# Dependencies and deployment

## Dependency refresh — 2026-10-13

The root application and isolated prototype manifests and npm lockfiles were
refreshed against stable registry releases, including compatible transitive
updates. Python requirements were re-resolved with `uv pip compile --upgrade
--generate-hashes` and installed with hash verification in both project virtual
environments. This refresh was committed and deployed on 13 October 2026 with
the narration release; see [verification](verification.md).

## Dependency refresh — 2026-10-23

All npm dependencies in the root and prototype manifests were moved to their
latest stable releases (including Astro 7.4.2, ESLint 10.13, Playwright 1.64.1,
Puppeteer 25.16.0 and the AWS SDK clients 3.1156.0) with compatible transitive
updates; `npm audit` reports no vulnerabilities. The install-script allowlist pins
exact versions, so it now allows `puppeteer@25.16.0` and keeps `core-js@3.51.0`
disabled, as before. Python requirements in all three tools were re-resolved with
`uv pip compile --upgrade --generate-hashes` (code analysis after content quality,
which it includes) and reinstalled with hash checks; this moves `certifi` to
2026.10.23, resolving the critical emSign-root advisories.

Two latest majors are deliberately not adopted:

- **TypeScript 7** (the native compiler): `typescript-eslint` 8.72 supports
  TypeScript below 6.1 and `@astrojs/check` 0.9.12 supports 5 and 6, so TypeScript
  stays on 6.0.3.
- **`@types/node` 26**: the site runs Node 24 (`.nvmrc`), so its types stay on the
  24 line (24.19.2, the latest).

The same refresh added `pagefind` 1.5.2 (dev) and `@litert-lm/core` 0.18.0 for
search and the reading assistant.

## Front-matter parser — 2026-10-22

## Front-matter parser — 2026-10-22

Front matter is split with `@11ty/gray-matter` 3.0.0, the Eleventy team's
maintained fork of `gray-matter`. The original `gray-matter` 4.0.3 is unmaintained
and pins `js-yaml` 3, whose `argparse` 1 dependency pulled in `sprintf-js`
([GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), no
patched release). The fork uses `js-yaml` 5, so `sprintf-js` is no longer installed.

Every production `matter()` call that reads front-matter data passes the `yaml`
package as its YAML engine (`YAML.parse` with `maxAliasCount: 0`), so dates stay
strings, as the content schema expects, and `js-yaml` 5's schema changes
(unquoted dates as strings, no `<<` merge keys, errors on `!!binary`/`!!set` tags)
do not affect content. `scripts/prepare.ts` reads only the body of `about.md` and
keeps the default engine. Implemented and tested; it deploys with the commit that
introduces it.

## Supported stack

The [interactive Python pilot](code-activities.md) also pins Pyodide 314.0.7
as an on-demand browser dependency from jsDelivr. It is outside npm lockfiles and
audit coverage. Runtime upgrades require updating both its Worker import and
sandbox CSP, then testing real browser execution; there is no floating CDN URL.
The download happens only when a reader presses Run or Step. The simplified runner is
included in this release; the pilot chapter remains a draft.

| Component  | Version     | Update policy                                                   |
| ---------- | ----------- | --------------------------------------------------------------- |
| Node.js    | 24.21.0 LTS | Pin `.nvmrc`; stay on the supported LTS major                   |
| npm        | 12.2.0      | Pin `packageManager`; enforce engines                           |
| Astro      | 7.3.8       | Current stable; validate renderer and route compatibility       |
| TypeScript | 6.0.3       | Astro checker supports 5.x/6.x; typescript-eslint requires <6.1 |
| Node types | 24.19.2     | Match the runtime major                                         |
| Prettier   | 3.9.10      | Current stable                                                  |

Direct upgrades include AWS SDK clients 3.1150.0, WebLLM 0.2.86, PostHog 1.438.9,
Vega-Lite 6.5.0, Zod 4.6.7, Puppeteer 25.13.0 and Playwright 1.64.0. The prototype
uses Vite 8.3.4 and its React plugin 6.1.2. The dev-only analysis tools include
ESLint 10.12.0, typescript-eslint 8.71.2, Knip 6.41.0, dependency-cruiser 18.6.0,
Ruff 0.17.0 and ty 0.0.86. See the [analysis guide](code-analysis.md) for setup.

The only newer direct npm releases intentionally held back are TypeScript 7.0.2,
which is outside both Astro checker's and typescript-eslint's peer ranges, and
Node 26 type definitions, which do not match the Node 24 runtime. Node 24.21.0
and npm 12.2.0 remain current on the supported lines. The spaCy 3.8 family is
retained to match the pinned English model. Python transitives `thinc` 8.3.13
and `mando` 0.7.1 remain constrained by spaCy (`<8.4`) and Radon (`<0.8`)
respectively. Native analysis pins remain Gitleaks
8.30.1, actionlint 1.7.12 and ShellCheck 0.11.0; official releases were checked.

CI uses uv 0.13.0 and immutable commit pins for checkout 7.0.1, setup-node 7.1.0,
upload-artifact 7.0.2 and configure-aws-credentials 6.3.0. Keep committed lockfiles;
production builds must not perform dependency upgrades. The separate design
prototype is not part of the deployed bundle.

## Security status — 2026-10-13

The root `overrides` retain patched `lodash-es` 4.18.1 and make all npm KaTeX dependency edges
resolve to the root KaTeX 0.19.0 declaration (`"katex": "$katex"`). This replaces vulnerable
0.16.x copies used by Mermaid CLI and Markdown maths rendering, addressing
[GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7).
Mermaid's prebuilt browser bundle separately embeds patched KaTeX 0.18.11;
the override does not rewrite prebuilt bundles. Retain the overrides until upstream
constraints and a fresh audit make them unnecessary.

Astro now resolves `http-cache-semantics` 4.3.0. Although the published affected
range for [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
ends at 4.2.0, **4.3.0 still reproduces the reported behaviour**: bare or numeric
`max-stale` can reuse a shared Set-Cookie response whose freshness was zeroed.
The advisory lists no patched release. An audit no longer flagging this package
must not be treated as proof of a fix.

The current static site has no demonstrated path to that vulnerable operation.
Astro's build-time remote-image loader calls `storable()` and `timeToLive()`, not
`evaluateRequest()` or `satisfiesWithoutRevalidation()`, and does not forward
visitor request headers. `test/astro-cache-boundary.test.mjs` exercises the installed
Astro loader with both vulnerable methods guarded, covering public images,
Set-Cookie responses with zero reusable lifetime, and conditional 304 responses.
Reassess this conclusion before adding a server/shared response cache or changing
Astro's cache usage. No custom fork or dependency patch was introduced.

The root npm audit still reports seven high-severity package entries, all arising
from one advisory in `braces` 3.0.3 (Stylelint's dev-only glob chain), a current
release with no patched version available. The `sprintf-js` advisory was removed on
22 October 2026 by the [front-matter parser switch](#front-matter-parser--2026-10-22).
The audit's suggested old major downgrades are not applied. This is a dependency status report, not a full
assessment of those additional findings. The prototype audit reports zero known
vulnerabilities. See [verification evidence](verification.md#dependency-refresh-and-cache-boundary-check--2026-10-13).

## One validation command

```sh
npm ci
npm run validate
```

Validation runs tests, prepares clean content, checks types, builds, packages both
sites, and verifies the artifact. Tests run first so their generated media is
cleared before production preparation. Preparation runs once. `npm run build`
remains available for a build without the full test/check sequence.

`.npmrc` enforces engines and explicit lifecycle-script approvals. Review installer
changes when upgrading esbuild, fsevents, or Puppeteer; do not bypass the allowlist.
Mermaid rendering requires Chromium and its system libraries. Amplify installs
AL2023 libraries; GitHub validation uses Ubuntu 24.04, installs Chromium's system
dependencies, and permits user namespaces for the exact installed browser path
through AppArmor so Chromium's sandbox can run.

## GitHub → Amplify → live verification

1. Pull requests run **Validate website** with a read-only token and no publishing
   credentials. The same job can be dispatched manually.
2. Pushing to `main` triggers Amplify's connected GitHub build automatically.
   The checked-in `amplify.yml` is authoritative; the console copy is a fallback.
3. Amplify runs `npm run validate` and deploys `dist/`. It caches npm downloads,
   render output, and Chromium, not `node_modules`. Astro's content store and Vite
   caches use workspace-local `.astro/` paths, keeping parallel isolated builds
   independent even when they share dependency installations.
4. **Verify deployment and update short links** independently waits for the exact
   revision at the uncached build marker, even when publication is disabled.
   It checks pages, resources/cache headers, RSS, true 404 responses, and original
   snapshot navigation and indexing. A newer main revision supersedes an older check explicitly;
   superseded checks cannot authorize publication.
5. Only a verified, indexable main revision can reach the optional publication
   job for short links. Third-party delivery is excluded from all GitHub workflows;
   its CLI requires a manually selected, reviewed copy. Short-link access remains
   a separate setup task.

`publishing/deployment.json` is the single source for HTTPS origin, base path,
indexing, and original-root preservation. `customHttp.yml` sets the corresponding
headers; review its path patterns when changing the base. Native Amplify 404
handling is retained because explicit `404` rules redirected with HTTP 302.

Amplify manages the website's underlying CloudFront distribution outside this
account's directly managed distributions. Its hosting remains subject to
[Amplify pricing](https://aws.amazon.com/amplify/pricing/); the short-link
distribution's CloudFront Free subscription does not cover the website.
[CloudFront flat-rate plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html)
cover one distribution each, with up to three Free subscriptions per account.
Using a separate Free plan for website delivery would require a hosting change,
such as deploying the static build to private S3 behind a directly managed
CloudFront distribution with OAC. That migration is not implemented or approved.
Placing another distribution in front of Amplify would not remove Amplify's
hosting/build charges or cap the entire application's bill.

Repository workflow defaults are read-only, with pull-request approval disabled.
Each workflow declares its own permissions. `main` currently permits direct pushes:
PR validation is available but is not a required merge gate. Branch protection
and automated dependency-update PRs are optional follow-up decisions.

## Evidence and operation

The pre-change main revision `686b116` matched successful Amplify job 5 and the
live `/new/build.json`; its build took about 2 minutes 24 seconds. The earlier
GitHub workflow only checked publication mode and skipped delivery, so its green
status did not prove deployment. The independent verifier closes that gap.
Local validation now passes 43 tests and checks 178 new-site files and 733 links.
See [verification](verification.md) for hosted results and
[publishing workflow](publishing-workflow.md) for author steps.

```sh
npm run verify:deployment           # verify the current commit is live
npm run verify:deployment -- --wait # wait up to 20 minutes for the marker, plus 3 for CDN convergence
```

Sources checked during this review: [Node releases](https://nodejs.org/en/blog/release),
[npm registry](https://www.npmjs.com/package/@astrojs/check),
[Amplify build settings](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html),
[GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).

## Local speech runtime

Kokoro uses a separate hash-locked Python 3.12.13 environment, MLX-Audio 0.5.8,
Misaki 0.9.4 and pinned model/voice/encoder checksums. `npm run narration:setup`
installs it explicitly on Apple Silicon. CI and reader browsers use prepared
MP3 assets and never download models or run inference. See [runtime comparison](narration-runtime-comparison.md)
and [article narration](article-narration.md) for provenance and licence boundaries.
