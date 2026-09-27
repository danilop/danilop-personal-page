import { repositoryFixture } from "./repository-fixture";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { load } from "cheerio";
import sharp from "sharp";
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
  { timeout: 120000 },
  async (t) => {
    const snapshot = await repositoryFixture(root);

    const file = "content/pieces/server-fixture/index.md";
    const original =
      "---\nschemaVersion: 1\nid: server-fixture\ntitle: Server fixture\nsummary: Local integration fixture\ndraft: true\nslug: server-fixture\npublication: {surfaces: [standalone]}\n---\n\n## A heading\n\nOriginal local text.\n";
    await fs.mkdir(path.dirname(path.join(snapshot.dir, file)), {
      recursive: true,
    });
    await fs.writeFile(path.join(snapshot.dir, file), original);
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
    const saved = await api("save", {
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
      "finding-range.js",
      "fixes.js",
      "fix-checks.js",
      "ux.js",
    ])
      assert.equal((await fetch(origin + "/_author/" + asset)).status, 200);
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
