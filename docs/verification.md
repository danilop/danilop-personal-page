# Release verification

## Front-matter parser switch — 22 October 2026

Replaced `gray-matter` 4.0.3 with `@11ty/gray-matter` 3.0.0 to drop the
unpatched `sprintf-js` advisory; see the
[dependency guide](dependencies-and-hosting.md#front-matter-parser--2026-10-22).

1. The regenerated lockfile has no `sprintf-js` or `gray-matter` entry; `js-yaml`
   resolves to 5.5.0 and `argparse` to 3.0.3. `npm audit signatures` verified all
   registry signatures. None of the new packages has install scripts.
2. Every `content/**/*.md` file parsed with the production `yaml` engine produced
   identical data and body under the old and new packages.
3. `tsc --noEmit -p tsconfig.core.json` passed. On a Raspberry Pi without a
   Puppeteer browser, the Node suite (excluding the four browser test files)
   passed 336 of 339; the two failures were Mermaid renders that could not find
   `chrome-headless-shell`. CI runs the complete suite with a browser.

## Chronicles native PDF proof — 16 October 2026

Installed XeLaTeX through Homebrew's `texlive` formula and the DejaVu font family
on the authoring Mac. A fresh equivalent setup uses:

```sh
brew install texlive pandoc poppler librsvg
brew install --cask font-dejavu
xelatex --version
```

Run `./build_pdf.sh` in the canonical Chronicles book checkout. Its tooling guide
documents installation, font overrides, generated evidence and maintenance through
Homebrew. MacTeX is an alternative distribution, not an additional dependency.
The canonical `editorial/pdf-proof-2026-10-16.md` records this proof in detail.

Fixed code listings splitting between pages, long highlighted tokens overflowing,
font extraction changing ASCII pipes/hyphens, a missing superscript-five glyph,
reference URLs extending into the margin, and contents page-number boxes too narrow
for three digits. Intentional blank versos now omit running headers and numbers.
The native build retains Letter paper, 2 cm margins, 10 pt text, right-hand chapter
openings and breakable quiet notes.

The resulting PDF has 224 pages. All pages were inspected at overview scale,
with detailed checks of short and long listings, indentation, notes, the layout
table, the agent diagram, contents and bibliography. All 120 Python listings
match source non-whitespace characters and fit on individual pages. No text
exceeds the checked page bounds; the final compiler pass has no missing glyphs,
overfull boxes or unresolved references. All fonts are embedded; 799 internal links
and 859 named destinations resolve. The book tooling suite passes 102 tests,
including a real XeLaTeX long-token regression. The British English check reports
zero targets.

The canonical PDF build now runs a stdlib/Poppler audit before replacing the last
successful PDF, retaining its exact assembled source, compiler log and a JSON
report with source/PDF fingerprints. Visual checks remain necessary: the audit
does not certify image placement, whitespace-preserving copy/paste or publisher
output. Native PDF proofing is complete for this reading-copy layout; remote
Leanpub rendering, native EPUB-reader proof and print-production sign-off are
separate. These are local book-build and documentation changes; manuscript prose,
article narration and website publication state are unchanged.

## Chronicles code example application — 16 October 2026

Applied the individual review decisions to the canonical book and synchronised
the existing Chapter 1 article through a scoped, fingerprinted import. Later
chapters have no corresponding articles yet. Publication flags and unrelated
draft work remain unchanged. See [the editorial record](code-example-editorial-review.md).

The resulting inventory is 104 included programs, 16 inline appendix snippets
and one optional attention companion. All 105 standalone files passed with
Python 3.14.8 and 3.15.0 under `-I -S`. Both interpreters also executed all 120
printed blocks successfully. The strict include/index/import audit found no
issues; 44 focused example tests passed on both interpreters, the complete book
tooling suite passed 94 tests, and the British English check found no targets.
The rebuilt HTML and EPUB contain 21 chapters and 28 EPUB spine documents, with
no broken internal links, duplicate IDs or missing resources. The book contains
83,252 prose words, within its existing 80,000–90,000 target.

The reviewed tally explanation and changed prose were regenerated with the
existing George/MLX profile: 549.0 seconds for the article and 962.6 seconds for
the preview audiobook. The private preview built 43 pages and verified 220 files
and 1,496 local links. Its initial sandboxed content-worker attempt was unavailable;
the retry with local worker access completed successfully.

In-app Chromium checks verified the actual Python output for ten and seven
animals, copied code equality, original-code restoration with cleared output,
and stepping through the loop with the correct line highlight and growing tally.
Desktop 1280px and mobile 390px article views were inspected; controls reflow,
the editor scrolls horizontally when necessary, and the page does not overflow.
Chapter playback advanced and paused with the new duration; the book page exposes
the regenerated full MP3. No console warnings or errors were recorded in the
tested article flow. Canonical HTML inspection found two long listings, which
were wrapped without changing execution, and a Pandoc highlight-style override
that defeated narrow-screen code scrolling; the export stylesheet now contains
that scrolling and allows long inline paths and reference URLs to wrap.

The later [native PDF proof](#chronicles-native-pdf-proof--16-october-2026) resolves
the initial missing-XeLaTeX limitation. EPUB structure and execution were checked;
the example pass does not claim
a native EPUB-reader or remote Leanpub proof. Full repository gates and the
exact hosted revision are checked by the commit/release workflow before reporting
deployment complete.

## Homepage and Writing discovery — 16 October 2026

Implemented the latest article, stable public book summaries and independent
articles as separate homepage sections. All writing now has linked public-book
and independent filters. Bounded static pages underpin an explicit shared Show
more control, including accessible counts/status, retry and browser-history
restoration. Legacy lead pinning no longer hides the newest publication.

Selection tests cover all three publication sources, multi-book and same-book reuse, identity
deduplication, stable date ties, publication batches, zero/one/many entries and
draft isolation. Runtime tests cover append/exhaustion, duplicate requests, failed
fetch/retry, build revision mismatch, direct later pages, cumulative restoration
and Back/Forward events. Navigation slugs are reserved against article collisions.

In-app Chromium checks used actual current preview content and isolated generated
fixtures containing both books and sixteen additional test articles. Fixture
publication dates were synthetic; no real draft flags or timestamps changed.
Desktop 1280px, narrow 640px reflow (equivalent layout width at 200% zoom),
and mobile 390px checks verified all three lead sources, no repeated
lead card, legible books and linked filters with no horizontal overflow. Actual
interactions verified append-six, keyboard focus, filter selection, exhaustion,
reload, article navigation and Back, and Back/Forward between loaded ranges.
A script-free copy verified ordinary Next-page navigation. Temporarily removing a
fixture page verified the error message, fallback link and successful retry.
The intentional 404 was the only expected application error in that scenario.
Safari, Firefox and assistive-technology speech output were not retested.

The full JavaScript suite passed: 359 tests, one opt-in AWS test skipped, zero
failures. All 26 repository commit checks passed, including coverage and build validation. The authoring integration test verifies draft/published toggling and
artwork with the new lead component.

The draft-inclusive snapshot built 43 pages and verified 219 files/1,496 local
links. Full repository and release checks are recorded by the commit/release
workflow; publication state remains unchanged by this interface change.

## Listening label simplification — 15 October 2026

Included in this release. Removed the “AI narration” badge and its
unused styling from both article and audiobook players. Playback controls, audio
files, spoken opening credits and internal voice choices are unchanged.
`npm run check` passed with no diagnostics. Browser inspection confirmed both
players omit the badge and retain their controls; no console errors or warnings
were recorded. Formatting and diff-whitespace checks passed.

## Article typography and combined release — 15 October 2026

Included in this release: the reviewed listening layout, Python information
disclosure, portable paragraph callouts and standalone article typography.
“Clever Enough to Find the Loophole” replaces 20 bold spans with 14 italic term
introductions and six ordinary acronym/product mentions. Its wording, links and
publication metadata are unchanged. Browser inspection confirmed the 14 emphasis
elements, no remaining bold spans in the article and no recorded console errors.
Both public narration renditions passed validation without audio regeneration.
Book drafts retain their publication status. Fresh release validation and hosted
revision verification are required before treating this release as deployed.

## Quiet callouts and whole-book emphasis — 15 October 2026

Included in this release. The portable Pandoc/Quarto note
profile renders as quiet in-flow paragraphs in article/book HTML and exports as
native Markua asides. Unsupported profiles and nesting fail explicitly; literal
code fences and source offsets are preserved. Narration flattens callout contents
without an added label or pause. See [the editorial conventions](book-emphasis.md).

Two HomePage regression tests cover LF/CRLF offsets, code literals, invalid
attributes, nested/unclosed fences, links/strong text, article/book/generic-prose
HTML, Markua and unchanged speech hashes. The final isolated snapshot passed
25 of 26 gate tasks; the remaining task had one browser-navigation timeout in an
unchanged article-sharing test. That test file passed separately on retry (3/3).
Across the run and retry, 343 JavaScript tests passed and the opt-in AWS test was
skipped. Coverage thresholds passed; types, lint, architecture, Python checks and
narration readiness passed. The isolated production build passed: 31 pages,
194 output files, 921 local links and private-content sentinels.

The canonical book now has 33 callouts: the introduction and 32 existing chapter
paragraphs. Removing the added wrappers restores every chapter byte-for-byte;
prose word counts are unchanged. All 33 occur in the HTML and EPUB. Four canonical
regression tests verify HTML/LaTeX conversion, strong text, unsupported/nested
profiles, literal code and the five updated prose-analysis paths. British English
review found zero targets. Export validation passed all 133 printed Python blocks,
21 chapters in both formats, 28 EPUB spine documents, zero broken internal links,
zero duplicate IDs and zero missing resources.

Browser checks used Codex's in-app browser at localhost:4322 for the article and
chapter, and localhost:4370 for the canonical HTML. Desktop 1280×720 and mobile
390×844 screenshots were inspected: ordinary typography, comfortable padding,
clear surrounding spacing, no horizontal overflow or framework overlay, and no
recorded warning/error console messages on the tested website pages. The EPUB's
extracted introduction and bundled CSS were inspected as an HTML browser proof
because direct XHTML navigation was blocked by the browser; this is not a native
EPUB-reader or pagination test. No new interactive control was added by callouts. The chapter still showed its
book-player link. Its actual Python example passed Step (next line 1), Run
(finished with ten notches) and Reset (original code restored, output cleared).

A representative standalone LaTeX document using the exact quiet-note environment
compiled successfully with Codex's built-in compiler. XeLaTeX was unavailable
during that check; the later [native PDF proof](#chronicles-native-pdf-proof--16-october-2026)
completes the book build and pagination review. No
remote Leanpub preview was requested or submitted; actual Leanpub styling and
physical reader/accessibility testing remain to be checked before distribution.

The actual Chapter 1 speech segments and hash were compared before/after wrapping.
They are identical. Its two unchanged code explanations were re-reviewed against
their source and context, renewing their context-bound hashes. Private audiobook
preparation reused all 61 chunks (1,008.2 seconds), without new synthesis.

## Listening layout and Python information — 15 October 2026

Included in this release. An isolated snapshot of the interface changes
passed all 26 repository checks: 341 JavaScript tests passed, one opt-in AWS test
was skipped. The production build verified 31 pages, 194 output files and 921
local links. The initial run hit navigation/cleanup timing failures; the final
run passed. A subsequent mobile button-padding adjustment passed targeted style
and formatting checks.

CUA checks in the Codex in-app browser covered introduction, chapter, standalone
article and book-page listening surfaces, including a 390px mobile viewport.
Listening areas leave 32px before reading content. The chapter link opens the
book player at Introduction without autoplay; article and book play/pause still
work. The Python information disclosure opens by mouse and keyboard without
starting a runtime, provides official project links, and fits beside
Run/Step/Reset on mobile without horizontal overflow. Actual Python Run and Step
worked; Reset restored the original source and cleared output. Safari, Firefox
and screen-reader behaviour were not tested in this pass.

The introduction's distinction between illustrative Python inputs and historical
records was clarified in both the canonical manuscript and the website copy.
The original book's British English check found no review targets. Its private
preview audiobook was regenerated, reusing 61 unchanged chunks. This was a local
preview refresh, not publication or deployment.

## Shared code-control icons — 14 October 2026

Included in this release. Run, Step and Reset retain their visible labels
and now use a play triangle, triangle-to-bar step symbol and counterclockwise
reset arrow. No rewind control was added. The SVG component and icon/label layout
are shared with audio playback, including private authoring previews. SVGs are
decorative and do not duplicate accessible names.

Verification passed: 341 JavaScript tests, zero failures, one opt-in AWS test
skipped, plus Python/coverage/narration checks. The first full run caught only a
CSS import-notation rule; after correcting it, all static checks and the production
build passed (31 pages, 194 output files, 921 local links). All 148 documentation
paths checked resolve, and the unrelated 19-file content baseline is unchanged.

In-app Chromium checks used the existing tally preview at normal panel width and
390×844 through CUA Playwright (the separate Browser plugin is unavailable).
Page identity, meaningful content, no framework overlay, clean console and visual
layout passed. Step highlighted the source, Run produced ten bars and the count,
and keyboard Reset restored the original code. All three buttons retain 44-pixel
height with no mobile page overflow. A public-article preview also verified play,
pause, resume labels and icon switching. Firefox, Safari and screen-reader testing
remain outside this browser verification. Release acceptance requires the exact
commit in the live `/build.json`, passing deployment checks, and unpublished book
routes remaining unavailable. `npm run release` records that result separately.

## Simplified Python example — 14 October 2026

Included in this release. The separate tally demo and the subsequent
local multi-panel prototype are replaced with one editable code area, Run, Step,
Reset and one output. There are no visible line numbers, matching the book's code
presentation. A background highlight follows the next Python line within the
editable area, including internal scrolling for longer examples. Run shows the
complete result; Step follows recorded execution. Editing invalidates the old
recording; Reset cancels execution and restores the exact article source.

Focused tests pass for real Python line events, progressive Unicode output,
functions, errors and execution/output limits, plus DOM controls, cancellation,
source restoration, message validation and scroll-aware highlighting. The complete
**26/26 repository checks** passed: 341 JavaScript tests passed, none failed and
one opt-in AWS test was skipped. The production build passed, verifying 31 pages,
194 output files, 921 local links and 307 legacy records. All 144 local documentation
paths checked resolve. The 19-file baseline of unrelated draft/content data is unchanged.

Real Chromium checks verified the original ten-bar tally, edited three-x tally,
progressive output, Unicode and a single exception display. A 32-line program
scrolled the same editable field to the next line without changing its selection.
Reset cancelled a deliberately busy program and restored source and scrolling.
Keyboard stepping passed. At 390×844, the page has no horizontal overflow and all
three buttons retain 44-pixel targets; long code lines scroll inside the editor.
No browser warnings/errors were observed. Firefox, Safari and screen readers
have not been exercised. Runtime version and opaque frame/CSP isolation remain
unchanged. See [the component specification](code-activities.md).

## Audio controls and code activities release — 14 October 2026

Release scope includes shared SVG play/pause controls for public narration and
local voice previews, plus the reusable editable Python runner, visual step demo
and tally companion file. The implementation passed the 26-check gate and
desktop/mobile browser checks recorded below. Publication flags are unchanged:
the book drafts and tally chapter are not public pages. Unrelated draft changes
and private asset metadata are excluded from this release.

The standard `npm run release` workflow validates the committed scope, verifies
asset transfers, pushes the exact revision and waits for the live `build.json`
marker and route checks. Its release receipt records that verified revision;
GitHub CI independently checks the deployment. Earlier local-only entries below
record the state at their test time.

The first GitHub validation run exposed an editor refresh race: rebuilding review
results could collapse an open decision group while the author was about to
reopen a finding. Decision groups now preserve their expanded state across
refreshes, as open finding groups already did. The browser regression triggers
a refresh with a decision group open and completes the keep/address/reopen
workflow using normal actionability waits instead of forced clicks. Validation
thresholds are unchanged.

The first hosting build also timed out while closing the sharing browser fixture.
Its HTTP-server teardown now closes remaining connections explicitly, so browser
keep-alive connections cannot block later cleanup. The three sharing tests passed
locally with this repair; their assertions and the ten-minute suite limit remain
unchanged.

## Interactive tally and reusable Python runner — 14 October 2026

Historical checks of the initial interface, superseded by the simplified example above.

Implemented and verified locally; not deployed. The draft Chronicles tally fence
is selected by an exact source hash in `activities.yaml`. Its manuscript bytes,
publication state and narration remain unchanged. The companion file supplies an
editable Python runner and an independent visual step model; see
[code activities](code-activities.md).

The full `tools/code-analysis/pre-commit.mjs` gate passed **26/26 checks** in an
isolated snapshot containing the code-activity changes and the already-tested
shared audio controls, excluding unrelated draft edits. JavaScript results:
**338 passed, 0 failed, 1 opt-in AWS CLI test skipped**. Coverage was 81.63% of
statements/lines, 79.15% of branches and 90.60% of functions. Checks included Astro
and core types, lint, dependency architecture, styles, formatting, generated-site
and book/publication fixtures, Python analysis and narration validation.

Added automated tests cover exact fence matching and drift, ambiguous/duplicate
selection, invalid configuration, HTML escaping, library loading, web versus book
output, visual stepping/count validation, runner message isolation, deadlines,
Stop and Reset code during execution. The Chronicles preview verifier now counts
`pre code` source listings separately from the runner's `pre samp` output panel.

Browser plugin not available: used installed Playwright with Chromium against
the authoring preview at `http://127.0.0.1:4342`, at 1280×900 and 390×844. Confirmed
chapter and continuous-reading routes, meaningful content, no framework overlay,
no horizontal overflow, 44px visible controls, keyboard activation and screenshots.
Real Pyodide execution produced the ten-mark output, then seven after an edit;
Reset code restored the original sample and cleared output. Also checked visual
step/back/play/reset, invalid counts, syntax errors, escaped output, unsupported
input, 64 KiB output limit, Stop, reset while running, the ten-second execution
deadline, reload resetting edits, blocked-CDN recovery controls and JavaScript-off
static code. No runtime download occurred before Run Python, including during
visual-demo use. Four expected Pyodide console messages came from deliberately
triggering unsupported stdin and the output cap; no unexpected app errors occurred.

Isolation was verified in the real browser: the frame could access neither the
parent document nor origin storage, Python reported a null origin, and a fetch to
a controlled CORS-enabled loopback endpoint was blocked before any request reached
it. A positive control from the article page reached the same endpoint. These
checks exercise the actual frame/Worker boundary rather than treating a Worker as
a sandbox by itself.

Physical Safari/iPhone, Firefox and screen-reader interaction remain untested.
The CDN is an explicit external runtime dependency; first-run offline execution
is unavailable. No content was published and no deployment was performed.

Earlier entries retain the commands/ports used at the time. The unified preview
entry below supersedes the former default snapshot and separate author command;
see [current preview usage](authoring-preview.md).

## Publication CLI fixture isolation — 2026-10-03

The publication CLI test now replaces the welcome article's body in its disposable
checkout with controlled prose and a generated PNG. Both destination previews must
bundle that PNG without network calls. This removes a dependency on ignored source
artwork and local image caches that caused the hosted build to fail after adding
the welcome illustration. Production content and export behaviour are unchanged.
The focused regression passes with the copied source artwork and asset cache
explicitly removed, and verifies the bundled image dimensions for both destinations.

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

## Managed asset release migration — 2026-10-02

Local implementation covers checksum manifests, private original backup, selected
public CDN delivery, pinned social cards, strict build availability checks and
exact-commit upload-before-push. The original authoring paths and initial public
media URLs are preserved. Local cleanup excludes catalog-only references, protects
explicit shared files and checks unused cached renditions; release holds its lock.
A daily collector shares the S3 lease and performs mark/grace/recoverable deletion
with scoped noncurrent-version retention. The three source images were uploaded,
read back and checksum-verified before untracking; each original's CDN path denied
access. Four public renditions passed CDN checks. A source-only production checkout
with no original files or rendition cache restored the required public bytes and
passed the 190-file / 919-link build. Private cover restoration rendered the actual
1024 × 1536 cover; a temporary book source restored a private image and froze it
into a checksum-verified manuscript resource. Temporary sources are not published.

The scoped daily collector is provisioned. Fourteen live lifecycle rules preserve
the existing abort-upload rule and restrict thirty-day data-version expiry to
owned objects. Its live dry run correctly deferred on the pre-migration deployment,
which had no inventory. Releases record the exact committed manifest and invoke
collection after hosted verification; routine outcomes and resource identifiers
are recorded in the private operations note.

Focused tests cover dirty repositories, upload failure, edits during upload,
changed ignored bytes, public-source hydration, corrupt bytes/MIME/status,
private-only draft upload, PDF reference protection, orphan collection, replacement
with legacy URL preservation and remote live/rollback/pending retention.
Remote data-collection dry runs make no data mutations (the coordination lease is
still acquired/released); deletion uses a conditional delete marker and records
the retained version ID. Tests cover ownership, manual-file preservation, immutable
shared downloads, directly linked managed files and committed-inventory recording
even when the working manifest changes during deployment.

## Chronicles source refresh — 7 October 2026

The existing Introduction and Chapter 1 drafts were compared with the canonical
book source. Only the Introduction required an article update: Python 3.14.8 and
the distinction between the 7 October selective evidence check and 19 September
AI coverage cutoff. Chapter 1, its two examples and four cited notes were unchanged.
The rejected Chapter 2 aside was removed in the original manuscript; Chapter 2
has not been imported into this collection.

The importer applied the reviewed two-piece plan and preserved publication
metadata. Raw extraction ranges, file hashes and article-body baselines were
checked and refreshed in the ignored pilot directory. The scoped quality check
completed with zero technical errors, zero incomplete checks and 29 editorial
review targets; both Python examples passed. The pilot reading pages passed their
navigation, footnote, code and draft-visibility assertions. A full-site authoring
snapshot built 35 pages and verified 197 output files and 1,089 local links.
The changed documentation links and `git diff --check` passed. This was a local
source sync and preview build; no publication or deployment was performed.

## Good Enough opening draft — 7 October 2026

Imported the `good-enough` collection with Part I and the complete
`good-enough-ch01` piece. Both remain drafts with collection/book surfaces.
The chapter's prose round-trips to the canonical source after reversing the
numeric-citation conversion; its two note bodies are preserved. The obsolete
preface excluded by the book's build was not imported. Source extracts, hashes,
the transformation record and baseline profile are kept in the ignored pilot.

The scoped content check completed with zero technical errors, zero incomplete
checks and 20 editorial review targets. These are advisory prose findings, not
rewrites or publication approval. The combined Good Enough/Chronicles authoring
snapshot built 39 pages and verified 204 output files and 1,266 local links,
including private-content sentinels. The new tags are registered as Decision
making and Systems thinking. No source-book files, publication dates or release
output were changed; nothing was committed or deployed.

## Opening book-export inspection — 7 October 2026

Generated private `structure-review-2026-10-07` Markua preview editions from both
current draft collections. Chronicles exports Introduction, Chapter 1 and its
single article in that order. Good Enough exports Part I, Chapter 1 and its single
article. `Book.txt` orders these files; internal article subheadings are nested
beneath the article heading. Both exports currently repeat the chapter title at
the article level. This is a known formatting task before publication, not a
reason to require one article per chapter. No live Leanpub request or manuscript
upload was made, and neither preview is a released edition.

## Split Chapter 2 and continuous book formatting — 7 October 2026

Good Enough now has three draft articles covering Chapters 1 and 2. Reversing
Chapter 2's named citations and image-path rewrite exactly reconstructs its
canonical source body: all seven H2 sections, the four-row table and paragraph
order are preserved. The copied figure matches its source bytes. Source notes
retain identities 1, 3 and 4, including repeated citations across both articles.
The scoped quality check passed with zero technical errors, zero incomplete
checks and 58 advisory editorial targets; these were not automatic prose edits.
The figure is registered in the managed asset manifest; this fixed the isolated
author-server fixture's missing-image error without changing the fixture or
uploading draft assets.

Exporter version 2 resolves the repeated-heading issue recorded above. Both
Chapter 1 placements and the two Chapter 2 placements omit article-level book
headings. Chapter 2 exports as one H1 with the original H2 sections, followed by
one group of three linked source notes. Chapter 1 remains the complete sample.
Regression tests cover repeated references, distinct evidence with equal labels,
notes with local links/images, generated index links, code preservation, part
attributes, sample selection and invalid heading-omission placements.

Validation passed:

- `npm run validate`: 278 tests passed, no failures; Astro/core checks had zero
  errors; the production build verified 190 output files and 919 local links.
- Focused exporter/publishing suite: 20 tests passed; TypeScript check passed.
- Combined draft preview: 42 pages, 210 output files and 1,443 local links.
- Frozen previews `good-enough/split-chapter-final-2026-10-07` and
  `chronicles-of-computation/heading-final-2026-10-07`: edition integrity passed;
  all internal anchors and local resources resolve. The final manuscript files
  match the bytes used for the visual proofs.
- Playwright Chromium at 1280 × 900 and 390 × 844: correct page identity,
  meaningful content, no error overlay or console warnings/errors. Chapter 1 →
  Chapter 2 first article → second article navigation, footnote/return links and
  mobile previous navigation all worked. The table and figure fit the layout.
  Browser plugin was unavailable, so regular Playwright was used.
- Local HTML proofs made from the actual Markua files showed a continuous
  Chapter 2 join, single chapter titles, intact table/figure and working chapter
  source-note links. Chronicles retained both Python code blocks. Screenshots
  and the temporary QA script are outside the repository.

README and the content, authoring, serialization and operations specifications
were updated together. This is local draft preparation: no release date, public
edition, source-book rewrite, remote upload or deployment. The HTML proof is not
a Leanpub renderer. A real Leanpub PDF/EPUB preview and manuscript synchronisation
remain unverified and required before distribution.

## Reading typography correction — 8 October 2026

The reported Good Enough heading rendered as H5 at 18.26px beside 22px prose.
Its inherited collection depth was also retained on the individual reading page.
The renderer now preserves the authored heading level in sanitised metadata;
article and chapter templates rebase only those headings, keeping anchors, code
and footnotes intact. Chapter/part descendant titles use the same prose scale.
H4–H6 have explicit relative sizes and spacing, with stronger weight at H5/H6;
no prose heading falls below the surrounding body size. The reported heading is
now 35px on desktop article pages and 30px on mobile; continuous-reading H5 is
23.98px beside 22px prose.

Validation: 22 focused tests and the full 279-test suite passed. Astro/core checks
and the production build passed; the draft snapshot verified 210 files and 1,443
local links. The regression test covers H5/H6 in continuous output becoming H2/H3
on article pages and H3/H4 on chapter pages, with identical anchors, code and
footnotes.

In-app Browser checks covered 16 routes at 1280×844 and 390×844: both collections,
all imported articles, chapter/part pages, two standalone posts, home, Writing
and Earlier Work. Computed sizes found no undersized prose headings; no page
overflow, missing images or console warnings/errors were found. Visual checks
covered heading spacing/wrapping, table and figure sizing, and scrolling code.
The Browser API was available through computer use, superseding the earlier
assumption that only external Playwright was available. Safari's existing local
preview was refreshed and its accessibility hierarchy inspected; its screenshot
API returned an unusable window thumbnail, so Safari visual parity is not claimed.
The live authoring preview on port 4322 also showed the corrected continuous
heading size. Contents → article → next article → footnote → return navigation
passed with no console warnings/errors. Screenshots of the corrected continuous,
desktop and mobile reading views are outside the repository.

This correction is local and has not been deployed. Book source prose and the
Markua formatting rules are unchanged.

## Shared chapter composition — 8 October 2026

Implemented `integration: body | section` on piece placements. The existing
assembler omits body articles from section numbering; a shared reading plan
controls heading inclusion, contextual levels and contents visibility in HTML
and Markua. Whole-chapter articles no longer repeat the chapter title or its
contents row. Split chapters keep labelled article links without manufacturing
book sections. Genuine section titles are retained, including intentionally equal
parent/section titles. Both books were explicitly migrated. Unspecified placements
and legacy book-only heading settings retain their prior behaviour.

The change preserves the existing source, URL, anchor and citation systems.
Generated web footnote labels now use contextual heading levels, while note
bodies and links remain intact. Chapter-body boundaries do not insert extra
reading links or spacing into the chapter prose.

Verification passed:

- `npm run validate`: 285 tests passed, zero failures; Astro/core checks had zero
  errors/warnings. Production output verified 190 files and 919 local links.
- Focused checks cover whole/split/mixed chapters, equal and different titles,
  reused articles, introductions, multiple parts, appendices, contextual before/
  after placement, draft filtering, planned placeholders, invalid integration,
  legacy compatibility and excessive nesting.
- Combined draft snapshot: 42 pages, 210 files, 1,434 local links. Source-quality
  checks: zero technical errors and zero incomplete checks; 58 advisory editorial
  targets remain unchanged.
- Exporter v3 preview editions `shared-structure-2026-10-08` for both books passed
  integrity verification. Every article hash and manuscript/resource file hash
  matches its previously verified 7 October final edition. This includes original
  prose, headings, figures, code and note content; frozen editions were not altered.
- In-app Browser checks covered 16 routes at 1280×844 and 390×844: no duplicated
  Chapter 1 heading, artificial body-section numbers, undersized prose headings,
  page overflow or console errors. Desktop/mobile screenshots of the corrected
  part → chapter → prose sequence are stored outside the repository.
- Live authoring preview: contents → Chapter 1 → Chapter 2 first article → second
  article → footnote → return all worked. Chapter 1 appears once; Chapter 2 shows
  its two reading-part links and correct article context. Existing URLs/fragments
  remain available.

README, content model, authoring syntax, serialization, operations and the shared
reading-structure document describe the implemented scope. No book-specific
title matching, CSS hiding, new manuscript tree or citation rewrite was added.
Changes remain local and undeployed; live Leanpub PDF/EPUB rendering is still
unverified. Safari visual parity remains outside this run's browser evidence.

## Book completion and continuation notices — 8 October 2026

Implemented optional, validated book-only completion metadata, independent of
publication status. Both imported books and their private staged collection YAML
copies are marked `in-progress`. Contents say **More to come** and the last
available reading page and continuous view say **You’re up to date** /
**This book will continue here.** Completed and unspecified books have distinct
endings; no status is inferred from missing Next. No prose was changed.

Validation:

- All 287 tests passed. New cases cover completion/publication independence,
  invalid and non-book values, unspecified status, empty/planned reading and
  automatic movement to a new piece within the same structural group. The book
  export regression checks that continuation copy never enters Markua prose.
- Astro/core checks passed with zero errors/warnings. Production built 31 pages;
  verification checked 190 files and 919 local links. The draft snapshot built
  42 pages and verified 210 files and 1,434 local links.
- Live in-app browser checks covered both books' contents, continuous endings,
  early and last reading pages and Good Enough's last chapter page. Earlier pages
  retain Next and omit the ending. Notices sit outside `.prose`. Desktop (1280px)
  and mobile (390px) inspection found no horizontal overflow or error overlays.
  Mobile Back to contents worked; standalone Hello, Brave New World has no book
  status or ending. Checked browser logs contained no warnings/errors.
- 129 local document targets resolved, and `git diff --check` passed.

These checks are local. Deployment and live Leanpub rendering were not performed.

## Dependency refresh and cache boundary check — 2026-10-13

Status: implemented and verified locally; not committed or deployed. Existing
book-format and reading-navigation edits were preserved. See
[dependency versions, holds, and security status](dependencies-and-hosting.md).

The root and prototype npm manifests/lockfiles, both Python hash lockfiles, CI
uv version and GitHub Action pins were refreshed. The new KaTeX override replaces
vulnerable npm copies with 0.19.0; Mermaid's prebuilt browser bundle independently
contains patched 0.18.11. TypeScript, Node types, spaCy/model, Thinc and Mando
compatibility constraints are recorded in the dependency guide.

Validation was performed in this order:

1. Inspected Astro's actual remote-image loader and cache-policy methods. Executed
   the reported trigger against installed `http-cache-semantics` 4.3.0: both bare
   `max-stale` and `max-stale=999999` still return a cached Set-Cookie response
   without revalidation even when `maxAge()` is zero. The upstream issue is **not
   verified fixed**, despite the advisory's affected range ending at 4.2.0.
2. `node --test test/astro-cache-boundary.test.mjs` passed all three tests against
   the installed Astro module. Guarded request-evaluation methods were never
   called; public image bytes and their 600-second lifetime were preserved,
   Set-Cookie images received zero reusable lifetime, and conditional 304 responses
   retained the ETag and cached bytes through the `data: null` contract.
3. `npm run verify:ci` passed 25 of 27 checks on an isolated snapshot of the full
   current working tree: 290 JavaScript/TypeScript tests, 16 Python tests, both
   coverage gates, type checks, prototype build, release preparation and packaged
   production build all passed. JavaScript line coverage was 81.85%, branches
   79.15%, and functions 90.54%.
4. The full working-tree lint check reported 11 errors in existing unfinished book
   changes: `core/book-format.ts`, `core/books.ts`, `core/model.ts`,
   `core/reading-structure.ts` and the chapter route. Formatting flagged
   `test/book-format.test.ts`. These unrelated files were not changed by this
   refresh. An isolated index snapshot with only the dependency changes, workflow
   changes and new cache test passed all 18 static checks using
   `node tools/code-analysis/run.mjs static`.
5. Final `npm outdated --json` showed only the two documented root compatibility
   holds; the prototype had no outdated direct packages. `uv pip list --outdated`
   showed only the documented Thinc and Mando transitive constraints.
6. Final root `npm audit` reported 11 affected entries (seven high, four moderate)
   arising from the unpatched Braces and sprintf-js advisories. The prototype
   audit reported zero. These counts do not include the still-reproducible
   cache-policy issue in 4.3.0, so a clean entry for that package is not proof of
   remediation. No alerts were dismissed.

An independent read-only review found no concrete reachable cache bypass or
regression in this change and reran the publishing integration test covering
maths, diagrams, charts, tables, references and edition freezing successfully.
This was a targeted dependency/cache review, not a complete security audit.
The GitHub-hosted workflow and deployment have not been run for this change.

## Article narration — 13 October 2026

Implemented locally: semantic speech extraction and source-bound adaptations;
pinned offline Kokoro/MLX generation; private auditions; managed MP3 publication;
voice, preview and reviewed provider controls; progressive public player; exact
listening durations; publication journal and mandatory staged/build readiness.

Both currently eligible public articles pass the narration gate: the welcome note
is 45.07 seconds (5 spoken segments, 541,772 bytes); the longer article is 1,186.19
seconds (70 segments, 14,235,308 bytes). Known atmospheric illustrations are silent.
There are no currently published collections to backfill. The generation profile
is pinned; byte receipts, decode checks and frame-duration verification pass.
The author approved MLX George by listening. [Numerical and performance results](narration-runtime-comparison.md)
are separate from subjective quality approval.

Tests exercise formatting-only reuse, source/voice/pace changes, decorative versus
informative images, rich-block review, ambiguous selectors, byte corruption,
duration/coverage, draft isolation, stale acceptance, cancellation/restart,
concurrent edits, partial-journal recovery, staged-versus-unstaged prose, canonical
import preservation, and publication waiting for every public title variant.
Browser tests exercise explicit voice auditions, cancellation, source/proposal
comparison and acceptance. DOM playback tests cover measured duration, bounds,
speed, resume identity, exclusive playback and retry. Production verification also
checks rendered players and transcripts, catching dropped Astro schema fields.

Actual in-app browser checks at 390 and 1280 pixels verified the George player,
no initial media loading, playback, ±15-second seeking, speed changes, pause,
transcript and resume after reload. No console warnings/errors were observed.
Local byte-range/HEAD/suffix/416 handling has dedicated tests. Native no-JavaScript
controls are checked in emitted HTML; Safari/iPhone and VoiceOver have not been
manually tested. This is not a complete accessibility audit.

Claude and Codex returned valid live structured explanation proposals from a small
synthetic example. Pi's configured provider hit an output-token limit; no proposal
was applied. Its parser/failure paths are covered but a successful live Pi response
with that service configuration remains unverified. No article text was submitted
in these provider smoke tests.

Production build verification passes for 190 files, 919 local links and 307 legacy
records. The final automated-check result is recorded below. No narration commit,
CDN upload, production deployment or exact deployed-revision verification has been
performed. Those are the remaining stage-7 delivery checks, along with manual
Safari/iPhone/VoiceOver testing. The feature must be described as local until then.

Final isolated `npm run verify:ci`: **28/28 checks passed**, including **309/309
JavaScript/TypeScript/browser tests**, Python checks, type checks, lint/security
checks, production build and narration readiness. JavaScript line coverage is
81.19%; branch and function coverage remain above their enforced thresholds.
The check uses non-ignored source plus identity-verified managed bytes, not private
model caches. Local documentation targets were checked; the only unresolved token
was the existing illustrative `CANONICAL_ARTICLE_URL` in cross-posting examples.

After that full run, the piece-ID CLI selector was tightened to include every
public title variant (falling back to the canonical title for private drafts).
The 14 focused narration tests, including a real CLI invocation over a two-title
fixture, passed; CLI lint, core type checking, cached preparation and the complete
public narration check also passed. No worker/audio profile changed.

A subsequent listening-progress fix preserves the stored position when a reader
visits and leaves without loading audio. All six runtime DOM tests passed with
`node --experimental-test-module-mocks --import tsx --test test/runtime-dom.test.js`,
including the regression and existing restore, pause, completion and hash-isolation
assertions. README and narration behaviour documentation were synchronised; this
small player change has not been deployed.

Playback now defaults to 1.1× with choices of 0.8×, 1×, 1.1×, 1.2×, 1.5× and 2×.
All six runtime DOM tests passed again, checking the initial rate, each selectable
rate and preservation of the selected rate when retry reloads audio. Recordings
and their measured 1× durations are unchanged; this change is local only.

## Narration release candidate — 13 October 2026

An isolated release copy includes narration and the dependency refresh while
excluding the unpublished book changes and newly imported drafts. Its full
`npm run verify:ci` passed all 28 checks, including 297 JavaScript/TypeScript tests,
Python tests, production build and both narration receipts. The preview-watch
fixture now installs its shutdown handler before announcing readiness, eliminating
a race exposed during the first release check. Local documentation links passed.
Upload, deployed-revision and CDN verification follow through `npm run release`.

## Narration production delivery — 13 October 2026

Release `3ab9d303e11781bd36924fc708d0ee97384cbf2d` deployed narration and the
compatible dependency refresh through the standard upload-before-push workflow.
The isolated release passed all 28 CI checks and 297 JavaScript/TypeScript tests;
the staged commit gate and release validation also passed. New unpublished book
work and imported drafts were excluded from the release.

Both public MP3s were uploaded to the existing managed S3/CDN store and verified
against their exact hashes. Live HEAD responses expose the expected byte lengths,
`audio/mpeg` and the established `max-age=0, s-maxage=300, must-revalidate`
cache policy; initial and suffix byte ranges return 206 with
matching bytes. Both public articles render the expected recording hash, six speed
choices, 1.1× default and the label **AI narration** without the voice name.

The live deployment marker matches the release revision. Site checks passed for
pages, resources, RSS, 404 and preserved original-site routes. Public browser
playback, speed changes and resumption after reload were checked. The exact spoken
transcript remains folded inside More listening options; it may contain reviewed
adaptations absent from the article text. Safari/iPhone and VoiceOver remain manual
platform checks; no claim of verification on those platforms is made.

### AWS CLI asset transfer checks

`npm run test:aws-cli` is an explicit native-tool contract test, also run in CI
with the pinned CLI from `core/aws-cli-version.json`. It uses a loopback S3 server
and dummy credentials to check actual conditional requests for small and multipart
uploads, safe existing-key reuse, retained remote objects, quiet transfer output,
JSON service responses/errors and non-zero failure handling. Ordinary unit tests
cover missing/unsupported CLI versions, argument safety, all documented failure
codes, manifest staging and post-transfer verification without requiring the CLI.
The publication gate still verifies S3 identities and CDN bytes; process success
alone never authorises a push. These checks do not constitute a live S3 release.

Local verification on 2026-10-13: 312 ordinary tests passed (the native contract
was skipped in that suite and passed separately with AWS CLI 2.37.12). Observed
CLI results: initial upload and existing-object reuse returned 0 with empty output;
a forced transfer failure returned 1; a service denial returned 254 with JSON
`Code: AccessDenied`. TypeScript, targeted ESLint, Knip, workflow/shell lint and
changed documentation links passed. The Linux installer archive's AWS signature
and pinned checksum were verified on Mac. The pinned Linux installation and actual
CLI contract test subsequently passed in GitHub CI.

Release `d35ea3115be4ab75a7ae90138c17f4c81f84f597` deployed this adapter on
13 October 2026. All 26 commit checks, release validation, Amplify build and both
GitHub workflows passed. Five production transfer batches verified 18 source/output
objects; every CLI invocation returned 0 with empty stdout and stderr. S3 identity
and public CDN byte checks passed before push. Exact-revision live verification
then passed for the website, feed, resource links and missing-page behaviour. The
private local transfer receipt records the per-batch results. Unpublished book
work was excluded from this release.

Release validation also exposed a fixed 100 ms wait in the existing multi-agent
editing test. It now waits for all jobs to finish, with a five-second deadline,
and closes the service even on failure. Production job behaviour is unchanged.

The preview watcher fixture also retries its initial edit until Node's watch
parent observes it, addressing the race between child startup output and parent
watch registration. Restart, syntax-error recovery and shutdown assertions remain.

## Growing audiobook implementation — 13 October 2026

Local implementation now covers semantic book speech, incremental lossless chunk
reuse and full MP3 encoding, the book-page player, stable browser progress,
authoring preparation and atomic publication gates. Model and encoder pins are
unchanged. Existing public articles regenerated with matching durations, timing
maps and sizes, but different byte identities. Decoded-sample comparisons also
differ (RMS difference approximately 0.006 full scale); they are not bit-identical.
Focused tests cover hierarchy/title suppression, draft isolation, partial chapters,
publication gaps, byte/timing verification, unchanged build reuse, editor jobs,
transactional publication, progress after appends/insertions/edits/removals and
player interactions. Cancellation, concurrent edits, private planned gaps and
empty planned chapters have explicit regression tests.

Chromium headless on this Mac passed real MP3 playback, no autoplay, saved position
after reload, chapter seek, speed-adjusted remaining time and HTTP range download.
The 1280 × 900 and 390 × 844 views had no overflow or page errors. The private
book authoring panel showed the approved voice and an up-to-date recording.
The two private draft recordings measured 1,008.905 and 2,114.3 seconds; both
passed complete decoding and timing coverage verification. An unchanged repeat
preparation reused the existing recordings. They remain private, with human
whole-book listening review still required before publication. Safari/iPhone
hardware and VoiceOver are not verified. The release command verifies asset identities and CDN bytes before pushing,
then waits for the exact production build marker and live site checks.

All 26 worktree verification checks passed: 323 JavaScript tests passed, with the
opt-in native AWS CLI contract test skipped in that suite; coverage thresholds,
Python tests, types, lint, architecture, build and narration gates passed.

Both private books passed the same rendered Chromium checks. Independent full
MP3 decoding found no full-scale samples (peaks 0.448 and 0.433). Title and author
metadata were present in both, and the available Chronicles cover was embedded.
The native AWS CLI contract test also passed separately, including conditional
uploads, existing-object reuse and structured failure handling.

Public-scope planning is also tested for a still-draft book: it produces the same
eligible edition as the published container while excluding unpublished pieces.
This supports reviewing the first public edition before publishing the book.
The published-only site preview selects public audiobook receipts; unrelated draft
pieces elsewhere do not switch a book to its private edition.

The first Amplify attempt stalled after the author-server test reported success,
although the same revision passed GitHub CI. That intermediate build was stopped.
The server fixture now explicitly closes its output pipes after shutdown so an
inherited descriptor cannot keep the test worker alive; its assertions are
unchanged, and the targeted integration test passed after this cleanup change.

### Audio-based reading and speed-adjusted listening labels — 13 October 2026

Article listening labels now divide the verified audio duration by the selected
playback speed, initially 1.1×. The homepage estimate uses 1.1×. Original recording
timestamps remain on the seek bar. Following the accepted reading-time decision,
“min read” uses available full 1× audio duration rounded up to whole minutes
(minimum one), falling back to word count at 220 words per minute.
The no-JavaScript player explicitly labels its native 1× duration. The release gate verifies the exact deployed revision before reporting
this adjustment as deployed.

Validation: all seven runtime DOM tests pass, including each supported speed,
unchanged playback position, retry and saved-progress behaviour. Astro and core
TypeScript checks report no errors; targeted ESLint and whitespace checks pass.
Chromium interaction checks at 1280×900 and 390×844 cover actual playback, all six
speed labels, no autoplay, stable paused position, native fallback, page identity,
no framework overlay, no page/console errors and no horizontal overflow. Browser
plugin unavailable; the existing Playwright/Puppeteer installation was used.
Homepage rendering with a narrated lead and physical Safari/iPhone testing were
not exercised in this check; the draft preview currently leads with a book.

The subsequent reading-label change passed all 17 homepage and runtime DOM tests,
including rounding boundaries, invalid/missing audio fallback and collection
placement audio. Type checks and targeted ESLint passed again. Browser checks on
“Clever Enough to Find the Loophole” confirm 20 min read from 1186.19 seconds at 1×,
17:58 listen at 1.1×, and 9:53 listen at 2× without changing the reading label.
Desktop and mobile checks found no overflow or page errors.

The first hosted attempt for the duration labels exceeded the test runner's
ten-minute limit in the narration authoring browser fixture. Local runs also
showed intermittent UI timeouts. The fixture now closes the browser before its
HTTP server, force-closing remaining connections, so polling cannot hold server
shutdown ahead of browser cleanup. All test files still run, with concurrency
capped at four to reduce browser/build contention. The release remains gated on
the complete suite and exact-revision deployment verification.

### Automatic commit-time narration — 13 October 2026

The native hook now prepares missing/stale public narration and audiobooks from
the exact staged content and automatically stages generated metadata. Seven
focused tests cover partial staging, unrelated files, unstaged metadata conflicts,
concurrent staging, unexpected source changes, synthesis failures, index locks,
current-audio reuse, CI bypass, alternate indexes and macOS path aliases. A real
native path-limited commit is rejected before synthesis because Git retains a
second index that would otherwise miss the hook's additions.

In a disposable checkout, the installed Kokoro/MLX runtime regenerated the welcome
article after a staged sentence change while a different later edit remained
unstaged. The resulting transcript matched the staged sentence, the generated
metadata was staged automatically, and a repeated readiness check reused the
recording. Preparation and the repeat check took 28.6 seconds on this Mac.
A separate ordinary native Git commit passed with actual synthesis and narration
validation; its commit contained the article and generated metadata, excluded an
unrelated file, and left no metadata/index mismatch. No fixture commit or audio
was promoted to the working repository. Existing content and draft asset-manifest
hashes remained unchanged. README and the affected workflow/specification docs
were updated. This is a local hook change, not a website deployment.

The final isolated staged-snapshot verification passed all 26 checks: 332
JavaScript tests passed, with the opt-in AWS CLI contract test skipped; Python
tests, coverage gates, types, lint, architecture and narration readiness passed.
All 187 checked local documentation links resolve, and `git diff --check` passes.

### Shared voice playback controls — 14 October 2026

Implemented and tested locally; not committed or deployed. Article and book
players share SVG play/pause symbols, visible action labels, accessible names,
keyboard activation, focus styling and playback state handling with private
article/book auditions. The public markup component and private preview adapter
use the same browser control module and stylesheet. Native fallback remains
available, and public saved-progress identities are unchanged.

All 26 isolated repository checks passed, including 333 passing JavaScript tests
and one skipped opt-in AWS CLI test. The eight runtime DOM tests cover symbol and
label state, pause/resume, completion, shared-media exclusivity, preview visibility,
seeking, speed, error/retry and source reset. The author-server test verifies the
new shared module/style routes. Types, lint, architecture and coverage passed.

Browser plugin not available; the installed Playwright and Chromium were used.
At `http://127.0.0.1:4342`, the welcome article and Chronicles book page passed
actual playback, Enter-to-play, Space-to-pause, retained position, reload without
autoplay, and icon/accessible-name checks. Article and book authoring preview
controls were exercised with an existing MP3 injected into browser state; no new
synthesis or content save was required. Desktop 1280×900 and mobile 390×844 checks
confirmed page identity, meaningful content, no framework overlay, no console/page
errors, no horizontal overflow and minimum 44-pixel playback targets. Screenshots
were inspected. Native article controls remain usable with JavaScript disabled.
Physical Safari/iPhone and screen-reader testing remain unverified. Existing
content and draft asset-manifest hashes were unchanged.

## Python controls and listening boundaries — 16 October 2026

Implemented for this release. Every Python web fence receives the same editable
Run/Step/Restore original/Copy control; the optional sidecar still validates
custom titles against source hashes. Static book exports retain the source.
Clipboard success and denial, duplicate fences with unique labels, source restore,
line highlighting, two independent runners and web/book fallbacks have automated
coverage. The second Chronicles example now runs without a special sidecar.

The canonical manuscript's 117 standalone examples and 16 inline examples executed
successfully under Python 3.14.8 and 3.15.0. Both strict example audits and all 16
concept/audit tests passed; the actual Python tracing helper's three tests also
passed under both interpreters. The required British English check reported zero
review targets. Book prose, its README and the imported introduction now name
Python 3.14 and 3.15 without patch versions. This does not upgrade Pyodide.

The full JavaScript suite passed 351 tests with one optional AWS test skipped.
Focused tests verify full-book resume, excerpt timing/seek bounds, end/replay,
per-placement progress, and preserved whole-book progress. Build verification
checks scoped chapter players, no duplicate audio chapter list, and reading links
in the book contents. Narration freshness was renewed for the changed private
introduction with Kokoro MLX (60 chunks reused); draft status was preserved.

Real Chromium browser checks in the local snapshot executed both opening examples
(expected ten notches and three True comparisons), copied edited source, restored
it, and stepped with the current line highlighted. Chapter audio played at its
book offset, stopped at its end, replayed from the chapter start and offered
Continue after reload. A 390-pixel mobile viewport showed no horizontal overflow.
All 26 staged-snapshot commit checks passed, including coverage, types, lint,
architecture, formatting and narration freshness. The private preview build
verified 42 pages, 218 output files and 1,466 local links. Deployment still uses
the exact-revision live verification gate; private book routes remain excluded.

## Chapter 1 example refinement — 16 October 2026

The canonical Chapter 1 and article now contain one tally example. Their bodies
match after expanding the canonical code include and normalising citation syntax.
The historical-interpretation paragraph is unchanged. The removed example has no
remaining manuscript include or example-index entry, and its narration adaptation
was removed.

All 116 remaining standalone examples pass on both Python 3.14 and 3.15. Strict
example coverage/import/index audit has no findings, all four include tests pass,
and the required British English check reports no review targets. The refreshed
article narration is 539.2 seconds; the complete preview audiobook is 952.84
seconds and reuses 58 speech chunks. Its transcript excludes the removed example
and retains the interpretation paragraph. In-app Chromium verified one code
editor, Run producing ten marks, Restore original, actual chapter audio playback
and the revised Ishango layout, with no console errors. The preview build verifies
220 files and 1,496 local links. Release checks confirm deployment separately;
draft publication flags are preserved. The pilot preview assertion now requires
one code listing and still checks all four citation references.

The initial full gate exposed a stale two-example assertion, corrected to one.
Several later attempts timed out during unrelated checks after unusually long
wall-clock pauses. The resumed run passed all 26 checks, including 359 JavaScript
tests with one opt-in AWS test skipped. Commit `3fe4f71` contains the Chapter 1
removal. Release status is established by the workflow and exact live revision
check; private book routes must remain unavailable.

The subsequent [whole-book example review](code-example-editorial-review.md)
contains 131 individual recommendations: 115 remaining narrative files and all
16 appendix snippets. Inventory coverage, unique identities and source links were
checked; code and context hashes record the reviewed version. Recommendations
are not implementations or newly tested replacements. No remaining example was
edited during this review, and the British English check found no review targets.

The follow-up dependency check covers all 132 current samples, including the
retained Chapter 1 tally and 16 inline appendix snippets: every import is from the
standard library. All 116 standalone examples also execute successfully on Python
3.14 and 3.15 with `-I -S` (isolated mode and no site-package initialisation), from
outside the source tree. This confirms that installed third-party packages are
not needed; it does not certify every standard-library feature in the browser.
The existing strict example audit rejects non-standard-library imports in included
files. The broader inline-snippet check was performed for this review.

## Static search and reading index — 23 October 2026

Phase 1 of the [agent tools plan](agent-and-browser-ai-plan.md), implemented and
tested locally; not deployed.

- `npm run build` indexed 3 pages (two published articles and About; the books
  are drafts and absent from production builds) and `verify-build.ts` passed its
  new search checks. A build with `NOTES_BASE_PATH=/preview/` rewrote the form
  action, Pagefind URL and base, and result links resolved under `/preview/`.
- Chrome 156 (Playwright): `?q=` results with highlighted excerpts, a typed
  search updating the URL, a no-results message, `/` from another page opening
  search with the field focused. With `--enable-features=WebMCPTesting`,
  `getTools()` listed `search_writing` with the inferred `{ q }` schema and
  `executeTool` returned structured results (absolute URL, context, plain-text
  excerpt) without navigating. Without `toolautosubmit` the call waited for the
  reader to press Search, so the attribute was added.
- WebKit 27.2 (Playwright): the same reader flow passed.
- Chrome with JavaScript disabled: the masthead link and form reached
  `/search/?q=agents` and the page explained that search needs JavaScript.
- Firefox: not verified. Playwright's Firefox build and the installed Firefox
  through Puppeteer both failed to launch on this machine. Manual check pending:
  open `/search/?q=agents` in Firefox and confirm results appear.
- Desktop (1280 px) and phone (390 px) screenshots checked: the masthead gains a
  Search link that wraps with the existing navigation.
- Full gate: 26/26 checks; 363 JavaScript tests passed, 1 opt-in AWS test
  skipped. New unit tests cover the reading index and the search runtime (stale
  queries, errors, reader rendering and the WebMCP `respondWith` path); the
  existing enhancement test covers the `/` shortcut.
- Two existing release tests first failed because they build through
  `package-site.ts` directly; indexing now runs inside that step. A fixture book
  with an empty introduction was skipped by Pagefind, so a book without an
  introduction indexes its summary instead.

## Agent tools and WebMCP — 23 October 2026

Phase 2 of the [agent tools plan](agent-and-browser-ai-plan.md), implemented and
tested locally; not deployed.

- Chrome 156 with `--enable-features=WebMCPTesting`, authoring preview, book page
  `/collections/chronicles-of-computation/read/early-records/`: 13 tools listed.
  Through `executeTool`, the outline returned the page's sections; section text
  was readable; `go_to_section` focused the heading at the top of the viewport and
  showed “An AI agent moved to …” with Undo; `run_code_example` ran the tally in
  real Pyodide in 1.6 seconds and returned its output; running edited code printed
  `10` and left the edit visible; step and restore matched the buttons; an unknown
  id and an external URL returned explanatory errors; `list_writing`,
  `get_book_contents` and `search_writing` returned absolute same-site URLs.
- `/agents/`: the switch removed all tools (7 → 0), stayed off after reload and
  restored them.
- Unit and DOM tests (linkedom) cover validation, result caps, every tool, feedback
  and Undo, the WebMCP adapter with a fake `modelContext`, the device switch and
  the Python controller's awaitable run, edit, step, restore and error paths.
- Narration tools were tested with a fake player only; real playback started by
  an agent depends on the browser's autoplay policy and reports a clear error
  when blocked.

## Model runtimes and reading assistant — 23 October 2026

Phases 3 and 4 of the [agent tools plan](agent-and-browser-ai-plan.md).

- Chrome 156 on an Apple M1 Pro, production build served locally: the panel found
  no built-in model (automation never enables it), offered the Gemma 4 E2B
  download with its size and source, downloaded 2,008,432,640 bytes from Hugging
  Face into the Cache API in 128 seconds and started the model; later visits were
  ready in 3 seconds from the cache.
- First real questions failed: the model chose site search, and every turn after a
  tool result failed with LiteRT-LM's “Invalid token at state …”. A direct probe of
  four tool-result shapes showed the failure only with constrained decoding on,
  so agent chats run without it; site search was replaced by `find_in_page`.
- `npm run assistant:eval`: the introduction section first swallowed the whole
  article (its prose is wrapped in one `section`), then the model marked declining
  answers as found. After scoping the introduction and treating declining text as
  not found, the run gave 8/8 answerable questions with the gold section cited and
  3/3 unanswerable questions declined, median 4.8 seconds, across both published
  articles.
- Accessibility (keyboard and layout): Tab reached “Ask about this page”, Enter
  opened the panel with focus on its heading, Escape closed it and returned focus
  with `aria-expanded` reset; at 390 px the bottom sheet showed the answer with no
  horizontal scrolling; a 640 × 450 viewport (200% zoom) did not overflow; answers
  were announced through the status region. No screen-reader session was run.
- Not verified: the Prompt API path with a real built-in model (automation cannot
  enable it; manual check on an everyday Chrome pending), Safari and Firefox
  WebGPU with LiteRT-LM, and Edge.
- Unit and DOM tests cover the adapters with fakes, the loop (citation filtering,
  declines, tool limit, unknown tools, errors, abort) and the panel (ladder,
  disclosure, progress, cancel, answers, errors, clear, Escape).

## Production release of search, agent tools and the assistant — 23 October 2026

- `npm run release` first stopped in validation: two authoring-preview tests needed
  draft audiobook MP3s that the local orphan cleanup had moved to
  `.authoring-state/image-trash/` during an authoring-preview run. Copying them back
  into `.asset-cache` (SHA-256 verified) let validation pass; nothing had been
  pushed. Releases `c95d398` and, after the dependency refresh, `61af1ef` were
  released and verified on https://www.danilop.net/.
- Live checks in Chrome 156 (WebMCP flag): `/search/?q=FelonyBench` returned the
  article; `/reading-index.json` listed both published articles; `/agents/` listed
  14 tools and the footer links to it; an article page registered 9 tools and
  `find_in_page` found the right section; no origin-trial meta tag is emitted.
- The first live assistant run downloaded Gemma 4 E2B from Hugging Face on the
  production origin (ready after 140 seconds) but could not submit: the analytics
  consent banner covered the panel's Ask button. The open panel now stacks above
  the banner and moves it aside on wide screens. After release `61af1ef`, the
  assistant started from cache in 3 seconds and answered “What is FelonyBench?”
  from “A rather awkward sort of leaderboard”, citing that section.
- Dependency refresh: `npm audit` reports no vulnerabilities; the Python locks pin
  `certifi` 2026.10.23, above the 2026.10.19 fix for the three Dependabot alerts
  (awaiting GitHub's rescan). The full gate passed; one long author-server test
  failed once under `npm run validate` load and passed alone and in the gate.
