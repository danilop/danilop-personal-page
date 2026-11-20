import test from "node:test";
import assert from "node:assert/strict";
import {
  addedObjects,
  manifestObjects,
  pushedRefs,
} from "../core/pushed-assets";

const record = (key: string, bytes: number, publicKey?: string) => ({
  sha256: "0".repeat(64),
  bytes,
  contentType: "image/png",
  key,
  ...(publicKey ? { publicKey } : {}),
});

test("asset push guard maps manifest records to bucket keys", () => {
  const objects = manifestObjects({
    schemaVersion: 1,
    sources: {
      "a.png": record("originals/a.png", 10, "media/a.png"),
    },
    outputs: { "a.webp": record("media/a.webp", 4) },
    recipes: [{ nested: record("originals/b.mp3", 7) }],
  });
  assert.deepEqual(
    [...objects.values()].sort((x, y) => x.key.localeCompare(y.key)),
    [
      { key: "originals/a.png", bytes: 10 },
      { key: "originals/b.mp3", bytes: 7 },
      { key: "published/media/a.png", bytes: 10 },
      { key: "published/media/a.webp", bytes: 4 },
    ],
  );
});

test("asset push guard reports only new or resized objects", () => {
  const before = { sources: { "a.png": record("originals/a.png", 10) } };
  const after = {
    sources: {
      "a.png": record("originals/a.png", 10),
      "b.png": record("originals/b.png", 5),
      "c.png": record("originals/c.png", 3),
    },
  };
  assert.deepEqual(
    addedObjects(before, after).map((o) => o.key),
    ["originals/b.png", "originals/c.png"],
  );
  assert.deepEqual(addedObjects(after, after), []);
  const resized = { sources: { "a.png": record("originals/a.png", 11) } };
  assert.deepEqual(
    addedObjects(before, resized).map((o) => o.key),
    ["originals/a.png"],
  );
  assert.deepEqual(addedObjects(after, before), []);
});

test("asset push guard reads hook input and skips deletions", () => {
  const sha = "a".repeat(40),
    zero = "0".repeat(40);
  assert.deepEqual(
    pushedRefs(
      `refs/heads/main ${sha} refs/heads/main ${zero}\n(delete) ${zero} refs/heads/old ${sha}\n\n`,
    ),
    [
      {
        localRef: "refs/heads/main",
        localSha: sha,
        remoteRef: "refs/heads/main",
        remoteSha: zero,
      },
    ],
  );
});
