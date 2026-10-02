import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { repositoryFixture } from "./repository-fixture";
import { AuthorLinks } from "../core/author-links";
import { suggestShortCode } from "../core/short-code";

test("short codes favour distinctive title words in order and avoid every owned or reserved code", () => {
  const title = "Clever Enough to Find the Loophole";
  assert.equal(suggestShortCode(title, "id", [title], []), "clever-loophole");
  assert.equal(
    suggestShortCode(
      "Understanding Agents, Rewards and Loopholes",
      "id",
      ["Understanding Agents", "Understanding Rewards", "Understanding Agents"],
      [],
    ),
    "rewards-loopholes",
  );
  assert.equal(
    suggestShortCode(title, "id", [], ["clever-loophole", "clever-loophole-2"]),
    "clever-loophole-3",
  );
  assert.equal(
    suggestShortCode("Introduction", "book-introduction", [], []),
    "book-introduction",
  );
  assert.equal(suggestShortCode("索引", "index", [], []), "index-2");
  assert.equal(suggestShortCode("Caffè e città", "id", [], []), "caffe-citta");
  const long = suggestShortCode("x".repeat(100), "id", [], ["x".repeat(48)]);
  assert.match(long, /^[a-z0-9][a-z0-9-]{0,63}$/);
  assert.equal(long, "x".repeat(48) + "-2");
});

test("editor reservations use saved revisions, retain tombstones and block premature live publication", async (t) => {
  const fixture = await repositoryFixture(process.cwd());
  t.after(() => fixture.cleanup());
  const original = process.env.NOTES_LINKS_CONFIG;
  process.env.NOTES_LINKS_CONFIG = path.join(
    fixture.dir,
    "not-configured.json",
  );
  t.after(() => {
    if (original === undefined) delete process.env.NOTES_LINKS_CONFIG;
    else process.env.NOTES_LINKS_CONFIG = original;
  });
  const links = new AuthorLinks(await fs.realpath(fixture.dir));
  const file = "content/pieces/hello-brave-new-world/index.md";
  const before = await links.list(file);
  assert(before.suggestedCode);
  const sourceBefore = await fs.readFile(path.join(fixture.dir, file), "utf8");
  const registryBefore = await fs.readFile(
    path.join(fixture.dir, "publishing/links.yaml"),
    "utf8",
  );
  assert.equal((await links.list(file)).suggestedCode, before.suggestedCode);
  assert.equal(
    await fs.readFile(path.join(fixture.dir, file), "utf8"),
    sourceBefore,
  );
  assert.equal(
    await fs.readFile(path.join(fixture.dir, "publishing/links.yaml"), "utf8"),
    registryBefore,
  );
  assert.equal(before.configured, false);
  const request = {
    file,
    code: "test-reservation",
    revision: before.sourceRevision,
    registryRevision: before.registryRevision,
  };
  const reserved = await links.reserve(request);
  assert(
    reserved.links.some((link) => link.code === request.code && link.target),
  );
  await assert.rejects(
    links.reserve({ ...request, code: "stale-code" }),
    /changed/,
  );
  await assert.rejects(
    links.reserve({ ...request, registryRevision: reserved.registryRevision }),
    /reserved/,
  );
  await assert.rejects(
    links.reserve({
      ...request,
      code: "index",
      registryRevision: reserved.registryRevision,
    }),
    /Reserved alias/,
  );
  const disabled = await links.deactivate({
    ...request,
    registryRevision: reserved.registryRevision,
  });
  assert.notEqual(disabled.suggestedCode, request.code);
  assert(!disabled.links.some((link) => link.code === request.code));
  const manifest = YAML.parse(
    await fs.readFile(path.join(fixture.dir, "publishing/links.yaml"), "utf8"),
  );
  assert.equal(manifest.removed[request.code], "hello-brave-new-world");
  await assert.rejects(
    links.reserve({ ...request, registryRevision: disabled.registryRevision }),
    /reserved/,
  );
  const draftFile = "content/pieces/link-draft/index.md";
  await fs.mkdir(path.join(fixture.dir, "content/pieces/link-draft"));
  await fs.writeFile(
    path.join(fixture.dir, draftFile),
    "---\nschemaVersion: 1\nid: link-draft\ntitle: Draft\nsummary: Draft fixture\ndraft: true\npublication: {surfaces: [standalone]}\n---\nDraft body.\n",
  );
  const draft = await links.list(draftFile);
  const draftReservation = await links.reserve({
    file: draftFile,
    code: "draft-link",
    revision: draft.sourceRevision,
    registryRevision: draft.registryRevision,
  });
  assert.equal(draftReservation.links[0].target, null);
  await fs.writeFile(
    process.env.NOTES_LINKS_CONFIG,
    JSON.stringify({
      schemaVersion: 2,
      resolver: "s3-oac",
      bucket: "fixture",
      distributionId: "fixture",
      shortOrigin: "https://short.example.com",
      canonicalOrigin: "https://www.danilop.net",
      region: "eu-west-1",
    }),
  );
  const fresh = await links.list(file);
  await assert.rejects(
    links.publish({
      file,
      revision: fresh.sourceRevision,
      registryRevision: fresh.registryRevision,
    }),
    /Commit and deploy/,
  );
});
