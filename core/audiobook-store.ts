import { speechDigest } from "./narration-speech";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generatedSchema } from "./narration-runtime";
import {
  narrationPolicy,
  mp3Duration,
  commitNarrationChanges,
} from "./narration-store";
import {
  digestAsset,
  readAssetManifest,
  emptyAssetManifest,
  sourceRecord,
  verifyAsset,
  hydrateManagedAsset,
} from "./asset-manifest";
import type { BookPlan } from "./audiobook-plan";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const segment = z.object({
  id: z.string(),
  placement: z.string(),
  label: z.string(),
  depth: z.number().int().nonnegative(),
  navigation: z.boolean(),
  contentHash: hash,
  kind: z.enum(["title", "heading", "paragraph", "adaptation"]),
  text: z.string().min(1),
  pause: z.number().nonnegative(),
});
export const bookRecordSchema = z
  .object({
    bookId: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    author: z.string(),
    hash,
    profileHash: hash,
    profile: z.string(),
    complete: z.boolean(),
    createdAt: z.iso.datetime(),
    partial: z.array(z.string()),
    segments: z.array(segment).min(1),
    audio: generatedSchema.omit({ id: true, done: true }).extend({
      path: z
        .string()
        .regex(/^content\/collections\/assets\/audiobook-[a-f0-9]{64}\.mp3$/),
    }),
  })
  .strict();
export type BookRecord = z.infer<typeof bookRecordSchema>;
export type PublicAudiobook = BookRecord & {
  url: string;
  filename: string;
  preview: boolean;
};
export async function bookIndex(root: string, preview = false) {
  const file = preview
    ? ".authoring-state/audiobooks/index.json"
    : "publishing/audiobooks.json";
  try {
    return z
      .object({
        schemaVersion: z.literal(1),
        books: z.record(z.string(), bookRecordSchema),
      })
      .strict()
      .parse(JSON.parse(await fs.readFile(path.join(root, file), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {
      schemaVersion: 1 as const,
      books: {} as Record<string, BookRecord>,
    };
  }
}
export async function bookBytes(root: string, r: BookRecord, online = false) {
  const asset = (await readAssetManifest(root))?.sources[r.audio.path];
  if (online && asset)
    await hydrateManagedAsset(
      path.join(root, "content/collections"),
      path.relative("content/collections", r.audio.path),
    );
  const bytes = await fs
    .readFile(path.join(root, r.audio.path))
    .catch(() =>
      fs.readFile(path.join(root, ".asset-cache", r.audio.sha256 + ".mp3")),
    );
  if (
    digestAsset(bytes) !== r.audio.sha256 ||
    bytes.length !== r.audio.bytes ||
    Math.abs(mp3Duration(bytes) - r.audio.duration) > 0.2
  )
    throw Error("Audiobook audio integrity or duration check failed");
  return bytes;
}
export async function verifyBook(root: string, plan: BookPlan, online = false) {
  if (plan.doc.issues.some((i) => !i.resolved))
    throw Error(
      "Audiobook needs reviewed explanations: " +
        plan.doc.issues
          .filter((i) => !i.resolved)
          .map((i) => i.id)
          .join(", "),
    );
  const r = (await bookIndex(root, plan.preview)).books[plan.bookId];
  if (
    !r ||
    r.hash !== plan.hash ||
    speechDigest(r.segments) !== speechDigest(plan.segments)
  )
    throw Error(
      `${plan.bookId}: audiobook is missing or out of date; prepare it in preview or with audiobook:prepare`,
    );
  if ((await narrationPolicy(root)).profiles[r.profile] !== r.profileHash)
    throw Error("Audiobook runtime profile is retired");
  const t = r.audio.timings;
  if (
    t.length !== r.segments.length ||
    t.some(
      (v, i) =>
        v.end <= v.start || Math.abs(v.start - (i ? t[i - 1].end : 0)) > 0.001,
    ) ||
    Math.abs(t.at(-1)!.end - r.audio.duration) > 0.001
  )
    throw Error("Audiobook timing coverage is incomplete");
  const bytes = await bookBytes(root, r, online);
  if (!plan.preview) {
    const asset = (await readAssetManifest(root))?.sources[r.audio.path];
    if (!asset || asset.contentType !== "audio/mpeg")
      throw Error("Audiobook is missing from the asset inventory");
    verifyAsset(bytes, asset, r.audio.path);
  }
  return r;
}
export async function bookUpdates(root: string, records: BookRecord[]) {
  const index = await bookIndex(root),
    sources: Record<string, import("./asset-manifest").AssetRecord> = {};
  for (const r of records) {
    sources[r.audio.path] = sourceRecord(
      r.audio.path,
      await bookBytes(root, r),
    );
    index.books[r.bookId] = r;
  }
  return {
    sources,
    updates: [
      {
        file: "publishing/audiobooks.json",
        text: JSON.stringify(index, null, 2) + "\n",
      },
    ],
  };
}
/** Caller owns the narration write lock and has rechecked the source fingerprint. */
export async function commitBooks(
  root: string,
  records: BookRecord[],
  source?: { file: string; text: string },
) {
  const extra = await bookUpdates(root, records),
    manifest = (await readAssetManifest(root)) ?? emptyAssetManifest();
  Object.assign(manifest.sources, extra.sources);
  await commitNarrationChanges(root, [
    {
      file: "publishing/media-assets.json",
      text: JSON.stringify(manifest, null, 2) + "\n",
    },
    ...extra.updates,
    ...(source ? [source] : []),
  ]);
}
