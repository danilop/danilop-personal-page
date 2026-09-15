export type ArticleData = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  html: string;
  minutes: number;
  collections: { title: string; url: string }[];
};
export type CollectionData = {
  id: string;
  title: string;
  summary: string;
  introduction: string;
  url: string;
  ordered: boolean;
  book: boolean;
  html: string;
  nodes: {
    id: string;
    title: string;
    kind: string;
    number?: string;
    planned?: boolean;
    html: string;
    pieceId?: string;
    depth: number;
  }[];
};
export type ArchiveRecord = {
  title: string;
  description: string | null;
  subtitle: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  publisher: string;
  kind: string;
};
export type CompiledSite = {
  articles: ArticleData[];
  collections: CollectionData[];
  archive: ArchiveRecord[];
  elsewhere: ArchiveRecord[];
  externalCopies: string[];
  home: {
    lead?: string;
    recentCount: number;
    elsewhereCount: number;
    collections: string[];
  };
  about: string;
  revision: string;
  isPreview: boolean;
  buildTime: string;
  shortlinks: Record<string, string>;
};
