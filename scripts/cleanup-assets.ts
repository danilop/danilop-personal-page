import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--apply"))
    throw Error("Usage: assets:cleanup [--apply]");
  const file =
    process.env.NOTES_MEDIA_CONFIG ??
    path.join(os.homedir(), ".config/notes-along-the-way/media.json");
  const config = JSON.parse(await fs.readFile(file, "utf8"));
  const aws = (args: string[]) =>
    execFileSync(
      "aws",
      [...args, "--region", config.region, "--output", "json"],
      { encoding: "utf8" },
    );
  if (
    JSON.parse(aws(["sts", "get-caller-identity"])).Account !== config.accountId
  )
    throw Error("Unexpected AWS account");
  const stack = JSON.parse(
    aws([
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      config.stackName + "-asset-cleanup",
    ]),
  );
  const name = stack.Stacks[0].Outputs.find(
    (item: { OutputKey: string }) => item.OutputKey === "CollectorName",
  )?.OutputValue;
  if (!name) throw Error("Provision asset cleanup first.");
  const temp = await fs.mkdtemp(
    path.join(os.tmpdir(), "asset-cleanup-result-"),
  );
  try {
    const resultFile = path.join(temp, "result.json");
    const invocation = JSON.parse(
      aws([
        "lambda",
        "invoke",
        "--function-name",
        name,
        "--cli-binary-format",
        "raw-in-base64-out",
        "--payload",
        JSON.stringify({ dryRun: !args.includes("--apply") }),
        resultFile,
      ]),
    );
    const result = JSON.parse(await fs.readFile(resultFile, "utf8"));
    if (invocation.FunctionError)
      throw Error(result.errorMessage ?? invocation.FunctionError);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
