import fs from "node:fs/promises";
import path from "node:path";
import {
  assetTypes,
  readAssetManifest,
  writeAssetManifest,
  digestAsset,
  verifyAsset,
  type AssetManifest,
} from "./asset-manifest";
import { mediaUrl } from "./media";
import type { Assets } from "./assets";

export async function pinnedSocialBytes(recipe: string) {
  if (
    process.env.NOTES_ASSET_PREPARE === "1" ||
    process.env.NOTES_AUTHORING_PREVIEW === "1"
  )
    return;
  const manifest = await readAssetManifest(process.cwd());
  const name = manifest?.recipes[recipe];
  const record = name && manifest?.outputs[name];
  if (!record) return;
  return cachedOutputBytes(name, record);
}
async function cachedOutputBytes(
  name: string,
  record: AssetManifest["outputs"][string],
) {
  const file = path.join(".asset-cache", record.sha256 + path.extname(name));
  let bytes: Uint8Array;
  try {
    bytes = await fs.readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const response = await fetch(mediaUrl("media:" + record.key), {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(
        `Missing pinned rendition: ${record.key}, HTTP ${response.status}`,
        { cause: error },
      );
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  verifyAsset(bytes, record, name);
  await fs.mkdir(".asset-cache", { recursive: true });
  await fs.writeFile(file, bytes);
  return Buffer.from(bytes);
}
export async function recordSocialRecipe(recipe: string, name: string) {
  if (process.env.NOTES_ASSET_PREPARE !== "1") return;
  const manifest = await readAssetManifest(process.cwd());
  if (!manifest) return;
  manifest.recipes[recipe] = name;
  await writeAssetManifest(process.cwd(), manifest);
}
async function collectOutputs(manifest: AssetManifest, prepare: boolean) {
  const names = await fs
    .readdir(".generated/public/media")
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  const outputs: AssetManifest["outputs"] = {};
  for (const name of names) {
    const bytes = await fs.readFile(path.join(".generated/public/media", name));
    const contentType = assetTypes[path.extname(name)];
    if (!contentType) throw Error(`Unsupported public asset: ${name}`);
    outputs[name] = {
      key: "media/" + name,
      sha256: digestAsset(bytes),
      bytes: bytes.length,
      contentType,
    };
    await fs.mkdir(".asset-cache", { recursive: true });
    await fs.writeFile(
      path.join(".asset-cache", outputs[name].sha256 + path.extname(name)),
      bytes,
    );
    if (!prepare) {
      const expected = manifest.outputs[name];
      if (!expected)
        throw Error(
          `Uncommitted rendition ${name}: run assets:prepare and commit before release.`,
        );
      verifyAsset(bytes, expected, name);
    }
  }
  return outputs;
}
function selectPublicSources(
  manifest: AssetManifest,
  assets: Assets,
  root: string,
  serializedSite: string,
) {
  const outputs = manifest.outputs;
  for (const record of Object.values(manifest.sources)) delete record.publicKey;
  const dependencies = new Map(assets.dependencies);
  const linked = Object.entries(manifest.sources)
    .filter(([, record]) =>
      serializedSite.includes(
        mediaUrl("media:sources/" + path.basename(record.key)),
      ),
    )
    .map(([logical]) => logical);
  const shared = new Set([...manifest.shared, ...linked]);
  for (const logical of shared) {
    const source = manifest.sources[logical];
    if (!source)
      throw Error(`Shared file is missing from manifest: ${logical}`);
    dependencies.set(path.join(root, logical), source.sha256);
  }
  for (const [file, sha256] of dependencies) {
    const logical = path.relative(root, file).split(path.sep).join("/");
    const source = manifest.sources[logical];
    if (!source) continue;
    if (source.sha256 !== sha256)
      throw Error(`Source changed while preparing: ${logical}`);
    const same = Object.values(outputs).find(
      (output) => output.sha256 === sha256,
    );
    source.publicKey = shared.has(logical)
      ? "sources/" + path.basename(source.key)
      : (same?.key ?? "sources/" + path.basename(source.key));
  }
}
export async function finishAssetBuild<T>(
  site: T,
  assets: Assets,
  authoring: boolean,
) {
  const root = process.cwd();
  const manifest = await readAssetManifest(root);
  if (!manifest || authoring) return site;
  const prepare = process.env.NOTES_ASSET_PREPARE === "1";
  if (prepare && (process.env.CI || process.env.AWS_BRANCH))
    throw Error("Asset preparation must run locally before committing.");
  for (const name of manifest.legacy) {
    const record = manifest.outputs[name];
    if (!record) throw Error(`Missing legacy rendition identity: ${name}`);
    await fs.mkdir(".generated/public/media", { recursive: true });
    await fs.writeFile(
      path.join(".generated/public/media", name),
      await cachedOutputBytes(name, record),
    );
  }
  const outputs = await collectOutputs(manifest, prepare);
  if (prepare) {
    if (!Object.keys(manifest.outputs).length)
      manifest.legacy = Object.keys(outputs);
    manifest.outputs = outputs;
    selectPublicSources(manifest, assets, root, JSON.stringify(site));
    for (const [recipe, name] of Object.entries(manifest.recipes))
      if (!outputs[name]) delete manifest.recipes[recipe];
    await writeAssetManifest(root, manifest);
  }
  const encoded = JSON.stringify(site).replace(
    /(?<![a-zA-Z0-9_:/.-])\/media\/([a-zA-Z0-9._-]+)/g,
    (match, name) =>
      outputs[name] ? mediaUrl("media:" + outputs[name].key) : match,
  );
  return JSON.parse(encoded) as T;
}
