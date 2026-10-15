import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { digestAsset, readAssetManifest } from "./asset-manifest";
import { allowed, assemble, parser, type Library, type Piece } from "./model";

export const voices = {
  bm_george: "George",
  bf_emma: "Emma",
  bf_alice: "Alice",
  bf_isabella: "Isabella",
  bf_lily: "Lily",
  bm_daniel: "Daniel",
  bm_fable: "Fable",
  bm_lewis: "Lewis",
} as const;
const voiceSchema = z.enum(
  Object.keys(voices) as [keyof typeof voices, ...(keyof typeof voices)[]],
);
const approvalSchema = z
  .object({
    treatment: z.enum([
      "decorative",
      "skip",
      "caption",
      "explanation",
      "literal",
    ]),
    sourceHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    text: z.string().max(12000).default(""),
    reason: z.string().max(2000).default(""),
  })
  .strict();
export const settingsSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    voice: voiceSchema.default("bm_george"),
    pace: z.number().min(0.8).max(1.2).default(1),
    profile: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default("kokoro-mlx-bf16-v1"),
    pronunciations: z
      .record(z.string().min(1).max(120), z.string().min(1).max(200))
      .default({}),
    adaptations: z.record(z.string().max(160), approvalSchema).default({}),
  })
  .strict();
export type NarrationSettings = z.infer<typeof settingsSchema>;
export type SpeechSegment = {
  kind: "title" | "heading" | "paragraph" | "adaptation";
  text: string;
  pause: number;
};
type SpeechIssue = {
  id: string;
  kind: string;
  source: string;
  caption: string;
  sourceHash: string;
  resolved: boolean;
};
export type SpeechDocument = {
  key: string;
  pieceId: string;
  title: string;
  settings: NarrationSettings;
  segments: SpeechSegment[];
  issues: SpeechIssue[];
  speechHash: string;
  reviewHash: string;
  firstParagraph?: string;
  audioMetadata?: { title: string; author: string; cover?: string };
};
type SpeechNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  name?: string;
  identifier?: string;
  attributes?: Record<string, string>;
  children?: SpeechNode[];
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "position")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const speechDigest = (value: unknown) =>
  digestAsset(JSON.stringify(canonical(value)));
const normal = (text: string) =>
  text.normalize("NFC").replace(/\s+/g, " ").trim();
const renditionKey = (piece: Piece, title = piece.title) =>
  `${piece.id}:${speechDigest(title).slice(0, 16)}`;
export async function readNarrationSettings(piece: Piece) {
  try {
    return settingsSchema.parse(
      YAML.parse(
        await fs.readFile(path.join(piece.dir, "narration.yaml"), "utf8"),
        { maxAliasCount: 0 },
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return settingsSchema.parse({});
    throw error;
  }
}
export function narrationUnits(lib: Library) {
  const units = new Map<string, { piece: Piece; title: string }>();
  const add = (piece: Piece, title: string) =>
    units.set(renditionKey(piece, title), { piece, title });
  for (const p of lib.pieces.values())
    if (allowed(p, "standalone")) add(p, p.title);
  for (const c of lib.collections.filter((c) => c.status === "published"))
    for (const n of assemble(c, lib, "web").nodes)
      if (n.piece) add(n.piece, n.title);
  return units;
}
/** Extract from the semantic source, never rendered HTML. Unknown material fails closed. */
export async function speechDocument(
  root: string,
  piece: Piece,
  lib: Library,
  supplied?: NarrationSettings,
  title = piece.title,
): Promise<SpeechDocument> {
  const settings = supplied ?? (await readNarrationSettings(piece));
  if (!/^en(?:-GB|-US)?$/i.test(piece.language))
    throw Error(`Narration currently supports English: ${piece.id}`);
  const segments: SpeechSegment[] = [],
    issues: SpeechIssue[] = [];
  const seen = new Set<string>();
  const tree = parser().parse(piece.body) as unknown as SpeechNode;
  const manifest = await readAssetManifest(root);
  const context = speechDigest({
    title: piece.title,
    body: piece.body.replace(/!\[[^\]]*\]\([^)]*\)/g, ""),
  });
  const replacements = Object.entries(settings.pronunciations).sort(
    ([a], [b]) => b.length - a.length,
  );
  function pronounce(text: string) {
    for (const [word, spoken] of replacements)
      text = text.replace(
        new RegExp(
          `(?<![\\p{L}\\p{N}_])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`,
          "gu",
        ),
        () => spoken,
      );
    return normal(text);
  }
  function add(kind: SpeechSegment["kind"], text: string) {
    text = pronounce(text);
    if (text)
      segments.push({
        kind,
        text,
        pause: kind === "heading" || kind === "title" ? 0.55 : 0.28,
      });
  }
  async function dependencies(value: unknown): Promise<unknown> {
    if (typeof value === "string" && value.startsWith("assets/")) {
      return sourceDependency(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(dependencies));
    if (value && typeof value === "object")
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([k, v]) => [
            k,
            await dependencies(v),
          ]),
        ),
      );
    return value;
  }
  async function sourceDependency(value: string) {
    const full = path.resolve(piece.dir, value);
    if (!full.startsWith(path.resolve(piece.dir) + path.sep))
      throw Error("Narration dependency escapes article");
    const logical = path.relative(root, full);
    const record = manifest?.sources[logical];
    // The byte inventory is authoritative in clean CI; working files are hashed when present.
    const real = await fs.realpath(full).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return undefined;
    });
    if (real && !real.startsWith(path.resolve(piece.dir) + path.sep))
      throw Error("Symbolic-link narration dependency escapes article");
    const bytes = real ? await fs.readFile(real) : undefined;
    if (!bytes && !record) throw Error(`Missing narration source: ${logical}`);
    return {
      path: value,
      sha256: bytes ? digestAsset(bytes) : record!.sha256,
    };
  }
  async function adaptation(
    n: SpeechNode,
    explicitId?: string,
    kind = n.type,
    caption = "",
    source: unknown = canonical(n),
    anchor?: string,
  ) {
    const id =
      explicitId ??
      `${kind}-${speechDigest(anchor ?? canonical(n)).slice(0, 24)}`;
    if (seen.has(id))
      throw Error(
        `Ambiguous narration selector ${id}; give repeated blocks distinct semantic IDs`,
      );
    seen.add(id);
    const chosen = settings.adaptations[id];
    const decorative = chosen?.treatment === "decorative" && kind === "image";
    const sourceHash = decorative
      ? speechDigest({ id, treatment: "decorative" })
      : speechDigest({ source: await dependencies(source), context });
    const current = decorative || chosen?.sourceHash === sourceHash;
    const resolved = Boolean(
      chosen && current && (decorative || adaptationContent(chosen, caption)),
    );
    issues.push({
      id,
      kind,
      source: JSON.stringify(source, null, 2),
      caption,
      sourceHash,
      resolved,
    });
    if (!resolved || !chosen || decorative || chosen.treatment === "skip")
      return "";
    return chosen.treatment === "caption" ? caption : chosen.text;
  }
  async function inline(n: SpeechNode, anchor?: string): Promise<string> {
    switch (n.type) {
      case "text":
        return (n.value ?? "").replace(/\[@[^\]]+\]/g, "");
      case "inlineCode":
        return /^[\w .-]{1,60}$/.test(n.value ?? "") ? n.value! : adaptation(n);
      case "break":
        return " ";
      case "image":
        return adaptation(
          n,
          undefined,
          "image",
          "",
          { url: n.url, alt: n.alt },
          anchor,
        );
      case "imageReference":
        return adaptation(n);
      case "inlineMath":
        return adaptation(n);
      case "footnoteReference":
        return ""; // Definitions are spoken once below.
      case "textDirective":
        return directive(n);
      default:
        if (n.children)
          return (
            await Promise.all(n.children.map((c) => inline(c, anchor)))
          ).join("");
    }
    return adaptation(n);
  }
  async function directive(n: SpeechNode) {
    if (n.name === "index") return n.attributes?.term ?? "";
    if (n.name !== "ref") return adaptation(n);
    const [id, block] = (n.attributes?.target ?? "").split("#");
    const p = lib.pieces.get(id);
    if (!p || (block && !p.blocks[block]))
      throw Error(`Unknown narration reference ${id}`);
    if (!block) return p.title;
    return (
      p.blocks[block].caption ??
      p.blocks[block].title ??
      `the ${p.blocks[block].kind} example in ${p.title}`
    );
  }
  add("title", title);
  async function walk(nodes: SpeechNode[]) {
    // Visual emphasis does not add speech, pauses, or change paragraph neighbours.
    nodes = nodes.flatMap((n) =>
      n.type === "containerDirective" && n.name === "callout"
        ? (n.children ?? [])
        : [n],
    );
    for (const [index, n] of nodes.entries()) {
      if (n.type === "heading" || n.type === "paragraph") {
        const neighbours = [nodes[index - 1], nodes[index + 1]].map((x) =>
          x ? canonical(x) : null,
        );
        add(
          n.type === "heading" ? "heading" : "paragraph",
          await inline(n, JSON.stringify(neighbours)),
        );
      } else if (n.type === "leafDirective" && n.name === "block") {
        await richBlock(n);
      } else if (
        ["list", "listItem", "blockquote", "footnoteDefinition"].includes(
          n.type,
        )
      ) {
        if (n.type === "footnoteDefinition") add("heading", "Source note");
        await walk(n.children ?? []);
      } else if (!["definition", "thematicBreak"].includes(n.type))
        add("adaptation", await adaptation(n));
    }
  }
  async function richBlock(n: SpeechNode) {
    const id = n.attributes?.ref ?? "",
      block = piece.blocks[id];
    if (!block) throw Error(`Unknown narration block ${id}`);
    add(
      "adaptation",
      await adaptation(n, id, block.kind, block.caption, block),
    );
  }
  await walk(tree.children ?? []);
  const firstParagraph = segments.find((s) => s.kind === "paragraph")?.text;
  if (!segments.some((s) => s.kind !== "title"))
    throw Error(`No speakable article content: ${piece.id}`);
  return {
    key: renditionKey(piece, title),
    pieceId: piece.id,
    title,
    settings,
    segments,
    issues,
    firstParagraph,
    speechHash: speechDigest({
      version: 1,
      segments,
      voice: settings.voice,
      pace: settings.pace,
      profile: settings.profile,
      language: "b",
    }),
    reviewHash: speechDigest(
      issues.map((i) => [i.id, i.sourceHash, i.resolved]),
    ),
  };
}
function adaptationContent(
  choice: NarrationSettings["adaptations"][string],
  caption: string,
) {
  if (choice.treatment === "skip") return choice.reason.trim();
  if (choice.treatment === "caption") return caption.trim();
  return choice.text.trim();
}
