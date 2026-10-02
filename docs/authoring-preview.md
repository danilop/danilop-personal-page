# Preview: browse, edit and review locally

Implemented locally. `npm run preview` is the shared preview entrypoint. It renders
the full draft-inclusive site with production templates and runs the private
editor. Neither starting preview nor saving commits, pushes or deploys content.

## Everyday workflow

Import once or edit files in `content/pieces/` and `content/collections/`. Keep
`draft: true` while working. Run:

```sh
npm run preview
```

Browse `http://127.0.0.1:4322/`. Use the same quiet **Edit** link on draft and
published article/book pages; the editor is at `/_author/`. Saved changes and
external source edits rebuild the site in the background. The editor also offers
live prose preview, undo/redo, saved versions, writing checks, editorial review
and image tools. NLP runs on demand, not at startup. See [local authoring](local-authoring.md).

Use **Preview content** in the local site banner to switch between **Show drafts**
(the startup default) and **Published only**. Switching rebuilds the isolated
preview and returns to the homepage. Published-only mode uses the source draft
flags unchanged, so homepage selection, ordering, listings and collections reflect
published content. Edit links and automatic refresh remain available; this is still
a local authoring preview, not a production deployment. All tabs on the same server
share the selection until restart. A failed build retains the last successful view.
This switch is available in live preview, not read-only snapshots or release mode.

Astro's content cache and Vite's cache live under each workspace's ignored
`.astro/` directory. Temporary previews and concurrent test builds share installed
dependencies through a symlink, but never share generated content stores. This
prevents one build's article inventory from replacing another build's routes.

### Watch application code

For development, leave this running:

```sh
./preview.sh
```

The executable wrapper runs `npm run preview -- --watch --open` from the repository
directory and selects the Node version in `.nvmrc` through nvm when needed.
Complete the [development setup](../README.md#develop) once first; the wrapper
does not install Node or dependencies. You can launch it by its full path from
any directory. Extra arguments are forwarded: `./preview.sh --port 4330` or
`./preview.sh --help`.

After the first successful site build it opens the homepage in your default
browser, normally in a new tab according to browser preferences. It opens only
once per invocation, even when watch mode restarts the server. Use
`./preview.sh --no-open` to disable this. For the npm command, add `--open` to
request the same behaviour. Help and build-only runs never open a browser.
Opening failure leaves the preview running and prints the URL for manual use.

Start at the homepage and follow **Edit** on a piece when needed. The
`/_author/` URL remains a direct shortcut to the content list and settings;
opening it separately is optional.

The existing content/publishing/template/asset watcher still rebuilds the site.
Node's native watch mode additionally restarts the editor server for changes to
`scripts/author.ts` and its imported modules, including server-side review logic.
It recovers when an import error is fixed, retains console output, and stops with
Ctrl+C. Generated output is not a watched import, avoiding rebuild/restart loops.
The wrapper uses the same preview entrypoint and adds no dependencies.

Reading pages refresh when the build changes or the server session is replaced.
The editor reconnects through its existing session-token recovery and preserves
its current text; it is never forcibly reloaded. Refresh that tab manually after
changing browser JS/HTML/CSS. These files are served fresh on request, but are not
imported server modules and do not themselves restart Node. The review prompt is
read afresh for each review. Imported server code changes cancel active jobs and
reset server-side review/job state; avoid those edits during an active review.
Changes to the preview launcher itself or installed toolchain still require a
manual restart. This is server restart, not hot module replacement.

`--watch` applies only to live preview; combining it with `--release` or `--snapshot`
is rejected. A custom port still works: `npm run preview -- --watch --port 4330`.

There is no separate `author` command or `preview:authoring` alias. All modes
below default to port 4322 and bind to `127.0.0.1`. Stop with Ctrl+C before switching
modes. Use `--port NUMBER` to choose another port. Run `npm run preview -- --help`
for all options.

A piece and its collection each retain their own draft flag. Remove it (or set it
to false) only when approved. Standalone articles need a slug and publication date.
Future dates do not schedule publication. Commit/push only after release checks.

### Node selection troubleshooting

An application installer can prepend its own Node to `PATH`. In a fresh terminal,
check `command -v nvm`, `command -v node`, `node --version`, and `npm --version`.
From the repository, `nvm use` should select `.nvmrc`; the npm version is pinned
in `package.json`.

For zsh with nvm installed in its default location, initialise nvm in `~/.zshrc`
after application-specific PATH additions:

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Preserve a custom `NVM_DIR` if your installation uses one. Back up shell settings
before editing, then open a new terminal. If nvm itself is missing, restore it
using the [official nvm installation instructions](https://github.com/nvm-sh/nvm#installing-and-updating)
and repeat the [development setup](../README.md#develop). A PATH conflict does
not require deleting another application's bundled Node or changing managers.
The preview wrapper also loads nvm explicitly when the active Node differs from
`.nvmrc`, so it works from a non-interactive shell without sourcing `~/.zshrc`.

## Read-only snapshots (advanced)

Use a snapshot to inspect selected or external content without importing or editing
it. This mode has no editor or Edit links:

```sh
npm run preview -- --snapshot
npm run preview -- --snapshot --collection chronicles-of-computation
npm run preview -- --snapshot --from /path/to/library --all --build-only
```

| Snapshot option | Behavior |
| --- | --- |
| `--from PATH` | Canonical library; defaults to `content`; external sources require explicit selection |
| `--piece ID` | Include a selected piece; repeatable |
| `--collection ID` | Include a collection and its dependencies; repeatable |
| `--all` | Include all non-retired candidates |
| `--exclude-piece ID`, `--exclude-collection ID` | Dependency-safe filtering, as in the importer |
| `--port NUMBER` | Loopback port, default 4322 |
| `--build-only` | Build without starting the server |
| `--serve-only` | Serve the existing snapshot without checks/rebuilding; cannot combine with selections |

Selection/build options require `--snapshot`. With no selection, all active local
content, including drafts, is rendered. A collection-only piece stays within its
collection; selecting a piece does not automatically include its owning collection.
Source identities and destination publication settings follow the importer rules.

Snapshot generation runs content-quality checks before rendering. Technical
failures and unavailable checks stop it; editorial findings remain advisory.
Install NLP once with `npm run quality:setup`. Reports go to ignored
`exports/content-review/`; snapshot output goes to `exports/authoring-preview/site`.
This output is separate from deployable `dist/` and from live workspace output
in `exports/author-live/`. Do not run concurrent snapshot builds.

Snapshots do not refresh after edits: stop and rerun to rebuild. To serve the last
snapshot without rebuilding:

```sh
npm run preview -- --snapshot --serve-only
```

## Release preview

Build and check the release, then serve its existing `dist/`:

```sh
npm run prepublish:check
npm run preview -- --release
```

Open `http://127.0.0.1:4322/` (or the printed path if a deployment base path is
configured). Release mode does not build or refresh files. It contains only
production-eligible content, with no draft badges, private editor, or Edit links.
Rebuild after changes. `npm run validate` provides technical checks/building without
the separate NLP/editorial release checks.

## Isolation and draft discovery

Both draft modes build in isolated temporary workspaces using the normal
prepare/render/package/verification pipeline. Draft visibility is enabled only in
the isolated copy; the source flags and release `dist/` are unchanged by building.
The live editor changes sources only on explicit Save. Draft modes reject CI and
Amplify environments. The public build never includes the author server.

Draft output has noindex headers/metadata, disallows indexing, and omits analytics.
Local RSS/sitemaps can include drafts; never host private preview output. The last
successful build remains available if a later build fails.

Draft badges appear on article cards, contents and headings. A collection's draft
flag does not label every member as draft. **Drafts in this preview** links to
included pages even when they are not featured. Undated standalone drafts receive
a provisional date only in the isolated copy; this is not a publication schedule.

Homepage discovery includes collection-only articles. Configure featured pieces or
books in `publishing/home.yaml`; hidden draft features fall back to visible content.
The old `*-preview.html` prototypes remain design snapshots, not the active site.
