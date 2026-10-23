import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { siteOutput, sitePath } from "../core/deployment.mjs";

/**
 * Ask the evaluation questions through the real assistant panel in installed
 * Chrome (WebGPU) and score citations and refusals. Needs a built site and,
 * on first run, downloads the model into a persistent test profile.
 */
type Question = { q: string; gold: string | null };
type Suite = {
  thresholds: { citedGold: number; declined: number };
  pieces: Record<string, Question[]>;
};
const suite = JSON.parse(
  fs.readFileSync("tools/assistant-eval/questions.json", "utf8"),
) as Suite;
const index = JSON.parse(
  fs.readFileSync(path.join(siteOutput, "reading-index.json"), "utf8"),
) as { pieces: { id: string; url: string }[] };
const DECLINE =
  /does not|doesn't|not (?:state|say|mention|provide|contain)|no information/i;
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

/** Ask one question through the panel and score the visible answer. */
async function ask(page: Page, { q, gold }: Question) {
  const before = await page.locator(".assistant-turn").count();
  await page.fill(".assistant-form textarea", q);
  const started = Date.now();
  await page.click(".assistant-form button[type=submit]");
  await page.waitForFunction(
    (n) => {
      const turns = document.querySelectorAll(".assistant-turn");
      return (
        turns.length > n &&
        !/Thinking…/.test(turns[turns.length - 1].textContent ?? "")
      );
    },
    before,
    { timeout: 180000 },
  );
  const turn = page.locator(".assistant-turn").last();
  const found = (await turn.getAttribute("data-found")) ?? "error";
  const text = (await turn.locator(".assistant-answer").allTextContents()).join(
    " ",
  );
  const cited = await turn
    .locator(".assistant-sources a")
    .evaluateAll((links) =>
      links.map((a) => a.getAttribute("href")!.replace(/^#/, "")),
    );
  const ok = gold
    ? found === "true" && cited.includes(gold)
    : found === "false" || (!cited.length && DECLINE.test(text));
  return { q, gold, found, text, cited, ok, ms: Date.now() - started };
}

async function main() {
  const missing = index.pieces.filter((p) => !suite.pieces[p.id]?.length);
  if (missing.length)
    throw Error(
      `No evaluation questions for: ${missing.map((p) => p.id).join(", ")}`,
    );
  const port = Number(process.env.ASSISTANT_EVAL_PORT ?? 4399);
  const server = http
    .createServer((req, res) => {
      let file = path.join("dist", decodeURIComponent(req.url!.split("?")[0]));
      if (file.endsWith("/")) file += "index.html";
      if (!fs.existsSync(file)) return void res.writeHead(404).end();
      res.setHeader(
        "content-type",
        types[path.extname(file)] ?? "application/octet-stream",
      );
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, "127.0.0.1");
  const context = await chromium.launchPersistentContext(
    ".cache/assistant-eval",
    {
      channel: "chrome",
      headless: false,
    },
  );
  const rows: {
    piece: string;
    q: string;
    gold: string | null;
    found: string;
    cited: string[];
    ok: boolean;
    ms: number;
  }[] = [];
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    for (const piece of index.pieces) {
      await page.goto(`http://127.0.0.1:${port}${sitePath(piece.url)}`);
      await page.click("[data-assistant-open]");
      await page.waitForSelector(".assistant-body .assistant-actions button", {
        timeout: 60000,
      });
      await page.click(".assistant-body .assistant-actions button >> nth=0");
      await page.waitForSelector(".assistant-form:not([hidden])", {
        timeout: 30 * 60000,
      });
      for (const question of suite.pieces[piece.id]) {
        const row = { piece: piece.id, ...(await ask(page, question)) };
        rows.push(row);
        console.log(
          `${row.ok ? "PASS" : "FAIL"} ${piece.id}: ${row.q} → found=${row.found} cited=${row.cited.join(",") || "none"}${row.ok ? "" : ` text=${row.text.slice(0, 160)}`}`,
        );
      }
    }
  } finally {
    await context.close();
    server.close();
  }
  const answerable = rows.filter((r) => r.gold);
  const unanswerable = rows.filter((r) => !r.gold);
  const rate = (list: typeof rows) =>
    list.filter((r) => r.ok).length / Math.max(1, list.length);
  const cited = rate(answerable);
  const declined = rate(unanswerable);
  console.log(
    `Cited the gold section: ${(cited * 100).toFixed(0)}% (threshold ${suite.thresholds.citedGold * 100}%); declined unanswerable: ${(declined * 100).toFixed(0)}% (threshold ${suite.thresholds.declined * 100}%); median ${rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)]} ms`,
  );
  if (
    cited < suite.thresholds.citedGold ||
    declined < suite.thresholds.declined
  )
    process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
