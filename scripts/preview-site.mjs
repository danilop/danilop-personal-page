import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  previewOptions,
  previewHelp,
  previewLaunchArgs,
} from "../core/preview-cli.mjs";
import { siteOutput, sitePath } from "../core/deployment.mjs";

let options;
try {
  options = previewOptions(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (options.help) {
  console.log(previewHelp);
  process.exit(0);
}
if (options.mode === "live" || options.mode === "snapshot") {
  const child = spawn(process.execPath, previewLaunchArgs(options), {
    stdio: "inherit",
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  const code = await new Promise((resolve) => {
    child.on("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });
  process.exit(code);
}
const authoring = options.mode === "snapshot-output";
const port = options.port;
const root = path.resolve(
  authoring ? "exports/authoring-preview/site" : "dist",
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const name = decodeURIComponent(url.pathname);
    let file = path.resolve(root, "." + name);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.isDirectory()) {
      if (!name.endsWith("/")) {
        res.writeHead(301, { location: url.pathname + "/" + url.search });
        res.end();
        return;
      }
      file = path.join(file, "index.html");
    }
    const real = await fs.realpath(file).catch(() => null);
    if (real && !real.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let body = await fs.readFile(file).catch(() => null);
    let status = 200;
    if (!body) {
      status = 404;
      file = authoring ? path.join(root, "404.html") : siteOutput + "/404.html";
      body = await fs.readFile(file);
    }
    res.writeHead(status, {
      "content-type": types[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
      ...(authoring ? { "x-robots-tag": "noindex, nofollow" } : {}),
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `${authoring ? "Read-only snapshot" : "Release preview"}: http://127.0.0.1:${port}${authoring ? "/" : sitePath("/")}`,
  ),
);
