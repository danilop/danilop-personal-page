# Publishing workflow

Write → prepare media → preview → approve → deploy → distribute.

**Deployment:** the new website uses `/`; the original snapshot is at
`/original-site/`. Old `/new/` links redirect. Website deployment is automatic on
push to `main`; third-party creation and updates are always manual. Short-link
infrastructure and live provider verification remain separate setup tasks.

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
collection/book navigation, keyboard access, homepage placement, and `/rss.xml`.
RSS rebuilds automatically with summaries of public standalone articles.

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

1. Set the final `publishedAt` date and `status: published`.
2. Optionally select the article or collection in `publishing/home.yaml` and
   reserve a `shortCode` or alias. Short links are not required to publish.
3. Rebuild and review any changes made since the preview.
4. Review the Git diff; commit the article, source assets, relevant configuration,
   and affected documentation. Push and merge the reviewed change into `main`.
5. Wait for Amplify and GitHub’s live-deployment verification to pass. Use
   `npm run verify:deployment -- --wait` for the same check locally, then review
   the published article and its media in the browser.

A push to `main` triggers Amplify; a local commit does not. The original snapshot
ships with the new website. The separate Amplify branch preview requires a manual release.

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

Short links are separate: `npm run publish:links` previews aliases. After cloud
setup, verified website deployment can activate them automatically. No DEV key
is involved and no external article is sent.

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
