import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { AuthorImageCleanup } from "../core/author-image-cleanup";
const day = 86400000;
const sha = (bytes: Buffer | string) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
async function fixture(t: import("node:test").TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "image-cleanup-")),
  );
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const cleanup = new AuthorImageCleanup(root),
    now = Date.now();
  const file = "content/pieces/sample/index.md";
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), "A source without artwork.");
  async function candidate(label: string, days = 10) {
    const bytes = Buffer.from(label),
      id = crypto.randomUUID();
    const record = {
      id,
      file,
      created: new Date(now - days * day).toISOString(),
      sha256: sha(bytes),
    };
    await fs.mkdir(path.join(cleanup.state, "images"), { recursive: true });
    await fs.writeFile(
      path.join(cleanup.state, "images", id + ".json"),
      JSON.stringify(record),
    );
    await fs.writeFile(path.join(cleanup.state, "images", id + ".png"), bytes);
    return { ...record, bytes };
  }
  async function asset(
    c: Awaited<ReturnType<typeof candidate>>,
    managed = true,
  ) {
    const relative = `content/pieces/sample/assets/object-${c.sha256.slice(0, 20)}.png`;
    await fs.mkdir(path.dirname(path.join(root, relative)), {
      recursive: true,
    });
    await fs.writeFile(path.join(root, relative), c.bytes);
    if (managed)
      await cleanup.register(relative, c.sha256, new Date(now).toISOString());
    return relative;
  }
  const client = crypto.randomUUID(),
    session = crypto.randomUUID();
  async function recover(names: string[] = [], undoNames: string[] = []) {
    return cleanup.recovery({ client, session, names, undoNames });
  }
  return {
    root,
    cleanup,
    now,
    candidate,
    asset,
    file,
    recover,
    client,
    session,
  };
}
async function exists(file: string) {
  return !!(await fs.stat(file).catch(() => null));
}

test("unused candidates disappear after grace, and their bytes and metadata are purged after trash retention", async (t) => {
  const f = await fixture(t),
    old = await f.candidate("old"),
    young = await f.candidate("young", 1);
  const result = await f.cleanup.sweep(f.now);
  assert.equal(result.candidates, 1);
  assert.equal(
    await exists(path.join(f.cleanup.state, "images", old.id + ".json")),
    false,
  );
  assert.equal(
    await exists(path.join(f.cleanup.state, "images", old.id + ".png")),
    false,
  );
  assert.equal(
    await exists(path.join(f.cleanup.state, "images", young.id + ".png")),
    true,
  );
  const trash = path.join(f.cleanup.state, "image-trash"),
    dirs = await fs.readdir(trash);
  assert.equal(dirs.length, 1);
  const record = JSON.parse(
    await fs.readFile(path.join(trash, dirs[0], "manifest.json"), "utf8"),
  );
  assert.equal(record.files.length, 2);
  assert.equal((await f.cleanup.sweep(f.now + 29 * day)).purged, 0);
  assert.equal((await f.cleanup.sweep(f.now + 30 * day)).purged, 1);
  assert.equal(await exists(path.join(trash, dirs[0])), false);
});

test("current shared content, saved history and edition inventory keep matching candidate bytes", async (t) => {
  const f = await fixture(t);
  for (const kind of ["current", "history", "edition", "template"]) {
    const c = await f.candidate(kind),
      asset = await f.asset(c);
    const ref = path.basename(asset);
    if (kind === "current") {
      await fs.mkdir(path.join(f.root, "content/collections"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(f.root, "content/collections/shared.yaml"),
        `cover: {path: ../pieces/sample/assets/${ref}}`,
      );
    } else if (kind === "history") {
      await fs.mkdir(path.join(f.cleanup.state, "history/test"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(f.cleanup.state, "history/test/one.json"),
        JSON.stringify({ text: `![old](${ref})` }),
      );
    } else if (kind === "template") {
      await fs.mkdir(path.join(f.root, "site"), { recursive: true });
      await fs.writeFile(
        path.join(f.root, "site/Home.astro"),
        `<img src="${ref}" />`,
      );
    } else {
      await fs.mkdir(path.join(f.root, "exports/book/edition"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(f.root, "exports/book/edition/edition.json"),
        JSON.stringify({ files: [{ sha256: c.sha256 }] }),
      );
    }
    await f.recover([ref]);
  }
  await f.recover([]);
  assert.equal((await f.cleanup.sweep(f.now + 60 * day)).candidates, 0);
  assert.equal((await f.cleanup.sweep(f.now + 70 * day)).assets, 0);
});

test("persistent unsaved references survive restart while session-only Undo pins expire", async (t) => {
  const f = await fixture(t),
    persisted = await f.candidate("recovery"),
    undo = await f.candidate("undo");
  const a = await f.asset(persisted),
    b = await f.asset(undo);
  await f.recover([path.basename(a)], [path.basename(b)]);
  assert.equal((await f.cleanup.sweep(f.now)).candidates, 0);
  const restarted = new AuthorImageCleanup(f.root);
  assert.equal((await restarted.sweep(f.now + 2 * day)).candidates, 1);
  assert.equal((await restarted.sweep(f.now + 10 * day)).assets, 1);
  assert.equal(await exists(path.join(f.root, a)), true);
  assert.equal(await exists(path.join(f.root, b)), false);
  assert.deepEqual(
    await fs.readdir(path.join(f.cleanup.state, "image-sessions")),
    [],
  );
});

test("source assets use a fresh unused grace clock and stop ageing when reused", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("managed"),
    a = await f.asset(c);
  await f.recover([path.basename(a)]);
  await f.recover([]);
  assert.equal((await f.cleanup.sweep(f.now)).assets, 0);
  assert.equal((await f.cleanup.sweep(f.now + 6 * day)).assets, 0);
  await fs.writeFile(path.join(f.root, f.file), `![used](${path.basename(a)})`);
  assert.equal((await f.cleanup.sweep(f.now + 8 * day)).assets, 0);
  await fs.writeFile(path.join(f.root, f.file), "Unlinked again.");
  assert.equal((await f.cleanup.sweep(f.now + 9 * day)).assets, 0);
  assert.equal((await f.cleanup.sweep(f.now + 15 * day)).assets, 0);
  assert.equal((await f.cleanup.sweep(f.now + 16 * day)).assets, 1);
});

test("historical workflow assets are adopted by checksum and owner; manual and modified assets remain", async (t) => {
  const f = await fixture(t),
    legacy = await f.candidate("legacy"),
    a = await f.asset(legacy, false);
  const manual = path.join(f.root, "content/pieces/sample/assets/manual.png");
  await fs.writeFile(manual, "manual");
  const modified = await f.candidate("modified"),
    b = await f.asset(modified);
  await f.recover([path.basename(b)]);
  await f.recover([]);
  await fs.writeFile(path.join(f.root, b), "changed by the author");
  assert.equal((await f.cleanup.sweep(f.now)).assets, 0);
  assert.equal((await f.cleanup.sweep(f.now + 7 * day)).assets, 1);
  assert.equal(await exists(path.join(f.root, a)), false);
  assert.equal(await fs.readFile(manual, "utf8"), "manual");
  assert.equal(
    await fs.readFile(path.join(f.root, b), "utf8"),
    "changed by the author",
  );
});

test("pending insertion protects fresh copies, then abandoned pending work is collected", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("pending"),
    a = await f.asset(c);
  assert.equal((await f.cleanup.sweep(f.now)).candidates, 0);
  assert.equal((await f.cleanup.sweep(f.now + 7 * day)).assets, 0);
  assert.equal((await f.cleanup.sweep(f.now + 14 * day)).assets, 1);
  assert.equal(await exists(path.join(f.root, a)), false);
});

test("selection renews a candidate's grace period without refreshing every thumbnail", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("selected");
  await f.cleanup.touch(c.id, new Date(f.now).toISOString());
  assert.equal((await f.cleanup.sweep(f.now + 6 * day)).candidates, 0);
  assert.equal((await f.cleanup.sweep(f.now + 7 * day)).candidates, 1);
});

test("identical unused candidate copies and stale temporary metadata do not remain indefinitely", async (t) => {
  const f = await fixture(t),
    a = await f.candidate("identical"),
    b = await f.candidate("identical");
  const asset = await f.asset(a);
  await fs.writeFile(
    path.join(f.root, f.file),
    `![linked](${path.basename(asset)})`,
  );
  await f.recover([path.basename(asset)]);
  const temp = path.join(
    f.cleanup.state,
    "image-assets",
    "record.json.tmp-" + crypto.randomUUID(),
  );
  await fs.writeFile(temp, "interrupted metadata write");
  await fs.utimes(temp, new Date(f.now - 10 * day), new Date(f.now - 10 * day));
  assert.equal((await f.cleanup.sweep(f.now)).candidates, 1);
  const remaining = await fs.readdir(path.join(f.cleanup.state, "images"));
  assert.equal(remaining.filter((file) => file.endsWith(".png")).length, 1);
  assert(
    remaining.includes(a.id + ".png") || remaining.includes(b.id + ".png"),
  );
  assert.equal(await exists(temp), false);
  assert.equal((await f.cleanup.sweep(f.now + 30 * day)).purged, 2);
});

test("lock contention and corrupt recovery defer cleanup without deleting candidates", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("protected-error");
  await fs.mkdir(f.cleanup.state, { recursive: true });
  const lock = path.join(f.cleanup.state, "write.lock");
  await fs.writeFile(lock, "locked");
  assert.equal((await f.cleanup.sweep(f.now)).deferred, true);
  await fs.rm(lock);
  await fs.mkdir(path.join(f.cleanup.state, "history/test"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(f.cleanup.state, "history/test/broken.json"),
    "broken",
  );
  await assert.rejects(f.cleanup.sweep(f.now));
  assert.equal(
    await exists(path.join(f.cleanup.state, "images", c.id + ".png")),
    true,
  );
  assert.equal(await exists(lock), false);
});

test("orphan PNG and orphan metadata left by interruptions are collected", async (t) => {
  const f = await fixture(t),
    a = await f.candidate("orphan png"),
    b = await f.candidate("orphan json");
  const png = path.join(f.cleanup.state, "images", a.id + ".png");
  await fs.rm(png.replace(/\.png$/, ".json"));
  await fs.utimes(png, new Date(f.now - 10 * day), new Date(f.now - 10 * day));
  await fs.rm(path.join(f.cleanup.state, "images", b.id + ".png"));
  assert.equal((await f.cleanup.sweep(f.now)).candidates, 2);
  assert.deepEqual(await fs.readdir(path.join(f.cleanup.state, "images")), []);
  assert.equal((await f.cleanup.sweep(f.now + 30 * day)).purged, 2);
});

test("tampered trash and symbolic links are preserved rather than blindly purged", async (t) => {
  const f = await fixture(t);
  await f.candidate("trash");
  await f.cleanup.sweep(f.now);
  const trashRoot = path.join(f.cleanup.state, "image-trash");
  const dir = path.join(trashRoot, (await fs.readdir(trashRoot))[0]);
  await fs.writeFile(path.join(dir, "unexpected.txt"), "preserve");
  assert.equal((await f.cleanup.sweep(f.now + 31 * day)).purged, 0);
  assert.equal(await exists(dir), true);
  await fs.symlink(f.root, path.join(f.root, "content/link"));
  await assert.rejects(f.cleanup.sweep(f.now + 32 * day), /symbolic link/);
});

test("missing unused source files leave no permanent ownership metadata", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("already removed"),
    a = await f.asset(c);
  await f.recover([path.basename(a)]);
  await f.recover([]);
  await fs.rm(path.join(f.root, a));
  assert.equal((await f.cleanup.sweep(f.now)).assets, 0);
  assert.equal((await f.cleanup.sweep(f.now + 7 * day)).assets, 1);
  assert.deepEqual(
    await fs.readdir(path.join(f.cleanup.state, "image-assets")),
    [],
  );
});

test("reference inventory changes during validation defer file removal", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("new reference");
  await assert.rejects(
    f.cleanup.sweep(f.now, async () => {
      await fs.writeFile(path.join(f.root, "content/new.md"), c.sha256);
    }),
    /reference inventory changed/,
  );
  assert.equal(
    await exists(path.join(f.cleanup.state, "images", c.id + ".png")),
    true,
  );
});

test("a reference restored during the trash window blocks purging its source filename", async (t) => {
  const f = await fixture(t),
    c = await f.candidate("restorable"),
    a = await f.asset(c);
  await f.recover([path.basename(a)]);
  await f.recover([]);
  await f.cleanup.sweep(f.now);
  await f.cleanup.sweep(f.now + 7 * day);
  await fs.writeFile(
    path.join(f.root, f.file),
    `![restore](${path.basename(a)})`,
  );
  const result = await f.cleanup.sweep(f.now + 38 * day);
  assert.equal(result.purged, 1); // Obsolete candidate pair, not the needed source asset.
  const entries = await fs.readdir(path.join(f.cleanup.state, "image-trash"));
  assert.equal(entries.length, 1);
  assert.equal(
    await exists(
      path.join(f.cleanup.state, "image-trash", entries[0], path.basename(a)),
    ),
    true,
  );
});
