# Danilo Poccia

*Notes Along the Way*

Articles, experiments, and ideas that can grow over time.

[Website](https://www.danilop.net) · [Design](docs/product-design.md) · [Authoring](docs/authoring-format.md) · [Operations](docs/operations.md)

## One article. Many ways to read it.

Write in Markdown. Publish an article on its own, place it in a collection, or
make it a section of a growing book. Collections can gain chapters, introductions,
appendices, and other book material without duplicating the original writing.

The Ink & Paper theme puts reading first: a name-first masthead, blue ink,
serif headlines, and generous space. Fonts, colors, images, CSS, and templates
live apart from the content and publishing system.

- **Rich explanations:** source code, CSV tables and charts, Mermaid and D2
  diagrams, equations, citations, figures, audio, and video.
- **Interactive examples:** registered JavaScript/WASM simulations and replaceable
  browser model runtimes, with explicit activation and static book alternatives.
- **Portable publishing:** frozen Markua manuscripts, a Leanpub adapter, DEV
  synchronization, and an assisted Medium workflow.
- **Durable links:** reviewed aliases for new work at `danilop.link`, activated
  only after the canonical publication is live.
- **Earlier Work:** the historical catalogue in the new design. **The Original
  Site** preserves the old look. **Elsewhere** is reserved for external writing
  published after relaunch. Empty sections stay hidden.

Public PDFs and published Google Docs/Slides load on reader request. iCloud
Photos albums use public album links; photographs are not copied into this repo.

## Release status

The rebuild is implemented and verified locally and on the
[hosted preview](https://rebuild-notes-along-the-way.d26ru7a9pi36wa.amplifyapp.com/).
The hosted build passed all 24 tests using pinned Node 24.21.0 and npm 12.0.2. Production
still serves the original site. The shorter **Hello, Brave New World** article
and the Earlier Work / The Original Site wording are approved.

Short-link cloud setup awaits the specific access approval described in
[deployment access review](docs/deployment-access-review.md). DEV and Leanpub
adapters have local contract tests; live publishing accounts are not connected.
Follow [credentials and access](docs/credentials-and-access.md) before adding
provider keys; protected DEV delivery still needs the documented workflow changes.
No article is enrolled for cross-posting. Media export now generates portable PNGs,
preserves supported destination embeds, and reports fallbacks or blocks required
embeds that cannot be preserved. The local suite passes 31 tests; actual remote
draft rendering remains to be checked with connected accounts. See [media portability](docs/cross-posting.md#media-portability-clarification--2026-09-16).
Search and a site-wide AI assistant
remain future work. See [verification](docs/verification.md) and [launch status](docs/launch-review.md) for evidence and
remaining release gates.

## Develop

Use the pinned Node.js 24.21.0 LTS and npm 12.0.2. With nvm installed:

```sh
nvm install --skip-default-packages
nvm use
npm install --global npm@12.0.2
npm ci
npm run dev
```

For a production build and preview:

```sh
npm run build
npm run check
npm test
npm run preview
```

Output goes to `dist/`. Ordinary article reading needs no JavaScript. Model
weights are downloaded only when a reader explicitly starts a model experiment.

## Write and maintain

Start with [the authoring guide](docs/authoring-format.md) and the
[welcome article](content/pieces/hello-brave-new-world/index.md). The private
[test manuscript](test/fixtures/manuscript/) exercises collections and book
features without inventing published books for the homepage.

```sh
npm run sync:posts          # explicitly refresh AWS and DEV discovery
npm run distribute         # prepare previews for enrolled destinations
npm run publish:links      # inspect proposed aliases; does not publish
```

Historical metadata combines saved source data with editorial corrections:
**Open Graph metadata → publisher metadata → per-field overrides**.
Corrections in `data/link-overrides.json` survive cache refreshes. Production
builds use versioned metadata and never scrape missing titles silently.

## Repository guide

| Directory | Purpose |
| --- | --- |
| `content/` | Markdown pieces, collections, references, and edition manifests |
| `core/` | Content model, assembly, rendering, editions, and publishing |
| `renderers/`, `runtime/` | Replaceable renderers and browser experiment adapters |
| `themes/`, `site/` | Theme templates, styles, and Astro routes |
| `publishing/` | Theme, homepage, renderers, models, aliases, and destinations |
| `data/`, `lib/` | Historical source lists and metadata resolution |
| `legacy/` | Preserved original-site snapshot |
| `scripts/`, `test/` | Build/publication tools and representative tests |
| `docs/` | Product decisions, implementation choices, and operating instructions |

`dist/`, `.generated/`, `exports/`, caches, and publication state are generated
or private local data and are ignored by Git. The original generator remains
available through `npm run build:legacy`; its output is `public/`.

## Specifications

- [Product design](docs/product-design.md): reader and author experience.
- [Content model](docs/content-model.md): pieces, collections, placements, editions.
- [Authoring format](docs/authoring-format.md): Markdown/YAML and configuration.
- [Architecture](docs/architecture.md): replaceable implementation choices.
- [Cross-posting](docs/cross-posting.md): delivery policies and provider limits.
- [Credentials and access](docs/credentials-and-access.md): provider capabilities, secret locations, and setup steps.
- [Dependencies and hosting](docs/dependencies-and-hosting.md): current toolchain, compatibility exceptions, and Amplify configuration.
- [Operations](docs/operations.md): deployment, export, recovery, and maintenance.
- [Implementation status](docs/implementation-plan.md): capability and verification map.

The README and specifications must change alongside the implementation. This
standing requirement is recorded in [AGENTS.md](AGENTS.md).

## Deployment

AWS Amplify builds and deploys pushes to GitHub `main`. `amplify.yml` defines
the build; `customHttp.yml` defines response headers. The publication workflow
waits for that exact deployed revision before activating short links or updating
enrolled remote copies. Local commits must be pushed to trigger deployment.

## License

[MIT](LICENSE) — Copyright © 2026 Danilo Poccia.
See [asset provenance](docs/assets.md) for fonts, artwork, and preserved material.
