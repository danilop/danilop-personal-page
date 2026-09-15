import fs from "node:fs/promises";
import { z } from "zod";
import { id, readYaml } from "./model";
export const editionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    collection: id,
    title: z.string().min(1),
    summary: z.string().min(1),
    status: z.enum(["draft", "published"]),
    publishedAt: z.iso.date(),
    sourceRevision: z.string().min(7),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    shortCode: id.optional(),
    artifacts: z
      .array(
        z
          .object({
            label: z.string(),
            url: z.url(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Edition = z.infer<typeof editionSchema>;
export async function loadEditions() {
  const editions: Edition[] = [];
  for (const name of await fs.readdir("content/editions"))
    if (name.endsWith(".yaml"))
      editions.push(
        editionSchema.parse(await readYaml("content/editions/" + name)),
      );
  const keys = new Set<string>();
  for (const e of editions) {
    const key = e.collection + "/" + e.id;
    if (keys.has(key)) throw Error("Duplicate edition " + key);
    keys.add(key);
    for (const a of e.artifacts)
      if (!a.url.startsWith("https://"))
        throw Error("Edition downloads require HTTPS");
  }
  return editions;
}
export const editionUrl = (e: Edition) => `/books/${e.collection}/${e.id}/`;
