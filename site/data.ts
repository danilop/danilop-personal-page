import fs from "node:fs";
import type { CompiledSite } from "../core/site-data";
export const site = JSON.parse(
  fs.readFileSync(".generated/site.json", "utf8"),
) as CompiledSite;
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
