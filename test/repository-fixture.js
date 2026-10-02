const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
async function repositoryFixture(root) {
  const { createSnapshot, attachRepository } =
    await import("../tools/code-analysis/snapshot.mjs");
  const fixture = createSnapshot(root, { worktree: true });
  try {
    attachRepository(root, fixture.dir);
    await seedPrivateImages(fixture.dir);
    for (const folder of [
      "node_modules",
      "prototypes/ink-and-paper/node_modules",
    ])
      fs.symlinkSync(
        path.join(root, folder),
        path.join(fixture.dir, folder),
        "dir",
      );
    return fixture;
  } catch (error) {
    fixture.cleanup();
    throw error;
  }
}
async function seedPrivateImages(dir) {
  // CI has no private draft artwork or AWS credentials. Give disposable authoring
  // fixtures their own image bytes/identities; production sources remain untouched.
  const file = path.join(dir, "publishing/media-assets.json");
  if (!fs.existsSync(file)) return;
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  const { sourceRecord } = await import("../core/asset-manifest.ts");
  for (const [logical, record] of Object.entries(manifest.sources)) {
    const target = path.join(dir, logical);
    if (
      record.publicKey ||
      !record.contentType.startsWith("image/") ||
      fs.existsSync(target)
    )
      continue;
    const bytes = await sharp({
      create: { width: 24, height: 36, channels: 3, background: "#123456" },
    })
      .toFormat(path.extname(target).slice(1).replace(/^jpg$/, "jpeg"))
      .toBuffer();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    manifest.sources[logical] = sourceRecord(logical, bytes);
  }
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}
module.exports = { repositoryFixture };
