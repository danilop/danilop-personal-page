# Authoring experience review — 24 September 2026

Status: reviewed and followed by a local implementation pass. The original
observations below describe the pre-change audit; the resolution section records
implemented behavior. Nothing was deployed.
This review covers the local author editor, not the public site's whole experience.
It preserves the existing content/publishing separation and explicit local Save.

## Evidence and scope

Inspected the current local editor at desktop and 390px width: editing/preview,
metadata, local writing checks, exact finding selection, fix setup, image briefing
and existing candidates, and the saved-version empty state. Exercised generated
proposal comparison, pre-apply checks, Apply, Keep original, Undo and metadata
changes using the actual frontend with synthetic backend responses. No manuscript
was sent to agents, saved, published, or changed for this audit. Screenshots and
full evidence are local audit artifacts, not public site assets.

## Strengths to retain

- Consistent restrained typography, colour and spacing.
- Explicit local Save, visible saved state, Undo/Redo, and separate deployment.
- Exact text ranges for findings; tested selection returns the intended word.
- Separate local checks and provider-based editorial review, with disclosure.
- Editable named proposals, pre-apply local checks, and collapsed check details.
- Image brief remains editable; insertion requires an image description.

## Priorities

### 1. Make applied fixes a distinct state (high)

Observed in the synthetic flow: applying a proposal changes the editor correctly,
but the periodic freshness check replaces the success notice with a stale-source
warning. Keep original remains available and merely closes the panel; it does not
restore the original. Undo restores the text, but the old review remains stale.

Propose explicit states: preparing, proposing, checking, ready, applied, and
out-of-date due to a subsequent unrelated edit. After Apply show “Applied ·
unsaved” and offer Undo change and Back to findings. Hide Keep original after
application. Reuse the validated result where its full scope fingerprint still
matches; otherwise make refreshing findings explicit. Do not automatically rerun
an editorial provider. Preserve the author's place in the findings queue.

### 2. Unify metadata and prose editing (high)

Observed with synthetic metadata: changing the title leaves “Saved locally” and a
disabled Save until Apply to editor is pressed. Fields and raw frontmatter create
two editing surfaces with different pending states. Source inspection confirms
opening Post details reloads its fields from the editor text.

Propose one unsaved working document and one Save action. Metadata edits should
update that working document with Undo support, or at minimum have a distinct
visible pending state and preservation on panel close. Keep raw frontmatter in an
advanced source mode. Use a multiline summary, tag suggestions with usage counts,
and a persistent draft/publication status near the article title. Removing Draft
must continue to mean eligible for the next deployment, not already published.

### 3. Make finding navigation reliable (high)

Observed: selecting an adverb highlighted the correct exact word in the textarea
selection, but the displayed scroll position did not show that word. The current
scroll calculation uses source line count and ignores wrapped visual lines.
Three different word targets in one sentence share identical file/line labels.

Propose measured scrolling to the actual selection, meaningful word/phrase link
labels, and an occurrence number when necessary. Preserve exact highlighting;
do not broaden the highlighted range just to provide context.

### 4. Put review results ahead of setup (medium)

At desktop size, setup consumes the visible review panel and results begin below
it. Twenty actual findings begin with tag-first-use advisories and repeat the same
passive-grammar explanation many times. Writing checks and editorial review share
one results slot rather than a clearly named persistent result set.

Propose a compact run toolbar, separate Checks and Editorial result views, grouped
findings and counts, and explanations on demand. Separate metadata advisories from
prose suggestions. Add next/previous finding and a session-level “Keep as written”
action (distinct from a persistent rule exception). Do not encourage clearing all
advisory findings as a quality target.

### 5. Make proposal comparison the focus (medium)

The result follows the full request form, original quote, editable replacement,
rationale, diff, check summary, retry field and action buttons in one long panel.
Request settings and competing Find a fix / Try again actions remain visible.
The selected proposal gets checked; other proposals lack a visible check status.

Propose collapsing request settings after results arrive, keeping named proposal
selectors visible, showing per-proposal check status, and a compact decision footer.
Retain editable replacements and details on demand. Treat modified wording as a
changed finding where possible: current exact-excerpt comparison can report a
surviving issue as one removed plus one new issue. Avoid implying “resolved”.

### 6. Prioritize the passage in preview (medium)

The embedded full-site masthead and draft banner occupy most of the initial
preview, while frontmatter occupies much of the editor. The preview description
also explains that navigation and metadata can reflect an older build.

Propose default article-focused preview, optional Full page mode, compact draft
status, and jump-to-heading/selection support. Preserve Open full site for the
complete site view. Clarify whether prose, metadata or the full site is refreshing.

### 7. Shorten the image workflow (medium)

The numbered stages are understandable, but form one long scrolling panel. The
candidate and insertion controls are far below the brief. Insertion is currently
explicitly described as appending to the article rather than at the selected
position.

Propose progressive Brief → Generate → Choose stages with easy back navigation,
visible candidate thumbnails, and insertion at the remembered cursor or an explicit
end-of-article choice. Say “Add an image description to insert” next to a disabled
button. Keep generation controls and provider details secondary to the next action.

### 8. Improve mobile and recovery polish (medium/low)

At 390px there was no horizontal page overflow, but the full editor sits above the
preview/review tools. Switching between writing and feedback involves substantial
page scrolling. The empty Saved versions dialog presents a large blank textarea.

Propose one active workspace pane on narrow screens with persistent Write,
Preview, Review and Images navigation and accessible Save/status. Hide empty
history controls; when history exists, prioritize a dated list and readable diff
before loading a version. Keep all later versions available after restore.

## Accessibility observations and limits

Native controls, visible keyboard focus and text labels are useful foundations.
Duplicate location labels and offscreen selections are observed navigation issues.
Small muted explanatory text and long independently scrolling regions merit
contrast, zoom, keyboard and screen-reader testing; this audit is not a WCAG
conformance assessment. No console errors were observed in the inspected real tab.

Fresh agent generation, authentication failures, long-running cancellation,
populated version restoration, image insertion and production deployment were not
exercised end to end in this audit. Synthetic checks demonstrate interface states,
not the quality of real provider suggestions or completeness of language analysis.

## Recommended sequence

First fix applied-state clarity, metadata pending-state integrity, and exact-target
scrolling. Then consolidate the review/proposal workflow. Finish with article-first
preview, image progression, mobile navigation, and history polish. Keep the visual
identity; improve hierarchy and state transitions instead of adding decoration.

## Resolution — implemented locally

- Applied fixes have a distinct state, Undo change and refreshed writing-check
  results; Keep original is hidden after application.
- Metadata joins the working document automatically, with unsaved status, Undo,
  pending-field recovery, multiline summary and tag usage suggestions.
- Article text is the default writing surface; Full source retains advanced access.
- Exact finding links have descriptive names and measured wrapped-line scrolling.
- Separate session results per file for Checks/Editorial, grouped findings,
  next/previous navigation and session-only Keep as written reduce review clutter.
- Request settings collapse after proposals; each proposal shows its check status.
- Article-focused preview, full-page toggle and heading navigation are available.
- Images use Brief/Generate/Choose stages, thumbnails and cursor/end insertion.
- Narrow screens use a single workspace pane. Saved versions show a diff and
  omit the blank editor in empty histories.

These changes preserve explicit Save and content/publishing separation. Similar
wording is classified heuristically as a changed finding, not proof of resolution.
History diff highlights the changed span rather than providing a full line diff.
Full accessibility conformance and provider availability remain separate concerns.
