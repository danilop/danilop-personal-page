#!/usr/bin/env python3
"""Local read-only editorial analysis. Structured stdin/stdout; never downloads models."""

from __future__ import annotations

import ast
import importlib.metadata
import json
import os
import re
import statistics

# Only explicitly declared local examples run, with argv lists, isolated Python and timeouts.
import subprocess  # nosec B404 - required for the reviewed local example runner
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import TypedDict


class SequenceRow(TypedDict):
    stems: list[str]
    n: int
    count: int
    perPiece: dict[str, int]
    pieceCount: int
    example: str
    locations: list[dict]


HERE = Path(__file__).resolve().parent
SPELLINGS = json.loads((HERE / "british-spellings.json").read_text())
WORD = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
TOKEN = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?|[.!?;\ufffc]")
TECHNICAL = {
    "algorithm",
    "application",
    "browser",
    "code",
    "compiler",
    "computer",
    "database",
    "device",
    "file",
    "framework",
    "function",
    "hardware",
    "interface",
    "interpreter",
    "language",
    "machine",
    "mechanism",
    "model",
    "network",
    "object",
    "program",
    "protocol",
    "runtime",
    "server",
    "software",
    "system",
    "tool",
}
MENTAL = {
    "believe",
    "decide",
    "feel",
    "hope",
    "intend",
    "know",
    "promise",
    "refuse",
    "remember",
    "think",
    "understand",
    "want",
}
PHRASES = {
    "inflated-language": re.compile(
        r"\b(?:changed everything|changed the world|transformative impact|quantum leap|profound breakthrough|towering figure)\b",
        re.I,
    ),
    "stock-framing": re.compile(
        r"\b(?:at its core|it is worth noting|in a very real sense|as we conclude our exploration|in today[’\']s (?:fast-paced|rapidly evolving) world|let[’\']s (?:delve|dive) into|the key takeaway|a testament to)\b",
        re.I,
    ),
    "reader-flattery": re.compile(
        r"\b(?:great question|excellent question|you[’\']re absolutely right)\b", re.I
    ),
    "formulaic-signpost": re.compile(
        r"\b(?:here[’\']s the (?:thing|kicker)|let that sink in|the bottom line is)\b", re.I
    ),
    "contrast-frame": re.compile(
        r"\b(?:not (?:just|merely|simply|only)\b.{0,120}?\bbut\b|isn[’']t about\b.{0,120}?\bit[’']s about\b)",
        re.I,
    ),
}


def line_at(segment, offset=0):
    return segment["line"] + segment["text"][:offset].count("\n")


def source_range(segment, start, end):
    if "sourceStart" not in segment:
        return {}

    # Browser textarea offsets count UTF-16 units, including emoji surrogate pairs.
    def units(text):
        return len(text.encode("utf-16-le", errors="surrogatepass")) // 2

    return {
        "start": segment["sourceStart"] + units(segment["text"][:start]),
        "end": segment["sourceStart"] + units(segment["text"][:end]),
    }


def finding(piece, segment, rule, message, offset=0, excerpt=None, severity="review"):
    quote = excerpt or segment["text"].strip()
    result = {
        "piece": piece["id"],
        "line": line_at(segment, offset),
        "rule": rule,
        "severity": severity,
        "message": message,
        "excerpt": quote,
    }
    if segment["text"][offset : offset + len(quote)] == quote:
        result.update(source_range(segment, offset, offset + len(quote)))
    return result


def sequences(pieces, config, stemmer):
    """Literal contiguous stem n-grams; no crossing sentences, blocks, or pieces."""
    occurrences = defaultdict(list)
    for piece in pieces:
        if not piece["language"].lower().startswith("en"):
            continue
        for segment in piece["segments"]:
            runs, run = [], []
            for match in TOKEN.finditer(segment["text"]):
                if match.group() in ".!?;\ufffc":
                    if run:
                        runs.append(run)
                    run = []
                else:
                    run.append((match.group(), match.start()))
            if run:
                runs.append(run)
            for run in runs:
                stems = stemmer.stemWords([word.lower() for word, _ in run])
                for n in range(config["minN"], config["maxN"] + 1):
                    for start in range(len(stems) - n + 1):
                        phrase = tuple(stems[start : start + n])
                        offset = run[start][1]
                        occurrences[phrase].append(
                            dict(
                                piece=piece["id"],
                                line=line_at(segment, offset),
                                excerpt=segment["text"].strip(),
                                text=" ".join(w for w, _ in run[start : start + n]),
                                offset=offset,
                                **source_range(
                                    segment,
                                    offset,
                                    run[start + n - 1][1] + len(run[start + n - 1][0]),
                                ),
                            )
                        )
    rows: list[SequenceRow] = []
    for phrase, locations in occurrences.items():
        if len(locations) < config["minCount"]:
            continue
        counts = dict(sorted(Counter(loc["piece"] for loc in locations).items()))
        rows.append(
            {
                "stems": list(phrase),
                "n": len(phrase),
                "count": len(locations),
                "perPiece": counts,
                "pieceCount": len(counts),
                "example": locations[0]["text"],
                "locations": locations,
            }
        )
    return sorted(rows, key=lambda row: (-row["n"], -row["count"], row["stems"]))


def token_findings(piece, segment, sent):
    findings = []
    for token in sent:
        if (
            token.dep_ in {"nsubj", "nsubjpass"}
            and token.lemma_.lower() in TECHNICAL
            and token.head.lemma_.lower() in MENTAL
        ):
            findings.append(
                finding(
                    piece,
                    segment,
                    "technical-agency",
                    f"The parser links “{token.text}” to “{token.head.text}”. Review whether this wording describes a mechanism precisely; established technical usage may be valid.",
                    token.idx,
                    token.text,
                )
            )
        if (
            piece["language"].lower().replace("_", "-") == "en-gb"
            and token.text.lower() in SPELLINGS
        ):
            if token.pos_ == "PROPN" or token.ent_type_:
                continue
            findings.append(
                finding(
                    piece,
                    segment,
                    "british-spelling",
                    f"Consider “{SPELLINGS[token.text.lower()]}” for “{token.text}” in British English. Preserve official names and quoted wording.",
                    token.idx,
                    token.text,
                )
            )
    return findings


def analyse_nlp(piece, nlp, style):
    findings, records, adverbs, passive, words = [], [], 0, 0, 0
    lemmas = Counter()
    for segment_index, segment in enumerate(piece["segments"]):
        doc = nlp(segment["text"])
        for sent in doc.sents:
            tokens = [t for t in sent if t.is_alpha]
            if not tokens:
                continue
            words += len(tokens)
            excerpt = sent.text.strip()
            start = next(t.idx for t in sent if not t.is_space)
            # Dependency labels distinguish grammatical relations; these remain model predictions.
            is_passive = any(t.dep_ in {"nsubjpass", "auxpass", "csubjpass"} for t in sent)
            adv = [t for t in tokens if t.pos_ == "ADV"]
            adverbs += len(adv)
            passive += int(is_passive)
            records.append(
                {
                    "text": excerpt,
                    "words": len(tokens),
                    "segment": segment,
                    "segmentIndex": segment_index,
                    "offset": start,
                    "openerText": segment["text"][
                        start : tokens[min(1, len(tokens) - 1)].idx
                        + len(tokens[min(1, len(tokens) - 1)].text)
                    ],
                    "opener": " ".join(t.lemma_.lower() for t in tokens[:2]),
                }
            )
            lemmas.update(
                t.lemma_.lower() for t in tokens if t.pos_ in {"NOUN", "VERB"} and not t.is_stop
            )
            if is_passive:
                findings.append(
                    finding(
                        piece,
                        segment,
                        "passive-candidate",
                        "The parser identifies passive grammar. Keep it when the actor is unknown, unimportant, or deliberately unstated.",
                        start,
                        excerpt,
                    )
                )
            if len(tokens) > style["longSentenceWords"]:
                findings.append(
                    finding(
                        piece,
                        segment,
                        "long-sentence",
                        f"{len(tokens)} words; inspect the sentence structure rather than shortening automatically.",
                        start,
                        excerpt,
                    )
                )
            if len(adv) >= style["adverbsPerSentence"]:
                f = finding(
                    piece,
                    segment,
                    "adverb-cluster",
                    "Several grammatical adverbs: "
                    + ", ".join(t.text for t in adv)
                    + ". Check whether each adds meaning.",
                    start,
                    excerpt,
                )
                f["locations"] = [
                    dict(
                        piece=piece["id"],
                        line=line_at(segment, t.idx),
                        excerpt=t.text,
                        **source_range(segment, t.idx, t.idx + len(t.text)),
                    )
                    for t in adv
                ]
                findings.append(f)
            findings.extend(token_findings(piece, segment, sent))
    openers = defaultdict(list)
    for r in records:
        openers[r["opener"]].append(r)
    for opener, matches in openers.items():
        if (
            len(matches) >= style["openerMinimum"]
            and len(matches) / max(1, len(records)) >= style["openerFraction"]
        ):
            first = matches[0]
            f = finding(
                piece,
                first["segment"],
                "repeated-opener",
                f"{len(matches)} of {len(records)} sentences begin with the same two lemmas: “{opener}”.",
                first["offset"],
                first["text"],
            )
            f["locations"] = [
                dict(
                    piece=piece["id"],
                    line=line_at(r["segment"], r["offset"]),
                    excerpt=r["openerText"],
                    **source_range(r["segment"], r["offset"], r["offset"] + len(r["openerText"])),
                )
                for r in matches
            ]
            findings.append(f)
    run = []

    def flush():
        if len(run) >= style["shortSentenceRun"]:
            first = run[0]
            findings.append(
                finding(
                    piece,
                    first["segment"],
                    "short-sentence-run",
                    f"{len(run)} consecutive sentences have fewer than {style['shortSentenceWords']} words. Review the rhythm in context.",
                    first["offset"],
                    " ".join(r["text"] for r in run),
                )
            )

    previous_segment = None
    for r in records:
        if r["segmentIndex"] != previous_segment:
            flush()
            run = []
        if r["words"] < style["shortSentenceWords"]:
            run.append(r)
        else:
            flush()
            run = []
        previous_segment = r["segmentIndex"]
    flush()
    lengths = [r["words"] for r in records]
    return {
        "words": words,
        "sentences": len(records),
        "passiveSentences": passive,
        "passivePercent": round(100 * passive / max(1, len(records)), 1),
        "adverbs": adverbs,
        "adverbsPer1000": round(1000 * adverbs / max(1, words), 1),
        "meanSentenceWords": round(statistics.mean(lengths), 1) if lengths else 0,
        "sentenceLengthStdDev": round(statistics.pstdev(lengths), 1) if lengths else 0,
        "commonLemmas": lemmas.most_common(15),
    }, findings


def check_python(pieces, declarations, fragments):
    findings = []
    syntax = 0
    executed = 0
    skipped = 0
    results = []
    by_key = {(d["piece"], d["block"]): d for d in declarations}
    if len(by_key) != len(declarations):
        raise ValueError("Duplicate executable example declaration")
    seen = set()
    fragment_map = {(f["piece"], f["block"]): f for f in fragments}
    if len(fragment_map) != len(fragments) or set(fragment_map) & set(by_key):
        raise ValueError("Duplicate or conflicting fragment declarations")
    fragment_results = []
    for piece in pieces:
        for block in piece["pythonBlocks"]:
            key = (piece["id"], block["block"])
            seen.add(key)
            seg = {"text": block["text"], "line": block["line"]}
            if key in fragment_map:
                fragment_results.append(fragment_map[key])
                continue
            declaration = by_key.get(key)
            if not declaration:
                try:
                    ast.parse(block["text"])
                except SyntaxError as error:
                    findings.append(
                        finding(piece, seg, "python-syntax", str(error), severity="error")
                    )
                    continue
                syntax += 1
                skipped += 1
                continue
            try:
                runtime = subprocess.run(  # nosec B603 - declared interpreter, fixed argv, shell disabled
                    [
                        declaration["python"],
                        "-I",
                        "-c",
                        'import sys; print("%d.%d" % sys.version_info[:2])',
                    ],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    env={"PATH": os.environ.get("PATH", ""), "LANG": "en_US.UTF-8"},
                )
                if runtime.returncode or runtime.stdout.strip() != declaration["version"]:
                    raise RuntimeError(
                        f"Expected Python {declaration['version']}; got {runtime.stdout.strip() or 'no version'}"
                    )
                parsed = subprocess.run(  # nosec B603 - declared interpreter, fixed argv, shell disabled
                    [
                        declaration["python"],
                        "-I",
                        "-c",
                        "import ast,sys; ast.parse(sys.stdin.read())",
                    ],
                    input=block["text"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    env={"PATH": os.environ.get("PATH", ""), "LANG": "en_US.UTF-8"},
                )
                if parsed.returncode:
                    findings.append(
                        finding(
                            piece, seg, "python-syntax", parsed.stderr[-1000:], severity="error"
                        )
                    )
                    continue
                syntax += 1
                with tempfile.TemporaryDirectory(prefix="content-example-") as directory:
                    script = Path(directory) / "example.py"
                    script.write_text(block["text"])
                    result = subprocess.run(  # nosec B603 - declared interpreter, fixed argv, shell disabled
                        [declaration["python"], "-I", str(script)],
                        cwd=directory,
                        capture_output=True,
                        text=True,
                        timeout=declaration["timeoutSeconds"],
                        env={"PATH": os.environ.get("PATH", ""), "LANG": "en_US.UTF-8"},
                    )
                executed += 1
                ok = result.returncode == 0 and result.stdout == declaration["stdout"]
                results.append(
                    {
                        "piece": piece["id"],
                        "block": block["block"],
                        "status": "passed" if ok else "failed",
                        "python": runtime.stdout.strip(),
                        "stdout": result.stdout[:10000],
                    }
                )
                if not ok:
                    findings.append(
                        finding(
                            piece,
                            seg,
                            "python-result",
                            f"Example exited {result.returncode} or output differed from the declared expectation. "
                            + result.stderr[-1000:],
                            severity="error",
                        )
                    )
            except FileNotFoundError:
                findings.append(
                    finding(
                        piece,
                        seg,
                        "python-runtime",
                        "Declared Python interpreter is unavailable.",
                        severity="unavailable",
                    )
                )
            except subprocess.TimeoutExpired:
                findings.append(
                    finding(
                        piece,
                        seg,
                        "python-timeout",
                        "Declared example exceeded its time limit.",
                        severity="error",
                    )
                )
            except RuntimeError as error:
                findings.append(
                    finding(piece, seg, "python-runtime", str(error), severity="unavailable")
                )
    for key in (set(by_key) | set(fragment_map)) - seen:
        findings.append(
            {
                "piece": key[0],
                "line": 1,
                "excerpt": "",
                "rule": "python-declaration",
                "severity": "error",
                "message": f"Declared Python block {key[1]} is missing from selected pieces.",
            }
        )
    return findings, {
        "syntaxChecked": syntax,
        "executed": executed,
        "notExecuted": skipped,
        "fragments": fragment_results,
        "results": results,
    }


def prose_findings(english):
    findings = []
    for p in english:
        for seg in p["segments"]:
            for rule, pattern in PHRASES.items():
                for match in pattern.finditer(seg["text"]):
                    findings.append(
                        finding(
                            p,
                            seg,
                            rule,
                            "Review this stock construction in context; it is not automatically wrong.",
                            match.start(),
                            match.group(),
                        )
                    )
            match = re.search(
                r"\b(?:appendix|subject index|previous chapter|next chapter)\b", seg["text"], re.I
            )
            if match:
                findings.append(
                    finding(
                        p,
                        seg,
                        "book-context",
                        "Check that this book-specific reference is useful and reachable in the published reading context.",
                        match.start(),
                        match.group(),
                    )
                )
    return findings


def analyse(payload):
    pieces, config = payload["pieces"], payload["config"]
    checks = []
    findings = []
    repetitions = []
    metrics = {}
    versions = {"python": sys.version.split()[0]}
    english = [p for p in pieces if p["language"].lower().startswith("en")]
    for p in pieces:
        if p not in english:
            findings.append(
                {
                    "piece": p["id"],
                    "line": 1,
                    "excerpt": p["language"],
                    "rule": "unsupported-language",
                    "severity": "unavailable",
                    "message": "This linguistic profile supports English only; no English stem or grammar results are claimed for this piece.",
                }
            )
    try:
        import snowballstemmer

        versions["snowballstemmer"] = importlib.metadata.version("snowballstemmer")
        repetitions = sequences(english, config["repetition"], snowballstemmer.stemmer("english"))
        checks.append(
            {
                "name": "Stem sequences",
                "status": "completed",
                "detail": f"{len(repetitions)} repeated sequences; all occurrences retained in JSON.",
            }
        )
        # Prioritize longer, non-function-word sequences. Keep raw counts separately.
        candidates = []
        for row in repetitions:
            if row["n"] < 5:
                continue
            location_keys = {(location["piece"], location["line"]) for location in row["locations"]}
            if any(
                location_keys == keys and " ".join(row["stems"]) in phrase
                for keys, phrase in candidates
            ):
                continue
            candidates.append((location_keys, " ".join(row["stems"])))
            first = row["locations"][0]
            findings.append(
                {
                    "piece": first["piece"],
                    "line": first["line"],
                    "excerpt": row["example"],
                    "rule": "repeated-stem-sequence",
                    "severity": "review",
                    "message": f"{row['count']} occurrences of {row['n']} consecutive stems across {row['pieceCount']} piece(s). Preserve necessary terminology and deliberate repetition.",
                    "locations": row["locations"],
                }
            )
    except Exception as error:
        checks.append({"name": "Stem sequences", "status": "unavailable", "detail": str(error)})
        findings.append(
            {
                "piece": "",
                "line": 0,
                "excerpt": "",
                "rule": "stem-engine",
                "severity": "unavailable",
                "message": str(error),
            }
        )
    try:
        import spacy

        nlp = spacy.load(config["model"])
        if nlp.lang != "en":
            raise RuntimeError("Expected an English NLP model")
        for component in ["parser", "tagger", "lemmatizer", "ner"]:
            if component not in nlp.pipe_names:
                raise RuntimeError("Model lacks required component: " + component)
        versions["spacy"] = spacy.__version__
        versions["model"] = {
            "name": config["model"],
            "version": nlp.meta.get("version"),
            "pipeline": nlp.pipe_names,
        }
        for p in english:
            metrics[p["id"]], found = analyse_nlp(p, nlp, config["style"])
            findings.extend(found)
        checks.append(
            {
                "name": "Linguistic analysis",
                "status": "completed",
                "detail": "Sentence boundaries, POS, lemmas, dependency relations, and entity-aware British spelling. Model predictions require review.",
            }
        )
    except Exception as error:
        checks.append(
            {"name": "Linguistic analysis", "status": "unavailable", "detail": str(error)}
        )
        findings.append(
            {
                "piece": "",
                "line": 0,
                "excerpt": "",
                "rule": "nlp-engine",
                "severity": "unavailable",
                "message": "Linguistic analysis incomplete: " + str(error),
            }
        )
    findings.extend(prose_findings(english))
    checks.append(
        {
            "name": "Prose patterns",
            "status": "completed",
            "detail": "Focused framing, inflation, contrast, and book-context checks.",
        }
    )
    found, examples = check_python(pieces, config["examples"], config["fragments"])
    findings.extend(found)
    checks.append(
        {
            "name": "Python examples",
            "status": "completed",
            "detail": f"{examples['syntaxChecked']} syntax checks; {examples['executed']} declared executions; {examples['notExecuted']} blocks not declared for execution; {len(examples['fragments'])} declared fragments excluded. Failures are listed separately.",
        }
    )
    return {
        "checks": checks,
        "findings": findings,
        "repetitions": repetitions,
        "metrics": metrics,
        "versions": versions,
        "examples": examples,
    }


if __name__ == "__main__":
    try:
        result = analyse(json.load(sys.stdin))
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"fatal": str(error)}))
        sys.exit(2)
