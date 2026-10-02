import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  readAssetManifest,
  emptyAssetManifest,
  sourceRecord,
  writeAssetManifest,
  assetTypes,
  hydrateManagedAsset,
  digestAsset,
} from "../core/asset-manifest";
import { AuthorImageCleanup } from "../core/author-image-cleanup";

async function main() {
  const root = process.cwd();
  const cleanup = new AuthorImageCleanup(root);
  await fs.mkdir(cleanup.state, { recursive: true });
  const lock = await fs.open(path.join(cleanup.state, "write.lock"), "wx");
  try {
    const manifest = (await readAssetManifest(root)) ?? emptyAssetManifest();
    const args = process.argv.slice(2);
    if (args.length) {
      if (
        args.length !== 2 ||
        !["--share", "--unshare"].includes(args[0]) ||
        !/^content\/(?:pieces\/[a-zA-Z0-9_-]+|collections)\/assets\/[a-zA-Z0-9_.-]+$/.test(
          args[1],
        )
      )
        throw Error(
          "Usage: assets:prepare [--share|--unshare content/pieces/ID/assets/FILE]",
        );
      if (args[0] === "--unshare")
        manifest.shared = manifest.shared.filter(
          (logical) => logical !== args[1],
        );
      else if (!manifest.shared.includes(args[1]))
        manifest.shared.push(args[1]);
    }
    const refs = await cleanup.references();
    for (const logical of Object.keys(manifest.sources)) {
      if (await fs.stat(logical).catch(() => null)) continue;
      if (
        refs.names.has(path.basename(logical)) ||
        refs.hashes.has(manifest.sources[logical].sha256) ||
        refs.corpus.includes(manifest.sources[logical].sha256) ||
        manifest.shared.includes(logical)
      )
        await hydrateManagedAsset(
          path.dirname(path.resolve(logical)),
          path.basename(logical),
        );
      else delete manifest.sources[logical];
    }
    async function walk(folder: string) {
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isSymbolicLink())
          throw Error(`Symbolic-link asset/source: ${file}`);
        if (entry.isDirectory()) await walk(file);
        else if (
          file.includes(path.sep + "assets" + path.sep) &&
          assetTypes[path.extname(file)] &&
          !/\.(svg|csv)$/.test(file)
        ) {
          const bytes = await fs.readFile(file);
          const next = sourceRecord(file.split(path.sep).join("/"), bytes);
          manifest.sources[file] = next;
          const ownership = path.join(
            cleanup.state,
            "image-assets",
            digestAsset(file) + ".json",
          );
          if (!(await fs.stat(ownership).catch(() => null)))
            await cleanup.register(file, next.sha256);
        }
      }
    }
    await walk("content");
    await writeAssetManifest(root, manifest);
    execFileSync(process.execPath, ["--import", "tsx", "scripts/prepare.ts"], {
      stdio: "inherit",
      env: { ...process.env, NOTES_ASSET_PREPARE: "1" },
    });
    const prepared = (await readAssetManifest(root))!;
    for (const logical of prepared.shared)
      console.log(
        `Shared file ${logical}: media:${prepared.sources[logical].publicKey}`,
      );
    console.log(
      "Asset identities and public renditions prepared. Review and commit before npm run release.",
    );
  } finally {
    await lock.close();
    await fs.rm(path.join(cleanup.state, "write.lock"));
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
