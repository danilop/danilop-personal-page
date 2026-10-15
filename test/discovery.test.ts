import test from "node:test";
import assert from "node:assert/strict";
import { pieceSchema } from "../core/model";
import { discovery, paginateWriting } from "../core/discovery";
import type { CompiledSite, CollectionData } from "../core/site-data";
import type { HomeEntry } from "../core/homepage";
const entry = (
  id: string,
  date = "2026-01-01",
  books: string[] = [],
): HomeEntry => ({
  id,
  title: id,
  summary: id,
  url: `/writing/${id}/`,
  publishedAt: date,
  kind: "piece",
  books: books.map((id) => ({
    id,
    title: id,
    url: `/collections/${id}/`,
    draft: false,
  })),
});
function fixture(latest: "article" | "one" | "two") {
  return {
    home: { collections: ["two", "one"], independentCount: 3, pageSize: 6 },
    collections: ["one", "two", "empty"].map(
      (id) =>
        ({ id, title: id, book: true, nodes: [] }) as unknown as CollectionData,
    ),
    homeWriting: [
      entry(
        latest === "article" ? "newest" : `chapter-${latest}`,
        "2026-10-16",
        latest === "article" ? [] : [latest],
      ),
      ...["one", "two"].map((id) => entry(`old-${id}`, "2026-10-15", [id])),
      ...Array.from({ length: 15 }, (_, i) =>
        entry(`independent-${String(i).padStart(2, "0")}`),
      ),
    ],
  } as unknown as CompiledSite;
}
for (const latest of ["article", "one", "two"] as const)
  test(`discovery when latest is ${latest}`, () => {
    const view = discovery(fixture(latest));
    assert.equal(
      view.lead?.id,
      latest === "article" ? "newest" : `chapter-${latest}`,
    );
    assert.deepEqual(
      view.books.map((b) => b.id),
      ["two", "one"],
    );
    assert.equal(
      view.books.filter((b) => b.featuredAbove).length,
      latest === "article" ? 0 : 1,
    );
    assert.equal(view.homePages[0].entries.length, 3);
    assert.equal(view.homePages[1].entries.length, 6);
    assert(
      !view.homePages
        .flatMap((p) => p.entries)
        .some((p) => p.id === view.lead?.id || p.books?.length),
    );
    assert.equal(view.filters.length, 4);
  });
test("shared identity appears once and both books refer to the same lead; draft books do not classify public pieces", () => {
  const site = fixture("article");
  const shared = entry("shared", "2026-11-01", ["one", "two"]);
  site.homeWriting!.push(shared, shared, {
    ...entry("future", "2030-01-01"),
    draft: true,
  });
  let view = discovery(site);
  assert(view.books.every((b) => b.featuredAbove));
  assert.equal(view.writing.filter((p) => p.id === "shared").length, 1);
  site.authoring = {
    pieces: [],
    collections: ["one", "two"],
    date: "2030-01-01",
  };
  for (const p of site.homeWriting!)
    for (const b of p.books ?? []) b.draft = true;
  view = discovery(site);
  assert.equal(view.books.length, 0);
  assert(view.independent.some((p) => p.id === "shared"));
  assert.equal(view.drafts.length, 1);
});
test("stable date ties, publication batches and zero/one articles", () => {
  const site = fixture("article");
  site.homeWriting = [
    entry("z"),
    entry("a"),
    ...Array.from({ length: 30 }, (_, i) =>
      entry(`batch-${i}`, "2026-10-16", ["one"]),
    ),
  ];
  assert.equal(discovery(site).lead?.id, "batch-0");
  assert.deepEqual(
    discovery(site).independent.map((p) => p.id),
    ["a", "z"],
  );
  site.homeWriting = [];
  assert.equal(discovery(site).lead, undefined);
  assert.equal(discovery(site).homePages.length, 1);
  site.homeWriting = [entry("only")];
  assert.equal(discovery(site).homePages[0].entries.length, 0);
});
test("pagination has addressable exact boundaries, no empty terminal page and no hidden full catalogue", () => {
  for (const count of [0, 1, 3, 4, 9, 10, 15, 16]) {
    const entries = Array.from({ length: count }, (_, i) => entry(String(i)));
    const pages = paginateWriting(entries, "/writing/independent/", 3, 6);
    assert.deepEqual(
      pages.flatMap((p) => p.entries),
      entries,
    );
    assert.equal(pages.at(-1)!.next, undefined);
    assert(pages.every((p, i) => p.entries.length <= (i ? 6 : 3)));
    for (const [i, p] of pages.entries()) {
      assert.equal(p.previous, pages[i - 1]?.url);
      assert.equal(p.next, pages[i + 1]?.url);
    }
  }
});

test("writing-navigation slugs cannot collide with article routes", () => {
  const base = {
    schemaVersion: 1,
    id: "example",
    title: "Example",
    summary: "Summary",
    draft: true,
    publication: { surfaces: ["standalone"] },
  };
  for (const slug of ["independent", "page", "books"])
    assert.equal(pieceSchema.safeParse({ ...base, slug }).success, false);
  assert.equal(
    pieceSchema.safeParse({ ...base, slug: "ordinary-article" }).success,
    true,
  );
});
