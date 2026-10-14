import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { load } from "cheerio";
import { codeHash, validateCodeActivities } from "../core/code-activities";
import { parser, loadLibrary, standalone } from "../core/model";
import { renderDocument } from "../core/render";
import { renderCodeActivity } from "../renderers/code-activity";

const code =
  'notches = ""\nfor _ in range(10):\n    notches += "|"\n    print(notches)\nprint("Number of notches:", len(notches))';
const activity = {
  id: "tally",
  title: "Make a tally",
  runtime: "python" as const,
  codeSha256: codeHash(code),
};
const config = { schemaVersion: 1, activities: [activity] };
const body = `\n\n\`\`\`python\n${code}\n\`\`\`\n`;

test("activities require one exact Python source; drift, ambiguity and invalid configuration fail", () => {
  assert.deepEqual(validateCodeActivities(config, parser().parse(body)), [
    activity,
  ]);
  for (const text of [
    body.replace("range(10)", "range(7)"),
    body + body,
    body.replace("```python", "```javascript"),
  ])
    assert.throws(
      () => validateCodeActivities(config, parser().parse(text)),
      /exactly one/,
    );
  assert.throws(
    () =>
      validateCodeActivities(
        { ...config, activities: [activity, activity] },
        parser().parse(body),
      ),
    /Duplicate/,
  );
  assert.throws(() =>
    validateCodeActivities({ ...config, extra: true }, parser().parse(body)),
  );
  assert.throws(() =>
    validateCodeActivities(
      {
        ...config,
        activities: [
          {
            ...activity,
            visualisation: { module: "tally", variable: "not-valid" },
          },
        ],
      },
      parser().parse(body),
    ),
  );
});

test("interactive markup escapes source and labels; every placement has its own label", () => {
  const source = "</textarea><script>alert(1)</script>";
  const html = renderCodeActivity(
    { ...activity, title: "<img src=x onerror=alert(1)>" },
    source,
    "<pre><code>static</code></pre>",
    "chapter",
  );
  const $ = load(html);
  assert.equal($("textarea").val(), source);
  assert.equal($("textarea").length, 1);
  assert.equal($("textarea").attr("wrap"), "off");
  assert.deepEqual(
    $("button")
      .map((_, button) => $(button).text())
      .get(),
    ["Run", "Step", "Reset"],
  );
  assert.equal($("[data-python-output]").length, 1);
  assert.deepEqual(
    $("button svg")
      .map((_, svg) => $(svg).attr("data-control-icon"))
      .get(),
    ["play", "step", "reset"],
  );
  assert.equal($("button svg[aria-hidden=true][focusable=false]").length, 3);
  assert.equal($("button.icon-label-button > span").length, 3);
  assert.equal(
    $(
      "[data-python-trace], [data-python-lines], [data-python-variables], [data-python-marks]",
    ).length,
    0,
  );
  assert.equal($("script,img").length, 0);
  assert.equal($("[data-python-controls][hidden]").length, 1);
  assert.equal(
    $("[data-code-activity]").attr("aria-labelledby"),
    "chapter-activity-tally",
  );
  assert.match(
    renderCodeActivity(activity, code, "static", "elsewhere"),
    /elsewhere-activity-tally/,
  );
  assert.doesNotMatch(
    renderCodeActivity(activity, code, "static", "elsewhere"),
    /data-python-marks/,
  );
});

test("sidecar loads with library; web enhances the original fence and book output stays static", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-activity-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "pieces", "example"), { recursive: true });
  await fs.mkdir(path.join(root, "collections"));
  await fs.writeFile(
    path.join(root, "pieces/example/index.md"),
    `---\nschemaVersion: 1\nid: example\nslug: example\ntitle: Example\nsummary: Example\npublication: {surfaces: [standalone, book]}\n---${body}`,
  );
  await fs.writeFile(
    path.join(root, "pieces/example/activities.yaml"),
    JSON.stringify(config),
  );
  const lib = await loadLibrary(root),
    piece = lib.pieces.get("example")!;
  const doc = standalone(piece);
  const defaults = {
    web: { code: { plugin: "code-plain" } },
    book: { code: { plugin: "code-plain" } },
  };
  const web = await renderDocument(doc, lib, defaults);
  assert.match(web.html, /data-python-run/);
  assert.equal(load(web.html)("textarea").val(), code);
  const book = await renderDocument({ ...doc, target: "book" }, lib, defaults);
  assert.doesNotMatch(book.html, /data-code-activity|textarea/);
  assert.match(load(book.html)("code").text(), /Number of notches/);
  await fs.writeFile(
    path.join(root, "pieces/example/activities.yaml"),
    JSON.stringify({
      ...config,
      activities: [{ ...activity, codeSha256: "0".repeat(64) }],
    }),
  );
  await assert.rejects(loadLibrary(root), /exactly one/);
});
