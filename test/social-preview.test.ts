import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { Assets } from "../core/assets";
import { socialCard, firstSocialImage } from "../core/social-preview";
import { verifySharedLink } from "../core/social-link-check";
import { verifySocialMetadata } from "../core/social-metadata";

const html = `<link rel="canonical" href="https://example.com/writing/story/">
<meta property="og:title" content="A story"><meta property="og:description" content="A summary">
<meta property="og:url" content="https://example.com/writing/story/"><meta property="og:type" content="article">
<meta property="og:site_name" content="Notes"><meta property="og:image" content="https://example.com/media/card.jpg">
<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630"><meta property="og:image:alt" content="Illustration">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="A story">
<meta name="twitter:description" content="A summary"><meta name="twitter:image" content="https://example.com/media/card.jpg">
<meta name="twitter:image:alt" content="Illustration">`;

test("image selection skips remote and vector images without fetching them", () => {
  assert.deepEqual(
    firstSocialImage(
      '<img src="https://remote.invalid/photo.png"><img src="/media/chart.svg"><img src="/media/art.png" alt="Artwork">',
    ),
    { src: "/media/art.png", alt: "Artwork" },
  );
  assert.equal(
    firstSocialImage('<img src="https://remote.invalid/photo.png">'),
    undefined,
  );
});

test("cards preserve portrait artwork, carry alt text and reuse identical bytes", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "social-card-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const out = path.join(root, "media");
  await fs.mkdir(out);
  await sharp({
    create: { width: 200, height: 600, channels: 3, background: "red" },
  })
    .png()
    .toFile(path.join(out, "cover.png"));
  const assets = new Assets(out);
  const image = { src: "/media/cover.png", alt: "Red portrait cover" };
  const card = await socialCard("Book", "Notes", assets, image, root);
  assert.equal(card.alt, image.alt);
  assert.deepEqual(
    await socialCard("Book", "Notes", assets, image, root),
    card,
  );
  const bytes = await fs.readFile(path.join(root, card.src));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(metadata.format, "jpeg");
  assert(bytes.length < 1_000_000);
  const pixel = async (left: number) =>
    (
      await sharp(bytes)
        .extract({ left, top: 315, width: 1, height: 1 })
        .raw()
        .toBuffer()
    )[0];
  assert((await pixel(600)) > 240);
  // Contain leaves paper either side, rather than cropping the tall cover.
  const side = await sharp(bytes)
    .extract({ left: 20, top: 315, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert(side[1] > 230);
});

test("title cards escape markup, wrap long multilingual titles and never fetch remote images", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "social-title-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const assets = new Assets(path.join(root, "media"));
  const title = "Comprendre <RL> & ses limites — café, déjà vu ".repeat(7);
  const card = await socialCard(
    title,
    "Notes & stories",
    assets,
    { src: "https://unreachable.invalid/image.png", alt: "Remote" },
    root,
  );
  assert.equal(card.alt, `${title} — Notes & stories`);
  const bytes = await fs.readFile(path.join(root, card.src));
  const { width, height } = await sharp(bytes).metadata();
  assert.deepEqual([width, height], [1200, 630]);
  assert.notEqual(
    (await socialCard("Another title", "Notes", assets, undefined, root)).src,
    card.src,
  );
});

test("preview generation refuses symlinks outside prepared public assets", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "social-safe-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const publicDir = path.join(root, "public");
  await fs.mkdir(publicDir);
  await fs.writeFile(path.join(root, "outside.png"), "not public");
  await fs.symlink(
    path.join(root, "outside.png"),
    path.join(publicDir, "link.png"),
  );
  await assert.rejects(
    socialCard(
      "Title",
      "Notes",
      new Assets(publicDir),
      { src: "/link.png", alt: "" },
      publicDir,
    ),
    /escapes/,
  );
});

test("crawler metadata rejects missing tags, inconsistent identity and invalid images", () => {
  assert.equal(verifySocialMetadata(html).title, "A story");
  for (const bad of [
    html.replace('property="og:title"', 'property="missing"'),
    html.replace(
      'name="twitter:image" content="https://example.com/media/card.jpg"',
      'name="twitter:image" content="https://example.com/wrong.jpg"',
    ),
    html.replace('content="1200"', 'content="100"'),
    html.replace(
      'rel="canonical" href="https://example.com/writing/story/"',
      'rel="canonical" href="https://example.com/other/"',
    ),
  ])
    assert.throws(() => verifySocialMetadata(bad));
});

test("full and short links expose identical cards through HTTP redirects with GET/HEAD parity", async () => {
  const image = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const rangeRequests: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    if (headers.has("range")) {
      assert.equal(headers.get("user-agent"), "LinkedInBot/1.0");
      rangeRequests.push(url.href);
    }
    if (url.hostname === "short.example")
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.com/writing/story/" },
      });
    if (url.pathname.endsWith(".jpg"))
      return new Response(image, { headers: { "content-type": "image/jpeg" } });
    return new Response(init?.method === "HEAD" ? null : html, {
      headers: { "content-type": "text/html" },
    });
  };
  const direct = await verifySharedLink(
    "https://example.com/writing/story/",
    "https://example.com",
    fetcher,
  );
  const short = await verifySharedLink(
    "https://short.example/story",
    "https://example.com",
    fetcher,
  );
  assert.equal(short.redirects, 1);
  assert.equal(short.image, direct.image);
  assert.equal(short.canonical, direct.canonical);
  assert.equal(short.title, direct.title);
  assert.deepEqual(rangeRequests, ["https://short.example/story"]);
});

test("crawler check catches short links that fail only on byte-range requests", async () => {
  const fetcher: typeof fetch = async (input, init) => {
    if (new URL(String(input)).hostname === "short.example") {
      if (new Headers(init?.headers).has("range"))
        return new Response("Short link not found.", { status: 404 });
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.com/writing/story/" },
      });
    }
    return new Response(init?.method === "HEAD" ? null : html, {
      headers: { "content-type": "text/html" },
    });
  };
  await assert.rejects(
    verifySharedLink(
      "https://short.example/story",
      "https://example.com",
      fetcher,
    ),
    /HTTP 404/,
  );
});

test("crawler check rejects broken image delivery and redirect loops", async () => {
  const missing: typeof fetch = async (input) =>
    new Response(String(input).endsWith(".jpg") ? "Missing" : html, {
      status: String(input).endsWith(".jpg") ? 404 : 200,
      headers: { "content-type": "text/html" },
    });
  await assert.rejects(
    verifySharedLink(
      "https://example.com/writing/story/",
      "https://example.com",
      missing,
    ),
    /not publicly available/,
  );
  const loop: typeof fetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://short.example/loop" },
    });
  await assert.rejects(
    verifySharedLink("https://short.example/loop", "https://example.com", loop),
    /Too many/,
  );
});

test("crawler check rejects different GET/HEAD destinations and unpublished HTML", async () => {
  const mismatch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "short.example")
      return new Response(null, {
        status: 302,
        headers: {
          location: `https://example.com/${init?.method === "HEAD" ? "wrong" : "story"}/`,
        },
      });
    return new Response(init?.method === "HEAD" ? null : html, {
      headers: { "content-type": "text/html" },
    });
  };
  await assert.rejects(
    verifySharedLink(
      "https://short.example/story",
      "https://example.com",
      mismatch,
    ),
    /GET\/HEAD/,
  );
  const preview: typeof fetch = async () =>
    new Response(`<meta name="robots" content="noindex,nofollow">${html}`, {
      headers: { "content-type": "text/html" },
    });
  await assert.rejects(
    verifySharedLink(
      "https://example.com/story/",
      "https://example.com",
      preview,
    ),
    /noindex/,
  );
});
