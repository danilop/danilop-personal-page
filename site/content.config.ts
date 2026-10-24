import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { file } from "astro/loaders";
const pieces = defineCollection({
  loader: file(".generated/pieces.json"),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    language: z.string().default("en"),
    url: z.string(),
    publishedAt: z.string().optional(),
    html: z.string(),
    minutes: z.number(),
    narration: z
      .object({
        url: z.string(),
        sha256: z.string(),
        duration: z.number().positive(),
        voice: z.string(),
        segments: z.array(
          z.object({
            kind: z.enum([
              "title",
              "subtitle",
              "heading",
              "paragraph",
              "adaptation",
            ]),
            text: z.string(),
            pause: z.number(),
          }),
        ),
      })
      .optional(),
    tags: z.array(z.string()),
    updatedAt: z.string().optional(),
    collections: z.array(z.object({ title: z.string(), url: z.string() })),
  }),
});
const groups = defineCollection({
  loader: file(".generated/collections.json"),
});
export const collections = { pieces, groups };
