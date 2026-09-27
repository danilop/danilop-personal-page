const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createReviewDecisions } = require("../authoring/review-decisions");
const report = { id: "review-1", kind: "ai" };
const finding = {
  piece: "intro",
  rule: "clarity",
  excerpt: "The subject index",
  message: "Unclear subject",
  line: 17,
};
test("author decisions distinguish addressed from retaining the original and can be reopened", () => {
  const d = createReviewDecisions();
  d.set(report, finding, "addressed");
  const other = { ...finding, line: 25, excerpt: "Another passage" };
  d.set(report, other, "kept");
  assert.deepEqual(d.counts(report, [finding, other]), {
    open: 0,
    addressed: 1,
    kept: 1,
  });
  d.set(report, finding, "open");
  assert.deepEqual(d.counts(report, [finding, other]), {
    open: 1,
    addressed: 0,
    kept: 1,
  });
});
test("a fresh review or another piece never inherits addressed or kept decisions", () => {
  const d = createReviewDecisions();
  d.set(report, finding, "addressed");
  assert.equal(d.get({ ...report, id: "review-2" }, finding), "open");
  assert.equal(d.get({ ...report, kind: "checks" }, finding), "open");
  assert.equal(d.get(report, { ...finding, piece: "chapter" }), "open");
  assert.equal(d.get(report, finding), "addressed");
});
test("manual decisions do not alter the review evidence or claim a check passed", () => {
  const d = createReviewDecisions();
  const frozen = Object.freeze({ ...finding });
  d.set(report, frozen, "addressed");
  assert.equal(d.get(report, frozen), "addressed");
  assert.equal(frozen.severity, undefined);
  assert.throws(
    () => d.set(report, frozen, "passed"),
    /Unknown review decision/,
  );
});
