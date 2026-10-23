const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");

const tick = () => new Promise((resolve) => setTimeout(resolve, 15));

function scriptedChat(steps) {
  const sent = [];
  return {
    sent,
    disposed: false,
    async send(input, signal) {
      signal.throwIfAborted();
      sent.push(input);
      const next = steps.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    async dispose() {
      this.disposed = true;
    },
  };
}
const fakeTool = (name, result) => ({
  name,
  title: name,
  description: name,
  inputSchema: {
    type: "object",
    properties: { section: { type: "string", description: "s" } },
    additionalProperties: false,
  },
  annotations: {},
  available: () => true,
  execute: async (input) =>
    typeof result === "function" ? result(input) : result,
});

function setGlobals(t, values) {
  for (const [key, value] of Object.entries(values)) {
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
}

test("the loop reads sections, keeps only retrieved citations and enforces the tool limit", async (t) => {
  const { document, window } = parseHTML(
    "<!doctype html><html><body></body></html>",
  );
  setGlobals(t, { document, CustomEvent: window.CustomEvent });
  const { askQuestion, answerTool, systemPrompt } =
    await import("../runtime/assistant/loop.ts");
  const sections = [
    { id: "a", title: "Alpha" },
    { id: "b", title: "Beta" },
  ];
  assert.deepEqual(
    answerTool(sections).inputSchema.properties.citations.items.enum,
    ["a", "b"],
  );
  assert.match(
    systemPrompt("Page", sections),
    /“Page”[\s\S]*- a: Alpha\n- b: Beta$/,
  );
  const read = fakeTool("get_section_text", (input) => ({
    section: input.section,
    text: "x".repeat(9000),
  }));
  const steps = [];
  const chat = scriptedChat([
    { call: { name: "get_section_text", input: { section: "a" } } },
    {
      call: {
        name: "answer",
        input: {
          found: true,
          answer: " Alpha says x. ",
          citations: ["a", "b", "a", 3],
        },
      },
    },
  ]);
  const signal = new AbortController().signal;
  assert.deepEqual(
    await askQuestion(chat, "Q?", [read], signal, (s) => steps.push(s)),
    {
      found: true,
      text: "Alpha says x.",
      citations: ["a"],
    },
  );
  assert.deepEqual(steps, [
    { tool: "get_section_text", input: { section: "a" } },
  ]);
  assert.equal(chat.sent[1].toolResult.result.truncated, true);
  assert.equal(chat.sent[1].toolResult.result.text.length, 4000);

  const busy = scriptedChat([
    ...Array.from({ length: 5 }, () => ({
      call: { name: "get_section_text", input: { section: "b" } },
    })),
    { call: { name: "nope", input: {} } },
    {
      call: {
        name: "answer",
        input: { found: false, answer: 7, citations: "b" },
      },
    },
  ]);
  const limited = await askQuestion(busy, "Q?", [read], signal, () => {});
  assert.deepEqual(limited, { found: false, text: "", citations: [] });
  assert.deepEqual(busy.sent[5].toolResult.result, {
    error: "Tool limit reached. Call answer now.",
  });
  assert.deepEqual(busy.sent[6].toolResult.result, {
    error: "Tool limit reached. Call answer now.",
  });

  const declining = scriptedChat([
    { call: { name: "get_section_text", input: { section: "a" } } },
    {
      call: {
        name: "answer",
        input: {
          found: true,
          answer: "The page does not state the price.",
          citations: ["a"],
        },
      },
    },
  ]);
  assert.deepEqual(
    await askQuestion(declining, "Price?", [read], signal, () => {}),
    {
      found: false,
      text: "The page does not state the price.",
      citations: [],
    },
  );

  const unknown = scriptedChat([
    { call: { name: "nope", input: {} } },
    { text: " Plain reply " },
  ]);
  assert.deepEqual(await askQuestion(unknown, "Q?", [], signal, () => {}), {
    found: true,
    text: "Plain reply",
    citations: [],
  });
  assert.deepEqual(unknown.sent[1].toolResult.result, {
    error: "Unknown tool nope. Call answer.",
  });

  const failing = fakeTool("get_section_text", () => {
    throw Error("broken");
  });
  const errors = t.mock.method(console, "error", () => {});
  const bad = scriptedChat([
    { call: { name: "get_section_text", input: { section: "a" } } },
    { text: "ok" },
  ]);
  await askQuestion(bad, "Q?", [failing], signal, () => {});
  assert.match(bad.sent[1].toolResult.result.error, /failed in the browser/);
  assert.equal(errors.mock.callCount(), 1);

  const controller = new AbortController();
  const stopping = scriptedChat([
    { call: { name: "get_section_text", input: { section: "a" } } },
  ]);
  const pending = askQuestion(
    stopping,
    "Q?",
    [
      fakeTool(
        "get_section_text",
        () => (controller.abort(), { section: "a" }),
      ),
    ],
    controller.signal,
    () => {},
  );
  await assert.rejects(pending);
});

const PAGE = `<header class="masthead"><nav><a data-search-link href="/search/">Search</a></nav></header><main><article class="reading"><h1>Loophole<span class="draft-badge">Draft</span></h1>
<p class="assistant-entry" data-assistant><button data-assistant-open aria-expanded="false">Ask about this page</button></p>
<div class="prose"><p>Intro text.</p><h2 id="board">A leaderboard</h2><p>FelonyBench is satirical.</p></div></article></main>`;

async function mountPanel(t, runtimes, language = "en-GB") {
  const { window, document } = parseHTML(
    `<!doctype html><html><head></head><body>${PAGE}</body></html>`,
  );
  setGlobals(t, {
    window,
    document,
    Element: window.Element,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    navigator: { language },
    location: {
      href: "https://fixture.invalid/writing/a/",
      origin: "https://fixture.invalid",
    },
  });
  const { modelRuntimes } = await import("../runtime/model-registry.ts");
  const saved = { ...modelRuntimes };
  t.after(() => Object.assign(modelRuntimes, saved));
  Object.assign(modelRuntimes, runtimes);
  const { mountAssistant } = await import("../runtime/assistant/panel.ts");
  const entry = document.querySelector("[data-assistant]");
  mountAssistant(entry);
  const open = entry.querySelector("button");
  const panel = document.querySelector("#assistant-panel");
  const body = () => panel.querySelector(".assistant-body");
  const button = (label) =>
    [...panel.querySelectorAll("button")].find((b) => b.textContent === label);
  return { document, window, open, panel, body, button };
}

test("the panel offers the first supported runtime, loads it, answers with citations and clears the model", async (t) => {
  const events = [];
  let chats = 0;
  const session = {
    run: async () => "",
    stop() {},
    reset: async () => {},
    dispose: async () => {},
    startAgentChat: async (system, tools) => {
      chats++;
      assert.match(system, /“Loophole”/);
      assert.deepEqual(
        tools.map((x) => x.name),
        ["get_section_text", "find_in_page", "answer"],
      );
      return scriptedChat(
        chats === 1
          ? [
              {
                call: { name: "get_section_text", input: { section: "board" } },
              },
              {
                call: {
                  name: "answer",
                  input: {
                    found: true,
                    answer: "It is satirical.",
                    citations: ["board"],
                  },
                },
              },
            ]
          : chats === 2
            ? [
                {
                  call: {
                    name: "answer",
                    input: { found: false, answer: "false", citations: [] },
                  },
                },
              ]
            : [new Error("Input token count exceeds the context window")],
      );
    },
  };
  let cleared = 0;
  const ui = await mountPanel(
    t,
    {
      "prompt-api": {
        id: "prompt-api",
        probe: async () => ({ supported: false, reason: "No built-in model." }),
      },
      "litert-lm": {
        id: "litert-lm",
        probe: async () => ({ supported: true, download: true }),
        load: async (_model, progress) => {
          progress("Downloading the model… 50%");
          return session;
        },
        clear: async () => {
          cleared++;
        },
      },
    },
    "it-IT",
  );
  ui.document.addEventListener("notes:assistant-started", (e) =>
    events.push(e.detail),
  );
  assert.equal(ui.panel.hidden, true);
  ui.open.click();
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.open.getAttribute("aria-expanded"), "true");
  await tick();
  assert.match(
    ui.body().textContent,
    /Downloads Gemma 4 E2B \(Google, Apache-2.0\) \(about 2.0 GB\) from Hugging Face/,
  );
  assert.match(ui.body().textContent, /questions work best in English/);
  ui.button("Download (about 2.0 GB)").click();
  await tick();
  assert.deepEqual(events, [{ runtime: "litert-lm" }]);
  assert.equal(ui.panel.querySelector(".assistant-form").hidden, false);
  const suggestions = [
    ...ui.panel.querySelectorAll(".assistant-suggestions button"),
  ].map((b) => b.textContent);
  assert.deepEqual(suggestions, [
    "What is the main point of this page?",
    "What does “A leaderboard” explain?",
  ]);
  const ask = (q) => {
    ui.panel.querySelector("textarea").value = q;
    ui.panel
      .querySelector("form")
      .dispatchEvent(new ui.window.Event("submit", { cancelable: true }));
  };
  ask("What is FelonyBench?");
  await tick();
  const turn = ui.panel.querySelector(".assistant-turn");
  assert.deepEqual(
    [...turn.querySelectorAll(".assistant-steps li")].map(
      (li) => li.textContent,
    ),
    ["Read section “A leaderboard”"],
  );
  assert.equal(
    turn.querySelector(".assistant-answer").textContent,
    "It is satirical.",
  );
  const cite = turn.querySelector(".assistant-sources a");
  assert.equal(cite.textContent, "A leaderboard");
  ui.document.getElementById("board").scrollIntoView = () => {};
  cite.click();
  assert(
    ui.document.getElementById("board").classList.contains("assistant-cited"),
  );
  ask("Price?");
  await tick();
  const second = ui.panel.querySelectorAll(".assistant-turn")[1];
  assert.equal(
    second.querySelector(".assistant-answer").textContent,
    "The page does not seem to say.",
  );
  const errors = t.mock.method(console, "error", () => {});
  ask("Everything?");
  await tick();
  assert.match(
    ui.panel.querySelectorAll(".assistant-turn")[2].textContent,
    /narrower question/,
  );
  assert.equal(errors.mock.callCount(), 1);
  ui.button("New conversation").click();
  assert.equal(ui.panel.querySelectorAll(".assistant-turn").length, 0);
  ui.button("Clear downloaded model").click();
  await tick();
  assert.equal(cleared, 1);
  assert.match(ui.body().textContent, /removed from this browser/);
  const escape = new ui.window.Event("keydown");
  escape.key = "Escape";
  ui.panel.dispatchEvent(escape);
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.open.getAttribute("aria-expanded"), "false");
});

test("the panel explains when no runtime works and reports load failures", async (t) => {
  const ui = await mountPanel(t, {
    "prompt-api": {
      id: "prompt-api",
      probe: async () => ({ supported: false, reason: "No built-in model." }),
    },
    "litert-lm": {
      id: "litert-lm",
      probe: async () => ({ supported: false, reason: "No WebGPU." }),
    },
  });
  ui.open.click();
  await tick();
  assert.match(
    ui.body().textContent,
    /cannot run the reading assistant[\s\S]*No built-in model\. No WebGPU\./,
  );
  ui.open.click();
  assert.equal(ui.panel.hidden, true);

  const failing = await mountPanel(t, {
    "prompt-api": {
      id: "prompt-api",
      probe: async () => ({ supported: true, download: false }),
      load: async (_m, _p, signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    },
  });
  failing.open.click();
  await tick();
  assert.match(failing.body().textContent, /browser's built-in model/);
  failing.button("Start").click();
  await tick();
  failing.button("Cancel").click();
  await tick();
  assert.match(
    failing.body().textContent,
    /Cancelled\. Nothing more was downloaded\./,
  );
  failing.button("Not now").click();
  assert.equal(failing.panel.hidden, true);
});
