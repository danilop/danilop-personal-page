import YAML from "yaml";

const header = /^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/;

/** Run inside the source save lock, before validation and atomic replacement. */
export function stampPublication(
  previous: string,
  next: string,
  now: () => string = () => new Date().toISOString(),
) {
  const before = header.exec(previous),
    after = header.exec(next);
  if (!after) return next; // The normal validator reports missing frontmatter.
  const doc = YAML.parseDocument(after[2]);
  if (doc.errors.length) throw doc.errors[0];
  const data = doc.toJS({ maxAliasCount: 0 });
  const old = before ? YAML.parse(before[2], { maxAliasCount: 0 }) : {};
  const published =
    (data.status ?? (data.draft ? "draft" : "published")) === "published";
  // A date already saved is publication history, including after unpublishing.
  const timestamp = old?.publishedAt ?? (published ? now() : undefined);
  if (data.publishedAt === timestamp) return next;
  if (timestamp === undefined) doc.delete("publishedAt");
  else doc.set("publishedAt", timestamp);
  return after[1] + doc.toString().trimEnd() + after[3] + after[4];
}
