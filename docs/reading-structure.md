# Shared reading structure

Status: implemented locally on 8 October 2026. Explicit body/section placement
relationships and a shared heading plan replace independent web/book heading
suppression for the migrated books. Deployment and live Leanpub rendering remain
pending. See [verification](verification.md) for checks and limitations.

## Content relationship

An article is a reading unit. Its placement specifies whether it supplies the
body of its parent chapter or introduces a section within it:

```yaml
- id: sensible-choices
  kind: piece
  ref: good-enough-ch01
  integration: body
```

- `body` contributes prose directly to a parent chapter or appendix. It can
  contain the whole chapter or a consecutive portion. Its article title does
  not add an assembled heading or consume a section number.
- `section` introduces a heading using the placement/article title and retains
  existing section numbering. This is the default when `integration` is omitted.

`body` is allowed only directly beneath a chapter or appendix, including the
existing contextual before/after placements that have that semantic parent.
Validation runs on the whole source collection, including hidden placements.
The relationship belongs to a placement: reusing an article elsewhere does not
require copying its prose or keeping the same integration choice. Equal titles
are not used to infer the relationship; genuine sections may intentionally have
the same title as their parent.

Good Enough uses body placements for Chapter 1 and both Chapter 2 articles.
Chronicles uses one for Chapter 1; its front-matter Introduction keeps its own
heading. Original prose, article IDs, slugs and placement IDs are unchanged.

## One calculation for reading views

`core/reading-structure.ts` computes emitted heading levels, body-heading
offsets, parent/chapter context and contents visibility from the existing
collection model. The assembler remains responsible for numbering, and now
excludes body placements from its section counter. No second manuscript tree,
anchor registry or citation-system rewrite is required.

| View | Heading behaviour |
| --- | --- |
| Individual article | Article title as page H1; source sections beneath it, independent of collection depth |
| Chapter or part page | Selected structure as H1; descendant headings relative to it; body placements add no title |
| Continuous collection | Full collection hierarchy; body article boundaries introduce no additional headings |
| Markua export | Same heading inclusion rules, with Markua-specific part/chapter levels and attributes |

Adapters use the shared plan and common supported-level validation. HTML records
source heading levels so page excerpts can be rebased without rerendering prose,
changing anchors or touching code. Generated footnote labels follow the same
contextual level. Rich-block rendering and citation contents remain independent.
Unsupported depth produces an error instead of silently flattening headings.

The primary web contents omit the redundant row for a single body article.
Chapters with several body articles expose labelled “Reading part 1 of 2” links,
separate from book section numbers. Their individual pages also show this
chapter-relative reading context; article position in the collection remains
separate. Genuine section entries stay visible. Existing article and chapter
routes remain available, along with Start reading and previous/next navigation.

## Links and evidence

Existing placement wrappers retain their IDs even when no title is emitted.
Authored heading IDs and duplicate-heading disambiguation are unchanged. Markua
keeps its existing explicit alias from an omitted placement title to an opening
heading where required by its anchor syntax. Links continue to target identities,
not display numbers. Existing frozen editions are never rewritten.

Article-local web footnotes and chapter-grouped book notes retain the current
reference-identity protection. This change adjusts generated note-label heading
levels; it does not merge web notes, rewrite their evidence or change citation
destinations. Figures, tables and code follow their existing renderers.

Imports must still reconstruct the selected source after reversing documented
citation and resource-path transformations. Composition metadata changes do not
change source prose or source heading text. The same composition rules also work
for articles authored directly in this repository.

## Compatibility and migration

The schema remains version 1 with an optional additive field. Existing placements
without `integration` retain section behaviour. `bookHeading` remains a legacy
book-only option; it does not alter continuous web reading. Consistent declarations
are accepted, but conflicting `integration` and `bookHeading` values fail validation.
Use `integration` for new content intended to agree across web and book views.

The reviewed Chronicles and Good Enough placements were migrated explicitly from
`bookHeading: omit` to `integration: body`. Other collections are not automatically
reinterpreted. Exporter version 3 identifies the shared composition implementation;
older frozen editions remain intact. Website typography and Leanpub rendering
settings are separate concerns.

## Regression coverage

Tests cover whole and split chapters, mixed body/genuine sections, equal titles,
different article/chapter titles, reused articles, introductions, appendices,
contextual before/after content, draft exclusions and planned placeholders.
They check numbering, contents visibility, headings in each view, placement
anchors, original section levels, source order and legacy compatibility. Existing
export tests cover repeated notes, local note links/images, code, figures and
sample selection. Browser checks must assess structure as well as font sizes.

See [serialization](book-serialization.md#articles-within-book-chapters),
[content model](content-model.md) and [authoring format](authoring-format.md).
