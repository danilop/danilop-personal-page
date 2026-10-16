# Chronicles code example editorial review

Status: reviewed on 16 October 2026; recommendations for Chapters 2–21 and the
Python appendix are not implemented. Chapter 1's separately authorised second
example removal is committed. Publication flags are unchanged.

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

## Completed review

The canonical book's `editorial/code-example-review-2026-10-16.md` contains a
separate assessment, recommendation and next step for every remaining sample.
Its companion JSON records source locations and hashes of displayed code and
surrounding context. The review covers 115 standalone included examples and all
16 inline appendix snippets: **131 samples, each reviewed individually**.

| Recommendation | Count |
| --- | ---: |
| Keep | 82 |
| Rework | 33 |
| Shorten | 5 |
| Remove from the narrative | 11 |

The 16 appendix snippets are all retained. The median narrative listing has seven
displayed lines and the longest has 37, so length is a local issue rather than a
reason to shrink every example. The review examined the code with its section and
surrounding prose, then compared lessons and spacing across chapters. It is not a
new historical-source audit or browser execution certification for every sample.

Proposed removals are the signed-number matrix (Chapter 3), repeated decimal carry
(5), elementary subroutine (9), repeated nested-list recursion (10), team-size pair
count (12), immediate callback invocation (15), active/waiting sum (16), repeated
local transaction and metadata-only accessibility output (17), and dictionary
memorisation and word-count handler (18). Preserve the substantive explanations
and relevant caveats when reviewing each removal.

The five listings proposed for shorter or staged presentation are memoisation
(Chapter 10), message dispatch (12), attention (19), and the agent loop and tracing
wrapper (21). The agent's real test execution, bounded loop and independent finish
check must remain; no canned success output should replace them.

## Applying the recommendations

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

The Chapter 1 tally improvement remains a proposal: name the animal count and offer
one prediction/change/step exercise. It has not been applied as part of this review.
