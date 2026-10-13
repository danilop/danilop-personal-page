import { sourceHeadingLevel } from "./reading-structure";
export function readingLinks(
  html: string,
  collectionUrl: string,
  localIds: string[],
) {
  const ids = new Set(localIds);
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
  return html.replace(/href="#([^"]+)"/g, (all, id) =>
    ids.has(id) ? all : `href="${collectionUrl}#${id}"`,
  );
}

// A standalone reading page starts beneath its own H1, irrespective of where
// the piece occurs in the collection. Only authored headings carry this marker;
// generated footnote labels share that level; rich-block headings stay intact.
export function readingHeadings(html: string, offset = 0) {
  return html.replace(
    /<h([2-6])([^>]*\bdata-source-heading="([2-6])"[^>]*)>([\s\S]*?)<\/h\1>/g,
    (_, _level, attributes, source, body) => {
      const level = sourceHeadingLevel(Number(source), offset, "article");
      return `<h${level}${attributes}>${body}</h${level}>`;
    },
  );
}
