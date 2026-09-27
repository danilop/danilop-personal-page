import type { QualityReport } from "./quality-types";
import type { Nodes } from "mdast";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { parser } from "./model";
import type { TagPiece } from "./tags";
import { escape } from "./assets";

export const hash = (text: string | Uint8Array) =>
  createHash("sha256").update(text).digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const qualitySchema = z
  .object({
    schemaVersion: z.literal(1),
    model: z.string().min(1).default("en_core_web_sm"),
    repetition: z
      .object({
        minN: z.number().int().min(2).max(12),
        maxN: z.number().int().min(2).max(12),
        minCount: z.number().int().min(2),
      })
      .strict()
      .refine((v) => v.minN <= v.maxN)
      .default({ minN: 3, maxN: 8, minCount: 2 }),
    style: z
      .object({
        longSentenceWords: z.number().int().min(10),
        adverbsPerSentence: z.number().int().min(2),
        openerMinimum: z.number().int().min(2),
        openerFraction: z.number().positive().max(1),
        shortSentenceWords: z.number().int().positive(),
        shortSentenceRun: z.number().int().min(2),
      })
      .strict()
      .default({
        longSentenceWords: 40,
        adverbsPerSentence: 3,
        openerMinimum: 4,
        openerFraction: 0.2,
        shortSentenceWords: 8,
        shortSentenceRun: 3,
      }),
    baselines: z
      .array(
        z
          .object({
            piece: z.string(),
            bodySha256: digest,
            files: z
              .array(z.object({ path: z.string(), sha256: digest }).strict())
              .default([]),
          })
          .strict(),
      )
      .default([]),
    examples: z
      .array(
        z
          .object({
            piece: z.string(),
            block: z.number().int().positive(),
            python: z.string().min(1).default("python3"),
            version: z.string().regex(/^\d+\.\d+$/),
            stdout: z.string(),
            timeoutSeconds: z.number().int().min(1).max(30).default(5),
          })
          .strict(),
      )
      .default([]),
    fragments: z
      .array(
        z
          .object({
            piece: z.string(),
            block: z.number().int().positive(),
            reason: z.string().trim().min(1),
          })
          .strict(),
      )
      .default([]),
    exceptions: z
      .array(
        z
          .object({
            finding: z.string(),
            fingerprint: digest,
            reason: z.string().trim().min(1),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type QualityConfig = z.infer<typeof qualitySchema>;
export type QualityFinding = {
  rule: string;
  severity: "error" | "review" | "information" | "unavailable";
  piece: string;
  line: number;
  excerpt: string;
  message: string;
  id?: string;
  fingerprint?: string;
  accepted?: string;
  start?: number;
  end?: number;
  locations?: {
    piece: string;
    line: number;
    excerpt: string;
    text?: string;
    start?: number;
    end?: number;
  }[];
};
type Segment = {
  text: string;
  line: number;
  kind: string;
  sourceStart?: number;
};
export type ReviewPiece = TagPiece & {
  language: string;
  bodySha256: string;
  segments: Segment[];
  pythonBlocks: { text: string; line: number; block: number }[];
  technical: QualityFinding[];
};

export async function extractReviewPiece(
  piece: TagPiece,
  snapshot?: string,
): Promise<ReviewPiece> {
  const raw = snapshot ?? (await fs.readFile(piece.sources[0], "utf8"));
  const parsed = matter(raw, {
    engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
  });
  const body = parsed.content;
  // Keep original source lines, including the front matter omitted by the parser.
  if (!raw.endsWith(body))
    throw Error(`Cannot map source positions for ${piece.id}`);
  const lineOffset =
    raw.slice(0, raw.length - body.length).split("\n").length - 1;
  const root = parser().parse(body);
  const segments: Segment[] = [],
    pythonBlocks: ReviewPiece["pythonBlocks"] = [],
    technical: QualityFinding[] = [];
  const footnotes = new Set<string>(),
    definitions = new Set<string>();
  const pending: { id: string; line: number; type: string }[] = [];
  const files: { url: string; line: number }[] = [];
  function prose(node: Nodes) {
    const start = node.position!.start.offset!,
      end = node.position!.end.offset!;
    const chars: string[] = body
      .slice(start, end)
      .split("")
      .map((c) => (c === "\n" ? "\n" : " "));
    function copy(n: Nodes) {
      if (n.type === "text") {
        const a = n.position!.start.offset!,
          b = n.position!.end.offset!;
        const text = body.slice(a, b);
        if (/^https?:\/\/\S+$/.test(text)) return;
        for (let i = a; i < b; i++) chars[i - start] = body[i];
      } else if (
        [
          "inlineCode",
          "inlineMath",
          "html",
          "image",
          "imageReference",
          "textDirective",
        ].includes(n.type)
      ) {
        if (n.position) chars[n.position.start.offset! - start] = "\ufffc";
      } else for (const c of "children" in n ? n.children : []) copy(c);
    }
    copy(node);
    let text = chars.join("");
    text = text.replace(
      /"[^"\n]*"|“[^”]*”/g,
      (match) => "\ufffc" + match.slice(1).replace(/[^\n]/g, " "),
    );
    if (text.trim())
      segments.push({
        text,
        line: node.position!.start.line + lineOffset,
        kind: node.type,
        sourceStart: raw.length - body.length + start,
      });
  }
  function walk(node: Nodes, blocked = false) {
    const line = (node.position?.start.line ?? 1) + lineOffset;
    inspectReferences();
    if (node.type === "image" && !blocked && node.alt)
      segments.push({ text: node.alt, line, kind: "image-alt" });
    if (
      node.type === "code" &&
      ["python", "py"].includes(node.lang?.toLowerCase() ?? "")
    )
      pythonBlocks.push({
        text: node.value,
        line: line + 1,
        block: pythonBlocks.length + 1,
      });
    const excluded =
      blocked ||
      [
        "blockquote",
        "footnoteDefinition",
        "heading",
        "code",
        "html",
        "definition",
      ].includes(node.type);
    if (!excluded && ["paragraph", "tableCell"].includes(node.type))
      prose(node);
    for (const child of "children" in node ? node.children : [])
      walk(child, excluded);

    function inspectReferences() {
      if (node.type === "footnoteDefinition") {
        if (footnotes.has(node.identifier))
          technical.push({
            rule: "footnote-duplicate",
            severity: "error",
            piece: piece.id,
            line,
            excerpt: node.identifier,
            message: "Duplicate footnote definition.",
          });
        footnotes.add(node.identifier);
      }
      if (node.type === "definition") definitions.add(node.identifier);
      if (node.type === "footnoteReference")
        pending.push({ id: node.identifier, line, type: "footnote" });
      // Unresolved Markdown footnotes may be parsed as literal text.
      if (node.type === "text")
        for (const match of node.value.matchAll(/\[\^([^\]\s]+)\]/g))
          pending.push({ id: match[1].toLowerCase(), line, type: "footnote" });
      if (node.type === "linkReference" || node.type === "imageReference")
        pending.push({ id: node.identifier, line, type: "link" });
      if (
        node.type === "link" ||
        node.type === "image" ||
        node.type === "definition"
      )
        files.push({ url: node.url, line });
    }
  }
  walk(root);
  for (const ref of pending)
    if (!(ref.type === "footnote" ? footnotes : definitions).has(ref.id))
      technical.push({
        rule: "reference-missing",
        severity: "error",
        piece: piece.id,
        line: ref.line,
        excerpt: ref.id,
        message: `Undefined ${ref.type} reference.`,
      });
  for (const file of files) {
    if (!file.url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(file.url)) continue;
    try {
      const local = decodeURIComponent(file.url.split(/[?#]/)[0]);
      await fs.access(path.resolve(path.dirname(piece.sources[0]), local));
    } catch {
      technical.push({
        rule: "local-resource-missing",
        severity: "error",
        piece: piece.id,
        line: file.line,
        excerpt: file.url,
        message: "Relative link or asset cannot be resolved from this piece.",
      });
    }
  }
  return {
    ...piece,
    language: parsed.data.language ?? "en",
    bodySha256: hash(body),
    segments,
    pythonBlocks,
    technical,
  };
}

export async function checkBaselines(
  pieces: ReviewPiece[],
  config: QualityConfig,
  baseDir: string,
) {
  const findings: QualityFinding[] = [];
  for (const b of config.baselines) {
    const p = pieces.find((p) => p.id === b.piece);
    if (!p) throw Error(`Baseline references unselected piece ${b.piece}`);
    if (p.bodySha256 !== b.bodySha256)
      findings.push({
        rule: "source-drift",
        severity: "error",
        piece: p.id,
        line: 1,
        excerpt: p.title,
        message:
          "Piece body differs from the reviewed extraction baseline. Review/regenerate from the editorial source.",
      });
    for (const f of b.files) {
      let actual = "";
      try {
        actual = hash(await fs.readFile(path.resolve(baseDir, f.path)));
      } catch {
        /* Report the unavailable source below instead of claiming a matching baseline. */
      }
      if (actual !== f.sha256)
        findings.push({
          rule: "source-drift",
          severity: "error",
          piece: p.id,
          line: 1,
          excerpt: f.path,
          message:
            "Source or copied asset is missing or differs from its recorded hash.",
        });
    }
  }
  return findings;
}

export function applyReviewDecisions(
  findings: QualityFinding[],
  pieces: ReviewPiece[],
  config: QualityConfig,
) {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  for (const f of findings) {
    const ids = [
      ...new Set([f.piece, ...(f.locations ?? []).map((l) => l.piece)]),
    ]
      .filter((id) => byId.has(id))
      .sort();
    f.fingerprint = hash(ids.map((id) => byId.get(id)!.fingerprint).join("\n"));
    f.id = hash(
      JSON.stringify([f.rule, f.piece, f.line, f.excerpt, f.locations ?? []]),
    ).slice(0, 20);
    const decision = config.exceptions.find(
      (e) => e.finding === f.id && e.fingerprint === f.fingerprint,
    );
    if (decision && f.severity === "review") f.accepted = decision.reason;
  }
  const stale = config.exceptions.filter(
    (e) =>
      !findings.some(
        (f) =>
          f.id === e.finding &&
          f.fingerprint === e.fingerprint &&
          f.severity === "review",
      ),
  );
  return { findings, stale };
}

export function renderQualityReport(report: QualityReport) {
  const e = (x: unknown) => escape(String(x ?? ""));
  const location = (f: { piece: string; line: number }) =>
    `${e(f.piece)} · line ${e(f.line)}`;
  const findings = report.findings;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Content review · Notes Along the Way</title><link rel="icon" href="data:,"><style>body{background:#faf8f3;color:#24221f;font:16px/1.6 system-ui;margin:0}main{max-width:1000px;margin:auto;padding:30px 22px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:40px}h2{margin-top:36px}a{color:#164b88}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #d9d4ca;vertical-align:top}.scroll{overflow:auto}summary{cursor:pointer}details{padding:14px 0;border-bottom:1px solid #d9d4ca}blockquote{border-left:3px solid #d9d4ca;margin:16px 0;padding-left:15px;white-space:pre-wrap}code{font-size:13px;overflow-wrap:anywhere}.muted{color:#635f59}.error,.unavailable{color:#9b3025}.review{color:#765421}p,li{overflow-wrap:anywhere}@media(max-width:600px){h1{font-size:32px}td,th{padding:7px;font-size:13px}}:focus-visible{outline:3px solid #8bafe0}</style></head><body><main>
<p class="muted">PRIVATE AUTHORING · ${e(report.generatedAt)}</p><h1>Content review</h1><p>${e(report.summary)}</p><p>These are review targets, not a quality score or a factual-accuracy verdict. No prose was rewritten. Counts describe unique pieces.</p><p><a href="report.json">Complete structured report</a> · <a href="#repetition">Repeated stem sequences</a> · <a href="#findings">Findings</a></p>
<h2>Checks and coverage</h2><ul>${report.checks.map((c) => `<li><strong>${e(c.name)}: ${e(c.status)}</strong> — ${e(c.detail)}</li>`).join("")}</ul>
<h2>Pieces</h2><div class="scroll"><table><thead><tr><th>Piece</th><th>Words</th><th>Sentences</th><th>Passive candidates</th><th>Adverbs / 1,000 words</th></tr></thead><tbody>${report.pieces.map((p) => `<tr><td>${e(p.title)}<br><small>${e(p.id)} · ${e(p.language)}</small></td><td>${e(p.metrics?.words ?? "—")}</td><td>${e(p.metrics?.sentences ?? "—")}</td><td>${e(p.metrics?.passiveSentences ?? "—")}</td><td>${e(p.metrics?.adverbsPer1000 ?? "—")}</td></tr>`).join("")}</tbody></table></div>
<h2 id="repetition">Repeated stem sequences</h2><p>Exact sequences of stemmed words (${e(report.config.repetition.minN)}–${e(report.config.repetition.maxN)} words). Counts include overlapping matches; sequences never cross sentence punctuation, paragraph, piece, or excluded-code boundaries. Raw counts are not defects.</p><p>${report.repetitions.length} repeated sequences. Showing the first ${Math.min(60, report.repetitions.length)} by length and frequency; the JSON retains all counts and occurrences.</p>
${
  report.repetitions
    .slice(0, 60)
    .map(
      (r) =>
        `<details><summary><strong>${e(r.example)}</strong> — ${r.count} matches across ${r.pieceCount} piece(s) · ${r.n} stems</summary><p><code>${e(r.stems.join(" "))}</code></p><p>Per piece: ${Object.entries(
          r.perPiece,
        )
          .map(([id, n]) => `${e(id)}: ${e(n)}`)
          .join(
            "; ",
          )}</p><ul>${r.locations.map((l) => `<li>${location(l)}<blockquote>${e(l.excerpt)}</blockquote></li>`).join("")}</ul></details>`,
    )
    .join("") || "<p>No repeated sequences met the configured count.</p>"
}
<h2 id="findings">Findings</h2><p>Accepted exceptions remain visible. Missing tools and technical errors cannot be waived as style preferences.</p>
${findings.map((f) => `<details><summary class="${f.severity}">${e(f.accepted ? "Accepted review" : f.severity)} · ${e(f.rule)} · ${location(f)}</summary><p>${e(f.message)}</p><blockquote>${e(f.excerpt)}</blockquote>${(f.locations ?? []).map((l) => `<p>${location(l)}</p><blockquote>${e(l.excerpt)}</blockquote>`).join("")}${f.accepted ? `<p>Accepted: ${e(f.accepted)}</p>` : ""}<p><code>Finding: ${e(f.id)}<br>Fingerprint: ${e(f.fingerprint)}</code></p></details>`).join("") || "<p>No findings from the checks that completed.</p>"}
${report.stale.length ? `<h2>Stale exceptions</h2><p>${report.stale.length} recorded decisions no longer match this review and were not applied.</p>` : ""}
<h2>Sources and limits</h2><ul>${report.pieces.map((p) => `<li>${e(p.id)}: ${e(p.sources.join(", "))}</li>`).join("")}</ul><p>Model and library versions, scope, metrics, findings, and fingerprints are recorded in the JSON. External-link availability, historical fact checking, and visual proofing remain separate tasks. Regenerate after editing content.</p></main></body></html>`;
}
