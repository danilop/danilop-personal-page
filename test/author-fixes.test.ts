import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fixRequest,
  fixPrompt,
  parseFix,
  validateTargets,
  AuthorFixes,
} from "../core/author-fixes";
const text = "😀 One phrase. One phrase.";
const request = fixRequest.parse({
  file: "content/pieces/hello-brave-new-world/index.md",
  text,
  agent: "codex",
  issue: "repetition",
  instructions: "Keep voice",
  approach: "Minimal edit",
  context: "paragraphs",
  targets: [{ start: 15, end: 25, before: "One phrase" }],
});
test("fix requests anchor exact Unicode-safe targets and reject overlaps", () => {
  validateTargets(text, request.targets);
  assert.throws(() =>
    validateTargets(text, [{ start: 0, end: 5, before: "wrong" }]),
  );
  assert.throws(
    () => validateTargets(text, [...request.targets, ...request.targets]),
    /overlap/,
  );
  assert(fixPrompt(request).includes("Keep voice"));
});
test("fix results reject invented or duplicate replacements and allow advice", () => {
  const change = {
    target: 0,
    before: "One phrase",
    after: "Another phrase",
    reason: "Vary opening",
  };
  assert.equal(
    parseFix(
      JSON.stringify({ summary: "Small edit", changes: [change] }),
      request,
    ).changes.length,
    1,
  );
  assert.throws(() =>
    parseFix(
      JSON.stringify({
        summary: "Edit",
        changes: [{ ...change, before: "not the source" }],
      }),
      request,
    ),
  );
  assert.throws(() =>
    parseFix(
      JSON.stringify({ summary: "Edit", changes: [change, change] }),
      request,
    ),
  );
  assert.equal(
    parseFix('{"summary":"Keep the original","changes":[]}', request).changes
      .length,
    0,
  );
});
test("drafting carries editorial advice and the author answer, and blocks unanswered questions", () => {
  const advice = "Explain the connection rather than merely naming the topic.";
  const question = "Which connection did you intend?";
  for (const answer of ["", "   "])
    assert.throws(
      () =>
        fixRequest.parse({ ...request, suggestion: advice, question, answer }),
      /Answer the editorial question/,
    );
  const clarified = fixRequest.parse({
    ...request,
    suggestion: advice,
    question,
    answer: "The index connects the same topic across periods.",
  });
  const prompt = fixPrompt(clarified);
  for (const content of [advice, question, clarified.answer])
    assert(prompt.includes(content));
  assert.deepEqual(
    parseFix(
      JSON.stringify({
        summary: "Need the named topic as well. Which one?",
        changes: [],
      }),
      clarified,
    ).changes,
    [],
  );
});
test("multiple installed agents can work independently without editing files", async (t) => {
  const bin = await fs.mkdtemp(path.join(os.tmpdir(), "fix-agents-"));
  const previous = process.env.PATH;
  for (const name of ["claude", "pi"])
    await fs.writeFile(path.join(bin, name), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
  process.env.PATH = bin;
  t.after(async () => {
    process.env.PATH = previous;
    await fs.rm(bin, { recursive: true, force: true });
  });
  const service = new AuthorFixes(process.cwd(), async () => {
    await new Promise((r) => setTimeout(r, 20));
    return { stdout: '{"summary":"Keep original","changes":[]}', stderr: "" };
  });
  const jobs = await Promise.all(
    ["claude", "pi"].map((agent) => service.start({ ...request, agent })),
  );
  await new Promise((r) => setTimeout(r, 100));
  assert(jobs.every((j) => j.state === "complete"));
  service.close();
});
