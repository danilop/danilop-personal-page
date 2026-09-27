import fs from "node:fs";
import path from "node:path";
import { readHistory, buildHotspots, hotspotMarkdown } from "./hotspots.mjs";

function readJson(root, name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function counts(rows, key) {
  const result = {};
  for (const row of rows)
    result[row[key] ?? "parse-error"] =
      (result[row[key] ?? "parse-error"] ?? 0) + 1;
  return result;
}
const relative = (root, file) =>
  path.relative(root, file).replaceAll(path.sep, "/");
function measurements(root, summary) {
  const ran = (id) => summary.checks.some((row) => row.check === id);
  const passed = (id) =>
    summary.checks.some((row) => row.check === id && row.passed);
  const eslint = ran("eslint") ? readJson(root, ".analysis/eslint.json") : null;
  const ruff = ran("ruff") ? readJson(root, ".analysis/ruff.log") : null;
  const js = ran("javascript-coverage")
    ? readJson(root, "coverage/javascript/coverage-summary.json")
    : null;
  const python = passed("python-coverage-json")
    ? readJson(root, "coverage/python/coverage.json")
    : null;
  const jsTestsPassed =
    ran("javascript-coverage") &&
    readJson(root, ".analysis/node-tests.json")?.passed === true;
  const architecture = ran("architecture")
    ? readJson(root, ".analysis/architecture.log")
    : null;
  const messages = (eslint ?? []).flatMap((row) =>
    row.messages.map((message) => ({
      ...message,
      file: relative(root, row.filePath),
    })),
  );
  const complexity = messages
    .filter((row) =>
      ["complexity", "sonarjs/cognitive-complexity"].includes(row.ruleId),
    )
    .map((row) => ({
      file: row.file,
      line: row.line,
      rule: row.ruleId,
      message: row.message,
    }));
  const metrics = {
    checkedAt: summary.checkedAt,
    javascript: js?.total ?? null,
    python: python?.totals ?? null,
    eslintFindings: eslint ? messages.length : null,
    eslintRules: eslint ? counts(messages, "ruleId") : null,
    ruffFindings: ruff?.length ?? null,
    ruffRules: ruff ? counts(ruff, "code") : null,
    complexity,
    pythonComplexity: (ruff ?? [])
      .filter((row) => row.code === "C901")
      .map((row) => ({
        file: relative(root, row.filename),
        line: row.location.row,
        message: row.message,
      })),
  };
  return {
    metrics,
    js,
    python,
    jsTestsPassed,
    pythonTestsPassed: passed("python-tests"),
    architecture,
  };
}

export function writeReport(root, summary) {
  const {
    metrics,
    js,
    python,
    jsTestsPassed,
    pythonTestsPassed,
    architecture,
  } = measurements(root, summary);
  const history = readHistory(root, new Date(summary.checkedAt));
  const hotspots = buildHotspots(root, {
    ...metrics,
    js: jsTestsPassed ? js : null,
    python: pythonTestsPassed ? python : null,
    history,
  });
  metrics.hotspots = hotspots;
  metrics.history = {
    days: history.days,
    since: history.since,
    until: history.until,
    status: history.status,
  };
  metrics.architecture = architecture
    ? {
        modules: architecture.summary.totalCruised,
        dependencies: architecture.summary.totalDependenciesCruised,
        violations: architecture.summary.violations,
      }
    : null;
  fs.writeFileSync(
    path.join(root, ".analysis/metrics.json"),
    JSON.stringify(metrics, null, 2) + "\n",
  );
  const lines = [
    "# Code analysis results",
    "",
    `Run: ${summary.checkedAt}. Mode: ${summary.mode}.`,
    "",
    `Result: **${summary.passed ? "passed" : "blocked"}**. No findings are automatically suppressed or accepted as a baseline.`,
    "",
    "| Check | Result | Seconds | Report |",
    "| --- | --- | ---: | --- |",
    ...summary.checks.map(
      (row) =>
        `| ${row.check} | ${row.passed ? "Pass" : "Fail"} | ${row.seconds} | [Details](${path.basename(row.report)}) |`,
    ),
    "",
    "## Coverage",
    "",
  ];
  if (js)
    lines.push(
      `JavaScript/TypeScript: **${js.total.lines.pct}% lines**, ${js.total.statements.pct}% statements, ${js.total.functions.pct}% functions, ${js.total.branches.pct}% branches.`,
      "",
      "[JavaScript HTML report](../coverage/javascript/index.html)",
      "",
    );
  if (python)
    lines.push(
      `Python: **${python.totals.percent_covered.toFixed(2)}% combined statements/branches**.`,
      "",
      "[Python HTML report](../coverage/python/html/index.html)",
      "",
    );
  lines.push(
    "Coverage is meaningful only when the corresponding tests passed. Unloaded executable source is included; Astro/HTML markup and inline scripts are statically checked but are not instrumented by these unit coverage reports.",
    "",
    "## Dependency architecture",
    "",
    architecture
      ? `${metrics.architecture.modules} modules, ${metrics.architecture.dependencies} dependencies, ${metrics.architecture.violations.length} violations. [Full graph and findings](architecture.log).`
      : "Architecture measurement unavailable for this run.",
    "",
    "The graph covers parsed JavaScript/TypeScript/JSX imports, including literal dynamic imports. Type-only imports are omitted. Astro/HTML inline scripts, Python imports, computed paths, classic-script globals and dependencies inside npm packages are outside this graph.",
    "",
    ...hotspotMarkdown(hotspots, history),
    "## Complexity violations",
    "",
    ...[...metrics.complexity, ...metrics.pythonComplexity].map(
      (row) => `- ${row.file}:${row.line} — ${row.message}`,
    ),
    "",
    "Full counts and measurements: [metrics.json](metrics.json). Thresholds are configured in eslint.config.mjs, pyproject.toml and .c8rc.json.",
    "",
  );
  fs.writeFileSync(path.join(root, ".analysis/report.md"), lines.join("\n"));
}
