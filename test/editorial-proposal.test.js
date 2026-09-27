const { test } = require("node:test");
const assert = require("node:assert/strict");
const { editorialProposal } = require("../authoring/finding-range");
const sentence =
  "The subject index helps you follow a particular topic across those periods without repeating its full explanation each time.";
const source = "Opening sentence. " + sentence + " Another sentence.";
const finding = {
  line: 1,
  excerpt: "without repeating its full explanation each time",
  suggestion:
    "'The text does not repeat a topic’s full explanation in each period; the subject index helps you follow it across those periods.'",
  verified: true,
};
test("older free-text suggestions offer drafting scopes but never replacement text", () => {
  const p = editorialProposal(source, finding);
  assert.equal(p.ready, false);
  assert.equal(p.options[0].before, finding.excerpt);
  assert.equal(
    p.options.find((o) => o.label === "Whole sentence").before,
    sentence,
  );
  assert.equal(p.after, null);
});
test("exact replacements can be reviewed directly, including deletion", () => {
  const p = editorialProposal(source, {
    ...finding,
    replacement: { before: sentence, after: "" },
  });
  assert.equal(p.ready, true);
  assert.equal(p.options[0].before, sentence);
  assert.equal(p.after, "");
});
test("invented or unrelated replacement targets never auto-select a range", () => {
  for (const before of ["Invented text", "Opening sentence."]) {
    const proposal = editorialProposal(source, {
      ...finding,
      replacement: { before, after: "Wrong" },
    });
    assert.equal(proposal.ready, false);
    assert.equal(proposal.after, null);
  }
});

test("generic advice and unanswered questions can never be applied as prose", () => {
  for (const suggestion of [
    "Explain why this matters.",
    "Reorganise this paragraph.",
    "'Add a concrete example.'",
  ]) {
    const p = editorialProposal(source, {
      ...finding,
      suggestion,
      replacement: null,
    });
    assert.equal(p.ready, false);
    assert.equal(p.after, null);
  }
  const p = editorialProposal(source, {
    ...finding,
    question: "Which topic do you mean?",
    replacement: { before: sentence, after: "An invented answer." },
  });
  assert.equal(p.ready, false);
  assert.equal(p.after, null);
});
test("unverified findings and unmatched quotes cannot replace text", () => {
  assert.deepEqual(
    editorialProposal(source, { ...finding, verified: false }).options,
    [],
  );
  assert.deepEqual(
    editorialProposal(source, { ...finding, excerpt: "No match" }).options,
    [],
  );
});
test("repeated text uses the reviewed occurrence and preserves Unicode offsets", () => {
  const text = "😀 First.\n" + sentence + "\n\n" + sentence;
  const p = editorialProposal(text, {
    ...finding,
    line: 4,
    replacement: { before: sentence, after: "Replacement." },
  });
  assert.equal(p.options[0].start, text.lastIndexOf(sentence));
});
