# Importing reviewed content

Status: implemented locally, 2026-09-20. Importing prepares source content for the
normal publishing workflow; it does not publish, deploy, commit, or remove sources.
The Chronicles Introduction, Chapter 1 and collection are now imported under
`content/` as drafts. Run `npm run preview` to see them; no repeated import is needed.
The [Good Enough opening](local-minimum-serialization.md), now the restored Introduction and Chapters 1 and 2,
was first imported as a draft on 7 October 2026, using the separate private library at
`exports/local-minimum-pilot/content` and collection ID `good-enough`.

Imported chapters stay in sync with the original manuscripts in
`~/Documents/MyBooks`: an edit made here is made there as well, and the reverse.
The [writing style](writing-style.md#books) lists the source folders. On 24 October
2026 the quotation-mark fixes in Chronicles Chapter 1 and Good Enough Chapter 1
were applied to both copies.

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

| Option                    | Behavior                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--from PATH`             | Required canonical source library; paths are relative to the working directory unless absolute                    |
| `--to PATH`               | Destination library; defaults to `content`; useful for rehearsal in a separate directory                          |
| `--piece ID`              | Select a piece by its metadata ID; repeat to select several; does not select owning collections                   |
| `--collection ID`         | Select a collection and its referenced pieces, including before/after/front/back matter; repeatable               |
| `--all`                   | Explicitly select every non-retired piece and collection; cannot combine with positive piece/collection selectors |
| `--exclude-piece ID`      | Exclude a source piece; repeatable; never silently break a selected collection or adaptation                      |
| `--exclude-collection ID` | Exclude an outline; repeatable; does not exclude independently selected pieces                                    |
| `--update`                | Allow changed/new files within existing identities; otherwise differing existing content blocks the import        |
| `--apply`                 | Apply the validated selection; without it, only plan and validate                                                 |
| `--expect HASH`           | With apply, require the fingerprint from a previous dry run; a changed plan fails                                 |
| `--json`                  | Print the plan with selected identities, file actions, SHA-256 hashes, warnings, and fingerprint                  |
| `--help`                  | Show command usage                                                                                                |

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

## Source refresh on 7 October 2026

The existing Chronicles Introduction and Chapter 1 drafts were checked against
the canonical book manuscript. The Introduction then recorded Python 3.14.8 and
distinguishes selected source checks on 7 October from the AI coverage cutoff of
19 September. Chapter 1, its two code examples and its four cited notes were
unchanged. The private raw extract, source manifest and quality baselines were
refreshed after checking the source ranges and article bodies.

The book's Chapter 2 paperwork/refreshments aside was removed at the author's
request; its original opening and corrected Euclidean explanation remain.
Chapter 2 is not yet part of the blog collection, so that edit affects the book
source only. No pieces were added or published.

For this prose refresh, the importer selected the two existing pieces with
`--piece chronicles-introduction --piece chronicles-ch01 --update`, then applied
the reviewed fingerprint with `--apply --expect HASH`. Selecting the pieces
preserved the current collection outline, summary and cover: the older pilot
collection is not a source for those later presentation edits.

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

Narration sidecars are local adaptations: imports preserve an existing destination
`narration.yaml`, even when the incoming manuscript supplies one. Changed source
invalidates affected spoken approvals; import does not publish or synthesise.

## Python compatibility refresh on 16 October 2026

After all 117 examples, strict coverage/import checks and 16 concept/audit tests
passed with both installed Python 3.14 and 3.15, the canonical introduction and
Python appendix were updated to name only those minor versions. The existing
Introduction article was synchronised by a scoped dry-run/fingerprint import;
publication settings and unrelated drafts were preserved. Browser Pyodide remains
a separately pinned runtime. No book publication is implied by this refresh.

## Chapter 1 example refinement on 16 October 2026

Removed the doubling-pairs example and its introductory and follow-up paragraphs
from the canonical manuscript, then applied the same bounded removal to the
existing Chapter 1 article. Expanded canonical source and article body match
exactly, including the retained interpretation paragraph and four citations.
The tally remains the sole runnable example. The original book example file and
index entry were removed; strict coverage now reports 116 examples, includes and
index rows. Historical verification counts above describe their earlier runs.

The obsolete spoken adaptation was removed and the unchanged tally explanation
re-reviewed against the new source context. Article narration and the preview
audiobook are regenerated, including the full MP3 and chapter timing. The chapter
and book remain drafts; deploying this edit does not publish either.

## Code example application on 16 October 2026

The whole-book example recommendations were applied in the original manuscript and
example files before refreshing the website copy. Only Chapter 1 currently has an
article affected by these code changes. Its expanded canonical body and four cited
notes match the imported article; the Introduction and later publication scope are
unchanged. The scoped import selected only `chronicles-ch01` with `--update`, then
applied the inspected fingerprint with `--apply --expect HASH`.

The tally's semantic activity ID remains `tally`; its source hash now covers the
named `animals` input. The spoken explanation was reviewed against the changed code
and nearby prediction exercise before regenerating article narration and the preview
audiobook. The active source manifest and copied tally source were refreshed, and
the removed second example was removed from the active extraction inventory.
The historical combined pilot remains a historical snapshot, not a source to reimport.
See [the applied example decisions](code-example-editorial-review.md#applied-outcome).

## Source synchronisation on 10 November 2026

Refreshed the draft Chronicles Introduction from the current manuscript: the
EDSAC/Renwick opening, the “How the book is arranged” section and the revised
ending now match. Curly apostrophes are aligned in both the original Introduction
and Chapter 1 and their website copies. The source Contents section remains
excluded because the collection supplies navigation.

After a later manuscript update the same day, refreshed all three Good Enough
pieces from Chapters 1 and 2 and their revised cited notes. Copied the new
four-arrangements diagram unchanged as Figure 2.1 and retained the objective-function
diagram, now Figure 2.2. The split remains before “What a graph can show”; its
source ranges are now lines 1–59 and 60–102. A scoped piece import preserved
publication metadata and the collection outline. The new original is registered
in the local managed asset manifest. The colon in the new `2012:3` working-paper
identifier is escaped in web Markdown to prevent directive parsing; its displayed
text remains identical to the source note.

The earlier comparison verified all five then-active book pieces, including Chronicles’
expanded tally example and four notes, Good Enough’s complete Chapters 1 and 2,
the Chapter 2 article join, cited notes and both original figures’ bytes. The active
private pilot copies, raw extracts, source manifests and quality baselines were
refreshed only after those comparisons passed. The obsolete second Chronicles
example was removed from its validation profile. Historical combined previews
remain snapshots and must not be reimported.

A subsequent recheck found another source revision: Chapter 1 was then about
1,100 words, omits “Reading the book” and revises the local-minimum explanation;
Chapter 2 has a new closing paragraph. Refreshed only the two changed pieces
(`good-enough-ch01` and `good-enough-ch02-search`). The foundations article, notes
and figures remain unchanged. All five active book pieces were compared again
with the current manuscript files before refreshing their source baselines.

The latest recheck found changes in both books. Chronicles Chapter 1 now includes
“Exact and approximate quantity”, “A tally that outlived writing” and “Tokens and
envelopes”, plus seven new cited notes. The two Python includes are expanded
verbatim without module docstrings; the new split-tally example has a stable
`split-tally` activity and an expected-output check. The earlier removed example
has not been restored. There are now eleven cited notes in Chapter 1.

Good Enough’s current build restores a new Introduction in `00-front-matter.md`.
Imported it as `good-enough-introduction` before Part I, preserving the current
collection’s other metadata and outline. Chapter 1 now includes “The second entry”
and is about 1,400 words; its current range is lines 1–37. Chapter 2’s ending was
refreshed again. The Introduction is lines 1–25. This supersedes the earlier
instruction to exclude the old preface: the new source text and build selection
are authoritative. All six active pieces now match the manuscript prose, cited
notes, both Python examples and both figures after documented transformations.

This is a local manuscript synchronisation, not a publication or deployment.
Audio and edition outputs were not regenerated; source-dependent outputs must
pass their freshness checks before use or release.
