# Development and publishing operations

Updated: 2026-09-16. Combined deployment: original site at `/`, rebuild at `/new/`.
Final root cutover and external integrations remain pending.

For routine authoring and release, follow the [publishing workflow](publishing-workflow.md).
This reference covers configuration, delivery commands, and recovery.

## Build and preview

Use pinned Node 24.21.0 LTS and npm 12.0.2, then `npm ci`. The project enforces
Node 24 and npm 12 and version-specific dependency install-script approvals.
See [dependencies and hosting](dependencies-and-hosting.md) for upgrades. Run `npm run dev` for the website, or
`npm run build` followed by `npm run preview` to inspect production output.
`npm run check` checks Astro and TypeScript; `npm test` covers the legacy importer
and publishing core. Run the build first on a fresh checkout to create the
content-loader inputs. Mermaid CLI needs its installed Chromium and Linux system
libraries; Amplify installs these in `amplify.yml`.

The website output is `dist/`. `.generated/` is disposable intermediate data.
Core reading works without browser scripts. Model and simulation workers are
loaded only for pages using those blocks; model weights require explicit reader
activation. No credentials belong in content, browser bundles, or Git.

Private browser fixtures can be created with
`NOTES_QA=1 node --import tsx scripts/fixture-preview.ts`. They create `/_qa/`
inside local output. **Always run a clean `npm run build` afterward.** The build
verifier rejects QA routes and private fixture sentinels.

## Deployment location

`publishing/deployment.json` currently sets `basePath: "/new/"`, `indexable: false`,
and `preserveOriginal: true`. `npm run build` produces a combined `dist/`;
`npm run preview` serves both sites locally. `npm run dev` serves the rebuilt
section only. Paths below are relative to the rebuilt site's configured base.
The current deployment marker is `/new/build.json`.

For an isolated root-build check, use `NOTES_BASE_PATH=/ npm run build`; this
also disables original-root preservation for that build. Do not deploy this
check output accidentally. Rebuild without the override for the combined release.

Apply `infrastructure/amplify-coexistence-rules.json` after the combined artifact
is live. Keep final-cutover rules separate. Non-indexable deployments reject
short-link and distribution `--apply`; CI skips publication before requesting
cloud credentials. Dry-run previews remain available.

## Historical publications and the relaunch boundary

`npm run sync:posts` discovers all configured AWS author pages and DEV posts,
merges them with existing URLs, and preserves editorial corrections. Review and
commit changes before deploying. It does not run automatically during builds.
See [historical maintenance](current-site.md) for importer details.

`publishing/site.yaml` sets `relaunchDate`. Date-only external posts through that
date belong to **Earlier Work**; later external posts belong to **Elsewhere**.
Undated legacy records stay in Earlier Work. DEV discovery retains canonical
URLs; known copies whose canonical URL matches a public native article are
excluded from both external lists while retained in the source inventory. This is an editorial boundary, not
an alteration of historical publication dates. The original snapshot is frozen
under `legacy/snapshot-2026-09-15/` and served as **The Original Site**.

Production metadata precedence is the versioned legacy Open Graph snapshot,
then `data/link-metadata.json`, then `data/link-overrides.json`. The existing
metadata resolver may use its raw cache, but the production preparation step
forbids network scraping. Import or deliberately capture metadata before adding
an Open Graph-only source. Corrections are applied after metadata resolution on
every build; do not edit disposable cache entries to make a lasting correction.

## Theme configuration

Edit `publishing/site.yaml` for theme (`ink-and-paper` or `plain`), layout
(`editorial` or `linear`), design tokens, portrait/biography/hero assets, and an
optional local `overrideCss` file. Token fields have defaults. `publishing/home.yaml`
selects a lead article, counts and collection IDs. Invalid or private selections
fail preparation. Empty homepage sections and empty navigation sections are hidden.

New page templates belong in the theme registry. Publishing rules remain in
`core/`. Home, Article and Shell are theme components; collection/archive routes
use semantic shared layouts styled by the selected theme. New structures can
introduce additional registered templates without changing article content.

## Books and editions

A representative local export:

```sh
npm run book -- --root test/fixtures/manuscript --collection guide --edition local-review
npm run book -- verify exports/guide/local-review
```

Use your own collection ID for actual work. Exports contain `manuscript/Book.txt`,
`Sample.txt`, `Preview.txt`, ordered Markdown/Markua sections and resources, plus
`edition.json` with source revision, content/configuration and file hashes.
An existing edition directory cannot be overwritten. Corrections need a new ID.
`--preview` explicitly includes eligible draft material; never publish a preview
artifact. `--exclude-planned` explicitly omits public outline placeholders.

The Markua adapter is implemented and locally tested. Remote Leanpub rendering
has not been verified for a real book. Sync the reviewed manuscript through the
source mode configured on an existing Leanpub book, then use `LEANPUB_API_KEY`
in the environment and:

```sh
npm run leanpub -- preview exports/guide/local-review EXISTING_BOOK --source-synced
npm run leanpub -- status exports/guide/local-review EXISTING_BOOK
```

Publishing requires `publish` plus `--source-synced --publish-reviewed-edition`;
review the real Leanpub preview first. The adapter does not create an account or
book, upload an unspecified source tree, or email readers. API receipts are kept
beside the local edition and are excluded from immutable-manuscript verification.
[Leanpub API](https://leanpub.com/help/api).

To expose a released edition, host its frozen artifacts at durable HTTPS URLs
and add a validated manifest under `content/editions/`. Include collection/edition
IDs, title, summary, date, status, source revision, manifest hash and download
hashes. Its landing page is `/books/<collection-id>/<edition-id>/`. A collection
links its published editions; living and fixed-edition aliases are separate.

## Cross-posting

Follow [credentials and access](credentials-and-access.md) before connecting a
provider. The protected DEV environment and separated delivery job are proposed,
not yet configured. Keep Leanpub local until a real book needs it; public embeds
and Medium's assisted workflow require no publishing credentials here.

No article is enrolled initially. Add an explicit assignment to
`publishing/distribution.yaml` and a destination/account to `destinations.yaml`.
Run `npm run distribute` to generate an article, payload and previous body under
`exports/distribution/`; compare these before delivery. Each copy also includes
`media-review.md` and `media-review.json` for conversions, embeds and fallbacks.
A blocked copy has `blocked.json` instead of stale deliverable files. Build-time
blocked copies are listed privately in `.generated/distribution-blocked.json`;
they do not prevent canonical site deployment. Credentials are named
environment variables. DEV supports API delivery; Medium uses manual import/edit.

`--apply` verifies a clean checkout and the exact live `build.json` revision.
Updates requiring review use `--reviewed`. Filter to a copy using `--piece ID
--destination ID`. Images must already be reachable from production.

- Adopt an existing owned DEV post with `--apply --piece ID --destination dev
  --adopt REMOTE_ID`. This checks its owner and canonical URL. It records the
  observed remote body without publishing; review before a subsequent update.
- Resolve a direct-edit conflict by reviewing remote changes and updating local
  source/overrides, then explicitly adopting that observed remote ID again.
  A subsequent reviewed delivery updates the same post.
- After completing a Medium import/edit, use `--apply --piece ID --destination
  medium --complete-manual https://medium.com/...` to record author verification.
  Add `--embeds-reviewed` after checking every editor embed listed in its media
  report. Required Medium embeds also need their exact verified URL recorded in
  the assignment before export. Completion is not reported as API verification.
- A timed-out create retains an intent. The next attempt searches the account for
  its canonical URL. Ambiguous/missing matches require explicit reconciliation;
  the coordinator will not blindly create twice.
- Removing an assignment stops delivery; it never deletes a remote story.

Local state lives in `.publication-state/`. CI uses the private S3 prefix
`publication/distribution/` with conditional writes and a lock. Keep this ledger
out of metadata caches and public artifacts. Before recovering a stale lock,
verify its recorded run is no longer active. Preserve ledger backups and remote
IDs. Never delete a creation intent merely to force a retry. One failed copy does
not prevent other enrolled copies from being processed.

## Deployment and short links

Amplify app `d26ru7a9pi36wa` in `eu-west-1` automatically builds GitHub `main`.
`amplify.yml` builds `dist/`; `customHttp.yml` sets response headers.
The AL2023 build installs the pinned runtime/package manager, installs required
Chromium libraries with `dnf`, and caches npm downloads, render output and
project-local Puppeteer browsers. It does not cache `node_modules` or use an
absolute/home-relative cache path. Hashed `_astro` assets are immutable-cacheable;
the deployment marker remains uncached.
The existing domain is `https://www.danilop.net`. The root-domain redirect stays
in Amplify. Preview branches emit noindex metadata and disallow crawling. Build
identity comes from the checked-out Git commit, including manually started jobs. At cutover, use explicit redirects for `/posts.html`, `/decks.html`,
`/videos.html`, and `/about.html`. Leave the missing-page catch-all absent:
Amplify `404` rules were observed to redirect with 302, while native handling
returns a true 404 (without the custom error-page body).
The final root-cutover rules are in `infrastructure/amplify-rules.json`. Apply
them only when the new site takes over the root: rules apply to every branch of this Amplify app.

Short-link setup is **pending specific access approval**. The exact proposal is
[here](deployment-access-review.md); `scripts/provision-links.mjs` defaults to a
plan and requires `--apply` to change resources. It saves the original distribution
configuration without overwriting that backup on reruns. It checks existing role
trust before applying the reviewed permission policy.

After setup, `.github/workflows/publish.yml` uses a main-only OIDC role. It waits
for the exact successful Amplify revision, checks public destinations, and updates
KVS aliases with ETags. The resolver redirects `/` to the website and returns
404 for unknown paths; it never exposes the S3 publication ledger through the
origin. No aliases are generated for historical work.

`npm run publish:links` previews aliases. `--apply --wait` publishes after deployment.
Each run retains a uniquely named snapshot under `publication/shortlinks/snapshots/`.
An interrupted run may leave some validated aliases updated; rerunning converges
the registry. Existing aliases and ownership are retained.

For rollback, select the exact snapshot key and inspect:

```sh
npm run publish:links -- --rollback publication/shortlinks/snapshots/REVISION-TIME.json
```

Add `--apply` only after review. Rollback verifies the current source deployment
and previous targets before restoring existing mappings. It does not delete
newer aliases or change fixed-edition destinations. A site rollback is a reviewed
Git revert deployed through the same pipeline; do not erase publication ledgers.

## Documentation

Keep the README, product/content specifications, authoring examples, architecture,
launch status and operating instructions synchronized in the same change.
