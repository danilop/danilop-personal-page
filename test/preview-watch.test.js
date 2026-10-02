const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const vm = require("node:vm");

test("reading pages refresh after server restarts without reloading during temporary outages", async () => {
  const script = await fs.readFile("authoring/preview.js", "utf8");
  for (const [status, version, expected] of [
    [200, 1, 0],
    [200, 2, 1],
    [403, 1, 1],
    [503, 1, 0],
    [0, 1, 0],
  ]) {
    let reloads = 0,
      poll;
    vm.runInNewContext(script, {
      document: {
        currentScript: {
          dataset: { token: "fixture-token", version: "1", drafts: "true" },
        },
        getElementById: () => null,
      },
      setInterval: (callback) => {
        poll = callback;
      },
      location: { reload: () => reloads++ },
      fetch: async () => {
        if (!status) throw Error("Server restarting");
        return {
          status,
          ok: status === 200,
          json: async () => ({ build: { version }, includeDrafts: true }),
        };
      },
    });
    await poll();
    assert.equal(reloads, expected, `status ${status}, version ${version}`);
  }
});

test(
  "preview watch restarts imported TypeScript, recovers after errors, and stops its child",
  { timeout: 30000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "preview-watch-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    for (const dir of ["scripts", "core", "publishing"])
      await fs.mkdir(path.join(root, dir));
    for (const file of [
      "scripts/preview-site.mjs",
      "core/preview-cli.mjs",
      "core/preview-browser.mjs",
      "core/deployment.mjs",
    ])
      await fs.copyFile(file, path.join(root, file));
    await fs.writeFile(path.join(root, "package.json"), '{"type":"module"}');
    await fs.writeFile(
      path.join(root, "publishing/deployment.json"),
      JSON.stringify({
        origin: "https://example.invalid",
        basePath: "/",
        indexable: false,
        preserveOriginal: false,
      }),
    );
    await fs.symlink(
      path.resolve("node_modules"),
      path.join(root, "node_modules"),
      "dir",
    );
    const module = path.join(root, "core/watched.ts");
    await fs.writeFile(module, 'export const value: string = "first";');
    await fs.writeFile(
      path.join(root, "scripts/author.ts"),
      `
    import { value } from "../core/watched.ts";
    console.log("START " + value + " " + process.argv.slice(2).join(" "));
    const timer = setInterval(() => {}, 1000);
    process.on("SIGTERM", () => { clearInterval(timer); console.log("STOP " + value); });
  `,
    );
    const child = spawn(
      process.execPath,
      ["scripts/preview-site.mjs", "--watch", "--port", "4331"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    const closed = once(child, "close");
    t.after(async () => {
      if (child.exitCode === null) child.kill("SIGTERM");
      await closed;
    });
    let output = "";
    const capture = (chunk) => {
      output += chunk;
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    async function expectOutput(pattern) {
      if (pattern.test(output)) return;
      await new Promise((resolve, reject) => {
        const clean = () => {
          clearTimeout(timer);
          child.stdout.off("data", changed);
          child.stderr.off("data", changed);
        };
        const changed = () => {
          if (pattern.test(output)) {
            clean();
            resolve();
          }
        };
        const timer = setTimeout(() => {
          clean();
          reject(Error(`Missing ${pattern}: ${output}`));
        }, 8000);
        child.stdout.on("data", changed);
        child.stderr.on("data", changed);
      });
    }
    await expectOutput(/START first --port 4331/);
    await fs.writeFile(module, 'export const value: string = "second";');
    await expectOutput(/STOP first/);
    await expectOutput(/START second --port 4331/);
    await fs.writeFile(module, "export const value: string = ;");
    await expectOutput(/TransformError|SyntaxError/);
    await fs.writeFile(module, 'export const value: string = "recovered";');
    await expectOutput(/START recovered --port 4331/);
    child.kill("SIGTERM");
    await closed;
    assert.match(output, /STOP recovered/);
  },
);
