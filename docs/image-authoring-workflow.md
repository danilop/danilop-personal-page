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
6. Add an image description (alt text) and optional caption, then **Insert into
   article**. Choose **Remembered cursor** or **End of article**. This prepares an
   article-local asset and inserts Markdown into the unsaved editor. If the cursor
   is in metadata, End of article is selected; a stale insertion position requires
   choosing a new position. Preview, reposition if desired, then **Save**. Undo removes the
   insertion without deleting the candidate or asset. Saving does not deploy.

The Brief, Generate and Choose stage buttons allow moving back and forth.
Candidates have thumbnails; Choose opens directly when candidates already exist.

**Use an existing image** in Generate imports PNG, JPEG or WebP locally, up to 20 MB and
40 million pixels. Imported images pass through the same candidate selection and
insertion flow; no provider request is made. Images are normalised to PNG and
metadata is stripped by the image processor.

## Style and storage

`publishing/image-style.md` defines the default: fine blue pen-and-ink on warm
ivory, restrained hatching, generous space and mobile legibility. Generation also
receives `site-assets/brand/notebooks.png` as a style reference. The image brief
can specify a subject and composition; exact charts and factual diagrams should
continue to use data, Mermaid or D2.

Candidates and generation records (brief, combined prompt, source article path,
time, dimensions, provider label and checksum) are stored under ignored
`.authoring-state/images/` and survive server restarts. The original output also
remains in Codex's generated-images folder. Candidates have no automatic cleanup.
The browser retains editable briefs separately in local storage.

Explicit insertion copies a checksum-named PNG into the article's `assets/`
folder and does not overwrite an existing different file. These local assets
work with web/book rendering. For published media delivery, use the existing
[media upload workflow](media-storage.md) and replace the local Markdown reference
with the returned `media:` reference when appropriate. This panel does not upload
to S3 or publish content. Local assets remain supported; review repository size
before committing large originals.

The panel inserts inline illustrations. Dedicated covers reused across homepage
cards, article headers and social previews remain future metadata/template work.

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
