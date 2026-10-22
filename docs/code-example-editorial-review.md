# Chronicles code example editorial review

Status: reviewed and applied individually on 16 October 2026 in the canonical
book. The existing Chapter 1 article is synchronised; later chapters have no
corresponding articles yet. Publication flags are unchanged. Release verification
is recorded separately from source and preview checks.

## Reader-facing requirement

Each narrative example should demonstrate one idea from its chapter through a
calculation, contrast or observable behaviour. It should be short enough to keep
the narrative moving, but readable rather than compressed. A runnable block that
only repeats an answer already given in prose may be better removed. A longer
algorithm can earn its space when following its steps is the point.

An obvious result is not enough to justify a narrative example: running or changing
it should reveal a mechanism, consequence, contrast or limitation. Do not add
complexity merely to make an elementary result look interesting.

All book samples, including appendix snippets and website copies, must use Python
built-ins and the standard library only. No third-party imports, package installation,
external services or credentials are required. This applies to future replacements
as well as retained examples. Authoring/build tools have separate dependencies and
are not reader prerequisites. Standard-library membership alone does not establish
browser compatibility; verify each imported example in the browser runtime too.

Do not impose a fixed number per chapter. Roughly 5–15 displayed lines is a useful
starting range; around 20, review the scope, and above 30 consider staged
presentation with a complete companion file. These are editorial prompts, not
validation limits. Preserve necessary checks, assumptions and limitations.
Likewise, nearby examples should teach distinct things; do not add filler to
satisfy a spacing target. Elementary appendix snippets serve as syntax references
and have a different purpose from the historical narrative.

## Original review

The canonical book's `editorial/code-example-review-2026-10-16.md` contains a
separate assessment, recommendation and next step for every remaining sample.
Its companion JSON records source locations and hashes of displayed code and
surrounding context. The review covers 115 standalone included examples and all
16 inline appendix snippets: **131 samples, each reviewed individually**.

| Recommendation            | Count |
| ------------------------- | ----: |
| Keep                      |    82 |
| Rework                    |    33 |
| Shorten                   |     5 |
| Remove from the narrative |    11 |

The 16 appendix snippets are all retained. At review time, the median narrative
listing had seven displayed lines and the longest had 37, so length is a local issue rather than a
reason to shrink every example. The review examined the code with its section and
surrounding prose, then compared lessons and spacing across chapters. It is not a
new historical-source audit or browser execution certification for every sample.

The review proposed removing the signed-number matrix (Chapter 3), repeated decimal carry
(5), elementary subroutine (9), repeated nested-list recursion (10), team-size pair
count (12), immediate callback invocation (15), active/waiting sum (16), repeated
local transaction and metadata-only accessibility output (17), and dictionary
memorisation and word-count handler (18). The implementation preserves substantive explanations and relevant caveats.

The five listings selected for shorter or staged presentation were memoisation
(Chapter 10), message dispatch (12), attention (19), and the agent loop and tracing
wrapper (21). The agent's real test execution, bounded loop and independent finish
check must remain; no canned success output should replace them.

## Future revisions

Work on the canonical book first, one sample at a time. Read each revised passage
in context before proceeding. Update includes, the example index and concept tests
when a file changes or is removed; retain complete companions when a printed
listing is staged rather than deleted. Execute changed examples with both supported
Python minor versions and verify their meaningful input variations and boundaries.
Inspect code wrapping and page breaks in book exports.

Import only the affected website pieces, preserving stable identities, draft flags
and unrelated authoring work. The reusable code runner remains the default for
Python fences; verify Run, Step, Restore original and Copy code for changed samples.
Re-review source-bound spoken explanations and regenerate affected narration and
book audio before publication. Review proposals alone do not change source, audio
or publication state.

## Applied outcome

The canonical `editorial/code-example-implementation-2026-10-16.md` and paired JSON
record every outcome: 62 programs revised, 58 samples retained (including the 16
appendix snippets), and 12 narrative programs removed. The layout rework chose its
recommended static table, accounting for the additional removal beyond the original
eleven. The resulting inventory is 104 included programs, 16 inline snippets and one
optional standalone attention companion.

Changed demonstrations expose carry propagation, mixed calendar weights, table
lookup, rounding error, forward-label relocation, search intervals, logical clocks,
transitive recalculation, a testing counterexample, retry jitter, reconciliation and
unsupported retrieval. Retained programs received focused output labels or visible
intermediate state where useful. No external package or service was introduced.

Memoisation and dispatch are shorter. Attention follows one query, with the original
all-position extension preserved as a companion. The tracing example executes both
success and failure paths. The agent remains one complete, copyable 31-line program
with two-stage reading guidance, rather than dependent fragments; its actual tests,
completion recheck, unknown-action rejection and step bound remain intact.

Example filenames and numbers remain stable. The strict audit permits gaps from
removals while rejecting duplicates, reversed ordering, missing files and stale index
entries. It now checks standard-library imports in companions and inline snippets too.
The standalone runner includes companions and executes with `-I -S`.

The Chapter 1 tally now names `animals` and offers a prediction/change/step exercise.
The article's stable `tally` activity ID is preserved with a reviewed source hash.
Its spoken explanation has been re-reviewed and the article and preview audiobook
regenerated. No later chapters or unrelated drafts were imported or published.

The subsequent [native PDF proof](verification.md#chronicles-native-pdf-proof--16-october-2026)
verified all 120 printed listings against source characters and kept each listing
on one page. The canonical build now rejects missing characters, split listings
and overflow; a real XeLaTeX regression covers long syntax-highlighted tokens.
These layout changes do not alter example behaviour or narration.
