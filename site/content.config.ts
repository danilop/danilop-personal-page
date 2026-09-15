import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { file } from "astro/loaders";
const pieces = defineCollection({
  loader: file(".generated/pieces.json"),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    url: z.string(),
    publishedAt: z.string(),
    html: z.string(),
    minutes: z.number(),
    tags: z.array(z.string()),
    updatedAt: z.string().optional(),
    collections: z.array(z.object({ title: z.string(), url: z.string() })),
  }),
});
const groups = defineCollection({
  loader: file(".generated/collections.json"),
});
export const collections = { pieces, groups };
