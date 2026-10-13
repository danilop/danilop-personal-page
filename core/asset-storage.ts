import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import type { AssetRecord } from "./asset-manifest";
import { execFileSync } from "node:child_process";
import { runAwsCli, checkAwsCli, type AwsCliRunner } from "./aws-cli";
import { createHash, randomUUID } from "node:crypto";

const operatorSchema = z
  .object({
    bucket: z.string().min(3),
    region: z.string().min(1),
    accountId: z.string().regex(/^\d{12}$/),
    distributionId: z.string().optional(),
    stackName: z.string().optional(),
    certificateArn: z.string().optional(),
    hostedZoneId: z.string().optional(),
  })
  .strict();
async function assetStorage() {
  const file =
    process.env.NOTES_MEDIA_CONFIG ??
    path.join(os.homedir(), ".config/notes-along-the-way/media.json");
  const config = operatorSchema.parse(
    JSON.parse(await fs.readFile(file, "utf8")),
  );
  return { config, client: new S3Client({ region: config.region }) };
}
export async function privateAssetBytes(record: AssetRecord) {
  const { config, client } = await assetStorage();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      ExpectedBucketOwner: config.accountId,
      Key: record.key,
    }),
  );
  if (!result.Body) throw Error(`Missing private asset: ${record.key}`);
  const bytes = await result.Body.transformToByteArray();
  return bytes;
}
export type AssetSyncGroup = {
  disposition?: "inline" | "attachment";
  directory: string;
  publicFile: boolean;
  contentType: string;
  records: AssetRecord[];
};

async function verifyStoredAsset(
  client: S3Client,
  request: { Bucket: string; ExpectedBucketOwner: string; Key: string },
  record: AssetRecord,
) {
  const object = await client.send(
    new HeadObjectCommand({ ...request, ChecksumMode: "ENABLED" }),
  );
  if (
    object.ContentLength !== record.bytes ||
    object.ContentType !== record.contentType
  )
    throw Error(`Stored asset differs from manifest: ${request.Key}`);
  const expected = Buffer.from(record.sha256, "hex").toString("base64");
  if (object.ChecksumType === "COMPOSITE") {
    // Multipart SHA-256 is a hash of part hashes, not the manifest's whole-file hash.
    // Verify the actual bytes without inventing multipart/checksum reconstruction.
    const downloaded = await client.send(
      new GetObjectCommand({ ...request, IfMatch: object.ETag }),
    );
    if (!downloaded.Body) throw Error(`Missing asset body: ${request.Key}`);
    const hash = createHash("sha256");
    let length = 0;
    for await (const chunk of downloaded.Body.transformToWebStream()) {
      hash.update(chunk);
      length += chunk.length;
    }
    if (length !== record.bytes || hash.digest("hex") !== record.sha256)
      throw Error(`Stored asset differs from manifest: ${request.Key}`);
  } else if (object.ChecksumSHA256 !== expected) {
    throw Error(`Stored asset differs from manifest: ${request.Key}`);
  }
  const tags = await client.send(new GetObjectTaggingCommand(request));
  const current = tags.TagSet ?? [];
  if (
    !current.some((tag) => tag.Key === "asset-managed" && tag.Value === "v1") ||
    current.some((tag) => tag.Key === "asset-unused-since")
  ) {
    const next = current.filter(
      (tag) => tag.Key !== "asset-unused-since" && tag.Key !== "asset-managed",
    );
    next.push({ Key: "asset-managed", Value: "v1" });
    await client.send(
      new PutObjectTaggingCommand({ ...request, Tagging: { TagSet: next } }),
    );
  }
}

export async function syncStoredAssets(
  groups: AssetSyncGroup[],
  run: AwsCliRunner = runAwsCli,
) {
  const cliVersion = await checkAwsCli(run);
  const { config, client } = await assetStorage();
  // High-level transfers have no ExpectedBucketOwner option. Check it before any CLI write.
  await client.send(
    new HeadBucketCommand({
      Bucket: config.bucket,
      ExpectedBucketOwner: config.accountId,
    }),
  );
  const credentials = await client.config.credentials();
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    AWS_SESSION_TOKEN: credentials.sessionToken,
    // Use the SDK-resolved identity for both halves of this operation.
    AWS_PROFILE: undefined,
    AWS_DEFAULT_PROFILE: undefined,
  };
  const reports = [];
  const transferConfig = await fs.mkdtemp(
    path.join(os.tmpdir(), "notes-aws-config-"),
  );
  try {
    const file = path.join(transferConfig, "config");
    // Test and production use the same documented transfer engine. User profiles
    // have already resolved credentials; do not inherit untested CRT settings.
    await fs.writeFile(
      file,
      "[default]\ns3 =\n    preferred_transfer_client = classic\n",
      { mode: 0o600 },
    );
    Object.assign(env, { AWS_CONFIG_FILE: file });
    for (const group of groups) {
      const result = await run(
        [
          "s3",
          "cp",
          "--recursive",
          group.directory,
          `s3://${config.bucket}/${group.publicFile ? "published/" : ""}`,
          "--region",
          config.region,
          "--no-overwrite",
          "--no-follow-symlinks",
          "--checksum-algorithm",
          "SHA256",
          "--content-type",
          group.contentType,
          "--content-disposition",
          group.disposition ??
            (group.contentType === "application/zip" ? "attachment" : "inline"),
          "--cache-control",
          group.publicFile
            ? "public, max-age=0, s-maxage=300, must-revalidate"
            : "private, no-store",
          "--only-show-errors",
          "--no-progress",
          "--no-cli-pager",
          "--no-cli-auto-prompt",
          "--output",
          "json",
          "--cli-error-format",
          "json",
        ],
        env,
      );
      // CLI zero is necessary, but never sufficient evidence to publish.
      for (const record of group.records)
        await verifyStoredAsset(
          client,
          {
            Bucket: config.bucket,
            ExpectedBucketOwner: config.accountId,
            Key: (group.publicFile ? "published/" : "") + record.key,
          },
          record,
        );
      reports.push({
        operation: "s3 cp --recursive --no-overwrite",
        cliVersion,
        publicFile: group.publicFile,
        contentType: group.contentType,
        verifiedObjects: group.records.length,
        ...result,
      });
    }
    return reports;
  } finally {
    await fs.rm(transferConfig, { recursive: true, force: true });
  }
}

export async function withAssetLease<T>(run: () => Promise<T>) {
  const { config, client } = await assetStorage();
  const request = {
    Bucket: config.bucket,
    ExpectedBucketOwner: config.accountId,
    Key: "asset-control/lease.json",
  };
  const body = JSON.stringify({
    owner: randomUUID(),
    expires: new Date(Date.now() + 3600000).toISOString(),
  });
  async function acquire() {
    try {
      return await client.send(
        new PutObjectCommand({
          ...request,
          Body: body,
          ContentType: "application/json",
          IfNoneMatch: "*",
        }),
      );
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 412
      )
        throw error;
    }
    const previous = await client.send(new GetObjectCommand(request));
    const lease = JSON.parse(await previous.Body!.transformToString());
    const expiry = Date.parse(lease.expires);
    if (!Number.isFinite(expiry))
      throw Error("Invalid asset lease; recovery required.");
    if (expiry > Date.now())
      throw Error("Another asset release or cleanup is running; retry later.");
    return client.send(
      new PutObjectCommand({
        ...request,
        Body: body,
        ContentType: "application/json",
        IfMatch: previous.ETag,
      }),
    );
  }
  const lease = await acquire();
  try {
    return await run();
  } finally {
    await client.send(
      new DeleteObjectCommand({ ...request, IfMatch: lease.ETag }),
    );
  }
}
export async function recordAssetRelease(
  revision: string,
  state: "pending" | "deployed",
) {
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw Error("Invalid asset release revision");
  const { config, client } = await assetStorage();
  const manifest = JSON.parse(
    execFileSync("git", ["show", `${revision}:publishing/media-assets.json`], {
      encoding: "utf8",
    }),
  );
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      ExpectedBucketOwner: config.accountId,
      Key: `asset-releases/${revision}.json`,
      ContentType: "application/json",
      CacheControl: "private, no-store",
      Body: JSON.stringify({
        schemaVersion: 1,
        revision,
        state,
        created: new Date().toISOString(),
        manifest,
      }),
    }),
  );
}
