# Writing style

Status: agreed with the author on 23–24 October 2026. It applies to articles and
book chapters on the site, and to captions, alternative text and summaries. The
checks named here are implemented; none of them edits text automatically.

## Voice

- Articles are in the first person, as Danilo. Book chapters keep the book’s
  own voice. Say what happened, what was measured and what is still uncertain.
- Prefer concrete subjects, plain verbs and sourced stories. A claim names its
  source or is marked as unverified.
- Humour is dry, British and restrained. It comes from real details, such as a
  job’s name or a tool’s error message, never from invented asides.
- Use British English (`language: en-GB`): “organise”, “behaviour”, “programme”
  for a plan and “program” for software.
- The `summary` is the subtitle. It appears beneath the title, serves as the
  search and social description, and is spoken after the title in the article’s
  narration. Write one plain sentence that reads well aloud and does not repeat
  the body’s opening sentence.
- Name things exactly. Spell out “Raspberry Pi” for the computer, including in
  captions and alternative text. “Pi” alone is reserved for the Pi coding agent.

## Habits to avoid

These read as model-written prose. One instance is normal; several in a paragraph
are what readers notice.

- Clauses joined with “, and”. Split them into two sentences or tighten them.
  Keep “and” for short lists and closely linked verbs.
- Colons that stage a reveal, trailing “, …ing” clauses and em dashes for asides.
- Contrasts written as “X, not Y”, “Y rather than X” or “not just X but Y”.
- Groups of three by default; let the content decide how many items a list has.
- Warm-ups (“Here’s the thing”), self-commentary (“It was a reminder that”,
  “turned out”), recaps (“In short”) and aphoristic closing lines.
- Inflated vocabulary: delve, pivotal, underscore, testament, showcase, foster,
  seamless, robust, “serves as” for “is”.
- Heavy bold, bold-label bullets and emoji headings.

## Typography

| Use                        | Character   | Example                                   |
| -------------------------- | ----------- | ----------------------------------------- |
| Apostrophe                 | ’           | Stockholm’s, don’t, the researchers’ view |
| Quotation, cited title     | “ ”         | a notice such as “Invalid token”          |
| Quotation inside another   | ‘ ’         | “An AI agent moved to ‘Permission’”       |
| Number, page or date range | – (en dash) | pages 671–680, 2006–07                    |
| Aside                      | , ( ) or .  | never an em dash (—)                      |

- Punctuation follows the quotation mark unless it belongs to the quotation.
- Keep an em dash only where it is part of a quoted title.
- Straight quotes belong in code, Markdown syntax, YAML and directive attributes
  only. Front matter values follow the prose rules.
- Use ordinary spaces. Invisible characters are never allowed: zero-width spaces
  and joiners, direction marks and overrides, soft hyphens, byte-order marks,
  Unicode tag characters and control characters. Text pasted from a chat window,
  a PDF or a web page can carry them, and some can serve as hidden marks.
- Double quotes for quotations match both books: the Chronicles and Good Enough
  manuscripts use “ ” in more than 97% of their quotations.

## Checks

| When           | Command                                     | What it covers                                                                                                                                                              |
| -------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| While writing  | `npm run quality -- --piece-file <path>`    | The [writing checks](content-quality.md): repetition, British spelling, the habits above, and the `hidden-character`, `unusual-space`, `em-dash` and `straight-quote` rules |
| While writing  | **Review → Editorial review** in the editor | The [editorial review](editorial-review.md) prompt in `authoring/editorial-review.md`, run by Claude Code, Codex or Pi                                                      |
| Every commit   | pre-commit gate, `npm run verify:static`    | `hidden-characters` scans every text file under `content/` and `authoring/`, including code, quotations and notes that the prose checks skip                                |
| Before release | `npm run prepublish:check`                  | The full writing checks with the release profile                                                                                                                            |

The writing checks read the report at `exports/content-review/report.json`; the
terminal shows only a summary. Character findings in prose cover body text and
table cells. Quotations in double quotes, footnotes and code are outside the prose
checks, so the commit gate scans whole files for hidden characters.

## Books

Book chapters on the site stay in sync with their original manuscripts:
Chronicles of Computation in `~/Documents/MyBooks/ChroniclesOfComputation/manuscript`
and Good Enough in `~/Documents/MyBooks/LocalMinimum/local_minimum_book/manuscript`.
Make every chapter edit in both places, including typography fixes. The original
manuscripts mix straight and curly apostrophes outside the chapters published so
far; align each chapter when it is serialised.
