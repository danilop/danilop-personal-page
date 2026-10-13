import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { z } from "zod";
import {
  digestAsset,
  emptyAssetManifest,
  readAssetManifest,
  sourceRecord,
  verifyAsset,
  hydrateManagedAsset,
} from "./asset-manifest";
import {
  generatedSchema,
  runtimeHash,
  type GeneratedNarration,
} from "./narration-runtime";
import {
  settingsSchema,
  speechDigest,
  type SpeechDocument,
  type SpeechSegment,
} from "./narration-speech";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const narrationRecordSchema = z
  .object({
    pieceId: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    speechHash: hash,
    reviewHash: hash,
    profileHash: hash,
    settings: settingsSchema,
    segments: z.array(
      z.object({
        kind: z.enum(["title", "heading", "paragraph", "adaptation"]),
        text: z.string().min(1),
        pause: z.number().nonnegative(),
      }),
    ),
    audio: generatedSchema.omit({ id: true, done: true }).extend({
      path: z
        .string()
        .regex(
          /^content\/pieces\/[a-z0-9-]+\/assets\/narration-[a-f0-9]{64}\.mp3$/,
        ),
    }),
  })
  .strict();
export type NarrationRecord = z.infer<typeof narrationRecordSchema>;
const indexSchema = z
  .object({
    schemaVersion: z.literal(1),
    renditions: z.record(z.string(), narrationRecordSchema),
  })
  .strict();
const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    required: z.boolean(),
    profiles: z.record(z.string(), hash),
  })
  .strict();
export async function narrationPolicy(root: string) {
  try {
    return policySchema.parse(
      YAML.parse(
        await fs.readFile(path.join(root, "publishing/narration.yaml"), "utf8"),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return {
        schemaVersion: 1,
        required: false,
        profiles: {} as Record<string, string>,
      };
    throw error;
  }
}
export async function narrationIndex(root: string) {
  try {
    return indexSchema.parse(
      JSON.parse(
        await fs.readFile(
          path.join(root, "publishing/narrations.json"),
          "utf8",
        ),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return {
        schemaVersion: 1 as const,
        renditions: {} as Record<string, NarrationRecord>,
      };
    throw error;
  }
}
/** Validate MP3 frame coverage without an encoder, speech runtime or network. */
export function mp3Duration(bytes: Buffer) {
  let offset = 0,
    seconds = 0,
    frames = 0;
  if (bytes.subarray(0, 3).toString() === "ID3")
    offset =
      10 +
      (((bytes[6] & 127) << 21) |
        ((bytes[7] & 127) << 14) |
        ((bytes[8] & 127) << 7) |
        (bytes[9] & 127));
  while (offset + 4 <= bytes.length) {
    if (
      bytes.subarray(offset, offset + 3).toString() === "TAG" &&
      offset + 128 === bytes.length
    )
      break;
    const { length, duration } = mp3Frame(bytes, offset);
    if (offset + length > bytes.length) throw Error("Truncated narration MP3");
    offset += length;
    seconds += duration;
    frames++;
  }
  if (frames < 2 || (offset !== bytes.length && offset + 128 !== bytes.length))
    throw Error("Incomplete narration MP3");
  return seconds;
}
function mp3Frame(bytes: Buffer, offset: number) {
  const h = bytes.readUInt32BE(offset),
    version = (h >>> 19) & 3,
    layer = (h >>> 17) & 3;
  if (h >>> 21 !== 2047 || version === 1 || layer !== 1)
    throw Error("Invalid narration MP3 frame");
  const rateIndex = (h >>> 10) & 3,
    bitIndex = (h >>> 12) & 15;
  const rates = [44100, 48000, 32000];
  const ratesK =
    version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  if (rateIndex === 3 || !ratesK[bitIndex])
    throw Error("Invalid narration MP3 bitrate");
  const rate = rates[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  const samples = version === 3 ? 1152 : 576;
  const length =
    Math.floor(((samples / 8) * ratesK[bitIndex] * 1000) / rate) +
    ((h >>> 9) & 1);

  return { length, duration: samples / rate };
}
export async function verifyNarration(
  root: string,
  doc: SpeechDocument,
  online = false,
) {
  const policy = await narrationPolicy(root);
  const r = (await narrationIndex(root)).renditions[doc.key];
  if (doc.issues.some((i) => !i.resolved))
    throw Error(
      `${doc.pieceId}: Needs explanation. Review the Narration panel.`,
    );
  if (!r)
    throw Error(
      `${doc.pieceId}: Not prepared. Run npm run narration:prepare -- ${doc.pieceId}`,
    );
  if (
    r.speechHash !== doc.speechHash ||
    r.reviewHash !== doc.reviewHash ||
    speechDigest(r.segments) !== speechDigest(doc.segments)
  )
    throw Error(
      `${doc.pieceId}: Out of date. Prepare narration for the saved article.`,
    );
  if (
    !policy.profiles[r.settings.profile] ||
    policy.profiles[r.settings.profile] !== r.profileHash
  )
    throw Error(`${doc.pieceId}: Narration profile is retired or invalid`);
  verifyTimings(r, doc);
  const asset = (await readAssetManifest(root))?.sources[r.audio.path];
  if (
    !asset ||
    asset.sha256 !== r.audio.sha256 ||
    asset.bytes !== r.audio.bytes ||
    asset.contentType !== "audio/mpeg"
  )
    throw Error("Narration byte inventory disagrees with the rendition");
  const file = path.join(root, r.audio.path);
  if (online)
    await hydrateManagedAsset(path.dirname(file), path.basename(file));
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(file);
  } catch {
    try {
      bytes = await fs.readFile(
        path.join(root, ".asset-cache", r.audio.sha256 + ".mp3"),
      );
    } catch {
      throw Error(
        `${doc.pieceId}: Missing local audio. Run npm run narration:check -- --hydrate before committing.`,
      );
    }
  }
  verifyAsset(bytes, asset, r.audio.path);
  if (Math.abs(mp3Duration(bytes) - r.audio.duration) > 0.2)
    throw Error("Narration duration disagrees with encoded audio");
  return r;
}

function verifyTimings(r: NarrationRecord, doc: SpeechDocument) {
  if (
    r.audio.timings.length !== doc.segments.length ||
    r.audio.timings.some(
      (t, i) =>
        t.end <= t.start ||
        Math.abs(t.start - (i ? r.audio.timings[i - 1].end : 0)) > 0.001,
    ) ||
    Math.abs(r.audio.timings.at(-1)!.end - r.audio.duration) > 0.001
  )
    throw Error("Incomplete narration segment coverage");
}

type Change = { file: string; before: string | null; after: string };
async function current(root: string, file: string) {
  return fs.readFile(path.join(root, file), "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}
async function replace(root: string, file: string, text: string) {
  const full = path.join(root, file),
    temp = full + "." + crypto.randomUUID() + ".tmp";
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(temp, text);
  await fs.rename(temp, full);
}
export async function narrationLock<T>(root: string, action: () => Promise<T>) {
  const state = path.join(root, ".authoring-state");
  await fs.mkdir(state, { recursive: true });
  const file = path.join(state, "write.lock");
  const lock = await fs.open(file, "wx").catch(() => {
    throw Error(
      "Another save is active. Retry; after a crash stop the editor, remove .authoring-state/write.lock, and run narration:recover.",
    );
  });
  try {
    await recoverNarration(root);
    return await action();
  } finally {
    await lock.close();
    await fs.rm(file, { force: true });
  }
}
/** Complete a journal only if every file still equals its before or after state. */
export async function recoverNarration(root: string) {
  const file = ".authoring-state/narration-transaction.json",
    text = await current(root, file);
  if (!text) return;
  const changes = z
    .array(
      z
        .object({
          file: z
            .string()
            .regex(
              /^(publishing\/(?:narrations\.json|audiobooks\.json|media-assets\.json)|content\/pieces\/[a-z0-9-]+\/(?:index\.md|narration\.yaml)|content\/collections\/[a-z0-9-]+\.yaml)$/,
            ),
          before: z.string().nullable(),
          after: z.string(),
        })
        .strict(),
    )
    .parse(JSON.parse(text));
  for (const c of changes) {
    const now = await current(root, c.file);
    if (now !== c.before && now !== c.after)
      throw Error(
        `Narration recovery conflict: ${c.file}. Preserve edits before resolving the journal.`,
      );
  }
  for (const c of changes) await replace(root, c.file, c.after);
  await fs.rm(path.join(root, file));
}
export async function commitNarration(
  root: string,
  doc: SpeechDocument,
  generated: GeneratedNarration,
  source?: { file: string; text: string },
  extra?: {
    sources: Record<string, import("./asset-manifest").AssetRecord>;
    updates: { file: string; text: string }[];
  },
) {
  const bytes = await fs.readFile(
    path.join(
      root,
      ".authoring-state/narration/jobs",
      generated.id,
      "audio.mp3",
    ),
  );
  if (
    digestAsset(bytes) !== generated.sha256 ||
    bytes.length !== generated.bytes ||
    Math.abs(mp3Duration(bytes) - generated.duration) > 0.2
  )
    throw Error("Generated narration failed byte verification");
  const logical = `content/pieces/${doc.pieceId}/assets/narration-${generated.sha256}.mp3`;
  await fs.mkdir(path.dirname(path.join(root, logical)), { recursive: true });
  await fs.writeFile(path.join(root, logical), bytes);
  await fs.mkdir(path.join(root, ".asset-cache"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".asset-cache", generated.sha256 + ".mp3"),
    bytes,
  );
  const manifest = (await readAssetManifest(root)) ?? emptyAssetManifest();
  Object.assign(manifest.sources, extra?.sources);
  manifest.sources[logical] = sourceRecord(logical, bytes);
  const index = await narrationIndex(root);
  const { id: _id, done: _done, ...audio } = generated;
  const record = narrationRecordSchema.parse({
    pieceId: doc.pieceId,
    title: doc.title,
    settings: doc.settings,
    speechHash: doc.speechHash,
    reviewHash: doc.reviewHash,
    profileHash: await runtimeHash(root),
    segments: doc.segments,
    audio: { ...audio, path: logical },
  });
  index.renditions[doc.key] = record;
  const updates = [
    {
      file: "publishing/media-assets.json",
      text: JSON.stringify(manifest, null, 2) + "\n",
    },
    {
      file: "publishing/narrations.json",
      text: JSON.stringify(index, null, 2) + "\n",
    },
    {
      file: `content/pieces/${doc.pieceId}/narration.yaml`,
      text: YAML.stringify(doc.settings),
    },
    ...(extra?.updates ?? []),
    ...(source ? [source] : []),
  ];
  await commitNarrationChanges(root, updates);
  return record;
}
export async function commitNarrationChanges(
  root: string,
  updates: { file: string; text: string }[],
) {
  const changes: Change[] = await Promise.all(
    updates.map(async (u) => ({
      file: u.file,
      before: await current(root, u.file),
      after: u.text,
    })),
  );
  await replace(
    root,
    ".authoring-state/narration-transaction.json",
    JSON.stringify(changes),
  );
  await recoverNarration(root);
}
export type PublicNarration = {
  url: string;
  sha256: string;
  duration: number;
  voice: string;
  segments: SpeechSegment[];
};
