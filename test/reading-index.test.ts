import test from "node:test";
import assert from "node:assert/strict";
import { readingIndex, searchContext } from "../core/reading-index";
import type { CompiledSite } from "../core/site-data";

const article = {
  id: "shared",
  title: "Shared piece",
  summary: "In an article and a book.",
  url: "/writing/shared/",
  publishedAt: "2026-10-01T00:00:00.000Z",
  tags: ["ai"],
  html: '<p>Intro</p><h2 id="shared-one">One <em>idea</em></h2><p>x</p><h3 id="shared-two">Two</h3><h4 id="deep">Too deep</h4><h2>No id</h2>',
  minutes: 3,
  collections: [{ title: "Book", url: "/collections/book/" }],
} as CompiledSite["articles"][number];

const collection = {
  id: "book",
  title: "Book",
  summary: "A book.",
  url: "/collections/book/",
  book: true,
  ordered: true,
  nodes: [
    {
      id: "ch1",
      title: "Chapter",
      kind: "chapter",
      number: "1",
      depth: 1,
      html: "",
    },
    {
      id: "shared",
      title: "Shared piece",
      kind: "piece",
      pieceId: "shared",
      depth: 2,
      html: '<h2 id="book-shared-one">One</h2>',
    },
    {
      id: "later",
      title: "Later",
      kind: "piece",
      depth: 2,
      planned: true,
      html: "",
    },
  ],
} as unknown as CompiledSite["collections"][number];

test("reading index lists pieces, linkable sections, book order and placements without body text", () => {
  const index = readingIndex({
    articles: [article],
    collections: [collection],
  });
  assert.equal(index.version, 1);
  assert.deepEqual(index.pieces, [
    {
      id: "shared",
      title: "Shared piece",
      summary: "In an article and a book.",
      url: "/writing/shared/",
      publishedAt: "2026-10-01T00:00:00.000Z",
      tags: ["ai"],
      sections: [
        { id: "shared-one", title: "One idea" },
        { id: "shared-two", title: "Two" },
      ],
      placements: [
        { collection: "book", url: "/collections/book/read/shared/" },
      ],
    },
  ]);
  const [book] = index.collections;
  assert.deepEqual(
    book.contents.map((n) => [n.id, n.url, n.number, n.sections.length]),
    [
      ["ch1", "/collections/book/chapters/ch1/", "1", 0],
      ["shared", "/collections/book/read/shared/", undefined, 1],
      ["later", undefined, undefined, 0],
    ],
  );
  assert.doesNotMatch(JSON.stringify(index), /Intro|<p>/);
});

test("search context names other placements of a piece", () => {
  assert.equal(searchContext("Article"), "Article");
  assert.equal(
    searchContext("Article", [{ title: "Book" }, { title: "Notes" }]),
    "Article · also in Book, Notes",
  );
});
