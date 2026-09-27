import test from "node:test";
import assert from "node:assert/strict";
import { parseOptions } from "../core/cli-options";

test("CLI options preserve repeated values and flags without consuming another flag", () => {
  const selected: string[] = [];
  let applied = false;
  const options = {
    values: { "--piece": (value: string) => selected.push(value) },
    flags: {
      "--apply": () => {
        applied = true;
      },
    },
    help: () => {},
  };
  assert(
    parseOptions(["--piece", "one", "--apply", "--piece", "two"], options),
  );
  assert.deepEqual(selected, ["one", "two"]);
  assert(applied);
  for (const args of [
    ["--piece"],
    ["--piece", "--apply"],
    ["--other"],
    ["toString", "x"],
    ["__proto__", "x"],
  ])
    assert.throws(
      () => parseOptions(args, options),
      /Unknown or incomplete option/,
    );
});
test("CLI help stops before later actions", () => {
  let shown = false;
  assert.equal(
    parseOptions(["--help", "--apply"], {
      values: {},
      flags: { "--apply": () => assert.fail("Help must not apply changes") },
      help: () => {
        shown = true;
      },
    }),
    false,
  );
  assert(shown);
});
