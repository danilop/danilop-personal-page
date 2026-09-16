import { deployment, sitePath, siteUrl, siteOutput } from "../core/deployment.mjs";
import { siteConfig } from "../core/config";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { load } from "cheerio";
import type { CompiledSite } from "../core/site-data";
import { loadLibrary, allowed } from "../core/model";
async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}
async function main() {
  const config = await siteConfig();
  const aliases: Record<string, string> = {
    "posts.html": "/archive/posts/",
    "decks.html": "/archive/decks/",
    "videos.html": "/archive/videos/",
    "about.html": "/about/",
  };
  for (const [file, target] of Object.entries(aliases))
    await fs.writeFile(
      siteOutput + "/" + file,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${sitePath(target)}"><link rel="canonical" href="${siteUrl(target, config.url)}"><title>Page moved</title></head><body><a href="${sitePath(target)}">Continue to ${sitePath(target)}</a></body></html>`,
    );
  const site = JSON.parse(
    await fs.readFile(".generated/site.json", "utf8"),
  ) as CompiledSite;
  let expected = 0;
  for (const kind of ["posts", "decks", "videos"])
    expected += JSON.parse(
      await fs.readFile(`data/${kind}.json`, "utf8"),
    ).length;
  assert.equal(
    site.archive.length + site.elsewhere.length + site.externalCopies.length,
    expected,
    "Archive parity",
  );
  const files = await walk(siteOutput);
  const errors: string[] = [];
  let links = 0;
  for (const file of files) {
    if (/\/_qa\//.test(file)) throw Error("QA content cannot be deployed");
    if (!file.endsWith(".html") || file.includes("/original-site/")) continue;
    const $ = load(await fs.readFile(file, "utf8"));
    const ids = new Set<string>();
    $("[id]").each((_, el) => {
      const id = $(el).attr("id")!;
      if (ids.has(id)) errors.push(`${file}: duplicate ID ${id}`);
      ids.add(id);
    });
    for (const el of $("a[href],img[src],script[src],link[href]").toArray()) {
      const url = $(el).attr("href") ?? $(el).attr("src")!;
      if (!url.startsWith("/") || url.startsWith("//")) continue;
      const p = url.split(/[?#]/)[0];
      const target = path.join("dist", p, p.endsWith("/") ? "index.html" : "");
      if (deployment.basePath !== "/" && !p.startsWith(deployment.basePath))
        errors.push(`${file}: escaped deployment base ${url}`);
      links++;
      try {
        await fs.access(target);
      } catch {
        errors.push(`${file}: missing ${url}`);
      }
    }
  }
  const lib = await loadLibrary();
  for (const p of lib.pieces.values())
    if (!allowed(p, "standalone"))
      assert(
        !site.articles.some((a) => a.id === p.id),
        "Private piece in article output",
      );
  const allText = (
    await Promise.all(
      files
        .filter((f) => /\.(html|json|xml|js)$/.test(f))
        .map((f) => fs.readFile(f, "utf8")),
    )
  ).join("\n");
  for (const sentinel of [
    "PRIVATE_PREFACE_SENTINEL",
    "PRIVATE_DRAFT_SENTINEL",
    "BOOK_ONLY_CLOSING_SENTINEL",
  ])
    assert(!allText.includes(sentinel), `Leaked ${sentinel}`);
  if (errors.length) throw Error(errors.slice(0, 30).join("\n"));
  console.log(
    `Verified ${files.length} output files, ${links} local links, ${expected} legacy records, and private-content sentinels.`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
