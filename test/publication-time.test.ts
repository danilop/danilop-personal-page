import test from "node:test";
import assert from "node:assert/strict";
import {
  validPublicationDate,
  publicationOrder,
} from "../core/publication-time.mjs";
import { stampPublication } from "../core/author-publication";
import YAML from "yaml";
import matter from "gray-matter";
const source = (metadata: string) =>
  `---\nid: example\n${metadata}\n---\nBody stays unchanged.\n`;
const data = (text: string) =>
  matter(text, { engines: { yaml: (s) => YAML.parse(s) } }).data;
const instant = "2026-10-01T12:02:00.000Z";

test("publication ordering compares instants, minutes and stable ties", () => {
  assert.deepEqual(
    [
      { id: "earlier", publishedAt: "2026-10-01T12:01:00Z" },
      { id: "a", publishedAt: "2026-10-01T13:02:00+01:00" },
      { id: "z", publishedAt: instant },
      { id: "legacy", publishedAt: "2026-09-15" },
    ]
      .sort(publicationOrder)
      .map((x) => x.id),
    ["a", "z", "earlier", "legacy"],
  );
});

test("publication dates accept legacy dates and timezone-qualified instants", () => {
  for (const date of ["2026-09-15", instant, "2026-10-01T13:02:00+01:00"])
    assert(validPublicationDate(date));
  for (const date of [
    "2026-02-30",
    "2026-10-01T25:00:00Z",
    "2026-10-01T12:00:00",
    "tomorrow",
  ])
    assert(!validPublicationDate(date));
});

test("local first publication stamps once for both draft syntaxes and all surfaces", () => {
  for (const draft of ["draft: true", "status: draft"]) {
    const previous = source(draft);
    for (const enabled of ["draft: false", "status: published", ""]) {
      const next = stampPublication(previous, source(enabled), () => instant);
      assert.equal(data(next).publishedAt, instant);
      assert(next.endsWith("---\nBody stays unchanged.\n"));
      assert.equal(
        stampPublication(next, next, () => "2026-10-02T00:00:00Z"),
        next,
      );
    }
  }
});

test("draft saves do not stamp and first publication replaces an unsaved provisional date", () => {
  const draft = source("draft: true");
  assert.equal(
    stampPublication(draft, draft, () => {
      throw Error("No clock needed");
    }),
    draft,
  );
  const next = stampPublication(
    draft,
    source("draft: false\npublishedAt: 2000-01-01"),
    () => instant,
  );
  assert.equal(data(next).publishedAt, instant);
});

test("edits, unpublishing, restoring old content and republishing retain publication time", () => {
  const published = source(`publishedAt: ${instant}`);
  const unpublished = stampPublication(published, source("draft: true"));
  assert.equal(data(unpublished).publishedAt, instant);
  const republished = stampPublication(unpublished, source("draft: false"));
  assert.equal(data(republished).publishedAt, instant);
  assert.equal(
    data(stampPublication(published, source("publishedAt: 2030-01-01")))
      .publishedAt,
    instant,
  );
});
