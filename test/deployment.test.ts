import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deploymentSettings,
  sitePath,
  siteUrl,
  localPath,
} from "../core/deployment.mjs";
import { deploymentHtml } from "../core/deployment-html";
import { load } from "cheerio";

test("deployment paths preserve external URLs and are idempotent under nested bases", () => {
  for (const base of ["/", "/new/", "/preview/site/"]) {
    for (const value of [
      "/",
      "/writing/example/?mode=read#section",
      "/media/figure.png",
    ]) {
      const deployed = sitePath(value, base);
      assert.equal(sitePath(deployed, base), deployed);
      assert.equal(localPath(deployed, base), value);
      assert.equal(
        siteUrl(value, "https://example.com", base),
        "https://example.com" + deployed,
      );
    }
    for (const value of [
      "https://cdn.example.com/a.png",
      "//cdn.example.com/a.png",
      "#section",
      "mailto:author@example.com",
      "data:image/png;base64,1234",
    ])
      assert.equal(sitePath(value, base), value);
  }
});

test("deployment configuration rejects unsafe and conflicting paths", () => {
  const config = {
    origin: "https://example.com",
    basePath: "/new/",
    indexable: false,
    preserveOriginal: true,
  };
  assert.deepEqual(deploymentSettings(config), config);
  for (const origin of [
    "http://example.com",
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com?x",
  ])
    assert.throws(() => deploymentSettings({ ...config, origin }));
  for (const basePath of ["new", "/new", "//", "/../", "/new?x/", "/a_b/"])
    assert.throws(() => deploymentSettings({ ...config, basePath }));
  assert.throws(() => deploymentSettings({ ...config, basePath: "/" }));
});

test("HTML boundary keeps reading, media, embeds and responsive images inside the mount", () => {
  const input =
    '<!doctype html><html><body><a href="/collections/guide/read/first/#section">Read</a><a href="#local">Local</a><a href="https://example.org/">External</a><img src="/media/one.png" srcset="/media/one.png 1x, /media/two.png 2x"><button data-src="/media/document.pdf">Load</button><video poster="/media/poster.png" src="/media/video.mp4"></video><script src="/new/_astro/runtime.js"></script></body></html>';
  const html = deploymentHtml(input, "/new/");
  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<html>/);
  const $ = load(html);
  assert.equal(
    $("a").eq(0).attr("href"),
    "/new/collections/guide/read/first/#section",
  );
  assert.equal($("a").eq(1).attr("href"), "#local");
  assert.equal($("a").eq(2).attr("href"), "https://example.org/");
  assert.equal(
    $("img").attr("srcset"),
    "/new/media/one.png 1x, /new/media/two.png 2x",
  );
  assert.equal($("button").attr("data-src"), "/new/media/document.pdf");
  assert.equal($("video").attr("poster"), "/new/media/poster.png");
  assert.equal($("script").attr("src"), "/new/_astro/runtime.js");
  assert.equal(deploymentHtml(html, "/new/"), html);
  assert.equal(deploymentHtml(input, "/"), input);
});
