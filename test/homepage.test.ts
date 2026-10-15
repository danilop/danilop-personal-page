import test from "node:test";
import assert from "node:assert/strict";
import { readingMinutes } from "../core/reading-time";
import {
  homepageWriting,
  homepageSelection,
  writingGroups,
} from "../core/homepage";
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
test("an editorial lead never replaces the latest piece; book overview points to the lead", () => {
  const { lib, site } = fixture();
  site.home.lead = "welcome";
  site.homeWriting = homepageWriting(site, lib);
  const view = homepageSelection(site);
  assert.equal(view.lead?.id, "section");
  assert.equal(view.books[0].latest.id, "section");
  assert.equal(view.books[0].featuredAbove, true);
});
test("reuse does not duplicate articles and standalone URL takes precedence", () => {
  const { lib, site } = fixture();
  site.collections.push(group("other"));
  site.collections[0].nodes.push({
    ...site.collections[0].nodes[1],
    id: "reused-section",
  });
  assert.deepEqual(
    homepageWriting(site, lib)
      .find((p) => p.id === "section")
      ?.books?.map((book) => book.id),
    ["book", "other"],
  );
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
  assert.equal(homepageSelection(site).lead?.id, "welcome");
  assert(!homepageSelection(site).independent.some((p) => p.id === "section"));
  assert.deepEqual(
    writingGroups(site).drafts.map((p) => p.id),
    ["section"],
  );
  site.home.lead = "book";
  assert.equal(homepageSelection(site).lead?.id, "welcome");
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
  site.homeWriting = homepageWriting(site, lib);
  assert.equal(homepageSelection(site).lead?.context, "New in book");
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

test("reading minutes use full 1x audio, round up and fall back without valid audio", () => {
  const body = Array(441).fill("word").join(" ");
  assert.equal(readingMinutes(body, 660), 11);
  assert.equal(readingMinutes(body, 660.01), 12);
  assert.equal(readingMinutes(body, 0.5), 1);
  for (const missing of [undefined, 0, -1, NaN, Infinity])
    assert.equal(readingMinutes(body, missing), 3);
  assert.equal(readingMinutes(""), 1);
});

test("collection writing uses its placement audio for reading minutes", () => {
  const { lib, site } = fixture();
  site.collections[0].nodes[1].narration = {
    duration: 660,
  } as NonNullable<CollectionData["nodes"][number]["narration"]>;
  assert.equal(
    homepageWriting(site, lib).find((entry) => entry.id === "section")?.minutes,
    11,
  );
});

test("draft-only previews have no published lead; draft metadata also works without a compiled writing index", () => {
  const { site } = fixture();
  site.authoring = {
    pieces: ["welcome"],
    collections: ["book"],
    date: "2030-01-01",
  };
  site.home.lead = "book";
  const result = homepageSelection(site);
  assert.equal(result.lead, undefined);
  assert.deepEqual(result.independent, []);
  assert.equal(result.drafts[0].id, "welcome");
});

test("writing identifies book membership without duplicating shared or standalone articles", () => {
  const { site, lib } = fixture();
  site.collections.push(group("other-book"));
  site.articles.push({ ...site.articles[0], id: "section" });
  const result = homepageWriting(site, lib);
  assert.equal(result.filter((entry) => entry.id === "section").length, 1);
  assert.deepEqual(
    result
      .find((entry) => entry.id === "section")
      ?.books?.map((book) => book.id),
    ["book", "other-book"],
  );
  assert.equal(
    result.find((entry) => entry.id === "welcome")?.books,
    undefined,
  );
});

test("public articles reused in draft books stay independent and preview book-only pieces remain drafts", () => {
  const { site, lib } = fixture();
  site.authoring = { pieces: [], collections: ["book"], date: "2030-01-01" };
  site.homeWriting = homepageWriting(site, lib);
  assert.deepEqual(
    writingGroups(site).drafts.map((p) => p.id),
    ["section"],
  );
  site.articles.push({ ...site.articles[0], id: "section" });
  site.homeWriting = homepageWriting(site, lib);
  const result = homepageSelection(site);
  assert.equal(result.drafts.length, 0);
  assert.equal(result.books.length, 0);
  assert.equal(result.independent.length, 2);
});
