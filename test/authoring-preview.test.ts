import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import { stageAuthoring, authoringContext } from "../core/authoring-preview";
import { loadLibrary } from "../core/model";

test("preview overlays only selected drafts in isolation and preserves source and release output", async (t) => {
  // A self-contained source fixture avoids depending on the ignored local pilot in CI.
  const temp = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "preview-fixture-"),
  );
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  await fs.mkdir(path.join(temp, "pieces/selected"), { recursive: true });
  await fs.mkdir(path.join(temp, "collections"));
  const article =
    "---\nschemaVersion: 1\nid: selected\ntitle: Selected draft\nsummary: Preview fixture\nstatus: draft\nslug: selected\npublication: {surfaces: [standalone]}\n---\nDraft text.\n";
  await fs.writeFile(path.join(temp, "pieces/selected/index.md"), article);
  await fs.mkdir(path.join(temp, "pieces/unselected"));
  await fs.writeFile(
    path.join(temp, "pieces/unselected/index.md"),
    article.replaceAll("selected", "unselected"),
  );
  const original = await fs.readFile(
    "content/pieces/hello-brave-new-world/index.md",
  );
  const staged = await stageAuthoring(
    process.cwd(),
    { from: temp, pieces: ["selected"] },
    true,
  );
  t.after(() => fs.rm(staged.workspace, { recursive: true, force: true }));
  const lib = await loadLibrary(path.join(staged.workspace, "content"));
  assert.equal(lib.pieces.get("selected")!.status, "published");
  assert.equal(lib.pieces.get("selected")!.publishedAt, staged.context.date);
  assert(!lib.pieces.has("unselected"));
  assert.deepEqual(staged.context.pieces, ["selected"]);
  assert.equal(
    matter(
      await fs.readFile(path.join(temp, "pieces/selected/index.md"), "utf8"),
    ).data.status,
    "draft",
  );
  assert(
    (await fs.readFile("content/pieces/hello-brave-new-world/index.md")).equals(
      original,
    ),
  );
  await assert.rejects(fs.access("content/pieces/selected"));
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(staged.workspace, "publishing/deployment.json"),
        "utf8",
      ),
    ).indexable,
    false,
  );
  await assert.rejects(
    authoringContext(staged.workspace, {}),
    /isolated workspace/,
  );
  await assert.rejects(
    authoringContext(staged.workspace, {
      NOTES_AUTHORING_PREVIEW: "1",
      CI: "true",
    }),
    /isolated workspace/,
  );
  assert.deepEqual(
    await authoringContext(staged.workspace, { NOTES_AUTHORING_PREVIEW: "1" }),
    staged.context,
  );
});
test("authoring mode cannot be enabled against the production workspace by an environment flag", async () => {
  assert.equal(await authoringContext(process.cwd(), {}), undefined);
  await assert.rejects(
    authoringContext(process.cwd(), { NOTES_AUTHORING_PREVIEW: "1" }),
    /isolated workspace/,
  );
});
test("internal snapshot without overlay preserves source statuses", async (t) => {
  const staged = await stageAuthoring(
    process.cwd(),
    { from: "content" },
    false,
  );
  t.after(() => fs.rm(staged.workspace, { recursive: true, force: true }));
  assert.deepEqual(staged.context.pieces, []);
  assert.deepEqual(staged.context.collections, []);
  const original = await loadLibrary();
  const preview = await loadLibrary(path.join(staged.workspace, "content"));
  assert.deepEqual(
    [...preview.pieces.values()].map((p) => [p.id, p.status]),
    [...original.pieces.values()].map((p) => [p.id, p.status]),
  );
});
