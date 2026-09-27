const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("authoring/index.html", "utf8");
const source = html.slice(
  html.indexOf("async function api("),
  html.indexOf("function error(e)"),
);
function client(responses) {
  const calls = [];
  const context = vm.createContext({
    fetch: async (...args) => {
      calls.push(args);
      return responses.shift();
    },
    DOMParser: class {
      parseFromString() {
        return { querySelector: () => ({ content: "b".repeat(64) }) };
      }
    },
  });
  vm.runInContext('let token="old"; let reconnecting=null; ' + source, context);
  return { api: context.api, calls };
}
const response = (status, text) => ({
  status,
  ok: status === 200,
  text: async () => text,
});
test("author session reconnect retries the original edit payload with the refreshed token", async () => {
  const { api, calls } = client([
    response(403, "Forbidden"),
    response(200, "<meta>"),
    response(200, '{"ok":true}'),
  ]);
  assert.equal((await api("preview", { text: "unsaved prose" })).ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[2][1].body, calls[0][1].body);
  assert.equal(calls[2][1].headers["X-Author-Token"], "b".repeat(64));
});
test("author session retries only once and explains non-JSON responses", async () => {
  const { api, calls } = client([
    response(403, "Forbidden"),
    response(200, "<meta>"),
    response(403, "Forbidden"),
  ]);
  await assert.rejects(api("files"), /unreadable response \(403\)/);
  assert.equal(calls.length, 3);
});
