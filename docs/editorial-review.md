# Writing checks and Editorial review

Status: implemented locally in the author editor on 2026-09-24. These are advisory
reviews, not AI-authorship detectors, fact checks, or publication gates. Neither
review edits, saves, commits, publishes, nor applies suggestions automatically.

## Author workflow

Start `npm run preview`, select a piece, and choose **Review** beside **Preview**.
The review uses the current editor text, including unsaved changes. Scope defaults
to **Current piece**. **Current book / collection** uses the selected reading
context and adds the other saved pieces once each. Review is limited to 160,000
source characters; oversized selections are rejected rather than truncated.

**Writing checks** runs the existing local analysis engine: contiguous repeated
stem sequences, linguistic patterns, British spelling where appropriate, focused
prose rules, tags and reference checks. New focused rules include reader flattery,
formulaic signposts and additional stock framing. NLP and fixed phrase rules are
separate methods; neither proves authorship. Literal phrase rules are deliberately
narrow and suggestions may be legitimate writing in context.

Initialize the language runtime with `npm run quality:setup` if necessary. Missing
Python/models are reported as unavailable, not as a clean review. Code receives
syntax checks but is never executed by this editor action, even if the release
profile declares example executions. `npm run prepublish:check` remains the full
release workflow, including configured example execution and site validation.

**Editorial review** offers Claude Code, Codex and Pi. Options are enabled only
when the corresponding executable is found on the author server's PATH. Refresh
rechecks installation. Installed does not mean authenticated, compatible or funded;
CLI errors appear in the panel. Sign in through the CLI outside the editor.

Running Editorial review sends the chosen source snapshot and shared review prompt
to the selected CLI's model provider, using its account allowance. No request is
made automatically while typing, viewing the prompt or running Writing checks.
**Model and review prompt** exposes the exact outgoing prompt and an optional model
identifier. There is no automatic retry or fallback to another provider.

Results include the reviewed time, source fingerprints, explanations, quotations
and suggested local changes. Filter by repetition, style/clarity or technical /
incomplete checks. Use passage buttons to select the relevant source lines. All
stem-sequence groups and occurrences are available under a separate disclosure.
Accepted deterministic exceptions retain their explanation.

Edits make results out of date. Other saved pieces in a reviewed collection are
checked periodically for changes. Rerun before acting on stale results; stale or
unverified quotation locations cannot navigate. Model quotations are matched
against the snapshot, not trusted solely because the model supplied a line number.
Unstructured model responses remain readable as plain text, explicitly labelled
as lacking verified locations. No-finding results are not a quality guarantee.

**Cancel review** stops the subprocess; language checks time out after three
minutes and CLI reviews after ten. One job per review type can run on the server;
the UI runs one at a time. Download the current JSON report or find retained reports
in ignored `.authoring-state/reviews/`. The panel shows the latest run in this page
session; it is not yet a report-history browser. Reports may contain private
excerpts. They are excluded from Git and release output and are not auto-pruned.

## CLI implementation

`core/author-review.ts` shares extraction and Python analysis with the command-line
quality workflow. It captures unsaved text in memory without modifying sources.
Agent commands use fixed argument arrays and stdin, never shell interpolation or
an author-supplied executable. Jobs use temporary working directories outside the
repository, bounded output, cancellation and process timeouts.

- Claude Code: print/text mode, no built-in tools or inherited MCP servers, hooks
  disabled, no session persistence, no skills, no user/project settings sources.
- Codex: noninteractive, read-only sandbox, no approval escalation, shell tools and
  web search disabled, ephemeral session, user configuration/rules ignored and
  project-document discovery disabled. Authentication is retained.
- Pi: print/text mode, no tools, extensions, skills, prompt templates, context files
  or persisted session.

Authentication remains the installed CLI's responsibility. Claude/Codex review
invocations intentionally omit normal user/project customisation; specify a model
explicitly when needed. Pi retains its configured provider/model defaults. This is
an integration with supported CLI flags, not a universal sandbox for arbitrary
third-party executables. No permission-bypass flags are used. Older CLI versions
may need updating if they do not support these options.

The endpoint shares the author's existing loopback, Host/Origin and token checks.
Outputs are inserted as text, never executable HTML. Source validation and review
state are independent of the editor's Save and Undo history.

## Prompt design and sources

The provider-neutral prompt is versioned in
[editorial-review.md](../authoring/editorial-review.md). It asks for restrained,
evidence-based findings and concrete edits in the same response, with exact source
passages and minimal revisions. Missing facts or author decisions require a specific
question instead of invented wording. Explanation and replacement prose are separate.
It checks
repetition, vague claims, inflated framing, mechanical contrasts, repeated punchy
fragments, rhetorical question/answer patterns, forced triples, decorative
metaphors, over-explanation and other mannerisms. It preserves technical terms,
useful uncertainty, code, quotations, citations, voice and language variant. It
permits an empty findings list and prohibits an AI-authorship score.

The specific editorial checklist is this project's synthesis, not a universal
Anthropic blacklist or a claim that one prompt has been validated across all
models. Anthropic's [prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
informs the use of clear task boundaries, positive style instructions, examples
and explicit output structure. Review quality remains model-dependent.

CLI behavior was checked against installed help and primary documentation:
[Claude Code](https://code.claude.com/docs/en/cli-reference),
[Codex noninteractive mode](https://developers.openai.com/codex/noninteractive/),
[Codex configuration](https://developers.openai.com/codex/config-reference/), and
[Pi](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md).
See [verification](verification.md) for tested versus unverified behavior.

Finding links select the exact source phrase or word when the checker supplies a
range, including each repeated stem occurrence on the same line. Sentence-level
findings select their sentence; spelling and stock-phrase findings select only
the relevant word or phrase. If an exact range or quotation cannot be matched,
the editor places a caret at the reported line and explains the limitation; it
does not highlight an unrelated full line. Stale findings remain non-navigable.

## Finding-specific assistance

**Review edit** opens a verified replacement already supplied in the initial review.
**Draft an edit** converts older generic advice into a proposal on explicit request;
**Answer question** first collects missing information. Writing-check findings use
**Suggest a fix**. For new drafting requests, select one or more installed
agents, customize the prepared instructions and context, then **Find a fix**.
Each agent receives the same input and uses its account allowance. Compare named
proposals and edit a replacement. Local writing checks automatically compare the
selected suggestion with the original before **Apply to editor** is enabled.
A compact summary exposes new and removed findings, with coverage/details on
demand; warnings are advisory, failed checks can be retried. No AI request is
made for this comparison. Explicitly **Apply to editor**; this creates
one undo step without saving. Failed agents do not discard successful results.
Stale source blocks application. Findings without verified text receive advice.
See [the interaction design and limits](finding-fixes-design.md).

The editor retains separate Writing checks and Editorial result sets per file for
the current session. Run settings collapse after completion; findings are grouped
by rule and metadata advisories have their own filter. **Mark as addressed**
records a manual fix; **Keep as written** records a decision to retain the original.
Both move the finding out of the open queue into a collapsed section with
**Reopen finding**. Decisions belong to this review in the current editor session;
new reviews start with open findings so recurring problems are not suppressed.
Passage buttons name the exact word/phrase.
Following application, the pre-apply local result is reused, with an explicit
applied state and Undo change. No implicit editorial rerun occurs.

### Reuse wording already supplied by the reviewer

The initial review should supply the issue, explanation and exact before/after edit
in one request whenever enough information is present. **Review edit** opens that
pair for comparison and local writing checks, without another agent request.
The proposed wording remains editable. Generate alternatives is optional; Apply
changes only the unsaved editor, with Undo available.

Free-text advice is never treated as replacement prose. Older reviews use **Draft
an edit**, which sends their advice and selected passage to an agent only when
requested. A question must be answered before drafting; its answer is carried in
the request. Unverified quotations cannot be applied, and changing the selected
scope or answer clears any prior draft. See [finding fixes](finding-fixes-design.md).

### Make your own change

Use **Edit myself** in the finding detail to return to the source passage, or edit
the article directly. After your edit, use **Mark as addressed** on the finding
(or its detail view). This remains available when editing makes the report stale;
unchanged, unambiguous passages remain navigable, while changed/missing targets
and stale generated suggestions require manual review or a fresh run. Addressed is an
author decision, not an automated pass, a save, or proof of factual correctness.
Progress shows open, addressed, and kept counts for the entire current report;
handled sections respect the selected filter. Reopen reverses the decision only,
not the text edit. Editor Undo reverses text separately. Downloaded reports include
author decisions separately from the unchanged findings. Session decisions do not
persist after reload or transfer to a new report.

After an edit, passage navigation is evaluated per finding rather than disabled
for the entire report. Unchanged ranges before/after edits keep their identity;
other exact quotations relocate only when unique or supported by unchanged nearby
text. Missing or ambiguous quotations are disabled individually. For another piece,
the match is checked when it opens. The report still warns that its coverage and
suggestions predate the edits; navigation does not certify the finding is current.
