import { z } from "zod";
import { readYaml } from "./model";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const asset = z
  .object({
    path: z.string(),
    alt: z.string(),
    fit: z.enum(["contain", "cover"]).default("contain"),
    position: z.enum(["center", "top", "bottom"]).default("center"),
  })
  .strict();
export const siteSchema = z
  .object({
    schemaVersion: z.literal(1),
    url: z.url(),
    relaunchDate: z.iso.date(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    theme: z.enum(["ink-and-paper", "plain"]),
    layout: z.enum(["editorial", "linear"]),
    tokens: z
      .object({
        paper: color.default("#f6f3eb"),
        ink: color.default("#13191c"),
        accent: color.default("#164b88"),
        muted: color.default("#586371"),
        rule: color.default("#708091"),
        hairline: color.default("#c9c9c3"),
        serif: z.enum(["Newsreader", "Georgia"]).default("Newsreader"),
        sans: z.enum(["Inter", "system-ui"]).default("Inter"),
        width: z.number().min(800).max(1600).default(1230),
      })
      .strict(),
    assets: z
      .object({ portrait: asset, biography: asset, hero: asset.optional() })
      .strict(),
    overrideCss: z.string().optional(),
  })
  .strict();
export type SiteConfig = z.infer<typeof siteSchema>;
export async function siteConfig() {
  return siteSchema.parse(await readYaml("publishing/site.yaml"));
}
export const homeSchema = z
  .object({
    schemaVersion: z.literal(1),
    lead: z.string().optional(),
    recentCount: z.number().int().min(0).max(20),
    elsewhereCount: z.number().int().min(0).max(20),
    collections: z.array(z.string()),
  })
  .strict();
export function tokensCss(c: SiteConfig) {
  const t = c.tokens;
  return `:root{--paper:${t.paper};--ink:${t.ink};--blue:${t.accent};--muted:${t.muted};--rule:${t.rule};--hairline:${t.hairline};--serif:${t.serif},Georgia,serif;--sans:${t.sans},sans-serif;--page-width:${t.width}px}`;
}
