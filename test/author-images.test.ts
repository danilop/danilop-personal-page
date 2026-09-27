import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
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
      const img = path.join(root, "generated_images/test.png");
      await fs.writeFile(img, bytes);
      await fs.writeFile(output, JSON.stringify({ imagePath: img }));
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
