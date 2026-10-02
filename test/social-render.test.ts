import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { load } from "cheerio";
import { repositoryFixture } from "./repository-fixture";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";
import { verifySocialMetadata } from "../core/social-metadata";

test(
  "release renders article/cover cards under a base path and excludes draft previews",
  { timeout: 120000 },
  async (t) => {
    const root = process.cwd(),
      fixture = await repositoryFixture(root);
    t.after(() => fixture.cleanup());
    const write = async (file: string, lines: string[]) => {
      const target = path.join(fixture.dir, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, lines.join("\n"));
    };
    await write("content/pieces/social-test/index.md", [
      "---",
      "schemaVersion: 1",
      "id: social-test",
      "slug: social-test",
      "title: Café & <RL>",
      "summary: Une explication accessible.",
      "language: fr-FR",
      "publishedAt: 2026-10-01T12:00:00.000Z",
      "publication: {surfaces: [standalone, collection, book]}",
      "---",
      "![A green illustration](art.png)",
      "Public prose.",
    ]);
    await sharp({
      create: { width: 700, height: 500, channels: 3, background: "green" },
    })
      .png()
      .toFile(path.join(fixture.dir, "content/pieces/social-test/art.png"));
    await write("content/collections/social-book.yaml", [
      "schemaVersion: 1",
      "id: social-book",
      "slug: social-book",
      "title: Social book",
      "summary: A book with its own cover.",
      "ordered: true",
      "book: true",
      "cover: {path: assets/test-cover.png, alt: A red book cover}",
      "body: [{id: opening, kind: piece, ref: social-test}]",
    ]);
    await fs.mkdir(path.join(fixture.dir, "content/collections/assets"), {
      recursive: true,
    });
    await sharp({
      create: { width: 300, height: 600, channels: 3, background: "red" },
    })
      .png()
      .toFile(
        path.join(fixture.dir, "content/collections/assets/test-cover.png"),
      );
    await write("content/pieces/social-private/index.md", [
      "---",
      "schemaVersion: 1",
      "id: social-private",
      "slug: social-private",
      "title: PRIVATE_SOCIAL_CARD_SENTINEL",
      "summary: Never publish this summary.",
      "draft: true",
      "publication: {surfaces: [standalone]}",
      "---",
      "Private prose.",
    ]);
    const env: NodeJS.ProcessEnv = {
      ...isolatedGitEnvironment(root),
      NOTES_BASE_PATH: "/new/",
    };
    delete env.NOTES_AUTHORING_PREVIEW;
    delete env.AWS_BRANCH;
    await promisify(execFile)("npm", ["run", "build"], {
      cwd: fixture.dir,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });
    const read = (file: string) =>
      fs.readFile(path.join(fixture.dir, file), "utf8");
    const site = JSON.parse(await read(".generated/site.json"));
    assert(!site.social.pages["/writing/social-private/"]);
    assert(
      !(await read(".generated/site.json")).includes(
        "PRIVATE_SOCIAL_CARD_SENTINEL",
      ),
    );
    const articleHtml = await read("dist/new/writing/social-test/index.html");
    const article = verifySocialMetadata(articleHtml);
    assert.equal(article.title, "Café & <RL>");
    assert.equal(
      article.canonical,
      "https://www.danilop.net/new/writing/social-test/",
    );
    assert(
      article.image.startsWith(
        "https://www.danilop.net/new/media/social-preview-",
      ),
    );
    const $ = load(articleHtml);
    assert.equal($("html").attr("lang"), "fr-FR");
    assert.equal($('meta[property="og:locale"]').attr("content"), "fr_FR");
    assert.equal(
      $('meta[property="article:published_time"]').attr("content"),
      "2026-10-01T12:00:00.000Z",
    );
    assert.equal(
      $('meta[property="og:image:alt"]').attr("content"),
      "A green illustration",
    );
    const bookHtml = await read("dist/new/collections/social-book/index.html");
    const book = verifySocialMetadata(bookHtml);
    assert.notEqual(book.image, article.image);
    assert.equal(
      load(bookHtml)('meta[property="og:image:alt"]').attr("content"),
      "A red book cover",
    );
    const placement = await read(
      "dist/new/collections/social-book/read/opening/index.html",
    );
    assert.equal(verifySocialMetadata(placement).image, article.image);
    assert.equal(
      load(placement)('meta[property="og:description"]').attr("content"),
      "Une explication accessible.",
    );
    const file = path.join(fixture.dir, "dist", new URL(book.image).pathname);
    const metadata = await sharp(await fs.readFile(file)).metadata();
    assert.deepEqual(
      [metadata.width, metadata.height, metadata.format],
      [1200, 630, "jpeg"],
    );
  },
);
