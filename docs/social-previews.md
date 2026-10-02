# Social link previews

Status: implemented and tested locally, not deployed. Open Graph previously used
the same portrait on every page. Static page metadata and generated preview images
now describe the actual article or collection. Short-link infrastructure is active
and live-tested; article aliases remain unactivated. These are separate from
deploying the new metadata.

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

Cards are generated in `.generated/public/media`, copied into `dist/`, ignored by
Git and served by Amplify after deployment. Every prepare regenerates only the
selected target's cards; it does not accumulate discarded candidates. The proposed
[S3 asset resolver](asset-release-design.md) must eventually include these public
renditions and their deployment retention. It is not required for today's cards.

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

The [active resolver](short-link-design.md) uses private S3 with OAC and one
viewer-response function. DNS/TLS, GET/HEAD parity, update freshness and disposable
test cleanup were verified on 2 October. The configured hostname is `danilop.link`,
not `danilo.link`. Article aliases still require a committed registry and verified
site deployment before activation. The new source-generated social cards remain
local until the website source changes are deployed; resolver activation does not
replace the canonical site's existing Open Graph image.

## Verification

`npm run build` validates generated metadata consistency and the actual JPEG
bytes/dimensions/budget for every page carrying Open Graph metadata. Focused tests
exercise artwork fit, text escaping, matching full/short cards, GET/HEAD parity,
missing images, redirect loops, drafts and a non-root deployment path.

After deploying, check an actual full URL and an active short URL:

```sh
npm run verify:social -- https://www.danilop.net/writing/hello-brave-new-world/
npm run verify:social -- https://danilop.link/hello
```

This command checks initial HTML as a crawler, bounded HTTP redirects, GET/HEAD
parity, final site/canonical origin, published/indexable metadata and publicly
retrievable JPEG bytes. It needs no AWS access and does not publish a social post.
It intentionally fails on the old deployed metadata until the new website ships;
the short example also requires resolver activation, DNS and an active alias.

Test the resulting card in platform composition tools after deployment. LinkedIn's
Post Inspector can request a metadata refresh; it does not guarantee replacement
of every existing post's cached preview. Code/crawler verification is not a claim
that logged-in LinkedIn, X or Bluesky card rendering has been tested.

Sources: [Open Graph protocol](https://ogp.me/),
[LinkedIn Post Inspector](https://www.linkedin.com/help/linkedin/answer/a6233775),
[Bluesky external-card model](https://bsky.network/docs/about-bluesky-content/posts/#website-card-embeds).
