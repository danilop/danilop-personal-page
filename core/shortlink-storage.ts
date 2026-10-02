import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { z } from "zod";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { linksSchema, reconcileLinks } from "./shortlinks";

export const redirectCacheControl = "public, max-age=0, s-maxage=60";
const origin = z.url().refine((s) => {
  const u = new URL(s);
  return (
    u.protocol === "https:" && !u.username && !u.password && u.origin === s
  );
});
const shortLinkConfigSchema = z
  .object({
    schemaVersion: z.literal(2),
    resolver: z.literal("s3-oac"),
    bucket: z.string().min(1),
    distributionId: z.string().min(1),
    region: z.string().default("eu-west-1"),
    shortOrigin: origin,
    canonicalOrigin: origin,
    amplifyAppId: z.string().optional(),
  })
  .passthrough();
export type ShortLinkConfig = z.infer<typeof shortLinkConfigSchema>;
export async function shortLinkConfig(root = process.cwd()) {
  const filename =
    process.env.NOTES_LINKS_CONFIG ??
    path.join(os.homedir(), ".config/notes-along-the-way/links.json");
  // CI can provide an explicitly configured file; machine inventories stay outside Git.
  const absolute = path.isAbsolute(filename)
    ? filename
    : path.join(root, filename);
  return shortLinkConfigSchema.parse(
    JSON.parse(await fs.readFile(absolute, "utf8")),
  );
}
export function redirectTarget(value: string, canonicalOrigin: string) {
  const u = new URL(value);
  if (
    u.origin !== canonicalOrigin ||
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 33 ||
        character.charCodeAt(0) === 127 ||
        character === "\\",
    )
  )
    throw Error("Redirect target must be on the canonical HTTPS site");
  return value;
}
const aliasKey = (code: string) => {
  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(code) ||
    ["index", "not-found"].includes(code)
  )
    throw Error("Invalid or reserved short code");
  return "redirects/" + code;
};
function isMissing(error: unknown) {
  return (
    error instanceof Error && ["NoSuchKey", "NotFound"].includes(error.name)
  );
}

type RedirectObjects = Awaited<ReturnType<ShortLinkStorage["inspect"]>>;

export class ShortLinkStorage {
  constructor(
    public config: ShortLinkConfig,
    private s3 = new S3Client({ region: config.region }),
    private cloudfront = new CloudFrontClient({ region: "us-east-1" }),
  ) {}
  async inspect() {
    const objects: Record<
      string,
      { target: string; owner: string; etag: string; cacheControl: string }
    > = {};
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: "redirects/",
          ContinuationToken: token,
        }),
      );
      for (const item of page.Contents ?? []) {
        const code = item.Key!.slice("redirects/".length);
        if (["index", "not-found"].includes(code)) continue;
        if (!/^[a-z0-9][a-z0-9-]{0,63}\/?$/.test(code)) continue;
        const value = await this.s3.send(
          new HeadObjectCommand({ Bucket: this.config.bucket, Key: item.Key }),
        );
        objects[code] = {
          target: value.WebsiteRedirectLocation ?? "",
          owner: value.Metadata?.owner ?? "",
          etag: value.ETag!,
          cacheControl: value.CacheControl ?? "",
        };
      }
      token = page.NextContinuationToken;
    } while (token);
    return objects;
  }
  async ownership(): Promise<{
    owners: Record<string, string>;
    etag?: string;
  }> {
    try {
      const result = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: "publication/shortlinks/owners.json",
        }),
      );
      return {
        owners: z
          .record(z.string(), z.string())
          .parse(JSON.parse(await result.Body!.transformToString())),
        etag: result.ETag,
      };
    } catch (error) {
      if (!isMissing(error)) throw error;
      return { owners: {} };
    }
  }
  async publish(
    input: unknown,
    targets: Record<string, string>,
    revision: string,
    verify: () => Promise<void>,
  ) {
    const manifest = linksSchema.parse(input);
    for (const [code, target] of Object.entries(targets)) {
      aliasKey(code);
      redirectTarget(target, this.config.canonicalOrigin);
    }
    await verify();
    const lockKey = "publication/shortlinks/lock.json";
    const lock = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: lockKey,
        Body: JSON.stringify({
          revision,
          token: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }),
        IfNoneMatch: "*",
        ContentType: "application/json",
      }),
    );
    try {
      const objects = await this.inspect();
      const existing = Object.fromEntries(
        Object.entries(objects)
          .filter(([code]) => !code.endsWith("/"))
          .map(([code, object]) => [code, object.target]),
      );
      const { owners, etag: ownerEtag } = await this.ownership();
      for (const [code, value] of Object.entries(objects)) {
        const owner = owners[code.replace(/\/$/, "")];
        if (!owner || value.owner !== owner)
          throw Error(`Missing or conflicting ownership for ${code}`);
      }
      for (const [code, target] of Object.entries(targets)) {
        if (
          owners[code]?.includes("@") &&
          existing[code] &&
          existing[code] !== target
        )
          throw Error("A fixed edition alias cannot change");
      }
      const next = reconcileLinks(manifest, targets, existing, owners);
      await verify();
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: `publication/shortlinks/snapshots/${revision}-${Date.now()}-${crypto.randomUUID()}.json`,
          Body: JSON.stringify({
            revision,
            before: existing,
            after: next.after,
            owners: next.owners,
          }),
          IfNoneMatch: "*",
          ContentType: "application/json",
        }),
      );
      // Claim ownership before first writes. Retain it after withdrawals.
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: "publication/shortlinks/owners.json",
          Body: JSON.stringify(next.owners),
          ContentType: "application/json",
          ...(ownerEtag ? { IfMatch: ownerEtag } : { IfNoneMatch: "*" }),
        }),
      );
      const changes = await this.writeTargets(
        targets,
        next.owners,
        objects,
        verify,
      );
      const deletions = new Set([
        ...next.deletions,
        ...Object.keys(manifest.removed),
        ...Object.keys(manifest.links).filter((code) => !(code in targets)),
      ]);
      const removed = await this.withdraw(deletions, objects, verify);
      if (changes.length || removed.length)
        await this.invalidate([...changes, ...removed]);
      return { changes, removed };
    } finally {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: lockKey,
          IfMatch: lock.ETag,
        }),
      );
    }
  }
  private async writeTargets(
    targets: Record<string, string>,
    owners: Record<string, string>,
    objects: RedirectObjects,
    verify: () => Promise<void>,
  ) {
    const changes: string[] = [];
    for (const [code, target] of Object.entries(targets)) {
      const owner = owners[code];
      let changed = false;
      for (const suffix of ["", "/"]) {
        const key = aliasKey(code) + suffix,
          old = objects[code + suffix];
        if (old?.target === target && old.cacheControl === redirectCacheControl)
          continue;
        await verify();
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
            // The body changes with the destination, so ETags guard metadata-only edits too.
            Body: JSON.stringify({ target, owner }),
            WebsiteRedirectLocation: target,
            CacheControl: redirectCacheControl,
            ContentType: "application/json",
            Metadata: { owner },
            ...(old ? { IfMatch: old.etag } : { IfNoneMatch: "*" }),
          }),
        );
        changed = true;
      }
      if (changed) changes.push(code);
    }
    return changes;
  }
  private async withdraw(
    deletions: Set<string>,
    objects: RedirectObjects,
    verify: () => Promise<void>,
  ) {
    const removed: string[] = [];
    for (const code of deletions) {
      aliasKey(code);
      let changed = false;
      for (const suffix of ["", "/"]) {
        const old = objects[code + suffix];
        if (!old) continue;
        await verify();
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: aliasKey(code) + suffix,
            IfMatch: old.etag,
          }),
        );
        changed = true;
      }
      if (changed) removed.push(code);
    }
    return removed;
  }
  async invalidate(codes: string[]) {
    return this.cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          CallerReference: crypto.randomUUID(),
          Paths: {
            Quantity: codes.length * 2,
            Items: codes.flatMap((code) => {
              aliasKey(code);
              return ["/" + code, "/" + code + "/"];
            }),
          },
        },
      }),
    );
  }
}
