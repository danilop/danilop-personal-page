import { sourceHeadingLevel } from "./reading-structure";
import { asError } from "./errors";
import { selectCode } from "./code-source";
import { visit } from "unist-util-visit";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  assemble,
  readYaml,
  parser,
  type Library,
  type Collection,
  type AssemblyNode,
  type Block,
} from "./model";
import { renderDocument } from "./render";
import { Assets, hash } from "./assets";
import { bookMatter } from "./book-matter";
import {
  bookLayout,
  bookSourceNotes,
  bookHeadingSlug,
  type TextEdit,
} from "./book-format";
type BookExporter = {
  id: string;
  version: string;
  export: (context: {
    collection: Collection;
    lib: Library;
    output: string;
    excludePlanned: boolean;
    preview: boolean;
  }) => Promise<string[]>;
};
const markua: BookExporter = {
  id: "markua",
  version: "3",
  async export({ collection, lib, output, excludePlanned, preview }) {
    const doc = assemble(collection, lib, "book", { excludePlanned, preview });
    const layout = bookLayout(doc.nodes);
    const notes = bookSourceNotes(doc.nodes, layout);
    const matter = await bookMatter(doc);
    const assets = new Assets(path.join(output, "manuscript", "resources"));
    const defaults = await readYaml("publishing/renderers.yaml");
    const rendered = await renderDocument(doc, lib, defaults, assets);
    await fs.mkdir(path.join(output, "manuscript"), { recursive: true });
    const files: string[] = [];
    const refs = new Map<string, string[]>();
    indexPiecePlacements();
    let part: "front" | "body" | "back" | undefined;
    const frontIds = new Set(collection.frontMatter.map((n) => n.id)),
      backIds = new Set(collection.backMatter.map((n) => n.id));
    let emittedPart: typeof part;
    for (let i = 0; i < doc.nodes.length; i++) {
      const n = doc.nodes[i];
      const format = layout.get(n.id)!;
      const bookDepth = format.depth;
      let body = "";
      if (frontIds.has(n.id)) part = "front";
      else if (backIds.has(n.id)) part = "back";
      else if (collection.body.some((x) => x.id === n.id)) part = "body";
      const marker = matterMarker();
      if (n.kind === "generated") {
        body = generatedMatter(n, body);
      } else if (n.piece) {
        body = await renderPiece(body, n, bookDepth);
      }
      const title = titleFor(n, bookDepth, format);

      if (format.attachAnchor) body = `{#${n.id}}\n${body.trimStart()}`;
      const filename = `${String(i + 1).padStart(3, "0")}-${n.id}.md`;
      await fs.writeFile(
        path.join(output, "manuscript", filename),
        marker + title + body + "\n",
      );
      files.push(filename);
      await appendSourceNotes(n, i);
    }
    function titleFor(
      n: AssemblyNode,
      bookDepth: number,
      format: { sample: boolean; omit: boolean },
    ) {
      const attributes = [`id: ${n.id}`];
      if (n.kind === "part") attributes.push("class: part");
      if (bookDepth === 1) attributes.push(`sample: ${format.sample}`);
      return n.kind === "generated" || format.omit
        ? ""
        : `{${attributes.join(", ")}}\n${"#".repeat(bookDepth)} ${n.title}\n\n`;
    }
    async function appendSourceNotes(n: AssemblyNode, i: number) {
      let sourceNotes = notes.after.get(n.id);
      if (sourceNotes) {
        for (const note of notes.entries.get(n.id)!) {
          const source = note.source;
          const renderedNote = await renderPiece(
            "",
            {
              ...source,
              piece: {
                ...source.piece!,
                body: note.text,
                ast: parser().parse(note.text),
              },
            },
            1,
            false,
          );
          sourceNotes = sourceNotes.replace(
            `**${note.number}.** ${note.text}`,
            `**${note.number}.** ${renderedNote}`,
          );
        }
        const notesFile = `${String(i + 1).padStart(3, "0")}-${n.id}-source-notes.md`;
        await fs.writeFile(
          path.join(output, "manuscript", notesFile),
          sourceNotes,
        );
        files.push(notesFile);
      }
    }
    await appendBackMatter();
    await fs.writeFile(
      path.join(output, "manuscript", "Book.txt"),
      files.join("\n") + "\n",
    );
    await fs.writeFile(
      path.join(output, "manuscript", "Preview.txt"),
      files.join("\n") + "\n",
    );
    return files;

    function indexPiecePlacements() {
      for (const n of doc.nodes)
        if (n.piece) {
          const list = refs.get(n.piece.id) ?? [];
          list.push(n.id);
          refs.set(n.piece.id, list);
        }
    }

    async function appendBackMatter() {
      for (const [role, body] of Object.entries(matter.sections)) {
        if (body && !doc.nodes.some((n) => n.role === role)) {
          const filename = role + ".md";
          await fs.writeFile(
            path.join(output, "manuscript", filename),
            "{backmatter}\n\n" + remapAnchors(body) + "\n",
          );
          files.push(filename);
        }
      }
    }

    function generatedMatter(n: AssemblyNode, body: string) {
      if (n.role === "toc")
        body =
          "## Contents\n\n" +
          doc.nodes
            .filter((x) => x.kind === "chapter" || x.kind === "appendix")
            .map((x) => `* [${x.title}](#${x.id})`)
            .join("\n");
      else if (["glossary", "index", "bibliography"].includes(n.role ?? "")) {
        body = matter.sections[n.role as keyof typeof matter.sections];
      } else throw Error(`Unsupported generated book material ${n.role}`);
      return remapAnchors(body);
    }

    function remapAnchors(body: string) {
      return body.replace(
        /\]\(#([^)]*)\)/g,
        (_, id) => `](#${layout.get(id)?.anchor ?? id})`,
      );
    }

    function matterMarker() {
      if (part === emittedPart) return "";
      emittedPart = part;
      return part === "body"
        ? "{mainmatter}\n\n"
        : part === "back"
          ? "{backmatter}\n\n"
          : "";
    }

    async function renderPiece(
      body: string,
      n: AssemblyNode,
      bookDepth: number,
      includeNotes = true,
    ) {
      body = n.piece!.body;
      let protectedCode;
      ({ protectedCode, body } = prepareHeadingsAndCode(
        n,
        bookDepth,
        body,
        includeNotes ? notes.edits.get(n.id) : [],
      ));

      body = body.replace(
        /\]\(#([^)]*)\)/g,
        (_, target) =>
          `](#${notes.anchors.has(target) ? target : `${n.id}-${target}`})`,
      );
      // Source stays Markdown; contextual block renditions replace directives only.
      body = await renderBlocks(n, body, protectedCode);
      body = await freezeImages(body, n);
      body = body.replace(/:ref\{([^}]+)\}/g, (_, raw) => {
        const attrs = Object.fromEntries(
          [...raw.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)')/g)].map((m) => [
            m[1],
            m[2] ?? m[3],
          ]),
        );
        const target = String(attrs.target ?? ""),
          placement = attrs.placement;
        const [pieceId, blockId] = target.split("#");
        const occurrences = refs.get(pieceId) ?? [];
        if (occurrences.length > 1 && !placement)
          throw Error(`Ambiguous book reference ${target}`);
        const selected = placement ?? occurrences[0];
        if (!selected || !occurrences.includes(selected))
          throw Error(`Unresolved book reference ${target}`);
        const anchor = blockId
          ? `${selected}-${blockId}`
          : layout.get(selected)!.anchor;
        return `[${blockId ?? lib.pieces.get(pieceId)!.title}](#${anchor})`;
      });
      body = body
        .replace(/\[@([^\]]+)\]|:cite\{key="([^"]+)"\}/g, (_, a, b) =>
          matter.citation(a ?? b),
        )
        .replace(/:term\{ref="([^"]+)"\}/g, (_, key) => matter.term(key))
        .replace(/:index\{term="([^"]+)"\}/g, (_, term) => term);
      for (const [token, code] of protectedCode)
        body = body.replaceAll(token, code);
      return body;
    }

    async function renderBlocks(
      n: AssemblyNode,
      body: string,
      protectedCode: Map<string, string>,
    ) {
      for (const [id, block] of Object.entries(n.piece!.blocks)) {
        const expression = new RegExp(
          "::block\\{ref=[\"\\']" + id + "[\"\\']\\}",
          "g",
        );
        if (!expression.test(body)) continue;
        expression.lastIndex = 0;
        const asset = rendered.blockAssets[`${n.id}#${id}`];
        let replacement: string = await renderBlock(asset, n, id, block);
        if (block.alternative?.mode === "static") {
          for (const item of block.alternative.assets ?? []) {
            const asset = await assets.copy(n.piece!.dir, item.path);
            replacement += `\n\n![${item.description}](resources/${path.basename(asset)})`;
          }
        }
        if (!replacement.startsWith(`{#${n.id}-${id}}`))
          replacement = `{#${n.id}-${id}}\n` + replacement;
        if (block.kind === "code") {
          const token = `NOTESBOOKCODE${protectedCode.size}END`;
          protectedCode.set(token, replacement);
          replacement = token;
        }
        body = body.replace(expression, replacement);
      }
      return body;
    }

    async function freezeImages(body: string, n: AssemblyNode) {
      const images = [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
      for (const match of images) {
        if (match[2].startsWith("resources/")) continue;
        if (/^(https?:|media:)/.test(match[2]))
          throw Error(
            "Freeze remote book images with an explicit local or versioned alternative",
          );
        const url = await assets.copy(n.piece!.dir, match[2]);
        body = body.replace(
          match[0],
          `![${match[1]}](resources/${path.basename(url)})`,
        );
      }
      return body;
    }

    async function renderBlock(
      asset: string,
      n: AssemblyNode,
      id: string,
      block: Block,
    ) {
      let replacement: string;
      if (asset)
        replacement = `{#${n.id}-${id}}\n![${block.description ?? block.caption ?? ""}](resources/${path.basename(asset)})${block.caption ? "\n\n" + block.caption : ""}`;
      else if (block.kind === "code") {
        replacement = await renderCodeBlock();
      } else if (block.alternative)
        replacement =
          block.alternative.text +
          (block.alternative.url
            ? `\n\n[Companion material](${block.alternative.url})`
            : "");
      else if (block.kind === "math")
        replacement = `{$$}\n${block.source.path ? (await assets.read(n.piece!.dir, String(block.source.path))).toString() : block.source.text}\n{/$$}`;
      else if (block.kind === "table") {
        const { parse } = await import("csv-parse/sync");
        const rows = parse<Record<string, string>>(
          (
            await assets.read(n.piece!.dir, String(block.source.path))
          ).toString(),
          { columns: true, skip_empty_lines: true },
        );
        const cols = Object.keys(rows[0]);
        const cell = (v: unknown) =>
          String(v).replaceAll("|", "\\|").replaceAll("\n", " ");
        replacement =
          `| ${cols.map(cell).join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n` +
          rows
            .map(
              (r: Record<string, unknown>) =>
                `| ${cols.map((c) => cell(r[c])).join(" | ")} |`,
            )
            .join("\n");
      } else if (["callout", "exercise"].includes(block.kind))
        replacement = `**${block.title ?? "Note"}**\n\n${block.source.text ?? ""}`;
      else throw Error(`No Markua rendition for ${block.kind}`);
      return replacement;

      async function renderCodeBlock() {
        let code = block.source.path
          ? (
              await assets.read(n.piece!.dir, String(block.source.path))
            ).toString()
          : String(block.source.text);
        code = selectCode(
          code,
          block.source.region ? String(block.source.region) : undefined,
        );
        return `{#${n.id}-${id}}\n{lang="${block.source.language}"}\n\`\`\`\n${code}\n\`\`\``;
      }
    }

    function prepareHeadingsAndCode(
      n: AssemblyNode,
      bookDepth: number,
      body: string,
      noteEdits: TextEdit[] = [],
    ) {
      const headingEdits: TextEdit[] = [...noteEdits];
      visit(n.piece!.ast, (v) => {
        if (v.type !== "containerDirective" || v.name !== "callout") return;
        const start = v.position!.start.offset!;
        const end = v.position!.end.offset!;
        headingEdits.push(
          { start, end: body.indexOf("\n", start), value: "{aside}" },
          {
            start: body.lastIndexOf("\n", end - 1) + 1,
            end,
            value: "{/aside}",
          },
        );
      });
      const headings = new Set<string>();
      visit(n.piece!.ast, (v) => {
        if (v.type === "footnoteDefinition") return "skip";
        if (v.type !== "heading") return;
        const depth = sourceHeadingLevel(
          v.depth,
          Math.max(0, bookDepth - 1),
          n.id,
        );
        const start = v.position!.start.offset!;
        const text = (v.children ?? [])
          .map((c) => ("value" in c ? c.value : ""))
          .join("");
        const slug = bookHeadingSlug(text);
        let unique = slug,
          index = 2;
        while (headings.has(unique)) unique = slug + "-" + index++;
        headings.add(unique);
        headingEdits.push({
          start,
          end: start + v.depth,
          value: `{#${n.id}-${unique}}\n` + "#".repeat(depth),
        });
      });
      const protectedCode = new Map<string, string>();
      visit(n.piece!.ast, (v) => {
        if (v.type === "footnoteDefinition") return "skip";
        if (v.type !== "code" && v.type !== "inlineCode") return;
        const token = `NOTESBOOKCODE${protectedCode.size}END`;
        const start = v.position!.start.offset!,
          end = v.position!.end.offset!;
        protectedCode.set(token, body.slice(start, end));
        headingEdits.push({ start, end, value: token });
      });
      for (const edit of headingEdits.sort((a, b) => b.start - a.start))
        body = body.slice(0, edit.start) + edit.value + body.slice(edit.end);
      return { protectedCode, body };
    }
  },
};
const bookExporters: Record<string, BookExporter> = { markua };
async function inventory(
  folder: string,
  prefix = "",
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await fs.readdir(path.join(folder, prefix), {
    withFileTypes: true,
  })) {
    const file = path.join(prefix, entry.name);
    if (entry.isDirectory())
      Object.assign(result, await inventory(folder, file));
    else if (file !== "edition.json" && file !== "leanpub-job.json")
      result[file] = hash(await fs.readFile(path.join(folder, file)));
  }
  return result;
}
export async function freezeEdition(
  collection: Collection,
  lib: Library,
  edition: string,
  outputRoot = "exports",
  options: {
    preview?: boolean;
    excludePlanned?: boolean;
    exporter?: string;
  } = {},
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(edition))
    throw Error("Invalid edition ID");
  const output = path.resolve(outputRoot, collection.id, edition);
  try {
    await fs.access(output);
    throw Error("Edition already exists; use a new edition ID");
  } catch (caught) {
    const e = asError(caught);
    if (e.code !== "ENOENT") throw e;
  }
  const exporter = bookExporters[options.exporter ?? "markua"];
  if (!exporter) throw Error("Unknown book exporter");
  const stage = output + ".staging-" + Date.now();
  try {
    await exporter.export({
      collection,
      lib,
      output: stage,
      preview: Boolean(options.preview),
      excludePlanned: Boolean(options.excludePlanned),
    });
    const manifest = {
      schemaVersion: 1,
      id: edition,
      collection: collection.id,
      title: collection.title,
      createdAt: new Date().toISOString(),
      sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      collectionHash: hash(JSON.stringify(collection)),
      pieces: Object.fromEntries(
        [...lib.pieces.values()]
          .filter((p) =>
            assemble(collection, lib, "book", {
              preview: options.preview,
              excludePlanned: options.excludePlanned,
            }).nodes.some((n) => n.piece?.id === p.id),
          )
          .map((p) => [
            p.id,
            hash(
              JSON.stringify({
                body: p.body,
                blocks: p.blocks,
                metadata: {
                  ...p,
                  ast: undefined,
                  body: undefined,
                  blocks: undefined,
                  dir: undefined,
                },
              }),
            ),
          ]),
      ),
      exporter: { id: exporter.id, version: exporter.version },
      dependencyLockHash: hash(await fs.readFile("package-lock.json")),
      renderSettings: await readYaml("publishing/renderers.yaml"),
      files: await inventory(stage),
      preview: Boolean(options.preview),
    };
    await fs.writeFile(
      path.join(stage, "edition.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.rename(stage, output);
    return output;
  } catch (e) {
    await fs.rm(stage, { recursive: true, force: true });
    throw e;
  }
}
export async function verifyEdition(folder: string) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(folder, "edition.json"), "utf8"),
  );
  const actual = await inventory(folder);
  if (
    JSON.stringify(Object.entries(actual).sort()) !==
    JSON.stringify(Object.entries(manifest.files).sort())
  )
    throw Error("Edition files differ from frozen manifest");
  return manifest;
}
