import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  loadLibrary,
  parser,
  collectionSchema,
  assemble,
  nodeSchema,
} from "../core/model";
import { freezeEdition, verifyEdition } from "../core/books";
import { bookLayout } from "../core/book-format";

test("split articles export as one chapter with original sections, shared notes, a figure and a complete sample", async (t) => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "book-format-"));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  await sharp({
    create: { width: 16, height: 10, channels: 3, background: "white" },
  })
    .png()
    .toFile(path.join(tmp, "figure.png"));
  const lib = await loadLibrary("test/fixtures/manuscript");
  const bodies = [
    'Opening prose.[^shared] Again.[^shared]\n\n## First section\n\n[Details](#first-section). :ref{target="second"}.\n\n```text\n[^shared] and ## not a heading\n```\n\n[^shared]: The same source.\n',
    '## Second section\n\nMore prose.[^shared] A distinct source.[^other]\n\n![A figure](figure.png)\n\n:index{term="Example"}\n\n[^shared]: The same source.\n\n[^other]: Another source with `code`. [Section](#second-section) and ![Note image](figure.png).\n',
    "Final chapter.[^shared]\n\n[^shared]: A different chapter source.\n",
  ];
  for (const [i, id] of ["first", "second", "closing"].entries()) {
    const p = lib.pieces.get(id)!;
    p.body = bodies[i];
    p.ast = parser().parse(p.body);
    p.blocks = {};
    p.dir = tmp;
    p.publication.surfaces = ["book", "collection"];
    p.status = "published";
  }
  const c = collectionSchema.parse({
    schemaVersion: 1,
    id: "split",
    title: "Split book",
    summary: "A split chapter",
    slug: "split",
    book: true,
    completion: "in-progress",
    body: [
      {
        id: "part-one",
        kind: "part",
        title: "Part One",
        children: [
          {
            id: "chapter-one",
            kind: "chapter",
            title: "One complete chapter",
            children: [
              {
                id: "first-half",
                kind: "piece",
                ref: "first",
                bookHeading: "omit",
              },
              {
                id: "second-half",
                kind: "piece",
                ref: "second",
                bookHeading: "omit",
              },
            ],
          },
          {
            id: "chapter-two",
            kind: "chapter",
            title: "The next chapter",
            children: [
              {
                id: "last",
                kind: "piece",
                ref: "closing",
                bookHeading: "omit",
              },
            ],
          },
        ],
      },
    ],
  });
  const output = await freezeEdition(c, lib, "review", tmp);
  assert.equal((await verifyEdition(output)).exporter.version, "3");
  const dir = path.join(output, "manuscript");
  const files = (await fs.readFile(path.join(dir, "Book.txt"), "utf8"))
    .trim()
    .split("\n");
  const text = (
    await Promise.all(files.map((f) => fs.readFile(path.join(dir, f), "utf8")))
  ).join("\n");
  assert.doesNotMatch(
    text,
    /More to come|You’re up to date|This book will continue here/,
  );
  assert.match(text, /\{id: part-one, class: part, sample: true\}\n# Part One/);
  assert.match(
    text,
    /\{id: chapter-one, sample: true\}\n# One complete chapter/,
  );
  assert.match(text, /\{id: chapter-two, sample: false\}\n# The next chapter/);
  assert.equal((text.match(/^# One complete chapter$/gm) ?? []).length, 1);
  assert.match(text, /\{#first-half-first-section\}\n## First section/);
  assert.match(text, /\{#second-half-second-section\}\n## Second section/);
  assert.match(text, /\]\(#second-half-second-section\)/);
  assert.match(text, /\]\(#first-half-first-section\)/);
  assert.match(text, /```text\n\[\^shared\] and ## not a heading\n```/);
  assert.equal((text.match(/The same source\./g) ?? []).length, 1);
  assert.equal(
    (text.match(/\]\(#chapter-one-source-note-1\)/g) ?? []).length,
    3,
  );
  assert.match(
    text,
    /\{#chapter-two-source-note-1\}\n\*\*1\.\*\* A different chapter source/,
  );
  assert.ok(
    text.indexOf("## Second section") < text.indexOf("## Source notes"),
  );
  assert.ok(
    text.indexOf("The same source.") < text.indexOf("# The next chapter"),
  );
  assert.doesNotMatch(text, /\{frontmatter\}|\{part\}|\{#[^}]+\}\n\n#/);
  await assert.rejects(fs.access(path.join(dir, "Sample.txt")));
  const image = text.match(/!\[A figure\]\((resources\/[^)]+)\)/)![1];
  await fs.access(path.join(dir, image));
  const ids = [...text.matchAll(/\{(?:#|id: )([\w-]+)/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const link of text.matchAll(/\]\(#([^)]*)\)/g))
    assert.ok(ids.includes(link[1]), link[1]);
  const web = assemble(c, lib, "web");
  assert.equal(web.nodes.filter((n) => n.piece).length, 3);
  assert.equal(lib.pieces.get("first")!.body, bodies[0]);
});

test("book heading omission is restricted to pieces within chapters or appendices", async () => {
  assert.equal(
    nodeSchema.safeParse({
      id: "part",
      kind: "part",
      title: "Part",
      bookHeading: "omit",
    }).success,
    false,
  );
  const lib = await loadLibrary("test/fixtures/manuscript");
  const c = collectionSchema.parse({
    schemaVersion: 1,
    id: "flat",
    title: "Flat",
    summary: "Flat",
    slug: "flat",
    body: [{ id: "first", kind: "piece", ref: "first", bookHeading: "omit" }],
  });
  assert.throws(
    () => bookLayout(assemble(c, lib, "book").nodes),
    /directly inside a chapter/,
  );
});

test("equal note labels with different evidence remain separate within a chapter", async () => {
  const { bookSourceNotes } = await import("../core/book-format");
  const lib = await loadLibrary("test/fixtures/manuscript");
  for (const [id, source] of [
    ["first", "Source A"],
    ["second", "Source B"],
  ]) {
    const p = lib.pieces.get(id)!;
    p.body = `Claim.[^one]\n\n[^one]: ${source}\n`;
    p.ast = parser().parse(p.body);
  }
  const c = collectionSchema.parse({
    schemaVersion: 1,
    id: "notes",
    title: "Notes",
    summary: "Notes",
    slug: "notes",
    body: [
      {
        id: "ch",
        kind: "chapter",
        title: "Chapter",
        children: [
          { id: "a", kind: "piece", ref: "first" },
          { id: "b", kind: "piece", ref: "second" },
        ],
      },
    ],
  });
  const nodes = assemble(c, lib, "book").nodes;
  const notes = bookSourceNotes(nodes, bookLayout(nodes));
  assert.equal(notes.anchors.size, 2);
  assert.match(notes.after.get("b")!, /\*\*1\.\*\* Source A/);
  assert.match(notes.after.get("b")!, /\*\*2\.\*\* Source B/);
});
