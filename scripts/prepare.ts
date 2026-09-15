import { assignmentSchema, exportPayload } from "../core/distribution";
import { loadEditions } from "../core/editions";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import sharp from "sharp";
import {
  loadLibrary,
  readYaml,
  allowed,
  articleUrl,
  assemble,
  standalone,
  collectionUrl,
} from "../core/model";
import { siteConfig, homeSchema, tokensCss } from "../core/config";
import { renderDocument, renderProse } from "../core/render";
import { Assets, localAsset } from "../core/assets";
import { compileLinks } from "../core/shortlinks";
import type { CompiledSite, ArchiveRecord } from "../core/site-data";
import metadata from "../lib/link-metadata.js";
import matter from "gray-matter";
async function main() {
  const lib = await loadLibrary(),
    config = await siteConfig(),
    home = homeSchema.parse(await readYaml("publishing/home.yaml")),
    defaults = await readYaml("publishing/renderers.yaml");
  await fs.rm(".generated", { recursive: true, force: true });
  await fs.mkdir(".generated/public/brand", { recursive: true });
  const assets = new Assets();
  for (const [slot, a] of Object.entries(config.assets)) {
    if (!a) continue;
    const file = await localAsset(process.cwd(), a.path);
    await sharp(await fs.readFile(file))
      .resize({
        width: slot === "portrait" ? 480 : 1200,
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toFile(`.generated/public/brand/${slot}.webp`);
  }
  await fs.cp("site-assets/licenses", ".generated/public/licenses", {
    recursive: true,
  });
  await fs.copyFile("site-assets/favicon.ico", ".generated/public/favicon.ico");
  await fs.writeFile(".generated/public/theme-tokens.css", tokensCss(config));
  if (config.overrideCss) {
    const file = await localAsset(process.cwd(), config.overrideCss);
    await fs.copyFile(file, ".generated/public/theme-overrides.css");
  }
  await fs.cp("legacy/snapshot-2026-09-15", ".generated/public/original-site", {
    recursive: true,
  });
  for (const file of await fs.readdir(".generated/public/original-site"))
    if (file.endsWith(".html")) {
      const p = ".generated/public/original-site/" + file;
      let s = await fs.readFile(p, "utf8");
      s = s
        .replace(/(href|src)="\/(?!\/)/g, '$1="/original-site/')
        .replace(
          "</head>",
          '<meta name="robots" content="noindex,follow"></head>',
        );
      await fs.writeFile(p, s);
    }
  // Keep historical asset URLs usable as well as the dated snapshot.
  await fs.cp("static", ".generated/public", { recursive: true });
  const site: CompiledSite = {
    articles: [],
    collections: [],
    archive: [],
    elsewhere: [],
    externalCopies: [],
    home,
    about: await renderProse(
      matter(await fs.readFile("content/about.md", "utf8")).content,
    ),
    revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    isPreview: Boolean(process.env.AWS_BRANCH && process.env.AWS_BRANCH !== "main"),
    buildTime: new Date().toISOString(),
    shortlinks: compileLinks(
      await readYaml("publishing/links.yaml"),
      lib,
      config.url,
      await loadEditions(),
    ),
  };
  for (const c of lib.collections.filter((c) => c.status === "published")) {
    const d = await renderDocument(
      assemble(c, lib, "web"),
      lib,
      defaults,
      assets,
    );
    site.collections.push({
      id: c.id,
      title: c.title,
      summary: c.summary,
      introduction: await renderProse(c.introduction ?? ""),
      url: collectionUrl(c),
      ordered: c.ordered,
      book: c.book,
      html: d.html,
      nodes: d.nodes,
    });
  }
  for (const p of [...lib.pieces.values()].filter((p) =>
    allowed(p, "standalone"),
  )) {
    const d = await renderDocument(standalone(p), lib, defaults, assets);
    site.articles.push({
      id: p.id,
      title: p.title,
      summary: p.summary,
      url: articleUrl(p),
      publishedAt: p.publishedAt!,
      updatedAt: p.updatedAt,
      tags: p.tags,
      html: d.html,
      minutes: Math.max(1, Math.ceil(p.body.split(/\s+/).length / 220)),
      collections: site.collections
        .filter((c) => c.nodes.some((n) => n.pieceId === p.id))
        .map((c) => ({ title: c.title, url: c.url })),
    });
  }
  // Prepare portable image renditions before deployment, so remote copies never
  // refer to assets that only exist in the publisher's temporary workspace.
  for (const raw of (await readYaml("publishing/distribution.yaml"))
    .assignments) {
    const assignment = assignmentSchema.parse(raw);
    const piece = lib.pieces.get(assignment.piece);
    if (!piece) throw Error("Unknown distribution source");
    await exportPayload(piece, lib, assignment, config.url);
  }
  site.articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (home.lead && !site.articles.some((p) => p.id === home.lead))
    throw Error("Pinned lead is not a public article");
  for (const id of home.collections)
    if (!site.collections.some((c) => c.id === id))
      throw Error(`Invalid homepage collection ${id}`);
  const imported = JSON.parse(
      await fs.readFile("data/link-metadata.json", "utf8"),
    ),
    overrides = JSON.parse(
      await fs.readFile("data/link-overrides.json", "utf8"),
    );
  let legacy: any = {};
  try {
    legacy = JSON.parse(await fs.readFile("data/legacy-metadata.json", "utf8"));
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
  }
  for (const kind of ["posts", "decks", "videos"]) {
    const urls: string[] = JSON.parse(
      await fs.readFile(`data/${kind}.json`, "utf8"),
    );
    for (const url of urls) {
      if (!legacy[url] && !imported[url]) {
        const cache = path.join(
          "cache",
          crypto.createHash("sha256").update(url).digest("hex"),
        );
        try {
          legacy[url] = JSON.parse(await fs.readFile(cache, "utf8"));
        } catch {
          throw Error(
            `Missing versioned metadata for ${url}; refresh before building`,
          );
        }
      }
      const record = await metadata.getLinkData(url, {
        cacheFolderName: "cache",
        imported: { ...legacy, ...imported },
        overrides,
        scrape: async () => {
          throw Error("Production build cannot discover metadata");
        },
      });
      const host = new URL(url).hostname;
      const publisher =
        host === "aws.amazon.com"
          ? "AWS"
          : host === "dev.to"
            ? "DEV"
            : host.includes("speakerdeck")
              ? "Speaker Deck"
              : host.includes("youtu")
                ? "YouTube"
                : host;
      const r: ArchiveRecord = { ...record, sourceUrl: url, publisher, kind };
      const canonical = imported[url]?.canonicalUrl;
      if (
        canonical &&
        site.articles.some(
          (p) =>
            new URL(p.url, config.url).href.replace(/\/$/, "") ===
            String(canonical).replace(/\/$/, ""),
        )
      )
        site.externalCopies.push(url);
      else site.archive.push(r);
    }
  }
  // The relaunch is a boundary, not a new publication date for historical work.
  const cutoff = config.relaunchDate;
  site.elsewhere = site.archive.filter(
    (r) =>
      r.kind === "posts" &&
      r.publishedAt &&
      r.publishedAt.slice(0, 10) > cutoff,
  );
  site.archive = site.archive.filter((r) => !site.elsewhere.includes(r));
  await fs.writeFile(".generated/site.json", JSON.stringify(site));
  await fs.writeFile(".generated/pieces.json", JSON.stringify(site.articles));
  await fs.writeFile(
    ".generated/collections.json",
    JSON.stringify(site.collections),
  );
  await fs.writeFile(
    ".generated/public/build.json",
    JSON.stringify({ revision: site.revision, builtAt: site.buildTime }),
  );
  await fs.writeFile(
    ".generated/shortlinks.json",
    JSON.stringify(site.shortlinks, null, 2),
  );
  console.log(
    `Prepared ${site.articles.length} articles, ${site.collections.length} collections, ${site.archive.length} historical records.`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
