import fs from "node:fs/promises";
import path from "node:path";
import { unified } from "unified";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { visit } from "unist-util-visit";
import { codeToHtml } from "shiki";
import {
  parser,
  allowed,
  articleUrl,
  type Library,
  type PublicationDocument,
  type AssemblyNode,
  type Block,
} from "./model";
import { Assets, escape as e, safeUrl } from "./assets";
import { registry } from "../renderers/static";
import type { Registry } from "../renderers/registry";
export type RenderedNode = {
  id: string;
  title: string;
  kind: string;
  number?: string;
  depth: number;
  html: string;
  pieceId?: string;
  planned?: boolean;
};
export type RenderedDocument = {
  id: string;
  title: string;
  nodes: RenderedNode[];
  html: string;
  assets: Record<string, string>;
  blockAssets: Record<string, string>;
};
const role = (b: Block) =>
  b.role ??
  (
    { code: "listing", table: "table", math: "equation" } as Record<
      string,
      string
    >
  )[b.kind] ??
  "figure";
const label = (r: string) =>
  ({
    listing: "Listing",
    table: "Table",
    equation: "Equation",
    figure: "Figure",
  })[r] ?? "Figure";
export async function renderDocument(
  doc: PublicationDocument,
  lib: Library,
  defaults: any,
  assets = new Assets(),
  plugins: Registry = registry(),
): Promise<RenderedDocument> {
  const refs = new Map<
    string,
    {
      anchor: string;
      label: string;
      pieceId: string;
      placement: string;
      blockId: string;
    }
  >();
  const counters: Record<string, number> = {};
  const blockAssets: Record<string, string> = {};
  for (const n of doc.nodes) {
    if (!n.piece) continue;
    const ast = structuredClone(n.piece.ast);
    const seen = new Set<string>();
    visit(ast, (v: any) => {
      if (v.type === "leafDirective" && v.name === "block") {
        const id = v.attributes?.ref;
        if (seen.has(id))
          throw Error(
            `Repeated block ${id} in ${n.id}; use a separate placement`,
          );
        seen.add(id);
        const b = n.piece!.blocks[id];
        if (!b) throw Error(`Missing block ${id}`);
        const r = role(b);
        counters[r] = (counters[r] ?? 0) + 1;
        refs.set(`${n.id}#${id}`, {
          anchor: `${n.id}-${id}`,
          blockId: id,
          label: `${label(r)} ${counters[r]}`,
          pieceId: n.piece!.id,
          placement: n.id,
        });
      }
    });
  }
  const citationEntries = new Map<string, any>();
  let bibliography: any;
  async function cite(key: string) {
    if (!bibliography) {
      try {
        const { Cite } = await import("@citation-js/core");
        await import("@citation-js/plugin-bibtex");
        await import("@citation-js/plugin-csl");
        bibliography = new Cite(
          await fs.readFile("content/references/sources.bib", "utf8"),
        );
      } catch {
        throw Error("Citations require content/references/sources.bib");
      }
    }
    const item = bibliography.data.find((i: any) => i.id === key);
    if (!item) throw Error(`Unknown citation ${key}`);
    if (!citationEntries.has(key)) citationEntries.set(key, item);
    return `<a href="#citation-${e(key)}">[${[...citationEntries.keys()].indexOf(key) + 1}]</a>`;
  }
  function ref(target: string, placement?: string) {
    const [pieceId, block] = target.split("#");
    if (!block) {
      const placements = doc.nodes.filter(
        (n) => n.piece?.id === pieceId && (!placement || n.id === placement),
      );
      if (placements.length > 1)
        throw Error(`Ambiguous reference ${target}; specify placement`);
      if (placements.length === 1)
        return `<a href="#${e(placements[0].id)}">${e(placements[0].title)}</a>`;
    }
    const candidates = [...refs.values()].filter(
      (r) =>
        r.pieceId === pieceId &&
        (!block || r.blockId === block) &&
        (!placement || r.placement === placement),
    );
    if (block && candidates.length > 1)
      throw Error(`Ambiguous reference ${target}; specify placement`);
    if (block && candidates.length === 1)
      return `<a href="#${candidates[0].anchor}">${e(candidates[0].label)}</a>`;
    const p = lib.pieces.get(pieceId);
    if (!p || !allowed(p, "standalone"))
      throw Error(`Reference has no public destination: ${target}`);
    let usedBlock = false;
    if (block)
      visit(p.ast, (v: any) => {
        if (
          v.type === "leafDirective" &&
          v.name === "block" &&
          v.attributes?.ref === block
        )
          usedBlock = true;
      });
    if (block && (!p.blocks[block] || !usedBlock))
      throw Error(`Unknown referenced block ${target}`);
    if (doc.target === "book" && block)
      throw Error(`Book block reference outside assembly: ${target}`);
    return `<a href="${articleUrl(p)}${block ? "#" + p.id + "-" + block : ""}">${e(block ? (p.blocks[block].caption ?? p.title) : p.title)}</a>`;
  }
  const rendered: RenderedNode[] = [];
  for (const node of doc.nodes) {
    let html = "";
    if (node.piece) {
      const piece = node.piece;
      const tree = structuredClone(piece.ast);
      const placeholders = new Map<string, string>();
      let seq = 0;
      const put = (v: any, value: string) => {
        const token = `NOTESRENDER${node.id.replaceAll("-", "")}SLOT${seq++}END`;
        placeholders.set(token, value);
        v.type = "text";
        v.value = token;
        delete v.children;
        delete v.attributes;
        delete v.name;
      };
      const nodes: any[] = [];
      visit(tree, (v: any) => {
        nodes.push(v);
      });
      const headings = new Set<string>();
      for (const v of nodes) {
        if (v.type === "html")
          throw Error(
            `Raw HTML is not part of the portable format (${piece.id})`,
          );
        if (v.type === "heading") {
          if (v.depth === 1)
            throw Error(`Body H1 is reserved for metadata (${piece.id})`);
          const title = (v.children ?? [])
            .map((c: any) => c.value ?? "")
            .join("");
          let slug =
            title
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "section";
          let unique = slug,
            i = 2;
          while (headings.has(unique)) unique = slug + "-" + i++;
          headings.add(unique);
          v.data = { hProperties: { id: `${node.id}-${unique}` } };
          const depth = v.depth + node.depth;
          if (depth > 6)
            throw Error(`Heading depth exceeds six in ${piece.id}`);
          v.depth = depth;
        }
        if (v.type === "image") {
          if (/^https?:/.test(v.url)) {
            safeUrl(v.url);
          } else v.url = await assets.copy(piece.dir, v.url);
          if (!v.alt)
            throw Error(`Image requires alternative text in ${piece.id}`);
        }
        if (v.type === "link" && v.url.startsWith("#"))
          v.url = `#${node.id}-${v.url.slice(1)}`;
        if (v.type === "link") {
          if (/^[a-z][a-z0-9+.-]*:/i.test(v.url)) {
            if (!v.url.startsWith("mailto:")) safeUrl(v.url);
          } else if (!v.url.startsWith("/") && !v.url.startsWith("#"))
            v.url = await assets.copy(piece.dir, v.url);
        }
        if (v.type === "code") {
          const b: Block = {
            kind: "code",
            source: {
              format: "source-code",
              text: v.value,
              language: v.lang ?? "text",
            },
          };
          const chosen = plugins.resolve(
            b,
            doc.target,
            defaults,
            node.preferences,
          );
          put(
            v,
            (
              await chosen.plugin.render({
                block: b,
                target: doc.target,
                options: chosen.options,
                owner: piece.dir,
                assets,
              })
            ).html,
          );
        }
        if (v.type === "leafDirective" && v.name === "block") {
          const id = v.attributes?.ref;
          const b = piece.blocks[id];
          const chosen = plugins.resolve(
            b,
            doc.target,
            defaults,
            node.preferences,
          );
          const rendition = await chosen.plugin.render({
            block: b,
            target: doc.target,
            options: chosen.options,
            owner: piece.dir,
            assets,
          });
          const resolved = refs.get(`${node.id}#${id}`)!;
          if (rendition.asset)
            blockAssets[`${node.id}#${id}`] = rendition.asset;
          put(
            v,
            `<figure class="rich-block" id="${resolved.anchor}">${rendition.html}${b.caption ? `<figcaption><span>${resolved.label}.</span> ${e(b.caption)}</figcaption>` : ""}</figure>`,
          );
        } else if (v.type === "textDirective" && v.name === "ref")
          put(
            v,
            ref(String(v.attributes?.target ?? ""), v.attributes?.placement),
          );
        else if (v.type === "textDirective" && v.name === "cite")
          put(v, await cite(String(v.attributes?.key ?? "")));
        else if (v.type === "textDirective" && v.name === "index")
          put(v, e(v.attributes?.term ?? ""));
        else if (v.type === "textDirective" && v.name === "term") {
          const glossary = await import("./model").then((m) =>
            m.readYaml("content/references/glossary.yaml"),
          );
          const term = glossary.terms?.[v.attributes?.ref];
          if (!term) throw Error("Unknown glossary term");
          put(v, `<abbr title="${e(term.definition)}">${e(term.term)}</abbr>`);
        } else if (v.type.endsWith("Directive"))
          throw Error(`Unknown directive ${v.name}`);
        else if (v.type === "text" && /\[@([^\]]+)\]/.test(v.value)) {
          let result = "",
            last = 0;
          for (const m of v.value.matchAll(/\[@([^\]]+)\]/g)) {
            result += e(v.value.slice(last, m.index)) + (await cite(m[1]));
            last = m.index + m[0].length;
          }
          result += e(v.value.slice(last));
          put(v, result);
        }
      }
      let out = await unified()
        .use(remarkRehype, { clobberPrefix: `${node.id}-fn-` })
        .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: "" })
        .use(rehypeKatex, { throwOnError: true, trust: false })
        .use(rehypeStringify)
        .run(tree);
      html = unified()
        .use(rehypeStringify)
        .stringify(out)
        .replaceAll("footnote-label", `${node.id}-footnote-label`);
      for (const [token, value] of placeholders)
        html = html.replaceAll(token, value);
    }
    rendered.push({
      id: node.id,
      title: node.title,
      kind: node.kind,
      number: node.number,
      depth: node.depth,
      html,
      pieceId: node.piece?.id,
      planned: node.planned,
    });
  }
  let html = rendered
    .map((n) =>
      n.planned
        ? `<p class="planned">${e(n.title)} <span>Planned</span></p>`
        : `<section id="${e(n.id)}">${n.depth ? `<h${Math.min(n.depth + 1, 6)}>${n.number ? e(n.number) + ". " : ""}${e(n.title)}</h${Math.min(n.depth + 1, 6)}>` : ""}${n.html}</section>`,
    )
    .join("\n");
  if (citationEntries.size) {
    const { Cite } = await import("@citation-js/core");
    html += `<section class="bibliography"><h2>References</h2><ol>${[...citationEntries].map(([key, item]) => `<li id="citation-${e(key)}">${new Cite(item).format("bibliography", { format: "html", template: "apa", lang: "en-US" })}</li>`).join("")}</ol></section>`;
  }
  return {
    id: doc.id,
    title: doc.title,
    nodes: rendered,
    html,
    assets: Object.fromEntries(assets.dependencies),
    blockAssets,
  };
}
export async function renderProse(body: string) {
  return String(
    await parser()
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(body),
  );
}
