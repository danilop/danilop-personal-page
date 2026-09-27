const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("a delayed image brief preserves newer edits and recovers only against its original article", async () => {
  const source = fs.readFileSync("authoring/images.js", "utf8");
  const start = source.slice(
    source.indexOf("async function start(kind)"),
    source.indexOf('  $("suggest-brief").onclick'),
  );
  const elements = new Map();
  const buttons = [];
  const messages = [];
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", append() {} });
    return elements.get(id);
  };
  const editor = { value: "original article" };
  $("image-brief").value = "original brief";
  const context = vm.createContext({
    $,
    editor,
    file: "article.md",
    currentFile: "article.md",
    busy: false,
    flushMetadata: async () => {},
    controls() {},
    remember() {},
    note: (message) => messages.push(message),
    localStorage: { setItem() {} },
    location: { origin: "http://localhost" },
    document: {
      createElement(tag) {
        const element = { remove() {} };
        if (tag === "button") buttons.push(element);
        return element;
      },
    },
    api: async (action, payload) => {
      assert.equal(payload.text, "original article");
      editor.value = "new article edits";
      return { state: "complete", brief: "suggested brief" };
    },
  });
  vm.runInContext(start, context);
  await context.start("brief");
  assert.equal($("image-brief").value, "original brief");
  assert.equal(buttons.length, 1);
  buttons[0].onclick();
  assert.equal(messages.at(-1), "Return to the article used for this brief.");
  assert.equal($("image-brief").value, "original brief");
  editor.value = "original article";
  context.active = { brief: "a different later job" };
  buttons[0].onclick();
  assert.equal($("image-brief").value, "suggested brief");
});
