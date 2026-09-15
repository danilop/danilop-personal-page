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
