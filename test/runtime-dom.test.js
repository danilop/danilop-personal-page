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
    MutationObserver: window.MutationObserver,
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

function pythonFixture(t) {
  const result = dom(
    t,
    `<section data-code-activity><div data-code-static>Original</div><div data-python-controls hidden><textarea data-python-code>print(10)</textarea><button data-python-step></button><button data-python-run></button><button data-python-reset></button><button data-python-copy></button><p data-copy-status></p><p data-python-status></p><samp data-python-output></samp></div></section>`,
  );
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({
    paddingTop: "10px",
    lineHeight: "20px",
  });
  t.after(() => {
    globalThis.getComputedStyle = previous;
  });
  const editor = result.document.querySelector("textarea");
  editor.scrollTop = 0;
  Object.defineProperty(editor, "clientHeight", { value: 100 });
  return { ...result, editor };
}

test("Python runner isolates messages, resets busy code, invalidates edits and handles deadlines", async (t) => {
  const { document, window, click, editor } = pythonFixture(t);
  t.mock.module("../runtime/python-sandbox.ts", {
    namedExports: { pythonSandbox: () => "<!doctype html>fixture" },
  });
  let timeout;
  t.mock.method(globalThis, "setTimeout", (fn) => {
    timeout = fn;
    return 1;
  });
  t.mock.method(globalThis, "clearTimeout", () => {});
  const { mountPythonRunner } = await import("../runtime/python-runner.ts");
  mountPythonRunner(document.querySelector("section"));
  const status = document.querySelector("[data-python-status]");
  const output = document.querySelector("[data-python-output]");
  const send = (source, data) => {
    const event = new Event("message");
    Object.assign(event, { source, data });
    window.dispatchEvent(event);
  };
  const target = {
    postMessage(data) {
      assert.equal(data.code, "print(7)");
    },
  };
  const frameTarget = () => {
    const frame = document.querySelector("iframe");
    assert.equal(frame.getAttribute("sandbox"), "allow-scripts");
    Object.defineProperty(frame, "contentWindow", { value: target });
  };
  editor.value = "print(7)";
  click("[data-python-run]");
  frameTarget();
  send({}, { phase: "done", output: "spoof" });
  assert.match(status.textContent, /Loading/);
  send(target, { phase: "ready" });
  send(target, { phase: "running" });
  send(target, {
    phase: "done",
    output: "7\n",
    error: "",
    steps: [
      { line: 1, outputLength: 0 },
      { line: null, outputLength: 2 },
    ],
  });
  assert.equal(output.textContent, "7\n");
  assert.equal(document.querySelector("iframe"), null);
  click("[data-python-step]");
  assert.equal(editor.dataset.currentLine, "1");
  assert.equal(output.textContent, "");
  click("[data-python-step]");
  assert.equal(output.textContent, "7\n");
  editor.dispatchEvent(new Event("input"));
  assert.equal(output.textContent, "");
  assert.equal(editor.dataset.currentLine, undefined);
  click("[data-python-run]");
  click("[data-python-reset]");
  assert.equal(editor.value, "print(10)");
  assert.equal(document.querySelector("iframe"), null);
  click("[data-python-step]");
  frameTarget();
  send(target, {
    phase: "done",
    output: "10\n",
    error: "",
    steps: [
      { line: 1, outputLength: 0 },
      { line: null, outputLength: 3 },
    ],
  });
  assert.equal(output.textContent, "");
  click("[data-python-run]");
  assert.equal(output.textContent, "10\n");
  click("[data-python-reset]");
  click("[data-python-run]");
  editor.dispatchEvent(new Event("input"));
  assert.equal(document.querySelector("iframe"), null);
  click("[data-python-run]");
  timeout();
  assert.match(status.textContent, /too long/);
  click("[data-python-run]");
  frameTarget();
  send(target, { phase: "running" });
  timeout();
  assert.match(status.textContent, /10 seconds/);
  click("[data-python-run]");
  frameTarget();
  send(target, { phase: "error", error: "Load failed" });
  assert.match(status.textContent, /Load failed/);
  click("[data-python-run]");
  frameTarget();
  send(target, {
    phase: "done",
    output: "spoof",
    error: "",
    steps: [{ line: 100, outputLength: 0 }],
  });
  assert.match(status.textContent, /invalid/);
  editor.value = " ";
  click("[data-python-run]");
  assert.equal(document.querySelector("iframe"), null);
  editor.value = "x".repeat(16001);
  click("[data-python-run]");
  assert.match(status.textContent, /16,000/);
});

test("Python steps highlight the same editor, follow long programs and show output and errors once", async (t) => {
  const { document, editor } = pythonFixture(t);
  const { pythonTracePlayer } =
    await import("../runtime/python-trace-player.ts");
  const status = document.querySelector("[data-python-status]");
  const output = document.querySelector("[data-python-output]");
  const player = pythonTracePlayer(document.body, status);
  editor.value = "print('first')\n" + "\n".repeat(19) + "print('last')";
  const original = editor.value;
  player.load({
    output: "first\nlast\n",
    error: "",
    steps: [
      { line: 1, outputLength: 0 },
      { line: 21, outputLength: 6 },
      { line: null, outputLength: 11 },
    ],
  });
  assert(player.loaded());
  assert.equal(editor.dataset.currentLine, "1");
  player.step();
  assert.equal(editor.dataset.currentLine, "21");
  assert.equal(editor.scrollTop, 360);
  assert.equal(editor.style.getPropertyValue("--python-line-top"), "50px");
  editor.scrollTop = 380;
  editor.dispatchEvent(new Event("scroll"));
  assert.equal(editor.style.getPropertyValue("--python-line-top"), "30px");
  assert.equal(output.textContent, "first\n");
  assert.equal(editor.value, original);
  player.run();
  assert.equal(output.textContent, "first\nlast\n");
  assert.equal(editor.dataset.currentLine, undefined);
  player.step();
  assert.equal(editor.dataset.currentLine, "1");
  player.clear();
  assert.equal(player.loaded(), false);
  assert.equal(output.textContent, "");
  player.load({
    output: "before\n",
    error: "ValueError: deliberate",
    steps: [{ line: null, outputLength: 7 }],
  });
  assert.equal(output.textContent, "before\n\nValueError: deliberate");
  assert.equal(status.textContent, "Stopped with an error.");
});

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
    bottom: 400,
    height: 400,
  });
  const laterSection = document.createElement("section");
  laterSection.className = "prose";
  laterSection.textContent = "Later chapter section";
  laterSection.getBoundingClientRect = () => ({
    top: 400,
    bottom: 2400,
    height: 2000,
  });
  document.querySelector("article.reading").append(laterSection);
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
  assert.deepEqual(events.find(([name]) => name === "article_engagement")[1], {
    active_seconds: 30,
    depth: 25,
  });
  assert.equal(settings.before_send(null), null);
  const storageClear = new Event("storage");
  Object.assign(storageClear, {
    key: null,
    newValue: null,
    storageArea: localStorage,
  });
  window.dispatchEvent(storageClear);
  assert.equal(
    optedOut,
    1,
    "clearing storage in another tab immediately revokes consent",
  );
  assert.match(document.cookie, /Max-Age=0/);
  assert.equal(
    settings.before_send({ event: "$pageview", properties: {} }),
    null,
  );
  const count = events.length;
  click(".reading-navigation a");
  assert.equal(events.length, count);
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

test("narration player uses measured time, explicit playback, bounded seeking and hash-scoped resume", async (t) => {
  const { document, window, click } = dom(
    t,
    `<section data-narration data-hash="new-audio" data-title="Article" data-duration="45.07"><audio controls preload="none"></audio><button data-play hidden><span data-play-icon></span><span data-play-label></span></button><div data-controls hidden></div><input data-seek><select data-speed><option value="0.8">0.8</option><option value="1">1</option><option value="1.1" selected>1.1</option><option value="1.2">1.2</option><option value="1.5">1.5</option><option value="2">2</option></select><span data-native-label></span><span data-listening-duration></span><p data-error hidden></p><button data-retry></button><output data-time></output><button data-back></button><button data-forward></button></section><video></video>`,
  );
  const audio = document.querySelector("audio"),
    video = document.querySelector("video");
  let plays = 0,
    pauses = 0,
    loads = 0,
    reject = false;
  audio.currentTime = 0;
  audio.duration = 45.07;
  audio.paused = true;
  audio.play = async () => {
    plays++;
    if (reject) throw Error("Network");
    audio.paused = false;
    audio.dispatchEvent(new Event("play", { bubbles: true }));
  };
  audio.pause = () => {
    audio.paused = true;
    audio.dispatchEvent(new Event("pause"));
  };
  audio.load = () => {
    loads++;
    audio.playbackRate = audio.defaultPlaybackRate;
  };
  video.pause = () => pauses++;
  localStorage.setItem("narration:old-audio", "33");
  localStorage.setItem("narration:new-audio", "12");
  await import("../runtime/narration-player.ts");
  const button = document.querySelector("[data-play]");
  assert.equal(
    button.getAttribute("aria-label"),
    "Continue listening: Article",
  );
  assert.equal(
    button.querySelector('[data-control-icon="play"]').hasAttribute("hidden"),
    false,
  );
  assert.equal(
    button.querySelector('[data-control-icon="pause"]').hasAttribute("hidden"),
    true,
  );
  assert.equal(plays, 0);
  assert.equal(audio.playbackRate, 1.1);
  assert.equal(audio.defaultPlaybackRate, 1.1);
  assert.equal(
    document.querySelector("[data-listening-duration]").textContent,
    "0:40 listen at 1.1×",
  );
  assert.equal(audio.getAttribute("preload"), "none");
  window.dispatchEvent(new Event("pagehide"));
  assert.equal(localStorage.getItem("narration:new-audio"), "12");
  assert.equal(localStorage.getItem("narration:old-audio"), "33");
  audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(audio.currentTime, 12);
  click("[data-play]");
  await tick();
  assert.equal(plays, 1);
  assert.equal(pauses, 1);
  assert.equal(button.getAttribute("aria-label"), "Pause: Article");
  assert.equal(
    button.querySelector('[data-control-icon="play"]').hasAttribute("hidden"),
    true,
  );
  assert.equal(
    button.querySelector('[data-control-icon="pause"]').hasAttribute("hidden"),
    false,
  );
  click("[data-forward]");
  assert.equal(audio.currentTime, 27);
  click("[data-forward]");
  click("[data-forward]");
  assert.equal(audio.currentTime, 45.07);
  click("[data-back]");
  assert.equal(audio.currentTime, 30.07);
  const speed = document.querySelector("[data-speed]");
  for (const [rate, expected] of [
    [0.8, "0:56"],
    [1, "0:45"],
    [1.1, "0:40"],
    [1.2, "0:37"],
    [2, "0:22"],
    [1.5, "0:30"],
  ]) {
    speed.querySelector(`[value="${rate}"]`).selected = true;
    speed.dispatchEvent(new Event("change"));
    assert.equal(audio.playbackRate, rate);
    assert.equal(audio.defaultPlaybackRate, rate);
    assert.equal(
      document.querySelector("[data-listening-duration]").textContent,
      `${expected} listen at ${rate}×`,
    );
    assert.equal(audio.currentTime, 30.07);
  }
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(document.querySelector("[data-time]").value, "0:30 / 0:45");
  click("[data-play]");
  assert.equal(localStorage.getItem("narration:new-audio"), "30.07");
  assert.equal(button.dataset.playbackState, "paused");
  assert.equal(
    button.getAttribute("aria-label"),
    "Continue listening: Article",
  );
  reject = true;
  click("[data-play]");
  await tick();
  assert.equal(document.querySelector("[data-error]").hidden, false);
  reject = false;
  click("[data-retry]");
  await tick();
  assert.equal(loads, 1);
  assert.equal(audio.playbackRate, 1.5);
  assert.equal(document.querySelector("[data-error]").hidden, true);
  audio.ended = true;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(localStorage.getItem("narration:new-audio"), "0");
  assert.equal(button.getAttribute("aria-label"), "Listen again: Article");
  assert.equal(button.querySelectorAll("svg").length, 2);
  window.dispatchEvent(new Event("pagehide"));
  assert.equal(audio.paused, true);
});

test("audiobook player resumes locally, seeks, adjusts remaining time and keeps progress without autoplay", async (t) => {
  const map = {
    bookId: "book",
    title: "A book",
    author: "Author",
    hash: "edition",
    segments: [
      { id: "one", placement: "one", contentHash: "one", label: "First" },
      { id: "two", placement: "two", contentHash: "two", label: "Second" },
      { id: "end", placement: "$closing", contentHash: "end", label: "End" },
    ],
    audio: {
      duration: 60,
      timings: [
        { start: 0, end: 20 },
        { start: 20, end: 50 },
        { start: 50, end: 60 },
      ],
    },
  };
  const { document, window, click } = dom(
    t,
    `<section data-audiobook><script data-book-map type="application/json">${JSON.stringify(map)}</script><audio controls preload="none"></audio><button data-book-play hidden></button><input data-book-seek><select data-book-speed><option value="1.1" selected>1.1</option><option value="2">2</option></select><p data-book-notice></p><p data-book-position></p><p data-book-time></p><p data-book-error hidden></p><div data-book-controls hidden></div><button data-book-retry></button><button data-book-back></button><button data-book-forward></button><span data-book-native></span></section><video></video>`,
  );
  location.href = "https://fixture.invalid/collections/book/";
  let plays = 0,
    reject = false;
  const audio = document.querySelector("audio");
  audio.paused = true;
  audio.currentTime = 0;
  audio.duration = 60;
  audio.play = async () => {
    if (reject) throw Error("Network");
    plays++;
    audio.paused = false;
    audio.dispatchEvent(new Event("play"));
  };
  audio.pause = () => {
    audio.paused = true;
    audio.dispatchEvent(new Event("pause"));
  };
  audio.load = () => {};
  document.querySelector("video").pause = () => {};
  localStorage.setItem(
    "audiobook:v1:book",
    JSON.stringify({
      version: 1,
      edition: "older",
      segment: "two",
      placement: "two",
      contentHash: "two",
      offset: 7,
      finished: false,
      order: ["one", "two"],
    }),
  );
  await import("../runtime/audiobook-player.ts");
  const button = document.querySelector("[data-book-play]");
  assert.equal(button.getAttribute("aria-label"), "Continue listening: A book");
  assert.equal(plays, 0);
  assert.equal(audio.playbackRate, 1.1);
  assert.match(
    document.querySelector("[data-book-play]").textContent,
    /Continue/,
  );
  window.dispatchEvent(new Event("pagehide"));
  assert.equal(JSON.parse(localStorage.getItem("audiobook:v1:book")).offset, 7);
  audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(audio.currentTime, 27);
  click("[data-book-play]");
  await tick();
  assert.equal(plays, 1);
  assert.equal(button.dataset.playbackState, "playing");
  assert.equal(button.getAttribute("aria-label"), "Pause: A book");
  click("[data-book-back]");
  assert.equal(audio.currentTime, 12);
  const seek = document.querySelector("[data-book-seek]");
  seek.value = "20";
  seek.dispatchEvent(new Event("input"));
  await tick();
  assert.equal(audio.currentTime, 20);
  const speed = document.querySelector("[data-book-speed]");
  speed.querySelector('[value="2"]').selected = true;
  speed.dispatchEvent(new Event("change"));
  assert.equal(audio.playbackRate, 2);
  assert.match(
    document.querySelector("[data-book-time]").textContent,
    /0:20 remaining/,
  );
  audio.currentTime = 25;
  audio.dispatchEvent(new Event("timeupdate"));
  click("[data-book-play]");
  assert.equal(JSON.parse(localStorage.getItem("audiobook:v1:book")).offset, 5);
  assert.equal(button.getAttribute("aria-label"), "Continue listening: A book");
  reject = true;
  click("[data-book-play]");
  await tick();
  assert.equal(document.querySelector("[data-book-error]").hidden, false);
  click("[data-book-retry]");
  await tick();
  audio.dispatchEvent(new Event("error"));
  reject = false;
  audio.dispatchEvent(new Event("loadedmetadata"));
  seek.value = "20";
  seek.dispatchEvent(new Event("input"));
  assert.equal(audio.currentTime, 20);
  click("[data-book-forward]");
  assert.equal(audio.currentTime, 35);
  seek.value = "58";
  seek.dispatchEvent(new Event("input"));
  assert.equal(audio.currentTime, 58);
  audio.ended = true;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(
    JSON.parse(localStorage.getItem("audiobook:v1:book")).finished,
    true,
  );
  assert.equal(button.getAttribute("aria-label"), "Listen again: A book");
});

test("voice previews share play/pause, stop competing media, seek, retry and reveal only available recordings", async (t) => {
  const { document } = dom(
    t,
    '<audio id="sample" controls hidden aria-label="Narration preview"></audio><audio id="book" controls aria-label="Book preview"></audio>',
  );
  const { mountVoicePreview } = await import("../runtime/audio-preview.js");
  const audios = [...document.querySelectorAll("audio")];
  let reject = false,
    plays = 0;
  for (const audio of audios) {
    audio.currentTime = 0;
    audio.duration = 60;
    audio.paused = true;
    audio.ended = false;
    audio.play = async () => {
      if (reject) throw Error("Unavailable");
      plays++;
      audio.paused = false;
      audio.dispatchEvent(new Event("play", { bubbles: true }));
    };
    audio.pause = () => {
      audio.paused = true;
      audio.dispatchEvent(new Event("pause"));
    };
    audio.load = () => audio.dispatchEvent(new Event("emptied"));
  }
  const [audio, book] = audios;
  const panel = mountVoicePreview(audio),
    other = mountVoicePreview(book);
  const get = (name) => panel.querySelector(`[data-preview-${name}]`);
  assert.equal(plays, 0);
  assert.equal(panel.hidden, true);
  assert.equal(audio.controls, false);
  audio.hidden = false;
  await tick();
  assert.equal(panel.hidden, false);
  assert.equal(audio.playbackRate, 1.1);
  get("play").click();
  await tick();
  assert.equal(
    get("play").getAttribute("aria-label"),
    "Pause: Narration preview",
  );
  get("forward").click();
  assert.equal(audio.currentTime, 15);
  get("play").click();
  assert.equal(audio.currentTime, 15);
  assert.equal(
    get("play").getAttribute("aria-label"),
    "Continue listening: Narration preview",
  );
  get("speed").querySelector('[value="0.8"]').selected = true;
  get("speed").dispatchEvent(new Event("change"));
  assert.equal(audio.playbackRate, 0.8);
  get("seek").value = "90";
  get("seek").dispatchEvent(new Event("input"));
  assert.equal(audio.currentTime, 60);
  get("back").click();
  assert.equal(audio.currentTime, 45);
  get("play").click();
  await tick();
  other.querySelector("[data-preview-play]").click();
  await tick();
  assert.equal(audio.paused, true);
  assert.equal(get("play").dataset.playbackState, "paused");
  reject = true;
  get("play").click();
  await tick();
  assert.equal(get("error").hidden, false);
  reject = false;
  get("retry").click();
  await tick();
  assert.equal(get("error").hidden, true);
  assert.equal(book.paused, true);
  audio.dispatchEvent(new Event("error"));
  assert.equal(get("error").hidden, false);
  audio.currentTime = 0;
  audio.paused = true;
  audio.duration = NaN;
  audio.dispatchEvent(new Event("emptied"));
  assert.equal(get("seek").disabled, true);
  assert.equal(get("time").textContent, "0:00 / 0:00");
  audio.hidden = true;
  await tick();
  assert.equal(panel.hidden, true);
});

test("Copy code copies edited source and reports clipboard failures without changing execution", async (t) => {
  const { document, editor, click } = pythonFixture(t);
  const { bindCopyCode } = await import("../runtime/copy-code.ts");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied,
    reject = false;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (text) => {
          if (reject) throw Error("Denied");
          copied = text;
        },
      },
    },
  });
  t.after(() => Object.defineProperty(globalThis, "navigator", previous));
  bindCopyCode(document.querySelector("section"), editor);
  editor.value = 'print("edited")';
  click("[data-python-copy]");
  await tick();
  assert.equal(copied, editor.value);
  assert.equal(
    document.querySelector("[data-copy-status]").textContent,
    "Code copied.",
  );
  assert.equal(document.querySelector("iframe"), null);
  reject = true;
  click("[data-python-copy]");
  await tick();
  assert.match(
    document.querySelector("[data-copy-status]").textContent,
    /Copy unavailable/,
  );
  assert.equal(document.querySelector("[data-python-copy]").disabled, false);
  editor.dispatchEvent(new Event("input"));
  assert.equal(document.querySelector("[data-copy-status]").textContent, "");
});

test("chapter audio uses relative time, clamps playback, resumes and replays only its excerpt", async (t) => {
  const map = {
    bookId: "book",
    title: "Chapter",
    hash: "edition",
    scope: "chapter",
    offset: 100,
    listenLabel: "Listen to this chapter",
    segments: [
      {
        id: "p",
        placement: "chapter",
        contentHash: "speech",
        label: "Chapter",
      },
    ],
    audio: { duration: 20, timings: [{ start: 0, end: 20 }] },
  };
  const { document, click } = dom(
    t,
    `<section data-audiobook><script data-book-map>${JSON.stringify(map)}</script><audio></audio><button data-book-play></button><input data-book-seek><select data-book-speed><option value="1.1" selected>1.1</option></select><p data-book-notice></p><p data-book-position></p><p data-book-time></p><p data-book-error hidden></p><div data-book-controls></div><button data-book-retry></button><button data-book-back></button><button data-book-forward></button><span data-book-native></span></section>`,
  );
  location.href = "https://fixture.invalid/chapter/";
  const audio = document.querySelector("audio");
  audio.currentTime = 0;
  audio.paused = true;
  audio.play = async () => {
    audio.paused = false;
    audio.dispatchEvent(new Event("play"));
  };
  audio.pause = () => {
    audio.paused = true;
    audio.dispatchEvent(new Event("pause"));
  };
  localStorage.setItem(
    "audiobook:v1:book:chapter",
    JSON.stringify({
      version: 1,
      edition: "old",
      segment: "p",
      placement: "chapter",
      contentHash: "speech",
      offset: 5,
      finished: false,
      order: ["p"],
    }),
  );
  const { mountAudiobook } = await import("../runtime/audiobook-player.ts");
  mountAudiobook(document.querySelector("section"));
  audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(audio.currentTime, 105);
  assert.equal(audio.paused, true);
  click("[data-book-back]");
  assert.equal(audio.currentTime, 100);
  click("[data-book-play]");
  await tick();
  audio.currentTime = 120.3;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 120);
  assert.match(
    document.querySelector("[data-book-play]").textContent,
    /Listen again/,
  );
  assert.equal(
    JSON.parse(localStorage.getItem("audiobook:v1:book:chapter")).finished,
    true,
  );
  assert.equal(localStorage.getItem("audiobook:v1:book"), null);
  click("[data-book-play]");
  await tick();
  assert.equal(audio.currentTime, 100);
  assert.equal(audio.paused, false);
  const seek = document.querySelector("[data-book-seek]");
  seek.value = "999";
  seek.dispatchEvent(new Event("input"));
  assert.equal(audio.currentTime, 120);
});
