import { load } from "cheerio";
import type { CompiledSite } from "./site-data";

export type AuthorRoute = { url: string; file: string; context?: string };
export function injectPreviewMode(
  html: string,
  state: {
    token: string;
    version: number;
    includeDrafts: boolean;
    building: boolean;
  },
) {
  const $ = load(html);
  const notice = $(".authoring-notice");
  notice
    .children("p")
    .first()
    .text(
      state.includeDrafts
        ? "Drafts are included in this local preview. Nothing has been published."
        : "Published content only. Local edits are shown; nothing has been deployed.",
    );
  const select = $('<select id="preview-content">').append(
    $('<option value="drafts">').text("Show drafts"),
    $('<option value="published">').text("Published only"),
  );
  select
    .find(`[value="${state.includeDrafts ? "drafts" : "published"}"]`)
    .attr("selected", "selected");
  if (state.building) select.attr("disabled", "disabled");
  notice.append($("<label>").text("Preview content ").append(select));
  notice.append(
    $('<p id="preview-mode-status" role="status">').text(
      state.building ? "Updating preview…" : "",
    ),
  );
  $("body").append(
    $("<script>").attr({
      src: "/_author/preview.js",
      "data-token": state.token,
      "data-version": String(state.version),
      "data-drafts": String(state.includeDrafts),
    }),
  );
  return $.html();
}

export function authorRoutes(
  site: Pick<CompiledSite, "articles" | "collections">,
  catalog: { file: string; id?: string }[],
): AuthorRoute[] {
  const routes: AuthorRoute[] = [];
  const piece = (id: string) =>
    catalog.find((c) => c.id === id && c.file.startsWith("content/pieces/"))
      ?.file;
  for (const article of site.articles) {
    const file = piece(article.id);
    if (file) routes.push({ url: article.url, file });
  }
  addCollectionRoutes();
  if (catalog.some((c) => c.file === "publishing/home.yaml"))
    routes.push({ url: "/", file: "publishing/home.yaml" });
  return routes;

  function addCollectionRoutes() {
    for (const collection of site.collections) {
      const file = catalog.find(
        (c) =>
          c.id === collection.id && c.file.startsWith("content/collections/"),
      )?.file;
      if (file) routes.push({ url: collection.url, file });
      for (const node of collection.nodes) {
        const source =
          node.kind === "piece" && !node.planned && node.pieceId
            ? piece(node.pieceId)
            : undefined;
        if (source)
          routes.push({
            url: `${collection.url}read/${node.id}/`,
            file: source,
            context: collection.id,
          });
      }
    }
  }
}

// Called only by the local author server, never by the static site build.
export function injectAuthorEdit(html: string, route?: AuthorRoute) {
  if (!route) return html;
  const $ = load(html);
  const heading = $("main .article-heading, main .page-heading").first();
  if (!heading.length) return html;
  const href =
    "/_author/?" + new URLSearchParams({ file: route.file, from: route.url });
  const link = $("<a>")
    .attr({ href, class: "author-edit", "aria-label": "Edit this content" })
    .text("Edit");
  const meta = heading.find(".meta").last();
  if (meta.length) meta.append(" · ", link);
  else heading.append($("<p>").addClass("meta").append(link));
  $("head").append(
    "<style>.author-edit{font:inherit;color:inherit;text-underline-offset:.2em}.author-edit:hover{color:var(--color-accent, #28564b)}.author-edit:focus-visible{outline:2px solid currentColor;outline-offset:4px}</style>",
  );
  $(".authoring-notice small").text(
    "Saved changes refresh this site automatically. Missing dates are provisional.",
  );
  return $.html();
}
