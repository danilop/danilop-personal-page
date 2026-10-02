# Suggest a fix — interaction design

Status: implemented locally, updated 2026-10-01, with the limitations below. Explicit
saving and publication remain separate.

## Entry and visual treatment

Writing-check findings, including expanded stem groups, get **Suggest a fix**.
Editorial findings with a concrete replacement use **Review edit**; generic advice
uses **Draft an edit**, and missing information uses **Answer question**. Each
opens a focused detail view
inside the right-hand Review panel. Keep the writing pane visible. A quiet **Back
to findings** link restores the prior filter, expanded groups and scroll position.
Avoid a modal or a second floating assistant. Reuse the current serif headings,
forest-green primary buttons, neutral surfaces, thin rules and generous spacing.
On narrow screens the detail occupies the existing companion pane; avoid nested
horizontal scrolling. The generated design concept illustrates the proposed result
state with synthetic prose, not a live implemented screen.

Show the issue, exact highlighted target, source piece, and surrounding context.
For repeated stems, offer an occurrence list with actual wording and sentence
context. Default to the occurrence the author last selected; otherwise require a
choice rather than silently rewriting all instances. Offer **Review all occurrences**
explicitly; propose which to retain and which to change. Necessary terminology
and deliberate repetition may need no change.

## Reuse an editorial suggestion

The initial editorial review is responsible for both identifying an issue and
providing a concrete edit in the same response whenever the source is sufficient.
It preserves language, tone, voice, factual meaning and uncertainty. The explanation
stays in `suggestion`; prose belongs only in `replacement.after`, paired with an
exact, contiguous `replacement.before` containing the highlighted excerpt. Deletion
uses an empty `after`. These verified pairs open directly in the comparison/check
view, without another agent request. Alternatives are optional.

When facts, intent or an author decision are missing, the reviewer supplies a
specific `question` and `replacement: null`. The question takes precedence even if
malformed output also contains a replacement. **Answer question** opens an answer
field; drafting is disabled until it is filled. The server enforces this too.
The answer, advice, issue and selected source/context go into the explicit drafting
request. If information is still insufficient, the model must ask a further question
and return no changes. The author can answer using the follow-up direction field.

Older free-text suggestions remain advice, even when they look like quoted prose.
**Draft an edit** keeps that advice visible, offers verified passage/sentence/paragraph
scopes and generates a concrete proposal only when requested. Scope selection never
converts advice into a replacement. Unmatched quotations cannot be drafted or
applied automatically; edit manually or rerun the review. No heuristic attempts to
distinguish prose from instructions in unstructured legacy suggestions.

Only a verified replacement creates an editable proposal and exposes Apply.
Local before/after writing checks must complete for the current proposal; source
changes block applying. Changing the answer or drafting scope discards the previous
draft/check result. Application stays unsaved, supports Undo, and never triggers a
new editorial review implicitly.

## Prepare

Use **Compare agents** checkboxes (installed Claude Code, Codex or Pi), selecting
one or more, and **Approach**. For individual findings:

- **Minimal edit** (default): smallest defensible change.
- **Rephrase**: allow a new sentence structure while preserving meaning.
- **Assess first**: decide whether the finding needs a change.

Remember selected agents locally; never silently switch to another provider.
Disable unavailable agents and explain authentication/usage failures at runtime.
A **Customize instructions** disclosure contains:

1. A prepared, editable instruction field, filled for the finding and approach.
2. **Reset to default** and an explicit **Remember my instructions** option.
   Persist style preferences only, not article excerpts or occurrence-specific text.
3. Context selection: **Surrounding paragraphs** by default, **Whole article**
   explicitly available. For all-occurrence analysis include each selected
   occurrence's context, including named peer articles when applicable.
4. Optional model override and a read-only **Exact request** preview.

Show what will be sent and to which provider immediately above **Find a fix**.
Prompt inspection does not send anything. Custom instructions are separate from
immutable output/source-validation rules and quoted source data. Treat manuscript
and model-generated finding text as data, never tool instructions.

Prepared editable instructions:

> Address this finding only if a change improves the passage. Prefer the smallest
> edit that preserves meaning, factual claims, uncertainty, voice and language
> variant. Keep technical terms, citations, quotations, links and code intact.
> Avoid replacing necessary repetition with awkward synonyms or introducing stock
> phrasing, rhetorical flourishes or unsupported claims. Explain briefly why the
> proposed change helps. If the original is better, recommend keeping it.

The request adds the finding's actual rule/message, exact target(s), relevant
context and approach. For repetition it asks which occurrences should remain.
The model returns exact before/replacement pairs and a short rationale, or a
no-change recommendation. It cannot edit files or run tools.

For **Review all repetitions**, label the default approach **Small changes per
passage** and explain: **Keep each edit small. Return all worthwhile fixes together.**
Require a full pass over all reported cases and a keep/change assessment for every
paragraph target. Validate complete coverage and consistency with replacements.
Small edits must not be interpreted as a cap on their number. Keep batch preferences
separate from single-finding preferences, including the Reset action; no edit quota.
Offer **Rephrase where useful** as the only alternative for batch review, with
matching helper text and prompt instructions allowing broader sentence changes.
Omit **Assess first** here: assessment is required in both batch approaches.

## Compare and apply

While running, show **Finding a fix…** with **Cancel**, leaving the source usable.
One comparison batch at a time, with one request per selected agent running
independently. Every agent receives the same snapshot and preferences. Each uses
its own allowance. Failed requests do not discard successful proposals. Named
proposal buttons let the author compare results; only the chosen proposal applies.
Capture the input source and its revision.

Validate generated fixes before displaying them: response schema, target indexes,
verbatim originals and unique targets must all pass. Retry invalid output once
with validation feedback and the unchanged request, agent and model. Keep rejected
output out of the proposal panel. A second invalid response fails visibly without
applying anything. Accept valid no-change responses immediately; do not retry CLI
execution failures or cancelled jobs. Disclose that a validation retry uses the
agent's allowance. Source validation cannot certify factual or editorial correctness.

Show **Original** and **Suggested** with word-level changes, a short rationale,
and an editable replacement field. Offer **Apply to editor**, **Try again** and
**Keep original**. Try again accepts a short direction and includes the prior
suggestion; it must preserve earlier attempts for comparison. Keep original is
not a permanent exception or a claim that the finding is wrong.

Apply changes only the exact verified target in unsaved editor text and creates
one undo step. Never save, commit or publish automatically. An applied finding is
not automatically marked resolved. Before application, the selected proposal is
checked locally against the original in the selected article/collection scope.
A compact Writing check summary shows new, no-longer-reported and remaining
findings, with details and coverage collapsed. Editing a replacement or changing
included targets refreshes the check after a short pause. Apply waits for checks;
findings and incomplete coverage remain advisory. Failed checks offer Retry.
No editorial agent is rerun automatically. Other reviews become stale after Apply.

For multiple occurrences, show per-change selection and one deliberate **Apply
selected changes** action for the current article. Check all ranges first, reject
overlaps, then replace from end to start in one undo transaction. Suggestions for
another article have **Open article to apply**; this version does not silently
write multiple files. Changing the source while the agent works makes results
stale; keep them readable but disable Apply until a fresh request is made.

## Findings without replaceable prose

Every finding can request help, but not every finding should offer text replacement.
Missing analysis tools, metadata/tag suggestions, missing files or unverified AI
quotes return an explanation and proposed steps. Label this **Suggested next step**,
with **Copy instructions** or an existing relevant settings/navigation action.
Do not turn operational advice into executable commands or apply it automatically.
For broad paragraph/sentence findings, make the larger proposed replacement scope
visible before generation and in the comparison. Never use approximate global
search-and-replace. Exact matches, source identity and captured ranges are required.

## Accessibility and verification requirements

- Keyboard-operable entry, back, occurrence selection and action controls; visible
  focus; restore focus to the originating finding on Back.
- Announce running/completed/error state without moving focus unexpectedly.
- Diff uses labels and deletion/insertion styling, not color alone.
- Verify deterministic and AI findings, exact and multiline spans, repeated phrases
  on one line, Unicode, stale source, cross-article findings, overlapping edits,
  cancellation, absent agents, invalid model output and undo/redo.
- Test desktop and narrow viewports; no manuscript edits or provider calls merely
  from opening a finding or customizing a prompt.

## Implementation limits

All-occurrence selection currently covers the current article; another article can
be selected in the Passage menu, which opens it before requesting a fix. There is
no automatic cross-file application or whole-collection fix request. Differences
mark the changed token span, rather than computing a full minimal diff. Context
defaults to the paragraph(s) containing the targets; whole-article context is an
explicit option. Operational findings without targets receive advice only.
Writing checks run automatically on proposals before Apply. Recheck writing is
also available explicitly; Editorial review remains its own request. Attempts live in the current detail session and are reset when switching
findings/occurrences. They are not persisted across reloads. Replacement edits are
kept when switching agent proposals.

## Consolidated workspace behavior

Implemented: request settings collapse when proposals arrive. Named proposal
selectors show unchecked/checking/completed status for each attempt. The selected
proposal is checked before Apply; similar excerpts from the same rule are reported
as changed findings, not as evidence of resolution. This similarity match is
heuristic.

After Apply, a stable Applied state replaces the request actions, Keep original
is hidden, and **Undo change** restores the original if no later edits intervened.
When there are later edits, normal Undo history is used. The successful local
check result becomes the current writing-check report; Editorial results remain
separate. No provider is rerun automatically. Save remains explicit.

## Author-written fixes and addressed findings

The detail view offers **Edit myself**, returning to the quoted source without an
agent request. The author can change the prose directly or replace the proposed
wording in its editable field. **Mark as addressed** is available on finding cards
and their detail view, including after edits make the report stale. It records a
manual decision for that report only and never applies, saves, or checks text.
Addressed findings leave the open queue and appear in a collapsed Addressed
section with **Reopen finding**. Keep as written has a separate section. Neither
decision suppresses findings in new reviews; both last for the current editor
session. Reopen changes the review decision; normal Undo changes the manuscript.
Raw repeated-sequence inventory remains available as supporting evidence.
