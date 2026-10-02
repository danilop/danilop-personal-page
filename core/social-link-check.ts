import assert from "node:assert/strict";
import sharp from "sharp";
import { verifySocialMetadata } from "./social-metadata";
import { mediaSettings } from "./media";

/** Follow real HTTP redirects and check the metadata/images available to crawlers. */
export async function verifySharedLink(
  input: string,
  origin: string,
  fetcher: typeof fetch = fetch,
) {
  async function follow(method: "GET" | "HEAD", rangeProbe = false) {
    let url = new URL(input);
    const chain: string[] = [];
    for (let hop = 0; hop <= 5; hop++) {
      assert.equal(url.protocol, "https:", "Preview URLs must use HTTPS");
      assert(
        !url.username && !url.password,
        "Preview URLs cannot contain credentials",
      );
      chain.push(url.href);
      const response = await fetcher(url, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: {
          "user-agent": rangeProbe ? "LinkedInBot/1.0" : "Twitterbot/1.0",
          ...(rangeProbe && url.origin !== origin
            ? { range: "bytes=0-524287" }
            : {}),
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        assert(location, "Redirect has no Location");
        await response.body?.cancel();
        url = new URL(location, url);
        continue;
      }
      assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
      assert.equal(
        url.origin,
        origin,
        "Short link did not reach the canonical site",
      );
      assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
      assert.doesNotMatch(
        response.headers.get("x-robots-tag") ?? "",
        /noindex/i,
      );
      return { response, chain };
    }
    throw Error("Too many short-link redirects");
  }
  const get = await follow("GET");
  const html = await get.response.text();
  assert.doesNotMatch(
    html,
    /name=["']robots["'][^>]*content=["'][^"']*noindex/i,
  );
  const metadata = verifySocialMetadata(html);
  assert.equal(new URL(metadata.canonical).origin, origin);
  const head = await follow("HEAD");
  assert.deepEqual(head.chain, get.chain, "GET/HEAD redirects differ");
  await head.response.body?.cancel();
  if (new URL(input).origin !== origin) {
    const range = await follow("GET", true);
    await range.response.body?.cancel();
    assert.deepEqual(range.chain, get.chain, "Byte-range redirects differ");
  }
  const imageUrl = new URL(metadata.image);
  assert(
    [origin, new URL(mediaSettings().baseUrl).origin].includes(imageUrl.origin),
    "Unexpected preview image origin",
  );
  const image = await fetcher(imageUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(image.status, 200, "Social image is not publicly available");
  assert.match(image.headers.get("content-type") ?? "", /^image\/jpeg\b/i);
  const bytes = Buffer.from(await image.arrayBuffer());
  assert(bytes.length <= 1_000_000, "Social image exceeds 1 MB");
  const dimensions = await sharp(bytes).metadata();
  assert.equal(dimensions.format, "jpeg");
  assert.equal(dimensions.width, 1200);
  assert.equal(dimensions.height, 630);
  return {
    ...metadata,
    redirects: get.chain.length - 1,
    finalUrl: get.chain.at(-1),
  };
}
