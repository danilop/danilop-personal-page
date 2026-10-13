import { execFile } from "node:child_process";
import { promisify } from "node:util";
import versions from "./aws-cli-version.json";

const execute = promisify(execFile);
type AwsCliResult = { exitCode: 0; stdout: string; stderr: string };
export type AwsCliRunner = (
  args: string[],
  env?: NodeJS.ProcessEnv,
) => Promise<AwsCliResult>;

export class AwsCliError extends Error {
  constructor(
    readonly exitCode: number | string | undefined,
    readonly stdout: string,
    readonly stderr: string,
    readonly signal?: string | null,
  ) {
    super(
      `AWS CLI failed (${signal ?? exitCode ?? "unknown"}): ${stderr.trim() || "no diagnostic output"}`,
    );
  }
}

// Use argv, never a shell. Credentials stay in the child environment, not logs.
export const runAwsCli: AwsCliRunner = async (args, env = process.env) => {
  try {
    const result = await execute(process.env.NOTES_AWS_CLI ?? "aws", args, {
      env: {
        ...env,
        AWS_PAGER: "",
        AWS_CLI_AUTO_PROMPT: "off",
        AWS_CLI_ERROR_FORMAT: "json",
      },
      encoding: "utf8",
      timeout: args[0] === "--version" ? 10000 : 15 * 60 * 1000,
      maxBuffer: 4 * 1024 * 1024,
      killSignal: "SIGTERM",
    });
    return { exitCode: 0, ...result };
  } catch (error) {
    const failure = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      signal?: string;
    };
    if (failure.code === "ENOENT")
      throw Error(
        "AWS CLI v2 is missing. Install it using docs/asset-release-design.md, then run npm run assets:doctor.",
        { cause: error },
      );
    throw new AwsCliError(
      failure.code,
      failure.stdout ?? "",
      failure.stderr ?? "",
      failure.signal,
    );
  }
};

export async function checkAwsCli(run: AwsCliRunner = runAwsCli) {
  const result = await run(["--version"]);
  const match = /^aws-cli\/(\d+)\.(\d+)\.(\d+)\b/.exec(result.stdout.trim());
  const actual = match?.slice(1).map(Number);
  const minimum = versions.minimum.split(".").map(Number);
  if (
    !actual ||
    actual[0] !== 2 ||
    actual[1] < minimum[1] ||
    (actual[1] === minimum[1] && actual[2] < minimum[2])
  )
    throw Error(
      `AWS CLI v2 >= ${versions.minimum} is required; received ${result.stdout.trim() || result.stderr.trim()}. See docs/asset-release-design.md.`,
    );
  return actual.join(".");
}
