const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");
function dom(t, body) {
  const { window, document } = parseHTML(
    "<!doctype html><html><body>" + body + "</body></html>",
  );
  for (const [key, value] of Object.entries({
    window,
    document,
    Element: window.Element,
    Event: window.Event,
    localStorage: new MapStorage(),
    location: {
      origin: "https://fixture.invalid",
      hostname: "fixture.invalid",
      protocol: "https:",
      reload() {},
    },
    innerHeight: 800,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }
  return {
    window,
    document,
    click: (selector) => {
      const node = document.querySelector(selector);
      assert(node, selector);
      node.click();
    },
  };
}
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
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("simulation controls validate inputs, render results, capture, stop and reset", async (t) => {
  const controls = ["run", "stop", "reset", "capture"]
    .map((action) => `<button data-action="${action}">${action}</button>`)
    .join("");
  const { document, click } = dom(
    t,
    `<section class="experiment" data-experiment="missing"></section><section class="experiment" data-experiment="growth-js" data-scenarios='{"small":{"input":{"initial":10,"rate":5,"steps":2}}}'><select data-action="scenario"><option value="small" selected>Small</option></select>${controls}<input name="initial" value="100"><input name="rate" value="5"><input name="steps" value="2"><output>Written example</output><div class="experiment-results"></div></section>`,
  );
  let worker;
  t.mock.method(globalThis, "setTimeout", (fn) => {
    fn();
    return 0;
  });
  const prior = globalThis.Worker;
  globalThis.Worker = class {
    terminated = false;
    constructor() {
      worker = this;
    }
    postMessage(message) {
      this.message = message;
    }
    terminate() {
      this.terminated = true;
    }
  };
  t.after(() => {
    globalThis.Worker = prior;
  });
  const { mountSimulations } = await import("../runtime/simulations.ts");
  mountSimulations();
  click("[data-action=capture]");
  assert.match(document.querySelector("output").textContent, /Run the example/);
  click("[data-action=run]");
  assert.equal(worker.message.input.initial, 100);
  worker.onmessage({ data: { result: [100, 105, 110.25] } });
  assert.equal(document.querySelectorAll("tbody tr").length, 3);
  assert.match(document.querySelector("output").textContent, /110.25/);
  assert(worker.terminated);
  click("[data-action=capture]");
  click("[data-action=stop]");
  assert.equal(document.querySelector("output").textContent, "Stopped.");
  click("[data-action=reset]");
  assert.equal(document.querySelector("output").textContent, "Written example");
  document.querySelector("[name=initial]").value = "-1";
  click("[data-action=run]");
  assert.match(document.querySelector("output").textContent, /Starting value/);
  document
    .querySelector("[data-action=scenario]")
    .dispatchEvent(new Event("change"));
  assert.equal(document.querySelector("[name=initial]").value, "10");
  click("[data-action=run]");
  worker.onmessage({ data: { error: "Computation failed" } });
  assert.equal(
    document.querySelector("output").textContent,
    "Computation failed",
  );
  click("[data-action=run]");
  worker.onerror();
  assert.match(document.querySelector("output").textContent, /could not run/);
});

test("model controls preserve explicit loading and safely run, reset, capture and unload", async (t) => {
  const model = require("../publishing/models.json").models[0];
  const actions = [
    "load-model",
    "cancel-model",
    "clear-model",
    "generate",
    "stop-model",
    "reset-model",
    "capture-model",
  ];
  const { document, window, click } = dom(
    t,
    `<section class="model-experiment" data-model="missing"><output></output><button></button></section><section id="model" class="model-experiment" data-model="${model.id}"><div class="model-info"></div><textarea>Explain this</textarea><output>Written fallback</output>${actions.map((action) => `<button data-action="${action}"></button>`).join("")}</section>`,
  );
  const { modelRuntimes } = await import("../runtime/model-registry.ts");
  const previous = modelRuntimes.webllm;
  const calls = [];
  modelRuntimes.webllm = {
    ...previous,
    probe: async () => ({ supported: true }),
    load: async (_model, progress) => {
      progress("Downloaded");
      return {
        run: async (prompt, onToken) => {
          onToken("Fixture answer");
          return prompt;
        },
        stop() {
          calls.push("stop");
        },
        reset: async () => {
          calls.push("reset");
        },
        dispose: async () => {
          calls.push("dispose");
        },
      };
    },
    clear: async () => {
      calls.push("clear");
    },
  };
  t.after(() => {
    modelRuntimes.webllm = previous;
  });
  const { mountModels } = await import("../runtime/models.ts");
  mountModels();
  const output = document.querySelector("#model output");
  click("[data-action=generate]");
  await tick();
  assert.match(output.textContent, /Load the model/);
  click("[data-action=capture-model]");
  assert.match(output.textContent, /Generate a response/);
  click("[data-action=load-model]");
  await tick();
  assert.match(output.textContent, /Ready/);
  click("[data-action=generate]");
  await tick();
  assert.equal(output.textContent, "Fixture answer");
  click("[data-action=capture-model]");
  click("[data-action=stop-model]");
  click("[data-action=reset-model]");
  await tick();
  assert.equal(output.textContent, "Written fallback");
  assert(calls.includes("reset"));
  click("[data-action=cancel-model]");
  await tick();
  assert.equal(output.textContent, "Model unloaded.");
  assert(calls.includes("dispose"));
  click("[data-action=clear-model]");
  await tick();
  assert.equal(output.textContent, "Downloaded model cleared.");
  assert(calls.includes("clear"));
  modelRuntimes.webllm.probe = async () => ({
    supported: false,
    reason: "No GPU",
  });
  click("[data-action=load-model]");
  await tick();
  assert.match(output.textContent, /No GPU/);
  window.dispatchEvent(new Event("pagehide"));
});

test("analytics sends nothing before consent and removes identifiers when consent is withdrawn", async (t) => {
  const { document, window, click } = dom(
    t,
    `<div id="analytics-config" data-origin="https://fixture.invalid" data-path="/writing/fixture/" data-token="fixture-token" data-host="https://analytics.invalid"></div><div id="analytics-choice"><h2 id="analytics-title">Statistics</h2><button data-analytics-choice="accept">Accept</button><button data-analytics-choice="reject">Reject</button><button data-analytics-close>Close</button></div><p id="analytics-status"></p><button data-privacy-settings>Privacy</button><div class="reading-navigation" data-collection-id="fixture"><a href="#" data-direction="next">Next</a></div><div class="collection-start"><a class="read-link" data-collection-id="fixture" data-collection-type="growing-book">Start</a></div><a data-edition-artifact data-edition-id="one">Edition</a><button class="load-embed">Load embed</button><div class="experiment" data-experiment="growth-js"><button data-action="run">Run</button></div><article class="reading"><div class="prose">Text</div></article>`,
  );
  const events = [];
  let optedOut = 0;
  let settings;
  const client = {
    capture: (...args) => events.push(args),
    opt_in_capturing() {},
    opt_out_capturing() {
      optedOut++;
    },
  };
  t.mock.module("posthog-js/dist/module.no-external", {
    exports: {
      default: {
        init: (_token, options) => {
          settings = options;
          return client;
        },
      },
    },
  });
  let interval;
  t.mock.method(globalThis, "setInterval", (fn) => {
    interval = fn;
    return 1;
  });
  t.mock.method(globalThis, "clearInterval", () => {});
  document.querySelector(".prose").getBoundingClientRect = () => ({
    top: 0,
    height: 1000,
  });
  Object.defineProperty(document, "visibilityState", { value: "visible" });
  await import("../runtime/analytics.ts");
  assert.deepEqual(events, []);
  assert.equal(document.querySelector("#analytics-choice").hidden, false);
  click("[data-analytics-choice=reject]");
  assert.deepEqual(events, []);
  assert.match(document.cookie, /Max-Age=0/);
  click("[data-privacy-settings]");
  assert.equal(document.querySelector("#analytics-choice").hidden, false);
  click("[data-analytics-close]");
  assert.equal(document.querySelector("#analytics-choice").hidden, true);
  click("[data-privacy-settings]");
  click("[data-analytics-choice=accept]");
  await tick();
  assert.equal(events[0][0], "$pageview");
  assert.equal(settings.autocapture, false);
  assert.equal(settings.disable_session_recording, true);
  for (const selector of [
    ".reading-navigation a",
    ".read-link",
    "[data-edition-artifact]",
    ".load-embed",
    "[data-action=run]",
  ])
    click(selector);
  document.dispatchEvent(new Event("notes:code-copied"));
  assert(events.some(([name]) => name === "code_copied"));
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  for (let i = 0; i < 8; i++) {
    now += 5000;
    window.dispatchEvent(new Event("scroll"));
    interval();
  }
  assert(events.some(([name]) => name === "article_engagement"));
  assert.equal(settings.before_send(null), null);
  click("[data-analytics-choice=reject]");
  assert(optedOut > 0);
  assert.equal(
    settings.before_send({ event: "$pageview", properties: {} }),
    null,
  );
  window.dispatchEvent(new Event("pagehide"));
  const restore = new Event("pageshow");
  restore.persisted = true;
  window.dispatchEvent(restore);
});

test("WebLLM adapter probes compatibility and releases workers during cancellation, reset and cache clearing", async (t) => {
  const { webllm } = await import("../runtime/adapters/webllm.ts");
  const model = require("../publishing/models.json").models[0];
  const navigatorBefore = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const workerBefore = globalThis.Worker;
  t.after(() => {
    Object.defineProperty(globalThis, "navigator", navigatorBefore);
    globalThis.Worker = workerBefore;
  });
  Object.defineProperty(globalThis, "navigator", {
    value: {},
    configurable: true,
  });
  assert.equal((await webllm.probe(model)).supported, false);
  navigator.gpu = { requestAdapter: async () => null };
  assert.equal((await webllm.probe(model)).supported, false);
  navigator.gpu.requestAdapter = async () => ({ features: new Set() });
  assert.match((await webllm.probe(model)).reason, /shader-f16/);
  navigator.gpu.requestAdapter = async () => ({
    features: new Set(["shader-f16"]),
  });
  assert.equal((await webllm.probe(model)).supported, true);
  let worker,
    interrupted = 0,
    reset = 0,
    unloaded = 0,
    cleared = 0;
  globalThis.Worker = class {
    terminated = false;
    constructor() {
      worker = this;
    }
    terminate() {
      this.terminated = true;
    }
  };
  const engine = {
    chat: {
      completions: {
        async *create() {
          yield { choices: [{ delta: { content: "Hello" } }] };
          yield { choices: [{ delta: { content: " world" } }] };
        },
      },
    },
    interruptGenerate() {
      interrupted++;
    },
    async resetChat() {
      reset++;
    },
    async unload() {
      unloaded++;
    },
  };
  t.mock.module("@mlc-ai/web-llm", {
    exports: {
      CreateWebWorkerMLCEngine: async (_worker, id, options) => {
        assert.equal(id, model.id);
        options.initProgressCallback({ text: "Loaded" });
        return engine;
      },
      deleteModelAllInfoInCache: async (id) => {
        assert.equal(id, model.id);
        cleared++;
      },
    },
  });
  const progress = [];
  const session = await webllm.load(
    model,
    (text) => progress.push(text),
    new AbortController().signal,
  );
  assert.deepEqual(progress, ["Loaded"]);
  const tokens = [];
  assert.equal(
    await session.run(
      "Hi",
      (text) => tokens.push(text),
      new AbortController().signal,
    ),
    "Hello world",
  );
  assert.deepEqual(tokens, ["Hello", "Hello world"]);
  const cancelled = new AbortController();
  cancelled.abort();
  assert.equal(await session.run("Hi", () => {}, cancelled.signal), "");
  session.stop();
  await session.reset();
  await session.dispose();
  await webllm.clear(model);
  assert.equal(interrupted, 1);
  assert.equal(reset, 1);
  assert.equal(unloaded, 1);
  assert.equal(cleared, 1);
  assert(worker.terminated);
});

test("progressive enhancement loads an embed only on request and handles clipboard success and denial", async (t) => {
  const { document, click } = dom(
    t,
    '<div><button class="load-embed" data-src="https://fixture.invalid/embed" data-title="Fixture" data-height="200">Load</button><div class="embed-host"></div></div><pre><code>example()</code></pre><pre>No code element</pre>',
  );
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: async (text) => {
          copied = text;
        },
      },
    },
    configurable: true,
  });
  t.after(() => Object.defineProperty(globalThis, "navigator", previous));
  await import("../runtime/enhance.ts");
  assert.equal(document.querySelector("iframe"), null);
  click(".load-embed");
  assert.equal(
    document.querySelector("iframe").src,
    "https://fixture.invalid/embed",
  );
  assert.equal(document.querySelector(".load-embed").hidden, true);
  click(".copy-code");
  await tick();
  assert.equal(copied, "example()");
  assert.equal(document.querySelector(".copy-code").textContent, "Copied");
  navigator.clipboard.writeText = async () => {
    throw Error("Denied");
  };
  click(".copy-code");
  await tick();
  assert.equal(
    document.querySelector(".copy-code").textContent,
    "Select code to copy",
  );
});
