import test from "node:test";
import assert from "node:assert/strict";
import { homepageWriting, homepageSelection } from "../core/homepage";
import type { CompiledSite, CollectionData } from "../core/site-data";
import type { Library, Piece } from "../core/model";
const piece = (id: string, date?: string): Piece => ({
  schemaVersion: 1,
  id,
  title: id,
  summary: id,
  language: "en",
  status: "published",
  publication: { surfaces: ["collection"] },
  tags: [],
  body: "Some text",
  ast: { type: "root", children: [] },
  dir: ".",
  blocks: {},
  publishedAt: date,
});
const group = (id: string): CollectionData => ({
  id,
  title: id,
  summary: id,
  introduction: "",
  url: `/collections/${id}/`,
  ordered: true,
  book: true,
  html: "",
  nodes: [
    {
      id: "chapter",
      title: "A chapter",
      kind: "chapter",
      number: "1",
      depth: 1,
      html: "",
    },
    {
      id: "section",
      title: "Chapter text",
      kind: "piece",
      number: "1.1",
      pieceId: "section",
      depth: 2,
      html: "",
    },
  ],
});
function fixture() {
  const lib: Library = {
    pieces: new Map([
      ["section", piece("section", "2026-09-20")],
      ["undated", piece("undated")],
    ]),
    collections: [],
  };
  const site = {
    articles: [
      {
        id: "welcome",
        title: "Welcome",
        summary: "Welcome",
        url: "/writing/welcome/",
        publishedAt: "2026-09-10",
        tags: [],
        html: "",
        minutes: 1,
        collections: [],
      },
    ],
    collections: [group("book")],
    home: { recentCount: 3, elsewhereCount: 0, collections: [] },
  } as unknown as CompiledSite;
  return { lib, site };
}
test("collection-only articles enter latest writing with context and actual reading URLs", () => {
  const { lib, site } = fixture();
  const items = homepageWriting(site, lib);
  assert.equal(items[0].id, "section");
  assert.equal(items[0].url, "/collections/book/read/section/");
  assert.equal(items[0].context, "book · Chapter 1");
  site.homeWriting = items;
  assert.equal(homepageSelection(site).lead?.id, "section");
});
test("book feature starts reading and keeps its articles in recent writing; draft-hidden feature falls back", () => {
  const { lib, site } = fixture();
  site.home.lead = "book";
  site.homeWriting = homepageWriting(site, lib);
  const view = homepageSelection(site);
  assert.equal(view.lead?.kind, "collection");
  assert.equal(view.lead?.url, "/collections/book/read/section/");
  assert(view.recent.some((p) => p.id === "section"));
  site.collections = [];
  site.homeWriting = homepageWriting(site, lib);
  assert.equal(homepageSelection(site).lead?.id, "welcome");
  assert.equal(homepageSelection(site).featured, false);
});
test("reuse does not duplicate articles and standalone URL takes precedence", () => {
  const { lib, site } = fixture();
  site.collections.push(group("other"));
  assert.equal(
    homepageWriting(site, lib).filter((p) => p.id === "section").length,
    1,
  );
  site.articles.push({
    ...site.articles[0],
    id: "section",
    url: "/writing/section/",
  });
  assert.equal(
    homepageWriting(site, lib).find((p) => p.id === "section")?.url,
    "/writing/section/",
  );
});
test("preview-only draft state supplies provisional dates; undated public pieces sort after dated entries", () => {
  const { lib, site } = fixture();
  lib.pieces.get("section")!.publishedAt = undefined;
  assert.equal(homepageWriting(site, lib)[0].id, "welcome");
  site.authoring = {
    pieces: ["section"],
    collections: ["book"],
    date: "2026-09-20",
  };
  const items = homepageWriting(site, lib);
  assert.equal(items[0].id, "section");
  assert.equal(items[0].draft, true);
  site.homeWriting = items;
  site.home.lead = "section";
  assert.equal(homepageSelection(site).lead?.id, "section");
  assert(!homepageSelection(site).recent.some((p) => p.id === "section"));
});

test("new-in-book is explicit, independent of collection membership and book feature", () => {
  const { lib, site } = fixture();
  assert(
    !homepageWriting(site, lib)
      .find((p) => p.id === "section")!
      .context!.startsWith("New in"),
  );
  site.home.newIn = [{ piece: "section", collection: "book" }];
  assert.equal(
    homepageWriting(site, lib).find((p) => p.id === "section")!.context,
    "New in book",
  );
  site.home.lead = "book";
  assert.equal(homepageSelection(site).lead?.context, "Book");
  site.collections = [];
  assert(
    !homepageWriting(site, lib).some((p) => p.context?.startsWith("New in")),
  );
});

test("introducing is explicitly assigned and does not follow reading order", () => {
  const { lib, site } = fixture();
  site.home.newIn = [
    { piece: "section", collection: "book", kind: "introducing" },
  ];
  assert.equal(
    homepageWriting(site, lib).find((p) => p.id === "section")!.context,
    "Introducing book",
  );
  site.collections[0].nodes.reverse();
  assert.equal(
    homepageWriting(site, lib).find((p) => p.id === "section")!.context,
    "Introducing book",
  );
  site.home.newIn = [];
  assert(
    !homepageWriting(site, lib).some((p) =>
      p.context?.startsWith("Introducing"),
    ),
  );
});

test("featured article artwork follows its first rendered image and clears for imageless articles", () => {
  const { lib, site } = fixture();
  site.articles[0].html =
    '<p><img src="/media/published.png" alt="Published &amp; illustrated"></p><img src="/media/second.png" alt="Second">';
  site.collections[0].nodes[1].html =
    '<img src="/media/chapter.png" alt="Chapter artwork">';
  site.homeWriting = homepageWriting(site, lib);
  assert.deepEqual(homepageSelection(site).lead?.image, {
    src: "/media/chapter.png",
    alt: "Chapter artwork",
  });
  site.collections = [];
  site.homeWriting = homepageWriting(site, lib);
  assert.deepEqual(homepageSelection(site).lead?.image, {
    src: "/media/published.png",
    alt: "Published & illustrated",
  });
  site.homeWriting = undefined;
  assert.deepEqual(homepageSelection(site).lead?.image, {
    src: "/media/published.png",
    alt: "Published & illustrated",
  });
  site.articles[0].html = "<p>No illustration.</p>";
  site.homeWriting = homepageWriting(site, lib);
  assert.equal(homepageSelection(site).lead?.image, undefined);
});

test("featured books use only their assigned cover, independent of first article or reading order", () => {
  const { site } = fixture();
  site.home.lead = "book";
  site.collections[0].nodes[1].html =
    '<img src="/media/chapter.png" alt="Chapter">';
  assert.equal(homepageSelection(site).lead?.image, undefined);
  const cover = {
    src: "/media/book.webp",
    alt: "Book cover",
    width: 100,
    height: 150,
  };
  site.collections[0].cover = cover;
  assert.deepEqual(homepageSelection(site).lead?.image, cover);
  site.collections[0].nodes.reverse();
  assert.deepEqual(homepageSelection(site).lead?.image, cover);
});
