const { test } = require("node:test");
const assert = require("node:assert/strict");
const { findingRange } = require("../authoring/finding-range");
test("precise ranges distinguish repeated occurrences on the same line", () => {
  const s = "😀 marks count, marks counted.";
  const at = s.indexOf("marks", 5);
  const r = findingRange(s, { line: 1, start: at, end: at + 13 });
  assert.equal(s.slice(r.start, r.end), "marks counted");
});
test("quotes highlight only a phrase, including across source lines", () => {
  const s = "Intro\nOne specific phrase\ncontinues here. More.";
  const r = findingRange(s, {
    line: 2,
    excerpt: "specific phrase\ncontinues here.",
  });
  assert.equal(s.slice(r.start, r.end), "specific phrase\ncontinues here.");
});
test("missing exact quotes never expand to a line or match another line", () => {
  assert.deepEqual(
    findingRange("One line\nOther phrase", {
      line: 1,
      excerpt: "Other phrase",
    }),
    { start: 0, end: 0 },
  );
});
const { relocateFinding } = require("../authoring/finding-range");
test("editing one passage leaves other findings navigable at their new offsets", () => {
  const old = "First issue.\n\nSecond finding.\n\nThird finding.";
  const changed =
    "A longer rewrite of the first passage.\n\nSecond finding.\n\nThird finding.";
  assert.equal(
    relocateFinding(changed, { line: 1, excerpt: "First issue." }, old),
    null,
  );
  for (const [line, excerpt] of [
    [3, "Second finding."],
    [5, "Third finding."],
  ]) {
    const range = relocateFinding(changed, { line, excerpt }, old);
    assert.equal(changed.slice(range.start, range.end), excerpt);
  }
});
test("changed repeated phrases never jump to another surviving occurrence", () => {
  const old = "Same phrase.\n\nSame phrase.";
  const changed = "Rewritten sentence.\n\nSame phrase.";
  assert.equal(
    relocateFinding(changed, { line: 1, excerpt: "Same phrase." }, old),
    null,
  );
  assert.deepEqual(
    relocateFinding(changed, { line: 3, excerpt: "Same phrase." }, old),
    { start: changed.lastIndexOf("Same phrase."), end: changed.length },
  );
});
test("unmatched and ambiguous locations stay disabled while unique exact quotes relocate", () => {
  assert.equal(
    relocateFinding("One quote. One quote.", { excerpt: "One quote." }),
    null,
  );
  assert.equal(relocateFinding("No match", { excerpt: "Missing" }), null);
  const old = "Before.\n\n😀 Exact phrase.\n\nAfter.";
  const text = "New start.\n\n😀 Exact phrase.\n\nNew ending.";
  const r = relocateFinding(text, { line: 3, excerpt: "Exact phrase." }, old);
  assert.equal(text.slice(r.start, r.end), "Exact phrase.");
});
