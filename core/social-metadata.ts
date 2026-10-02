import assert from "node:assert/strict";
import { load } from "cheerio";

/** Check the initial HTML a social crawler sees, without executing JavaScript. */
export function verifySocialMetadata(html: string) {
  const $ = load(html);
  const property = (key: string) =>
    $(`meta[property="${key}"]`).attr("content");
  const name = (key: string) => $(`meta[name="${key}"]`).attr("content");
  for (const key of [
    "og:title",
    "og:description",
    "og:url",
    "og:type",
    "og:site_name",
  ])
    assert.ok(property(key)?.trim(), `Missing ${key}`);
  const canonical = $("link[rel=canonical]").attr("href");
  assert.equal(property("og:url"), canonical, "Open Graph canonical mismatch");
  assert.equal(new URL(canonical!).protocol, "https:");
  assert.equal(name("twitter:title"), property("og:title"));
  assert.equal(name("twitter:description"), property("og:description"));
  assert.equal(name("twitter:card"), "summary_large_image");
  const image = property("og:image")!;
  assert.equal(
    new URL(image).protocol,
    "https:",
    "Social image must be absolute HTTPS",
  );
  assert.equal(name("twitter:image"), image);
  assert.equal(property("og:image:type"), "image/jpeg");
  assert.equal(property("og:image:width"), "1200");
  assert.equal(property("og:image:height"), "630");
  assert.notEqual(property("og:image:alt"), undefined);
  assert.equal(name("twitter:image:alt"), property("og:image:alt"));
  return { image, canonical: canonical!, title: property("og:title")! };
}
