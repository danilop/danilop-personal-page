/** Local presentation pilot. Reads ignored manuscript extracts; never publishes. */
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { loadLibrary, assemble, standalone, readYaml } from "../core/model";
import { renderDocument } from "../core/render";
import { Assets, escape as esc } from "../core/assets";
import { loadTagRegistry, renderTagList } from "../core/tags";

async function main() {
  const root = "exports/chronicles-pilot";
  const registry = await loadTagRegistry();
  const lib = await loadLibrary(`${root}/content`);
  const book = lib.collections.find(
    (c) => c.id === "chronicles-of-computation",
  );
  assert(book, "Prepare the local Chronicles source extracts first.");
  const bookTitle = book.title;
  const document = assemble(book, lib, "web", { preview: true });
  const nodes = document.nodes.filter((n) => n.piece);
  assert.deepEqual(
    nodes.map((n) => n.piece!.id),
    ["chronicles-introduction", "chronicles-ch01"],
  );
  assert.equal(
    assemble(book, lib, "web").nodes.length,
    0,
    "Pilot must remain draft-only",
  );
  const defaults = await readYaml("publishing/renderers.yaml");
  const config = await readYaml("publishing/site.yaml");
  const chapter = document.nodes.find((n) => n.kind === "chapter")!;
  const components = [
    {
      node: nodes[0],
      role: "Introduction",
      label: "Front matter",
      file: "introduction-preview.html",
      anchor: "introduction",
    },
    {
      node: nodes[1],
      role: `Chapter ${chapter.number}`,
      label: `Chapter ${chapter.number}`,
      file: "chapter-01-preview.html",
      anchor: "chapter-1",
    },
  ];
  const rendered = await Promise.all(
    components.map(async (c) => {
      const result = await renderDocument(
        standalone(c.node.piece!),
        lib,
        defaults,
        new Assets(`${root}/assets`),
      );
      return { ...c, html: result.html };
    }),
  );
  await fs.mkdir(`${root}/assets`, { recursive: true });
  await fs.copyFile(
    "themes/ink-and-paper/style.css",
    `${root}/assets/theme.css`,
  );
  for (const family of ["inter", "newsreader"])
    for (const weight of [400, 500])
      await fs.copyFile(
        `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`,
        `${root}/assets/${family}-${weight}.woff2`,
      );
  const styles = `
@font-face{font-family:Newsreader;src:url(assets/newsreader-400.woff2) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Newsreader;src:url(assets/newsreader-500.woff2) format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:Inter;src:url(assets/inter-400.woff2) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Inter;src:url(assets/inter-500.woff2) format('woff2');font-weight:500;font-display:swap}
:root{--paper:${config.tokens.paper};--ink:${config.tokens.ink};--blue:${config.tokens.accent};--muted:${config.tokens.muted};--hairline:${config.tokens.hairline};--serif:Newsreader,Georgia,serif;--sans:Inter,system-ui,sans-serif}
body{padding:0 24px 50px}.preview-bar{max-width:960px;margin:auto;padding:20px 0;border-bottom:1px solid var(--hairline);display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:12px;color:var(--muted)}.preview-bar a{font-size:15px;color:var(--ink)}.article-heading{padding-top:36px}.book-context{font-size:15px;margin-bottom:14px}.book-context a,.reading-tools a,.contents-list a{color:var(--blue);text-decoration:underline;text-underline-offset:4px}.component-label{color:var(--muted);font-size:13px;letter-spacing:.025em}.article-heading h1{margin-top:12px}.dek{color:var(--muted)}.reading-tools{display:flex;gap:12px 24px;flex-wrap:wrap;margin-top:22px;font-size:14px}.component-heading{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin:44px 0 24px}.component-heading h2{margin:0}.component-heading .component-label{display:block;margin-bottom:8px}.component-heading a{font-family:var(--sans);font-size:12px;white-space:nowrap}.prose .book-component+.book-component{border-top:1px solid var(--hairline);margin-top:52px;padding-top:8px}.prose .book-component h3{font-size:29px}.reading-footer{border-top:1px solid var(--hairline);padding-top:24px;margin-top:40px}.reading-footer p{color:var(--muted);font-size:14px;margin-bottom:18px}.reading-footer nav{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:14px}.reading-footer a{color:var(--blue);text-decoration:underline;text-underline-offset:4px}.contents-list{list-style:none;padding:0;margin:32px 0}.contents-list li{border-bottom:1px solid var(--hairline);padding:22px 0}.contents-list .component-label{display:block;margin-bottom:7px}.contents-list a{font:30px/1.2 var(--serif)}.contents-list p{font-size:15px;color:var(--muted);margin-top:8px}.collection-note{color:var(--muted);font-size:14px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.reading-footer .next-reading{display:grid;grid-template-columns:1fr auto;gap:7px 24px;padding:22px 24px;margin-bottom:24px;border:1px solid var(--blue);text-decoration:none;background:#164b8808}.next-reading>span:first-child{grid-column:1;font:13px/1.5 var(--sans)}.next-reading strong{grid-column:1;font:500 30px/1.15 var(--serif)}.next-reading>span:last-child{grid-column:2;grid-row:1/3;align-self:center;font-size:26px}.next-reading:hover{background:#164b8812}
@media(max-width:600px){body{padding:0 20px 32px}.preview-bar{padding:16px 0;align-items:flex-start}.preview-bar span{max-width:125px;text-align:right}.article-heading{padding-top:28px}.article-heading h1{font-size:42px;letter-spacing:-.8px}.prose{font-size:20px}.dek{font-size:23px}.component-heading{display:block}.component-heading>a{display:inline-block;margin-top:12px}.prose h2{font-size:31px}.prose .book-component h3{font-size:26px}.reading-footer nav{flex-direction:column}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
  const bookLink = `<a href="collection-preview.html">${esc(book.title)}</a>`;
  function page(
    title: string,
    label: string,
    summary: string,
    body: string,
    footer: string,
    overview = false,
  ) {
    const titleText = overview
      ? `${bookTitle} | ${config.name}`
      : `${title} | ${bookTitle}`;
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="${esc(summary)}"><meta property="og:title" content="${esc(titleText)}"><title>${esc(titleText)}</title><link rel="icon" href="data:,"><link rel="stylesheet" href="assets/theme.css"><style>${styles}</style></head><body><a class="skip-link" href="#main">Skip to content</a><div class="preview-bar"><a href="collection-preview.html">${esc(config.title)}</a><span>Local preview · Not published</span></div><main id="main" class="reading"><header class="article-heading">${overview ? "" : `<p class="book-context">${bookLink}</p>`}<p class="component-label">${esc(label)}</p><h1>${esc(title)}</h1><p class="dek">${esc(summary)}</p><nav class="reading-tools" aria-label="Book navigation">${overview ? '<a href="introduction-preview.html">Start reading</a><a href="continuous-preview.html">Read continuously</a>' : '<a href="collection-preview.html">Book contents</a>'}${!overview && title !== components[0].node.title ? '<a href="introduction-preview.html">Start from the beginning</a>' : ""}</nav></header>${body}${footer}</main></body></html>`;
  }
  const pages = new Map<string, string>();
  const combined = rendered
    .map((c) => {
      const $ = load(c.html, null, false);
      // Component titles are H2; shift their own subheadings beneath them.
      $("h2,h3,h4,h5").each((_, el) => {
        el.tagName = `h${Number(el.tagName.slice(1)) + 1}`;
      });
      return `<section class="book-component" id="${c.anchor}"><header class="component-heading"><div>${c.role === c.node.title ? "" : `<span class="component-label">${esc(c.role)}</span>`}<h2>${esc(c.node.title)}</h2></div><a href="${c.file}">Read ${c.role.toLowerCase()} separately</a></header>${$.html()}</section>`;
    })
    .join("\n");
  const end = `<footer class="reading-footer"><p>You're up to date with this growing book. More chapters will follow.</p><nav aria-label="Continue reading"><a href="collection-preview.html">Book contents</a><a href="#introduction">Back to introduction</a></nav></footer>`;
  pages.set(
    "continuous-preview.html",
    page(
      "Read continuously",
      `Introduction + Chapter ${chapter.number}`,
      "The opening of a practical history of computing: early records, counting and the interpretation of ancient marks.",
      `<div class="prose">${combined}</div>`,
      end,
    ),
  );
  for (const [i, c] of rendered.entries()) {
    const previous = rendered[i - 1],
      next = rendered[i + 1];
    const navigation = `<footer class="reading-footer">${next ? `<a class="next-reading" href="${next.file}" rel="next" aria-label="Next: ${esc(next.role)} — ${esc(next.node.title)}"><span>Next · ${esc(next.role)}</span><strong>${esc(next.node.title)}</strong><span aria-hidden="true">→</span></a>` : "<p>You're up to date with this growing book. More chapters will follow.</p>"}<nav aria-label="Continue reading">${previous ? `<a href="${previous.file}" rel="prev">Previous: ${esc(previous.node.title)}</a>` : ""}<a href="collection-preview.html">Book contents</a><a href="continuous-preview.html#${c.anchor}">Read continuously</a></nav></footer>`;
    pages.set(
      c.file,
      page(
        c.node.title,
        c.label,
        c.node.piece!.summary,
        `<div class="prose">${c.html}</div>${renderTagList(c.node.piece!.tags, registry)}`,
        navigation,
      ),
    );
  }
  const contents = `<p class="collection-note">New material is released weekly. Start with the introduction, then continue to Chapter ${esc(chapter.number)}.</p><ol class="contents-list">${rendered.map((c) => `<li><span class="component-label">${esc(c.label)}</span><a href="${c.file}">${esc(c.node.title)}</a><p>${esc(c.node.piece!.summary)}</p></li>`).join("")}</ol>`;
  pages.set(
    "collection-preview.html",
    page(
      book.title,
      "Growing book",
      "A Practical History of Software Engineering",
      contents,
      "",
      true,
    ),
  );
  // Preserve the old preview address while directing readers to the introduction.
  pages.set(
    "opening-preview.html",
    pages
      .get("introduction-preview.html")!
      .replace(
        "<head>",
        '<head><meta http-equiv="refresh" content="0;url=introduction-preview.html">',
      ),
  );
  await verifyPages();
  await fs.writeFile(
    `${root}/preview-composition.json`,
    JSON.stringify(
      {
        status: "local-preview",
        collection: book.id,
        readingOrder: components.map((c) => c.file),
        components: components.map((c) => ({
          piece: c.node.piece!.id,
          placement: c.node.id,
          role: c.role,
          title: c.node.title,
          preview: c.file,
        })),
        start: "introduction-preview.html",
        continuousView: "continuous-preview.html",
        source:
          "Separate reading pages are primary; the optional continuous view renders the same two pieces without another editable manuscript.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Four draft reading pages and one legacy redirect generated from two pieces. All local links, anchors, headings, code examples, notes and draft visibility checks passed.",
  );

  async function verifyPages() {
    for (const [file, html] of pages) {
      const $ = load(html);
      assert.equal($("h1").length, 1);
      assert.equal(
        $('meta[name="robots"]').attr("content"),
        "noindex,nofollow",
      );
      const ids = $("[id]")
        .toArray()
        .map((el) => $(el).attr("id"));
      assert.equal(new Set(ids).size, ids.length, `Duplicate ID in ${file}`);
      for (const el of $("a[href]").toArray()) {
        const href = $(el).attr("href")!;
        if (/^https?:/.test(href)) continue;
        const [dest, anchor] = href.split("#");
        assert(pages.has(dest || file), `Missing page ${href}`);
        if (anchor)
          assert(
            load(pages.get(dest || file)!)("[id]")
              .toArray()
              .some((e) => e.attribs.id === anchor),
            `Missing anchor ${href}`,
          );
      }
      const expected = [
        "continuous-preview.html",
        "chapter-01-preview.html",
      ].includes(file);
      assert.equal($("pre").length, expected ? 2 : 0);
      assert.equal($("[data-footnote-ref]").length, expected ? 4 : 0);
      await fs.writeFile(path.join(root, file), html);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
