const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

async function repository(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "analysis-contract-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git(["init", "--quiet"]);
  git(["config", "core.hooksPath", "/dev/null"]);
  return { ...(await import("../tools/code-analysis/snapshot.mjs")), dir, git };
}

test("commit snapshot checks staged bytes, preserves partial staging, and omits ignored secrets", async (t) => {
  const { dir, git, createSnapshot, indexFingerprint } = await repository(t);
  const name = "space;$(not-a-command).js";
  fs.writeFileSync(path.join(dir, name), "staged\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), ".env\n");
  fs.writeFileSync(
    path.join(dir, ".env"),
    "private fixture, not a credential\n",
  );
  git(["add", "--", name, ".gitignore"]);
  fs.writeFileSync(path.join(dir, name), "working\n");
  fs.writeFileSync(path.join(dir, "new.js"), "untracked\n");
  const before = indexFingerprint(dir);
  const snapshot = createSnapshot(dir);
  try {
    assert.equal(
      fs.readFileSync(path.join(snapshot.dir, name), "utf8"),
      "staged\n",
    );
    assert.equal(fs.existsSync(path.join(snapshot.dir, ".env")), false);
    assert.equal(fs.existsSync(path.join(snapshot.dir, "new.js")), false);
    assert.equal(fs.readFileSync(path.join(dir, name), "utf8"), "working\n");
    assert.equal(indexFingerprint(dir), before);
  } finally {
    snapshot.cleanup();
  }
});

test("working snapshot includes untracked files and respects unstaged deletion and ignore rules", async (t) => {
  const { dir, git, createSnapshot } = await repository(t);
  fs.writeFileSync(path.join(dir, "deleted.js"), "gone\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), ".env\n");
  git(["add", "."]);
  fs.unlinkSync(path.join(dir, "deleted.js"));
  fs.writeFileSync(path.join(dir, "new.js"), "new\n");
  fs.writeFileSync(path.join(dir, ".env"), "private fixture\n");
  const snapshot = createSnapshot(dir, { worktree: true });
  try {
    assert.equal(
      fs.readFileSync(path.join(snapshot.dir, "new.js"), "utf8"),
      "new\n",
    );
    assert.equal(fs.existsSync(path.join(snapshot.dir, "deleted.js")), false);
    assert.equal(fs.existsSync(path.join(snapshot.dir, ".env")), false);
  } finally {
    snapshot.cleanup();
  }
});

test("staged deletion is absent, and staged symlinks fail closed", async (t) => {
  const { dir, git, createSnapshot } = await repository(t);
  fs.writeFileSync(path.join(dir, "deleted.js"), "gone\n");
  git(["add", "."]);
  git(["rm", "--cached", "deleted.js"]);
  const snapshot = createSnapshot(dir);
  try {
    assert.equal(fs.existsSync(path.join(snapshot.dir, "deleted.js")), false);
  } finally {
    snapshot.cleanup();
  }
  fs.symlinkSync(os.tmpdir(), path.join(dir, "outside"));
  git(["add", "outside"]);
  assert.throws(() => createSnapshot(dir), /symlinks/);
});

test("dependency attachment refuses partially staged lockfiles", async (t) => {
  const { dir, createSnapshot, attachTools, git } = await repository(t);
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    '{"lockfileVersion":3}\n',
  );
  git(["add", "."]);
  const snapshot = createSnapshot(dir);
  try {
    fs.writeFileSync(
      path.join(dir, "package-lock.json"),
      '{"lockfileVersion":2}\n',
    );
    assert.throws(() => attachTools(dir, snapshot.dir), /differ/);
  } finally {
    snapshot.cleanup();
  }
});

test("the analyzer executes through a symlinked path instead of silently succeeding", async (t) => {
  const { dir } = await repository(t);
  const link = path.join(dir, "runner.mjs");
  fs.symlinkSync(path.resolve("tools/code-analysis/run.mjs"), link);
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(process.execPath, [link, "invalid-mode"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown analysis mode/);
});

test("snapshot Git metadata is independent and tool symlinks stay out of source inventories", async (t) => {
  const { dir, git, createSnapshot, attachRepository } = await repository(t);
  fs.writeFileSync(path.join(dir, "source.js"), "original\n");
  git(["add", "."]);
  git([
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture",
  ]);
  const head = git(["rev-parse", "HEAD"]);
  const snapshot = createSnapshot(dir);
  try {
    attachRepository(dir, snapshot.dir);
    fs.symlinkSync(os.tmpdir(), path.join(snapshot.dir, ".venv-analysis"));
    fs.symlinkSync(os.tmpdir(), path.join(snapshot.dir, "node_modules"));
    const listed = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: snapshot.dir, encoding: "utf8" },
    );
    assert.equal(listed, "source.js\n");
    assert.equal(
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: snapshot.dir,
        encoding: "utf8",
      }),
      head,
    );
    execFileSync("git", ["rm", "--cached", "source.js"], { cwd: snapshot.dir });
    assert.equal(git(["ls-files"]), "source.js\n");
    assert.equal(git(["rev-parse", "HEAD"]), head);
  } finally {
    snapshot.cleanup();
  }
});

test("analysis orchestration records every check and fails closed without skipping later checks", async (t) => {
  const { dir } = await repository(t);
  const { main } = await import("../tools/code-analysis/run.mjs");
  fs.writeFileSync(path.join(dir, ".nvmrc"), process.versions.node);
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(
    path.join(dir, "scripts/example.js"),
    'console.log("fixture");\n',
  );
  fs.mkdirSync(path.join(dir, ".githooks"));
  fs.writeFileSync(
    path.join(dir, ".githooks/pre-commit"),
    "#!/bin/sh\nexit 0\n",
  );
  const argv = process.argv,
    exitCode = process.exitCode;
  t.after(() => {
    process.argv = argv;
    process.exitCode = exitCode;
  });
  const invocations = [];
  const run = (command, args) => {
    invocations.push({ command, args });
    return {
      status: command.endsWith("/eslint") ? 1 : 0,
      stdout: "",
      stderr: "",
    };
  };
  process.argv = [process.execPath, "analyzer", "ci"];
  main({ workspace: dir, run });
  const summary = JSON.parse(
    fs.readFileSync(path.join(dir, ".analysis/summary.json"), "utf8"),
  );
  assert.equal(process.exitCode, 1);
  assert.equal(summary.passed, false);
  assert.equal(summary.checks.length, 27);
  assert.deepEqual(
    summary.checks.filter((row) => !row.passed).map((row) => row.check),
    ["eslint"],
  );
  assert.equal(summary.checks.at(-1).check, "release-build");
  assert(invocations.some((call) => call.args.includes("scripts/prepare.ts")));
  assert(invocations.some((call) => call.command.endsWith("/c8")));
  assert(fs.existsSync(path.join(dir, ".analysis/report.md")));
});
