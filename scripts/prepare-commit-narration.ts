import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createSnapshot,
  attachRepository,
  attachTools,
  indexFingerprint,
  isolatedGitEnvironment,
  git,
} from "../tools/code-analysis/snapshot.mjs";
import {
  narrationPolicy,
  narrationLock,
  commitNarrationChanges,
} from "../core/narration-store";
import { readAssetManifest, verifyAsset } from "../core/asset-manifest";

const generatedMetadata =
  /^(publishing\/(media-assets|narrations|audiobooks)\.json|content\/pieces\/[a-z0-9-]+\/narration\.yaml)$/;
type Run = (snapshot: string, prepare: boolean) => void;
function runInSnapshot(snapshot: string, prepare: boolean) {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      prepare ? "scripts/prepare-assets.ts" : "scripts/narration.ts",
      ...(prepare ? [] : ["check"]),
    ],
    {
      cwd: snapshot,
      env: {
        ...isolatedGitEnvironment(snapshot),
        HF_HUB_OFFLINE: "1",
        TRANSFORMERS_OFFLINE: "1",
      },
      stdio: prepare ? "inherit" : "pipe",
      timeout: 60 * 60_000,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(
      prepare
        ? "Audio preparation failed. Review Narration in preview; nothing was staged."
        : String(result.stderr),
    );
}
async function bytes(file: string) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return undefined;
  }
}
const same = (a: Buffer | undefined, b: Buffer | undefined) =>
  a === undefined ? b === undefined : b !== undefined && a.equals(b);
async function safeDestination(root: string, name: string) {
  const file = path.join(root, name);
  for (let current = file; current !== root; current = path.dirname(current)) {
    const stat = await fs
      .lstat(current)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
        return undefined;
      });
    if (stat?.isSymbolicLink())
      throw Error(`Refusing symbolic-link output: ${name}`);
  }
  return file;
}
async function attachNarrationRuntime(root: string, snapshot: string) {
  const python = path.join(root, ".venv-narration/bin/python");
  if (!(await fs.stat(python).catch(() => undefined)))
    throw Error(
      "Commit needs audio. Run npm run narration:setup on this Mac first.",
    );
  await fs.symlink(
    path.join(root, ".venv-narration"),
    path.join(snapshot, ".venv-narration"),
    "dir",
  );
  const state = ".authoring-state/narration";
  await fs.mkdir(path.join(snapshot, state), { recursive: true });
  await fs.copyFile(
    path.join(root, state, "model.json"),
    path.join(snapshot, state, "model.json"),
  );
  const chunks = path.join(root, state, "chunks");
  if (await fs.stat(chunks).catch(() => undefined))
    await fs.cp(chunks, path.join(snapshot, state, "chunks"), {
      recursive: true,
    });
}
async function copyPreparedAssets(root: string, snapshot: string) {
  const manifest = await readAssetManifest(snapshot);
  if (!manifest) throw Error("Prepared asset manifest is missing");
  const sources = Object.entries(manifest.sources);
  const outputs = Object.entries(manifest.outputs).map(
    ([name, record]) =>
      [`.asset-cache/${record.sha256}${path.extname(name)}`, record] as const,
  );
  for (const [name, record] of [...sources, ...outputs]) {
    const source = await bytes(path.join(snapshot, name));
    if (!source) throw Error(`Prepared asset is missing: ${name}`);
    verifyAsset(source, record, name);
    const target = await safeDestination(root, name),
      existing = await bytes(target);
    if (existing) {
      verifyAsset(existing, record, name);
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, source, { flag: "wx" });
  }
}
async function checkCommitIndex(root: string) {
  const active = path.resolve(
    root,
    git(root, ["rev-parse", "--git-path", "index"]).trim(),
  );
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  const normal = path.resolve(
    root,
    execFileSync("git", ["rev-parse", "--git-path", "index"], {
      cwd: root,
      env,
      encoding: "utf8",
    }).trim(),
  );
  // A path-limited commit has a temporary commit index and a separately locked
  // future index. Git does not propagate hook additions between these indexes.
  if (
    active !== normal &&
    active !== normal + ".lock" &&
    (await bytes(normal + ".lock"))
  )
    throw Error(
      "Audio needs preparation, but this is a path-limited commit. Stage the intended changes and run git commit without --only or file arguments; generated metadata must enter both the commit and the retained index.",
    );
}
async function stageMetadata(
  root: string,
  fingerprint: string,
  updates: { file: string; text: string; before: Buffer | undefined }[],
) {
  const index = path.resolve(
    root,
    git(root, ["rev-parse", "--git-path", "index"]).trim(),
  );
  const lock = index + ".lock";
  const handle = await fs.open(lock, "wx");
  await handle.close();
  try {
    if (indexFingerprint(root) !== fingerprint)
      throw Error(
        "Staging changed during audio preparation. Retry the commit.",
      );
    await fs.copyFile(index, lock);
    const entries = updates
      .map(({ file, text }) => {
        const hash = execFileSync("git", ["hash-object", "-w", "--stdin"], {
          cwd: root,
          input: text,
          encoding: "utf8",
        }).trim();
        return `100644 ${hash}\t${file}\0`;
      })
      .join("");
    execFileSync("git", ["update-index", "-z", "--index-info"], {
      cwd: root,
      input: entries,
      env: { ...process.env, GIT_INDEX_FILE: lock },
    });
    for (const { file, before } of updates) {
      const target = await safeDestination(root, file);
      if (!same(await bytes(target), before))
        throw Error(
          `Metadata changed during audio preparation: ${file}. Retry the commit.`,
        );
    }
    // The real index changes only after the recoverable metadata write succeeds.
    await commitNarrationChanges(root, updates);
    await fs.rename(lock, index);
  } finally {
    await fs.rm(lock, { force: true });
    await fs.rm(lock + ".lock", { force: true });
  }
}
export async function prepareCommitAudio(
  root: string,
  run: Run = runInSnapshot,
) {
  if (process.env.CI || process.env.AWS_BRANCH) return [];
  root = await fs.realpath(root);
  if (!git(root, ["diff", "--cached", "--name-only", "-z"]).length) return [];
  const snapshot = createSnapshot(root);
  try {
    if (!(await narrationPolicy(snapshot.dir)).required) return [];
    attachRepository(root, snapshot.dir);
    attachTools(root, snapshot.dir);
    const snapshotGit = (args: string[]) =>
      execFileSync("git", args, {
        cwd: snapshot.dir,
        env: isolatedGitEnvironment(root),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    try {
      run(snapshot.dir, false);
      return [];
    } catch {
      console.log(
        "Staged publication needs audio. Preparing from staged content on this Mac…",
      );
    }
    await checkCommitIndex(root);
    await attachNarrationRuntime(root, snapshot.dir);
    run(snapshot.dir, true);
    run(snapshot.dir, false);
    const changed = [
      ...new Set(
        [
          ...snapshotGit(["diff", "--name-only", "-z"]).split("\0"),
          ...snapshotGit([
            "ls-files",
            "--others",
            "--exclude-standard",
            "-z",
          ]).split("\0"),
        ].filter(Boolean),
      ),
    ].filter((name) => name !== ".venv-narration");
    if (changed.some((name) => !generatedMetadata.test(name)))
      throw Error(
        `Preparation changed unexpected files; nothing promoted: ${changed.join(", ")}`,
      );
    await narrationLock(root, async () => {
      if (indexFingerprint(root) !== snapshot.fingerprint)
        throw Error(
          "Staging changed during audio preparation. Retry the commit.",
        );
      const updates = [];
      for (const name of changed) {
        const listed = snapshotGit(["ls-files", "--", name]).trim();
        const before = listed
          ? Buffer.from(snapshotGit(["show", `:${name}`]))
          : undefined;
        const target = await safeDestination(root, name);
        if (!same(await bytes(target), before))
          throw Error(
            `Unstaged changes in ${name}; preserve/reconcile them before preparing commit audio. Nothing was staged.`,
          );
        const after = await bytes(path.join(snapshot.dir, name));
        if (!after) throw Error(`Preparation unexpectedly deleted ${name}`);
        updates.push({ file: name, text: after.toString("utf8"), before });
      }
      await copyPreparedAssets(root, snapshot.dir);
      if (indexFingerprint(root) !== snapshot.fingerprint)
        throw Error("Staging changed during audio transfer. Retry the commit.");
      if (updates.length)
        await stageMetadata(root, snapshot.fingerprint, updates);
    });
    return changed;
  } finally {
    snapshot.cleanup();
  }
}
async function main() {
  const root = await fs.realpath(
    git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim(),
  );
  const files = await prepareCommitAudio(root);
  if (files.length) {
    console.log(
      "Audio prepared from staged content; generated metadata staged automatically:\n" +
        files.map((name) => "  " + name).join("\n"),
    );
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
