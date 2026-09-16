import {
  experiments,
  validateExperiment,
} from "../runtime/experiment-registry";
import { selectCode } from "../core/code-source";
import { z } from "zod";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { codeToHtml } from "shiki";
import modelManifest from "../publishing/models.json";
import katex from "katex";
import { parse as parseCsv } from "csv-parse/sync";
import {
  Registry,
  type Request,
  type Rendition,
  type Plugin,
} from "./registry";
import { escape as e, safeUrl, hash } from "../core/assets";
const exec = promisify(execFile);
const empty = z.object({}).strict();
const text = (v: unknown, name: string) => {
  if (typeof v !== "string" || !v.trim()) throw Error(`Missing ${name}`);
  return v;
};
async function source(r: Request, field = "path") {
  return r.block.source[field]
    ? (
        await r.assets.read(r.owner, text(r.block.source[field], field))
      ).toString()
    : text(r.block.source.text, "source text");
}
function description(r: Request) {
  return text(r.block.description ?? r.block.summary, "accessible description");
}
async function imageResult(r: Request, svg: string) {
  if (/<script\b|\bon\w+\s*=|javascript:|<iframe\b/i.test(svg))
    throw Error("Unsafe generated SVG");
  const url = await r.assets.emit(svg, ".svg");
  return {
    html: `<img src="${url}" alt="${e(description(r))}" loading="lazy" />`,
    asset: url,
  };
}
async function cached(
  r: Request,
  plugin: string,
  generate: () => Promise<string>,
) {
  const inputs: Record<string, string> = {};
  for (const field of ["path", "data"])
    if (typeof r.block.source[field] === "string")
      inputs[field] = (
        await r.assets.read(r.owner, r.block.source[field] as string)
      ).toString();
  const lock = await fs.readFile("package-lock.json", "utf8");
  const key = hash(
    JSON.stringify({
      source: r.block.source,
      inputs,
      options: r.options,
      target: r.target,
      plugin,
      lock: hash(lock),
    }),
  );
  const file = path.join("cache", "renditions", key + ".svg");
  let svg: string;
  try {
    svg = await fs.readFile(file, "utf8");
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
    svg = await generate();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, svg);
  }
  return imageResult(r, svg);
}
export function publicEmbed(format: string, value: string) {
  const u = new URL(safeUrl(value));
  if (
    u.protocol !== "https:" ||
    u.hostname !== "docs.google.com" ||
    u.username ||
    u.password
  )
    throw Error("Expected a public Google published URL");
  const kind = format === "google-docs-published" ? "document" : "presentation";
  const suffix = kind === "document" ? "pub" : "embed";
  if (!new RegExp(`^/${kind}/d/e/[A-Za-z0-9_-]+/${suffix}$`).test(u.pathname))
    throw Error("Use Publish to web, not a private/edit/share URL");
  if (
    [...u.searchParams.keys()].some(
      (k) => !["embedded", "start", "loop", "delayms"].includes(k),
    )
  )
    throw Error("Unsupported embed parameter");
  return u.href;
}
function activation(
  url: string,
  title: string,
  provider: string,
  summary: string,
  view: string,
  height: number,
) {
  return `<section class="document-view"><p>${e(summary)}</p><p><a href="${e(view)}" rel="noopener">Open ${e(title)}</a></p><button type="button" class="load-embed" data-src="${e(url)}" data-title="${e(title)}" data-height="${height}">Load ${e(provider)} viewer</button><div class="embed-host"></div><noscript><p>Use the original link to read this document.</p></noscript></section>`;
}
async function alternative(r: Request): Promise<Rendition> {
  const a = r.block.alternative;
  if (!a) throw Error(`Book alternative required for ${r.block.kind}`);
  let html = `<p>${e(a.text)}</p>`;
  if (a.url)
    html += `<p><a href="${e(safeUrl(a.url))}">${e(r.block.title ?? "Companion material")}</a></p>`;
  if (a.mode === "static") {
    if (!a.capturedAt || !a.assets?.length)
      throw Error("Static alternative requires dated assets");
    for (const asset of a.assets) {
      const url = await r.assets.copy(r.owner, asset.path);
      html += `<img src="${url}" alt="${e(asset.description)}"/>`;
    }
  }
  return { html };
}
const plugin = (
  id: string,
  kinds: Plugin["kinds"],
  formats: string[],
  render: Plugin["render"],
  options: Plugin["options"] = empty,
): Plugin => ({
  id,
  version: "1",
  kinds,
  formats,
  targets: ["web", "book"],
  options,
  render,
});
export function registry() {
  const reg = new Registry();
  reg.register(
    plugin(
      "shiki",
      ["code"],
      ["source-code"],
      async (r) => {
        const code = selectCode(
          await source(r),
          r.block.source.region
            ? text(r.block.source.region, "region")
            : undefined,
        );
        return {
          html: await codeToHtml(code, {
            lang: text(r.block.source.language, "language"),
            theme: String(r.options.theme ?? "github-light"),
          }),
          markdown: `\n\n\`\`\`${r.block.source.language}\n${code}\n\`\`\`\n`,
        };
      },
      z
        .object({ theme: z.enum(["github-light", "github-dark"]).optional() })
        .strict(),
    ),
  );
  reg.register(
    plugin("code-plain", ["code"], ["source-code"], async (r) => ({
      html: `<pre><code>${e(selectCode(await source(r), r.block.source.region ? String(r.block.source.region) : undefined))}</code></pre>`,
    })),
  );
  reg.register(
    plugin(
      "image",
      ["image"],
      ["image"],
      async (r) => {
        const data = await r.assets.read(
          r.owner,
          text(r.block.source.path, "image path"),
        );
        const url = await r.assets.emit(
          await sharp(data)
            .resize({
              width: Number(r.options.width ?? 1600),
              withoutEnlargement: true,
            })
            .webp({ quality: 88 })
            .toBuffer(),
          ".webp",
        );
        return {
          html: `<img src="${url}" alt="${e(description(r))}" loading="lazy"/>`,
          asset: url,
        };
      },
      z
        .object({ width: z.number().int().min(200).max(3200).optional() })
        .strict(),
    ),
  );
  reg.register(
    plugin("table", ["table"], ["csv"], async (r) => {
      const rows = parseCsv(await source(r), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
      }) as Record<string, string>[];
      if (!rows.length) throw Error("Table dataset is empty");
      const columns =
        (r.block.source.columns as string[] | undefined) ??
        Object.keys(rows[0]);
      for (const c of columns)
        if (!(c in rows[0])) throw Error(`Missing column ${c}`);
      return {
        html: `<div class="table-scroll" tabindex="0" role="region" aria-label="${e(r.block.caption ?? "Data table")}"><table><thead><tr>${columns.map((c) => `<th scope="col">${e(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((c) => `<td>${e(row[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      };
    }),
  );
  reg.register(
    plugin(
      "vega-lite",
      ["chart"],
      ["chart-v1", "vega-lite"],
      (r) =>
        cached(r, "vega-lite", async () => {
          const { compile } = await import("vega-lite");
          const { View, parse } = await import("vega");
          let spec: any;
          if (r.block.source.format === "vega-lite")
            spec = JSON.parse(
              selectCode(
                await source(r),
                r.block.source.region
                  ? String(r.block.source.region)
                  : undefined,
              ),
            );
          else {
            const s = r.block.source;
            if (!["line", "bar", "point"].includes(String(s.mark)))
              throw Error("chart-v1 supports line, bar, point");
            spec = {
              mark: s.mark,
              encoding: {
                x: s.x,
                y: s.y,
                ...(s.color ? { color: s.color } : {}),
              },
            };
          }
          if (r.block.source.data) {
            const csv = (
              await r.assets.read(r.owner, text(r.block.source.data, "dataset"))
            ).toString();
            spec.data = {
              values: parseCsv(csv, {
                columns: true,
                skip_empty_lines: true,
                cast: true,
              }),
            };
          }
          const inspect = (v: any): void => {
            if (!v || typeof v !== "object") return;
            if (v.url) throw Error("Chart data must be local and versioned");
            Object.values(v).forEach(inspect);
          };
          inspect(spec);
          spec = {
            ...spec,
            width: Number(r.options.width ?? 640),
            height: Number(r.options.height ?? 300),
            background: "transparent",
          };
          const view = new View(parse(compile(spec).spec), {
            renderer: "none",
          });
          try {
            return await view.toSVG();
          } finally {
            view.finalize();
          }
        }),
      z
        .object({
          width: z.number().min(240).max(1600).optional(),
          height: z.number().min(160).max(1000).optional(),
        })
        .strict(),
    ),
  );
  reg.register(
    plugin(
      "d2",
      ["diagram"],
      ["d2"],
      (r) =>
        cached(r, "d2", async () => {
          const dir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-d2-"));
          try {
            const input = path.join(dir, "source.d2");
            const output = path.join(dir, "diagram.svg");
            await fs.writeFile(input, await source(r));
            await exec(
              process.execPath,
              [
                "scripts/render-d2.mjs",
                input,
                output,
                String(r.options.layout ?? "elk"),
              ],
              { timeout: 60000 },
            );
            return fs.readFile(output, "utf8");
          } finally {
            await fs.rm(dir, { recursive: true, force: true });
          }
        }),
      z.object({ layout: z.enum(["elk", "dagre"]).optional() }).strict(),
    ),
  );
  reg.register(
    plugin(
      "mermaid",
      ["diagram"],
      ["mermaid"],
      (r) =>
        cached(r, "mermaid-native-labels-v2", async () => {
          const dir = await fs.mkdtemp(
            path.join(os.tmpdir(), "notes-mermaid-"),
          );
          try {
            const input = path.join(dir, "source.mmd"),
              output = path.join(dir, "diagram.svg"),
              config = path.join(dir, "config.json");
            await fs.writeFile(input, await source(r));
            await fs.writeFile(
              config,
              JSON.stringify({
                securityLevel: "strict",
                theme: "neutral",
                htmlLabels: false,
                flowchart: { htmlLabels: false },
                ...r.options,
              }),
            );
            await exec(
              process.execPath,
              [
                "node_modules/@mermaid-js/mermaid-cli/src/cli.js",
                "-i",
                input,
                "-o",
                output,
                "-c",
                config,
                "-b",
                "transparent",
                "--quiet",
                ...(process.env.AWS_APP_ID
                  ? ["-p", "infrastructure/puppeteer-ci.json"]
                  : []),
              ],
              { timeout: 60000 },
            );
            return fs.readFile(output, "utf8");
          } finally {
            await fs.rm(dir, { recursive: true, force: true });
          }
        }),
      z.object({ layout: z.enum(["elk", "dagre"]).optional() }).strict(),
    ),
  );
  reg.register(
    plugin("katex", ["math"], ["tex"], async (r) => ({
      html: katex.renderToString(await source(r), {
        throwOnError: true,
        displayMode: true,
        trust: false,
      }),
    })),
  );
  reg.register(
    plugin("prose", ["callout", "exercise"], ["text"], async (r) => ({
      html: `<aside class="callout"><strong>${e(r.block.title ?? (r.block.kind === "exercise" ? "Exercise" : "Note"))}</strong><p>${e(selectCode(await source(r), r.block.source.region ? String(r.block.source.region) : undefined))}</p>${r.block.source.solution ? `<p><a href="#${e(r.block.source.solution)}">See solution</a></p>` : ""}</aside>`,
    })),
  );
  reg.register(
    plugin("media", ["audio", "video"], ["audio", "video"], async (r) => {
      if (r.target === "book") return alternative(r);
      const s = r.block.source;
      const url = s.path
        ? await r.assets.copy(r.owner, String(s.path))
        : safeUrl(text(s.url, "media URL"));
      const tag = r.block.kind;
      return {
        html: `<${tag} controls preload="none" src="${e(url)}"></${tag}><p>${e(description(r))}</p>${s.transcript ? `<details><summary>Transcript</summary><p>${e(s.transcript)}</p></details>` : ""}`,
      };
    }),
  );
  for (const format of [
    "pdf",
    "google-docs-published",
    "google-slides-published",
  ])
    reg.register(
      plugin(
        format === "pdf" ? "pdf-native" : format,
        format === "google-slides-published" ? ["presentation"] : ["document"],
        [format],
        async (r) => {
          if (r.target === "book") return alternative(r);
          const s = r.block.source;
          if (Boolean(s.path) === Boolean(s.url))
            throw Error("Document requires exactly one path or URL");
          let url = s.path
            ? await r.assets.copy(r.owner, String(s.path))
            : safeUrl(text(s.url, "document URL"));
          if (format !== "pdf") url = publicEmbed(format, url);
          const view = s.viewUrl ? safeUrl(String(s.viewUrl)) : url;
          return {
            html: activation(
              url,
              text(r.block.title, "document title"),
              format === "pdf" ? "PDF" : "Google",
              text(r.block.summary, "document summary"),
              view,
              Number(r.options.height ?? 540),
            ),
          };
        },
        z
          .object({ height: z.number().int().min(240).max(1000).optional() })
          .strict(),
      ),
    );
  reg.register(
    plugin("gallery-link", ["gallery"], ["public-photo-album"], async (r) => {
      if (r.target === "book") return alternative(r);
      const s = r.block.source;
      const url = safeUrl(text(s.url, "album URL"));
      if (s.provider !== "icloud-shared-album")
        throw Error("Unregistered photo provider");
      const u = new URL(url);
      if (
        u.hostname !== "www.icloud.com" ||
        u.pathname !== "/sharedalbum/" ||
        !u.hash
      )
        throw Error("Use an iCloud public shared album, not an expiring link");
      return {
        html: `<section class="album"><h3>${e(r.block.title)}</h3><p>${e(r.block.summary)}</p><a href="${e(url)}">View album on iCloud Photos</a></section>`,
      };
    }),
  );
  reg.register(
    plugin(
      "simulation",
      ["simulation"],
      ["registered-simulation"],
      async (r) => {
        if (r.target === "book") return alternative(r);
        const s = r.block.source;
        if (!experiments[String(s.module)])
          throw Error("Unknown simulation module");
        const scenarios = z
          .record(
            z.string().regex(/^[a-z0-9-]+$/),
            z
              .object({
                label: z.string(),
                input: z.record(z.string(), z.number()),
              })
              .strict(),
          )
          .parse(s.scenarios ?? {});
        for (const scenario of Object.values(scenarios))
          validateExperiment(experiments[String(s.module)], scenario.input);
        const scenarioControls = Object.keys(scenarios).length
          ? `<label>Scenario <select data-action="scenario"><option value="">Choose a scenario</option>${Object.entries(
              scenarios,
            )
              .map(
                ([id, scenario]) =>
                  `<option value="${e(id)}">${e(scenario.label)}</option>`,
              )
              .join("")}</select></label>`
          : "";
        return {
          html: `<section class="experiment" data-experiment="${e(s.module)}" data-scenarios="${e(JSON.stringify(scenarios))}">${scenarioControls}<p>${e(description(r))}</p>${experiments[String(s.module)].fields.map((f) => `<label>${e(f.label)} <input name="${e(f.name)}" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.initial}"></label>`).join("")}<div class="controls"><button data-action="run">Run</button><button data-action="stop">Stop</button><button data-action="reset">Reset</button><button data-action="capture">Save result</button></div><output aria-live="polite">${e(s.recordedResult ?? "Choose values and run the example.")}</output><div class="experiment-results"></div></section>`,
        };
      },
    ),
  );
  reg.register(
    plugin(
      "browser-model",
      ["model-experiment"],
      ["text-generation"],
      async (r) => {
        if (r.target === "book") return alternative(r);
        const s = r.block.source;
        if (
          s.locality !== "local" ||
          !modelManifest.models.some(
            (m) => m.id === s.model && m.runtime === (s.runtime ?? m.runtime),
          )
        )
          throw Error("Model requires a registered local runtime");
        const model = text(s.model, "model ID");
        return {
          html: `<section class="model-experiment" data-model="${e(model)}"><p>${e(description(r))}</p><p>Runs on your device using WebGPU. Model files download only when you choose to load them; your prompts stay in this browser.</p><p class="model-info"></p><button data-action="load-model">Check and load model</button><button data-action="cancel-model">Cancel / unload</button><button data-action="clear-model">Clear downloaded model</button><label>Prompt<textarea rows="3">${e(s.prompt ?? "Explain the idea in three sentences.")}</textarea></label><button data-action="generate">Generate</button><button data-action="stop-model">Stop</button><button data-action="reset-model">Reset conversation</button><button data-action="capture-model">Save result</button><output aria-live="polite">${e(s.recordedResult ?? "Load a model to try this example.")}</output></section>`,
        };
      },
    ),
  );
  return reg;
}
