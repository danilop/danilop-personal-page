import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { load } from "cheerio";
import YAML from "yaml";
import {
  buildTagInventory,
  parseTagRegistry,
  readTagPieces,
  renderTagList,
  type TagPiece,
} from "../core/tags";
import { renderTagReview } from "../core/tag-review";

const rawRegistry = {
  schemaVersion: 1,
  tags: [
    {
      id: "python",
      label: "Python",
      description: "Python examples and guidance.",
      aliases: ["python3"],
    },
    {
      id: "data-representation",
      label: "Data representation",
      description: "Encoding and interpreting information.",
    },
    {
      id: "unused",
      label: "Unused",
      description: "A registered topic awaiting content.",
    },
  ],
};
const registry = parseTagRegistry(rawRegistry);
function piece(
  id: string,
  tags: string[],
  status: TagPiece["status"] = "draft",
): TagPiece {
  return {
    id,
    tags,
    status,
    title: id,
    summary: "Example piece",
    sources: [id],
    fingerprint: id,
  };
}

test("usage counts unique pieces and aliases once, keeps statuses separate, includes unused vocabulary", () => {
  const p = piece("one", ["python", "Python", "python3"], "published");
  const inventory = buildTagInventory(
    [p, p, piece("two", ["python"]), piece("old", ["python"], "retired")],
    registry,
  );
  const row = inventory.rows.find((r) => r.id === "python")!;
  assert.deepEqual([row.published, row.draft, row.retired], [1, 1, 1]);
  assert.equal(row.pieces.length, 3);
  assert.equal(inventory.rows.find((r) => r.id === "unused")!.pieces.length, 0);
  assert.equal(
    inventory.reviews.one.filter((f) => f.kind === "duplicate").length,
    2,
  );
  assert(!inventory.reviews.one.some((f) => f.kind === "first-use"));
  assert.throws(
    () => buildTagInventory([p, { ...p, fingerprint: "changed" }], registry),
    /Conflicting sources/,
  );
});

test("new and similar tags produce editorial suggestions without rewriting assignments", () => {
  const p = piece("new", ["pythn", "Data representation"]);
  const inventory = buildTagInventory([p], registry);
  assert(
    inventory.reviews.new.some(
      (f) => f.kind === "similar" && f.message.includes("python"),
    ),
  );
  assert(inventory.reviews.new.some((f) => f.kind === "unregistered"));
  assert(
    inventory.reviews.new.some(
      (f) => f.kind === "variant" && f.message.includes("data-representation"),
    ),
  );
  assert(inventory.reviews.new.some((f) => f.kind === "first-use"));
  assert.deepEqual(p.tags, ["pythn", "Data representation"]);
});

test("registry rejects duplicate identities and ambiguous aliases or labels", () => {
  assert.throws(
    () =>
      parseTagRegistry({
        ...rawRegistry,
        tags: [rawRegistry.tags[0], rawRegistry.tags[0]],
      }),
    /Duplicate tag ID/,
  );
  assert.throws(
    () =>
      parseTagRegistry({
        ...rawRegistry,
        tags: [
          ...rawRegistry.tags,
          {
            id: "other",
            label: "Other",
            description: "Other",
            aliases: ["Python"],
          },
        ],
      }),
    /Ambiguous/,
  );
  assert.throws(() =>
    parseTagRegistry({
      ...rawRegistry,
      tags: [{ id: "Python", label: "Python", description: "x" }],
    }),
  );
});

test("public labels and private report escape authored text and have no fake tag links", () => {
  const html = renderTagList(
    ["python", "python3", "<script>alert(1)</script>"],
    registry,
  );
  const $ = load(html);
  assert.equal($("li").length, 2);
  assert.equal($("script,a").length, 0);
  assert.equal($("li").first().text(), "Python");
  assert.equal(renderTagList([], registry), "");
  const p = piece("hostile", ["python"]);
  p.title = "</script><script>alert(1)</script>";
  const report = load(renderTagReview(buildTagInventory([p], registry)));
  assert.equal(
    report('meta[name="robots"]').attr("content"),
    "noindex,nofollow",
  );
  assert.equal(report("script").length, 2);
  assert.equal(
    JSON.parse(report("#inventory-data").text()).pieces[0].title,
    p.title,
  );
});

async function writePiece(root: string, id: string, tags = ["python"]) {
  const file = path.join(root, "pieces", id, "index.md");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    "---\n" +
      YAML.stringify({
        schemaVersion: 1,
        id,
        title: id,
        summary: "Example",
        status: "draft",
        publication: { surfaces: ["book"] },
        tags,
      }) +
      "---\nPrivate prose sentinel.\n",
  );
  return file;
}

test("inventory discovers only selected canonical pieces, deduplicates identical copies, rejects stale copies", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tag-sources-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = await writePiece(path.join(dir, "content"), "one");
  await writePiece(path.join(dir, "exports"), "snapshot");
  const copy = path.join(dir, "copy.md");
  await fs.copyFile(file, copy);
  const pieces = await readTagPieces([path.join(dir, "content")], [file, copy]);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].sources.length, 2);
  assert(!JSON.stringify(pieces).includes("Private prose sentinel"));
  await fs.appendFile(copy, "Changed\n");
  await assert.rejects(
    () => readTagPieces([path.join(dir, "content")], [copy]),
    /Conflicting sources/,
  );
  await writePiece(path.join(dir, "bad"), "bad", [" "]);
  await assert.rejects(
    () => readTagPieces([path.join(dir, "bad")]),
    /Empty tag/,
  );
});

test("CLI writes only the private review directory and validates review selection/options", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tag-cli-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = await writePiece(path.join(dir, "content"), "one");
  const before = await fs.readFile(file, "utf8");
  await fs.writeFile(
    path.join(dir, "registry.yaml"),
    YAML.stringify(rawRegistry),
  );
  const args = [
    "--import",
    createRequire(import.meta.url).resolve("tsx"),
    path.resolve("scripts/tags.ts"),
    "--registry",
    "registry.yaml",
  ];
  const result = execFileSync(
    process.execPath,
    [...args, "--review", "one", "--json"],
    { cwd: dir, encoding: "utf8" },
  );
  assert.equal(
    JSON.parse(result).rows.find(
      (r: { id: string; draft: number }) => r.id === "python",
    ).draft,
    1,
  );
  assert(
    (
      await fs.readFile(path.join(dir, "exports/tag-review/index.html"), "utf8")
    ).includes("Tag review"),
  );
  assert.equal(await fs.readFile(file, "utf8"), before);
  assert.throws(
    () =>
      execFileSync(process.execPath, [...args, "--review", "missing"], {
        cwd: dir,
        stdio: "pipe",
      }),
    /Command failed/,
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [...args, "--wat"], {
        cwd: dir,
        stdio: "pipe",
      }),
    /Command failed/,
  );
  await assert.rejects(() => fs.access(path.join(dir, "dist")));
});
