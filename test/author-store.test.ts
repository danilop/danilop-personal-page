import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AuthorStore } from "../core/author-store";
async function fixture(t: import("node:test").TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "author-test-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "content/pieces/a"), { recursive: true });
  await fs.writeFile(path.join(root, "content/pieces/a/index.md"), "original");
  return new AuthorStore(root);
}
const file = "content/pieces/a/index.md";
const valid = async () => {};
test("save and restore keep both original and later revisions across store instances", async (t) => {
  const s = await fixture(t),
    a = await s.read(file);
  const b = await s.save(file, "changed", a.revision, valid);
  const restored = await new AuthorStore(s.root).save(
    file,
    a.text,
    b.revision,
    valid,
  );
  assert.equal(restored.text, "original");
  const h = await s.history(file);
  assert(h.some((r) => r.text === "changed"));
  assert(h.some((r) => r.text === "original"));
});
test("stale revisions and invalid edits never overwrite the source", async (t) => {
  const s = await fixture(t),
    a = await s.read(file);
  await s.save(file, "outside", a.revision, valid);
  await assert.rejects(s.save(file, "mine", a.revision, valid), /Conflict/);
  const b = await s.read(file);
  await assert.rejects(
    s.save(file, "bad", b.revision, async () => {
      throw Error("invalid");
    }),
    /invalid/,
  );
  assert.equal((await s.read(file)).text, "outside");
});
test("traversal, unlisted files and symlinks are not editable", async (t) => {
  const s = await fixture(t);
  await assert.rejects(s.read("../package.json"));
  await assert.rejects(s.read("package.json"));
  await fs.unlink(path.join(s.root, file));
  await fs.symlink("/etc/hosts", path.join(s.root, file));
  await assert.rejects(s.read(file));
});
test("external modification during validation is detected", async (t) => {
  const s = await fixture(t),
    a = await s.read(file);
  await assert.rejects(
    s.save(file, "mine", a.revision, async () => {
      await fs.writeFile(path.join(s.root, file), "external");
    }),
    /Conflict/,
  );
  assert.equal((await s.read(file)).text, "external");
});

test("publishing saves a timestamp atomically and preserves it through unpublish and restore", async (t) => {
  const s = await fixture(t);
  const draft = "---\nid: a\ndraft: true\n---\nA draft.\n";
  await fs.writeFile(path.join(s.root, file), draft);
  const original = await s.read(file);
  const candidate = draft.replace("draft: true", "draft: false");
  await assert.rejects(
    s.save(file, candidate, original.revision, async (text) => {
      assert.match(text, /publishedAt: .*T.*Z/);
      throw Error("Invalid article");
    }),
    /Invalid article/,
  );
  assert.equal((await s.read(file)).text, draft);
  const saved = await s.save(file, candidate, original.revision, valid);
  const date = saved.text.match(/publishedAt: (.+)/)![1];
  assert(Number.isFinite(Date.parse(date.replaceAll('"', ""))));
  const restored = await s.save(file, draft, saved.revision, valid);
  assert(restored.text.includes(`publishedAt: ${date}`));
  const republished = await s.save(file, candidate, restored.revision, valid);
  assert(republished.text.includes(`publishedAt: ${date}`));
  assert.equal((await s.read(file)).text, republished.text);
});
