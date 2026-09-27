import test from "node:test";
import assert from "node:assert/strict";
import { pieceSchema, collectionSchema, allowed } from "../core/model";
const piece = {
  schemaVersion: 1,
  id: "example",
  title: "Example",
  summary: "Example",
  publication: { surfaces: ["collection"] },
};
const collection = {
  schemaVersion: 1,
  id: "example-book",
  slug: "example-book",
  title: "Example",
  summary: "Example",
  body: [],
};
test("draft flag controls publication and removal or false enables publication", () => {
  for (const [schema, base] of [
    [pieceSchema, piece],
    [collectionSchema, collection],
  ] as const) {
    assert.equal(schema.parse({ ...base, draft: true }).status, "draft");
    assert.equal(schema.parse({ ...base, draft: false }).status, "published");
    assert.equal(schema.parse(base).status, "published");
    assert.equal(
      schema.parse({ ...base, status: "retired" }).status,
      "retired",
    );
    assert.equal(schema.parse({ ...base, status: "draft" }).status, "draft");
    assert.throws(
      () => schema.parse({ ...base, status: "published", draft: true }),
      /not both/,
    );
    assert.throws(() => schema.parse({ ...base, draft: "false" }));
  }
});
test("draft omission retains standalone date and slug requirements", () => {
  const standalone = { ...piece, publication: { surfaces: ["standalone"] } };
  assert.doesNotThrow(() => pieceSchema.parse({ ...standalone, draft: true }));
  assert.throws(() => pieceSchema.parse(standalone), /slug and publishedAt/);
  const parsed = pieceSchema.parse({
    ...standalone,
    slug: "example",
    publishedAt: "2026-09-20",
  });
  assert.equal(parsed.status, "published");
  assert.equal(
    allowed(
      {
        ...parsed,
        body: "",
        ast: { type: "root", children: [] },
        dir: ".",
        blocks: {},
      },
      "standalone",
    ),
    true,
  );
});
