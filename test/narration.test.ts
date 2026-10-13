import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import YAML from "yaml";
import { loadLibrary, parser, kinds, type Piece } from "../core/model";
import {
  speechDocument,
  settingsSchema,
  narrationUnits,
  speechDigest,
} from "../core/narration-speech";
import {
  commitNarration,
  verifyNarration,
  narrationLock,
  recoverNarration,
  mp3Duration,
  narrationIndex,
} from "../core/narration-store";
import {
  Narrations,
  checkAllNarrations,
  explanationPrompt,
} from "../core/narration";
import { runtimeHash, NarrationRuntime } from "../core/narration-runtime";
import { AuthorStore } from "../core/author-store";
import { digestAsset } from "../core/asset-manifest";

const manuscript =
  "---\nschemaVersion: 1\nid: a\ntitle: An article\nsummary: A useful article\nslug: a\ndraft: false\npublication:\n  surfaces: [standalone, collection]\n---\n\nWelcome to **this article**. Read [the source](https://example.com).\n";
async function fixture(t: TestContext, text = manuscript) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "narration-test-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const name of [
    "content/pieces/a/assets",
    "content/collections",
    "publishing",
    "tools/narration",
  ])
    await fs.mkdir(path.join(root, name), { recursive: true });
  await fs.writeFile(path.join(root, "content/pieces/a/index.md"), text);
  for (const name of ["profile.json", "requirements.txt", "worker.py"])
    await fs.writeFile(
      path.join(root, "tools/narration", name),
      "test profile",
    );
  await fs.writeFile(
    path.join(root, "publishing/narration.yaml"),
    YAML.stringify({
      schemaVersion: 1,
      required: true,
      profiles: { "kokoro-mlx-bf16-v1": await runtimeHash(root) },
    }),
  );
  const lib = await loadLibrary(path.join(root, "content"));
  const piece = lib.pieces.get("a")!;
  return { root, lib, piece, doc: await speechDocument(root, piece, lib) };
}
function changed(p: Piece, body: string): Piece {
  return { ...p, body, ast: parser().parse(body) };
}
// Two valid-sized MPEG-2 layer-3 frames; storage tests test frame/inventory contracts,
// while real encoder/decoder and listening checks are exercised by the runtime spike.
function framedMp3() {
  const frame = Buffer.alloc(288);
  frame.writeUInt32BE(0xfff3a4c0);
  return Buffer.concat(Array.from({ length: 20 }, () => frame));
}
async function generated(root: string, count: number) {
  const bytes = framedMp3(),
    id = crypto.randomUUID(),
    duration = mp3Duration(bytes);
  const folder = path.join(root, ".authoring-state/narration/jobs", id);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, "audio.mp3"), bytes);
  return {
    id,
    done: true as const,
    sha256: digestAsset(bytes),
    bytes: bytes.length,
    duration,
    timings: Array.from({ length: count }, (_, i) => ({
      start: (i * duration) / count,
      end: ((i + 1) * duration) / count,
    })),
    reusedChunks: 0,
    generationSeconds: 0.01,
  };
}
test("speech ignores presentation and metadata but preserves spoken wording, voice, punctuation and pace", async (t) => {
  const { root, piece, lib, doc } = await fixture(t);
  const same = await speechDocument(
    root,
    {
      ...changed(
        piece,
        piece.body
          .replace("**this article**", "this article")
          .replace("https://example.com", "https://other.example"),
      ),
      tags: ["new"],
      updatedAt: "2026-10-13",
    },
    lib,
  );
  assert.equal(same.speechHash, doc.speechHash);
  for (const body of [
    piece.body.replace("Welcome", "Hello"),
    piece.body.replace("article**.", "article**!"),
  ])
    assert.notEqual(
      (await speechDocument(root, changed(piece, body), lib)).speechHash,
      doc.speechHash,
    );
  assert.notEqual(
    (
      await speechDocument(
        root,
        piece,
        lib,
        settingsSchema.parse({ voice: "bf_emma" }),
      )
    ).speechHash,
    doc.speechHash,
  );
  assert.notEqual(
    (
      await speechDocument(
        root,
        piece,
        lib,
        settingsSchema.parse({ pace: 1.1 }),
      )
    ).speechHash,
    doc.speechHash,
  );
  assert.equal(
    (
      await speechDocument(
        root,
        piece,
        lib,
        settingsSchema.parse({ pronunciations: { absent: "different" } }),
      )
    ).speechHash,
    doc.speechHash,
  );
  assert.match(doc.firstParagraph!, /^Welcome/);
  assert(!doc.segments.some((s) => s.text.includes("https:")));
});
test("decorative images are silent without speaking alt text; replacement bytes do not change speech", async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.piece.dir, "assets/art.png"), "first");
  const p = changed(
    f.piece,
    "![Long decorative alt](assets/art.png)\n\nA clear opening.",
  );
  const d = await speechDocument(f.root, p, f.lib);
  assert.equal(d.issues[0].resolved, false);
  const settings = settingsSchema.parse({
    adaptations: { [d.issues[0].id]: { treatment: "decorative" } },
  });
  const before = await speechDocument(f.root, p, f.lib, settings);
  await fs.writeFile(path.join(f.piece.dir, "assets/art.png"), "replacement");
  const after = await speechDocument(
    f.root,
    changed(p, p.body.replace("Long decorative alt", "New decorative alt")),
    f.lib,
    settings,
  );
  assert.equal(before.speechHash, after.speechHash);
  assert.equal(before.reviewHash, after.reviewHash);
  assert.equal(after.firstParagraph, "A clear opening.");
  assert(after.issues[0].resolved);
});
test("code explanations are source-bound and do not execute; ambiguity and unknown source material fail closed", async (t) => {
  const f = await fixture(t),
    p = changed(f.piece, "A test.\n\n```js\nprocess.exit(1)\n```\n");
  const d = await speechDocument(f.root, p, f.lib),
    issue = d.issues[0];
  const s = settingsSchema.parse({
    adaptations: {
      [issue.id]: {
        treatment: "explanation",
        sourceHash: issue.sourceHash,
        text: "This stops the program.",
      },
    },
  });
  const ready = await speechDocument(f.root, p, f.lib, s);
  assert(ready.issues[0].resolved);
  const stale = await speechDocument(
    f.root,
    changed(p, p.body.replace("A test.", "A different context.")),
    f.lib,
    s,
  );
  assert(!stale.issues[0].resolved);
  await assert.rejects(
    speechDocument(
      f.root,
      changed(p, p.body + "\n```js\nprocess.exit(1)\n```"),
      f.lib,
    ),
    /Ambiguous/,
  );
  await assert.rejects(
    speechDocument(f.root, { ...p, language: "it" }, f.lib),
    /English/,
  );
  await assert.rejects(
    speechDocument(f.root, changed(p, ""), f.lib),
    /No speakable/,
  );
});
test("every rich block kind requires a reviewed adaptation; caption/skip need actual content", async (t) => {
  const f = await fixture(t);
  for (const kind of kinds) {
    const p = {
      ...changed(f.piece, "Opening.\n\n::block{ref=example}"),
      blocks: {
        example: { kind, source: { text: "source" }, caption: "A caption" },
      },
    };
    const doc = await speechDocument(f.root, p, f.lib);
    assert.equal(doc.issues[0].kind, kind);
    assert(!doc.issues[0].resolved);
    const choice = {
      treatment: "caption",
      sourceHash: doc.issues[0].sourceHash,
    };
    const ready = await speechDocument(
      f.root,
      p,
      f.lib,
      settingsSchema.parse({ adaptations: { example: choice } }),
    );
    assert(ready.issues[0].resolved);
    const skip = await speechDocument(
      f.root,
      p,
      f.lib,
      settingsSchema.parse({
        adaptations: {
          example: {
            ...choice,
            treatment: "skip",
            reason: "Already explained in the paragraph",
          },
        },
      }),
    );
    assert(skip.issues[0].resolved);
  }
});
test("informative dependency byte changes invalidate approvals even with the same caption", async (t) => {
  const f = await fixture(t),
    asset = path.join(f.piece.dir, "assets/data.csv");
  await fs.writeFile(asset, "value\n1");
  const p = {
    ...changed(f.piece, "Opening.\n\n::block{ref=chart}"),
    blocks: {
      chart: {
        kind: "chart" as const,
        source: { path: "assets/data.csv" },
        caption: "The value is one.",
      },
    },
  };
  const d = await speechDocument(f.root, p, f.lib);
  const s = settingsSchema.parse({
    adaptations: {
      chart: { treatment: "caption", sourceHash: d.issues[0].sourceHash },
    },
  });
  assert((await speechDocument(f.root, p, f.lib, s)).issues[0].resolved);
  await fs.writeFile(asset, "value\n2");
  assert(!(await speechDocument(f.root, p, f.lib, s)).issues[0].resolved);
  await fs.rm(asset);
  await fs.symlink("/etc/hosts", asset);
  await assert.rejects(speechDocument(f.root, p, f.lib, s), /escapes/);
});
test("public graph excludes drafts and book-only pieces and distinguishes contextual titles", async (t) => {
  const f = await fixture(t);
  assert.equal(narrationUnits(f.lib).size, 1);
  f.lib.pieces.set("a", { ...f.piece, status: "draft" });
  assert.equal(narrationUnits(f.lib).size, 0);
  f.lib.pieces.set("a", { ...f.piece, publication: { surfaces: ["book"] } });
  assert.equal(narrationUnits(f.lib).size, 0);
  const other = await speechDocument(
    f.root,
    f.piece,
    f.lib,
    undefined,
    "Contextual opening",
  );
  assert.notEqual(other.key, f.doc.key);
  assert.notEqual(other.speechHash, f.doc.speechHash);
  const library = await loadLibrary("test/fixtures/manuscript");
  assert(
    [...narrationUnits(library).values()].some(
      (u) => u.title === "The contextual first section",
    ),
  );
});
test("artifact checks require coverage, manifests, exact bytes and matching speech without a speech runtime", async (t) => {
  const f = await fixture(t);
  await assert.rejects(verifyNarration(f.root, f.doc), /Not prepared/);
  const result = await generated(f.root, f.doc.segments.length);
  await narrationLock(f.root, () => commitNarration(f.root, f.doc, result));
  assert.equal(await checkAllNarrations(f.root), 1);
  const record = await verifyNarration(f.root, f.doc);
  const file = path.join(f.root, record.audio.path);
  await fs.writeFile(file, "corrupt");
  await assert.rejects(verifyNarration(f.root, f.doc), /checksum/);
  await fs.rm(file);
  assert.equal(
    (await verifyNarration(f.root, f.doc)).audio.sha256,
    result.sha256,
  );
  await fs.rm(path.join(f.root, ".asset-cache", result.sha256 + ".mp3"));
  await assert.rejects(verifyNarration(f.root, f.doc), /Missing local audio/);
  assert.throws(() => mp3Duration(framedMp3().subarray(0, -10)), /Truncated/);
  assert.throws(() => mp3Duration(Buffer.from("not mp3")), /Invalid/);
});
test("recoverable transaction completes partial writes but protects a concurrent edit", async (t) => {
  const f = await fixture(t),
    journal = path.join(f.root, ".authoring-state/narration-transaction.json");
  await fs.mkdir(path.dirname(journal), { recursive: true });
  const changes = [
    { file: "publishing/narrations.json", before: null, after: "one" },
    { file: "content/pieces/a/index.md", before: manuscript, after: "two" },
  ];
  await fs.writeFile(journal, JSON.stringify(changes));
  await fs.writeFile(path.join(f.root, changes[0].file), "one");
  await recoverNarration(f.root);
  assert.equal(
    await fs.readFile(path.join(f.root, changes[1].file), "utf8"),
    "two",
  );
  await fs.writeFile(journal, JSON.stringify(changes));
  await fs.writeFile(path.join(f.root, changes[1].file), "external");
  await assert.rejects(recoverNarration(f.root), /recovery conflict/);
  assert.equal(
    await fs.readFile(path.join(f.root, changes[1].file), "utf8"),
    "external",
  );
});
test("publication waits for audio, stamps once, rejects concurrent edits and reuses ready recordings", async (t) => {
  const draft = manuscript.replace("draft: false", "draft: true"),
    f = await fixture(t, draft);
  const manager = new Narrations(f.root);
  t.after(() => manager.close());
  const store = new AuthorStore(f.root),
    file = "content/pieces/a/index.md",
    saved = await store.read(file);
  const request = { file, revision: saved.revision, text: manuscript };
  manager.runtime.generate = async () => {
    throw Error("worker failed");
  };
  await assert.rejects(manager.publish(request), /worker failed/);
  assert.equal((await store.read(file)).text, draft);
  manager.runtime.generate = async (doc) =>
    generated(f.root, doc.segments.length);
  const published = await manager.publish(request);
  assert.match(published.text, /publishedAt:/);
  assert.equal(await checkAllNarrations(f.root), 1);
  manager.runtime.generate = async () => {
    throw Error("should be cached");
  };
  await manager.prepareSaved("a");
  await assert.rejects(
    manager.capture({ ...request, revision: saved.revision }),
    /changed outside/,
  );
  const fresh = await store.read(file);
  manager.runtime.generate = async (doc) => {
    await fs.writeFile(
      path.join(f.root, file),
      fresh.text + "\nExternal edit.",
    );
    return generated(f.root, doc.segments.length);
  };
  await assert.rejects(
    manager.publish({
      file,
      revision: fresh.revision,
      text: fresh.text + "\nMy edit.",
    }),
    /changed outside/,
  );
  assert.match((await store.read(file)).text, /External edit/);
});
test("draft previews and changed voice remain private; accepting stale source is rejected", async (t) => {
  const f = await fixture(t, manuscript.replace("draft: false", "draft: true")),
    manager = new Narrations(f.root);
  t.after(() => manager.close());
  manager.runtime.generate = async (doc) =>
    generated(f.root, doc.segments.length);
  const file = "content/pieces/a/index.md",
    saved = await new AuthorStore(f.root).read(file),
    request = { file, ...saved };
  assert((await manager.inspect(request)).previewOnly);
  const job = await manager.start(request);
  while (["queued", "preparing"].includes(manager.get(job.id).status))
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(manager.get(job.id).status, "ready");
  assert.equal(
    Object.keys((await narrationIndex(f.root)).renditions).length,
    0,
  );
  const result = await manager.inspect(request);
  await manager.saveSettings(
    { ...request, settings: settingsSchema.parse({ voice: "bf_emma" }) },
    result.settingsRevision,
  );
  await assert.rejects(
    manager.saveSettings(
      { ...request, settings: settingsSchema.parse({ voice: "bm_lewis" }) },
      result.settingsRevision,
    ),
    /settings or sources changed/,
  );
  assert.match(explanationPrompt(f.doc), /not supplied/);
  assert.notEqual(speechDigest({ a: 1 }), speechDigest({ a: 2 }));
});
test("serial worker cancellation restarts cleanly and invalid workers fail promptly", async (t) => {
  const f = await fixture(t),
    runtime = new NarrationRuntime(f.root);
  t.after(() => runtime.close());
  await assert.rejects(
    runtime.generate(f.doc, new AbortController().signal),
    /unavailable/,
  );
  await fs.mkdir(path.join(f.root, ".venv-narration/bin"), { recursive: true });
  await fs.symlink(
    process.execPath,
    path.join(f.root, ".venv-narration/bin/python"),
  );
  await fs.writeFile(
    path.join(f.root, "tools/narration/worker.py"),
    `const lines=require('node:readline').createInterface({input:process.stdin});console.log(JSON.stringify({ready:true}));lines.on('line',line=>{const r=JSON.parse(line); console.log(JSON.stringify({id:r.id,progress:1,total:1}));setTimeout(()=>console.log(JSON.stringify({id:r.id,done:true,sha256:'a'.repeat(64),bytes:100,duration:1,timings:[{start:0,end:1}],reusedChunks:0,generationSeconds:0.1})),200);});`,
  );
  const abort = new AbortController();
  const first = runtime.generate(f.doc, abort.signal, () => abort.abort());
  const second = runtime.generate(f.doc, new AbortController().signal);
  await assert.rejects(first, /cancelled/);
  assert.equal((await second).duration, 1);
  runtime.close();
  await fs.writeFile(
    path.join(f.root, "tools/narration/worker.py"),
    "console.log('not-json');setTimeout(()=>{},10000)",
  );
  await assert.rejects(
    runtime.generate(f.doc, new AbortController().signal),
    /Invalid narration worker response/,
  );
});

test("commit snapshot validates staged prose and audio independently of unstaged edits", async (t) => {
  const f = await fixture(t);
  await commitNarration(
    f.root,
    f.doc,
    await generated(f.root, f.doc.segments.length),
  );
  const { git, createSnapshot } =
    await import("../tools/code-analysis/snapshot.mjs");
  git(f.root, ["init", "--quiet"]);
  await fs.writeFile(path.join(f.root, "content/collections/.gitkeep"), "");
  await fs.writeFile(
    path.join(f.root, ".gitignore"),
    ".authoring-state/\n.asset-cache/\ncontent/pieces/*/assets/\n",
  );
  git(f.root, ["add", "."]);
  const source = path.join(f.root, "content/pieces/a/index.md");
  await fs.writeFile(source, manuscript + "\nAn unstaged addition.\n");
  const staged = createSnapshot(f.root);
  try {
    assert.equal(await checkAllNarrations(staged.dir), 1);
  } finally {
    staged.cleanup();
  }
  const worktree = createSnapshot(f.root, { worktree: true });
  try {
    await assert.rejects(checkAllNarrations(worktree.dir), /Out of date/);
  } finally {
    worktree.cleanup();
  }
});

test("private preview can use exact saved draft audio but never promotes it to a public rendition", async (t) => {
  const f = await fixture(t, manuscript.replace("draft: false", "draft: true"));
  const manager = new Narrations(f.root);
  t.after(() => manager.close());
  t.mock.method(manager.runtime, "generate", async () =>
    generated(f.root, f.doc.segments.length),
  );
  await manager.prepareSaved("a");
  const { publicNarration } = await import("../core/narration-public");
  const { Assets } = await import("../core/assets");
  const assets = new Assets(path.join(f.root, "preview-assets"));
  const preview = await publicNarration(f.root, f.piece, f.lib, assets, true);
  assert.equal(preview?.duration, mp3Duration(framedMp3()));
  assert.equal(
    Object.keys((await narrationIndex(f.root)).renditions).length,
    0,
  );
  await assert.rejects(
    publicNarration(f.root, f.piece, f.lib, assets, false),
    /Not prepared/,
  );
  assert.equal(
    await publicNarration(
      f.root,
      changed(f.piece, f.piece.body + "Different words."),
      f.lib,
      assets,
      true,
    ),
    undefined,
  );
});

test("publication prepares every public placement title before changing draft state", async (t) => {
  const draft = manuscript.replace("draft: false", "draft: true");
  const f = await fixture(t, draft);
  await fs.writeFile(
    path.join(f.root, "content/collections/book.yaml"),
    YAML.stringify({
      schemaVersion: 1,
      id: "book",
      title: "A collection",
      summary: "A collection",
      slug: "book",
      status: "published",
      body: [
        { id: "opening", kind: "piece", ref: "a", title: "Collection opening" },
      ],
    }),
  );
  const manager = new Narrations(f.root);
  t.after(() => manager.close());
  const store = new AuthorStore(f.root),
    file = "content/pieces/a/index.md",
    saved = await store.read(file);
  const request = { file, revision: saved.revision, text: manuscript };
  manager.runtime.generate = async (doc) => {
    if (doc.title === "Collection opening")
      throw Error("Second rendition failed");
    return generated(f.root, doc.segments.length);
  };
  await assert.rejects(manager.publish(request), /Second rendition failed/);
  assert.equal((await store.read(file)).text, draft);
  assert.equal(
    Object.keys((await narrationIndex(f.root)).renditions).length,
    0,
  );
  manager.runtime.generate = async (doc) =>
    generated(f.root, doc.segments.length);
  await manager.publish(request);
  assert.equal(await checkAllNarrations(f.root), 2);
  assert.deepEqual(
    Object.values((await narrationIndex(f.root)).renditions)
      .map((r) => r.title)
      .sort(),
    ["An article", "Collection opening"],
  );
  const { execFileSync } = await import("node:child_process");
  const { createRequire } = await import("node:module");
  const inventory = execFileSync(
    process.execPath,
    [
      "--import",
      createRequire(import.meta.url).resolve("tsx"),
      path.resolve("scripts/narration.ts"),
      "inventory",
      "a",
    ],
    { cwd: f.root, encoding: "utf8" },
  );
  assert.match(inventory, /"title": "Collection opening"/);
  assert.match(inventory, /"title": "An article"/);
});
