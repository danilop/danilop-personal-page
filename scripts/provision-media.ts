import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mediaSettings } from "../core/media";
const configPath =
  process.env.NOTES_MEDIA_CONFIG ??
  path.join(os.homedir(), ".config/notes-along-the-way/media.json");
try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const settings = mediaSettings();
  const url = new URL(settings.baseUrl);
  if (url.pathname !== "/")
    throw Error(
      "Provisioned CloudFront media URL must be an HTTPS origin without a path",
    );
  for (const key of [
    "bucket",
    "region",
    "accountId",
    "stackName",
    "certificateArn",
    "hostedZoneId",
  ])
    if (typeof config[key] !== "string" || !config[key])
      throw Error(`Private media config requires ${key}`);
  const account = execFileSync(
    "aws",
    ["sts", "get-caller-identity", "--query", "Account", "--output", "text"],
    { encoding: "utf8" },
  ).trim();
  if (account !== config.accountId)
    throw Error("AWS account differs from private media configuration");
  const apply = process.argv.includes("--apply");
  const args = [
    "cloudformation",
    "deploy",
    "--stack-name",
    config.stackName,
    "--region",
    config.region,
    "--template-file",
    "infrastructure/media.yaml",
    "--no-fail-on-empty-changeset",
    "--parameter-overrides",
    `BucketName=${config.bucket}`,
    `DomainName=${url.hostname}`,
    `HostedZoneId=${config.hostedZoneId}`,
    `CertificateArn=${config.certificateArn}`,
    `CacheSeconds=${settings.cacheSeconds}`,
  ];
  if (!apply) args.push("--no-execute-changeset");
  execFileSync("aws", args, { stdio: "inherit" });
  if (apply) {
    const outputs = JSON.parse(
      execFileSync(
        "aws",
        [
          "cloudformation",
          "describe-stacks",
          "--stack-name",
          config.stackName,
          "--region",
          config.region,
          "--query",
          "Stacks[0].Outputs",
        ],
        { encoding: "utf8" },
      ),
    );
    config.distributionId = outputs.find(
      (o: any) => o.OutputKey === "DistributionId",
    ).OutputValue;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
      mode: 0o600,
    });
    fs.chmodSync(configPath, 0o600);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
