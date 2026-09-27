import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { pieceSchema } from "./model";
import { escape } from "./assets";

const tagSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
type Tag = z.infer<typeof tagSchema>;
export type Registry = { tags: Tag[]; names: Map<string, string> };
export type TagPiece = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "retired";
  tags: string[];
  sources: string[];
  fingerprint: string;
};
type Finding = {
  kind: "variant" | "duplicate" | "unregistered" | "first-use" | "similar";
  tag: string;
  message: string;
};
type TagRow = Tag & {
  registered: boolean;
  published: number;
  draft: number;
  retired: number;
  pieces: string[];
};
export type Inventory = {
  rows: TagRow[];
  pieces: TagPiece[];
  reviews: Record<string, Finding[]>;
};

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}
export function parseTagRegistry(raw: unknown): Registry {
  const { tags } = z
    .object({ schemaVersion: z.literal(1), tags: z.array(tagSchema) })
    .strict()
    .parse(raw);
  const names = new Map<string, string>();
  const ids = new Set<string>();
  for (const tag of tags) {
    if (ids.has(tag.id)) throw Error(`Duplicate tag ID: ${tag.id}`);
    ids.add(tag.id);
    for (const value of [tag.id, tag.label, ...tag.aliases]) {
      const key = normalizeTag(value);
      const owner = names.get(key);
      if (owner && owner !== tag.id)
        throw Error(`Ambiguous tag name or alias: ${value}`);
      names.set(key, tag.id);
    }
  }
  return { tags, names };
}
export async function loadTagRegistry(file = "content/tags.yaml") {
  return parseTagRegistry(
    YAML.parse(await fs.readFile(file, "utf8"), { maxAliasCount: 0 }),
  );
}
function tagKey(value: string, registry: Registry) {
  const normalized = normalizeTag(value);
  return registry.names.get(normalized) ?? normalized;
}
function tagLabels(values: string[], registry: Registry) {
  return [
    ...new Set(values.map((v) => tagKey(v, registry)).filter(Boolean)),
  ].map((id) => ({
    id,
    label:
      registry.tags.find((t) => t.id === id)?.label ?? id.replaceAll("-", " "),
  }));
}
export function renderTagList(values: string[], registry: Registry) {
  const labels = tagLabels(values, registry);
  return labels.length
    ? `<aside class="article-tags" aria-label="Topics"><span>Topics</span><ul>${labels.map((t) => `<li>${escape(t.label)}</li>`).join("")}</ul></aside>`
    : "";
}

/** Only direct canonical piece folders and individually selected extra files. */
export async function readTagPieces(roots: string[], files: string[] = []) {
  const selected = [...files];
  for (const root of roots) {
    const folder = path.join(root, "pieces");
    for (const entry of (
      await fs.readdir(folder, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name)))
      if (entry.isDirectory())
        selected.push(path.join(folder, entry.name, "index.md"));
  }
  const pieces = new Map<string, TagPiece>();
  for (const file of [...new Set(selected.map((f) => path.resolve(f)))]) {
    const raw = await fs.readFile(file, "utf8");
    const parsed = matter(raw, {
      engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
    });
    const data = pieceSchema.parse(parsed.data);
    if (data.tags.some((t) => !normalizeTag(t)))
      throw Error(`Empty tag in ${file}`);
    const fingerprint = createHash("sha256").update(raw).digest("hex");
    const previous = pieces.get(data.id);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw Error(
          `Conflicting sources for piece ${data.id}: ${previous.sources[0]} and ${file}`,
        );
      previous.sources.push(file);
    } else
      pieces.set(data.id, {
        id: data.id,
        title: data.title,
        summary: data.summary,
        status: data.status,
        tags: data.tags,
        sources: [file],
        fingerprint,
      });
  }
  return [...pieces.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)),
      );
    row = next;
  }
  return row[b.length];
}

export function buildTagInventory(
  input: TagPiece[],
  registry: Registry,
): Inventory {
  const unique = new Map<string, TagPiece>();
  for (const p of input) {
    if (unique.has(p.id) && unique.get(p.id)!.fingerprint !== p.fingerprint)
      throw Error(`Conflicting sources for piece ${p.id}`);
    unique.set(p.id, p);
  }
  const pieces = [...unique.values()];
  const rows = new Map<string, TagRow>(
    registry.tags.map((t) => [
      t.id,
      {
        ...t,
        registered: true,
        published: 0,
        draft: 0,
        retired: 0,
        pieces: [],
      },
    ]),
  );
  countTags();
  const reviews: Record<string, Finding[]> = Object.create(null);
  reviewTags();
  return {
    rows: [...rows.values()].sort((a, b) => a.label.localeCompare(b.label)),
    pieces,
    reviews,
  };

  function reviewTags() {
    for (const p of pieces) {
      const findings: Finding[] = [];
      const seen = new Set<string>();
      for (const raw of p.tags) {
        const key = tagKey(raw, registry),
          row = rows.get(key)!;
        if (raw !== key)
          findings.push({
            kind: "variant",
            tag: raw,
            message: `Use the canonical tag “${key}” for “${raw}”.`,
          });
        if (seen.has(key)) {
          findings.push({
            kind: "duplicate",
            tag: raw,
            message: `“${key}” is assigned more than once; counted once.`,
          });
          continue;
        }
        seen.add(key);
        if (!row.registered)
          findings.push({
            kind: "unregistered",
            tag: raw,
            message: `“${key}” is not in the registry. Reuse an existing tag or define its scope.`,
          });
        if (
          !row.pieces.some(
            (id) => id !== p.id && unique.get(id)!.status !== "retired",
          )
        )
          findings.push({
            kind: "first-use",
            tag: raw,
            message: `No other active piece in this inventory uses “${key}”. Check whether an existing tag fits.`,
          });
        reviewSpelling(row, key, findings, raw);
      }
      reviews[p.id] = findings;
    }

    function reviewSpelling(
      row: TagRow,
      key: string,
      findings: Finding[],
      raw: string,
    ) {
      if (!row.registered && key.length >= 4) {
        const similar = [...rows.keys()]
          .filter(
            (id) => id !== key && distance(key, id) <= (key.length > 7 ? 2 : 1),
          )
          .sort()
          .slice(0, 3);
        if (similar.length)
          findings.push({
            kind: "similar",
            tag: raw,
            message: `Possible spelling variant of: ${similar.join(", ")}. Review before creating a new tag.`,
          });
      }
    }
  }

  function countTags() {
    for (const p of pieces) {
      for (const key of new Set(p.tags.map((t) => tagKey(t, registry)))) {
        if (!key) throw Error(`Empty tag in ${p.id}`);
        if (!rows.has(key))
          rows.set(key, {
            id: key,
            label: key.replaceAll("-", " "),
            description:
              "Not registered — review its scope before adding it to the vocabulary.",
            aliases: [],
            registered: false,
            published: 0,
            draft: 0,
            retired: 0,
            pieces: [],
          });
        const row = rows.get(key)!;
        row[p.status]++;
        row.pieces.push(p.id);
      }
    }
  }
}
