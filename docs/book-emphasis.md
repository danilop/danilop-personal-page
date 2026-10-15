# Emphasis in books and serialised articles

Status: included in this website release, tested locally on 15 October 2026;
not submitted for a Leanpub preview. These conventions apply to the canonical source
and its imported articles. Syntax is specified in [authoring format](authoring-format.md#quiet-paragraph-callouts).

## Editorial choices

A quiet callout highlights an existing explanation in its original place. It is
read once, including in narration. It is not a duplicated pull quote or an
optional sidebar. Keep the surrounding argument, qualifications and citations
intact; leave headings, chapter openings and transitions to their existing roles.

Working guidelines, to be judged in context rather than enforced as quotas:

- Usually zero or one callout in a short chapter and one or two in a longer one.
  Review a third; most sections should contain none. Do not require equal counts.
- Prefer one paragraph of about 40–90 words; review anything over 120 words.
- Aim for at least 1,000 prose words between callouts in continuous reading;
  flag gaps below 600, including across chapter boundaries. Measure between the
  end of one and the start of the next. Inspect proximity to code and figures too.
- Choose a useful distinction, consequential limit or reusable principle. Do not
  highlight every example conclusion merely because it can be summarised.
- Keep short closing material, references and indexes free of unnecessary boxes.

These numbers are editorial choices for this book, not externally established
optimal values. The [Australian Government Style Manual](https://www.stylemanual.gov.au/structuring-content/text-boxes-and-callouts)
provides the broader principle of restraint; its guidance on optional sidebars is
not a reason to remove these paragraphs from the reading sequence.

## Bold and italics

The existing book uses italics for introduced terms. Keep that convention and
use it in standalone articles too: italicise a term where it is first introduced
or defined, then use ordinary text. Acronyms and product/model names remain in
ordinary text. Do not mechanically italicise every technical word.
Use `**bold**` sparingly for a short critical warning, operational requirement or literal interface label,
not routinely for every technical term, person or date. Avoid entire bold
sentences/paragraphs, pseudo-headings, combined bold/italic treatment and extra
bold inside a callout. There is no quota. This pass added no bold to chapter prose. Existing Python-version emphasis in
the introduction remains a setup requirement.
[Google's documentation style guide](https://developers.google.com/style/text-formatting)
is another example of a deliberately restrictive bold policy; our book's rules
remain a separate editorial choice.

Ordinary Markdown strong/emphasis works in the website, Pandoc HTML/EPUB/LaTeX,
and Markua exports. Narration reads the words without announcing the formatting
or promising a vocal-stress change. Meaning must survive without visual styling.

## Standalone article review

“Clever Enough to Find the Loophole” now uses italics for 14 introduced terms
in place of bold; six acronym/model/product mentions use ordinary text. This
formatting-only edit changes no wording, links, publication dates or narration.
It is included in this release. No callouts were added to the article in this pass.

## Chronicles placement review

The review examined the structure of all 21 chapters, section conclusions and
candidate paragraphs in surrounding context, plus the introduction, appendix,
epilogue and reference apparatus. It was an emphasis review, not a new factual
audit of every sentence.

There are 33 callouts: one in the introduction, one each in Chapters 1–9 and 20,
and two each in Chapters 10–19 and 21. Thirty-two wrappers were added in this pass
without changing the underlying prose. The longest selected paragraph has 86
words; the smallest gap across the book is 1,038 prose words. No callouts were
added to the appendix, epilogue, references or index. The canonical book's
`editorial/emphasis-conventions.md` records the individual selections and reasons.

Only the introduction and Chapter 1 currently have imported HomePage pieces.
Their matching callouts were updated without changing their publication settings
or importing the rest of the book. Later imports should retain the canonical
wrappers. The original book remains the editorial source of truth.

## Rendering and verification boundaries

The website uses a sanitised `div.text-callout` in normal document order, ordinary
typography, a restrained tint and a left rule. Pandoc uses `tools/callouts.lua`
with HTML/EPUB CSS and a breakable LaTeX environment. Prose-analysis tools ignore
wrapper lines. HomePage's Leanpub exporter converts the source wrapper to native
Markua `{aside}` / `{/aside}`; do not send Pandoc fences directly to Leanpub.
A remote Leanpub preview is still required to confirm its actual page styling.

Source remains Pandoc Markdown. Changing the whole authoring system to Markua,
Quarto or MyST would add migration work without being needed for this feature.
See [verification](verification.md) for checks and remaining PDF limitations, and
[narration](article-narration.md) for source-bound explanation review and reuse.
