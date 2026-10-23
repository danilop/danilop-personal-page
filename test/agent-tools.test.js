const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
class MapStorage {
  data = new Map();
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, value);
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

/** A reading page with the masthead link that carries the site base. */
function page(t, body, extra = {}) {
  const { window, document } = parseHTML(
    `<!doctype html><html><body><header class="masthead"><nav><a data-search-link href="/notes/search/">Search</a>${extra.books ? '<a href="/notes/collections/">Books</a>' : ""}</nav></header><main>${body}</main></body></html>`,
  );
  const globals = {
    window,
    document,
    Element: window.Element,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    localStorage: new MapStorage(),
    location: {
      href: "https://fixture.invalid/notes/writing/a/#top",
      origin: "https://fixture.invalid",
      assign(url) {
        this.assigned = url;
      },
    },
    scrollY: 120,
    scrollTo(options) {
      globalThis.scrolledTo = options.top;
    },
    ...extra.globals,
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, key, previous)
        : delete globalThis[key],
    );
  }
  return { window, document };
}

const ARTICLE = `<article class="reading"><h1>Loophole <span class="draft-badge">Draft</span></h1><div class="prose">
<p>Intro.</p><h2 id="tame">What to tame</h2><p>First   paragraph.</p><h3 id="sub">Detail</h3><p>Sub text.</p>
<h2 id="score">The score</h2><p>Second.</p></div>
<section class="prose reading-section" id="piece-b"><h2>Piece B</h2><p>Body B.</p></section>
<section class="code-activity" data-code-activity data-activity-id="tally"><p class="activity-heading">Make a tally</p><textarea>print(1)</textarea></section>
<section class="code-activity" data-code-activity data-activity-id="tally"><p class="activity-heading">Again</p><textarea>print(2)</textarea></section>
<section data-narration><button class="audio-playback-button">Listen</button><audio></audio></section>
</article>`;

async function tools() {
  const { agentTools } = await import("../runtime/agent-tools/tools.ts");
  const { runTool } = await import("../runtime/agent-tools/registry.ts");
  const call = (name, input) =>
    runTool(
      agentTools.find((t) => t.name === name),
      input,
      { caller: "assistant" },
    );
  return { agentTools, call };
}

test("input validation rejects unknown, missing and out-of-range values; results stay capped", async () => {
  const { validateInput, capResult, ToolError } =
    await import("../runtime/agent-tools/registry.ts");
  const schema = {
    type: "object",
    properties: {
      q: { type: "string", description: "q", maxLength: 3, enum: ["a", "abc"] },
      n: { type: "integer", description: "n", minimum: 1, maximum: 5 },
      b: { type: "boolean", description: "b" },
    },
    required: ["q"],
    additionalProperties: false,
  };
  assert.deepEqual(validateInput(schema, { q: "a", n: 2, b: true }), {
    q: "a",
    n: 2,
    b: true,
  });
  for (const [input, message] of [
    [[], /object/],
    [{}, /"q" is required/],
    [{ q: "a", x: 1 }, /Unknown input "x"/],
    [{ q: 1 }, /text/],
    [{ q: "abcd" }, /longer than 3/],
    [{ q: "ab" }, /one of: a, abc/],
    [{ q: "a", n: 1.5 }, /whole number/],
    [{ q: "a", n: 9 }, /between 1 and 5/],
    [{ q: "a", b: "yes" }, /true or false/],
  ])
    assert.throws(() => validateInput(schema, input), message);
  assert.deepEqual(validateInput({ ...schema, required: [] }, undefined), {});
  const long = capResult({ section: "s", text: "x".repeat(20000) });
  assert.equal(long.truncated, true);
  assert(JSON.stringify(long).length <= 8000);
  assert.deepEqual(capResult({ small: 1 }), { small: 1 });
  assert.throws(
    () => capResult({ items: "y".repeat(9000) }),
    (e) => e instanceof ToolError && /too large/.test(e.message),
  );
});

test("page tools read the outline and sections, move with undo and report bad ids", async (t) => {
  const { document } = page(t, ARTICLE);
  const events = [];
  document.addEventListener("notes:agent-tool", (e) => events.push(e.detail));
  const { agentTools, call } = await tools();
  assert.deepEqual(
    agentTools.filter((tool) => tool.available(document)).map((x) => x.name),
    [
      "search_writing",
      "list_writing",
      "get_page_outline",
      "get_section_text",
      "go_to_section",
      "open_page",
      "play_narration",
      "pause_narration",
      "list_code_examples",
      "run_code_example",
      "step_code_example",
      "restore_code_example",
    ],
  );
  const outline = await call("get_page_outline");
  assert.deepEqual(outline.result, {
    title: "Loophole",
    url: "https://fixture.invalid/notes/writing/a/",
    sections: [
      { id: "tame", title: "What to tame", level: 2 },
      { id: "sub", title: "Detail", level: 3 },
      { id: "score", title: "The score", level: 2 },
      { id: "piece-b", title: "Piece B", level: 2 },
    ],
  });
  assert.equal(
    (await call("get_section_text", { section: "tame" })).result.text,
    "What to tame\n\nFirst paragraph.\n\nDetail\n\nSub text.",
  );
  assert.equal(
    (await call("get_section_text", { section: "sub" })).result.text,
    "Detail\n\nSub text.",
  );
  assert.equal(
    (await call("get_section_text", { section: "piece-b" })).result.text,
    "Piece B\n\nBody B.",
  );
  assert.match(
    (await call("get_section_text", { section: "nope" })).error,
    /get_page_outline/,
  );
  assert.match((await call("get_section_text", {})).error, /required/);
  const moved = await call("go_to_section", { section: "score" });
  assert.deepEqual(moved.result, { section: "score" });
  const notice = document.querySelector(".agent-notice");
  assert.equal(notice.hidden, false);
  assert.match(notice.textContent, /moved to “The score”/);
  assert(
    document.getElementById("score").classList.contains("agent-highlight"),
  );
  notice.querySelector("[data-agent-undo]").click();
  assert.equal(globalThis.scrolledTo, 120);
  assert.equal(notice.hidden, true);
  assert.equal(
    document.getElementById("score").classList.contains("agent-highlight"),
    false,
  );
  assert.deepEqual(events.at(-1), {
    tool: "go_to_section",
    caller: "assistant",
    ok: true,
  });
  assert.equal(events.filter((e) => !e.ok).length, 2);
});

test("site tools search, list, read book contents and open only same-site pages", async (t) => {
  const index = {
    pieces: [
      {
        id: "a",
        title: "A",
        summary: "Sa",
        url: "/writing/a/",
        publishedAt: "2026-10-01T20:00:00Z",
        tags: ["ai"],
        placements: [],
      },
      {
        id: "b",
        title: "B",
        summary: "Sb",
        url: "/writing/b/",
        tags: ["math"],
        placements: [],
      },
    ],
    collections: [
      {
        id: "book",
        title: "Book",
        summary: "S",
        url: "/collections/book/",
        book: true,
        contents: [
          {
            id: "c1",
            title: "One",
            kind: "chapter",
            number: "1",
            depth: 1,
            url: "/collections/book/chapters/c1/",
          },
          { id: "p", title: "Later", kind: "piece", depth: 2 },
        ],
      },
    ],
  };
  let fetches = 0;
  const { document } = page(t, "<p>No article</p>", {
    books: true,
    globals: {
      fetch: async (url) => {
        fetches++;
        assert.equal(url, "/notes/reading-index.json");
        return { ok: fetches > 1, json: async () => index };
      },
    },
  });
  t.mock.module("../runtime/search.ts", {
    namedExports: {
      searchWriting: async (site, query, limit) => {
        assert.deepEqual(site, {
          src: "/notes/pagefind/pagefind.js",
          base: "/notes/",
        });
        return [1, 2, 3].slice(0, limit).map((n) => ({
          title: "T" + n,
          url: `/notes/writing/${n}/`,
          context: "Article",
          excerpt: `<mark>${query}</mark>`,
        }));
      },
      agentHits: (hits) =>
        hits.map((h) => ({ ...h, url: "https://fixture.invalid" + h.url })),
    },
  });
  const { agentTools, call } = await tools();
  assert.deepEqual(
    agentTools.filter((x) => x.available(document)).map((x) => x.name),
    ["search_writing", "list_writing", "get_book_contents", "open_page"],
  );
  const found = await call("search_writing", { query: "loop", limit: 2 });
  assert.deepEqual(
    found.result.results.map((r) => r.url),
    [
      "https://fixture.invalid/notes/writing/1/",
      "https://fixture.invalid/notes/writing/2/",
    ],
  );
  assert.match((await call("list_writing")).error, /could not load/);
  const listed = await call("list_writing", { tag: "ai" });
  assert.deepEqual(listed.result.articles, [
    {
      title: "A",
      url: "https://fixture.invalid/notes/writing/a/",
      date: "2026-10-01",
      summary: "Sa",
      tags: ["ai"],
    },
  ]);
  assert.deepEqual(listed.result.books, [
    {
      id: "book",
      title: "Book",
      url: "https://fixture.invalid/notes/collections/book/",
      kind: "book",
    },
  ]);
  const book = await call("get_book_contents", { book: "book" });
  assert.deepEqual(book.result.contents, [
    {
      title: "1. One",
      kind: "chapter",
      depth: 1,
      url: "https://fixture.invalid/notes/collections/book/chapters/c1/",
    },
    { title: "Later", kind: "piece", depth: 2, planned: true },
  ]);
  assert.match(
    (await call("get_book_contents", { book: "x" })).error,
    /Available: book/,
  );
  assert.equal(fetches, 2);
  for (const url of ["https://evil.invalid/notes/", "/elsewhere/", "http://["])
    assert.match((await call("open_page", { url })).error, /site|valid/);
  const opened = await call("open_page", { url: "/notes/writing/b/" });
  assert.equal(
    opened.result.opening,
    "https://fixture.invalid/notes/writing/b/",
  );
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(
    globalThis.location.assigned,
    "https://fixture.invalid/notes/writing/b/",
  );
});

test("narration and Python tools drive the visible controls", async (t) => {
  const { document } = page(t, ARTICLE);
  const audio = document.querySelector("audio");
  const button = document.querySelector(".audio-playback-button");
  audio.paused = true;
  audio.currentTime = 12.4;
  let pausedByUndo = false;
  audio.pause = () => {
    pausedByUndo = true;
    audio.paused = true;
  };
  let allow = false;
  button.addEventListener("click", () => {
    if (allow) audio.paused = !audio.paused;
  });
  const calls = [];
  t.mock.module("../runtime/python-runner.ts", {
    namedExports: {
      mountPythonRunner: (root) => ({
        run: async (code) => {
          calls.push(["run", root.dataset.activityId, code]);
          return { status: "Finished.", output: "1\n" };
        },
        step: async () => ({ status: "Next line 1.", output: "", line: 1 }),
        restore: () => {
          calls.push(["restore"]);
          return { status: "Original code restored.", output: "" };
        },
      }),
    },
  });
  const { call } = await tools();
  assert.match((await call("play_narration")).error, /press the Listen button/);
  allow = true;
  assert.deepEqual((await call("play_narration")).result, {
    playing: true,
    position: 12,
  });
  document.querySelector("[data-agent-undo]").click();
  assert.equal(pausedByUndo, true);
  audio.paused = false;
  assert.deepEqual((await call("pause_narration")).result, {
    playing: false,
    position: 12,
  });
  assert.equal(audio.paused, true);
  assert.deepEqual((await call("list_code_examples")).result.examples, [
    { id: "tally", title: "Make a tally", code: "print(1)" },
    { id: "tally-2", title: "Again", code: "print(2)" },
  ]);
  assert.deepEqual(
    (await call("run_code_example", { id: "tally-2", code: "print(3)" }))
      .result,
    { id: "tally-2", status: "Finished.", output: "1\n" },
  );
  assert.deepEqual(calls[0], ["run", "tally", "print(3)"]);
  document.querySelector("[data-agent-undo]").click();
  assert.deepEqual(calls.at(-1), ["restore"]);
  assert.equal(
    (await call("step_code_example", { id: "tally" })).result.line,
    1,
  );
  assert.equal(
    (await call("restore_code_example", { id: "tally" })).result.status,
    "Original code restored.",
  );
  assert.match(
    (await call("run_code_example", { id: "x" })).error,
    /list_code_examples/,
  );
  const keydown = new Event("keydown");
  keydown.key = "Escape";
  document.dispatchEvent(keydown);
  assert.equal(document.querySelector(".agent-notice").hidden, true);
});

test("WebMCP adapter registers available tools, returns errors as data and honours the device switch", async (t) => {
  page(t, ARTICLE);
  const registered = [];
  const context = new EventTarget();
  context.registerTool = async (tool, { signal }) => {
    if (tool.name === "pause_narration") throw Error("duplicate");
    registered.push(tool);
    signal.addEventListener("abort", () =>
      registered.splice(registered.indexOf(tool), 1),
    );
  };
  context.getTools = async () => [];
  const errors = t.mock.method(console, "error", () => {});
  const { mountWebMcp } = await import("../runtime/agent-tools/webmcp.ts");
  const { setAgentToolsEnabled, agentToolsEnabled } =
    await import("../runtime/agent-tools/setting.ts");
  await mountWebMcp(context);
  assert.equal(registered.length, 11);
  assert.equal(errors.mock.callCount(), 1);
  const outline = registered.find((r) => r.name === "get_page_outline");
  assert.deepEqual(outline.annotations, { readOnlyHint: true });
  assert.equal(outline.inputSchema.additionalProperties, false);
  assert.equal((await outline.execute({})).title, "Loophole");
  const section = registered.find((r) => r.name === "get_section_text");
  assert.match((await section.execute({ section: "x" })).error, /No section/);
  assert.equal(setAgentToolsEnabled(false), true);
  assert.equal(agentToolsEnabled(), false);
  assert.equal(registered.length, 0);
  setAgentToolsEnabled(true);
  await tick();
  assert.equal(registered.length, 11);
  globalThis.window.dispatchEvent(new Event("pagehide"));
  assert.equal(registered.length, 0);
  localStorage.setItem = () => {
    throw Error("blocked");
  };
  assert.equal(setAgentToolsEnabled(false), false);
  localStorage.getItem = () => {
    throw Error("blocked");
  };
  assert.equal(agentToolsEnabled(), true);
});
