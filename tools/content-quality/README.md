# Local content-analysis engine

This Python worker consumes structured JSON from `scripts/quality.ts`. It never
scans a book checkout, rewrites prose, or downloads a model during analysis.

Run `npm run quality:setup` once, then `npm run quality` or the combined
`npm run prepublish:check`. The source selection, report, profiles, exceptions,
and example declarations are documented in [content quality](../../docs/content-quality.md).

## Reuse and changes

The British spelling pairs in `british-spellings.json` were extracted directly
from the author's Chronicles of Computation checker. `upstream.json` records the
source hashes of this table and the book tools whose rules informed this adapter.
No machine-specific book path, chapter naming scheme, inherited refrain exceptions,
NLP download helper, or automatic editing function is imported at runtime.

The book's POS-based prose-health approach is extended with spaCy dependency
parsing, lemmatization, sentence segmentation, and named-entity recognition.
Technical-agency review uses a parsed subject/verb relation rather than proximity.
Passive constructions remain candidates, including legitimate scientific prose.
The British spelling rule skips predicted proper names and named entities, but
these predictions are imperfect. The Markdown adapter excludes explicit block
quotes, double/curly-double quoted passages, code, footnotes, and link destinations.

Snowball stem n-grams remain an independent, transparent count layer. All repeated
3–8 word stem sequences and their occurrences are retained by default. The HTML
shows at most 60 groups; JSON retains the full inventory. The editorial queue
prioritizes sequences of five or more stems and suppresses some nested duplicates;
it does not apply those suppressions to raw counts. The algorithm never joins
pieces, prose blocks, sentence punctuation, or excluded inline-code boundaries.
Stemming matches morphological forms, not synonymous meanings or plagiarism.

## Reproducibility

`requirements.txt` locks all Python packages and the model wheel with hashes.
`requirements.in` defines the intended dependency family. Setup uses Python 3.13
in `.venv-quality`; model and library versions are included in every report.
The report runner fails explicitly if the required runtime/model is unavailable.
It performs no silent stemming fallback.

To deliberately refresh dependencies, review the resulting lock diff and rerun
both test suites before using new editorial output:

```sh
uv pip compile tools/content-quality/requirements.in \
  --python .venv-quality/bin/python --generate-hashes \
  --output-file tools/content-quality/requirements.txt
npm run quality:setup
npm run test:quality
npm test
```

The standard website build has no Python/model dependency. Local pre-publication
review is a separate combined command, so a missing model cannot silently pass a
content review or unexpectedly break the existing Node-only deployment pipeline.

## Tests

`npm run test:quality` exercises the actual installed language model and stemmer,
source-location/count boundaries, inflections, dependency distinctions, language
profiles, deliberate fragments, expected-output failures, and missing model behavior.
It fails if the model is absent; it does not silently skip linguistic tests.
TypeScript tests in `test/content-quality.test.ts` cover Markdown extraction,
source baselines, review decisions, private report output, and unavailable runtimes.

## Reference documentation

- [spaCy linguistic features](https://spacy.io/usage/linguistic-features)
- [spaCy English models](https://spacy.io/models/en)
- [Snowball stemming algorithms](https://snowballstem.org/)

Grammar and entity predictions are review aids, not truth judgments. The small
English model does not provide semantic paraphrase detection. Historical/source
verification and layout proofing remain separate.
