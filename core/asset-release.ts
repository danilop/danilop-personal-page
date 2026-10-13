import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { syncStoredAssets, type AssetSyncGroup } from "./asset-storage";
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
  sync: (groups: AssetSyncGroup[]) => Promise<unknown> = syncStoredAssets,
  verify = verifyUploadedAsset,
) {
  const manifest = await readAssetManifest(root);
  if (!manifest)
    throw Error("Run assets:prepare and commit the asset manifest first.");
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "notes-asset-sync-"),
  );
  const groups = new Map<string, AssetSyncGroup>();
  const identities = new Map<string, AssetRecord>();
  async function stage(
    record: AssetRecord,
    bytes: Uint8Array,
    publicFile: boolean,
  ) {
    verifyAsset(bytes, record, record.key);
    const key = `${publicFile ? "published/" : ""}${record.key}`;
    const previous = identities.get(key);
    if (previous) {
      if (
        previous.sha256 !== record.sha256 ||
        previous.contentType !== record.contentType
      )
        throw Error(`Conflicting asset identity: ${key}`);
      return;
    }
    identities.set(key, record);
    const disposition =
      publicFile && /^media\/audiobook-[a-z0-9-]+\.mp3$/.test(record.key)
        ? "attachment"
        : undefined;
    const groupKey = `${publicFile}:${record.contentType}:${disposition ?? "default"}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        directory: path.join(directory, String(groups.size)),
        publicFile,
        contentType: record.contentType,
        ...(disposition ? { disposition } : {}),
        records: [],
      };
      groups.set(groupKey, group);
    }
    const file = path.join(group.directory, record.key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // A private snapshot, not symlinks to mutable authoring files.
    await fs.writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    group.records.push(record);
  }
  try {
    for (const [logical, record] of Object.entries(manifest.sources)) {
      await hydrateManagedAsset(
        path.dirname(path.join(root, logical)),
        path.basename(logical),
      );
      const bytes = await fs.readFile(path.join(root, logical));
      await stage(record, bytes, false);
      if (
        record.publicKey &&
        !Object.values(manifest.outputs).some(
          (output) => output.key === record.publicKey,
        )
      )
        await stage({ ...record, key: record.publicKey }, bytes, true);
    }
    for (const [name, record] of Object.entries(manifest.outputs)) {
      const bytes = await fs.readFile(
        path.join(root, ".asset-cache", record.sha256 + path.extname(name)),
      );
      await stage(record, bytes, true);
    }
    // Nothing is uploaded until all local files have passed validation.
    const report = await sync([...groups.values()]);
    for (const group of groups.values())
      if (group.publicFile)
        for (const record of group.records) await verify(record);
    return report;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
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
