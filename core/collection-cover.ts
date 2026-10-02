import sharp from "sharp";
import { Assets } from "./assets";
import type { Collection } from "./model";
import { imageAssetStem } from "./image-filenames";

export async function collectionCover(
  cover: Collection["cover"],
  directory: string,
  assets: Assets,
) {
  if (!cover) return undefined;
  const bytes = await assets.read(directory, cover.path);
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  const meta = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
    throw Error("Collection cover must be PNG, JPEG or WebP.");
  const normalized = await image.rotate().webp({ quality: 90 }).toBuffer();
  const { width, height } = await sharp(normalized).metadata();
  return {
    src: await assets.emit(normalized, ".webp", imageAssetStem(cover.path)),
    alt: cover.alt,
    width,
    height,
  };
}
