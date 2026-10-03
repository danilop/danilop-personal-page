import { asError } from "../core/errors";
import fs from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import matter from "gray-matter";
import YAML from "yaml";
import { load } from "cheerio";
import {
  Reviews,
  availability,
  requestSchema,
  snapshot,
  reviewPrompt,
} from "../core/author-review";
import { AuthorFixes, fixPrompt } from "../core/author-fixes";
import { AuthorImages } from "../core/author-images";
import { imageCleanupPolicy } from "../core/author-image-cleanup";
import { collectionCover } from "../core/collection-cover";
import {
  authorRoutes,
  injectAuthorEdit,
  injectPreviewMode,
  type AuthorRoute,
} from "../core/author-navigation";
import { authorCatalog, authorTags } from "../core/author-catalog";
import { AuthorLifecycle } from "../core/author-lifecycle";
import { AuthorExports } from "../core/author-exports";
import { AuthorLinks } from "../core/author-links";
import { AuthorStore } from "../core/author-store";
import {
  loadLibrary,
  pieceSchema,
  collectionSchema,
  parser,
  assemble,
  standalone,
  readYaml,
  validateCollection,
} from "../core/model";
import { renderDocument } from "../core/render";
import { Assets, escape } from "../core/assets";
import { homeSchema } from "../core/config";
import { compileLinks } from "../core/shortlinks";
import { stageAuthoring } from "../core/authoring-preview";
import { parseTagRegistry } from "../core/tags";
import { readingLinks } from "../core/reading-links";
async function main() {
  const root = await fs.realpath(process.cwd());
  if (process.env.CI || process.env.AWS_BRANCH)
    throw Error("Authoring is local only");
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "npm run preview -- [--port 4322]\nLocal editor, recoverable saves and live prose preview. No deployment.",
    );
    process.exit(0);
  }
  if (args.length && (args.length !== 2 || args[0] !== "--port"))
    throw Error("Use --port NUMBER");
  const port = Number(args[1] ?? 4322);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Invalid port");
  const origin = `http://127.0.0.1:${port}`,
    token = crypto.randomBytes(32).toString("hex"),
    store = new AuthorStore(root);
  const lifecycle = new AuthorLifecycle(root);
  const links = new AuthorLinks(root);
  const exports = new AuthorExports(root);
  const reviews = new Reviews(root);
  const images = new AuthorImages(root);
  const fixes = new AuthorFixes(root);
  const output = path.join(root, "exports/author-live"),
    media = path.join(output, "media");
  await fs.mkdir(output, { recursive: true });
  let navigation: AuthorRoute[] = [];
  let includeDrafts = true,
    renderedDrafts = true;
  let siteDir = path.join(output, "site");
  let activeChild: ReturnType<typeof spawn> | undefined;
  let stopping = false;
  let build = { state: "starting", error: "", version: 0 },
    queued = false,
    building = false;
  async function run(cmd: string[], cwd: string, env: NodeJS.ProcessEnv) {
    await new Promise<void>((resolve, reject) => {
      const p = spawn(process.execPath, cmd, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      activeChild = p;
      let log = "";
      p.stdout.on("data", (d) => {
        log = (log + d).slice(-12000);
      });
      p.stderr.on("data", (d) => {
        log = (log + d).slice(-12000);
      });
      p.on("error", reject);
      p.on("exit", (code) => (code === 0 ? resolve() : reject(Error(log))));
    });
  }
  async function rebuild() {
    if (stopping) return;
    queued = true;
    if (building) return;
    building = true;
    while (queued) {
      queued = false;
      build.state = "building";
      let workspace = "";
      try {
        const staged = await stageAuthoring(
          root,
          { from: "content", all: true },
          includeDrafts,
        );
        workspace = staged.workspace;
        const env = {
          ...process.env,
          NOTES_AUTHORING_PREVIEW: "1",
          NOTES_BASE_PATH: "/",
          GIT_DIR: execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
            encoding: "utf8",
          }).trim(),
          GIT_WORK_TREE: workspace,
        };
        await run(["--import", "tsx", "scripts/prepare.ts"], workspace, env);
        await run(
          ["node_modules/astro/bin/astro.mjs", "build"],
          workspace,
          env,
        );
        await run(
          ["--import", "tsx", "scripts/package-site.ts"],
          workspace,
          env,
        );
        await run(
          ["--import", "tsx", "scripts/verify-build.ts"],
          workspace,
          env,
        );
        const next = path.join(output, "site-" + crypto.randomUUID());
        await fs.cp(path.join(workspace, "dist"), next, { recursive: true });
        const nextNavigation = authorRoutes(
          JSON.parse(
            await fs.readFile(
              path.join(workspace, ".generated/site.json"),
              "utf8",
            ),
          ),
          await authorCatalog(root),
        );
        const previous = siteDir;
        siteDir = next;
        navigation = nextNavigation;
        renderedDrafts = includeDrafts;
        setTimeout(() => {
          void fs.rm(previous, { recursive: true, force: true });
        }, 30000).unref();
        build = { state: "ready", error: "", version: build.version + 1 };
        if (build.version === 1) console.log(`Preview ready: ${origin}/`);
      } catch (caught) {
        const e = asError(caught);
        build.state = "error";
        build.error = e.message;
        includeDrafts = renderedDrafts;
        console.error("Site preview:", e.message);
      } finally {
        if (workspace) await fs.rm(workspace, { recursive: true, force: true });
      }
    }
    building = false;
    queueImageCleanup();
  }
  async function library(file: string, text: string) {
    const lib = await loadLibrary();
    if (file.endsWith("/index.md")) {
      const old = [...lib.pieces.values()].find(
        (p) => path.relative(root, path.join(p.dir, "index.md")) === file,
      );
      if (!old) throw Error("Unknown piece");
      const parsed = matter(text, {
          engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
        }),
        data = pieceSchema.parse(parsed.data);
      if (data.id !== old.id)
        throw Error("Content ID cannot change in the editor");
      lib.pieces.set(old.id, {
        ...old,
        ...data,
        body: parsed.content,
        ast: parser().parse(parsed.content),
      });
    } else if (file.startsWith("content/collections/")) {
      const old = collectionSchema.parse(await readYaml(file)),
        next = collectionSchema.parse(YAML.parse(text, { maxAliasCount: 0 }));
      if (old.id !== next.id)
        throw Error("Collection ID cannot change in the editor");
      await collectionCover(
        next.cover,
        path.dirname(path.join(root, file)),
        new Assets(media),
      );
      lib.collections = lib.collections.map((c) =>
        c.id === old.id ? next : c,
      );
    } else if (file === "publishing/home.yaml")
      homeSchema.parse(YAML.parse(text, { maxAliasCount: 0 }));
    else if (file === "publishing/links.yaml")
      compileLinks(
        YAML.parse(text, { maxAliasCount: 0 }),
        lib,
        "https://www.danilop.net",
      );
    else parseTagRegistry(YAML.parse(text, { maxAliasCount: 0 }));
    for (const c of lib.collections) validateCollection(c, lib.pieces);
    return lib;
  }
  async function preview(file: string, text: string, context?: string) {
    const lib = await library(file, text);
    const p = [...lib.pieces.values()].find(
      (p) => path.relative(root, path.join(p.dir, "index.md")) === file,
    );
    if (!p)
      return {
        html: "",
        contexts: [],
        message:
          "Configuration is valid. Save to refresh the full-site preview.",
      };
    const contexts = lib.collections.filter((c) =>
      assemble(c, lib, "web", { preview: true }).nodes.some(
        (n) => n.piece?.id === p.id,
      ),
    );
    const c =
      contexts.find((c) => c.id === context) ??
      (!p.publication.surfaces.includes("standalone")
        ? contexts[0]
        : undefined);
    const doc = c ? assemble(c, lib, "web", { preview: true }) : standalone(p);
    const rendered = await renderDocument(
      doc,
      lib,
      await readYaml("publishing/renderers.yaml"),
      new Assets(media),
    );
    const node = rendered.nodes.find((n) => n.pieceId === p.id);
    if (!node) throw Error("Piece is not visible in this context");
    const url = c
      ? `/collections/${c.slug}/read/${node.id}/`
      : `/writing/${p.slug}/`;
    const body = c
      ? readingLinks(node.html, `/collections/${c.slug}/`, [node.id])
      : node.html;
    let template = await fs
      .readFile(path.join(siteDir, url, "index.html"), "utf8")
      .catch(() => "");
    if (template) {
      const $ = load(template);
      $("script").remove();
      $(".authoring-notice small").text(
        "Saved changes refresh the full site automatically. Missing dates are provisional.",
      );
      $("article.reading .prose").first().html(body);
      $("article.reading h1")
        .first()
        .text((node.number ? node.number + ". " : "") + node.title);
      if (p.status === "draft")
        $("article.reading h1")
          .first()
          .append(' <span class="draft-badge">Draft</span>');
      $("article.reading .dek").text(p.summary ?? "");
      $("head").append(
        `<style>.draft-badge{display:inline-block;vertical-align:middle;margin-left:.4em;padding:.15em .5em;border:1px solid #aa8843;border-radius:3px;background:#fff5da;color:#624c20;font:500 12px/1.4 system-ui,sans-serif;letter-spacing:normal}</style>`,
      );
      $("head").prepend(`<base href="${origin}${url}">`);
      template = $.html();
    } else
      template = `<!doctype html><html><head><meta charset="utf-8"><base href="${origin}${url}"><style>body{max-width:760px;margin:40px auto;padding:20px;font:18px/1.7 Georgia}pre{overflow:auto}img{max-width:100%}</style></head><body><p>Quick content preview · full site is preparing</p><h1>${escape(node.title)}</h1>${body}</body></html>`;
    return {
      html: template,
      url,
      contexts: contexts.map((c) => ({ id: c.id, title: c.title })),
      context: c?.id ?? "",
      message: template.includes("full site is preparing")
        ? "Content preview; site template preparing"
        : "Live prose preview · surrounding navigation and metadata reflect the last site build",
    };
  }
  let serial = Promise.resolve();
  async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const p = serial.then(fn);
    serial = p.then(
      () => {},
      () => {},
    );
    return p;
  }
  let imageCleanupTimer: ReturnType<typeof setTimeout> | undefined;
  let imageCleanupVersion = 0;
  let imageCleanupError = "";
  function queueImageCleanup(delay = 750) {
    if (stopping) return;
    clearTimeout(imageCleanupTimer);
    imageCleanupTimer = setTimeout(() => {
      void exclusive(async () => {
        if (stopping) return;
        if (
          building ||
          [...images.jobs.values()].some((job) => job.state === "running")
        ) {
          queueImageCleanup(30000);
          return;
        }
        // A malformed/partially written source is not evidence that references
        // disappeared. Defer collection until the library validates again.
        await loadLibrary(path.join(root, "content"));
        const result = await images.cleanup.sweep(Date.now(), async () => {
          await loadLibrary(path.join(root, "content"));
        });
        imageCleanupError = "";
        if (result.deferred) queueImageCleanup(30000);
        if (result.candidates || result.assets || result.purged)
          imageCleanupVersion++;
      }).catch((error) => {
        imageCleanupError = asError(error).message;
        console.error("Image cleanup deferred:", imageCleanupError);
      });
    }, delay);
    imageCleanupTimer.unref();
  }
  const dailyImageCleanup = setInterval(() => queueImageCleanup(), 86400000);
  dailyImageCleanup.unref();
  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((error: unknown) =>
      res.destroy(asError(error)),
    );
  });
  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (req.headers.host !== `127.0.0.1:${port}`) throw Error("Invalid host");
      const u = new URL(req.url!, origin);
      if (await serveAuthorModule(u)) return;
      if (u.pathname === "/_author/" && req.method === "GET") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          (await fs.readFile("authoring/index.html", "utf8")).replace(
            "__TOKEN__",
            token,
          ),
        );
        return;
      }
      if (u.pathname.startsWith("/_author/api/")) {
        if (
          req.headers["x-author-token"] !== token ||
          (req.method !== "GET" && req.headers.origin !== origin)
        ) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                "The authoring session changed. Reload the page to reconnect; unsaved edits remain in your browser.",
            }),
          );
          return;
        }
        if (await serveExportDownload(u)) return;
        const body = await readRequestBody(u);
        const data = body ? JSON.parse(body) : {},
          action = u.pathname.split("/").pop();
        const result = await exclusive(async () => {
          const routes: Record<string, () => Promise<unknown>> = {
            "GET export-settings": async () =>
              exports.settings(u.searchParams.get("file")!),
            "POST export-generate": async () => exports.generate(data),
            "POST export-enroll": async () => exports.enroll(data),
            "GET short-links": async () =>
              links.list(u.searchParams.get("file")!),
            "POST short-link-reserve": async () => links.reserve(data),
            "POST short-link-deactivate": async () => links.deactivate(data),
            "POST short-link-publish": async () => links.publish(data),
            "POST short-link-check": async () => links.check(data.file),
            "GET navigation": async () => {
              const matches = navigation.filter(
                (r) => r.file === u.searchParams.get("file"),
              );
              return (
                matches.find((r) => r.url === u.searchParams.get("from")) ??
                matches[0] ??
                null
              );
            },
            "POST fix-start": async () => {
              return fixes.start(data);
            },
            "POST fix-prompt": async () => {
              return { prompt: fixPrompt(await fixes.prepare(data)) };
            },
            "GET fix-job": async () => {
              return fixes.get(u.searchParams.get("id")!);
            },
            "POST fix-cancel": async () => {
              fixes.cancel(data.id);
              return { ok: true };
            },
            "GET image-settings": async () => {
              return {
                ...(await images.settings()),
                style: await images.style(),
                agents: await availability(),
              };
            },
            "GET image-list": async () => {
              return images.list(u.searchParams.get("file")!);
            },
            "POST image-touch": async () => images.cleanup.touch(data.id),
            "POST image-recovery": async () => images.cleanup.recovery(data),
            "GET image-job": async () => {
              return images.get(u.searchParams.get("id")!);
            },
            "GET image-data": async () => {
              return images.data(u.searchParams.get("id")!);
            },
            "POST image-start": async () => {
              return images.start(data);
            },
            "POST image-cancel": async () => {
              images.cancel(data.id);
              return { ok: true };
            },
            "POST image-insert": async () => {
              return images.insert(
                data.file,
                data.id,
                data.alt,
                data.caption || "",
              );
            },
            "POST image-cover": async () => {
              return images.cover(
                data.file,
                data.id,
                data.alt || "",
                data.text,
              );
            },
            "POST image-import": async () => {
              if (
                typeof data.image !== "string" ||
                !/^[A-Za-z0-9+/=]+$/.test(data.image)
              )
                throw Error("Invalid image upload");
              return images.saveCandidate(
                data.file,
                Buffer.from(data.image, "base64"),
              );
            },
            "GET review-agents": async () => {
              return availability();
            },
            "GET review-job": async () => {
              return reviews.get(u.searchParams.get("id")!);
            },
            "POST review-cancel": async () => {
              reviews.cancel(data.id);
              return { ok: true };
            },
            "GET catalog": async () => {
              return authorCatalog(root);
            },
            "GET tags": async () => {
              return authorTags(root);
            },
            "GET files": async () => {
              return {
                files: await store.files(),
                build,
                includeDrafts: renderedDrafts,
                imageCleanupVersion,
                imageCleanupError,
                imageCleanupPolicy,
              };
            },
            "POST preview-mode": async () => {
              if (typeof data.includeDrafts !== "boolean")
                throw Error("Choose whether to show drafts.");
              if (building)
                throw Error("Wait for the current preview build to finish.");
              if (data.includeDrafts !== renderedDrafts) {
                includeDrafts = data.includeDrafts;
                void rebuild();
              }
              return { ok: true };
            },
            "GET read": async () => {
              const file = u.searchParams.get("file")!;
              const value = await store.read(file);
              const publication = file.endsWith("/index.md")
                ? pieceSchema.safeParse(
                    matter(value.text, {
                      engines: {
                        yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }),
                      },
                    }).data,
                  )
                : null;
              return {
                ...value,
                publication: publication?.success
                  ? publication.data.status
                  : null,
              };
            },
            "GET history": async () => {
              return store.history(u.searchParams.get("file")!);
            },
            "POST review-start": reviewAction,
            "POST review-prompt": reviewAction,
            "POST review-fingerprint": reviewAction,
          };
          const route = routes[req.method + " " + action];
          if (route) return route();
          if (req.method !== "POST") throw Error("Unsupported method");
          await store.file(data.file);
          const writing: Record<string, () => Promise<unknown>> = {
            unpublish: async () => {
              return lifecycle.unpublish(data.file, data.revision);
            },
            "delete-plan": async () => {
              const plan = await lifecycle.plan(data.file, data.revision);
              return { ...plan, changes: plan.changes.map((c) => c.file) };
            },
            "delete-draft": async () => {
              return lifecycle.delete(
                data.file,
                data.revision,
                data.planRevision,
              );
            },
            metadata: async () => {
              if (!data.file.endsWith("/index.md"))
                throw Error("Metadata forms apply to pieces");
              const match = /^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/.exec(
                data.text,
              );
              if (!match) throw Error("Missing metadata header");
              const doc = YAML.parseDocument(match[2]);
              if (doc.errors.length) throw doc.errors[0];
              if (data.fields) {
                for (const field of ["title", "summary", "tags"])
                  if (field in data.fields) doc.set(field, data.fields[field]);
                if (
                  "draft" in data.fields &&
                  !(doc.get("status") === "retired" && !data.fields.draft)
                ) {
                  doc.delete("status");
                  doc.set("draft", Boolean(data.fields.draft));
                }
              }
              return {
                text: match[1] + doc.toString().trimEnd() + match[3] + match[4],
                fields: doc.toJS({ maxAliasCount: 0 }),
              };
            },
            preview: async () => {
              return preview(data.file, data.text, data.context);
            },
            save: async () => {
              const result = await store.save(
                data.file,
                data.text,
                data.revision,
                async (text) => {
                  await preview(data.file, text, data.context);
                },
              );
              queueImageCleanup();
              return result;
            },
          };
          const edit = writing[action!];
          if (!edit) throw Error("Unknown action");
          return edit();
          async function reviewAction() {
            const request = requestSchema.parse(data);
            const captured = await snapshot(root, request);
            if (action === "review-fingerprint")
              return { fingerprint: captured.fingerprint };
            if (action === "review-prompt")
              return {
                prompt: await reviewPrompt(root, captured),
                fingerprint: captured.fingerprint,
              };
            return reviews.start(request, captured);
          }
        });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      await serveFile(u);
    } catch (caught) {
      const e = asError(caught);
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: e.message }));
    }

    async function serveAuthorModule(u: URL) {
      if (
        [
          "/_author/review.js",
          "/_author/review-decisions.js",
          "/_author/images.js",
          "/_author/image-recovery.js",
          "/_author/finding-range.js",
          "/_author/repetition-batch.js",
          "/_author/fixes.js",
          "/_author/fix-checks.js",
          "/_author/ux.js",
          "/_author/preview.js",
          "/_author/links.js",
          "/_author/exports.js",
        ].includes(u.pathname) &&
        req.method === "GET"
      ) {
        res.setHeader("Content-Type", "text/javascript");
        res.end(
          await fs.readFile(
            (["finding-range.js", "repetition-batch.js"].includes(
              path.basename(u.pathname),
            )
              ? "lib/"
              : "authoring/") + path.basename(u.pathname),
            "utf8",
          ),
        );
        return true;
      }
      return false;
    }
    async function serveExportDownload(u: URL) {
      if (u.pathname !== "/_author/api/export-download" || req.method !== "GET")
        return false;
      const result = await exclusive(() =>
        exports.download(
          u.searchParams.get("id")!,
          u.searchParams.get("name")!,
        ),
      );
      res.setHeader(
        "Content-Type",
        result.name.endsWith(".zip")
          ? "application/zip"
          : "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.name}"`,
      );
      res.end(result.bytes);
      return true;
    }
    async function readRequestBody(u: URL) {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (
          Buffer.byteLength(body) >
          (u.pathname.endsWith("/image-import") ? 28000000 : 2000000)
        )
          throw Error("Request too large");
      }
      return body;
    }

    async function serveFile(u: URL) {
      if (req.method !== "GET" && req.method !== "HEAD")
        throw Error("Unsupported method");
      const isMedia = u.pathname.startsWith("/media/");
      const base = isMedia ? media : siteDir;
      const relative = decodeURIComponent(
        isMedia ? u.pathname.slice(7) : u.pathname,
      ).replace(/^\/+/, "");
      let file = path.resolve(base, relative);
      if (file !== base && !file.startsWith(base + path.sep))
        throw Error("Invalid path");
      if (u.pathname.endsWith("/")) file = path.join(file, "index.html");
      let data = await fs
        .readFile(file)
        .catch(async () =>
          isMedia
            ? fs.readFile(path.join(siteDir, "media", relative))
            : Promise.reject(
                Error("Page unavailable while site preview prepares"),
              ),
        );
      const type: Record<string, string> = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".jpg": "image/jpeg",
        ".pdf": "application/pdf",
      };
      res.setHeader(
        "Content-Type",
        type[path.extname(file)] ?? "application/octet-stream",
      );
      if (path.extname(file) === ".html")
        data = Buffer.from(
          injectPreviewMode(
            injectAuthorEdit(
              data.toString(),
              navigation.find((r) => r.url === u.pathname),
            ),
            {
              token,
              version: build.version,
              includeDrafts: renderedDrafts,
              building,
            },
          ),
        );
      res.end(req.method === "HEAD" ? undefined : data);
    }
  }
  server.listen(port, "127.0.0.1", () => {
    console.log(`Preview: ${origin}/\nEditor: ${origin}/_author/`);
    void rebuild();
    queueImageCleanup();
  });
  let refreshTimer: ReturnType<typeof setTimeout>;
  const watchers = [
    "content",
    "publishing",
    "site",
    "themes",
    "site-assets",
  ].map((dir) =>
    watch(path.join(root, dir), { recursive: true }, (_event, name) => {
      if (name?.includes(".author-")) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void rebuild();
        queueImageCleanup();
      }, 750);
    }),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      reviews.close();
      images.close();
      fixes.close();
      stopping = true;
      queued = false;
      clearTimeout(refreshTimer);
      clearTimeout(imageCleanupTimer);
      clearInterval(dailyImageCleanup);
      watchers.forEach((w) => w.close());
      server.close();
      activeChild?.kill("SIGTERM");
    });
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
