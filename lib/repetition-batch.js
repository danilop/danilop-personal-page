/* Shared browser/server preparation; offsets are UTF-16, end exclusive. */
(function (root) {
  function repetitionBatch(source, rows) {
    const blocks = [
      ...source.matchAll(/[^\r\n](?:[^\n]|\n(?![ \t]*\r?\n))*/g),
    ].map((m) => ({ start: m.index, end: m.index + m[0].trimEnd().length }));
    const targets = new Map();
    const groups = rows.map((row) => {
      const locations = [...row.locations]
        .sort((a, b) => a.start - b.start)
        .map((l, i, all) => {
          if (
            !Number.isInteger(l.start) ||
            !Number.isInteger(l.end) ||
            l.start < 0 ||
            l.end <= l.start ||
            l.end > source.length ||
            source.slice(l.start, l.end) !== l.text
          )
            throw Error(
              "The repetition list no longer matches this article. Rerun Writing checks.",
            );
          const blockIndex = blocks.findIndex(
            (b) => b.start <= l.start && b.end >= l.end,
          );
          if (blockIndex < 0)
            throw Error(
              "Could not anchor a repetition to a paragraph. Rerun Writing checks.",
            );
          const block = blocks[blockIndex];
          const prefix = source.slice(0, l.start);
          // A report must never turn article metadata into a prose-edit target.
          const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(
            source,
          );
          if (frontmatter && block.start < frontmatter[0].length)
            throw Error("Repetition targets must be in the article body.");
          targets.set(block.start, {
            ...block,
            before: source.slice(block.start, block.end),
          });
          return {
            ...l,
            line: prefix.split("\n").length,
            paragraph: blockIndex + 1,
            section:
              [...prefix.matchAll(/^#{1,6}\s+(.+)$/gm)].at(-1)?.[1] ||
              "Opening",
            ...(i
              ? {
                  wordsSincePrevious: source
                    .slice(all[i - 1].end, l.start)
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean).length,
                  linesSincePrevious:
                    source.slice(all[i - 1].start, l.start).split("\n").length -
                    1,
                }
              : {}),
          };
        });
      return {
        example: row.example,
        n: row.n,
        count: locations.length,
        locations,
      };
    });
    const ordered = [...targets.values()].sort((a, b) => a.start - b.start);
    if (ordered.length > 100)
      throw Error(
        "This report spans more than 100 paragraphs. Review individual repetition groups instead.",
      );
    return { groups, targets: ordered };
  }
  if (typeof module !== "undefined") module.exports = { repetitionBatch };
  else root.repetitionBatch = repetitionBatch;
})(globalThis);
