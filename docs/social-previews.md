# Social link previews

Status: article metadata/cards deployed and full/short URLs verified live on
2 October 2026. LinkedIn Post Inspector also rendered the published AI article's
short-link preview after the deployed byte-range handling fix. Collection/book-cover
cards are implemented and locally tested;
the current collection remains draft. Open Graph previously used the same portrait
on every page. Static metadata and images now describe the actual published work.

## Reader behaviour

Social platforms can use the HTML's Open Graph and X card tags to construct a link
preview. All metadata and image bytes are static and require no JavaScript,
authentication, analytics consent or platform SDK. The platform decides whether
to display a card, how to crop it and how long to cache it.

- Standalone articles use their first rendered local raster image and its alt text.
- Collection/book overview pages use the explicitly selected cover.
- Collection reading pages use their first local body image, then the collection
  cover when no body image exists. Their description/language/dates come from the
  source piece. The existing collection canonical URL is preserved.
- Missing or unsuitable imagery produces a branded title card. Other site pages
  use the site title card. Arbitrary remote images are not downloaded during builds;
  a remote-only image produces a title card in this implementation.

Cards are 1200 × 630 JPEGs, at most 1 MB, with content-hashed filenames. Images fit
inside the card without cropping the authored illustration or portrait cover.
Title cards escape text markup and fit long Unicode titles inside the text area;
font coverage depends on the build environment's installed fonts. Image alt text
is preserved, including empty alt text for a decorative source image. No model
call, new artwork generation or new source image is involved.

`npm run assets:prepare` generates cards in `.generated/public/media` and records
their recipes and byte checksums in `publishing/media-assets.json`. Release backs
up prepared bytes and serves them through the configured media CDN. Later builds
restore those exact JPEGs from the verified cache/CDN; they do not depend on a
second machine's fonts producing identical cards. Initial migration URLs remain
available under the website's `/media/` path for existing consumers.
The [asset resolver](asset-release-design.md) includes cards in deployment
availability and retention checks. Validators allow only the site origin or the
explicitly configured media origin and check actual image bytes and dimensions.

Open Graph includes title, description, type, canonical URL, site name, image URL,
MIME type, dimensions and alt text, plus article publication/modification dates
when available. X receives explicit title/description/image/alt tags and
`summary_large_image`. JSON-LD includes the image and language. Article language
passes through to HTML; an explicitly regional language such as `en-GB` also
provides `og:locale` (`en_GB`). A bare language does not imply a territory.

Draft cards appear only in a local authoring target that explicitly includes that
draft. Release preparation generates neither pages nor cards for unpublished pieces.
There is no explicit social-image override or private card-inspection UI yet;
those parts of [the broader social plan](social-publishing-plan.md#8-article-previews-on-social-platforms)
remain proposed.

## Full and short links

A functioning short URL sends an HTTP redirect to the public website. Crawlers
then read the destination's metadata; the short response does not need a separate
Open Graph document. Keep `og:url` and the canonical link set to the full canonical
website URL. GET and HEAD must resolve through the same chain. Do not introduce a
JavaScript redirect or serve different HTML to different crawler user agents.
Byte-range requests must also redirect correctly; crawlers may request only the
beginning of a resource. A partial origin/cache response must not turn an active
short link into a 404.

The [active resolver](short-link-design.md) uses private S3 with OAC and one
viewer-response function. DNS/TLS, GET/HEAD parity, update freshness and disposable
test cleanup were verified on 2 October. The configured hostname is `danilop.link`,
not `danilo.link`. Article aliases require a committed registry and verified site
deployment before activation. The saved welcome and AI-article aliases are active.
Crawler checks of both short URLs confirmed matching GET/HEAD chains, the final
canonical page and its public JPEG card. An actual LinkedIn Post Inspector check
initially reported 404 for the AI article alias. Byte-range GETs reproduced the
failure: the resolver accepted only HTTP 200 and rejected valid HTTP 206 responses.
After the deployed fix, Inspector showed the article image/title and a
302 → 200 redirect trail. This validates that alias in Inspector, rather than
assuming a simulated crawler user agent proves platform access. Other platforms
and actual published social posts remain outside this verification.

Reader [sharing controls](article-sharing.md) expose an active short link after
an on-demand target check. Email and platform handoff links use the same visible
URL. This does not change canonical/Open Graph metadata or post to any platform.

## Verification

`npm run build` validates generated metadata consistency and the actual JPEG
bytes/dimensions/budget for every page carrying Open Graph metadata. Focused tests
exercise artwork fit, text escaping, matching full/short cards, GET/HEAD parity,
byte-range redirect parity, missing images, redirect loops, drafts and a non-root
deployment path.

After deploying, check an actual full URL and an active short URL:

```sh
npm run verify:social -- https://www.danilop.net/writing/hello-brave-new-world/
npm run verify:social -- https://danilop.link/hello
```

This command checks initial HTML as a crawler, bounded HTTP redirects, GET/HEAD
parity, byte-range requests to short-link hosts, final site/canonical origin,
published/indexable metadata and publicly
retrievable JPEG bytes. It needs no AWS access and does not publish a social post.
It fails on stale/missing metadata or inactive aliases. The examples above passed
after production deployment and alias activation.

Test the resulting card in platform composition tools after deployment. LinkedIn's
Post Inspector can request a metadata refresh; it does not guarantee replacement
of every existing post's cached preview. Code/crawler verification is not a claim
that logged-in LinkedIn, X or Bluesky card rendering has been tested.

Sources: [Open Graph protocol](https://ogp.me/),
[LinkedIn Post Inspector](https://www.linkedin.com/help/linkedin/answer/a6233775),
[Bluesky external-card model](https://bsky.network/docs/about-bluesky-content/posts/#website-card-embeds).
