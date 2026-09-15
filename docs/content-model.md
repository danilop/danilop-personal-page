# Content model

Status: v1 product model, implemented locally. Date: 2026-09-15.
See [implementation status](implementation-plan.md) for verification and deployment gates.

This is the logical model. File syntax belongs in [the authoring format](authoring-format.md),
and library choices in [the architecture](architecture.md).

## 1. Entities

| Entity | Meaning |
| --- | --- |
| Piece | Reusable writing; shown as an article when independently published |
| Collection | Editorial grouping with an optional ordered/book structure |
| Placement | One use of a piece in a collection or as supporting material |
| Structural node | A part, chapter, appendix, or front/back-matter group |
| Content block | Code, image, table, chart, diagram, equation, media, or experiment |
| Asset | Source file, dataset, media, or generated rendition |
| Edition | Frozen publication of a collection at a particular revision |
| Short link | Durable alias for a public entity or edition resource |
| Archive record | Metadata and destination for externally hosted legacy work |

Tags classify subjects. Collections select and contextualize material. “Series,”
“guide,” and “growing book” may describe a collection to readers; they are not
separate entity types.

## 2. Identity and references

IDs are stable; titles, paths, and URLs can change. Identity is not derived from
a filename or title.

- Piece and collection IDs are unique across the repository.
- Structural and placement IDs are unique within a collection.
- Block IDs are unique within a piece; external references include the piece ID.
- A piece may appear repeatedly. References to repeated occurrences must specify
  a placement when the destination would otherwise be ambiguous.
- Rendered HTML anchors are namespaced by placement.
- Relative assets resolve against their source piece, even when assembled elsewhere.
- Cross-references use identity, not hard-coded chapter/figure numbers.

## 3. Piece

Required: ID, title, summary, language, lifecycle state, publication permissions,
and Markdown body. Optional: assets, block descriptors, tags, standalone slug,
publication/revision dates, short code, renderer preferences, and `adaptedFrom`.

Lifecycle states: `draft`, `published`, `retired`. A published piece is eligible
only for its declared surfaces; it does not automatically get a public web page.

| Publication surface | Effect |
| --- | --- |
| `standalone` | Own article page, article feed eligibility, and sitemap entry |
| `collection` | Inclusion in a public web collection |
| `book` | Inclusion in a book assembly/export |

A preface may allow only `book`. An article can allow all three. A contextual
opening can allow `collection` and `book`. Private preview is a separate mode.

First-publication and substantive-update dates are explicit editorial metadata;
file modification times do not determine their meaning.

## 4. Collections and book structure

A collection has ID, title, summary, optional introduction, subjects, state, and
an explicit tree of contents. A flat collection can contain piece placements
directly. Ordering is owned by the collection.

```text
Collection
├── Front matter
│   ├── Foreword
│   ├── Preface
│   └── Introduction
├── Body
│   ├── Optional part
│   │   ├── Chapter
│   │   │   ├── Optional opening
│   │   │   ├── Piece placement → book section
│   │   │   └── Optional closing
│   │   └── Chapter
│   └── Chapter (parts may be omitted)
└── Back matter
    ├── Appendix → group of pieces
    ├── Glossary / references
    └── Acknowledgments
```

Chapters are groups, including when they initially contain one article. Parts
group chapters. Appendices may group pieces through the same placement mechanism.
Pieces do not carry a global chapter/section number.

Front/back matter can be authored pieces or generated material such as a table
of contents, bibliography, or index. Display titles and numbering belong to the
collection/export style. Tags may suggest additions, but do not silently change
an authored collection's membership.

## 5. Placements, openings, and closings

A placement references a piece and may provide a contextual title, narrower
publication surfaces, and `before`/`after` placements for supporting pieces.
Chapters can also have opening and closing placements.

This supports a short opening attached to one article's use in a book, as well
as an introduction to the whole chapter. Ordinary introductions can remain in
an article's body; separate pieces are useful for distinct context or visibility.

Visibility is the intersection of piece permissions, placement permissions,
parent visibility, lifecycle state, and requested target. A placement cannot
make a draft or restricted piece public.

Pieces always declare their surfaces explicitly. An omitted placement or
structural-node surface restriction adds no further restriction; it never
broadens the permissions inherited from the piece or its parents.

Composition must be acyclic. Reuse across placements is valid; recursive
inclusion through supporting pieces is not. Substantial body rewriting creates
a separate `adaptedFrom` piece rather than an invisible patch to shared prose.

## 6. Planned contents and drafts

A `planned` placeholder contains an explicit public label and no body reference.
It can appear in a growing-book outline without exposing a private draft.

A released book must explicitly exclude unfinished outline nodes or resolve
them to eligible pieces. An edition preflight reports any unresolved placeholders.

Production excludes unpublished text from routes, feeds, client bundles,
downloadable data, and assets. Assets reachable only from excluded pieces must
not be copied wholesale into a public directory.

## 7. Rich blocks and assets

Common fields: ID, kind, source, optional caption/description, renderer
preferences, and target behavior. Sources are distinct from generated outputs.

Kinds: `code`, `image`, `table`, `chart`, `diagram`, `math`, `callout`, `exercise`,
`audio`, `video`, `document`, `presentation`, `gallery`, `simulation`, and `model-experiment`.

- A figure is the caption/numbering role for an image, chart, diagram, or snapshot.
- Tables, equations, and listings can have separate number sequences.
- Charts preserve data and specifications: scales, units, transformations,
  legends, and annotations. CSV alone is not a chart specification.
- Tables remain semantic tables in outputs that support them.
- Code declares language, source selection, and annotations. Execution is an
  explicitly declared example/experiment capability.
- Complex visuals and media have an accessible text equivalent.
- Assets retain provenance and attribution where relevant.
- Galleries reference a public provider album or an explicit list of remote image
  assets. Source/provider and viewer plugin are distinct. Store stable IDs, URLs,
  title, summary, update policy, and any authored order/captions in Git, not photo
  binaries. Provider-managed albums may expose only an album-level reference.
  Per-photo identity, order, and descriptions require declared provider support.
- Remote assets used in frozen editions need immutable versions and hashes in
  external asset storage, or an authored summary/link alternative. Referencing a
  live album does not authorize an automatic download or mirror.
- Documents and presentations declare a source format, local asset or public URL,
  title, summary, canonical viewing link, and live/snapshot update policy. Provider
  format and selected viewer plugin are separate properties.
- Public visibility is an author-managed property of the external source; local
  publication metadata cannot grant or revoke access at the provider.
- A book alternative is an explicit summary/reference or selected static material.
  Snapshot material records its capture date and content hash. Editions freeze
  the alternative, not whatever the live URL happens to show later.

Each export target requires a supported rendition or an authored alternative.
A release build must fail rather than silently drop unsupported content.

## 8. Experiments

Separate experiment behavior, program/model assets, runtime plugin, backend
requirements, parameter schema, and named scenarios. Serialize simulation state
where practical. Shared scenarios identify the experiment revision and inputs.

Model experiments additionally record model/tokenizer identity, weight checksums,
runtime/backend versions, generation settings, and observed outputs used in a
publication. Preserve recorded evidence; deterministic seeds do not guarantee
identical generation across runtimes and hardware.

Runtime swaps must respect model formats, required capabilities, and local-only
processing requirements. WebLLM or another implementation is never a content kind.

## 9. Editions

An edition records collection/edition IDs, source revision, resolved structure,
included piece/asset revisions, rendering settings and plugin versions, recorded
experiment results, generated artifacts, and checksums.

Released editions are immutable. Corrections create a new edition/revision ID.
The living collection continues independently. “Latest” and edition-specific
aliases are distinct, explicit destinations.

## 10. Archive and short links

Archive records preserve original links and curated metadata. They are not
native Markdown bodies. A collection can reference them as external resources.

New short links identify public pieces, collections, editions, or companions.
Resolve canonical destinations during publication. Codes are unique, checked
for collisions, and never generated automatically for legacy records.

### Distribution assignments and remote copies

A distribution assignment connects one eligible public standalone piece to a
destination/account, with full-copy or excerpt mode, metadata overrides, and
creation/update policies. A remote copy records its provider ID/URL, source
revision, last delivered rendition, synchronization state and any remote conflict.
It is a delivery record for the same piece, not another independently authored
article. Provider-specific series mapping does not create a new series entity.

Local source plus explicit destination overrides determines desired content;
remote edits require reconciliation rather than automatic two-way merging.
Durable delivery records are separate from disposable metadata caches and
immutable book editions. See [cross-posting adapters](cross-posting.md).

## 11. Validation and assembly

Validate identity, uniqueness, reference resolution, cycles, visibility,
structural types, required metadata, dates, local assets, URL schemes, and
plugin/target compatibility.

Resolve contextual headings, numbering, citations, and references before export.
Stable placement IDs determine anchors; output position determines visible
numbering. Excessively deep headings must produce an actionable error.
