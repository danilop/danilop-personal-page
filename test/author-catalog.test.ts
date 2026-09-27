import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { authorCatalog } from "../core/author-catalog";
test("author catalog groups content and reads titles without exposing arbitrary files", async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "author-catalog-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "content/pieces/sample"), { recursive: true });
  await fs.mkdir(path.join(root, "content/collections"), { recursive: true });
  await fs.mkdir(path.join(root, "publishing"));
  await fs.writeFile(
    path.join(root, "content/pieces/sample/index.md"),
    "---\ntitle: A clear title\ndraft: true\n---\nHello",
  );
  await fs.writeFile(
    path.join(root, "content/collections/book.yaml"),
    "title: A book\ndraft: true",
  );
  await fs.writeFile(path.join(root, "content/private.txt"), "not editable");
  const rows = await authorCatalog(root);
  assert.deepEqual(
    rows.map((r) => [r.group, r.title, r.draft]),
    [
      ["Articles", "A clear title", true],
      ["Books and collections", "A book", true],
    ],
  );
});
test("author tag suggestions count saved articles and exclude symlink targets", async (t) => {
  const { authorTags } = await import("../core/author-catalog");
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "author-tags-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "content/collections"), { recursive: true });
  await fs.writeFile(
    path.join(root, "content/tags.yaml"),
    "schemaVersion: 1\ntags:\n  - id: computing\n    label: Computing\n    description: Computing articles\n",
  );
  for (const id of ["one", "two", "linked"])
    await fs.mkdir(path.join(root, "content/pieces", id), { recursive: true });
  for (const [id, draft] of [
    ["one", true],
    ["two", false],
  ])
    await fs.writeFile(
      path.join(root, "content/pieces", String(id), "index.md"),
      `---\nschemaVersion: 1\nid: ${id}\nslug: ${id}\npublishedAt: 2026-09-24\ntitle: ${id}\nsummary: Sample\ndraft: ${draft}\npublication: {surfaces: [standalone]}\ntags: [computing]\n---\nText`,
    );
  await fs.symlink(
    path.join(root, "content/pieces/one/index.md"),
    path.join(root, "content/pieces/linked/index.md"),
  );
  const rows = await authorTags(root);
  assert.equal(rows[0].published, 1);
  assert.equal(rows[0].draft, 1);
  assert.equal(rows[0].pieces.length, 2);
});
