import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  S3Client,
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
export async function ensureStoredAsset(
  record: AssetRecord,
  bytes: Uint8Array,
  publicFile: boolean,
) {
  if (
    bytes.length !== record.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== record.sha256
  )
    throw Error(`Asset checksum mismatch: ${record.key}`);
  const { config, client } = await assetStorage();
  const key = publicFile ? "published/" + record.key : record.key;
  const request = {
    Bucket: config.bucket,
    ExpectedBucketOwner: config.accountId,
    Key: key,
  };
  const checksum = Buffer.from(record.sha256, "hex").toString("base64");
  async function existing() {
    try {
      const object = await client.send(
        new HeadObjectCommand({ ...request, ChecksumMode: "ENABLED" }),
      );
      if (
        object.ChecksumSHA256 !== checksum ||
        object.ContentLength !== record.bytes ||
        object.ContentType !== record.contentType
      )
        throw Error(`Stored asset differs from manifest: ${key}`);
      return true;
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return false;
      throw error;
    }
  }
  if (await existing()) {
    const tags = await client.send(new GetObjectTaggingCommand(request));
    if (tags.TagSet?.some((tag) => tag.Key === "asset-unused-since"))
      await client.send(
        new PutObjectTaggingCommand({
          ...request,
          Tagging: {
            TagSet: tags.TagSet.filter(
              (tag) => tag.Key !== "asset-unused-since",
            ),
          },
        }),
      );
    return;
  }
  try {
    await client.send(
      new PutObjectCommand({
        ...request,
        Body: bytes,
        ContentType: record.contentType,
        ContentDisposition:
          record.contentType === "application/zip" ? "attachment" : "inline",
        CacheControl: publicFile
          ? "public, max-age=0, s-maxage=300, must-revalidate"
          : "private, no-store",
        ChecksumSHA256: checksum,
        Metadata: { sha256: record.sha256 },
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
  if (!(await existing())) throw Error(`Asset upload not verified: ${key}`);
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
