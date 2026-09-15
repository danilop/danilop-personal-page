import { loadEditions } from "../core/editions";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  CloudFrontKeyValueStoreClient,
  DescribeKeyValueStoreCommand,
  UpdateKeysCommand,
  ListKeysCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { AmplifyClient, ListJobsCommand } from "@aws-sdk/client-amplify";
import { loadLibrary, readYaml } from "../core/model";
import { compileLinks } from "../core/shortlinks";
import { siteConfig } from "../core/config";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const dry = !process.argv.includes("--apply");
  const rollbackIndex = process.argv.indexOf("--rollback");
  const rollback =
    rollbackIndex < 0 ? undefined : process.argv[rollbackIndex + 1];
  if (
    rollbackIndex >= 0 &&
    (!rollback ||
      !/^publication\/shortlinks\/snapshots\/[a-zA-Z0-9-]+\.json$/.test(
        rollback,
      ))
  )
    throw Error("Specify an exact publication/shortlinks/snapshots/*.json key");
  const config = await siteConfig(),
    lib = await loadLibrary(),
    compiledLinks = compileLinks(
      await readYaml("publishing/links.yaml"),
      lib,
      config.url,
      await loadEditions(),
    );
  let links = compiledLinks;
  const revision =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (dry && !rollback) {
    console.log(JSON.stringify({ revision, links }, null, 2));
    return;
  }
  const infra = JSON.parse(
    await fs.readFile("publishing/infrastructure.json", "utf8"),
  );
  const s3 = new S3Client({ region: "eu-west-1" }),
    kvs = new CloudFrontKeyValueStoreClient({ region: "us-east-1" }),
    amplify = new AmplifyClient({ region: "eu-west-1" });
  if (rollback) {
    const snapshot = await s3.send(
      new GetObjectCommand({ Bucket: infra.bucket, Key: rollback }),
    );
    links = JSON.parse(await snapshot.Body!.transformToString()).before;
    for (const url of Object.values(links))
      if (!url.startsWith(config.url + "/"))
        throw Error("Rollback target outside canonical site");
    if (dry) {
      console.log(JSON.stringify({ revision, rollback, links }, null, 2));
      return;
    }
  }
  if (process.argv.includes("--wait")) {
    for (let n = 0; n < 180; n++) {
      const jobs = await amplify.send(
        new ListJobsCommand({
          appId: infra.amplifyAppId,
          branchName: "main",
          maxResults: 20,
        }),
      );
      const job = jobs.jobSummaries?.find((j) => j.commitId === revision);
      if (job?.status === "SUCCEED") break;
      if (job && ["FAILED", "CANCELLED"].includes(job.status!))
        throw Error(`Site deployment ${job.status}`);
      if (n === 179) throw Error("Timed out waiting for exact site deployment");
      await delay(10000);
    }
  }
  const verify = async () => {
    const response = await fetch(
      config.url + "/build.json?revision=" + revision,
      { cache: "no-store" },
    );
    if (!response.ok || (await response.json()).revision !== revision)
      throw Error("This source revision is not the currently deployed website");
  };
  await verify();
  for (const url of Object.values(links)) {
    const r = await fetch(url, { method: "HEAD", redirect: "manual" });
    if (r.status !== 200)
      throw Error(`Destination unavailable: ${url} (${r.status})`);
  }
  const lock = "publication/shortlinks/lock.json";
  await s3.send(
    new PutObjectCommand({
      Bucket: infra.bucket,
      Key: lock,
      Body: JSON.stringify({ revision, createdAt: new Date().toISOString() }),
      IfNoneMatch: "*",
      ContentType: "application/json",
    }),
  );
  try {
    let existing: Record<string, string> = {};
    let token: string | undefined;
    do {
      const page = await kvs.send(
        new ListKeysCommand({ KvsARN: infra.kvsArn, NextToken: token }),
      );
      for (const item of page.Items ?? []) existing[item.Key!] = item.Value!;
      token = page.NextToken;
    } while (token);
    // Never silently drop old aliases. Ownership follows the content ID ledger.
    let owners: Record<string, string> = {};
    try {
      const previous = await s3.send(
        new GetObjectCommand({
          Bucket: infra.bucket,
          Key: "publication/shortlinks/owners.json",
        }),
      );
      owners = JSON.parse(await previous.Body!.transformToString());
    } catch (e: any) {
      if (e.name !== "NoSuchKey") throw e;
    }
    const manifest = await readYaml("publishing/links.yaml");
    for (const code of Object.keys(links)) {
      if (rollback) {
        if (!owners[code]) throw Error(`Missing owner for ${code}`);
        if (owners[code].includes("@") && links[code] !== existing[code])
          throw Error("A fixed edition alias cannot change during rollback");
        continue;
      }
      if (
        owners[code] &&
        owners[code] !==
          [manifest.links[code].ref, manifest.links[code].edition]
            .filter(Boolean)
            .join("@")
      )
        throw Error(`Alias ${code} already belongs to ${owners[code]}`);
      owners[code] = [manifest.links[code].ref, manifest.links[code].edition]
        .filter(Boolean)
        .join("@");
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: infra.bucket,
        Key: `publication/shortlinks/snapshots/${revision}-${Date.now()}.json`,
        Body: JSON.stringify({
          revision,
          before: existing,
          after: { ...existing, ...links },
          owners,
        }),
        ContentType: "application/json",
      }),
    );
    await verify();
    const items = Object.entries(links).filter(
      ([Key, Value]) => existing[Key] !== Value,
    );
    for (let i = 0; i < items.length; i += 50) {
      await verify();
      const state = await kvs.send(
        new DescribeKeyValueStoreCommand({ KvsARN: infra.kvsArn }),
      );
      await kvs.send(
        new UpdateKeysCommand({
          KvsARN: infra.kvsArn,
          IfMatch: state.ETag,
          Puts: items.slice(i, i + 50).map(([Key, Value]) => ({ Key, Value })),
        }),
      );
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: infra.bucket,
        Key: "publication/shortlinks/owners.json",
        Body: JSON.stringify(owners),
        ContentType: "application/json",
      }),
    );
    console.log(`Published ${items.length} alias changes for ${revision}.`);
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket: infra.bucket, Key: lock }));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
