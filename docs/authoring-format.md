# Authoring format

Status: implemented authoring format v1. Date: 2026-09-15.
Examples use illustrative IDs; referenced files must exist. Runnable examples
live under test/fixtures/manuscript/.

For the draft-to-release process, follow the [publishing workflow](publishing-workflow.md).

The [content model](content-model.md) defines meaning. This document chooses a
portable file representation. The [architecture](architecture.md) explains how
it is parsed and rendered. Schema versioning applies to all manifests.

## 1. Source layout

```text
content/
  pieces/
    agent-memory/
      index.md
      blocks.yaml
      latency.csv
      architecture.d2
      example.py
    memory-opening/index.md
    memory-closing/index.md
    book-preface/index.md
  collections/
    reliable-agents.yaml
  references/
    sources.bib
  assets/
    shared-illustration.svg
  editions/
    reliable-agents-first.yaml
publishing/
  site.yaml                   # brand and theme configuration
  deployment.json             # origin, base path, indexing, original-root preservation
  renderers.yaml
  links.yaml
  destinations.yaml           # cross-posting adapters/account references
  distribution.yaml           # piece assignments and update policies
  models.json                 # pinned model/runtime manifests
```

Files in these directories are version controlled. Generated HTML,
figures, bundles, and manuscript exports go into build directories. Large model
weights live in versioned asset storage; manifests record URLs and checksums.
A file's physical location is not its content ID.

For proposed natural-language illustration briefs and local image review, see
the [image authoring workflow](image-authoring-workflow.md). It is an authoring
proposal, not an extension to the implemented content schema.

Branding, theme selection, design tokens, portraits, decorative asset slots, and
supported layout variants belong in `publishing/site.yaml`, not article Markdown.
Theme packages live separately under `themes/<theme-id>/`. The site's initial
theme is `ink-and-paper`; the configuration schema is validated by core/config.ts. See the
[theme boundary](architecture.md#theme-and-template-boundary--required-for-the-rebuild).
Editorial homepage selections and book-export settings remain separate concerns.

## 2. Piece metadata and body

```markdown
---
schemaVersion: 1
id: agent-memory
title: Why agents need more than conversation history
summary: Understanding the roles of working and persistent memory.
language: en
status: draft
publication:
  surfaces: [standalone, collection, book]
slug: agent-memory
tags: [agents, memory]
---

A first paragraph that explains the problem.

## Working memory

The article body starts below its metadata title.

::block{ref="memory-architecture"}

See :ref{target="agent-memory#memory-architecture"}.
```

The block and reference notation is our directive syntax, implemented
through a Markdown extension. It is not a promise of compatibility with every
Markdown viewer. Plain prose, headings, links, lists, and fences remain ordinary
Markdown. Unsupported directives must produce a clear export error.

Publishing a standalone piece requires an explicit `publishedAt` date. Optional
`updatedAt` marks a substantive revision. Setting `status: published` makes the
piece eligible only on its declared surfaces. `shortCode` is optional for public
pieces; drafts may reserve a code without activating it.

Bodies omit H1 because the title comes from metadata. During book assembly, a
piece title becomes a section heading and body headings are shifted beneath it.
References, captions, and titles are never manually numbered in the source.

## 3. Collections and placements

```yaml
schemaVersion: 1
id: reliable-agents
title: Building Reliable Agents
summary: A growing guide to designing useful, dependable agents.
status: draft
slug: reliable-agents
ordered: true
shortCode: reliable-agents
frontMatter:
  - id: preface-use
    kind: piece
    role: preface
    ref: book-preface
    surfaces: [book]
body:
  - id: foundations
    kind: part
    title: Foundations
    children:
      - id: managing-memory
        kind: chapter
        title: Managing Context and Memory
        children:
          - id: memory-section
            kind: piece
            ref: agent-memory
            title: Memory beyond conversation history
            before:
              - id: memory-opening-use
                kind: piece
                ref: memory-opening
                surfaces: [book]
            after:
              - id: memory-closing-use
                kind: piece
                ref: memory-closing
                surfaces: [book]
          - id: persistence-planned
            kind: planned
            title: Choosing what to remember
            publicOutline: true
backMatter: []
```

All referenced pieces must exist in the actual content repository. The example
names illustrate the relationship; this document does not create those pieces.

- `body` can initially contain direct piece placements, without parts or chapters.
- `kind: appendix` groups pieces in `backMatter`.
- Chapters/appendices may also use `before` and `after` for their own introductions.
- `kind: generated` identifies `toc`, `bibliography`, `glossary`, or `index` outputs;
  these outputs are generated by the book exporter.
- A placement's `surfaces` narrows its referenced piece's publication permissions.
- A `planned` node has an explicit label but no hidden draft body reference.
- The same piece can be referenced in multiple collections. Placement IDs are
  unique within each collection, including supporting placements.

Collections remain data and editorial structure; they do not contain JavaScript.

## 4. Rich-block descriptors

Use inline code fences and Markdown image/table syntax for simple cases.
Use `blocks.yaml` when an element needs an ID, external source, renderer options,
or a publication-specific alternative. Descriptors belong to their source piece.

```yaml
schemaVersion: 1
blocks:
  memory-architecture:
    kind: diagram
    source:
      format: d2
      path: ./architecture.d2
    caption: The relationship between working memory and persistent storage.
    description: Working memory exchanges selected information with persistent storage.
    render:
      web:
        plugin: d2
        options:
          layout: elk
      book:
        plugin: d2
        options:
          layout: elk
  latency-comparison:
    kind: chart
    source:
      format: chart-v1
      data: ./latency.csv
      mark: line
      x: {field: concurrent_users, type: quantitative, title: Concurrent users}
      y: {field: latency_ms, type: quantitative, title: Latency (ms)}
    caption: Latency as concurrency increases.
    description: A line chart comparing latency across concurrency levels.
  memory-example:
    kind: code
    source:
      format: source-code
      path: ./example.py
      language: python
    caption: A minimal memory interface.
```

`chart-v1` is our small portable chart vocabulary. Start with line, bar, and
point (scatter) marks, typed x/y fields, an optional color series, labels, and explicit
units. Advanced specifications can instead declare `format: vega-lite` and a
source path. Such sources require a compatible adapter or a migration.

CSV is data; `mark`, field types, scales, aggregation, and labels determine the
visualization. Unspecified transformations must not be guessed by the renderer.
Referenced datasets can also be offered as downloads or rendered as tables.

### PDFs and published documents/decks

These illustrative URLs contain placeholders. Supply the actual published URLs
from Google; do not construct them from a private editing link. The example PDF
would be stored beside the article. Reference each descriptor with the same
`::block{ref="..."}` directive used for other rich content.

```yaml
schemaVersion: 1
blocks:
  field-guide:
    kind: document
    title: Field guide
    source:
      format: pdf
      path: ./field-guide.pdf
      updatePolicy: snapshot
      capturedAt: 2026-09-15
    summary: A printable guide to the techniques explained in this article.
    alternative:
      mode: summary-link
      text: See the companion field guide for the printable checklist.
      url: https://example.com/field-guide.pdf
  working-notes:
    kind: document
    title: Working notes
    source:
      format: google-docs-published
      url: https://docs.google.com/document/d/e/PUBLISHED_ID/pub?embedded=true
      viewUrl: https://docs.google.com/document/d/e/PUBLISHED_ID/pub
      updatePolicy: live
    summary: Evolving notes on the examples and their assumptions.
    alternative:
      mode: summary-link
      text: The companion notes expand on the examples and assumptions.
      url: https://docs.google.com/document/d/e/PUBLISHED_ID/pub
  workshop-slides:
    kind: presentation
    title: Workshop slides
    source:
      format: google-slides-published
      url: https://docs.google.com/presentation/d/e/PUBLISHED_ID/embed
      viewUrl: https://docs.google.com/presentation/d/e/PUBLISHED_ID/pub
      updatePolicy: live
    summary: A guided walkthrough of the article's main ideas.
    alternative:
      mode: summary-link
      text: The workshop deck provides a visual walkthrough of these ideas.
      url: https://docs.google.com/presentation/d/e/PUBLISHED_ID/pub
```

The source format resolves a compatible viewer through the normal plugin rules.
Initial site defaults select `pdf-native`, `google-docs-published`, or
`google-slides-published`. Each adapter handles the book target through its
authored static alternative. A direct
link to a local PDF is derived from its published asset path. Remote PDFs use
`url` instead of `path`; sources declare exactly one of these fields.

`alternative.mode: summary-link` renders the supplied text and reference in the
book; it does not reproduce the external document. For material essential to the
book, use `mode: static` with `assets` listing local page/slide images, each with
`path` and `description`, plus explanatory `text` and `capturedAt`. Assembly hashes
these assets and freezes them with the edition. Local snapshots require a capture
date; compilation computes the source hash. A Google published URL remains live:
to freeze it, supply an exported local asset rather than just relabeling its URL.

Titles and summaries remain outside the viewer and must make sense without it.
The default for remote viewers is reader activation; plugins may offer validated
layout options such as frame height or slide aspect ratio. Document permissions
are set in the publishing account, as described in the
[architecture](architecture.md#publishing-from-another-google-account).

### Externally hosted photo galleries

Photo files stay outside Git. An album-level descriptor can be used in an article
or in a dedicated piece that introduces the gallery. This URL is a placeholder;
paste the actual non-expiring public album URL supplied by Photos.

```yaml
schemaVersion: 1
blocks:
  night-sky:
    kind: gallery
    title: Nights under the stars
    source:
      format: public-photo-album
      provider: icloud-shared-album
      url: https://www.icloud.com/sharedalbum/#PUBLIC_ALBUM_TOKEN
      updatePolicy: live
    summary: A selection of night-sky photographs and observing sessions.
    render:
      web:
        plugin: gallery-link
      book:
        plugin: gallery-link
    alternative:
      mode: summary-link
      text: View the companion album for photographs from these observing sessions.
      url: https://www.icloud.com/sharedalbum/#PUBLIC_ALBUM_TOKEN
```

`gallery-link` displays an album link, not an embedded grid. Provider plugins
declare capabilities independently of viewer plugins; changing the viewer cannot
make an unsupported iCloud embed or image-list API available. A verified embed
may become another viewer later. Never infer public access from URL syntax alone.

A future `remote-image-list` source can reference stable external image URLs with
IDs, dimensions, captions, descriptions, and explicit order. No such iCloud image
enumeration is assumed. For a book's `static` alternative, selected images use
versioned external asset references and checksums, not photo files committed to
Git. The exact remote-asset manifest is defined when that capability is built.
Live album references remain usable with the summary/link alternative meanwhile.

## 5. Plugin selection

Resolve settings independently for each target (`web` or `book`):

1. Site defaults by content kind and source format.
2. Collection preferences, when rendering within that collection.
3. Piece preferences.
4. Placement preferences, when present.
5. Individual block preferences.

A standalone article has no collection context. There is no arbitrary winner
among its collection memberships.

Each layer may select a plugin and provide options. When the selected plugin
changes, discard options belonging to the previous plugin. Merge options only
between layers selecting the same plugin. Plugin schemas validate the result;
unknown plugins, incompatible formats, and invalid options fail the build.

An omitted plugin means “resolve the configured default.” Authors need not name
Shiki, Vega-Lite, Mermaid, D2, or an inference library in ordinary prose.

## 6. References and reuse

Use stable references for pieces, blocks, citations, and glossary terms. For
example, `:ref{target="agent-memory#memory-architecture"}` points to a block;
an optional `placement` attribute disambiguates repeated uses in one collection.
The compiler generates links and contextual labels.

Use ordinary footnote syntax and citation keys backed by `sources.bib`. The
parser must recognize citation/reference nodes before any HTML rendering. Exact
citation-style configuration is an export concern.

Contextual before/after pieces contain ordinary Markdown. Their publication
permissions can make them book-only. For a substantially different chapter
section, create a new piece and set `adaptedFrom: agent-memory`.

## 7. Experiments, editions and distribution

A simulation block selects a registered module. Fields, validation and execution
are defined in `runtime/experiment-registry.ts`; additional modules use that
contract. Optional named scenarios supply validated input values:

```yaml
schemaVersion: 1
blocks:
  growth:
    kind: simulation
    source:
      format: registered-simulation
      module: growth-wasm
      scenarios:
        steady:
          label: Steady growth
          input: {initial: 100, rate: 5, steps: 20}
      recordedResult: After 20 steps at 5 percent, 100 becomes about 265.33.
    description: Explore repeated percentage growth with a fixed rate.
    alternative:
      mode: summary-link
      text: At 5 percent per step, 100 grows to about 265.33 after 20 steps.
      url: https://www.danilop.net/
```

Use `growth-js` to select the equivalent JavaScript implementation. Browser
controls support run, stop, reset, scenarios and downloaded result records.
Model blocks use `kind: model-experiment`, `source.format: text-generation`,
`locality: local`, and a model ID from `publishing/models.json`. Optional source
fields include `runtime`, `prompt` and `recordedResult`. Runtime selection lives
in the model manifest and registry; prose does not depend on WebLLM. Supply a
book alternative. No model loads until the reader chooses to start it.

`npm run book -- --collection ID --edition NEW_ID` creates a frozen manuscript.
The generated `edition.json` captures source revision, hashes, rendering settings
and output files. A public edition descriptor under `content/editions/` uses:
`schemaVersion: 1`, `id`, `collection`, `title`, `summary`, `status` (draft/published),
`publishedAt`, `sourceRevision`, `manifestHash`, optional `shortCode`, and
`artifacts: [{label, url, sha256}]`. URLs must be HTTPS; hashes are SHA-256 hex.
Public downloads are explicit hosted artifacts, not private build directories.

Short links in `publishing/links.yaml` map codes to `{ref: ID}` or
`{ref: COLLECTION_ID, edition: EDITION_ID}`. Scenario companions should be authored
public experiment pieces with their own ID; arbitrary query-based scenario
aliases are rejected. Draft targets reserve codes without publishing them.

`publishing/destinations.yaml` declares adapter/account references; see the
checked-in file. `publishing/distribution.yaml` selects assignments:

```yaml
schemaVersion: 1
assignments:
  - piece: agent-memory
    destination: dev
    mode: full
    creation: draft
    updates: review
    overrides:
      tags: [ai, programming]
```

Creation states are `draft`, `published`, and `manual`; updates are `review` or
`paused`. These settings describe the copy, not a delivery trigger. Every create
or update needs `--apply --piece ID --destination ID --reviewed` from a local
checkout. Commit, push, and tag events never send external articles.

`mode: excerpt` requires authored `excerpt` text. Overrides support title,
summary, tags, and series. Optional `media` settings select PNG width, embed
policy, required block IDs, and editor-verified URLs; see
[cross-post media](cross-posting.md#media-portability-clarification--2026-09-16).
Images need alt text; unsupported interactive content needs an authored
alternative and public companion link. The assignments list is initially empty.
The former `automatic` policies are rejected: use `creation: published` only
for the intended first-copy state and `updates: review` for manual updates.

## 8. Compatibility policy

Every authored manifest declares `schemaVersion`. Changes to meaning require an
explicit migration. Engine-specific definitions retain their declared format.
Migration tooling must report unsupported constructs rather than silently
flattening them to a lossy image or dropping them.

The first-party authoring system is separate from the `data/link-metadata.json` and `data/link-overrides.json` flow for
external publications. Both can coexist during migration.

## References and defaults quick reference

`:cite{key="KEY"}` or `[@KEY]` resolves `content/references/sources.bib`.
`:term{ref="ID"}` resolves `content/references/glossary.yaml`, whose `terms`
map contains `{term, definition}` entries. `:index{term="Term"}` marks an index
entry. A book generates bibliography, glossary and index sections when used.
Plain heading links such as `[Details](#details)` are namespaced per placement.

`publishing/site.yaml` requires identity, relaunchDate, theme/layout, tokens
and portrait/biography assets; individual token values have defaults. Supported
fonts are Newsreader/Georgia and Inter/system-ui. The HTTPS origin and deployment
base belong in `publishing/deployment.json`, not `site.yaml`. `publishing/home.yaml` contains
optional lead, recentCount, elsewhereCount, and selected collection IDs.

## About-page social profiles

Keep biography prose in `content/about.md`; configure the separate profile row in
`publishing/site.yaml` using optional `socialLinks` entries:

```yaml
socialLinks:
  - {label: GitHub, url: 'https://github.com/danilop', icon: github}
```

Icons currently support `github`, `linkedin`, `x`, and `facebook`. Labels, HTTPS
URLs and ordering are configurable; an empty list hides the row. Add future icon
artwork to the local icon set and schema. Each icon/name pair is one link, with
the icon hidden from assistive technology to avoid duplicate announcements.
Local Font Awesome SVG attribution is in `site-assets/licenses/font-awesome-social-icons.txt`.
