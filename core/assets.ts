import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export const hash = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
export const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function safeUrl(s: string) {
  const u = new URL(s);
  if (u.protocol !== "https:" && u.protocol !== "http:")
    throw Error("Only HTTP(S) URLs are supported");
  return u.href;
}
export async function localAsset(owner: string, relative: string) {
  if (path.isAbsolute(relative)) throw Error("Asset paths must be relative");
  const root = await fs.realpath(owner);
  const file = await fs.realpath(path.resolve(owner, relative));
  if (!file.startsWith(root + path.sep))
    throw Error(`Asset escapes source directory: ${relative}`);
  return file;
}
export class Assets {
  dependencies = new Map<string, string>();
  constructor(public out = ".generated/public/media") {}
  async read(owner: string, relative: string) {
    const file = await localAsset(owner, relative);
    const data = await fs.readFile(file);
    this.dependencies.set(file, hash(data));
    return data;
  }
  async emit(data: Uint8Array | string, extension: string) {
    if (!/^\.[a-z0-9]+$/.test(extension))
      throw Error("Invalid asset extension");
    const name = hash(typeof data === "string" ? data : data) + extension;
    await fs.mkdir(this.out, { recursive: true });
    await fs.writeFile(path.join(this.out, name), data);
    return "/media/" + name;
  }
  async copy(owner: string, relative: string) {
    const data = await this.read(owner, relative);
    return this.emit(data, path.extname(relative).toLowerCase());
  }
}
