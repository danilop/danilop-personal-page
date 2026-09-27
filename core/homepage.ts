import type { Library } from "./model";
import type { CompiledSite } from "./site-data";
import { readingContext } from "./reading-navigation";
export type HomeEntry = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  minutes?: number;
  context?: string;
  kind: "piece" | "collection";
  draft?: boolean;
};
export function homepageWriting(site: CompiledSite, lib: Library): HomeEntry[] {
  const entries = new Map<string, HomeEntry>();
  for (const a of site.articles)
    entries.set(a.id, {
      ...a,
      kind: "piece",
      draft: site.authoring?.pieces.includes(a.id),
    });
  addCollectionWriting();
  applyAnnouncements();
  return [...entries.values()].sort(
    (a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
      a.id.localeCompare(b.id),
  );

  function applyAnnouncements() {
    for (const announcement of site.home.newIn ?? []) {
      const collection = site.collections.find(
        (c) => c.id === announcement.collection && c.book,
      );
      const entry = entries.get(announcement.piece);
      if (
        entry &&
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
      if (entries.has(p.id)) {
        entries.get(p.id)!.context ??= context;
        continue;
      }
      const draft = site.authoring?.pieces.includes(p.id);
      entries.set(p.id, {
        id: p.id,
        title: p.title,
        summary: p.summary,
        url: `${c.url}read/${n.id}/`,
        publishedAt:
          p.publishedAt ?? (draft ? site.authoring?.date : undefined),
        minutes: Math.max(1, Math.ceil(p.body.split(/\s+/).length / 220)),
        context,
        kind: "piece",
        draft,
      });
    }
  }
}
export function homepageSelection(site: CompiledSite) {
  const writing: HomeEntry[] =
    site.homeWriting ??
    site.articles.map((a) => ({ ...a, kind: "piece" as const }));
  const featured = site.collections.find((c) => c.id === site.home.lead);
  const first = featured?.nodes.find((n) => n.kind === "piece" && !n.planned);
  const book: HomeEntry | undefined =
    featured && first
      ? {
          id: featured.id,
          title: featured.title,
          summary: featured.summary,
          url: `${featured.url}read/${first.id}/`,
          context: featured.book ? "Book" : "Collection",
          kind: "collection",
          draft: site.authoring?.collections.includes(featured.id),
        }
      : undefined;
  const pinned = book ?? writing.find((p) => p.id === site.home.lead);
  const lead = pinned ?? writing[0];
  return {
    lead,
    featured: Boolean(pinned),
    recent: writing
      .filter((p) => p.id !== lead?.id)
      .slice(0, site.home.recentCount),
  };
}
