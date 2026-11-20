// Slide and document viewer for PDF blocks rendered by the `pdf-js` plugin.
// The page ships a static cover; PDF.js and the file load only when the reader
// asks for them, and the viewer then replaces the cover in place.

export type PdfViewport = { width: number; height: number };
export type PdfRenderTask = { promise: Promise<unknown>; cancel(): void };
export type PdfPage = {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: PdfViewport;
  }): PdfRenderTask;
  getTextContent(): Promise<{ items: { str?: string }[] }>;
};
export type PdfDocument = {
  numPages: number;
  getPage(number: number): Promise<PdfPage>;
};
export type PdfLoader = (url: string) => Promise<PdfDocument>;

const ZOOMS = [1, 1.25, 1.5, 2, 3];
const MAX_PIXELS = 4096;

const icons = {
  first: '<path d="M17 6l-6 6 6 6M7 6v12"/>',
  prev: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  last: '<path d="M7 6l6 6-6 6M17 6v12"/>',
  grid: '<rect x="4" y="5" width="7" height="5.5" rx="1"/><rect x="13" y="5" width="7" height="5.5" rx="1"/><rect x="4" y="13.5" width="7" height="5.5" rx="1"/><rect x="13" y="13.5" width="7" height="5.5" rx="1"/>',
  zoomOut:
    '<circle cx="10.5" cy="10.5" r="6"/><path d="M19.5 19.5l-4.6-4.6M8 10.5h5"/>',
  zoomIn:
    '<circle cx="10.5" cy="10.5" r="6"/><path d="M19.5 19.5l-4.6-4.6M8 10.5h5M10.5 8v5"/>',
  download: '<path d="M12 4v11M7 10.5l5 4.5 5-4.5M5 19.5h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};
type Icon = keyof typeof icons;
const svg = (name: Icon) =>
  `<svg class="pdf-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name]}</svg>`;

/**
 * Loads the bundled PDF.js build and its worker from this site's own origin.
 * The worker is bundled by Vite as a classic `.js` chunk, so hosts that do not
 * know the `.mjs` MIME type still serve it as JavaScript.
 */
export const loadPdfJs: PdfLoader = async (url) => {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?worker"),
  ]);
  pdfjs.GlobalWorkerOptions.workerPort ??= new worker.default();
  return pdfjs.getDocument({ url }).promise as unknown as Promise<PdfDocument>;
};

function button(name: Icon, label: string, action: string) {
  return `<button type="button" class="pdf-tool" data-pdf-action="${action}" aria-label="${label}" title="${label}">${svg(name)}</button>`;
}

function toolbar(noun: string, pages: number, download: string) {
  return `<div class="pdf-toolbar" role="toolbar" aria-label="${noun[0].toUpperCase() + noun.slice(1)} controls">
<div class="pdf-group">${button("first", `First ${noun}`, "first")}${button("prev", `Previous ${noun}`, "prev")}
<label class="pdf-counter"><span class="pdf-visually-hidden">${noun[0].toUpperCase() + noun.slice(1)} number</span><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="1" data-pdf-page><span class="pdf-total" aria-hidden="true">/ ${pages}</span></label>
${button("next", `Next ${noun}`, "next")}${button("last", `Last ${noun}`, "last")}</div>
<div class="pdf-group">${button("grid", `Show all ${noun}s`, "strip")}${button("zoomOut", "Zoom out", "zoom-out")}${button("zoomIn", "Zoom in", "zoom-in")}<a class="pdf-tool" href="${download}" download aria-label="Download PDF" title="Download PDF">${svg("download")}</a><button type="button" class="pdf-tool" data-pdf-action="fullscreen" aria-label="Full screen" title="Full screen">${svg("expand")}${svg("collapse")}</button></div>
</div>`;
}

class Viewer {
  page = 1;
  zoom = 0;
  strip = false;
  token = 0;
  task?: PdfRenderTask;
  stage: HTMLElement;
  canvas?: HTMLCanvasElement;
  input!: HTMLInputElement;
  constructor(
    readonly root: HTMLElement,
    readonly doc: PdfDocument,
    readonly noun: string,
  ) {
    this.stage = root.querySelector<HTMLElement>(".pdf-stage")!;
  }

  get pages() {
    return this.doc.numPages;
  }

  mount() {
    const { root, noun, pages } = this;
    root.dataset.state = "ready";
    root.tabIndex = 0;
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", `${noun} viewer`);
    this.stage.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="pdf-hit pdf-hit-prev" data-pdf-action="prev" tabindex="-1" aria-hidden="true">${svg("prev")}</button><button type="button" class="pdf-hit pdf-hit-next" data-pdf-action="next" tabindex="-1" aria-hidden="true">${svg("next")}</button><div class="pdf-progress" aria-hidden="true"><span></span></div>`,
    );
    const download =
      root.querySelector<HTMLAnchorElement>(".pdf-download")!.href;
    this.stage.insertAdjacentHTML("afterend", toolbar(noun, pages, download));
    root
      .querySelector(".pdf-toolbar")!
      .insertAdjacentHTML(
        "afterend",
        `<div class="pdf-strip" hidden></div><p class="pdf-visually-hidden" aria-live="polite" data-pdf-status></p><div class="pdf-visually-hidden" data-pdf-text></div>`,
      );
    this.input = root.querySelector<HTMLInputElement>("[data-pdf-page]")!;
    root.addEventListener("click", (event) => {
      const action = (event.target as Element)
        .closest<HTMLElement>("[data-pdf-action]")
        ?.getAttribute("data-pdf-action");
      if (action) this.act(action);
    });
    root.addEventListener("keydown", (event) => this.key(event));
    this.input.addEventListener("change", () => {
      const n = Number.parseInt(this.input.value, 10);
      if (Number.isFinite(n)) void this.show(n);
      else this.input.value = String(this.page);
    });
    this.input.addEventListener("focus", () => this.input.select());
    this.swipe();
    document.addEventListener("fullscreenchange", () => this.layout());
    if (typeof ResizeObserver === "function") {
      let last = 0;
      new ResizeObserver(() => {
        const width = this.stage.clientWidth;
        if (Math.abs(width - last) < 2) return;
        last = width;
        void this.render();
      }).observe(this.stage);
    }
    return this.show(1);
  }

  act(action: string) {
    const steps: Record<string, () => unknown> = {
      first: () => this.show(1),
      prev: () => this.show(this.page - 1),
      next: () => this.show(this.page + 1),
      last: () => this.show(this.pages),
      strip: () => this.toggleStrip(),
      "zoom-in": () => this.setZoom(this.zoom + 1),
      "zoom-out": () => this.setZoom(this.zoom - 1),
      fit: () => this.setZoom(0),
      fullscreen: () => this.toggleFullscreen(),
    };
    void steps[action]?.();
  }

  key(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target === this.input) {
      if (event.key === "Escape") this.input.blur();
      return;
    }
    const keys: Record<string, string> = {
      ArrowRight: "next",
      ArrowDown: "next",
      PageDown: "next",
      j: "next",
      ArrowLeft: "prev",
      ArrowUp: "prev",
      PageUp: "prev",
      k: "prev",
      Home: "first",
      End: "last",
      f: "fullscreen",
      g: "strip",
      "+": "zoom-in",
      "=": "zoom-in",
      "-": "zoom-out",
      "0": "fit",
    };
    let action = keys[event.key];
    const full = this.root.classList.contains("is-full");
    // In the article these keys keep scrolling the page; in full screen they turn it.
    if (!full && /^(ArrowUp|ArrowDown|PageUp|PageDown)$/.test(event.key))
      return;
    if (
      full &&
      event.key === " " &&
      !(event.target as Element).closest("button, a")
    )
      action = event.shiftKey ? "prev" : "next";
    if (event.key === "Escape" && this.root.classList.contains("is-immersive"))
      action = "fullscreen";
    if (!action) return;
    // Arrow keys scroll a zoomed slide instead of turning it.
    if (this.zoom > 0 && event.key.startsWith("Arrow")) return;
    event.preventDefault();
    this.act(action);
  }

  swipe() {
    let start: { x: number; y: number } | undefined;
    this.stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" && this.zoom === 0)
        start = { x: event.clientX, y: event.clientY };
    });
    this.stage.addEventListener("pointerup", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x,
        dy = event.clientY - start.y;
      start = undefined;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5)
        this.act(dx < 0 ? "next" : "prev");
    });
  }

  async show(n: number) {
    const page = Math.min(Math.max(1, Math.round(n)), this.pages);
    const moved = page !== this.page || !this.canvas;
    this.page = page;
    this.input.value = String(page);
    this.root.style.setProperty(
      "--pdf-progress",
      String(this.pages > 1 ? (page - 1) / (this.pages - 1) : 1),
    );
    for (const action of ["first", "prev"])
      this.control(action).disabled = page === 1;
    for (const action of ["next", "last"])
      this.control(action).disabled = page === this.pages;
    for (const thumb of this.root.querySelectorAll<HTMLElement>(".pdf-thumb"))
      if (Number(thumb.dataset.page) === page) {
        thumb.setAttribute("aria-current", "true");
        thumb.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      } else thumb.removeAttribute("aria-current");
    if (!moved) return;
    this.status(`${this.capital()} ${page} of ${this.pages}`);
    await this.render();
    void this.describe(page);
  }

  control(action: string) {
    return this.root.querySelector<HTMLButtonElement>(
      `.pdf-toolbar [data-pdf-action="${action}"]`,
    )!;
  }

  capital() {
    return this.noun[0].toUpperCase() + this.noun.slice(1);
  }

  status(text: string) {
    this.root.querySelector("[data-pdf-status]")!.textContent = text;
  }

  /** Screen readers get the current page's text, which the canvas cannot carry. */
  async describe(n: number) {
    try {
      const text = (await (await this.doc.getPage(n)).getTextContent()).items
        .map((item) => item.str ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (n === this.page)
        this.root.querySelector("[data-pdf-text]")!.textContent = text;
    } catch {
      // The text is an enhancement; the visible page is already shown.
    }
  }

  async render() {
    const token = ++this.token;
    this.task?.cancel();
    const page = await this.doc.getPage(this.page);
    if (token !== this.token) return;
    const base = page.getViewport({ scale: 1 });
    const box = this.stage.getBoundingClientRect();
    const width = box.width || base.width,
      height = box.height || base.height;
    const fit = Math.min(width / base.width, height / base.height);
    const css = fit * ZOOMS[this.zoom];
    const ratio = globalThis.devicePixelRatio || 1;
    const scale = Math.min(
      css * ratio,
      MAX_PIXELS / Math.max(base.width, base.height),
    );
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(base.width * css)}px`;
    canvas.style.height = `${Math.floor(base.height * css)}px`;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `${this.capital()} ${this.page} of ${this.pages}`,
    );
    const context = canvas.getContext?.("2d");
    if (context) {
      this.task = page.render({ canvasContext: context, canvas, viewport });
      try {
        await this.task.promise;
      } catch {
        return; // Cancelled by a newer page or size.
      }
      if (token !== this.token) return;
    }
    this.stage.querySelector(".pdf-cover")?.remove();
    const previous = this.canvas;
    this.canvas = canvas;
    this.stage.prepend(canvas);
    previous?.remove();
    this.stage.classList.toggle("is-zoomed", this.zoom > 0);
    if (this.page < this.pages) void this.doc.getPage(this.page + 1);
  }

  setZoom(level: number) {
    const next = Math.min(Math.max(0, level), ZOOMS.length - 1);
    this.control("zoom-out").disabled = next === 0;
    this.control("zoom-in").disabled = next === ZOOMS.length - 1;
    if (next === this.zoom) return;
    this.zoom = next;
    this.status(
      next === 0 ? "Fit to frame" : `Zoom ${Math.round(ZOOMS[next] * 100)}%`,
    );
    return this.render();
  }

  toggleStrip() {
    const strip = this.root.querySelector<HTMLElement>(".pdf-strip")!;
    this.strip = !this.strip;
    strip.hidden = !this.strip;
    this.control("strip").setAttribute("aria-pressed", String(this.strip));
    if (this.strip && !strip.childElementCount) this.fillStrip(strip);
    if (this.strip)
      strip
        .querySelector<HTMLElement>('[aria-current="true"]')
        ?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }

  fillStrip(strip: HTMLElement) {
    const thumbs = Array.from({ length: this.pages }, (_, i) => {
      const n = i + 1;
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "pdf-thumb";
      thumb.dataset.page = String(n);
      thumb.setAttribute("aria-label", `${this.capital()} ${n}`);
      if (n === this.page) thumb.setAttribute("aria-current", "true");
      thumb.innerHTML = `<span class="pdf-thumb-number" aria-hidden="true">${n}</span>`;
      thumb.addEventListener("click", () => void this.show(n));
      strip.append(thumb);
      return thumb;
    });
    const draw = (thumb: HTMLElement) => void this.thumbnail(thumb);
    if (typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            draw(entry.target as HTMLElement);
          }
      },
      { root: strip, rootMargin: "0px 240px" },
    );
    for (const thumb of thumbs) observer.observe(thumb);
  }

  async thumbnail(thumb: HTMLElement) {
    const page = await this.doc.getPage(Number(thumb.dataset.page));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (240 / base.width) * Math.min(globalThis.devicePixelRatio || 1, 2),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext?.("2d");
    if (!context) return;
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    thumb.prepend(canvas);
  }

  async toggleFullscreen() {
    const root = this.root;
    if (document.fullscreenElement === root) await document.exitFullscreen();
    else if (root.classList.contains("is-immersive")) {
      root.classList.remove("is-immersive");
      document.documentElement.classList.remove("pdf-immersive");
      this.layout();
    } else if (typeof root.requestFullscreen === "function")
      try {
        await root.requestFullscreen();
      } catch {
        this.immersive();
      }
    else this.immersive();
    root.focus({ focusVisible: false });
  }

  /** iPhone Safari has no element full screen; cover the page instead. */
  immersive() {
    this.root.classList.add("is-immersive");
    document.documentElement.classList.add("pdf-immersive");
    this.layout();
  }

  layout() {
    const full =
      document.fullscreenElement === this.root ||
      this.root.classList.contains("is-immersive");
    this.root.classList.toggle("is-full", full);
    this.control("fullscreen").setAttribute(
      "aria-label",
      full ? "Exit full screen" : "Full screen",
    );
    this.control("fullscreen").title = full
      ? "Exit full screen"
      : "Full screen";
    void this.render();
  }
}

async function activate(root: HTMLElement, load: PdfLoader) {
  if (root.dataset.state) return;
  root.dataset.state = "loading";
  const cover = root.querySelector<HTMLButtonElement>(".pdf-cover")!;
  cover.setAttribute("aria-busy", "true");
  try {
    const doc = await load(root.dataset.src!);
    const viewer = new Viewer(root, doc, root.dataset.noun || "page");
    await viewer.mount();
    root.focus({ preventScroll: true, focusVisible: false });
  } catch (error) {
    console.error("Could not open the PDF", error);
    root.dataset.state = "failed";
    cover.removeAttribute("aria-busy");
    cover.disabled = true;
    root.querySelector<HTMLElement>(".pdf-failed")!.hidden = false;
  }
}

export function mountPdfViewers(
  scope: ParentNode = document,
  load: PdfLoader = loadPdfJs,
) {
  for (const root of scope.querySelectorAll<HTMLElement>(".pdf-viewer")) {
    const cover = root.querySelector<HTMLButtonElement>(".pdf-cover");
    cover?.addEventListener("click", () => void activate(root, load));
  }
}
