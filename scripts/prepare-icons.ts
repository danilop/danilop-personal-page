import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { localAsset } from "../core/assets";

/** Derive all browser icons from one editable vector; filenames refresh cached icons. */
export async function prepareIcons(source: string, publicDir: string, paper: string) {
  const svg = await fs.readFile(await localAsset(process.cwd(), source));
  const metadata = await sharp(svg).metadata();
  if (metadata.format !== "svg" || metadata.width !== metadata.height)
    throw new Error("The favicon source must be a square SVG.");
  const hash = crypto.createHash("sha256").update(svg).update(paper).digest("hex").slice(0, 12);
  const base = `/brand/favicon-${hash}`;
  await fs.mkdir(path.join(publicDir, "brand"), { recursive: true });
  await fs.writeFile(path.join(publicDir, `${base}.svg`), svg);
  const images = await Promise.all(
    [16, 32, 48].map((size) => sharp(svg).resize(size, size).png().toBuffer()),
  );
  // ICO directory with PNG entries, supported by modern browsers and Windows.
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const entry = 6 + 16 * i;
    header[entry] = header[entry + 1] = [16, 32, 48][i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  const ico = Buffer.concat([header, ...images]);
  await fs.writeFile(path.join(publicDir, `${base}.ico`), ico);
  await fs.writeFile(path.join(publicDir, "favicon.ico"), ico);
  await sharp(svg).resize(180, 180).flatten({ background: paper }).png()
    .toFile(path.join(publicDir, `${base}-apple.png`));
  return { svg: `${base}.svg`, ico: `${base}.ico`, apple: `${base}-apple.png` };
}
