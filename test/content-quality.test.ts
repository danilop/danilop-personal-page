import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readTagPieces } from "../core/tags";
import {
  emptyAssetManifest,
  sourceRecord,
  writeAssetManifest,
} from "../core/asset-manifest";
import {
  qualitySchema,
  extractReviewPiece,
  checkBaselines,
  applyReviewDecisions,
  hash,
  renderQualityReport,
  type QualityFinding,
} from "../core/content-quality";

async function fixture(t: import("node:test").TestContext, body: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quality-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const folder = path.join(dir, "pieces", "example");
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, "index.md");
  await fs.writeFile(
    file,
    "---\nschemaVersion: 1\nid: example\ntitle: Example\nsummary: Metadata phrase excluded\nstatus: draft\nlanguage: en-GB\npublication: {surfaces: [collection]}\ntags: [python]\n---\n" +
      body,
  );
  const [p] = await readTagPieces([dir]);
  return { dir, file, p };
}
test("prose extraction preserves original source lines and excludes code, metadata, quotes, headings, footnotes, and link destinations", async (t) => {
  const body =
    '# Heading words excluded\n\nThe record stores useful information.\n\n> Quoted prose is excluded.\n\nText with `inline_code_word` and [visible label](https://secret-url.invalid/destinationword).\n\n```python\nprint("codeword")\n```\n\nThe author called it “quotedword”.\n\n| Label | Value |\n| --- | --- |\n| Caption prose | original table words |\n\nA source.[^source]\n\n[^source]: Citation prose is excluded.\n';
  const { p, file } = await fixture(t, body);
  const review = await extractReviewPiece(p);
  const prose = review.segments.map((s) => s.text).join("\n");
  assert(prose.includes("visible label"));
  assert(prose.includes("original table words"));
  for (const term of [
    "Heading words",
    "Quoted prose",
    "Metadata phrase",
    "inline_code_word",
    "destinationword",
    "codeword",
    "quotedword",
    "Citation prose",
  ])
    assert(!prose.includes(term), term);
  const source = (await fs.readFile(file, "utf8")).split("\n");
  const record = review.segments.find((s) => s.text.includes("The record"))!;
  assert.equal(
    source[record.line - 1],
    "The record stores useful information.",
  );
  assert.equal(review.pythonBlocks.length, 1);
  assert.equal(source[review.pythonBlocks[0].line - 1], 'print("codeword")');
  assert.equal(review.technical.length, 0);
});
test("missing footnotes and relative assets are technical errors, external URLs are not fetched", async (t) => {
  const { p } = await fixture(
    t,
    "Unresolved note.[^missing]\n\n![caption](missing.png)\n\n[Remote](https://invalid.invalid)\n",
  );
  const r = await extractReviewPiece(p);
  assert(r.technical.some((f) => f.rule === "reference-missing"));
  assert(r.technical.some((f) => f.rule === "local-resource-missing"));
  assert.equal(r.technical.length, 2);
});
test("writing checks restore a missing managed asset and reject corrupt downloaded bytes", async (t) => {
  const { p, dir, file } = await fixture(
    t,
    "![Managed image](assets/image.png)\n",
  );
  const source = "content/pieces/example/index.md";
  const logical = "content/pieces/example/assets/image.png";
  const canonical = await fs.realpath(dir);
  await fs.mkdir(path.dirname(path.join(dir, source)), { recursive: true });
  await fs.copyFile(file, path.join(dir, source));
  const bytes = Buffer.from("checksum-pinned image");
  const manifest = emptyAssetManifest();
  manifest.sources[logical] = {
    ...sourceRecord(logical, bytes),
    publicKey: "media/image.png",
  };
  await writeAssetManifest(dir, manifest);
  const piece = { ...p, sources: [path.join(canonical, source)] };
  let downloaded = bytes;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.match(String(url), /\/media\/image\.png$/);
    return new Response(downloaded);
  });
  assert.equal((await extractReviewPiece(piece)).technical.length, 0);
  assert.deepEqual(await fs.readFile(path.join(dir, logical)), bytes);
  await fs.rm(path.join(dir, logical));
  downloaded = Buffer.from("corrupt");
  assert(
    (await extractReviewPiece(piece)).technical.some(
      (f) => f.rule === "local-resource-missing",
    ),
  );
  await assert.rejects(fs.access(path.join(dir, logical)));
});
test("baseline checks detect body/source drift without modifying source", async (t) => {
  const { p, file, dir } = await fixture(t, "Stable prose.\n");
  const r = await extractReviewPiece(p);
  const before = await fs.readFile(file, "utf8");
  const binary = Buffer.from([255, 0, 128, 42]);
  await fs.writeFile(path.join(dir, "asset.bin"), binary);
  const config = qualitySchema.parse({
    schemaVersion: 1,
    baselines: [
      {
        piece: p.id,
        bodySha256: r.bodySha256,
        files: [
          { path: path.relative(dir, file), sha256: hash(before) },
          { path: "asset.bin", sha256: hash(binary) },
        ],
      },
    ],
  });
  assert.equal((await checkBaselines([r], config, dir)).length, 0);
  config.baselines[0].bodySha256 = "a".repeat(64);
  await fs.appendFile(file, "Change\n");
  assert.equal((await checkBaselines([r], config, dir)).length, 2);
  assert.equal(await fs.readFile(file, "utf8"), before + "Change\n");
});
test("review decisions require matching finding and fingerprint and cannot suppress errors", async (t) => {
  const { p } = await fixture(t, "Stable prose.\n");
  const r = await extractReviewPiece(p);
  const finding: QualityFinding = {
    piece: p.id,
    line: 11,
    excerpt: "Stable prose.",
    rule: "style",
    severity: "review",
    message: "Review",
  };
  const config = qualitySchema.parse({ schemaVersion: 1 });
  const first = applyReviewDecisions([{ ...finding }], [r], config).findings[0];
  config.exceptions = [
    {
      finding: first.id!,
      fingerprint: first.fingerprint!,
      reason: "Intentional terminology",
    },
  ];
  assert.equal(
    applyReviewDecisions([{ ...finding }], [r], config).findings[0].accepted,
    "Intentional terminology",
  );
  assert.equal(
    applyReviewDecisions(
      [{ ...finding }],
      [{ ...r, fingerprint: "changed" }],
      config,
    ).stale.length,
    1,
  );
  assert.equal(
    applyReviewDecisions([{ ...finding, severity: "error" }], [r], config)
      .findings[0].accepted,
    undefined,
  );
});
test("configuration rejects unknown fields and invalid thresholds", () => {
  assert.throws(() =>
    qualitySchema.parse({ schemaVersion: 1, autoRewrite: true }),
  );
  assert.throws(() =>
    qualitySchema.parse({
      schemaVersion: 1,
      repetition: { minN: 8, maxN: 3, minCount: 2 },
    }),
  );
});
test("missing NLP runtime writes an explicitly incomplete private report and returns failure", async (t) => {
  const { dir, file } = await fixture(t, "Plain content.\n");
  const config = path.join(dir, "quality.yaml");
  await fs.writeFile(config, "schemaVersion: 1\n");
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      createRequire(import.meta.url).resolve("tsx"),
      path.resolve("scripts/quality.ts"),
      "--source",
      dir,
      "--config",
      config,
      "--registry",
      path.resolve("content/tags.yaml"),
      "--python",
      path.join(dir, "not-python"),
    ],
    { cwd: dir, encoding: "utf8" },
  );
  assert.equal(result.status, 3, result.stderr);
  const report = JSON.parse(
    await fs.readFile(
      path.join(dir, "exports/content-review/report.json"),
      "utf8",
    ),
  );
  assert(
    report.findings.some(
      (f: { rule: string }) => f.rule === "worker-unavailable",
    ),
  );
  assert(
    report.checks.some((c: { status: string }) => c.status === "unavailable"),
  );
  assert((await fs.readFile(file, "utf8")).includes("Plain content."));
  report.findings[0].excerpt = "<script>alert(1)</script>";
  const html = renderQualityReport(report);
  assert(!html.includes("<script>alert"));
  assert(html.includes("&lt;script&gt;"));
  const padded =
    "This can  improve reasoning                                   , but tests can miss defects.";
  report.findings[0].excerpt = padded;
  report.findings[0].locations = [
    { piece: "example", line: 1, excerpt: padded },
  ];
  report.repetitions = [
    {
      example: "improve reasoning",
      stems: ["improv", "reason"],
      pieceCount: 1,
      perPiece: { example: 2 },
      n: 2,
      count: 2,
      locations: report.findings[0].locations,
    },
  ];
  const snapshot = JSON.stringify(report);
  const clean = renderQualityReport(report);
  assert(!clean.includes(padded));
  assert.equal(
    clean.split(
      "<blockquote>This can improve reasoning, but tests can miss defects.</blockquote>",
    ).length - 1,
    3,
  );
  assert.equal(JSON.stringify(report), snapshot);
});
