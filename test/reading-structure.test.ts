import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { load } from "cheerio";
import { readingPlan, sourceHeadingLevel } from "../core/reading-structure";
import {
  assemble,
  collectionSchema,
  loadLibrary,
  nodeSchema,
  parser,
  readYaml,
  validateCollection,
} from "../core/model";
import { renderDocument } from "../core/render";
import { readingHeadings } from "../core/reading-links";
import { freezeEdition } from "../core/books";

async function fixture() {
  const lib = await loadLibrary("test/fixtures/manuscript");
  for (const id of ["first", "second", "closing"]) {
    const p = lib.pieces.get(id)!;
    p.title = "Same title";
    p.body = `Opening ${id}.\n\n## Original section\n\nClosing ${id}.\n`;
    p.ast = parser().parse(p.body);
    p.blocks = {};
    p.status = "published";
    p.publication.surfaces = ["collection", "book"];
  }
  const c = collectionSchema.parse({
    schemaVersion: 1,
    id: "composed",
    title: "Composed",
    summary: "Test",
    slug: "composed",
    book: true,
    ordered: true,
    frontMatter: [{ id: "intro", kind: "piece", ref: "closing" }],
    body: [
      {
        id: "part",
        kind: "part",
        title: "Part",
        children: [
          {
            id: "one",
            kind: "chapter",
            title: "Same title",
            children: [
              { id: "whole", kind: "piece", ref: "first", integration: "body" },
            ],
          },
          {
            id: "two",
            kind: "chapter",
            title: "Split chapter",
            children: [
              {
                id: "opening",
                kind: "piece",
                ref: "first",
                integration: "body",
                title: "Web opening",
              },
              {
                id: "section",
                kind: "piece",
                ref: "closing",
                integration: "section",
                title: "Split chapter",
              },
              {
                id: "continuation",
                kind: "piece",
                ref: "second",
                integration: "body",
              },
            ],
          },
        ],
      },
    ],
    backMatter: [
      {
        id: "appendix",
        kind: "appendix",
        title: "Appendix",
        children: [
          {
            id: "appendix-body",
            kind: "piece",
            ref: "second",
            integration: "body",
          },
        ],
      },
    ],
  });
  return { lib, c };
}

test("whole and split chapter bodies share web/book structure; equal genuine titles remain", async (t) => {
  const { lib, c } = await fixture();
  validateCollection(c, lib.pieces);
  const doc = assemble(c, lib, "web");
  const plan = readingPlan(doc.nodes);
  assert.equal(doc.nodes.find((n) => n.id === "section")!.number, "2.1");
  assert.equal(
    doc.nodes.find((n) => n.id === "continuation")!.number,
    undefined,
  );
  assert.equal(plan.get("whole")!.inContents, false);
  assert.deepEqual(plan.get("opening")!.readingPart, { position: 1, total: 2 });
  assert.equal(plan.get("opening")!.inContents, true);
  assert.equal(plan.get("section")!.headingLevel, 4);
  assert.equal(plan.get("opening")!.headingLevel, null);
  const rendered = await renderDocument(
    doc,
    lib,
    await readYaml("publishing/renderers.yaml"),
  );
  const $ = load(rendered.html);
  assert.equal($("#one > h3").text(), "1. Same title");
  assert.equal($("#whole > h4").length, 1); // Original section, not article title.
  assert.equal($("#whole > h4").text(), "Original section");
  assert.equal($("#opening").text().includes("Web opening"), false);
  assert.equal($("#section > h4").text(), "2.1. Split chapter");
  assert.equal($("#appendix-body > h3").text(), "Original section");
  for (const id of ["whole", "opening", "continuation", "appendix-body"])
    assert.equal($("#" + id).length, 1, "Preserve placement anchor " + id);
  const chapterPlan = readingPlan(doc.nodes, { rootId: "two" });
  const partPlan = readingPlan(doc.nodes, { rootId: "part" });
  const articlePlan = readingPlan(doc.nodes, { rootId: "opening" });
  assert.equal(chapterPlan.get("opening")!.bodyOffset, 0);
  assert.equal(chapterPlan.get("section")!.bodyOffset, 1);
  assert.equal(partPlan.get("opening")!.bodyOffset, 1);
  assert.equal(articlePlan.get("opening")!.headingLevel, 1);
  const opening = rendered.nodes.find((n) => n.id === "opening")!;
  assert.equal(
    load(readingHeadings(opening.html, chapterPlan.get("opening")!.bodyOffset))(
      "h2",
    ).text(),
    "Original section",
  );
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reading-composition-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const edition = await freezeEdition(c, lib, "composition", dir);
  const manuscript = path.join(edition, "manuscript");
  const text = (
    await Promise.all(
      (await fs.readFile(path.join(manuscript, "Book.txt"), "utf8"))
        .trim()
        .split("\n")
        .map((f) => fs.readFile(path.join(manuscript, f), "utf8")),
    )
  ).join("\n");
  assert.equal((text.match(/^# Same title$/gm) ?? []).length, 2); // Introduction article and Chapter 1.
  assert.doesNotMatch(text, /^#+ Web opening$/m);
  assert.match(text, /^## Split chapter$/m); // Intentionally equal section title remains.
  assert.ok(
    text.indexOf("Opening first.", text.indexOf("# Split chapter")) <
      text.indexOf("Opening second.", text.indexOf("# Split chapter")),
  );
  const bookPlan = readingPlan(assemble(c, lib, "book").nodes, {
    target: "book",
  });
  for (const n of doc.nodes)
    assert.equal(plan.get(n.id)!.omit, bookPlan.get(n.id)!.omit);
});

test("invalid integration fails before visibility filtering; legacy omission stays book-only", async () => {
  const { lib, c } = await fixture();
  assert.equal(
    nodeSchema.safeParse({
      id: "bad",
      kind: "chapter",
      title: "Bad",
      integration: "body",
    }).success,
    false,
  );
  assert.equal(
    nodeSchema.safeParse({
      id: "bad",
      kind: "piece",
      ref: "first",
      integration: "body",
      bookHeading: "include",
    }).success,
    false,
  );
  const invalid = collectionSchema.parse({
    ...c,
    body: [
      {
        id: "bad",
        kind: "piece",
        ref: "first",
        integration: "body",
        surfaces: ["standalone"],
      },
    ],
  });
  assert.throws(
    () => validateCollection(invalid, lib.pieces),
    /directly inside/,
  );
  const legacy = [
    { id: "chapter", kind: "chapter", depth: 1 },
    { id: "piece", kind: "piece", depth: 2, bookHeading: "omit" as const },
  ];
  assert.equal(readingPlan(legacy).get("piece")!.headingLevel, 3);
  assert.equal(
    readingPlan(legacy, { target: "book" }).get("piece")!.headingLevel,
    null,
  );
  assert.throws(
    () => readingPlan(legacy, { rootId: "missing" }),
    /Unknown reading root/,
  );
});

test("draft bodies and planned placeholders do not create phantom reading parts", async () => {
  const { lib, c } = await fixture();
  lib.pieces.get("second")!.status = "draft";
  c.body[0].children!.push({
    id: "later",
    kind: "planned",
    title: "Later",
    publicOutline: true,
  });
  const visible = assemble(c, lib, "web");
  const plan = readingPlan(visible.nodes);
  assert.deepEqual(plan.get("opening")!.readingPart, { position: 1, total: 1 });
  assert.equal(plan.get("opening")!.inContents, false);
  assert.equal(plan.has("appendix"), false);
  assert.equal(plan.get("later")!.inContents, true);
  assert.throws(() => assemble(c, lib, "book"), /Unfinished book outline/);
  const preview = assemble(c, lib, "web", { preview: true });
  assert.equal(
    readingPlan(preview.nodes).get("opening")!.readingPart!.total,
    2,
  );
});

test("contextual before/after bodies have their semantic parent and keep reading order", async () => {
  const { lib, c } = await fixture();
  const whole = c.body[0].children![0].children![0];
  whole.before = [
    { id: "before", kind: "piece", ref: "second", integration: "body" },
  ];
  whole.after = [
    { id: "after", kind: "piece", ref: "closing", integration: "body" },
  ];
  validateCollection(c, lib.pieces);
  const plan = readingPlan(assemble(c, lib, "web").nodes);
  assert.equal(plan.get("before")!.parent!.id, "one");
  assert.deepEqual(plan.get("whole")!.readingPart, { position: 2, total: 3 });
  assert.equal(plan.get("after")!.readingPart!.position, 3);
});

test("excessive heading depth fails instead of silently flattening structure", () => {
  assert.throws(
    () => readingPlan([{ id: "deep", kind: "chapter", depth: 6 }]),
    /depth/,
  );
  assert.throws(() => sourceHeadingLevel(6, 1, "deep"), /depth/);
  assert.equal(sourceHeadingLevel(6, 0, "article"), 6);
});

test("multiple parts preserve chapter numbering and contextual heading levels", async () => {
  const { lib, c } = await fixture();
  c.body.push({
    id: "part-two",
    kind: "part",
    title: "Second part",
    children: [
      {
        id: "three",
        kind: "chapter",
        title: "Third chapter",
        children: [
          {
            id: "third-body",
            kind: "piece",
            ref: "first",
            integration: "body",
          },
        ],
      },
    ],
  });
  validateCollection(c, lib.pieces);
  const doc = assemble(c, lib, "web");
  assert.equal(doc.nodes.find((n) => n.id === "three")!.number, "3");
  const web = readingPlan(doc.nodes);
  const book = readingPlan(assemble(c, lib, "book").nodes, { target: "book" });
  assert.equal(web.get("three")!.headingLevel, 3);
  assert.equal(book.get("three")!.headingLevel, 1);
  assert.equal(web.get("third-body")!.headingLevel, null);
  assert.equal(book.get("third-body")!.bodyOffset, 0);
  assert.equal(
    readingPlan(doc.nodes, { rootId: "part-two" }).get("third-body")!
      .bodyOffset,
    1,
  );
});
