import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { pythonTrace } from "../runtime/python-trace";
import type { PythonRecording } from "../runtime/python-trace-player";

function trace(source: string): PythonRecording {
  return JSON.parse(
    execFileSync(
      "python3",
      ["-c", `${pythonTrace}\nprint(article_trace(${JSON.stringify(source)}))`],
      { encoding: "utf8", timeout: 10000 },
    ),
  );
}

test("Python traces actual edited source, line events and progressive output", () => {
  const result = trace(
    'notches = ""\nfor i in range(3):\n    notches += "x"\n    print(notches)\nprint(len(notches))',
  );
  assert.equal(result.error, "");
  assert.equal(result.steps[0].line, 1);
  const increments = result.steps.filter((s) => s.line === 3);
  assert.equal(increments.length, 3);
  assert.equal(result.output, "x\nxx\nxxx\n3\n");
  assert.equal(result.output.slice(0, increments[1].outputLength), "x\n");
});

test("Python trace handles functions, Unicode, exceptions and fresh namespaces", () => {
  const result = trace(
    'def f(n):\n    marks = "😀" * n\n    print(marks)\n    return marks\nanswer = f(2)\nitems = [1, {"ok": True}]',
  );
  assert(result.steps.some((s) => s.line === 3));
  assert.equal(
    result.output.slice(0, result.steps.at(-1)!.outputLength),
    "😀😀\n",
  );
  assert.match(trace("print(answer)").error, /NameError/);
  const broken = trace('x = 3\nprint(x)\nraise ValueError("deliberate")');
  assert.equal(broken.output, "3\n");
  assert.match(broken.error, /ValueError: deliberate/);
  assert.match(trace("if:").error, /SyntaxError/);
});

test("Python trace bounds steps and output, even when the program catches the limit", () => {
  const loop = trace("x = 0\nwhile True:\n    x += 1");
  assert.equal(loop.steps.length, 501);
  assert.match(loop.error, /Trace limit reached/);
  assert.match(trace('print("x" * 70000)').error, /Output limit/);
  const unicode = trace('print("😀" * 40000)');
  assert.equal(unicode.output.length, 65536);
  assert.match(unicode.error, /Output limit/);
  assert.match(
    trace("try:\n    while True:\n        pass\nexcept Exception:\n    pass")
      .error,
    /Trace limit/,
  );
});
