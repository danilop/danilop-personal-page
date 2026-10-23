const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");

const models = require("../publishing/models.json").models;
const builtin = models.find((m) => m.runtime === "prompt-api");
const gemma = models.find((m) => m.runtime === "litert-lm");
const tools = [
  {
    name: "get_section_text",
    description: "Read a section.",
    inputSchema: {
      type: "object",
      properties: {
        section: { type: "string", description: "Id", maxLength: 200 },
      },
      required: ["section"],
      additionalProperties: false,
    },
  },
  {
    name: "answer",
    description: "Answer.",
    inputSchema: { type: "object", properties: {} },
  },
];

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

test("descriptors cover the three runtimes and summarise sizes", async () => {
  const { modelSummary } = await import("../runtime/contracts.ts");
  assert.deepEqual(
    models.map((m) => m.runtime),
    ["webllm", "prompt-api", "litert-lm"],
  );
  assert.equal(
    modelSummary(builtin),
    "The browser's built-in model, provided by this browser.",
  );
  assert.match(
    modelSummary(gemma),
    /^Gemma 4 E2B .* Download approximately 1916 MB; estimated GPU memory 1800 MB\.$/,
  );
  assert.match(
    gemma.model,
    /\/resolve\/a790a852d433991c0c0a41c1154cf9b3850300fa\//,
  );
  assert.match(modelSummary(models[0]), /^SmolLM2/);
});

test("Prompt API adapter probes without downloading, streams, resets and runs a validated JSON agent chat", async (t) => {
  const created = [];
  const replies = [];
  const session = (options) => {
    const s = {
      options,
      destroyed: false,
      prompts: [],
      async prompt(text, o) {
        s.prompts.push([text, o.responseConstraint]);
        return replies.shift();
      },
      async *promptStreaming(text) {
        yield "Hel";
        yield "lo " + text;
      },
      clone: async () => session(options),
      destroy() {
        s.destroyed = true;
      },
    };
    created.push(s);
    return s;
  };
  let state = "available";
  setGlobals(t, {
    navigator: { userAgent: "Mozilla/5.0 Chrome/156.0.0.0 Safari/537.36" },
    LanguageModel: {
      availability: async (o) => {
        assert.deepEqual(o.expectedInputs, [
          { type: "text", languages: ["en"] },
        ]);
        return state;
      },
      create: async (o) => {
        o.monitor?.({
          addEventListener: (_name, listener) => listener({ loaded: 0.5 }),
        });
        return session(o);
      },
    },
  });
  const { promptApi } = await import("../runtime/adapters/prompt-api.ts");
  assert.deepEqual(await promptApi.probe(builtin), {
    supported: true,
    download: false,
  });
  state = "downloadable";
  assert.deepEqual(await promptApi.probe(builtin), {
    supported: true,
    download: true,
  });
  state = "unavailable";
  assert.equal((await promptApi.probe(builtin)).supported, false);
  const progress = [];
  const loaded = await promptApi.load(
    builtin,
    (p) => progress.push(p),
    new AbortController().signal,
  );
  assert.deepEqual(progress, ["Downloading the browser's model… 50%"]);
  const tokens = [];
  assert.equal(
    await loaded.run(
      "you",
      (x) => tokens.push(x),
      new AbortController().signal,
    ),
    "Hello you",
  );
  assert.deepEqual(tokens, ["Hel", "Hello you"]);
  loaded.stop();
  await loaded.reset();
  assert.equal(created[1].destroyed, true);
  const chat = await loaded.startAgentChat("Be brief.", tools);
  const chatSession = created.at(-1);
  assert.match(
    chatSession.options.initialPrompts[0].content,
    /^Be brief\.[\s\S]*get_section_text: Read a section\./,
  );
  replies.push(
    "not json",
    '```json\n{"tool": "get_section_text", "input": {"section": "a"}}\n```',
  );
  assert.deepEqual(
    await chat.send({ user: "What?" }, new AbortController().signal),
    {
      call: { name: "get_section_text", input: { section: "a" } },
    },
  );
  assert.match(chatSession.prompts[1][0], /not valid/);
  assert.deepEqual(chatSession.prompts[0][1].properties.tool.enum, [
    "get_section_text",
    "answer",
  ]);
  replies.push('<think></think>{"tool": "nope", "input": {}}', "plain words");
  assert.deepEqual(
    await chat.send(
      { toolResult: { name: "get_section_text", result: { text: "x" } } },
      new AbortController().signal,
    ),
    { text: "plain words" },
  );
  assert.equal(
    chatSession.prompts[2][0],
    'Result of get_section_text:\n{"text":"x"}',
  );
  await chat.dispose();
  assert.equal(chatSession.destroyed, true);
  await loaded.dispose();
  await promptApi.clear(builtin);
  setGlobals(t, { LanguageModel: undefined });
  assert.equal((await promptApi.probe(builtin)).supported, false);
});

test("LiteRT-LM adapter checks WebGPU and storage, caches the download, and maps native tool calls", async (t) => {
  const stored = new Map();
  const cache = {
    match: async (url) => stored.get(url)?.clone(),
    put: async (url, response) => {
      stored.set(url, new Response(await response.arrayBuffer()));
    },
    delete: async (url) => stored.delete(url),
  };
  const downloads = [];
  let adapter = { features: new Set() };
  let quota = 10e9;
  setGlobals(t, {
    caches: {
      open: async (name) => (assert.equal(name, "notes-models-v1"), cache),
    },
    fetch: async (url) => {
      downloads.push(url);
      const chunk = new Uint8Array(4);
      let sent = 0;
      return new Response(
        new ReadableStream({
          pull(controller) {
            if (sent >= 2) return controller.close();
            sent++;
            controller.enqueue(chunk);
          },
        }),
      );
    },
    navigator: {
      gpu: { requestAdapter: async () => adapter },
      storage: { estimate: async () => ({ quota, usage: 0 }) },
    },
  });
  const conversations = [];
  const conversation = (config) => {
    const c = {
      config,
      sent: [],
      replies: [],
      cancelled: 0,
      deleted: false,
      async sendMessage(message) {
        c.sent.push(message);
        return c.replies.shift();
      },
      async *sendMessageStreaming() {
        yield { content: [{ type: "text", text: "Hi" }] };
        yield { content: [{ type: "text", text: " there" }] };
      },
      cancel() {
        c.cancelled++;
      },
      async delete() {
        c.deleted = true;
      },
    };
    conversations.push(c);
    return c;
  };
  let engineDeleted = false;
  let modelStream;
  t.mock.module("@litert-lm/core", {
    namedExports: {
      SamplerType: { GREEDY: 3 },
      Engine: {
        create: async (settings) => {
          modelStream = settings.model;
          assert.equal(settings.mainExecutorSettings.maxNumTokens, 4096);
          return {
            createConversation: async (config) => conversation(config),
            delete: async () => {
              engineDeleted = true;
            },
          };
        },
      },
    },
  });
  const { litertLm } = await import("../runtime/adapters/litert-lm.ts");
  assert.equal(litertLm.version, "0.18.0");
  const signal = new AbortController().signal;
  quota = 1e9;
  assert.match(
    (await litertLm.probe(gemma)).reason,
    /Not enough free browser storage for the 2.0 GB/,
  );
  quota = 10e9;
  assert.deepEqual(await litertLm.probe(gemma), {
    supported: true,
    download: true,
  });
  await assert.rejects(
    litertLm.load(gemma, () => {}, signal),
    /incomplete/,
  );
  assert.equal(stored.size, 0);
  const small = { ...gemma, downloadBytes: 8 };
  const progress = [];
  const session = await litertLm.load(small, (p) => progress.push(p), signal);
  assert.deepEqual(progress, [
    "Downloading the model… 50%",
    "Downloading the model… 100%",
    "Starting the model…",
  ]);
  assert(modelStream instanceof ReadableStream);
  assert.deepEqual(await litertLm.probe(small), {
    supported: true,
    download: false,
  });
  await litertLm.load(small, () => {}, signal);
  assert.equal(downloads.length, 2);
  const tokens = [];
  assert.equal(
    await session.run("hello", (x) => tokens.push(x), signal),
    "Hi there",
  );
  assert.deepEqual(tokens, ["Hi", "Hi there"]);
  const chat = await session.startAgentChat("System.", tools);
  const c = conversations.at(-1);
  assert.equal(c.config.enableConstrainedDecoding, true);
  assert.deepEqual(c.config.preface.messages, [
    { role: "system", content: "System." },
  ]);
  assert.deepEqual(c.config.preface.tools[0], {
    type: "function",
    function: {
      name: "get_section_text",
      description: "Read a section.",
      parameters: {
        type: "object",
        required: ["section"],
        properties: { section: { type: "string", description: "Id" } },
      },
    },
  });
  c.replies.push(
    {
      role: "assistant",
      tool_calls: [
        {
          type: "function",
          function: { name: "answer", arguments: { found: false } },
        },
      ],
    },
    { role: "assistant", content: [{ type: "text", text: "No tool" }] },
    { role: "assistant", content: "Plain" },
  );
  assert.deepEqual(await chat.send({ user: "Q?" }, signal), {
    call: { name: "answer", input: { found: false } },
  });
  assert.deepEqual(
    await chat.send(
      { toolResult: { name: "get_section_text", result: { text: "t" } } },
      signal,
    ),
    { text: "No tool" },
  );
  assert.deepEqual(c.sent[1], {
    role: "tool",
    content: [
      {
        type: "tool_response",
        name: "get_section_text",
        response: { text: "t" },
      },
    ],
  });
  const aborting = new AbortController();
  aborting.abort();
  await assert.rejects(chat.send({ user: "x" }, aborting.signal));
  await chat.dispose();
  assert.equal(c.deleted, true);
  session.stop();
  await session.reset();
  await session.dispose();
  assert.equal(engineDeleted, true);
  await litertLm.clear(small);
  assert.equal(stored.size, 0);
  adapter = { features: new Set() };
  assert.match(
    (await litertLm.probe({ ...gemma, requiredFeatures: ["shader-f16"] }))
      .reason,
    /missing shader-f16/,
  );
  adapter = null;
  assert.match((await litertLm.probe(gemma)).reason, /No compatible GPU/);
  setGlobals(t, { navigator: {} });
  assert.match((await litertLm.probe(gemma)).reason, /WebGPU/);
  setGlobals(t, {
    navigator: {
      gpu: { requestAdapter: async () => ({ features: new Set() }) },
    },
    caches: undefined,
  });
  assert.match((await litertLm.probe(gemma)).reason, /cannot store/);
});

test("model experiments use the first supported model in their preference order", async (t) => {
  const { window, document } = parseHTML(
    `<!doctype html><html><body><section class="model-experiment" data-model="browser-language-model ${models[0].id}"><p class="model-info"></p><textarea>Hi</textarea><output>Fallback</output>${["load-model", "cancel-model", "clear-model", "generate", "stop-model", "reset-model", "capture-model"].map((a) => `<button data-action="${a}"></button>`).join("")}</section></body></html>`,
  );
  setGlobals(t, { window, document });
  const { modelRuntimes } = await import("../runtime/model-registry.ts");
  const saved = { ...modelRuntimes };
  t.after(() => Object.assign(modelRuntimes, saved));
  modelRuntimes["prompt-api"] = {
    ...saved["prompt-api"],
    probe: async () => ({ supported: false, reason: "No built-in model." }),
  };
  modelRuntimes.webllm = {
    ...saved.webllm,
    probe: async () => ({ supported: true }),
    load: async () => ({
      run: async () => "",
      stop() {},
      reset: async () => {},
      dispose: async () => {},
    }),
  };
  const { mountModels } = await import("../runtime/models.ts");
  mountModels();
  const info = document.querySelector(".model-info");
  assert.equal(
    info.textContent,
    `Uses the first available of: The browser's built-in model; ${models[0].id}.`,
  );
  document.querySelector("[data-action=load-model]").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(info.textContent, /^SmolLM2/);
  assert.equal(
    document.querySelector("output").textContent,
    "Ready. Enter a prompt to begin.",
  );
  modelRuntimes.webllm = {
    ...modelRuntimes.webllm,
    probe: async () => ({ supported: false, reason: "No WebGPU." }),
  };
});
