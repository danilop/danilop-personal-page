import { parseOptions } from "../core/cli-options";
import type { WorkerAnalysis } from "../core/quality-types";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
import { loadLibrary } from "../core/model";
import {
  readTagPieces,
  loadTagRegistry,
  buildTagInventory,
} from "../core/tags";
import {
  qualitySchema,
  extractReviewPiece,
  checkBaselines,
  applyReviewDecisions,
  renderQualityReport,
  type QualityFinding,
} from "../core/content-quality";

async function main() {
  const args = process.argv.slice(2),
    roots: string[] = [],
    files: string[] = [];
  let configFile = "publishing/quality.yaml",
    python =
      process.env.QUALITY_PYTHON ?? path.resolve(".venv-quality/bin/python"),
    registryFile = "content/tags.yaml",
    collection = "",
    validate = false;
  if (
    !parseOptions(args, {
      help: () => {
        console.log(
          "npm run quality -- [--source ROOT] [--piece-file FILE] [--collection ID] [--config FILE] [--python EXECUTABLE] [--registry FILE]\nRepeat source/file options. Default: active pieces in content. npm run prepublish:check accepts the same options and also runs site validation. Reports: exports/content-review/. Exit 2: technical failure; 3: incomplete checks; 0: required checks completed, editorial findings may remain.",
        );
      },
      values: {
        "--source": (value) => {
          roots.push(value);
        },
        "--piece-file": (value) => {
          files.push(value);
        },
        "--collection": (value) => {
          collection = value;
        },
        "--config": (value) => {
          configFile = value;
        },
        "--python": (value) => {
          python = value;
        },
        "--registry": (value) => {
          registryFile = value;
        },
      },
      flags: {
        "--validate": () => {
          validate = true;
        },
      },
    })
  )
    return;
  const { sources, config, selectedRoots } = await selectSources();
  if (!sources.length) throw Error("No active pieces selected for review");
  const pieces = await Promise.all(
    sources.map((piece) => extractReviewPiece(piece)),
  );
  const tags = buildTagInventory(sources, await loadTagRegistry(registryFile));
  const findings: QualityFinding[] = pieces.flatMap((p) => p.technical);
  findings.push(
    ...(await checkBaselines(
      pieces,
      config,
      path.dirname(path.resolve(configFile)),
    )),
  );
  addTagFindings();
  const worker = spawnSync(
    python,
    [path.resolve("tools/content-quality/analyze.py")],
    {
      input: JSON.stringify({ pieces, config }),
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  let analysis: WorkerAnalysis = {
    checks: [],
    findings: [],
    repetitions: [],
    metrics: {},
    versions: {},
    examples: {},
  };
  readWorkerResponse();
  const decisions = applyReviewDecisions(findings, pieces, config);
  const errors = findings.filter((f) => f.severity === "error").length;
  const unavailable = findings.filter(
    (f) => f.severity === "unavailable",
  ).length;
  const reviews = findings.filter(
    (f) => f.severity === "review" && !f.accepted,
  ).length;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: `${pieces.length} pieces · ${errors} technical errors · ${unavailable} incomplete checks · ${reviews} editorial review targets`,
    config,
    scope: { roots: selectedRoots, files, collection: collection || null },
    checks: [
      {
        name: "Metadata and selected sources",
        status: "completed",
        detail:
          "Validated piece metadata, unique identities, source positions, and active status.",
      },
      {
        name: "References and relative resources",
        status: "completed",
        detail:
          "Footnote definitions and local files checked. Site routes/fragments are additionally checked during rendering; external URLs are not fetched.",
      },
      {
        name: "Source baselines",
        status: config.baselines.length ? "completed" : "not-configured",
        detail: `${config.baselines.length} explicit body/source baselines. Failures are listed separately.`,
      },
      {
        name: "Tag reuse",
        status: "completed",
        detail:
          "Registry, aliases, new vocabulary, and selected-corpus use counts.",
      },
      ...analysis.checks,
    ],
    pieces: pieces.map((p) => ({
      id: p.id,
      title: p.title,
      language: p.language,
      status: p.status,
      sources: p.sources,
      fingerprint: p.fingerprint,
      bodySha256: p.bodySha256,
      metrics: analysis.metrics?.[p.id] ?? null,
    })),
    ...decisions,
    repetitions: analysis.repetitions,
    versions: analysis.versions,
    examples: analysis.examples,
  };
  const output = path.resolve("exports/content-review");
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(output, "index.html"),
    renderQualityReport(report),
  );
  console.log(report.summary);
  console.log(`Private report: ${path.join(output, "index.html")}`);
  for (const check of report.checks)
    console.log(`${check.name}: ${check.status}`);
  process.exitCode = errors ? 2 : unavailable ? 3 : 0;
  if (validate && process.exitCode === 0) {
    const npm = process.env.npm_execpath;
    if (!npm)
      throw Error("Run the combined workflow with npm run prepublish:check");
    const result = spawnSync(process.execPath, [npm, "run", "validate"], {
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 2;
  }

  function addTagFindings() {
    for (const p of pieces)
      for (const f of tags.reviews[p.id])
        findings.push({
          piece: p.id,
          line: 1,
          rule: `tag-${f.kind}`,
          severity: "review",
          excerpt: f.tag,
          message: f.message,
        });
  }

  function readWorkerResponse() {
    if (worker.error || worker.status !== 0) {
      analysis.checks.push({
        name: "Content analysis worker",
        status: "unavailable",
        detail:
          "Run npm run quality:setup, or select a working interpreter with --python.",
      });
      findings.push({
        piece: "",
        line: 0,
        rule: "worker-unavailable",
        severity: "unavailable",
        excerpt: "",
        message:
          worker.error?.message ??
          worker.stderr?.trim() ??
          "Content worker failed",
      });
      if (worker.stdout?.trim())
        try {
          findings[findings.length - 1].message =
            JSON.parse(worker.stdout).fatal ??
            findings[findings.length - 1].message;
        } catch {
          /* Retain the process failure when its output is not structured JSON. */
        }
    } else {
      analysis = JSON.parse(worker.stdout);
      if (!Array.isArray(analysis.findings) || !Array.isArray(analysis.checks))
        throw Error("Invalid analysis worker response");
      findings.push(...analysis.findings);
    }
  }

  async function selectSources() {
    const selectedRoots = roots.length ? roots : ["content"];
    const config = qualitySchema.parse(
      YAML.parse(await fs.readFile(configFile, "utf8"), { maxAliasCount: 0 }),
    );
    let sources = (await readTagPieces(selectedRoots, files)).filter(
      (p) => p.status !== "retired",
    );
    if (collection) {
      const libs = await Promise.all(
        selectedRoots.map((root) => loadLibrary(root)),
      );
      const books = libs
        .flatMap((lib) => lib.collections)
        .filter((c) => c.id === collection);
      if (books.length !== 1)
        throw Error(`Expected one selected collection named ${collection}`);
      const ids = new Set<string>();
      const walk = (nodes: import("../core/model").Node[]) => {
        for (const n of nodes) {
          if (n.ref) ids.add(n.ref);
          walk(n.children ?? []);
          walk(n.before ?? []);
          walk(n.after ?? []);
        }
      };
      walk([...books[0].frontMatter, ...books[0].body, ...books[0].backMatter]);
      sources = sources.filter((p) => ids.has(p.id));
    }
    return { sources, config, selectedRoots };
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 2;
});
