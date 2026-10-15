import { homepageSelection, type HomeEntry } from "./homepage";
import type { CompiledSite } from "./site-data";

export type WritingPage = {
  base: string;
  url: string;
  page: number;
  pages: number;
  total: number;
  start: number;
  end: number;
  entries: HomeEntry[];
  previous?: string;
  next?: string;
};
const pageUrl = (base: string, page: number) =>
  page === 1 ? base : `${base}page/${page}/`;

export function paginateWriting(
  entries: HomeEntry[],
  base: string,
  initial: number,
  size: number,
): WritingPage[] {
  const count = 1 + Math.ceil(Math.max(0, entries.length - initial) / size);
  return Array.from({ length: count }, (_, index) => {
    const offset = index === 0 ? 0 : initial + (index - 1) * size;
    const items = entries.slice(
      offset,
      offset + (index === 0 ? initial : size),
    );
    const page = index + 1;
    return {
      base,
      url: pageUrl(base, page),
      page,
      pages: count,
      total: entries.length,
      start: items.length ? offset + 1 : 0,
      end: offset + items.length,
      entries: items,
      previous: index ? pageUrl(base, page - 1) : undefined,
      next: page < count ? pageUrl(base, page + 1) : undefined,
    };
  });
}

export function discovery(site: CompiledSite) {
  const home = homepageSelection(site);
  const size = site.home.pageSize ?? 6;
  const filters = [
    { title: "All writing", url: "/writing/", entries: home.writing },
    {
      title: "Independent articles",
      url: "/writing/independent/",
      entries: home.independent,
    },
    ...home.books.map((book) => ({
      title: book.title,
      url: `/writing/books/${book.id}/`,
      entries: home.writing.filter((p) =>
        p.books?.some((b) => b.id === book.id && !b.draft),
      ),
    })),
  ];
  return {
    ...home,
    filters,
    homePages: paginateWriting(
      home.independent.filter((p) => p.id !== home.lead?.id),
      "/",
      site.home.independentCount ?? 3,
      size,
    ),
    writingPages: filters.flatMap((filter) =>
      paginateWriting(filter.entries, filter.url, size, size).map((page) => ({
        ...page,
        title: filter.title,
      })),
    ),
  };
}
