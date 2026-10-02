import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { S3Client } from "@aws-sdk/client-s3";
import { sourceRecord, emptyAssetManifest } from "../core/asset-manifest.ts";
import {
  ensureStoredAsset,
  privateAssetBytes,
  withAssetLease,
  recordAssetRelease,
} from "../core/asset-storage.ts";

async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "asset-storage-test-")),
  );
  const previous = process.env.NOTES_MEDIA_CONFIG,
    cwd = process.cwd();
  const config = path.join(root, "operator.json");
  await fs.writeFile(
    config,
    JSON.stringify({
      bucket: "fixture",
      region: "eu-west-1",
      accountId: "000000000000",
    }),
  );
  process.env.NOTES_MEDIA_CONFIG = config;
  t.after(async () => {
    process.chdir(cwd);
    if (previous === undefined) delete process.env.NOTES_MEDIA_CONFIG;
    else process.env.NOTES_MEDIA_CONFIG = previous;
    await fs.rm(root, { recursive: true, force: true });
  });
  const objects = new Map(),
    calls = [];
  const failure = (status) =>
    Object.assign(Error("S3 fixture"), {
      $metadata: { httpStatusCode: status },
    });
  const handlers = {
    HeadObjectCommand(input, old) {
      if (!old) throw failure(404);
      return { ...old, ContentLength: old.bytes.length };
    },
    GetObjectCommand(input, old) {
      if (!old) throw failure(404);
      return {
        ...old,
        Body: {
          transformToString: async () => old.bytes.toString(),
          transformToByteArray: async () => old.bytes,
        },
      };
    },
    GetObjectTaggingCommand(input, old) {
      return { TagSet: old.TagSet };
    },
    PutObjectTaggingCommand(input, old) {
      old.TagSet = input.Tagging.TagSet;
      return {};
    },
    DeleteObjectCommand(input) {
      objects.delete(input.Key);
      return {};
    },
    PutObjectCommand(input) {
      const bytes = Buffer.from(input.Body);
      const value = {
        ...input,
        bytes,
        TagSet: [...new URLSearchParams(input.Tagging ?? "")].map(
          ([Key, Value]) => ({ Key, Value }),
        ),
        ETag: `"etag-${calls.length}"`,
      };
      objects.set(input.Key, value);
      return { ETag: value.ETag };
    },
  };
  t.mock.method(S3Client.prototype, "send", async (command) => {
    const input = command.input,
      type = command.constructor.name,
      old = objects.get(input.Key);
    assert.equal(input.ExpectedBucketOwner, "000000000000");
    calls.push({ type, input });
    if (
      (input.IfNoneMatch === "*" && old) ||
      (input.IfMatch && input.IfMatch !== old?.ETag)
    )
      throw failure(412);
    return handlers[type](input, old);
  });
  return { root, objects, calls };
}
test("storage writes immutable checked objects, keeps drafts private and verifies idempotent reuse", async (t) => {
  const f = await fixture(t),
    bytes = Buffer.from("reviewed original"),
    record = sourceRecord("figure.png", bytes);
  await ensureStoredAsset(record, bytes, false);
  assert.equal(f.objects.get(record.key).CacheControl, "private, no-store");
  assert.equal(f.objects.get(record.key).ContentType, "image/png");
  assert.equal(
    f.objects.get(record.key).ChecksumSHA256,
    Buffer.from(record.sha256, "hex").toString("base64"),
  );
  assert.equal(f.calls.filter((x) => x.type === "PutObjectCommand").length, 1);
  await ensureStoredAsset(record, bytes, false);
  assert.equal(f.calls.filter((x) => x.type === "PutObjectCommand").length, 1);
  f.objects.get(record.key).TagSet = [
    { Key: "asset-unused-since", Value: "old" },
    { Key: "owner", Value: "keep" },
  ];
  await ensureStoredAsset(record, bytes, false);
  assert.deepEqual(f.objects.get(record.key).TagSet, [
    { Key: "owner", Value: "keep" },
    { Key: "asset-managed", Value: "v1" },
  ]);
  assert.deepEqual(await privateAssetBytes(record), bytes);
  await ensureStoredAsset({ ...record, key: "media/figure.png" }, bytes, true);
  assert(f.objects.has("published/media/figure.png"));
  assert.match(
    f.objects.get("published/media/figure.png").CacheControl,
    /s-maxage=300/,
  );
  await assert.rejects(
    ensureStoredAsset(record, Buffer.from("altered"), false),
    /checksum mismatch/,
  );
  f.objects.get(record.key).ChecksumSHA256 = "corrupt";
  await assert.rejects(
    ensureStoredAsset(record, bytes, false),
    /differs from manifest/,
  );
  assert.equal(f.calls.filter((x) => x.type === "PutObjectCommand").length, 2);
});
test("leases use create-first acquisition, exclude concurrent work and release even on failure", async (t) => {
  const f = await fixture(t),
    key = "asset-control/lease.json";
  assert.equal(
    await withAssetLease(async () => {
      assert.equal(f.calls[0].type, "PutObjectCommand");
      await assert.rejects(
        withAssetLease(async () =>
          assert.fail("Must not enter concurrent lease"),
        ),
        /Another asset release/,
      );
      return "leased";
    }),
    "leased",
  );
  assert(!f.objects.has(key));
  await assert.rejects(
    withAssetLease(async () => {
      throw Error("Callback failed");
    }),
    /Callback failed/,
  );
  assert(!f.objects.has(key));
  f.objects.set(key, {
    ETag: '"expired"',
    bytes: Buffer.from(JSON.stringify({ expires: new Date(0).toISOString() })),
  });
  await withAssetLease(async () => {});
  assert(
    f.calls.some(
      (x) => x.type === "PutObjectCommand" && x.input.IfMatch === '"expired"',
    ),
  );
  f.objects.set(key, {
    ETag: '"invalid"',
    bytes: Buffer.from(JSON.stringify({ expires: "invalid" })),
  });
  await assert.rejects(
    withAssetLease(async () => {}),
    /Invalid asset lease/,
  );
  assert(f.objects.has(key));
});
test("deployment inventories come from the exact commit even if the working manifest changes", async (t) => {
  const f = await fixture(t);
  process.chdir(f.root);
  await fs.mkdir("publishing");
  const manifest = emptyAssetManifest();
  await fs.writeFile("publishing/media-assets.json", JSON.stringify(manifest));
  const git = (args) =>
    execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Asset test"]);
  git(["config", "user.email", "asset@example.invalid"]);
  git(["add", "publishing/media-assets.json"]);
  git(["commit", "-m", "Inventory"]);
  const sha = git(["rev-parse", "HEAD"]);
  await fs.writeFile(
    "publishing/media-assets.json",
    "Changed while deployment was pending",
  );
  await recordAssetRelease(sha, "deployed");
  const stored = JSON.parse(f.objects.get(`asset-releases/${sha}.json`).bytes);
  assert.deepEqual(stored.manifest, manifest);
  assert.equal(stored.state, "deployed");
  assert.equal(stored.revision, sha);
  await assert.rejects(
    recordAssetRelease("bad", "pending"),
    /Invalid asset release revision/,
  );
});
