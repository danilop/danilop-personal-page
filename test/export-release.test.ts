import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { repositoryFixture } from "./repository-fixture";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";
import { readAssetManifest } from "../core/asset-manifest";
import { hash } from "../core/assets";

test(
  "asset preparation pins export-only downloads/renditions and keeps enrolled draft assets private",
  { timeout: 90000 },
  async (t) => {
    const fixture = await repositoryFixture(process.cwd());
    t.after(() => fixture.cleanup());
    const root = fixture.dir,
      id = "export-release-fixture";
    const directory = path.join(root, "content/pieces", id);
    await fs.mkdir(path.join(directory, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(directory, "index.md"),
      `---\nschemaVersion: 1\nid: ${id}\ntitle: Export release fixture\nsummary: An export-only asset test.\ndraft: false\nslug: ${id}\npublishedAt: 2026-10-03T10:00:00Z\npublication: {surfaces: [standalone]}\n---\n\nThe canonical article has no local attachments.\n`,
    );
    const pdf = Buffer.from("%PDF-1.4\nexport-only\n%%EOF\n");
    await fs.writeFile(path.join(directory, "assets/guide.pdf"), pdf);
    await sharp({
      create: { width: 36, height: 20, channels: 3, background: "#a1b2c3" },
    })
      .png()
      .toFile(path.join(directory, "assets/image.png"));
    const draftDirectory = path.join(
      root,
      "content/pieces/export-draft-fixture",
    );
    await fs.mkdir(path.join(draftDirectory, "assets"), { recursive: true });
    await sharp({
      create: { width: 36, height: 20, channels: 3, background: "#ff0000" },
    })
      .png()
      .toFile(path.join(draftDirectory, "assets/private.png"));
    await fs.writeFile(
      path.join(draftDirectory, "index.md"),
      "---\nschemaVersion: 1\nid: export-draft-fixture\ntitle: Private export fixture\nsummary: Draft asset isolation.\ndraft: true\nslug: export-draft-fixture\npublication: {surfaces: [standalone]}\n---\n\n![Private](assets/private.png)\n",
    );
    await fs.writeFile(
      path.join(root, "publishing/distribution.yaml"),
      `schemaVersion: 1\nassignments:\n  - piece: ${id}\n    destination: dev\n    mode: excerpt\n    excerpt: |\n      ![Export image](assets/image.png)\n\n      [Download guide](assets/guide.pdf)\n  - piece: export-draft-fixture\n    destination: dev\n`,
    );
    const env = isolatedGitEnvironment(process.cwd());
    delete env.CI;
    delete env.AWS_BRANCH;
    execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/prepare-assets.ts"],
      { cwd: root, env, stdio: "pipe", timeout: 60000 },
    );
    const manifest = (await readAssetManifest(root))!;
    const pdfSource = manifest.sources[`content/pieces/${id}/assets/guide.pdf`];
    assert.equal(pdfSource.publicKey, "media/" + hash(pdf) + ".pdf");
    assert(manifest.outputs[hash(pdf) + ".pdf"]);
    const image = manifest.sources[`content/pieces/${id}/assets/image.png`];
    assert(
      image.publicKey,
      "export-only source must restore from public storage during CI",
    );
    assert.equal(
      manifest.sources["content/pieces/export-draft-fixture/assets/private.png"]
        .publicKey,
      undefined,
    );
    const blocked = JSON.parse(
      await fs.readFile(
        path.join(root, ".generated/distribution-blocked.json"),
        "utf8",
      ),
    );
    assert(
      blocked.some(
        (copy: { piece: string }) => copy.piece === "export-draft-fixture",
      ),
    );
    assert(!blocked.some((copy: { piece: string }) => copy.piece === id));
    const before = Object.keys(manifest.outputs).sort();
    execFileSync(process.execPath, ["--import", "tsx", "scripts/prepare.ts"], {
      cwd: root,
      env: { ...env, NOTES_ASSET_STRICT: "1" },
      stdio: "pipe",
      timeout: 60000,
    });
    assert.deepEqual(
      Object.keys((await readAssetManifest(root))!.outputs).sort(),
      before,
    );
  },
);
