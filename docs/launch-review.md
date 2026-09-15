# Launch requirements review

Status: review in progress; implementation and deployment authorized by Danilo,
with scope and editorial decisions confirmed below. Date: 2026-09-15.

This is a delivery checklist, not a replacement for the product or technical
specifications. Keep it updated with implementation and verification evidence.

## Confirmed direction

- Identity: Danilo Poccia first; Notes Along the Way beneath it. Keep the domain.
- Visual starting point: selected Ink & Paper concept and responsive prototype.
  Use its ink portrait initially; make portrait, images, fonts, colors, CSS and
  supported layouts configurable independently of content and publishing rules.
- File-based Markdown authoring; stable IDs, explicit publication/update dates,
  draft/retired states and separate standalone, collection and book permissions.
- Collections own order and optional book structure. Chapters group articles as
  sections. Support contextual titles, openings/closings, appendices and front/back
  matter; preserve reusable source bodies and future edition independence.
- Replaceable rendering adapters for static rich content; accessible fallbacks
  for embedded documents, slides, PDFs and externally hosted photo albums.
- Keep photo binaries out of Git. iCloud starts with a public shared-album link;
  inline album rendering must not be claimed without provider verification.
- Preserve existing publication destinations, curated metadata overrides and
  old routes. Refresh discovery explicitly, not silently during deployment.
- Automatic deployment from GitHub main through the existing Amplify application.
- Durable short links for new public work, with collision checks and exact
  deployment verification before activation.
- Selected cross-posting with per-destination plugins; automatic DEV delivery is
  feasible, while Medium needs assisted import/update. Do not publish remotely
  merely because a destination plugin exists.
- Keep README, product design, content model, authoring instructions, architecture
  and operations synchronized with the implementation.
- Hello, Brave New World is approved, including the Earlier Work / The Original
  Site paragraph. Publish the checked-in approved wording.

## Confirmed launch decisions

1. Build all planned capabilities before deployment: core publishing, static
   rendering, simulations/WASM, browser model runtime, book export/editions,
   cross-posting adapters and short-link delivery. Search/site-wide AI and optional
   browser editing/subscriptions remain separate product decisions.
2. Earlier Work is the integrated historical catalogue; The Original Site is the
   preserved snapshot.
3. Elsewhere is reserved for post-relaunch external publications. Empty sections
   never appear, including Elsewhere, collections, galleries and recent writing.
4. The shorter, less personal welcome article is approved, including the revised
   Earlier Work / The Original Site wording.

## Defaults that do not need to block the build

- Keep the selected illustration and the prototype's type/palette as the initial
  theme. Support future configuration changes without requiring another rebuild
  of the content model.
- Label the historical catalogue Earlier Work and the snapshot The Original Site.
- Start with one real article. Hide empty collection/gallery sections rather
  than inventing published books or photographs. Keep test collections private.
- Use an ordinary editor and version control. Browser editing is deferred.
- Do not display private draft outline titles. Public planned entries must be
  explicitly authored placeholders.
- Existing About information remains the source for the initial biography;
  preserve its links and make the text editable as content.
- Public Google/iCloud examples depend on actual published URLs from the author.
  Implement and test adapters with fixtures; distinguish those tests from
  verifying the author's real public permissions, which cannot be inferred.

## Build and verification sequence

1. Preserve the old generator and capture an inventory/snapshot before cutover.
2. Implement and test content schemas, visibility, structure, contextual assembly
   and stable references with representative private manuscript fixtures.
3. Implement renderer registry, static adapters, asset isolation and cache keys.
4. Implement theme configuration and Astro routes, migrate real catalogue data,
   add the welcome draft to a local preview, and verify sparse/populated layouts.
5. Verify no private content leaks, metadata parity, all legacy routes, feeds,
   sitemap, accessibility, links and desktop/mobile visual fidelity.
6. Prepare short-link infrastructure and publication coordination; verify collision,
   ordering and rollback behavior. Finalize article only after editorial review.
7. Commit/push the tested release, verify the exact production deployment, activate
   verified short links, and record live URLs and remaining provider limitations.

## Current evidence and remaining gates

Local implementation includes the full selected publishing scope. Core tests
exercise actual static renderers, JS/WASM parity, reusable collection assembly,
private-content filtering, frozen editions and cross-posting behavior. Browser
checks have exercised real local model download/generation/reset/unload/cache
removal and both simulations. The integrity-enabled runtime also passed real browser checks. Final local
evidence, including 24 tests, is recorded in [verification](verification.md).

The initial site has one approved article, 307 historical records, and no public
collections or Elsewhere items. Sparse sections are hidden. No test manuscript
or model example is published as filler.

Specific short-link AWS/GitHub access approval remains pending after an automatic
approval rejection; no short-link or access mutation occurred. Production still serves the old
site. Hosted preview job 4 passed at `008fbc2`, including all 24 tests and public
route checks; see [verification](verification.md). Production cutover and exact
live revision/alias verification remain release gates. DEV/Leanpub adapters are locally tested but unconnected to live
publishing accounts; public Google/iCloud permissions await real URLs.
