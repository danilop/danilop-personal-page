# Visitor navigation review

Date: 2026-09-16. Local changes and hosted preview verified; missing-page rule remains pending.
The review combines source inspection, browser journeys and internal-link checks.
It is not a usability study with independent readers.

## Findings and changes

| Finding | Resolution |
| --- | --- |
| Main menu did not indicate the active section | Current page/section has an underline and `aria-current` |
| Collections lacked an obvious reading entry point | Ordered collections offer Start reading |
| Contextual sections lacked chapter context and a bottom contents link | Chapter link, section position, Back to contents and conditional standalone-post link |
| Chapter pages ended without continuation controls | Shared previous/next navigation exits the chapter's descendants |
| Last section had no completion cue | End-of-collection message and contents link |
| Unordered collections implied a required sequence | Contents navigation without Previous/Next sequencing |
| Fixed edition had no path back to its growing collection | Conditional collection link and collection/book index link |
| A published edition could become undiscoverable without a live collection | Index and main-menu visibility include published editions independently |
| Archive pagination relied solely on numbers | Previous/Next links and explicit current-page labels |
| Preserved original site had no clear route back | Small return banner in generated copies; snapshot sources unchanged |
| Populated homepage's recent list lacked a direct browse-all action | Browse all posts link |

## Browser and structural evidence

Browser plugin/skill unavailable; used bundled Playwright with installed Chromium.
Public-content checks used `http://127.0.0.1:4321`. An isolated checkout under
`/tmp/notes-navigation-audit` served private sample routes on port 4180; none were
written into repository publication content.

- Home → Writing → welcome post → all writing; active parent section correct.
- Earlier Work → page 2 → previous page → Videos → Original Site → current home.
- Collections & Books → growing book → opening → contextual section → chapter →
  next chapter's section → appendix → completion → contents → fixed edition →
  growing collection.
- Standalone post → another collection → reused contextual post → standalone post.
- Planned outline item stays non-clickable; draft/book-only placements excluded.
- Unordered collection shows a contents link without invented sequence controls.
- Published edition remains reachable when no collection is public; no dead
  growing-collection link is emitted.
- Keyboard Skip to content works. Correct headings and meaningful content, no
  framework overlay, console warnings/errors or horizontal overflow at 1440,
  390 and 320px widths. Screenshots inspected for desktop and mobile layouts.
- Private populated build: 43 pages and 838 internal links/anchors verified.
- Release build: 29 pages, 178 files, 733 local links and legacy/private-content
  checks pass. All 34 tests pass, including three reading-order regression tests.

Local screenshot evidence: `/tmp/notes-nav-public-1440.png`,
`/tmp/notes-nav-public-390.png`, `/tmp/notes-nav-fixture-1440.png`,
`/tmp/notes-nav-fixture-390.png`, and matching 320px captures.
No real book download or third-party publication content was asserted as verified;
the private edition test checked navigation and its declared download destination.

## Remaining limitations

1. **Hosted missing URLs are still misleading.** An unknown preview URL followed
   the shared legacy fallback to `/index.html` and returned the homepage (HTTP 200
   after redirect). The app-wide fallback is `/<*>` → `/index.html`, status `404`.
   The prepared `infrastructure/amplify-rules.json` targets `/404.html`. Apply it at
   production cutover, then verify the requested URL produces a real 404 and
   recovery links. Changing the shared rule now would affect the old production site.
2. Writing versus Journal/Posts remains an editorial decision. No rename or URL
   migration was bundled into this review.
3. Public content is currently one post and no collections/books. Book/collection
   browser evidence uses private fixtures, not a launched book. Repeat checks with
   the first actual collection and edition, including its download artifacts.
4. The post index currently lists all posts. Pagination/filtering should be revisited
   as the corpus grows; search remains outside the agreed implementation scope.

## Hosted rollout

Amplify preview job 7 passed build, deploy and verify at
`dc433ac87a94dddf371158f67f6a32fc95cf94b2`. The live build marker matches.
The public-content browser journey also passed on the hosted preview at all three
widths, with no browser errors or overflow. The shared missing-page rule remains
a production-cutover task; production itself still serves the original site.

## Hosted status after `/new/` release — 2026-09-16

The combined main-domain deployment passes desktop/mobile navigation at `/new/`
while preserving the original root site. Missing URLs return native HTTP 404 after
removing Amplify catch-all redirects. The previous recommendation to use a `404`
rule targeting `/404.html` is superseded: live testing showed a 302 redirect followed
by a 200 response. Custom error-page rendering remains local-only; hosted missing
URLs have an empty native 404 body. See [verification](verification.md).
