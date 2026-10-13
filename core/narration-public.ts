import type { Library, Piece } from "./model";
import { speechDocument, voices } from "./narration-speech";
import {
  narrationPolicy,
  verifyNarration,
  type PublicNarration,
} from "./narration-store";
import type { Assets } from "./assets";
import path from "node:path";
import fs from "node:fs/promises";
import { generatedSchema, runtimeHash } from "./narration-runtime";
import { digestAsset } from "./asset-manifest";
export async function publicNarration(
  root: string,
  piece: Piece,
  lib: Library,
  assets: Assets,
  preview: boolean,
  title = piece.title,
): Promise<PublicNarration | undefined> {
  const policy = await narrationPolicy(root);
  try {
    const doc = await speechDocument(root, piece, lib, undefined, title);
    const r = await verifyNarration(
      root,
      doc,
      Boolean(process.env.CI || process.env.AWS_BRANCH),
    );
    return {
      url: await assets.copy(
        piece.dir,
        path.relative(piece.dir, path.join(root, r.audio.path)),
      ),
      sha256: r.audio.sha256,
      duration: r.audio.duration,
      voice: voices[r.settings.voice],
      segments: r.segments,
    };
  } catch (error) {
    if (policy.required && !preview) throw error;
    if (preview) return privateNarration(root, piece, lib, assets, title);
    return undefined;
  }
}
async function privateNarration(
  root: string,
  piece: Piece,
  lib: Library,
  assets: Assets,
  title: string,
) {
  try {
    const doc = await speechDocument(root, piece, lib, undefined, title);
    if (doc.issues.some((i) => !i.resolved)) return undefined;
    const receipt = JSON.parse(
      await fs.readFile(
        path.join(
          root,
          ".authoring-state/narration/renditions",
          doc.speechHash + ".json",
        ),
        "utf8",
      ),
    );
    const result = generatedSchema.parse(receipt.result);
    if (
      receipt.profileHash !== (await runtimeHash(root)) ||
      result.timings.length !== doc.segments.length
    )
      return undefined;
    const bytes = await fs.readFile(
      path.join(
        root,
        ".authoring-state/narration/jobs",
        result.id,
        "audio.mp3",
      ),
    );
    if (digestAsset(bytes) !== result.sha256 || bytes.length !== result.bytes)
      return undefined;
    return {
      url: await assets.emit(bytes, ".mp3"),
      sha256: result.sha256,
      duration: result.duration,
      voice: voices[doc.settings.voice],
      segments: doc.segments,
    };
  } catch {
    return undefined;
  } // A stale private preview never makes a public rendition ready.
}
