import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseHTML } from "linkedom";
import { registry, formatBytes } from "../renderers/static";
import { readYaml, type Block } from "../core/model";
import { Assets } from "../core/assets";
import {
  mountPdfViewers,
  type PdfDocument,
  type PdfPage,
} from "../runtime/pdf-viewer";

/** A two-page 16:9 PDF with one filled rectangle per page, offsets computed. */
function pdfFixture() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Contents 5 0 R >>",
  ];
  const stream = "0.08 0.29 0.53 rg 20 20 280 140 re f";
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

test("pdf-js renders a static cover, page count and download link at build time", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-pdf-"));
  try {
    await fs.writeFile(path.join(dir, "deck.pdf"), pdfFixture());
    const reg = registry(),
      assets = new Assets(path.join(dir, "media"));
    const defaults = await readYaml("publishing/renderers.yaml");
    const render = async (block: Block, target: "web" | "book" = "web") => {
      const chosen = reg.resolve(block, target, defaults);
      assert.equal(chosen.plugin.id, "pdf-js");
      return chosen.plugin.render({
        block,
        target,
        options: chosen.options,
        owner: dir,
        assets,
      });
    };
    const block: Block = {
      kind: "document",
      title: "Talk <slides>",
      summary: "Two pages",
      source: { format: "pdf", path: "deck.pdf" },
      alternative: { mode: "summary-link", text: "Slides on the web page." },
    };
    const web = await render(block);
    assert.match(web.html, /^<section class="pdf-viewer"/);
    assert.match(web.html, /data-noun="slide"/);
    assert.match(web.html, /--pdf-ratio: 1\.7778/);
    assert.match(web.html, /View slides: Talk &lt;slides&gt; \(2 slides\)/);
    assert.match(web.html, /<img src="\/media\/[a-f0-9]+\.webp"/);
    assert.match(web.html, /width="1600" height="900"/);
    assert.match(web.html, /alt="First slide of Talk &lt;slides&gt;"/);
    assert.match(web.html, /href="\/media\/[a-f0-9]+\.pdf" download>/);
    assert.match(web.html, /Download PDF · \d+ B/);
    assert(!web.html.includes("<figure"));
    const media = await fs.readdir(path.join(dir, "media"));
    assert(media.some((name) => name.endsWith(".webp")));
    assert(media.some((name) => name.endsWith(".pdf")));
    // A second render reuses the cached cover and produces identical output.
    assert.equal((await render(block)).html, web.html);

    const remote = await render({
      ...block,
      kind: "document",
      source: { format: "pdf", url: "https://example.com/paper.pdf" },
    });
    assert.match(remote.html, /data-src="https:\/\/example.com\/paper.pdf"/);
    assert.match(remote.html, /data-noun="page"/);
    assert.match(remote.html, /pdf-cover-blank/);
    assert(!remote.html.includes("<img"));

    const book = await render(block, "book");
    assert.match(book.html, /Slides on the web page\./);
    await assert.rejects(
      render({ ...block, source: { format: "pdf" } }),
      /exactly one path or URL/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("formatBytes keeps download sizes short", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(428963), "419 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});

function viewerDom(t: TestContext) {
  const { window, document } = parseHTML(
    `<!doctype html><html><body><section class="pdf-viewer" data-src="/media/deck.pdf" data-noun="slide"><div class="pdf-stage"><button type="button" class="pdf-cover">Cover</button></div><div class="pdf-caption"><a class="pdf-download" href="/media/deck.pdf" download>Download</a><span class="pdf-failed" hidden>Failed</span></div></section></body></html>`,
  );
  for (const [key, value] of Object.entries({
    window,
    document,
    Event: window.Event,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete (globalThis as Record<string, unknown>)[key];
    });
  }
  return document;
}

function fakeDocument(pages: number, rendered: number[]): PdfDocument {
  return {
    numPages: pages,
    async getPage(n) {
      const page: PdfPage = {
        getViewport: ({ scale }) => ({
          width: 320 * scale,
          height: 180 * scale,
        }),
        render: () => {
          rendered.push(n);
          return { promise: Promise.resolve(), cancel() {} };
        },
        getTextContent: async () => ({
          items: [{ str: `Slide` }, { str: `${n}  text` }, {}],
        }),
      };
      return page;
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test("the PDF viewer loads on request and navigates by controls, keys and the counter", async (t) => {
  const document = viewerDom(t);
  const root = document.querySelector<HTMLElement>(".pdf-viewer")!;
  // linkedom has no canvas; give it a 2D context so rendering runs.
  const create = document.createElement.bind(document);
  document.createElement = (name: string) => {
    const node = create(name);
    if (name === "canvas")
      Object.assign(node, {
        getContext: () => ({}) as CanvasRenderingContext2D,
      });
    return node;
  };
  const rendered: number[] = [];
  const requested: string[] = [];
  mountPdfViewers(document, async (url) => {
    requested.push(url);
    return fakeDocument(3, rendered);
  });
  assert.equal(root.querySelector(".pdf-toolbar"), null);
  root.querySelector<HTMLButtonElement>(".pdf-cover")!.click();
  await tick();
  assert.deepEqual(requested, ["/media/deck.pdf"]);
  assert.equal(root.dataset.state, "ready");
  assert.equal(root.querySelector(".pdf-cover"), null);
  assert.equal(root.getAttribute("aria-roledescription"), "slide viewer");
  assert(root.querySelector("canvas.pdf-canvas"));
  assert.equal(
    root.querySelector("canvas")!.getAttribute("aria-label"),
    "Slide 1 of 3",
  );
  assert.equal(
    root.querySelector("[data-pdf-text]")!.textContent,
    "Slide 1 text",
  );
  const control = (action: string) =>
    root.querySelector<HTMLButtonElement>(
      `.pdf-toolbar [data-pdf-action="${action}"]`,
    )!;
  const input = root.querySelector<HTMLInputElement>("[data-pdf-page]")!;
  assert.equal(control("prev").disabled, true);
  assert.equal(
    root
      .querySelector<HTMLAnchorElement>(".pdf-toolbar a[download]")!
      .getAttribute("href"),
    "/media/deck.pdf",
  );

  control("next").click();
  await tick();
  assert.equal(input.value, "2");
  assert.equal(root.style.getPropertyValue("--pdf-progress"), "0.5");
  assert.equal(
    root.querySelector("[data-pdf-status]")!.textContent,
    "Slide 2 of 3",
  );

  const press = (key: string, target: Element = root) => {
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    Object.assign(event, { key });
    target.dispatchEvent(event);
    return event;
  };
  assert.equal(press("End").defaultPrevented, true);
  await tick();
  assert.equal(input.value, "3");
  assert.equal(control("next").disabled, true);
  press("ArrowLeft");
  await tick();
  assert.equal(input.value, "2");
  press("Home");
  await tick();
  assert.equal(input.value, "1");
  assert.equal(press("x").defaultPrevented, false);
  // Keys typed into the counter edit it rather than turning slides.
  assert.equal(press("ArrowRight", input).defaultPrevented, false);

  input.value = "9";
  input.dispatchEvent(new Event("change"));
  await tick();
  assert.equal(input.value, "3");
  input.value = "two";
  input.dispatchEvent(new Event("change"));
  assert.equal(input.value, "3");

  control("zoom-in").click();
  await tick();
  assert.equal(control("zoom-out").disabled, false);
  assert(root.querySelector(".pdf-stage")!.classList.contains("is-zoomed"));
  assert.equal(
    root.querySelector("[data-pdf-status]")!.textContent,
    "Zoom 125%",
  );
  // While zoomed, arrows scroll the page instead of turning it.
  assert.equal(press("ArrowLeft").defaultPrevented, false);
  press("0");
  await tick();
  assert(!root.querySelector(".pdf-stage")!.classList.contains("is-zoomed"));

  control("strip").click();
  const strip = root.querySelector<HTMLElement>(".pdf-strip")!;
  assert.equal(strip.hidden, false);
  assert.equal(control("strip").getAttribute("aria-pressed"), "true");
  const thumbs = strip.querySelectorAll<HTMLButtonElement>(".pdf-thumb");
  assert.equal(thumbs.length, 3);
  assert.equal(thumbs[2].getAttribute("aria-current"), "true");
  thumbs[0].click();
  await tick();
  assert.equal(input.value, "1");
  assert.equal(thumbs[0].getAttribute("aria-current"), "true");
  press("g");
  assert.equal(strip.hidden, true);

  // Without element full screen the viewer covers the page instead.
  control("fullscreen").click();
  await tick();
  assert(root.classList.contains("is-immersive"));
  assert(root.classList.contains("is-full"));
  assert.equal(
    control("fullscreen").getAttribute("aria-label"),
    "Exit full screen",
  );
  press("Escape");
  await tick();
  assert(!root.classList.contains("is-immersive"));
  assert.equal(control("fullscreen").getAttribute("aria-label"), "Full screen");
  assert(rendered.length >= 6);
});

test("the PDF viewer keeps the download link when the file cannot be opened", async (t) => {
  const document = viewerDom(t);
  const errors: unknown[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => errors.push(args));
  mountPdfViewers(document, () => Promise.reject(Error("CORS")));
  const cover = document.querySelector<HTMLButtonElement>(".pdf-cover")!;
  cover.click();
  await tick();
  const root = document.querySelector<HTMLElement>(".pdf-viewer")!;
  assert.equal(root.dataset.state, "failed");
  assert.equal(cover.disabled, true);
  assert.equal(
    document.querySelector<HTMLElement>(".pdf-failed")!.hidden,
    false,
  );
  assert.equal(errors.length, 1);
  cover.click();
  await tick();
  assert.equal(errors.length, 1);
});
