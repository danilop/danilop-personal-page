# Danilo Poccia

*Notes Along the Way*

Articles, experiments, and ideas that will grow over time.

[Website](https://www.danilop.net) · [Publishing](docs/publishing-workflow.md) · [Design](docs/product-design.md) · [Operations](docs/operations.md)

## One article. Many ways to read it.

Write in Markdown. Publish an article on its own, place it in a collection, or
make it a section of a growing book. Collections can gain chapters, introductions,
appendices, and other book material without duplicating the original writing.

The Ink & Paper theme puts reading first: a name-first masthead, blue ink,
serif headlines, and generous space. Fonts, colors, images, CSS, and templates
live apart from the content and publishing system.
The configurable SVG favicon generates browser and iPhone home-screen icons;
see [branding assets](docs/authoring-format.md#browser-icons).

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

The new site is live at the main URL, with the historical catalogue at
`/archive/` and the preserved snapshot at `/original-site/`. Temporary `/new/`
links redirect to their root equivalents. See [verification](docs/verification.md)
for release evidence.

Third-party publication is manual: assignments prepare exports; commits and tags
never send or update external posts. No articles are enrolled. The DEV key is
not consumed by website builds or GitHub workflows. See
[credentials and access](docs/credentials-and-access.md) before first delivery.
Short-link setup still awaits [access approval](docs/deployment-access-review.md).
AI image automation, search, and a site-wide AI assistant remain future work.

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
npm run validate
npm run preview
```

Output goes to `dist/`. Ordinary article reading needs no JavaScript. Model
weights are downloaded only when a reader explicitly starts a model experiment.

## Publish

Follow the [publishing workflow](docs/publishing-workflow.md) from draft to release:

1. Write the Markdown article and prepare its media.
2. Preview locally, run checks, and approve the content and visuals.
3. Commit and merge into `main`; verify the production deployment.
4. Optionally review and manually deliver an explicitly selected external copy.

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
- [Authoring format](docs/authoring-format.md): Markdown/YAML, math syntax and configuration.
- [Architecture](docs/architecture.md): replaceable implementation choices.
- [Cross-posting](docs/cross-posting.md): delivery policies and provider limits.
- [Analytics and privacy](docs/analytics-and-privacy.md): deployed PostHog EU analytics, visitor consent, event definitions and operating instructions; MCP and exports remain unconfigured.
- [Media storage](docs/media-storage.md): configured S3/CloudFront delivery, uploads and corrections for images/PDFs.
- [Private operations](docs/private-operations.md): where account-specific notes live and how to recover them.
- [Credentials and access](docs/credentials-and-access.md): provider capabilities, secret locations, and setup steps.
- [Dependencies and hosting](docs/dependencies-and-hosting.md): current toolchain, compatibility exceptions, and Amplify configuration.
- [Operations](docs/operations.md): deployment, export, recovery, and maintenance.
- [Implementation status](docs/implementation-plan.md): capability and verification map.
- [Navigation review](docs/navigation-review.md): tested visitor journeys, improvements, and hosting limitations.

Keep documentation brief, professional, and task-focused. The README and affected
guides must change alongside the implementation; see [AGENTS.md](AGENTS.md).

## Deployment

Pull requests run the same validation command as Amplify. AWS Amplify builds
and deploys pushes to GitHub `main`; an independent GitHub job verifies the exact
live revision, routes, assets, RSS, indexing, and the original-site snapshot. `amplify.yml` defines
the build; `customHttp.yml` defines response headers. After integration setup,
the publication workflow requires that verification before activating
short links. Third-party delivery is a separate manual operation. Local commits
must be pushed to trigger website deployment.

## License

[MIT](LICENSE) — Copyright © 2026 Danilo Poccia.
See [asset provenance](docs/assets.md) for fonts, artwork, and preserved material.
