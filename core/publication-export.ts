import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { visit } from "unist-util-visit";
import { parser } from "./model";
import { mediaUrl } from "./media";
import {
  readAssetManifest,
  verifyAsset,
  type AssetRecord,
} from "./asset-manifest";
import { hash } from "./assets";
import type { exportPublication } from "./distribution";

export type PublicationExport = Awaited<ReturnType<typeof exportPublication>>;
const exec = promisify(execFile);

async function restoredBytes(
  root: string,
  name: string,
  record: AssetRecord,
  url: string,
) {
  let bytes = await fs
    .readFile(
      path.join(root, ".asset-cache", record.sha256 + path.extname(name)),
    )
    .catch(() => undefined);
  if (!bytes) {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(
        `Cannot bundle published asset: HTTP ${response.status} ${url}`,
      );
    bytes = Buffer.from(await response.arrayBuffer());
  }
  verifyAsset(bytes, record, url);
  return bytes;
}
async function restoreManifestAssets(
  root: string,
  assetsDir: string,
  references: Set<string>,
  assets: PublicationExport["assets"],
) {
  const manifest = await readAssetManifest(root);
  // Authored media: URLs already point to the CDN. Restore only manifest-pinned
  // public objects; arbitrary remote images/embeds remain references, not downloads.
  if (manifest) {
    const records = [
      ...Object.entries(manifest.outputs).map(([name, record]) => ({
        name,
        record,
      })),
      ...Object.values(manifest.sources)
        .filter((record) => record.publicKey)
        .map((record) => ({
          name: path.basename(record.publicKey!),
          record: { ...record, key: record.publicKey! },
        })),
    ];
    for (const { name, record } of records) {
      const url = mediaUrl("media:" + record.key);
      if (!references.has(url) || assets.some((asset) => asset.url === url))
        continue;
      const bytes = await restoredBytes(root, name, record, url);
      const file = path.join(assetsDir, name);
      await fs.writeFile(file, bytes);
      assets.push({ name, file, bytes: bytes.length, url });
    }
  }
}
async function zipBundle(out: string, names: string[]) {
  const archive = path.resolve(out, "bundle.zip");
  await fs.rm(archive, { force: true });
  try {
    await exec("zip", ["-q", "-r", archive, ...names, "assets"], { cwd: out });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw Error(
        "Install the zip command to download export bundles (included with macOS).",
        { cause: error },
      );
    throw error;
  }
}
/** Package only referenced renditions/downloads, never private originals or credentials. */
export async function writePublicationExport(
  out: string,
  exported: PublicationExport,
  root = process.cwd(),
) {
  const assetsDir = path.join(out, "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  const references = new Set<string>();
  visit(parser().parse(exported.payload.body_markdown), (node) => {
    if (
      (node.type === "image" ||
        node.type === "link" ||
        node.type === "definition") &&
      "url" in node
    )
      references.add(node.url);
  });
  const assets = exported.assets.filter((asset) => references.has(asset.url));
  await restoreManifestAssets(root, assetsDir, references, assets);
  let offline = `# ${exported.payload.title}\n\n${exported.payload.body_markdown}`;
  for (const asset of assets) {
    const target = path.join(assetsDir, asset.name);
    if (path.resolve(asset.file) !== path.resolve(target))
      await fs.copyFile(asset.file, target);
    offline = offline.replaceAll(asset.url, "assets/" + asset.name);
  }
  const inventory = await Promise.all(
    assets.map(async ({ name, url, bytes }) => ({
      name,
      url,
      bytes,
      sha256: hash(await fs.readFile(path.join(assetsDir, name))),
    })),
  );
  const external = [...references].filter(
    (url) =>
      /^https?:/.test(url) &&
      !inventory.some((asset) => asset.url === url) &&
      exported.review.some(
        (item) =>
          item.url === url && item.action !== "png" && item.action !== "asset",
      ),
  );
  const files: Record<string, string> = {
    "article.md": offline,
    "article-online.md": `# ${exported.payload.title}\n\n${exported.payload.body_markdown}`,
    "payload.json": JSON.stringify(exported.payload, null, 2) + "\n",
    "media-review.json":
      JSON.stringify(
        { profile: exported.profile, media: exported.review, external },
        null,
        2,
      ) + "\n",
    "media-review.md":
      `# Media review\n\nDestination: ${exported.profile}\n\n` +
      (exported.review
        .map(
          (item) =>
            `- **${item.action}**${item.block ? ` (${item.block})` : ""}: ${item.detail}${item.url ? `\n  ${item.url}` : ""}`,
        )
        .join("\n") || "No media conversions or embeds.") +
      "\n",
    "assets.json": JSON.stringify(inventory, null, 2) + "\n",
    "README.txt":
      "article.md uses bundled local assets. article-online.md and payload.json use public CDN URLs.\nRelease enrolled assets before using those URLs online. This bundle does not publish a post.\nRemote images and live embeds remain external references; see media-review.json.\n",
  };
  for (const [name, text] of Object.entries(files))
    await fs.writeFile(path.join(out, name), text);
  for (const name of await fs.readdir(assetsDir)) {
    if (!inventory.some((asset) => asset.name === name))
      await fs.rm(path.join(assetsDir, name), { force: true });
  }
  await zipBundle(out, Object.keys(files));
  return { assets: inventory, external, markdown: files["article-online.md"] };
}
