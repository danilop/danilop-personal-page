# Cross-posting adapters

Status: adapters implemented and locally tested; no external publishing accounts
or credentials configured. Provider
capabilities checked against official documentation on 2026-09-15.

The [product design](product-design.md#cross-posting-and-updates) defines the
experience. This document specifies replaceable delivery adapters, separate
from rendering plugins and themes.

Credential setup and the required automation isolation changes are documented in
[credentials and access](credentials-and-access.md). Store a DEV key only in the
proposed `dev-publication` environment; the current workflow does not yet consume
that environment. Do not add a repository-wide key to enable the existing wiring.

## Provider feasibility

| Destination | Initial adapter | Update behavior |
| --- | --- | --- |
| DEV / Forem | API-backed delivery | Create and update the same remote article by ID; API supports Markdown and canonical URLs |
| Medium | Assisted import/export | Prepare content and a revision diff for manual application; automatic synchronization is not promised |
| Future destinations | Registered capability-based adapter | Enable only operations supported by the provider and connected account |

DEV exposes `POST /api/articles` and `PUT /api/articles/{id}` with author API-key
authentication. Its format includes a canonical URL, a maximum of four tags, and
a series field. Updates must preserve the intended publication state explicitly;
an update must not accidentally revert a published article to a draft.
[Forem API](https://developers.forem.com/api/v1).

Medium does not issue new integration tokens or allow new integrations; its help
page says existing tokens continue to work. Its API repository is archived and
labels the API unsupported. Do not build the default integration around legacy
tokens or assume a supported update endpoint exists.
[Medium integration policy](https://help.medium.com/hc/en-us/articles/213480228-API-Importing),
[archived API documentation](https://github.com/Medium/medium-api-docs).

Medium's import tool can import a published page and assign its original date
and canonical link. Treat import as initial creation, not a subscription to later
source changes. Prepare subsequent revisions for the editor, retaining the same
remote story URL. Manual completion records the applied source revision; it is
reported as author-confirmed rather than API-verified.
[Medium importing](https://help.medium.com/hc/en-us/articles/214550207-Importing-a-post-to-Medium).

## Configuration and contract

### Media portability clarification — 2026-09-16

The intended delivery behavior includes figures, charts and diagrams as portable
images, including PNG renditions, plus live embeds where a destination supports
the provider and URL. Each destination needs its own media capability profile;
the book rendering target must not stand in for a platform-specific exporter.

Current implementation has a gap: `exportPayload` uses the `book` target and
converts rendered HTML to Markdown. It references images hosted by the original
website; it does not upload image binaries into DEV. Generated diagrams/charts
are SVG and image blocks are WebP. Google document/presentation blocks become
authored static alternatives. Universal PNG export and native destination embed
syntax are not yet implemented or verified on an actual remote draft.

Required completion work:

- Select image formats per destination; use PNG for portable chart/diagram
  delivery, preserving readable resolution, alternative text and captions.
- Include the rendition bytes/options in asset identity. A changed figure gets
  a new public URL, and the same remote article is updated to reference it after
  deployment. Verify the destination's rendered result, including image caching.
- Preserve a public embed URL using the destination's supported syntax when
  verified. Otherwise expose an authored preview/summary and link. If the author
  requires a live embed, block that destination rather than silently flattening it.
- Report image conversions and embed fallbacks in the export review. Platform
  uploads, where a supported API exists, are a separate adapter capability from
  linking to publicly hosted images.

DEV documents Markdown images and a supported list of Liquid URL embeds; Google
Docs and Slides are not on that list. Do not assume a generic iframe will work.
Medium supports URL-based embeds through Embed.ly and lists Google Drive, but
does not accept arbitrary embed HTML. Verify the exact public document URL in
the destination editor; neither provider guarantees every embed works everywhere.
[DEV editor guide](https://dev.to/p/editor_guide),
[Medium embeds](https://help.medium.com/hc/en-us/articles/214981378-Using-embeds).

Static image changes require a cross-post update. Changes inside a supported
live Google embed may appear without changing the article, according to the
provider's publication and caching behavior. A static preview image will not
refresh just because the remote document changes.

### Article assignments

Use versioned `publishing/destinations.yaml` for adapter/account references and
`publishing/distribution.yaml` for explicit piece-to-destination assignments.
Keep credentials in server-side secret storage; manifests contain references
only. Start with new native, public standalone pieces. Existing external archive
records are not automatically enrolled or republished.

Each installed adapter declares its version, configuration schema, supported
formats, limits, and capabilities: preview/export, create draft, publish, read
managed fields, update, canonical link, assets, series, and unpublish. Unsupported
operations return an actionable manual step, not a false success. A second
adapter must not require changes to the article model or delivery coordinator.

Assignments select full article or authored excerpt, target-specific title,
summary, tags and optional remote series, and delivery policies. Initial creation
can be a reviewed draft, explicitly enabled automatic publication, or assisted
manual publication. Updates can be automatic after site deployment, reviewed,
or paused. An enabled policy is standing configuration; routine updates do not
require repeated confirmation. Unsupported automatic policies fail validation.

Render the assembled standalone document into destination Markdown/HTML. Apply
explicit destination overrides last, preserving them across revisions. Do not
copy a book-context placement or private opening/closing material into an export.
Resolve diagrams/charts to supported static assets; replace interactive blocks
with approved accessible fallbacks and links to the live original. Unsupported
content without a fallback blocks that destination with a clear explanation.

Use the full canonical site URL as the original-source reference, not its short
alias. `danilop.link` can link to interactive companions or the original in copy.
Platform series mapping is optional: one chosen ordered collection can map to a
remote series, without adding a series entity to the content model. Validate tag
limits and format differences; do not silently discard editorial choices.

## Durable delivery state

Keep a durable publication ledger outside disposable build/metadata caches and
outside the public bundle. Key it by piece ID, destination and account. Retain:

- Remote article ID and URL, desired and observed publication state.
- Last delivered source/deployment revision and destination payload hash.
- Adapter/rendering versions and destination settings that shaped that payload.
- Last observed remote revision or normalized managed-field snapshot/hash.
- Pending operation, attempt identifier, status, error, verification method/time.

This ledger is not the existing Open Graph metadata cache. Clearing or refreshing
that cache cannot lose remote IDs or cause duplicate publication. State uses local atomic files or private S3 conditional writes and a lock;
see [operations](operations.md) for recovery and explicit mapping commands.

## Synchronization flow

1. Build a reviewable destination payload from eligible source and explicit
   overrides; validate capabilities, assets, links and publication policy.
2. Wait for and verify the exact source commit's canonical site deployment.
   Reject stale jobs and serialize delivery per piece/destination/account.
3. Compare the resulting payload hash with the last delivered version. A site
   theme change alone does not trigger a remote edit unless its rendition changes.
4. For updates, read remote managed fields where supported. Compare with the last
   observed snapshot to detect direct remote edits. Surface a conflict for review;
   do not silently overwrite or merge remote prose into the Markdown source.
   Without reliable remote inspection, require a reviewed/manual update.
5. Create once or update the stored remote ID. Persist an operation intent before
   the request. Use provider idempotency support where available; otherwise
   reconcile uncertain creation results before retrying. Never blindly repeat a
   create request after a timeout. Respect rate limits and bounded retry/backoff.
6. Verify and record the result. Assisted destinations show a pending manual
   update with a rendered diff and remote URL until completion is recorded.

Expose per-copy states such as not published, pending, current, needs update,
conflict, failed, paused, and manual action required. An external failure does
not roll back the main site or successful destinations. Retry only the affected
copy. Preserve remote identity and original publication date when supported.

Retiring a local article or removing an assignment pauses delivery and flags the
remote copy for an explicit retain/update/unpublish decision; it does not silently
delete copies, comments, or reactions. Adoption of an existing remote post requires
an explicit verified mapping. Inbound AWS/DEV discovery must recognize mapped
copies as the same work and avoid duplicating them in the archive or homepage.

## Verification before enabling delivery

- Create, update, retry, and unchanged rerun preserve one remote identity.
- A timeout after successful creation is reconciled without a duplicate.
- Source updates and destination overrides compose predictably.
- Remote edits produce a conflict; stale deployments cannot overwrite newer work.
- Canonical URL changes propagate while the remote ID stays stable.
- Draft/book-only content is excluded, including transcluded pieces and assets.
- Diagram/interactive fallbacks are readable in the destination preview.
- Expired credentials and rate limits produce recoverable per-copy failures.
- Medium export does not claim automatic publication or verified synchronization.

Use fixtures/adapter conformance checks first, then an account-authorized draft
integration check. No article is enrolled initially; account-authorized draft delivery remains a
separate verification step. Local tests do not establish remote account readiness.
