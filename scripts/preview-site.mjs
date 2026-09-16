import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { deployment, siteOutput, sitePath } from "../core/deployment.mjs";

const portIndex = process.argv.indexOf("--port");
const port = portIndex < 0 ? 4321 : Number(process.argv[portIndex + 1]);
const root = path.resolve("dist");
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
      file = siteOutput + "/404.html";
      body = await fs.readFile(file);
    }
    res.writeHead(status, {
      "content-type": types[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Preview: http://127.0.0.1:${port}${sitePath("/")}${deployment.preserveOriginal ? ` (original: http://127.0.0.1:${port}/)` : ""}`,
  ),
);
