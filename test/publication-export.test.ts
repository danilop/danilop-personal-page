import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { loadLibrary, parser } from "../core/model";
import { assignmentSchema, exportPublication } from "../core/distribution";
import { writePublicationExport } from "../core/publication-export";
import { AuthorExports } from "../core/author-exports";
import { AuthorStore } from "../core/author-store";
import { hash } from "../core/assets";
import { emptyAssetManifest, writeAssetManifest } from "../core/asset-manifest";
import YAML from "yaml";

async function fixture(t: import("node:test").TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "publication-export-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp("test/fixtures/manuscript", path.join(root, "content"), {
    recursive: true,
  });
  await fs.mkdir(path.join(root, "publishing"));
  await fs.writeFile(
    path.join(root, "publishing/distribution.yaml"),
    "schemaVersion: 1\nassignments: []\n",
  );
  await fs.copyFile(
    "publishing/destinations.yaml",
    path.join(root, "publishing/destinations.yaml"),
  );
  const lib = await loadLibrary(path.join(root, "content")),
    piece = lib.pieces.get("first")!;
  const file = "content/pieces/first/index.md";
  const source =
    (await fs.readFile(path.join(root, file), "utf8")).split(/\n---\n/)[0] +
    "\n---\n\n";
  const body =
    "![Green square](image.svg)\n\n[Read PDF](guide.pdf)\n\n[Listen](sound.mp3)\n\n![Remote image](https://example.com/remote.png)\n";
  await fs.writeFile(
    path.join(piece.dir, "image.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="green"/></svg>',
  );
  await fs.writeFile(
    path.join(piece.dir, "guide.pdf"),
    "%PDF-1.4\nfixture\n%%EOF\n",
  );
  await fs.writeFile(
    path.join(piece.dir, "sound.mp3"),
    Buffer.from([73, 68, 51, 1, 2, 3]),
  );
  await fs.writeFile(path.join(root, file), source + body);
  piece.body = body;
  piece.ast = parser().parse(body);
  const assignment = assignmentSchema.parse({
    piece: "first",
    destination: "dev",
  });
  return { root, lib, piece, file, source, body, assignment };
}

test("portable bundles preserve PNG, PDF/audio bytes, offline paths and canonical online CDN links", async (t) => {
  const f = await fixture(t),
    out = path.join(f.root, "export");
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    "https://www.danilop.net",
    { plugin: "dev", assetsOut: path.join(out, "assets") },
  );
  assert.equal(exported.dependencies.size, 3);
  assert.match(
    exported.payload.body_markdown,
    /https:\/\/media\.danilop\.net\/media\/[a-f0-9]+\.pdf/,
  );
  assert.doesNotMatch(
    exported.payload.body_markdown,
    /www\.danilop\.net\/media/,
  );
  assert.equal(
    exported.review.filter((item) => item.action === "asset").length,
    2,
  );
  await fs.writeFile(path.join(out, "assets", "unreferenced.txt"), "leftover");
  const bundle = await writePublicationExport(out, exported, f.root);
  assert.equal(bundle.assets.length, 3);
  assert.deepEqual(bundle.external, ["https://example.com/remote.png"]);
  await assert.rejects(fs.access(path.join(out, "assets/unreferenced.txt")));
  const archive = path.join(out, "bundle.zip");
  assert.match(
    execFileSync("unzip", ["-t", archive], { encoding: "utf8" }),
    /No errors/,
  );
  const offline = execFileSync("unzip", ["-p", archive, "article.md"], {
    encoding: "utf8",
  });
  assert.match(offline, /https:\/\/www.danilop.net\/writing\/first\//);
  assert.doesNotMatch(offline, /https:\/\/media.danilop.net\/media\//);
  assert.match(offline, /https:\/\/example.com\/remote.png/);
  for (const asset of bundle.assets) {
    const bytes = execFileSync("unzip", [
      "-p",
      archive,
      "assets/" + asset.name,
    ]);
    assert.equal(hash(bytes), asset.sha256);
    assert(offline.includes("assets/" + asset.name));
    if (asset.name.endsWith(".png"))
      assert.equal((await sharp(bytes).metadata()).format, "png");
    if (asset.name.endsWith(".pdf"))
      assert.equal(bytes.toString(), "%PDF-1.4\nfixture\n%%EOF\n");
  }
  assert.equal(
    JSON.parse(
      execFileSync("unzip", ["-p", archive, "payload.json"], {
        encoding: "utf8",
      }),
    ).canonical_url,
    exported.payload.canonical_url,
  );
});

test("bundles restore referenced manifest-pinned media while retaining arbitrary remote images", async (t) => {
  const f = await fixture(t),
    bytes = Buffer.from("%PDF-1.4\npinned\n%%EOF\n"),
    name = "pinned.pdf";
  const manifest = emptyAssetManifest(),
    digest = hash(bytes);
  manifest.outputs[name] = {
    sha256: digest,
    bytes: bytes.length,
    key: "media/" + name,
    contentType: "application/pdf",
  };
  await writeAssetManifest(f.root, manifest);
  await fs.mkdir(path.join(f.root, ".asset-cache"));
  await fs.writeFile(path.join(f.root, ".asset-cache", digest + ".pdf"), bytes);
  f.piece.body =
    "[Pinned document](media:media/pinned.pdf)\n\n![External](https://example.com/media/pinned.png)";
  f.piece.ast = parser().parse(f.piece.body);
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    "https://www.danilop.net",
    { plugin: "dev", assetsOut: path.join(f.root, "out/assets") },
  );
  const bundle = await writePublicationExport(
    path.join(f.root, "out"),
    exported,
    f.root,
  );
  assert.deepEqual(
    bundle.assets.map((asset) => asset.name),
    [name],
  );
  assert.match(
    await fs.readFile(path.join(f.root, "out/article.md"), "utf8"),
    /assets\/pinned.pdf/,
  );
  assert.deepEqual(bundle.external, ["https://example.com/media/pinned.png"]);
  await fs.writeFile(
    path.join(f.root, ".asset-cache", digest + ".pdf"),
    "corrupted",
  );
  await assert.rejects(
    writePublicationExport(path.join(f.root, "broken"), exported, f.root),
    /checksum mismatch/,
  );
});

test("local editor exports unsaved draft text, fences downloads and enrollment, and removes failed/stale results", async (t) => {
  const f = await fixture(t),
    service = new AuthorExports(f.root),
    store = new AuthorStore(f.root);
  const draft = (f.source + f.body).replace(
    "status: published",
    "status: draft",
  );
  await fs.writeFile(path.join(f.root, f.file), draft);
  const read = await store.read(f.file),
    settings = await service.settings(f.file);
  const request = {
    file: f.file,
    revision: read.revision,
    text: draft + "\nUnsaved addition.\n",
    destination: "dev",
    tags: ["test"],
  };
  const first = await service.generate(request);
  assert(first.draft && first.unsaved && !first.enrolled);
  assert.match(first.markdown, /Unsaved addition/);
  assert.equal(first.assets.length, 3);
  assert.equal(first.unprepared.length, 3);
  const payload = JSON.parse(
    (await service.download(first.id, "payload.json")).bytes.toString(),
  );
  assert.equal(payload.published, false);
  await assert.rejects(
    service.download(first.id, "../../publishing/destinations.yaml"),
    /unavailable/,
  );
  await assert.rejects(
    service.enroll({ ...request, registryRevision: settings.registryRevision }),
    /Save article edits/,
  );
  await assert.rejects(
    service.enroll({ ...request, text: draft, registryRevision: "stale" }),
    /settings changed/,
  );
  await assert.rejects(
    service.generate({ ...request, revision: "stale" }),
    /File changed/,
  );
  const saved = { ...request, text: draft };
  const enrolled = await service.enroll({
    ...saved,
    registryRevision: settings.registryRevision,
  });
  assert.equal(
    enrolled.destinations.find((d) => d.id === "dev")!.assignment?.creation,
    "draft",
  );
  assert.equal((await store.read(f.file)).text, draft);
  const second = await service.generate(saved);
  assert(second.enrolled && !second.unsaved);
  await assert.rejects(service.download(first.id, "bundle.zip"), /expired/);
  await assert.rejects(
    service.generate({
      ...saved,
      text: draft.replace("![Green square]", "![]"),
    }),
    /alternative text/,
  );
  await assert.rejects(service.download(second.id, "bundle.zip"), /expired/);
  await assert.rejects(
    fs.access(path.join(f.root, "exports/editor/dev/first")),
  );
  const registry = YAML.parse(
    await fs.readFile(
      path.join(f.root, "publishing/distribution.yaml"),
      "utf8",
    ),
  );
  assert.equal(registry.assignments.length, 1);
  const lib = await loadLibrary(path.join(f.root, "content"));
  await assert.rejects(
    exportPublication(
      lib.pieces.get("first")!,
      lib,
      f.assignment,
      "https://www.danilop.net",
      { plugin: "dev" },
    ),
    /Only public/,
  );
  await assert.rejects(
    service.settings("content/tags.yaml"),
    /standalone articles/,
  );
});

test("distribute CLI creates a usable bundle without delivery or global generated media", async (t) => {
  const f = await fixture(t);
  for (const name of [
    "renderers.yaml",
    "site.yaml",
    "media.json",
    "deployment.json",
  ])
    await fs.copyFile(
      "publishing/" + name,
      path.join(f.root, "publishing", name),
    );
  await fs.writeFile(
    path.join(f.root, "publishing/distribution.yaml"),
    "schemaVersion: 1\nassignments:\n  - {piece: first, destination: dev}\n",
  );
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: f.root,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    });
  git(["init", "-q"]);
  git(["add", "."]);
  git([
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "Fixture",
  ]);
  const cli = execFileSync(
    process.execPath,
    [
      "--import",
      path.resolve("node_modules/tsx/dist/loader.mjs"),
      path.resolve("scripts/distribute.ts"),
    ],
    {
      cwd: f.root,
      env: { ...process.env },
      encoding: "utf8",
    },
  );
  assert.match(cli, /preview ready/);
  const out = path.join(f.root, "exports/distribution/dev/first");
  assert.match(
    await fs.readFile(path.join(out, "article-online.md"), "utf8"),
    /media\.danilop\.net/,
  );
  assert.match(
    await fs.readFile(path.join(out, "article.md"), "utf8"),
    /assets\/[a-f0-9]+\.pdf/,
  );
  assert.equal((await fs.readdir(path.join(out, "assets"))).length, 3);
  assert.match(
    execFileSync("unzip", ["-t", path.join(out, "bundle.zip")], {
      encoding: "utf8",
    }),
    /No errors/,
  );
  await assert.rejects(fs.access(path.join(f.root, ".generated")));
});

test("local PDF/media block fallbacks include the actual downloadable source", async (t) => {
  const f = await fixture(t);
  f.piece.blocks.document = {
    kind: "document",
    source: { format: "pdf", path: "guide.pdf" },
    title: "Guide",
    alternative: { mode: "summary-link", text: "A guide to the example." },
  };
  f.piece.blocks.audio = {
    kind: "audio",
    source: { format: "audio", path: "sound.mp3" },
    title: "Recording",
    alternative: { mode: "summary-link", text: "An audio example." },
  };
  f.piece.body = '::block{ref="document"}\n\n::block{ref="audio"}';
  f.piece.ast = parser().parse(f.piece.body);
  const out = path.join(f.root, "block-export");
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    "https://www.danilop.net",
    { plugin: "dev", assetsOut: path.join(out, "assets") },
  );
  assert.match(exported.payload.body_markdown, /Download Guide/);
  assert.match(exported.payload.body_markdown, /Download Recording/);
  assert.equal(exported.assets.length, 2);
  const bundle = await writePublicationExport(out, exported, f.root);
  assert.equal(bundle.assets.length, 2);
  assert.match(
    await fs.readFile(path.join(out, "article.md"), "utf8"),
    /assets\/[a-f0-9]+\.mp3/,
  );
});
