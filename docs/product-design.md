# Product design

Status: agreed product specification; local implementation and release verification in progress.
Date: 2026-09-15.

This document defines the experience independently of rendering libraries and
hosting mechanisms. See [the content model](content-model.md) for the concepts
and [the architecture](architecture.md) for implementation choices. “Must” means
required; “should” means preferred. All planned publishing capabilities are in launch scope; search, site-wide AI,
browser editing and subscriptions remain separate future decisions.

## 1. Purpose

Build a distinctive personal website where Danilo can develop and publish ideas,
connect them into larger works, and eventually release books. Support both
intentional book writing and collections that emerge from articles.

The homepage introduces the person and provides a curated entry into the work.
The publishing system makes that work durable, reusable, and easy to maintain.
The balance of professional and personal material, and the visual direction,
remain editorial decisions for the design phase.

The identity hierarchy is **Danilo Poccia** first, with **Notes Along the Way**
beneath it as the publication title. Explore their visual
presentation together with the portrait and overall style. The title accommodates writing, experiments, photography,
and collections that grow into books. The preference does not select a portrait
or visual direction. Final typography and any tagline remain open. Website naming
is separate from the archive label and does not imply a domain change.

### Profile portrait

Compare reusing the existing portrait, selecting another photo from the author's
collection, and creating an illustrated interpretation (such as manga or ink).
A photographic portrait and an illustrated version may serve different contexts;
the selected Ink & Paper concept uses an ink portrait as the starting point, while
the final treatment remains open. Assess recognizability, personal expression,
fit with the page design, and clarity at small sizes. Review candidates in the
actual homepage and author-bio layouts before deciding. The current photo remains
the baseline; alternative personal photos have not yet been reviewed.

### Identity directions — recorded exploration

Three [homepage visual studies](design-concepts/README.md) now make these
directions concrete: Ink & Paper, Open Workshop, and Wide Horizons. The user
selected the first, **Ink & Paper**, as the visual starting point. A separate
[working prototype](../prototypes/ink-and-paper/README.md) explores it with sample
content. This selection establishes the direction, not every generated detail.
See the studies document for the displayed option mapping.

The following table preserves the three concepts considered. Notes Along the Way
is the preferred name across all three directions; earlier name suggestions below
are exploration history, not competing active recommendations.
Keep Danilo's personal identity visible across writing, technical experiments,
books, and photography. A publication title may be secondary to his name.

| Direction | Name possibilities | Portrait | Visual language | Tradeoff |
| --- | --- | --- | --- | --- |
| Editorial notebook | Danilo Poccia; Fieldnotes by Danilo Poccia; In the Margins | Loose ink interpretation, with a photo on the biography page | Warm off-white, charcoal, deep blue, serif reading text, restrained annotations | Fits writing/books; needs room for strong photography and interactive work |
| Workshop | Danilo Poccia; Danilo's Workshop; Working Notes | Photo or simplified manga illustration | Clean pale surfaces, strong sans-serif headings, diagrams, selective bright accents | Fits building and experiments; can overemphasize technology |
| Visual journal | Danilo Poccia; Open Horizons; Notes Along the Way | Natural photographic portrait | Generous spacing, large photographs, quiet captions, alternating visual and written features | Fits personal breadth; must keep articles easy to discover |

Selected starting direction: use the name-first
hierarchy and an editorial foundation with blue accents, an ink
portrait, generous photo-gallery layouts, and purpose-built experiment pages.
The portrait can still be refined or replaced as the direction develops.
Avoid giving every content type the same card layout. Keep article reading calm,
gallery viewing image-led, and experiment controls close to their explanation.

Refine the selected direction with real content and portrait treatments.
Candidate names were creative suggestions only;
availability and potential name conflicts have not been checked. No domain change
is proposed. The historical sections are named Earlier Work and The Original Site.

## 2. Principles

The visual theme must be configurable and replaceable. Ink & Paper is the first
theme, not a permanent dependency of the content model. Colors, typography,
spacing, CSS, portraits, decorative images, and supported layouts belong to a
separate presentation layer. Routine changes use configuration and asset
references; new layout structures may require new template code. A theme change
must preserve articles, collection/book structure, publication rules, and URLs,
with readable, accessible, responsive output. Website themes and book typography
are independently chosen.

1. Writing has an identity independent of URL, placement, and renderer.
2. Articles are grouped in collections. Ordering uses the same model; there is
   no separate “series” entity to maintain.
3. A collection can acquire a book structure at any time, including at creation.
4. Chapters group articles; articles become sections in a book.
5. Opening, closing, and supporting pieces use the same writing workflow.
   Independent publication is optional.
6. Sources remain editable: code, data, and diagram definitions accompany outputs.
7. Tool choices are replaceable plugins, with explicit compatibility limits.
8. Web and book presentations are deliberately designed for their medium.
9. Historical content and existing URLs remain usable during migration.
10. Ordinary reading requires no simulator startup or model download.

## 3. Author experience

The author must be able to:

- Write Markdown with local assets and a small metadata header.
- Preview a piece independently and in a collection/book context.
- Publish an article without first creating a collection.
- Use the same piece in multiple collections without copying its body.
- Create unordered collections or specify an intentional reading order.
- Add parts, chapters, appendices, and opening/closing material gradually.
- Change a contextual section title independently of the article's web title.
- Add an opening or conclusion around a particular use of an article.
- Choose independent web, web collection, book, or combined publication.
- Create a separate adaptation when a book needs substantially different text.
- Distinguish first publication from a substantive revision.
- Receive clear errors for broken references and incomplete exports.

The initial workflow uses files and version control. A future browser editor
must preserve the source format and publication rules.

## 4. Reader experience

### Homepage — editorial front page

The homepage should surface a pinned or latest article, several more posts, and
collections/books in a structured editorial layout. Keep the personal masthead
compact enough that writing is visible immediately. A large introductory portrait
must not push the publication's contents out of the first view.

Proposed composition, with counts and placement still open:

1. Masthead: Danilo Poccia, Notes Along the Way, compact navigation and optional
   small portrait/one-line introduction.
2. Lead story: one explicitly pinned public article, otherwise the latest eligible
   article. Show a title, useful summary, publication date, and optional visual.
3. More recent writing: roughly three additional articles, excluding the lead.
4. Collections and books: two or three curated entries, each explaining the topic,
   identifying a collection/growing book/released edition as appropriate, and
   offering a clear entry into its contents. Exact status labels remain open.
5. Optional editorial feature: a gallery, experiment, or selected earlier article,
   only when material exists to justify that section.
6. Compact author introduction and links to the full catalogue/archive.

The intent is a personal magazine with clear editorial hierarchy. Preserve
publication dates when pinning; use Featured rather than Latest for an older
pinned piece. Do not duplicate the lead in the recent list or manufacture dates,
popularity rankings, empty sections, or book-completion percentages. A substantial
update may be explicitly highlighted without pretending it is a new publication.

The layout must work at launch with one article and one collection, then expand
with available content. Keep collections easy to find on mobile and avoid a
carousel as the only way to discover them. No image is required for every post;
typography can carry the hierarchy. Exact visual placement and section names will
be compared in mockups before selection.

The automatic recent list initially uses eligible standalone first-party pieces.
Earlier Work shows pre-relaunch AWS/DEV publications and other historical material.
Elsewhere is reserved for external publications after relaunch and remains hidden
until populated. Identify publishers and external destinations clearly.

### Articles

Articles should offer clear titles, summaries, dates, readable prose,
illustrations, and references. Collection memberships and reading paths should
be discoverable without requiring search.

### Collections

A collection has a title and introduction explaining what connects its contents.
Tags describe subjects and may suggest membership; editorial selection determines
what belongs to the published collection.

An ordered collection should have a table of contents and previous/next
navigation. A growing book may show deliberately public planned sections,
clearly distinguished from readable sections. Draft text must remain private.

### Archive

Preserve old posts, decks, videos, and relevant biographical material, retaining
original destinations and historical context. **Earlier Work** is the integrated
catalogue. **The Original Site** is a dated snapshot preserving the old look.
Both presentations are selected. Metadata corrections can improve the catalogue
without changing the historical snapshot. Preserving the site does not preserve
the full contents or availability of external destinations.

The archive is initially a catalogue of external publications. Preserving links
does not mean their full text or transcripts exist in this repository. New
collections may reference archived work as related material. New short links
are not automatically assigned to the archive.

## 5. Rich content

| Element | Required capability |
| --- | --- |
| Code | Highlighting, source-file inclusion, captions/references, optional annotations |
| Images | Original assets, captions, accessible descriptions, suitable output sizing |
| Photo galleries | Curated albums, external hosting, captions, accessible viewing, and source links |
| Tables | Structured values, header semantics, captions, and references |
| Charts | Data and visualization specification, with units, scales, and annotations |
| Diagrams | Editable definitions, configurable rendering, captions, and references |
| Mathematics | Inline/display equations and optional numbering/references |
| Citations | Reusable sources and contextual bibliographies |
| Callouts | Definitions, observations, examples, and practical advice |
| Exercises | Prompts and separately addressable solutions |
| Audio/video | Playback with transcripts or equivalent written explanation |
| Documents and presentations | Read-only PDF/document/deck embeds, accessible summaries, direct links, and book alternatives |
| Simulations | Controls, named scenarios, reproducible inputs, book alternatives |
| Model experiments | Explicit activation, compatibility/download information, recorded examples |

A figure is a publishing role for an image, chart, diagram, or simulation
snapshot. Tables, equations, and listings may use separate numbering. All
numbering and cross-references are generated for the publication context.

### Photo galleries

Support galleries within articles and dedicated pieces introducing an album.
Prefer iCloud Photos as the author's photo source and keep photo binaries out of
Git. Repository content stores album references and editorial metadata. Embedding
the hosted album is preferred where reliable; a clearly labelled link to the
public album remains a fallback. Inline iCloud embedding is not yet verified.

Keep the photo provider separate from gallery presentation. A native gallery
should support intentional order, captions, accessible descriptions, responsive
images, and keyboard/touch navigation. A provider-hosted album may offer fewer
controls; do not promise per-photo features unless the adapter supports them.
Only deliberately published albums are eligible; the site needs no private
library access. Live albums can evolve outside site deployments.

Books use an authored album summary/link or explicitly selected, versioned images
from external asset storage. A live album is not a frozen book illustration.
External derivative hosting is an optional future choice, not implied consent to
copy the library. Album titles and summaries remain useful if the provider fails.

### Embedded documents and presentations

Authors can include PDFs and publicly published documents or slide decks from
another account. Readers can view them without signing in or receiving editing
access. Provider integrations and PDF viewers are replaceable plugins.

Every embed has a title, meaningful written summary, and an always-available
open-original link. Layouts adapt to phones and keyboards. Unavailable or blocked
embeds leave the surrounding article readable. Third-party viewers load on reader
activation by default, with the provider identified before loading.

Live documents may evolve independently of the article. Authors choose a live
source or a frozen snapshot explicitly. Books use an authored summary/reference
or versioned static material, never a live viewer. An embed does not automatically
turn the external document into reusable article sections.

## 6. Interactive experiments

Content describes the experiment independently of its runtime library. Provide
meaningful initial inputs, model assumptions, and appropriate run/stop/reset
controls. Simulations should have named scenarios referenced by the prose.

Before a browser model starts, show device compatibility and required downloads.
A local-only experiment must keep inputs on the device; swapping a runtime must
not silently introduce cloud inference.

Every interactive element needs a meaningful static presentation for books,
unsupported devices, and ordinary reading. A sequence of states or recorded
results may explain an experiment better than a single screenshot.

Experiments are content elements. Site-wide search and an AI assistant remain
separate, deferred product decisions.

## 7. Books and editions

A collection can start with a book outline or gain one later. Support optional
parts, chapters grouping articles as sections, appendices, and appropriate
front/back matter. Chapters may have introductions and conclusions.

Books can include pieces never published independently online. Titles,
numbering, references, and heading levels adapt to the book context.

An edition captures a stable assembly of text, assets, settings, and outputs.
Later edits to a growing collection must not silently alter a released edition.
Repeated model or numerical runs are not assumed identical; retain the recorded
results actually used by the publication.

Book export must have a replaceable publishing-service adapter. Leanpub is the
intended first integration; the content remains portable.

## 8. Durable short links

New public articles, collections, and eventually book companions may receive
human-readable `danilop.link` aliases. An alias identifies a work even if its
canonical address changes.

Distinguish links to living collections from links to specific editions. Never
silently reassign a code to unrelated work. Activate links only after verifying
the public destination. Drafts and book-only text must not become public through
link generation.

### Cross-posting and updates

Write once on the personal website and distribute selected articles to other
websites through replaceable destination plugins. The local article remains the
editorial source and its public URL is the canonical original. Choose destinations
per article; support full copies or deliberate excerpts without duplicating the
source body. Destination-specific titles, summaries and tags may be retained.

After changes, update the existing remote copy where supported. Track whether
each copy is current, needs an update, failed, or requires manual action. Support
automatic updates under an enabled policy as well as reviewed or paused delivery.
Flag direct remote edits as conflicts before overwriting them. Preserve remote
identity rather than creating a new post for each revision.

Capabilities differ by destination: assisted export/import and manual updates
are valid plugin outcomes when automation is unavailable. Adapt rich content
with readable static alternatives and links back to interactive originals.
Exclude drafts, book-only pieces and the legacy catalogue from automatic
distribution. Retirement does not silently delete remote copies.

This is an accepted launch requirement; actual external publication remains an
explicit per-article choice. See
[cross-posting adapters](cross-posting.md) for technical choices and current
DEV/Medium constraints.

## 9. Quality and scope

Support mobile layouts, keyboard navigation, accessible structure, reduced
motion, and useful reading without optional client features. Visuals need
legible labels and descriptions. Prioritize reading and publishing in release 1.

Launch scope includes native Markdown articles, collections/book structure,
static rich content, archive migration, short links, simulations/WASM, browser
model adapters, frozen editions/Markua export, Leanpub and cross-posting adapters.
Account-dependent verification is recorded separately from local implementation.
Browser editing, subscriptions, search and a site-wide assistant are deferred.

## 10. First-release success criteria

- Publish a piece and place it in two collections without duplicating the body.
- Organize an ordered collection into chapters and retain a book-only preface.
- Display appropriate titles and numbering in each public context.
- Exclude draft/restricted content from routes, feeds, assets, and metadata.
- Render static rich content while retaining its editable sources.
- Preserve archive URLs or redirect them to equivalent destinations.
- Resolve a new short link correctly before and after a canonical slug change.
- Require no model download or experiment startup for ordinary reading.
