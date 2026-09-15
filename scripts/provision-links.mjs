import { isDeepStrictEqual } from "node:util";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const aws = (service, operation, args = []) =>
  JSON.parse(
    execFileSync("aws", [service, operation, ...args, "--output", "json"], {
      encoding: "utf8",
    }),
  );
const bucket = "danilop-link",
  distributionId = "E3FXM6R13U242B",
  name = "danilop-notes-links",
  region = "eu-west-1";
if (!process.argv.includes("--apply")) {
  console.log(
    "Plan: add a CloudFront KVS and viewer-request function to the existing danilop.link distribution; create a GitHub-main-only OIDC role limited to this publication registry. No site deployment in this command.",
  );
  process.exit(0);
}
const account = aws("sts", "get-caller-identity").Account;
if (account !== "600966831890") throw Error("Unexpected AWS account");
const stores =
  aws("cloudfront", "list-key-value-stores").KeyValueStoreList.Items ?? [];
const store =
  stores.find((s) => s.Name === name) ??
  aws("cloudfront", "create-key-value-store", [
    "--name",
    name,
    "--comment",
    "Durable aliases for Notes Along the Way",
  ]).KeyValueStore;
const kvsArn = store.ARN;
const code = `import cf from 'cloudfront';\nconst store = cf.kvs();\nasync function handler(event) {\n const request = event.request;\n if (request.method !== 'GET' && request.method !== 'HEAD') return {statusCode:404,headers:{'content-type':{value:'text/plain; charset=utf-8'}},body:'Short link not found.'};\n if (request.uri === '/') return {statusCode:302,headers:{location:{value:'https://www.danilop.net/'},'cache-control':{value:'public, max-age=60'}}};\n const key = request.uri.replace(/^\\//, '').replace(/\\/$/, '');\n if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(key)) return {statusCode:404,headers:{'content-type':{value:'text/plain; charset=utf-8'}},body:'Short link not found.'};\n try { const target = await store.get(key);\n if (!target.startsWith('https://www.danilop.net/')) return {statusCode:404,headers:{'content-type':{value:'text/plain; charset=utf-8'}},body:'Short link not found.'};\n return {statusCode:302,headers:{location:{value:target},'cache-control':{value:'public, max-age=60'}}};\n } catch (_) { return {statusCode:404,headers:{'content-type':{value:'text/plain; charset=utf-8'}},body:'Short link not found.'}; }\n}\n`;
await fs.mkdir("infrastructure", { recursive: true });
await fs.writeFile("infrastructure/shortlinks.js", code);
const config = {
  Comment: "Notes Along the Way durable short links",
  Runtime: "cloudfront-js-2.0",
  KeyValueStoreAssociations: {
    Quantity: 1,
    Items: [{ KeyValueStoreARN: kvsArn }],
  },
};
await fs.writeFile("/tmp/notes-function-config.json", JSON.stringify(config));
let fn;
try {
  fn = aws("cloudfront", "describe-function", ["--name", name]);
} catch (e) {
  if (!String(e.stderr).includes("NoSuchFunctionExists")) throw e;
}
const result = fn
  ? aws("cloudfront", "update-function", [
      "--name",
      name,
      "--if-match",
      fn.ETag,
      "--function-config",
      "file:///tmp/notes-function-config.json",
      "--function-code",
      "fileb://infrastructure/shortlinks.js",
    ])
  : aws("cloudfront", "create-function", [
      "--name",
      name,
      "--function-config",
      "file:///tmp/notes-function-config.json",
      "--function-code",
      "fileb://infrastructure/shortlinks.js",
    ]);
const published = aws("cloudfront", "publish-function", [
  "--name",
  name,
  "--if-match",
  result.ETag,
]);
const functionArn = published.FunctionSummary.FunctionMetadata.FunctionARN;
const before = aws("cloudfront", "get-distribution-config", [
  "--id",
  distributionId,
]);
await fs
  .writeFile(
    "infrastructure/cloudfront-before.json",
    JSON.stringify(before, null, 2) + "\n",
    { flag: "wx" },
  )
  .catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
const distribution = before.DistributionConfig;
if (!(distribution.Aliases.Items ?? []).includes("danilop.link"))
  throw Error("Unexpected distribution aliases");
const associations =
  distribution.DefaultCacheBehavior.FunctionAssociations.Items ?? [];
if (
  associations.some(
    (a) => a.EventType === "viewer-request" && a.FunctionARN !== functionArn,
  )
)
  throw Error("Existing viewer-request function requires review");
const items = [
  ...associations.filter((a) => a.EventType !== "viewer-request"),
  { FunctionARN: functionArn, EventType: "viewer-request" },
];
distribution.DefaultCacheBehavior.FunctionAssociations = {
  Quantity: items.length,
  Items: items,
};
await fs.writeFile(
  "/tmp/notes-distribution.json",
  JSON.stringify(distribution),
);
aws("cloudfront", "update-distribution", [
  "--id",
  distributionId,
  "--if-match",
  before.ETag,
  "--distribution-config",
  "file:///tmp/notes-distribution.json",
]);
const roleName = "danilop-notes-publication";
const trust = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: {
        Federated: `arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com`,
      },
      Action: "sts:AssumeRoleWithWebIdentity",
      Condition: {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub":
            "repo:danilop/danilop-personal-page:ref:refs/heads/main",
        },
      },
    },
  ],
};
await fs.writeFile("/tmp/notes-trust.json", JSON.stringify(trust));
let role;
try {
  role = aws("iam", "get-role", ["--role-name", roleName]).Role;
} catch (e) {
  if (!String(e.stderr).includes("NoSuchEntity")) throw e;
  role = aws("iam", "create-role", [
    "--role-name",
    roleName,
    "--assume-role-policy-document",
    "file:///tmp/notes-trust.json",
  ]).Role;
}
if (!isDeepStrictEqual(role.AssumeRolePolicyDocument, trust))
  throw Error("Existing role trust differs from the reviewed policy");
const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Action: ["amplify:ListJobs"],
      Resource: `arn:aws:amplify:${region}:${account}:apps/d26ru7a9pi36wa/branches/main`,
    },
    {
      Effect: "Allow",
      Action: [
        "cloudfront-keyvaluestore:DescribeKeyValueStore",
        "cloudfront-keyvaluestore:ListKeys",
        "cloudfront-keyvaluestore:UpdateKeys",
      ],
      Resource: kvsArn,
    },
    {
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      Resource: [
        `arn:aws:s3:::${bucket}/publication/shortlinks/*`,
        `arn:aws:s3:::${bucket}/publication/distribution/*`,
      ],
    },
  ],
};
await fs.writeFile(
  "infrastructure/publication-policy.json",
  JSON.stringify(policy, null, 2) + "\n",
);
await fs.writeFile(
  "infrastructure/publication-trust.json",
  JSON.stringify(trust, null, 2) + "\n",
);
execFileSync("aws", [
  "iam",
  "put-role-policy",
  "--role-name",
  roleName,
  "--policy-name",
  "shortlink-publication",
  "--policy-document",
  "file://infrastructure/publication-policy.json",
]);
execFileSync("gh", [
  "variable",
  "set",
  "PUBLICATION_ROLE_ARN",
  "--body",
  role.Arn,
  "--repo",
  "danilop/danilop-personal-page",
]);
await fs.writeFile(
  "publishing/infrastructure.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      amplifyAppId: "d26ru7a9pi36wa",
      bucket,
      distributionId,
      kvsArn,
      functionArn,
      publicationRoleArn: role.Arn,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Prepared short-link resolver and GitHub publication role. Article aliases remain empty until verified site deployment.",
);
