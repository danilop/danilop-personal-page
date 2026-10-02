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

async function fixture(
  t,
  {
    initialText = original,
    fixError = "",
    withRepetitions = false,
    findingExcerpt = "One phrase",
  } = {},
) {
  let saved = initialText;
  let review;
  let reviewRunning = false,
    reviewJobError = "";
  const reviewRequests = [];
  let fix;
  let lastFixRequest;
  let candidates = [];
  const imageRecoveryRequests = [];
  const agents = [{ id: "codex", label: "Codex fixture", installed: true }];
  const findings = [
    {
      piece: "browser-fixture",
      rule: "repeated-phrase",
      severity: "review",
      message: "Consider this repeated phrase.",
      excerpt: findingExcerpt,
      line: 12,
      start: initialText.indexOf("One phrase"),
      end: initialText.indexOf("One phrase") + 10,
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
      repetitions: withRepetitions
        ? ["One phrase", "phrase"]
            .map((text) => ({
              example: text,
              n: text.split(" ").length,
              locations: [...data.text.matchAll(new RegExp(text, "g"))].map(
                (m) => ({
                  piece: "browser-fixture",
                  line: data.text.slice(0, m.index).split("\n").length,
                  start: m.index,
                  end: m.index + text.length,
                  text,
                }),
              ),
            }))
            .filter((row) => row.locations.length > 1)
            .map((row) => ({ ...row, count: row.locations.length }))
        : [],
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
  let shortLinks = [];
  let registryVersion = 0;
  const linkState = () => ({
    links: shortLinks,
    configured: true,
    shortOrigin: "https://short.example.com",
    sourceRevision: digest(saved),
    registryRevision: String(registryVersion),
  });
  const handlers = {
    "short-links": linkState,
    "short-link-reserve": (data) => {
      assert.equal(data.file, filename);
      assert.equal(data.revision, digest(saved));
      assert.equal(data.registryRevision, String(registryVersion));
      shortLinks.push({ code: data.code, target: null });
      registryVersion++;
      return linkState();
    },
    "short-link-deactivate": (data) => {
      shortLinks = shortLinks.filter((link) => link.code !== data.code);
      registryVersion++;
      return linkState();
    },
    "short-link-publish": () => ({
      error: "Deploy this commit before publishing redirects",
    }),
    "short-link-check": () => ({
      results: shortLinks.map((link) => ({
        code: link.code,
        ready: false,
        status: 404,
      })),
    }),
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
      if (saved.includes("draft: false") && !saved.includes("publishedAt:"))
        saved = saved.replace(
          "draft: false",
          "draft: false\npublishedAt: 2026-10-01T12:02:00.000Z",
        );
      return { text: saved, revision: digest(saved) };
    },
    history: () => [
      {
        id: "version-one",
        created: new Date().toISOString(),
        revision: digest(initialText),
      },
    ],
    version: () => ({ text: initialText }),
    "review-agents": () => agents,
    "review-start": (data) => {
      reviewRequests.push(data);
      review = report(data);
      if (reviewRunning) review.state = "running";
      return review;
    },
    "review-job": () => {
      if (reviewJobError) throw Error(reviewJobError);
      return review;
    },
    "review-fingerprint": (data) => ({ fingerprint: digest(data.text) }),
    "review-prompt": () => ({ prompt: "Review the fixture only." }),
    "review-cancel": () => ({ ok: true }),
    "fix-prompt": () => ({ prompt: "A bounded fixture edit." }),
    "fix-start": (data) => {
      lastFixRequest = data;
      if (fixError)
        return { id: "failed-fix", state: "failed", error: fixError };
      fix = {
        id: "fix-one",
        state: "complete",
        result: {
          summary: "A small revision",
          ...(data.repetitions?.length
            ? {
                assessments: data.targets.map((_, target) => ({
                  target,
                  decision: "change",
                  reason: "Nearby repeated phrasing.",
                })),
              }
            : {}),
          changes: data.targets.map((target, i) => ({
            target: i,
            before: target.before,
            after: data.repetitions?.length
              ? target.before.replace("One phrase", "A fresh phrase")
              : "A fresh phrase",
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
    "image-touch": () => ({ ok: true }),
    "image-recovery": (data) => {
      imageRecoveryRequests.push(data);
      return { ok: true };
    },
    "image-start": (data) => {
      if (data.kind === "brief")
        return {
          id: "brief-one",
          state: "complete",
          brief: "A simple diagram",
        };
      const generated = {
        ...candidate,
        id: "generated-" + candidates.length,
        altText: "Blue ink diagram " + (candidates.length + 1),
      };
      candidates = [generated, ...candidates];
      return {
        id: "generation-one",
        state: "complete",
        candidate: generated.id,
      };
    },
    "image-import": () => {
      candidates = [candidate, ...candidates];
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
        const result = handlers[action](data);
        if (result.error) res.statusCode = 409;
        res.end(JSON.stringify(result));
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
        (
          await fs.readFile(
            path.join(
              ["finding-range.js", "repetition-batch.js"].includes(name)
                ? "lib"
                : "authoring",
              name,
            ),
            "utf8",
          )
        ).replace("__TOKEN__", "fixture-token"),
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
                ["finding-range.js", "repetition-batch.js"].includes(
                  path.basename(new URL(entry.url).pathname),
                )
                  ? "lib"
                  : "authoring",
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
  return {
    page,
    getSaved: () => saved,
    getFixRequest: () => lastFixRequest,
    setDisk: (text) => {
      saved = text;
    },
    setReviewRunning: (value) => {
      reviewRunning = value;
    },
    setReviewJobError: (value) => {
      reviewJobError = value;
    },
    reviewRequests,
    imageRecoveryRequests,
    setCandidates: (value) => {
      candidates = value;
    },
  };
}

test("image recovery protects current and Undo references separately and cleanup removes stale candidate controls", async (t) => {
  const f = await fixture(t),
    { page } = f;
  await page.locator("#show-images").click();
  await page.locator("#image-brief").fill("A simple diagram");
  await page
    .getByRole("button", { name: "Continue to generate", exact: true })
    .click();
  await page.locator("#generate-image").click();
  await page.waitForFunction(
    () => document.querySelector("#image-alt").value === "Blue ink diagram 1",
  );
  await page.locator("#insert-image").click();
  await page.waitForFunction(() =>
    document.querySelector("#source").value.includes("images/fixture.png"),
  );
  await page.evaluate(() => window.protectAuthorImages());
  assert(f.imageRecoveryRequests.at(-1).names.includes("fixture.png"));
  const client = f.imageRecoveryRequests.at(-1).client;
  await page.locator("#undo").click();
  await page.evaluate(() => window.protectAuthorImages());
  assert(!f.imageRecoveryRequests.at(-1).names.includes("fixture.png"));
  assert(f.imageRecoveryRequests.at(-1).undoNames.includes("fixture.png"));
  await page.locator("#redo").click();
  await page.evaluate(() => window.protectAuthorImages());
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector("#source").value.includes("images/fixture.png"),
  );
  await page.evaluate(() => window.protectAuthorImages());
  assert.equal(f.imageRecoveryRequests.at(-1).client, client);
  assert(f.imageRecoveryRequests.at(-1).names.includes("fixture.png"));
  await page.locator("#show-images").click();
  await page.waitForFunction(
    () => document.querySelector("#image-candidates").children.length === 1,
  );
  assert.equal(await page.locator("#image-candidates button").count(), 1);
  f.setCandidates([]);
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("author-image-cleanup", { detail: 99 }),
    ),
  );
  await page.waitForFunction(
    () => !document.querySelector("#image-candidates").children.length,
  );
  assert.equal(await page.locator("#insert-image").isDisabled(), true);
  assert.equal(await page.locator("#image-alt").inputValue(), "");
});

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
  await page.waitForFunction(
    () => document.querySelector("#image-alt").value === "Blue ink diagram 1",
  );
  await page.locator("#image-alt").fill("A test illustration");
  assert.deepEqual(
    await page.locator("#image-position option").allTextContents(),
    ["Beginning of article", "End of article"],
  );
  const beforeImage = await page.locator("#source").inputValue();
  await page.locator("#insert-image").click();
  await page.waitForFunction(() =>
    document.querySelector("#source").value.includes("![A test illustration]"),
  );
  assert.equal(
    getSaved().includes("fixture.png"),
    false,
    "Insertion remains unsaved",
  );
  const withOpeningImage = matter(await page.locator("#source").inputValue());
  assert.deepEqual(withOpeningImage.data, matter(beforeImage).data);
  assert.equal(
    withOpeningImage.content.trimStart(),
    "![A test illustration](images/fixture.png)\n\n" +
      matter(beforeImage).content,
  );
  await page.locator("#undo").click();
  assert.equal(await page.locator("#source").inputValue(), beforeImage);
  await page.locator("#image-position").selectOption("end");
  await page.locator("#insert-image").click();
  await page.waitForFunction(() =>
    document.querySelector("#source").value.includes("![A test illustration]"),
  );
  assert.equal(
    await page.locator("#source").inputValue(),
    beforeImage + "\n\n![A test illustration](images/fixture.png)\n\n",
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

test("publishing keeps the server-assigned timestamp in the editor after saving", async (t) => {
  const { page, getSaved } = await fixture(t);
  await page.getByText("Post details", { exact: true }).click();
  await page.locator("#draft-field").uncheck();
  await page.locator("#save").click();
  await page.waitForFunction(
    () => document.querySelector("#status").textContent === "Saved locally",
  );
  assert.match(getSaved(), /publishedAt: 2026-10-01T12:02:00.000Z/);
  assert.equal(await page.locator("#source").inputValue(), getSaved());
});

test("failed fix providers show the error without offering nonexistent proposals", async (t) => {
  const { page, getSaved } = await fixture(t, {
    fixError:
      "CLI exited 1: Failed to authenticate: OAuth session expired and could not be refreshed",
  });
  await page.locator("#show-review").click();
  await page.locator("#run-checks").click();
  await page.locator(".finding-group summary").click();
  await page
    .getByRole("button", { name: "Suggest a fix", exact: true })
    .click();
  await page.locator("#fix-run").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#fix-notice")
      .textContent.includes("OAuth session expired"),
  );
  const message = await page.locator("#fix-notice").textContent();
  assert.match(message, /No new proposal was returned/);
  assert.doesNotMatch(message, /Compare the named proposals/);
  assert.equal(await page.locator("#fix-apply").isEnabled(), false);
  assert.equal(getSaved(), original);
});

test("review all repetitions sends the article and full list, then applies only a reviewed proposal", async (t) => {
  const article = original + "\nOne phrase deserves a second paragraph.\n";
  const { page, getSaved, getFixRequest } = await fixture(t, {
    initialText: article,
    withRepetitions: true,
  });
  await page.evaluate(() =>
    localStorage.setItem(
      "author-fix-instructions",
      "Only fix this single finding.",
    ),
  );
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  assert.match(page.url(), /127\.0\.0\.1:\d+\/_author\//);
  assert.match(await page.title(), /Author|Editor|Preview/i);
  await page.locator("#show-review").click();
  await page.locator("#run-checks").click();
  await page
    .getByText("All repeated stem sequences (2)", { exact: true })
    .click();
  await page.locator("#review-repetitions").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#fix-quote")
        .textContent.includes("groups across") &&
      !document.querySelector("#fix-run").disabled,
  );
  assert.equal(
    getFixRequest(),
    undefined,
    "Opening settings does not send a model request",
  );
  assert.equal(await page.locator("#fix-context").inputValue(), "article");
  assert.equal(await page.locator("#fix-context").isDisabled(), true);
  assert.match(
    await page.locator("#fix-instructions").inputValue(),
    /distance/,
  );
  const batchInstructions = await page
    .locator("#fix-instructions")
    .inputValue();
  assert.match(batchInstructions, /Return all worthwhile edits together/);
  assert.doesNotMatch(batchInstructions, /Only fix this single finding/);
  assert.equal(
    await page.locator("#fix-approach").inputValue(),
    "Minimal edit",
  );
  assert.equal(
    await page.locator("#fix-approach option:checked").textContent(),
    "Small changes per passage",
  );
  assert.equal(
    await page.locator("#fix-approach-help").textContent(),
    "Keep each edit small. Return all worthwhile fixes together.",
  );
  assert.deepEqual(
    await page.locator("#fix-approach option").allTextContents(),
    ["Small changes per passage", "Rephrase where useful"],
  );
  await page.locator("#fix-approach").selectOption("Rephrase");
  assert.match(
    await page.locator("#fix-approach-help").textContent(),
    /Reshape sentences where useful/,
  );
  await page.locator("#fix-approach").selectOption("Minimal edit");
  await page.getByText("Customize instructions", { exact: true }).click();
  await page.locator("#fix-remember").check();
  await page
    .locator("#fix-instructions")
    .fill("Temporary custom batch instructions");
  await page.locator("#fix-reset").click();
  assert.equal(
    await page.locator("#fix-instructions").inputValue(),
    batchInstructions,
  );
  assert.deepEqual(
    await page.evaluate(() => [
      localStorage.getItem("author-fix-instructions"),
      localStorage.getItem("author-repetition-instructions"),
    ]),
    ["Only fix this single finding.", batchInstructions],
  );
  if (process.env.AUTHOR_REPETITION_SCREENSHOT) {
    await page.screenshot({
      path: process.env.AUTHOR_REPETITION_SCREENSHOT.replace(
        ".png",
        "-settings.png",
      ),
      fullPage: false,
    });
  }
  await page.locator("#fix-run").click();
  await page.waitForFunction(
    () => !document.querySelector("#fix-apply").disabled,
  );
  const request = getFixRequest();
  assert.equal(request.text, article);
  assert.equal(request.repetitions.length, 2);
  assert.equal(
    request.targets.length,
    2,
    "Nested matches share targets, while separate paragraphs stay independent",
  );
  assert.equal(request.targets[0].before, "One phrase. One phrase.");
  assert.equal(getSaved(), article);
  if (process.env.AUTHOR_REPETITION_SCREENSHOT) {
    await page.screenshot({
      path: process.env.AUTHOR_REPETITION_SCREENSHOT,
      fullPage: false,
    });
  }
  const choices = page.locator('#fix-changes input[type="checkbox"]');
  assert.equal(await choices.count(), 2);
  assert.equal(await page.locator("#fix-changes textarea").count(), 2);
  await page.locator("#fix-coverage summary").click();
  assert.equal(await page.locator("#fix-coverage p").count(), 2);
  assert.match(
    await page.locator("#fix-coverage").textContent(),
    /Nearby repeated phrasing/,
  );
  for (const selected of [[0], [1], [0, 1]]) {
    for (let i = 0; i < 2; i++)
      await choices.nth(i).setChecked(selected.includes(i));
    await page.waitForFunction(
      () => !document.querySelector("#fix-apply").disabled,
    );
    await page.locator("#fix-apply").click();
    let expected = article;
    for (const i of [...selected].sort((a, b) => b - a)) {
      const target = request.targets[i];
      expected =
        expected.slice(0, target.start) +
        target.before.replace("One phrase", "A fresh phrase") +
        expected.slice(target.end);
    }
    assert.equal(await page.locator("#source").inputValue(), expected);
    assert.equal(getSaved(), article, "Applying does not save");
    await page.locator("#fixUndo").click();
    assert.equal(await page.locator("#source").inputValue(), article);
  }
  await page.locator("#proseEditor").fill("\nChanged article.\n");
  await page.waitForFunction(() => document.querySelector("#fix-run").disabled);
  assert.equal(
    await page.locator("#fix-run").isDisabled(),
    true,
    "Stale proposals cannot be rerun or applied",
  );
  assert.deepEqual(
    consoleErrors,
    [],
    "No browser console errors in the batch flow",
  );
});

test("finding previews collapse Markdown padding while navigation keeps source offsets", async (t) => {
  const { page, getSaved } = await fixture(t, {
    findingExcerpt:
      "This can  improve reasoning                                   , but a passing test may miss a defect.",
  });
  await page.locator("#show-review").click();
  await page.locator("#run-checks").click();
  await page.locator(".finding-group summary").click();
  assert.equal(
    await page.locator(".review-finding blockquote").textContent(),
    "This can improve reasoning, but a passing test may miss a defect.",
  );
  if (process.env.AUTHOR_EXCERPT_SCREENSHOT) {
    await page.locator(".review-finding").scrollIntoViewIfNeeded();
    await page
      .locator(".review-finding")
      .screenshot({ path: process.env.AUTHOR_EXCERPT_SCREENSHOT });
  }
  await page
    .getByTitle("Edit this passage in your own words", { exact: true })
    .click();
  const selected = await page
    .locator("#proseEditor")
    .evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd));
  assert.equal(selected, "One phrase");
  assert.equal(getSaved(), original);
});

for (const kind of ["checks", "ai"]) {
  test(`${kind} reviews can rerun after reloading, including recovery from a lost job`, async (t) => {
    const f = await fixture(t);
    const { page } = f;
    await page.locator("#show-review").click();
    if (kind === "ai") await page.locator("#editorial-view").click();
    const run = page.locator(
      kind === "checks" ? "#run-checks" : "#run-editorial",
    );
    await run.click();
    await page.waitForFunction(() =>
      document
        .querySelector("#review-notice")
        .textContent.includes("Review complete"),
    );
    const changed = original + "\nA new paragraph from disk.\n";
    f.setDisk(changed);
    await page.locator("#reload").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#source")
        .value.includes("A new paragraph from disk."),
    );
    assert.equal(await page.locator("#source").inputValue(), changed);
    assert.equal(await run.isEnabled(), true);
    assert.equal(await page.locator("#rerun-review").isEnabled(), true);
    assert.equal(
      f.reviewRequests.length,
      1,
      "Reload must not send a model request",
    );
    f.setReviewRunning(true);
    await page.locator("#rerun-review").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#rerun-review").disabled &&
        document
          .querySelector("#review-notice")
          .textContent.includes("Review running"),
    );
    assert.equal(f.reviewRequests[1].text, changed);
    assert.equal(f.reviewRequests[1].kind, kind);
    await page.locator("#reload").click();
    await page.waitForFunction(
      () => document.querySelector("#review-setup").open,
    );
    assert.equal(
      await page.locator("#rerun-review").isEnabled(),
      false,
      "Reload must not unlock a genuinely running job",
    );
    f.setReviewJobError("Unknown review job after server restart");
    await page.locator("#reload").click();
    await page.waitForFunction(
      () => !document.querySelector("#rerun-review").disabled,
    );
    assert.match(
      await page.locator("#review-notice").textContent(),
      /Could not retrieve review status/,
    );
    assert.equal(await page.locator("#checks-view").isEnabled(), true);
    assert.equal(await page.locator("#editorial-view").isEnabled(), true);
    assert.equal(f.reviewRequests.length, 2);
    f.setReviewRunning(false);
    f.setReviewJobError("");
    await page.locator("#rerun-review").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#review-notice")
        .textContent.includes("Review complete"),
    );
    assert.equal(f.reviewRequests.length, 3);
    assert.equal(f.reviewRequests[2].kind, kind);
    assert.equal(f.getSaved(), changed);
  });
}

test("generated descriptions follow candidates and preserve per-image edits", async (t) => {
  const { page } = await fixture(t);
  await page.locator("#show-images").click();
  await page.locator("#image-brief").fill("A simple diagram");
  await page
    .getByRole("button", { name: "Continue to generate", exact: true })
    .click();
  await page.locator("#generate-image").click();
  await page.waitForFunction(
    () => document.querySelector("#image-alt").value === "Blue ink diagram 1",
  );
  await page.locator("#image-alt").fill("My edited description");
  await page.locator('#image-steps [data-step="generate"]').click();
  await page.locator("#generate-image").click();
  await page.waitForFunction(
    () => document.querySelector("#image-alt").value === "Blue ink diagram 2",
  );
  await page.locator('#image-candidates [data-id="generated-0"]').click();
  assert.equal(
    await page.locator("#image-alt").inputValue(),
    "My edited description",
  );
  await page.locator("#image-alt").fill("");
  await page.locator('#image-candidates [data-id="generated-1"]').click();
  assert.equal(
    await page.locator("#image-alt").inputValue(),
    "Blue ink diagram 2",
  );
  await page.locator('#image-candidates [data-id="generated-0"]').click();
  assert.equal(await page.locator("#image-alt").inputValue(), "");
  assert.equal(await page.locator("#insert-image").isDisabled(), true);
  await page.locator('#image-steps [data-step="generate"]').click();
  await page.locator("#image-upload").setInputFiles({
    name: "imported.png",
    mimeType: "image/png",
    buffer: Buffer.from("fixture"),
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#image-notice")
      .textContent.includes("Image imported locally"),
  );
  assert.equal(await page.locator("#image-alt").inputValue(), "");
  await page.reload();
  await page.locator("#show-images").click();
  await page.locator('#image-candidates [data-id="generated-1"]').click();
  assert.equal(
    await page.locator("#image-alt").inputValue(),
    "Blue ink diagram 2",
  );
});

test("short-link controls reserve drafts, show deployment errors and check activation independently", async (t) => {
  const { page } = await fixture(t);
  assert.equal(new URL(page.url()).pathname, "/_author/");
  assert.equal(await page.title(), "Author · Notes Along the Way");
  await page.locator("#short-links-panel summary").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#short-link-status")
      .textContent.includes("Saved reservations"),
  );
  await page.locator("#short-link-code").fill("fixture-link");
  await page.locator("#short-link-reserve").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#short-link-list")
      .textContent.includes("fixture-link"),
  );
  assert.match(
    await page.locator("#short-link-list").innerText(),
    /reserved for a draft/,
  );
  await page.locator("#short-link-publish").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#short-link-status")
      .textContent.includes("Deploy this commit"),
  );
  await page.locator("#short-link-check").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#short-link-status")
      .textContent.includes("not ready (HTTP 404)"),
  );
  if (process.env.NOTES_LINKS_QA_SCREENSHOT)
    await page.screenshot({ path: process.env.NOTES_LINKS_QA_SCREENSHOT });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Short-link controls must not cause horizontal overflow",
  );
  if (process.env.NOTES_LINKS_QA_SCREENSHOT)
    await page.screenshot({
      path: process.env.NOTES_LINKS_QA_SCREENSHOT.replace(
        /\.png$/,
        "-mobile.png",
      ),
    });
  await page.getByRole("button", { name: "Disable alias locally" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#short-link-list")
      .textContent.includes("No short codes"),
  );
});
