# Implementation and verification status

Status: the root website, AI article, public topic labels, publication ordering
and article social cards are deployed and verified. Local book-preview,
content-review and import additions are implemented and tested; the author editor
remains local-only. Short-link infrastructure and saved article aliases are active
and live-tested. Real provider delivery remains pending.
Off-repository editorial assets, checksum manifests and coordinated release are
implemented and migrated. Source-only builds and private book/image resources are
verified; the release command verifies exact-revision hosted delivery.
Updated: 2026-10-02.

Danilo selected **all planned publishing capabilities before deployment**.
The former release 1 / later releases split is superseded. Search, a site-wide
assistant, browser editing, and subscriptions remain separate future decisions.

| Capability                                        | Implementation                                                                                                                  | Verification / remaining gate                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown, collections, contextual sections        | `core/model.ts`, `core/render.ts`                                                                                               | Fixture assembly, reuse, visibility and reference tests                                                                                                             |
| Book-only openings/closings and front/back matter | Collection placements and surface permissions                                                                                   | Private fixture; public-output exclusion checks                                                                                                                     |
| Code, charts, tables, diagrams, math              | Renderer registry; Shiki, Vega-Lite, Mermaid, D2, KaTeX                                                                         | Real local renders and source/cache tests                                                                                                                           |
| PDF, Google Docs/Slides, iCloud albums            | Activation viewers and album-link adapter                                                                                       | URL/fallback tests; author-owned public URLs not supplied                                                                                                           |
| Configurable Ink & Paper                          | Theme registry, Shell/Home/Article templates, tokens and assets                                                                 | Desktop/mobile browser review; second theme contract                                                                                                                |
| Earlier Work + The Original Site                  | Integrated catalogue and preserved dated snapshot                                                                               | 307 historical records; route/link parity checks                                                                                                                    |
| JS/WASM simulations                               | Experiment registry, Worker, controls, scenarios and result capture                                                             | JS/WASM parity; real browser runs/reset                                                                                                                             |
| Local browser models                              | Replaceable runtime, WebLLM worker, pinned model manifest                                                                       | Real model download/generation/reset/unload/clear; final integrity-enabled version also verified                                                                    |
| Frozen editions                                   | Markua v3, continuous chapters across articles, chapter source notes, complete chapter sample, immutable editions               | Real fixture export and tamper detection; no public edition created                                                                                                 |
| Leanpub                                           | Preview/status/publication adapter for an existing book                                                                         | API contract tests; live account/source/preview not configured                                                                                                      |
| DEV / Medium                                      | Manual-only adapters, durable state, local editor/CLI bundles and CDN media preparation                                         | Local contract/media/bundle and browser tests; no real provider delivery. See [export readiness](cross-posting.md#local-export-and-readiness)                       |
| `danilop.link`                                    | Compiler, edge resolver setup, deployment coordinator, snapshots/rollback                                                       | S3/OAC and Free active; live resolver test passed; CI access unconfigured                                                                                           |
| Main deployment                                   | Existing Amplify integration; build/check/test configuration and console fallback updated                                       | Root cutover uses the validated shared base configuration; see the latest release evidence in [verification](verification.md)                                       |
| Tag vocabulary and private inventory              | Registry, aliases, unique-piece usage counts, review guidance, public topic labels                                              | Public labels deployed; private desktop/mobile reports tested locally; public topic pages remain unimplemented                                                      |
| Chronicles book pilot                             | Separate Introduction and Chapter 1 pages, next/previous navigation, contents and continuous view                               | Imported as drafts; full-site preview tested; publication pending                                                                                                   |
| Good Enough book pilot                            | Part I and Chapters 1–2; Chapter 2 split across two articles with original figure and notes                                     | Imported as three local draft pieces; source, export and browser checks recorded in [verification](verification.md); live Leanpub rendering and publication pending |
| Pre-publication content review                    | Local spaCy analysis, Snowball sequence counts, references, optional source baselines and declared Python examples              | Current three-article corpus tested; private report and full validation evidence in [verification](verification.md); NLP is not a CI gate                           |
| Content import                                    | Canonical source selection, dependency expansion, dry-run/apply, draft defaults and controlled updates                          | Twelve focused tests, full validation and a real Chronicles rehearsal passed; opening imported as drafts; see [usage](content-import.md)                            |
| Full-site authoring preview                       | Single preview command for live site/editor with all local drafts; explicit snapshot and release modes; private output isolated | Local build and selection/isolation tests; release output remains separate; see [usage](authoring-preview.md) and [verification](verification.md)                   |

## Remaining release work

Destination-specific media exports, local editor controls and asset bundles are
implemented and locally tested. Generated media uses the managed CDN and release
inventory; enrolment and media deployment do not send external posts.
Real DEV rendering/cache behavior and Medium public-document viewers remain account-dependent
acceptance checks. See [cross-posting](cross-posting.md#media-portability-clarification--2026-09-16).

1. Local regression/browser checks are recorded in [verification](verification.md).
   Repeat affected checks only when further release changes require them.
2. The [private-S3/OAC design](short-link-design.md), local editor controls and
   Free-plan enrolment are implemented; the resolver, DNS and plan are active.
   Live TTL, privacy, updates, redirect parity and disposable cleanup passed.
3. Commit/deploy eligible source and saved reservations before activating article
   aliases; the current saved aliases are now active. Optional automatic
   reconciliation still requires scoped CI access.
   Before adding live external-publishing credentials, implement the isolation
   and authentication checks in [credentials and access](credentials-and-access.md).
   This includes a separate protected DEV environment and matching delivery role;
   the earlier KVS/GitHub-role proposal is superseded by the new access scope.
4. The root release and newer public article changes are live. The user authorised
   their main commit/push; source and deployment verification are recorded below.
5. After any further deployment, verify the exact revision, homepage, article, old
   routes, 404, feeds and snapshot, plus short links when configured. Update release
   status with live evidence.

## Account-dependent acceptance

Adapters are usable building blocks, but a mock API response is not an actual
DEV post or Leanpub preview. These account integrations require chosen content,
credentials, and an explicitly selected destination/book. Public Google/iCloud
permissions also need verification against real author-supplied URLs.

The initial site contains no pretend books, galleries, experiments, or external
copies. Empty public sections stay hidden. Private fixtures exercise capabilities
without publishing filler content beyond the approved welcome article.

Homepage discovery now includes visible collection-only articles, with optional
piece/book featuring and automatic latest fallback. Preview-only draft badges
appear in local-preview cards, contents and headers. Public homepage discovery is
deployed and verified; the current book stays draft. See verification.

### Local author review integration

Writing checks and Editorial review are implemented locally in the author editor.
CLI availability, safe argument construction, response handling, local NLP review
and browser interaction are covered by [verification](verification.md). Editorial
quality across all providers/models is not claimed; no deployment was performed.

### Article illustration authoring — implemented locally, 2026-09-24

Images panel, agent-assisted editable briefs, shared ink style, subscription-only
Codex generation, local image import, persistent candidates and explicit Markdown
insertion are implemented. Live Codex generation and desktop/mobile browser flows
were tested; automated coverage includes all three brief adapters. Dedicated
cover metadata, automatic CDN upload and persistent job-progress recovery remain
future work. See [image workflow](image-authoring-workflow.md) and
[verification](verification.md).

### Local article lifecycle (2026-09-24)

Implemented locally: Unpublish to draft, confirmed draft-only deletion with
owned-dependency cleanup and local recovery, and short-link deactivation/removal
reconciliation. Existing published content is unchanged. Automated lifecycle
coverage is part of the regular tests; cloud apply and production deployment are
not performed by the editor. Trash browsing, restore and explicit permanent
deletion are the accepted next scope, with no automatic expiration or purge.
See [local authoring](local-authoring.md#unpublish-and-delete).

### Social publishing, assistant reuse, links and Trash — planned, 2026-09-24

Follow the [researched technical plan](social-publishing-plan.md), including its
[ordered milestones](social-publishing-plan.md#11-ordered-implementation-milestones)
and [acceptance matrix](social-publishing-plan.md#12-test-and-acceptance-matrix).
The sequence is analysis/tooling baseline; shared assistant adapters and picker;
central URL configuration and automatic alias allocation; recoverable lifecycle
transactions and Trash; short-link management; social metadata/images; public
sharing; private social composition; and live handoff/resolver verification.

Public sharing never invokes AI. Private generation preserves the article's tone
and language. The planning change itself implemented no new functionality;
the analysis milestone below has since started. Platform text/thread handoff limitations and article-specific short-link
readiness are explicit release gates, not assumed capabilities.

### Code-analysis gate — implemented locally, 2026-09-25

The [analysis guide](code-analysis.md) documents the installed native Git hook,
staged-snapshot safety, pinned free tools for all current source languages,
complexity gates and c8/Coverage.py reports. The PR/main CI workflow now invokes
the same runner and retains reports. It has not been pushed or run on GitHub.
The initial scan exposes existing lint, typing, dead-code, formatting, complexity
and coverage debt; no suppression baseline or lowered limits makes it pass.
Source cleanup remains open. The delayed-image-brief recovery defect found during
the scan is fixed with a regression test. Dependency architecture rules and an
advisory refactoring queue using 90-day commit frequency and file coverage are also
implemented. JS cyclomatic counting is explicitly pinned to classic; existing
limits are unchanged. See [verification](verification.md).

### Concrete editorial edits — implemented locally, 2026-09-25

The initial review requests issue, explanation and exact replacement together in
one response. A specific author question is the exception for missing facts or
intent. The editor opens verified edits directly, collects required answers before
drafting, and supports explicit conversion of legacy advice without inserting that
advice as prose. Prompt/schema, source matching, UI and documentation are updated;
provider quality still depends on the model. See [finding fixes](finding-fixes-design.md)
and [verification](verification.md) for the local test scope.

### Preview server watch mode — implemented locally, 2026-09-26

`npm run preview -- --watch` uses Node's native watcher for automatic restarts
when the author server's imported code changes. Existing content/template rebuilds
remain in place. Reading pages reconnect after server restarts; the editor keeps
its state and requires an explicit refresh for browser-code changes. Release and
snapshot modes reject this flag. See [preview modes](authoring-preview.md#watch-application-code)
for job/session limits and [verification](verification.md) for the restart tests.

## Shared reading composition — 8 October 2026

Implemented an optional body/section placement relationship, shared heading plan,
body-aware section numbering and contents presentation. Continuous HTML,
chapter/part templates, individual reading pages and Markua use the shared rules.
The reviewed books are migrated; default/legacy behaviour is preserved for other
collections. Existing prose, anchors and citation systems remain in use. See the
[implementation and regression scope](reading-structure.md) and
[verification record](verification.md). Deployment and live Leanpub rendering
remain pending.

## Explicit book completion — 8 October 2026

Implemented optional book-only `completion: in-progress | complete` collection
metadata, separate from publication status. Both opening serializations use
`in-progress`. Shared web endings follow the last available reading step, and
contents/continuous views show the matching status. Omitted completion stays
neutral; normal articles and manuscript exports are unaffected. Validation and
responsive local preview checks passed; deployment remains pending. See
[authoring semantics](authoring-format.md#book-completion) and
[verification](verification.md).

## Article narration — deployed, 2026-10-13

The [narration implementation](article-narration.md) follows the seven-stage plan:
runtime comparison, semantic speech, local generation/assets, preview/review,
public player, publication gates, and backfill/delivery. Stages 1–6 are implemented
locally. Both current public articles are backfilled and the required policy is
enabled. George's MLX sample was approved; numerical comparison is documented.

Stage 7's backfill and release are complete. The exact deployed revision, hosted
audio headers/ranges and public browser playback were verified. Safari/iPhone and
VoiceOver checks remain outstanding, so deployment does not imply that every
original platform acceptance check has passed. See [verification](verification.md).

### Commit-time preparation — implemented locally, 13 October 2026

The native pre-commit hook now prepares missing or stale public article narration
and public audiobooks from the staged snapshot. The accepted workflow stages
generated metadata automatically and continues into the existing verification
gate. Partial staging and unrelated edits are preserved; conflicting unstaged
metadata, changed staging, missing runtime or unreviewed spoken explanations stop
the commit. Draft preparation remains explicit. CI and the standalone verification
commands only validate. This local hook change does not require a website deployment.

## Growing audiobooks — implementation complete, 13 October 2026

The five [audiobook stages](book-audiobooks.md#implementation-sequence-and-evidence-required)
are implemented: semantic composition, cached local synthesis, verified full MP3
and timing map, public/authoring players with stable progress, and atomic
publication plus asset/release gates. Private recordings of both draft books
exercise the actual MLX runtime. Automated and Chromium desktop/mobile checks
are recorded in [verification](verification.md). The release command verifies the
exact production revision before reporting success.
Book publication remains separate from feature deployment and requires listening
review. Physical Safari/iPhone and VoiceOver checks remain manual.
