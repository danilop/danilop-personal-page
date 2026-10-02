# Danilo Poccia

_Notes Along the Way_

Articles, experiments, and ideas that will grow over time.

[Website](https://www.danilop.net) · [Publishing](docs/publishing-workflow.md) · [Design](docs/product-design.md) · [Operations](docs/operations.md)

## One article. Many ways to read it.

Write in Markdown. Publish an article on its own, place it in a collection, or
make it a section of a growing book. Collections can gain chapters, introductions,
appendices, and other book material without duplicating the original writing.

The Ink & Paper theme puts reading first: a name-first masthead, blue ink,
serif headlines, and generous space. Fonts, colors, images, CSS, and templates
live apart from the content and publishing system.
The configurable SVG favicon generates browser and iPhone home-screen icons;
see [branding assets](docs/authoring-format.md#browser-icons).

- **Rich explanations:** source code, CSV tables and charts, Mermaid and D2
  diagrams, equations, citations, figures, audio, and video.
- **Interactive examples:** registered JavaScript/WASM simulations and replaceable
  browser model runtimes, with explicit activation and static book alternatives.
- **Portable publishing:** frozen Markua manuscripts, a Leanpub adapter, DEV
  synchronization, and an assisted Medium workflow. Exported full articles and
  excerpts open with a direct link to the original article.
- **Durable links:** reviewed aliases for new work at `danilop.link`, activated
  only after the canonical publication is live.
- **Earlier Work:** the historical catalogue in the new design. **The Original
  Site** preserves the old look, with a return link to the current website. **Elsewhere** is reserved for external writing
  published after relaunch. Empty sections stay hidden.

Public PDFs and published Google Docs/Slides load on reader request. iCloud
Photos albums use public album links; photographs are not copied into this repo.
The About page presents social profiles in a separate row below the biography,
with local icons and visible platform names configured in `publishing/site.yaml`.

## Release status

The new site is live at the main URL, with the historical catalogue at
`/archive/` and the preserved snapshot at `/original-site/`. Temporary `/new/`
links redirect to their root equivalents. See [verification](docs/verification.md)
for release evidence.

Third-party publication is manual: assignments prepare exports; commits and tags
never send or update external posts. No articles are enrolled. The DEV key is
not consumed by website builds or GitHub workflows. See
[credentials and access](docs/credentials-and-access.md) before first delivery.
Short-link infrastructure is active with private S3, OAC, one CloudFront Function
and the Free flat-rate plan. The local editor has **Short links** controls for
reservations, verified activation and live checks. Article aliases require a
committed registry and verified deployment; see the
[design and operating instructions](docs/short-link-design.md).
The local editor suggests new short codes from distinctive saved-title words,
avoiding existing, removed and system codes. Suggestions stay editable; remote
ownership is checked on reservation. No code is reserved merely by opening the
panel, and existing aliases are preserved.
Article illustrations can be generated explicitly in the local editor through a
ChatGPT-signed-in Codex CLI. Search and a site-wide AI assistant remain future work.

## Develop

Use the pinned Node.js 24.21.0 LTS and npm 12.2.0. Dependencies were refreshed on
1 October 2026; [compatibility exceptions and the transitive security override](docs/dependencies-and-hosting.md)
are documented. With nvm installed:

```sh
nvm install --skip-default-packages
nvm use
npm install --global npm@12.2.0
npm ci
npm --prefix prototypes/ink-and-paper ci
npm run dev
```

If another application changes which Node your shell selects, see
[Node selection troubleshooting](docs/authoring-preview.md#node-selection-troubleshooting).

For a production build and preview:

```sh
npm run validate
npm run preview -- --release
```

To review the full site with selected drafts at `/`, use the
[authoring preview](docs/authoring-preview.md):

```sh
npm run preview
```

Open `http://127.0.0.1:4322/`. The site uses production templates and normal URLs,
with draft notices and quiet Edit links. Follow Edit to reach the editor; `/_author/`
is an optional direct shortcut, not a separate launch step. Saved changes
refresh the site automatically. Saving writes local sources but does not deploy.
Run writing checks from Review when needed; startup does not run NLP.
In the repetition list, **Review all repetitions in this article** sends the complete
current-article list and text to selected Claude Code, Codex or Pi agents. The review
considers distance and context, keeps useful repetition, and proposes edits for
your approval. **Small changes per passage** means small edits to every worthwhile
case, returned together. Batch reviews must assess every affected paragraph;
their saved instructions are separate from single-finding preferences.
**Rephrase where useful** permits broader sentence changes with the same complete
review scope. Batch review offers only these two approaches.
Fix proposals are validated before display; invalid output gets one
automatic retry with validation feedback, using the same selected agent and model.
Apply updates the editor; Save remains explicit.
For application development, run `./preview.sh` (equivalent to
`npm run preview -- --watch --open`). It opens the homepage in your default browser
once the first build succeeds; restarts do not open extra tabs. Use
`./preview.sh --no-open` to keep the browser closed. The script selects the pinned Node version through
nvm when needed and can be launched by its path from any directory. It also restarts
the editor server when its entrypoint or imported code changes. Leave it running;
there is no need to repeat `nvm use` between edits. Reading pages reconnect and
refresh after restarts. Refresh the editor tab manually to load changed browser
scripts; it is not forcibly reloaded while you work. Server-side jobs and review
sessions restart with the server, so avoid code changes during an active AI job.
`npm run preview -- --release` serves the existing release build without the editor.
Use `--snapshot` only for a read-only, filtered or external-source snapshot.

Output goes to `dist/`. Ordinary article reading needs no JavaScript. Model
weights are downloaded only when a reader explicitly starts a model experiment.

## Publish

Follow the [publishing workflow](docs/publishing-workflow.md) from draft to release:

1. Import once, or create/edit the Markdown article and media under `content/`.
   Keep `draft: true` while it is being written.
2. Run `npm run preview` to browse, edit and review the full site, including drafts.
   When approved, clear Draft and Save in the editor, or run
   `npm run article:publish -- <piece-id>`. The local save sets `publishedAt` once;
   standalone articles also require a slug. Enable the collection separately if
   needed. Run
   `npm run prepublish:check` and `npm run preview -- --release` before pushing.
3. Run `npm run assets:prepare`, review and commit the manifest with the source,
   then run `npm run release` on `main`. It uploads and verifies assets before
   pushing the exact commit and waiting for the production deployment.
4. Optionally review and manually deliver an explicitly selected external copy.

`draft: true` excludes content from the website build. This GitHub repository is
public, so committed and pushed draft source remains readable on GitHub. Keep
confidential writing in an external local library until it can be shared.

For reviewed content in a separate local library, use the
[content importer](docs/content-import.md). It defaults to a dry run; a collection
selection includes its referenced pieces and leaves unrelated preview snapshots out:

```sh
npm run content:import -- --from exports/chronicles-pilot/content \
  --collection chronicles-of-computation
```

Review the file list, then repeat with `--apply` to copy new content as drafts.
Use repeatable piece/collection selectors or explicit `--all`, with exclusions as
needed. Changed existing content requires `--update`; publication settings are
preserved. Importing never publishes or deletes the source.

The guide also covers collections, book editions, updates, and recovery. Use the
[authoring reference](docs/authoring-format.md) for file formats and the
[image authoring workflow](docs/image-authoring-workflow.md) for subscription-based Codex generation.

The article on the limits of reward-based AI training has a
[article](content/pieces/clever-enough-to-find-the-loophole/index.md),
[researched outline](docs/ai-taming-outline.md) and
[source notes and reading guide](docs/ai-taming-research.md), comparing RLHF,
Jev's RLCD and methods outside RL alongside recent agent safety evidence,
including AISI and FelonyBench. The article uses sourced stories to explain the
mechanisms for readers interested in AI, with detailed method comparisons kept
in the research notes. Sources were checked on 1 October 2026.
The article is published at its canonical writing URL. Its `clever-loophole`
short code is active and resolves to the same verified social preview.
The Chronicles pieces remain drafts.

Keep [content structure separate from publishing](docs/content-model.md#content-structure-and-publication-are-independent):
pieces and book order remain independent of weekly release groups and announcements.

For an existing manuscript, see the [weekly book serialization plan](docs/book-serialization.md):
exact source extraction, article sizing, short introductions, and preserved book
order. The Chronicles local preview starts with Introduction → Chapter 1 as
separate pages, with book/component labels, a prominent Next link and an optional
continuous-reading view. Production
source integration is complete; publication and scheduling remain pending.

The [tagging system](docs/tagging.md) is implemented locally: a shared vocabulary,
article topic labels, and a private searchable inventory with published/draft/retired
usage counts and reuse guidance. Run `npm run tags` to generate the review. Public
topic pages are not implemented; public article labels are deployed. The
[content discovery review](docs/content-discovery.md) retains proposed search
improvements for separate book reading pages.

The [reading-time comparison](docs/reading-time-experiment.md) records a local
experiment with parsed text and `reading-time`. It left all four current reading-time
labels unchanged; the production calculation remains raw word count at 220 words
per minute, rounded up. No new runtime dependency was adopted.

The [content review workflow](docs/content-quality.md) combines local NLP, stem-sequence
counts, source/reference checks, tag reuse, and declared Python example tests.
Run `npm run quality:setup` once, then `npm run prepublish:check` for the review
and site validation together. Editorial suggestions remain advisory; missing tools
and technical failures are explicit. Nothing is published by these commands.

## Private authoring on your computer

One command, `npm run preview`, runs the complete local workspace independently
of the deployed website. Browse the site and use Edit, or edit the Markdown/YAML
sources directly. The editor saves local files; standalone tag/quality reports
remain read-only tools. No separate `author` command is provided.

Run `npm run preview` for the [local editor](docs/local-authoring.md): live prose
preview, explicit saves, undo/redo, post details and recoverable saved versions.
Use **Preview content → Published only** in the local site banner to rebuild the
view without drafts, or **Show drafts** to restore them. This does not publish content.
The editor pairs a spacious **Write** pane with **Preview** and **Review** views,
with local save status and history controls above the workspace.
The **Images** panel offers editable briefs from installed agents, Codex subscription
image generation, preserved candidates, and explicit insertion with automatically
suggested, editable alt text for generated images. Insert at the beginning (after
the title and summary) or the end of the article.
For books and collections, the same panel generates or imports a dedicated cover;
**Use as cover** assigns it to the unsaved collection, then **Save** applies it.
Cover briefs and generation use the chosen shape and ask for artwork filling the
canvas, with modest margins and no blank area reserved for title lettering.
Image filenames describe their visible content and retain a hash suffix for uniqueness.
Automatic image cleanup runs after saves, at startup and daily while preview runs.
Unused candidates and managed source assets get a seven-day grace period, then
30 days in recoverable trash before deletion. Saved versions and browser recovery
protect their images. See [cleanup and recovery](docs/image-authoring-workflow.md#automatic-cleanup).
The **Review** panel adds [Writing checks and Editorial review](docs/editorial-review.md):
local language analysis and an explicit review through installed Claude Code, Codex or Pi.
Browse `http://127.0.0.1:4322/` and click **Edit** beneath an article or book
heading, or open `http://127.0.0.1:4322/_author/` directly. Draft and published
pages use the same local-only link. **View on site** opens the saved page in a
new tab, preserving the editor and its unsaved changes. Saved changes refresh the full site in the
background; nothing is deployed. The editor is implemented locally, not hosted.

| Local view                              | Generate                        | Serve                                                                             |
| --------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Tag inventory                           | `npm run tags`                  | `python3 -m http.server 8769 --bind 127.0.0.1 --directory exports/tag-review`     |
| Content review                          | `npm run quality`               | `python3 -m http.server 8770 --bind 127.0.0.1 --directory exports/content-review` |
| Full site and editor, including drafts  | `npm run preview`               | Live workspace on 4322                                                            |
| Read-only snapshot with selected drafts | `npm run preview -- --snapshot` | Builds and serves on 4322; see [preview modes](docs/authoring-preview.md)         |

Run commands from the repository root after setup. Tag/content commands select
`content` by default; use the linked guides' source options to include private drafts.
Open `http://127.0.0.1:<port>/`. The old book-specific HTML preview remains a design
snapshot; the full-site authoring preview is the normal visual review workflow.
Ctrl+C stops the preview; start it again after stopping it or restarting the
computer. Stop it before switching modes on the same port, or use `-- --port NUMBER`.
The live workspace refreshes after saved edits. Standalone tag/quality reports and
read-only snapshots remain on disk and require their generators to be rerun.

GitHub validation runs `npm run verify:ci`, including analysis, coverage and release
checks. Amplify runs `npm run validate` and publishes only `dist/`. Neither runs
the article NLP review or these private servers. The combined
`npm run prepublish:check` remains a local release step, not an enforced CI gate.
Ignored `exports/` reports and pilot drafts are excluded from the public build;
this is local-only storage, not password-protected hosting. A draft committed to
this public GitHub repository is still readable there, regardless of draft status.
See [where authoring runs](docs/publishing-workflow.md#where-authoring-runs).

## Repository guide

| Directory                | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `content/`               | Markdown pieces, collections, references, and edition manifests       |
| `core/`                  | Content model, assembly, rendering, editions, and publishing          |
| `renderers/`, `runtime/` | Replaceable renderers and browser experiment adapters                 |
| `themes/`, `site/`       | Theme templates, styles, and Astro routes                             |
| `publishing/`            | Theme, homepage, renderers, models, aliases, and destinations         |
| `data/`, `lib/`          | Historical source lists and metadata resolution                       |
| `legacy/`                | Preserved original-site snapshot                                      |
| `scripts/`, `test/`      | Build/publication tools and representative tests                      |
| `docs/`                  | Product decisions, implementation choices, and operating instructions |

`dist/`, `.generated/`, `exports/`, caches, and publication state are generated
or private local data and are ignored by Git. The original generator remains
available through `npm run build:legacy`; its output is `public/`.

## Specifications

- [Publishing workflow](docs/publishing-workflow.md): drafting, review, release, distribution, and updates.
- [Content import](docs/content-import.md): selection, dry runs, dependencies, draft staging, and controlled updates.
- [Authoring preview](docs/authoring-preview.md): full-site draft review at `/`, isolation, and release preview.
- [Product design](docs/product-design.md): reader and author experience.
- [Content model](docs/content-model.md): pieces, collections, placements, editions.
- [Authoring format](docs/authoring-format.md): Markdown/YAML, math syntax and configuration.
- [Architecture](docs/architecture.md): replaceable implementation choices.
- [Cross-posting](docs/cross-posting.md): delivery policies and provider limits.
- [Analytics and privacy](docs/analytics-and-privacy.md): deployed PostHog EU analytics, visitor consent, event definitions and operating instructions; MCP and exports remain unconfigured.
- [Media storage](docs/media-storage.md): configured S3/CloudFront delivery, uploads and corrections for images/PDFs.
- [Asset release design](docs/asset-release-design.md): ignored editorial media, checksum manifests, release/deployment gates and automatic retention.
- [Social link previews](docs/social-previews.md): deployed Open Graph/X article cards, locally tested book covers and verified full/short article URLs.
- [Private operations](docs/private-operations.md): where account-specific notes live and how to recover them.
- [Credentials and access](docs/credentials-and-access.md): provider capabilities, secret locations, and setup steps.
- [Dependencies and hosting](docs/dependencies-and-hosting.md): current toolchain, compatibility exceptions, and Amplify configuration.
- [Operations](docs/operations.md): deployment, export, recovery, and maintenance.
- [Implementation status](docs/implementation-plan.md): capability and verification map.
- [Code analysis](docs/code-analysis.md): installed commit checks, complexity limits, coverage thresholds and reports.
- [Social publishing and Trash plan](docs/social-publishing-plan.md): researched next scope, migrations, milestones and acceptance tests.
- [Navigation review](docs/navigation-review.md): tested visitor journeys, improvements, and hosting limitations.

Keep documentation brief, professional, and task-focused. The README and affected
guides must change alongside the implementation; see [AGENTS.md](AGENTS.md).

## Deployment

Pull requests run the same validation command as Amplify. AWS Amplify builds
and deploys pushes to GitHub `main`; an independent GitHub job verifies the exact
live revision, routes, assets, RSS, indexing, and the original-site snapshot. `amplify.yml` defines
the build; `customHttp.yml` defines response headers. After integration setup,
the publication workflow requires that verification before activating
short links. Third-party delivery is a separate manual operation. Local commits
must be pushed to trigger website deployment.

Editorial image/PDF binaries stay in ignored article/collection asset folders;
`publishing/media-assets.json` tracks their checksums. `npm run assets:prepare`
prepares selected public renditions and privately backed-up sources before commit.
`npm run release` rejects uncommitted work, verifies ignored bytes, uploads to the
existing media bucket, checks `media.danilop.net`, then pushes the exact commit and
verifies Amplify delivery. Fresh public builds need no AWS credentials.

The [asset release workflow](docs/asset-release-design.md) preserves local cleanup,
book/export resolution and existing `/media/` URLs. The remote collector protects
the live release, thirty-day rollbacks, seven-day pending releases and explicit
shared downloads. It uses a seven-day unused grace period and recoverable S3
deletions, then scoped lifecycle expiry. Collection runs after releases and daily;
local file deletion is never mirrored with `sync --delete`.

## License

[MIT](LICENSE) — Copyright © 2026 Danilo Poccia.
See [asset provenance](docs/assets.md) for fonts, artwork, and preserved material.

### Homepage discovery and draft labels

The featured article uses its first rendered body image, with the same alt text.
Articles without images show no homepage artwork; the site-wide decorative hero
is not used as an article fallback. Switching preview visibility therefore changes
the artwork along with the selected article.
Featured books and collections use their explicitly assigned cover, also shown on
their overview page. They never inherit the first chapter's illustration.

The homepage and Writing index include visible collection articles as well as
standalone posts, without duplicate entries. Book articles show their collection
and chapter context and link to the reading page. Publication dates determine
latest order. The [publication timestamp workflow](docs/publication-time.md) is
implemented, with public date ordering deployed: first local publication saves a UTC timestamp
in the article's `publishedAt` metadata. Prepare assets, commit, then run `npm run release`; Amplify delivers
the dated article in one deployment. Drafting dates stay internal, and edits or
republishing preserve the original publication time. Actual delivery can be later
than the local publication action.

Preview and test builds keep Astro/Vite caches inside their own ignored `.astro/`
directories, even when installed dependencies are shared. Concurrent builds cannot
replace each other's cached article inventory.

Set `lead` in `publishing/home.yaml` to a piece or collection ID to feature it, or
omit it for automatic latest selection. Chronicles of Computation is selected;
Start reading opens its Introduction. While it is draft, the release homepage
falls back to visible writing. Draft badges appear only in authoring previews,
on homepage/list entries, collection contents and article headers. They are
publication-state labels, not topic tags or access controls.

Book cards use **Book**. Optional `newIn` entries in `publishing/home.yaml` show
**New in [book title]** for explicitly announced material. Adding existing writing
to a book does not mark it new. Remove announcements when no longer current; see
[book labels](docs/authoring-format.md#book-labels-and-new-material-announcements).

The chosen opening/announcement card can use `kind: introducing` in its `newIn`
entry to show **Introducing [book title]**. Omitting `kind` retains **New in…**.
This is an explicit announcement choice, not inferred from reading order or
article age, and works for books assembled from existing writing. The Chronicles
Introduction introduces the book; Chapter 1 retains New in.

Finding-specific **Suggest a fix** assistance supports [one or more agents](docs/finding-fixes-design.md),
customizable instructions, named proposals for comparison, and explicit undoable
application to unsaved text.

Authoring fix proposals are automatically checked locally before application. A compact
Writing check summary compares new, no-longer-reported and remaining findings;
details and coverage expand on demand. Edited proposals are rechecked, failed
checks can be retried, and Apply remains explicit. This is advisory checking, not
a guarantee of factual or editorial correctness.

The [authoring UX review](docs/authoring-ux-review.md) records the September 2026
flow audit and the implemented local workflow improvements.

The local author workspace now separates article text from optional full source,
unifies details with normal Save/Undo, keeps Checks and Editorial results separate,
and checks proposals before Apply with explicit applied/undo states. Images use
three stages; mobile uses one workspace pane at a time. See
[local authoring](docs/local-authoring.md) for the current flow.

Post details also offers **Unpublish to draft** and **Delete draft…**. Unpublishing
preserves content and reserved URLs; deletion requires draft state and cleans up
owned assets, placements, promotions, distribution assignments and short links,
with a local recovery copy. Shared resources remain, and incoming references
must be resolved first. Public removal takes effect after deployment and short-link
publication. See [article lifecycle](docs/local-authoring.md#unpublish-and-delete).
These controls and short-link removal handling are implemented locally; no public
article has been unpublished or deleted as part of this implementation.

The [social publishing and Trash plan](docs/social-publishing-plan.md) records the
next agreed scope: a private social composer preserving
each article's language and voice; a reusable assistant catalog;
automatic short-code allocation on publication and richer link management; further social preview controls; and
free analysis hooks/CI. Draft removal will become **Move to Trash**, with restore
as draft, explicit permanent deletion and **no automatic expiration**. These
composer, link-management and Trash additions remain planned. Reader sharing is
implemented, tested and deployed: **Share ↗** beside article metadata and **Share this article** after
topic tags open one accessible panel with copy, Email, device sharing and platform
links. An on-demand status check confirms a short link before using it; an explicit
full-link fallback handles unavailable aliases. Drafts have no sharing controls.
See [article sharing](docs/article-sharing.md) for behavior and verification. Automatic
Open Graph/X preview cards are implemented and deployed: article illustrations and
book covers become hashed JPEGs, with title-card fallback, complete static metadata
and `npm run verify:social -- <url>` for crawler checks, including GET/HEAD and
byte-range redirect parity. Full and short article URLs
were verified live on 2 October 2026; book-cover cards remain locally tested while
the current collection is draft. LinkedIn Post Inspector rendered the AI article's
short-link preview after the deployed byte-range redirect fix.
See [social previews](docs/social-previews.md). The plan includes platform limitations,
ordered technical milestones and acceptance tests. The
[code-analysis pipeline](docs/code-analysis.md) is now implemented locally: the
installed pre-commit hook checks the staged snapshot without changing other work,
and `npm run verify:worktree` runs the same checks before staging. ESLint/Knip,
Astro/TypeScript, HTML/CSS/configuration checks, Ruff/ty/Vulture, security checks,
complexity limits and JS/Python coverage gates block on failures. The initial
findings have been corrected without lowering thresholds; browser and disposable
server integration tests exercise the authoring and publishing boundaries. Dependency rules also block runtime cycles and forbidden browser/server
or production/prototype imports. Reports prioritise complex files using current
changes, 90-day commit frequency and file coverage, with unavailable measurements
labelled explicitly. See the guide for setup, thresholds and coverage scope.

Editorial review requests concrete edits in the **same review response**, preserving
language, tone and voice. **Review edit** opens a verified original/replacement pair
with local before/after checks; **Apply to editor** remains explicit and unsaved.
If information is missing, **Answer question** collects the author's answer before
an explicit drafting request. Older generic advice uses **Draft an edit** and is
never inserted as article text. Alternatives remain optional. See the
[finding-fix workflow](docs/finding-fixes-design.md#reuse-an-editorial-suggestion).

Machine-readable reviews and fixes use schema-constrained output with Claude and
Codex, or Pi's final completed JSON-event answer followed by local validation.
Generated-image results also use a Codex output schema; illustration briefs stay
plain text. Source and image-file checks remain in place. See
[CLI response handling](docs/editorial-review.md#cli-implementation).

Both review types expose **Run … again** beside their results. Reloading a file
refreshes review state, and a lost review job unlocks retry controls with an error;
no editorial rerun is sent automatically.

For fixes in your own words, use **Edit myself**, change the article, then **Mark
as addressed**. Addressed and Kept as written remain separate, reversible decisions
for the current review session; they neither save text nor suppress future checks.

Finding links track unchanged quotations through edits; changing one passage no
longer disables links to every other finding. Missing or ambiguous targets are
disabled individually, while the report retains its out-of-date notice.
