# Ink & Paper design QA

Date: 2026-09-15.

**final result: passed**

Passed for the selected visual starting-point prototype. This is not a claim of
pixel-identical reproduction, production readiness, or a full accessibility audit.

## Evidence and state

- Source visual truth: `../../docs/design-concepts/ink-and-paper.png`, first image
  selected by the user; 1190 × 1322 pixels.
- Implementation: `http://127.0.0.1:4173/`, homepage at top, light/paper theme.
- Primary capture: `qa/desktop-final.png`, 1190 × 1322 pixels, 1190 × 1322 CSS
  viewport, devicePixelRatio 1. No density rescaling. Content height 1334 CSS px;
  the last 12 px are trailing space, not hidden controls.
- The source and final implementation images were opened together in the same
  comparison tool input. The source and earlier `qa/desktop-pass2.png` were also
  opened together before refinements. This was visual review of both artifacts,
  not an inference from code or a build result.
- Focused review used the masthead, article headline/metadata, collection covers
  and captions, and gallery/footer regions of that same full-resolution pair.
  Their text and imagery were legible at the supplied size; separate cropped
  captures were not required for this small single-page design.
- Additional browser captures: `qa/mobile-final.png` (390 × 844),
  `qa/mobile-reader.png` (390 × 844), `qa/mobile-collections.png` (390 × 844), and
  `qa/wide-desktop.png` (1440 × 1000). The collections capture preceded the final
  ink-background refinement; it establishes the mobile collection layout.
- Browser: Codex in-app browser. Temporary viewport overrides were reset and the
  preview tab was marked as a deliverable.

## Comparison history and fixes

1. Initial browser review found a P1 sizing error: the HTML image height made the
   featured illustration box 430 CSS px tall, pushing the collections far below
   their intended position. Fixed image sizing and adjusted the lead/recent grid.
2. `qa/desktop-pass2.png` showed the corrected structure, but P2 image-background
   rectangles and excess vertical spacing remained. Regenerated cleaner ink
   assets, applied CSS contrast/brightness plus multiply compositing, and refined
   masthead, image, story, and section spacing. No custom vector/CSS artwork was
   substituted for the generated assets.
3. `qa/desktop-final.png`, viewed with the source, confirms the corrections:
   free-standing ink assets, clear editorial hierarchy, visible collections and
   gallery, and the complete footer. The main structure is retained. Minor
   typographic and illustration differences are recorded below as P3 refinements.
4. A small background mismatch in the article reader was corrected using the same
   compositing treatment. `qa/mobile-reader.png` was refreshed and visually checked
   after that change.

## Required fidelity surfaces

- **Fonts/typography:** Newsreader supplies the editorial serif; Inter supplies
  navigation and small metadata. Local font loading completed. Heading hierarchy
  and readable body widths are preserved. Exact glyph shapes and lead line breaks
  differ slightly from the generated image; acceptable for a starting-point preview.
- **Spacing/layout:** Name-first masthead, lead/recent split, two collection entries,
  panoramic gallery and compact footer match the selected structure. At narrow
  widths these become an ordered single column. No horizontal page overflow at
  tested widths 320, 390, 1190, and 1440 CSS px. The 390px reader also has no internal
  horizontal overflow.
- **Colors/tokens:** Warm paper `#f6f3eb`, near-black type, blue links/ink and fine
  muted rules preserve the source palette. Focus uses an explicit blue outline.
  Image compositing removes the conspicuous darker rectangles in the homepage
  and reader; generated originals remain RGB rather than true transparent PNGs.
- **Image quality:** Separate built-in-generated assets reproduce the ink portrait,
  notebook/network illustration, two covers, and night-sky banner. Actual portrait
  was supplied as identity reference. Source/crop details are not pixel-identical;
  artwork remains provisional. The generated night sky is explicitly illustrative.
- **Copy/content:** Lead and recent titles, date order, collection labels and
  personal identity match the shared brief. Removed unapproved generated slogans;
  kept honest design-preview/sample labels. Dialog sample text is newly authored
  only to demonstrate the reading flow. No fake production book or feed is claimed.

## Interactions verified

- Lead headline opens its sample article; collection link opens the corresponding
  contents; selecting an item returns to that article.
- Thinking in Systems opens a different collection with its two appropriate items.
- Collections navigation scrolls to the section on mobile.
- Gallery opens the larger image and explanatory caption.
- About opens the portrait and current-biography link; RSS explains its pending
  availability instead of claiming a live feed.
- Close buttons and Escape dismiss dialogs; focus returns to the initiating
  article control. Native dialogs provide modal focus containment. Panel changes
  reset the reading position and focus the close control.
- Browser console warning/error log inspected after interactions: no entries.
- All five homepage images reported complete with nonzero natural widths.

## Findings and follow-up polish

No actionable P0/P1/P2 findings remain within this prototype's scope.

- **P3:** Refine the final portrait's likeness/linework and the lead illustration's
  scale when reviewing the real page together. The generated asset differs from
  the original concept and is not final approved artwork.
- **P3:** Finalize typography and headline wrapping with actual article titles.
  The prototype intentionally uses a maintainable local font approximation.
- **P3:** Optimize image derivatives/file sizes before production; this local
  prototype retains large generated raster assets for visual review.

## Boundaries and remaining implementation

No production deployment, real Markdown loader, article routes, RSS feed, public
album connection, Google embed, short-link publishing, or book export is implemented
here. A new production implementation must provide real URLs in place of modal
sample reading. Test screen readers, all browsers, real content states, and
production accessibility/performance during that implementation.

## Implementation checklist

- [x] Resolve first displayed image as the selected source.
- [x] Supply and inspect individual artwork assets.
- [x] Build, run, and visually inspect the local prototype.
- [x] Fix substantive layout and image-integration issues, then re-capture.
- [x] Verify primary sample interactions and phone layout.
- [x] Synchronize prototype README and repository specifications.
- [ ] Refine real content/portrait and implement the production publishing system.
