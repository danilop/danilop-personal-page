import { repositoryFixture } from "./repository-fixture";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isolatedGitEnvironment } from "../tools/code-analysis/snapshot.mjs";
const exec = promisify(execFile),
  root = process.cwd();
test(
  "publication CLIs verify deployment before aliases and preserve reviewed delivery controls with mocked services",
  { timeout: 90000 },
  async (t) => {
    const fixture = await repositoryFixture(root);

    t.after(() => fixture.cleanup());
    const configFile = path.join(fixture.dir, "fixture-config.json"),
      log = path.join(fixture.dir, "fixture-calls.json");
    const site = await import("../core/config");
    const siteConfig = await site.siteConfig();
    const { loadLibrary, articleUrl } = await import("../core/model");
    const lib = await loadLibrary();
    const article =
      siteConfig.url + articleUrl(lib.pieces.get("hello-brave-new-world")!);
    await fs.writeFile(
      path.join(fixture.dir, "publishing/infrastructure.json"),
      JSON.stringify({
        bucket: "fixture-bucket",
        schemaVersion: 2,
        resolver: "s3-oac",
        distributionId: "fixture-distribution",
        shortOrigin: "https://short.example.com",
        canonicalOrigin: siteConfig.url,
        amplifyAppId: "fixture-app",
      }),
    );
    await fs.writeFile(
      path.join(fixture.dir, "publishing/links.yaml"),
      "schemaVersion: 1\nlinks:\n  hello: {ref: hello-brave-new-world}\nremoved: {removed: retired-fixture}\n",
    );
    const env: NodeJS.ProcessEnv = {
      ...isolatedGitEnvironment(root),
      CLI_FIXTURE_CONFIG: configFile,
      GITHUB_SHA: "1".repeat(40),
      DEV_API_KEY: "fixture",
      NOTES_LINKS_CONFIG: path.join(
        fixture.dir,
        "publishing/infrastructure.json",
      ),
    };
    delete env.GITHUB_ACTIONS;
    delete env.PUBLICATION_BUCKET;
    const run = async (script: string, args: string[]) => {
      await fs.writeFile(
        configFile,
        JSON.stringify({
          script: path.join(root, script),
          args,
          log,
          articleUrl: article,
        }),
      );
      const result = await exec(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--import",
          "tsx",
          path.join(root, "test/fixtures/publication-cli.mjs"),
        ],
        { cwd: fixture.dir, env, timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
      );
      return {
        output: result.stdout,
        calls: JSON.parse(await fs.readFile(log, "utf8")) as {
          type?: string;
          url?: string;
          input?: Record<string, unknown>;
          command?: string;
          args?: string[];
        }[],
      };
    };
    const published = await run("scripts/publish-links.ts", [
      "--apply",
      "--wait",
    ]);
    assert.match(published.output, /Published 1 alias changes and 1 removals/);
    const updates = published.calls.filter(
      (c) =>
        c.type === "PutObjectCommand" &&
        String(c.input?.Key).startsWith("redirects/"),
    );
    assert.equal(updates.length, 2);
    assert.equal(published.calls.at(-1)!.type, "DeleteObjectCommand");
    assert(
      published.calls.findIndex((c) => c.url?.includes("/build.json")) <
        published.calls.findIndex(
          (c) =>
            c.type === "PutObjectCommand" &&
            String(c.input?.Key).startsWith("redirects/"),
        ),
    );
    const mediaConfig = path.join(fixture.dir, "media-fixture.json");
    await fs.writeFile(
      mediaConfig,
      JSON.stringify({
        bucket: "fixture-bucket",
        region: "eu-west-1",
        accountId: "123456789012",
        distributionId: "fixture-distribution",
      }),
    );
    Object.assign(env, { NOTES_MEDIA_CONFIG: mediaConfig });
    const image = path.join(fixture.dir, "pixel.png");
    await sharp({
      create: { width: 2, height: 2, channels: 3, background: "white" },
    })
      .png()
      .toFile(image);
    const upload = await run("scripts/media.ts", [
      "upload",
      image,
      "--key",
      "images/pixel.png",
      "--alt",
      "Fixture pixel",
      "--replace",
      "--apply",
    ]);
    assert.equal(
      JSON.parse(upload.output).invalidation,
      "fixture-invalidation",
    );
    assert(upload.calls.some((c) => c.type === "PutObjectCommand"));
    const invalidated = await run("scripts/media.ts", [
      "invalidate",
      "images/pixel.png",
      "--apply",
    ]);
    assert.equal(
      JSON.parse(invalidated.output).invalidation,
      "fixture-invalidation",
    );
    await fs.writeFile(
      path.join(fixture.dir, "publishing/destinations.yaml"),
      "schemaVersion: 1\ndestinations:\n  dev: {plugin: dev, account: fixture, credentialEnv: DEV_API_KEY}\n  medium: {plugin: medium-assisted, account: fixture}\n",
    );
    await fs.writeFile(
      path.join(fixture.dir, "publishing/distribution.yaml"),
      "schemaVersion: 1\nassignments:\n  - {piece: hello-brave-new-world, destination: dev}\n  - {piece: hello-brave-new-world, destination: medium}\n",
    );
    const dry = await run("scripts/distribute.ts", []);
    assert.match(dry.output, /preview ready/);
    assert.equal(dry.calls.filter((c) => c.url).length, 0);
    const delivered = await run("scripts/distribute.ts", [
      "--apply",
      "--reviewed",
      "--piece",
      "hello-brave-new-world",
      "--destination",
      "dev",
    ]);
    assert.match(delivered.output, /current/);
    assert(
      delivered.calls.some((c) => c.url === "https://dev.to/api/articles"),
    );
    const adopted = await run("scripts/distribute.ts", [
      "--apply",
      "--reviewed",
      "--piece",
      "hello-brave-new-world",
      "--destination",
      "dev",
      "--adopt",
      "42",
    ]);
    assert.match(adopted.output, /mapped existing ID 42/);
    const manual = await run("scripts/distribute.ts", [
      "--apply",
      "--reviewed",
      "--piece",
      "hello-brave-new-world",
      "--destination",
      "medium",
      "--complete-manual",
      "https://medium.com/@fixture/article",
    ]);
    assert.match(manual.output, /author-confirmed/);
  },
);
