# Publishing workflow

Write → prepare media → preview → approve → deploy → distribute.

**Deployment:** the new website uses `/`; the original snapshot is at
`/original-site/`. Old `/new/` links redirect. Website deployment is automatic on
push to `main`; third-party creation and updates are always manual. Short-link
infrastructure and live provider verification remain separate setup tasks.

## Where authoring runs

Authoring and editorial review run on the author's computer. Markdown/YAML files
are the editable sources. `npm run preview` starts the full local site and private
editor together. Browse `/`, use Edit links, and save explicitly; source changes
refresh the site automatically. Writing checks run on demand from Review.

The tag inventory and content-quality reports remain static output under ignored
`exports/`. `npm run tags` and `npm run quality` generate those reports; their
browser controls inspect existing output. Regenerate them after source edits.
Use `npm run preview -- --snapshot` for advanced read-only content selections and
`npm run preview -- --release` for the existing production build. All preview modes
default to port 4322; stop the current server before switching modes. No separate
author command or compatibility alias remains.

These are loopback-only local tools, not public administration routes. See the
[preview modes](authoring-preview.md), [local editor](local-authoring.md),
[tag source selection](tagging.md#selecting-sources-and-reviewing-new-content), and
[content review](content-quality.md#setup-and-daily-workflow).

The checked-in GitHub validation workflow runs `npm run verify:ci`, including
analysis, coverage and release checks; Amplify runs `npm run validate`.
Amplify publishes only the generated `dist/` artifact. Tests start disposable
loopback authoring servers with fixture content; no public authoring service is
deployed, and release validation does not run manuscript NLP; `npm run prepublish:check` is currently a local
release step, not an enforced CI requirement. Draft status controls website
visibility, not GitHub access: never commit confidential drafts to the public repo.

## 1. Write the article

For content already prepared in a separate private library, use the
[content importer](content-import.md) instead of copying an entire preview folder.
Inspect a dry run with `--from` and `--collection` or `--piece`, then add `--apply`.
New content arrives as drafts; dependencies are validated before copying, and
changed existing content requires `--update`. Generated reports and preview pages
outside piece directories are not imported. Continue the same review/release steps
below after import; the command does not publish anything.

Create `content/pieces/<id>/index.md`. Use the
[welcome article](../content/pieces/hello-brave-new-world/index.md) as a template,
with a new `id` and `slug`, and set `draft: true`.

Set the title, summary, language, tags, and publication surfaces (`standalone`,
`collection`, `book`). Reference the piece ID in collection outlines as needed.
Chapters group pieces; book-only material omits `standalone`.

Select existing pieces for a release independently of their reading order and
book structure. A shared release date does not require merging pages, creating
an “instalment” entity, or announcing every piece separately. Follow the
[content/publishing separation](content-model.md#content-structure-and-publication-are-independent).

For weekly articles drawn from an existing manuscript, follow the
[book serialization plan](book-serialization.md). It covers consecutive section
grouping, exact source extraction, accompanying notes/code, and short introductions.
The later Chronicles groupings remain proposed. Its opening uses separate
Introduction and Chapter 1 preview pages, a prominent Next link, and an optional
continuous book view with the accepted book/component labels;
it is not a deployed series or an automatic publication schedule.

Before integrating the separate book pages into production, review the proposed
[search work](content-discovery.md), including preferred reading URLs, piece-specific
metadata, and sitemap coverage. Those search changes remain unimplemented.

Review tags with `npm run tags -- --review <piece-id>` before creating new vocabulary.
The [internal tag inventory](tagging.md) lists scopes, existing uses, and separate
published/draft/retired counts; its findings are advisory. Explicitly include private
draft files when needed. Regenerate the report after edits; it does not publish or
change assignments.

See [authoring format](authoring-format.md) for Markdown, metadata, and collection
examples. This repository is public: draft status hides a page from the website,
not its source from GitHub. Keep confidential drafts outside the public repo.

## 2. Prepare media

Store local images, diagram sources, chart data, and other supporting files inside
the piece's directory. Use Markdown for simple content; use `blocks.yaml` for
captions, references, renderer choices, and publication-specific alternatives.

- Keep Mermaid/D2 and chart data editable; the build renders them.
- Add alt text and captions; verify factual labels and values.
- Provide static/linked alternatives for interactive content on other platforms.
- Check public embed permissions while signed out.
- Save generated illustrations with their briefs and review locally. The
  [Codex image workflow](image-authoring-workflow.md) is implemented locally;
  insertion and Save do not upload to S3.

For externally stored images and PDFs, use the [media upload workflow](media-storage.md):
preview locally, upload with `npm run media`, verify the public URL, then use the
returned `media:` reference in Markdown or a PDF block. Bucket settings stay private;
the public base URL is configured once. The local workflow below remains supported.

Managed editorial binary files are ignored in their existing asset folders.
Run `npm run assets:prepare` after final content/publication changes; review and
commit `publishing/media-assets.json` with the content. Editable diagram sources,
small datasets and stable theme resources remain versioned. Use `npm run release`
for upload-before-push and exact-commit verification; see
[asset release gates](asset-release-design.md#prepare-commit-and-release).

## 3. Preview and approve locally

Run the implemented [content review](content-quality.md) before approving a release.
Install its local environment once with `npm run quality:setup`, then use
`npm run prepublish:check` (with source/config arguments for private drafts). It
runs NLP, repeated-stem counts, references, optional provenance and declared example
checks, and tag review before the existing site validation. Resolve technical
failures and incomplete checks; assess editorial suggestions in their source context.
The command does not rewrite or publish content. Re-run after content changes.

Install using the [README](../README.md#develop). Review selected drafts with the
[full-site authoring preview](authoring-preview.md), using production templates and
normal routes at `/` without changing source publication status:

```sh
npm run preview
```

After approval and final publication settings, check the release output separately.
Do not push before approval. Future dates do not schedule publication.

```sh
npm run prepublish:check
npm run preview -- --release
```

Open the printed local address. Check desktop/mobile layout, media, links,
collection/book navigation, keyboard access, homepage placement, and `/rss.xml`.
RSS rebuilds automatically with summaries of public standalone articles.
`npm run validate` remains available for technical website checks alone; it is not
a substitute for the local content review or factual/source verification.

If cross-posting is planned, configure the destination and explicit assignment,
then run:

```sh
npm run distribute
```

Review the article and media report in `exports/distribution/<destination>/<piece>/`;
resolve any `blocked.json`. This prepares exports without sending them. Review
assignment settings before committing. Assignments only prepare exports; they
never authorize a send on commit, push, or tag.

## 4. Commit and deploy

After editorial and visual approval:

1. Clear Draft and Save for each article in the local editor, or run
   `npm run article:publish -- <piece-id>`. This sets the first `publishedAt`
   timestamp automatically. Enable the collection separately if needed.
   Standalone articles require a slug.
   For legacy files, replace `status: draft` with `draft: true` during authoring;
   do not combine the two fields.
2. Optionally select the article or collection in `publishing/home.yaml` and
   reserve a `shortCode` or alias. Short links are not required to publish.
3. Rebuild and review any changes made since the preview.
   The build checks [social preview metadata and image bytes](social-previews.md).
4. Run `npm run assets:prepare`; review the Git diff and commit the article,
   checksum manifest, editable sources, relevant configuration and documentation.
   On a clean `main` tracking `origin/main`, run `npm run release`. It validates
   exact bytes, uploads and checks S3/CDN before pushing the captured commit.
5. Wait for Amplify and GitHub’s live-deployment verification to pass. Use
   `npm run verify:deployment -- --wait` for the same check locally, then review
   the published article and its media in the browser.

After deployment, use `npm run verify:social -- <full-url> <active-short-url>` to
check crawler-visible metadata, image delivery and redirect parity. An active short
URL requires the separate reviewed resolver setup; metadata alone does not activate it.

A push to `main` triggers Amplify; a local commit does not. The original snapshot
ships with the new website. The separate Amplify branch preview requires a manual release.

The release script waits for exact-revision deployment verification and records
its private asset inventory before triggering cleanup. Amplify independently
checks committed outputs and CDN availability; pushing without required asset
uploads fails the build. See [release gates](asset-release-design.md#prepare-commit-and-release).

Draft flags control website publication, not repository access. This repository
is public: pushing a draft makes its source readable on GitHub even while
`draft: true` excludes it from the website. Keep confidential writing in an
external local library until it can be shared.

### Publication timestamp — implemented locally, not deployed

Local publication saves a UTC `publishedAt` timestamp in the article's frontmatter.
Prepare assets and commit this together with the draft-state change, then run
`npm run release`. Amplify builds
and delivers the dated article in one deployment; CI verifies delivery without
creating another commit. Public listings and RSS use the saved timestamp. Edits,
unpublishing and republishing retain it. Local draft saves and previews do not
assign publication times. Actual delivery may occur later than the local publish
action. See [publication timestamps](publication-time.md).

## 5. Manually publish an external copy, when wanted

Use `publishing/distribution.yaml`, not topic tags or Git tags:

```yaml
schemaVersion: 1
assignments:
  - piece: YOUR_ARTICLE_ID
    destination: dev
    creation: draft
    updates: review
```

An assignment prepares the destination version and its media during builds. It
never sends anything. Keep the current empty list until there is an article to
cross-post. `creation: published` requests a public first copy when you explicitly
run delivery; `manual` selects assisted creation. `updates: paused` blocks delivery.

After reviewing the export and deploying that exact commit, inject the provider
key from your password manager into the local process and run:

```sh
npm run distribute -- --piece YOUR_ARTICLE_ID --destination dev --apply --reviewed
```

Both selection flags and `--reviewed` are required for every create or update.
GitHub Actions cannot run delivery. The stored GitHub DEV secret is unused;
future GitHub delivery would require a separate manual workflow and protected
credential/state setup. See [credentials and access](credentials-and-access.md).

Start with a DEV draft; inspect its actual media and canonical link before
publishing in DEV. Later manual updates reuse its remote ID and preserve its
publication state. Medium uses reviewed import/edit and explicit completion;
see [operations](operations.md#cross-posting).

Preserve `.publication-state/` and its backups: this private local ledger records
remote IDs and prevents duplicates. Exports link directly to the root website.
Unsupported embeds use alternatives or block required delivery.

Short links are separate: private S3/OAC infrastructure and CloudFront Free pricing
are active. In the editor, use **Short links** to reserve a code; commit/push saved
content and reservations, wait for Amplify, then use **Publish saved redirects**
and **Check live links**. `npm run publish:links` previews mappings and
`--apply --wait` publishes them after exact deployment verification. Draft aliases
remain inactive. Automatic CI reconciliation requires both private configuration
and a scoped role and is not enabled by this task. No DEV key is involved and no
external article is sent. See [short-link design](short-link-design.md).

## 6. Release a book edition, when needed

Freeze the reviewed collection under a new edition ID, then verify the export:

```sh
npm run book -- --collection COLLECTION_ID --edition EDITION_ID
npm run book -- verify exports/COLLECTION_ID/EDITION_ID
```

Replace the uppercase placeholders and inspect the export. `--preview` includes
eligible drafts for private review only. Corrections require a new edition ID.
Follow [book operations](operations.md#books-and-editions) for Leanpub and edition
pages; live Leanpub delivery remains unverified.

## 7. Update or recover

Edit the original source; preserve `id`, `slug`, and `publishedAt`. Set `updatedAt`
for a substantive revision, then repeat preview, approval, deployment, and delivery.
Review remote edits before overwriting them. Removing a distribution assignment
stops syncing; it does not delete the remote article.

Refresh external article discovery separately with `npm run sync:posts`; review
and commit the resulting data. Put lasting metadata fixes in
`data/link-overrides.json`, not a cache. Keep the original-site snapshot frozen.

Rollback by reverting and redeploying. Reconcile short links and remote copies
separately; see [operations](operations.md). Keep this guide and the README brief
and synchronized with workflow changes.

## Homepage placement

New visible articles enter homepage/ Writing discovery automatically, including
collection-only pieces. Saved `publishedAt` timestamps determine latest ordering;
release builds reject visible articles without dates. Set `lead` in `publishing/home.yaml` to a piece or
collection ID only when an editorial feature is desired. A featured book starts
at its first readable piece and keeps its articles in recent writing. A draft
feature is ignored in release output until visible, with latest content as fallback.
Draft badges are preview-only status indicators, separate from topic tags.

For newly published material in a book, optionally add a `newIn` announcement to
`publishing/home.yaml`; remove it when no longer current. Do not use it simply
because older articles were collected into a book. The permanent category is Book.
See [announcement syntax](authoring-format.md#book-labels-and-new-material-announcements).

The chosen opening/announcement card can use `kind: introducing` in its `newIn`
entry to show **Introducing [book title]**. Omitting `kind` retains **New in…**.
This is an explicit announcement choice, not inferred from reading order or
article age, and works for books assembled from existing writing. The Chronicles
Introduction introduces the book; Chapter 1 retains New in.

## Local browser editing

`npm run preview` serves the full site at `/` and the [local editor](local-authoring.md) at `/_author/`. Explicit saves
update the canonical files; Undo/Redo and Saved versions support recovery. Draft
removal makes content eligible for a later deployment. Neither saving nor restoring
a version deploys. Run the existing prepublication checks before committing.

## Unpublish or delete an article

Implemented locally; public effects require deployment. In the editor's **Post
details**, use **Unpublish to draft** after saving edits. It preserves identity,
dates, assets, placements and reserved short links. Review the release output:
the article is omitted from routes, listings, feed and sitemap, including public
collection readings. Resolve incoming references before deploying. Existing
external copies and immutable editions are separate publications.

For deletion, first save the article as draft, then use **Delete draft…**. Review
the dependency list before confirming. The editor removes the source folder,
collection placements, homepage promotions, distribution assignments and alias
assignments together, with a local recovery copy. See [local authoring](local-authoring.md#unpublish-and-delete)
for conflict handling, blockers and recovery.

Deploy the changed source and run `npm run publish:links` to inspect active,
deactivated and explicitly removed aliases. `--apply --wait` verifies the exact
site deployment before reconciling cloud redirects. An unpublished alias can
reactivate for the same article on republication; a deleted alias remains reserved
by a removal tombstone. Public pages and withdrawn aliases return 404 after
publication/cache propagation. Website and short-link publication are separate
steps, so a failed link run must be retried. No cloud action runs from the editor.

### Planned publication and recovery additions

The [social publishing plan](social-publishing-plan.md) adds automatic primary-alias
reservation to the publication transaction, with activation still gated on the
verified deployment. Social handoff uses the verified short URL; an unready alias
must be visible as pending. The author reviews generated text before opening a
platform composer, and opening it never counts as a confirmed post. Reader
sharing is independent of AI. Published-source revisions and language/voice
fidelity are required inputs to private composition.

Draft deletion will move to Trash with no expiration. Restoration returns the
article to draft and reserves its original aliases without republishing; permanent
deletion requires a separate explicit action. These workflows, new commands and
schema changes are planned, not available in the current editor.

## Code quality before committing

The [installed analysis hook](code-analysis.md) checks the staged snapshot and
enforces explicit complexity and coverage thresholds. Run `npm run verify:worktree`
to inspect all current source before staging. Review and address failures; neither
the hook nor the CI configuration automatically suppresses initial findings.
These engineering checks complement editorial review and release validation.
They do not publish content or change the existing approval/deployment workflow.
