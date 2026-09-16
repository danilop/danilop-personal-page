import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { assignmentSchema } from "../core/distribution";

test("distribution requires an explicit reviewed copy and rejects GitHub delivery", () => {
  const rejected = (args: string[], expected: RegExp, github = false) => {
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ["--import", "tsx", "scripts/distribute.ts", "--apply", ...args],
          {
            env: { ...process.env, GITHUB_ACTIONS: String(github) },
            stdio: "pipe",
          },
        ),
      (error: any) => expected.test(String(error.stderr)),
    );
  };
  rejected([], /Manual delivery requires/);
  rejected(
    ["--piece", "hello", "--destination", "dev"],
    /Manual delivery requires/,
  );
  rejected(
    ["--piece", "hello", "--destination", "dev", "--reviewed"],
    /Third-party delivery is manual/,
    true,
  );
});

test("assignments describe publication state without automatic delivery policies", () => {
  const assignment = { piece: "hello", destination: "dev" };
  assert.equal(assignmentSchema.parse(assignment).creation, "draft");
  assert.equal(assignmentSchema.parse(assignment).updates, "review");
  assert.equal(
    assignmentSchema.parse({ ...assignment, creation: "published" }).creation,
    "published",
  );
  assert.throws(() =>
    assignmentSchema.parse({ ...assignment, creation: "automatic" }),
  );
  assert.throws(() =>
    assignmentSchema.parse({ ...assignment, updates: "automatic" }),
  );
});
