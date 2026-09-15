import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  loadLibrary,
  assemble,
  allowed,
  standalone,
  pieceSchema,
  validateCollection,
  type Block,
} from "../core/model";
import { renderDocument } from "../core/render";
import { readYaml } from "../core/model";
import { Assets, localAsset } from "../core/assets";
import { registry, publicEmbed } from "../renderers/static";
import { freezeEdition, verifyEdition } from "../core/books";
import { compileLinks } from "../core/shortlinks";
import { siteSchema } from "../core/config";
import { simulate } from "../runtime/growth";
import {
  syncCopy,
  payloadHash,
  type Destination,
  type Payload,
  type Delivery,
} from "../core/distribution";
const root = "test/fixtures/manuscript";
test("contextual assembly respects surfaces, identity, order and private content", async () => {
  const lib = await loadLibrary(root),
    c = lib.collections.find((c) => c.id === "guide")!;
  const web = assemble(c, lib, "web"),
    book = assemble(c, lib, "book");
  assert(
    !web.nodes.some((n) =>
      ["preface", "closing", "draft"].includes(n.piece?.id ?? ""),
    ),
  );
  assert(book.nodes.some((n) => n.piece?.id === "preface"));
  assert.equal(
    web.nodes.find((n) => n.id === "first-use")!.title,
    "The contextual first section",
  );
  assert.equal(lib.pieces.get("first")!.title, "A reusable article");
  assert.equal(
    assemble(lib.collections[0], lib, "web").id,
    lib.collections[0].id,
  );
  const reordered = structuredClone(c);
  reordered.body.reverse();
  assert.equal(
    assemble(reordered, lib, "web").nodes.find((n) => n.id === "chapter-one")!
      .number,
    "2",
  );
  assert.equal(web.nodes.find((n) => n.id === "chapter-one")!.number, "1");
  assert(!allowed(lib.pieces.get("preface")!, "standalone"));
});
test("broken references, duplicate placements, invalid dates, cycles and alias collisions fail", async () => {
  const lib = await loadLibrary(root),
    c = structuredClone(lib.collections.find((c) => c.id === "guide")!);
  c.body.push({ id: "missing", kind: "piece", ref: "not-there" });
  assert.throws(() => validateCollection(c, lib.pieces), /Missing piece/);
  c.body.pop();
  c.body.push(c.body[0]);
  assert.throws(() => validateCollection(c, lib.pieces), /Duplicate placement/);
  assert(
    !pieceSchema.safeParse({
      ...lib.pieces.get("first"),
      publishedAt: "2026-02-30",
    }).success,
  );
  assert.throws(
    () =>
      compileLinks(
        { schemaVersion: 1, links: { api: { ref: "first" } } },
        lib,
        "https://example.com",
      ),
    /Reserved/,
  );
});
test("renderer changes discard inherited options and reject incompatible formats", async () => {
  const reg = registry();
  const block: Block = {
    kind: "code",
    source: { format: "source-code", text: "hi", language: "text" },
    render: { web: { plugin: "code-plain" } },
  };
  const result = reg.resolve(block, "web", {
    web: { code: { plugin: "shiki", options: { theme: "github-dark" } } },
  });
  assert.equal(result.plugin.id, "code-plain");
  assert.deepEqual(result.options, {});
  assert.throws(
    () =>
      reg.resolve({ ...block, render: { web: { plugin: "d2" } } }, "web", {}),
    /incompatible/,
  );
});
test("assets cannot escape their source and embed URLs must be public formats", async () => {
  await assert.rejects(
    localAsset(path.resolve(root, "pieces/first"), "../../../../package.json"),
  );
  assert.throws(() =>
    publicEmbed(
      "google-docs-published",
      "https://docs.google.com/document/d/private/edit",
    ),
  );
  assert.equal(
    publicEmbed(
      "google-docs-published",
      "https://docs.google.com/document/d/e/PUBLIC/pub",
    ),
    "https://docs.google.com/document/d/e/PUBLIC/pub",
  );
});
test("JS and WASM simulations produce matching results and reject invalid input", async () => {
  const input = { initial: 100, rate: 5, steps: 20 };
  const js = await simulate(input, "js"),
    wasm = await simulate(input, "wasm");
  assert.deepEqual(js, wasm);
  assert(Math.abs(js.at(-1)! - 265.3297705) < 0.0001);
  await assert.rejects(simulate({ ...input, steps: 1e9 }, "wasm"));
});
test("static diagrams, charts, tables, code, math and references render; editions freeze", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
  try {
    const lib = await loadLibrary(root),
      p = lib.pieces.get("first")!,
      defaults = await readYaml("publishing/renderers.yaml");
    const rendered = await renderDocument(
      standalone(p),
      lib,
      defaults,
      new Assets(path.join(tmp, "media")),
    );
    assert.match(rendered.html, /href="#first-flow"/);
    assert.match(rendered.html, /id="first-flow"/);
    assert.match(rendered.html, /<table>/);
    assert.match(rendered.html, /katex/);
    assert.equal(Object.keys(rendered.blockAssets).length, 2);
    const c = lib.collections.find((c) => c.id === "guide")!;
    const output = await freezeEdition(c, lib, "edition-one", tmp);
    const manifest = await verifyEdition(output);
    assert.equal(manifest.exporter.id, "markua");
    await assert.rejects(
      freezeEdition(c, lib, "edition-one", tmp),
      /already exists/,
    );
    p.body += "A future edit.";
    await verifyEdition(output);
    await fs.appendFile(
      path.join(output, "manuscript", "Book.txt"),
      "tampered",
    );
    await assert.rejects(verifyEdition(output), /differ/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
const payload: Payload = {
  title: "Hello",
  description: "Hello",
  body_markdown: "Text",
  canonical_url: "https://example.com/writing/hello/",
  tags: [],
  published: true,
};
test("cross-post reruns update one ID, preserve overrides and detect remote edits", async () => {
  let remote: any;
  let creates = 0,
    updates = 0;
  const adapter: Destination = {
    id: "test",
    capabilities: { create: true, update: true, read: true },
    async find() {
      return remote ? [remote] : [];
    },
    async read() {
      return structuredClone(remote);
    },
    async create(p) {
      creates++;
      remote = {
        id: 123,
        url: "https://dev.to/test/hello",
        payload: structuredClone(p),
      };
      return structuredClone(remote);
    },
    async update(id, p) {
      updates++;
      assert.equal(id, 123);
      remote.payload = structuredClone(p);
      return structuredClone(remote);
    },
  };
  let entry: Delivery | undefined;
  const save = async (e: Delivery) => {
    entry = structuredClone(e);
  };
  const policy = {
    piece: "hello",
    destination: "dev",
    mode: "full" as const,
    creation: "automatic" as const,
    updates: "automatic" as const,
    overrides: {},
  };
  await syncCopy(adapter, payload, "a", entry, save, policy);
  await syncCopy(adapter, payload, "a", entry, save, policy);
  assert.equal(creates, 1);
  assert.equal(updates, 0);
  await syncCopy(
    adapter,
    { ...payload, body_markdown: "Revised" },
    "b",
    entry,
    save,
    policy,
  );
  assert.equal(updates, 1);
  remote.payload.body_markdown = "Remote edit";
  await syncCopy(
    adapter,
    { ...payload, body_markdown: "Another revision" },
    "c",
    entry,
    save,
    policy,
  );
  assert.equal(entry!.status, "conflict");
  assert.equal(updates, 1);
});
test("uncertain remote creation cannot blindly create twice", async () => {
  let calls = 0;
  const adapter: Destination = {
    id: "test",
    capabilities: { create: true, update: true, read: true },
    async find() {
      return [];
    },
    async read() {
      throw Error("unused");
    },
    async create() {
      calls++;
      throw Error("timeout");
    },
    async update() {
      throw Error("unused");
    },
  };
  let entry: Delivery | undefined;
  const save = async (e: Delivery) => {
    entry = e;
  };
  const policy = {
    piece: "hello",
    destination: "dev",
    mode: "full" as const,
    creation: "automatic" as const,
    updates: "automatic" as const,
    overrides: {},
  };
  await assert.rejects(syncCopy(adapter, payload, "a", entry, save, policy));
  await syncCopy(adapter, payload, "a", entry, save, policy);
  assert.equal(calls, 1);
  assert.equal(entry!.status, "conflict");
});

test("Mermaid, document activation, gallery fallback and runtime adapters render independently", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-adapters-"));
  try {
    const reg = registry(),
      assets = new Assets(path.join(dir, "media"));
    const call = async (block: Block) => {
      const chosen = reg.resolve(
        block,
        "web",
        await readYaml("publishing/renderers.yaml"),
      );
      return chosen.plugin.render({
        block,
        target: "web",
        options: chosen.options,
        owner: dir,
        assets,
      });
    };
    await fs.writeFile(
      path.join(dir, "flow.mmd"),
      "flowchart LR\n  Notes --> Collection --> Book\n",
    );
    const diagram = await call({
      kind: "diagram",
      source: { format: "mermaid", path: "flow.mmd" },
      description: "Notes connect to a collection and a book.",
    });
    assert(diagram.asset?.endsWith(".svg"));
    const docs = await call({
      kind: "document",
      title: "A document",
      summary: "Readable summary",
      source: {
        format: "google-docs-published",
        url: "https://docs.google.com/document/d/e/PUBLIC/pub",
      },
    });
    assert(!docs.html.includes("<iframe"));
    assert.match(docs.html, /Load Google viewer/);
    const gallery = await call({
      kind: "gallery",
      title: "A public album",
      summary: "An album summary",
      source: {
        format: "public-photo-album",
        provider: "icloud-shared-album",
        url: "https://www.icloud.com/sharedalbum/#PUBLIC",
      },
    });
    assert.match(gallery.html, /View album on iCloud Photos/);
    assert(!gallery.html.includes("<img"));
    for (const module of ["growth-js", "growth-wasm"])
      assert.match(
        (
          await call({
            kind: "simulation",
            source: { format: "registered-simulation", module },
            description: "A growth example",
          })
        ).html,
        /Save result/,
      );
    assert.match(
      (
        await call({
          kind: "model-experiment",
          source: {
            format: "text-generation",
            runtime: "webllm",
            locality: "local",
            model: "SmolLM2-135M-Instruct-q0f16-MLC",
          },
          description: "A local generation example",
        })
      ).html,
      /Clear downloaded model/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("theme configuration accepts a second theme and rejects unknown templates", async () => {
  const c = await readYaml("publishing/site.yaml");
  assert.equal(
    siteSchema.parse({ ...c, theme: "plain", layout: "linear" }).theme,
    "plain",
  );
  assert(!siteSchema.safeParse({ ...c, theme: "remote-script" }).success);
});

test("Leanpub publisher targets the selected book and disables reader emails", async () => {
  const { leanpub } = await import("../core/leanpub");
  const calls: any[] = [];
  const provider = leanpub("test-only", async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response('{"success":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  await provider.preview("test-book");
  await provider.publish("test-book", "Corrected edition");
  assert.match(calls[0].url, /test-book\/preview.json/);
  const body = new URLSearchParams(calls[1].init.body);
  assert.equal(body.get("publish[email_readers]"), "false");
  assert.equal(body.get("api_key"), "test-only");
});

test("replacement local model runtime follows the session lifecycle without network", async () => {
  const { webllm } = await import("../runtime/adapters/webllm");
  assert.equal(webllm.locality, "local");
  let disposed = false,
    stopped = false;
  const adapter: import("../runtime/contracts").ModelRuntime = {
    id: "fixture-model",
    version: "1",
    locality: "local",
    formats: ["fixture"],
    async probe() {
      return { supported: true };
    },
    async load() {
      return {
        async run(prompt, onToken) {
          const result = "Recorded fixture: " + prompt;
          onToken(result);
          return result;
        },
        stop() {
          stopped = true;
        },
        async reset() {
          stopped = false;
        },
        async dispose() {
          disposed = true;
        },
      };
    },
    async clear() {},
  };
  const controller = new AbortController();
  const session = await adapter.load({} as any, () => {}, controller.signal);
  let output = "";
  await session.run("example", (s) => (output = s), controller.signal);
  assert.equal(output, "Recorded fixture: example");
  session.stop();
  assert(stopped);
  await session.reset();
  assert(!stopped);
  await session.dispose();
  assert(disposed);
});

test("contextual fragments, article references and heading transformations preserve their targets", async () => {
  const { parser } = await import("../core/model");
  const { readingLinks } = await import("../core/reading-links");
  const lib = await loadLibrary(root),
    p = lib.pieces.get("second")!;
  p.body =
    '## Details\n\n[Details](#details) and :ref{target="first"}.\n\n```text\n## code, not a heading\n```\n';
  p.ast = parser().parse(p.body);
  const c = lib.collections.find((c) => c.id === "guide")!,
    doc = assemble(c, lib, "web");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "notes-refs-"));
  try {
    const rendered = await renderDocument(
      doc,
      lib,
      await readYaml("publishing/renderers.yaml"),
      new Assets(path.join(tmp, "media")),
    );
    const occurrence = rendered.nodes.find((n) => n.pieceId === p.id)!;
    assert.match(
      occurrence.html,
      new RegExp(`href="#${occurrence.id}-details"`),
    );
    assert.match(occurrence.html, /href="#first-use"/);
    const page = readingLinks(occurrence.html, "/collections/guide/", [
      occurrence.id,
    ]);
    assert.match(page, /href="\/collections\/guide\/#first-use"/);
    assert.match(page, new RegExp(`href="#${occurrence.id}-details"`));
    const output = await freezeEdition(c, lib, "references", tmp);
    const files = await fs.readdir(path.join(output, "manuscript"));
    const section = files.find((f) => f.endsWith("-" + occurrence.id + ".md"))!;
    const body = await fs.readFile(
      path.join(output, "manuscript", section),
      "utf8",
    );
    assert.match(body, /```text\n## code, not a heading\n```/);
    assert.match(body, /### Details/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("a timed-out successful update is reconciled without another update", async () => {
  let remote = {
      id: 42,
      url: "https://dev.to/test/example",
      payload: structuredClone(payload),
    },
    updates = 0;
  const changed = { ...payload, body_markdown: "Updated" };
  const adapter: Destination = {
    id: "fixture",
    capabilities: { create: true, update: true, read: true },
    async find() {
      return [remote];
    },
    async read() {
      return structuredClone(remote);
    },
    async create() {
      throw Error("must not create");
    },
    async update(_, p) {
      updates++;
      remote.payload = p;
      throw Error("response timed out");
    },
  };
  let entry: Delivery = {
    sourceRevision: "old",
    payloadHash: payloadHash(payload),
    remote: structuredClone(remote),
    status: "current",
  };
  const save = async (e: Delivery) => {
    entry = e;
  };
  const policy = {
    piece: "hello",
    destination: "dev",
    mode: "full" as const,
    creation: "automatic" as const,
    updates: "automatic" as const,
    overrides: {},
  };
  await assert.rejects(syncCopy(adapter, changed, "new", entry, save, policy));
  await syncCopy(adapter, changed, "new", entry, save, policy);
  assert.equal(updates, 1);
  assert.equal(entry.status, "current");
  assert(!entry.intent);
});

test("fixed edition aliases resolve separately from living collections and drafts", async () => {
  const lib = await loadLibrary(root);
  const edition = {
    schemaVersion: 1 as const,
    id: "first-edition",
    collection: "guide",
    title: "First edition",
    summary: "A frozen edition",
    status: "published" as const,
    publishedAt: "2026-09-15",
    sourceRevision: "1234567",
    manifestHash: "a".repeat(64),
    artifacts: [
      {
        label: "Book",
        url: "https://example.com/book.pdf",
        sha256: "b".repeat(64),
      },
    ],
  };
  const map = compileLinks(
    {
      schemaVersion: 1,
      links: { fixed: { ref: "guide", edition: "first-edition" } },
    },
    lib,
    "https://example.com",
    [edition],
  );
  assert.equal(map.fixed, "https://example.com/books/guide/first-edition/");
  assert.deepEqual(
    compileLinks(
      {
        schemaVersion: 1,
        links: { fixed: { ref: "guide", edition: "first-edition" } },
      },
      lib,
      "https://example.com",
      [{ ...edition, status: "draft" }],
    ),
    {},
  );
});

test('short-link resolver redirects only managed site targets and never falls through to S3',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=(await fs.readFile('infrastructure/shortlinks.js','utf8')).replace("import cf from 'cloudfront';",'');
 const handler=runInNewContext(source+'\nhandler;',{cf:{kvs:()=>({async get(key:string){if(key==='hello')return 'https://www.danilop.net/writing/hello-brave-new-world/';if(key==='bad')return 'https://example.com/';throw Error('missing');}})}});
 const call=(uri:string,method='GET')=>handler({request:{uri,method,querystring:{next:{value:'https://example.com/'}}}});
 assert.equal((await call('/hello/')).headers.location.value,'https://www.danilop.net/writing/hello-brave-new-world/');
 assert.equal((await call('/hello','HEAD')).statusCode,302);
 for(const uri of ['/missing','/bad','/publication/distribution/ledger.json','/../hello'])assert.equal((await call(uri)).statusCode,404);
 assert.equal((await call('/hello','POST')).statusCode,404);
});
