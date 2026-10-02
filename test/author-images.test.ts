import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import YAML from "yaml";
import { Assets } from "../core/assets";
import { collectionCover } from "../core/collection-cover";
import { collectionSchema } from "../core/model";
import {
  AuthorImages,
  codexImageArgs,
  generatedBytes,
  subscriptionEnv,
} from "../core/author-images";
const file = "content/pieces/sample/index.md";
const text =
  "---\nschemaVersion: 1\nid: sample\ntitle: Sample\nsummary: A synthetic article\ndraft: true\npublication: {surfaces: [standalone]}\n---\nA notebook holds observations.\n";
async function fixture(t: import("node:test").TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "author-images-test-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const d of [
    "content/pieces/sample",
    "content/collections",
    "publishing",
    "site-assets/brand",
    "bin",
    "generated_images",
  ])
    await fs.mkdir(path.join(root, d), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
  await fs.writeFile(
    path.join(root, "publishing/image-style.md"),
    "Blue ink on ivory.",
  );
  const bytes = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#f8f7f4" },
  })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(root, "site-assets/brand/notebooks.png"), bytes);
  for (const cmd of ["codex", "claude", "pi"])
    await fs.writeFile(path.join(root, "bin", cmd), "#!/bin/sh\nexit 0\n", {
      mode: 0o700,
    });
  const oldPath = process.env.PATH,
    oldHome = process.env.CODEX_HOME;
  process.env.PATH = path.join(root, "bin");
  process.env.CODEX_HOME = root;
  t.after(() => {
    process.env.PATH = oldPath;
    if (oldHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = oldHome;
  });
  return { root, bytes };
}
async function done(service: AuthorImages, id: string) {
  for (let i = 0; i < 100; i++) {
    const j = service.get(id);
    if (j.state !== "running") return j;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw Error("Job did not finish");
}
test("image invocation enforces subscription with no shell or API fallback", () => {
  const args = codexImageArgs("/tmp/out", "/tmp/ref.png");
  for (const value of [
    "image_generation",
    'forced_login_method="chatgpt"',
    "features.shell_tool=false",
    "read-only",
    "--ignore-user-config",
    "--image",
  ])
    assert(args.includes(value));
  assert.equal(args.at(-1), "-");
  assert.equal(subscriptionEnv().OPENAI_API_KEY, undefined);
});
test("candidates persist, stay scoped, and insert safely without editing manuscript", async (t) => {
  const { root, bytes } = await fixture(t);
  const service = new AuthorImages(root);
  const c = await service.saveCandidate(file, bytes, "brief");
  assert.equal((await service.list(file)).length, 1);
  assert.equal((await new AuthorImages(root).list(file))[0].id, c.id);
  const inserted = await service.insert(
    file,
    c.id,
    "Notebook [blue]",
    "Caption",
  );
  assert(inserted.markdown.includes("Notebook \\[blue\\]"));
  assert.match(inserted.asset, /^assets\/notebook-blue-[a-f0-9]{20}\.png$/);
  assert.equal(await fs.readFile(path.join(root, file), "utf8"), text);
  assert.equal(
    (await fs.readFile(path.join(root, path.dirname(file), inserted.asset)))
      .length,
    bytes.length,
  );
  await assert.rejects(
    service.saveCandidate(file, Buffer.from("not an image")),
  );
  await assert.rejects(service.record("../../secret"));
  await assert.rejects(service.insert(file, c.id, "", ""));
  await fs.mkdir(path.join(root, "content/pieces/other"));
  await fs.writeFile(path.join(root, "content/pieces/other/index.md"), text);
  await assert.rejects(
    service.insert("content/pieces/other/index.md", c.id, "Description", ""),
    /different article/,
  );
});
test("all brief agents receive unsaved snapshot and generation imports only fresh Codex output", async (t) => {
  const { root, bytes } = await fixture(t);
  let seen = "";
  const runner: typeof import("../core/author-review").runProcess = async (
    command,
    args,
    opts,
  ) => {
    if (args[0] === "login")
      return { stdout: "", stderr: "Logged in using ChatGPT" };
    seen = opts.input;
    const output = args.includes("--output-last-message")
      ? args[args.indexOf("--output-last-message") + 1]
      : "";
    if (args.includes("image_generation")) {
      assert(args.includes("--output-schema"));
      const schema = JSON.parse(
        await fs.readFile(args[args.indexOf("--output-schema") + 1], "utf8"),
      );
      assert.deepEqual(schema.required, [
        "imagePath",
        "altText",
        "filenameStem",
        "error",
      ]);
      const img = path.join(root, "generated_images/test.png");
      await fs.writeFile(img, bytes);
      await fs.writeFile(
        output,
        JSON.stringify({
          imagePath: img,
          altText: "A blue notebook on ivory paper.",
          filenameStem: "notebook-blue-paper",
          error: null,
        }),
      );
    } else if (output) await fs.writeFile(output, "A notebook in blue ink.");
    return { stdout: "A notebook in blue ink.", stderr: "" };
  };
  const service = new AuthorImages(root, runner);
  for (const agent of ["codex", "claude", "pi"]) {
    const j = await service.start({
      file,
      text: text + "Unsaved sentence.",
      kind: "brief",
      agent,
    });
    const result = await done(service, j.id);
    assert.equal(result.state, "complete");
    assert(seen.includes("Unsaved sentence."));
    assert.match(seen, /Canvas: landscape \(3:2\), 1536x1024 pixels/);
    assert.match(seen, /ample breathing room/);
    assert.doesNotMatch(seen, /cover layout requirements/);
    assert.equal(result.brief, "A notebook in blue ink.");
  }
  const j = await service.start({
    file,
    kind: "generate",
    brief: "A notebook.",
  });
  const r = await done(service, j.id);
  assert.equal(r.state, "complete");
  assert(r.candidate);
  assert(seen.includes("Blue ink on ivory."));
  assert(seen.includes("actual generated image"));
  assert.match(seen, /Requested shape: 1536x1024/);
  assert.doesNotMatch(seen, /Do not reserve a blank area for a title/);
  assert.equal(
    (await new AuthorImages(root).record(r.candidate)).altText,
    "A blue notebook on ivory paper.",
  );
  await assert.rejects(
    generatedBytes(path.join(root, file), Date.now()),
    /outside/,
  );
  const old = path.join(root, "generated_images/old.png");
  await fs.writeFile(old, bytes);
  await fs.utimes(old, 0, 0);
  await assert.rejects(generatedBytes(old, Date.now()), /old or invalid/);
});
test("API-key login cannot enable generation, and provider failures do not create candidates", async (t) => {
  const { root } = await fixture(t);
  const service = new AuthorImages(root, async () => ({
    stdout: "Logged in using an API key",
    stderr: "",
  }));
  assert.equal((await service.settings()).available, false);
  await assert.rejects(
    service.start({ file, kind: "generate", brief: "Notebook" }),
    /Sign in/,
  );
  const failing = new AuthorImages(root, async (_cmd, args) => {
    if (args[0] === "login")
      return { stdout: "Logged in using ChatGPT", stderr: "" };
    throw Error("Usage limit reached");
  });
  const j = await failing.start({ file, kind: "generate", brief: "Notebook" });
  assert.equal((await done(failing, j.id)).state, "failed");
  assert.equal((await failing.list(file)).length, 0);
});

test("cancelling generation stops the task without adding a candidate", async (t) => {
  const { root } = await fixture(t);
  const service = new AuthorImages(root, async (_cmd, args, opts) => {
    if (args[0] === "login")
      return { stdout: "Logged in using ChatGPT", stderr: "" };
    return new Promise((_resolve, reject) => {
      if (opts.signal.aborted) reject(Error("Cancelled"));
      else
        opts.signal.addEventListener(
          "abort",
          () => reject(Error("Cancelled")),
          { once: true },
        );
    });
  });
  const job = await service.start({
    file,
    kind: "generate",
    brief: "Notebook",
  });
  service.cancel(job.id);
  assert.equal((await done(service, job.id)).state, "cancelled");
  assert.equal((await service.list(file)).length, 0);
});

test("structured generation failures never create an image candidate", async (t) => {
  const { root } = await fixture(t);
  let result: unknown = {
    imagePath: null,
    altText: null,
    filenameStem: null,
    error: "Image tool unavailable",
  };
  const service = new AuthorImages(root, async (_cmd, args) => {
    if (args[0] === "login")
      return { stdout: "Logged in using ChatGPT", stderr: "" };
    const output = args[args.indexOf("--output-last-message") + 1];
    await fs.writeFile(output, JSON.stringify(result));
    return { stdout: "", stderr: "" };
  });
  for (const response of [
    {
      imagePath: null,
      altText: null,
      filenameStem: null,
      error: "Image tool unavailable",
    },
    { imagePath: null, altText: null, filenameStem: null, error: null },
    {
      imagePath: "/not/a/generated/image.png",
      altText: "A notebook.",
      filenameStem: "notebook-paper",
      error: null,
    },
    {
      imagePath: "/not/a/generated/image.png",
      altText: "A notebook.",
      filenameStem: "notebook-paper",
      error: "Generation failed",
    },
    { imagePath: "/not/a/generated/image.png", error: null },
    {
      imagePath: "/not/a/generated/image.png",
      altText: null,
      filenameStem: null,
      error: null,
    },
    {
      imagePath: "/not/a/generated/image.png",
      altText: "   ",
      filenameStem: "notebook-paper",
      error: null,
    },
    {
      imagePath: "/not/a/generated/image.png",
      altText: "A notebook.",
      filenameStem: "../../escape",
      error: null,
    },
    {
      imagePath: "/not/a/generated/image.png",
      altText: "A notebook.",
      filenameStem: null,
      error: null,
    },
    { unrelated: true },
  ]) {
    result = response;
    const job = await service.start({
      file,
      kind: "generate",
      brief: "A notebook.",
    });
    const final = await done(service, job.id);
    assert.equal(final.state, "failed");
    assert.equal(final.candidate, undefined);
    assert.equal((await service.list(file)).length, 0);
  }
});

test("collection covers reuse image candidates, preserve unsaved YAML, and keep assignment explicit", async (t) => {
  const { root, bytes } = await fixture(t);
  const book = "content/collections/book.yaml";
  const original =
    "# Keep this comment\nschemaVersion: 1\nid: book\nslug: book\ntitle: Whole book\nsummary: A history of ideas\nbook: true\ndraft: true\nbody: []\n";
  await fs.writeFile(path.join(root, book), original);
  let prompt = "";
  const service = new AuthorImages(root, async (_cmd, args, opts) => {
    if (args[0] === "login")
      return { stdout: "Logged in using ChatGPT", stderr: "" };
    if (args.includes("image_generation")) {
      const imagePath = path.join(root, "generated_images/cover.png");
      await fs.writeFile(imagePath, bytes);
      await fs.writeFile(
        args[args.indexOf("--output-last-message") + 1],
        JSON.stringify({
          imagePath,
          altText: "Generated book cover",
          filenameStem: "mechanical-calculator-book-pages",
          error: null,
        }),
      );
    }
    prompt = opts.input;
    return { stdout: "A cover spanning the whole work.", stderr: "" };
  });
  const unsaved = original.replace("Whole book", "Unsaved book title");
  const job = await service.start({
    file: book,
    text: unsaved,
    kind: "brief",
    agent: "claude",
  });
  assert.equal((await done(service, job.id)).state, "complete");
  assert.match(prompt, /as a whole/);
  assert.match(prompt, /Unsaved book title/);
  assert.match(prompt, /Canvas: portrait \(2:3\), 1024x1536 pixels/);
  assert.match(prompt, /occupy most of the canvas in both dimensions/);
  assert.match(prompt, /Do not reserve a blank area for a title/);
  const generated = await service.start({
    file: book,
    kind: "generate",
    brief: "A long horizontal arrangement of objects on a shared ground line.",
  });
  const finished = await done(service, generated.id);
  assert.equal(finished.state, "complete");
  assert.match(prompt, /Requested shape: 1024x1536/);
  assert.match(prompt, /Build a vertical composition/);
  assert.match(prompt, /conflicting horizontal arrangement in the brief/);
  assert.match(prompt, /A long horizontal arrangement of objects/);
  const candidate = await service.record(finished.candidate!);
  assert.equal(candidate.altText, "Generated book cover");
  assert.equal((await service.list(book))[0].id, candidate.id);
  assert.equal((await service.list(file)).length, 0);
  for (const size of ["1024x1024", "1536x1024"]) {
    const shaped = await service.start({
      file: book,
      kind: "brief",
      agent: "claude",
      text: unsaved,
      size,
    });
    assert.equal((await done(service, shaped.id)).state, "complete");
    assert.match(prompt, /occupy most of the canvas in both dimensions/);
    assert.match(
      prompt,
      size === "1024x1024"
        ? /Canvas: square \(1:1\)/
        : /Canvas: landscape \(3:2\)/,
    );
    assert.doesNotMatch(prompt, /Build a vertical composition/);
  }
  const assigned = await service.cover(
    book,
    candidate.id,
    "Blue book illustration",
    unsaved,
  );
  assert.match(assigned.text, /# Keep this comment/);
  assert.match(assigned.text, /title: Unsaved book title/);
  assert.match(
    assigned.text,
    /path: assets\/mechanical-calculator-book-pages-/,
  );
  assert.match(assigned.text, /alt: Blue book illustration/);
  const parsed = collectionSchema.parse(YAML.parse(assigned.text));
  const compiled = await collectionCover(
    parsed.cover,
    path.join(root, "content/collections"),
    new Assets(path.join(root, "rendered")),
  );
  assert.equal(compiled?.alt, "Blue book illustration");
  assert.equal(compiled?.width, 20);
  assert.match(compiled.src, /^\/media\/.+\.webp$/);
  assert.throws(() =>
    collectionSchema.parse({
      ...YAML.parse(assigned.text),
      cover: { path: "assets/../../secret.png", alt: "Unsafe" },
    }),
  );
  assert.equal(await fs.readFile(path.join(root, book), "utf8"), original);
  const removed = await service.cover(book, null, "", assigned.text);
  assert.doesNotMatch(removed.text, /cover:/);
  assert.match(removed.text, /title: Unsaved book title/);
  await assert.rejects(
    service.cover(book, candidate.id, "", unsaved),
    /description/,
  );
  await assert.rejects(
    service.cover(
      book,
      candidate.id,
      "Description",
      unsaved.replace("id: book", "id: other"),
    ),
    /ID cannot change/,
  );
  await assert.rejects(
    service.insert(book, candidate.id, "Description", ""),
    /cover assignment/,
  );
  const articleCandidate = await service.saveCandidate(file, bytes);
  await assert.rejects(
    service.cover(book, articleCandidate.id, "Description", unsaved),
    /different article or collection/,
  );
});
