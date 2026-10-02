import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  readAssetManifest,
  verifyAsset,
  hydrateManagedAsset,
  type AssetRecord,
} from "./asset-manifest";
import { setTimeout as delay } from "node:timers/promises";
import { mediaUrl } from "./media";

export function releaseRevision(root: string) {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const dirty = git(["status", "--porcelain", "--untracked-files=all"]);
  if (dirty)
    throw Error(`Commit required before release. Uncommitted files:\n${dirty}`);
  if (git(["branch", "--show-current"]) !== "main")
    throw Error("Release requires the main branch.");
  if (
    git([
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]) !== "origin/main"
  )
    throw Error("Release requires origin/main as upstream.");
  return git(["rev-parse", "HEAD"]);
}
export async function verifyPublicAsset(record: AssetRecord, fetcher = fetch) {
  const response = await fetcher(mediaUrl("media:" + record.key), {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw Error(
      `Public asset unavailable: ${record.key}, HTTP ${response.status}`,
    );
  if (
    response.headers.get("content-type")?.split(";")[0] !== record.contentType
  )
    throw Error(`Wrong public MIME type: ${record.key}`);
  verifyAsset(new Uint8Array(await response.arrayBuffer()), record, record.key);
}
async function verifyUploadedAsset(record: AssetRecord) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await verifyPublicAsset(record);
      return;
    } catch (error) {
      if (
        attempt === 2 ||
        !/HTTP (403|404)|fetch failed|timed out/i.test(String(error))
      )
        throw error;
      await delay(6000);
    }
  }
}
export async function uploadReleaseAssets(
  root: string,
  upload: (
    record: AssetRecord,
    bytes: Uint8Array,
    publicFile: boolean,
  ) => Promise<void>,
  verify = verifyUploadedAsset,
) {
  const manifest = await readAssetManifest(root);
  if (!manifest)
    throw Error("Run assets:prepare and commit the asset manifest first.");
  for (const [logical, record] of Object.entries(manifest.sources)) {
    await hydrateManagedAsset(
      path.dirname(path.join(root, logical)),
      path.basename(logical),
    );
    const bytes = await fs.readFile(path.join(root, logical));
    verifyAsset(bytes, record, logical);
    await upload(record, bytes, false);
    if (
      record.publicKey &&
      !Object.values(manifest.outputs).some(
        (output) => output.key === record.publicKey,
      )
    ) {
      const publicRecord = { ...record, key: record.publicKey };
      await upload(publicRecord, bytes, true);
      await verify(publicRecord);
    }
  }
  for (const [name, record] of Object.entries(manifest.outputs)) {
    const bytes = await fs.readFile(
      path.join(root, ".asset-cache", record.sha256 + path.extname(name)),
    );
    verifyAsset(bytes, record, name);
    await upload(record, bytes, true);
    await verify(record);
  }
}
export async function releaseAssetCommit(
  root: string,
  upload: () => Promise<void>,
  push: (revision: string) => Promise<void>,
) {
  const revision = releaseRevision(root);
  await upload();
  if (releaseRevision(root) !== revision)
    throw Error("HEAD changed during asset upload; nothing pushed.");
  await push(revision);
  return revision;
}
