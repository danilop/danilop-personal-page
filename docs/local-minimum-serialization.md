# Good Enough: opening the growing book

Status, 10 November 2026: the restored Introduction and Chapters 1 and 2 are
prepared in the local content library as drafts matching the current manuscript. Publication,
release dates and later chapter groupings remain undecided.
The blog book is explicitly `completion: in-progress`, independently of the
external source manuscript. Its contents say **More to come**; the current ending
says **You’re up to date** / **This book will continue here.** These interface
messages do not enter the manuscript or export. Implemented locally on 8 October;
not deployed.

## Opening batch

Use the current book title, **Good Enough: The Local Minimum Trap**. The opening
is Introduction → Part I → Chapter 1 → Chapter 2. The Introduction begins with
Sweden’s switch to driving on the right and explains the book’s questions and
structure. It precedes Part I,
**Why arrangements persist**, and the complete Chapter 1,
**Why sensible choices get stuck**. The chapter is about 1,400 words before its
two source notes. It opens with Stockholm's buses arriving ahead of their
timetables after congestion charging, develops the distinction between choosing
within existing rules and changing those rules, and develops the invented office
example in “The second entry”.
Its final paragraph returns to the buses and closes the argument.

Chapter 1 remains one complete reading unit within the usual opening-batch length.
The latest source revision removes the “Reading the book” section. There is no
need to add another chapter merely to create two pages. The part heading belongs to the
collection structure, not a tiny standalone article. Its subtitle, “information,
costs and interdependence”, informs the collection introduction.

The book build restored `manuscript/00-front-matter.md` on 10 November with a new
Introduction. The site imports that complete text as front matter before Part I;
this supersedes the earlier exclusion of the old “A note on how this book works”
preface. Both Chapter 2 figures remain included. The source build’s generated
List of Figures is not a separate site article.

The local collection is good-enough (`content/collections/good-enough.yaml`, local draft);
its first piece is good-enough-introduction
(`content/pieces/good-enough-introduction/index.md`, local draft).
The collection and all four articles are drafts, using collection and book publication surfaces,
matching the Chronicles pilot. They do not yet create standalone blog/feed posts.
Book order and article identity remain independent of the eventual announcement
and release schedule.

## Source preservation

The current Chapter 1 heading is authoritative even though its source filename
still describes an earlier opening:

| Source                                               | Selection               | Treatment                                                        |
| ---------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `manuscript/00-front-matter.md`                     | Complete, lines 1–25    | Introduction in collection front matter                          |
| `manuscript/part1.md`                                | Complete, lines 1–3     | Part structure and opening context                               |
| `manuscript/ch01-the-diamond-that-should-be-coal.md` | Complete, lines 1–37    | One reading piece; title/number move into metadata and structure |
| `manuscript/refs/ch01.md`                            | Both chapter notes      | Named Markdown footnotes                                         |
| `manuscript/ch02-a-field-guide-to-landscapes.md`     | Lines 1–59; 60–102       | Split before “What a graph can show”                             |
| `manuscript/refs/ch02.md`                            | Notes 1, 3 and 4        | Preserve identities; include each article’s cited notes          |
| `assets/figures/fig-four-arrangements.png`          | Complete original image | Copy unchanged; rewrite the local path                           |
| `assets/figures/fig-smooth-vs-rugged.png`            | Complete original image | Copy unchanged; rewrite the local path                           |

These line ranges describe the inspected working files, not permanent boundaries.
Raw extracts and a manifest under ignored `exports/local-minimum-pilot/` record
file hashes, source revision and transformations. The manuscript working files,
rather than the Git commit alone, identify the copied version.

Chapter prose is copied without rewriting. Chapter-local citations `[1]` and
`[2]` become unique footnote IDs; their corresponding note bodies are preserved.
Reversing that conversion reproduces the source chapter body. The source's
attribution of the bus account to parliamentary testimony is retained.
This import does not constitute a new historical fact-check.

Both figures are registered in the managed asset manifest for local snapshots and
future release preparation. Their ignored source bytes remain local until release.

The shared tag registry now includes `decision-making` and `systems-thinking`;
these describe the chapter's subject rather than its position in the book.

## Review locally

The draft is already imported; use the ordinary `npm run preview` to read and
edit it alongside the other local content. A bounded read-only build is:

```sh
npm run preview -- --snapshot --collection good-enough --build-only
```

Source and body baseline checks use the private pilot profile:

```sh
npm run quality -- --source content --collection good-enough \
  --config exports/local-minimum-pilot/quality.yaml
```

For later source revisions, deliberately regenerate the relevant extracts and
piece, then use the [content importer](content-import.md) in dry-run/update mode.
Keep source corrections in the book before refreshing its blog copy.

The 10 November 2026 manuscript updates refreshed the three chapter pieces and
their cited notes, then added the restored Introduction as a fourth piece. Chapter 2 now includes the four-arrangements diagram
as Figure 2.1; the objective-function diagram becomes Figure 2.2. Direct comparison
confirms complete prose, cited notes, the Chapter 2 join and both figures match
the current manuscript. The private pilot extracts, active copies, manifest and
quality baselines were refreshed; see the
[source synchronisation record](content-import.md#source-synchronisation-on-10-november-2026).

Before publication, review the chapter's textual references to Chapters 15
and 21, the next chapter, the appendices and end-of-book notes. The draft preserves those references;
later destinations are not yet available. Decide the web context, cover and launch
announcement separately. No release date or deployment is implied by this pilot.

## Chapter 2: two articles, one book chapter

Chapter 2, **What a local minimum means**, is now imported as:

- What a local minimum means (`content/pieces/good-enough-ch02-foundations/index.md`, local draft):
  roughly 1,500 prose words, from the opening through “What counts as nearby”,
  including the four-arrangements diagram.
- Searching for a better solution (`content/pieces/good-enough-ch02-search/index.md`, local draft):
  roughly 1,300 prose words, beginning “What a graph can show”, with the objective-function figure,
  starting points, transition costs and search rules.

The complete four-arrangement table stays in the first article. All seven
original section headings and every paragraph remain in order. Chapter 2’s
reference numbering has no source note 2; the import preserves the identities
1, 3 and 4 rather than inventing a missing source. Web notes are article-local;
the book groups matching notes once after the complete chapter and renumbers
citations consistently in reading order.

All three chapter placements use `integration: body`; the Introduction is front matter. Thus assembled web and book views have each chapter
title once, with original H2 sections and no extra article-title headings at the
join. Whole Chapter 1 has one contents entry; Chapter 2 exposes two labelled
reading-part links without adding section numbers. Chapter 1 remains the complete sample chapter. Local export checks cover
both books, including the two Python code blocks present in Chronicles at that
review (the removed October example was replaced by a new split-tally example
on 10 November); desktop/mobile browser
checks cover table, figure, navigation and notes. See
[verification](verification.md) and the shared
[chapter/article guidance](book-serialization.md#articles-within-book-chapters).

Chapter 3 and later remain in the original source only. The next release batch,
launch and cover are undecided. Local Markua export and a local HTML proof have
been checked; actual Leanpub delivery and PDF/EPUB rendering remain
unverified and must precede distribution. Local draft-to-manuscript comparison
was repeated after the 10 November update.
