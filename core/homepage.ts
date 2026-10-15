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
      const context = `${c.title} · ${parent?.kind === "chapter" ? `Chapter ${parent.number ?? parent.title}` : n.title}`;
      const book = collectionBook(c, site);
      const existing = entries.get(p.id);
      if (existing) {
        addMembership(existing, c, site, context);
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
) {
  if (entry.draft || !site.authoring?.collections.includes(c.id))
    entry.context ??= context;
  const book = collectionBook(c, site);
  if (book) (entry.books ??= []).push(book);
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
  const { published: writing, drafts } = writingGroups(site);
  const featured = site.collections.find(
    (c) =>
      c.id === site.home.lead && !site.authoring?.collections.includes(c.id),
  );
  const first = featured?.nodes.find(
    (n) =>
      n.kind === "piece" &&
      !n.planned &&
      !site.authoring?.pieces.includes(n.pieceId ?? ""),
  );
  const book: HomeEntry | undefined =
    featured && first
      ? {
          id: featured.id,
          title: featured.title,
          summary: featured.summary,
          url: `${featured.url}read/${first.id}/`,
          context: featured.book ? "Book" : "Collection",
          kind: "collection",
          image: featured.cover,
          draft: site.authoring?.collections.includes(featured.id),
        }
      : undefined;
  const pinned = book ?? writing.find((p) => p.id === site.home.lead);
  const lead = pinned ?? writing[0];
  const recentGroups = groupWriting(
    writing.filter((p) => p.id !== lead?.id),
  ).slice(0, site.home.recentCount);
  return {
    lead,
    drafts,
    recentGroups,
    featured: Boolean(pinned),
    recent: recentGroups.map((group) => group.entries[0]),
  };
}
