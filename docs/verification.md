# Release verification

Earlier entries retain the commands/ports used at the time. The unified preview
entry below supersedes the former default snapshot and separate author command;
see [current preview usage](authoring-preview.md).

## Social link previews — 2026-10-01

Implemented static Open Graph/X metadata, source language and regional locale,
article dates, local body-image/collection-cover JPEG cards and title-card fallback.
Build verification checks metadata consistency and actual 1200 × 630 JPEG bytes
within 1 MB. A public crawler-check CLI tests full/short URLs with bounded HTTP
redirects, GET/HEAD parity and image delivery. No arbitrary remote image download
or social post submission occurs.

13 focused tests passed: eight card/metadata/crawler cases, one isolated non-root
release build and four existing deployment-verification cases. The release fixture
checks escaped French title/language/locale, article dates, distinct book cover,
reading-page summary and exclusion of draft cards. It caught Astro's content schema
dropping the language field; the schema now retains it. Portrait artwork fit and
multilingual title-card generation pass. Generated beetle-artwork and branded
title-card JPEGs were inspected visually. Astro/TypeScript checks and focused
ESLint passed; documentation links and diff whitespace checks passed.

Live inspection found the existing portrait metadata, no viewer-request function
on the configured short-link distribution, and unresolved short hostnames from
the checking environment. No cloud writes or deployment were performed. Actual
logged-in platform previews and live redirect/card checks after activation remain
pending. See [current behaviour and commands](social-previews.md).

## Automatic image cleanup — 2026-10-01

Implemented local save/startup/daily sweeps, private source-asset ownership,
reference protection, browser recovery name backups, expiring Undo-session pins,
seven-day unused grace periods, checksum-verified recoverable quarantine and
30-day trash deletion. Existing generated assets can be adopted using matching
candidate owner, filename and bytes. Cleanup covers interrupted candidate pairs,
temporary metadata and identical expired alternatives; it preserves manual or
modified assets and images needed by current content or retained recovery.

31 focused tests passed: 14 cleanup lifecycle tests, seven image-service tests,
nine authoring browser tests and the real-server browser integration. Controlled
clocks verify ageing and actual file deletion without waiting for retention periods.
The real server verifies removal from disk and API inventory on startup and after
Save. Browser checks verify current/Undo reference separation, recovery after
reload, removal of stale candidate controls and retained editable descriptions.
An asynchronous test wait and candidate-selection timing were corrected during
verification. Core type checking, focused ESLint and diff whitespace checks passed.
No live generation, source publication or deployment was performed.

## Cover composition — 2026-10-01

Inspected both locally generated Chronicles cover records and one corresponding
image. Both canvases were correctly 1024×1536, but their identical brief requested
a horizontal row and open centre; shared style also encouraged ample negative
space. Updated shared style and both brief/generation prompts with purpose-specific
composition guidance. Covers use most of the selected canvas, modest margins and
no reserved lettering area. Portrait cover guidance adapts a conflicting horizontal
brief to vertical composition. Missing request shapes now default to portrait for
covers and landscape for articles.

All seven image-service tests passed with provider fixtures, including cover and
article defaults, square/landscape cover brief choices, and layout guidance on
generation from an older horizontal brief. Core type checking, focused ESLint and
diff whitespace checks passed. Actual output composition is not automatically
validated; no new image was generated and existing candidates were preserved.

## Content-based image filenames — 2026-10-01

New generated images return a short content-based filename stem in the same
structured response as their alt text. Imports and legacy candidates derive a safe
stem from their description. Source assets append a checksum suffix; published
local image and cover URLs retain the descriptive stem with their content hash.
Renamed the existing beetle illustration to
`wind-up-beetle-bell-rope-barrier-8d113315a70e86eafdd8.png` and updated the article
reference and matching private candidate label. Image bytes and publication time
were preserved.

20 focused naming, image-service, media/export and real-server browser tests passed.
The diagram browser needed an unsandboxed test run; its rerun passed. Core type
checking, focused ESLint and diff whitespace checks passed. Provider generation
responses were fixtures. No live generation or deployment was performed.

## Book and collection covers — 2026-10-01

Added optional explicit collection `cover` metadata and reused the Images workflow
for collection-wide briefs, generation/import, editable descriptions and unsaved
cover assignment/removal. Homepage features and collection overviews render the
assigned cover independently of chapter images. Imports include cover assets;
the build validates and generates hashed WebP renditions.

31 focused service, import, homepage and isolated-preview tests passed, plus eight
authoring browser tests and the real-server browser integration. The latter checks
assignment, removal, Undo, explicit Save, matching homepage/overview images and a
reachable cover rendition. Generation was tested with provider fixtures, without
a live model call. Core type checking, focused ESLint and diff whitespace checks
passed. No cover was assigned to the user's books, and nothing was deployed.

## Homepage article artwork — 2026-10-01

Replaced the fixed site-wide hero in the featured article with that article's
first rendered image and alt text. Collection-only articles use their own rendered
node content; an imageless article has no artwork. Eight focused tests passed:
homepage selection/image derivation and a real local-server Chromium round trip
from a featured draft image to the published article's image (or none) and back.
Core type checking and focused ESLint passed. No publication flags were changed
and nothing was deployed.

## Live preview draft visibility — 2026-10-01

The local banner now offers **Show drafts / Published only**. Switching rebuilds
the isolated site with or without draft promotion; publication flags and release
output stay unchanged. Eight focused tests passed, including an actual server and
Chromium round trip through both views, absence/restoration of draft links,
unchanged draft source, invalid input rejection, browser error recovery and
disabled controls during rebuilding. Focused ESLint, core type checking and diff
whitespace checks passed. Documentation covers shared server-session state and
the reset on restart. This feature is local only; nothing was deployed.

## Image placement — 2026-10-01

Replaced the remembered-cursor option with **Beginning of article** (default),
alongside **End of article**. Beginning inserts after source frontmatter, so the
rendered image follows the title, summary and publication metadata and precedes
the body. All eight authoring browser tests passed, including placement at both
ends, unchanged frontmatter, unsaved insertion and undo. Focused ESLint and diff
whitespace checks passed. This change is local and has not been deployed.

## Generated image descriptions — 2026-10-01

Image generation now returns and persists a suggested alt description with each
candidate. The editor fills it automatically and retains manual edits per candidate
during the session. Imported and older undescribed candidates still require manual
alt text. Six image service tests and eight browser tests passed, including candidate
switching, manual overrides, deliberate clearing, import, reload and insertion.
Core type checking and focused ESLint passed. Provider responses were fixtures;
no live generation or deployment was performed for this change.

## Article publication review and batch approaches — 2026-10-01

Reviewed the saved **Clever Enough to Find the Loophole** draft against the recent
editor changes and its cited sources. The edits retained the distinction between
RL failure mechanisms and deployment controls, and between RLCD, supervised
learning, DPO and predictive world models. Corrected **50 simulated malicious
tasks** to **50 simulated malicious trials**: Anthropic's GLM-5.3 experiment repeats
requests across conditions rather than testing 50 distinct tasks. Two paragraphs
were rewrapped without changing their rendered text. No other publication-blocking
error was found in this pass.

The quality command completed with zero technical errors and zero incomplete
checks. The article's 12 advisory findings were inspected: nine passive-voice
candidates, the intentional first use of the AI tag, a negated attribution of
feelings to a model, and an adverb flag on a deliberate parallel. These do not
require changes. Live source retrieval checked the references; the large Mythos
PDF exceeded the web reader's limit, so its relevant passages were checked in
the previously downloaded source excerpt. The draft's local page rendered at
1440×1000 and 390×844 with 34 source links, correct title/description, the intended
ending, no internal research notes and no browser errors or horizontal overflow.
Screenshots were inspected. The article remains a draft; it was not published.

Batch fix review now offers **Small changes per passage** and **Rephrase where
useful**, with matching helper text and server guidance. Both require a complete
pass; **Assess first** remains available only for individual findings. All 14
focused fix tests and seven browser tests passed, along with ESLint and core type
checking. Documentation reflects the two-option batch behaviour.

## Complete repetition pass — 2026-10-01

Batch repetition review now requests all worthwhile edits together and labels
the default approach **Small changes per passage**, explaining that each edit
should be small. Saved batch instructions and Reset are separate from
single-finding preferences. A required keep/change assessment covers every
paragraph target, with complete unique coverage and replacement consistency
checked before display. The result offers expandable per-passage reasons.

The current article produced 27 repetition groups across 29 targets. A live
Claude Opus 5.5 response assessed all 29, proposed one change and gave reasons
for keeping the others. It passed validation on its first attempt. A test assertion
expecting multiple edits was therefore not satisfied; completeness is not an edit
quota. This demonstrates explicit coverage, not that the model cannot miss an
editorial improvement or change its judgement on another run.

Focused tests cover incomplete, duplicate and unknown assessments, disagreements
between assessments and edits, no-change responses and schema requirements.
Browser regression checks cover separate instruction storage, the batch Reset,
the explanatory label, assessment display and independently applying two edits.
All 27 focused tests and seven browser tests passed, along with type checking and
ESLint. One browser run had an intermittent detached-element failure in the
existing Reopen finding interaction; a repeat passed. Replaying the recorded live
response verified all 29 assessment reasons in the UI, exact application and Undo,
with no additional model request or browser errors. Desktop screenshots were
inspected at 1440×1000; mobile layout was not retested. The article was not saved
or published by these tests.

## Live repetition review — 2026-10-01

The current draft of **Clever Enough to Find the Loophole** was tested in the
local editor at `127.0.0.1:4322`, using Playwright at 1440×1000. The browser used
the real UI; test routing connected review/fix requests to freshly loaded
`Reviews` and `AuthorFixes` services, including the real Python writing checks
and live Claude CLI. No model response or repetition report was mocked. Saving
was blocked in the test session.

Writing checks found 28 repeated stem groups across 30 editable paragraphs.
The first Claude response failed exact-source validation and was rejected; its
individual mismatch was not retained, so the cause within that response remains
unconfirmed. A fresh run with the same normal selective-edit prompt returned two
verified changes from `claude-opus-5-5`, without requesting a minimum edit count.

Both changes appeared with separate checkboxes, original text and editable
replacements. Applying the first alone, the second alone, and both together
produced the exact expected source each time. Unselected changes stayed out;
Undo restored the complete original. Selection and application made no additional
model requests. Browser error/warning checks passed, and the draft on disk
remained byte-for-byte unchanged. This verifies multi-fix handling, not a guarantee
that every live response will pass validation or propose multiple edits.

The persistent browser regression also exercises two paragraph edits, each
selected separately and then together; all seven browser tests passed.

Following this test, fix generation gained one automatic retry after invalid
output, before exposing any proposal. Controlled tests cover Claude, Codex and Pi
recovering from an invalid source quote to two valid edits, a second invalid
response failing without results, cancellation, CLI failures and valid no-change
responses. A retry uses a fresh output file and the unchanged source request plus
validation feedback. All 27 focused fix, review and structured-output tests passed,
as did type checking and ESLint. A further live Claude run with the updated service
returned one valid edit on its first attempt; the earlier multi-fix test's minimum
of two was not met on that run. This is a valid selective result, not a reason to
retry. Automatic repair is verified with controlled provider outputs, not a
live model correction. This is local implementation and testing, not deployment.

## Dependency and shared-helper refresh — 2026-10-01

`npm run verify:ci` passed all 27 checks against an isolated working-tree snapshot
using Node 24.21.0 and npm 12.2.0. This included 197 JavaScript/TypeScript tests,
16 Python tests, coverage gates, formatting, static analysis, dependency boundaries,
workflow checks and the production build. The built artifact verified 185 output
files, 897 local links, 307 legacy records and private-content sentinels. Rendering
tests covered the upgraded Mermaid, KaTeX and citation dependencies.

Both npm packages report zero known vulnerabilities after the documented
`lodash-es` override. The separate prototype rendered at `127.0.0.1:4173` with no
browser console warnings or errors; its temporary server and tab were closed.
Shared finding and repetition helpers are served at their existing authoring URLs
from `lib/`, and architecture checks pass without exceptions. Browser/server tests
verify those assets and editor interactions. No hosted deployment, commit or push
was performed as part of this refresh.

See [current dependency versions and compatibility holds](dependencies-and-hosting.md).

## Finding fixes and agent comparison — 2026-09-24

- Repository suite passed 107 tests (13 JavaScript, 94 TypeScript). New tests
  cover exact target/Unicode anchors, overlaps, invented/duplicate replacements,
  advice-only results and independent agent jobs. Type checks passed.
- An isolated browser fixture using the actual editor UI verified two-agent
  selection, named proposal comparison, selecting and applying only the Codex
  proposal, unsaved state, stale-application blocking and one-step Undo. Desktop
  and mobile checks found no page/panel overflow or relevant console errors.
  Screenshots were inspected. Fixture responses were synthetic; no manuscript
  was sent to agents for this task. Live multi-agent model responses were not tested.
- Existing review flow was opened in the live local editor. No deployment or
  manuscript save occurred. Session persistence and cross-file batch application
  remain outside this implementation.

## Exact finding selection — 2026-09-24

- The author editor now uses per-occurrence UTF-16 source ranges for repeated
  stems and local phrase/word findings. Missing exact matches place a caret with
  an explanation instead of selecting a whole line.
- Browser verification selected the two distinct `a count of ten` occurrences
  on the same source line separately and selected only `twice` for an adverb
  finding. The article remained saved and unchanged.
- All 104 repository tests and 16 Python quality tests passed; type checks passed.
  New cases cover repeated same-line matches, Unicode offsets, wrapped quotations
  and missing-match fallback.

## Subscription-based article images — 2026-09-24

- `npm test` passed 101 tests (10 JavaScript, 91 TypeScript), including five new
  image tests covering subscription-only arguments, all three brief adapters,
  unsaved snapshots, persistent candidates, article isolation, image validation,
  safe insertion, fresh generated-file checks, API-key login rejection, failures
  and cancellation. Type checks passed with no errors or warnings. The final
  build passed: 30 pages, 185 output files, 897 links and private-content sentinels.
- A live synthetic Codex CLI image test succeeded using ChatGPT authentication.
  The actual editor Generate image flow also produced a 1536×1024 candidate from
  an invented notebook brief and the blog style reference. No API key was used;
  no manuscript was sent for these tests.
- In-app browser checks passed at 1440×1000 and 390×844: meaningful screen, no
  framework overlay, no relevant console warnings/errors, no page or image-panel
  horizontal overflow. Screenshots inspected against the existing editor design.
  Insertion, undo, redo, candidate persistence after reload and reuse of the brief
  worked. The article was restored to its saved text; the test asset copy was
  removed, while the ignored candidate remains available as an example.
- Brief adapters were tested with controlled outputs; no new live Claude/Pi brief
  requests were made. Other browsers and interrupted-job recovery remain unverified.
  No publication or deployment.

## Author editor visual refresh — 2026-09-24

- In-app browser checks at 1440×1000 and 390×844 passed page identity,
  meaningful rendering, no error overlay, no relevant console warnings/errors,
  and no horizontal page overflow. Screenshots inspected.
- Real local Writing checks completed with 20 findings; Preview/Review switching
  and opening/closing Saved versions worked. Session recovery regression tests
  passed. No source content was edited or sent to an external reviewer.
- Compared the generated concept and rendered screen for two-pane layout,
  typography, palette, toolbar hierarchy and section spacing. Intentional changes:
  retained collection context and scope guidance, omitted mockup-only rich-text
  icons/line numbers, kept advanced settings together. Results scroll within the
  review pane; narrow screens stack panes. No generated image is a runtime asset.
- This is a local authoring change, not a public-site redesign or deployment.

## Authoring session recovery — 2026-09-24

- Two regression tests passed for refreshed session tokens, preservation of the
  original request payload, bounded retry and readable non-JSON errors.
- Verified the existing in-app browser tab across a real author-server restart:
  it reconnected without another reload, the error cleared, the chapter preview
  rendered and the full site reported ready. Content remained saved locally.

## Writing checks and Editorial review — 2026-09-24

- Full `npm run validate` passed: 8 JavaScript and 86 TypeScript tests (94 total),
  type checks and release verification (30 pages, 185 files, 897 local links).
  The Python quality suite passed all 14 tests, including the added mannerism
  patterns. Later focused review tests and type checks also passed.
- Seven new review tests cover CLI arguments/tool restrictions, executable
  discovery, exact quotation anchoring, literal stdin transport, cancellation,
  timeouts, failure messages, unsaved collection snapshots, unavailable Python,
  and all three adapters using controlled executable fixtures.
- Browser plugin not available; bundled Playwright/Chrome verified the editor at
  1440x1050 and 390x844. Real local piece/collection NLP runs, exact prompt display,
  passage selection, stale-result disabling, undo and unchanged manuscript passed.
  Page identity, nonblank rendering, runtime errors and mobile overflow were checked;
  desktop/mobile screenshots were inspected. Controlled browser responses verified
  disabled unavailable CLI options, cancellation and error recovery.
- Installed CLI help was inspected for Claude Code, Codex and Pi. A live Codex run
  on an invented three-sentence passage passed, returning two suggestions whose
  quotations matched the supplied text. No manuscript was sent: automatic approval
  review rejected the proposed live Introduction test, so the live test used only
  synthetic content. Claude/Pi authentication and model responses were not tested
  live; their adapters passed controlled execution tests.
- No manuscript changes, content publication or deployment. Broader model quality,
  older CLI compatibility and non-Chromium browsers remain unverified. See
  [review usage and limits](editorial-review.md).

## Local authoring editor — 2026-09-24

- `npm run validate` passed: 8 JavaScript and 79 TypeScript tests, Astro/type
  checks, 30 release pages, 185 files and 897 local links. Release private-content
  sentinels passed. No deployment was performed.
- Four new store tests cover save/restore across store instances, stale revision
  rejection, invalid-save preservation, path/symlink restrictions, and an external
  modification during validation.
- Browser plugin not available; bundled Playwright with local Chrome tested
  `http://127.0.0.1:4324/_author/` at 1440x1000 and 390x844. Page identity,
  meaningful content, no runtime errors/overlay, no horizontal mobile overflow,
  screenshots and real interactions passed.
- Tested metadata form application, live preview, undo/redo across Save, saved
  versions after reload, restoration as another save, invalid frontmatter,
  rejected tokenless API access, and full-site availability after refresh.
  The Introduction was restored byte for byte after the save/restore test.
- Warm prose typing-to-preview measured approximately 0.83 seconds on this
  machine. This is an observation, not a performance guarantee for diagrams,
  larger books or full builds. Full-site updates still rebuild in the background.
- Dedicated collection/homepage/alias forms, multi-file transactions, autosave,
  creation/upload tools, incremental full builds and non-Chromium browser QA
  remain outside this first version. See [authoring](local-authoring.md).

Evidence spans 2026-09-16 through 2026-09-20. The root release is deployed;
the latest tagging, book-preview, content-review and import additions are verified locally
and have not been deployed. Dated sections below retain their original test scope.

## Introducing a book — local verification, 2026-09-24

The Introduction announcement now uses Introducing Chronicles of Computation;
Chapter 1 retains New in. Six homepage tests pass, including explicit assignment
independent of reading order. Astro/TypeScript checking and the full authoring
build pass. The permanent Book label and publication flags are unchanged.

## Book labels — local verification, 2026-09-20

Permanent labels now say Book. Explicit newIn announcements identify newly
published book material without treating existing articles or new membership as
new publication. The opening description now reads A Practical History of
Software Engineering. All 82 tests and release validation pass; desktop/mobile
browser checks confirm the new labels, no Growing book text, working reading
navigation and release fallback. Screenshots were inspected. This remains local,
with no publication or deployment.

## Homepage discovery and draft badges — local verification, 2026-09-20

Four new tests cover collection reading URLs/context, book features and fallback,
reuse deduplication, standalone URL preference, dates and preview-only draft state.
All 81 repository tests, type checks and the release build pass. The authoring
build verifies 34 pages and 1,061 links; release output remains 30 pages and 897
links with the unpublished book excluded. Chronicles is configured as the feature;
release currently falls back to the welcome article. No content was published.
Desktop (1280px) and mobile (390px) browser checks pass for the book feature, recent
collection articles, per-piece badges, Start reading → next → contents, and release
fallback without public badges. Screenshots were inspected; no console warnings,
errors or horizontal overflow were found. The Browser plugin was unavailable, so
bundled Playwright and installed Chrome for Testing were used.

## Simplified draft workflow — local verification, 2026-09-20

The Introduction, Chapter 1 and collection are now imported into `content/` with
`draft: true`; earlier notes describing the import as rehearsal-only are historical.
Plain preview runs quality checks and includes all active content. `--release`
remains draft-free. New schema tests cover draft removal/false, legacy status,
conflicting fields, and standalone publication metadata requirements. All 77
repository tests and full release validation pass. The normal preview build checks
three pieces (zero technical errors/incomplete checks, 31 advisory findings), then
verifies 34 pages and 1,057 links. The release build verifies 30 pages and 897 links.
Desktop/mobile navigation was checked again after import. No publication or remote
deployment was performed; the manuscript body text is preserved.

## Full-site authoring preview — local verification, 2026-09-20

- Three focused tests cover selected draft overlays, exclusion of unselected
  drafts, source preservation, temporary dates, local-workspace guards, CI rejection,
  and published-only defaults. The full release validation passes all 75 tests,
  Astro/TypeScript checks, and the 30-page release build (185 files, 897 links,
  307 legacy records).
- The actual Chronicles authoring build passes the production rendering and
  artifact-verification pipeline: 34 pages, 189 files and 1,057 local links.
  It includes the existing site, Introduction and Chapter 1, excludes the obsolete
  combined draft, and is retained only in ignored authoring exports.
- Bundled Playwright with Chrome for Testing checked 1280px and 390px layouts:
  root homepage → collection → Introduction → Chapter 1 → previous/contents;
  meaningful content, draft labels, noindex metadata/headers, omitted analytics,
  HTTP 404 behavior, and absence of console warnings/errors or page overflow.
  Screenshots were visually inspected. The Browser plugin was unavailable.
- The authoring command and its `npm run preview -- --authoring` alias were both
  exercised. Hash comparisons confirm `content`, `.generated`, and `dist` remain
  byte-for-byte unchanged by the authoring build. Release output remains draft-free;
  source statuses are unchanged.
  This is a local preview implementation, not a content import or deployment.

## Content import — local verification, 2026-09-20

- Twelve importer tests pass: selection/dependency expansion, excluded dependencies,
  retired items and typos, byte-preserving bodies/binary assets, idempotence,
  opt-in updates and preserved publication identity, slug collisions, missing
  references/assets, hidden files and symlinks, stale plans, CLI apply controls,
  rollback after a write failure, and copied block dependencies.
- `npm run validate` passes all 72 JavaScript/TypeScript tests, Astro/TypeScript
  checks, and the full site build. Artifact checks verify 185 files, 897 local links,
  and 307 legacy records.
- A dry run against the production content library selects only the two Chronicles
  opening pieces and their collection. An actual CLI apply into a temporary copy
  of the library leaves both imported pieces as drafts, excludes the obsolete
  combined snapshot, and passes the original body/source baselines. The existing
  published welcome article remains in the combined library.
- Production content was not imported or changed. No source prose, publication
  settings, Git commits, remote accounts or deployments were changed. The importer
  has no UI; this change does not require new browser-layout checks.

## Content review — local verification, 2026-09-20

The [pre-publication review](content-quality.md) is implemented and tested locally.
No manuscript prose was changed, and no deployment or publication was performed.

- The documented setup command verified all 46 locked packages and loaded spaCy
  3.8.16 with `en_core_web_sm` 3.8.0; analysis uses Python 3.13.14 and
  Snowball stemming 3.1.1. Setup requires network access; review does not.
- The combined opening review and `npm run validate` passed: eight JavaScript and
  52 TypeScript tests, Astro/TypeScript checking, and the full 30-page build.
  Artifact verification checked 185 files, 897 local links, and 307 legacy records.
- Six focused adapter/CLI tests and 13 Python tests passed, including actual model
  behavior, inflected stem matches, source boundaries/lines, language handling,
  unavailable resources, declared-example output and timeout failures, binary-file
  hashes, stale exceptions, and source immutability. Undeclared snippets were
  verified not to execute.
- The two canonical Chronicles opening pieces passed source/copy baselines,
  reference/resource checks, and both declared Python examples under Python 3.14.
  The report has zero technical errors or incomplete checks, 22 repeated stem
  sequences, and 29 editorial review targets. The obsolete combined snapshot is
  excluded; these findings are not an instruction to rewrite the text.
- Bundled Playwright and installed Chrome for Testing checked the private report
  at 1280 and 390 pixel widths: page identity, meaningful content, noindex metadata,
  expandable counts and passages, findings navigation, and matching JSON results.
  Screenshots were visually inspected; there were no console errors/warnings or
  horizontal page overflow. The Browser plugin was unavailable.
- Private report and draft markers were absent from the public build. Documentation
  links and whitespace were checked. Reports and the pilot profile remain ignored
  local authoring artifacts.

Semantic paraphrase detection, factual/source verification, non-Python runtimes,
other browser engines, and hosted deployment are outside this verification.

Follow-up run on the current article corpus (2026-09-20): the published welcome
article plus the separate Chronicles Introduction and Chapter 1 passed with zero
technical errors or incomplete checks. Both declared Python examples passed again;
source baselines cover the two book extracts, not the welcome article. The combined
report contains 25 repeated stem sequences and 31 editorial targets: 23 passive
candidates, one adverb cluster, three appendix/index context references, and four
tag first-use notices. The welcome article repeats “will grow over time” twice;
three raw sequence counts describe that phrase and its overlapping shorter forms.
This article review excludes the About page, legacy external-link records, and the
obsolete combined draft. It made no prose changes. The previous full site validation
was not rerun because this follow-up only regenerated the content report.

## Tagging — local verification, 2026-09-20

The extensible vocabulary, private inventory, and public non-linked topic labels
are implemented locally; no deployment was performed for this change.

- `npm run validate` passed: eight JavaScript and 46 TypeScript tests (including
  six new tag tests), Astro/TypeScript checking, and the full build. The build
  verified 185 files, 897 local links, and parity for 307 legacy records.
- Tag tests cover unique-piece/status counts, alias deduplication, unknown and
  similar names, registry collisions, escaping, selected source discovery,
  conflicting copies, CLI options, and source immutability. The focused tests
  passed again after moving report output to persistent ignored exports.
- The private review contains one published piece and the two active Chronicles
  drafts. Python has two draft uses; Data representation has one. The obsolete
  combined snapshot is excluded. Source prose was preserved during tag changes.
- Playwright with the installed Chrome for Testing verified the private inventory
  on loopback port 8769 at 1280, 390, and 320 pixel widths: page identity, meaningful
  content, no error overlay, search (including scope text), name/usage sorting,
  published/retired filters, empty states, piece-review selection, and counts.
- The Chronicles preview on port 8768 passed Introduction → Chapter 1 navigation
  and topic-label checks at 1280 and 390 pixel widths. Screenshots were inspected;
  no console warnings/errors or horizontal overflow were observed. The Browser
  plugin was unavailable, so bundled Playwright was used.
- Built standalone article labels and absence of private report/draft markers in
  public HTML/JSON/XML/JS were checked. Documentation links and whitespace passed.

Other browser engines, public topic pages, production deployment, and SEO changes
are outside this verification. The catalogue is a manually regenerated snapshot,
not a live editor or an automated publication gate.

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

| Comparison                  | Evidence and outcome                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Identity hierarchy          | Large Danilo Poccia masthead, spaced secondary publication name, upper-right ink portrait retained             |
| Typography                  | Newsreader headlines/prose and Inter navigation/metadata preserve the selected literary/editorial hierarchy    |
| Palette                     | Warm ivory `#f6f3eb`, charcoal and blue ink; no added gradient or image color overlay                          |
| Containers and spacing      | Open editorial layout with thin rules; no invented dashboard/card chrome                                       |
| Asset treatment             | Ink portrait and matching paper illustration; all rendered images load and stay clear of text                  |
| Responsive behavior         | Masthead and headline reflow at mobile widths; readable navigation and article text remain within the viewport |
| Copy and populated sections | Approved welcome copy and agreed historical labels replace illustrative sample content                         |

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

The earlier hosted dependency modernization passed checks on Node 24.21.0 and
npm 12.0.2. The 1 October 2026 update is verified locally separately; no new
hosted deployment is claimed. See
[dependencies and hosting](dependencies-and-hosting.md).

The hosted preview (URL in the private operations note)
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
- Article alias activation after the next source deployment, optional CI access
  and a full infrastructure rollback rehearsal. The private-S3/OAC resolver,
  TTL/privacy and disposable test cleanup passed on 2 October; see
  [short-link verification](#private-s3-short-links-and-free-plan--2026-10-02).
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

Hosted main job 4 succeeded at `c093c9378d0ed0e02fd37e1f91a27552c6b7a4c3`.
Live verification confirms five original pages remain byte-for-byte identical,
seven new-section routes respond, `/new/build.json` matches the deployed revision
and is uncached, RSS uses mounted URLs, and the apex redirect preserves `/new/`.
Desktop (1440px) and mobile (390px) navigation pass without app/resource errors.
The private fixture browser check also passes collection next/contents, standalone
exit, chapter entry, and book-edition navigation at the mounted base.

Hosting correction: explicit Amplify `404` rules returned 302 redirects to a
200 error page. Removing those catch-alls gives native HTTP 404 responses with
no redirect. The local preview serves the custom error design; Amplify currently
returns an empty native 404 body. Both routing files omit the misleading catch-all.
No credentials, short-link infrastructure, or remote article copies were changed.

## GitHub and Amplify process audit — 2026-09-16

Confirmed before changes: GitHub main, Amplify job 5, and the live marker all
matched `686b116`; auto-build is enabled and the checked-in build recipe overrides
the console fallback. Root pages, mounted routes, feed, headers, and native 404s pass.

The updated process adds read-only PR validation and an independent live check
that runs while publication is disabled. Tests cover stale/invalid/cached markers,
transient failures, superseded commits, and deployment origin/path validation.
Local release validation passes all 40 tests and 178-file / 733-link checks.
Prettier is updated to 3.9.7; registry audit reports zero known vulnerabilities.
Repository workflow defaults were reduced to read-only, with PR approval disabled.
Amplify main job 6 deployed `2bfb695`, and the independent
[GitHub live check](https://github.com/danilop/danilop-personal-page/actions/runs/35085047702)
passed against that exact revision, including original page preservation.
The first manual validation run found Ubuntu's AppArmor restriction prevented
Chromium from starting in two rendering tests. The workflow now grants user
namespaces to Mermaid's exact headless-shell path and retains its sandbox.
The corrected [hosted validation](https://github.com/danilop/danilop-personal-page/actions/runs/35085922379)
passes all tests, type checks, preparation, packaging, and artifact verification
at `1527401`. This manually dispatched run exercises the same job used for PRs;
an actual pull-request event was not needed for this audit.

## Root release and manual distribution — 2026-09-16

Root release configuration passes 42 tests, type checks, and verification of
178 output files, 733 internal links, and 307 historical records. The two new
checks reject unreviewed/unselected delivery, GitHub delivery, and automatic
assignment policies. Existing media/idempotency tests now use reviewed delivery.
No article is enrolled, and no DEV request or credential use occurs.

The artifact enables indexing at `/`, retains `/original-site/`, and prepares
permanent temporary/legacy redirects in `infrastructure/amplify-rules.json`.
The live verifier now checks indexing, robots/sitemap, and all five snapshot
pages in addition to root routes/assets, RSS, revision, and true 404 responses.
Amplify main job 9 deployed `ff09c23`. Direct live verification passed root pages,
assets, indexing, robots/sitemap, RSS, true 404s, and all five snapshot pages.
Ten temporary/legacy redirect cases returned 301 and reached HTTP 200 destinations,
including the article, RSS, and preserved query parameters.

The initial GitHub check saw old root HTML immediately after the new marker
arrived at its CDN edge. The verifier now allows up to three additional minutes
for route convergence and rechecks the marker afterward. A dedicated regression
test covers transient and persistent failures, bringing the suite to 43 tests.
This retry does not turn a persistent route failure into success.

Credential metadata confirms `DEV_API_KEY` in the `dev-publication` GitHub
environment, with no repository-wide copy. Only names were inspected; its value
was not accessed and no provider authentication/publication request was made.

Authoring fix proposals are automatically checked locally before application. A compact
Writing check summary compares new, no-longer-reported and remaining findings;
details and coverage expand on demand. Edited proposals are rechecked, failed
checks can be retried, and Apply remains explicit. This is advisory checking, not
a guarantee of factual or editorial correctness.

## Author workspace consolidation — 24 September 2026

Implemented locally; not deployed. `npm run validate` passed 113 tests (17 JS,
96 TypeScript), type checks, the production build, and output verification:
30 pages, 185 files, 897 local links and 307 historical records.
New regression cases cover grouped content titles/draft labels, saved tag counts
and symlink exclusion, and changed wording classified as a changed finding.
Agent-fix tests use disposable executable stubs rather than depending on installed
provider CLIs, so the suite can run in CI.

Browser checks used the real editor and local writing analysis, plus synthetic
provider/media responses against the actual frontend. Verified:

- Article-text edits preserve frontmatter; Undo restores saved state.
- Metadata immediately marks the working document unsaved and shares Undo.
- Exact selection is visible after wrapping-aware scrolling in article-text mode.
- Writing-check and editorial reports survive switching between result views.
- Finding groups, Next finding, and descriptive occurrence labels work.
- Proposal switching disables Apply while its local check runs.
- Applied state persists; Keep original disappears; Undo change restores text.
- Image stages, description-required insertion, cursor insertion and Undo work.
- Saved-version diff, load and Undo work with a synthetic history record.
- Narrow-screen pane switching fits 390px without horizontal overflow.

No manuscript edits were saved, no live editorial/image-generation requests were
made, and nothing was published during UI verification. The synthetic responses
verify interface transitions, not provider quality. Full screen-reader/contrast
conformance and every long-running provider failure mode remain outside this pass.

## Local browse-to-edit navigation — 2026-09-24

Implemented locally, not deployed. `npm run validate` passed 116 tests (17 JS,
99 TS), type checks, and the production build (185 files and 897 local links).
Production HTML/JavaScript contained no `author-edit`, `/_author/`, or
`author-navigation` references. The server injects links into responses only.

Codex in-app browser checks at desktop 1280px and mobile 390px verified the
Introduction draft's Edit link opens its exact source and collection context.
View on site opened the same reading page in a new tab. The published Hello,
Brave New World article used the same Edit link and opened its own source; the
book overview opened its collection YAML. Meaningful content rendered with no
framework overlay, console warnings/errors, or horizontal overflow on the tested
mobile flow. Screenshots confirmed the link sits quietly in heading metadata;
Draft badges remain unchanged and noninteractive. No content was saved or
published during these checks. Other browser engines were not tested.

## Reusing editorial suggestions — 2026-09-24

Historical result: the free-text replacement workflow below is superseded by the
2026-09-25 concrete-edit workflow. Legacy advice now requires explicit drafting;
selecting a scope no longer turns free text into replacement prose.

Implemented locally; not deployed. `npm run validate` passed 122 tests (22 JS,
100 TS), type checks and the production build (185 files / 897 local links).
New tests cover exact replacements/deletions, legacy scope selection, sentence
boundaries, duplicate excerpts/Unicode, unmatched quotations and replacement
schema compatibility. Subsequent UI-only refinements passed syntax and browser
checks.

Isolated browser fixtures reproduced the subject-index finding: Review suggestion
required a Whole sentence choice for free-text wording, ran before/after checks,
showed a new finding before Apply, applied only to unsaved text, and Undo restored
the original. Server counters showed two writing checks and zero fix-generation
requests. A structured exact replacement skipped scope selection and immediately
started checks. Explicitly requesting synthetic Claude/Codex alternatives retained
the original Review suggestion as a selectable proposal. The optional agent
selector uses a labelled group so its checkboxes remain visible in this view.

Desktop and 390px mobile checks found no framework overlay, relevant console
warnings/errors or horizontal overflow. No real provider calls, manuscript saves,
or publication occurred during these browser tests; model response behavior is
covered by fixtures rather than a new live editorial run.

## Manual decisions and independent passage links — 2026-09-24

Implemented locally; not deployed. `npm run validate` passed 128 tests (28 JS,
100 TS), type checks and production verification (185 files / 897 local links).
Decision tests distinguish Addressed from Kept, allow Reopen, retain original
review evidence, and prevent decisions carrying to fresh reports or other pieces.
Location tests cover offsets shifted by edits, changed/missing quotations,
ambiguous duplicate text, and Unicode. A changed repeated occurrence never jumps
to another surviving occurrence.

An isolated in-app browser fixture verified Edit myself selects the precise
clause. Rewriting it disabled only that missing passage link; the second finding
still selected its exact text at the new source offset. Mark as addressed remained
available on the stale report, removed the finding from the open queue, and Reopen
restored it without changing text. Kept counts remained separate. A fresh review
reset both decisions. No model fix requests, automated check requests, manuscript
saves or publication occurred in the manual-edit flow. These are explicit author
decisions, not automated passes.

Desktop and 390px checks showed meaningful content, no framework overlay, no
console warnings/errors, and no page overflow. Long finding buttons wrap at narrow
widths. The live author server serves the local review decision helper; source,
documentation and tests are updated together.

## Unified preview command — 2026-09-24

Implemented and tested locally; not deployed. `npm run preview` now starts the
full site and local editor together on port 4322. The `author` and
`preview:authoring` npm commands are removed without compatibility aliases.
Release and read-only snapshot previews are explicit modes of the same command.

`npm run validate` passed 131 tests (31 JS, 100 TS), type checks and production
verification (185 files, 897 local links, 307 legacy records and private-content
sentinels). CLI tests cover mode defaults, port overrides, repeated selectors,
invalid combinations, removed flags/scripts and help without starting a server.

Live HTTP checks confirmed the home page, editor and draft Introduction load;
the draft has an Edit link and local responses carry noindex headers. An in-app
browser check followed Edit into the correct Introduction source with the book
context selected and a working View on site destination.

`npm run preview -- --snapshot --collection chronicles-of-computation --build-only`
completed the content checks (two pieces, zero technical errors, zero incomplete
checks, 29 editorial review targets) and built the selected draft snapshot.
Serving that existing snapshot returned the draft without Edit links and rejected
`/_author/`. Release mode served a published article without Edit links and
returned 404 for both the draft and editor. Temporary test servers were stopped;
the normal unified preview remains on port 4322. No manuscript edits, provider
requests or deployment were needed for these checks.

## Article lifecycle

`test/author-lifecycle.test.ts` exercises identity-preserving unpublish, draft-only
deletion, placement/promotion/distribution cleanup, recovery copies, stale source
and dependency rejection, incoming-reference blockers, symlink rejection, rollback
on write failure, short-link deactivation/republication/deletion, idempotency and
ownership conflicts. The regular test command includes this suite. Cloud removal
uses the existing exact-deployment gate. The S3/OAC replacement now has storage, CLI and editor tests; lifecycle
tests alone do not establish cloud publication. UI validation should use disposable content in an isolated copy,
including confirmation cancellation, unpublished-to-draft transition, deletion,
unsaved-edit guards and catalog refresh. Never delete a real article for a smoke test.

Local validation on 2026-09-24: 140 automated tests passed; Astro/core checks
reported no errors or warnings; the release build verified 185 output files,
897 local links and draft/private-content sentinels. The documentation pass checked
157 local links. An isolated Chromium/Playwright session verified published-delete
rejection, cancellation, unsaved-edit guards, unpublish, confirmed deletion and
catalog refresh at desktop (1440 × 1100) and mobile (390 × 844) sizes. The sole
console error was the deliberately rejected published-delete request. The Browser
plugin was unavailable, so bundled Playwright with installed Chrome was used.
Live cloud reconciliation was not applied; these results establish local behavior.

## Social publishing and Trash planning — 2026-09-24

The [new plan](social-publishing-plan.md) records source/CLI inspection and official
platform research, plus a future acceptance matrix. Read-only requests observed
existing basic Open Graph metadata and responding share endpoints; they do not
establish logged-in prefill, thread assembly or real platform card rendering.
Live short-link resolution was not established. No social posts were sent and no
new social, assistant-registry, Trash UI or analysis-hook code was implemented in
this planning change. Earlier lifecycle test results above remain scoped to that
implementation. The planned public sharing flow never uses AI.

Planning validation: 216 local README/documentation links and Markdown anchors
passed; the proposed assistant-catalog YAML example parsed successfully. This is
syntax/documentation verification, not validation against an implemented registry
schema. The application test suite was not rerun for this documentation-only
planning change.

## Code analysis and commit gate — 2026-09-25

Installed the repository-local native Git hook and ran it against an isolated
worktree snapshot, since the real index has no staged changes. Then ran the full
CI-equivalent command, `npm run verify:ci`, with the pinned Node runtime and browser
permissions needed by the existing rendering tests. No source files were staged,
committed, pushed or deployed; the GitHub workflow has not run remotely.

The final local run completed all 26 checks in approximately 45 seconds of analyzer
time. **16 passed; 10 failed on reported findings/coverage thresholds.** This is a
working, blocking gate, not a claim that existing source meets the new policy.
There is no suppression baseline. The detailed report and machine-readable metrics
are `.analysis/report.md`, `.analysis/summary.json` and `.analysis/metrics.json`.

| Measurement                                                | Observed result                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| JS/TS tests (including prototype and new regression tests) | 151 passed, no failures or skips                                                                                                |
| Python tests                                               | 16 passed                                                                                                                       |
| JS/TS coverage                                             | 48.14% lines/statements, 81.01% functions, 76.06% branches; line/statement gate fails against 80%                               |
| Python coverage                                            | 84.57% combined statements/branches; 80% gate passes                                                                            |
| Astro and core TypeScript checks                           | Pass                                                                                                                            |
| ESLint                                                     | 223 findings, including 27 cyclomatic and 45 cognitive-complexity violations                                                    |
| Ruff                                                       | 96 findings, including two functions over the complexity limit (19 and 17 versus 15)                                            |
| ty                                                         | Two type diagnostics                                                                                                            |
| Knip                                                       | 23 dependency/export/type findings                                                                                              |
| Stylelint / HTML-validate                                  | 764 style findings / 54 HTML findings                                                                                           |
| Formatting                                                 | 49 Prettier file findings; Python formatting also requires cleanup                                                              |
| Security                                                   | Gitleaks passes for versionable source; Bandit reports four subprocess review findings, not four confirmed vulnerabilities      |
| Other static checks                                        | Vulture, actionlint, ShellCheck and tool-version verification pass                                                              |
| Builds                                                     | Prototype and release build pass; release verifies 185 files, 897 local links, 307 legacy records and private-content sentinels |

Six snapshot contracts cover partial staging, untracked/ignored files, deletions,
special filenames, dependency-lock mismatch, independent Git metadata, source
symlink rejection and execution through symlinked paths. An additional image-brief
regression test covers delayed results, preserved article edits and stable recovery
after a later job. New analysis scripts and the changed image module pass their
focused ESLint check. Git diff whitespace checks pass.

Earlier scan iterations exposed environment/configuration issues: browser launch
restrictions, missing isolated Git metadata, prototype build prerequisites and
ignored tool symlinks. Those were corrected before the results above. Safe top-level
`node:test` registrations are explicitly recognized, while ordinary application
promises remain checked. Coverage includes unloaded executable modules but not
instrumented Astro/HTML inline scripts; see [scope and thresholds](code-analysis.md).

## Architecture and complexity prioritisation — 2026-09-25

Implemented and exercised locally after the initial analysis run above. No remote
CI run, commit, push or deployment was performed. `npm run verify:ci` completed
the entire snapshot pipeline: **17 of 27 checks passed**, with ten existing debt
categories still blocking. Summed analyzer time was **48.5 seconds**, excluding
snapshot setup/copying. All **158 JS/TS tests** and **16 Python tests** passed.
The seven added contracts check forbidden and allowed imports, fail-closed graph
generation, commit windows/unusual filenames/shallow snapshots, ranking, Python
coverage denominators, stale reports and failed-test coverage handling.

Dependency-cruiser 18.4.0 reported **163 modules, 503 dependencies and zero rule
violations** in its declared runtime graph. Fixtures demonstrate that every
forbidden rule actually blocks; the adapter checks the JSON verdict rather than
trusting upstream's JSON reporter exit status. Astro/HTML embedded dependencies,
Python imports and package internals remain outside the graph.

Coverage was **49.55% JS lines/statements, 81.99% functions, 75.86% branches**;
Python remained **84.57% combined statements/branches**. The increase from the
earlier aggregate chiefly reflects testing the new analysis tooling, not broader
application coverage. ESLint remains at **223 findings**; new analysis files pass
their focused ESLint and formatting checks. No complexity/coverage thresholds
were relaxed and no baseline suppressions were introduced.

The new report uses complete 90-day Git history. Its first two files are
`scripts/prepare.ts` (six commits) and `scripts/publish-links.ts` (two), both with
complexity violations and zero measured unit coverage. Both participate in release
checks outside the unit coverage session; zero unit coverage does not mean no
validation. New authoring files are identified as having no committed history;
unmeasured inline scripts retain unavailable coverage, not zero.

Release validation again checked **185 output files, 897 local links, 307 legacy
records and private-content sentinels**. The real Git index remained empty.
See `.analysis/report.md` and `.analysis/metrics.json` for the reproducible local
inventory, and [code analysis](code-analysis.md) for policy and interpretation.

## Concrete edits in the initial editorial review — 2026-09-25

Implemented locally, not deployed. The shared prompt now requests the explanation
and a concrete edit together in one response, preserving the article's language,
tone and voice. Missing facts or intent instead require a specific question.
Legacy advice cannot populate replacement prose, even after choosing a scope;
it needs an explicit drafting request. Questions require answers in both the UI
and server schema. Conflicting question/replacement output is treated as a question.

`npm run verify:ci` completed all 27 checks: **17 passed**, with the same ten
existing debt categories blocking. All **160 JS/TS tests** and **16 Python tests**
passed, including regression coverage for advice-only findings, exact replacements,
deletions, unmatched/duplicate/Unicode source, required answers, advice/answer prompt
propagation and legacy output compatibility. Astro/TypeScript, dependency boundaries
and release validation passed: **185 output files, 897 local links, 307 legacy records
and private-content sentinels**. Refactoring the changed UI functions reduced ESLint
findings from **223 to 217** without relaxing limits. JS coverage remains below its
gate: **49.41% lines/statements, 81.92% functions, 75.98% branches**; Python remains
**84.57% combined**. Browser interactions are outside that unit coverage session.

The initial QA used Playwright with the installed Chrome executable on the local
editor route. A subsequent capability check confirmed that Computer Use exposes
the Codex in-app browser and native Safari controls; the earlier claim that browser
access was unavailable was incorrect. The local editor was then opened and its
rendered content verified through the in-app browser. The interaction suite below
was performed with Playwright, not repeated through Computer Use.
Desktop **1440×1000** and mobile **390×844** checks passed
page identity, meaningful content, absence of framework overlays, console
errors/warnings and mobile horizontal overflow. Deterministic API fixtures verified:

- **Review edit** opened an already supplied pair with **zero additional generation
  requests**; local check completion enabled Apply; Apply/Undo restored exact source.
- **Draft an edit** showed generic advice without a replacement or Apply control.
  Choosing a paragraph still did not create replacement prose. Only an explicit
  draft request produced one, carrying the original advice and selected target.
- **Answer question** disabled drafting until an answer was present, passed that
  answer to the request, and discarded the draft when the answer changed.
- Opening another finding cleared the previous proposal during asynchronous setup.
  No article was saved or published; the source file stayed byte-identical.

Screenshots were inspected and kept outside the repository. Focused formatting,
`git diff --check`, and **110 documentation links/anchors** passed. The real Git
index remains empty. Provider responses and local check results were simulated for
the UI test; no live model was called, so this verifies workflow and contracts,
not the quality or consistency of any provider's new editorial output. Restart an
existing preview server and refresh its editor to load the updated server schema
and browser scripts before running a new review.

## Preview server watch mode — 2026-09-26

Implemented locally: `npm run preview -- --watch` starts the existing live preview
under Node's native watcher. An isolated integration fixture runs the real launcher
and tsx loader, changes an imported TypeScript module, verifies a child restart,
introduces and fixes a syntax error, verifies recovery, then verifies shutdown of
the watched child. Reading-page polling tests cover unchanged/new build versions,
replaced server sessions, temporary HTTP failures and connection failures.
Release/snapshot combinations are rejected; custom ports remain supported.

All **162 JS/TS tests** and **16 Python tests**, Astro/TypeScript checks, architecture
checks and release validation passed in `npm run verify:ci`. The overall gate still
reports **17/27 passing checks**, blocked by existing analysis debt and **49.46% JS
line coverage** against the 80% threshold. The refactored preview option parser and
new tests pass focused ESLint/formatting checks; total ESLint findings fell from
217 to **215**. No threshold was relaxed. **92 documentation links/anchors** and
`git diff --check` passed. The real index remained unchanged.

The watcher fixture needed execution outside the filesystem sandbox: sandboxed
Node reported `EMFILE` while establishing file watches; the same integration test
passed with normal filesystem access. This change does not forcibly reload editor
tabs, retain server-side AI jobs across code restarts, or hot-update browser scripts.
The existing running user preview was not stopped or replaced during validation.

## Release preflight — 2026-09-27

The pending authoring, content-model and analysis changes were checked with
`npm run verify:ci` using the pinned runtime and normal browser/filesystem access.
All **162 JS/TS tests** and **16 Python tests** passed, together with Astro/core
type checks, dependency boundaries, secret scanning and release preparation/build.
The release verified **185 output files, 897 local links and 307 legacy records**,
including private-content sentinels.

The full gate remains **17/27 passing checks**. The same documented ESLint,
dead-code, CSS, HTML, formatting, Ruff, Python-format/type/security and JavaScript
coverage categories fail; this is not an approved clean analysis run. Local model
benchmark reports under `outputs/cli/tune/` are now ignored and excluded from the
versionable snapshot. Production deployment is not established by this preflight.

Both Chronicles pieces and their collection retain `draft: true`. Draft status
excludes them from the website; source pushed to this public repository remains
readable on GitHub. The README and publishing workflow state that distinction and
correctly distinguish GitHub's `verify:ci` job from Amplify's `validate` build.

## Commit-hook findings resolved — 2026-09-27

This supersedes the blocking preflight above. The isolated `npm run verify:ci`
run passed **27/27 checks**, including **175 JS/TS tests**, **16 Python tests**,
the prototype build and release preparation/build. JavaScript coverage measured
**80.94% lines/statements, 86.80% functions and 76.11% branches**; Python combined
statement/branch coverage was **84%**. Thresholds and source scope were not reduced,
and no suppression baseline or hook bypass was used.

The fixes split complex functions, remove unused code/dependencies, replace unsafe
types and correct markup, styles, Python diagnostics and formatting. Browser and
server integration tests cover editing, recoverable changes, review suggestions,
image insertion, prototype dialogs and draft exclusion. Cloud-publication, model
and analytics boundaries are mocked without contacting those services. Coverage
from Chromium is attributed only to verified source; long-running server coverage
is flushed before shutdown. Snapshot Vite servers explicitly allow the reused
dependency directory, so font requests are validated instead of ignored.

Desktop (1440 × 1000) and mobile (390 × 844) authoring screenshots were inspected.
Computed layout, type, colour and spacing properties matched the staged pre-cleanup
CSS on both viewports after accounting for the renamed element IDs. Browser tests
also assert no console/page errors and no horizontal overflow. Documentation was
updated for the unified browser suite and both npm workspace installations.

The Chronicles pieces and collection still have `draft: true`; the release tests
verify their absence from public pages, feeds and indexes. This local validation
does not itself establish production deployment.

The first GitHub run stopped during tool setup: Go-installed Gitleaks lacked
release version metadata, and Actionlint's Go version string did not match the
required plain version. CI and the documented Go commands now explicitly embed
the same pinned source versions through linker flags; exact-version enforcement
remains unchanged.

Both corrected Go commands were rebuilt in a disposable directory and accepted by
the unchanged version gate. The application commit also completed Amplify
validation and passed the live revision, page, resource, RSS and 404 checks; the
CI installation correction requires a subsequent GitHub run.

The corrected GitHub run passed all analysis and release checks. Its final upload
then exposed a coverage HTML filename containing a generated bundler identifier
(colon and angle-bracket characters), which GitHub artifacts reject as individual paths. The
workflow now uploads both complete report directories in `code-analysis.tar.gz`,
without dropping reports or altering measured source or thresholds.

A later Amplify run passed 174 tests but exceeded the prototype browser test's
five-second initial page-load timeout during cold Vite compilation. Initial
navigation now allows 30 seconds within a 60-second test limit; interaction
assertions, console-error checks and coverage requirements are unchanged.

## Private S3 short links and Free plan — 2026-10-02

The existing distribution uses an S3 REST origin with OAC, public bucket access
blocked, and CloudFront read access restricted to `redirects/*` for that distribution.
One viewer-response Function converts S3 redirect metadata to HTTP 302. It preserves
read-only Via/Warning headers and runs an AWS runtime check before provisioning
publishes it. The managed uncompressed caching policy is accepted by the Free plan.
The five-second error mapping returns 404 for missing private-origin keys.

The Free subscription was observed ACTIVE for the short-link distribution, its
required dedicated WAF ACL and matching Route 53 zone. DNS/TLS and the root 302
were checked over the public hostname. Access logging was disabled for Free;
previous settings, resource IDs and test evidence remain outside this repository.

A disposable S3 alias passed GET/HEAD equivalence, empty-body 302, browser no-store,
edge cache hit, 60-second update expiry, targeted invalidation, unknown-path 404,
private-prefix denial through CloudFront and anonymous direct-S3 403. Its redirect
and temporary private object were deleted; invalidation completed and the test URL
returned 404. The final object inventory contained only the intended root/error
objects. No article aliases or website source changes were published in this task.

Local tests cover paired alias paths, destination-sensitive ETags, ownership and
removal tombstones, retry after interruption, deployment gates, CLI ordering and
editor reservation/check/deactivation. Browser tests exercise a draft reservation,
a deployment error and live-status feedback. Optional CI publication requires
both private configuration and a scoped role; neither is activated by local saves.

## Release cache isolation — 2026-10-02

The article/editor release was committed and pushed to main. Its local checks
passed (25 analysis checks, 245 JavaScript tests, production validation of 190
output files and 921 local links). Amplify's parallel integration tests exposed
a shared Astro content cache: temporary builds shared `node_modules`, allowing
another fixture's inventory to replace the preview's routes. Deployment stopped
before delivery, preserving the previous public site.

Astro and Vite now use workspace-local caches under ignored `.astro/` paths.
A new concurrent-build regression and the preview-server integration test passed
locally. The corrected source passed Amplify's tests and deployed successfully.

## Article and social-card delivery — 2026-10-02

Release `49efd5f` passed all 25 analysis checks and 246 JavaScript tests, with
16 Python tests passing. The combined pre-publication check found no technical
errors or incomplete checks; editorial review targets remain advisory. Production
verification checked 190 files, 921 local links and 307 historical records.

The public build marker matched the exact main revision. Live checks passed for
the homepage, public routes/resources, RSS, true missing-page 404 and original-site
navigation. Clever Enough to Find the Loophole is published; the two Chronicles
pieces and their collection remain draft and absent from production output.

The saved welcome and AI-article short aliases were activated only after this
verification. Full and short URL crawler checks confirmed matching GET/HEAD chains,
canonical URLs, titles and publicly fetchable 1200 × 630 JPEG cards within the
image budget. No logged-in social platform rendering was tested. Private resource
identifiers and publication evidence remain in the operator note.
