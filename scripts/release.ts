import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  releaseRevision,
  releaseAssetCommit,
  uploadReleaseAssets,
} from "../core/asset-release";
import {
  ensureStoredAsset,
  withAssetLease,
  recordAssetRelease,
} from "../core/asset-storage";

async function main() {
  const root = process.cwd();
  const original = releaseRevision(root); // No credentials, uploads or build work before the commit gate.
  const uploadOnly =
    process.argv.slice(2).length === 1 && process.argv[2] === "--upload-only";
  if (process.argv.length > 2 && !uploadOnly)
    throw Error("Usage: npm run release [-- --upload-only]");
  const state = path.join(root, ".authoring-state");
  await fs.mkdir(state, { recursive: true });
  const file = path.join(state, "write.lock");
  const lock = await fs.open(file, "wx");
  try {
    execFileSync("npm", ["run", "validate"], {
      stdio: "inherit",
      env: { ...process.env, NOTES_ASSET_STRICT: "1" },
    });
    if (releaseRevision(root) !== original)
      throw Error(
        "HEAD changed during validation; nothing uploaded or pushed.",
      );
    const revision = await withAssetLease(async () => {
      await recordAssetRelease(original, "pending");
      return releaseAssetCommit(
        root,
        () => uploadReleaseAssets(root, ensureStoredAsset),
        async (sha) => {
          if (uploadOnly) return;
          execFileSync("git", ["push", "origin", sha + ":refs/heads/main"], {
            stdio: "inherit",
          });
          execFileSync(
            process.execPath,
            ["scripts/verify-deployment.mjs", "--wait"],
            { stdio: "inherit", env: { ...process.env, GITHUB_SHA: sha } },
          );
          await recordAssetRelease(sha, "deployed");
        },
      );
    });
    if (uploadOnly) {
      console.log(
        `Assets uploaded and verified for ${revision}; no push or deployment performed.`,
      );
      return;
    }
    await fs.mkdir(".publication-state/assets", { recursive: true });
    await fs.writeFile(
      `.publication-state/assets/${revision}.json`,
      execFileSync("git", ["show", `${revision}:publishing/media-assets.json`]),
    );
    console.log(`Released and verified ${revision}.`);
    execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/cleanup-assets.ts", "--apply"],
      { stdio: "inherit" },
    );
  } finally {
    await lock.close();
    await fs.rm(file);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
