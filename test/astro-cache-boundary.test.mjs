import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// Resolve Astro's actual copy even if npm stops hoisting this transitive package.
const astroEntry = import.meta.resolve("astro");
const astroRequire = createRequire(astroEntry);
const CachePolicy = astroRequire("http-cache-semantics");
const { loadRemoteImage, revalidateRemoteImage } = await import(
  new URL("./assets/build/remote.js", astroEntry).href
);
const imageUrl = "https://example.test/image.png";
const now = 1_800_000_000_000;

function guardRequestEvaluation(t) {
  t.mock.method(Date, "now", () => now);
  for (const method of ["evaluateRequest", "satisfiesWithoutRevalidation"]) {
    t.mock.method(CachePolicy.prototype, method, () => {
      assert.fail(
        `Astro must not use ${method} for its build-time image cache`,
      );
    });
  }
}

test("Astro's image loader preserves public caching without evaluating client requests", async (t) => {
  guardRequestEvaluation(t);
  const result = await loadRemoteImage(imageUrl, async (request) => {
    assert.equal(request.headers.get("cache-control"), null);
    return new Response("image bytes", {
      headers: { "cache-control": "public, max-age=600", etag: '"image-v1"' },
    });
  });
  assert.equal(result.data.toString(), "image bytes");
  assert.equal(result.expires, now + 600_000);
  assert.equal(result.etag, '"image-v1"');
});

test("Astro's image loader gives shared Set-Cookie responses no reusable lifetime", async (t) => {
  guardRequestEvaluation(t);
  const result = await loadRemoteImage(
    imageUrl,
    async () =>
      new Response("private image", {
        headers: {
          "cache-control": "max-age=600",
          "set-cookie": "test-only=session",
        },
      }),
  );
  assert.equal(result.expires, now);
  assert.equal(result.data.toString(), "private image");
  assert.deepEqual(Object.keys(result).sort(), [
    "data",
    "etag",
    "expires",
    "lastModified",
  ]);
});

test("Astro's conditional image revalidation preserves the cached image and ETag", async (t) => {
  guardRequestEvaluation(t);
  const result = await revalidateRemoteImage(
    imageUrl,
    { etag: '"image-v1"' },
    async (request) => {
      assert.equal(request.headers.get("if-none-match"), '"image-v1"');
      assert.equal(request.headers.get("cache-control"), null);
      return new Response(null, {
        status: 304,
        headers: { "cache-control": "public, max-age=600" },
      });
    },
  );
  assert.equal(result.data, null);
  assert.equal(result.expires, now + 600_000);
  assert.equal(result.etag, '"image-v1"');
});
