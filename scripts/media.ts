import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { z } from "zod";
import sharp from "sharp";
import { mediaKey, mediaUrl, mediaSettings } from "../core/media";
const operatorSchema = z
  .object({
    bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    region: z.string().min(1),
    accountId: z.string().regex(/^\d{12}$/),
    distributionId: z.string().optional(),
    stackName: z.string().optional(),
    certificateArn: z.string().optional(),
    hostedZoneId: z.string().optional(),
  })
  .strict();
async function main() {
  const [action, input, ...args] = process.argv.slice(2);
  if (!["upload", "invalidate"].includes(action) || !input)
    throw Error(
      "Usage: npm run media -- upload FILE [--key PATH] [--alt TEXT] [--replace] [--apply] | invalidate KEY [--apply]",
    );
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    if (["--apply", "--replace"].includes(args[i])) flags.add(args[i]);
    else if (["--key", "--alt"].includes(args[i]) && args[i + 1] !== undefined)
      values.set(args[i], args[++i]);
    else throw Error(`Unknown or incomplete option: ${args[i]}`);
  }
  const configPath =
    process.env.NOTES_MEDIA_CONFIG ??
    path.join(os.homedir(), ".config/notes-along-the-way/media.json");
  const raw = JSON.parse(await fs.readFile(configPath, "utf8"));
  if (process.env.MEDIA_BUCKET) raw.bucket = process.env.MEDIA_BUCKET;
  if (process.env.MEDIA_REGION) raw.region = process.env.MEDIA_REGION;
  if (process.env.MEDIA_DISTRIBUTION_ID)
    raw.distributionId = process.env.MEDIA_DISTRIBUTION_ID;
  const operator = operatorSchema.parse(raw);
  const settings = mediaSettings();
  const invalidate = async (key: string) => {
    if (!operator.distributionId)
      throw Error("Set distributionId for invalidation");
    const result = await new CloudFrontClient({ region: operator.region }).send(
      new CreateInvalidationCommand({
        DistributionId: operator.distributionId,
        InvalidationBatch: {
          CallerReference: `media-${Date.now()}`,
          Paths: { Quantity: 1, Items: ["/" + key] },
        },
      }),
    );
    return result.Invalidation?.Id;
  };
  if (action === "invalidate") {
    const key = mediaKey(input.replace(/^media:/, ""));
    console.log(
      JSON.stringify({
        url: mediaUrl("media:" + key),
        apply: flags.has("--apply"),
        invalidation: flags.has("--apply") ? await invalidate(key) : undefined,
      }),
    );
    return;
  }
  const file = await fs.readFile(input);
  const extension = path.extname(input).toLowerCase();
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  const contentType = types[extension];
  if (!contentType)
    throw Error("Supported files: PNG, JPEG, WebP, AVIF, GIF, SVG, PDF");
  if (
    extension === ".pdf" &&
    !file.subarray(0, 1024).includes(Buffer.from("%PDF-"))
  )
    throw Error("Invalid PDF header");
  if (extension === ".svg" && !file.toString().includes("<svg"))
    throw Error("Invalid SVG");
  const dimensions = contentType.startsWith("image/")
    ? await sharp(file).metadata()
    : undefined;
  const sha256 = createHash("sha256").update(file).digest("hex");
  const key = mediaKey(
    values.get("--key") ??
      `${contentType === "application/pdf" ? "documents" : "images"}/${sha256}${extension}`,
  );
  if (path.extname(key).toLowerCase() !== extension)
    throw Error("Key extension must match uploaded file");
  if (flags.has("--replace") && !values.has("--key"))
    throw Error("--replace requires an explicit --key");
  const reference = "media:" + key;
  const url = mediaUrl(reference);
  let invalidation;
  if (flags.has("--apply")) {
    await new S3Client({ region: operator.region }).send(
      new PutObjectCommand({
        Bucket: operator.bucket,
        ExpectedBucketOwner: operator.accountId,
        Key: "published/" + key,
        Body: file,
        ContentType: contentType,
        ContentDisposition: "inline",
        CacheControl: `public, max-age=0, s-maxage=${settings.cacheSeconds}, must-revalidate`,
        Metadata: { sha256 },
        ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
        ...(!flags.has("--replace") ? { IfNoneMatch: "*" } : {}),
      }),
    );
    if (flags.has("--replace") && operator.distributionId)
      invalidation = await invalidate(key);
  }
  const alt = (values.get("--alt") ?? path.basename(input)).replace(
    /[\[\]\\\r\n]/g,
    " ",
  );
  console.log(
    JSON.stringify(
      {
        applied: flags.has("--apply"),
        key,
        reference,
        url,
        sha256,
        bytes: file.length,
        contentType,
        width: dimensions?.width,
        height: dimensions?.height,
        invalidation,
        markdown: `${contentType.startsWith("image/") ? "!" : ""}[${alt}](${reference})`,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
