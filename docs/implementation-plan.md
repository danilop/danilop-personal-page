# Implementation and verification status

Status: the root website is deployed and verified. Local tagging, book-preview,
content-review and import additions are implemented and tested but not deployed.
Short-link setup and real provider delivery remain pending.
Updated: 2026-09-20.

Danilo selected **all planned publishing capabilities before deployment**.
The former release 1 / later releases split is superseded. Search, a site-wide
assistant, browser editing, and subscriptions remain separate future decisions.

| Capability | Implementation | Verification / remaining gate |
| --- | --- | --- |
| Markdown, collections, contextual sections | `core/model.ts`, `core/render.ts` | Fixture assembly, reuse, visibility and reference tests |
| Book-only openings/closings and front/back matter | Collection placements and surface permissions | Private fixture; public-output exclusion checks |
| Code, charts, tables, diagrams, math | Renderer registry; Shiki, Vega-Lite, Mermaid, D2, KaTeX | Real local renders and source/cache tests |
| PDF, Google Docs/Slides, iCloud albums | Activation viewers and album-link adapter | URL/fallback tests; author-owned public URLs not supplied |
| Configurable Ink & Paper | Theme registry, Shell/Home/Article templates, tokens and assets | Desktop/mobile browser review; second theme contract |
| Earlier Work + The Original Site | Integrated catalogue and preserved dated snapshot | 307 historical records; route/link parity checks |
| JS/WASM simulations | Experiment registry, Worker, controls, scenarios and result capture | JS/WASM parity; real browser runs/reset |
| Local browser models | Replaceable runtime, WebLLM worker, pinned model manifest | Real model download/generation/reset/unload/clear; final integrity-enabled version also verified |
| Frozen editions | Markua exporter, hashed manifest, immutable output directory, public edition routes | Real fixture export and tamper detection; no public edition created |
| Leanpub | Preview/status/publication adapter for an existing book | API contract tests; live account/source/preview not configured |
| DEV / Medium | Manual-only API and assisted adapters, durable state, mapping/review/recovery commands | Local contract/media tests; PNG renditions, native video embeds, Medium URL review and explicit fallback/blocking implemented; no real account delivery enrolled |
| `danilop.link` | Compiler, edge resolver setup, deployment coordinator, snapshots/rollback | Compiler tests; specific infrastructure access approval pending |
| Main deployment | Existing Amplify integration; build/check/test configuration and console fallback updated | Root cutover uses the validated shared base configuration; see the latest release evidence in [verification](verification.md) |
| Tag vocabulary and private inventory | Registry, aliases, unique-piece usage counts, review guidance, public topic labels | Locally tested, including desktop/mobile reports; not deployed; public topic pages remain unimplemented |
| Chronicles book pilot | Separate Introduction and Chapter 1 pages, next/previous navigation, contents and continuous view | Imported as drafts; full-site preview tested; publication pending |
| Pre-publication content review | Local spaCy analysis, Snowball sequence counts, references, optional source baselines and declared Python examples | Current three-article corpus tested; private report and full validation evidence in [verification](verification.md); NLP is not a CI gate |
| Content import | Canonical source selection, dependency expansion, dry-run/apply, draft defaults and controlled updates | Twelve focused tests, full validation and a real Chronicles rehearsal passed; opening imported as drafts; see [usage](content-import.md) |
| Full-site authoring preview | Single preview command for live site/editor with all local drafts; explicit snapshot and release modes; private output isolated | Local build and selection/isolation tests; release output remains separate; see [usage](authoring-preview.md) and [verification](verification.md) |

## Remaining release work

Destination-specific media export is implemented and locally tested. Real DEV
rendering/cache behavior and Medium public-document viewers remain account-dependent
acceptance checks. See [cross-posting](cross-posting.md#media-portability-clarification--2026-09-16).

1. Local regression/browser checks are recorded in [verification](verification.md).
   Repeat affected checks only when further release changes require them.
2. Resolve the pending [specific access approval](deployment-access-review.md).
   Automatic approval review blocked the initial setup; no short-link or access mutation occurred.
3. Apply approved setup, test resolver behavior and alias ownership/recovery.
   Before adding live external-publishing credentials, implement the isolation
   and authentication checks in [credentials and access](credentials-and-access.md).
   This includes a separate protected DEV environment and matching delivery role;
   the original short-link role proposal remains unchanged.
4. The root release is already live. For the newer local changes, obtain release
   approval before committing/pushing to `main`; local verification is not deployment.
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
appear in cards, contents and headers. These additions are locally implemented
and tested, not deployed; see verification.

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
the analysis milestone below has since started. Platform text/thread handoff limitations and unresolved live short-link
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
