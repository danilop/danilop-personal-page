import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The upstream JSON reporter always exits zero, even with rule violations.
// Enforce its machine-readable verdict explicitly; invalid output fails closed.
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../../node_modules/.bin/depcruise", import.meta.url),
    ),
    "--config",
    fileURLToPath(new URL("../../.dependency-cruiser.cjs", import.meta.url)),
    "--output-type",
    "json",
    ...process.argv.slice(2),
  ],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 120_000 },
);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) console.error(result.error.message);
try {
  const { summary, modules } = JSON.parse(result.stdout);
  const valid =
    Array.isArray(modules) &&
    modules.length > 0 &&
    Array.isArray(summary.violations);
  process.exitCode =
    result.status === 0 &&
    !result.error &&
    valid &&
    summary.error === 0 &&
    summary.advisedExitCode === 0
      ? 0
      : 1;
} catch {
  console.error("Dependency graph is missing or invalid.");
  process.exitCode = 1;
}
