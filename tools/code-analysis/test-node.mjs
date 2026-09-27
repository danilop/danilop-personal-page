import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
// One V8 coverage session includes both suites and the prototype's worker contract.
const files = readdirSync("test")
  .filter((f) => /\.test\.(js|ts)$/.test(f))
  .map((f) => `test/${f}`);
files.push("prototypes/ink-and-paper/tests/sites-worker.test.mjs");
const result = spawnSync(
  process.execPath,
  ["--experimental-test-module-mocks", "--import", "tsx", "--test", ...files],
  {
    stdio: "inherit",
    env: { ...process.env, NOTES_BASE_PATH: "/" },
    timeout: 10 * 60 * 1000,
  },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

mkdirSync(".analysis", { recursive: true });
writeFileSync(
  ".analysis/node-tests.json",
  JSON.stringify(
    {
      passed: result.status === 0,
      exitCode: result.status,
      error: result.error?.message,
    },
    null,
    2,
  ) + "\n",
);
