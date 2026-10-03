import { repositoryFixture } from "./repository-fixture";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { load } from "cheerio";
import sharp from "sharp";
import { chromium } from "playwright";
import { executablePath } from "puppeteer";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";
const root = process.cwd();
async function unusedPort() {
  const socket = net.createServer();
  await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const address = socket.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return address.port;
}

test(
  "author server authenticates local writes and keeps preview, revision history, and draft deletion recoverable",
  { timeout: 240000 },
  async (t) => {
    const snapshot = await repositoryFixture(root);

    const file = "content/pieces/server-fixture/index.md";
    const original =
      "---\nschemaVersion: 1\nid: server-fixture\ntitle: Server fixture\nsummary: Local integration fixture\ndraft: true\nslug: server-fixture\npublication: {surfaces: [standalone, collection, book]}\n---\n\n![Draft fixture artwork](illustration.png)\n\n## A heading\n\nOriginal local text.\n";
    await fs.mkdir(path.dirname(path.join(snapshot.dir, file)), {
      recursive: true,
    });
    await fs.writeFile(path.join(snapshot.dir, file), original);
    await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#123456" },
    })
      .png()
      .toFile(path.join(snapshot.dir, path.dirname(file), "illustration.png"));
    await fs.writeFile(
      path.join(snapshot.dir, "publishing/home.yaml"),
      "schemaVersion: 1\nlead: server-fixture\nrecentCount: 3\nelsewhereCount: 4\ncollections: []\n",
    );
    const bookFile = "content/collections/cover-fixture.yaml";
    const bookText =
      "# Cover fixture\nschemaVersion: 1\nid: cover-fixture\nslug: cover-fixture\ntitle: Cover fixture\nsummary: A whole book\nbook: true\nordered: true\ndraft: true\nbody:\n  - {id: opening, kind: piece, ref: server-fixture}\n";
    await fs.writeFile(path.join(snapshot.dir, bookFile), bookText);
    const imageState = path.join(snapshot.dir, ".authoring-state/images");
    async function expiredCandidate(color: string) {
      const bytes = await sharp({
        create: { width: 3, height: 2, channels: 3, background: color },
      })
        .png()
        .toBuffer();
      const id = crypto.randomUUID();
      await fs.mkdir(imageState, { recursive: true });
      await fs.writeFile(path.join(imageState, id + ".png"), bytes);
      await fs.writeFile(
        path.join(imageState, id + ".json"),
        JSON.stringify({
          id,
          file,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          created: new Date(Date.now() - 10 * 86400000).toISOString(),
          width: 3,
          height: 2,
          model: "Cleanup fixture",
          brief: "",
        }),
      );
      return id;
    }
    const startupCandidate = await expiredCandidate("#5a23ab");
    const port = await unusedPort(),
      origin = `http://127.0.0.1:${port}`;
    const env = isolatedGitEnvironment(root);
    delete env.CI;
    delete env.AWS_BRANCH;
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        path.join(root, "test/fixtures/server-coverage.mjs"),
        path.join(root, "scripts/author.ts"),
        "--port",
        String(port),
      ],
      { cwd: snapshot.dir, env, stdio: ["ignore", "pipe", "pipe", "ipc"] },
    );
    let log = "";
    assert(child.stdout && child.stderr);
    child.stdout.on("data", (d) => {
      log += d;
    });
    child.stderr.on("data", (d) => {
      log += d;
    });
    t.after(async () => {
      try {
        if (child.connected) {
          const flushed = once(child, "message", {
            signal: AbortSignal.timeout(5000),
          });
          child.send("flush-coverage");
          const [message] = await flushed;
          assert.equal(message, "coverage-flushed");
        }
      } finally {
        if (child.connected) child.disconnect();
        child.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once("exit", () => resolve());
          setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 10000).unref();
        });
        snapshot.cleanup();
      }
    });
    for (let i = 0; i < 150 && !log.includes("Editor:"); i++) {
      assert.equal(child.exitCode, null, log);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.match(log, /Editor:/);
    const shell = await fetch(origin + "/_author/");
    assert.equal(shell.status, 200);
    assert.match(shell.headers.get("x-robots-tag")!, /noindex/);
    const html = await shell.text();
    const token = load(html)('meta[name="author-session"]').attr("content")!;
    assert.match(token, /^[a-f0-9]{64}$/);
    const api = async (
      action: string,
      data?: Record<string, unknown>,
      status = 200,
    ) => {
      const response = await fetch(origin + "/_author/api/" + action, {
        method: data ? "POST" : "GET",
        headers: {
          "X-Author-Token": token,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      const value = await response.json();
      assert.equal(response.status, status, JSON.stringify(value));
      return value;
    };
    assert.equal((await fetch(origin + "/_author/api/files")).status, 403);
    assert.equal(
      (
        await fetch(origin + "/_author/api/metadata", {
          method: "POST",
          headers: {
            "X-Author-Token": token,
            Origin: "https://outside.invalid",
          },
        })
      ).status,
      403,
    );
    assert((await api("files")).files.includes(file));
    assert((await api("catalog")).length > 0);
    assert((await api("tags")).length > 0);
    const disk = await api("read?file=" + encodeURIComponent(file));
    assert.equal(disk.publication, "draft");
    assert.equal(disk.text, original);
    const exports = await api(
      "export-settings?file=" + encodeURIComponent(file),
    );
    assert(exports.destinations.some((d: { id: string }) => d.id === "dev"));
    const exported = await api("export-generate", {
      file,
      revision: disk.revision,
      text: original,
      destination: "dev",
    });
    assert.equal(exported.assets.length, 1);
    assert.match(exported.markdown, /media\.danilop\.net/);
    const downloadPath =
      "/_author/api/export-download?" +
      new URLSearchParams({ id: exported.id, name: "bundle.zip" });
    assert.equal((await fetch(origin + downloadPath)).status, 403);
    const bundle = await fetch(origin + downloadPath, {
      headers: { "X-Author-Token": token },
    });
    assert.equal(bundle.status, 200);
    assert.equal(bundle.headers.get("content-type"), "application/zip");
    assert.equal(
      Buffer.from(await bundle.arrayBuffer())
        .subarray(0, 2)
        .toString(),
      "PK",
    );
    await api(
      "export-download?" +
        new URLSearchParams({
          id: exported.id,
          name: "../../publishing/site.yaml",
        }),
      undefined,
      400,
    );

    // Switch the actual rendered preview, not just visibility of existing cards.
    let readyState;
    for (let i = 0; i < 600; i++) {
      const state = (await api("files")).build;
      assert.notEqual(state.state, "error", state.error);
      if (state.state === "ready") {
        readyState = state;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Restoring a missing source may queue another equivalent watch build. Assert
    // the observed ready snapshot; a second request can legitimately see building.
    assert.equal(readyState?.state, "ready", log);
    const draftHtml = await (
      await fetch(origin + "/writing/server-fixture/")
    ).text();
    assert.equal(
      load(draftHtml)("[data-share-open]").length,
      0,
      "draft previews must not advertise public sharing",
    );
    async function waitForCleanup(id: string) {
      for (let i = 0; i < 600; i++) {
        if (
          !(await api("image-list?file=" + encodeURIComponent(file))).some(
            (candidate: { id: string }) => candidate.id === id,
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await assert.rejects(fs.access(path.join(imageState, id + ".png")));
      await assert.rejects(fs.access(path.join(imageState, id + ".json")));
      assert((await api("files")).imageCleanupVersion > 0, log);
    }
    await waitForCleanup(startupCandidate);
    const browser = await chromium.launch({
      executablePath: await executablePath({ headless: "shell" }),
    });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(origin);
    const draftImage = await page
      .locator(".lead .article-art img")
      .getAttribute("src");
    assert.equal(
      await page.locator(".lead .article-art img").getAttribute("alt"),
      "Draft fixture artwork",
    );
    assert.equal(await page.locator("#preview-content").inputValue(), "drafts");
    assert(
      (await page.locator('a[href="/writing/server-fixture/"]').count()) > 0,
    );
    await page.locator("#preview-content").selectOption("published");
    await page.waitForFunction(
      () => {
        const select =
          document.querySelector<HTMLSelectElement>("#preview-content");
        return select?.value === "published" && !select.disabled;
      },
      null,
      { timeout: 60000 },
    );
    assert.equal((await api("files")).includeDrafts, false);
    assert.equal(await page.locator(".draft-badge").count(), 0);
    const publishedImage = await page.evaluate(async () => {
      const url = document.querySelector<HTMLAnchorElement>(".lead h1 a")!.href;
      const article = new DOMParser().parseFromString(
        await (await fetch(url)).text(),
        "text/html",
      );
      return article.querySelector(".prose img")?.getAttribute("src") ?? null;
    });
    const leadImage = page.locator(".lead .article-art img");
    assert.equal(
      (await leadImage.count()) ? await leadImage.getAttribute("src") : null,
      publishedImage,
    );
    assert.notEqual(publishedImage, draftImage);
    assert.equal(
      await page.locator('a[href="/writing/server-fixture/"]').count(),
      0,
    );
    assert.equal(
      await fs.readFile(path.join(snapshot.dir, file), "utf8"),
      original,
    );
    await page.locator("#preview-content").selectOption("drafts");
    await page.waitForFunction(
      () => {
        const select =
          document.querySelector<HTMLSelectElement>("#preview-content");
        return select?.value === "drafts" && !select.disabled;
      },
      null,
      { timeout: 60000 },
    );
    assert.equal((await api("files")).includeDrafts, true);
    assert.equal(
      await page.locator(".lead .article-art img").getAttribute("src"),
      draftImage,
    );
    assert(
      (await page.locator('a[href="/writing/server-fixture/"]').count()) > 0,
    );
    await page.route("**/_author/api/preview-mode", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Preview fixture failure" }),
      }),
    );
    await page.locator("#preview-content").selectOption("published");
    await page.waitForFunction(
      () =>
        document.querySelector("#preview-mode-status")?.textContent ===
        "Preview fixture failure",
    );
    assert.equal(await page.locator("#preview-content").inputValue(), "drafts");
    assert.equal(await page.locator("#preview-content").isDisabled(), false);
    await api("preview-mode", { includeDrafts: "invalid" }, 400);
    // The collection uses the same local image panel, with explicit unsaved assignment.
    await page.goto(origin + "/_author/?file=" + encodeURIComponent(bookFile));
    await page.waitForFunction(() =>
      document
        .querySelector<HTMLTextAreaElement>("#source")
        ?.value.includes("id: cover-fixture"),
    );
    await page.locator("#show-images").click();
    assert.equal(
      await page.locator("#images-heading").textContent(),
      "Create a book or collection cover",
    );
    assert.equal(await page.locator("#image-size").inputValue(), "1024x1536");
    await page
      .getByRole("button", { name: "Continue to generate", exact: true })
      .click();
    await page
      .locator("#image-upload")
      .setInputFiles(
        path.join(snapshot.dir, path.dirname(file), "illustration.png"),
      );
    await page.waitForFunction(() =>
      document
        .querySelector("#image-notice")
        ?.textContent?.includes("Image imported locally"),
    );
    await page.locator("#image-alt").fill("A blue book cover");
    assert.equal(await page.locator("#image-position").isVisible(), false);
    assert.equal(
      await page.locator("#insert-image").textContent(),
      "Use as cover",
    );
    await page.locator("#insert-image").click();
    await page.waitForFunction(() =>
      document
        .querySelector<HTMLTextAreaElement>("#source")
        ?.value.includes("cover:"),
    );
    assert.equal(
      await fs.readFile(path.join(snapshot.dir, bookFile), "utf8"),
      bookText,
    );
    await page.locator("#undo").click();
    assert.equal(await page.locator("#source").inputValue(), bookText);
    await page.locator("#insert-image").click();
    await page.waitForFunction(() =>
      document
        .querySelector<HTMLTextAreaElement>("#source")
        ?.value.includes("cover:"),
    );
    await page.locator("#remove-cover").click();
    await page.waitForFunction(
      () =>
        !document
          .querySelector<HTMLTextAreaElement>("#source")
          ?.value.includes("cover:"),
    );
    await page.locator("#undo").click();
    assert.match(await page.locator("#source").inputValue(), /cover:/);
    await page.locator("#save").click();
    await page.waitForFunction(() =>
      document.querySelector("#status")?.textContent?.includes("Saved"),
    );
    assert.match(
      await fs.readFile(path.join(snapshot.dir, bookFile), "utf8"),
      /alt: A blue book cover/,
    );
    const oldVersion = (await api("files")).build.version;
    await fs.writeFile(
      path.join(snapshot.dir, "publishing/home.yaml"),
      "schemaVersion: 1\nlead: cover-fixture\nrecentCount: 3\nelsewhereCount: 4\ncollections: []\n",
    );
    for (let i = 0; i < 600; i++) {
      const state = (await api("files")).build;
      assert.notEqual(state.state, "error", state.error);
      if (state.state === "ready" && state.version > oldVersion) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await page.goto(origin);
    assert.equal(
      await page.locator(".lead .article-art img").getAttribute("alt"),
      "A blue book cover",
    );
    const coverSrc = await page
      .locator(".lead .article-art img")
      .getAttribute("src");
    assert.match(coverSrc!, /^\/media\/.+\.webp$/);
    assert.equal((await fetch(origin + coverSrc)).status, 200);
    await page.goto(origin + "/collections/cover-fixture/");
    assert.equal(
      await page.locator(".article-art img").getAttribute("src"),
      coverSrc,
    );
    await browser.close();
    const metadata = await api("metadata", {
      file,
      text: disk.text,
      fields: {
        title: "Edited fixture",
        summary: "An edited local fixture",
        tags: ["computing"],
        draft: true,
      },
    });
    assert.match(metadata.text, /Edited fixture/);
    const preview = await api("preview", {
      file,
      text: metadata.text,
      context: "",
    });
    assert.match(preview.html, /Edited fixture/);
    assert.equal(preview.context, "");
    let saved = await api("save", {
      file,
      text: metadata.text,
      revision: disk.revision,
      context: "",
    });
    assert.notEqual(saved.revision, disk.revision);
    await api(
      "save",
      { file, text: original, revision: disk.revision, context: "" },
      400,
    );
    const history = await api("history?file=" + encodeURIComponent(file));
    assert(history.length > 0);
    await api("read?file=../outside.md", undefined, 400);
    await api(
      "metadata",
      { file: "publishing/site.yaml", text: "title: bad" },
      400,
    );
    await api("unknown", { file }, 400);
    const request = {
      file,
      text: metadata.text,
      context: "",
      scope: "piece",
      kind: "checks",
    };
    const fingerprint = await api("review-fingerprint", request);
    assert.match(fingerprint.fingerprint, /^[a-f0-9]{64}$/);
    const prompt = await api("review-prompt", {
      ...request,
      kind: "ai",
      agent: "codex",
    });
    assert.match(prompt.prompt, /Edited fixture/);
    await api("review-job?id=missing", undefined, 400);
    await api("fix-job?id=missing", undefined, 400);
    await api("fix-cancel", { id: "missing" }, 400);
    await api("review-cancel", { id: "missing" }, 400);
    await api("image-cancel", { id: "missing" }, 400);
    await api("image-import", { file, image: "not base64" }, 400);
    const png = (
      await sharp({
        create: { width: 2, height: 2, channels: 3, background: "white" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
    const candidate = await api("image-import", { file, image: png });
    const list = await api("image-list?file=" + encodeURIComponent(file));
    assert.equal(list[0].id, candidate.id);
    const image = await api("image-data?id=" + candidate.id);
    assert.match(image.image, /^data:image\//);
    const insertion = await api("image-insert", {
      file,
      id: candidate.id,
      alt: "Fixture pixel",
      caption: "Local test",
    });
    assert.match(insertion.markdown, /Fixture pixel/);
    for (const asset of [
      "review.js",
      "review-decisions.js",
      "images.js",
      "image-recovery.js",
      "finding-range.js",
      "repetition-batch.js",
      "fixes.js",
      "fix-checks.js",
      "ux.js",
      "preview.js",
    ])
      assert.equal((await fetch(origin + "/_author/" + asset)).status, 200);
    const publishMetadata = await api("metadata", {
      file,
      text: saved.text,
      fields: { draft: false },
    });
    assert(!publishMetadata.text.includes("publishedAt:"));
    saved = await api("save", {
      file,
      text: publishMetadata.text,
      revision: saved.revision,
      context: "",
    });
    assert.match(saved.text, /publishedAt: .*T.*Z/);
    assert.equal(
      await fs.readFile(path.join(snapshot.dir, file), "utf8"),
      saved.text,
    );
    const publishedDate = saved.text.match(/publishedAt: (.+)/)[1];
    const savedCandidate = await expiredCandidate("#fb732a");
    const beforeCleanup = (await api("files")).imageCleanupVersion;
    await api("save", {
      file,
      text: saved.text,
      revision: saved.revision,
      context: "",
    });
    await waitForCleanup(savedCandidate);
    assert((await api("files")).imageCleanupVersion > beforeCleanup);
    saved = await api("unpublish", { file, revision: saved.revision });
    assert(saved.text.includes(`publishedAt: ${publishedDate}`));
    const plan = await api("delete-plan", { file, revision: saved.revision });
    assert.equal(plan.id, "server-fixture");
    const deleted = await api("delete-draft", {
      file,
      revision: saved.revision,
      planRevision: plan.revision,
    });
    assert.equal(deleted.ok, true);
    await assert.rejects(fs.access(path.join(snapshot.dir, file)));
    assert.match(
      await fs.readFile(
        path.join(snapshot.dir, deleted.recovery, "piece/index.md"),
        "utf8",
      ),
      /Edited fixture/,
    );
  },
);
