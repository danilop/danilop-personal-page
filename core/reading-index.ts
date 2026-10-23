import { load } from "cheerio";
import type { CompiledSite } from "./site-data";

type ReadingSection = { id: string; title: string };
type ReadingPiece = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  tags: string[];
  sections: ReadingSection[];
  /** Book placements of the same piece; the article URL stays canonical. */
  placements: { collection: string; url: string }[];
};
type ReadingCollection = {
  id: string;
  title: string;
  summary: string;
  url: string;
  book: boolean;
  ordered: boolean;
  contents: {
    id: string;
    title: string;
    kind: string;
    number?: string;
    depth: number;
    url?: string;
    pieceId?: string;
    sections: ReadingSection[];
  }[];
};
export type ReadingIndex = {
  version: 1;
  pieces: ReadingPiece[];
  collections: ReadingCollection[];
};

/** Headings that readers can link to, in document order. */
function readingSections(html: string): ReadingSection[] {
  const $ = load(html);
  return $("h2[id], h3[id]")
    .toArray()
    .map((el) => ({ id: $(el).attr("id")!, title: $(el).text().trim() }));
}

/** Book pieces get their own reading page unless planned. */
const nodeUrl = (
  collectionUrl: string,
  node: { id: string; kind: string; planned?: boolean },
) =>
  node.planned
    ? undefined
    : node.kind === "piece"
      ? `${collectionUrl}read/${node.id}/`
      : `${collectionUrl}chapters/${node.id}/`;

/**
 * The public reading index for agents and the assistant: what exists, where
 * it lives and how it is structured, without body text.
 */
export function readingIndex(
  site: Pick<CompiledSite, "articles" | "collections">,
): ReadingIndex {
  const collections = site.collections.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    url: c.url,
    book: c.book,
    ordered: c.ordered,
    contents: c.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      kind: n.kind,
      ...(n.number ? { number: n.number } : {}),
      depth: n.depth,
      ...(nodeUrl(c.url, n) ? { url: nodeUrl(c.url, n) } : {}),
      ...(n.pieceId ? { pieceId: n.pieceId } : {}),
      sections: n.kind === "piece" ? readingSections(n.html) : [],
    })),
  }));
  const pieces = site.articles.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    url: a.url,
    ...(a.publishedAt ? { publishedAt: a.publishedAt } : {}),
    tags: a.tags,
    sections: readingSections(a.html),
    placements: collections.flatMap((c) =>
      c.contents
        .filter((n) => n.pieceId === a.id && n.url)
        .map((n) => ({ collection: c.id, url: n.url! })),
    ),
  }));
  return { version: 1, pieces, collections };
}

/** The line shown under a search result's title. */
export const searchContext = (
  label: string,
  alsoIn: { title: string }[] = [],
) =>
  alsoIn.length
    ? `${label} · also in ${alsoIn.map((c) => c.title).join(", ")}`
    : label;
