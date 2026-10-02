import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const configPath =
  process.env.NOTES_LINKS_CONFIG ??
  path.join(os.homedir(), ".config/notes-along-the-way/links.json");
const apply = process.argv.includes("--apply");
const enrol = process.argv.includes("--free-plan");
if (!apply) {
  console.log(
    "Plan: private S3 REST + OAC, one viewer-response Function, managed cache policy, 60-second object TTL and short error TTL. --apply changes infrastructure; --free-plan additionally enrols in FREE pricing with a dedicated WAF ACL and disables access logging. Configuration: " +
      configPath,
  );
  process.exit(0);
}
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const {
  bucket,
  distributionId,
  accountId,
  region = "eu-west-1",
  shortOrigin,
  canonicalOrigin,
  hostedZoneId,
} = config;
if (
  !bucket ||
  !distributionId ||
  !accountId ||
  canonicalOrigin !== "https://www.danilop.net" ||
  new URL(shortOrigin).protocol !== "https:"
)
  throw Error("Invalid private short-link configuration");
const aws = (service, operation, args = []) => {
  const output = execFileSync(
    "aws",
    [service, operation, ...args, "--output", "json", "--no-cli-pager"],
    { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] },
  );
  return output.trim() ? JSON.parse(output) : {};
};
if (aws("sts", "get-caller-identity").Account !== accountId)
  throw Error("Unexpected AWS account");
const before = aws("cloudfront", "get-distribution-config", [
  "--id",
  distributionId,
]);
const dist = before.DistributionConfig;
const hostname = new URL(shortOrigin).hostname;
if (
  !(dist.Aliases.Items ?? []).includes(hostname) ||
  dist.Origins.Quantity !== 1 ||
  dist.CacheBehaviors.Quantity !== 0
)
  throw Error("Distribution requires manual configuration review");
if (dist.DefaultCacheBehavior.LambdaFunctionAssociations.Quantity)
  throw Error("Existing Lambda associations require review");
const directory = path.dirname(configPath);
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
const backupPath = path.join(directory, "short-links-before.json");
async function optional(service, operation, args, missing) {
  try {
    return aws(service, operation, args);
  } catch (error) {
    if (missing.some((code) => String(error.stderr).includes(code)))
      return null;
    throw error;
  }
}
const policy = await optional(
  "s3api",
  "get-bucket-policy",
  ["--bucket", bucket],
  ["NoSuchBucketPolicy"],
);
const ownership = await optional(
  "s3api",
  "get-bucket-ownership-controls",
  ["--bucket", bucket],
  ["OwnershipControlsNotFoundError"],
);
const publicAccess = await optional(
  "s3api",
  "get-public-access-block",
  ["--bucket", bucket],
  ["NoSuchPublicAccessBlockConfiguration"],
);
const acl = aws("s3api", "get-bucket-acl", ["--bucket", bucket]);
if (acl.Grants.some((grant) => grant.Grantee.ID !== acl.Owner.ID))
  throw Error("Bucket has other ACL grants; review before disabling ACLs");
await fs
  .writeFile(
    backupPath,
    JSON.stringify(
      { distribution: before, policy, ownership, publicAccess, acl },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  )
  .catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "notes-links-"));
const json = async (name, value) => {
  const file = path.join(tmp, name + ".json");
  await fs.writeFile(file, JSON.stringify(value), { mode: 0o600 });
  return "file://" + file;
};
try {
  const name = "notes-short-links";
  const oacs =
    aws("cloudfront", "list-origin-access-controls").OriginAccessControlList
      .Items ?? [];
  const oac =
    oacs.find((item) => item.Name === name) ??
    aws("cloudfront", "create-origin-access-control", [
      "--origin-access-control-config",
      await json("oac", {
        Name: name,
        Description: "Private S3 short-link objects",
        SigningProtocol: "sigv4",
        SigningBehavior: "always",
        OriginAccessControlOriginType: "s3",
      }),
    ]).OriginAccessControl;
  if (oac.SigningBehavior && oac.SigningBehavior !== "always")
    throw Error("Existing OAC does not always sign requests");
  const functionConfig = {
    Comment: "S3 metadata to canonical HTTP redirects",
    Runtime: "cloudfront-js-2.0",
  };
  const fn = await optional(
    "cloudfront",
    "describe-function",
    ["--name", name],
    ["NoSuchFunctionExists"],
  );
  const result = aws("cloudfront", fn ? "update-function" : "create-function", [
    "--name",
    name,
    ...(fn ? ["--if-match", fn.ETag] : []),
    "--function-config",
    await json("function", functionConfig),
    "--function-code",
    "fileb://infrastructure/shortlinks.js",
  ]);
  const eventFile = await json("test-event", {
    version: "1.0",
    context: { eventType: "viewer-response" },
    viewer: { ip: "192.0.2.1" },
    request: { method: "GET", uri: "/", headers: {} },
    response: {
      statusCode: 200,
      headers: {
        via: { value: "1.1 cloudfront" },
        "x-amz-website-redirect-location": { value: canonicalOrigin + "/" },
      },
    },
  });
  const runtimeTest = aws("cloudfront", "test-function", [
    "--name",
    name,
    "--if-match",
    result.ETag,
    "--stage",
    "DEVELOPMENT",
    "--event-object",
    eventFile.replace("file://", "fileb://"),
  ]).TestResult;
  if (
    runtimeTest.FunctionErrorMessage ||
    JSON.parse(runtimeTest.FunctionOutput).response.statusCode !== 302
  )
    throw Error(
      "CloudFront runtime test failed: " + runtimeTest.FunctionErrorMessage,
    );
  const published = aws("cloudfront", "publish-function", [
    "--name",
    name,
    "--if-match",
    result.ETag,
  ]);
  const functionArn = published.FunctionSummary.FunctionMetadata.FunctionARN;
  const existingAssociations =
    dist.DefaultCacheBehavior.FunctionAssociations.Items ?? [];
  if (existingAssociations.some((a) => a.FunctionARN !== functionArn))
    throw Error("Existing Function association requires review");
  const distributionArn = `arn:aws:cloudfront::${accountId}:distribution/${distributionId}`;
  const bucketPolicy = policy
    ? JSON.parse(policy.Policy)
    : { Version: "2012-10-17", Statement: [] };
  const sid = "ShortLinkCloudFrontRead";
  const statements = Array.isArray(bucketPolicy.Statement)
    ? bucketPolicy.Statement
    : [bucketPolicy.Statement];
  bucketPolicy.Statement = [
    ...statements.filter((s) => s.Sid !== sid),
    {
      Sid: sid,
      Effect: "Allow",
      Principal: { Service: "cloudfront.amazonaws.com" },
      Action: "s3:GetObject",
      Resource: `arn:aws:s3:::${bucket}/redirects/*`,
      Condition: { StringEquals: { "AWS:SourceArn": distributionArn } },
    },
  ];
  aws("s3api", "put-public-access-block", [
    "--bucket",
    bucket,
    "--public-access-block-configuration",
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
  ]);
  aws("s3api", "put-bucket-ownership-controls", [
    "--bucket",
    bucket,
    "--ownership-controls",
    await json("ownership", {
      Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
    }),
  ]);
  aws("s3api", "put-bucket-policy", [
    "--bucket",
    bucket,
    "--policy",
    await json("policy", bucketPolicy),
  ]);
  const empty = path.join(tmp, "empty");
  await fs.writeFile(empty, "");
  const index = await optional(
    "s3api",
    "head-object",
    ["--bucket", bucket, "--key", "redirects/index"],
    ["404", "NotFound"],
  );
  if (index && index.Metadata?.owner !== "system-root")
    throw Error("Root object has unknown ownership");
  aws("s3api", "put-object", [
    "--bucket",
    bucket,
    "--key",
    "redirects/index",
    "--body",
    empty,
    "--website-redirect-location",
    canonicalOrigin + "/",
    "--cache-control",
    "public, max-age=0, s-maxage=60",
    "--metadata",
    "owner=system-root",
    ...(index ? ["--if-match", index.ETag] : ["--if-none-match", "*"]),
  ]);
  const origin = dist.Origins.Items[0];
  if (!origin.DomainName.startsWith(bucket + ".s3"))
    throw Error("Unexpected S3 origin");
  origin.DomainName = `${bucket}.s3.${region}.amazonaws.com`;
  origin.OriginPath = "/redirects";
  origin.OriginAccessControlId = oac.Id;
  origin.S3OriginConfig.OriginAccessIdentity = "";
  dist.DefaultRootObject = "index";
  const behavior = dist.DefaultCacheBehavior;
  for (const field of ["ForwardedValues", "MinTTL", "DefaultTTL", "MaxTTL"])
    delete behavior[field];
  behavior.CachePolicyId = "b2884449-e4de-46a7-ac36-70bc7f1ddd6d";
  behavior.FunctionAssociations = {
    Quantity: 1,
    Items: [{ EventType: "viewer-response", FunctionARN: functionArn }],
  };
  dist.CustomErrorResponses = {
    Quantity: 1,
    Items: [
      {
        ErrorCode: 403,
        ResponseCode: "404",
        ResponsePagePath: "/not-found",
        ErrorCachingMinTTL: 5,
      },
    ],
  };
  // A private static error object lets CloudFront map missing-key 403 to a real 404.
  const errorKey = "redirects/not-found";
  const errorObject = await optional(
    "s3api",
    "head-object",
    ["--bucket", bucket, "--key", errorKey],
    ["404", "NotFound"],
  );
  if (errorObject && errorObject.Metadata?.owner !== "system-error")
    throw Error("Error object has unknown ownership");
  aws("s3api", "put-object", [
    "--bucket",
    bucket,
    "--key",
    errorKey,
    "--body",
    empty,
    "--content-type",
    "text/plain",
    "--cache-control",
    "public, max-age=0, s-maxage=5",
    "--metadata",
    "owner=system-error",
    ...(errorObject
      ? ["--if-match", errorObject.ETag]
      : ["--if-none-match", "*"]),
  ]);
  dist.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2021";
  let wafArn = dist.WebACLId;
  if (enrol) {
    const acls =
      aws("wafv2", "list-web-acls", [
        "--scope",
        "CLOUDFRONT",
        "--region",
        "us-east-1",
      ]).WebACLs ?? [];
    const waf =
      acls.find((item) => item.Name === name) ??
      aws("wafv2", "create-web-acl", [
        "--name",
        name,
        "--scope",
        "CLOUDFRONT",
        "--region",
        "us-east-1",
        "--default-action",
        '{"Allow":{}}',
        "--visibility-config",
        '{"SampledRequestsEnabled":false,"CloudWatchMetricsEnabled":true,"MetricName":"notes-short-links"}',
        "--rules",
        await json("waf-rules", [
          {
            Name: "RequestRate",
            Priority: 0,
            Statement: {
              RateBasedStatement: {
                Limit: 2000,
                AggregateKeyType: "IP",
                EvaluationWindowSec: 300,
              },
            },
            Action: { Block: {} },
            VisibilityConfig: {
              SampledRequestsEnabled: false,
              CloudWatchMetricsEnabled: true,
              MetricName: "short-links-rate",
            },
          },
        ]),
      ]).Summary;
    if (wafArn && wafArn !== waf.ARN)
      throw Error("Existing web ACL requires review");
    wafArn = waf.ARN;
    dist.WebACLId = wafArn;
    dist.Logging = {
      Enabled: false,
      IncludeCookies: false,
      Bucket: "",
      Prefix: "",
    };
  }
  const updated = aws("cloudfront", "update-distribution", [
    "--id",
    distributionId,
    "--if-match",
    before.ETag,
    "--distribution-config",
    await json("distribution", dist),
  ]);
  Object.assign(config, {
    schemaVersion: 2,
    resolver: "s3-oac",
    functionArn,
    oacId: oac.Id,
    wafArn,
  });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(
    "Updated private S3/OAC distribution. Wait for CloudFront propagation before enrolment and live testing.",
  );
  console.log(
    JSON.stringify({
      distributionId,
      domain: updated.Distribution.DomainName,
      configPath,
      backupPath,
    }),
  );
  if (enrol) {
    // Poll without a single long blocking wait; progress remains visible.
    for (let n = 0; n < 90; n++) {
      if (
        aws("cloudfront", "get-distribution", ["--id", distributionId])
          .Distribution.Status === "Deployed"
      )
        break;
      if (n === 89)
        throw Error(
          "CloudFront propagation timed out; rerun after reviewing state",
        );
      if (n % 6 === 0)
        console.log("Waiting for CloudFront configuration propagation…");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    const subscriptions =
      aws("pricing-plan-manager", "list-subscriptions", [
        "--region",
        "us-east-1",
      ]).subscriptionSummaries ?? [];
    let subscription = subscriptions.find((item) =>
      item.resourceArns?.includes(distributionArn),
    );
    if (subscription && subscription.planTier !== "FREE")
      throw Error("Existing paid subscription requires review");
    if (!subscription)
      subscription = aws("pricing-plan-manager", "create-subscription", [
        "--plan-family",
        "CloudFront",
        "--plan-tier",
        "FREE",
        "--usage-level",
        "DEFAULT",
        "--resource-arns",
        distributionArn,
        wafArn,
        ...(hostedZoneId
          ? [`arn:aws:route53:::hostedzone/${hostedZoneId}`]
          : []),
        "--approval-mode",
        "IMMEDIATE",
        "--client-token",
        crypto
          .createHash("sha256")
          .update(distributionArn + ":FREE")
          .digest("hex"),
        "--region",
        "us-east-1",
      ]).subscription;
    Object.assign(config, { subscriptionArn: subscription.arn });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log("Free subscription: " + subscription.status);
  }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
