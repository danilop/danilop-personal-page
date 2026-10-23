import fs from "node:fs/promises";
import path from "node:path";

/**
 * Index the built pages with Pagefind. Only elements marked data-pagefind-body
 * are indexed; reading-index.ts and the page templates decide which.
 */
export async function buildSearchIndex(siteDir: string) {
  // Pagefind is ESM-only; the build scripts run as CommonJS.
  const pagefind = await import("pagefind");
  const output = path.join(siteDir, "pagefind");
  const { index, errors } = await pagefind.createIndex({ forceLanguage: "en" });
  if (!index) throw Error(errors.join("\n"));
  try {
    const added = await index.addDirectory({
      path: siteDir,
      glob: "**/*.html",
    });
    if (added.errors.length) throw Error(added.errors.join("\n"));
    const written = await index.writeFiles({ outputPath: output });
    if (written.errors.length) throw Error(written.errors.join("\n"));
  } finally {
    await pagefind.close();
  }
  // The site renders its own results; Pagefind's bundled UIs are not shipped.
  for (const name of await fs.readdir(output))
    if (/^pagefind-(?:.+-)?ui\.(?:js|css)$|^pagefind-highlight\.js$/.test(name))
      await fs.rm(path.join(output, name));
  const entry = JSON.parse(
    await fs.readFile(path.join(output, "pagefind-entry.json"), "utf8"),
  ) as { languages: Record<string, { page_count: number }> };
  return Object.values(entry.languages).reduce((n, l) => n + l.page_count, 0);
}
