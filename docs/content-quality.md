# Pre-publication content review

Status: implemented locally on 2026-09-20 and tested on the Chronicles opening.
No content was rewritten or published. Advanced linguistic checks and basic
stem-sequence counts supplement the existing website validation.

## Purpose and review scopes

The report separates technical errors, editorial suggestions, information, and
unavailable checks. There is no universal quality score or AI-authorship verdict.
Preserve meaning and authorial voice; a clean report does not establish factual
accuracy or good writing.

Following the [content/publishing separation](content-model.md#content-structure-and-publication-are-independent),
review unique pieces independently of weekly release groups. A selected collection
provides a corpus for cross-piece repetition. Repeated placements and generated
reading views do not inflate counts. Site rendering/navigation validation remains
part of the combined workflow. An introduction need not match a chapter's length.

## Implemented checks

| Layer | What it checks | Interpretation |
| --- | --- | --- |
| Linguistic analysis | spaCy sentence segmentation, POS, lemmas, dependency grammar, named entities; passive candidates, technical subject/mental-verb pairings, adverb clusters, sentence length/rhythm, repeated openings | Model-supported editorial suggestions, never automatic rewrites |
| Basic repetition | Counts contiguous Snowball stem sequences, default 3–8 words, within and across selected pieces | Raw counts with original passages, source lines, and per-piece totals |
| Focused prose rules | Stock framing, inflated phrases, contrast constructions, reader flattery, formulaic signposts, book-specific context references | Inspect in context; a reference to an appendix may be perfectly valid |
| British English | Spelling pairs reused from the book, with predicted proper names/entities protected | Enabled by piece language `en-GB`; not a global rule |
| References/resources | Footnote definitions and relative link/asset existence | Missing targets are technical errors; external URLs are not fetched |
| Code | Syntax checks for Python fences; explicit fragment exclusions; declared executions with version and exact-output expectations | Execution is opt-in per block; success alone is not a proof of explanatory correctness |
| Source integrity | Optional body baselines and original/copied-file hashes | Missing or changed declared sources require review and regeneration |
| Tags | Existing registry and selected-corpus reuse findings | Advisory, using the implemented [tag inventory](tagging.md) |

The Markdown adapter preserves original file lines, excludes metadata, headings,
code, block quotations, double/curly-double quoted passages, reference notes,
rendering directives, and link destinations from prose checks. Original table-cell
prose and image alternative text are included. All local reference checks still
inspect their appropriate source structures.

Stem sequences do not cross piece, paragraph/table-cell, sentence punctuation, or
excluded-code boundaries. Counts include overlapping matches, retain function words,
and are unaffected by how many times a piece is placed in a book. Raw short-phrase
counts may be commonplace; the editorial queue prioritizes longer sequences and
reduces nested duplicates. The HTML shows the first 60 repeated groups; JSON retains
all counts and occurrences. Stemming handles inflections, not semantic equivalence.

## Setup and daily workflow

Use the repository's pinned Node/npm versions and install `uv` if it is not already
available. Setup installs a separate Python 3.13 environment, pinned dependencies,
and the English model using the hashed lock file:

```sh
npm run quality:setup
npm run test:quality
npm run quality
```

Analysis is local and does not download dependencies or send manuscript text to a
service. Missing runtime/model resources produce an explicitly incomplete report.
The default sources are active (published/draft) pieces in `content`; retired
pieces and unrelated exports are excluded. Source selection mirrors the tag tool:

```sh
npm run quality -- --source content
npm run quality -- --piece-file path/to/private/draft/index.md
npm run quality -- --source path/to/library --collection collection-id
npm run quality -- --config path/to/release-quality.yaml
```

Repeat `--source` for multiple libraries or `--piece-file` for selected extras.
Providing `--source` replaces the default root. A collection selection includes
its referenced pieces once, including supporting placements, and excludes unrelated
snapshots. Select only intended review content; no publication permissions change.
`--registry` selects another tag registry and `--python` selects the analysis
interpreter. `QUALITY_PYTHON` can also select that interpreter.

The report is regenerated at `exports/content-review/index.html` and `report.json`.
It contains draft passages and local source paths, is ignored by Git, and is never
packaged into the public website. Serve only that directory on loopback:

```sh
python3 -m http.server 8770 --bind 127.0.0.1 --directory exports/content-review
```

Open `http://127.0.0.1:8770/`. Inspect findings, source excerpts, model/library versions,
metrics, counts, and any incomplete coverage. Review findings do not fail the command:

- Exit 0: selected required checks completed without technical errors; editorial
  review may still be required. Optional checks not configured are explicitly listed.
- Exit 2: technical/configuration failure.
- Exit 3: incomplete analysis, such as an unavailable model/interpreter or unsupported
  language. The current linguistic profile supports English only.

For the combined pre-publication workflow:

```sh
npm run prepublish:check
```

It accepts the same source/configuration arguments, runs the content report first,
and runs `npm run validate` only if the content checks return 0. It never publishes,
commits, or sends content. The existing `npm run validate` and deployed Node-only
build remain technical validation; they do not implicitly install/run Python NLP.
The combined command is the local release check before the existing preview,
editorial approval, and deployment workflow.

## Profile configuration and reviewed exceptions

`publishing/quality.yaml` defines advisory thresholds and the model. Piece metadata
supplies language; no new required content fields were introduced. A release can
supply its own configuration. Default thresholds are a starting point for review,
not a validated measure of writing quality.

Optional declarations use the following shapes (digest values below are placeholders,
not runnable values):

```yaml
schemaVersion: 1
baselines:
  - piece: example-piece
    bodySha256: REPLACE_WITH_REVIEWED_BODY_SHA256
    files:
      - path: relative/to/this/config/source.md
        sha256: REPLACE_WITH_SOURCE_SHA256
examples:
  - piece: example-piece
    block: 1
    python: python3
    version: '3.14'
    stdout: "6\n"
    timeoutSeconds: 5
fragments:
  - piece: another-piece
    block: 1
    reason: Deliberately incomplete syntax shown for explanation.
exceptions:
  - finding: REPLACE_WITH_FINDING_ID
    fingerprint: REPLACE_WITH_REPORT_FINGERPRINT
    reason: Deliberate terminology needed for this explanation.
```

Blocks are numbered among Python fences within a piece, starting at one. Undeclared
blocks get syntax checks under the analysis interpreter (Python 3.13), but are not
executed. Declared examples use the requested interpreter for syntax and execution,
verify its major/minor version, and compare exact stdout. Mark intentional fragments
explicitly instead of treating them as failed runnable programs.

Run declarations are for reviewed, trusted examples. They use a temporary working
directory, Python isolated mode, a minimal environment, and a timeout. These are
execution controls, not an operating-system security sandbox; arbitrary untrusted
code needs a separate sandbox. No code is executed just because it has a Python fence.

Body hashes exclude front matter but preserve exact body bytes; file hashes verify
whole files. Establish a baseline only after checking the extract against the source;
never refresh it automatically to hide drift. For manuscript corrections, edit the
editorial source and regenerate the extract with its approved transformations.

Finding IDs and fingerprints are in the report. Exceptions apply only to editorial
review findings and only while the participating source pieces match the recorded
fingerprint. Accepted findings stay visible; unmatched decisions are reported as
stale. Technical failures and missing tools cannot be waived through style exceptions.

## Chronicles opening and evidence

The private pilot profile at `exports/chronicles-pilot/quality.yaml` records verified
source/copy hashes, body baselines, and expected outputs for its two printed Python
examples. Run it with the actual two-piece collection:

```sh
npm run prepublish:check -- \
  --source exports/chronicles-pilot/content \
  --collection chronicles-of-computation \
  --config exports/chronicles-pilot/quality.yaml
```

This excludes the old combined snapshot. The initial run completed with zero
technical errors or incomplete checks, 22 repeated stem sequences, and 29 editorial
review targets: 23 passive candidates, one adverb cluster, three book-context
references, and two first-use tag notices. Both examples matched their declared
outputs under Python 3.14. These results are a dated snapshot, not approval to remove
wording or confirmation that the history is fully fact checked.

The book's approach and spelling table are tracked with upstream hashes in
`tools/content-quality/upstream.json`. The [engine documentation](../tools/content-quality/README.md)
records adaptations, model limitations, dependency refresh, and tests. The small
spaCy model supplies grammatical/lexical analysis, not semantic paraphrase detection.

## Remaining work

Historical/source verification, visual proofing, external link availability,
semantic duplication review, and comparisons between successive report versions
remain separate work. Full book layout and runtime checks for languages other than
Python are not supplied by this tool. The earlier book-wide suite has not been
ported wholesale, and editorial thresholds need ongoing calibration on varied prose.

## Author editor integration

[Writing checks](editorial-review.md) runs this engine against an in-memory editor
snapshot, optionally with saved collection peers. It preserves source line numbers
and lets the author navigate findings. The editor syntax-checks code but deliberately
does not execute examples. **Editorial review** is a separate explicit CLI/model
review with advisory suggestions; it is not part of deterministic release validation.

Prose segments retain their source offsets. The Python worker returns UTF-16
start/end positions for precise author-editor selection (end exclusive), including
Unicode before a match. Repetition locations retain both their contextual excerpt
and per-occurrence ranges. These offsets describe the reviewed snapshot only.
