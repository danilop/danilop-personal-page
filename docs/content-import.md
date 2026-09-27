# Importing reviewed content

Status: implemented locally, 2026-09-20. Importing prepares source content for the
normal publishing workflow; it does not publish, deploy, commit, or remove sources.
The Chronicles Introduction, Chapter 1 and collection are now imported under
`content/` as drafts. Run `npm run preview` to see them; no repeated import is needed.

## Selection and defaults

Run `npm run content:import -- --from <library>` from the repository root.
The source library contains `pieces/<folder>/index.md` and/or `collections/*.yaml`.
For our pilot it is `exports/chronicles-pilot/content`, not the surrounding folder
of generated HTML and reports. The destination defaults to `content`.

The default is a **dry run of all active canonical content**: inspect the proposed
files without changing the destination. Applying requires an explicit scope:
`--collection`, `--piece`, or `--all`, plus `--apply`. This lets us inspect everything
without making “everything in a preview folder” the automatic publication choice.

For weekly serialization, selecting the collection is usually the right scope:
its outline supplies the reading order and referenced pieces. A shared release
still does not merge articles or introduce an instalment entity. Import selections
are operational choices, separate from the [content model](content-model.md).

| Option | Behavior |
| --- | --- |
| `--from PATH` | Required canonical source library; paths are relative to the working directory unless absolute |
| `--to PATH` | Destination library; defaults to `content`; useful for rehearsal in a separate directory |
| `--piece ID` | Select a piece by its metadata ID; repeat to select several; does not select owning collections |
| `--collection ID` | Select a collection and its referenced pieces, including before/after/front/back matter; repeatable |
| `--all` | Explicitly select every non-retired piece and collection; cannot combine with positive piece/collection selectors |
| `--exclude-piece ID` | Exclude a source piece; repeatable; never silently break a selected collection or adaptation |
| `--exclude-collection ID` | Exclude an outline; repeatable; does not exclude independently selected pieces |
| `--update` | Allow changed/new files within existing identities; otherwise differing existing content blocks the import |
| `--apply` | Apply the validated selection; without it, only plan and validate |
| `--expect HASH` | With apply, require the fingerprint from a previous dry run; a changed plan fails |
| `--json` | Print the plan with selected identities, file actions, SHA-256 hashes, warnings, and fingerprint |
| `--help` | Show command usage |

Without positive selectors, the dry run includes all non-retired candidates, minus
exclusions. With positive selectors, their union is used. A collection adds its
piece dependencies; an adaptation adds its original piece, transitively. Unknown
IDs and contradictory include/exclude requests fail. Explicitly selecting retired
content fails. An excluded/unavailable dependency may use a non-retired copy already
in the destination; the plan identifies this. Otherwise the command stops. It never
prunes or reorders the collection to make a filter succeed.

`--all` means all canonical content, not all files beneath the preview folder. The
old combined Chronicles snapshot is still a canonical draft in that source library,
so **use `--collection chronicles-of-computation` for the opening**, rather than
`--all`. A future source library should retain only intentional import candidates.

## Import the Chronicles opening

First inspect the plan:

```sh
npm run content:import -- \
  --from exports/chronicles-pilot/content \
  --collection chronicles-of-computation
```

It selects the two separate pieces and their collection. Review every listed file.
Then repeat with `--apply` to copy the validated source files as drafts:

```sh
npm run content:import -- \
  --from exports/chronicles-pilot/content \
  --collection chronicles-of-computation \
  --apply
```

For exact agreement with a reviewed plan, also pass `--expect` followed by the
fingerprint printed by the dry run. The fingerprint covers destination contents
and planned output bytes. Re-run the dry run if either changes. Do not treat the
fingerprint as an editorial approval or source provenance certificate.

Examples of other selections (replace example IDs with actual metadata IDs):

```sh
# One piece; the owning collection is not imported implicitly.
npm run content:import -- --from path/to/library --piece article-id

# Everything except an unwanted piece and outline; still only a dry run.
npm run content:import -- --from path/to/library --all \
  --exclude-piece obsolete-draft --exclude-collection old-outline

# Review a later revision of a collection and its pieces.
npm run content:import -- --from path/to/library \
  --collection book-id --update

# Rehearse against another destination, using the same selectors.
npm run content:import -- --from path/to/library \
  --collection book-id --to path/to/rehearsal-content --apply
```

## What is copied and preserved

Selected piece directories are copied with their files, including `blocks.yaml`,
code, figures, and other assets. Every file appears in the plan. Keep private notes
outside those directories: this is not an automatic classifier of confidential
material. Symlinks and hidden files are rejected, except `.gitkeep`; `.DS_Store` is
ignored. Special files and overlapping source/destination roots are rejected.

Collections are copied as individual YAML files. Reports, generated HTML, book
exports, provenance profiles, tag registries, and publishing configuration outside
the selected piece directories are not copied or merged. Maintain the shared tag
registry separately; existing unregistered-tag review remains available.

New destination folders and collection filenames use stable metadata IDs. Existing
identities keep their destination paths. New pieces and collections always arrive
with `draft: true`, even if their source says `published`. Other metadata remains available
for subsequent review; the import does not choose publication dates or change
publication surfaces. Markdown body bytes and assets are preserved. Front matter
and collection YAML may be reformatted while setting safe publication metadata.

An identical repeat import is a no-op. Existing changed content requires `--update`.
Updates preserve the destination's status, slug and short code; piece updates also
preserve its publication surfaces and publication/update dates. Source prose,
other metadata, and selected collection outlines may change. Destination-only files
are retained, never silently deleted. Updating a published item changes its source
for the next deployment, so review the diff and set an appropriate update date in
that separate release step. The command does not provide a force-overwrite mode or
rewrite stable IDs, URLs, dates, or publication settings automatically.

## Validation and failure behavior

Before writing, the importer validates the merged library in a temporary directory:
metadata, identities/slugs, collection references, adaptation dependencies,
footnotes, relative resources, and declared local block paths/data/alternative
assets. Relative links cannot escape the library; renderer asset paths must remain
inside their piece. Source metadata must be valid, including unselected entries
needed to establish the inventory. Unrelated source collections are not assembled.

It does not execute article code, fetch external links, render every block, run NLP,
or verify remote `media:` resources. Site routes/fragments, renderer-specific
requirements and the full site build remain part of subsequent validation.

Destination changes after planning are rejected. Applying holds an exclusive
importer lock, creates new files exclusively, and replaces changed files through
temporary files. On a caught write failure it restores earlier file changes;
empty directories may remain. This is not a crash-proof multi-file transaction:
avoid editing the destination concurrently and inspect the diff after interruption.
A crashed process can leave `.<destination-name>.import.lock` beside the destination;
remove it only after confirming no importer is running. Exit status is zero for a
successful plan/apply and one for errors. Invalid selections never trigger a partial
best-effort import.

## Continue through publication review

After applying, inspect the Git diff and rerun the local review with the intended
corpus/profile. For the Chronicles collection, the existing private profile can
check the imported bodies and original source baselines:

```sh
npm run prepublish:check -- \
  --source content \
  --collection chronicles-of-computation \
  --config exports/chronicles-pilot/quality.yaml
```

This default draft import does not make the normal website render the new articles.
Use the [full-site authoring preview](authoring-preview.md) to inspect selected drafts
without changing their source status, either before or after import.
Follow [preview and approval](publishing-workflow.md#3-preview-and-approve-locally)
for the actual production layout and publication settings. Resolve the current
appendix/index references and review the book/component presentation before release.
The private pilot preview renderer is not imported into the production templates.
Only then follow the normal commit/push/deployment process. Draft status does not
hide source committed to the public GitHub repository.
