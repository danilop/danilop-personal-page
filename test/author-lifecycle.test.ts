import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import { AuthorLifecycle } from "../core/author-lifecycle";
import { loadLibrary, assemble } from "../core/model";
import { compileLinks, reconcileLinks } from "../core/shortlinks";

const file = "content/pieces/article/index.md";
const source = `---
schemaVersion: 1
id: article
title: An article
summary: A summary
status: published
publication: {surfaces: [standalone, collection]}
slug: stable-url
publishedAt: 2026-09-01
shortCode: article
---
Text that must survive unpublication.\n`;
async function fixture(t: import("node:test").TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "lifecycle-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (name: string, text: string) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), text);
  };
  await write(file, source);
  await write("content/pieces/article/assets/image.svg", "<svg/>");
  await write(
    "content/pieces/other/index.md",
    source
      .replace("id: article", "id: other")
      .replace("slug: stable-url", "slug: other")
      .replace("shortCode: article\n", ""),
  );
  await write(
    "content/collections/book.yaml",
    `schemaVersion: 1
id: book
title: Book
summary: Book summary
slug: book
body:
  - id: chapter
    kind: chapter
    title: First
    before: [{id: opening, kind: piece, ref: article}]
    children:
      - {id: one, kind: piece, ref: article}
      # Keep the surviving placement and this comment.
      - {id: two, kind: piece, ref: other}
    after: [{id: closing, kind: piece, ref: article}]
`,
  );
  await write(
    "publishing/links.yaml",
    "schemaVersion: 1\nlinks:\n  article: {ref: article}\n  alias: {ref: article}\n  other: {ref: other}\n",
  );
  await write(
    "publishing/home.yaml",
    "schemaVersion: 1\nlead: article\nrecentCount: 3\nelsewhereCount: 4\ncollections: [book]\nnewIn: [{piece: article, collection: book}, {piece: other, collection: book}]\n",
  );
  await write(
    "publishing/distribution.yaml",
    "schemaVersion: 1\nassignments: [{piece: article, destination: dev}, {piece: other, destination: dev}]\n",
  );
  const lifecycle = new AuthorLifecycle(root);
  const read = (name: string) => fs.readFile(path.join(root, name), "utf8");
  const draft = async () =>
    lifecycle.unpublish(file, (await lifecycle.store.read(file)).revision);
  return { root, lifecycle, write, read, draft };
}
test("unpublish preserves identity, dates, body, placements and aliases; release omits article", async (t) => {
  const f = await fixture(t);
  const before = await f.read("content/collections/book.yaml");
  const result = await f.draft();
  assert.match(result.text, /draft: true/);
  assert.doesNotMatch(result.text, /status:/);
  assert.match(result.text, /slug: stable-url/);
  assert.match(result.text, /publishedAt: 2026-09-01/);
  assert.match(result.text, /Text that must survive/);
  assert.equal(await f.read("content/collections/book.yaml"), before);
  const lib = await loadLibrary(path.join(f.root, "content"));
  assert(
    !assemble(lib.collections[0], lib, "web").nodes.some(
      (n) => n.piece?.id === "article",
    ),
  );
  const manifest = YAML.parse(await f.read("publishing/links.yaml"));
  assert.deepEqual(compileLinks(manifest, lib, "https://example.com"), {
    other: "https://example.com/writing/other/",
  });
  assert.equal(manifest.links.alias.ref, "article");
  assert.equal((await f.lifecycle.store.history(file)).length, 2);
});
test("published and retired articles cannot be deleted, including direct API use", async (t) => {
  const f = await fixture(t);
  const current = await f.lifecycle.store.read(file);
  await assert.rejects(f.lifecycle.plan(file, current.revision), /Unpublish/);
  await f.write(file, source.replace("status: published", "status: retired"));
  await assert.rejects(
    f.lifecycle.plan(file, (await f.lifecycle.store.read(file)).revision),
    /Unpublish/,
  );
  await assert.rejects(f.lifecycle.unpublish("../elsewhere", "bad"));
});
test("delete removes owned files and dependent assignments, preserves shared content and recovery", async (t) => {
  const f = await fixture(t),
    draft = await f.draft();
  const plan = await f.lifecycle.plan(file, draft.revision);
  assert.deepEqual(plan.aliases, ["article", "alias"]);
  assert.equal(plan.placements.length, 3);
  assert.equal(plan.assignments, 1);
  const result = await f.lifecycle.delete(file, draft.revision, plan.revision);
  await assert.rejects(f.read(file), /ENOENT/);
  assert.match(
    await f.read(result.recovery + "/piece/index.md"),
    /draft: true/,
  );
  assert.equal(
    await f.read(result.recovery + "/piece/assets/image.svg"),
    "<svg/>",
  );
  assert.match(
    await f.read("content/collections/book.yaml"),
    /Keep the surviving placement/,
  );
  const lib = await loadLibrary(path.join(f.root, "content"));
  assert.equal(lib.pieces.size, 1);
  assert.equal(lib.collections[0].body[0].children?.[0].ref, "other");
  const links = YAML.parse(await f.read("publishing/links.yaml"));
  assert.deepEqual(links.links, { other: { ref: "other" } });
  assert.deepEqual(links.removed, { article: "article", alias: "article" });
  const home = YAML.parse(await f.read("publishing/home.yaml"));
  assert.equal(home.lead, undefined);
  assert.deepEqual(home.newIn, [{ piece: "other", collection: "book" }]);
  assert.deepEqual(
    YAML.parse(await f.read("publishing/distribution.yaml")).assignments,
    [{ piece: "other", destination: "dev" }],
  );
  const cloud = reconcileLinks(
    links,
    compileLinks(links, lib, "https://example.com"),
    { article: "old", alias: "old", unrelated: "keep" },
    { article: "article", alias: "article" },
  );
  assert.deepEqual(cloud.deletions, ["article", "alias"]);
  assert.equal(cloud.after.unrelated, "keep");
  assert.equal(cloud.owners.article, "article");
});
test("stale article, changed dependency and new assets invalidate confirmation without deletion", async (t) => {
  const f = await fixture(t),
    draft = await f.draft();
  await assert.rejects(f.lifecycle.plan(file, "stale"), /Conflict/);
  const plan = await f.lifecycle.plan(file, draft.revision);
  await f.write("content/pieces/article/assets/new.svg", "new");
  await assert.rejects(
    f.lifecycle.delete(file, draft.revision, plan.revision),
    /Conflict/,
  );
  const next = await f.lifecycle.plan(file, draft.revision);
  await f.write(
    "publishing/home.yaml",
    (await f.read("publishing/home.yaml")) + "# external edit\n",
  );
  await assert.rejects(
    f.lifecycle.delete(file, draft.revision, next.revision),
    /Conflict/,
  );
  assert.equal(await f.read(file), draft.text);
  await assert.rejects(f.read(".authoring-state/write.lock"), /ENOENT/);
});
test("incoming article references and adaptation provenance block deletion", async (t) => {
  const f = await fixture(t),
    draft = await f.draft();
  const other = await f.read("content/pieces/other/index.md");
  for (const text of [
    other + '\n:ref[Article]{target="article"}\n',
    other + "\n[Article](/writing/stable-url/)\n",
    other.replace("id: other", "id: other\nadaptedFrom: article"),
  ]) {
    await f.write("content/pieces/other/index.md", text);
    await assert.rejects(
      f.lifecycle.plan(file, draft.revision),
      /Resolve these references/,
    );
  }
});
test("nested placement content and symlink assets cannot be discarded", async (t) => {
  const f = await fixture(t),
    draft = await f.draft();
  const collection = await f.read("content/collections/book.yaml");
  await f.write(
    "content/collections/book.yaml",
    collection.replace(
      "{id: one, kind: piece, ref: article}",
      "{id: one, kind: piece, ref: article, children: [{id: nested, kind: piece, ref: other}]}",
    ),
  );
  await assert.rejects(
    f.lifecycle.plan(file, draft.revision),
    /nested content/,
  );
  await f.write("content/collections/book.yaml", collection);
  await fs.symlink(
    path.join(f.root, "content/pieces/other/index.md"),
    path.join(f.root, "content/pieces/article/assets/link"),
  );
  await assert.rejects(
    f.lifecycle.plan(file, draft.revision),
    /symbolic links/,
  );
});
test("failure after dependency writes rolls back all changes and preserves article", async (t) => {
  const f = await fixture(t),
    draft = await f.draft();
  const plan = await f.lifecycle.plan(file, draft.revision);
  const rename = fs.rename;
  t.mock.method(
    fs,
    "rename",
    async (
      from: Parameters<typeof fs.rename>[0],
      to: Parameters<typeof fs.rename>[1],
    ) => {
      if (String(to).endsWith("/piece")) throw Error("simulated move failure");
      return rename(from, to);
    },
  );
  await assert.rejects(
    f.lifecycle.delete(file, draft.revision, plan.revision),
    /simulated/,
  );
  for (const change of plan.changes)
    assert.equal(await f.read(change.file), change.before);
  assert.equal(await f.read(file), draft.text);
});
test("short-link deactivation, republication and deletion are idempotent and ownership-safe", () => {
  const manifest = { schemaVersion: 1, links: { article: { ref: "article" } } };
  const unpublished = reconcileLinks(
    manifest,
    {},
    { article: "old", unknown: "keep" },
    { article: "article" },
  );
  assert.deepEqual(unpublished.after, { unknown: "keep" });
  assert.deepEqual(
    reconcileLinks(manifest, {}, unpublished.after, unpublished.owners)
      .deletions,
    [],
  );
  assert.equal(
    reconcileLinks(
      manifest,
      { article: "new" },
      unpublished.after,
      unpublished.owners,
    ).after.article,
    "new",
  );
  assert.throws(
    () => reconcileLinks(manifest, {}, { article: "old" }, {}),
    /Missing owner/,
  );
  assert.throws(
    () => reconcileLinks(manifest, {}, {}, { article: "somebody-else" }),
    /already belongs/,
  );
  assert.throws(
    () =>
      reconcileLinks(
        { ...manifest, removed: { article: "article" } },
        {},
        {},
        {},
      ),
    /cannot be reused/,
  );
  assert.throws(
    () =>
      reconcileLinks(
        { schemaVersion: 1, links: {}, removed: { article: "article" } },
        {},
        { article: "old" },
        { article: "somebody-else" },
      ),
    /already belongs/,
  );
});

test("incoming links in other content and blocks are detected without alias prefix collisions", async (t) => {
  const f = await fixture(t),
    draft = await f.draft();
  await f.write(
    "content/about.md",
    "[Different alias](https://danilop.link/article-other)",
  );
  await f.lifecycle.plan(file, draft.revision);
  await f.write("content/about.md", "[Article](/writing/stable-url)");
  await assert.rejects(
    f.lifecycle.plan(file, draft.revision),
    /content\/about.md/,
  );
  await f.write("content/about.md", "No article link");
  await f.write(
    "content/pieces/other/blocks.yaml",
    'schemaVersion: 1\nblocks:\n  external:\n    kind: document\n    source: {url: "https://danilop.link/article"}\n',
  );
  await assert.rejects(f.lifecycle.plan(file, draft.revision), /blocks.yaml/);
});
