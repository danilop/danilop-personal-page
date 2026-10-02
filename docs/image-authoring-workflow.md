# Image authoring workflow

**Status:** implemented locally, 2026-09-24. The author editor has an **Images**
panel. Generation uses the installed Codex CLI, signed in with ChatGPT, and its
built-in image-generation tool. It uses subscription allowances; it never calls
an image API or falls back to API-key billing. Nothing generates during builds,
saves or deployment. See [local authoring](local-authoring.md).

## Create an illustration

1. Run `npm run preview`, open an article and select **Images**.
2. Write an **Illustration brief**, or select an installed **Brief writer**
   (Claude Code, Codex or Pi) and click **Suggest brief**. Optional direction can
   specify a subject, mood or exclusions. This sends the current article,
   including unsaved edits, and the shared style to that agent's provider.
3. Edit the brief. It is retained per article in this browser. New suggestions
   do not overwrite a brief or article changed while the agent was working.
   A delayed suggestion retains its original result and can be loaded only while
   viewing the same article text used to generate it. Later jobs do not replace
   the saved suggestion behind its recovery button.
4. Select **Continue to generate** (or the Generate stage). Choose landscape, square or portrait, and draft, standard or high quality.
   These are instructions to Codex's image tool, not guaranteed output dimensions
   or price tiers. Click **Generate image**. Only the brief, shared style and
   reference image are sent for this step; not the full article.
5. Inspect the candidate. **Use this brief again** lets you revise it and generate
   another candidate. Earlier candidates remain available; this is a fresh
   generation, not a pixel-preserving edit of the selected image.
6. Review the automatically populated **Image description (alt text)** and edit it
   if needed. Add an optional caption, then **Insert into
   article**. Choose **Beginning of article** (the default) or **End of article**.
   Beginning inserts before the first body paragraph, after the rendered title,
   summary and publication metadata. This prepares an article-local asset and
   inserts Markdown into the unsaved editor, leaving source frontmatter intact.
   Preview, reposition if desired, then **Save**. Undo removes the
   insertion without deleting the candidate or asset. Saving does not deploy.

The Brief, Generate and Choose stage buttons allow moving back and forth.
Candidates have thumbnails; Choose opens directly when candidates already exist.
Each generated candidate has its own suggested description. Switching candidates
preserves manual description edits, including deliberate clearing, during the
editor session. After reloading, the saved generated description is offered again;
inserted Markdown retains the description used at insertion.

**Use an existing image** in Generate imports PNG, JPEG or WebP locally, up to 20 MB and
40 million pixels. Imported images pass through the same candidate selection and
insertion flow; no provider request is made, so their descriptions must be entered
manually. Older candidates without a saved description also remain editable.
Images are normalised to PNG and
metadata is stripped by the image processor.

## Style and storage

`publishing/image-style.md` defines the default: fine blue pen-and-ink on warm
ivory, restrained hatching and mobile legibility. Article illustrations allow
generous space; cover artwork uses most of the selected canvas. Generation also
receives `site-assets/brand/notebooks.png` as a style reference. The image brief
can specify a subject and composition; exact charts and factual diagrams should
continue to use data, Mermaid or D2.

Candidates and generation records (brief, combined prompt, source article path,
generated description and filename label, time, dimensions, provider label and checksum) are stored under ignored
`.authoring-state/images/` and survive server restarts. The original output also
remains in Codex's generated-images folder. Unused candidates expire through the
[automatic cleanup](#automatic-cleanup) described below.
The browser retains editable briefs separately in local storage.

Explicit insertion copies a descriptively named PNG with a checksum suffix into the article's `assets/`
folder and does not overwrite an existing different file. These local assets
work with web/book rendering. For published media delivery, use the existing
[media upload workflow](media-storage.md) and replace the local Markdown reference
with the returned `media:` reference when appropriate. This panel does not upload
to S3 or publish content. Local assets remain supported; review repository size
before committing large originals.

The [asset release design](asset-release-design.md) proposes moving managed source
bytes out of Git, while keeping image selection, alt text and checksum identities
versioned. It includes covers and reproducible book exports; simply replacing
every local path with `media:` is not sufficient. This integration is not implemented.
Local cleanup never deletes remote published media.

Names describe image content rather than the article or book title, for example
`wind-up-beetle-bell-rope-barrier-8d113315a70e86eafdd8.png`. Generation returns a
short lowercase filename label with the image and alt text, using the same provider
call. Imported and older candidates derive a safe, bounded label from the entered
description. Assigning an image again with the same label and bytes reuses its asset.
Existing references remain valid if a title changes. Private candidate records keep
their stable UUIDs. Built local image URLs preserve the label and append the full
content hash; cover renditions use their own WebP hash.

The panel inserts inline illustrations. The homepage's featured article reuses
the first rendered body image and its alt text; inserting at the beginning makes
that illustration the homepage image. An article with no images has no homepage
artwork. This also applies to collection-only articles featured individually.
Articles have no explicit cover-image field. Books and collections instead use
the dedicated cover workflow below. [Social preview metadata](social-previews.md)
now uses article illustrations and explicit covers, with title-card fallback;
this is implemented locally, not deployed.

## Automatic cleanup

Implemented in local preview. Sweeps run after successful saves, on startup and
after builds/external changes, and once daily while the server stays running.
They are coalesced, serialised with editor writes, and postponed during builds or
image jobs. Nothing runs periodically when preview is stopped; the next startup
catches up. These operations do not run in public builds or deployments.

Unused candidates expire seven days after creation or their last selection.
Thumbnail loading and background list refreshes do not renew that clock. A source
asset starts a fresh seven-day clock when a sweep first finds it unreferenced;
reuse resets that clock. Eligible files and associated metadata move to ignored
`.authoring-state/image-trash/<id>/`. Complete, unchanged trash entries are deleted
after 30 further days. The candidate panel refreshes automatically when cleanup
changes the inventory. The panel shows a pause message if a sweep encounters an
error rather than silently claiming cleanup succeeded.

A repository-wide scan protects current content, retained save/deletion recovery,
edition inventories and recoverable unsaved references. Saved versions have no
retention limit, so their images remain in use. The browser mirrors image names
from all its recovery entries into ignored `image-recovery/` state; prose remains
in browser storage. Empty reference records are removed. These protections survive
restarts until that browser reports a changed recovery inventory. Each tab also
refreshes its Undo references every 30 seconds; these session records expire after
24 hours without contact. Saving waits for protection to be persisted.

Copied assets are registered before insertion returns. An insertion not yet
acknowledged by browser recovery has a seven-day temporary protection, followed
by the ordinary unused grace period if it remains abandoned. This prevents an
interrupted insertion from leaving permanent files. A retained linked candidate
is protected by the matching bytes; expired identical alternatives are deduplicated.
Old candidate PNGs without metadata, metadata without PNGs and interrupted atomic
metadata writes are also collected after their grace period.

Cleanup only owns images created by this workflow. New copied assets have an
ownership/checksum record in `image-assets/`; older generated assets are adopted
only when their filename, bytes and candidate owner prove the match, with a fresh
grace period. Hand-authored or modified files, Codex's original outputs, unrelated
assets and exported book resources are preserved. Edition exports contain their
own resource copies. Unreadable reference state, malformed content,
symlinks or lock contention defer collection. Partially moved or modified trash
is preserved for recovery rather than forcibly purged.

To recover an image from trash, stop preview and inspect that entry's
`manifest.json`. Each item records its repository-relative `from` path, trash
`to` filename and checksum. Restore all items, including ownership or candidate
metadata, to their original paths without overwriting different files. Verify
the bytes and references before restarting preview. Remove the trash entry only
after recovery is complete. A newly restored reference blocks purging its matching
trash filename; this is a local recovery window, not an off-device backup.

## Book and collection covers

Open a book or collection YAML file in the editor, then **Images**. The same brief,
generation, candidate selection, import and editable alt-description controls are
available. **Suggest brief** sends its current unsaved title, summary, introduction
and outline, plus saved summaries of referenced articles, to the selected agent.
It asks for a cover representing the whole work without title lettering. It does
not send every chapter's manuscript. Portrait is the initial shape; other shapes
remain available. Generation uses the same Codex subscription and shared style.
Both brief writing and generation receive the selected shape with its aspect
ratio. Cover instructions ask for a composition occupying most of the canvas,
modest margins and no empty area reserved for lettering. Portrait covers use a
vertical composition rather than a small horizontal strip. The reference supplies
ink and palette rather than layout. When an older brief requests a horizontal row,
generation retains its subjects but adapts their placement to the chosen format.
These remain prompt instructions, not automatic visual-layout validation. Existing
candidates are unchanged; regenerate to use the new guidance. If no shape is sent,
the service defaults to portrait for covers and landscape for articles.

Select a candidate and **Use as cover**, then **Save**. Assignment updates the
unsaved collection's `cover` metadata while preserving other YAML and comments;
it does not insert an image into a chapter. **Remove cover** clears that metadata.
Both actions support Undo. Replacing/removing a cover initially retains existing
candidates and assets; automatic cleanup later collects files no longer needed
by content or recovery. Conflicting edits made while an assignment runs are preserved.

Cover assets are copied to `content/collections/assets/SUBJECT-HASH.png`. The
collection's relative path and alt text are explicit; imports carry the referenced
asset with the collection. Builds generate a content-hashed WebP rendition for the
featured homepage entry and collection overview. No cover means no image: neither
chapter order nor the first article controls it. This does not create a PDF/ebook
cover or assign social sharing metadata.

## Local setup and limits

Codex must be on the author server's PATH and `codex login status` must report
ChatGPT authentication. Use `codex login` if needed, then reload the editor.
Brief writers only require executable discovery; provider authentication and
account limits are checked when a task runs. Disabled controls explain missing
setup. No credentials are stored in browser code, content or Git.

Generation ignores user configuration, forces ChatGPT login, removes API-key
environment variables, disables shell/web/app tools and runs in an isolated
read-only workspace. The built-in image tool is explicitly enabled. Only fresh
files within Codex's generated-images directory can become candidates, and their
image format and size are checked. A missing tool, usage limit, invalid output or
timeout is a failure, never a fallback to paid API generation. Cancel stops the
local task; it cannot promise to reverse usage already consumed remotely.

Generation returns a schema-constrained Codex result with `imagePath`, `altText`,
`filenameStem` and `error`. The same request asks for a concise description of the actual generated
image in the brief's language, without a separate provider call. A successful result
supplies the generated path, a nonempty description (up to 1,000 characters), a
lowercase ASCII filename stem (up to 80 characters), and a null error; a failed
attempt supplies null path, description and filename stem and an explanation.
The app still verifies the file's
location, freshness, size and image bytes before creating a candidate. Schema
files live only in the job's temporary directory. Brief-writing calls remain plain
text because their output is editable prose.

Image jobs and brief results are kept in memory while running. Reloading during a
job does not resume its progress display; completed image candidates can be
reloaded from disk. The suggested brief itself should be copied into the editable
field before leaving the session. Broader persistent job history is future work.

## References

- [Authoring format](authoring-format.md)
- [Editorial review](editorial-review.md)
- [OpenAI image generation](https://learn.chatgpt.com/docs/image-generation)

Official documentation and installed CLI checked 2026-09-24. Built-in image
availability and usage remain subject to the signed-in account and CLI version.
