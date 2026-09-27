import sys
import unittest

import analyze as qa
import snowballstemmer
import spacy

CONFIG = {
    "model": "en_core_web_sm",
    "repetition": {"minN": 3, "maxN": 8, "minCount": 2},
    "style": {
        "longSentenceWords": 40,
        "adverbsPerSentence": 3,
        "openerMinimum": 4,
        "openerFraction": 0.2,
        "shortSentenceWords": 8,
        "shortSentenceRun": 3,
    },
    "examples": [],
    "fragments": [],
}


def piece(id, text, language="en-GB"):
    return {
        "id": id,
        "language": language,
        "segments": [{"text": text, "line": 10, "kind": "paragraph"}],
        "pythonBlocks": [],
    }


class QualityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nlp = spacy.load("en_core_web_sm")
        cls.stemmer = snowballstemmer.stemmer("english")

    def test_exact_stem_ranges_include_unicode_and_distinct_occurrences(self):
        text = "😀 Records store useful values. Records store useful values."
        p = piece("one", text)
        p["segments"][0]["sourceStart"] = 20
        row = next(r for r in qa.sequences([p], CONFIG["repetition"], self.stemmer) if r["n"] == 4)
        self.assertEqual([location["start"] for location in row["locations"]], [23, 52])
        self.assertEqual(
            [location["end"] - location["start"] for location in row["locations"]], [27, 27]
        )

    def test_stock_phrase_range_is_not_the_surrounding_paragraph(self):
        seg = {"text": "Before, at its core, after.", "line": 1, "sourceStart": 5}
        f = qa.finding({"id": "one"}, seg, "stock-framing", "Review", 8, "at its core")
        self.assertEqual((f["start"], f["end"]), (13, 24))

    def test_inflections_group_and_counts_retain_all_occurrences(self):
        pieces = [
            piece(
                "one",
                "Programmers counted stored values carefully. Programmer counts storing value carefully.",
            ),
            piece("two", "Programmers counted stored values carefully."),
        ]
        rows = qa.sequences(pieces, CONFIG["repetition"], self.stemmer)
        row = next(r for r in rows if r["n"] == 5)
        self.assertEqual(row["count"], 3)
        self.assertEqual(row["perPiece"], {"one": 2, "two": 1})
        self.assertEqual(len(row["locations"]), 3)

    def test_no_sequences_cross_sentence_paragraph_code_or_piece_boundaries(self):
        p = piece("one", "alpha beta. gamma delta. alpha beta\ufffc gamma delta")
        p["segments"] += [{"text": "alpha beta", "line": 20}, {"text": "gamma delta", "line": 22}]
        rows = qa.sequences(
            [p, piece("two", "alpha beta"), piece("three", "gamma delta")],
            CONFIG["repetition"],
            self.stemmer,
        )
        self.assertEqual(rows, [])

    def test_source_line_for_repeated_phrase_on_wrapped_line(self):
        p = piece(
            "one", "Opening words.\nRecords store useful values.\nRecords store useful values."
        )
        row = next(r for r in qa.sequences([p], CONFIG["repetition"], self.stemmer) if r["n"] == 4)
        self.assertEqual([location["line"] for location in row["locations"]], [11, 12])

    def test_dependency_agency_distinguishes_human_subject(self):
        _, found = qa.analyse_nlp(
            piece("one", "The database remembers every visitor."), self.nlp, CONFIG["style"]
        )
        self.assertTrue(any(f["rule"] == "technical-agency" for f in found))
        _, found = qa.analyse_nlp(
            piece("two", "The programmer remembers the database."), self.nlp, CONFIG["style"]
        )
        self.assertFalse(any(f["rule"] == "technical-agency" for f in found))

    def test_passive_and_adverb_pos_analysis(self):
        metrics, found = qa.analyse_nlp(
            piece("one", "The results were carefully recorded by the researchers."),
            self.nlp,
            CONFIG["style"],
        )
        self.assertEqual(metrics["passiveSentences"], 1)
        self.assertGreaterEqual(metrics["adverbs"], 1)
        self.assertTrue(any(f["rule"] == "passive-candidate" for f in found))

    def test_british_profile_and_proper_names(self):
        for language, expected in [("en-GB", True), ("en-US", False)]:
            _, found = qa.analyse_nlp(
                piece("one", "The color was recorded.", language), self.nlp, CONFIG["style"]
            )
            self.assertEqual(any(f["rule"] == "british-spelling" for f in found), expected)
        _, found = qa.analyse_nlp(
            piece("one", "The Department of Defense published a report."), self.nlp, CONFIG["style"]
        )
        self.assertFalse(any(f["rule"] == "british-spelling" for f in found))

    def test_short_rhythm_does_not_join_separate_paragraphs(self):
        p = piece("one", "We counted. We recorded. We checked.")
        _, found = qa.analyse_nlp(p, self.nlp, CONFIG["style"])
        self.assertTrue(any(f["rule"] == "short-sentence-run" for f in found))
        p["segments"] = [
            {"text": text, "line": n}
            for n, text in enumerate(["We counted.", "We recorded.", "We checked."])
        ]
        _, found = qa.analyse_nlp(p, self.nlp, CONFIG["style"])
        self.assertFalse(any(f["rule"] == "short-sentence-run" for f in found))

    def test_code_expectations_and_fragments(self):
        p = piece("one", "")
        p["pythonBlocks"] = [{"text": "print(2*3)", "line": 12, "block": 1}]
        declaration = {
            "piece": "one",
            "block": 1,
            "python": sys.executable,
            "version": f"{sys.version_info.major}.{sys.version_info.minor}",
            "stdout": "6\n",
            "timeoutSeconds": 2,
        }
        findings, result = qa.check_python([p], [declaration], [])
        self.assertEqual(findings, [])
        self.assertEqual(result["executed"], 1)
        declaration["stdout"] = "7\n"
        findings, _ = qa.check_python([p], [declaration], [])
        self.assertTrue(any(f["rule"] == "python-result" for f in findings))
        p["pythonBlocks"][0]["text"] = "for x in"
        findings, _ = qa.check_python([p], [], [])
        self.assertTrue(any(f["rule"] == "python-syntax" for f in findings))
        findings, result = qa.check_python(
            [p], [], [{"piece": "one", "block": 1, "reason": "Intentional syntax fragment"}]
        )
        self.assertEqual(findings, [])
        self.assertEqual(len(result["fragments"]), 1)

    def test_declared_example_timeout_and_missing_runtime_are_distinct(self):
        p = piece("one", "")
        p["pythonBlocks"] = [{"text": "while True: pass", "line": 12, "block": 1}]
        d = {
            "piece": "one",
            "block": 1,
            "python": sys.executable,
            "version": f"{sys.version_info.major}.{sys.version_info.minor}",
            "stdout": "",
            "timeoutSeconds": 1,
        }
        found, _ = qa.check_python([p], [d], [])
        self.assertTrue(
            any(f["rule"] == "python-timeout" and f["severity"] == "error" for f in found)
        )
        d["python"] = "/nonexistent/editorial/python"
        found, _ = qa.check_python([p], [d], [])
        self.assertTrue(
            any(f["rule"] == "python-runtime" and f["severity"] == "unavailable" for f in found)
        )

    def test_undeclared_code_is_never_executed(self):
        p = piece("one", "")
        p["pythonBlocks"] = [{"text": 'raise RuntimeError("must not run")', "line": 12, "block": 1}]
        findings, result = qa.check_python([p], [], [])
        self.assertEqual(findings, [])
        self.assertEqual(result["executed"], 0)
        self.assertEqual(result["notExecuted"], 1)

    def test_unavailable_model_keeps_stem_counts_and_is_not_a_pass(self):
        config = {**CONFIG, "model": "nonexistent_editorial_test_model"}
        result = qa.analyse(
            {
                "pieces": [piece("one", "We stored useful records. We stored useful records.")],
                "config": config,
            }
        )
        self.assertTrue(result["repetitions"])
        self.assertTrue(
            any(
                f["severity"] == "unavailable" and f["rule"] == "nlp-engine"
                for f in result["findings"]
            )
        )

    def test_non_english_is_explicitly_unsupported(self):
        result = qa.analyse(
            {"pieces": [piece("one", "Un texte français.", "fr")], "config": CONFIG}
        )
        self.assertTrue(any(f["rule"] == "unsupported-language" for f in result["findings"]))
        self.assertNotIn("one", result["metrics"])

    def test_mannerism_patterns_are_advisory_and_specific(self):
        cases = [
            ("reader-flattery", "Excellent question."),
            ("formulaic-signpost", "Here’s the kicker: the records persisted."),
            ("stock-framing", "Let's delve into the topic."),
        ]
        for rule, text in cases:
            self.assertIsNotNone(qa.PHRASES[rule].search(text))
        self.assertIsNone(qa.PHRASES["reader-flattery"].search("The question was recorded."))

    def test_empty_prose_is_well_defined(self):
        metrics, findings = qa.analyse_nlp(piece("empty", ""), self.nlp, CONFIG["style"])
        self.assertEqual(metrics["words"], 0)
        self.assertEqual(metrics["sentences"], 0)
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
