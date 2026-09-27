# Local authoring review

Status: reviewed on 2026-09-24; an initial implementation is now available.
See [local authoring](local-authoring.md) for exact supported behavior. The
existing snapshot preview remains available. The design below describes the
target; dependency-based incremental builds, dedicated collection/publishing
forms and autosave remain deferred. Undo/redo across saves and durable saved
versions are implemented; switching files starts a fresh session undo stack.
Unpublish and guarded draft deletion are also implemented, including dependency
cleanup and local recovery; see [article lifecycle](local-authoring.md#unpublish-and-delete).
Cloud publication remains separate.

## Author experience

Recommend a focused local Markdown editor with a preview using the publication
renderer and templates. Files remain the source of truth. Browser edits and
external file edits should feed the same refresh workflow. Preserve separate
piece identities, collection placement, and publication settings.

Preview unsaved text after a short pause. Initially use explicit Save (including
a keyboard shortcut), with recoverable unsaved work; consider autosave after
conflict handling and recovery are proven. Show save and preview freshness
separately. An invalid edit must not discard text or leave a stale preview
looking current. Draft removal is an explicit publication setting, not a typing
side effect. Saving never deploys.

Prioritize body/metadata, tags, collection order, homepage announcements and
short aliases. Defer generic editing of every configuration file, rich-text
round trips, cloud editing and deployment controls.

## Implementation proposal

First create a persistent local preview service and file watcher. Existing
`dev` prepares once before starting Astro; the authoring preview currently runs
quality checks and a complete isolated build. Neither is the proposed live loop.
Reuse the parser, assembler, renderer and templates; avoid a second Markdown
implementation. Render in the selected standalone or collection context so
references, numbering and citations remain meaningful. Cache expensive assets,
refresh affected dependants, and discard obsolete render responses.

Then add the browser editor and constrained file-writing API. Bind to loopback,
validate request origins/session authorization, restrict writable paths, and
use atomic writes with revision checks. Preserve unmanaged metadata and detect
external edits before saving. Keep editor services out of release artifacts.

Implemented: `npm run preview` starts the editor and live site together. The
former separate author command was removed; compatibility aliases are not retained.
Read-only snapshots now require `--snapshot`; release output uses `--release`. Run expensive NLP,
code execution and complete release validation explicitly, outside the typing
loop. Do not claim deployed status without verifying the deployed revision.

## Acceptance evidence before expanding scope

Measure cold start and warmed typing-to-preview latency on real book content;
aim for ordinary prose feedback within roughly one second, without promising
this for diagrams or full-book assembly. Test book references, invalid edits,
rapid consecutive edits, external-file conflicts and recovery. Verify a saved
revision against the release renderer and confirm draft isolation. Only then
expand metadata forms and consider autosave.

Astro supports development-time refresh, but our custom preparation pipeline
needs integration; see [Astro development documentation](https://docs.astro.build/en/develop-and-build/).
