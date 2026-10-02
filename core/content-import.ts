import type { Nodes } from "mdast";
import { asError } from "./errors";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import matter from "gray-matter";
import YAML from "yaml";
import {
  collectionSchema,
  pieceSchema,
  loadLibrary,
  type Node,
  type Library,
  type Piece,
} from "./model";
import { hash, localAsset } from "./assets";
import { extractReviewPiece } from "./content-quality";
import { Dirent } from "fs";

export type ImportOptions = {
  from: string;
  to?: string;
  pieces?: string[];
  collections?: string[];
  excludePieces?: string[];
  excludeCollections?: string[];
  all?: boolean;
  update?: boolean;
};
type Entry = {
  id: string;
  status: string;
  relative: string;
} & (
  | { kind: "piece"; data: ReturnType<typeof pieceSchema.parse> }
  | { kind: "collection"; data: ReturnType<typeof collectionSchema.parse> }
);
type Files = Map<string, Buffer>;
type ImportPlan = {
  source: string;
  destination: string;
  selected: string[];
  warnings: string[];
  files: {
    path: string;
    action: "add" | "update" | "unchanged";
    sha256: string;
  }[];
  fingerprint: string;
};
async function exists(file: string) {
  try {
    await fs.lstat(file);
    return true;
  } catch (caught) {
    const e = asError(caught);
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
async function safeRoot(root: string) {
  const absolute = path.resolve(root);
  let current = path.parse(absolute).root;
  for (const part of absolute
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    if (await exists(current)) {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw Error(`Not a real directory: ${current}`);
    }
  }
  return absolute;
}
async function tree(root: string, prefix = ""): Promise<Files> {
  const files: Files = new Map();
  if (!(await exists(root))) return files;
  for (const entry of (await fs.readdir(root, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (entry.name === ".DS_Store") continue;
    const { file, rel } = validateEntry(entry);
    if (entry.isDirectory()) {
      for (const [key, value] of await tree(file, rel)) files.set(key, value);
      continue;
    }
    if (!entry.isFile()) throw Error(`Unsupported file: ${file}`);
    files.set(rel, await fs.readFile(file));
  }
  return files;

  function validateEntry(entry: Dirent<string>) {
    if (entry.name.startsWith(".") && entry.name !== ".gitkeep")
      throw Error(
        `Hidden files are not importable: ${path.join(root, entry.name)}`,
      );
    const rel = path.join(prefix, entry.name),
      file = path.join(root, entry.name);
    if (entry.isSymbolicLink())
      throw Error(`Symbolic links are not importable: ${file}`);
    return { file, rel };
  }
}
async function inventory(root: string) {
  const entries: Entry[] = [];
  for (const kind of ["piece", "collection"] as const) {
    const folder = path.join(root, kind === "piece" ? "pieces" : "collections");
    if (!(await exists(folder))) continue;
    await safeRoot(folder);
    await readFolder(folder, kind);
  }
  return entries;

  async function readFolder(folder: string, kind: Entry["kind"]) {
    for (const entry of (
      await fs.readdir(folder, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".DS_Store") continue;
      if (entry.isSymbolicLink())
        throw Error(`Symbolic link in inventory: ${entry.name}`);
      if (
        kind === "piece" ? !entry.isDirectory() : !entry.name.endsWith(".yaml")
      )
        continue;
      await readEntry(kind, entry);
    }
  }

  async function readEntry(kind: Entry["kind"], entry: Dirent<string>) {
    const relative =
      kind === "piece"
        ? path.join("pieces", entry.name, "index.md")
        : path.join("collections", entry.name);
    const sourceFile = path.join(root, relative);
    if ((await fs.lstat(sourceFile)).isSymbolicLink())
      throw Error(`Symbolic link: ${sourceFile}`);
    const raw = await fs.readFile(sourceFile, "utf8");
    const data =
      kind === "piece"
        ? pieceSchema.parse(
            matter(raw, {
              engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
            }).data,
          )
        : collectionSchema.parse(YAML.parse(raw, { maxAliasCount: 0 }));
    if (entries.some((e) => e.id === data.id))
      throw Error(`Duplicate identity: ${data.id}`);
    const item = { id: data.id, status: data.status, relative };
    if (kind === "piece")
      entries.push({ ...item, kind, data: pieceSchema.parse(data) });
    else entries.push({ ...item, kind, data: collectionSchema.parse(data) });
  }
}
function refs(nodes: Node[]): string[] {
  return nodes.flatMap((n) => [
    ...(n.ref ? [n.ref] : []),
    ...refs(n.before ?? []),
    ...refs(n.children ?? []),
    ...refs(n.after ?? []),
  ]);
}
function metadata(
  bytes: Buffer,
  kind: Entry["kind"],
  status: string,
  existing?: Record<string, unknown>,
) {
  const raw = bytes.toString("utf8");
  const match =
    kind === "piece"
      ? /^(---\r?\n)([\s\S]*?)(\r?\n---[^\S\r\n]*(?:\r?\n|$))/.exec(raw)
      : null;
  if (kind === "piece" && !match) throw Error("Expected YAML front matter");
  const doc = YAML.parseDocument(match ? match[2] : raw);
  doc.delete("status");
  doc.delete("draft");
  if (status === "draft") doc.set("draft", true);
  if (status === "retired") doc.set("status", "retired");
  const keys =
    kind === "collection"
      ? ["slug", "shortCode"]
      : ["slug", "shortCode", "publishedAt", "updatedAt", "publication"];
  if (existing)
    for (const key of keys) {
      if (existing[key] === undefined) doc.delete(key);
      else doc.set(key, existing[key]);
    }
  // Publication metadata belongs to the destination; article body bytes stay intact.
  return Buffer.from(
    match
      ? match[1] +
          doc.toString().trimEnd() +
          match[3] +
          raw.slice(match[0].length)
      : YAML.stringify(doc.toJS({ maxAliasCount: 0 })),
  );
}
async function writeTree(root: string, files: Files) {
  for (const [relative, bytes] of files) {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
}
const digest = (files: Files) =>
  hash(
    JSON.stringify(
      [...files]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([p, b]) => [p, hash(b)]),
    ),
  );

export async function prepareImport(options: ImportOptions) {
  const source = await safeRoot(options.from),
    destination = await safeRoot(options.to ?? "content");
  if (
    source === destination ||
    source.startsWith(destination + path.sep) ||
    destination.startsWith(source + path.sep)
  )
    throw Error(
      "Source and destination must be separate, non-nested directories",
    );
  const available = await inventory(source),
    existing = await inventory(destination);
  if (!available.length)
    throw Error(
      "No canonical content found; --from must contain pieces/ or collections/",
    );
  if (
    options.all &&
    (options.pieces?.length ?? 0) + (options.collections?.length ?? 0)
  )
    throw Error("--all cannot be combined with --piece or --collection");
  const { selected, warnings }: { selected: Set<Entry>; warnings: string[] } =
    selectContent();
  const before = await tree(destination),
    incoming: Files = new Map();
  const merged = await prepareFiles();
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "content-import-"));
  try {
    await writeTree(temporary, merged);
    await fs.mkdir(path.join(temporary, "pieces"), { recursive: true });
    await fs.mkdir(path.join(temporary, "collections"), { recursive: true });
    const library = await loadLibrary(temporary);
    await validateImportedContent(library);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
  const files: ImportPlan["files"] = [...incoming]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, b]) => ({
      path: p,
      action: !before.has(p)
        ? "add"
        : before.get(p)!.equals(b)
          ? "unchanged"
          : "update",
      sha256: hash(b),
    }));
  const plan: ImportPlan = {
    source,
    destination,
    selected: [...selected].map((e) => `${e.kind}:${e.id}`).sort(),
    warnings: [...new Set(warnings)],
    files,
    fingerprint: hash(
      JSON.stringify({ source, destination, before: digest(before), files }),
    ),
  };
  return { plan, before, incoming };

  async function validateImportedContent(library: Library) {
    for (const e of selected)
      if (e.kind === "piece") {
        const p = library.pieces.get(e.id)!;
        const review = await extractReviewPiece({
          id: p.id,
          title: p.title,
          summary: p.summary,
          status: p.status,
          tags: p.tags,
          sources: [path.join(p.dir, "index.md")],
          fingerprint: "",
        });
        if (review.technical.length)
          throw Error(
            `${p.id}: ${review.technical.map((f) => f.message + " " + f.excerpt).join("; ")}`,
          );
        await validateResources(p);
      }

    async function validateResources(p: Piece) {
      const checkLinks = (node: Nodes) => {
        if (
          (node.type === "image" ||
            node.type === "link" ||
            node.type === "definition") &&
          node.url &&
          !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(node.url)
        ) {
          const resolved = path.resolve(
            p.dir,
            decodeURIComponent(node.url.split(/[?#]/)[0]),
          );
          if (!resolved.startsWith(temporary + path.sep))
            throw Error(
              `${p.id}: relative resource escapes the imported library: ${node.url}`,
            );
        }
        for (const child of "children" in node ? node.children : [])
          checkLinks(child);
      };
      checkLinks(p.ast);
      for (const block of Object.values(p.blocks)) {
        for (const field of ["path", "data"])
          if (
            typeof block.source[field] === "string" &&
            !block.source[field].startsWith("media:")
          )
            await localAsset(p.dir, block.source[field]);
        for (const asset of block.alternative?.assets ?? [])
          await localAsset(p.dir, asset.path);
      }
    }
  }

  async function prepareFiles() {
    for (const e of [...selected].sort((a, b) => a.id.localeCompare(b.id))) {
      await prepareEntry(e);
    }
    const merged = new Map([...before, ...incoming]);
    return merged;

    async function prepareEntry(e: Entry) {
      const previous = existing.find((x) => x.id === e.id);
      if (
        previous &&
        (previous.kind !== e.kind || previous.status === "retired")
      )
        throw Error(`Destination identity is incompatible or retired: ${e.id}`);
      const targetRelative =
        previous?.relative ??
        (e.kind === "piece"
          ? `pieces/${e.id}/index.md`
          : `collections/${e.id}.yaml`);
      const files =
        e.kind === "piece"
          ? await tree(path.dirname(path.join(source, e.relative)))
          : new Map([
              [
                path.basename(e.relative),
                await fs.readFile(path.join(source, e.relative)),
              ],
            ]);
      if (e.kind === "collection" && e.data.cover) {
        const cover = await localAsset(
          path.dirname(path.join(source, e.relative)),
          e.data.cover.path,
        );
        files.set(e.data.cover.path, await fs.readFile(cover));
      }
      prepareEntryFiles();
      if (previous)
        warnings.push(
          `${e.id}: destination status and publication identity retained; destination-only files are not deleted.`,
        );

      function prepareEntryFiles() {
        for (const [local, bytes] of files) {
          const main =
            local ===
            (e.kind === "piece" ? "index.md" : path.basename(e.relative));
          const relative = main
            ? targetRelative
            : path.join(path.dirname(targetRelative), local);
          if (
            before.has(relative) &&
            ((!previous && (main || !before.get(relative)!.equals(bytes))) ||
              (e.kind === "collection" &&
                !main &&
                !before.get(relative)!.equals(bytes)))
          )
            throw Error(
              `Destination path belongs to other content: ${relative}`,
            );
          let output = main
            ? metadata(
                bytes,
                e.kind,
                previous?.status ?? "draft",
                previous?.data,
              )
            : bytes;
          // Keep exact existing formatting on semantically identical front matter.
          output = retainExistingFormatting(main, relative, output);
          if (
            previous &&
            !options.update &&
            (!before.has(relative) || !before.get(relative)!.equals(output))
          )
            throw Error(
              `Existing ${e.id} differs; review again with --update to allow changes`,
            );
          incoming.set(relative, output);
        }

        function retainExistingFormatting(
          main: boolean,
          relative: string,
          output: Buffer<ArrayBufferLike>,
        ) {
          if (main && before.has(relative)) {
            const a = before.get(relative)!.toString(),
              b = output.toString();
            const parse = (s: string) =>
              e.kind === "piece"
                ? matter(s, {
                    engines: {
                      yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }),
                    },
                  })
                : YAML.parse(s, { maxAliasCount: 0 });
            const aa = parse(a),
              bb = parse(b);
            if (
              e.kind === "piece"
                ? JSON.stringify(aa.data) === JSON.stringify(bb.data) &&
                  aa.content === bb.content
                : JSON.stringify(aa) === JSON.stringify(bb)
            )
              output = before.get(relative)!;
          }
          return output;
        }
      }
    }
  }

  function selectContent() {
    const selected = new Set<Entry>();
    const find = (id: string, kind: Entry["kind"]) => {
      const found = available.find((e) => e.id === id && e.kind === kind);
      if (!found) throw Error(`Unknown ${kind}: ${id}`);
      return found;
    };
    for (const id of options.excludePieces ?? []) find(id, "piece");
    for (const id of options.excludeCollections ?? []) find(id, "collection");
    const excluded = (e: Entry) =>
      (e.kind === "piece"
        ? options.excludePieces
        : options.excludeCollections
      )?.includes(e.id);
    const explicit =
      (options.pieces?.length ?? 0) + (options.collections?.length ?? 0) > 0;
    for (const e of available)
      if (!explicit && e.status !== "retired" && !excluded(e)) selected.add(e);
    addExplicitSelections();
    const warnings: string[] = [];
    const requirePiece = (id: string) => {
      const e = available.find((e) => e.kind === "piece" && e.id === id);
      if (e && e.status !== "retired" && !excluded(e)) selected.add(e);
      else if (
        existing.some(
          (e) => e.kind === "piece" && e.id === id && e.status !== "retired",
        )
      )
        warnings.push(`Dependency ${id} uses the existing destination copy.`);
      else
        throw Error(
          `Required piece ${id} is missing, retired or excluded; collection outlines are never pruned`,
        );
    };
    // Set iteration visits added dependencies, including adaptation chains.
    for (const e of selected) {
      if (e.kind === "collection")
        for (const id of refs([
          ...e.data.frontMatter,
          ...e.data.body,
          ...e.data.backMatter,
        ]))
          requirePiece(id);
      else if (e.data.adaptedFrom) requirePiece(e.data.adaptedFrom);
    }
    if (!selected.size) throw Error("No content selected");
    return { selected, warnings };

    function addExplicitSelections() {
      for (const [kind, ids] of [
        ["piece", options.pieces ?? []],
        ["collection", options.collections ?? []],
      ] as const) {
        for (const id of ids) {
          const e = find(id, kind);
          if (excluded(e)) throw Error(`Both selected and excluded: ${id}`);
          if (e.status === "retired")
            throw Error(`Retired content cannot be imported: ${id}`);
          selected.add(e);
        }
      }
    }
  }
}
export async function applyImport(
  prepared: Awaited<ReturnType<typeof prepareImport>>,
  expected?: string,
) {
  const { plan, before, incoming } = prepared;
  if (expected && expected !== plan.fingerprint)
    throw Error("Import plan changed; review the new dry run before applying");
  await safeRoot(plan.destination);
  const parent = path.dirname(plan.destination);
  await fs.mkdir(parent, { recursive: true });
  const lock = path.join(
    parent,
    `.${path.basename(plan.destination)}.import.lock`,
  );
  const handle = await fs.open(lock, "wx");
  const written: string[] = [];
  try {
    if (digest(await tree(plan.destination)) !== digest(before))
      throw Error("Destination changed since planning; rerun the import");
    await writeFiles();
  } catch (error) {
    for (const relative of written.reverse()) {
      const target = path.join(plan.destination, relative);
      if (before.has(relative))
        await fs.writeFile(target, before.get(relative)!);
      else await fs.rm(target, { force: true });
    }
    throw error;
  } finally {
    await handle.close();
    await fs.rm(lock, { force: true });
  }

  async function writeFiles() {
    for (const file of plan.files)
      if (file.action !== "unchanged") {
        const target = path.join(plan.destination, file.path);
        await safeRoot(path.dirname(target));
        await fs.mkdir(path.dirname(target), { recursive: true });
        // Updates replace complete files; an interrupted write cannot truncate the original.
        if (file.action === "update") {
          const temporary = target + `.import-${randomUUID()}`;
          try {
            await fs.writeFile(temporary, incoming.get(file.path)!, {
              flag: "wx",
            });
            if (!(await fs.readFile(target)).equals(before.get(file.path)!))
              throw Error(`Destination changed during import: ${file.path}`);
            await fs.rename(temporary, target);
            written.push(file.path);
          } finally {
            await fs.rm(temporary, { force: true });
          }
        } else {
          const output = await fs.open(target, "wx");
          written.push(file.path);
          try {
            await output.writeFile(incoming.get(file.path)!);
          } finally {
            await output.close();
          }
        }
      }
  }
}
