const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { executablePath } = require("puppeteer");
const matter = require("gray-matter");
const filename = "content/pieces/browser-fixture/index.md";
const original =
  "---\nid: browser-fixture\ntitle: Browser fixture\nsummary: A browser test article\ndraft: true\ntags: [computing]\n---\n\n## Opening\n\nOne phrase. One phrase.\n";
const digest = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function fixture(t) {
  let saved = original;
  let review;
  let fix;
  let candidates = [];
  const agents = [{ id: "codex", label: "Codex fixture", installed: true }];
  const findings = [
    {
      piece: "browser-fixture",
      rule: "repeated-phrase",
      severity: "review",
      message: "Consider this repeated phrase.",
      excerpt: "One phrase",
      line: 12,
      start: original.indexOf("One phrase"),
      end: original.indexOf("One phrase") + 10,
      verified: true,
    },
  ];
  const report = (data) => ({
    id: crypto.randomUUID(),
    kind: data.kind,
    state: "complete",
    fingerprint: digest(data.text),
    finishedAt: new Date().toISOString(),
    sources: { [filename]: digest(saved) },
    result: {
      summary: "Fixture checks completed",
      checks: [
        {
          name: "Fixture",
          status: "completed",
          detail: "Local deterministic check",
        },
      ],
      findings: data.text.includes("One phrase. One phrase") ? findings : [],
      files: { "browser-fixture": filename },
      repetitions: [],
    },
  });
  const candidate = {
    id: "image-one",
    created: new Date().toISOString(),
    width: 1,
    height: 1,
    model: "local fixture",
    brief: "A simple diagram",
  };
  const handlers = {
    files: () => ({
      files: [filename],
      build: { state: "ready", version: 1, error: "" },
    }),
    catalog: () => [
      {
        file: filename,
        title: "Browser fixture",
        status: "draft",
        kind: "piece",
      },
    ],
    tags: () => [
      {
        id: "computing",
        label: "Computing",
        description: "Computing history",
        pieces: [],
        published: 1,
        draft: 1,
      },
    ],
    read: () => ({
      text: saved,
      revision: digest(saved),
      publication: "draft",
    }),
    navigation: () => ({ url: "/writing/browser-fixture/", context: "" }),
    metadata: (data) => {
      const parsed = matter(data.text);
      return {
        text: matter.stringify(parsed.content, {
          ...parsed.data,
          ...data.fields,
        }),
        fields: { ...parsed.data, ...data.fields },
      };
    },
    preview: () => ({
      html: '<!doctype html><html><body><main><h1>Browser fixture</h1><h2 id="opening">Opening</h2><p>Article preview</p></main></body></html>',
      contexts: [],
      context: "",
      message: "Preview ready",
    }),
    save: (data) => {
      assert.equal(data.revision, digest(saved));
      saved = data.text;
      return { revision: digest(saved) };
    },
    history: () => [
      {
        id: "version-one",
        created: new Date().toISOString(),
        revision: digest(original),
      },
    ],
    version: () => ({ text: original }),
    "review-agents": () => agents,
    "review-start": (data) => {
      review = report(data);
      return review;
    },
    "review-job": () => review,
    "review-fingerprint": (data) => ({ fingerprint: digest(data.text) }),
    "review-prompt": () => ({ prompt: "Review the fixture only." }),
    "review-cancel": () => ({ ok: true }),
    "fix-prompt": () => ({ prompt: "A bounded fixture edit." }),
    "fix-start": (data) => {
      fix = {
        id: "fix-one",
        state: "complete",
        result: {
          summary: "A small revision",
          changes: data.targets.map((target, i) => ({
            target: i,
            before: target.before,
            after: "A fresh phrase",
            reason: "Avoid repetition",
          })),
        },
      };
      return fix;
    },
    "fix-job": () => fix,
    "fix-cancel": () => ({ ok: true }),
    "image-settings": () => ({
      available: true,
      reason: "Local fixture provider",
      style: "Simple line drawing",
      agents,
    }),
    "image-list": () => candidates,
    "image-start": (data) => {
      if (data.kind === "brief")
        return {
          id: "brief-one",
          state: "complete",
          brief: "A simple diagram",
        };
      candidates = [candidate];
      return { id: "generation-one", state: "complete" };
    },
    "image-import": () => {
      candidates = [candidate];
      return candidate;
    },
    "image-data": () => ({
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    }),
    "image-insert": (data) => ({
      markdown: `![${data.alt}](images/fixture.png)`,
    }),
  };
  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/_author/api/")) {
        const action = url.pathname.split("/").at(-1);
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const data = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        assert(handlers[action], `Unexpected API call ${action}`);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(handlers[action](data)));
        return;
      }
      const name =
        url.pathname === "/_author/"
          ? "index.html"
          : path.basename(url.pathname);
      if (!/^(index\.html|[a-z-]+\.js)$/.test(name)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        name.endsWith(".js") ? "text/javascript" : "text/html",
      );
      res.end(
        (await fs.readFile(path.join("authoring", name), "utf8")).replace(
          "__TOKEN__",
          "fixture-token",
        ),
      );
    })().catch((error) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch({
    executablePath: await executablePath({ headless: "shell" }),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.startPreciseCoverage", {
    callCount: true,
    detailed: true,
  });
  t.after(async () => {
    try {
      const { result } = await cdp.send("Profiler.takePreciseCoverage");
      if (process.env.NODE_V8_COVERAGE) {
        const mapped = result
          .filter((entry) => /\/_author\/[a-z-]+\.js$/.test(entry.url))
          .map((entry) => ({
            ...entry,
            url: pathToFileURL(
              path.resolve(
                "authoring",
                path.basename(new URL(entry.url).pathname),
              ),
            ).href,
          }));
        await fs.mkdir(process.env.NODE_V8_COVERAGE, { recursive: true });
        await fs.writeFile(
          path.join(
            process.env.NODE_V8_COVERAGE,
            `coverage-${process.pid}-${Date.now()}-browser.json`,
          ),
          JSON.stringify({ result: mapped, timestamp: Date.now() / 1000 }),
        );
      }
      assert.deepEqual(errors, [], "Editor must not throw browser errors");
    } finally {
      await browser.close();
    }
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/_author/`);
  await page.waitForFunction(
    () => document.querySelector("#title-field").value === "Browser fixture",
  );
  return { page, getSaved: () => saved };
}

test("editor supports prose editing, review decisions, checked suggestions, and local image insertion", async (t) => {
  const { page, getSaved } = await fixture(t);
  assert.match(await page.title(), /Author|Editor|Preview/i);
  await page
    .locator("#proseEditor")
    .fill("\n## Opening\n\nOne phrase. One phrase.\n\nAn unsaved addition.\n");
  assert.match(await page.locator("#status").textContent(), /Unsaved/);
  assert.equal(getSaved(), original);
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await page.locator("#save").click();
  await page.waitForFunction(
    () => document.querySelector("#status").textContent === "Saved locally",
  );
  assert.match(getSaved(), /An unsaved addition/);
  await page.getByRole("button", { name: "Full source", exact: true }).click();
  assert.equal(await page.locator("#source").isVisible(), true);
  await page.getByRole("button", { name: "Article text", exact: true }).click();
  await page.locator("#show-review").click();
  await page.locator("#run-checks").click();
  await page.locator(".finding-group summary").click();
  await page
    .getByRole("button", { name: "Keep as written", exact: true })
    .click();
  assert.match(await page.locator("#review-progress").textContent(), /1 kept/);
  await page.locator(".review-decisions summary").click();
  await page
    .getByRole("button", { name: "Reopen finding", exact: true })
    .click({ force: true });
  await page.locator(".finding-group summary").click();
  await page
    .getByRole("button", { name: "Mark as addressed", exact: true })
    .click();
  assert.match(
    await page.locator("#review-progress").textContent(),
    /1 addressed/,
  );
  await page.locator(".review-decisions summary").click();
  await page
    .getByRole("button", { name: "Reopen finding", exact: true })
    .click({ force: true });
  for (const value of ["metadata", "technical", "repetition", "style", "all"])
    await page.locator("#review-filter").selectOption(value);
  await page.locator(".finding-group summary").click();
  await page
    .getByRole("button", { name: "Suggest a fix", exact: true })
    .click();
  await page.locator("#fix-run").click();
  await page.waitForFunction(
    () => !document.querySelector("#fix-apply").disabled,
  );
  assert.equal(getSaved().includes("A fresh phrase"), false);
  await page.locator("#fix-apply").click();
  assert.match(await page.locator("#source").inputValue(), /A fresh phrase/);
  assert.match(await page.locator("#status").textContent(), /Unsaved/);
  await page.locator("#fixUndo").click();
  assert.doesNotMatch(
    await page.locator("#source").inputValue(),
    /A fresh phrase/,
  );
  await page.locator("#fix-back").click();
  await page.locator("#show-images").click();
  await page.locator("#suggest-brief").click();
  await page.waitForFunction(
    () => document.querySelector("#image-brief").value === "A simple diagram",
  );
  await page
    .getByRole("button", { name: "Continue to generate", exact: true })
    .click();
  await page.locator("#generate-image").click();
  await page.locator("#image-alt").fill("A test illustration");
  await page.locator("#insert-image").click();
  await page.waitForFunction(() =>
    document.querySelector("#source").value.includes("![A test illustration]"),
  );
  assert.equal(
    getSaved().includes("fixture.png"),
    false,
    "Insertion remains unsaved",
  );
  await page.locator("#undo").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#show-write").click();
  assert.equal(await page.locator("#proseEditor").isVisible(), true);
  await page.locator("#show-review").click();
  assert.equal(await page.locator("#review-panel").isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile editor must fit viewport",
  );
});
