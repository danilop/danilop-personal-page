import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForRevision } from "../scripts/verify-deployment.mjs";
const markerUrl = "https://example.com/new/build.json";
const response = (revision: string, cache = "no-store") =>
  new Response(JSON.stringify({ revision }), {
    headers: { "cache-control": cache },
  });

test("deployment verification waits through stale markers and transient failures", async () => {
  let time = 0,
    calls = 0;
  const result = await waitForRevision({
    markerUrl,
    revision: "new",
    timeoutMs: 30,
    intervalMs: 10,
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
    fetcher: async () => {
      calls++;
      if (calls === 1) throw Error("Temporary network failure");
      return response(calls === 2 ? "old" : "new");
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.status, "deployed");
});

test("deployment verification rejects stale revisions, HTML fallbacks and cached markers", async () => {
  for (const fetcher of [
    async () => response("old"),
    async () => new Response("<html>Old site</html>"),
    async () => response("new", "max-age=3600"),
  ])
    await assert.rejects(
      waitForRevision({ markerUrl, revision: "new", fetcher }),
      /not verified/,
    );
});

test("superseded deployments do not claim verification or poll the old revision", async () => {
  const result = await waitForRevision({
    markerUrl,
    revision: "old",
    currentRevision: async () => "new",
    fetcher: async () => {
      throw Error("Must not fetch");
    },
  });
  assert.deepEqual(result, { status: "superseded", revision: "new" });
});
