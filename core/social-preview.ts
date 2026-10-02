import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { load } from "cheerio";
import { Assets, escape } from "./assets";
import { localPath } from "./deployment.mjs";
import type { CompiledSite } from "./site-data";

export type SocialImage = {
  src: string;
  alt: string;
  type: "image/jpeg";
  width: number;
  height: number;
};
const width = 1200,
  height = 630;

/** Read only prepared local media. Never fetch external URLs during a build. */
async function preparedImage(src: string, publicDir: string) {
  const relative = localPath(src);
  if (!relative.startsWith("/") || relative.startsWith("//")) return undefined;
  const root = await fs.realpath(publicDir);
  const file = await fs.realpath(path.resolve(root, "." + relative));
  if (!file.startsWith(root + path.sep))
    throw Error("Social image escapes public assets");
  const input = await fs.readFile(file);
  const metadata = await sharp(input, {
    limitInputPixels: 40_000_000,
  }).metadata();
  return ["png", "jpeg", "webp", "avif", "gif"].includes(metadata.format ?? "")
    ? input
    : undefined;
}

export function firstSocialImage(html: string) {
  const $ = load(html);
  const image = $("img[src]")
    .filter((_, element) => {
      const src = $(element).attr("src") ?? "";
      return /^\/(?!\/).*\.(?:png|jpe?g|webp|avif|gif)$/i.test(src);
    })
    .first();
  const src = image.attr("src");
  return src ? { src, alt: image.attr("alt") ?? "" } : undefined;
}

/** Fits a complete illustration/portrait cover; never crop important artwork. */
export async function socialCard(
  title: string,
  brand: string,
  assets: Assets,
  image?: { src: string; alt: string },
  publicDir = ".generated/public",
): Promise<SocialImage> {
  const input = image ? await preparedImage(image.src, publicDir) : undefined;
  let output: Buffer;
  if (input) {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(width, height, { fit: "contain", background: "#f6f3eb" })
      .flatten({ background: "#f6f3eb" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } else {
    const text = await sharp({
      text: {
        text: `<span foreground="#13191c">${escape(title)}</span>`,
        font: "sans bold 64",
        width: 1032,
        height: 330,
        rgba: true,
        wrap: "word-char",
      },
    })
      .png()
      .toBuffer();
    const label = await sharp({
      text: {
        text: `<span foreground="#164b88">${escape(brand)}</span>`,
        font: "sans 28",
        width: 1032,
        height: 42,
        rgba: true,
        wrap: "word-char",
      },
    })
      .png()
      .toBuffer();
    output = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "#f6f3eb",
      },
    })
      .composite([
        { input: text, left: 84, top: 100 },
        { input: label, left: 84, top: 510 },
      ])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  }
  if (output.length > 1_000_000)
    throw Error("Social card exceeds the 1 MB budget");
  return {
    src: await assets.emit(output, ".jpg", "social-preview"),
    alt: input ? image!.alt : `${title} — ${brand}`,
    type: "image/jpeg",
    width,
    height,
  };
}

export async function prepareSocialPreviews(
  site: Pick<CompiledSite, "articles" | "collections">,
  assets: Assets,
  brand: string,
  publicDir = ".generated/public",
) {
  const pages: Record<string, SocialImage> = {};
  const card = (title: string, image?: { src: string; alt: string }) =>
    socialCard(title, brand, assets, image, publicDir);
  for (const article of site.articles)
    pages[article.url] = await card(
      article.title,
      firstSocialImage(article.html),
    );
  for (const collection of site.collections) {
    pages[collection.url] = await card(collection.title, collection.cover);
    for (const node of collection.nodes) {
      if (node.planned) continue;
      const route = `${collection.url}${node.kind === "piece" ? "read" : "chapters"}/${node.id}/`;
      pages[route] = await card(
        node.title,
        firstSocialImage(node.html) ?? collection.cover,
      );
    }
  }
  return { default: await card(brand), pages };
}
