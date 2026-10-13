import { narrationPolicy } from "./narration-store";
import path from "node:path";
import {
  assemble,
  readYaml,
  type Collection,
  type Library,
  type AssemblyNode,
} from "./model";
import { readingPlan } from "./reading-structure";
import {
  readNarrationSettings,
  settingsSchema,
  speechDigest,
  speechDocument,
  type SpeechDocument,
  type SpeechSegment,
} from "./narration-speech";
import { localAsset } from "./assets";
import { digestAsset } from "./asset-manifest";
import fs from "node:fs/promises";

type BookSegment = SpeechSegment & {
  id: string;
  placement: string;
  label: string;
  depth: number;
  navigation: boolean;
  contentHash: string;
};
export type BookPlan = {
  bookId: string;
  title: string;
  author: string;
  complete: boolean;
  preview: boolean;
  hash: string;
  cover?: string;
  coverHash?: string;
  partial: string[];
  segments: BookSegment[];
  doc: SpeechDocument;
};
export function publicBooks(lib: Library) {
  return lib.collections.filter((c) => c.book && c.status === "published");
}
function contentNodes(c: Collection, lib: Library, preview: boolean) {
  // Public eligibility is the book's web reading view, never the broader draft outline.
  const nodes = assemble(c, lib, "web", { preview }).nodes;
  return nodes.filter((n, i) => {
    if (n.planned) return false;
    if (n.piece) return true;
    for (const child of nodes.slice(i + 1)) {
      if (child.depth <= n.depth) break;
      if (child.piece) return true;
    }
    return false;
  });
}
function fullOutline(c: Collection, lib: Library) {
  // Include private placeholders only for readiness checks, never spoken output.
  const copy = structuredClone(c);
  function reveal(nodes: Collection["body"]) {
    for (const n of nodes) {
      if (n.kind === "planned") n.publicOutline = true;
      reveal(n.before ?? []);
      reveal(n.children ?? []);
      reveal(n.after ?? []);
    }
  }
  reveal([...copy.frontMatter, ...copy.body, ...copy.backMatter]);
  return assemble(copy, lib, "web", { preview: true }).nodes;
}
function publicationBoundary(
  all: AssemblyNode[],
  visible: AssemblyNode[],
  complete: boolean,
) {
  const expected = all.filter((n) => n.piece || n.planned),
    ids = new Set(visible.map((n) => n.id));
  const last = expected.reduce((last, n, i) => (ids.has(n.id) ? i : last), -1);
  if (expected.slice(0, last + 1).some((n) => !ids.has(n.id)))
    throw Error(
      "Audiobook publication held: an internal unpublished gap interrupts the reading order.",
    );
  if (complete && expected.some((n) => !ids.has(n.id)))
    throw Error("A complete audiobook cannot contain unpublished material.");
  const plan = readingPlan(all);
  return [
    ...new Set(
      expected
        .filter((n) => !ids.has(n.id))
        .map((n) => plan.get(n.id)!.group.id),
    ),
  ].filter((id) => visible.some((n) => n.id === id));
}
function spokenHeading(n: AssemblyNode, part: number) {
  if (n.kind === "part") return `Part ${part}. ${n.title}`;
  if (n.kind === "chapter") return `Chapter ${n.number}. ${n.title}`;
  if (n.kind === "appendix") return `Appendix ${n.number}. ${n.title}`;
  const role =
    n.role &&
    [
      "foreword",
      "preface",
      "introduction",
      "dedication",
      "epigraph",
      "afterword",
      "acknowledgements",
    ].includes(n.role)
      ? n.role
      : undefined;
  if (role && !n.title.toLowerCase().startsWith(role))
    return `${role[0].toUpperCase() + role.slice(1)}. ${n.title}`;
  return n.number ? `${n.number}. ${n.title}` : n.title;
}
export async function audiobookPlan(
  root: string,
  c: Collection,
  lib: Library,
  preview = false,
): Promise<BookPlan> {
  if (!c.book || !c.ordered)
    throw Error("Audiobooks require an ordered book collection");
  const all = fullOutline(c, lib),
    nodes = contentNodes(c, lib, preview);
  if (!nodes.some((n) => n.piece))
    throw Error("No eligible book content to narrate");
  const complete = c.completion === "complete";
  const partial = preview ? [] : publicationBoundary(all, nodes, complete);
  const structure = readingPlan(nodes),
    settings = settingsSchema.parse(c.audiobook ?? {});
  const site = await readYaml(path.join(root, "publishing/site.yaml"));
  const author = c.audioAuthor ?? site.name;
  if (typeof author !== "string" || !author.trim())
    throw Error("Audiobook author attribution is required");
  const segments: BookSegment[] = [],
    issues: SpeechDocument["issues"] = [];
  const profileHash = (await narrationPolicy(root)).profiles[settings.profile];
  const seen = new Map<string, number>();
  function add(
    s: SpeechSegment,
    placement: string,
    label: string,
    depth: number,
    navigation = false,
  ) {
    const contentHash = speechDigest({
      s,
      voice: settings.voice,
      pace: settings.pace,
      profileHash,
    });
    const anchor = `${placement}:${speechDigest({ text: s.text, kind: s.kind }).slice(0, 24)}`;
    const occurrence = (seen.get(anchor) ?? 0) + 1;
    seen.set(anchor, occurrence);
    segments.push({
      ...s,
      id: `${anchor}:${occurrence}`,
      placement,
      label,
      depth,
      navigation,
      contentHash,
    });
  }
  add(
    {
      kind: "title",
      text: `${c.title}.${c.audioSubtitle ? ` ${c.audioSubtitle}.` : ""} By ${author}. AI narration.`,
      pause: 1.2,
    },
    "$opening",
    "Opening credits",
    0,
    true,
  );
  await addNodes();
  async function addNodes() {
    const parts = all.filter((n) => n.kind === "part");
    for (const n of nodes) {
      const part = parts.findIndex((p) => p.id === n.id) + 1;
      const label = spokenHeading(n, part),
        entry = structure.get(n.id)!;
      if (!n.piece) {
        add(
          {
            kind: "heading",
            text: label,
            pause: n.kind === "part" ? 1.2 : 0.8,
          },
          n.id,
          label,
          n.depth,
          true,
        );
        continue;
      }
      const pSettings = await readNarrationSettings(n.piece);
      const doc = await speechDocument(
        root,
        n.piece,
        lib,
        {
          ...pSettings,
          voice: settings.voice,
          pace: settings.pace,
          profile: settings.profile,
        },
        n.title,
      );
      issues.push(
        ...doc.issues.map((i) => ({ ...i, id: `${n.piece!.id}/${i.id}` })),
      );
      if (!entry.omit)
        add(
          { kind: "heading", text: label, pause: 0.7 },
          n.id,
          label,
          n.depth,
          true,
        );
      for (const s of doc.segments.filter((s) => s.kind !== "title"))
        add(
          s,
          n.id,
          s.kind === "heading" ? s.text : label,
          n.depth + 1,
          s.kind === "heading",
        );
    }
  }
  add(
    {
      kind: "paragraph",
      text: complete
        ? `You have been listening to ${c.title}, by ${author}. The end.`
        : "You're up to date. This book will continue here as more content is published.",
      pause: 1,
    },
    "$closing",
    complete ? "Closing credits" : "You're up to date",
    0,
    true,
  );
  let cover: string | undefined, coverHash: string | undefined;
  if (c.cover) {
    cover = await localAsset(
      path.join(root, "content/collections"),
      c.cover.path,
    );
    coverHash = digestAsset(await fs.readFile(cover));
  }
  const speechHash = speechDigest({
    version: 1,
    segments,
    settings,
    author,
    coverHash,
    complete,
  });
  const doc: SpeechDocument = {
    key: c.id,
    pieceId: c.id,
    title: c.title,
    settings,
    segments,
    issues,
    speechHash,
    reviewHash: speechDigest(issues),
    firstParagraph: segments.find(
      (s) => s.kind === "paragraph" && !s.placement.startsWith("$"),
    )?.text,
  };
  return {
    bookId: c.id,
    title: c.title,
    author,
    complete,
    preview,
    hash: speechDigest([speechHash, doc.reviewHash, partial]),
    segments,
    doc,
    cover,
    coverHash,
    partial,
  };
}
