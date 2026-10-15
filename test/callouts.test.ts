import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { load } from "cheerio";
import { visit } from "unist-util-visit";
import {
  parser,
  loadLibrary,
  standalone,
  collectionSchema,
} from "../core/model";
import { renderDocument, renderProse } from "../core/render";
import { speechDocument, settingsSchema } from "../core/narration-speech";
import { freezeEdition, verifyEdition } from "../core/books";

const paragraph =
  "A **useful principle**, with [its source](https://example.com).";
const wrap = (text: string) =>
  `::: {.callout-note appearance="simple" icon="false"}\n${text}\n:::`;

test("portable callouts preserve original source offsets, Markdown children and literal code", () => {
  const body = `Before.\n\n${wrap(paragraph)}\n\n## Afterwards\n\n\`\`\`text\n${wrap("literal")}\n\`\`\`\n`;
  for (const source of [body, body.replaceAll("\n", "\r\n")]) {
    const ast = parser().parse(source);
    const notes = ast.children.filter((n) => n.type === "containerDirective");
    assert.equal(notes.length, 1);
    visit(ast, "heading", (n) =>
      assert.equal(
        source.slice(n.position!.start.offset, n.position!.end.offset),
        "## Afterwards",
      ),
    );
    visit(ast, "code", (n) =>
      assert.equal(n.value.replaceAll("\r\n", "\n"), wrap("literal")),
    );
    visit(ast, "link", (n) =>
      assert.equal(
        source.slice(n.position!.start.offset, n.position!.end.offset),
        "[its source](https://example.com)",
      ),
    );
  }
  assert.throws(
    () => parser().parse(wrap("One") + "\n\n::: {.callout-note}\nUnclosed"),
    /closing/,
  );
  assert.throws(() => parser().parse(wrap(wrap("Nested"))), /Nested/);
  for (const attrs of [
    ".callout-warning",
    '.callout-note icon="true"',
    '.callout-note appearance="default"',
    '.callout-note onclick="evil"',
    '.callout-note title="Title"',
  ])
    assert.throws(
      () => parser().parse(`::: {${attrs}}\nText\n:::`),
      /Supported callout/,
    );
});

test("web/book HTML and Markua preserve a callout exactly once; narration is unchanged", async (t) => {
  assert.equal(
    load(await renderProse(wrap(paragraph)))(".text-callout").length,
    1,
  );
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "callouts-"));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const lib = await loadLibrary("test/fixtures/manuscript");
  const piece = lib.pieces.get("first")!;
  piece.blocks = {};
  const plain = `Before.\n\n${paragraph}\n\nAfterwards.`;
  piece.body = plain;
  const speechBefore = await speechDocument(
    tmp,
    piece,
    lib,
    settingsSchema.parse({}),
  );
  piece.body = `Before.\n\n${wrap(paragraph)}\n\nAfterwards.`;
  piece.ast = parser().parse(piece.body);
  const speechAfter = await speechDocument(
    tmp,
    piece,
    lib,
    settingsSchema.parse({}),
  );
  assert.deepEqual(speechAfter.segments, speechBefore.segments);
  assert.equal(speechAfter.speechHash, speechBefore.speechHash);
  assert.deepEqual(speechAfter.issues, []);
  for (const target of ["web", "book"] as const) {
    const doc = standalone(piece);
    doc.target = target;
    const result = await renderDocument(doc, lib, {});
    const $ = load(result.html);
    assert.equal($(".text-callout").length, 1);
    assert.equal($(".text-callout strong").text(), "useful principle");
    assert.equal($(".text-callout a").attr("href"), "https://example.com");
    assert.doesNotMatch(result.html, /appearance=|icon=|:::/);
  }
  // Content after a wrapper must still use offsets into the unmodified source.
  piece.body +=
    '\n\n## Following section\n\n```python\nprint("still code")\n```\n';
  piece.ast = parser().parse(piece.body);
  const collection = collectionSchema.parse({
    schemaVersion: 1,
    id: "notes",
    title: "Notes",
    summary: "Notes",
    slug: "notes",
    book: true,
    status: "published",
    body: [{ id: "first-use", kind: "piece", ref: "first" }],
  });
  const output = await freezeEdition(collection, lib, "test", tmp);
  await verifyEdition(output);
  const text = await fs.readFile(
    path.join(output, "manuscript/001-first-use.md"),
    "utf8",
  );
  assert.equal((text.match(/\{aside\}/g) ?? []).length, 1);
  assert.match(text, /\{aside\}\nA \*\*useful principle\*\*/);
  assert.match(text, /\{\/aside\}/);
  assert.match(text, /Following section/);
  assert.match(text, /```python\nprint\("still code"\)\n```/);
  assert.doesNotMatch(text, /callout-note|appearance=|icon=|:::/);
});
