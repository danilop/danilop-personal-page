# Article narration

Status: deployed on 13 October 2026. MLX George was approved by
listening. Both eligible public articles have prepared audio and the mandatory
readiness policy is enabled. Local automated and browser verification is recorded
in [verification](verification.md), including the exact deployed revision and
hosted audio checks. Authoring and synthesis continue to run only on the Mac.

## Product behaviour

Quiet paragraph callouts and inline emphasis remain in the normal reading order.
Narration speaks their text once without announcing formatting or promising a
change of vocal stress. Wrapping an unchanged paragraph preserves speech segments
and their hash. Existing code explanations are separately bound to the full source
context, so a formatting edit can still require their review approval to be renewed;
the reviewed, identical speech can then reuse cached audio chunks.

**Article narration** is a spoken rendition, preserving the article's claims,
qualifications and sequence. **Listen to this article** appears below the article
metadata. It is optional and never autoplays on page load. The player shows the
listening action and duration without an “AI narration” badge. Voice names are
internal to the authoring preview and are not
displayed in the public player. The compact player offers pause, seeking, ±15 seconds,
playback speed, download and the exact spoken transcript. Native audio controls
remain available without JavaScript. With JavaScript, listening positions are saved
in browser local storage about every five seconds, on pause and when leaving.
Returning readers press Continue listening to resume; revisiting without playing preserves
their position. Progress belongs to the audio hash, so a different recording starts
afresh. Completed recordings and positions within the final three seconds restart
from the beginning. Progress stays in the same browser profile and site, without
account or device synchronisation; clearing site storage removes it, and disabled
storage prevents persistence. Playback defaults to 1.1×, with 0.8×, 1×, 1.1×,
1.2×, 1.5× and 2× available. The selected speed is retained during playback and
retry, but is not persisted across page visits. The native fallback without
JavaScript uses the browser's default speed.
Only one media element plays at a time on
the current page, including book players and private auditions. Cross-page continuous playback is outside this delivery.

### Shared playback controls

Article and book players, including private voice auditions, use the same
play triangle and pause bars beside a visible action label. The label changes
from Listen to Continue listening after pausing, and to Listen again at the end.
Pause preserves the position; there is no Stop action that resets it. Icons are
decorative SVGs; the accessible button name includes the visible action and the
recording title. Buttons support native keyboard activation, visible focus and a
44-pixel minimum target. State follows the audio element, including playback
started elsewhere, errors, completion and one-player-at-a-time changes.

Public listening areas and private auditions share the surface in
`runtime/audio-playback.css` (imported by `site/components/audio-surface.css`): a subtle tinted
background, complete border, internal padding and space before the prose. The
reusable `ListeningHeading.astro` pairs a headphones icon with Listen or Audiobook;
play/pause symbols remain on the actual playback buttons. Chapter and section
pages use a bounded portion of the verified book recording when available, with
their own relative timeline and saved progress. The book overview retains the
full-book player and download, followed by the text table of contents. There is
no second audio chapter list. See [book listening](book-audiobooks.md).

`site/components/AudioPlaybackButton.astro` supplies public markup, with shared
state/activation behaviour and audio styling in `runtime/audio-playback.js` and
`runtime/audio-playback.css`. The local icon refinement shares decorative SVGs
and icon/label layout through `runtime/control-icons.js` and
`runtime/control-icons.css` with Run/Step/Restore original/Copy code controls. This refinement is
included in this release; audio actions and accessible labels are unchanged. `runtime/audio-preview.js` reuses the same control
for private article/book auditions and supplies seeking, ±15 seconds, time,
speed and retry. Private preview enhancement preserves native audio as its
fallback and does not persist auditions across source changes. This UI change
does not regenerate narration or change public progress keys. The original audio
interface shipped in the 14 October 2026 release; the shared-icon refinement above
is included in this release. Private auditions remain part of the local editor.

Listening duration is measured from generated audio and verified against MP3 frame
coverage. Display it as `17:58 listen at 1.1×`, alongside `20 min read` for a
19:46 recording. The reading estimate uses the full verified audio duration at 1×, rounded up to whole minutes with a minimum of one.
It is a narration-paced estimate, including spoken pauses and adaptations, not
a measurement of individual silent-reading speed. Without available narration,
fall back to the existing raw word count at 220 words per minute. Reading estimates
never change with playback speed; article pages and homepage writing entries use
the same rule.
Duration is available without fetching audio (`preload="none"`). The display is
the full recording duration divided by the selected speed, initially 1.1×, and
updates immediately when speed changes. Homepage listening estimates also use
1.1×. The seek bar and elapsed/total timestamps stay in original recording time
to keep seeking and saved positions consistent. Without JavaScript, the article
player displays the measured duration at the native 1× speed. Speed changes do
not generate another file. The reading and listening label adjustments are implemented and tested.
Release verification checks the exact deployed revision.

Scope includes standalone articles and pieces exposed by public collection reading
routes, including attached pieces. Each piece has its own player; this is not a
whole-chapter or whole-book recording. A different placement title gets a separate
rendition. Identical speech can reuse generation. Drafts, book-only material,
external archive links and the preserved original site do not require backfill.

## Spoken content

[Growing audiobooks](book-audiobooks.md) extend this foundation with
book-level composition, resumable listening and complete current-edition MP3
downloads. The book implementation uses the shared publication and release gates. Article title/subtitle improvements discussed
alongside it are also proposals: titles already play, while including a true
subtitle and an exact body-start skip would require new speech metadata and audio.

The speech compiler reads the semantic source before HTML rendering. It speaks
the title once, headings, prose, lists, quotations and substantive footnotes.
It omits the summary/dek, citation markers and raw link URLs; link text remains.
Simple inline identifiers can be spoken directly; ambiguous notation needs review.
No article code or interactive block is executed to generate narration.

| Material                                                   | Treatment                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Decorative illustrations                                   | Silent. The existing atmospheric artwork is explicitly classified decorative. Replacing it or changing its alt text does not change speech. |
| Informative images                                         | Explicitly choose Skip, Read caption or Spoken explanation. Alt text is not an automatic narration fallback.                                |
| Code, diagrams, charts, tables, maths                      | A source-bound reviewed explanation, deliberate literal reading, or omission with a reason.                                                 |
| Exercises, callouts, interactive blocks and embedded media | Explicit adaptation; no automatic execution, transcription or soundtrack mixing.                                                            |

Unresolved material blocks full generation and publication. Unknown source kinds,
ambiguous selectors and unsupported languages fail with an actionable error.
English (`en`, `en-GB`, `en-US`) is supported; the voice phonemiser uses British mode.
Canonical prose, image alt text and captions remain unchanged.

## Explanations with Claude, Codex or Pi

The Narration pane uses the installed CLI adapters with tools disabled. Choose a
provider and optional model, inspect **Show outgoing prompt**, then explicitly
request proposals. The request includes the unresolved source and spoken context.
It may send that material to the selected provider's configured service; Kokoro
itself remains local. There are no provider calls while typing or automatic
provider switches. Pi also disables MCP connections.

Image bytes are not sent in this delivery. A provider must state insufficient
visual evidence when captions or source metadata cannot support an explanation.
Compare each proposal with the displayed source, edit, audition, accept or reject.
**Accept selected proposals** is explicit batch acceptance. Provider output never
counts as its own review receipt. Unsaved prose must be saved before acceptance.
Approvals include exact source hashes and become stale when their source or
article context changes. Decorative classification is independent of image bytes.

Live smoke tests returned valid proposals from Claude and Codex. Pi's configured
service rejected a request at its output-token limit; the adapter fails closed and
shows an actionable error. Successful live Pi generation remains unverified with
that configuration. Parser, retry and failure handling have automated tests.

## Local authoring

Run `npm run preview` (drafts are included locally) and open an article's editor, then
**Narration**. Choose among the eight pinned British voices; George (`bm_george`)
is the default. **Test first paragraph** uses the selected voice and production
pace, excluding the title and decorative art. Long paragraphs are safely split
within phoneme limits and are read in full. A spoken explanation can also be
auditioned. Voice selection itself does not start synthesis.

**Prepare narration** creates a private recording for unsaved/draft inputs, or a
managed rendition when saved public inputs match. Current recordings offer
**Play current narration**. Jobs show progress and can be cancelled. An older
preview is labelled when its source or voice changes. Voice, pace and pronunciation
choices can be recovered from browser storage, then explicitly saved in the sidecar.
Pace is 0.8–1.2; reader playback speed is a separate control. Unsupported voice
blending and emotion prompts are not offered.

The current collection preview context supplies the spoken title. If a piece has
multiple differently titled placements in one collection, prepare all variants
using the CLI. Full-site preview includes matching saved draft audio privately;
a stale recording is omitted from live prose preview.

```sh
npm run narration:setup
npm run narration:inventory
npm run narration:sample -- hello-brave-new-world
npm run narration:prepare -- hello-brave-new-world
npm run narration:prepare          # every eligible public rendition
npm run narration:check            # every public rendition; offline
npm run narration:check -- --hydrate # explicitly restore known public bytes
npm run assets:prepare
```

A piece ID selects its public title variants, or its canonical title for a private
draft. `inventory` and `sample` also accept a draft piece ID. Omitting an ID operates on
the public graph. `check` always checks the complete public graph. Generation does
not commit, push, upload or deploy. On a fresh Mac, setup requires `uv` and network
access; normal synthesis uses verified local files offline.

## Source and artifact layout

| Location                                              | Role                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `content/pieces/<id>/narration.yaml`                  | Voice, pace, pronunciations and reviewed adaptations; retained through canonical imports.         |
| `publishing/narration.yaml`                           | Mandatory gate and accepted immutable runtime-profile hashes.                                     |
| `publishing/narrations.json`                          | Public rendition records, exact spoken segments, provenance, timing, duration and audio identity. |
| `publishing/media-assets.json`                        | Existing authoritative byte/storage inventory, including immutable MP3 assets.                    |
| `tools/narration/profile.json` and `requirements.txt` | Pinned model, voice and encoder hashes and hash-locked Python environment.                        |
| `.authoring-state/narration/`                         | Ignored private auditions, proposals, worker jobs and reusable PCM chunks.                        |
| `.asset-cache/` and piece `assets/`                   | Ignored managed audio bytes; no model or audio binaries are committed.                            |

See [authoring format](authoring-format.md#narration-source-format) for the exact
sidecar shape. Rich blocks use semantic IDs; ordinary Markdown uses deterministic
source/context selectors. Duplicate selectors require an explicit resolution.
Meaningful source dependencies include byte hashes. The speech hash includes
ordered text, pauses, voice, pace and profile. A separate review hash verifies
adaptations even when their spoken words have not changed. Tag/date/link-URL or
formatting-only prose changes do not require synthesis. Conservative context
hashing can require re-review of an adaptation after a prose formatting edit.

A valid index entry is insufficient by itself: checks verify manifests, exact
bytes, MP3 structure, duration and segment timing coverage. Old accepted profiles
may remain usable until explicitly retired. Changing the worker or its dependencies
requires a reviewed profile-hash update and regeneration before release. Do not
edit hashes just to bypass stale output.

## Runtime and measurements

The selected runtime is **MLX-Audio 0.5.8**, Kokoro 82M BF16, British George at pace
1.0, mono 24 kHz, MP3 96 kbit/s. The model revision, eight voice checksums and the
bundled encoder checksum are pinned in `profile.json`. Python 3.12.13 is isolated
in `.venv-narration`; every locked package version is checked before generation.
Setup explicitly downloads the English phonemiser data. Builds and CI do not
install or execute speech tooling.

A serial warm worker has a bounded queue, cancellation/restart, idle expiry and
progress. It validates every phoneme chunk before inference to reject truncation,
checks finite unclipped samples and plausible length, then encodes and decodes the
assembled recording. Cached chunks have their own byte receipts. These checks do
not establish pronunciation quality; listening remains necessary.

[Runtime comparison](narration-runtime-comparison.md) contains the measurements and
reproduction commands. On this Mac, MLX generated the 94.725-second excerpt in
6.318 seconds versus 10.943 seconds for reference PyTorch. Its first request had
substantial initial warm-up; subsequent paragraph synthesis was 0.643 seconds.
George's MLX sample was approved by the author. ONNX was retained as a fallback
candidate only and was not benchmarked after that approval. There is no automatic
runtime fallback that could silently change a published voice.

## Publication and commit behaviour

### Local publication transaction

**Publish locally when audio is ready** and `npm run article:publish -- <id>`
prepare audio before changing the draft state or assigning the first `publishedAt`.
Generation happens outside the short write lock. Promotion reacquires the lock,
rechecks source/settings/dependencies, and records a recoverable multi-file journal
covering the sidecar, manifests and source. Failure or cancellation retains the
draft. Existing publication timestamps are retained on updates and republication.

Saving an already published article preserves the edit and queues narration when
its adaptations are ready, or displays a review-needed notice. A public build and
commit remain blocked until the committed revision has current audio. The local
commit hook can prepare missing/stale audio from the exact staged source. Draft Save,
unpublishing and deletion do not require synthesis. Manual collection changes are
saved locally; `assets:prepare` prepares every newly exposed rendition before
commit. No background task enables a collection or publishes a draft.

If interrupted during promotion, `npm run narration:recover` completes the journal
only when files still match their before/after identities. Stop the author server
before investigating a stale `.authoring-state/write.lock`; do not remove a lock
belonging to an active writer. A conflicting source requires operator reconciliation.

### Enforcement at three boundaries

1. The local Git pre-commit hook first checks the exact staged source. If public
   article narration or a public audiobook is missing/stale, it runs the existing
   `assets:prepare` pipeline in an isolated staged snapshot using installed local
   Kokoro. Current recordings are reused; drafts are not generated automatically.
   Generated narration sidecars, article/book indexes and the asset manifest are
   copied back and staged automatically, then the normal full commit gate runs.
   Audio and derived asset bytes stay ignored. Unstaged prose is never included.
   Conflicting unstaged metadata, a changed/locked index, unresolved explanations,
   missing runtime or preparation failure stop the commit. No provider proposals,
   approvals, package installation, publication or upload happens in this phase.
   `npm run verify:commit`, worktree analysis and CI remain validation-only.
2. Production preparation/build verifies the public graph. Release uses the
   existing immutable asset upload-before-push workflow and validates the captured
   commit. Manual `assets:prepare` remains available; the local hook also runs it
   when staged narration needs preparation.
3. CI/Amplify verifies speech/review identities and pinned public bytes without
   Kokoro, provider access or private draft state. Direct hook bypass cannot make
   missing or stale narration pass the production build.

Draft auditions and proposals are never enrolled as public assets. Cleanup protects
private saved-rendition receipts, public indexes and existing retention inventories.
Replaced recordings are not immediately deleted. Hosted MIME/Range/cache behaviour
must still be verified after the first narration release.

## Implementation stages and remaining delivery checks

| Stage                 | Local implementation                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Runtime comparison | MLX and reference samples measured; George MLX accepted.                                                                                  |
| 2. Speech document    | Semantic extraction, source-bound review, freshness and import preservation implemented.                                                  |
| 3. Generation/assets  | Offline pinned worker, cache, validation and managed MP3s implemented.                                                                    |
| 4. Preview            | Voice/audition, progress/cancel, transcript and reviewed CLI proposals implemented.                                                       |
| 5. Reader             | Progressive player, measured time, transcript, seek/speed/resume and failure handling implemented.                                        |
| 6. Gates              | Coordinated article publication, recovery and staged/build/CI checks implemented.                                                         |
| 7. Backfill/delivery  | Both current public articles backfilled and deployed; mandatory gate enabled. Exact revision, hosted audio and browser playback verified. |

Automated Chromium and DOM checks do not establish VoiceOver, Safari/iPhone or
physical-device lock-screen behaviour. Manual testing on those platforms remains a
delivery check. Media Session, sticky playback, continuous playlists, highlighting,
podcast feeds and richer pronunciation tools are outside this implementation.

## Sources and licensing

The upstream [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M) labels the
weights Apache-2.0; [Kokoro](https://github.com/hexgrad/kokoro) and
[MLX-Audio](https://github.com/Blaizzy/mlx-audio) publish their code licences.
Keep their licence notices when redistributing tooling or weights; this site serves
prepared audio, not weights. The pinned environment also includes spaCy/Misaki
phonemisation and a packaged FFmpeg encoder; their package notices accompany the
local distributions. It is not a claim that all transitive components share one
licence. [Official voices](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
and the [reference pipeline](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py)
document voice IDs and phoneme chunking. Exact output from the user's earlier tool
on another computer is unknown; matching that recording is not claimed.
