const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
const { executablePath } = require("puppeteer");
const { browserCoverage } = require("./browser-coverage");

test(
  "prototype dialogs render each reader surface and restore the page through close, Escape, and backdrop",
  { timeout: 60000 },
  async (t) => {
    const root = path.resolve("prototypes/ink-and-paper");
    const cache = await fs.mkdtemp(path.join(os.tmpdir(), "prototype-vite-"));
    const { createServer } =
      await import("../prototypes/ink-and-paper/tests/browser-server.mjs");
    const server = await createServer({
      root,
      cacheDir: cache,
      server: {
        host: "127.0.0.1",
        port: 0,
        fs: {
          allow: [root, await fs.realpath(path.join(root, "node_modules"))],
        },
      },
    });
    await server.listen();
    const browser = await chromium.launch({
      executablePath: await executablePath({ headless: "shell" }),
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.setDefaultTimeout(5000);
    // Cold Vite compilation shares CI resources with the release integration tests.
    page.setDefaultNavigationTimeout(30000);
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const coverage = await browserCoverage(page, (url) => {
      const m = /\/src\/(App\.jsx|main\.jsx)(?:\?|$)/.exec(url);
      return m ? path.join(root, "src", m[1]) : null;
    });
    t.after(async () => {
      try {
        await coverage();
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
        await server.close();
        await fs.rm(cache, { recursive: true, force: true });
      }
    });
    await page.goto(server.resolvedUrls.local[0]);
    assert.match(await page.title(), /Notes Along the Way/);
    await page
      .getByRole("button", {
        name: "Read Why agents need more than conversation history",
        exact: true,
      })
      .click();
    assert.match(
      await page.locator("#panel-title").textContent(),
      /conversation history/,
    );
    await page
      .getByRole("button", { name: "Explore the collection", exact: true })
      .click();
    assert.match(await page.locator("#panel-title").textContent(), /agent/i);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    for (const title of await page
      .locator(".recent button")
      .allTextContents()) {
      await page
        .getByRole("button", { name: title.trim(), exact: true })
        .click();
      assert.equal(await page.locator("dialog").isVisible(), true);
      await page.keyboard.press("Escape");
    }
    for (const button of await page.locator(".cover-link").all()) {
      await button.click();
      assert.equal(await page.locator("dialog").isVisible(), true);
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "About Danilo Poccia", exact: true })
      .click();
    assert.match(await page.locator("#panel-title").textContent(), /Danilo/);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", {
        name: "Enlarge Nights under the stars",
        exact: true,
      })
      .click();
    assert.equal(await page.locator("dialog img").isVisible(), true);
    await page.mouse.click(3, 3);
    await page.waitForFunction(() => !document.querySelector("dialog").open);
    await page.getByRole("button", { name: "RSS", exact: true }).click();
    assert.match(await page.locator("dialog").textContent(), /feed/i);
    await page
      .getByRole("button", { name: "Back to the homepage", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  },
);
