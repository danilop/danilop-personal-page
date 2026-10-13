import type { CollectionData } from "./site-data";

/** Reader-facing book status is independent of publication and manuscript prose. */
export function bookProgress(
  collection: Pick<CollectionData, "book" | "completion">,
) {
  if (!collection.book) return undefined;
  switch (collection.completion) {
    case "in-progress":
      return {
        contents: "More to come",
        title: "You’re up to date",
        message: "This book will continue here.",
      };
    case "complete":
      return {
        contents: "Complete book",
        title: "End of the book",
        message: "You’ve reached the end of this book.",
      };
    default:
      return {
        contents: undefined,
        title: undefined,
        message: "You’ve reached the last available part of this book.",
      };
  }
}

/** Reading order follows visible placements, including contextual openings. */
export function readingContext(collection: CollectionData, nodeId: string) {
  const { nodes } = collection;
  const start = nodes.findIndex((n) => n.id === nodeId);
  if (start < 0) throw Error(`Unknown reading placement ${nodeId}`);
  const node = nodes[start];
  let end = start + 1;
  if (node.kind !== "piece") {
    while (end < nodes.length && nodes[end].depth > node.depth) end++;
  }
  const readable = (n: CollectionData["nodes"][number]) =>
    n.kind === "piece" && !n.planned;
  const reading = nodes.filter(readable);
  const children = nodes.slice(start + 1, end);
  let parent: CollectionData["nodes"][number] | undefined;
  for (let i = start - 1; i >= 0; i--) {
    if (nodes[i].depth < node.depth) {
      parent = nodes[i];
      break;
    }
  }
  const previous = collection.ordered
    ? nodes.slice(0, start).filter(readable).at(-1)
    : undefined;
  const next = collection.ordered ? nodes.slice(end).find(readable) : undefined;
  return {
    children,
    parent,
    previous,
    next,
    position: reading.findIndex((n) => n.id === nodeId) + 1,
    total: reading.length,
    finished:
      collection.ordered &&
      !next &&
      (readable(node) || children.some(readable)),
  };
}
