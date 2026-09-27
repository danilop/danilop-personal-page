# Serializing an existing book

Status: requested workflow recorded on 2026-09-19; article groupings and length
are editorial proposals. A local opening pilot has been prepared for review.
No instalment, collection, edition or recurring publication job has been deployed.

## Reader experience

See the [content discovery review](content-discovery.md) for implemented opening tags,
proposed page summaries, and search treatment of individual and continuous reading views.
The implemented [content review](content-quality.md) adapts the book's checks with
local NLP and stem counts; its private opening profile verifies source hashes and
the two printed Python examples before the website checks.

Publish new material weekly, using consecutive sections of the original manuscript.
Meaningful components have separate reading pages within an ordered **collection**,
marked as a **growing book**. Release related pieces together without making the
weekly grouping another public content type. Publication dates order the article
feed; the authored collection outline controls book order.

The accepted opening path is Introduction → Chapter 1, with an optional continuous
book view. See [reading units and release groups](#reading-units-and-release-groups--accepted).

The requested workflow preserves manuscript prose through direct file/line
extraction, adds article formatting, and retains the original reading sequence.
Leanpub is outside the current scope. The website can already present a growing
book without an external book service. A downloadable edition is a separate
release; the existing local exporter produces Markua, not a finished PDF or EPUB.

## Proposed article length

Start with 1,200–1,800 prose words per week. Allow roughly 1,000–2,200 when a
natural ending or code example warrants it. These are editorial working targets,
not a measured optimum. Count code, figures and exercises as additional reader
effort; never split an explanation from its example or pad a short, complete idea.

The inspected *Chronicles of Computation* manuscript contains 82,731 prose words
under its own counting rules, excluding code, citation labels, bibliography and
index. Its 21 main chapters contain 215 second-level sections, with a median of
340 words; 201 are below 500 words. One such section per week would usually be
too slight for this proposed cadence. Most instalments will combine several
adjacent sections. At an average of 1,500 words, the manuscript suggests roughly
55 weekly instalments; this is a scale estimate, not a fixed release calendar.

### Opening sequence for review

Counts use the manuscript's rules and include headings. Code and copied endnotes
add to the reading material. Lines refer to the inspected working files, not a
promise that future revisions will retain those line numbers.

| Week | Proposed material | Source selection | Prose words |
| --- | --- | --- | ---: |
| 1 | Book introduction + all of Before Written Arithmetic | `00-front-matter.md` 1–36; `ch01.md` 1–43 | 2,021 |
| 2 | Chapter 2 opening, Numbers in clay, A scribe's mathematics | `ch02.md` 1–48 | 1,297 |
| 3 | Areas, approximations and a problem about seven; Euclid's common measure | `ch02.md` 49–85 | 1,032 |
| 4 | Chapter 3 opening, astronomical gears, movable counters, Roman arithmetic | `ch03.md` 1–56 | 1,409 |
| 5 | Maya calendars, Zu Chongzhi, Brahmagupta | `ch03.md` 57–103 | 1,143 |
| 6 | Chapter 4 opening, completing a square, translated texts, Al-Battani | `ch04.md` 1–48 | 1,218 |
| 7 | Astrolabes, Madhava, accounting with cords | `ch04.md` 49–95 | 1,295 |

These selections cover Chapters 1–4 in order without gaps or overlap. Review
each opening and ending as an article before fixing the grouping. Later splits
remain undecided. Keep two or three reviewed instalments ready ahead of release.

## Introductions and short supporting material

- Include a short chapter opening in that chapter's first substantial article.
  Keep it once at the beginning of the chapter in the book.
- Release a short foreword, preface or book introduction with the first
  substantive instalment. Preserve its attribution and front-matter position.
- A substantial introduction with its own subject can be an article in its own
  right. Do not allocate a week solely because a heading exists.
- Keep the table of contents in the collection structure. Do not copy a book's
  full contents list, broken chapter anchors or entire bibliography into an article.
- Bring each instalment's cited notes and necessary code/assets with it. Publish
  supporting Python guidance when readers need it, even if the book keeps that
  guidance in an appendix. That supporting release need not consume a weekly slot.

“Released together” and “one combined article” are different operations in the
current implementation. Book placements support front matter and `before`/`after`
pieces; standalone articles currently render one piece's body. Placements do not
automatically prepend a foreword to a standalone article.

For several ordinary sections within one chapter, one piece with subheadings can
serve all three publication surfaces. The opening now has two primary reading
pages: Introduction and Chapter 1. The optional continuous view renders those
same pieces without another editable manuscript. Separate reading pages do not
require separate feed posts. All pilot material remains local.
`preview-composition.json` records the reading order and optional continuous view.
A production bundle schema is no longer required by this workflow.

## Component names and article context — proposal, 2026-09-20

New requirement: identify a book component by its role/position (Introduction,
Chapter 1, Appendix A, and so on) separately from its actual title. A visitor
arriving directly at an article should immediately understand its relationship
to the larger book. The author accepted the top context label and bottom navigation
on 2026-09-20. They are implemented in the local opening preview; integration into
production article templates remains pending.

Keep the article headline focused on its subject. Show a compact linked book
name and component label above the headline, with the parent chapter's actual
title when different. For example: book **Chronicles of Computation**, context
**Chapter 2 — Keeping Records and Following Procedures**, headline **A scribe's
mathematics**. If the component title is simply “Introduction”, do not repeat
“Introduction” as both a separate label and the headline.

Provide Contents and Start from the beginning near the top, plus Previous,
Contents and Next at the end. A desktop contents sidebar may supplement this;
neither a sidebar nor bottom-only membership should be the only source of book
context on mobile. Link only published destinations. At the current end of a
growing book, say “You're up to date” rather than implying the whole book is complete.

| Treatment | Benefit | Cost |
| --- | --- | --- |
| Book/chapter prefix in the article headline | Context survives plain-title feeds and copying | Long, repetitive titles; weak subject prominence; awkward for reuse and combined instalments |
| Separate context above the headline | Immediate orientation with a clear subject title; works on mobile | Requires explicit placement/bundle metadata and separate share/search-title handling |
| Sidebar | Useful persistent contents on a wide screen | Consumes reading space and needs a mobile alternative |
| Bottom-only annotation | Quiet opening and useful onward navigation | Arriving readers may miss the book relationship entirely |

Component roles and positions belong to collection placements/structure, not
ordinary topic tags or manually prefixed article titles. An article can be reused
in several collections and have different positions or contextual titles in each.
Select a primary collection explicitly for standalone orientation; retain other
memberships as secondary links. The separate pages show **Front matter / Introduction** and **Chapter 1 / Before
Written Arithmetic**. The optional continuous view identifies its coverage as
**Introduction + Chapter 1**. No numbered weekly instalment is shown to readers.

For search/share metadata, the proposed title pattern is **Subject title |
Book title**, without adding a long chain of book, chapter, instalment and site
names. Keep the visible subject headline prominent and URLs stable when ordering
changes. Add truthful, linked breadcrumbs and matching structured data as part of
implementation. Google recommends concise, descriptive page titles and may generate
a different search title; breadcrumb markup can describe hierarchy but does not
guarantee its display or a ranking improvement. See Google's
[title guidance](https://developers.google.com/search/docs/appearance/title-link)
and [breadcrumb guidance](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).

Current production templates: standalone articles show collection membership at the
bottom; collection reading pages show the book, contextual title/number and
parent above the body, with previous/next navigation below. The model already
has structural kinds, placement roles and contextual titles. Exposing these
consistently on standalone articles and adding the accepted metadata/navigation
remain production implementation work. The local
pilot already shows book/component labels, subject-first browser/share titles,
working contents and separate component pages, and contextual reading navigation.
Search structured data and indexing behaviour are not part of this private pilot.

## Reading units and release groups — accepted

Accepted on 2026-09-20: use separate pages for meaningful reading units and treat
the weekly release grouping as editorial information. Introduction → Chapter 1
is the primary preview path, with a prominent Next link. The combined numbered
instalment has been replaced by an optional **Read continuously** book view.
Book-context labels and navigation are retained. The comparison below records
the tradeoff; combined weekly articles are not the selected approach.

| Choice | Advantages | Costs |
| --- | --- | --- |
| Separate reading pages released together | Clear titles, direct links to each component, natural book order, independent corrections and flexible release grouping | Another click between components; tiny fragments can feel insubstantial; onward navigation must be prominent |
| Combined weekly article | Continuous reading; one link per weekly release; short openings travel with substantive material | Release boundaries become reading boundaries; combined and separate versions introduce competing destinations; requires bundle mapping and navigation rules |

For the opening, prefer Introduction → Chapter 1, released on the same day.
Use one main homepage/feed announcement for the substantive article, while making
the introduction available through the book's contents and reading navigation.
Separate reading pages do not require two standalone feed posts: the existing
publication surfaces already distinguish collection/book material from standalone
articles. The exact homepage/feed selection remains to be implemented and reviewed.

Do not turn every manuscript heading into a page. Keep a short chapter opening
with its first substantive section and group tightly connected short sections
into a useful article. The book introduction is distinct front matter, so its
own page is appropriate even when released alongside Chapter 1. Word targets guide
weekly reading effort and article grouping; they are not a minimum for front matter.

At the end of Introduction, make “Next: Chapter 1 — Before Written Arithmetic”
the primary onward link, with Contents secondary. Retain the book label and route
to the beginning near the top for readers arriving directly. A continuous-reading
view can remain optional at collection level; a separate numbered instalment
need not become another public content type or a third copy to maintain.

## Extraction and weekly preparation

1. Inspect the current canonical `manuscript/` files. Use working-file content,
   not an old root copy, generated reading edition or historical editorial plan.
2. Choose complete consecutive sections. Record source-relative filenames,
   inclusive line ranges, heading names, Git revision and SHA-256 file hashes.
   A commit alone is insufficient when the manuscript has uncommitted changes.
3. Copy the selected lines with Unix tools, keeping a byte-identical raw extract.
   For example, with `BOOK_SOURCE` set to the original book directory:

   ```sh
   mkdir -p exports/chronicles-pilot/source-extracts
   sed -n '1,36p' "$BOOK_SOURCE/manuscript/00-front-matter.md" > exports/chronicles-pilot/source-extracts/introduction.md
   sed -n '1,43p' "$BOOK_SOURCE/manuscript/ch01.md" > exports/chronicles-pilot/source-extracts/chapter-01.md
   ```

4. Add a stable article ID, title, summary, tags, slug and draft status. Convert
   heading levels, citation syntax, code includes and asset references explicitly.
   Copy example files with `cp`; do not ask a language model to recreate their code
   or the manuscript prose. Preserve a list of formatting transformations.
5. Convert the manuscript's `[[label]]` citations to supported article footnotes,
   copying the matching notes. The site's standard parser does not understand the
   original include comments or those citation labels automatically.
6. Review book-specific references such as “the appendix” or “the next chapter”.
   Supply working destinations or review explicit editorial changes; do not silently
   paraphrase, drop dependencies or claim unavailable supporting material exists.
7. Insert the material in the explicit collection outline. Keep article IDs and
   slugs stable as new instalments are added; validate ordering, duplicates, gaps,
   notes, links, code, assets and exclusion of unpublished material.
8. Preview the article and collection, then follow the normal
   [review and release workflow](publishing-workflow.md#3-preview-and-approve-locally).
   Record the verified live URL and release date only after deployment succeeds.

Keep the original book as the editorial source during serialization. Apply prose
corrections there first, then deliberately regenerate affected copies and review
their diff. Hash mismatches require reselecting/checking source ranges rather than
silently reusing stale line numbers. Do not auto-overwrite a published article
because the manuscript changed; review substantive updates and their dates.

Store extraction snapshots and review output under ignored `exports/`. Commit
only material intended to be publicly inspectable: this is a public repository,
and website draft status does not hide committed source from GitHub.

## Local opening pilot

The normal visual review now uses the [full-site authoring preview](authoring-preview.md)
at `/`, with the production templates and the opening selected from its private
library. The HTML files described below remain design snapshots, not the primary
release-preview workflow. Neither preview imports or publishes the source content.

To stage the reviewed opening in the production content library, use the
[content importer](content-import.md): select `--collection chronicles-of-computation`
from `exports/chronicles-pilot/content`, inspect the dry run, then add `--apply`.
This includes Introduction and Chapter 1, excluding the obsolete combined draft.
The two pieces and collection have now been imported into `content/` with
`draft: true`. Use plain `npm run preview`; release remains pending.

The ignored `exports/chronicles-pilot/` directory contains the reading previews,
raw Unix extracts, copied examples, a source manifest, and draft collection/book
pieces. The source manuscript is unchanged. Article prose is mechanically copied;
only metadata and the recorded formatting transformations are added.

After preparing those private source pieces, regenerate the four reading pages
and the redirect from the old opening-preview address:

```sh
node --import tsx scripts/preview-chronicles.ts
python3 -m http.server 8768 --bind 127.0.0.1 --directory exports/chronicles-pilot
```

Use the repository's pinned Node version. Open
`http://127.0.0.1:8768/introduction-preview.html`. The old `opening-preview.html`
address redirects there. The contents page offers **Start reading** and a secondary
**Read continuously** link. Introduction ends with a prominent Next link to Chapter
1; Chapter 1 links back to Introduction. `continuous-preview.html` presents the
same two pieces in one view. No numbered instalment label is shown. Only available
destinations are linked. All pages are marked as local unpublished previews and
excluded from indexing. This script does not import, rewrite or publish manuscript
content. The earlier combined Markdown is a review snapshot; the current HTML is
assembled directly from the two pieces, without using that duplicate as input.

Local checks passed for exact extracts and copied example files, rendering both
views with two code examples and four linked notes, internal footnote anchors,
front-matter/chapter order, and draft exclusion. A private opening manuscript
export was created and its hashes verified. The article was also opened and
visually inspected in the local browser. These are pilot checks, not a production
deployment or a full site/mobile acceptance review.

The initial 2026-09-20 context/navigation update passed TypeScript checking and generator
assertions for links across all four pages, unique anchors, one main heading per
page, code/notes and draft exclusion. Browser review covered 1280×900 and 390×844,
with no horizontal page overflow on the phone-sized viewport and no console
warnings/errors. The tested path was combined instalment → contents → introduction
→ next chapter → combined instalment at Chapter 1. Production deployment, external
source-link availability and other browser engines were not tested in this pass.

After accepting separate pages, the updated preview passed TypeScript and all
generator link/anchor checks. Browser checks verified the old opening URL redirects
to Introduction, the prominent Next link opens Chapter 1, and Contents offers
separate Start reading and Read continuously actions. The new Next treatment was
inspected at 390×844 and the contents at 1280×900; no phone-width overflow or console
errors/warnings were observed. Production templates remain unchanged.

The pilot retains book-specific wording about the appendix, subject index and
chapter-grouped endnotes. Those references need web context before release. The
source book also records that publication proofing remains outstanding. Formatting
verification does not constitute a new historical fact-check or publication approval.

Weekly preparation can initially be requested manually. A future recurring task
could prepare the next draft for review after a day and time are chosen. No schedule
is configured by this plan, and a future `publishedAt` date does not delay website
publication: the current build publishes eligible content on deployment.

The tagging update assigns Python to both opening pieces and Data representation
to Chapter 1, replacing its broad Programming tag. Separate preview pages display
registry labels below the prose. Original body text is unchanged. The private
[tag inventory](tagging.md) explicitly includes only these two active extracts.
