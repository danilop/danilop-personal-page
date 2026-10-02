# Publication timestamps

Status: implemented and tested locally. Clever Enough to Find the Loophole is
marked published in source with a saved timestamp; the two Chronicles pieces
remain drafts. The article and timestamp changes await the next main deployment.

## Publish locally, then deliver

The first local publication sets an article's public `publishedAt` timestamp.
The author then commits and pushes to `main`; Amplify builds and delivers the site.
The timestamp represents the publishing decision, not a measurement of when the
first reader could fetch the page. Delaying the push or a failed deployment can
make actual availability later. Deployment verification still checks delivery.

In the local editor, clear **Draft** and **Save**. The save adds a UTC ISO timestamp
with seconds and a timezone to the article's frontmatter, under the existing
write lock, validation, revision history and atomic replacement. Merely toggling
the checkbox or previewing does not modify the source. Failed saves leave the
source and publication timestamp unchanged.

For the same local operation from the terminal:

```sh
npm run article:publish -- <piece-id>
npm run prepublish:check
npm run preview -- --release
```

Review and commit the article and relevant changes, then push to `main`. A public
collection must also be enabled separately for its articles to appear there.
The command changes only the selected article locally; it does not commit, push,
deploy, enable a collection or distribute external copies. Retired articles must
be restored before using it.

There is no automatic ledger commit, public publication inventory or confirmation
build. The dated article and its final ordering ship in one ordinary deployment.
This replaces the earlier post-deployment observation design.

## Dates and ordering

Public latest-content lists, the Writing index and standalone article RSS sort
newest first by the parsed publication instant. Different timezone offsets compare
correctly; identical instants use stable piece IDs as a deterministic fallback.
Readers see a calendar date, while HTML metadata and feeds retain timestamp
precision. Book reading order and explicit featured placement remain independent.
External archived work retains its original dates.

`publishedAt` is publication history, never a drafting date. Never-published drafts
omit it. The existing welcome article retains its historical date-only value.
When editing source directly instead of using the editor or command, set a valid
`publishedAt` at publication; release builds reject visible articles without one.
Draft creation dates do not enter the public ordering.

Edits, unpublishing, restoring older prose through the editor, and republishing
preserve a saved publication time. The editor prevents accidental changes to it.
An intentional historical correction can be made explicitly in the source and
reviewed through Git. A saved draft with `publishedAt` is treated as previously
published; do not use this field for provisional dates.

Preview dates are temporary build values. Builds and previews do not rewrite
source dates. The first published save supplies the date before the release build,
so new articles do not need an undated interval on the public site.

## Validation

Tests exercise local publication, unchanged draft saves, validation failures,
revision conflicts, preserved dates on unpublish/restore/republish, minute-level
and timezone-aware ordering, and single-build HTML, JSON-LD and feed output.
Live delivery remains subject to the existing Amplify deployment verification.

On 1 October 2026, full local validation passed 182 tests, TypeScript/Astro checks,
the production build and verification of 185 output files and 897 local links.
After correcting editor handling of server-added metadata, both browser tests
(including the new publication test) and focused lint checks passed. No live
publication or deployment was performed.
