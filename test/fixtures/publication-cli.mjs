import { mock } from "node:test";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import * as processes from "node:child_process";
const config = JSON.parse(
  fs.readFileSync(process.env.CLI_FIXTURE_CONFIG, "utf8"),
);
const calls = [];
process.on("exit", () => fs.writeFileSync(config.log, JSON.stringify(calls)));
const revision = "1".repeat(40);
mock.module("node:child_process", {
  exports: {
    ...processes,
    execFileSync(command, args) {
      calls.push({ command, args });
      if (command === "git") return args[0] === "status" ? "" : revision;
      throw Error("Unmocked executable: " + command);
    },
  },
});
const handlers = {
  DescribeKeyValueStoreCommand: () => ({ ETag: "fixture-etag" }),
  ListKeysCommand: () => ({
    Items: [{ Key: "removed", Value: "https://danilop.net/old/" }],
  }),
  UpdateKeysCommand: () => ({}),
  ListJobsCommand: () => ({
    jobSummaries: [{ commitId: revision, status: "SUCCEED" }],
  }),
  PutObjectCommand: () => ({}),
  DeleteObjectCommand: () => ({}),
  CreateInvalidationCommand: () => ({
    Invalidation: { Id: "fixture-invalidation" },
  }),
  GetObjectCommand: (command) => ({
    Body: {
      transformToString: async () =>
        JSON.stringify(
          command.input.Key.endsWith("owners.json")
            ? { removed: "retired-fixture" }
            : { before: { hello: config.articleUrl } },
        ),
    },
  }),
};
for (const [moduleName, clientName] of [
  ["s3", "S3Client"],
  ["cloudfront-keyvaluestore", "CloudFrontKeyValueStoreClient"],
  ["amplify", "AmplifyClient"],
  ["cloudfront", "CloudFrontClient"],
]) {
  const name = "@aws-sdk/client-" + moduleName;
  const sdk = await import(name);
  mock.module(name, {
    exports: {
      ...sdk,
      [clientName]: class {
        async send(command) {
          const type = command.constructor.name;
          calls.push({ type, input: command.input });
          if (!handlers[type]) throw Error("Unmocked cloud command " + type);
          return handlers[type](command);
        }
      },
    },
  });
}
let remote = {
  id: 42,
  url: "https://dev.to/fixture/article",
  title: "Fixture",
  canonical_url: config.articleUrl,
  body_markdown: "Existing",
  published: false,
  tags: [],
  user: { username: "fixture" },
};
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  calls.push({ url, method: options.method ?? "GET" });
  if (url.includes("/build.json")) return Response.json({ revision });
  if (options.method === "HEAD") return new Response("", { status: 200 });
  if (url.includes("/articles/me/all")) return Response.json([]);
  if (url === "https://dev.to/api/articles" || options.method === "PUT") {
    remote = { ...remote, ...JSON.parse(options.body).article };
    return Response.json(remote);
  }
  if (url === "https://dev.to/api/articles/42") return Response.json(remote);
  throw Error("Unmocked request " + url);
};
process.argv = [process.execPath, config.script, ...config.args];
await import(pathToFileURL(config.script).href);
