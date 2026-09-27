const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
test("preview defaults to the complete workspace and all modes use one default port", async () => {
  const { previewOptions } = await import("../core/preview-cli.mjs");
  for (const [args, mode] of [
    [[], "live"],
    [["--release"], "release"],
    [["--snapshot"], "snapshot"],
    [["--snapshot", "--serve-only"], "snapshot-output"],
    [["--watch"], "live"],
  ]) {
    const result = previewOptions(args);
    assert.equal(result.mode, mode);
    assert.equal(result.port, 4322);
  }
  assert.equal(previewOptions(["--port", "4330"]).port, 4330);
  assert.equal(previewOptions(["--watch"]).watch, true);
  assert.equal(previewOptions([]).watch, false);
});
test("snapshot selectors remain explicit and preserve repeated selections", async () => {
  const { previewOptions } = await import("../core/preview-cli.mjs");
  const opts = [
    "--from",
    "other/content",
    "--piece",
    "one",
    "--piece",
    "two",
    "--exclude-piece",
    "three",
    "--build-only",
  ];
  assert.deepEqual(previewOptions(["--snapshot", ...opts]).snapshotArgs, [
    ...opts,
    "--port",
    "4322",
  ]);
  for (const args of [
    ["--piece", "one"],
    ["--build-only"],
    ["--serve-only"],
    ["--release", "--snapshot"],
    ["--snapshot", "--serve-only", "--all"],
    ["--port", "80"],
    ["--port", "no"],
    ["--port"],
    ["--authoring"],
    ["--watch", "--release"],
    ["--watch", "--snapshot"],
  ])
    assert.throws(() => previewOptions(args));
});
test("preview help exits without starting servers and obsolete command aliases are removed", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/preview-site.mjs", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Full local site with drafts/);
  assert.match(run.stdout, /--snapshot/);
  assert.match(run.stdout, /--watch/);
  const pkg = require("../package.json");
  assert.equal(pkg.scripts.author, undefined);
  assert.equal(pkg.scripts["preview:authoring"], undefined);
  const bad = spawnSync(
    process.execPath,
    ["scripts/preview-site.mjs", "--collection", "book"],
    { encoding: "utf8" },
  );
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /require --snapshot/);
});
