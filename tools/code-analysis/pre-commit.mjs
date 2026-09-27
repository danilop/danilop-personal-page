import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  createSnapshot,
  attachTools,
  indexFingerprint,
  attachRepository,
  isolatedGitEnvironment,
  git,
} from "./snapshot.mjs";

const options = new Set(process.argv.slice(2));
for (const option of options)
  if (!["--worktree", "--static", "--ci"].includes(option))
    throw Error(`Unknown argument: ${option}`);
const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
const worktree = options.has("--worktree");
if (!worktree && !git(root, ["diff", "--cached", "--name-only", "-z"]).length) {
  console.log(
    "No staged changes. Use npm run verify:worktree to check current files.",
  );
} else {
  let snapshot;
  try {
    snapshot = createSnapshot(root, { worktree });
    attachRepository(root, snapshot.dir);
    attachTools(root, snapshot.dir);
    const runner = path.join(snapshot.dir, "tools/code-analysis/run.mjs");
    if (!fs.existsSync(runner))
      throw Error(
        "Stage tools/code-analysis before enabling this commit hook.",
      );
    console.log(
      `Checking ${worktree ? "current non-ignored files" : "the staged snapshot"}; your working files and index are not modified.`,
    );
    const result = spawnSync(
      process.execPath,
      [
        runner,
        options.has("--ci") ? "ci" : options.has("--static") ? "static" : "all",
      ],
      {
        cwd: snapshot.dir,
        stdio: "inherit",
        env: { ...isolatedGitEnvironment(root), ANALYSIS_TOOL_ROOT: root },
        timeout: 30 * 60 * 1000,
      },
    );
    if (!fs.existsSync(path.join(snapshot.dir, ".analysis/summary.json"))) {
      throw Error(
        "The analyzer did not produce a summary; validation did not run.",
      );
    }
    for (const name of [".analysis", "coverage"]) {
      const from = path.join(snapshot.dir, name);
      if (fs.existsSync(from)) {
        fs.rmSync(path.join(root, name), { recursive: true, force: true });
        fs.cpSync(from, path.join(root, name), { recursive: true });
      }
    }
    if (indexFingerprint(root) !== snapshot.fingerprint)
      throw Error(
        "The index changed during validation. No commit was approved; retry.",
      );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(`Analysis could not complete: ${error.message}`);
    process.exitCode = 1;
  } finally {
    snapshot?.cleanup();
  }
}
