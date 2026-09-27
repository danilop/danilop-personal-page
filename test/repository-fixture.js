const fs = require("node:fs");
const path = require("node:path");
async function repositoryFixture(root) {
  const { createSnapshot, attachRepository } =
    await import("../tools/code-analysis/snapshot.mjs");
  const fixture = createSnapshot(root, { worktree: true });
  try {
    attachRepository(root, fixture.dir);
    for (const folder of [
      "node_modules",
      "prototypes/ink-and-paper/node_modules",
    ])
      fs.symlinkSync(
        path.join(root, folder),
        path.join(fixture.dir, folder),
        "dir",
      );
    return fixture;
  } catch (error) {
    fixture.cleanup();
    throw error;
  }
}
module.exports = { repositoryFixture };
