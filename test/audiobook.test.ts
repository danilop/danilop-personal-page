import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { loadLibrary, collectionSchema } from "../core/model";
import { audiobookPlan } from "../core/audiobook-plan";
import { Audiobooks, checkAllAudiobooks } from "../core/audiobooks";
import {
  bookIndex,
  bookBytes,
  verifyBook,
  commitBooks,
} from "../core/audiobook-store";
import { runtimeHash } from "../core/narration-runtime";
import { mp3Duration, narrationLock } from "../core/narration-store";
import { digestAsset } from "../core/asset-manifest";
import { bookPreviewScope, publicAudiobook } from "../core/audiobook-public";
import { Assets } from "../core/assets";
import {
  captureProgress,
  restoreProgress,
  readProgress,
  audioClock,
  type AudioMap,
} from "../runtime/audiobook-progress";
import { AuthorStore } from "../core/author-store";

async function fixture(t: TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "audiobook-test-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const p of ["content/collections", "publishing", "tools/narration"])
    await fs.mkdir(path.join(root, p), { recursive: true });
  for (const name of ["profile.json", "worker.py", "requirements.txt"])
    await fs.writeFile(path.join(root, "tools/narration", name), "fixture");
  await fs.writeFile(
    path.join(root, "publishing/site.yaml"),
    "name: Test Author\n",
  );
  await fs.writeFile(
    path.join(root, "publishing/narration.yaml"),
    YAML.stringify({
      schemaVersion: 1,
      required: true,
      profiles: { "kokoro-mlx-bf16-v1": await runtimeHash(root) },
    }),
  );
  for (const id of ["one", "two", "three"]) {
    const dir = path.join(root, "content/pieces", id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "index.md"),
      `---\nschemaVersion: 1\nid: ${id}\ntitle: Article ${id}\nsummary: Example\nslug: ${id}\ndraft: ${id === "three"}\npublication:\n  surfaces: [standalone, collection, book]\n---\n\nA paragraph from ${id}.\n\n## An inner section\n\nAnother paragraph from ${id}.\n`,
    );
  }
  const c = {
    schemaVersion: 1,
    id: "book",
    title: "A book",
    summary: "A summary not spoken",
    slug: "book",
    ordered: true,
    book: true,
    draft: false,
    completion: "in-progress",
    body: [
      {
        id: "part",
        kind: "part",
        title: "Beginnings",
        children: [
          {
            id: "chapter",
            kind: "chapter",
            title: "First chapter",
            children: [
              { id: "first", kind: "piece", ref: "one", integration: "body" },
              { id: "second", kind: "piece", ref: "two", integration: "body" },
              { id: "third", kind: "piece", ref: "three", integration: "body" },
            ],
          },
        ],
      },
    ],
  };
  await fs.writeFile(
    path.join(root, "content/collections/book.yaml"),
    YAML.stringify(c),
  );
  const manager = new Audiobooks(root);
  t.after(() => manager.close());
  let calls = 0;
  manager.runtime.generate = async (doc, signal, progress) => {
    if (signal.aborted) throw Error("cancelled");
    calls++;
    const frame = Buffer.alloc(288);
    frame.writeUInt32BE(0xfff3a4c0);
    const bytes = Buffer.concat(
        Array.from({ length: doc.segments.length * 20 }, () => frame),
      ),
      duration = mp3Duration(bytes),
      id = crypto.randomUUID();
    const dir = path.join(root, ".authoring-state/narration/jobs", id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "audio.mp3"), bytes);
    progress?.(doc.segments.length, doc.segments.length);
    return {
      id,
      done: true,
      sha256: digestAsset(bytes),
      bytes: bytes.length,
      duration,
      timings: doc.segments.map((_, i) => ({
        start: (i * duration) / doc.segments.length,
        end: ((i + 1) * duration) / doc.segments.length,
      })),
      reusedChunks: 0,
      generationSeconds: 0.01,
    };
  };
  return {
    root,
    c,
    manager,
    calls: () => calls,
    lib: await loadLibrary(path.join(root, "content")),
  };
}
test("book speech preserves hierarchy, suppresses body article titles, excludes drafts and identifies partial chapters", async (t) => {
  const { root, lib } = await fixture(t),
    c = lib.collections[0],
    p = await audiobookPlan(root, c, lib);
  const words = p.segments.map((s) => s.text).join("\n");
  assert.match(words, /A book. By Test Author. AI narration/);
  assert.match(words, /Part 1. Beginnings/);
  assert.match(words, /Chapter 1. First chapter/);
  assert.doesNotMatch(words, /Article one|Article two|from three|A summary/);
  assert.equal(p.partial[0], "chapter");
  assert.match(words, /You're up to date/);
  const pendingBook = await audiobookPlan(root, { ...c, status: "draft" }, lib);
  assert.equal(pendingBook.hash, p.hash);
  assert.doesNotMatch(
    pendingBook.segments.map((s) => s.text).join(" "),
    /from three/,
  );
  const preview = await audiobookPlan(root, c, lib, true);
  assert.match(preview.segments.map((s) => s.text).join(" "), /from three/);
  lib.pieces.get("one")!.status = "draft";
  await assert.rejects(audiobookPlan(root, c, lib), /gap/);
  lib.pieces.get("one")!.status = "published";
  await assert.rejects(
    audiobookPlan(root, { ...c, completion: "complete" }, lib),
    /unpublished/,
  );
});
test("genuine section titles, explicit subtitle and completed closing survive composition", async (t) => {
  const { root, lib, c } = await fixture(t);
  c.body[0].children[0].children.pop();
  c.body[0].children[0].children[0].integration = "section";
  const book = collectionSchema.parse({
    ...c,
    completion: "complete",
    audioSubtitle: "The real subtitle",
    audioAuthor: "Another Author",
  });
  const p = await audiobookPlan(root, book, lib);
  assert.match(p.segments[0].text, /real subtitle.*Another Author/);
  assert.equal(
    p.segments.filter((s) => s.text.includes("Article one")).length,
    1,
  );
  assert.match(p.segments.at(-1)!.text, /The end/);
});
test("private planned gaps hold publication and empty planned chapters stay silent", async (t) => {
  const { root, lib, c } = await fixture(t);
  const raw = JSON.parse(JSON.stringify(c));
  raw.body[0].children[0].children.splice(1, 0, {
    id: "future",
    kind: "planned",
    title: "Private future title",
  });
  await assert.rejects(
    audiobookPlan(root, collectionSchema.parse(raw), lib),
    /gap/,
  );
  raw.body[0].children[0].children.splice(1, 1);
  raw.body[0].children.push({
    id: "empty",
    kind: "chapter",
    title: "Empty chapter",
    children: [
      {
        id: "future",
        kind: "planned",
        title: "Private future title",
        publicOutline: true,
      },
    ],
  });
  const p = await audiobookPlan(root, collectionSchema.parse(raw), lib);
  assert.doesNotMatch(
    p.segments.map((s) => s.text).join(" "),
    /Empty chapter|Private future/,
  );
  await assert.rejects(
    audiobookPlan(
      root,
      collectionSchema.parse({ ...raw, completion: "complete" }),
      lib,
    ),
    /unpublished/,
  );
});
test("generation is reused, verified, inventoried and emitted; corruption and source changes fail closed", async (t) => {
  const { root, manager, calls, lib } = await fixture(t);
  const r = await manager.prepare("book");
  assert.equal(calls(), 1);
  await manager.prepare("book");
  assert.equal(calls(), 1);
  assert.equal(await checkAllAudiobooks(root), 1);
  const out = await publicAudiobook(
    root,
    lib.collections[0],
    lib,
    new Assets(path.join(root, "media")),
    false,
  );
  assert.ok(out);
  assert.ok(out.url.endsWith(".mp3"));
  assert.equal(out.preview, false);
  assert.match(out.filename, /book-\d{4}-\d{2}-\d{2}-/);
  assert.equal((await bookIndex(root)).books.book.hash, r.hash);
  assert.ok((await bookBytes(root, r)).length);
  const p = await manager.plan("book");
  p.hash = "0".repeat(64);
  await assert.rejects(verifyBook(root, p), /out of date/);
  await fs.writeFile(path.join(root, r.audio.path), "corrupt");
  await assert.rejects(
    verifyBook(root, await manager.plan("book")),
    /integrity/,
  );
});
test("private draft preparation never promotes sources or public records; it is renderable only in preview", async (t) => {
  assert.equal(bookPreviewScope(undefined, "book", ["one"]), false);
  assert.equal(
    bookPreviewScope({ collections: [], pieces: [] }, "book", ["one"]),
    false,
  );
  assert.equal(
    bookPreviewScope({ collections: ["book"], pieces: [] }, "book", ["one"]),
    true,
  );
  assert.equal(
    bookPreviewScope({ collections: [], pieces: ["one"] }, "book", ["one"]),
    true,
  );
  assert.equal(
    bookPreviewScope({ collections: [], pieces: ["other"] }, "book", ["one"]),
    false,
  );
  const { root, manager, lib } = await fixture(t);
  const r = await manager.prepare("book", true);
  assert.equal(Object.keys((await bookIndex(root)).books).length, 0);
  assert.equal((await bookIndex(root, true)).books.book.hash, r.hash);
  await assert.rejects(fs.stat(path.join(root, r.audio.path)), {
    code: "ENOENT",
  });
  const output = await publicAudiobook(
    root,
    lib.collections[0],
    lib,
    new Assets(path.join(root, "media")),
    true,
  );
  assert.ok(output);
  assert.equal(output.preview, true);
  await assert.rejects(
    publicAudiobook(
      root,
      lib.collections[0],
      lib,
      new Assets(path.join(root, "media")),
      false,
    ),
    /missing/,
  );
});
test("book editor validates identity and revision, completes jobs, auditions, and publishes transactionally", async (t) => {
  const { root, manager } = await fixture(t),
    file = "content/collections/book.yaml",
    saved = await new AuthorStore(root).read(file),
    request = { file, ...saved, preview: true };
  const inspected = await manager.inspect(request);
  assert.equal(inspected.status, "Needs preparation");
  await assert.rejects(
    manager.capture({ ...request, revision: "stale" }),
    /reload/,
  );
  await assert.rejects(
    manager.capture({
      ...request,
      text: saved.text.replace("id: book", "id: changed"),
    }),
    /identity/,
  );
  for (const mode of ["audition", "prepare", "publish"] as const) {
    let job = await manager.start(request, mode);
    while (job.status === "preparing") {
      await new Promise((r) => setTimeout(r, 10));
      job = manager.get(job.id);
    }
    assert.equal(job.status, "ready", job.error);
    if (mode === "publish") assert.ok(job.saved);
  }
  assert.equal(await checkAllAudiobooks(root), 1);
  assert.throws(() => manager.get("missing"), /Unknown/);
  assert.throws(() => manager.cancel("missing"), /Unknown/);
});
test("book commit journal updates source and inventory under the shared lock", async (t) => {
  const { root, manager } = await fixture(t);
  const plan = await manager.plan("book"),
    r = await manager.generate(plan, new AbortController().signal);
  const file = "content/collections/book.yaml",
    text = await fs.readFile(path.join(root, file), "utf8");
  await narrationLock(root, () => commitBooks(root, [r], { file, text }));
  assert.equal(await checkAllAudiobooks(root), 1);
});
test("cancellation and concurrent source edits cannot publish a book", async (t) => {
  const { root, manager } = await fixture(t);
  const file = "content/collections/book.yaml";
  const original = await fs.readFile(path.join(root, file), "utf8");
  for (const cancel of [true, false]) {
    await fs.writeFile(path.join(root, file), original);
    const saved = await new AuthorStore(root).read(file);
    const generate = manager.runtime.generate.bind(manager.runtime);
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    manager.runtime.generate = async (...args) => {
      await wait;
      return generate(...args);
    };
    let job = await manager.start(
      { file, ...saved, preview: false },
      "publish",
    );
    if (cancel) manager.cancel(job.id);
    else
      await fs.writeFile(
        path.join(root, file),
        original.replace("A book", "An edited book"),
      );
    release();
    while (job.status === "preparing") {
      await new Promise((resolve) => setTimeout(resolve, 10));
      job = manager.get(job.id);
    }
    assert.equal(job.status, cancel ? "cancelled" : "failed");
    assert.equal(Object.keys((await bookIndex(root)).books).length, 0);
    assert.equal(
      await fs.readFile(path.join(root, file), "utf8"),
      cancel ? original : original.replace("A book", "An edited book"),
    );
    manager.runtime.generate = generate;
  }
});
const audioMap = (names: string[]): AudioMap => ({
  hash: names.join(),
  segments: names.map((id) => ({
    id,
    placement: id.split("-")[0],
    contentHash: id,
    label: id,
  })),
  audio: {
    duration: names.length * 10,
    timings: names.map((_, i) => ({ start: i * 10, end: (i + 1) * 10 })),
  },
});
test("progress survives append and insertion, resumes new content and relocates edited/removed passages explicitly", () => {
  const first = audioMap(["intro", "a-one", "a-two", "$closing"]),
    saved = captureProgress(first, 24);
  assert.equal(
    restoreProgress(
      audioMap(["intro", "new", "a-one", "a-two", "b-one", "$closing"]),
      saved,
    ).time,
    34,
  );
  const end = captureProgress(first, 35);
  assert.equal(
    restoreProgress(
      audioMap(["intro", "a-one", "a-two", "b-one", "$closing"]),
      end,
    ).time,
    30,
  );
  assert.match(
    restoreProgress(audioMap(["intro", "a-one", "a-edited", "$closing"]), saved)
      .message,
    /changed/,
  );
  assert.match(
    restoreProgress(audioMap(["intro", "$closing"]), saved).message,
    /removed/,
  );
  assert.equal(readProgress(JSON.stringify(saved))?.offset, 4);
  assert.equal(readProgress('{"offset":-2}'), undefined);
  assert.equal(readProgress("bad"), undefined);
  assert.equal(restoreProgress(first).time, 0);
  assert.equal(audioClock(3661), "1:01:01");
});
