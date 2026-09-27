import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
export function indexFingerprint(cwd) {
  return createHash("sha256")
    .update(git(cwd, ["ls-files", "--stage", "-z"]))
    .digest("hex");
}
export function createSnapshot(cwd, { worktree = false } = {}) {
  const before = indexFingerprint(cwd);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-analysis-"));
  try {
    const entries = git(cwd, ["ls-files", "--stage", "-z"])
      .split("\0")
      .filter(Boolean);
    if (entries.some((row) => !/^100(644|755) [a-f0-9]+ 0\t/.test(row))) {
      throw Error(
        "Resolve merge conflicts and inspect symlinks/submodules before analysis; snapshots accept regular source files only.",
      );
    }
    if (worktree) {
      const names = new Set(
        git(cwd, [
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          "-z",
        ])
          .split("\0")
          .filter(Boolean),
      );
      for (const name of names) {
        const from = path.join(cwd, name);
        if (!fs.existsSync(from)) continue; // Unstaged deletion.
        if (!fs.lstatSync(from).isFile())
          throw Error(`Not a regular source file: ${name}`);
        const to = path.join(dir, name);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        fs.chmodSync(to, fs.statSync(from).mode & 0o777);
      }
    } else {
      git(cwd, ["checkout-index", "--all", `--prefix=${dir}${path.sep}`]);
    }
    if (indexFingerprint(cwd) !== before)
      throw Error("The Git index changed while creating the snapshot; retry.");
    return {
      dir,
      fingerprint: before,
      cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
    };
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

export function attachTools(cwd, snapshot) {
  for (const lock of [
    "package-lock.json",
    "tools/code-analysis/requirements.txt",
    "prototypes/ink-and-paper/package-lock.json",
  ]) {
    if (!fs.existsSync(path.join(snapshot, lock)))
      throw Error(
        `Stage the analysis setup first: ${lock} is missing from this snapshot.`,
      );
    if (
      !fs
        .readFileSync(path.join(snapshot, lock))
        .equals(fs.readFileSync(path.join(cwd, lock)))
    ) {
      throw Error(
        `Staged and working ${lock} differ; install the staged dependencies before committing.`,
      );
    }
  }
  for (const name of [
    "node_modules",
    ".venv-analysis",
    "prototypes/ink-and-paper/node_modules",
  ]) {
    const target = path.join(cwd, name);
    if (!fs.existsSync(target))
      throw Error(`Missing ${name}; run npm run analysis:setup first.`);
    fs.symlinkSync(target, path.join(snapshot, name), "dir");
  }
}

export function isolatedGitEnvironment(cwd) {
  const env = { ...process.env };
  for (const name of git(cwd, ["rev-parse", "--local-env-vars"])
    .trim()
    .split("\n"))
    delete env[name];
  return env;
}

export function attachRepository(cwd, snapshot) {
  // Private refs/index, with read-only object lookup in the source repository.
  // Never share its .git directory: tests must not mutate the real index/refs.
  const env = isolatedGitEnvironment(cwd);
  const localGit = (args) =>
    execFileSync("git", args, { cwd: snapshot, env, encoding: "utf8" });
  const objects = path.resolve(
    cwd,
    git(cwd, ["rev-parse", "--git-path", "objects"]).trim(),
  );
  const revision = git(cwd, ["rev-parse", "HEAD"]).trim();
  localGit(["init", "--quiet"]);
  localGit(["config", "core.hooksPath", "/dev/null"]);
  fs.writeFileSync(
    path.join(snapshot, ".git/objects/info/alternates"),
    objects + "\n",
  );
  const shallow = path.resolve(
    cwd,
    git(cwd, ["rev-parse", "--git-path", "shallow"]).trim(),
  );
  if (fs.existsSync(shallow))
    fs.copyFileSync(shallow, path.join(snapshot, ".git/shallow"));
  localGit(["update-ref", "HEAD", revision]);
  localGit(["add", "--all"]);
  fs.appendFileSync(
    path.join(snapshot, ".git/info/exclude"),
    "\n/node_modules\n/.venv-analysis\n/prototypes/ink-and-paper/node_modules\n",
  );
}
