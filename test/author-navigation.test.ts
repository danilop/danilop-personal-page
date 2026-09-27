import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { authorRoutes, injectAuthorEdit } from "../core/author-navigation";
import type { CompiledSite } from "../core/site-data";

test("author navigation maps rendered URLs to source files, including collection-only drafts", () => {
  const routes = authorRoutes(
    {
      articles: [{ id: "published", url: "/writing/public-slug/" }],
      collections: [
        {
          id: "book",
          url: "/collections/book-slug/",
          nodes: [
            { id: "placement", kind: "piece", pieceId: "draft" },
            { id: "later", kind: "piece", pieceId: "planned", planned: true },
          ],
        },
      ],
    } as Pick<CompiledSite, "articles" | "collections">,
    [
      { id: "published", file: "content/pieces/folder/index.md" },
      { id: "draft", file: "content/pieces/draft-folder/index.md" },
      { id: "book", file: "content/collections/different-name.yaml" },
      { id: "planned", file: "content/pieces/planned/index.md" },
    ],
  );
  assert.deepEqual(routes, [
    { url: "/writing/public-slug/", file: "content/pieces/folder/index.md" },
    {
      url: "/collections/book-slug/",
      file: "content/collections/different-name.yaml",
    },
    {
      url: "/collections/book-slug/read/placement/",
      file: "content/pieces/draft-folder/index.md",
      context: "book",
    },
  ]);
});
test("local Edit links are identical for draft and published pages and preserve the page context", () => {
  const route = {
    url: "/collections/book/read/intro/",
    file: "content/pieces/introduction/index.md",
  };
  for (const badge of ["", '<span class="draft-badge">Draft</span>']) {
    const html = `<html><head></head><body><main><header class="article-heading"><h1>Title ${badge}</h1><p class="meta">5 min read</p></header></main></body></html>`;
    const $ = load(injectAuthorEdit(html, route));
    assert.equal($(".meta .author-edit").text(), "Edit");
    assert.equal($(".draft-badge a").length, 0);
    const url = new URL(
      $(".author-edit").attr("href")!,
      "http://127.0.0.1:4324",
    );
    assert.equal(url.searchParams.get("file"), route.file);
    assert.equal(url.searchParams.get("from"), route.url);
    assert.equal(injectAuthorEdit(html), html);
  }
});
test("book overview receives one quiet Edit link without requiring existing metadata", () => {
  const $ = load(
    injectAuthorEdit(
      '<main><header class="page-heading"><h1>Book</h1></header></main>',
      { url: "/collections/book/", file: "content/collections/book.yaml" },
    ),
  );
  assert.equal($(".page-heading .meta .author-edit").text(), "Edit");
});
