export type AudioMap = {
  hash: string;
  segments: {
    id: string;
    placement: string;
    contentHash: string;
    label: string;
  }[];
  audio: { duration: number; timings: { start: number; end: number }[] };
};
export type BookProgress = {
  version: 1;
  edition: string;
  segment: string;
  placement: string;
  contentHash: string;
  offset: number;
  finished: boolean;
  order: string[];
};
export function segmentAt(book: AudioMap, time: number) {
  const found = book.audio.timings.findIndex((t) => time < t.end);
  return found < 0 ? book.segments.length - 1 : found;
}
export function captureProgress(
  book: AudioMap,
  time: number,
  finished = false,
): BookProgress {
  let i = segmentAt(book, time);
  if (book.segments[i].placement === "$closing") {
    i = Math.max(0, i - 1);
    finished = true;
  }
  const s = book.segments[i],
    t = book.audio.timings[i];
  return {
    version: 1,
    edition: book.hash,
    segment: s.id,
    placement: s.placement,
    contentHash: s.contentHash,
    offset: Math.max(0, Math.min(time - t.start, t.end - t.start)),
    finished,
    order: book.segments
      .filter((s) => s.placement !== "$closing")
      .map((s) => s.id),
  };
}
export function readProgress(text: string | null): BookProgress | undefined {
  try {
    const p = JSON.parse(text ?? "null") as BookProgress;
    if (
      !p ||
      p.version !== 1 ||
      ![p.edition, p.segment, p.placement, p.contentHash].every(
        (v) => typeof v === "string",
      ) ||
      !Number.isFinite(p.offset) ||
      p.offset < 0 ||
      typeof p.finished !== "boolean" ||
      !Array.isArray(p.order) ||
      p.order.length > 20000 ||
      !p.order.every((v) => typeof v === "string")
    )
      return;
    return p;
  } catch {
    return;
  }
}
export function restoreProgress(book: AudioMap, saved?: BookProgress) {
  if (!saved) return { time: 0, message: "", resume: false };
  const exact = book.segments.findIndex(
    (s) => s.id === saved.segment && s.contentHash === saved.contentHash,
  );
  if (exact < 0) return relocated(book, saved);
  const t = book.audio.timings[exact];
  if (saved.finished) {
    const next = book.segments.findIndex(
      (s, i) =>
        i > exact && s.placement !== "$closing" && !saved.order.includes(s.id),
    );
    if (next >= 0)
      return {
        time: book.audio.timings[next].start,
        message:
          "New content is ready. Continue where the previous edition ended.",
        resume: true,
      };
  }
  const addedEarlier = book.segments
    .slice(0, exact)
    .some((s) => !saved.order.includes(s.id));
  return {
    time: t.start + Math.min(saved.offset, t.end - t.start),
    message: addedEarlier
      ? "New material was added earlier in the book. Your place is preserved; explore Chapters to find it."
      : saved.finished
        ? "You're up to date with this edition."
        : "",
    resume: true,
  };
}
function relocated(book: AudioMap, saved: BookProgress) {
  let index = book.segments.findIndex((s) => s.placement === saved.placement);
  if (index >= 0)
    return {
      time: book.audio.timings[index].start,
      message:
        "This passage changed. Continue from the start of its reading section.",
      resume: true,
    };
  const old = saved.order.indexOf(saved.segment);
  const survivors = [
    ...saved.order.slice(old + 1),
    ...saved.order.slice(0, Math.max(0, old)).reverse(),
  ];
  for (const id of survivors) {
    index = book.segments.findIndex((s) => s.id === id);
    if (index >= 0) break;
  }
  return {
    time: index >= 0 ? book.audio.timings[index].start : 0,
    message:
      "Your previous passage was removed. A surviving reading boundary is selected.",
    resume: true,
  };
}
export const audioClock = (seconds: number) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60),
    s = String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0");
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${s}`
    : `${minutes}:${s}`;
};
