import test from "node:test";
import assert from "node:assert/strict";
import { audiobookExcerpt } from "../core/audiobook-excerpt";
import type { PublicAudiobook } from "../core/audiobook-store";

test("chapter excerpts contain only their descendants with relative timings", () => {
  const book = {
    bookId: "book",
    title: "Book",
    partial: ["ch1"],
    segments: ["$opening", "ch1", "p1", "p1", "p2", "ch2", "$closing"].map(
      (placement, i) => ({ id: String(i), placement }),
    ),
    audio: {
      duration: 70,
      timings: Array.from({ length: 7 }, (_, i) => ({
        start: i * 10,
        end: (i + 1) * 10,
      })),
    },
  } as PublicAudiobook;
  const nodes = [
    { id: "ch1", title: "First", depth: 1, kind: "chapter" },
    { id: "p1", title: "One", depth: 2, kind: "piece" },
    { id: "p2", title: "Two", depth: 2, kind: "piece" },
    { id: "ch2", title: "Second", depth: 1, kind: "chapter" },
  ];
  const chapter = audiobookExcerpt(book, nodes, "ch1")!;
  assert.equal(chapter.offset, 10);
  assert.equal(chapter.audio.duration, 40);
  assert.equal(chapter.listenLabel, "Listen to this chapter");
  assert.deepEqual(
    chapter.segments.map((s) => s.placement),
    ["ch1", "p1", "p1", "p2"],
  );
  assert.deepEqual(chapter.audio.timings[0], { start: 0, end: 10 });
  assert.deepEqual(chapter.audio.timings.at(-1), { start: 30, end: 40 });
  const section = audiobookExcerpt(book, nodes, "p1")!;
  assert.equal(section.offset, 20);
  assert.equal(section.audio.duration, 20);
  assert.equal(section.listenLabel, "Listen to this section");
  assert.equal(audiobookExcerpt(undefined, nodes, "ch1"), undefined);
  assert.equal(audiobookExcerpt(book, nodes, "missing"), undefined);
  assert.equal(
    audiobookExcerpt(
      book,
      [{ id: "empty", title: "Empty", depth: 1, kind: "chapter" }],
      "empty",
    ),
    undefined,
  );
  assert.equal(book.audio.duration, 70);
});
