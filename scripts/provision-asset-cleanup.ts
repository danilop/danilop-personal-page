import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

async function main() {
  const file =
    process.env.NOTES_MEDIA_CONFIG ??
    path.join(os.homedir(), ".config/notes-along-the-way/media.json");
  const config = JSON.parse(await fs.readFile(file, "utf8"));
  const apply = process.argv.includes("--apply");
  const bucket = config.bucket;
  const objectPrefixes = [
    "originals/",
    "published/media/",
    "published/sources/",
  ];
  const arn = (prefix: string) => `arn:aws:s3:::${bucket}/${prefix}*`;
  const template = {
    AWSTemplateFormatVersion: "2010-09-09",
    Description:
      "Daily recoverable collection of managed media, coordinated with releases",
    Resources: {
      Role: {
        Type: "AWS::IAM::Role",
        Properties: {
          AssumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { Service: "lambda.amazonaws.com" },
                Action: "sts:AssumeRole",
              },
            ],
          },
          Policies: [
            {
              PolicyName: "ManagedAssetsOnly",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: "s3:ListBucket",
                    Resource: `arn:aws:s3:::${bucket}`,
                    Condition: {
                      StringLike: {
                        "s3:prefix": [...objectPrefixes, "asset-releases/"].map(
                          (prefix) => prefix + "*",
                        ),
                      },
                    },
                  },
                  {
                    Effect: "Allow",
                    Action: [
                      "s3:GetObject",
                      "s3:GetObjectTagging",
                      "s3:PutObjectTagging",
                      "s3:DeleteObject",
                    ],
                    Resource: objectPrefixes.map(arn),
                  },
                  {
                    Effect: "Allow",
                    Action: ["s3:GetObject", "s3:DeleteObject"],
                    Resource: arn("asset-releases/"),
                  },
                  {
                    Effect: "Allow",
                    Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
                    Resource: arn("asset-control/"),
                  },
                  {
                    Effect: "Allow",
                    Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
                    Resource: {
                      "Fn::Sub":
                        "arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-collector:*",
                    },
                  },
                  {
                    Effect: "Allow",
                    Action: "s3:PutObject",
                    Resource: arn("asset-trash/"),
                  },
                ],
              },
            },
          ],
        },
      },
      Collector: {
        Type: "AWS::Lambda::Function",
        Properties: {
          FunctionName: { "Fn::Sub": "${AWS::StackName}-collector" },
          Runtime: "python3.13",
          Handler: "index.handler",
          Role: { "Fn::GetAtt": ["Role", "Arn"] },
          Timeout: 120,
          MemorySize: 128,
          Environment: {
            Variables: {
              ASSET_BUCKET: bucket,
              DEPLOYMENT_MARKER: "https://www.danilop.net/build.json",
            },
          },
          Code: {
            ZipFile: await fs.readFile(
              "infrastructure/asset_cleanup.py",
              "utf8",
            ),
          },
        },
      },
      Logs: {
        Type: "AWS::Logs::LogGroup",
        Properties: {
          LogGroupName: {
            "Fn::Sub": "/aws/lambda/${AWS::StackName}-collector",
          },
          RetentionInDays: 14,
        },
      },
      Schedule: {
        Type: "AWS::Events::Rule",
        Properties: {
          ScheduleExpression: "rate(1 day)",
          State: "ENABLED",
          Targets: [
            {
              Id: "AssetCleanup",
              Arn: { "Fn::GetAtt": ["Collector", "Arn"] },
              Input: "{}",
            },
          ],
        },
      },
      Permission: {
        Type: "AWS::Lambda::Permission",
        Properties: {
          Action: "lambda:InvokeFunction",
          FunctionName: { Ref: "Collector" },
          Principal: "events.amazonaws.com",
          SourceArn: { "Fn::GetAtt": ["Schedule", "Arn"] },
        },
      },
    },
    Outputs: { CollectorName: { Value: { Ref: "Collector" } } },
  };
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "asset-cleanup-plan-"));
  try {
    const templateFile = path.join(temp, "template.json");
    await fs.writeFile(templateFile, JSON.stringify(template));
    const account = execFileSync(
      "aws",
      ["sts", "get-caller-identity", "--query", "Account", "--output", "text"],
      { encoding: "utf8" },
    ).trim();
    if (account !== config.accountId) throw Error("Unexpected AWS account");
    execFileSync(
      "aws",
      [
        "cloudformation",
        "deploy",
        "--stack-name",
        config.stackName + "-asset-cleanup",
        "--region",
        config.region,
        "--template-file",
        templateFile,
        "--capabilities",
        "CAPABILITY_IAM",
        "--no-fail-on-empty-changeset",
        ...(apply ? [] : ["--no-execute-changeset"]),
      ],
      { stdio: "inherit" },
    );
    if (apply) {
      const result = execFileSync(
        "aws",
        [
          "s3api",
          "get-bucket-lifecycle-configuration",
          "--bucket",
          bucket,
          "--output",
          "json",
        ],
        { encoding: "utf8" },
      );
      const lifecycle = JSON.parse(result);
      const rules: Record<string, unknown>[] = [
        ...objectPrefixes,
        "asset-control/",
        "asset-releases/",
        "asset-trash/",
      ].flatMap((prefix, index) => [
        {
          ID: `ManagedAssetVersions${index}`,
          Status: "Enabled",
          Filter: prefix.startsWith("asset-")
            ? { Prefix: prefix }
            : {
                And: {
                  Prefix: prefix,
                  Tags: [{ Key: "asset-managed", Value: "v1" }],
                },
              },
          NoncurrentVersionExpiration: {
            NoncurrentDays: prefix.startsWith("asset-") ? 1 : 30,
          },
        },
        {
          ID: `ManagedAssetMarkers${index}`,
          Status: "Enabled",
          Filter: { Prefix: prefix },
          Expiration: { ExpiredObjectDeleteMarker: true },
        },
      ]);
      rules.push({
        ID: "ManagedAssetTrashRecords",
        Status: "Enabled",
        Filter: { Prefix: "asset-trash/" },
        Expiration: { Days: 31 },
      });
      lifecycle.Rules = [
        ...lifecycle.Rules.filter(
          (rule: { ID: string }) => !rule.ID.startsWith("ManagedAsset"),
        ),
        ...rules,
      ];
      const lifecycleFile = path.join(temp, "lifecycle.json");
      await fs.writeFile(
        lifecycleFile,
        JSON.stringify({ Rules: lifecycle.Rules }),
      );
      execFileSync(
        "aws",
        [
          "s3api",
          "put-bucket-lifecycle-configuration",
          "--bucket",
          bucket,
          "--lifecycle-configuration",
          "file://" + lifecycleFile,
          ...(lifecycle.TransitionDefaultMinimumObjectSize
            ? [
                "--transition-default-minimum-object-size",
                lifecycle.TransitionDefaultMinimumObjectSize,
              ]
            : []),
        ],
        { stdio: "inherit" },
      );
    }
    console.log(
      apply
        ? "Daily collector deployed with managed-prefix version retention."
        : "Collector change set prepared; no resources changed.",
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
