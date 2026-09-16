import fs from "node:fs";
import { z } from "zod";

export const mediaSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseUrl: z.url().refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash
      );
    }, "Media base URL must be HTTPS without credentials, query or fragment"),
    cacheSeconds: z.number().int().min(0).max(3600),
  })
  .strict();
export function mediaSettings() {
  const config = JSON.parse(fs.readFileSync("publishing/media.json", "utf8"));
  if (process.env.MEDIA_BASE_URL) config.baseUrl = process.env.MEDIA_BASE_URL;
  return mediaSchema.parse(config);
}
/** Safe paths relative to the CDN root, never S3's private prefixes. */
export function mediaKey(value: string) {
  if (
    !value ||
    value.length > 800 ||
    !value
      .split("/")
      .every(
        (part) =>
          /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part) &&
          part !== "." &&
          part !== "..",
      )
  )
    throw Error("Media key must contain safe relative path segments");
  return value;
}
export function mediaUrl(value: string, baseUrl = mediaSettings().baseUrl) {
  if (!value.startsWith("media:")) return value;
  const base = mediaSchema.shape.baseUrl.parse(baseUrl);
  return base.replace(/\/$/, "") + "/" + mediaKey(value.slice(6));
}
