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

If Claude reports an expired OAuth session while a terminal session still works,
check a freshly launched `claude auth status --text` in that terminal. An already
running session does not establish that a new noninteractive process can sign in.
Stop preview and start `./preview.sh` from the working terminal to inherit its
current environment. Compare the executable with `type -a claude` and check
whether the terminal uses `CLAUDE_CONFIG_DIR` or a shell alias/function; the editor
launches the executable on its PATH directly, without an interactive shell.
Do not paste credentials into the editor or repository. If the fresh CLI also
reports an expired login, re-authenticate through Claude's terminal login flow.
See [Claude authentication](https://code.claude.com/docs/en/authentication).

When all fix providers fail, the panel reports that no new proposal was returned
and retains each provider's error. It does not tell the author to compare missing
proposals; any earlier successful proposals remain available.

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

After either kind of review, **Run writing checks again** or **Run editorial review
again** remains beside the results. Reloading the source with **Reload file**
refreshes review freshness and opens settings; it does not automatically run local
checks or send a model request. An active job still disables new requests. If its
status cannot be retrieved (for example, after a server restart), the editor marks
the run failed, explains the error and re-enables both review tabs and retry
controls. Late replies from a previous run cannot replace a newer run's status.

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

- Claude Code: reviews and fixes use JSON mode with schema-constrained
  `structured_output`; illustration briefs use text mode. No built-in tools or
  inherited MCP servers, hooks disabled, no session persistence, no skills,
  no user/project settings sources.
- Codex: reviews, fixes and image-generation results use `--output-schema` and
  the final-message file; illustration briefs use plain text. Noninteractive,
  read-only sandbox, no approval escalation, shell tools and web search disabled,
  ephemeral session, user configuration/rules ignored and project-document
  discovery disabled. Authentication is retained.
- Pi: reviews and fixes use JSON event mode; illustration briefs use text mode.
  No tools, extensions, skills, prompt templates, context files or persisted
  session.

`core/author-structured.ts` handles these data responses consistently. Claude must
return a successful envelope with a structured result. Codex schemas are private
files in the job's temporary directory and are removed with it; optional properties
become required nullable fields to meet its schema requirements. Pi has no equivalent
schema flag: the app reads the final completed assistant message only after the run
settles, ignoring progress, thinking and superseded retry output. Its JSON event
format does not guarantee that the answer itself conforms to the requested schema.
Older Pi versions without the completion event need updating.

All decoded answers still pass local schema validation. Exact source matches,
duplicate-target checks and image-file validation remain necessary: valid JSON does
not make an edit or a path trustworthy. Malformed or multiple JSON objects are never
silently combined or selected. Failed/incomplete provider results fail the request;
a completed editorial answer that fails content validation remains readable as an
unstructured review with no verified findings. Fixes and image results fail without
applying changes. Plain-text illustration briefs and browser text generation do not
need output schemas. See
[Claude structured output](https://code.claude.com/docs/en/headless#get-structured-output).

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

## Review all repetitions

After **Writing checks**, expand **All repeated stem sequences** and choose
**Review all repetitions in this article**. Choose one or more installed agents
(Claude Code, Codex or Pi), then **Review repetitions**. Opening the panel makes
no model request. The button uses every group with at least two occurrences in
the current article, including nested matches; it does not silently cap the list
at the first displayed rows. Collection-wide reports are filtered to that article
and do not send or edit its peers.

Each selected agent receives the full article, the repetition groups and verified
source positions. The prepared prompt asks it to consider approximate word and
line distance, paragraph/section proximity, repeated explanations, technical
terminology, experimental conditions, ordinary grammar, deliberate emphasis and
callbacks. Raw counts are candidates, not errors. The goal is better reading,
not fewer matches. It may keep every occurrence, and should explain important
keep decisions as well as the changes it proposes. **View exact request** shows
the complete prompt before sending.

This is a complete pass, not a request for one representative fix. The default
approach is labelled **Small changes per passage**, with the explanation
**Keep each edit small. Return all worthwhile fixes together.** Minimality concerns
the size of each change, not how many relevant cases are addressed. The prompt
asks the agent to assess every affected paragraph, include all worthwhile edits
at once and check the combined proposal for remaining relevant fixes. It must
not invent changes to meet a quota; zero or one can still be a valid result.

The other batch option, **Rephrase where useful**, permits restructuring sentences
or supplied paragraphs while preserving meaning and voice. Its helper text and
server prompt reflect that broader editing scope. **Assess first** is omitted
from batch review because both options already assess every passage before
proposing changes. Individual findings retain their existing three approaches.

Batch instructions are remembered separately from single-finding instructions,
so a saved instruction to fix only one finding does not carry over. **Reset to
default** restores the complete-pass prompt when reviewing all repetitions.

Overlapping phrases share one paragraph target, preventing conflicting edits to
the same passage. Only paragraphs containing reported repetitions are editable;
other article text provides context. Returned replacements must match those
paragraphs exactly. Proposals remain editable and individually selectable, and
local writing checks still precede **Apply to editor**. Apply leaves changes
unsaved; **Save** is separate. Existing Undo and stale-source protections apply.

Generated fix responses are checked before display for valid structured output,
supplied target indexes, verbatim original passages and duplicate targets. Invalid
output gets one automatic retry with the validation error, using the same agent,
model, article snapshot and instructions. No rejected or partial proposal is shown.
If the retry also fails, the UI reports the failure and applies nothing. A valid
no-change result is accepted without retry. Cancellation and CLI execution failures
(including authentication failures) do not trigger this retry. The extra request
uses the selected agent's allowance. These checks establish format and source
anchoring, not factual accuracy or editorial quality.

Batch responses additionally contain a keep/change assessment and a specific
reason for every supplied paragraph target. Coverage must be complete and unique,
and change decisions must agree with the returned replacements. Missing assessments
or missing promised edits fail validation and use the same bounded retry. This
enforces explicit coverage, not the correctness of the model's editorial judgement.
Expand **passages assessed — see keep/change reasons** in the result to inspect
the decision for each passage. These assessments are separate from the selectable
edits; keeping a passage does not create an edit to approve.

The operation accepts up to 1,000 groups and 100 distinct paragraph targets;
larger reports fail explicitly rather than being truncated. Rerun checks after
editing before requesting another batch. The actual editorial choices depend on
the selected model; a clean repetition report is not the objective.

Local validation on 1 October 2026 passed all 188 tests and the production build.
The desktop browser flow was exercised with mocked providers: open the batch,
send the article/list, review a selective proposal, apply without saving, undo,
and reject stale requests. Source/prompt tests cover nested matches, Unicode,
distance, exact paragraph anchoring and valid no-change results. Live provider
output quality was not evaluated by those tests. A subsequent live check using
the current article and Claude Opus 5.5 verified multiple independently selectable
edits; see [the live repetition test](verification.md#live-repetition-review--2026-10-01)
for the result and its limitations.

## Finding-specific assistance

**Review edit** opens a verified replacement already supplied in the initial review.
**Draft an edit** converts older generic advice into a proposal on explicit request;
**Answer question** first collects missing information. Writing-check findings use
**Suggest a fix**. For new drafting requests, select one or more installed
agents, customize the prepared instructions and context, then **Find a fix**.
Each agent receives the same input and uses its account allowance. Compare named
proposals and edit a replacement. The same pre-display validation and one-retry
policy described above applies to individual fix and drafting requests for all
three providers; it does not rerun the initial Editorial review. Local writing checks automatically compare the
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
