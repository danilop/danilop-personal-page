# Image authoring workflow

**Status:** proposal, 2026-09-16. The shared style guide, Codex skill, and approval
validator are not implemented. For the full release process, see
[publishing workflow](publishing-workflow.md).

## Files and style

Proposed convention:

```text
publishing/image-style.md
content/pieces/my-article/
  index.md
  blocks.yaml
  assets/
    opening.image.md
    opening.png
    architecture.d2
```

Each `*.image.md` brief describes one illustration; its adjacent PNG is the
approved source asset. Briefs are authoring inputs, never executed by the build.
Use Mermaid/D2 for factual diagrams and data/specifications for charts.

The shared guide would define blue pen-and-ink artwork, warm ivory, restrained
hatching, generous space, and small-size clarity. Approved images such as
`site-assets/brand/notebooks.png` provide style references. Individual articles
or collections may override the default.

Example brief:

> Wide opening illustration: three notebooks joined by fine threads, suggesting
> different forms of memory. Follow the shared Ink & Paper style. Keep the subject
> clear in a narrow mobile crop, with essential details away from the edges.
> No readable text, logos, or interface elements. Output: opening.png.

## Generate and review

1. Write the brief, or ask Codex to suggest concepts from the article.
2. Explicitly generate candidates into an ignored review directory. Preserve any
   approved image until its replacement is selected.
3. Review and refine. Record the brief, style/reference versions, available
   generator metadata, and selected image checksum. Regeneration may differ.
4. Integrate the image through Markdown or `blocks.yaml`. Add alt text and captions
   after inspecting it; keep important labels in actual page text.
5. Review desktop/mobile composition, cropping, legibility, factual accuracy,
   background blending, and file weight. Check book and destination previews
   where relevant. Obtain visual approval before committing and pushing.

Keep approved source images and briefs in Git. The existing rendering pipeline
creates web and cross-post derivatives. A future validator could flag changed
briefs or references for review; it should never silently regenerate artwork.
CI should validate approved assets without calling image-generation services.

## Tooling and limits

A proposed repository skill, `article-art`, would coordinate the generator and
local preview. Codex supports repository skills in `.agents/skills/` and
interactive CLI image generation through `$imagegen`. Check tool availability
in the target session. The workflow should produce ordinary assets and remain
independent of any particular generator.

Built-in generation needs no separate API key when available. An explicitly
chosen API implementation could support later batch work, with separate API
costs. Keep keys in the local environment or a secret manager, never in content,
Git, or browser code. Deployment would require no generation credentials.

Article-local image blocks, diagram rendering, and portable derivatives already
work. The homepage hero is currently global: per-article covers for cards,
headers, and social previews need a separate metadata/template change.

## References

- [Authoring format](authoring-format.md)
- [Cross-posting](cross-posting.md)
- [OpenAI: skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI: image generation](https://learn.chatgpt.com/docs/image-generation)

Provider documentation checked 2026-09-16.
