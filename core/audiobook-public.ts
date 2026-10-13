import { narrationPolicy } from "./narration-store";
import path from "node:path";
import type { Assets } from "./assets";
import type { Collection, Library } from "./model";
import { audiobookPlan } from "./audiobook-plan";
import { bookBytes, verifyBook, type PublicAudiobook } from "./audiobook-store";
export async function publicAudiobook(
  root: string,
  c: Collection,
  lib: Library,
  assets: Assets,
  preview: boolean,
): Promise<PublicAudiobook | undefined> {
  if (!c.book) return;
  try {
    const plan = await audiobookPlan(root, c, lib, preview),
      r = await verifyBook(
        root,
        plan,
        Boolean(process.env.CI || process.env.AWS_BRANCH),
      );
    const stem = `audiobook-${c.slug}-${r.createdAt.slice(0, 10)}`;
    const bytes = preview
      ? await bookBytes(root, r)
      : await assets.read(
          path.join(root, "content/collections"),
          path.relative("content/collections", r.audio.path),
        );
    const url = await assets.emit(bytes, ".mp3", stem);
    return {
      ...r,
      url,
      preview,
      filename: `${c.slug}-${r.createdAt.slice(0, 10)}-${r.hash.slice(0, 8)}.mp3`,
    };
  } catch (error) {
    if (!preview && (await narrationPolicy(root)).required) throw error;
    return undefined;
  }
}
