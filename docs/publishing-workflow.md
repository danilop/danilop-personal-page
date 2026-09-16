# Publishing workflow

Write → prepare media → preview → approve → deploy → distribute.

**Current deployment:** the original website stays at `/`; the rebuilt section
uses `/new/`. Final root cutover is pending. Short links and external delivery
remain disabled during this non-indexable preview. Accounts are unconnected;
AI image automation remains proposed. See [launch status](launch-review.md).

## 1. Write the article

Create `content/pieces/<id>/index.md`. Use the
[welcome article](../content/pieces/hello-brave-new-world/index.md) as a template,
with a new `id` and `slug`, and set `status: draft`.

Set the title, summary, language, tags, and publication surfaces (`standalone`,
`collection`, `book`). Reference the piece ID in collection outlines as needed.
Chapters group pieces; book-only material omits `standalone`.

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
  [Codex image workflow](image-authoring-workflow.md) remains proposed.

Commit selected source assets. Build output and rejected image candidates do not
belong in the publication commit.

## 3. Preview and approve locally

Install using the [README](../README.md#develop). The normal website excludes
drafts. For local review, temporarily set the article and relevant collection to
`published`; supply the article's `publishedAt` and `slug`. Restore `draft` if
not ready. Do not push before approval. Future dates do not schedule publication.

```sh
npm run validate
npm run preview
```

Open the printed local address. Check desktop/mobile layout, media, links,
collection/book navigation, keyboard access, homepage placement, and `/new/rss.xml`.
RSS rebuilds automatically with summaries of public standalone articles.

If cross-posting is planned, configure the destination and explicit assignment,
then run:

```sh
npm run distribute
```

Review the article and media report in `exports/distribution/<destination>/<piece>/`;
resolve any `blocked.json`. This prepares exports without sending them. Review
assignment policies before committing: once integration is active, assignments
can trigger delivery on a main push.

## 4. Commit and deploy

After editorial and visual approval:

1. Set the final `publishedAt` date and `status: published`.
2. Optionally select the article or collection in `publishing/home.yaml` and
   reserve a `shortCode` or alias. Short links are not required to publish.
3. Rebuild and review any changes made since the preview.
4. Review the Git diff; commit the article, source assets, relevant configuration,
   and affected documentation. Push and merge the reviewed change into `main`.
5. Wait for Amplify and GitHub’s live-deployment verification to pass. Use
   `npm run verify:deployment -- --wait` for the same check locally, then review
   the published article and its media in the browser.

A push to `main` triggers Amplify; a local commit does not. The `/new/` section and original root ship together. The separate Amplify branch
preview requires a manual release.

## 5. Activate links and deliver external copies

**After setup and production verification:** the workflow checks the exact
revision before activating aliases or delivering enrolled copies. Follow
[credentials and access](credentials-and-access.md); protected DEV delivery
still needs implementation.

- **Short links:** inspect with `npm run publish:links`. After cloud setup,
  activation runs through the publication workflow. Verify the final redirect.
- **DEV:** start with draft creation and reviewed updates. Inspect the actual
  remote draft, its media, and canonical link before publishing. Later updates
  should reuse the recorded remote ID.
- **Medium:** review the prepared article, import/edit it manually, check embeds,
  and record completion using the [operations guide](operations.md#cross-posting).

Exports link to the configured original URL, including its deployment base.
During the temporary preview this is `/new/`; defer delivery until final cutover.
Unsupported embeds use alternatives or block required delivery. Preserve the
publication ledger to retain remote IDs and prevent duplicates.

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
