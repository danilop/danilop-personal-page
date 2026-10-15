import { publicationOrder } from "./publication-time.mjs";
import { load } from "cheerio";
import type { Library } from "./model";
import type { CompiledSite } from "./site-data";
import { readingContext } from "./reading-navigation";
import { readingMinutes } from "./reading-time";
export type HomeEntry = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  minutes?: number;
  narration?: Pick<import("./narration-store").PublicNarration, "duration">;
  context?: string;
  readingLabel?: string;
  books?: { id: string; title: string; url: string; draft: boolean }[];
  kind: "piece" | "collection";
  draft?: boolean;
  image?: { src: string; alt: string; width?: number; height?: number };
};
function articleImage(html: string) {
  const image = load(html)("img[src]").first();
  const src = image.attr("src");
  return src ? { src, alt: image.attr("alt") ?? "" } : undefined;
}
export function homepageWriting(site: CompiledSite, lib: Library): HomeEntry[] {
  const entries = new Map<string, HomeEntry>();
  for (const a of site.articles)
    entries.set(a.id, {
      ...a,
      image: articleImage(a.html),
      kind: "piece",
      draft: site.authoring?.pieces.includes(a.id),
    });
  addCollectionWriting();
  applyAnnouncements();
  return [...entries.values()].sort(publicationOrder);

  function applyAnnouncements() {
    for (const announcement of site.home.newIn ?? []) {
      const collection = site.collections.find(
        (c) => c.id === announcement.collection && c.book,
      );
      const entry = entries.get(announcement.piece);
      if (
        entry &&
        (entry.draft ||
          !site.authoring?.collections.includes(announcement.collection)) &&
        collection?.nodes.some(
          (n) =>
            n.kind === "piece" &&
            n.pieceId === announcement.piece &&
            !n.planned,
        )
      )
        entry.context = `${announcement.kind === "introducing" ? "Introducing" : "New in"} ${collection.title}`;
    }
  }

  function addCollectionWriting() {
    for (const c of site.collections) addCollection(c);
  }
  function addCollection(c: CompiledSite["collections"][number]) {
    for (const n of c.nodes) {
      if (n.kind !== "piece" || n.planned || !n.pieceId) continue;
      const p = lib.pieces.get(n.pieceId);
      if (!p || p.status !== "published") continue;
      const parent = readingContext(c, n.id).parent;
      const readingLabel =
        parent?.kind === "chapter"
          ? `Chapter ${parent.number ?? parent.title}`
          : undefined;
      const context = `${c.title} · ${readingLabel ?? n.title}`;
      const book = collectionBook(c, site);
      const existing = entries.get(p.id);
      if (existing) {
        addMembership(existing, c, site, context, readingLabel);
        continue;
      }
      const draft = Boolean(
        site.authoring?.pieces.includes(p.id) ||
        site.authoring?.collections.includes(c.id),
      );
      entries.set(p.id, {
        id: p.id,
        title: p.title,
        summary: p.summary,
        url: `${c.url}read/${n.id}/`,
        publishedAt:
          p.publishedAt ?? (draft ? site.authoring?.date : undefined),
        minutes: readingMinutes(p.body, n.narration?.duration),
        narration: n.narration,
        context,
        readingLabel,
        books: book ? [book] : [],
        kind: "piece",
        draft,
        image: articleImage(n.html),
      });
    }
  }
}
function collectionBook(
  c: CompiledSite["collections"][number],
  site: CompiledSite,
) {
  return c.book
    ? {
        id: c.id,
        title: c.title,
        url: c.url,
        draft: Boolean(site.authoring?.collections.includes(c.id)),
      }
    : undefined;
}
function addMembership(
  entry: HomeEntry,
  c: CompiledSite["collections"][number],
  site: CompiledSite,
  context: string,
  readingLabel?: string,
) {
  if (entry.draft || !site.authoring?.collections.includes(c.id))
    entry.context ??= context;
  const book = collectionBook(c, site);
  if (book) (entry.books ??= []).push(book);
  if (!book?.draft) entry.readingLabel ??= readingLabel;
}
export function writingGroups(site: CompiledSite) {
  const writing: HomeEntry[] =
    site.homeWriting ??
    site.articles.map((a) => ({
      ...a,
      image: articleImage(a.html),
      kind: "piece" as const,
      draft: site.authoring?.pieces.includes(a.id),
    }));
  return {
    published: writing.filter((entry) => !entry.draft),
    drafts: writing.filter((entry) => entry.draft),
  };
}
export type WritingGroup = {
  book?: NonNullable<HomeEntry["books"]>[number];
  entries: HomeEntry[];
};
export function groupWriting(entries: HomeEntry[]): WritingGroup[] {
  const groups = new Map<string, WritingGroup>();
  for (const entry of entries) {
    // Published articles must not be grouped under a preview-only book.
    const book = entry.books?.find(
      (candidate) => entry.draft || !candidate.draft,
    );
    const key = book ? `book:${book.id}` : `piece:${entry.id}`;
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { book, entries: [entry] });
  }
  return [...groups.values()];
}
export function homepageSelection(site: CompiledSite) {
  const { published, drafts } = writingGroups(site);
  const writing = [...new Map(published.map((p) => [p.id, p])).values()].sort(
    publicationOrder,
  );
  const lead = writing[0];
  const order = [
    ...site.home.collections,
    ...site.collections.map((c) => c.id),
  ];
  const books = [...new Set(order)].flatMap((id) => {
    const book = site.collections.find((c) => c.id === id && c.book);
    const latest = writing.find((p) =>
      p.books?.some((b) => b.id === id && !b.draft),
    );
    return book && latest && !site.authoring?.collections.includes(id)
      ? [{ ...book, latest, featuredAbove: latest.id === lead?.id }]
      : [];
  });
  const independent = writing.filter((p) => !p.books?.some((b) => !b.draft));
  return { lead, books, independent, writing, drafts };
}
