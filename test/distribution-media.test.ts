import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { loadLibrary, parser, type Block } from "../core/model";
import {
  assignmentSchema,
  exportPublication,
  payloadHash,
  syncCopy,
  type Delivery,
  type Payload,
} from "../core/distribution";
import {
  MediaProfiles,
  PortableAssets,
  mediaPolicySchema,
} from "../core/distribution-media";

const origin = "https://www.danilop.net";
async function fixture(t: any) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "notes-crosspost-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const lib = await loadLibrary("test/fixtures/manuscript");
  const piece = lib.pieces.get("first")!;
  await fs.cp(piece.dir, path.join(temp, "source"), { recursive: true });
  piece.dir = path.join(temp, "source");
  const setBody = (body: string) => {
    piece.body = body;
    piece.ast = parser().parse(body);
  };
  const assignment = assignmentSchema.parse({
    piece: piece.id,
    destination: "dev",
    creation: "automatic",
    updates: "automatic",
  });
  const options = { plugin: "dev", assetsOut: path.join(temp, "media") };
  return { temp, lib, piece, setBody, assignment, options };
}
const google =
  "https://docs.google.com/document/d/e/2PACX-test/pub?embedded=true";
const googleBlock = (): Block => ({
  kind: "document",
  source: { format: "google-docs-published", url: google },
  title: "Design notes",
  caption: "The living document.",
  summary: "Design notes updated over time.",
  alternative: {
    mode: "summary-link",
    text: "Read the public design notes.",
    url: google,
  },
});

test("Mermaid word spans rasterize identically to a complete label", async (t) => {
  const f = await fixture(t);
  const assets = new PortableAssets(
    mediaPolicySchema.parse({}),
    [],
    f.options.assetsOut,
  );
  const svg = (words: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60"><text x="10" y="35" font-size="22"><tspan class="text-outer-tspan">${words}</tspan></text></svg>`;
  const split = await assets.emit(
    svg(
      '<tspan class="text-inner-tspan">Readable</tspan><tspan class="text-inner-tspan"> labels</tspan>',
    ),
    ".svg",
  );
  const whole = await assets.emit(
    svg('<tspan class="text-inner-tspan">Readable labels</tspan>'),
    ".svg",
  );
  const joined = await assets.emit(
    svg('<tspan class="text-inner-tspan">Readablelabels</tspan>'),
    ".svg",
  );
  assert.equal(split, whole);
  assert.notEqual(split, joined);
});

test("reference-style images and dated fallback previews are rasterized without losing the companion link", async (t) => {
  const f = await fixture(t);
  await fs.writeFile(
    path.join(f.piece.dir, "preview.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="green"/></svg>',
  );
  f.piece.blocks.document = {
    kind: "document",
    source: { format: "pdf", url: "https://example.com/guide.pdf" },
    alternative: {
      mode: "static",
      text: "A captured page.",
      capturedAt: "2026-09-16",
      assets: [{ path: "preview.svg", description: "A green page preview." }],
    },
  };
  f.setBody(
    '![Reference image][preview]\n\n[preview]: preview.svg\n\n::block{ref="document"}',
  );
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    f.options,
  );
  assert.match(
    exported.payload.body_markdown,
    /!\[Reference image\]\(https:\/\/www.danilop.net\/media\/[a-f0-9]+\.png\)/,
  );
  assert.match(exported.payload.body_markdown, /!\[A green page preview\.\]/);
  assert.match(
    exported.payload.body_markdown,
    /https:\/\/example.com\/guide.pdf/,
  );
  assert(exported.review.some((item) => item.action === "fallback"));
  assert.equal(
    f.piece.ast.children.some((node: any) =>
      node.children?.some((child: any) => child.type === "imageReference"),
    ),
    true,
  );
});

test("cross-post charts, both diagram engines and local figures become real PNGs with captions and alt text", async (t) => {
  const f = await fixture(t);
  f.piece.blocks.mermaid = {
    kind: "diagram",
    source: {
      format: "mermaid",
      text: "flowchart LR\nA[Readable label] --> B[Next step]",
    },
    description: "A connects to B.",
    caption: "A labelled flow.",
  };
  await fs.writeFile(
    path.join(f.piece.dir, "photo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="blue"/></svg>',
  );
  f.piece.blocks.photo = {
    kind: "image",
    source: { format: "image", path: "photo.svg" },
    description: "Blue rectangle.",
    caption: "Local figure.",
  };
  f.setBody(
    'See :ref{target="first#flow"}.\n\n::block{ref="flow"}\n\n::block{ref="chart"}\n\n::block{ref="mermaid"}\n\n::block{ref="photo"}\n\n::block{ref="table"}\n\n![Raw local image](photo.svg)',
  );
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    f.options,
  );
  const body = exported.payload.body_markdown;
  assert(
    body.startsWith(
      `The original article can be found [here](${exported.payload.canonical_url}).\n\n`,
    ),
  );
  assert.match(body, /Figure 1\. Notes become a book/);
  assert.match(body, /Figure 4\. Local figure/);
  assert.match(
    body,
    /!\[Blue rectangle\.\]\(https:\/\/www\.danilop\.net\/media\/[a-f0-9]+\.png\)/,
  );
  assert.match(body, /\| step\s*\| value/);
  assert.match(
    body,
    /https:\/\/www\.danilop\.net\/writing\/first\/#first-flow/,
  );
  assert.doesNotMatch(body, /\.svg\)|\.webp\)|NOTESMEDIA/);
  for (const asset of exported.review.filter((item) => item.action === "png")) {
    const image = await sharp(
      await fs.readFile(
        path.join(
          f.options.assetsOut,
          path.basename(new URL(asset.url!).pathname),
        ),
      ),
    ).metadata();
    assert.equal(image.format, "png");
    assert(image.width! > 0 && image.width! <= 1600);
    assert(image.height! > 0);
  }
  assert(exported.review.filter((item) => item.action === "png").length >= 4);
});

test("changed image bytes update the same remote article with a fresh image URL", async (t) => {
  const f = await fixture(t);
  f.setBody('::block{ref="chart"}');
  const first = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    f.options,
  );
  await fs.writeFile(
    path.join(f.piece.dir, "data.csv"),
    "step,value\n0,30\n1,55\n2,70\n",
  );
  const second = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    f.options,
  );
  assert.notEqual(first.review[0].url, second.review[0].url);
  assert.notEqual(payloadHash(first.payload), payloadHash(second.payload));
  let remote: Payload,
    creates = 0,
    updates = 0,
    entry: Delivery | undefined;
  const adapter = {
    id: "test",
    capabilities: { create: true, update: true, read: true },
    async find() {
      return [];
    },
    async read(id: number) {
      assert.equal(id, 42);
      return { id, url: "https://dev.to/danilop/test", payload: remote };
    },
    async create(payload: Payload) {
      creates++;
      remote = payload;
      return this.read(42);
    },
    async update(id: number, payload: Payload) {
      updates++;
      remote = payload;
      return this.read(id);
    },
  };
  const save = async (value: Delivery) => {
    entry = value;
  };
  await syncCopy(adapter, first.payload, "one", entry, save, f.assignment);
  await syncCopy(adapter, second.payload, "two", entry, save, f.assignment);
  await syncCopy(adapter, second.payload, "two", entry, save, f.assignment);
  assert.equal(creates, 1);
  assert.equal(updates, 1);
  assert.equal(entry!.remote!.id, 42);
});

test("DEV uses native video embeds and explicit Google fallbacks; required unsupported embeds fail", async (t) => {
  const f = await fixture(t);
  f.piece.blocks.document = googleBlock();
  f.piece.blocks.video = {
    kind: "video",
    source: { format: "video", url: "https://www.youtube.com/watch?v=abc123" },
    description: "A video.",
  };
  f.setBody('::block{ref="document"}\n\n::block{ref="video"}');
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    f.options,
  );
  assert.match(
    exported.payload.body_markdown,
    /\{% embed https:\/\/www.youtube.com\/watch\?v=abc123 %\}/,
  );
  assert.match(exported.payload.body_markdown, /Read the public design notes/);
  assert.match(exported.payload.body_markdown, /docs.google.com/);
  assert.deepEqual(
    exported.review.map((item) => item.action),
    ["fallback", "embed"],
  );
  const required = {
    ...f.assignment,
    media: mediaPolicySchema.parse({ requiredEmbeds: ["document"] }),
  };
  await assert.rejects(
    exportPublication(f.piece, f.lib, required, origin, f.options),
    /Required embed document/,
  );
  delete f.piece.blocks.document.alternative;
  await assert.rejects(
    exportPublication(f.piece, f.lib, f.assignment, origin, f.options),
    /fallback required/,
  );
});

test("Medium preserves Google URLs with an editor review step and exact-URL required-embed verification", async (t) => {
  const f = await fixture(t);
  f.piece.blocks.document = googleBlock();
  f.setBody('::block{ref="document"}');
  const options = { ...f.options, plugin: "medium-assisted" };
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    options,
  );
  assert(
    exported.payload.body_markdown.startsWith(
      `The original article can be found [here](${exported.payload.canonical_url}).\n\n${google}\n`,
    ),
  );
  assert.equal(exported.review[0].action, "embed-review");
  assert.doesNotMatch(
    exported.payload.body_markdown,
    /iframe|NOTESMEDIA|Read the public design notes/,
  );
  const required = {
    ...f.assignment,
    media: mediaPolicySchema.parse({ requiredEmbeds: ["document"] }),
  };
  await assert.rejects(
    exportPublication(f.piece, f.lib, required, origin, options),
    /exact-URL editor verification/,
  );
  required.media.verifiedEmbeds.push(google);
  assert.equal(
    (await exportPublication(f.piece, f.lib, required, origin, options))
      .review[0].action,
    "embed-review",
  );
  f.piece.blocks.document.source.url =
    "https://docs.google.com/document/d/private/edit";
  await assert.rejects(
    exportPublication(f.piece, f.lib, f.assignment, origin, options),
    /Publish to web/,
  );
});

test("profiles are replaceable, excerpt images use the same policy, and unsafe SVG cannot silently lose content", async (t) => {
  const f = await fixture(t);
  f.piece.blocks.document = googleBlock();
  f.setBody('::block{ref="document"}');
  const profiles = new MediaProfiles().register({
    id: "custom",
    embed: (url) => ({ markdown: `CUSTOM(${url.href})`, needsReview: false }),
  });
  const exported = await exportPublication(
    f.piece,
    f.lib,
    f.assignment,
    origin,
    { ...f.options, plugin: "custom", profiles },
  );
  assert.match(exported.payload.body_markdown, /CUSTOM\(https/);
  const excerpt = {
    ...f.assignment,
    mode: "excerpt" as const,
    excerpt: "![External](https://example.com/image.png)",
  };
  const external = await exportPublication(
    f.piece,
    f.lib,
    excerpt,
    origin,
    f.options,
  );
  assert.equal(external.review[0].action, "external-image");
  assert(
    external.payload.body_markdown.startsWith(
      `The original article can be found [here](${external.payload.canonical_url}).\n\n`,
    ),
  );
  assert.match(
    external.payload.body_markdown,
    /https:\/\/example.com\/image.png/,
  );
  const assets = new PortableAssets(
    mediaPolicySchema.parse({}),
    [],
    f.options.assetsOut,
  );
  await assert.rejects(
    assets.emit(
      "<svg><foreignObject>Missing text</foreignObject></svg>",
      ".svg",
    ),
    /native text/,
  );
  await assert.rejects(
    exportPublication(f.piece, f.lib, f.assignment, origin, {
      ...f.options,
      plugin: "missing",
    }),
    /No media profile/,
  );
});
