# Reading-time comparison

Status: local experiment completed on 1 October 2026. No production calculation,
package dependency, article content or publication status changed. The author accepted retaining the existing calculation; no replacement
implementation is planned from this experiment.

## Question and method

Compare the current raw-Markdown calculation with `reading-time` on raw Markdown
and on extracted reader-facing text. Keep the reading speed fixed at 220 words per
minute to distinguish changes in extraction from changes in assumed speed. Round
up and retain the current minimum of one displayed minute.

The experiment used Node 24.21.0 and the npm-published `reading-time@1.5.0`, installed
in a temporary directory with lifecycle scripts disabled. The repository's existing
Markdown parser supplied the syntax tree. No article content left the computer.
The library's repository README describes development APIs that can differ from
the published version; this experiment used the actual installed package.

The candidate extraction counted prose, headings, lists, quotations, table text,
link labels, inline code, fenced code and referenced footnotes once. It excluded
Markdown syntax, link destinations, image alt text and unused definitions. It
included title/caption/description text from referenced blocks. A separate variant
excluded fenced code to measure that policy's effect. No fixed image, diagram,
code or equation time was invented.

The prototype fails on unsupported HTML, math or other directives. None occurred
in the four canonical pieces. Its block-caption behaviour was tested with a
synthetic example; the current pieces have no separate block files. It is not a
complete production extractor or a validated measure of comprehension time.

## Results

All columns below use 220 words per minute. Counts include the content categories
above, so they need not match editorial prose-only analysis.

| Piece | Current words | Library on raw Markdown | Extracted words | Current minutes | Extracted minutes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clever Enough to Find the Loophole | 2,719 | 2,717 | 2,706 | 13 | 13 |
| Chronicles, Chapter 1 | 1,351 | 1,349 | 1,338 | 7 | 7 |
| Chronicles, Introduction | 893 | 891 | 888 | 5 | 5 |
| Hello, Brave New World | 92 | 90 | 90 | 1 | 1 |

Simple whitespace counting of extracted text and the library returned identical
counts for all four pieces. Replacing the raw counter with the library alone
removed two boundary items per piece; it did not improve the source extraction.
The AI article's 13-word reduction corresponds to about 3.5 seconds. At the
library's default 200 words per minute, the cleaned article instead displays
14 minutes: that is a speed assumption, not an extraction improvement.

Chapter 1 contains two short code blocks, totalling 35 words by this counter.
Excluding them moves its extracted count from 1,338 to 1,303, changing the label
from 7 to 6 minutes. The underlying difference is only about 9.5 seconds and
crosses a rounding boundary. This is not evidence that code requires no reading
time, or that six minutes is more accurate.

Five small extraction checks passed:

- Formatting and a reference-link definition: 16 raw items versus 6 readable words.
- An unused footnote: 9 versus 2.
- A footnote referenced twice: 6 versus 4, counting the note once.
- A caption supplied by separate block metadata: 6 versus 12, exposing undercounting.
- Whitespace-only content: 2 versus 0; both still display the minimum one minute.

Repeating the complete calculation produced identical results. The small corpus
contains English prose and only two short code examples; it does not establish
accuracy for other languages, substantial code listings, mathematics or diagrams.

## Assessment

Adding `reading-time` alone is not justified by the measured benefit for this
corpus. Better extraction is the useful future improvement, particularly for
reference definitions and content in separate blocks. Existing parsing tools can
support it without a new dependency. A shared helper would also remove the
calculation duplicated in `scripts/prepare.ts` and `core/homepage.ts`.

Retain the existing calculation for now. If extraction is later implemented,
first define coverage for rendered blocks, footnotes, code and math, then use the
same helper in article metadata and listing cards. Do not claim that a more
elaborate deterministic formula establishes a more accurate reading duration.

## Local artefacts and references

The experimental script and full measurements are in ignored local files:
`exports/reading-time-experiment/compare.mts` and
`exports/reading-time-experiment/results.json`. The script uses the temporary
package at `/tmp/homepage-reading-time-comparison/node_modules/reading-time`.
After restoring that package if necessary, rerun locally with:

```sh
npm install --prefix /tmp/homepage-reading-time-comparison reading-time@1.5.0 --ignore-scripts --no-audit --no-fund
node --import tsx exports/reading-time-experiment/compare.mts
```

These ignored artefacts are not shipped with a fresh repository checkout.

- [reading-time source and documentation](https://github.com/ngryman/reading-time)
- [Alternative readability-based plugin](https://github.com/rehypejs/rehype-infer-reading-time-meta): investigated previously, not measured in this experiment.
