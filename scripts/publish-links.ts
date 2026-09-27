import { asError } from "../core/errors";
import { deployment, siteUrl } from "../core/deployment.mjs";
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
import { compileLinks, linksSchema, reconcileLinks } from "../core/shortlinks";
import { siteConfig } from "../core/config";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  if (process.argv.includes("--apply") && !deployment.indexable)
    throw Error("External publication is disabled for this preview deployment");
  const dry = !process.argv.includes("--apply");
  const rollback = rollbackKey();
  const config = await siteConfig(),
    lib = await loadLibrary(),
    manifest = linksSchema.parse(await readYaml("publishing/links.yaml")),
    compiledLinks = compileLinks(
      manifest,
      lib,
      config.url,
      await loadEditions(),
    );
  let links = compiledLinks;
  const revision =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (dry && !rollback) {
    console.log(
      JSON.stringify(
        {
          revision,
          links,
          deactivate: Object.keys(manifest.links).filter(
            (code) => !(code in links),
          ),
          removed: manifest.removed,
        },
        null,
        2,
      ),
    );
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
  await waitForDeployment();
  const verify = async () => {
    const response = await fetch(
      siteUrl("/build.json", config.url) + "?revision=" + revision,
      { cache: "no-store" },
    );
    if (!response.ok || (await response.json()).revision !== revision)
      throw Error("This source revision is not the currently deployed website");
  };
  await verify();
  await verifyDestinations();
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
    const {
      owners,
      existing,
      after,
      deletions,
    }: {
      owners: Record<string, string>;
      existing: Record<string, string>;
      after: Record<string, string>;
      deletions: string[];
    } = await planPublication();
    // Persist ownership before KVS changes, making an interrupted first publication retryable.
    await s3.send(
      new PutObjectCommand({
        Bucket: infra.bucket,
        Key: "publication/shortlinks/owners.json",
        Body: JSON.stringify(owners),
        ContentType: "application/json",
      }),
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: infra.bucket,
        Key: `publication/shortlinks/snapshots/${revision}-${Date.now()}.json`,
        Body: JSON.stringify({
          revision,
          before: existing,
          after,
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
    for (let i = 0; i < deletions.length; i += 50) {
      await verify();
      const state = await kvs.send(
        new DescribeKeyValueStoreCommand({ KvsARN: infra.kvsArn }),
      );
      await kvs.send(
        new UpdateKeysCommand({
          KvsARN: infra.kvsArn,
          IfMatch: state.ETag,
          Deletes: deletions.slice(i, i + 50).map((Key) => ({ Key })),
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
    console.log(
      `Published ${items.length} alias changes and ${deletions.length} removals for ${revision}.`,
    );
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket: infra.bucket, Key: lock }));
  }

  function rollbackKey() {
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
      throw Error(
        "Specify an exact publication/shortlinks/snapshots/*.json key",
      );
    return rollback;
  }

  async function verifyDestinations() {
    for (const url of Object.values(links)) {
      const r = await fetch(url, { method: "HEAD", redirect: "manual" });
      if (r.status !== 200)
        throw Error(`Destination unavailable: ${url} (${r.status})`);
    }
  }

  async function planPublication() {
    const existing: Record<string, string> = {};
    let token: string | undefined;
    do {
      const page = await kvs.send(
        new ListKeysCommand({ KvsARN: infra.kvsArn, NextToken: token }),
      );
      for (const item of page.Items ?? []) existing[item.Key!] = item.Value!;
      token = page.NextToken;
    } while (token);
    // Ownership survives deactivation and deletion so old codes are never reassigned.
    let owners: Record<string, string> = {};
    try {
      const previous = await s3.send(
        new GetObjectCommand({
          Bucket: infra.bucket,
          Key: "publication/shortlinks/owners.json",
        }),
      );
      owners = JSON.parse(await previous.Body!.transformToString());
    } catch (caught) {
      const e = asError(caught);
      if (e.name !== "NoSuchKey") throw e;
    }
    let after: Record<string, string>;
    let deletions: string[] = [];
    if (rollback) {
      validateRollback();
      // Preserve the existing rollback contract: restore targets without removing newer aliases.
      after = { ...existing, ...links };
    } else {
      const next = reconcileLinks(manifest, links, existing, owners);
      after = next.after;
      owners = next.owners;
      deletions = next.deletions;
    }
    return { owners, existing, after, deletions };

    function validateRollback() {
      for (const code of Object.keys(links)) {
        if (!owners[code]) throw Error(`Missing owner for ${code}`);
        if (owners[code].includes("@") && links[code] !== existing[code])
          throw Error("A fixed edition alias cannot change during rollback");
      }
    }
  }

  async function waitForDeployment() {
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
        if (n === 179)
          throw Error("Timed out waiting for exact site deployment");
        await delay(10000);
      }
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
