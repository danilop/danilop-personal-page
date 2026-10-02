# Local authoring

Status: implemented locally on 2026-09-24. The editor is not deployed. It writes
existing source files; saving never commits, pushes, deploys or activates links.

## Start and edit

```sh
npm run preview
```

Browse `http://127.0.0.1:4322/` and follow **Edit** on an article or book.
The direct editor URL `http://127.0.0.1:4322/_author/` is an optional shortcut
to the content list and settings; no separate author link or launch is needed.
`./preview.sh` opens the homepage automatically after its first successful build
and watches application code. Use `./preview.sh --no-open` to suppress opening,
or `npm run preview -- --open` to open without code watching. Use `--port 4325`
with the wrapper (or after `--` with npm) if needed. Stop with Ctrl+C.
This is the single everyday command for browsing and editing. The separate
`author` and `preview:authoring` npm commands have been removed. `--release` serves
the existing production build; `--snapshot` creates an advanced read-only snapshot.
All modes default to port 4322; stop the current mode before starting another.

The local site banner offers **Preview content: Show drafts / Published only**.
Switching rebuilds the site, then returns to the homepage with the appropriate
featured article, listings and publication order. Drafts are excluded during the
build, not merely hidden on screen. The editor remains available. The choice is
shared by tabs connected to this server, applies to subsequent saved changes, and
resets to **Show drafts** when the server restarts. Source publication flags and
the release `dist/` are unchanged. A failed rebuild keeps the last successful view.

Browse the full site and use the quiet **Edit** link beneath an article or book
heading. Draft and published pages use the identical link; Draft badges remain
status labels. Edit opens that exact source in the editor, retaining its book
context. **View on site** opens the saved page in a new tab so unsaved editor
changes remain undisturbed. Save first to see those changes on the full site.
These links are injected by the local author server only; they are absent from
static preview builds and production/Amplify artifacts.

You can also choose an article, book/collection or setting from the grouped content list.
Articles open in **Article text**, with metadata outside the writing area.
**Full source** exposes the complete Markdown header for advanced editing.
Post details provides title, multiline summary, tags with reuse suggestions and
saved usage counts, and Draft controls. Details update the same unsaved working
document automatically; **Save** (Command/Ctrl+S) writes it. Undo covers both
prose and details. A draft/eligibility label remains visible beside the save state.
Removing Draft makes content eligible for deployment, not already deployed.
The full metadata header is available for dates, publication surfaces and other
fields. Unknown metadata is retained. IDs cannot be changed through the editor.

The file list includes existing piece manuscripts, collection outlines, the tag
registry, `publishing/home.yaml` and `publishing/links.yaml`. Collection order
and homepage selection use YAML editing. The **Short links** panel provides
local alias reservations, deactivation, verified S3 publication and live checks.
Creating/importing pieces and automatic alias allocation still use the existing
file/command workflows. The Images panel can import local images; tag reuse
suggestions are available in Post details. Short-link infrastructure is active;
this editor does not provision it. Reserve a code, commit/push saved content and
reservations, wait for Amplify, then use **Publish saved redirects** and **Check live
links**. Publishing reconciles the full saved registry; drafts stay inactive. See
[short-link operations](short-link-design.md#local-configuration-and-commands).

## Review repetitions together

Run **Writing checks**, expand **All repeated stem sequences**, and select
**Review all repetitions in this article**. Pick Claude Code, Codex or Pi (or
compare several), then **Review repetitions**. The agent receives the full current
article and repetition list, with distance and context, and is asked to preserve
useful terminology and deliberate echoes. Review and select proposed edits before
**Apply to editor**; Save remains separate. See [editorial review](editorial-review.md#review-all-repetitions).

## Unpublish and delete

In **Post details**, **Unpublish to draft** preserves the article's source, ID,
slug, publication dates, media, collection placements, and reserved short links.
Save unsaved edits first. Confirming writes `draft: true` locally and records a
saved version. Republishing uses the existing Draft control and Save; retain the
original `publishedAt`. For a new article, clearing Draft and saving assigns the
current UTC publication time atomically with the source. Toggling without saving
or previewing does not assign one. Commit and push to `main` for Amplify delivery.
See [publication timestamps](publication-time.md).

**Delete draft…** is available only for a saved draft. Published and retired
pieces are rejected by the server as well as the UI; return them to draft first
(retired pieces use the Draft control). The confirmation lists owned source and
asset files, aliases, placements, distribution assignments and changed settings.
Deletion removes the piece directory, its placements in every collection,
homepage lead/new-in entries, distribution assignments and active alias records.
It leaves empty structural groups in place: book organization is editorial
content, not a disposable article dependency. Move nested content out of an
article placement before deletion. Other articles' semantic references, known
article/placement/short-link URLs, and `adaptedFrom` provenance block deletion
until reviewed; authored prose is never silently rewritten.

Shared tags, bibliography, shared/cloud media, immutable editions, external copies,
and historical delivery/review/image records remain. A local recovery copy is
retained under ignored `.authoring-state/trash/`; this is recoverable deletion,
not secure erasure. The deleted file's browser recovery entry is cleared.
Deletion checks source/dependency revisions again after confirmation and shares
the save lock. Recoverable write failures restore changed dependencies.

Neither action removes an already deployed page immediately. Deploy the source
change, then run the short-link publisher for that exact deployment. Unpublished
aliases are deactivated but reserved; deleted aliases receive removal tombstones
and cannot be reused. Old URLs return 404 once the corresponding site/link
changes propagate. Review incoming links before deployment; do not silently
redirect an unrelated article. External copies must be managed separately.

Accepted next iteration: rename **Delete draft…** to **Move to Trash…**, add a
private Trash view, restore as draft with dependency conflict review, and a
separate **Delete permanently** action. There will be no automatic expiration.
These controls are planned; current recovery is manual. The
[technical plan](social-publishing-plan.md) also covers the shared assistant
configuration, private social composer and extensions to Short links management. Reader-facing
sharing uses ordinary platform links/copy actions and never calls an assistant.

## Preview and checks

Preview defaults to the article, with **Full page** and **Jump to heading** controls.
At narrow widths, Write, Preview, Review and Images switch workspace panes instead
of stacking them.

Typing triggers a debounced render of the piece using the shared publication
parser and renderer. Select a collection context to assemble its references,
numbering and citations. The rendered piece is placed in the existing site page
when its template is available. While the first site build is running, a basic
content preview is explicitly labelled. Interactive scripts are disabled in the
embedded content preview; use the full-site window for interactive behavior.

The prose preview is fast; surrounding navigation, tag labels, reading time and
other metadata reflect the last successful full-site build. Invalid edits keep
the last valid preview with an explicit out-of-date message. Configuration edits
validate on preview and refresh the full site after Save. Full publication checks
can still find cross-file or delivery issues beyond immediate editor validation.

Saved changes and external changes under content, publishing, site, themes and
site-assets trigger a coalesced background build. Open full-site pages reload
when it finishes. The last successful site stays available if a build fails;
check the full-site status in the editor. This first implementation rebuilds the
whole site after saves; dependency-based incremental preparation remains future
work. NLP, example execution and release validation do not run while typing.

Before publication, run:

```sh
npm run prepublish:check
```

Removing Draft makes a piece eligible only on its declared publication surfaces.
A collection has its own Draft flag. Review the release output and deploy through
the existing GitHub workflow. The editor reports local state, not verified live
deployment state.

## Undo, redo and recovery

Undo/Redo buttons and Command/Ctrl+Z / Command/Ctrl+Shift+Z act on the current
file's editing session. Saving does not clear that history. Ctrl+Y also redoes.
Switching files resets the session undo stack; unsaved text remains recoverable.
Unsaved text is stored in browser local storage for this origin and file. Reloading
recovers it. Keep the same port/browser profile for that recovery; clearing browser
storage deletes it. A browser storage error is not a successful backup.

Every changed save preserves the prior and new text under ignored
`.authoring-state/history/`. **Saved versions** lets you inspect a snapshot and
load it into the editor. Press Save to restore it as a new revision. Later versions
remain available. Disk history survives server restarts and is separate from Git;
it is not an off-device backup. Revisions have no automatic retention limit yet.
[Automatic image cleanup](image-authoring-workflow.md#automatic-cleanup) preserves
assets needed by these versions and recoverable unsaved edits. Browser recovery
image names are mirrored in ignored local state, separately from the prose kept
in browser storage. Undo-only protections are refreshed while a tab is open and
expire after a day without contact; closed tabs cannot restore their old Undo stack.
Saving waits for image protection to be backed up. Unused managed images receive
a seven-day grace period and 30 days in recoverable image trash before deletion.

If a file changes externally, saves based on the old revision are rejected.
**Reload file** loads disk content into the undo history so you can compare and
reapply your changes. Saves use a local exclusive lock and atomic file replacement.
This is single-author local tooling, not collaborative editing; external tools do
not honor its lock. Draft deletion is a guarded multi-file operation; ordinary
editing still saves one document at a time.

If the process crashes during a save, stop all authoring processes before removing
`.authoring-state/write.lock`. Inspect the source and saved versions before retrying. For interrupted deletions,
inspect the newest `.authoring-state/trash/<id>/manifest.json`: it records original
and replacement dependency text and the original piece path. If `piece/` exists,
move it back to that path to recover the source and assets. Restore dependency
`before` text only after comparing with the current file, so later edits are not
overwritten. The `complete` marker means local deletion finished. Remove the lock
only after reconciling source and settings. There is no one-click trash restore
or automatic purge yet; Git and these local snapshots are separate recovery paths.

## Local-only boundary

The server binds to `127.0.0.1`, checks its Host and write-request Origin, requires
a per-process API token, and permits editing only listed files. Do not expose it
through a public tunnel. Generated previews are under ignored
`exports/author-live/`; source history and editor services are absent from release
output. See [the design review](local-authoring-proposal.md) for remaining scope.

## Writing review

The **Review** view integrates [Writing checks and Editorial review](editorial-review.md).
Run local NLP/stem checks or explicitly send a snapshot to an installed Claude Code,
Codex or Pi CLI. Results have source locations and stale-state indicators; they never
apply edits. Reviews include unsaved text and can cover the current collection.
Both review types have a visible **Run … again** button beside the results. Reloading
the file keeps rerunning available; a lost status request releases the controls
with an error instead of leaving the editor stuck in a running state. Editorial
reruns require an explicit click and use the selected agent's allowance.

If the local server restarts, the open editor refreshes its session automatically
and retries the interrupted request once, preserving the editor text. Unreadable
server responses show a recovery message instead of a JSON parsing error. After
updating the editor software itself, reload the page to load the new interface;
unsaved text is retained in this browser.

## Workspace layout

The local editor uses a two-column workspace: **Write** on the left and
**Preview / Review** on the right. Content selection, undo/redo, saved versions,
reload and local Save stay above the workspace. **Post details** expands only
when needed. The selected piece displays its title once its metadata loads;
configuration files retain their paths. Small screens stack the writing and
companion panes. Review tools use separate sections, with advanced model/prompt
settings collapsed. Existing source editing, explicit saving and recovery remain
unchanged; this is not a rich-text editor.

## Article illustrations and collection covers

The **Images** view provides **Suggest brief** (installed Claude Code, Codex or Pi),
**Generate image** (Codex signed in with ChatGPT), and explicit candidate insertion.
It uses the blog's shared ink illustration style. API keys are not used. Candidates
survive restarts with their generated descriptions. Selecting a generated candidate
fills **Image description (alt text)** automatically; review or edit it before
inserting. Manual edits are retained per candidate during the editor session.
Imported images require a description entered manually. Choose **Beginning of
article** (after the title and summary, before the body) or **End of article**.
Insertion participates in editor undo/redo. See
[image authoring](image-authoring-workflow.md) for setup, storage and limits.

For a book or collection, open its YAML file and use **Images**. The same helper
suggests a brief for the whole work, defaults to portrait, and generates or imports
candidates. **Use as cover** assigns the selected image and description to the
unsaved collection. **Remove cover** clears the assignment. Save applies either
change; Undo restores the previous text. The cover appears on its overview and
when featured on the homepage, independently of chapter images and reading order.

Finding links select the exact source phrase or word when the checker supplies a
range, including each repeated stem occurrence on the same line. Sentence-level
findings select their sentence; spelling and stock-phrase findings select only
the relevant word or phrase. If an exact range or quotation cannot be matched,
the editor places a caret at the reported line and explains the limitation; it
does not highlight an unrelated full line. Stale findings remain non-navigable.

## Finding-specific fixes

Verified editorial replacements offer **Review edit**; older advice offers
**Draft an edit**, and missing information offers **Answer question**. Other findings offer
**Suggest a fix**. For a new proposal, check one or more installed agents to
compare independent proposals using the same source and customizable instructions.
Named proposal buttons preserve edited replacements while comparing. Apply only
the selected proposal to unsaved text, with one undo step. Before Apply, a compact
**Writing check** compares the suggestion with the original. Changes to a proposal
refresh the check; expand details to review new findings or unavailable coverage.
**Recheck writing** also explicitly reruns local checks. Each selected provider uses its own allowance.
Generated fixes are validated before display. Invalid response structure or source
anchors trigger one automatic retry with the same provider/model and validation
feedback; that retry also uses its allowance. A second invalid response fails
without displaying or applying a proposal. This checks format and source matching,
not factual accuracy. Valid no-change responses are not retried.
For batch repetitions, **Small changes per passage** requests all worthwhile fixes
together, each kept small. The response must assess every affected paragraph.
Batch instructions and their Reset default are separate from single-finding settings.
The only other batch approach is **Rephrase where useful**, for broader sentence
changes. Both assess the complete list; **Assess first** remains a single-finding option.
See [finding fixes](finding-fixes-design.md) for scope and session limits.

Writing checks and Editorial review retain separate session results per file.
Results group findings by rule, with tags/metadata separated, named passage links,
Previous/Next finding, **Mark as addressed** for fixes in your own words, and
**Keep as written** for intentional retention. Both decisions are scoped to the
current report/session and can be reopened from collapsed sections. Use **Edit
myself** in a finding detail to jump back to the source; after editing, Mark as
addressed remains available even if the report is stale. Exact
selection scrolling accounts for wrapped lines. Applied proposals show
**Applied · unsaved**, offer **Undo change**, and reuse their checked results.
Saved versions show a change preview before restoration; full version source is
optional and empty histories omit unused controls.

Editorial review requests concrete edits in the same response as its findings.
Inspect a verified replacement and its automated checks through **Review edit**;
no second agent call is needed. Only missing information or author intent should
produce a specific question. **Answer question** requires an answer before drafting.
Older free-text advice uses **Draft an edit**; selecting a passage never makes that
advice directly applicable. Only explicit original/replacement pairs enable Apply.
See [finding fixes](finding-fixes-design.md#reuse-an-editorial-suggestion).

Editing one passage does not disable other finding links: exact, unambiguous
quotations remain clickable at their updated positions. Only missing/ambiguous
locations are disabled. Review coverage and generated suggestions remain marked
out of date until rerun.
