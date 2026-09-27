# Code analysis, complexity and coverage

Status: implemented locally on 2026-09-25, with the initial findings corrected on
2026-09-27. The Git hook checks the exact staged snapshot; CI checks the versionable
checkout. See [verification](verification.md) for dated validation evidence. Reports
are ignored local artifacts; no suppression baseline was added.

## Tools and source coverage

Versions were checked against the official package registries and upstream releases.
JavaScript tools are exact dev dependencies in `package.json`/`package-lock.json`.
Python tools and the existing NLP test dependencies are hash-locked in
`tools/code-analysis/requirements.txt`. Native versions are pinned in
`tools/code-analysis/native-versions.json` and checked on every run. Installation
never occurs during a commit.

| Source                   | Checks                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript               | ESLint 10, typescript-eslint typed promise/assertion rules, strict TypeScript, Knip dead exports/files/dependencies, SonarJS duplication and cognitive complexity |
| JavaScript and JSX       | ESLint correctness, browser/Node/CloudFront environments, SonarJS, Knip; maintained React, hooks and accessibility rules for the prototype                        |
| Astro                    | Astro check, Astro ESLint and accessibility rules, embedded script checking, Stylelint for styles                                                                 |
| HTML                     | HTML-validate, ESLint's HTML integration for inline scripts, Stylelint for embedded CSS                                                                           |
| CSS                      | Stylelint standard rules; formatting with Prettier                                                                                                                |
| Python                   | Ruff lint/format and complexity, ty type checking, Vulture dead code, Bandit security findings, Radon complexity inventory                                        |
| YAML/JSON                | ESLint YAML/JSON correctness; Prettier; existing application schemas in tests/build                                                                               |
| Shell and workflow shell | ShellCheck, plus actionlint for GitHub Actions expressions and workflow structure                                                                                 |
| Secrets                  | Gitleaks with redacted diagnostics on the versionable snapshot                                                                                                    |
| Test coverage            | c8/V8 with source maps for JS/TS and Python Coverage.py with branches; HTML, JSON and LCOV/XML reports                                                            |
| Dependency architecture  | dependency-cruiser 18.4.0, runtime cycles and explicit module boundaries for JS/TS/JSX                                                                            |

The main app, local authoring, scripts, infrastructure source, legacy _generator_
source and the isolated JSX prototype are included. Historical snapshots, generated
output, installed dependencies, caches, publication/recovery state, article prose,
and third-party/static assets are not style-linted. Example Python fixtures are
checked. Secret scanning includes versionable content/configuration; ignored local
credentials are not copied into worktree snapshots. A mistakenly staged secret is
included in the staged scan.

Dynamic entrypoints are explicit in Knip. Its narrowly named exceptions cover the
CloudFront built-in module, externally invoked renderer/analyzer commands, stylesheet
font imports, implicit ambient types, and the separately installed Python runtime.
They do not suppress unused application files or exports. Source references to shared
classic-script bindings are explicit in ESLint; this does not remove the need for
the planned authoring-module refactor. Astro's generated virtual script fragments
use syntax linting plus Astro's checker, rather than an incompatible standalone
TypeScript project parser. Stylelint recognises Astro's compiler `:global` selector;
HTML validation uses the lowercase doctype emitted by Prettier. Python subprocess
exceptions are documented at their reviewed call sites: fixed argument lists,
isolated interpreter, bounded timeout and no shell execution.

## Setup and commands

Use the Node version in `.nvmrc` and npm version in `package.json`. A mismatched
runtime fails with instructions; it is not silently accepted. Install `uv` and the
pinned Gitleaks/actionlint releases (macOS Homebrew currently supplies them). With Go,
the latter can be installed reproducibly with:

```sh
go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
go install github.com/zricethezav/gitleaks/v8@v8.30.1
```

Ensure those executables are on PATH. ShellCheck is provided by the hash-locked
`shellcheck-py` package in the analysis environment. Then:

```sh
npm ci --include=dev
npm --prefix prototypes/ink-and-paper ci --include=dev
npm run analysis:setup
npm run verify:worktree
```

Setup creates `.venv-analysis`, installs locked dependencies, checks native tool
versions and configures this repository's `core.hooksPath` as `.githooks`. It refuses
to replace an existing unrelated hook. It does not change global Git configuration,
stage files, commit, push, run assistants or deploy. The hook itself uses Git's native
hook mechanism; no Husky/lint-staged dependency is necessary because validation is
read-only and snapshot-based.

| Command                   | Scope                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify:commit`   | Exactly the staged snapshot, including whole-project static checks and coverage; also runs automatically before a commit |
| `npm run verify:worktree` | Current tracked and non-ignored untracked files in an isolated snapshot, useful before staging                           |
| `npm run verify:static`   | Worktree snapshot static checks only; does not replace the full commit gate                                              |
| `npm run test:coverage`   | Run the coverage suite directly in this checkout, including the prototype build                                          |
| `npm run verify:ci`       | Worktree snapshot full analysis/coverage plus the existing release preparation and verified build                        |

An empty staged diff reports that there is nothing to check; use `verify:worktree`
for the current checkout. Fixes are never automatically applied by the hook. Existing
`npm test`, `npm run check` and `npm run validate` remain available.

`npm test` builds the prototype, then runs the JS/TS suite, worker contracts and Chromium interaction
tests. Install both npm workspaces first. Playwright drives the pinned Puppeteer
Chrome headless shell, reusing the renderer browser installation and Linux system
libraries. Tests start disposable loopback authoring/Vite servers and temporary Git
repositories. Model, analytics and cloud-publication tests mock external boundaries;
they do not publish content, upload media, send analytics or download models. The
server fixture explicitly flushes real V8 coverage before shutdown so renderer
cleanup timing cannot silently discard its measurements.

## Commit safety and failure behavior

The hook copies staged bytes into a disposable directory without stashing or changing
the real index. Unstaged edits cannot conceal a staged error. Worktree mode copies
only files Git considers versionable. A snapshot has its own Git index/refs so
existing authoring/edition tests can inspect repository state; existing objects are
read through Git's alternate-object mechanism, not through a shared `.git` directory.
Git's hook-local environment variables are cleared for snapshot execution.

Dependencies are reused through explicit environment symlinks. Staged lockfiles must
match the installed working-tree setup; stage/install matching lockfiles first when
updating dependencies. Symlink/submodule source entries and unresolved merges are
rejected for explicit inspection. The index fingerprint is checked before/after
validation. Filenames are passed as arguments, not interpolated into shell commands.
An analyzer crash, missing executable, timeout or missing summary fails the gate.

Independent checks continue after a failure so one run produces the complete
inventory. Child tests and coverage thresholds both affect success. The prototype
is built before its packaging tests. Reports are copied back before the temporary
snapshot is removed. Snapshot build artifacts are for validation, not deployment.

## Complexity and coverage policy

The initial explicit limits are:

- JavaScript/TypeScript cyclomatic complexity: **20** per function, explicitly using ESLint's **classic** counting variant.
- JavaScript/TypeScript cognitive complexity: **15** per function.
- Python McCabe complexity: **15** per function, enforced by Ruff C901.
- JavaScript/TypeScript coverage: **80% lines/statements/functions**, **70% branches**.
- Python combined statement/branch coverage: **80%**.

These limits remain unchanged after fixing the initial findings. Radon provides an
additional inventory; Ruff supplies the blocking Python complexity gate. Exceptions or reduced
thresholds require an explained code/configuration change, not automatic suppression.
Prefer focused refactoring and behavior-based tests to coverage-only assertions.

Keep the measures separate: cyclomatic complexity describes branching paths;
cognitive complexity estimates reading difficulty, including nesting. Neither
measures correctness. ESLint counts optional chains/default parameters and classic
switch cases; Python Ruff/Radon use their own language-specific counting rules.
Do not add their scores together or compare repository averages across languages.
These thresholds are engineering starting points, not universal research cutoffs.
CSS specificity/nesting, markup accessibility and component state/effect design
need their own checks and review; a function score does not capture them.

c8's `all` setting includes eligible executable source that tests never import,
including browser modules, scripts and prototype JSX. Coverage is aggregate over
that declared scope. A global pass does not prove every function is well tested.
Chromium coverage from the authoring browser modules and prototype JSX is merged
with Node coverage only after checking exact source bytes or source-map contents.
Astro/HTML templates and inline JavaScript are statically checked and exercised by
browser tests but are **not instrumented** in this report. Manual accessibility
review remains separate; aggregate coverage does not establish accessibility.
Python coverage includes all production Python modules under `tools/content-quality`,
not its tests or illustrative code fixtures.

Read `.analysis/report.md`, `.analysis/summary.json` and `.analysis/metrics.json` for
results and complexity locations. Full diagnostics remain beside them. Coverage
reports are under `coverage/javascript/` and `coverage/python/`. Missing/incomplete
measurements are not reported as zero findings or successful checks. Reports may
contain source snippets and stay out of website artifacts.

### Dependency boundaries

`.dependency-cruiser.cjs` blocks runtime cycles; browser code reaching Node built-ins
or private authoring/server tools, including through shared modules; core modules
importing application entrypoints; production importing prototypes/tests; and
prototypes importing production modules. Server-side `site/` code may legitimately
use Node. Type-only imports are omitted from this runtime graph. Private browser
authoring UI can call the local API but must not import its server implementation.

The graph parses JS/TS/JSX modules and literal dynamic imports. It does not analyse
Astro/HTML embedded scripts, Python imports, computed import paths, shared globals
between classic scripts or the internals of installed npm dependencies. Astro's
server/component dependencies therefore remain a gap; the build, type checks and
rendered tests still matter. Unresolved imports are not a separate architecture
gate because framework/CloudFront virtual modules require their own resolution.

The JSON reporter upstream returns exit zero even on rule violations.
`tools/code-analysis/architecture.mjs` explicitly checks its verdict and fails on
violations, empty/invalid output or process errors. Contract fixtures exercise all
six forbidden rules and verify legitimate Node/type-only imports remain allowed.

### Prioritising refactoring

The report lists **files with threshold violations**, with the individual function
locations retained below and in `metrics.json`. It sorts current changes first,
then commits touching the file during the preceding **90 days** descending, then
file branch coverage ascending (unavailable first), then filename. These are
visible, separate signals and an advisory review order; no composite risk score or
new threshold is introduced. More findings do not necessarily mean more complex
functions: one function may violate both JS metrics.

Commit frequency counts non-merge commits at the checked HEAD, using exact current
paths without following renames. New files are labelled as having no committed
history. Changed means the checked snapshot differs from HEAD, including untracked
files in worktree mode; it does not mean the whole PR diff. CI fetches full history.
Local shallow checkouts retain shallow metadata in their snapshot and report counts
as lower bounds; unavailable Git history is explicitly labelled.

Coverage is file-level, not coverage of the reported function. Missing coverage,
no branches, static-only scans and failed test suites are labelled unavailable,
never zero or fully covered. Coverage from older runs is not reused in static-only
reports. A failed aggregate threshold can still provide useful measurements when
the tests themselves passed. Prioritisation never changes the blocking rules.

CI runs on pull requests and main pushes and retains reports for 14 days, including
failed runs. This provides comparable per-run metrics without a paid service. GitHub
branch-protection/required-check settings are not changed by this task; a local hook
can be bypassed and a failing check alone does not prevent Amplify's push-triggered
deployment. Review those release controls before relying on CI as a deployment gate.

## Current findings and verification

See the dated entry in [verification](verification.md#code-analysis-and-commit-gate--2026-09-25)
for actual counts, measured coverage and test outcomes. The setup does not silently
accept existing complexity, formatting, typing, dead-code or accessibility findings.
A narrowly scoped bug found by the scan was fixed: delayed image briefs now retain
the source text and result they were generated from, preserving newer edits and
avoiding an undefined-variable failure during recovery.

## Upgrades and references

Upgrade deliberately: query current stable releases, check Node/TypeScript/plugin
compatibility, update exact npm versions/lockfile, re-resolve Python requirements
with `uv pip compile --generate-hashes`, review native pins, then rerun the complete
suite. Do not use unconstrained `latest` installations inside hooks or CI. ty is
currently a 0.x tool; its diagnostics complement rather than prove runtime behavior.

Primary documentation: [ESLint](https://eslint.org/docs/latest/use/configure/configuration-files),
[typed linting](https://typescript-eslint.io/getting-started/typed-linting/),
[Astro linting](https://ota-meshi.github.io/eslint-plugin-astro/user-guide/),
[Knip](https://knip.dev/reference/configuration),
[dependency-cruiser rules](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md),
[ESLint complexity variants](https://eslint.org/docs/latest/rules/complexity),
[Ruff complexity](https://docs.astral.sh/ruff/rules/complex-structure/),
[ty](https://docs.astral.sh/ty/type-checking/),
[Vulture](https://github.com/jendrikseipp/vulture),
[c8](https://github.com/bcoe/c8),
[Coverage.py](https://coverage.readthedocs.io/en/latest/config.html),
[HTML-validate](https://html-validate.org/usage/index.html),
[Gitleaks](https://github.com/gitleaks/gitleaks), and
[actionlint](https://github.com/rhysd/actionlint).
