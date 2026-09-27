import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeReport } from "./report.mjs";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const nodeBin = path.dirname(process.execPath);
const python = path.join(root, ".venv-analysis/bin/python");
const bin = (name) => path.join(root, "node_modules/.bin", name);
const pybin = (name) => path.join(root, ".venv-analysis/bin", name);
export const environment = {
  ...process.env,
  PATH: `${nodeBin}${path.delimiter}${path.join(root, ".venv-analysis/bin")}${path.delimiter}${process.env.PATH}`,
  NO_COLOR: "1",
  PYTHONDONTWRITEBYTECODE: "1",
  UV_CACHE_DIR: path.join(root, ".cache/uv"),
};

export function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    ...options,
  });
}

const excluded = new Set([
  "node_modules",
  ".git",
  ".astro",
  ".generated",
  ".cache",
  ".analysis",
  ".authoring-state",
  ".publication-state",
  "coverage",
  "outputs",
  "dist",
  "public",
  "legacy",
  "cache",
  "exports",
  "data",
  "content",
  "site-assets",
]);
export function sourceFiles(dir = root, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      if (excluded.has(entry.name) || entry.name.startsWith(".venv")) return [];
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) return [];
      return entry.isDirectory()
        ? sourceFiles(full, base)
        : [path.relative(base, full).replaceAll(path.sep, "/")];
    })
    .sort();
}

export function main({ workspace = root, run = execute } = {}) {
  const root = workspace;
  const mode = process.argv[2] ?? "all";
  if (!["all", "static", "coverage", "ci"].includes(mode))
    throw Error(`Unknown analysis mode: ${mode}`);
  const requiredNode = fs
    .readFileSync(path.join(root, ".nvmrc"), "utf8")
    .trim();
  if (process.versions.node !== requiredNode)
    throw Error(
      `Use Node ${requiredNode} from .nvmrc; found ${process.versions.node}.`,
    );
  const dir = path.join(root, ".analysis");
  fs.mkdirSync(dir, { recursive: true });
  const files = sourceFiles(root);
  const reports = [];
  const task = (id, command, args, options) => {
    const started = Date.now();
    process.stdout.write(`Checking ${id}…\n`);
    const result = run(command, args, options);
    const output =
      (result.stdout ?? "") +
      (result.stderr ?? "") +
      (result.error ? `\n${result.error.message}\n` : "");
    fs.writeFileSync(path.join(dir, `${id}.log`), output);
    const row = {
      check: id,
      passed: result.status === 0 && !result.error,
      exitCode: result.status,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      report:
        id === "eslint" && fs.existsSync(path.join(dir, "eslint.json"))
          ? ".analysis/eslint.json"
          : `.analysis/${id}.log`,
    };
    reports.push(row);
    console.log(
      `${row.passed ? "PASS" : "FAIL"} ${id} (${row.seconds}s); ${row.report}`,
    );
  };
  task("tool-versions", process.execPath, ["tools/code-analysis/versions.mjs"]);
  if (mode !== "coverage") {
    task("eslint", bin("eslint"), [
      ".",
      "--max-warnings",
      "0",
      "--format",
      "json",
      "--output-file",
      ".analysis/eslint.json",
    ]);
    task("types", bin("astro"), ["check"]);
    task("core-types", bin("tsc"), ["--noEmit", "-p", "tsconfig.core.json"]);
    task("dead-code", bin("knip"), ["--reporter", "json"]);
    task("architecture", process.execPath, [
      "tools/code-analysis/architecture.mjs",
      ...files.filter((file) =>
        /^(core|runtime|renderers|themes|site|authoring|scripts|lib|infrastructure|prototypes|tools\/code-analysis|test)\/.*\.(?:[cm]?js|jsx|ts)$/.test(
          file,
        ),
      ),
      "processLinks.js",
    ]);
    task("styles", bin("stylelint"), [
      ...files.filter((f) => /\.(css|astro|html)$/.test(f)),
      "--formatter",
      "json",
      "--max-warnings",
      "0",
    ]);
    task(
      "html",
      bin("html-validate"),
      files.filter((f) => /\.html$/.test(f)),
    );
    task("format", bin("prettier"), [
      "--check",
      ...files.filter((f) =>
        /\.(?:[cm]?js|jsx|ts|astro|css|html|json|ya?ml)$/.test(f),
      ),
    ]);
    task("ruff", pybin("ruff"), ["check", ".", "--output-format", "json"]);
    task("python-format", pybin("ruff"), ["format", "--check", "."]);
    task("python-types", pybin("ty"), [
      "check",
      "--python",
      python,
      "--error-on-warning",
    ]);
    task("python-dead-code", python, ["-m", "vulture"]);
    task("python-security", python, [
      "-m",
      "bandit",
      "-r",
      "tools",
      "-x",
      "test_analysis.py",
      "-f",
      "json",
    ]);
    task("python-complexity", python, ["-m", "radon", "cc", "tools", "-j"]);
    task("secrets", "gitleaks", [
      "dir",
      ".",
      "--config",
      ".gitleaks.toml",
      "--redact",
      "--no-banner",
      "--report-format",
      "json",
      "--report-path",
      ".analysis/secrets.json",
    ]);
    const workflows = files.filter((f) =>
      /^\.github\/workflows\/.*\.ya?ml$/.test(f),
    );
    task("workflows", "actionlint", ["-color", ...workflows]);
    const shell = files.filter(
      (f) => f.endsWith(".sh") || f.startsWith(".githooks/"),
    );
    if (shell.length)
      task("shell", "shellcheck", ["--severity=style", ...shell]);
  }
  if (mode !== "static") {
    fs.mkdirSync(path.join(root, "coverage/python"), { recursive: true });
    task("prototype-build", "npm", [
      "--prefix",
      "prototypes/ink-and-paper",
      "run",
      "build",
    ]);
    task("javascript-coverage", bin("c8"), [
      process.execPath,
      "tools/code-analysis/test-node.mjs",
    ]);
    task("python-tests", python, [
      "-m",
      "coverage",
      "run",
      "-m",
      "unittest",
      "discover",
      "-s",
      "tools/content-quality",
      "-p",
      "test_*.py",
    ]);
    task("python-coverage", python, ["-m", "coverage", "report"]);
    task("python-coverage-json", python, ["-m", "coverage", "json"]);
    task("python-coverage-html", python, ["-m", "coverage", "html"]);
    task("python-coverage-xml", python, ["-m", "coverage", "xml"]);
  }
  if (mode === "ci") {
    // Continue after individual failures so one run provides a complete inventory.
    task("release-prepare", bin("tsx"), ["scripts/prepare.ts"]);
    task("release-build", "npm", ["run", "build:prepared"]);
  }
  const summary = {
    schemaVersion: 1,
    mode,
    checkedAt: new Date().toISOString(),
    node: process.version,
    passed: reports.every((r) => r.passed),
    checks: reports,
  };
  writeReport(root, summary);
  fs.writeFileSync(
    path.join(dir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(
    `\n${reports.filter((r) => r.passed).length}/${reports.length} checks passed. Summary: .analysis/summary.json`,
  );
  process.exitCode = summary.passed ? 0 : 1;
}
if (
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
