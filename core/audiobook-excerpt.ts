import type { PublicAudiobook } from "./audiobook-store";

export type ListeningAudio = PublicAudiobook & {
  offset?: number;
  scope?: string;
  listenLabel?: string;
};

/** Reuse a contiguous chapter/section of the book recording, with local timings. */
export function audiobookExcerpt(
  book: PublicAudiobook | undefined,
  nodes: { id: string; title: string; depth: number; kind: string }[],
  id: string,
): ListeningAudio | undefined {
  if (!book) return;
  const index = nodes.findIndex((node) => node.id === id);
  if (index < 0) return;
  const node = nodes[index];
  const placements = new Set([id]);
  for (const child of nodes.slice(index + 1)) {
    if (child.depth <= node.depth) break;
    placements.add(child.id);
  }
  const first = book.segments.findIndex((s) => placements.has(s.placement));
  if (first < 0) return;
  let end = first + 1;
  while (
    end < book.segments.length &&
    placements.has(book.segments[end].placement)
  )
    end++;
  const offset = book.audio.timings[first].start;
  return {
    ...book,
    title: node.title,
    scope: id,
    offset,
    listenLabel:
      node.kind === "chapter"
        ? "Listen to this chapter"
        : "Listen to this section",
    segments: book.segments.slice(first, end),
    partial: book.partial.filter((p) => placements.has(p)),
    audio: {
      ...book.audio,
      duration: book.audio.timings[end - 1].end - offset,
      timings: book.audio.timings
        .slice(first, end)
        .map((t) => ({ start: t.start - offset, end: t.end - offset })),
    },
  };
}
