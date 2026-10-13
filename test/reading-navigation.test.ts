import { test } from "node:test";
import assert from "node:assert/strict";
import { bookProgress, readingContext } from "../core/reading-navigation";
import { assemble, collectionSchema, loadLibrary } from "../core/model";
import type { CollectionData } from "../core/site-data";
async function fixture(): Promise<CollectionData> {
  const lib = await loadLibrary("test/fixtures/manuscript");
  const c = lib.collections.find((c) => c.id === "guide")!;
  const doc = assemble(c, lib, "web");
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    url: "/collections/guide/",
    ordered: true,
    book: true,
    introduction: "",
    html: "",
    nodes: doc.nodes.map((n) => ({ ...n, html: "" })),
  } satisfies CollectionData;
}
test("collection reading crosses chapter boundaries and excludes book-only/draft placements", async () => {
  const c = await fixture();
  const first = readingContext(c, "first-use");
  assert.equal(first.parent?.id, "chapter-one");
  assert.equal(first.previous?.id, "chapter-opening");
  assert.equal(first.next?.id, "second-use");
  assert.equal(first.position, 2);
  assert.equal(first.total, 4);
  const last = readingContext(c, "appendix-use");
  assert.equal(last.next, undefined);
  assert.equal(last.finished, true);
});
test("chapter exits skip its descendants, and nested groups retain the closest parent", async () => {
  const c = await fixture();
  c.nodes.unshift({
    id: "part-one",
    kind: "part",
    depth: 0,
    title: "Part one",
    html: "",
  });
  const chapter = readingContext(c, "chapter-one");
  assert.equal(chapter.parent?.id, "part-one");
  assert.deepEqual(
    chapter.children.map((n) => n.id),
    ["chapter-opening", "first-use"],
  );
  assert.equal(chapter.previous, undefined);
  assert.equal(chapter.next?.id, "second-use");
  assert.equal(readingContext(c, "appendix-a").finished, true);
});
test("unordered collections expose contents without implying a required reading sequence", async () => {
  const c = await fixture();
  c.ordered = false;
  const context = readingContext(c, "first-use");
  assert.equal(context.previous, undefined);
  assert.equal(context.next, undefined);
  assert.equal(context.finished, false);
  assert.throws(
    () => readingContext(c, "missing"),
    /Unknown reading placement/,
  );
});

test("book completion is explicit, book-only and independent of publication", async () => {
  const lib = await loadLibrary("test/fixtures/manuscript");
  const base = lib.collections.find((c) => c.id === "guide")!;
  for (const status of ["draft", "published", "retired"] as const)
    for (const completion of ["in-progress", "complete"] as const) {
      const parsed = collectionSchema.parse({ ...base, status, completion });
      assert.equal(parsed.completion, completion);
      assert.equal(parsed.status, status);
    }
  assert.equal(collectionSchema.parse(base).completion, undefined);
  assert.throws(() =>
    collectionSchema.parse({ ...base, completion: "unfinished" }),
  );
  assert.throws(
    () =>
      collectionSchema.parse({ ...base, book: false, completion: "complete" }),
    /Completion applies only to book/,
  );
  assert.equal(bookProgress({ book: false }), undefined);
  assert.equal(bookProgress({ book: true })?.contents, undefined);
  assert.match(bookProgress({ book: true })!.message, /last available part/);
  assert.equal(
    bookProgress({ book: true, completion: "in-progress" })?.contents,
    "More to come",
  );
  assert.equal(
    bookProgress({ book: true, completion: "complete" })?.title,
    "End of the book",
  );
});

test("continuation moves to new visible reading material, including another piece in the same chapter", async () => {
  const c = await fixture();
  c.completion = "in-progress";
  const ending = bookProgress(c);
  assert.equal(readingContext(c, "first-use").finished, false);
  assert.equal(readingContext(c, "appendix-use").finished, true);
  c.nodes.push({
    id: "future",
    kind: "planned",
    planned: true,
    depth: 2,
    title: "Future",
    html: "",
  });
  assert.equal(readingContext(c, "appendix-use").finished, true);
  c.nodes.splice(c.nodes.length - 1, 0, {
    id: "continuation",
    kind: "piece",
    depth: 2,
    title: "A continuation",
    html: "More prose",
  });
  assert.equal(readingContext(c, "appendix-use").finished, false);
  assert.equal(readingContext(c, "continuation").finished, true);
  assert.equal(readingContext(c, "appendix-a").finished, true);
  assert.deepEqual(bookProgress(c), ending);
  c.nodes = [
    {
      id: "future",
      kind: "planned",
      planned: true,
      depth: 1,
      title: "Future",
      html: "",
    },
  ];
  assert.equal(readingContext(c, "future").finished, false);
});

test("article and chapter pages rebase authored headings without changing anchors, code or footnotes", async () => {
  const { renderDocument } = await import("../core/render");
  const { readingHeadings } = await import("../core/reading-links");
  const { parser, readYaml } = await import("../core/model");
  const lib = await loadLibrary("test/fixtures/manuscript");
  const c = lib.collections.find((c) => c.id === "guide")!;
  const doc = assemble(c, lib, "web");
  const node = doc.nodes.find((n) => n.piece)!;
  node.depth = 3;
  node.piece = {
    ...node.piece!,
    body: "## Section\n\nText.[^a]\n\n### Detail\n\nMore text.\n\n```html\n<h5>Example</h5>\n```\n\n[^a]: Evidence.\n",
  };
  node.piece.ast = parser().parse(node.piece.body);
  doc.nodes = [node];
  const rendered = await renderDocument(
    doc,
    lib,
    await readYaml("publishing/renderers.yaml"),
  );
  const { load } = await import("cheerio");
  const continuous = load(rendered.nodes[0].html);
  const article = load(readingHeadings(rendered.nodes[0].html));
  const chapter = load(readingHeadings(rendered.nodes[0].html, 1));
  assert.equal(continuous("[data-source-heading='2']")[0].tagName, "h5");
  assert.equal(continuous("[data-source-heading='3']")[0].tagName, "h6");
  assert.equal(article("[data-source-heading='2']")[0].tagName, "h2");
  assert.equal(article("[data-source-heading='3']")[0].tagName, "h3");
  assert.equal(chapter("[data-source-heading='2']")[0].tagName, "h3");
  assert.equal(chapter("[data-source-heading='3']")[0].tagName, "h4");
  assert.deepEqual(
    article("[id]")
      .map((_, e) => e.attribs.id)
      .get(),
    continuous("[id]")
      .map((_, e) => e.attribs.id)
      .get(),
  );
  assert.equal(article("pre").html(), continuous("pre").html());
  assert.equal(
    article(".footnotes ol").html(),
    continuous(".footnotes ol").html(),
  );
  assert.equal(article(".footnotes [data-source-heading]")[0].tagName, "h2");
  assert.equal(continuous(".footnotes [data-source-heading]")[0].tagName, "h5");
  assert.throws(() => readingHeadings(rendered.nodes[0].html, 5), /depth/);
});
