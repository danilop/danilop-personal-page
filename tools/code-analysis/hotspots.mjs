import path from "node:path";
import { execFileSync } from "node:child_process";

const days = 90;
const names = (output) => output.split("\0").filter(Boolean);
export function readHistory(root, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const metadata = { days, since, until: now.toISOString() };
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  try {
    const shallow =
      git(["rev-parse", "--is-shallow-repository"]).trim() === "true";
    const commits = Object.create(null);
    for (const file of names(
      git([
        "log",
        "HEAD",
        `--since-as-filter=${since}`,
        `--until=${metadata.until}`,
        "--no-merges",
        "--no-renames",
        "--format=",
        "--name-only",
        "-z",
      ]),
    ))
      commits[file] = (commits[file] ?? 0) + 1;
    const changed = names(
      git(["diff", "HEAD", "--name-only", "--no-renames", "-z"]),
    );
    changed.push(
      ...names(git(["ls-files", "--others", "--exclude-standard", "-z"])),
    );
    return {
      ...metadata,
      status: shallow ? "partial" : "complete",
      commits,
      changed: [...new Set(changed)],
      committed: names(git(["ls-tree", "-r", "--name-only", "-z", "HEAD"])),
    };
  } catch {
    return {
      ...metadata,
      status: "unavailable",
      commits: null,
      changed: null,
      committed: null,
    };
  }
}

function percentage(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function sourcePath(root, file) {
  return (path.isAbsolute(file) ? path.relative(root, file) : file).replaceAll(
    path.sep,
    "/",
  );
}
function coverageByFile(root, js, python) {
  const result = new Map();
  for (const [file, row] of Object.entries(js ?? {})) {
    if (file === "total") continue;
    result.set(sourcePath(root, file), {
      lines: row.lines.total ? percentage(row.lines.pct) : null,
      branches: row.branches.total ? percentage(row.branches.pct) : null,
    });
  }
  for (const [file, row] of Object.entries(python?.files ?? {})) {
    const data = row.summary;
    result.set(sourcePath(root, file), {
      lines: data.num_statements
        ? (100 * data.covered_lines) / data.num_statements
        : null,
      branches: data.num_branches
        ? (100 * data.covered_branches) / data.num_branches
        : null,
    });
  }
  return result;
}

export function buildHotspots(
  root,
  { complexity, pythonComplexity, js, python, history },
) {
  const coverage = coverageByFile(root, js, python);
  const files = new Map();
  for (const finding of [...complexity, ...pythonComplexity]) {
    const file = finding.file;
    if (!files.has(file))
      files.set(file, {
        file,
        changed: history.changed?.includes(file) ?? null,
        committed: history.committed?.includes(file) ?? null,
        commits: history.commits ? (history.commits[file] ?? 0) : null,
        coverage: coverage.get(file) ?? null,
        findings: [],
      });
    files.get(file).findings.push(finding);
  }
  // No combined complexity score: independently display every violated measure.
  return [...files.values()].sort(
    (a, b) =>
      Number(b.changed) - Number(a.changed) ||
      (b.commits ?? 0) - (a.commits ?? 0) ||
      (a.coverage?.branches ?? -1) - (b.coverage?.branches ?? -1) ||
      a.file.localeCompare(b.file),
  );
}

export function hotspotMarkdown(hotspots, history) {
  const pct = (value) =>
    value == null ? "unavailable" : `${value.toFixed(1)}%`;
  const cell = (value) =>
    String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  return [
    "## Refactoring priorities",
    "",
    `History: **${history.status}**, ${history.days} days (${history.since} to ${history.until}).`,
    "",
    "Files with complexity violations, sorted by current changes first, then recent non-merge commits descending, then branch coverage ascending (unavailable first), then filename. This is an advisory review order, not a risk score. Multiple complexity findings may describe the same function.",
    "",
    "Coverage is file-level, not coverage of the named function. Unavailable coverage includes uninstrumented code, static-only runs and failed tests; it is never treated as zero. Files absent from HEAD have no committed history; renames are not followed. Partial-history counts are lower bounds.",
    "",
    "| File | Changed vs HEAD | Commits | Lines | Branches | Violations |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...hotspots.map(
      (row) =>
        `| ${cell(row.file)} | ${row.changed == null ? "unknown" : row.changed ? "yes" : "no"} | ${row.committed === false ? "new file" : row.commits == null ? "unavailable" : `${history.status === "partial" ? "≥" : ""}${row.commits}`} | ${pct(row.coverage?.lines)} | ${pct(row.coverage?.branches)} | ${row.findings.length} |`,
    ),
    "",
  ];
}
