import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { prepareCommitAudio } from "../scripts/prepare-commit-narration";
import { emptyAssetManifest, sourceRecord } from "../core/asset-manifest";
import { indexFingerprint } from "../tools/code-analysis/snapshot.mjs";

const manifest = "publishing/media-assets.json";
const article = "content/pieces/a/index.md";
function fixture(t: TestContext) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "commit-audio-test-")),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = ["CI", "AWS_BRANCH"].map((key) => [
    key,
    process.env[key],
  ]);
  for (const [key] of environment) delete process.env[key!];
  t.after(() => {
    for (const [key, value] of environment) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  });
  const write = (name: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "--quiet");
  git("config", "core.hooksPath", "/dev/null");
  write(
    ".gitignore",
    "node_modules/\n.venv-*/\n.authoring-state/\n.asset-cache/\ncontent/**/assets/\n",
  );
  for (const name of [
    "package-lock.json",
    "tools/code-analysis/requirements.txt",
    "prototypes/ink-and-paper/package-lock.json",
  ])
    write(name, "{}");
  write(
    "publishing/narration.yaml",
    "schemaVersion: 1\nrequired: true\nprofiles: {}\n",
  );
  write(manifest, JSON.stringify(emptyAssetManifest()));
  write(article, "Original article\n");
  git("add", ".");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "base",
  );
  for (const folder of [
    "node_modules",
    ".venv-analysis",
    "prototypes/ink-and-paper/node_modules",
  ])
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  write(".venv-narration/bin/python", "fixture");
  write(".authoring-state/narration/model.json", "{}");
  write(article, "Staged article\n");
  git("add", article);
  let prepared = false;
  const run = (snapshot: string, prepare: boolean) => {
    if (!prepare) {
      if (!prepared) throw Error("Out of date");
      return;
    }
    assert.equal(
      fs.readFileSync(path.join(snapshot, article), "utf8"),
      "Staged article\n",
    );
    const audio = Buffer.from("fixture audio"),
      name = "content/pieces/a/assets/narration-fixture.mp3";
    fs.mkdirSync(path.dirname(path.join(snapshot, name)), { recursive: true });
    fs.writeFileSync(path.join(snapshot, name), audio);
    const m = emptyAssetManifest();
    m.sources[name] = sourceRecord(name, audio);
    fs.writeFileSync(path.join(snapshot, manifest), JSON.stringify(m));
    fs.writeFileSync(
      path.join(snapshot, "publishing/narrations.json"),
      '{"ready":true}\n',
    );
    fs.writeFileSync(
      path.join(snapshot, "content/pieces/a/narration.yaml"),
      "voice: bm_george\n",
    );
    prepared = true;
  };
  return { root, write, git, run };
}
test("commit prepares staged prose, atomically stages only generated metadata and preserves unstaged prose", async (t) => {
  const f = fixture(t);
  f.write(article, "Unstaged next edit\n");
  f.write("unrelated.md", "Private draft\n");
  const files = await prepareCommitAudio(f.root, f.run);
  assert(files.includes(manifest));
  assert.equal(f.git("show", ":" + article), "Staged article\n");
  assert.equal(
    fs.readFileSync(path.join(f.root, article), "utf8"),
    "Unstaged next edit\n",
  );
  assert.equal(
    f.git("show", ":publishing/narrations.json"),
    '{"ready":true}\n',
  );
  assert.equal(f.git("ls-files", "unrelated.md"), "");
  assert.equal(f.git("ls-files", "content/pieces/a/assets"), "");
  assert.equal(
    fs.readFileSync(
      path.join(f.root, "content/pieces/a/assets/narration-fixture.mp3"),
      "utf8",
    ),
    "fixture audio",
  );
  const before = indexFingerprint(f.root);
  assert.deepEqual(await prepareCommitAudio(f.root, () => {}), []);
  assert.equal(indexFingerprint(f.root), before);
});
test("commit refuses to overwrite an unstaged manifest and leaves the index intact", async (t) => {
  const f = fixture(t);
  f.write(manifest, '{"privateDraft":"keep"}\n');
  const before = indexFingerprint(f.root);
  await assert.rejects(prepareCommitAudio(f.root, f.run), /Unstaged changes/);
  assert.equal(indexFingerprint(f.root), before);
  assert.equal(
    fs.readFileSync(path.join(f.root, manifest), "utf8"),
    '{"privateDraft":"keep"}\n',
  );
});
test("staging during synthesis and unexpected generated source edits fail closed", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    prepareCommitAudio(f.root, (snapshot, prepare) => {
      f.run(snapshot, prepare);
      if (prepare) {
        f.write("another.md", "New staging");
        f.git("add", "another.md");
      }
    }),
    /Staging changed/,
  );
  const g = fixture(t),
    before = indexFingerprint(g.root);
  await assert.rejects(
    prepareCommitAudio(g.root, (snapshot, prepare) => {
      g.run(snapshot, prepare);
      if (prepare)
        fs.writeFileSync(path.join(snapshot, article), "Unexpected rewrite");
    }),
    /unexpected files/,
  );
  assert.equal(indexFingerprint(g.root), before);
});
test("CI and current recordings never load the synthesis runtime", async (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.root, ".venv-narration"), { recursive: true });
  let calls = 0;
  assert.deepEqual(
    await prepareCommitAudio(f.root, (_dir, prepare) => {
      calls++;
      assert.equal(prepare, false);
    }),
    [],
  );
  assert.equal(calls, 1);
  process.env.CI = "1";
  assert.deepEqual(
    await prepareCommitAudio(f.root, () => {
      throw Error("Must not run");
    }),
    [],
  );
});
test("failed synthesis and a locked Git index do not stage partial results", async (t) => {
  const f = fixture(t),
    before = indexFingerprint(f.root);
  await assert.rejects(
    prepareCommitAudio(f.root, (_dir, prepare) => {
      throw Error(prepare ? "Needs explanation" : "Out of date");
    }),
    /Needs explanation/,
  );
  assert.equal(indexFingerprint(f.root), before);
  f.write(".git/index.lock", "Existing writer");
  await assert.rejects(prepareCommitAudio(f.root, f.run), /EEXIST/);
  assert.equal(indexFingerprint(f.root), before);
  assert.equal(
    fs.readFileSync(path.join(f.root, ".git/index.lock"), "utf8"),
    "Existing writer",
  );
});
test("preparation honours an alternate commit index and a macOS-style root alias", async (t) => {
  const f = fixture(t),
    alias = f.root + "-alias",
    index = path.join(f.root, ".git/index"),
    alternate = path.join(f.root, ".git/commit-index"),
    originalIndex = fs.readFileSync(index),
    previous = process.env.GIT_INDEX_FILE;
  fs.symlinkSync(f.root, alias, "dir");
  t.after(() => fs.rmSync(alias));
  fs.copyFileSync(index, alternate);
  process.env.GIT_INDEX_FILE = alternate;
  try {
    const files = await prepareCommitAudio(alias, f.run);
    assert(files.includes(manifest));
    assert.equal(
      f.git("show", ":publishing/narrations.json"),
      '{"ready":true}\n',
    );
    assert.deepEqual(fs.readFileSync(index), originalIndex);
  } finally {
    if (previous === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = previous;
  }
});
test("native path-limited commits stop before synthesis instead of leaving a stale retained index", async (t) => {
  const f = fixture(t),
    before = indexFingerprint(f.root);
  const hookFolder = path.join(f.root, ".git/test-hooks");
  fs.mkdirSync(hookFolder);
  const script = path.join(hookFolder, "prepare.mjs");
  fs.writeFileSync(
    script,
    `import { prepareCommitAudio } from ${JSON.stringify(new URL("../scripts/prepare-commit-narration.ts", import.meta.url).href)};\nawait prepareCommitAudio(process.cwd(), () => { throw Error("Out of date"); });\n`,
  );
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  fs.writeFileSync(
    path.join(hookFolder, "pre-commit"),
    `#!/bin/sh\nexec ${quote(process.execPath)} --import ${quote(createRequire(import.meta.url).resolve("tsx"))} ${quote(script)}\n`,
    { mode: 0o755 },
  );
  f.git("config", "core.hooksPath", hookFolder);
  assert.throws(
    () =>
      f.git(
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--only",
        "-m",
        "must stop",
        "--",
        article,
      ),
    /path-limited commit/,
  );
  assert.equal(indexFingerprint(f.root), before);
  assert.equal(f.git("show", "HEAD:" + article), "Original article\n");
});
