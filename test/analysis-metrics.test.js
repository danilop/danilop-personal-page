const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync, execFileSync } = require("node:child_process");

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "analysis-metrics-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}
function architecture(root, files) {
  const result = spawnSync(
    process.execPath,
    [path.resolve("tools/code-analysis/architecture.mjs"), ...files],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.error, undefined);
  assert.ok(result.stdout, result.stderr);
  return { status: result.status, ...JSON.parse(result.stdout) };
}

test("architecture blocks runtime cycles and transitive browser/private, Node and prototype leaks", (t) => {
  const files = {
    "runtime/client.ts": 'import "../lib/bridge";',
    "lib/bridge.ts":
      'import "../core/author-private"; import "../prototypes/example";',
    "core/author-private.ts": 'import "node:fs"; import "../scripts/entry";',
    "scripts/entry.ts": 'import "../core/author-private";',
    "prototypes/example.ts": 'import "../core/author-private";',
  };
  const result = architecture(fixture(t, files), Object.keys(files));
  assert.equal(result.status, 1, JSON.stringify(result.modules));
  const rules = new Set(result.summary.violations.map((row) => row.rule.name));
  for (const rule of [
    "no-runtime-cycles",
    "browser-no-node",
    "browser-no-private-tools",
    "core-no-entrypoints",
    "production-no-prototypes-or-tests",
    "prototype-no-production",
  ])
    assert.ok(rules.has(rule), `Missing ${rule}`);
});

test("architecture allows server-side Node, safe shared browser code and type-only cycles", (t) => {
  const files = {
    "runtime/client.ts":
      'import { value } from "../core/shared"; import type { Server } from "../core/author-server"; console.log(value); export type Client = Server;',
    "core/shared.ts": "export const value = 1;",
    "core/author-server.ts":
      'import "node:fs"; import type { Client } from "../runtime/client"; export type Server = { client: Client };',
    "site/data.ts": 'import "node:fs";',
  };
  const result = architecture(fixture(t, files), Object.keys(files));
  assert.equal(result.status, 0);
  assert.deepEqual(result.summary.violations, []);
});

test("history counts commits within the window, keeps unusual names intact and labels new files", async (t) => {
  const { readHistory } = await import("../tools/code-analysis/hotspots.mjs");
  const unusual = "space\nfile.js";
  const root = fixture(t, { [unusual]: "old", "old.js": "old" });
  const git = (args, date) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      },
    });
  git(["init", "--quiet"]);
  git(["config", "core.hooksPath", "/dev/null"]);
  const commit = (date) => {
    git(["add", "."]);
    git(
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        "fixture",
      ],
      date,
    );
  };
  commit("2025-01-01T12:00:00Z");
  fs.writeFileSync(path.join(root, unusual), "recent");
  commit("2026-09-01T12:00:00Z");
  fs.writeFileSync(path.join(root, unusual), "pending");
  fs.writeFileSync(path.join(root, "new.js"), "new");
  const history = readHistory(root, new Date("2026-09-25T12:00:00Z"));
  assert.equal(history.status, "complete");
  assert.equal(history.commits[unusual], 1);
  assert.equal(history.commits["old.js"], undefined);
  assert.ok(history.changed.includes(unusual));
  assert.ok(history.changed.includes("new.js"));
  assert.equal(history.committed.includes("new.js"), false);
  fs.writeFileSync(path.join(root, ".git/shallow"), git(["rev-parse", "HEAD"]));
  const { createSnapshot, attachRepository } =
    await import("../tools/code-analysis/snapshot.mjs");
  const snapshot = createSnapshot(root, { worktree: true });
  try {
    attachRepository(root, snapshot.dir);
    assert.equal(readHistory(snapshot.dir).status, "partial");
  } finally {
    snapshot.cleanup();
  }
});

test("hotspot ranking keeps unknown coverage and absent history distinct from zero", async (t) => {
  const { readHistory, buildHotspots } =
    await import("../tools/code-analysis/hotspots.mjs");
  const root = fixture(t, {});
  assert.equal(readHistory(root).status, "unavailable");
  const row = (file) => ({ file, line: 1, message: "complex" });
  const js = {
    [path.join(root, "zero.ts")]: {
      lines: { total: 10, pct: 0 },
      branches: { total: 2, pct: 0 },
    },
  };
  const result = buildHotspots(root, {
    complexity: [row("zero.ts"), row("unknown.astro"), row("changed.ts")],
    pythonComplexity: [],
    js,
    history: {
      changed: ["changed.ts"],
      committed: ["zero.ts", "unknown.astro"],
      commits: { "zero.ts": 5, "unknown.astro": 5 },
    },
  });
  assert.deepEqual(
    result.map((item) => item.file),
    ["changed.ts", "unknown.astro", "zero.ts"],
  );
  assert.equal(result[0].committed, false);
  assert.equal(result[1].coverage, null);
  assert.equal(result[2].coverage.branches, 0);
});

test("static reports reject stale coverage and failed tests never improve hotspot ranking", async (t) => {
  const { writeReport } = await import("../tools/code-analysis/report.mjs");
  const source = "complex.ts";
  const root = fixture(t, {
    ".analysis/eslint.json": JSON.stringify([
      {
        filePath: source,
        messages: [{ ruleId: "complexity", line: 1, message: "complex" }],
      },
    ]),
    ".analysis/node-tests.json": '{"passed":false}',
    "coverage/javascript/coverage-summary.json": JSON.stringify({
      total: {
        lines: { pct: 100 },
        statements: { pct: 100 },
        functions: { pct: 100 },
        branches: { pct: 100 },
      },
      [source]: {
        lines: { total: 1, pct: 100 },
        branches: { total: 1, pct: 100 },
      },
    }),
  });
  const summary = {
    mode: "static",
    checkedAt: new Date().toISOString(),
    passed: false,
    checks: [
      { check: "eslint", passed: false, report: ".analysis/eslint.json" },
    ],
  };
  writeReport(root, summary);
  const read = () =>
    JSON.parse(fs.readFileSync(path.join(root, ".analysis/metrics.json")));
  assert.equal(read().javascript, null);
  summary.mode = "all";
  summary.checks.push({
    check: "javascript-coverage",
    passed: false,
    report: ".analysis/javascript-coverage.log",
  });
  fs.writeFileSync(
    path.join(root, ".analysis/eslint.json"),
    JSON.stringify([
      {
        filePath: path.join(root, source),
        messages: [{ ruleId: "complexity", line: 1, message: "complex" }],
      },
    ]),
  );
  writeReport(root, summary);
  assert.equal(read().hotspots[0].coverage, null);
  fs.writeFileSync(
    path.join(root, ".analysis/node-tests.json"),
    '{"passed":true}',
  );
  writeReport(root, summary);
  assert.equal(read().hotspots[0].coverage.branches, 100);
});

test("Python hotspot coverage separates statements and branches, including files without branches", async (t) => {
  const { buildHotspots } = await import("../tools/code-analysis/hotspots.mjs");
  const root = fixture(t, {});
  const findings = ["branch.py", "linear.py"].map((file) => ({
    file,
    line: 1,
  }));
  const result = buildHotspots(root, {
    complexity: [],
    pythonComplexity: findings,
    python: {
      files: {
        "branch.py": {
          summary: {
            num_statements: 10,
            covered_lines: 8,
            num_branches: 4,
            covered_branches: 1,
          },
        },
        "linear.py": {
          summary: {
            num_statements: 2,
            covered_lines: 2,
            num_branches: 0,
            covered_branches: 0,
          },
        },
      },
    },
    history: { changed: null, committed: null, commits: null },
  });
  assert.deepEqual(result.find((row) => row.file === "branch.py").coverage, {
    lines: 80,
    branches: 25,
  });
  assert.equal(
    result.find((row) => row.file === "linear.py").coverage.branches,
    null,
  );
  assert.equal(result[0].commits, null);
});

test("architecture fails closed when graph generation fails", (t) => {
  const root = fixture(t, {});
  const result = spawnSync(
    process.execPath,
    [path.resolve("tools/code-analysis/architecture.mjs"), "missing.ts"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dependency graph is missing or invalid/);
});
