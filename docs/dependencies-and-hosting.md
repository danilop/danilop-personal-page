# Dependencies and deployment

## Dependency refresh — 2026-10-01

The [analysis guide](code-analysis.md) documents the new dev-only toolchain and
setup. ESLint 10.11.0, typescript-eslint 8.71.0, Knip 6.39.0, dependency-cruiser
18.5.0, c8 12.0.0 and the
Astro/React/HTML/CSS/configuration adapters are pinned in npm. The existing
TypeScript 6.0.3 and Node pin are retained for compatible typed analysis. Python
Ruff 0.16.9, ty 0.0.84, Vulture 2.16, Coverage.py 7.16.2, Bandit 1.9.4 and Radon
6.0.1 are installed in a separate hash-locked `.venv-analysis` environment.
Gitleaks 8.30.1, actionlint 1.7.12 and ShellCheck 0.11.0 are verified before runs.
The tools do not become public browser dependencies or run inference.

Reviewed 2026-10-01. The new site uses `/`; its original-site snapshot remains at `/original-site/`.

## Supported stack

| Component | Version | Update policy |
| --- | --- | --- |
| Node.js | 24.21.0 LTS | Pin `.nvmrc`; stay on the supported LTS major |
| npm | 12.2.0 | Pin `packageManager`; enforce engines |
| Astro | 7.3.5 | Current stable; validate renderer and route compatibility |
| TypeScript | 6.0.3 | Astro checker supports 5.x/6.x, not 7.x |
| Node types | 24.19.0 | Match the runtime major; do not follow an unrelated latest tag |
| Prettier | 3.9.9 | Compatible patch applied in this review |

The root application and isolated prototype manifests and npm lockfiles were
refreshed against the stable registry releases, including compatible transitive
updates. This includes Mermaid CLI 12.0.0, Citation.js 0.9.0, KaTeX 0.19.0,
Puppeteer 25.12.0 and prototype Vite 8.3.2. Python hash-locked requirements were
re-resolved with `uv pip compile --upgrade --generate-hashes` and installed in both
project virtual environments.

Two intentional exceptions remain: TypeScript 7.0.2 is outside both Astro checker's
and typescript-eslint's supported peer ranges, and Node 26 type definitions would
not match the Node 24 runtime. Node 24.21.0 remains the latest release on the
project's supported LTS line. These are compatibility decisions, not missed updates.

Mermaid 12's parser pins a vulnerable `lodash-es` version. A root `overrides` entry
selects the patched 4.18.1 release without overriding the parser's major version.
Retain this override until upstream resolves the advisory and a fresh audit confirms
it is unnecessary. Native analysis tools and the spaCy 3.8 English model are retained;
the native pins already match their current stable releases and the NLP model must
match the installed spaCy family.

Registry review found no other compatible direct upgrades. The dependency audit
reports zero known vulnerabilities. This is an advisory database result, not a
full security assessment. Keep the committed lockfile; never upgrade during a
production build. The separate design prototype is not part of the deployed bundle.

Local verification on 1 October passed all 27 analysis/test/build checks, including
197 JavaScript/TypeScript and 16 Python tests. The isolated prototype also rendered
with a clean browser console. This refresh has not been committed or deployed;
see [verification evidence](verification.md#dependency-and-shared-helper-refresh--2026-10-01).

All action pins match their current official releases: checkout 7.0.1, setup-node
7.0.0, upload-artifact 7.0.1, and configure-aws-credentials 6.3.0. Pins use immutable
commit IDs. TypeScript's newer major and Node's newer majors are not automatic
upgrade targets.

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
