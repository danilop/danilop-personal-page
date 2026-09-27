/* Compare findings as multisets: changing line numbers alone is not a new issue. */
(function (root) {
  function compareFixChecks(before, after) {
    const key = (f) =>
      JSON.stringify([f.rule, f.piece, f.severity, f.excerpt || f.message]);
    const remaining = [...(before.findings || [])];
    const added = [],
      retained = [];
    for (const f of after.findings || []) {
      const i = remaining.findIndex((old) => key(old) === key(f));
      if (i < 0) added.push(f);
      else {
        remaining.splice(i, 1);
        retained.push(f);
      }
    }
    const changed = [];
    // Similar wording is a changed finding, never evidence that an issue was fixed.
    for (let i = added.length - 1; i >= 0; i--) {
      const f = added[i],
        words = new Set(
          (f.excerpt || "").toLowerCase().match(/\p{L}+/gu) || [],
        );
      if (words.size < 4) continue;
      const j = remaining.findIndex((old) => {
        if (old.rule !== f.rule || old.piece !== f.piece) return false;
        const prior = new Set(
          (old.excerpt || "").toLowerCase().match(/\p{L}+/gu) || [],
        );
        const common = [...words].filter((w) => prior.has(w)).length;
        return common / Math.max(words.size, prior.size) >= 0.7;
      });
      if (j >= 0) {
        changed.push({
          before: remaining.splice(j, 1)[0],
          after: added.splice(i, 1)[0],
        });
      }
    }
    const incomplete = [before, after].some(
      (r) =>
        !(r.checks || []).length ||
        (r.checks || []).some(
          (c) => !["completed", "complete", "passed", "ok"].includes(c.status),
        ) ||
        (r.findings || []).some((f) => f.severity === "unavailable"),
    );
    return { added, retained, resolved: remaining, changed, incomplete };
  }
  if (typeof module !== "undefined") module.exports = { compareFixChecks };
  else root.compareFixChecks = compareFixChecks;
})(globalThis);
