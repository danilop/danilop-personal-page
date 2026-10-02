import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { agentArgs } from "../core/author-review";
import {
  structuredArgs,
  structuredAnswer,
  piFinalAnswer,
  parseStructuredJSON,
  claudeStructuredResult,
} from "../core/author-structured";

const eventStream = (...events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\r\n");
const message = (text: string, stopReason = "stop") => ({
  type: "message_end",
  message: {
    role: "assistant",
    stopReason,
    content: [
      { type: "thinking", text: "Not the answer" },
      { type: "text", text },
    ],
  },
});
const settled = { type: "agent_settled" };

test("structured args preserve isolation and model choice, with private Codex schema files", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "structured-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const output = path.join(dir, "answer.txt");
  const schema = z.object({
    summary: z.string(),
    findings: z.array(z.object({ question: z.string().nullable().optional() })),
  });
  for (const agent of ["claude", "codex", "pi"] as const) {
    const base = agentArgs(agent, output, "chosen-model");
    const copy = [...base];
    const args = await structuredArgs(agent, base, schema, output);
    assert.deepEqual(base, copy);
    assert.equal(args[args.indexOf("--model") + 1], "chosen-model");
    if (agent === "codex") {
      assert.equal(args.at(-1), "-");
      assert(args.includes("read-only"));
      const file = args[args.indexOf("--output-schema") + 1];
      assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
      const wire = JSON.parse(await fs.readFile(file, "utf8"));
      assert.equal(wire.additionalProperties, false);
      assert.deepEqual(wire.properties.findings.items.required, ["question"]);
      assert.equal(wire.properties.findings.items.additionalProperties, false);
      assert(wire.properties.findings.items.properties.question.anyOf);
      await fs.writeFile(output, '{"summary":"Final","findings":[]}');
      assert.equal(
        await structuredAnswer(agent, "progress messages", output),
        '{"summary":"Final","findings":[]}',
      );
    } else if (agent === "claude") {
      assert.equal(args[args.indexOf("--output-format") + 1], "json");
      assert.equal(args[args.indexOf("--tools") + 1], "");
      const wire = JSON.parse(args[args.indexOf("--json-schema") + 1]);
      assert.equal(wire.$schema, "http://json-schema.org/draft-07/schema#");
    } else {
      assert.equal(args[args.indexOf("--mode") + 1], "json");
      assert(args.includes("--no-tools"));
    }
  }
});

test("Pi uses the final completed answer, ignoring thinking, progress and retried answers", () => {
  const answer = '{"summary":"Unicode 😀\u2028separator","changes":[]}';
  const stream = eventStream(
    { type: "session" },
    message("Earlier answer", "error"),
    { type: "agent_end", willRetry: true },
    { type: "agent_start" },
    { type: "message_update", text: "partial JSON" },
    message(answer),
    { type: "agent_end", willRetry: false },
    settled,
  );
  assert.equal(piFinalAnswer(stream), answer);
  assert.equal(
    (parseStructuredJSON(piFinalAnswer(stream)) as { summary: string }).summary,
    "Unicode 😀\u2028separator",
  );
});

test("Pi rejects incomplete, failed, empty and malformed responses", () => {
  for (const stream of [
    eventStream(message("{}")),
    eventStream(message("{}", "length"), settled),
    eventStream(message("{}", "error"), settled),
    eventStream(message("{}", "aborted"), settled),
    eventStream(message("{}", "toolUse"), settled),
    eventStream(message(""), settled),
    eventStream(message("{}"), settled, { type: "message_start" }),
    eventStream(message("{}"), { type: "agent_end", willRetry: true }, settled),
    eventStream(message("{}"), settled, { type: "error" }),
    eventStream(message("{}"), settled) + '\n{"unfinished":',
  ])
    assert.throws(() => piFinalAnswer(stream));
});

test("Claude rejects malformed or unsuccessful envelopes and ignores unstructured commentary", async () => {
  const result = { summary: "Okay", changes: [] };
  const envelope = {
    type: "result",
    subtype: "success",
    is_error: false,
    structured_output: result,
    result: "{}\nExtra commentary",
  };
  assert.deepEqual(
    parseStructuredJSON(
      await structuredAnswer("claude", JSON.stringify(envelope), "unused"),
    ),
    result,
  );
  for (const raw of [
    "not JSON",
    "{}",
    JSON.stringify({ ...envelope, is_error: true }),
    JSON.stringify({ ...envelope, structured_output: undefined }),
  ])
    assert.throws(() => claudeStructuredResult(raw));
});

test("a final answer still needs one valid JSON value", () => {
  assert.deepEqual(
    parseStructuredJSON(
      '  ```json\n{"summary":"braces { } and quote \\""}\n```  ',
    ),
    { summary: 'braces { } and quote "' },
  );
  for (const text of [
    "{}\n{}",
    "{}\ncommentary",
    '{"incomplete":',
    "```json\n{}\n```\n{}",
  ])
    assert.throws(() => parseStructuredJSON(text));
});
