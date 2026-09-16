import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaKey, mediaUrl } from "../core/media";
import { loadLibrary, standalone, parser, readYaml } from "../core/model";
import { renderDocument } from "../core/render";
test("media references are portable and cannot escape their configured origin", () => {
  assert.equal(
    mediaUrl("media:images/one.png", "https://cdn.example.net/assets"),
    "https://cdn.example.net/assets/images/one.png",
  );
  assert.equal(
    mediaUrl("https://other.example/a.png", "https://cdn.example.net"),
    "https://other.example/a.png",
  );
  for (const key of [
    "../private/a.pdf",
    "/private/a.pdf",
    "a/../b",
    "a//b",
    "%2e%2e/a",
    "x?versionId=a",
    "a#x",
    "a\\b",
    "https://evil.example/a",
  ])
    assert.throws(() => mediaKey(key));
  assert.throws(() =>
    mediaUrl("media:x.png", "https://user:password@cdn.example.net"),
  );
});
test("article images, reference images, PDF links and viewers resolve media URLs", async () => {
  const lib = await loadLibrary("test/fixtures/manuscript");
  const piece = lib.pieces.get("first")!;
  piece.body =
    '![Image](media:images/example.png)\n\n![Second][img]\n\n[img]: media:images/second.png\n\n[PDF](media:documents/example.pdf)\n\n::block{ref="paper"}';
  piece.ast = parser().parse(piece.body);
  piece.blocks = {
    paper: {
      kind: "document",
      title: "Paper",
      summary: "A PDF",
      source: { format: "pdf", url: "media:documents/example.pdf" },
    },
  };
  const rendered = await renderDocument(
    standalone(piece),
    lib,
    await readYaml("publishing/renderers.yaml"),
  );
  for (const key of [
    "images/example.png",
    "images/second.png",
    "documents/example.pdf",
  ])
    assert(rendered.html.includes(mediaUrl("media:" + key)));
  assert.doesNotMatch(rendered.html, /media:images|media:documents/);
});
