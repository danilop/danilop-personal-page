# Cross-posting adapters

Status: adapters and media export implemented. Third-party creation and updates
are manual; no article is enrolled or remotely published. Provider capabilities
were checked against official documentation on 2026-09-15.

The [product design](product-design.md#cross-posting-and-updates) defines the
experience. Delivery adapters remain separate from rendering plugins and themes.
The GitHub website/short-link workflow does not consume `DEV_API_KEY` or invoke
delivery. See [publishing workflow](publishing-workflow.md#5-manually-publish-an-external-copy-when-wanted)
for the per-article file and explicit local command, and
[credentials and access](credentials-and-access.md) for secret/state setup.

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

Implemented on 2026-09-16 in `core/distribution-media.ts`, separately from the
book target. Each destination plugin has a replaceable media profile. Local
figures, chart and diagram renditions, inline/reference-style Markdown images,
and authored static previews become content-addressed PNGs. Captions, alternative
text and Markdown tables survive export; figure references link to the original.

PNG output uses a white background and a maximum width of 1600 pixels by default.
SVG is rasterized at density 144. Static formats supported by the installed Sharp
build can be converted, including PNG, JPEG, WebP, AVIF and SVG. Animated/multipage
inputs need an authored static export. SVG must be self-contained, with native
text and no active/HTML content. Mermaid generates native SVG labels and its word
spans are normalized before rasterization. Unsupported inputs fail the copy rather
than silently dropping an image. Remote images remain authored HTTPS URLs and are
reported for review; the exporter does not download or convert them.

Images are hosted by the canonical website, not uploaded as binaries into DEV.
A changed rendition gets a new URL derived from its PNG bytes; the payload changes
and delivery updates the stored remote article ID. Delivery checks that image URLs
are reachable after the exact canonical revision has deployed.

Built-in profiles preserve YouTube/Vimeo embeds using DEV's native Liquid syntax
or Medium's editor URL workflow. Published Google Docs/Slides use authored
fallbacks on DEV. Medium exports their published URL on its own line with an
explicit instruction to press Enter and verify the viewer in the editor. Arbitrary
HTML iframes are never copied. Other interactive blocks require an authored
static/summary alternative and a public HTTPS companion link.

Optional assignment settings:

```yaml
media:
  imageWidth: 1600 # 640–3200
  embeds: prefer # prefer, require, or fallback
  requiredEmbeds: [] # block IDs that must remain live
  verifiedEmbeds: [] # exact public URLs already verified in the destination editor
```

`require` applies to every exported interactive/embed block; `requiredEmbeds`
selects specific blocks. Unsupported required embeds block that copy. Medium's
required embeds additionally need their exact normalized URL in `verifiedEmbeds`;
this records an author check, not an automated provider guarantee. It cannot add
support to DEV. Required block IDs must appear in a full-article export; excerpt
assignments cannot declare them.

Exports include `media-review.md` and `media-review.json` alongside the article and
payload. A failed export clears stale outputs and writes `blocked.json`. Build
preparation records blocked copies privately in `.generated/distribution-blocked.json`
and continues building the canonical website; the delivery command independently
blocks those copies and reports failure. Medium completion requires
`--embeds-reviewed` when the report contains editor-verification items.

Local tests cover real PNG bytes, captions, fallback links, reference images,
Mermaid spacing, asset-change identity, repeat-delivery idempotence, provider
profiles, required-embed blocking, private URLs and unsafe SVG rejection. Actual
DEV draft rendering/caching and a real Medium Google viewer remain account/content
dependent checks. No article has been enrolled or remotely published.

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
can be a draft, a public copy (`published`), or assisted manual publication.
Updates are reviewed or paused. Every create/update requires an explicit manual
command selecting one piece and destination with `--reviewed`; no standing
assignment, commit, push, or tag authorizes a send. Automatic policies are rejected.

Render the assembled standalone document into destination Markdown/HTML. Apply
explicit destination overrides last, preserving them across revisions. Do not
copy a book-context placement or private opening/closing material into an export.
Resolve diagrams/charts to supported static assets; replace interactive blocks
with approved accessible fallbacks and links to the live original. Unsupported
content without a fallback blocks that destination with a clear explanation.

Use the full canonical site URL as the original-source reference, not its short
alias. `danilop.link` can link to interactive companions or the original in copy.
Every exported article body, including excerpts, begins with
`The original article can be found [here](CANONICAL_ARTICLE_URL).`
This opening attribution uses the direct article URL; aliases are not substituted
automatically because the registry does not record verified activation. The
canonical metadata and existing closing attribution retain that same URL.
The opening line participates in the payload hash, so existing enrolled copies
receive it on their next permitted update; Medium uses the assisted edit workflow.
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
