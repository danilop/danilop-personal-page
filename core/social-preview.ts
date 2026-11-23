import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { load } from "cheerio";
import { Assets, escape } from "./assets";
import { localPath } from "./deployment.mjs";
import type { CompiledSite } from "./site-data";
import { digestAsset } from "./asset-manifest";
import { pinnedRecipeBytes, recordRecipe } from "./asset-build";

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
async function preparedImage(src: string, publicDir: string, figure = false) {
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
  const formats = [
    "png",
    "jpeg",
    "webp",
    "avif",
    "gif",
    ...(figure ? ["svg"] : []),
  ];
  return formats.includes(metadata.format ?? "") ? input : undefined;
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

/** The rendered chart or diagram an article names with `homeImage`. */
export function chosenSocialImage(html: string, anchor: string) {
  const $ = load(html);
  const image = $(`figure.rich-block[id="${anchor}"] img[src]`).first();
  const src = image.attr("src");
  return src && /^\/(?!\/).*\.svg$/i.test(src)
    ? { src, alt: image.attr("alt") ?? "", figure: true }
    : undefined;
}

/**
 * A chart or diagram card: the title above the figure on paper, so the figure's
 * own labels stay readable in a link preview.
 */
async function figureCard(title: string, brand: string, svg: Buffer) {
  const heading = await sharp({
    text: {
      text: `<span foreground="#13191c">${escape(title)}</span>`,
      font: "sans bold 40",
      width: 1032,
      height: 110,
      rgba: true,
      wrap: "word-char",
    },
  })
    .png()
    .toBuffer();
  const label = await sharp({
    text: {
      text: `<span foreground="#164b88">${escape(brand)}</span>`,
      font: "sans 22",
      width: 1032,
      height: 32,
      rgba: true,
      wrap: "word-char",
    },
  })
    .png()
    .toBuffer();
  const chart = await sharp(svg, { density: 288, limitInputPixels: 40_000_000 })
    .resize(1032, 380, {
      fit: "contain",
      background: "#f6f3eb",
      position: "left",
    })
    .flatten({ background: "#f6f3eb" })
    .png()
    .toBuffer();
  return sharp({
    create: { width, height, channels: 3, background: "#f6f3eb" },
  })
    .composite([
      { input: heading, left: 84, top: 48 },
      { input: chart, left: 84, top: 176 },
      { input: label, left: 84, top: 574 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** Fits a complete illustration/portrait cover; never crop important artwork. */
export async function socialCard(
  title: string,
  brand: string,
  assets: Assets,
  image?: { src: string; alt: string; figure?: boolean },
  publicDir = ".generated/public",
): Promise<SocialImage> {
  const input = image
    ? await preparedImage(image.src, publicDir, image.figure)
    : undefined;
  const recipe = digestAsset(
    JSON.stringify({
      version: 1,
      title,
      brand,
      image: input ? digestAsset(input) : null,
      ...(input && image?.figure ? { layout: "figure" } : {}),
    }),
  );
  const pinned = await pinnedRecipeBytes(recipe);
  let output: Buffer;
  if (pinned) output = pinned;
  else if (input && image?.figure)
    output = await figureCard(title, brand, input);
  else if (input) {
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
  const src = await assets.emit(output, ".jpg", "social-preview");
  await recordRecipe(recipe, path.basename(src));
  return {
    src,
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
  homeImages: Map<string, string> = new Map(),
) {
  const pages: Record<string, SocialImage> = {};
  const card = (
    title: string,
    image?: { src: string; alt: string; figure?: boolean },
  ) => socialCard(title, brand, assets, image, publicDir);
  for (const article of site.articles) {
    const chosen = homeImages.get(article.id);
    pages[article.url] = await card(
      article.title,
      (chosen && chosenSocialImage(article.html, `${article.id}-${chosen}`)) ||
        firstSocialImage(article.html),
    );
  }
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
