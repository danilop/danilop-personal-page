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
  fixAgentArgs,
} from "../core/author-fixes";
import { claudeStructuredResult as claudeFixResult } from "../core/author-structured";
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
  for (const name of ["claude", "codex", "pi"])
    await fs.writeFile(path.join(bin, name), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
  process.env.PATH = bin;
  t.after(async () => {
    process.env.PATH = previous;
    await fs.rm(bin, { recursive: true, force: true });
  });
  const service = new AuthorFixes(process.cwd(), async (_command, args) => {
    await new Promise((r) => setTimeout(r, 20));
    const proposal = { summary: "Keep original", changes: [] };
    if (args.includes("--output-last-message")) {
      const schema = JSON.parse(
        await fs.readFile(args[args.indexOf("--output-schema") + 1], "utf8"),
      );
      assert.deepEqual(schema.required, ["summary", "changes"]);
      await fs.writeFile(
        args[args.indexOf("--output-last-message") + 1],
        JSON.stringify(proposal),
      );
      return { stdout: "Progress only", stderr: "" };
    }
    return {
      stdout: args.includes("--json-schema")
        ? JSON.stringify({
            type: "result",
            subtype: "success",
            is_error: false,
            result:
              JSON.stringify(proposal) +
              "\nAdditional commentary that must not be parsed.",
            structured_output: proposal,
          })
        : [
            {
              type: "message_end",
              message: {
                role: "assistant",
                stopReason: "stop",
                content: [{ type: "text", text: JSON.stringify(proposal) }],
              },
            },
            { type: "agent_settled" },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n"),
      stderr: "",
    };
  });
  const jobs = await Promise.all(
    ["claude", "codex", "pi"].map((agent) =>
      service.start({ ...request, agent }),
    ),
  );
  await new Promise((r) => setTimeout(r, 100));
  assert(jobs.every((j) => j.state === "complete"));
  service.close();
});

test("whole-article repetition review groups overlapping targets, includes distance and accepts selective edits", async () => {
  const { repetitionBatch } = await import("../lib/repetition-batch.js");
  const source =
    "---\ntitle: Test\n---\n\n## Opening\n\n😀 Given an image of a cat, consider it. Given an image of a dog, pause.\n\n## Closing\n\nGiven an image of a bird, look again.\n";
  const rows = ["Given an image of", "an image of"].map((phrase) => ({
    example: phrase,
    n: phrase.split(" ").length,
    locations: [...source.matchAll(new RegExp(phrase, "g"))].map((m) => ({
      start: m.index,
      end: m.index + phrase.length,
      text: phrase,
    })),
  }));
  const batch = repetitionBatch(source, rows);
  assert.equal(batch.targets.length, 2);
  assert.equal(batch.groups.length, 2);
  assert.equal(batch.groups[0].locations[0].section, "Opening");
  assert.equal(
    batch.groups[0].locations[1].paragraph,
    batch.groups[0].locations[0].paragraph,
  );
  assert.equal(batch.groups[0].locations[2].section, "Closing");
  assert(batch.groups[0].locations[2].wordsSincePrevious! > 0);
  assert.equal(batch.groups[0].locations[2].linesSincePrevious, 4);
  const r = fixRequest.parse({
    ...request,
    text: source,
    repetitions: rows,
    targets: batch.targets,
  });
  const prompt = fixPrompt(r);
  for (const text of [
    "Raw stem matches are candidates, not mistakes",
    "word distance",
    "technical terms",
    "callbacks",
    "Returning no changes is valid",
    "wordsSincePrevious",
    "## Closing",
    "Return ALL worthwhile edits together",
    "never a limit on the number of passages",
    "Assessments must cover EVERY supplied target exactly once",
  ])
    assert(prompt.includes(text));
  const rephrasePrompt = fixPrompt({ ...r, approach: "Rephrase" });
  assert.match(
    rephrasePrompt,
    /Rephrase sentences or restructure the supplied paragraphs/,
  );
  assert.doesNotMatch(
    rephrasePrompt,
    /Keep each edit small within its passage/,
  );
  const result = parseFix(
    JSON.stringify({
      summary: "Keep the distant echo; vary only the nearby restart.",
      assessments: [
        {
          target: 0,
          decision: "change",
          reason: "Repeated restart within a paragraph.",
        },
        {
          target: 1,
          decision: "keep",
          reason: "A distant callback in the closing section.",
        },
      ],
      changes: [
        {
          target: 0,
          before: batch.targets[0].before,
          after: batch.targets[0].before.replace(
            "Given an image of a dog",
            "For the dog image",
          ),
          reason: "Avoid restarting the same scenario within one paragraph.",
        },
      ],
    }),
    r,
  );
  assert.equal(result.changes.length, 1);
  assert.deepEqual(
    parseFix(
      JSON.stringify({
        summary: "All repetitions are useful",
        changes: [],
        assessments: batch.targets.map((_, target) => ({
          target,
          decision: "keep",
          reason: "Deliberate parallel examples.",
        })),
      }),
      r,
    ).changes,
    [],
  );
  const complete = {
    ...result,
    assessments: [
      { target: 0, decision: "change", reason: "Repeated restart." },
      { target: 1, decision: "keep", reason: "Useful callback." },
    ],
  };
  for (const assessments of [
    undefined,
    complete.assessments.slice(0, 1),
    [complete.assessments[0], complete.assessments[0]],
    [complete.assessments[0], { ...complete.assessments[1], target: 99 }],
    complete.assessments.map((a) => ({ ...a, decision: "keep" })),
    complete.assessments.map((a) => ({ ...a, decision: "change" })),
  ])
    assert.throws(() =>
      parseFix(JSON.stringify({ ...complete, assessments }), r),
    );
  const args = await fixAgentArgs(
    { ...r, agent: "claude" },
    "/tmp/batch-schema",
  );
  const schema = JSON.parse(args[args.indexOf("--json-schema") + 1]);
  assert(schema.required.includes("assessments"));
  assert.equal(schema.properties.assessments.minItems, 2);
  assert.equal(schema.properties.assessments.maxItems, 2);
  assert.throws(
    () => repetitionBatch(source.replace("cat", "kitten"), rows),
    /no longer matches/,
  );
  assert.throws(
    () => fixPrompt({ ...r, targets: [{ start: 0, end: 3, before: "---" }] }),
    /targets do not match/,
  );
  assert.throws(
    () =>
      repetitionBatch(source, [
        {
          example: "title",
          n: 1,
          locations: [{ start: 4, end: 9, text: "title" }],
        },
      ]),
    /article body/,
  );
});

test("Claude fixes request a schema and use only the successful structured result", async () => {
  const args = await fixAgentArgs(
    { ...request, agent: "claude" },
    "/tmp/result",
  );
  assert.equal(args[args.indexOf("--output-format") + 1], "json");
  assert.equal(args[args.indexOf("--tools") + 1], "");
  const schema = JSON.parse(args[args.indexOf("--json-schema") + 1]);
  assert.deepEqual(schema.required, ["summary", "changes"]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
  const proposal = { summary: "Keep original", changes: [] };
  const envelope = {
    type: "result",
    subtype: "success",
    is_error: false,
    structured_output: proposal,
  };
  const answer = claudeFixResult(
    JSON.stringify({
      ...envelope,
      result: JSON.stringify(proposal) + "\nA second message.",
    }),
  );
  assert.deepEqual(parseFix(answer, request), proposal);
  for (const invalid of [
    { ...envelope, is_error: true },
    { ...envelope, subtype: "error_max_structured_output_retries" },
    { ...envelope, structured_output: undefined },
    proposal,
  ])
    assert.throws(() => claudeFixResult(JSON.stringify(invalid)));
  assert.throws(
    () =>
      parseFix(
        claudeFixResult(
          JSON.stringify({
            ...envelope,
            structured_output: {
              ...proposal,
              changes: [
                {
                  target: 0,
                  before: "invented",
                  after: "edit",
                  reason: "test",
                },
              ],
            },
          }),
        ),
        request,
      ),
    /unverified replacement/,
  );
  assert.throws(
    () =>
      parseFix(
        JSON.stringify(proposal) + "\n" + JSON.stringify(proposal),
        request,
      ),
    /multiple JSON proposals/,
  );
  assert.deepEqual(
    parseFix("  \n```json\n" + JSON.stringify(proposal) + "\n```\n", request),
    proposal,
  );
});

test("fix validation retries once before exposing results, across all providers", async (t) => {
  const bin = await fs.mkdtemp(path.join(os.tmpdir(), "fix-retry-"));
  const previous = process.env.PATH;
  for (const agent of ["claude", "codex", "pi"])
    await fs.writeFile(path.join(bin, agent), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
  process.env.PATH = bin;
  t.after(async () => {
    process.env.PATH = previous;
    await fs.rm(bin, { recursive: true, force: true });
  });
  const source = "First paragraph.\n\nSecond paragraph.";
  const targets = [
    { start: 0, end: 16, before: "First paragraph." },
    { start: 18, end: 35, before: "Second paragraph." },
  ];
  const valid = {
    summary: "Two independently selectable edits",
    changes: targets.map((target, i) => ({
      target: i,
      before: target.before,
      after: `Revised paragraph ${i + 1}.`,
      reason: "Test edit",
    })),
  };
  const invalid = {
    ...valid,
    changes: [{ ...valid.changes[0], before: "Invented original" }],
  };
  for (const agent of ["claude", "codex", "pi"] as const) {
    await t.test(agent, async () => {
      const prompts: string[] = [],
        outputs: string[] = [];
      const service: AuthorFixes = new AuthorFixes(
        process.cwd(),
        async (_command, args, options) => {
          prompts.push(options.input);
          const result = prompts.length === 1 ? invalid : valid;
          assert.equal(
            [...service.jobs.values()][0].result,
            null,
            "Rejected output stays private while retrying",
          );
          if (agent === "codex") {
            const output = args[args.indexOf("--output-last-message") + 1];
            outputs.push(output);
            await fs.writeFile(output, JSON.stringify(result));
            return { stdout: "Progress", stderr: "" };
          }
          return {
            stdout:
              agent === "claude"
                ? JSON.stringify({
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    structured_output: result,
                  })
                : [
                    {
                      type: "message_end",
                      message: {
                        role: "assistant",
                        stopReason: "stop",
                        content: [
                          { type: "text", text: JSON.stringify(result) },
                        ],
                      },
                    },
                    { type: "agent_settled" },
                  ]
                    .map((e) => JSON.stringify(e))
                    .join("\n"),
            stderr: "",
          };
        },
      );
      t.after(() => service.close());
      const job = await service.start({
        ...request,
        text: source,
        targets,
        agent,
      });
      for (let i = 0; job.state === "running" && i < 200; i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(job.state, "complete", job.error);
      assert.equal(job.attempts, 2);
      assert.deepEqual(job.result, valid);
      assert(prompts[1].startsWith(prompts[0]));
      assert.match(prompts[1], /OUTPUT VALIDATION RETRY/);
      assert.match(prompts[1], /target 0.*before must copy/);
      if (agent === "codex") assert.notEqual(outputs[0], outputs[1]);
    });
  }
  for (const mode of [
    "invalid twice",
    "CLI failure",
    "cancel",
    "valid no changes",
  ] as const) {
    await t.test(mode, async () => {
      let calls = 0;
      const service = new AuthorFixes(
        process.cwd(),
        async (_command, _args, options) => {
          ++calls;
          if (mode === "CLI failure") throw Error("Authentication expired");
          if (mode === "cancel") service.close();
          assert.equal(options.signal.aborted, mode === "cancel");
          return {
            stdout:
              mode === "valid no changes"
                ? JSON.stringify({
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    structured_output: { summary: "Keep it", changes: [] },
                  })
                : "malformed JSON",
            stderr: "",
          };
        },
      );
      t.after(() => service.close());
      const job = await service.start({ ...request, agent: "claude" });
      for (let i = 0; job.state === "running" && i < 200; i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(calls, mode === "invalid twice" ? 2 : 1);
      assert.equal(
        job.state,
        mode === "cancel"
          ? "cancelled"
          : mode === "valid no changes"
            ? "complete"
            : "failed",
      );
      if (mode !== "valid no changes") assert.equal(job.result, null);
      if (mode === "invalid twice") assert.match(job.error, /after one retry/);
      if (mode === "CLI failure")
        assert.match(job.error, /Authentication expired/);
    });
  }
});
