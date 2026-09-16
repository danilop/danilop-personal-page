# Danilo Poccia

*Notes Along the Way*

Articles, experiments, and ideas that can grow over time.

[Website](https://www.danilop.net) · [Publishing](docs/publishing-workflow.md) · [Design](docs/product-design.md) · [Operations](docs/operations.md)

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
  synchronization, and an assisted Medium workflow. Exported full articles and
  excerpts open with a direct link to the original article.
- **Durable links:** reviewed aliases for new work at `danilop.link`, activated
  only after the canonical publication is live.
- **Earlier Work:** the historical catalogue in the new design. **The Original
  Site** preserves the old look, with a return link to the current website. **Elsewhere** is reserved for external writing
  published after relaunch. Empty sections stay hidden.

Public PDFs and published Google Docs/Slides load on reader request. iCloud
Photos albums use public album links; photographs are not copied into this repo.
The About page presents social profiles in a separate row below the biography,
with local icons and visible platform names configured in `publishing/site.yaml`.

## Release status

The rebuild is verified locally and on the
[live preview](https://www.danilop.net/new/),
with 37 passing tests. The verified live deployment preserves the original site at
`/` and serves the rebuild under `/new/`. Root cutover remains pending.

Short-link setup awaits [access approval](docs/deployment-access-review.md).
External accounts are not connected; no articles are enrolled for cross-posting.
Protected DEV delivery still needs implementation. Follow
[credentials and access](docs/credentials-and-access.md) before adding keys.
AI image automation, search, and a site-wide AI assistant remain future work.
See [verification](docs/verification.md) and [launch status](docs/launch-review.md)
for tested capabilities and remaining release gates.

The [temporary `/new/` deployment](docs/launch-review.md#temporary-launch-under-new)
uses shared base-path configuration. Short-link and external delivery are disabled
while this section is a non-indexable preview.

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

## Publish

Follow the [publishing workflow](docs/publishing-workflow.md) from draft to release:

1. Write the Markdown article and prepare its media.
2. Preview locally, run checks, and approve the content and visuals.
3. Commit and merge into `main`; verify the production deployment.
4. After final cutover and integration setup, activate short links and external copies.

The guide also covers collections, book editions, updates, and recovery. Use the
[authoring reference](docs/authoring-format.md) for file formats and the
[image authoring proposal](docs/image-authoring-workflow.md) for planned Codex support.

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

- [Publishing workflow](docs/publishing-workflow.md): drafting, review, release, distribution, and updates.
- [Product design](docs/product-design.md): reader and author experience.
- [Content model](docs/content-model.md): pieces, collections, placements, editions.
- [Authoring format](docs/authoring-format.md): Markdown/YAML and configuration.
- [Architecture](docs/architecture.md): replaceable implementation choices.
- [Cross-posting](docs/cross-posting.md): delivery policies and provider limits.
- [Analytics and privacy](docs/analytics-and-privacy.md): proposed provider comparison and consent approach; not enabled.
- [Credentials and access](docs/credentials-and-access.md): provider capabilities, secret locations, and setup steps.
- [Dependencies and hosting](docs/dependencies-and-hosting.md): current toolchain, compatibility exceptions, and Amplify configuration.
- [Operations](docs/operations.md): deployment, export, recovery, and maintenance.
- [Implementation status](docs/implementation-plan.md): capability and verification map.
- [Navigation review](docs/navigation-review.md): tested visitor journeys, improvements, and the pending hosted 404 rule.

Keep documentation brief, professional, and task-focused. The README and affected
guides must change alongside the implementation; see [AGENTS.md](AGENTS.md).

## Deployment

AWS Amplify builds and deploys pushes to GitHub `main`. `amplify.yml` defines
the build; `customHttp.yml` defines response headers. After integration setup,
the publication workflow waits for that exact deployed revision before activating
short links or updating enrolled remote copies. Local commits must be pushed to
trigger deployment. The `/new/` preview keeps the original root site intact.

## License

[MIT](LICENSE) — Copyright © 2026 Danilo Poccia.
See [asset provenance](docs/assets.md) for fonts, artwork, and preserved material.
