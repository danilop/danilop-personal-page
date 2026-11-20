import fs from "node:fs/promises";
import path from "node:path";

// The site renders its own results; Pagefind's bundled UIs are not shipped.
const bundledUi = /^pagefind-(?:.+-)?ui\.(?:js|css)$|^pagefind-highlight\.js$/;

/**
 * Index the built pages with Pagefind. Only elements marked data-pagefind-body
 * are indexed; reading-index.ts and the page templates decide which.
 *
 * The index is taken from Pagefind in memory and written here. With Pagefind's
 * own writeFiles, a loaded CI build once read an empty pagefind-entry.json after
 * writeFiles had resolved and the backend was closed. Writing the bytes
 * ourselves makes completion explicit; the output is byte-identical.
 */
export async function buildSearchIndex(siteDir: string) {
  // Pagefind is ESM-only; the build scripts run as CommonJS.
  const pagefind = await import("pagefind");
  const output = path.join(siteDir, "pagefind");
  const { index, errors } = await pagefind.createIndex({ forceLanguage: "en" });
  if (!index) throw Error(errors.join("\n"));
  let files: { path: string; content: Uint8Array }[];
  try {
    const added = await index.addDirectory({
      path: siteDir,
      glob: "**/*.html",
    });
    if (added.errors.length) throw Error(added.errors.join("\n"));
    const built = await index.getFiles();
    if (built.errors.length) throw Error(built.errors.join("\n"));
    files = built.files;
  } finally {
    await pagefind.close();
  }
  let entry: { languages: Record<string, { page_count: number }> } | undefined;
  await fs.rm(output, { recursive: true, force: true });
  for (const file of files) {
    const relative = path.normalize(file.path);
    if (path.isAbsolute(relative) || relative.startsWith(".."))
      throw Error(`Unexpected search index path: ${file.path}`);
    if (bundledUi.test(relative)) continue;
    const target = path.join(output, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
    if (relative === "pagefind-entry.json")
      entry = JSON.parse(Buffer.from(file.content).toString("utf8"));
  }
  if (!entry) throw Error("Search index has no pagefind-entry.json");
  return Object.values(entry.languages).reduce((n, l) => n + l.page_count, 0);
}
