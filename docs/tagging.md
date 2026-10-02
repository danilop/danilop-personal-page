# Tag authoring and review

Status: implemented locally on 2026-09-20; not deployed. Public topic pages and
automatic semantic tag assignment are not implemented.

## Vocabulary and assignments

Each piece keeps a `tags` list in its Markdown metadata. The shared vocabulary
is `content/tags.yaml`:

```yaml
schemaVersion: 1
tags:
  - id: python
    label: Python
    description: Substantive Python examples or guidance on using Python.
    aliases: [python3, python-3]
```

The registered topics are History, Computing, AI, Programming, Python, Data
representation, Website and Notes. AI covers artificial intelligence, how it
learns, its capabilities, applications and limitations; `artificial-intelligence`
is an alias for `ai`. The draft *Clever Enough to Find the Loophole* uses both
Computing and AI.

IDs are lowercase words separated by hyphens. Labels are reader-facing names;
descriptions define when a tag is appropriate. Aliases identify alternate names
for the same concept. Duplicate IDs and names/aliases that resolve to different
tags are errors. Labels participate in lookup, so `Data representation` resolves
to `data-representation`. Matching ignores case, trims surrounding whitespace,
and treats spaces/underscores as hyphens.

Use canonical IDs in piece metadata, for example `tags: [history, computing,
python, data-representation]`. Existing free-form assignments remain supported;
unregistered tags appear in the report for review rather than blocking the site.
Aliases and spelling/case variants are grouped for display and counting without
rewriting source assignments. Suggestions never add, replace, or merge tags.

Public standalone articles and individual collection reading pages show a quiet
Topics list after the prose. Registry labels are used when available; unregistered
labels fall back to their normalized name. Labels are not links because public
topic pages do not exist. Continuous book assembly does not repeat topic lists.
The Chronicles local preview uses the same labels on its separate reading pages.

## Internal inventory

From the repository root, using the pinned Node/npm versions:

```sh
npm run tags
python3 -m http.server 8769 --bind 127.0.0.1 --directory exports/tag-review
```

Open `http://127.0.0.1:8769/`. The private page provides:

- Search across tag IDs, labels, scopes, aliases, and titles of pieces using them.
- Sort by name or usage in the selected status group.
- Separate published/draft/retired counters; unused registered tags in All.
- Piece-title buttons that open the piece's assignments and reuse findings.
- Flags for new vocabulary, first use among active pieces, spelling/case aliases,
  repeated assignments, and likely spelling variants of existing tags.
- An explicit empty state and the list of included source files.

Counters are unique piece counts, not placement/page/release counts. A repeated
assignment or alias on one piece counts once. Published means source status,
not verified live deployment. Retired pieces have their own counter/filter and
are excluded from the default active view and first-use comparison.

An existing tag can still be wrong for a new piece; review its scope and example
pieces. Similar-spelling suggestions are not semantic recommendations. Search
provides the manual way to discover conceptually relevant existing tags.

The report is a snapshot; regenerate it after editing content. It writes
`exports/tag-review/index.html` and `inventory.json`, outside the public build.
The report includes private draft metadata and source paths: serve it only on
loopback and do not publish the output. Normal website builds do not delete it.

## Selecting sources and reviewing new content

```sh
npm run tags -- --review hello-brave-new-world
npm run tags -- --json
npm run tags -- --source content --source path/to/another/library
npm run tags -- --piece-file path/to/private/draft/index.md
npm run tags -- --registry path/to/another/tags.yaml
```

`--source` replaces the default `content` root; repeat it for multiple libraries.
Only direct `pieces/<folder>/index.md` files in those selected roots are read.
`--piece-file` adds individually selected sources, retaining the default root
unless `--source` is supplied. Identical copies with one piece ID count once;
conflicting copies of an ID fail instead of silently choosing a version.
Collection subjects, test fixtures, generated views, and unrelated exports are
not discovered automatically. Explicitly selected roots must contain canonical
pieces, not snapshots that should be excluded.

For the current local Chronicles pilot, include only its two active pieces:

```sh
npm run tags -- \
  --piece-file exports/chronicles-pilot/content/pieces/chronicles-introduction/index.md \
  --piece-file exports/chronicles-pilot/content/pieces/chronicles-ch01/index.md \
  --review chronicles-ch01
```

This excludes the obsolete combined opening snapshot. Source and registry errors
return a failing exit status. Editorial findings are advisory. `--json` emits
machine-readable inventory data; both report files are still generated.

Before publication, regenerate the inventory, review the selected piece, reuse
appropriate tags, and add a registry entry with a clear scope for genuinely new
concepts. Then regenerate and continue the normal publishing checks. The report
never changes publication status or sends content anywhere.
