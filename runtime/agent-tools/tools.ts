import { ToolError, type AgentTool, type InputSchema } from "./registry";
import { announceAgentAction } from "./feedback";

type ReadingIndex = {
  pieces: {
    id: string;
    title: string;
    summary: string;
    url: string;
    publishedAt?: string;
    tags: string[];
    placements: { collection: string; url: string }[];
  }[];
  collections: {
    id: string;
    title: string;
    summary: string;
    url: string;
    book: boolean;
    contents: {
      id: string;
      title: string;
      kind: string;
      number?: string;
      depth: number;
      url?: string;
    }[];
  }[];
};

const schema = (
  properties: InputSchema["properties"] = {},
  required: string[] = [],
): InputSchema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

/** Site base path, taken from the masthead Search link the deployment rewrites. */
function siteBase(doc = document) {
  const link = doc.querySelector<HTMLAnchorElement>("a[data-search-link]");
  if (!link) throw new ToolError("This page does not offer site tools.");
  return new URL(link.href, location.href).pathname.replace(/search\/$/, "");
}
const absolute = (path: string) =>
  new URL(siteBase().slice(0, -1) + path, location.href).href;
const date = (iso?: string) => iso?.slice(0, 10);

let index: Promise<ReadingIndex> | undefined;
function readingIndex() {
  index ??= fetch(siteBase() + "reading-index.json").then((r) => {
    if (!r.ok) throw new ToolError("The reading index could not load.");
    return r.json() as Promise<ReadingIndex>;
  });
  return index.catch((error: unknown) => {
    index = undefined;
    throw error;
  });
}

const readingBody = (doc: Document) =>
  doc.querySelector("main article.reading");
const text = (el: Element | null | undefined) =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();

type OutlineItem = { id: string; title: string; level: number };
function outline(doc: Document): OutlineItem[] {
  const article = readingBody(doc);
  if (!article) return [];
  return [
    ...article.querySelectorAll<HTMLElement>(
      ".prose :is(h2, h3)[id], section.prose[id]",
    ),
  ].map((el) => {
    const heading =
      el.tagName === "SECTION"
        ? el.querySelector(":scope > :is(h2, h3, h4, h5, h6)")
        : el;
    return {
      id: el.id,
      title: text(heading) || el.id,
      level: heading ? Number(heading.tagName.slice(1)) : 2,
    };
  });
}
function findSection(doc: Document, id: string) {
  const el = doc.getElementById(id);
  if (!el || !outline(doc).some((s) => s.id === id))
    throw new ToolError(
      `No section "${id}". Call get_page_outline for section ids.`,
    );
  return el;
}
const BLOCK = /^(P|H[1-6]|LI|PRE|BLOCKQUOTE|FIGCAPTION|TD|TH|DT|DD)$/;
const SKIP =
  "button, noscript, audio, [data-narration], [data-audiobook], .copy-code";
/** Readable text of an element: one paragraph per block, controls skipped. */
function blockText(el: Element): string[] {
  if (el.matches(SKIP)) return [];
  if (BLOCK.test(el.tagName)) return [text(el)].filter(Boolean);
  const nested = [...el.children].flatMap(blockText);
  return nested.length ? nested : [text(el)].filter(Boolean);
}
function sectionText(el: HTMLElement) {
  if (el.tagName === "SECTION") return blockText(el).join("\n\n");
  const level = Number(el.tagName.slice(1));
  const parts = [text(el)];
  for (
    let next = el.nextElementSibling;
    next &&
    !(/^H[1-6]$/.test(next.tagName) && Number(next.tagName.slice(1)) <= level);
    next = next.nextElementSibling
  )
    parts.push(...blockText(next));
  return parts.filter(Boolean).join("\n\n");
}

const activities = (doc: Document) => {
  const seen = new Map<string, number>();
  return [...doc.querySelectorAll<HTMLElement>("[data-code-activity]")].map(
    (root) => {
      const base = root.dataset.activityId ?? "example";
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return {
        id: n === 1 ? base : `${base}-${n}`,
        title: text(root.querySelector(".activity-heading")),
        root,
      };
    },
  );
};
async function activity(id: string) {
  const found = activities(document).find((a) => a.id === id);
  if (!found)
    throw new ToolError(
      `No code example "${id}". Call list_code_examples for ids.`,
    );
  const { mountPythonRunner } = await import("../python-runner");
  return { ...found, controller: mountPythonRunner(found.root) };
}

function player(doc: Document) {
  const panel = doc.querySelector<HTMLElement>(
    "[data-narration], [data-audiobook]",
  );
  const button = panel?.querySelector<HTMLButtonElement>(
    ".audio-playback-button",
  );
  const audio = panel?.querySelector("audio");
  if (!button || !audio)
    throw new ToolError("This page has no listening controls.");
  return { button, audio };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const agentTools: AgentTool[] = [
  {
    name: "search_writing",
    title: "Search the writing",
    description:
      "Full-text search across Danilo Poccia's published articles and books. Returns up to `limit` results with title, URL, context and a short excerpt. Use it to find writing on a topic before opening or reading it.",
    inputSchema: schema(
      {
        query: {
          type: "string",
          description: "Words to search for",
          maxLength: 200,
        },
        limit: {
          type: "integer",
          description: "Maximum results (1-10, default 5)",
          minimum: 1,
          maximum: 10,
        },
      },
      ["query"],
    ),
    annotations: { readOnlyHint: true },
    // The search page offers the same tool declaratively through its form.
    available: (doc) =>
      !!doc.querySelector("a[data-search-link]") &&
      !doc.querySelector('form[toolname="search_writing"]'),
    async execute(input) {
      const { searchWriting, agentHits } = await import("../search");
      const base = siteBase();
      const hits = await searchWriting(
        { src: base + "pagefind/pagefind.js", base },
        input.query as string,
        (input.limit as number | undefined) ?? 5,
      );
      return { results: agentHits(hits) };
    },
  },
  {
    name: "list_writing",
    title: "List the writing",
    description:
      "List published articles (newest first) with title, URL, date, summary and tags, and the books with their URLs. Optionally filter articles by tag.",
    inputSchema: schema({
      tag: {
        type: "string",
        description: "Only articles with this tag",
        maxLength: 60,
      },
    }),
    annotations: { readOnlyHint: true },
    available: (doc) => !!doc.querySelector("a[data-search-link]"),
    async execute(input) {
      const { pieces, collections } = await readingIndex();
      return {
        articles: pieces
          .filter((p) => !input.tag || p.tags.includes(input.tag as string))
          .map((p) => ({
            title: p.title,
            url: absolute(p.url),
            date: date(p.publishedAt),
            summary: p.summary,
            tags: p.tags,
          })),
        books: collections.map((c) => ({
          id: c.id,
          title: c.title,
          url: absolute(c.url),
          kind: c.book ? "book" : "collection",
        })),
      };
    },
  },
  {
    name: "get_book_contents",
    title: "Book contents",
    description:
      "Table of contents of one book or collection: chapters and pieces in reading order, with numbers and URLs. Use list_writing for book ids.",
    inputSchema: schema(
      {
        book: {
          type: "string",
          description: "Book or collection id",
          maxLength: 100,
        },
      },
      ["book"],
    ),
    annotations: { readOnlyHint: true },
    available: (doc) =>
      !!doc.querySelector('.masthead nav a[href$="/collections/"]'),
    async execute(input) {
      const { collections } = await readingIndex();
      const c = collections.find((c) => c.id === input.book);
      if (!c)
        throw new ToolError(
          `No book "${String(input.book)}". Available: ${collections.map((c) => c.id).join(", ") || "none"}.`,
        );
      return {
        title: c.title,
        summary: c.summary,
        url: absolute(c.url),
        contents: c.contents.map((n) => ({
          title: (n.number ? `${n.number}. ` : "") + n.title,
          kind: n.kind,
          depth: n.depth,
          ...(n.url ? { url: absolute(n.url) } : { planned: true }),
        })),
      };
    },
  },
  {
    name: "get_page_outline",
    title: "Page outline",
    description:
      "Title and section headings of the article or chapter open in this tab, with section ids for get_section_text and go_to_section.",
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
    available: (doc) => !!readingBody(doc),
    async execute() {
      return {
        title: [
          ...(readingBody(document)?.querySelector("h1")?.childNodes ?? []),
        ]
          .filter((n) => !(n instanceof Element && n.matches(".draft-badge")))
          .map((n) => n.textContent)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
        url: location.href.split("#")[0],
        sections: outline(document),
      };
    },
  },
  {
    name: "get_section_text",
    title: "Read a section",
    description:
      "Plain text of one section of the current page, up to about 7,500 characters. Get section ids from get_page_outline.",
    inputSchema: schema(
      {
        section: { type: "string", description: "Section id", maxLength: 200 },
      },
      ["section"],
    ),
    annotations: { readOnlyHint: true },
    available: (doc) => !!readingBody(doc),
    async execute(input) {
      const el = findSection(document, input.section as string);
      return {
        section: el.id,
        url: `${location.href.split("#")[0]}#${el.id}`,
        text: sectionText(el),
      };
    },
  },
  {
    name: "go_to_section",
    title: "Go to a section",
    description:
      "Scroll the current page to a section and move keyboard focus there, as an in-page link would. The reader sees the move and can undo it.",
    inputSchema: schema(
      {
        section: { type: "string", description: "Section id", maxLength: 200 },
      },
      ["section"],
    ),
    annotations: {},
    available: (doc) => !!readingBody(doc),
    async execute(input) {
      const el = findSection(document, input.section as string);
      const previous = scrollY;
      const heading =
        el.tagName === "SECTION"
          ? (el.querySelector<HTMLElement>("h2, h3, h4") ?? el)
          : el;
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      announceAgentAction(`An AI agent moved to “${text(heading)}”.`, {
        target: el,
        undo: () => scrollTo({ top: previous }),
      });
      return { section: el.id };
    },
  },
  {
    name: "open_page",
    title: "Open a page",
    description:
      "Navigate this tab to another page of this site (same origin only), for example a URL returned by search_writing or list_writing. Tools on the new page replace the current ones.",
    inputSchema: schema(
      {
        url: {
          type: "string",
          description: "Absolute or site-relative URL",
          maxLength: 500,
        },
      },
      ["url"],
    ),
    annotations: {},
    available: (doc) => !!doc.querySelector("a[data-search-link]"),
    async execute(input) {
      let target: URL;
      try {
        target = new URL(input.url as string, location.href);
      } catch {
        throw new ToolError("That is not a valid URL.");
      }
      if (
        target.origin !== location.origin ||
        !target.pathname.startsWith(siteBase())
      )
        throw new ToolError("Only pages on this site can be opened.");
      announceAgentAction(`An AI agent is opening ${target.pathname}.`);
      setTimeout(() => location.assign(target.href), 300);
      return { opening: target.href };
    },
  },
  {
    name: "play_narration",
    title: "Play narration",
    description:
      "Start or resume the audio narration of this page with its visible player. Browsers may block playback that the reader did not start; then ask the reader to press Listen.",
    inputSchema: schema(),
    annotations: {},
    available: (doc) =>
      !!doc.querySelector("[data-narration], [data-audiobook]"),
    async execute() {
      const { button, audio } = player(document);
      if (audio.paused || audio.ended) {
        button.click();
        await wait(500);
      }
      if (audio.paused)
        throw new ToolError(
          "The browser did not allow playback without the reader's action. Ask the reader to press the Listen button.",
        );
      announceAgentAction("An AI agent started the narration.", {
        target: button,
        undo: () => audio.pause(),
      });
      return { playing: true, position: Math.round(audio.currentTime) };
    },
  },
  {
    name: "pause_narration",
    title: "Pause narration",
    description: "Pause the audio narration of this page if it is playing.",
    inputSchema: schema(),
    annotations: {},
    available: (doc) =>
      !!doc.querySelector("[data-narration], [data-audiobook]"),
    async execute() {
      const { button, audio } = player(document);
      if (!audio.paused) button.click();
      announceAgentAction("An AI agent paused the narration.", {
        target: button,
      });
      return { playing: false, position: Math.round(audio.currentTime) };
    },
  },
  {
    name: "list_code_examples",
    title: "List code examples",
    description:
      "Runnable Python examples on this page, with ids, titles and their current code. Use the ids with run_code_example, step_code_example and restore_code_example.",
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
    available: (doc) => !!doc.querySelector("[data-code-activity]"),
    async execute() {
      return {
        examples: activities(document).map((a) => ({
          id: a.id,
          title: a.title,
          code: a.root.querySelector("textarea")?.value ?? "",
        })),
      };
    },
  },
  {
    name: "run_code_example",
    title: "Run a code example",
    description:
      "Run a Python example in the page's isolated in-browser Python (Pyodide; standard library only, 10-second limit) and return its output. Optionally replace the code first; the reader sees the edited code in the editor and can restore the original. The first run downloads Python and may take a while.",
    inputSchema: schema(
      {
        id: { type: "string", description: "Example id", maxLength: 200 },
        code: {
          type: "string",
          description: "Python code to run instead of the current code",
          maxLength: 16000,
        },
      },
      ["id"],
    ),
    annotations: { untrustedContentHint: true },
    available: (doc) => !!doc.querySelector("[data-code-activity]"),
    async execute(input) {
      const a = await activity(input.id as string);
      const changed = typeof input.code === "string";
      const result = await a.controller.run(input.code as string | undefined);
      announceAgentAction(`An AI agent ran “${a.title}”.`, {
        target: a.root,
        ...(changed ? { undo: () => a.controller.restore() } : {}),
      });
      return { id: a.id, ...result };
    },
  },
  {
    name: "step_code_example",
    title: "Step through a code example",
    description:
      "Advance a Python example by one recorded line, as the Step button does, returning the next line number and the output so far.",
    inputSchema: schema(
      { id: { type: "string", description: "Example id", maxLength: 200 } },
      ["id"],
    ),
    annotations: {},
    available: (doc) => !!doc.querySelector("[data-code-activity]"),
    async execute(input) {
      const a = await activity(input.id as string);
      const result = await a.controller.step();
      announceAgentAction(`An AI agent stepped through “${a.title}”.`, {
        target: a.root,
      });
      return { id: a.id, ...result };
    },
  },
  {
    name: "restore_code_example",
    title: "Restore a code example",
    description:
      "Restore a Python example's original code and clear its output, as Restore original does.",
    inputSchema: schema(
      { id: { type: "string", description: "Example id", maxLength: 200 } },
      ["id"],
    ),
    annotations: {},
    available: (doc) => !!doc.querySelector("[data-code-activity]"),
    async execute(input) {
      const a = await activity(input.id as string);
      const result = a.controller.restore();
      announceAgentAction(`An AI agent restored “${a.title}”.`, {
        target: a.root,
      });
      return { id: a.id, ...result };
    },
  },
];
