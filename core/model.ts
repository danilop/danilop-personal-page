import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import type { Root } from "mdast";

export const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const surface = z.enum(["standalone", "collection", "book"]);
export type Surface = z.infer<typeof surface>;
export type Target = "web" | "book";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      return new Date(v).toISOString().slice(0, 10) === v;
    } catch {
      return false;
    }
  }, "Invalid date");
export const selectionSchema = z
  .object({
    plugin: z.string().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type Selection = z.infer<typeof selectionSchema>;
export type Preferences = Partial<Record<Target, Record<string, Selection>>>;
const preferences = z
  .partialRecord(z.enum(["web", "book"]), z.record(z.string(), selectionSchema))
  .optional();
export const pieceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    title: z.string().min(1),
    summary: z.string().min(1),
    language: z.string().default("en"),
    status: z.enum(["draft", "published", "retired"]),
    publication: z.object({ surfaces: z.array(surface).min(1) }).strict(),
    slug: id.optional(),
    publishedAt: date.optional(),
    updatedAt: date.optional(),
    shortCode: id.optional(),
    tags: z.array(z.string()).default([]),
    adaptedFrom: id.optional(),
    render: preferences,
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.status === "published" &&
      v.publication.surfaces.includes("standalone") &&
      (!v.slug || !v.publishedAt)
    )
      c.addIssue({
        code: "custom",
        message: "Public standalone pieces require slug and publishedAt",
      });
    if (v.updatedAt && v.publishedAt && v.updatedAt < v.publishedAt)
      c.addIssue({ code: "custom", message: "updatedAt precedes publication" });
  });
export type Piece = z.infer<typeof pieceSchema> & {
  body: string;
  ast: Root;
  dir: string;
  blocks: Record<string, Block>;
};
export const kinds = [
  "code",
  "image",
  "table",
  "chart",
  "diagram",
  "math",
  "callout",
  "exercise",
  "audio",
  "video",
  "document",
  "presentation",
  "gallery",
  "simulation",
  "model-experiment",
] as const;
const alternativeSchema = z
  .object({
    mode: z.enum(["summary-link", "static"]),
    text: z.string().min(1),
    url: z.string().url().optional(),
    capturedAt: date.optional(),
    assets: z
      .array(z.object({ path: z.string(), description: z.string() }))
      .optional(),
  })
  .strict();
export const blockSchema = z
  .object({
    kind: z.enum(kinds),
    source: z.record(z.string(), z.unknown()),
    caption: z.string().optional(),
    description: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    role: z.enum(["figure", "table", "listing", "equation"]).optional(),
    render: z
      .partialRecord(z.enum(["web", "book"]), selectionSchema)
      .optional(),
    alternative: alternativeSchema.optional(),
  })
  .strict();
export type Block = z.infer<typeof blockSchema>;
export type Node = {
  id: string;
  kind: "piece" | "part" | "chapter" | "appendix" | "planned" | "generated";
  ref?: string;
  title?: string;
  role?: string;
  surfaces?: Surface[];
  before?: Node[];
  after?: Node[];
  children?: Node[];
  publicOutline?: boolean;
  render?: Preferences;
};
export const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z
    .object({
      id,
      kind: z.enum([
        "piece",
        "part",
        "chapter",
        "appendix",
        "planned",
        "generated",
      ]),
      ref: id.optional(),
      title: z.string().optional(),
      role: z.string().optional(),
      surfaces: z.array(surface).optional(),
      before: z.array(nodeSchema).optional(),
      after: z.array(nodeSchema).optional(),
      children: z.array(nodeSchema).optional(),
      publicOutline: z.boolean().optional(),
      render: preferences,
    })
    .strict()
    .superRefine((v, c) => {
      if (v.kind === "piece" && !v.ref)
        c.addIssue({ code: "custom", message: "Piece placement requires ref" });
      if (v.kind !== "piece" && !v.title && v.kind !== "generated")
        c.addIssue({
          code: "custom",
          message: "Structural node requires title",
        });
      if (v.kind === "planned" && (v.ref || v.children || v.before || v.after))
        c.addIssue({
          code: "custom",
          message: "Planned nodes may contain only a public label",
        });
      if (v.kind !== "piece" && v.ref)
        c.addIssue({
          code: "custom",
          message: "Only placements reference pieces",
        });
    }),
);
export const collectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    title: z.string().min(1),
    summary: z.string().min(1),
    introduction: z.string().optional(),
    status: z.enum(["draft", "published", "retired"]),
    slug: id,
    ordered: z.boolean().default(false),
    book: z.boolean().default(false),
    shortCode: id.optional(),
    subjects: z.array(z.string()).default([]),
    render: preferences,
    frontMatter: z.array(nodeSchema).default([]),
    body: z.array(nodeSchema),
    backMatter: z.array(nodeSchema).default([]),
  })
  .strict();
export type Collection = z.infer<typeof collectionSchema>;
export type Library = { pieces: Map<string, Piece>; collections: Collection[] };
export type AssemblyNode = {
  id: string;
  kind: Node["kind"];
  title: string;
  depth: number;
  number?: string;
  piece?: Piece;
  preferences: Preferences[];
  planned?: boolean;
  role?: string;
};
export type PublicationDocument = {
  id: string;
  title: string;
  target: Target;
  nodes: AssemblyNode[];
};
export const parser = () =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkMath);
export async function readYaml(file: string): Promise<any> {
  const doc = YAML.parseDocument(await fs.readFile(file, "utf8"));
  if (doc.errors.length) throw doc.errors[0];
  return doc.toJS({ maxAliasCount: 0 });
}
export function allowed(piece: Piece, s: Surface) {
  return piece.status === "published" && piece.publication.surfaces.includes(s);
}
export function articleUrl(p: Piece) {
  return `/writing/${p.slug}/`;
}
export function collectionUrl(c: Collection) {
  return `/collections/${c.slug}/`;
}
export async function loadLibrary(root = "content"): Promise<Library> {
  const pieces = new Map<string, Piece>();
  const dirs = await fs.readdir(path.join(root, "pieces"), {
    withFileTypes: true,
  });
  for (const dir of dirs.filter((d) => d.isDirectory())) {
    const folder = path.resolve(root, "pieces", dir.name);
    const raw = await fs.readFile(path.join(folder, "index.md"), "utf8");
    const parsed = matter(raw, {
      engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
    });
    const data = pieceSchema.parse(parsed.data);
    if (pieces.has(data.id)) throw Error(`Duplicate piece ${data.id}`);
    let blocks: Record<string, Block> = {};
    try {
      const b = await readYaml(path.join(folder, "blocks.yaml"));
      blocks = z
        .object({
          schemaVersion: z.literal(1),
          blocks: z.record(id, blockSchema),
        })
        .strict()
        .parse(b).blocks;
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    pieces.set(data.id, {
      ...data,
      body: parsed.content,
      ast: parser().parse(parsed.content),
      dir: folder,
      blocks,
    });
  }
  const collections: Collection[] = [];
  for (const file of await fs.readdir(path.join(root, "collections"))) {
    if (!file.endsWith(".yaml")) continue;
    collections.push(
      collectionSchema.parse(
        await readYaml(path.join(root, "collections", file)),
      ),
    );
  }
  const global = new Set(pieces.keys());
  const slugs = new Set<string>();
  for (const p of pieces.values()) {
    if (p.slug) {
      if (slugs.has(p.slug)) throw Error(`Duplicate article slug ${p.slug}`);
      slugs.add(p.slug);
    }
    if (p.adaptedFrom && !pieces.has(p.adaptedFrom))
      throw Error(`Unknown adaptation ${p.adaptedFrom}`);
  }
  const cslugs = new Set<string>();
  for (const c of collections) {
    if (global.has(c.id) || cslugs.has(c.slug))
      throw Error(`Duplicate collection identity ${c.id}`);
    global.add(c.id);
    cslugs.add(c.slug);
    validateCollection(c, pieces);
  }
  return { pieces, collections };
}
export function validateCollection(c: Collection, pieces: Map<string, Piece>) {
  const ids = new Set<string>();
  function walk(nodes: Node[], ancestors: Set<Node>, depth: number) {
    if (depth > 12) throw Error(`Collection ${c.id} is too deep`);
    for (const n of nodes) {
      if (ancestors.has(n)) throw Error(`Cycle at ${n.id}`);
      if (ids.has(n.id)) throw Error(`Duplicate placement ${n.id}`);
      ids.add(n.id);
      if (n.ref && !pieces.has(n.ref)) throw Error(`Missing piece ${n.ref}`);
      if (
        n.kind === "part" &&
        (n.children ?? []).some((x) => !["chapter", "planned"].includes(x.kind))
      )
        throw Error("Parts group chapters");
      const next = new Set(ancestors).add(n);
      walk(n.before ?? [], next, depth + 1);
      walk(n.children ?? [], next, depth + 1);
      walk(n.after ?? [], next, depth + 1);
    }
  }
  walk([...c.frontMatter, ...c.body, ...c.backMatter], new Set(), 0);
}
export function assemble(
  c: Collection,
  lib: Library,
  target: Target,
  options: { preview?: boolean; excludePlanned?: boolean } = {},
): PublicationDocument {
  const nodes: AssemblyNode[] = [];
  let chapter = 0,
    appendix = 0;
  const s: Surface = target === "book" ? "book" : "collection";
  function walk(
    list: Node[],
    depth: number,
    parentAllowed: boolean,
    prefs: Preferences[],
    sectionPrefix?: string,
  ) {
    let section = 0;
    for (const n of list) {
      const visible = parentAllowed && (!n.surfaces || n.surfaces.includes(s));
      if (!visible) continue;
      const inherited = [...prefs, n.render ?? {}];
      if (n.kind === "planned") {
        if (target === "book" && !options.excludePlanned)
          throw Error(`Unfinished book outline: ${n.title}`);
        if (target === "web" && n.publicOutline)
          nodes.push({
            id: n.id,
            kind: n.kind,
            title: n.title!,
            depth,
            preferences: inherited,
            planned: true,
          });
        continue;
      }
      if (n.kind === "generated") {
        if (target === "book")
          nodes.push({
            id: n.id,
            kind: n.kind,
            title: n.title ?? n.role ?? "Contents",
            depth,
            preferences: inherited,
            role: n.role,
          });
        continue;
      }
      const piece = n.ref ? lib.pieces.get(n.ref) : undefined;
      if (
        piece &&
        !(options.preview
          ? piece.publication.surfaces.includes(s)
          : allowed(piece, s))
      )
        continue;
      let number: string | undefined;
      if (n.kind === "chapter") number = String(++chapter);
      else if (n.kind === "appendix")
        number = String.fromCharCode(65 + appendix++);
      else if (piece && sectionPrefix) number = `${sectionPrefix}.${++section}`;
      if (!piece) {
        const start = nodes.length;
        nodes.push({
          id: n.id,
          kind: n.kind,
          title: n.title!,
          depth,
          number,
          preferences: inherited,
        });
        walk(n.before ?? [], depth + 1, visible, inherited);
        walk(
          n.children ?? [],
          depth + 1,
          visible,
          inherited,
          number ?? sectionPrefix,
        );
        walk(n.after ?? [], depth + 1, visible, inherited);
        if (nodes.length === start + 1) nodes.pop();
      } else {
        walk(n.before ?? [], depth, visible, inherited);
        nodes.push({
          id: n.id,
          kind: "piece",
          title: n.title ?? piece.title,
          depth,
          number,
          piece,
          preferences: [...prefs, piece.render ?? {}, n.render ?? {}],
        });
        walk(n.after ?? [], depth, visible, inherited);
      }
    }
  }
  if (c.status === "published" || options.preview)
    walk([...c.frontMatter, ...c.body, ...c.backMatter], 1, true, [
      c.render ?? {},
    ]);
  return { id: c.id, title: c.title, target, nodes };
}
export function standalone(p: Piece): PublicationDocument {
  return {
    id: p.id,
    title: p.title,
    target: "web",
    nodes: [
      {
        id: p.id,
        kind: "piece",
        title: p.title,
        depth: 0,
        piece: p,
        preferences: [p.render ?? {}],
      },
    ],
  };
}
