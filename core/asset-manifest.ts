import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

const manifestPath = "publishing/media-assets.json";
export const digestAsset = (bytes: Uint8Array | string) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
export const assetTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".csv": "text/csv",
};
const safePath = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
  .refine((value) =>
    value.split("/").every((part) => part && part !== "." && part !== ".."),
  );
const record = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative(),
    contentType: z.string().min(1),
    key: safePath,
    publicKey: safePath
      .refine((key) => /^(media|sources)\/[^/]+$/.test(key))
      .optional(),
  })
  .strict();
const assetManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.record(
      safePath.refine((key) =>
        /^content\/(?:pieces\/[a-zA-Z0-9_-]+|collections)\/assets\/[^/]+$/.test(
          key,
        ),
      ),
      record.extend({
        key: safePath.refine((key) => /^originals\/[^/]+$/.test(key)),
      }),
    ),
    outputs: z.record(
      safePath.refine((key) => !key.includes("/")),
      record.extend({
        key: safePath.refine((key) => /^media\/[^/]+$/.test(key)),
      }),
    ),
    recipes: z.record(z.string().regex(/^[a-f0-9]{64}$/), safePath),
    legacy: z.array(safePath.refine((key) => !key.includes("/"))),
    shared: z.array(safePath),
  })
  .strict();
export type AssetManifest = z.infer<typeof assetManifestSchema>;
export type AssetRecord = z.infer<typeof record>;
export const emptyAssetManifest = (): AssetManifest => ({
  schemaVersion: 1,
  sources: {},
  outputs: {},
  recipes: {},
  legacy: [],
  shared: [],
});
export async function readAssetManifest(root: string) {
  try {
    return assetManifestSchema.parse(
      JSON.parse(await fs.readFile(path.join(root, manifestPath), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function writeAssetManifest(
  root: string,
  manifest: AssetManifest,
) {
  const file = path.join(root, manifestPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + "." + crypto.randomUUID() + ".tmp";
  await fs.writeFile(
    temp,
    JSON.stringify(assetManifestSchema.parse(manifest), null, 2) + "\n",
  );
  await fs.rename(temp, file);
}
async function assetRoot(owner: string) {
  let folder = path.resolve(owner);
  while (folder !== path.dirname(folder)) {
    if (await readAssetManifest(folder)) return folder;
    folder = path.dirname(folder);
  }
  return undefined;
}
export function verifyAsset(
  bytes: Uint8Array,
  expected: AssetRecord,
  label: string,
) {
  if (bytes.length !== expected.bytes || digestAsset(bytes) !== expected.sha256)
    throw Error(
      `Asset checksum mismatch: ${label}. Run assets:prepare and commit the reviewed manifest.`,
    );
}
export function sourceRecord(logical: string, bytes: Uint8Array): AssetRecord {
  const ext = path.extname(logical).toLowerCase();
  const contentType = assetTypes[ext];
  if (!contentType) throw Error(`Unsupported managed asset: ${logical}`);
  const sha256 = digestAsset(bytes);
  const stem = path
    .basename(logical, ext)
    .replace(/-[a-f0-9]{20,64}$/, "")
    .replace(/[^a-zA-Z0-9-]/g, "-");
  return {
    sha256,
    bytes: bytes.length,
    contentType,
    key: `originals/${stem}-${sha256}${ext}`,
  };
}
export async function registerManagedAsset(
  root: string,
  logical: string,
  bytes: Uint8Array,
) {
  const manifest = await readAssetManifest(root);
  if (!manifest) return;
  const next = sourceRecord(logical, bytes);
  if (manifest.sources[logical]?.sha256 === next.sha256) return;
  manifest.sources[logical] = next;
  await writeAssetManifest(root, manifest);
}
async function rejectSymlinkParents(file: string) {
  let parent = path.dirname(file);
  while (true) {
    try {
      if ((await fs.realpath(parent)) !== parent)
        throw Error(`Symbolic-link asset folder: ${parent}`);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      parent = path.dirname(parent);
    }
  }
}
export async function hydrateManagedAsset(owner: string, relative: string) {
  const root = await assetRoot(owner);
  if (!root) return;
  const logical = path
    .relative(root, path.resolve(owner, relative))
    .split(path.sep)
    .join("/");
  const manifest = (await readAssetManifest(root))!;
  const expected = manifest.sources[logical];
  if (!expected) return;
  const file = path.join(root, logical);
  await rejectSymlinkParents(file);
  try {
    const bytes = await fs.readFile(file);
    if (
      process.env.CI ||
      process.env.AWS_BRANCH ||
      process.env.NOTES_ASSET_STRICT === "1"
    )
      verifyAsset(bytes, expected, logical);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let bytes: Uint8Array;
  if (expected.publicKey) {
    const { mediaUrl } = await import("./media");
    const response = await fetch(mediaUrl("media:" + expected.publicKey), {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(
        `Missing published asset ${logical}: HTTP ${response.status}`,
      );
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    if (process.env.CI || process.env.AWS_BRANCH)
      throw Error(
        `Private asset cannot be resolved by a public build: ${logical}`,
      );
    const { privateAssetBytes } = await import("./asset-storage");
    bytes = await privateAssetBytes(expected);
  }
  verifyAsset(bytes, expected, logical);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + "." + crypto.randomUUID() + ".tmp";
  await fs.writeFile(temp, bytes);
  await fs.rename(temp, file);
}
