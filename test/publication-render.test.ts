import test from "node:test";
import type { CompiledSite } from "../core/site-data";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { load } from "cheerio";
import { repositoryFixture } from "./repository-fixture";
import { stampPublication } from "../core/author-publication";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";

test(
  "local publication renders dates and ordering in a single release build",
  { timeout: 120000 },
  async (t) => {
    const root = process.cwd(),
      fixture = await repositoryFixture(root);
    t.after(() => fixture.cleanup());
    for (const [id, surface] of [
      ["time-old-draft", "standalone"],
      ["time-new-draft", "standalone"],
      ["time-chapter", "collection"],
      ["time-unpublished", "standalone"],
    ]) {
      const folder = path.join(fixture.dir, "content/pieces", id);
      await fs.mkdir(folder);
      await fs.writeFile(
        path.join(folder, "index.md"),
        `---\nschemaVersion: 1\nid: ${id}\nslug: ${id}\ntitle: ${id}\nsummary: A publication-time fixture\npublication: {surfaces: [${surface}]}\ndraft: true\n---\nA public fixture.\n`,
      );
    }
    await fs.writeFile(
      path.join(fixture.dir, "content/collections/time-book.yaml"),
      "schemaVersion: 1\nid: time-book\nslug: time-book\ntitle: Time book\nsummary: Test book\nbody:\n  - {id: chapter, kind: piece, ref: time-chapter}\n",
    );
    const env = isolatedGitEnvironment(root);
    delete env.NOTES_AUTHORING_PREVIEW;
    delete env.AWS_BRANCH;
    delete env.CI; // Disposable local fixtures prepare new assets; they are not deployments.
    delete env.NOTES_BASE_PATH;
    const run = (script: string) =>
      execFileSync("npm", ["run", script], {
        cwd: fixture.dir,
        env,
        stdio: "pipe",
        maxBuffer: 8 * 1024 * 1024,
      });
    const read = (file: string) =>
      fs.readFile(path.join(fixture.dir, file), "utf8");
    const publish = () =>
      execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/publish-article.ts", "time-old-draft"],
        { cwd: fixture.dir, env, stdio: "pipe" },
      );
    publish();
    const published = await read("content/pieces/time-old-draft/index.md");
    assert.match(published, /publishedAt: .*T.*Z/);
    assert.match(published, /draft: false/);
    publish();
    assert.equal(
      await read("content/pieces/time-old-draft/index.md"),
      published,
    );
    // Reset this fixture only, to exercise explicit clocks in the rendering case.
    await fs.writeFile(
      path.join(fixture.dir, "content/pieces/time-old-draft/index.md"),
      published
        .replace(/publishedAt:.*\n/, "")
        .replace("draft: false", "draft: true"),
    );
    const times: Record<string, string> = {
      "time-old-draft": "2026-10-01T12:02:00.000Z",
      "time-new-draft": "2026-10-01T12:01:00.000Z",
      "time-chapter": "2026-10-01T12:03:00.000Z",
    };
    for (const [id, publishedAt] of Object.entries(times)) {
      const file = `content/pieces/${id}/index.md`;
      const previous = await read(file);
      const text = stampPublication(
        previous,
        previous.replace("draft: true", "draft: false"),
        () => publishedAt,
      );
      // Fixed clocks make the rendering assertions deterministic.
      await fs.writeFile(path.join(fixture.dir, file), text);
    }
    run("assets:prepare");
    run("build");
    const site = JSON.parse(await read(".generated/site.json")) as CompiledSite;
    assert.deepEqual(
      site
        .homeWriting!.filter((x: { id: string; publishedAt?: string }) =>
          x.id.startsWith("time-"),
        )
        .map((x: { id: string; publishedAt?: string }) => x.id),
      ["time-chapter", "time-old-draft", "time-new-draft"],
    );
    const html = load(await read("dist/writing/time-old-draft/index.html"));
    assert.equal(
      html(".article-heading time").attr("datetime"),
      times["time-old-draft"],
    );
    assert.equal(html(".article-heading time").text(), "1 October 2026");
    const metadata = JSON.parse(
      html('script[type="application/ld+json"]').text(),
    );
    assert.equal(metadata.datePublished, times["time-old-draft"]);
    const rss = load(await read("dist/rss.xml"), { xml: true });
    const items = rss("item").filter((_, el) =>
      rss(el).find("title").text().startsWith("time-"),
    );
    assert.deepEqual(items.map((_, el) => rss(el).find("title").text()).get(), [
      "time-old-draft",
      "time-new-draft",
    ]);
    assert.equal(
      items.first().find("pubDate").text(),
      "Thu, 01 Oct 2026 12:02:00 GMT",
    );
    assert(!site.homeWriting!.some((x) => x.id === "time-unpublished"));
    assert(
      (await read("content/pieces/time-old-draft/index.md")).includes(
        times["time-old-draft"],
      ),
    );
  },
);
