import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { S3Client } from "@aws-sdk/client-s3";
import { sourceRecord, emptyAssetManifest } from "../core/asset-manifest.ts";
import {
  syncStoredAssets,
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
    HeadBucketCommand() {
      return {};
    },
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
          transformToWebStream: () =>
            new ReadableStream({
              start(controller) {
                controller.enqueue(old.bytes);
                controller.close();
              },
            }),
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
test("CLI sync verifies stored objects, preserves ownership tags and rejects corrupt or absent assets", async (t) => {
  const f = await fixture(t),
    bytes = Buffer.from("reviewed original"),
    record = sourceRecord("figure.png", bytes);
  const originalId = process.env.AWS_ACCESS_KEY_ID,
    originalSecret = process.env.AWS_SECRET_ACCESS_KEY;
  process.env.AWS_ACCESS_KEY_ID = "fixture-id";
  process.env.AWS_SECRET_ACCESS_KEY = "fixture-secret";
  t.after(() => {
    if (originalId === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    else process.env.AWS_ACCESS_KEY_ID = originalId;
    if (originalSecret === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    else process.env.AWS_SECRET_ACCESS_KEY = originalSecret;
  });
  const group = {
    directory: f.root,
    publicFile: false,
    contentType: record.contentType,
    records: [record],
  };
  const commands = [];
  const run = async (args, env) => {
    if (args[0] === "--version")
      return { exitCode: 0, stdout: "aws-cli/2.37.12 Python/test", stderr: "" };
    commands.push(args);
    assert.equal(env.AWS_ACCESS_KEY_ID, "fixture-id");
    assert.equal(env.AWS_SECRET_ACCESS_KEY, "fixture-secret");
    assert(args.includes("--no-overwrite"));
    assert(!args.includes("--delete"));
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  // A successful process is not proof that all expected objects exist.
  await assert.rejects(syncStoredAssets([group], run), /S3 fixture/);
  f.objects.set(record.key, {
    bytes,
    ContentType: record.contentType,
    ChecksumSHA256: Buffer.from(record.sha256, "hex").toString("base64"),
    TagSet: [
      { Key: "owner", Value: "keep" },
      { Key: "asset-unused-since", Value: "old" },
    ],
  });
  await syncStoredAssets([group], run);
  assert.deepEqual(f.objects.get(record.key).TagSet, [
    { Key: "owner", Value: "keep" },
    { Key: "asset-managed", Value: "v1" },
  ]);
  const taggingCalls = () =>
    f.calls.filter((x) => x.type === "PutObjectTaggingCommand").length;
  assert.equal(taggingCalls(), 1);
  await syncStoredAssets([group], run);
  assert.equal(taggingCalls(), 1);
  assert.deepEqual(await privateAssetBytes(record), bytes);
  f.objects.get(record.key).ChecksumSHA256 = "corrupt";
  await assert.rejects(syncStoredAssets([group], run), /differs from manifest/);
  f.objects.get(record.key).ChecksumType = "COMPOSITE";
  await syncStoredAssets([group], run);
  f.objects.get(record.key).bytes = Buffer.alloc(bytes.length);
  await assert.rejects(syncStoredAssets([group], run), /differs from manifest/);
  f.objects.set("published/" + record.key, {
    bytes,
    ContentType: record.contentType,
    ChecksumSHA256: Buffer.from(record.sha256, "hex").toString("base64"),
    TagSet: [],
  });
  await syncStoredAssets([{ ...group, publicFile: true }], run);
  assert(commands.at(-1).includes("s3://fixture/published/"));
  await syncStoredAssets(
    [{ ...group, publicFile: true, disposition: "attachment" }],
    run,
  );
  assert.equal(
    commands.at(-1)[commands.at(-1).indexOf("--content-disposition") + 1],
    "attachment",
  );
  assert(
    commands
      .at(-1)
      .includes("public, max-age=0, s-maxage=300, must-revalidate"),
  );
  assert(!f.calls.some((x) => x.type === "PutObjectCommand"));
  const before = f.calls.length;
  await assert.rejects(
    syncStoredAssets([group], async () => {
      throw Error("CLI unavailable");
    }),
    /CLI unavailable/,
  );
  assert.equal(f.calls.length, before);
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
