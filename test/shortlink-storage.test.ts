import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import {
  ShortLinkStorage,
  redirectTarget,
  redirectCacheControl,
} from "../core/shortlink-storage";
const config = {
  schemaVersion: 2 as const,
  resolver: "s3-oac" as const,
  bucket: "fixture",
  distributionId: "fixture",
  region: "eu-west-1",
  canonicalOrigin: "https://example.com",
  shortOrigin: "https://short.example.com",
};
const target = "https://example.com/writing/hello/";
function fixture() {
  const objects = new Map<
    string,
    {
      Body: string;
      ETag: string;
      WebsiteRedirectLocation?: string;
      CacheControl?: string;
      Metadata?: Record<string, string>;
    }
  >();
  const calls: { type: string; input: Record<string, unknown> }[] = [];
  let failNextPut = false;
  const s3 = {
    async send(command: {
      constructor: { name: string };
      input: Record<string, unknown>;
    }) {
      const { input } = command,
        type = command.constructor.name;
      calls.push({ type, input });
      const key = String(input.Key),
        old = objects.get(key);
      const missing = () =>
        Object.assign(new Error("missing"), { name: "NoSuchKey" });
      if (type === "ListObjectsV2Command")
        return {
          Contents: [...objects.keys()]
            .filter((name) => name.startsWith(String(input.Prefix)))
            .map((Key) => ({ Key })),
        };
      if (type === "HeadObjectCommand") {
        if (!old) throw missing();
        return old;
      }
      if (type === "GetObjectCommand") {
        if (!old) throw missing();
        return { ...old, Body: { transformToString: async () => old.Body } };
      }
      if (
        (input.IfNoneMatch === "*" && old) ||
        (input.IfMatch && input.IfMatch !== old?.ETag)
      )
        throw Object.assign(new Error("stale"), { name: "PreconditionFailed" });
      if (type === "PutObjectCommand") {
        if (failNextPut && key.startsWith("redirects/")) {
          failNextPut = false;
          throw Error("interrupted write");
        }
        const Body = String(input.Body);
        const value = {
          ...input,
          Body,
          ETag: crypto.createHash("md5").update(Body).digest("hex"),
        };
        objects.set(key, value);
        return value;
      }
      if (type === "DeleteObjectCommand") {
        objects.delete(key);
        return {};
      }
      throw Error("Unmocked: " + type);
    },
  } as unknown as S3Client;
  const cf = {
    async send(command: {
      constructor: { name: string };
      input: Record<string, unknown>;
    }) {
      calls.push({ type: command.constructor.name, input: command.input });
      return {};
    },
  } as unknown as CloudFrontClient;
  return {
    store: new ShortLinkStorage(config, s3, cf),
    objects,
    calls,
    interrupt: () => {
      failNextPut = true;
    },
  };
}
test("S3 publication creates both paths, changes ETags with targets, and withdraws without losing ownership", async () => {
  const f = fixture(),
    manifest = { schemaVersion: 1, links: { hello: { ref: "article" } } };
  let verified = 0;
  assert.deepEqual(
    await f.store.publish(manifest, { hello: target }, "revision", async () => {
      verified++;
    }),
    { changes: ["hello"], removed: [] },
  );
  assert(verified >= 3);
  assert.equal(
    f.objects.get("redirects/hello/")!.WebsiteRedirectLocation,
    target,
  );
  assert.equal(
    f.objects.get("redirects/hello")!.CacheControl,
    redirectCacheControl,
  );
  const first = f.objects.get("redirects/hello")!.ETag;
  assert.deepEqual(
    await f.store.publish(
      manifest,
      { hello: target },
      "revision",
      async () => {},
    ),
    { changes: [], removed: [] },
  );
  await f.store.publish(
    manifest,
    { hello: target + "new/" },
    "revision",
    async () => {},
  );
  assert.notEqual(f.objects.get("redirects/hello")!.ETag, first);
  await f.store.publish(
    { schemaVersion: 1, links: {}, removed: { hello: "article" } },
    {},
    "revision",
    async () => {},
  );
  assert(!f.objects.has("redirects/hello"));
  assert(!f.objects.has("redirects/hello/"));
  assert.equal(
    JSON.parse(f.objects.get("publication/shortlinks/owners.json")!.Body).hello,
    "article",
  );
  assert(!f.objects.has("publication/shortlinks/lock.json"));
  assert(f.calls.some((call) => call.type === "CreateInvalidationCommand"));
  await assert.rejects(
    f.store.publish(
      { schemaVersion: 1, links: { hello: { ref: "another" } } },
      { hello: target },
      "revision",
      async () => {},
    ),
    /already belongs/,
  );
});
test("publication rejects unowned objects and unavailable deployment before changing aliases", async () => {
  const f = fixture(),
    manifest = { schemaVersion: 1, links: { hello: { ref: "article" } } };
  await assert.rejects(
    f.store.publish(manifest, { hello: target }, "revision", async () => {
      throw Error("not deployed");
    }),
    /not deployed/,
  );
  assert.equal(f.calls.length, 0);
  f.objects.set("redirects/hello", {
    Body: "unowned",
    ETag: "other",
    WebsiteRedirectLocation: target,
  });
  await assert.rejects(
    f.store.publish(manifest, { hello: target }, "revision", async () => {}),
    /ownership/,
  );
  assert.equal(f.objects.get("redirects/hello")!.Body, "unowned");
  assert(!f.objects.has("publication/shortlinks/lock.json"));
});
test("interrupted first publication retains ownership and can converge on retry", async () => {
  const f = fixture(),
    manifest = { schemaVersion: 1, links: { hello: { ref: "article" } } };
  f.interrupt();
  await assert.rejects(
    f.store.publish(manifest, { hello: target }, "revision", async () => {}),
    /interrupted/,
  );
  assert(!f.objects.has("publication/shortlinks/lock.json"));
  assert.equal(
    JSON.parse(f.objects.get("publication/shortlinks/owners.json")!.Body).hello,
    "article",
  );
  await f.store.publish(
    manifest,
    { hello: target },
    "revision",
    async () => {},
  );
  assert.equal(
    f.objects.get("redirects/hello/")!.WebsiteRedirectLocation,
    target,
  );
});
test("targets reject lookalike hosts, credentials and header injection", () => {
  for (const value of [
    "https://example.com.evil/",
    "http://example.com/",
    "https://user@example.com/",
    target + "\r\nBad: yes",
    target + "\\bad",
  ])
    assert.throws(() => redirectTarget(value, config.canonicalOrigin));
  assert.equal(redirectTarget(target, config.canonicalOrigin), target);
});
