# Cross-posting adapters

Status: adapters implemented and locally tested; no external publishing accounts
or credentials configured. Provider
capabilities checked against official documentation on 2026-09-15.

The [product design](product-design.md#cross-posting-and-updates) defines the
experience. This document specifies replaceable delivery adapters, separate
from rendering plugins and themes.

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
