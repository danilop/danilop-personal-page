# Dependencies and deployment

Reviewed 2026-09-16. The new site uses `/`; its original-site snapshot remains at `/original-site/`.

## Supported stack

| Component | Version | Update policy |
| --- | --- | --- |
| Node.js | 24.21.0 LTS | Pin `.nvmrc`; stay on the supported LTS major |
| npm | 12.0.2 | Pin `packageManager`; enforce engines |
| Astro | 7.3.2 | Current stable; validate renderer and route compatibility |
| TypeScript | 6.0.3 | Astro checker supports 5.x/6.x, not 7.x |
| Node types | 24.13.5 | Match the runtime major; do not follow an unrelated latest tag |
| Prettier | 3.9.7 | Compatible patch applied in this review |

Registry review found no other compatible direct upgrades. The dependency audit
reports zero known vulnerabilities. This is an advisory database result, not a
full security assessment. Keep the committed lockfile; never upgrade during a
production build. The separate design prototype is not part of the deployed bundle.

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
   render output, and Chromium, not `node_modules`.
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

Repository workflow defaults are read-only, with pull-request approval disabled.
Each workflow declares its own permissions. `main` currently permits direct pushes:
PR validation is available but is not a required merge gate. Branch protection
and automated dependency-update PRs are optional follow-up decisions.

## Evidence and operation

The pre-change main revision `686b116` matched successful Amplify job 5 and the
live `/new/build.json`; its build took about 2 minutes 24 seconds. The earlier
GitHub workflow only checked publication mode and skipped delivery, so its green
status did not prove deployment. The independent verifier closes that gap.
Local validation passes 40 tests and checks 178 new-site files and 733 links.
See [verification](verification.md) for hosted results and
[publishing workflow](publishing-workflow.md) for author steps.

```sh
npm run verify:deployment           # verify the current commit is live
npm run verify:deployment -- --wait # wait up to 20 minutes, then check routes
```

Sources checked during this review: [Node releases](https://nodejs.org/en/blog/release),
[npm registry](https://www.npmjs.com/package/@astrojs/check),
[Amplify build settings](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html),
[GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).
