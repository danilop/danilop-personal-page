/* Shared browser/test helper: source ranges are UTF-16, end exclusive. */
(function (root) {
  function findingRange(source, location) {
    const { start, end } = location;
    if (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      end <= source.length
    )
      return { start, end };
    const lines = source.split("\n");
    const line = Math.max(1, Math.min(location.line || 1, lines.length));
    const offset =
      lines.slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
    const quote = location.text || location.excerpt;
    if (quote) {
      // Restrict the anchor to the reported line; never jump to another occurrence.
      const at = source.indexOf(quote, offset);
      if (at >= offset && at <= offset + lines[line - 1].length)
        return { start: at, end: at + quote.length };
    }
    // A missing precise match gets a caret, not a misleading full-line selection.
    return { start: offset, end: offset };
  }
  function unchangedRange(source, reviewedSource, oldRange) {
    let prefix = 0;
    while (
      prefix < source.length &&
      prefix < reviewedSource.length &&
      source[prefix] === reviewedSource[prefix]
    )
      prefix++;
    let suffix = 0;
    while (
      suffix < source.length - prefix &&
      suffix < reviewedSource.length - prefix &&
      source[source.length - 1 - suffix] ===
        reviewedSource[reviewedSource.length - 1 - suffix]
    )
      suffix++;
    if (oldRange.end <= prefix) return oldRange;
    if (oldRange.start >= reviewedSource.length - suffix) {
      const shift = source.length - reviewedSource.length;
      return { start: oldRange.start + shift, end: oldRange.end + shift };
    }

    return null;
  }
  function relocateFinding(source, location, reviewedSource) {
    const oldRange =
      typeof reviewedSource === "string"
        ? findingRange(reviewedSource, location)
        : null;
    const quote =
      oldRange && oldRange.end > oldRange.start
        ? reviewedSource.slice(oldRange.start, oldRange.end)
        : location.text || location.excerpt;
    if (!quote) return null;
    if (oldRange && oldRange.end > oldRange.start) {
      const unchanged = unchangedRange(source, reviewedSource, oldRange);
      if (unchanged) return unchanged;
    }
    const matches = [];
    for (
      let at = source.indexOf(quote);
      at >= 0;
      at = source.indexOf(quote, at + 1)
    )
      matches.push({ start: at, end: at + quote.length });
    const appearedOnce =
      typeof reviewedSource !== "string" ||
      reviewedSource.indexOf(quote) === reviewedSource.lastIndexOf(quote);
    if (matches.length === 1 && appearedOnce) return matches[0];
    if (oldRange && oldRange.end > oldRange.start && matches.length > 0) {
      const before = reviewedSource.slice(
        Math.max(0, oldRange.start - 40),
        oldRange.start,
      );
      const after = reviewedSource.slice(oldRange.end, oldRange.end + 40);
      const anchored = matches.filter(
        (r) =>
          source.slice(Math.max(0, r.start - before.length), r.start) ===
            before && source.slice(r.end, r.end + after.length) === after,
      );
      if (anchored.length === 1) return anchored[0];
    }
    return null;
  }
  // Only explicit, verified replacement pairs are edits. Free text is advice.
  function editorialProposal(source, finding) {
    const range = findingRange(source, finding);
    if (finding.verified === false || range.end <= range.start)
      return { options: [], after: null, ready: false };
    const replacement = finding.replacement;
    if (
      !finding.question?.trim() &&
      replacement &&
      typeof replacement.before === "string" &&
      typeof replacement.after === "string" &&
      replacement.before.length
    ) {
      let at = source.indexOf(replacement.before);
      while (at >= 0) {
        if (at <= range.start && at + replacement.before.length >= range.end) {
          // Preserve exact whitespace in verified model replacements.
          return {
            options: [
              {
                label: "Proposed passage",
                start: at,
                end: at + replacement.before.length,
                before: replacement.before,
              },
            ],
            after: replacement.after,
            ready: true,
          };
        }
        at = source.indexOf(replacement.before, at + 1);
      }
    }
    return {
      options: draftingOptions(source, range),
      after: null,
      ready: false,
    };
  }
  function draftingOptions(source, range) {
    const options = [];
    const add = (label, start, end) => {
      while (start < end && /\s/.test(source[start])) start++;
      while (end > start && /\s/.test(source[end - 1])) end--;
      if (!options.some((o) => o.start === start && o.end === end))
        options.push({ label, start, end, before: source.slice(start, end) });
    };
    add("Quoted passage", range.start, range.end);
    const start = source.lastIndexOf("\n\n", range.start - 1) + 2;
    const endAt = source.indexOf("\n\n", range.end);
    const paraStart = start === 1 ? 0 : start;
    const paraEnd = endAt < 0 ? source.length : endAt;
    if (typeof Intl.Segmenter === "function") {
      for (const part of new Intl.Segmenter("en", {
        granularity: "sentence",
      }).segment(source.slice(paraStart, paraEnd))) {
        const a = paraStart + part.index,
          b = a + part.segment.length;
        if (a <= range.start && b >= range.end) add("Whole sentence", a, b);
      }
    }
    add("Whole paragraph", paraStart, paraEnd);
    return options;
  }
  function editorialAction(finding, ready = !!finding.replacement) {
    if (finding.question) return "Answer question";
    if (ready) return "Review edit";
    return finding.suggestion || finding.replacement
      ? "Draft an edit"
      : "Suggest a fix";
  }
  if (typeof module !== "undefined")
    module.exports = {
      findingRange,
      relocateFinding,
      editorialProposal,
      editorialAction,
    };
  else {
    root.findingRange = findingRange;
    root.relocateFinding = relocateFinding;
    root.editorialProposal = editorialProposal;
    root.editorialAction = editorialAction;
  }
})(typeof window !== "undefined" ? window : globalThis);
