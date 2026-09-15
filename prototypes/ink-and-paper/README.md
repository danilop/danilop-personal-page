# Ink & Paper — homepage prototype

Selected visual starting point for **Danilo Poccia / Notes Along the Way**.

This isolated React/Vite prototype implements the first visual concept. It is a
local design preview, not the production rebuild. Astro/TypeScript and the
Markdown publishing architecture remain the intended production baseline.

The production template must be configurable and replaceable. This prototype has
editable CSS and image files, but brand text, asset paths, and layout choices are
still wired into its components; it does not yet implement the planned validated
site configuration and theme registry. See the
[theme architecture](../../docs/architecture.md#theme-and-template-boundary--required-for-the-rebuild).

## Preview

Use the root project's pinned Node 24.21.0 and npm 12.0.2. This prototype now uses
React 19.3.0, Vite 8.3.0 and the React plugin 6.1.1. Its lockfile and version-specific
install-script approvals are independent of the production Astro application.

From this folder:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Open the [local preview](http://127.0.0.1:4173/).

```sh
npm run build
```

The bundled starter builds into `dist/client` and prepares its hosting metadata.
No hosting service or production deployment has been configured for this preview.

## What works

- Responsive editorial homepage, name-first masthead, featured/recent writing.
- Section navigation, sample article reading, and collection-to-article navigation.
- Gallery enlargement, About view, and a link to the existing archive.
- Native modal focus containment, Escape dismissal, focus restoration, visible
  keyboard focus, reduced-motion styles, and a skip-to-writing link.
- Local fonts and illustration assets; no live Google/iCloud service integration.

The articles, collection bodies, book covers, and gallery image are illustrative.
The RSS control explains that a live feed is not available in this preview.
Production articles and collections will have addressable pages; the dialogs here
are a quick way to explore the design without introducing a route/content system.

## Visual source and assets

Selected source: [Ink & Paper image](../../docs/design-concepts/ink-and-paper.png).
The user selected it as a starting point; typography, crop, portrait, and final
copy remain open to refinement. Generated mock slogans were intentionally omitted.

Built-in image generation produced separate portrait, notebook illustration, two
covers, and night-sky assets in `public/assets`. The original photo supplied the
portrait identity reference. The night sky is generated, not a photograph from
Danilo's library; no iCloud photos were copied.

Prompt/provenance records:

- [Portrait](portrait-prompt.md)
- [Notebook illustration](memory-notebooks-prompt.txt)
- [Covers and night sky](asset-provenance.md)

The generated ink assets are RGB with pale backgrounds, not transparent PNGs.
CSS contrast/brightness and multiply blending visually integrate them with the
paper color. Generated originals remain available in the tool's output storage.
A future production asset pass should optimize file sizes and finalize treatments.

Fonts: [Newsreader](https://github.com/productiontype/Newsreader) and
[Inter](https://rsms.me/inter/), bundled via Fontsource; see their package licenses.
UI icons: [Phosphor](https://phosphoricons.com/). These prototype dependencies do
not impose a production font or icon-library decision.

## Verification

See [design QA](design-qa.md) for source comparison, browser checks, fixes,
limitations, and screenshots. This is visual/interaction validation of a prototype,
not a full accessibility audit or production publishing test.

Dependency refresh (2026-09-15): clean install, production build, all four hosting
tests and dependency audit pass. Browser smoke testing verified homepage rendering
and opening/closing the sample article; no browser errors or warnings were logged.

## Production implementation

The Astro rebuild now lives at the repository root. This prototype remains a
record of the selected visual exploration; its sample articles and books are not
production content. The validated theme system is implemented in `themes/` and
`publishing/site.yaml`. See [the root README](../../README.md).
