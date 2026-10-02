import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";
import YAML from "yaml";
import { prepareImport, applyImport } from "../core/content-import";

async function fixture(t: import("node:test").TestContext) {
  const root = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "content-import-test-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const from = path.join(root, "source"),
    to = path.join(root, "destination");
  await fs.mkdir(path.join(from, "pieces"), { recursive: true });
  await fs.mkdir(path.join(from, "collections"), { recursive: true });
  const piece = async (
    id: string,
    body = "A useful article.\n",
    extra: Record<string, unknown> = {},
  ) => {
    const dir = path.join(from, "pieces", id);
    await fs.mkdir(dir, { recursive: true });
    const raw =
      "---\n" +
      YAML.stringify({
        schemaVersion: 1,
        id,
        title: id,
        summary: "A summary",
        status: "draft",
        publication: { surfaces: ["standalone", "collection", "book"] },
        slug: id,
        ...extra,
      }) +
      "---\n" +
      body;
    await fs.writeFile(path.join(dir, "index.md"), raw);
    return dir;
  };
  const collection = async (id: string, ids: string[]) =>
    fs.writeFile(
      path.join(from, "collections", id + ".yaml"),
      YAML.stringify({
        schemaVersion: 1,
        id,
        title: id,
        summary: "A book",
        status: "draft",
        slug: id,
        body: ids.map((ref) => ({ id: ref, kind: "piece", ref })),
      }),
    );
  return { root, from, to, piece, collection };
}
test("collection selection excludes unrelated snapshots, copies binary assets and preserves body, then is idempotent", async (t) => {
  const f = await fixture(t);
  const body = "\n## Heading\n\nExact prose.  \n\n![Diagram](figure.png)\n";
  const dir = await f.piece("intro", body, {
    status: "published",
    publishedAt: "2026-09-20",
  });
  await fs.writeFile(
    path.join(dir, "figure.png"),
    Buffer.from([0, 255, 13, 10]),
  );
  await f.piece("obsolete");
  await f.collection("book", ["intro"]);
  const source = await fs.readFile(path.join(dir, "index.md"), "utf8");
  const p = await prepareImport({ ...f, collections: ["book"] });
  assert.deepEqual(p.plan.selected, ["collection:book", "piece:intro"]);
  await assert.rejects(fs.access(f.to));
  await applyImport(p, p.plan.fingerprint);
  const imported = matter(
    await fs.readFile(path.join(f.to, "pieces/intro/index.md"), "utf8"),
  );
  assert.equal(imported.content, matter(source).content);
  assert.equal(imported.data.draft, true);
  assert.deepEqual(
    await fs.readFile(path.join(f.to, "pieces/intro/figure.png")),
    Buffer.from([0, 255, 13, 10]),
  );
  assert.equal(await fs.readFile(path.join(dir, "index.md"), "utf8"), source);
  assert(
    (await prepareImport({ ...f, collections: ["book"] })).plan.files.every(
      (f) => f.action === "unchanged",
    ),
  );
});
test("all planning omits retired items; selectors and exclusion typos fail", async (t) => {
  const f = await fixture(t);
  await f.piece("active");
  await f.piece("retired", undefined, { status: "retired" });
  assert.deepEqual((await prepareImport(f)).plan.selected, ["piece:active"]);
  await assert.rejects(prepareImport({ ...f, pieces: ["retired"] }), /Retired/);
  await assert.rejects(
    prepareImport({ ...f, excludePieces: ["typo"] }),
    /Unknown/,
  );
  await assert.rejects(
    prepareImport({ ...f, all: true, pieces: ["active"] }),
    /cannot be combined/,
  );
});
test("exclusions cannot leave broken collections, but may reuse an existing dependency", async (t) => {
  const f = await fixture(t);
  await f.piece("intro");
  await f.collection("book", ["intro"]);
  await assert.rejects(
    prepareImport({ ...f, collections: ["book"], excludePieces: ["intro"] }),
    /Required piece/,
  );
  await applyImport(await prepareImport({ ...f, pieces: ["intro"] }));
  const p = await prepareImport({
    ...f,
    collections: ["book"],
    excludePieces: ["intro"],
  });
  assert.deepEqual(p.plan.selected, ["collection:book"]);
  assert(p.plan.warnings.some((x) => x.includes("existing destination")));
  await applyImport(p);
});
test("updates require opt-in and retain existing publication identity and extra files", async (t) => {
  const f = await fixture(t);
  await f.piece("intro");
  await applyImport(await prepareImport(f));
  const target = path.join(f.to, "pieces/intro/index.md");
  const before = matter(await fs.readFile(target, "utf8"));
  delete before.data.draft;
  before.data.status = "published";
  before.data.publishedAt = "2026-09-19";
  before.data.slug = "stable-url";
  await fs.writeFile(target, matter.stringify(before.content, before.data));
  await fs.writeFile(path.join(f.to, "pieces/intro/retained.txt"), "keep");
  await f.piece("intro", "New prose.\n", {
    slug: "new-url",
    publishedAt: "2026-09-20",
  });
  await assert.rejects(prepareImport(f), /--update/);
  const p = await prepareImport({ ...f, update: true });
  await applyImport(p);
  const updated = matter(await fs.readFile(target, "utf8"), {
    engines: { yaml: (s) => YAML.parse(s) },
  });
  assert.equal(updated.data.status, undefined);
  assert.equal(updated.data.draft, undefined);
  assert.equal(updated.data.slug, "stable-url");
  assert.equal(updated.data.publishedAt, "2026-09-19");
  assert.equal(updated.content, "New prose.\n");
  assert.equal(
    await fs.readFile(path.join(f.to, "pieces/intro/retained.txt"), "utf8"),
    "keep",
  );
});
test("combined library rejects duplicate slugs before writing anything", async (t) => {
  const f = await fixture(t);
  await f.piece("one", undefined, { slug: "same" });
  await applyImport(await prepareImport(f));
  await f.piece("two", undefined, { slug: "same" });
  await assert.rejects(
    prepareImport({ ...f, pieces: ["two"] }),
    /Duplicate article slug/,
  );
  await assert.rejects(fs.access(path.join(f.to, "pieces/two")));
});
test("missing Markdown assets, footnotes and block assets fail before copying", async (t) => {
  const f = await fixture(t);
  const dir = await f.piece("intro", "![Missing](missing.png)\n");
  await assert.rejects(prepareImport(f), /intro:/);
  await f.piece("intro", "A statement.[^missing]\n");
  await assert.rejects(prepareImport(f), /intro:/);
  await f.piece("intro");
  await fs.writeFile(
    path.join(dir, "blocks.yaml"),
    YAML.stringify({
      schemaVersion: 1,
      blocks: {
        code: {
          kind: "code",
          source: { path: "missing.py", language: "python" },
        },
      },
    }),
  );
  await assert.rejects(prepareImport(f), /ENOENT/);
  await assert.rejects(fs.access(f.to));
});
test("symlinks and hidden files are rejected instead of copying external or private data", async (t) => {
  const f = await fixture(t);
  const dir = await f.piece("intro");
  await fs.symlink("/etc/hosts", path.join(dir, "leak.txt"));
  await assert.rejects(prepareImport(f), /Symbolic/);
  await fs.unlink(path.join(dir, "leak.txt"));
  await fs.writeFile(path.join(dir, ".env"), "secret");
  await assert.rejects(prepareImport(f), /Hidden/);
});
test("destination changes and mismatched review fingerprints prevent writes", async (t) => {
  const f = await fixture(t);
  await f.piece("intro");
  const p = await prepareImport(f);
  await assert.rejects(applyImport(p, "0".repeat(64)), /plan changed/);
  await fs.mkdir(f.to);
  await fs.writeFile(path.join(f.to, "about.md"), "new concurrent content");
  await assert.rejects(applyImport(p), /Destination changed/);
  await assert.rejects(fs.access(path.join(f.to, "pieces/intro")));
});
test("adaptation dependencies are included and nested roots rejected", async (t) => {
  const f = await fixture(t);
  await f.piece("original");
  await f.piece("adaptation", undefined, { adaptedFrom: "original" });
  assert.deepEqual(
    (await prepareImport({ ...f, pieces: ["adaptation"] })).plan.selected,
    ["piece:adaptation", "piece:original"],
  );
  await assert.rejects(
    prepareImport({ ...f, to: path.join(f.from, "nested") }),
    /non-nested/,
  );
});
test("CLI requires explicit selection for apply and provides a JSON dry run", async (t) => {
  const f = await fixture(t);
  await f.piece("intro");
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/import-content.ts",
        "--from",
        f.from,
        "--to",
        f.to,
        ...args,
      ],
      { encoding: "utf8" },
    );
  const dry = run("--json");
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(JSON.parse(dry.stdout).mode, "dry-run");
  assert.equal(run("--apply").status, 1);
  await assert.rejects(fs.access(f.to));
  const apply = run(
    "--all",
    "--apply",
    "--expect",
    JSON.parse(dry.stdout).fingerprint,
    "--json",
  );
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(JSON.parse(apply.stdout).mode, "applied");
});

test("write failure rolls back earlier additions without deleting unrelated destination data", async (t) => {
  const f = await fixture(t);
  const dir = await f.piece("intro");
  await fs.writeFile(path.join(dir, "asset.txt"), "asset");
  const prepared = await prepareImport(f);
  // An empty directory appearing at a planned file path causes an exclusive add to fail.
  await fs.mkdir(path.join(f.to, "pieces/intro/index.md"), { recursive: true });
  await assert.rejects(applyImport(prepared));
  await assert.rejects(fs.access(path.join(f.to, "pieces/intro/asset.txt")));
  assert(
    (await fs.stat(path.join(f.to, "pieces/intro/index.md"))).isDirectory(),
  );
});

test("block dependencies are carried with the piece and remain readable after copying", async (t) => {
  const f = await fixture(t);
  const dir = await f.piece("intro");
  await fs.mkdir(path.join(dir, "examples"));
  await fs.writeFile(path.join(dir, "examples/example.py"), "print(6)\n");
  await fs.writeFile(
    path.join(dir, "blocks.yaml"),
    YAML.stringify({
      schemaVersion: 1,
      blocks: {
        example: {
          kind: "code",
          source: { path: "examples/example.py", language: "python" },
        },
      },
    }),
  );
  const prepared = await prepareImport(f);
  await applyImport(prepared);
  assert.equal(
    await fs.readFile(
      path.join(f.to, "pieces/intro/examples/example.py"),
      "utf8",
    ),
    "print(6)\n",
  );
});

test("collection import includes its cover and rejects replacement of a conflicting shared asset", async (t) => {
  const f = await fixture(t);
  await f.piece("intro");
  await f.collection("book", ["intro"]);
  const cover = Buffer.from([0, 1, 2, 3]);
  await fs.mkdir(path.join(f.from, "collections/assets"));
  await fs.writeFile(path.join(f.from, "collections/assets/cover.png"), cover);
  await fs.appendFile(
    path.join(f.from, "collections/book.yaml"),
    "cover:\n  path: assets/cover.png\n  alt: The book illustration\n",
  );
  await applyImport(await prepareImport({ ...f, collections: ["book"] }));
  assert.deepEqual(
    await fs.readFile(path.join(f.to, "collections/assets/cover.png")),
    cover,
  );
  assert.match(
    await fs.readFile(path.join(f.to, "collections/book.yaml"), "utf8"),
    /assets\/cover.png/,
  );
  await fs.writeFile(
    path.join(f.from, "collections/assets/cover.png"),
    "different bytes",
  );
  await assert.rejects(
    prepareImport({ ...f, collections: ["book"], update: true }),
    /belongs to other content/,
  );
});
