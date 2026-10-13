import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkAwsCli, runAwsCli, AwsCliError } from "../core/aws-cli";
import { s3Fixture } from "./helpers/s3-fixture";

test(
  "real AWS CLI: upload, multipart create-only, repeat transfer, output formats and failure codes",
  {
    skip: process.env.NOTES_TEST_AWS_CLI !== "1",
    timeout: 60000,
  },
  async (t) => {
    await checkAwsCli();
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "aws-cli-contract-"),
    );
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const server = await s3Fixture();
    t.after(() => server.close());
    const config = path.join(directory, "config");
    await fs.writeFile(
      config,
      "[default]\ns3 =\n    preferred_transfer_client = classic\n    addressing_style = path\n",
    );
    const env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: "fixture",
      AWS_SECRET_ACCESS_KEY: "fixture",
      AWS_SESSION_TOKEN: undefined,
      AWS_PROFILE: undefined,
      AWS_DEFAULT_PROFILE: undefined,
      AWS_CONFIG_FILE: config,
      AWS_SHARED_CREDENTIALS_FILE: path.join(directory, "no-credentials"),
      AWS_EC2_METADATA_DISABLED: "true",
      AWS_MAX_ATTEMPTS: "1",
    };
    const source = path.join(directory, "source");
    await fs.mkdir(source);
    const small = Buffer.from("reviewed audio sample"),
      large = Buffer.alloc(9 * 1024 * 1024, 65);
    await fs.writeFile(path.join(source, "small.mp3"), small);
    await fs.writeFile(path.join(source, "large.mp3"), large);
    server.objects.set("published/retained.mp3", Buffer.from("rollback"));
    const options = [
      "--endpoint-url",
      server.endpoint,
      "--region",
      "eu-west-1",
      "--no-cli-pager",
      "--no-cli-auto-prompt",
      "--output",
      "json",
      "--cli-error-format",
      "json",
    ];
    const args = [
      "s3",
      "cp",
      "--recursive",
      source,
      "s3://fixture/published/",
      "--no-overwrite",
      "--no-follow-symlinks",
      "--checksum-algorithm",
      "SHA256",
      "--content-type",
      "audio/mpeg",
      "--content-disposition",
      "inline",
      "--cache-control",
      "public, max-age=0, s-maxage=300, must-revalidate",
      "--only-show-errors",
      "--no-progress",
      ...options,
    ];
    const first = await runAwsCli(args, env);
    assert.deepEqual(first, { exitCode: 0, stdout: "", stderr: "" });
    t.diagnostic(
      JSON.stringify({ scenario: "initial conditional upload", ...first }),
    );
    assert.deepEqual(server.objects.get("published/small.mp3"), small);
    assert.deepEqual(server.objects.get("published/large.mp3"), large);
    const put = server.writes.find((write) => write.operation === "put")!;
    assert.equal(put.headers["if-none-match"], "*");
    assert.equal(put.headers["content-type"], "audio/mpeg");
    assert.equal(put.headers["content-disposition"], "inline");
    assert.match(String(put.headers["cache-control"]), /s-maxage=300/);
    assert.equal(
      server.writes.find((write) => write.operation === "complete")!.headers[
        "if-none-match"
      ],
      "*",
    );
    const count = server.writes.length;
    await fs.writeFile(
      path.join(source, "small.mp3"),
      "changed bytes must never replace an existing key",
    );
    const repeat = await runAwsCli(args, env);
    assert.deepEqual(repeat, { exitCode: 0, stdout: "", stderr: "" });
    t.diagnostic(
      JSON.stringify({ scenario: "existing objects preserved", ...repeat }),
    );
    assert(server.writes.length > count);
    assert.deepEqual(server.objects.get("published/small.mp3"), small);
    assert(server.objects.has("published/retained.mp3"));
    // Low-level service output really is JSON; high-level transfer success is empty with only-show-errors.
    const listed = await runAwsCli(
      ["s3api", "list-objects-v2", "--bucket", "fixture", ...options],
      env,
    );
    assert.equal(JSON.parse(listed.stdout).Contents.length, 3);
    server.deny();
    await assert.rejects(
      runAwsCli(
        ["s3api", "list-objects-v2", "--bucket", "fixture", ...options],
        env,
      ),
      (error: unknown) => {
        assert(error instanceof AwsCliError);
        assert.equal(error.exitCode, 254);
        assert.equal(JSON.parse(error.stderr).Code, "AccessDenied");
        t.diagnostic(
          JSON.stringify({
            scenario: "service error",
            exitCode: error.exitCode,
            stderr: JSON.parse(error.stderr),
          }),
        );
        return true;
      },
    );
    await assert.rejects(runAwsCli(args, env), (error: unknown) => {
      assert(error instanceof AwsCliError);
      assert.equal(error.exitCode, 1);
      t.diagnostic(
        JSON.stringify({
          scenario: "transfer failure",
          exitCode: error.exitCode,
          stderrContains: "AccessDenied",
        }),
      );
      assert.match(error.stderr, /AccessDenied/);
      return true;
    });
  },
);
