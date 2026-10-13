import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { checkAwsCli, runAwsCli, AwsCliError } from "../core/aws-cli";

test("CLI dependency gate accepts supported v2 and rejects old, future-major and malformed versions", async () => {
  for (const version of ["2.37.12", "2.38.0"])
    assert.equal(
      await checkAwsCli(async () => ({
        exitCode: 0,
        stdout: `aws-cli/${version} Python/test`,
        stderr: "",
      })),
      version,
    );
  for (const version of ["1.42.0", "2.37.11", "2.33.0", "3.0.0", "garbage"])
    await assert.rejects(
      checkAwsCli(async () => ({
        exitCode: 0,
        stdout: `aws-cli/${version}`,
        stderr: "",
      })),
      /required/,
    );
});

test("CLI process wrapper preserves output, fails on every nonzero exit and never invokes a shell", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aws-cli-runner-"));
  const previous = process.env.NOTES_AWS_CLI;
  t.after(async () => {
    if (previous === undefined) delete process.env.NOTES_AWS_CLI;
    else process.env.NOTES_AWS_CLI = previous;
    await fs.rm(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, "fake aws");
  process.env.NOTES_AWS_CLI = file;
  await fs.writeFile(
    file,
    `#!${process.execPath}\nprocess.stdout.write(JSON.stringify(process.argv.slice(3))); process.stderr.write('{"Code":"Fixture"}'); process.exit(Number(process.argv[2]));`,
    { mode: 0o700 },
  );
  const literal = "$(touch should-never-exist); with spaces";
  assert.deepEqual(await runAwsCli(["0", literal]), {
    exitCode: 0,
    stdout: JSON.stringify([literal]),
    stderr: '{"Code":"Fixture"}',
  });
  for (const code of [1, 2, 130, 252, 253, 254, 255]) {
    await assert.rejects(
      runAwsCli([String(code), literal]),
      (error: unknown) => {
        assert(error instanceof AwsCliError);
        assert.equal(error.exitCode, code);
        assert.equal(JSON.parse(error.stderr).Code, "Fixture");
        assert.equal(error.stdout, JSON.stringify([literal]));
        return true;
      },
    );
  }
  process.env.NOTES_AWS_CLI = path.join(directory, "missing");
  await assert.rejects(checkAwsCli(), /missing.*assets:doctor/);
});
