import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  emptyAssetManifest,
  sourceRecord,
  writeAssetManifest,
  hydrateManagedAsset,
  readAssetManifest,
} from "../core/asset-manifest";
import {
  releaseAssetCommit,
  releaseRevision,
  uploadReleaseAssets,
  verifyPublicAsset,
} from "../core/asset-release";
import { Assets } from "../core/assets";
import { finishAssetBuild } from "../core/asset-build";
import { AuthorImageCleanup } from "../core/author-image-cleanup";

async function repository(t: { after: (fn: () => Promise<unknown>) => void }) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "asset-release-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Asset test"]);
  git(["config", "user.email", "asset@example.invalid"]);
  git(["remote", "add", "origin", root + "/remote"]);
  await fs.writeFile(
    path.join(root, ".gitignore"),
    ".asset-cache/\ncontent/*/assets/\n",
  );
  git(["add", "."]);
  git(["commit", "-m", "Fixture"]);
  git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
  git(["config", "branch.main.remote", "origin"]);
  git(["config", "branch.main.merge", "refs/heads/main"]);
  return { root, git };
}
test("release requires a committed tree before upload and pushes the exact verified commit", async (t) => {
  const { root } = await repository(t);
  const sha = releaseRevision(root),
    events: string[] = [];
  assert.equal(
    await releaseAssetCommit(
      root,
      async () => {
        events.push("upload");
      },
      async (value) => {
        events.push(value);
      },
    ),
    sha,
  );
  assert.deepEqual(events, ["upload", sha]);
  await fs.writeFile(path.join(root, "draft.md"), "Unsaved");
  await assert.rejects(
    releaseAssetCommit(
      root,
      async () => {
        throw Error("Upload must not run");
      },
      async () => {},
    ),
    /Commit required.*\n.*draft.md/s,
  );
});
test("failed uploads and source edits during upload prevent a push", async (t) => {
  const { root } = await repository(t);
  let pushed = false;
  const push = async () => {
    pushed = true;
  };
  await assert.rejects(
    releaseAssetCommit(
      root,
      async () => {
        throw Error("S3 unavailable");
      },
      push,
    ),
    /S3 unavailable/,
  );
  await assert.rejects(
    releaseAssetCommit(
      root,
      async () => {
        await fs.writeFile(path.join(root, "new.md"), "changed");
      },
      push,
    ),
    /Commit required/,
  );
  assert.equal(pushed, false);
});
test("ignored source changes fail checksum checks and drafts never become public uploads", async (t) => {
  const { root } = await repository(t);
  const logical = "content/pieces/story/assets/figure.png";
  const bytes = Buffer.from("reviewed bytes");
  const manifest = emptyAssetManifest();
  manifest.sources[logical] = sourceRecord(logical, bytes);
  await writeAssetManifest(root, manifest);
  await fs.mkdir(path.dirname(path.join(root, logical)), { recursive: true });
  await fs.writeFile(path.join(root, logical), bytes);
  const uploaded: boolean[] = [];
  await uploadReleaseAssets(root, async (_, value, publicFile) => {
    assert.deepEqual(value, bytes);
    uploaded.push(publicFile);
  });
  assert.deepEqual(uploaded, [false]);
  await fs.writeFile(path.join(root, logical), "changed ignored bytes");
  await assert.rejects(
    uploadReleaseAssets(root, async () => {
      throw Error("Must not upload changed bytes");
    }),
    /checksum mismatch/,
  );
});
test("fresh clones hydrate only checksum-verified public sources and reject corrupt CDN bytes", async (t) => {
  const { root } = await repository(t);
  const logical = "content/pieces/story/assets/figure.png",
    bytes = Buffer.from("public reviewed image");
  const manifest = emptyAssetManifest();
  manifest.sources[logical] = {
    ...sourceRecord(logical, bytes),
    publicKey: "media/figure.png",
  };
  await writeAssetManifest(root, manifest);
  const owner = path.join(root, "content/pieces/story");
  await fs.mkdir(owner, { recursive: true });
  const oldFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = oldFetch;
  });
  globalThis.fetch = async () => new Response(bytes);
  await hydrateManagedAsset(owner, "assets/figure.png");
  assert.deepEqual(await fs.readFile(path.join(root, logical)), bytes);
  await fs.rm(path.join(root, logical));
  globalThis.fetch = async () => new Response("corrupt");
  await assert.rejects(
    hydrateManagedAsset(owner, "assets/figure.png"),
    /checksum mismatch/,
  );
  await assert.rejects(fs.stat(path.join(root, logical)), /ENOENT/);
  assert.equal(
    (await readAssetManifest(root))!.sources[logical].sha256,
    manifest.sources[logical].sha256,
  );
});
test("CDN checks reject mismatched MIME types, corrupt bytes and unavailable objects", async () => {
  const bytes = Buffer.from("%PDF-1.7\nfixture"),
    record = sourceRecord("guide.pdf", bytes);
  await verifyPublicAsset(
    record,
    async () =>
      new Response(bytes, { headers: { "content-type": "application/pdf" } }),
  );
  await assert.rejects(
    verifyPublicAsset(
      record,
      async () =>
        new Response(bytes, { headers: { "content-type": "text/html" } }),
    ),
    /MIME/,
  );
  await assert.rejects(
    verifyPublicAsset(
      record,
      async () =>
        new Response("wrong", {
          headers: { "content-type": "application/pdf" },
        }),
    ),
    /checksum/,
  );
  await assert.rejects(
    verifyPublicAsset(record, async () => new Response(null, { status: 404 })),
    /unavailable/,
  );
});
test("manifest entries do not prevent orphan cleanup, while references protect PDF assets", async (t) => {
  const { root } = await repository(t);
  const logical = "content/pieces/story/assets/guide.pdf",
    bytes = Buffer.from("%PDF-1.7\nfixture");
  const manifest = emptyAssetManifest();
  manifest.sources[logical] = sourceRecord(logical, bytes);
  await writeAssetManifest(root, manifest);
  await fs.mkdir(path.dirname(path.join(root, logical)), { recursive: true });
  await fs.writeFile(path.join(root, logical), bytes);
  const cleanup = new AuthorImageCleanup(root),
    now = Date.now();
  await cleanup.register(
    logical,
    manifest.sources[logical].sha256,
    new Date(now).toISOString(),
  );
  const content = path.join(root, "content/pieces/story/index.md");
  await fs.writeFile(content, "[Guide](assets/guide.pdf)");
  await cleanup.sweep(now + 8 * 86400000);
  assert.equal((await cleanup.sweep(now + 20 * 86400000)).assets, 0);
  await fs.writeFile(content, "The link was removed.");
  await cleanup.sweep(now + 21 * 86400000);
  assert.equal((await cleanup.sweep(now + 29 * 86400000)).assets, 1);
});

test("a replacement keeps pinned legacy URLs, while unprepared new renditions fail", async (t) => {
  const { root } = await repository(t);
  const before = process.cwd(),
    oldPrepare = process.env.NOTES_ASSET_PREPARE;
  t.after(async () => {
    process.chdir(before);
    if (oldPrepare === undefined) delete process.env.NOTES_ASSET_PREPARE;
    else process.env.NOTES_ASSET_PREPARE = oldPrepare;
  });
  process.chdir(root);
  const manifest = emptyAssetManifest(),
    bytes = Buffer.from("legacy image bytes");
  const name = "original.png",
    record = { ...sourceRecord("original.png", bytes), key: "media/" + name };
  manifest.outputs[name] = record;
  manifest.legacy = [name];
  await fs.mkdir(".asset-cache");
  await fs.writeFile(path.join(".asset-cache", record.sha256 + ".png"), bytes);
  await writeAssetManifest(root, manifest);
  await fs.writeFile(
    "publishing/media.json",
    JSON.stringify({
      schemaVersion: 1,
      baseUrl: "https://media.example.invalid",
      cacheSeconds: 300,
    }),
  );
  const assets = new Assets();
  const replacement = await assets.emit("replacement image", ".png");
  await assert.rejects(
    finishAssetBuild({ image: replacement }, assets, false),
    /Uncommitted rendition/,
  );
  process.env.NOTES_ASSET_PREPARE = "1";
  const site = await finishAssetBuild({ image: replacement }, assets, false);
  assert.match(site.image, /^https:\/\//);
  assert.deepEqual(
    await fs.readFile(".generated/public/media/original.png"),
    bytes,
  );
  assert.equal(
    (await readAssetManifest(root))!.outputs[name].sha256,
    record.sha256,
  );
});

test("cleanup defers under the release lock and collects only stale unpinned renditions", async (t) => {
  const { root } = await repository(t);
  const cleanup = new AuthorImageCleanup(root),
    now = Date.now();
  const manifest = emptyAssetManifest();
  const pinned = sourceRecord("pinned.jpg", Buffer.from("pinned")),
    unused = sourceRecord("unused.jpg", Buffer.from("unused"));
  manifest.outputs["pinned.jpg"] = { ...pinned, key: "media/pinned.jpg" };
  await writeAssetManifest(root, manifest);
  await fs.mkdir(path.join(root, ".asset-cache"));
  for (const record of [pinned, unused]) {
    const file = path.join(root, ".asset-cache", record.sha256 + ".jpg");
    await fs.writeFile(
      file,
      record.sha256 === pinned.sha256 ? "pinned" : "unused",
    );
    await fs.utimes(
      file,
      new Date(now - 8 * 86400000),
      new Date(now - 8 * 86400000),
    );
  }
  await fs.mkdir(cleanup.state, { recursive: true });
  const lock = path.join(cleanup.state, "write.lock");
  await fs.writeFile(lock, "release");
  assert.equal((await cleanup.sweep(now)).deferred, true);
  await fs.rm(lock);
  await cleanup.sweep(now);
  assert.equal(
    await fs.readFile(
      path.join(root, ".asset-cache", pinned.sha256 + ".jpg"),
      "utf8",
    ),
    "pinned",
  );
  await assert.rejects(
    fs.stat(path.join(root, ".asset-cache", unused.sha256 + ".jpg")),
    /ENOENT/,
  );
});
test("changed HEAD blocks push and failed push remains a failed release", async (t) => {
  const { root, git } = await repository(t);
  let pushed = false;
  await assert.rejects(
    releaseAssetCommit(
      root,
      async () => {
        git(["commit", "--allow-empty", "-m", "Concurrent source commit"]);
      },
      async () => {
        pushed = true;
      },
    ),
    /HEAD changed/,
  );
  assert.equal(pushed, false);
  await assert.rejects(
    releaseAssetCommit(
      root,
      async () => {},
      async () => {
        throw Error("Push rejected");
      },
    ),
    /Push rejected/,
  );
});
