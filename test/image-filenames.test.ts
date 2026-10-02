import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Assets, hash } from "../core/assets";
import { imageFilenameStem, imageAssetStem } from "../core/image-filenames";

test("image descriptions produce bounded filesystem-safe content names", () => {
  assert.equal(
    imageFilenameStem(
      "Blue ink illustration of a wind-up beetle beside a bell",
    ),
    "wind-up-beetle-beside-bell",
  );
  assert.equal(
    imageFilenameStem("A photograph of café tables and chairs"),
    "cafe-tables-chairs",
  );
  assert.equal(
    imageFilenameStem("../../a winding key\\evil.png"),
    "winding-key-evil-png",
  );
  assert.equal(imageFilenameStem("..."), "image");
  const long = imageFilenameStem("mechanical".repeat(100));
  assert(long.length <= 80);
  assert.match(long, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(
    imageAssetStem("assets/wind-up-beetle-8d113315a70e86eafdd8.png"),
    "wind-up-beetle",
  );
});

test("published image names preserve their content label and content hash without repeating the old suffix", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "image-filenames-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("image bytes fixture");
  const file = "wind-up-beetle-8d113315a70e86eafdd8.png";
  await fs.writeFile(path.join(root, file), bytes);
  const assets = new Assets(path.join(root, "output"));
  const url = await assets.copy(root, file, true);
  assert.equal(url, `/media/wind-up-beetle-${hash(bytes)}.png`);
  assert.deepEqual(
    await fs.readFile(path.join(assets.out, path.basename(url))),
    bytes,
  );
  assert.equal(await assets.copy(root, file, true), url);
  assert.equal(await assets.copy(root, file), `/media/${hash(bytes)}.png`);
  await assert.rejects(
    assets.emit(bytes, ".png", "../escape"),
    /Invalid asset filename/,
  );
});
