# Implementation and verification status

Status: implemented; local and hosted preview checks passed; short-link setup and production cutover pending.
Updated: 2026-09-16.

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
| DEV / Medium | API and assisted adapters, durable state, mapping/review/recovery commands | Local contract/media tests; PNG renditions, native video embeds, Medium URL review and explicit fallback/blocking implemented; no real account delivery enrolled |
| `danilop.link` | Compiler, edge resolver setup, deployment coordinator, snapshots/rollback | Compiler tests; specific infrastructure access approval pending |
| Main deployment | Existing Amplify integration; build/check/test configuration and console fallback updated | Hosted preview job 4 passed at `008fbc2` with Node 24.21.0/npm 12.0.2; production cutover pending |

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
4. Push the tested release to `main`; the rebuilt branch is committed and its hosted preview has passed.
5. Verify the exact deployed revision, homepage, article, old routes, 404, feeds,
   snapshot, and short links. Update release status with live evidence.

## Account-dependent acceptance

Adapters are usable building blocks, but a mock API response is not an actual
DEV post or Leanpub preview. These account integrations require chosen content,
credentials, and an explicitly selected destination/book. Public Google/iCloud
permissions also need verification against real author-supplied URLs.

The initial site contains no pretend books, galleries, experiments, or external
copies. Empty public sections stay hidden. Private fixtures exercise capabilities
without publishing filler content beyond the approved welcome article.
