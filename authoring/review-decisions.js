/* Author decisions belong to one review, not to a permanent ignore list. */
(function (root) {
  function createReviewDecisions() {
    const decisions = new Map();
    const identity = (finding) =>
      JSON.stringify([
        finding.piece,
        finding.rule,
        finding.excerpt,
        finding.message,
        finding.start,
        finding.line,
        finding.locations,
      ]);
    const key = (review, finding) =>
      JSON.stringify([review.id, review.kind, identity(finding)]);
    return {
      get: (review, finding) => decisions.get(key(review, finding)) || "open",
      set(review, finding, status) {
        if (!["open", "addressed", "kept"].includes(status))
          throw Error("Unknown review decision");
        if (status === "open") decisions.delete(key(review, finding));
        else decisions.set(key(review, finding), status);
      },
      counts(review, findings) {
        const counts = { open: 0, addressed: 0, kept: 0 };
        for (const finding of findings) counts[this.get(review, finding)]++;
        return counts;
      },
    };
  }
  if (typeof module !== "undefined") module.exports = { createReviewDecisions };
  else root.createReviewDecisions = createReviewDecisions;
})(typeof window !== "undefined" ? window : globalThis);
