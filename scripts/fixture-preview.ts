import { siteOutput } from "../core/deployment.mjs";
import { deploymentHtml } from "../core/deployment-html";
import fs from "node:fs/promises";
import { loadLibrary, assemble, readYaml, parser } from "../core/model";
import { renderDocument } from "../core/render";
import { Assets } from "../core/assets";
import { load } from "cheerio";
async function main() {
  if (process.env.NOTES_QA !== "1")
    throw Error(
      "This private fixture is only available with NOTES_QA=1; a release build rejects its output.",
    );
  const lib = await loadLibrary("test/fixtures/manuscript");
  const p = lib.pieces.get("first")!;
  for (const [id, module] of [
    ["growth-js", "growth-js"],
    ["growth-wasm", "growth-wasm"],
  ]) {
    p.blocks[id] = {
      kind: "simulation",
      source: { format: "registered-simulation", module },
      description: "Change the growth rate to explore repeated multiplication.",
      alternative: {
        mode: "summary-link",
        text: "At 5% per step, a starting value of 100 reaches approximately 265.33 after 20 steps.",
      },
    };
    p.body += `\n\n::block{ref="${id}"}\n`;
  }
  p.blocks.model = {
    kind: "model-experiment",
    source: {
      format: "text-generation",
      runtime: "webllm",
      locality: "local",
      model: "SmolLM2-135M-Instruct-q0f16-MLC",
      prompt: "Explain why small notes can become a book.",
    },
    description: "Try a small local language model.",
    alternative: {
      mode: "summary-link",
      text: "Recorded examples remain readable without model downloads.",
    },
  };
  p.body += '\n\n::block{ref="model"}\n';
  p.ast = parser().parse(p.body);
  const c = lib.collections.find((c) => c.id === "guide")!;
  const rendered = await renderDocument(
    assemble(c, lib, "web"),
    lib,
    await readYaml("publishing/renderers.yaml"),
    new Assets(siteOutput + "/media"),
  );
  const $ = load(
    await fs.readFile(siteOutput + "/writing/hello-brave-new-world/index.html", "utf8"),
  );
  $("title").text("Private publishing verification");
  $("head").append('<meta name="robots" content="noindex,nofollow">');
  $("main").html(
    `<article class="reading"><header class="article-heading"><h1>Private publishing verification</h1><p>This fixture is not part of the deployed website.</p></header><div class="prose">${rendered.html}</div></article>`,
  );
  await fs.mkdir(siteOutput + "/_qa", { recursive: true });
  await fs.writeFile(siteOutput + "/_qa/index.html", deploymentHtml($.html()));
  console.log(
    "Local verification: /_qa/. The next release build removes this fixture.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
