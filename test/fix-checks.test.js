const { test } = require("node:test");
const assert = require("node:assert/strict");
const { compareFixChecks } = require("../authoring/fix-checks");
const report = (findings) => ({ findings, checks: [{ status: "completed" }] });
const f = {
  rule: "repetition",
  piece: "one",
  excerpt: "same phrase",
  message: "Repeated",
  line: 2,
};
test("fix checks ignore shifted lines but preserve duplicate counts", () => {
  const d = compareFixChecks(report([f, f]), report([{ ...f, line: 9 }]));
  assert.equal(d.added.length, 0);
  assert.equal(d.retained.length, 1);
  assert.equal(d.resolved.length, 1);
  assert.equal(d.incomplete, false);
});
test("fix checks expose new issues even when total count is unchanged", () => {
  const d = compareFixChecks(
    report([f]),
    report([{ ...f, rule: "spelling", excerpt: "mispelled" }]),
  );
  assert.equal(d.added.length, 1);
  assert.equal(d.resolved.length, 1);
});
test("missing or unavailable coverage never reports a complete check", () => {
  assert.equal(compareFixChecks(report([]), { findings: [] }).incomplete, true);
  assert.equal(
    compareFixChecks(
      { ...report([]), checks: [{ status: "unavailable" }] },
      report([]),
    ).incomplete,
    true,
  );
});
test("small wording edits are reported as changed rather than resolved issues", () => {
  const d = compareFixChecks(
    report([
      {
        ...f,
        excerpt: "The old record was carefully preserved by its keeper.",
      },
    ]),
    report([
      { ...f, excerpt: "The old record was safely preserved by its keeper." },
    ]),
  );
  assert.equal(d.changed.length, 1);
  assert.equal(d.resolved.length, 0);
  assert.equal(d.added.length, 0);
});
