import { test } from "node:test";
import assert from "node:assert/strict";
import { readingContext } from "../core/reading-navigation";
import { assemble, loadLibrary } from "../core/model";
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
