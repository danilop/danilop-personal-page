import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { chromium } from "playwright";
import { executablePath } from "puppeteer";
import { repositoryFixture } from "./repository-fixture";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";
import { confirmedShareUrl, shareLinks } from "../runtime/share-links";
import { siteSchema } from "../core/config";

test("sharing encodes one URL consistently and bounds Bluesky graphemes", () => {
  const title = "A & B: 👩‍💻";
  const url = "https://example.com/article/?a=1&b=2#part";
  const links = shareLinks(title, url);
  assert.equal(new URL(links.x).searchParams.get("text"), title);
  assert.equal(new URL(links.x).searchParams.get("url"), url);
  assert.equal(new URL(links.linkedin).searchParams.get("url"), url);
  assert.equal(
    new URL(links.email).searchParams.get("body"),
    `${title}\n\n${url}`,
  );
  const text = new URL(
    shareLinks("👩‍💻".repeat(400), url).bluesky,
  ).searchParams.get("text")!;
  assert.equal(
    Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ).length,
    300,
  );
  assert(text.endsWith(url));
  // Public short-link configuration must be an origin, not an arbitrary URL.
  const field = siteSchema.shape.shortLinkOrigin;
  assert(field.safeParse("https://short.example").success);
  for (const value of [
    "http://short.example",
    "https://short.example/",
    "https://user@short.example",
    "https://short.example?x=1",
  ])
    assert(!field.safeParse(value).success);
});

test("short-link confirmation requires an exact public target and never follows redirects", async () => {
  const full = "https://example.com/article/";
  const short = "https://short.example/a";
  const signal = new AbortController().signal;
  const response =
    (body: unknown, status = 200): typeof fetch =>
    async (input, init) => {
      assert.equal(String(input), short + "?__link_status=1");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      return Response.json(body, { status });
    };
  assert.equal(
    await confirmedShareUrl(full, short, signal, response({ target: full })),
    short,
  );
  for (const body of [
    { target: full + "other" },
    { owner: "private" },
    null,
    "oops",
  ])
    assert.equal(
      await confirmedShareUrl(full, short, signal, response(body)),
      full,
    );
  assert.equal(
    await confirmedShareUrl(full, short, signal, response({}, 404)),
    full,
  );
  assert.equal(await confirmedShareUrl(full, "", signal), full);
  const offline: typeof fetch = () => Promise.reject(new Error("offline"));
  assert.equal(await confirmedShareUrl(full, short, signal, offline), full);
});

test(
  "article sharing uses both placements, handles fallback, and works on mobile without JS",
  { timeout: 120000 },
  async (t) => {
    const fixture = await repositoryFixture(process.cwd());
    t.after(() => fixture.cleanup());
    const env = isolatedGitEnvironment(process.cwd());
    delete env.NOTES_AUTHORING_PREVIEW;
    delete env.AWS_BRANCH;
    delete env.NOTES_BASE_PATH;
    await promisify(execFile)("npm", ["run", "build"], {
      cwd: fixture.dir,
      env,
      maxBuffer: 8 * 1024 * 1024,
    });
    const server = http.createServer((req, res) => {
      void (async () => {
        const pathname = new URL(req.url!, "http://local.invalid").pathname;
        const file = path.join(
          fixture.dir,
          "dist",
          pathname.endsWith("/") ? pathname + "index.html" : pathname,
        );
        try {
          const bytes = await fs.readFile(file);
          const ext = path.extname(file);
          res.setHeader(
            "content-type",
            ext === ".js"
              ? "text/javascript"
              : ext === ".css"
                ? "text/css"
                : ext === ".html"
                  ? "text/html"
                  : "application/octet-stream",
          );
          res.end(bytes);
        } catch {
          res.writeHead(404);
          res.end();
        }
      })();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    t.after(
      () => new Promise<void>((resolve) => server.close(() => resolve())),
    );
    const address = server.address();
    assert(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const route = "/writing/clever-enough-to-find-the-loophole/";
    const full = "https://www.danilop.net" + route;
    const short = "https://danilop.link/clever-loophole";
    const browser = await chromium.launch({
      executablePath: await executablePath({ headless: "shell" }),
    });
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let requests = 0;
    let target = full;
    await page.route("https://danilop.link/**", (request) => {
      requests++;
      return request.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ target }),
      });
    });
    await page.addInitScript(`
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {writeText(value) {sessionStorage.setItem("copied", value); return Promise.resolve();}}
      });
      Object.defineProperty(navigator, "share", {
        value(data) {sessionStorage.setItem("shared", JSON.stringify(data)); return Promise.resolve();}
      });
      Object.defineProperty(navigator, "canShare", {value() {return true;}});
    `);
    await page.goto(origin + route);
    assert.equal(requests, 0, "reading must not probe short links");
    assert.equal(await page.locator("[data-share-open]").count(), 2);
    assert.equal(await page.locator("dialog[data-article-share]").count(), 1);
    await page.getByRole("button", { name: "Share ↗", exact: true }).click();
    await page
      .getByRole("button", { name: "Copy short link", exact: true })
      .waitFor();
    assert.equal(await page.getByLabel("Link to share").inputValue(), short);
    assert.equal(
      new URL(
        (await page
          .getByRole("link", { name: "LinkedIn", exact: true })
          .getAttribute("href")) ?? "",
      ).searchParams.get("url"),
      short,
    );
    await page.getByRole("button", { name: "Copy short link" }).click();
    await page
      .getByText("Link copied to the clipboard.", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("copied")),
      short,
    );
    await page.getByRole("button", { name: "Share on your device" }).click();
    await page.waitForFunction(() => sessionStorage.getItem("shared") !== null);
    assert.equal(
      JSON.parse(
        (await page.evaluate(() => sessionStorage.getItem("shared"))) ?? "{}",
      ).url,
      short,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Share ↗",
    );
    target = full + "wrong";
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Share this article", exact: true })
      .click();
    await page
      .getByText("The short link could not be confirmed.", { exact: false })
      .waitFor();
    assert.equal(await page.getByLabel("Link to share").inputValue(), full);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(
      new URL(
        (await page
          .getByRole("link", { name: "Email", exact: true })
          .getAttribute("href")) ?? "",
      ).searchParams
        .get("body")
        ?.endsWith(full),
      true,
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText() {
            return Promise.reject(new Error("denied"));
          },
        },
      });
    });
    await page
      .getByRole("button", { name: "Copy full link", exact: true })
      .click();
    await page.getByText("Copy was unavailable.", { exact: false }).waitFor();
    assert.equal(
      await page
        .getByLabel("Link to share")
        .evaluate(
          (input: HTMLInputElement) =>
            input.selectionEnd! - input.selectionStart!,
        ),
      full.length,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Share this article",
    );
    assert.deepEqual(errors, []);
    const noJS = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const fallback = await noJS.newPage();
    await fallback.goto(origin + route);
    await fallback
      .locator("noscript details")
      .first()
      .getByText("Share this article", { exact: true })
      .click();
    assert.equal(
      await fallback
        .locator("noscript details")
        .first()
        .getByRole("link", { name: full, exact: true })
        .isVisible(),
      true,
    );
  },
);
