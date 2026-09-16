# Release verification

Date: 2026-09-16. Scope: local rebuild and hosted preview; production release pending.

## Automated checks

- 34 tests: eight legacy metadata/discovery tests and 26 publishing tests.
- Astro/TypeScript: zero errors, warnings or hints in the checker.
- Production build: 29 generated pages, 178 output files, 733 checked local links.
- Historical parity: 307 records, comprising 201 posts, 92 decks and 14 videos.
- Private fixture sentinels absent from output; `/_qa/` removed by a clean build.
- Documentation file links and new-source whitespace checks pass. The historical
  snapshot retains its original line endings and formatting.
- Short-link dry run maps `hello` to the approved article; no remote alias activated.
- Cross-posting dry run confirms no enrolled articles and performs no delivery.

The build reports an empty collection loader (expected with no public collection)
and a large optional WebLLM chunk. Ordinary reading does not load that model
runtime or download model weights.

## Cross-post media checks — 2026-09-16

Seven additional tests exercise actual PNG conversions from charts, Mermaid/D2,
figures, Markdown reference images and dated fallback previews; captions, alt text,
tables and original-site references; native DEV video syntax; Medium URL review;
required-embed failures; image revision URLs and same-article update/no-op behavior.
SVG spacing has a pixel-output regression check. D2, chart and Mermaid PNGs were
also inspected visually; a Mermaid word-spacing defect was fixed before release.
Unsafe SVG, private Google URLs and unknown profiles fail explicitly.
No external post was created. The initial assignments remain empty.

Opening source attribution is now included in full and excerpt exports. Existing
DEV/media and Medium embed tests check that the first paragraph links to the same
article as the canonical metadata, with the embed URL still on its own line.
This follow-up is verified locally and included in hosted preview job 6.

## Browser checks

Codex's in-app browser was used directly; no fallback browser was required.
Checked desktop 1440×960, design-reference width 1190 with requested height 1322,
mobile 390×844, and small-screen article/archive navigation at 320×740.

- Homepage → approved welcome article → Earlier Work → Videos → The Original Site.
- No horizontal overflow in the tested 320/390 layouts; no empty collection,
  recent-writing or Elsewhere section appears.
- Both JS and WASM return 265.33 after 20 steps from 100 at 5% growth.
  Invalid step input produces a useful error; reset restores the initial view.
- The pinned SmolLM2 model actually downloads and generates locally via WebGPU.
  The final integrity-enabled version was exercised. Reset/unload/cache clearing
  work, and browser error/warning logs are empty for those runs.
- The preserved snapshot retains the original Some Stuff styling and content.

Model execution verifies runtime behavior, not the quality of a tiny model's prose.
No test model content is published on the initial site.

## Visual fidelity ledger

Compared `docs/design-concepts/ink-and-paper.png` directly with fresh in-app
browser screenshots using the image viewer. Local captures:
`/tmp/notes-home-native-final.png`, `/tmp/notes-home-desktop-final.png`, and
`/tmp/notes-home-mobile-final.png`.

| Comparison | Evidence and outcome |
| --- | --- |
| Identity hierarchy | Large Danilo Poccia masthead, spaced secondary publication name, upper-right ink portrait retained |
| Typography | Newsreader headlines/prose and Inter navigation/metadata preserve the selected literary/editorial hierarchy |
| Palette | Warm ivory `#f6f3eb`, charcoal and blue ink; no added gradient or image color overlay |
| Containers and spacing | Open editorial layout with thin rules; no invented dashboard/card chrome |
| Asset treatment | Ink portrait and matching paper illustration; all rendered images load and stay clear of text |
| Responsive behavior | Masthead and headline reflow at mobile widths; readable navigation and article text remain within the viewport |
| Copy and populated sections | Approved welcome copy and agreed historical labels replace illustrative sample content |

Intentional content-driven differences: only one native article is published,
so the recent-writing rail is hidden. No invented books or photos fill empty
sections. Earlier Work occupies the next populated section. The welcome artwork
replaces the concept's agent-memory diagram. The exploratory tagline and
photography/collection navigation are omitted where no corresponding public
content exists. Above-the-fold copy was checked against these accepted decisions.

The implementation was visually verified against the selected Ink & Paper
**direction with the agreed sparse-content changes**. It is not represented as
an identical reproduction of the concept's illustrative content. No material
clipping, asset-loading or responsive mismatch remains in the checked views.

## Hosted preview

The dependency modernization passes local and hosted checks on Node 24.21.0 and
npm 12.0.2. See
[dependencies and hosting](dependencies-and-hosting.md).

The [hosted preview](https://rebuild-notes-along-the-way.d26ru7a9pi36wa.amplifyapp.com/)
passed Amplify build, deploy and verify stages (job 7) on Amazon Linux 2023.
Its public build marker matches `dc433ac87a94dddf371158f67f6a32fc95cf94b2`.
The pipeline installs pinned Node 24.21.0/npm 12.0.2, passes the checker and all 34 tests,
and generates the static site successfully.

The homepage, approved welcome article, video archive, original snapshot,
build marker, robots file, feed and sitemap all returned HTTP 200. The preview
has `noindex`, robots `Disallow: /`, and the expected `nosniff` response header.
Hashed CSS has the configured immutable year-long cache policy; the build marker
has `no-store`. Preview indexing settings are branch-specific. Production still
serves the old site. The console fallback recipe matches the repository buildspec.

The book-export correction namespaces footnotes by placement, preventing
collisions when assembled articles reuse the same footnote name. This fix is
included since preview job 4. Cross-post media export is included in job 6.

## Not yet verified remotely

- Production cutover, production redirects/404 and the live main-domain revision.
- CloudFront/KVS setup, actual alias resolution, IAM/OIDC and cloud rollback.
- Actual DEV account draft delivery and Leanpub rendering/publication.
- Anonymous viewing of the author's Google documents or iCloud albums.

Local contract tests do not replace these checks. The first two are release
work; account/content-dependent checks require selected material and configured
accounts. See [launch review](launch-review.md) and [access review](deployment-access-review.md).

## About-page social links — 2026-09-16

Local checker: zero errors/warnings/hints. Production build passes, including
178 output files and 695 local links. Existing profile destinations are preserved
in `publishing/site.yaml`; icons are locally bundled with attribution.

Browser plugin/skill was unavailable, so the bundled Playwright runtime and
installed Chromium were used at `http://127.0.0.1:4321/about/`. Checks passed at
1440×960, 390×844 and 320×740: correct page identity and meaningful content, no
error overlay, no browser warnings/errors, four labelled icon links, 44px link
height, no horizontal overflow. GitHub focus → Tab focuses LinkedIn with a visible
outline. Screenshots were inspected at desktop and mobile widths; icons remain
recognizable and the row wraps below the biography. The old text-only sentence
is intentionally replaced by this row. Remote profile pages were not audited.

Local screenshots: `/tmp/notes-about-1440.png`, `/tmp/notes-about-390.png`,
`/tmp/notes-about-320.png`. Hosted preview job 6 passed build, deploy and verify;
the public build marker matches `1672c84`. The About route returns HTTP 200 and
contains the restored labelled social row. Production remains unchanged.

## Cross-section navigation — 2026-09-16

See [navigation review](navigation-review.md). Local checks and 34 tests pass.
The release build contains 29 pages, 178 files and 733 checked local links.
An isolated private build exercised 43 pages and 838 local links/anchors, including
collections, nested parts/chapters, reused pieces and a fixed edition. Desktop
1440px and mobile 390/320px browser journeys pass with no overflow or errors.
No private manuscript or edition is added to production content.

Hosted missing-URL behavior remains incorrect: the shared legacy Amplify rule
fallback targets `/index.html`. It must switch to the prepared `/404.html` rule at
production cutover. This is not resolved by the template navigation improvements.

Preview job 7 passed build/deploy/verify at `dc433ac`. The public-content navigation
journey was repeated successfully against the hosted preview at 1440/390/320px,
with no browser errors or overflow. The missing-page routing exception above
remains pending and is not covered by that successful normal-navigation result.

## Original root and `/new/` deployment — 2026-09-16

- Original root HTML matches the saved snapshot byte-for-byte before release;
  packaging verifies every preserved file, including assets.
- Type checks and 37 tests pass, including base-path normalization, HTML rewrite
  idempotence, document structure, responsive image paths, and external URL preservation.
- `/new/` and isolated `/` builds each pass 178-file / 733-link verification.
- Local desktop/mobile browser checks cover the original homepage, new home,
  article navigation and refresh, About/social images, archive pagination,
  preserved snapshot return navigation, and real 404 responses.
- Private collection/chapter/book fixtures pass 868 internal links across 49
  HTML pages, including the preserved root; no fixture content enters the release.
- No publication credentials are used. Delivery is disabled while indexing is off.
- Browser plugin not available; checks use the installed Playwright/Chromium runtime.

Hosted release verification is performed after the exact main revision deploys.
