import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { repositoryFixture } from "./repository-fixture";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";

const run = promisify(execFile);

test(
  "concurrent builds with shared dependencies keep separate article inventories",
  { timeout: 120000 },
  async (t) => {
    const root = process.cwd();
    const fixtures = await Promise.all([
      repositoryFixture(root),
      repositoryFixture(root),
    ]);
    for (const fixture of fixtures) t.after(() => fixture.cleanup());
    const ids = ["isolation-first", "isolation-second"];
    await Promise.all(
      fixtures.map(async (fixture, index) => {
        const id = ids[index];
        const dir = path.join(fixture.dir, "content/pieces", id);
        await fs.mkdir(dir);
        await fs.writeFile(
          path.join(dir, "index.md"),
          `---\nschemaVersion: 1\nid: ${id}\nslug: ${id}\ntitle: ${id}\nsummary: Build isolation fixture\npublication: {surfaces: [standalone]}\npublishedAt: 2026-10-02T10:00:00Z\n---\nA unique article for this build.\n`,
        );
        await fs.writeFile(
          path.join(fixture.dir, "publishing/home.yaml"),
          `schemaVersion: 1\nlead: ${id}\nrecentCount: 3\nelsewhereCount: 4\ncollections: []\n`,
        );
        const env = isolatedGitEnvironment(root);
        delete env.NOTES_AUTHORING_PREVIEW;
        delete env.AWS_BRANCH;
        delete env.CI; // Disposable local fixtures prepare new assets; they are not deployments.
        delete env.NOTES_BASE_PATH;
        await run("npm", ["run", "assets:prepare"], {
          cwd: fixture.dir,
          env,
          maxBuffer: 8 * 1024 * 1024,
        });
        await run("npm", ["run", "build"], {
          cwd: fixture.dir,
          env,
          maxBuffer: 8 * 1024 * 1024,
        });
        const home = await fs.readFile(
          path.join(fixture.dir, "dist/index.html"),
          "utf8",
        );
        assert(home.includes(`/writing/${id}/`));
        assert(!home.includes(`/writing/${ids[1 - index]}/`));
        await fs.access(
          path.join(fixture.dir, `dist/writing/${id}/index.html`),
        );
        await assert.rejects(
          fs.access(
            path.join(fixture.dir, `dist/writing/${ids[1 - index]}/index.html`),
          ),
        );
        const cache = await fs.realpath(path.join(fixture.dir, ".astro/cache"));
        assert(cache.startsWith((await fs.realpath(fixture.dir)) + path.sep));
      }),
    );
  },
);
