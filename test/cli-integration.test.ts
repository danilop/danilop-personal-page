import { repositoryFixture } from "./repository-fixture";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";
import { checkSite } from "../scripts/verify-deployment.mjs";
const exec = promisify(execFile);
const root = process.cwd();

test(
  "release CLI builds a complete static site and keeps canonical draft content out of every public index",
  { timeout: 180000 },
  async (t) => {
    const snapshot = await repositoryFixture(root);
    t.after(() => snapshot.cleanup());

    const env = { ...isolatedGitEnvironment(root), NOTES_BASE_PATH: "/" };
    const run = async (
      file: string,
      args: string[] = [],
      overrides: NodeJS.ProcessEnv = {},
    ) =>
      exec(
        process.execPath,
        ["--import", "tsx", path.join(root, file), ...args],
        {
          cwd: snapshot.dir,
          env: { ...env, ...overrides },
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
    await run("scripts/prepare.ts");
    await run("node_modules/.bin/astro", ["build"]);
    await run("scripts/package-site.ts");
    const verified = await run("scripts/verify-build.ts");
    assert.match(verified.stdout, /Verified.*private-content sentinels/);
    const fetcher = async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(input instanceof Request ? input.url : input);
      let file = path.join(snapshot.dir, "dist", url.pathname);
      if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
      try {
        const body = await fs.readFile(file);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": file.endsWith(".html")
              ? "text/html"
              : "application/octet-stream",
            "cache-control": url.pathname.includes("/_astro/")
              ? "public, max-age=31536000, immutable"
              : "no-store",
          },
        });
      } catch {
        return new Response("Missing", { status: 404 });
      }
    };
    // The generated canonical URLs use the configured deployment origin.
    const deployment = JSON.parse(
      await fs.readFile(
        path.join(snapshot.dir, "publishing/deployment.json"),
        "utf8",
      ),
    );
    const checked = await checkSite({
      origin: deployment.origin,
      basePath: "/",
      preserveOriginal: false,
      indexable: true,
      fetcher,
    });
    assert(checked);
    for (const name of [
      "rss.xml",
      "sitemap.xml",
      "index.html",
      "writing/index.html",
    ]) {
      const text = await fs.readFile(
        path.join(snapshot.dir, "dist", name),
        "utf8",
      );
      assert.doesNotMatch(
        text,
        /chronicles-introduction|chronicles-ch01|PRIVATE_DRAFT_SENTINEL/,
      );
    }
    await assert.rejects(
      fs.access(
        path.join(
          snapshot.dir,
          "dist/writing/chronicles-introduction/index.html",
        ),
      ),
    );
    const pilot = path.join(snapshot.dir, "exports/chronicles-pilot");
    await fs.mkdir(pilot, { recursive: true });
    await fs.cp(
      path.join(snapshot.dir, "content"),
      path.join(pilot, "content"),
      { recursive: true },
    );
    const preview = await run("scripts/preview-chronicles.ts");
    assert.match(
      preview.stdout,
      /All local links.*draft visibility checks passed/,
    );
    assert.match(
      await fs.readFile(path.join(pilot, "collection-preview.html"), "utf8"),
      /noindex,nofollow/,
    );
    const legacy = path.join(snapshot.dir, "legacy-fixture");
    for (const dir of ["data", "source", "static", "cache"])
      await fs.mkdir(path.join(legacy, dir), { recursive: true });
    const urls = ["https://fixture.invalid/one", "https://fixture.invalid/two"];
    await fs.writeFile(
      path.join(legacy, "data/links.json"),
      JSON.stringify(urls),
    );
    for (const [i, url] of urls.entries())
      await fs.writeFile(
        path.join(
          legacy,
          "cache",
          createHash("sha256").update(url).digest("hex"),
        ),
        JSON.stringify({
          ogTitle: `Fixture <${i}>`,
          ogDescription: "A & B",
          ogImage: { url: "https://fixture.invalid/image.png" },
        }),
      );
    await fs.writeFile(
      path.join(legacy, "source/index.html"),
      "<!doctype html>\n<!-- processLinks links.json 8 4 1 -->\n<p>Preserved template</p>",
    );
    await fs.writeFile(
      path.join(legacy, "static/style.css"),
      "body {color: black}",
    );
    await run(
      "processLinks.js",
      ["data", "static", "source", "output", "cache"].map((dir) =>
        path.join(legacy, dir),
      ),
    );
    const legacyHtml = await fs.readFile(
      path.join(legacy, "output/index.html"),
      "utf8",
    );
    assert.match(legacyHtml, /Fixture &lt;0&gt;/);
    assert.doesNotMatch(legacyHtml, /Fixture &lt;1&gt;/);
    assert.match(legacyHtml, /Preserved template/);
    await run("scripts/fixture-preview.ts", [], { NOTES_QA: "1" });
    const qa = await fs.readFile(
      path.join(snapshot.dir, "dist/_qa/index.html"),
      "utf8",
    );
    assert.match(qa, /noindex,nofollow/);
    assert.match(qa, /model-experiment/);
    await assert.rejects(
      run("scripts/verify-build.ts"),
      /QA content cannot be deployed/,
    );
    const links = await run("scripts/publish-links.ts");
    assert(
      Array.isArray(JSON.parse(links.stdout).removed) ||
        JSON.parse(links.stdout).links,
    );
  },
);
