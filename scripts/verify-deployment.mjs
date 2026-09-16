import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { deployment, sitePath, siteUrl } from "../core/deployment.mjs";

/** @param {{ markerUrl: string, revision: string, timeoutMs?: number, intervalMs?: number, fetcher?: typeof fetch, now?: () => number, sleep?: (ms: number) => Promise<void>, currentRevision?: () => Promise<string | undefined> }} options */
export async function waitForRevision({
  markerUrl,
  revision,
  timeoutMs = 0,
  intervalMs = 15000,
  fetcher = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  currentRevision,
}) {
  const end = now() + timeoutMs;
  let observed = "unavailable";
  while (true) {
    if (currentRevision) {
      const current = await currentRevision();
      if (current && current !== revision)
        return { status: "superseded", revision: current };
    }
    try {
      const response = await fetcher(markerUrl + "?revision=" + revision, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (response.ok) {
        const marker = await response.json();
        observed = String(marker.revision ?? "missing revision");
        if (marker.revision === revision) {
          assert.match(
            response.headers.get("cache-control") ?? "",
            /no-store/,
            "Deployment marker must not be cached",
          );
          return { status: "deployed", revision };
        }
      } else observed = `HTTP ${response.status}`;
    } catch (error) {
      observed = error.message;
    }
    if (now() >= end)
      throw Error(`Deployment ${revision} not verified; observed ${observed}`);
    await sleep(Math.min(intervalMs, end - now()));
  }
}

export async function checkSite({
  origin,
  basePath,
  preserveOriginal,
  indexable,
  fetcher = fetch,
}) {
  const at = (value) => siteUrl(value, origin, basePath);
  const get = async (url, status = 200) => {
    const response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, status, `${url}: unexpected response`);
    return response;
  };
  let home = "";
  for (const route of ["/", "/about/", "/writing/", "/archive/"]) {
    const response = await get(at(route));
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    const html = await response.text();
    assert.match(html, /Notes Along the Way/, `${route}: wrong website`);
    assert.ok(
      html.includes(`href="${at(route)}"`),
      `${route}: canonical URL missing`,
    );
    if (!indexable) assert.match(html, /name="robots"[^>]*content="noindex/);
    else {
      assert.doesNotMatch(html, /name="robots"[^>]*content="noindex/);
      assert.doesNotMatch(
        response.headers.get("x-robots-tag") ?? "",
        /noindex/i,
      );
    }
    if (route === "/") home = html;
  }
  const resources = new Set(
    [...home.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((m) => m[1])
      .filter(
        (value) =>
          value.startsWith(sitePath("/", basePath)) &&
          /\.(?:css|js|webp|png)(?:\?|$)/.test(value),
      ),
  );
  assert.ok(resources.size > 0, "Homepage has no local resources");
  for (const resource of resources) {
    const response = await get(new URL(resource, origin));
    assert.ok(
      !response.headers.get("content-type")?.includes("text/html"),
      `HTML fallback for ${resource}`,
    );
    if (resource.includes("/_astro/"))
      assert.match(response.headers.get("cache-control") ?? "", /immutable/);
    await response.arrayBuffer();
  }
  const feed = await (await get(at("/rss.xml"))).text();
  assert.match(feed, /<rss\b/);
  for (const match of feed.matchAll(/<link>([^<]+)<\/link>/g))
    assert.ok(
      match[1].startsWith(at("/")),
      `Feed link outside deployment: ${match[1]}`,
    );
  const article = feed.match(/<item>[\s\S]*?<link>([^<]+)<\/link>/)?.[1];
  if (article) await get(article);
  await get(at("/missing-deployment-check-" + Date.now() + "/"), 404);
  if (preserveOriginal) {
    for (const name of [
      "index.html",
      "about.html",
      "posts.html",
      "decks.html",
      "videos.html",
    ]) {
      const response = await get(
        new URL(name === "index.html" ? "/" : "/" + name, origin),
      );
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        await fs.readFile("legacy/snapshot-2026-09-15/" + name),
        `Original page changed: ${name}`,
      );
    }
  } else {
    for (const name of [
      "",
      "about.html",
      "posts.html",
      "decks.html",
      "videos.html",
    ]) {
      const html = await (await get(at("/original-site/" + name))).text();
      assert.match(html, /You are viewing the preserved original site/);
      assert.match(html, /noindex,follow/);
      assert.ok(
        html.includes(`href="${sitePath("/", basePath)}"`),
        "Snapshot return link missing",
      );
    }
  }
  if (indexable) {
    const robots = await (await get(at("/robots.txt"))).text();
    assert.ok(robots.includes(`Sitemap: ${at("/sitemap.xml")}`));
    assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
    const sitemap = await (await get(at("/sitemap.xml"))).text();
    assert.doesNotMatch(sitemap, /\/new\//);
  }
  return {
    pages: 4,
    resources: resources.size,
    feed: true,
    missingPage: 404,
    originalPreserved: preserveOriginal,
    snapshotChecked: !preserveOriginal,
  };
}

// A new uncached marker can arrive before cached HTML at every CDN edge.
export async function waitForSite(
  check,
  {
    timeoutMs = 0,
    intervalMs = 15000,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const end = now() + timeoutMs;
  while (true) {
    try {
      return await check();
    } catch (error) {
      if (now() >= end) throw error;
      await sleep(Math.min(intervalMs, end - now()));
    }
  }
}

async function main() {
  const revision =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  let currentRevision;
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_TOKEN) {
    currentRevision = async () => {
      const r = await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/git/ref/heads/main`,
        {
          headers: {
            authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!r.ok)
        throw Error(`Cannot check current main revision: HTTP ${r.status}`);
      return (await r.json()).object.sha;
    };
  }
  const result = await waitForRevision({
    markerUrl: siteUrl("/build.json", deployment.origin),
    revision,
    timeoutMs: process.argv.includes("--wait") ? 20 * 60 * 1000 : 0,
    currentRevision,
  });
  if (result.status === "superseded") {
    console.log(
      `Superseded by main revision ${result.revision}; this revision was not verified.`,
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      await fs.appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `Deployment check superseded by main revision ${result.revision}. No verification claimed for ${revision}.\n`,
      );
    if (process.env.GITHUB_OUTPUT)
      await fs.appendFile(process.env.GITHUB_OUTPUT, "verified=false\n");
    return;
  }
  const checks = await waitForSite(
    async () => {
      const checked = await checkSite(deployment);
      // Confirm the marker still identifies this revision after checking pages.
      await waitForRevision({
        markerUrl: siteUrl("/build.json", deployment.origin),
        revision,
      });
      return checked;
    },
    { timeoutMs: process.argv.includes("--wait") ? 3 * 60 * 1000 : 0 },
  );
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(process.env.GITHUB_OUTPUT, "verified=true\n");
  console.log(
    JSON.stringify({
      revision,
      url: siteUrl("/", deployment.origin),
      ...checks,
    }),
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `Verified [live website](${siteUrl("/", deployment.origin)}) at revision ${revision}: pages, resources, RSS, 404, and original-site preservation passed.\n`,
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
