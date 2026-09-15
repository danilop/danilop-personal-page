import fs from "node:fs/promises";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-csl";
import { readYaml, type PublicationDocument } from "./model";
export async function bookMatter(doc: PublicationDocument) {
  const citations = new Set<string>(),
    terms = new Set<string>(),
    index = new Map<string, string[]>();
  for (const n of doc.nodes) {
    if (!n.piece) continue;
    const body = n.piece.body;
    for (const m of body.matchAll(/\[@([^\]]+)\]|:cite\{key="([^"]+)"\}/g))
      citations.add(m[1] ?? m[2]);
    for (const m of body.matchAll(/:term\{ref="([^"]+)"\}/g)) terms.add(m[1]);
    for (const m of body.matchAll(/:index\{term="([^"]+)"\}/g)) {
      const refs = index.get(m[1]) ?? [];
      refs.push(n.id);
      index.set(m[1], refs);
    }
  }
  let bib: any;
  if (citations.size) {
    bib = new Cite(await fs.readFile("content/references/sources.bib", "utf8"));
    for (const key of citations)
      if (!bib.data.some((x: any) => x.id === key))
        throw Error("Unknown citation " + key);
  }
  let glossary: Record<string, { term: string; definition: string }> = {};
  if (terms.size)
    glossary = (await readYaml("content/references/glossary.yaml")).terms;
  const citation = (key: string) => {
    if (!citations.has(key)) throw Error("Unregistered citation");
    return `[${[...citations].indexOf(key) + 1}](#citation-${key})`;
  };
  const term = (key: string) => {
    if (!glossary[key]) throw Error("Missing glossary term " + key);
    return `[${glossary[key].term}](#term-${key})`;
  };
  const sections = {
    bibliography: citations.size
      ? "# References\n\n" +
        [...citations]
          .map(
            (key) =>
              `{#citation-${key}}\n${[...citations].indexOf(key) + 1}. ${new Cite(bib.data.find((x: any) => x.id === key)).format("bibliography", { format: "text", template: "apa", lang: "en-US" }).trim()}`,
          )
          .join("\n\n")
      : "",
    glossary: terms.size
      ? "# Glossary\n\n" +
        [...terms]
          .sort()
          .map((key) => {
            term(key);
            return `{#term-${key}}\n## ${glossary[key].term}\n\n${glossary[key].definition}`;
          })
          .join("\n\n")
      : "",
    index: index.size
      ? "# Index\n\n" +
        [...index]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([term, refs]) =>
              `* ${term}: ${[...new Set(refs)].map((ref) => `[${doc.nodes.find((n) => n.id === ref)!.title}](#${ref})`).join(", ")}`,
          )
          .join("\n")
      : "",
  };
  return { sections, citation, term };
}
