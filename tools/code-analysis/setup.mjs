import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { root } from "./run.mjs";
const run = (command, args) =>
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, UV_CACHE_DIR: path.join(root, ".cache/uv") },
  });
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw Error("Use the Node 24 version in .nvmrc before setup.");
run("uv", ["venv", "--allow-existing", "--python", "3.13", ".venv-analysis"]);
run("uv", [
  "pip",
  "sync",
  "--python",
  ".venv-analysis/bin/python",
  "--require-hashes",
  "tools/code-analysis/requirements.txt",
]);
run(process.execPath, ["tools/code-analysis/versions.mjs"]);
const configured = spawnSync("git", ["config", "--get", "core.hooksPath"], {
  cwd: root,
  encoding: "utf8",
}).stdout.trim();
if (configured && configured !== ".githooks")
  throw Error(
    `Existing hooksPath ${configured} preserved. Integrate the pre-commit command into that hook explicitly.`,
  );
const legacyHook = path.join(
  root,
  execFileSync("git", ["rev-parse", "--git-path", "hooks/pre-commit"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
);
if (!configured && fs.existsSync(legacyHook))
  throw Error(
    "An existing pre-commit hook was found and preserved; integrate it explicitly.",
  );
fs.chmodSync(path.join(root, ".githooks/pre-commit"), 0o755);
run("git", ["config", "--local", "core.hooksPath", ".githooks"]);
console.log(
  "Installed the local pre-commit hook. No files were staged or committed.",
);
