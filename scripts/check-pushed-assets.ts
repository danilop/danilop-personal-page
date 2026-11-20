import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { missingStoredObjects } from "../core/asset-storage";
import { addedObjects, pushedRefs } from "../core/pushed-assets";

// Pre-push guard: every stored object a pushed commit adds to the asset manifest
// must already be in the media bucket. Otherwise other checkouts (and builds)
// cannot restore it. `npm run release` uploads before it pushes, so it passes.
const manifestPath = "publishing/media-assets.json";

function git(args: string[]) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}
function manifestAt(sha: string | undefined) {
  if (!sha) return {};
  try {
    return JSON.parse(git(["show", `${sha}:${manifestPath}`]));
  } catch {
    return {};
  }
}
function baseFor(remoteSha: string, localSha: string) {
  if (!/^0+$/.test(remoteSha)) {
    try {
      git(["cat-file", "-e", remoteSha + "^{commit}"]);
      return remoteSha;
    } catch {
      // Unknown remote commit (not fetched): fall back to the tracking branch.
    }
  }
  try {
    return git(["merge-base", localSha, "origin/main"]).trim();
  } catch {
    return undefined;
  }
}

async function main() {
  const refs = pushedRefs(fs.readFileSync(0, "utf8"));
  const added = new Map<string, { key: string; bytes?: number }>();
  for (const ref of refs)
    for (const object of addedObjects(
      manifestAt(baseFor(ref.remoteSha, ref.localSha)),
      manifestAt(ref.localSha),
    ))
      added.set(object.key, object);
  if (!added.size) return;
  let missing;
  try {
    missing = await missingStoredObjects([...added.values()]);
  } catch (error) {
    console.error(
      `Cannot confirm ${added.size} new asset object(s) in the media bucket: ${(error as Error).message}\n` +
        "Sign in to AWS (aws login) and push again, or run npm run release -- --upload-only.",
    );
    process.exitCode = 1;
    return;
  }
  if (!missing.length) {
    console.log(`Asset check: ${added.size} new object(s) already uploaded.`);
    return;
  }
  console.error(
    "Push blocked: the asset manifest refers to objects that are not uploaded.\n" +
      missing.map((m) => `  ${m.key} (${m.reason})`).join("\n") +
      "\nOther checkouts could not restore them. Upload first, then push:\n" +
      "  npm run release -- --upload-only\n" +
      "(npm run release uploads and pushes in one step.)",
  );
  process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
