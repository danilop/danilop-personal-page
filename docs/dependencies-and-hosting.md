# Dependencies and Amplify hosting

Updated 2026-09-15. Local verification and the modernized hosted preview passed.
The production build preserves the original root site and adds the rebuild at `/new/`.

## Supported versions

| Component | Selected version | Reason |
| --- | --- | --- |
| Node.js | 24.21.0 | Current Node 24 LTS; pinned in `.nvmrc` |
| npm | 12.0.2 | Current stable; pinned in `packageManager` |
| Astro | 7.3.2 | Current stable, already in use |
| TypeScript | 6.0.3 | Latest compatible version; Astro's checker requires the 6.x compiler API |
| Node types | 24.13.5 | Match the chosen Node 24 runtime rather than a different major's registry tag |
| Cheerio | 1.2.0 | Replace the old release candidate |
| fs-extra | 11.4.0 | Replace 8.1.0 |
| open-graph-scraper | 6.12.0 | Replace 4.6.0; preserve source cache and editorial overrides |

All other direct dependencies were checked against current registry releases;
compatible transitive updates are recorded in `package-lock.json`. TypeScript 7
is not forced past Astro's peer requirements. Two upstream deprecated transitive
packages remain: `whatwg-encoding` through Cheerio's encoding-sniffer, and
`node-domexception` through CitationJS's fetch stack. Their current parent
packages still require them; no incompatible overrides were introduced.

Sources: [Node releases](https://nodejs.org/en/blog/release),
[Astro TypeScript compatibility](https://github.com/withastro/astro/issues/17268),
[Open Graph options](https://github.com/jshemas/openGraphScraper).
Package versions and peers were also read directly from the npm registry.

The isolated design prototype was updated too: React/React DOM 19.3.0, Vite 8.3.0,
and the React plugin 6.1.1. It shares the runtime/npm requirements but keeps its
own lockfile and install-script policy. Its four hosting tests, build and browser
article-dialog smoke check pass, with no browser errors or warnings. Its audit
also reports zero known vulnerabilities. These prototype dependencies are not
part of the production Astro bundle.

## Reproducible installation

`.npmrc` enforces the supported engines and strict install-script policy.
`package.json` permits only the reviewed installed versions of esbuild, fsevents
and Puppeteer to run dependency lifecycle scripts. Changing one of those versions
requires reviewing its installer and updating its explicit approval. Do not use
a blanket allow-all flag to bypass an install failure.

Use `npm ci` for builds. Updating dependencies uses `npm update` or explicit
package upgrades, followed by a clean install, type checks, tests and build.
`npm outdated` can still list TypeScript and the Node type tag; the table above
records why the selected versions differ. Native model binaries and weights keep
their separately verified immutable versions and integrity manifest.
[npm install policy](https://docs.npmjs.com/cli/install/).

## Amplify

The existing app already uses `amplify:al2023` and static `WEB` hosting. No SSR
adapter or Amplify backend dependency is needed for this static website.

The version-1 repository build specification:

- Installs `.nvmrc` without the image's unrelated default global packages.
- Installs the npm version declared by `packageManager`.
- Uses AL2023 `dnf` for Chromium's shared-library dependencies.
- Installs the locked dependency tree including development tools.
- Checks types, runs tests, builds and verifies public output before deployment.
- Publishes `dist/` and caches `.npm`, renderer `cache/`, and `.cache/puppeteer`
  relative to the repository. Puppeteer's cache directory is explicitly exported.

The console fallback build specification was synchronized and read back to verify
an exact match with the repository recipe. The combined `main` build packages
the preserved root site and `/new/` together. Use
`infrastructure/amplify-coexistence-rules.json` for this stage;
`infrastructure/amplify-rules.json` remains reserved for final root cutover.
`customHttp.yml` retains reader/security headers and an uncached build marker,
and makes hashed `_astro` assets cacheable for a year with `immutable`.

Sources: [AWS build settings](https://docs.aws.amazon.com/amplify/latest/userguide/edit-build-settings.html),
[cache path rules](https://docs.aws.amazon.com/amplify/latest/userguide/yml-specification-syntax.html).

## GitHub Actions

Official action releases are pinned by immutable commit ID: checkout 7.0.1,
setup-node 7.0.0, configure-aws-credentials 6.3.0 and upload-artifact 7.0.1.
A read-only configuration job skips publication when deployment indexing is disabled.
Checkout does not persist credentials. Both push and manual publication require
`refs/heads/main`; OIDC permission is scoped to the publication job. Preview
artifacts expire after seven days. These changes do not provision cloud access or
connect external publishing credentials. The separate DEV environment and role
work in [credentials and access](credentials-and-access.md) is still pending.

## Verification

- Fresh npm 12 installation on Node 24 succeeds; dependency audit reports zero
  known vulnerabilities and `npm ls --all` has no invalid dependencies.
- 24 tests pass (8 metadata/discovery, 16 publishing), including real parsing
  through the upgraded Open Graph library. Its timeout is now 20 seconds rather
  than the old millisecond value.
- Type checks pass; production output remains 29 pages, 177 files, 695 checked
  local links, and 307 historical records.
- Amplify preview job 4 passed build/deploy/verify at commit
  `008fbc27f1ca3de8fb66bc0daced8c40737b65ab`. All 24 hosted tests passed.
  The public build marker matches; homepage, article, archive, original snapshot,
  robots, feed and sitemap return 200. A hashed CSS response has
  `public, max-age=31536000, immutable`; the build marker has `no-store`.
- Prototype-only dependency changes and final documentation follow that preview
  commit; they do not change the deployed production build inputs.
