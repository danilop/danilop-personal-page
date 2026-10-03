# Asset provenance

Updated: 2026-10-03.

- The existing portrait photograph belongs to the original site and is reused on
  the biography page. The ink portrait is the generated interpretation selected
  during Ink & Paper prototyping; it is a configurable theme asset.
- `site-assets/brand/favicon.svg` is an original vector DP monogram in blue ink
  on warm paper. Browser and Apple touch icons are generated from it during builds.
- `site-assets/brand/notebooks.png` is generated artwork for the welcome article:
  blue ink, an open book and loose pages on warm ivory, with no lettering.
  It was created on 2026-09-15 and replaces the prototype's topic-specific art.
- The three images in `docs/design-concepts/` are generated design studies. Their
  illustrative article/book titles are not published content. The first design,
  Ink & Paper, is the selected starting point.
- The selected illustration for **Clever Enough to Find the Loophole** was revised
  with the built-in image-generation tool on 2026-10-03: one winding key attached
  to the beetle, a central bell clapper and a tighter landscape composition.
  Its article-local PNG and alt text are selected locally; this revision has not
  been deployed.
- The **Chronicles of Computation** draft cover was revised with the same tool on
  2026-10-03: computing tools in a tighter portrait composition, rectangular card
  punches and a recognisable closed laptop. It remains a draft cover. These are
  symbolic illustrations, not reproductions of specific historical artefacts.
  Both replacements use content-based filenames and the managed-asset manifest;
  their exact prompts and descriptions are retained in ignored local candidate
  records. Previous selections remain available through saved-version recovery.
- Inter and Newsreader are self-hosted from their Fontsource packages. Their SIL
  Open Font License files are retained under `site-assets/licenses/` and copied
  into `/licenses/` in the generated site. Third-party libraries retain their own licenses; the repository's MIT
  license does not replace those licenses.
- `legacy/snapshot-2026-09-15/` preserves original markup/assets and original CDN
  references. This is a historical website snapshot, not a mirror of external
  posts, videos, slide decks or their copyrighted content.
- External gallery photos remain on the selected provider. No iCloud photo
  library has been imported. Future photo assets need explicit provenance and
  publication permission before copying or hosting derivatives.
