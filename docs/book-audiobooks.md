# Growing audiobooks

Status: implemented and tested on 13 October 2026. Release verification uses the
existing exact-revision deployment gate. Article narration remains deployed. This implementation uses the
shared book reading structure. Draft books remain private in preview; deploying
this feature does not publish them.

## Product and listening experience

A book should gain an audiobook as its content is published, in the same authored
reading order as the written book. Publication groups and article boundaries do
not create extra chapters. Include only material eligible for that public book
view, including its eligible front and back matter. Preview can audition a clearly
separate draft edition. Never expose draft titles, audio or planned placeholders
through the public audio manifest or downloads.

Provide both ways to listen on the book's existing main page, beneath its summary
and before the contents:

- **Listen to this book**, changing to **Continue listening** when a saved position
  exists. Show the chapter and position that will resume; never autoplay on arrival.
- **Download audiobook (MP3)** with the current edition date, measured duration,
  file size and included chapter/section range. Say **Published so far** until
  the book is explicitly complete. Identify partially published chapters clearly.

Keep a compact player with play/pause, seek, previous/next chapter, 15-second
rewind/forward and speed. Reuse the article player's 1.1× default and available
0.8×, 1×, 1.1×, 1.2×, 1.5× and 2× speeds. Show remaining listening time at the
selected speed, while download metadata reports the recording's duration at 1×.
Expand **Chapters** for the hierarchical audio contents and **More options** for
secondary controls. The opening credits are a navigable entry, so skipping them
uses chapter navigation rather than another prominent button. Label the recording
**AI narration**; voice names remain internal. Use keyboard-operable controls,
clear focus and labels, restrained status announcements, and text-reading links.

The book main page is the listening destination. Do not initially require a separate
audio page, modal or floating player across the whole site. Playback across ordinary
page navigation is not promised; returning and choosing Continue restores progress.
Individual chapter pages can link to the book player at their chapter. Provide
native audio/download fallback when scripting is unavailable, without claiming
automatic queueing or saved progress in that fallback.

## Progress that survives growth

Persist progress locally under a stable book identity, independently of the current
edition hash, filename, total duration, chapter number or array index. Record the
stable placement/segment identity, its speech/runtime fingerprint, offset within that segment and
the edition last seen. Placements distinguish the same piece reused in a book.
Save periodically, on pause and on page exit; tolerate unavailable or full storage.

Appending or inserting content preserves the exact position in unchanged audio.
If a preceding segment changes, its duration does not shift that position. If the
current segment is regenerated, resume at the start of its surviving reading
placement, with a brief explanation; do not reuse an unverified second offset in
changed speech. If it was removed, offer the closest surviving reading boundary
and explain the change, rather than silently guessing. Paragraph anchors use placement identity and spoken text, with occurrence indices
for repeated paragraphs. Voice, pace, pause and runtime identity also participate
in the audio fingerprint. Identical repeated passages inserted earlier can be
ambiguous; the browser cannot infer an editorial identity absent from the source.

At the end of an unfinished edition, retain the last listened content identity
and the end-of-edition state. On return, offer the first newly appended content,
without restarting the book or replaying its temporary closing message. If new
material was inserted earlier, preserve the current position and identify the
new sections separately; do not jump backwards automatically. Completed listening
and completion of the written book are distinct states. Clearing browser storage
loses progress; it does not follow a downloaded file or synchronise across devices.

## Spoken structure and editorial treatment

The implementation compiles one semantic reading plan shared with the written book. Generate an
explicit reviewed speech script from that plan, not from a scrape of displayed
HTML or a concatenation of standalone article MP3s.

| Book material                                         | Spoken treatment                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening                                               | Book title, actual subtitle if present, author attribution and concise AI narration disclosure, once. No invented narrator persona or public voice name.                                                                                                 |
| Dedication, epigraph, foreword, preface, introduction | Include when part of the published book; announce their labels and any meaningful attribution. Preserve the authored order.                                                                                                                              |
| Part                                                  | Speak its assigned number and name once before its first available content; no empty part announcements.                                                                                                                                                 |
| Chapter/appendix                                      | Speak its assigned number/letter and name once. Use the canonical book numbering, including gaps, without renumbering for a release.                                                                                                                     |
| Articles forming a chapter body                       | Continue the prose without repeating article title, subtitle, credits or web calls to action. A publication split is not a spoken section.                                                                                                               |
| Genuine sections/subsections                          | Speak meaningful authored headings, with numbering where the book specifies it. Use pauses for unlabelled scene breaks; do not invent labels.                                                                                                            |
| Notes and references                                  | Preserve substantive qualifications through reviewed in-context narration or navigable notes. Keep citation lists, bibliographies and indexes available in text; every omission or adaptation must be explicit, never blanket deletion of all footnotes. |
| Code, equations, tables, informative images           | Reuse source-bound reviewed narration adaptations when their context remains valid. Explain meaning faithfully; literal reading where useful. Link supporting material from the book page.                                                               |
| Decorative images                                     | Silent, as for articles. A cover image does not need spoken description.                                                                                                                                                                                 |
| Closing                                               | An unfinished edition ends with a short “You're up to date” continuation message. Only an explicitly complete book gets final closing credits/end wording.                                                                                               |

The contents list is navigation, not an opening recitation. Do not add spoken page
numbers, raw URLs, markdown punctuation or repeated running headers. Avoid music
by default. A real subtitle is distinct from a promotional summary/dek; inclusion
must be explicit rather than guessing from summary text. Section and part pauses
should be longer than paragraph pauses, but their durations need listening trials.
Check joins to avoid doubled silence, abrupt cuts or repeated words/headings.

Use one book-level voice/profile for continuity, initially the approved MLX George.
An article's different voice should not silently change the book narrator. Explicit
role overrides, such as a separately attributed foreword, would need preview review.
Keep pronunciation, tone, loudness and encoding consistent between releases. Changes
to the book voice/profile invalidate all affected audio and require a coherent
regeneration rather than mixing profiles accidentally.

## Growth and downloadable editions

The web player uses one immutable MP3 per edition and a timing manifest with a
hierarchical navigation map and measured timings. Segment time ranges refer to that
MP3; no separate streaming files or queue are needed. Assembly follows the canonical
composition rules: body placements suppress article titles, genuine sections retain
their headings. The same plan supplies chapter cues and the full download.

Build a single MP3 containing all currently included material, with title, author,
cover where available and book metadata. The date and edition hash are included in the download filename. Its asset URL is immutable and
content-addressed; the book page points to the newest released edition. Use a
readable dated download filename. Existing downloads never update themselves;
listeners must download the newer edition. External players control their own
bookmarks, which we cannot migrate. Chapter metadata may be added, but MP3 player
support must be tested rather than promised. A chaptered M4B remains an optional later
format, not a prerequisite for the requested MP3.

Reuse unchanged speech segments. Assemble from retained lossless intermediates
and encode the full download once, avoiding repeated lossy transcoding and raw MP3
byte concatenation. Speech generation is incremental even though a new
full MP3 must be assembled when the book grows. Keep generated bytes in the existing
S3 asset pipeline and use its AWS CLI transfer, verification and retention rules.
Published snapshots remain subject to that retention policy, not an indefinite
archive guarantee. In-progress playback should stay on its loaded manifest; offer
the latest edition when the page is revisited, using saved passage progress rather
than changing the recording mid-sentence.

For sequential serialisation, include the available portion of the next chapter
and label it partial. If publication creates an internal gap, fail the audiobook
readiness check by default with a clear explanation. Intentionally nonsequential editions are currently blocked too; an explicit
reviewed omission/transition policy would be required before supporting them. Do not infer book completion from today's assets.

## Local production and publication

Extend the book authoring preview with an Audiobook panel: included contents,
speech/review status, voice audition, changed/stale segments, a navigable transition script,
full listening preview and download build status. Separate draft and public-scope
plans. Reuse Claude/Codex/Pi proposal tools and explicit human acceptance for spoken
adaptations; model output is never its own review receipt.

Generate on the Mac before commit, holding publication until the affected article
and book audio, transitions, manifests and MP3 are ready and verified. Hash the
speech, composition, adaptation receipts, voice and encoding profile to detect
changes; decorative-image changes alone should not resynthesise speech. Cover-only
changes may update download metadata without regenerating narration. A new part,
chapter title or closing state invalidates its structural speech, not every body.
CI validates prepared outputs and source identities; it does not run synthesis.
Upload and verify all required assets before publishing references. On failure,
retain the previous public text/audio edition and report what needs repair.

## Authoring and operations

Book YAML accepts optional `audioSubtitle` and `audioAuthor` fields (the site author
is the fallback), plus an optional `audiobook` mapping with `voice`, `pace` and
`profile`. Defaults are `bm_george`, `1` and the registered Kokoro profile. Article
adaptations and pronunciations remain in their existing narration sidecars.

```sh
npm run audiobook:inventory -- chronicles-of-computation --preview
npm run audiobook:prepare -- chronicles-of-computation --preview
npm run audiobook:prepare
npm run audiobook:check -- --hydrate
```

The default preparation selects public books only. `--preview` writes an ignored
private receipt and cached audio; it never promotes those bytes into the public
inventory. Public records live in `publishing/audiobooks.json` and use the existing
managed asset inventory. `assets:prepare` prepares public books automatically;
`narration:check`, the commit snapshot gate and release build verify them.

In preview, select a book source and open **Narration**. Choose draft or public
scope, inspect changes and unresolved explanations, apply voice settings to the
editor, audition, prepare and listen. Public scope is available before the book
itself is published and still excludes its unpublished pieces. Save draft settings normally. **Publish
locally when audio is ready** verifies public-scope content and atomically saves
its source, manifest and asset inventory. New article publication also prepares
public books before saving the article transition. Cancelling or stale inputs
leave publication held. Terminal/externally edited sources still pass mandatory
commit and build gates. Full recordings never autoplay in the authoring panel.

The worker streams cached lossless chunks into an intermediate WAV and encodes
one MP3, then decodes it to check duration/coverage. Model, voice and encoder pins
are unchanged. The worker fingerprint changed; existing public article recordings
were regenerated with identical durations/timing maps and file sizes, but different
audio bytes. CDN transfer
marks named audiobook MP3 outputs as attachments so cross-origin download links
work; audio elements can still stream the same resource.

## Implementation sequence and evidence required

1. Finalise composition and speech policies using the existing book models;
   record stable identities, partial chapters, explicit omissions and completion.
2. Build the speech plan, incremental segment cache and structural narration;
   audition representative opening, part, split chapter, code and closing joins.
3. Produce and verify the manifest, full MP3 and shared chapter timing map locally.
4. Add the book-page player and progress migration; add authoring preview controls.
5. Extend commit/release gates, upload verification and asset inventories; release
   only after automated and listening checks pass.

Tests must cover title deduplication, nested headings, partial chapters, hidden
content exclusion, reused placements, exact order, missing/stale adaptations,
profile changes and deterministic no-change builds. Verify measured durations,
decoded complete downloads, seek accuracy, clipping and transition consistency.
Exercise saved progress after appends, earlier insertions, edits, removals, new
closing messages and storage failure. Check no autoplay, playback speed/time,
keyboard use, mobile layout, Safari/iPhone background audio and media interruption;
record platform limits explicitly. Human listening review is still required before publishing a book; audio metrics
alone cannot judge pronunciation, clarity or a coherent finished book. The approved
George voice is retained, but generated private books are not claimed to have
passed an end-to-end human listening review.

## Sources and relationship to existing work

- [W3C Audiobooks](https://www.w3.org/TR/audiobooks/) provides the reading-order,
  manifest, primary entry page and hierarchical contents model. The implementation uses
  these ideas; standards conformance is not claimed.
- [ACX audio submission requirements](https://help.acx.com/s/article/what-are-the-acx-audio-submission-requirements)
  inform opening/closing credits, chapter structure and consistent audio quality.
  Its store submission rules are distinct from this self-hosted Kokoro workflow.
- [ACX narration guidance](https://help.acx.com/s/article/producing-and-recording-your-audiobook)
  recommends against narrating the table of contents and stresses listening review.
- [Article narration](article-narration.md) remains the implemented foundation.
  [Book serialisation](book-serialization.md) and [shared reading structure](reading-structure.md)
  describe the shared book composition used by this implementation.
