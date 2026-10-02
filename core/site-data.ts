export type ArticleData = {
  id: string;
  title: string;
  summary: string;
  language?: string;
  url: string;
  publishedAt?: string;
  updatedAt?: string;
  tags: string[];
  html: string;
  minutes: number;
  collections: { title: string; url: string }[];
};
export type CollectionData = {
  cover?: { src: string; alt: string; width: number; height: number };
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
    tags?: string[];
    language?: string;
    summary?: string;
    publishedAt?: string;
    updatedAt?: string;
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
  social?: {
    default: import("./social-preview").SocialImage;
    pages: Record<string, import("./social-preview").SocialImage>;
  };
  homeWriting?: import("./homepage").HomeEntry[];
  authoring?: { pieces: string[]; collections: string[]; date: string };
  icons: { svg: string; ico: string; apple: string };
  articles: ArticleData[];
  collections: CollectionData[];
  archive: ArchiveRecord[];
  elsewhere: ArchiveRecord[];
  externalCopies: string[];
  home: {
    lead?: string;
    newIn?: {
      piece: string;
      collection: string;
      kind?: "new-in" | "introducing";
    }[];
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
