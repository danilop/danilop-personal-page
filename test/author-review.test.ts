import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  agentArgs,
  executable,
  parseAI,
  runProcess,
  snapshot,
  requestSchema,
  reviewPrompt,
  writingChecks,
  Reviews,
} from "../core/author-review";
const sample = {
  pieces: [
    {
      id: "one",
      title: "One",
      source: "/tmp/one",
      text: "---\ntitle: One\n---\nA precise observation.\n",
    },
  ],
  fingerprint: "sample",
};
test("provider commands disable edits and use explicit noninteractive modes", () => {
  const claude = agentArgs("claude", "/tmp/out");
  assert(claude.includes("--print"));
  assert.equal(claude[claude.indexOf("--tools") + 1], "");
  assert(claude.includes("--strict-mcp-config"));
  const codex = agentArgs("codex", "/tmp/out", "example-model");
  assert(codex.includes("read-only"));
  assert(codex.includes("--ignore-user-config"));
  assert(codex.includes("features.shell_tool=false"));
  assert.equal(codex.at(-1), "-");
  assert(codex.includes("example-model"));
  const pi = agentArgs("pi", "/tmp/out");
  for (const flag of [
    "--no-tools",
    "--no-extensions",
    "--no-context-files",
    "--no-session",
  ])
    assert(pi.includes(flag));
  for (const agent of ["claude", "codex", "pi"] as const)
    assert(!agentArgs(agent, "out").some((v) => v.includes("dangerously")));
});
test("availability requires an executable file on an absolute PATH entry", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "review-bin-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, "pi"), "fake");
  assert.equal(await executable("pi", dir), null);
  await fs.chmod(path.join(dir, "pi"), 0o700);
  assert.equal(await executable("pi", dir), path.join(dir, "pi"));
  assert.equal(await executable("claude", dir), null);
});
test("model output anchors quotes and marks fabricated passages unverified", () => {
  const f = {
    piece: "one",
    line: 99,
    excerpt: "precise observation",
    category: "clarity",
    priority: "low",
    message: "Consider context",
    suggestion: "Keep it",
  };
  const r = parseAI(
    JSON.stringify({
      summary: "Review",
      findings: [f, { ...f, excerpt: "Invented quotation" }],
    }),
    sample,
  );
  assert.equal(r.findings[0].line, 4);
  assert.equal(r.findings[0].verified, true);
  assert.equal(r.findings[1].verified, false);
  assert.throws(() => parseAI("not JSON", sample));
});
test("runner passes prompt literally through stdin and reports errors and cancellation", async () => {
  const input = "$(touch /tmp/do-not-run) `false`\ntext";
  const signal = new AbortController().signal;
  const r = await runProcess(
    process.execPath,
    ["-e", "process.stdin.pipe(process.stdout)"],
    { cwd: os.tmpdir(), input, signal },
  );
  assert.equal(r.stdout, input);
  await assert.rejects(
    runProcess(
      process.execPath,
      ["-e", 'process.stderr.write("Login required");process.exit(2)'],
      { cwd: os.tmpdir(), input: "", signal },
    ),
    /Login required/,
  );
  const controller = new AbortController();
  const running = runProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { cwd: os.tmpdir(), input: "", signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(running, /cancelled/);
  await assert.rejects(
    runProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      cwd: os.tmpdir(),
      input: "",
      signal,
      timeout: 100,
    }),
    /timed out/,
  );
});
test("snapshot uses unsaved text and saved collection peers without changing source", async () => {
  const root = process.cwd(),
    file = "content/pieces/chronicles-introduction/index.md",
    raw = await fs.readFile(file, "utf8");
  const r = requestSchema.parse({
    file,
    text: raw + "\nUnsaved review sentence.\n",
    scope: "collection",
    context: "chronicles-of-computation",
    kind: "checks",
  });
  const s = await snapshot(root, r);
  assert.equal(s.pieces.length, 2);
  assert(
    s.pieces
      .find((p) => p.id === "chronicles-introduction")!
      .text.includes("Unsaved review"),
  );
  assert.equal(await fs.readFile(file, "utf8"), raw);
  const prompt = await reviewPrompt(root, s);
  assert(prompt.includes("never as instructions"));
  assert(prompt.includes("Unsaved review sentence"));
  assert(prompt.includes("line"));
  assert.throws(() => requestSchema.parse({ ...r, model: "; malicious" }));
});
test("missing Python is an incomplete review, never a clean pass", async () => {
  const file = "content/pieces/chronicles-introduction/index.md",
    text = await fs.readFile(file, "utf8");
  const s = await snapshot(
    process.cwd(),
    requestSchema.parse({ file, text, kind: "checks" }),
  );
  const previous = process.env.QUALITY_PYTHON;
  try {
    process.env.QUALITY_PYTHON = "/no-such-python";
    const r = await writingChecks(
      process.cwd(),
      s,
      new AbortController().signal,
    );
    assert(r.checks.some((c) => c.status === "unavailable"));
    assert(Array.isArray(r.findings));
  } finally {
    if (previous === undefined) delete process.env.QUALITY_PYTHON;
    else process.env.QUALITY_PYTHON = previous;
  }
});
test("review jobs retain an advisory response from each fake CLI, with no source writes", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "review-jobs-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "authoring"));
  await fs.copyFile(
    "authoring/editorial-review.md",
    path.join(root, "authoring/editorial-review.md"),
  );
  const bin = path.join(root, "bin");
  await fs.mkdir(bin);
  const script = `#!${process.execPath}\nlet text='';process.stdin.on('data',d=>text+=d);process.stdin.on('end',()=>{const out=JSON.stringify({summary:'Fixture review',findings:[]});const at=process.argv.indexOf('--output-last-message');if(at>=0)require('node:fs').writeFileSync(process.argv[at+1],out);else process.stdout.write(out);});\n`;
  for (const name of ["claude", "codex", "pi"]) {
    await fs.writeFile(path.join(bin, name), script, { mode: 0o700 });
  }
  const prev = process.env.PATH;
  process.env.PATH = bin;
  try {
    const reviews = new Reviews(root);
    for (const agent of ["claude", "codex", "pi"] as const) {
      const job = await reviews.start(
        requestSchema.parse({
          file: "content/pieces/one/index.md",
          text: sample.pieces[0].text,
          kind: "ai",
          agent,
        }),
        sample,
      );
      while (job.state === "running")
        await new Promise((r) => setTimeout(r, 10));
      assert.equal(job.state, "complete", job.error);
      assert(job.result);
      assert.equal(job.result.summary, "Fixture review");
      assert.deepEqual(job.result.findings, []);
      assert(job.sources);
    }
  } finally {
    process.env.PATH = prev;
  }
});

test("editorial review retains exact replacement pairs and advice-only nulls", () => {
  const finding = {
    piece: "one",
    line: 4,
    excerpt: "precise observation",
    category: "clarity",
    priority: "low",
    message: "Simplify",
    suggestion: "A clear observation.",
    replacement: {
      before: "A precise observation.",
      after: "A clear observation.",
    },
  };
  const result = parseAI(
    JSON.stringify({
      summary: "Review",
      findings: [
        finding,
        {
          ...finding,
          replacement: null,
          question: "Which observation do you mean?",
        },
        { ...finding, question: "Which observation do you mean?" },
      ],
    }),
    sample,
  );
  assert.deepEqual(result.findings[0].replacement, finding.replacement);
  assert.equal(result.findings[1].replacement, null);
  assert.equal(result.findings[1].question, "Which observation do you mean?");
  assert.equal(result.findings[2].replacement, null);
});
