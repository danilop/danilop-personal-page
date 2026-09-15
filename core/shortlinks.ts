import { z } from "zod";
import { editionUrl, type Edition } from "./editions";
import { allowed, articleUrl, collectionUrl, type Library } from "./model";
const code = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const linksSchema = z
  .object({
    schemaVersion: z.literal(1),
    links: z.record(
      code,
      z
        .object({
          ref: z.string(),
          edition: z.string().optional(),
          scenario: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export function compileLinks(
  input: unknown,
  lib: Library,
  origin: string,
  editions: Edition[] = [],
) {
  const config = linksSchema.parse(input),
    result: Record<string, string> = {};
  for (const [alias, t] of Object.entries(config.links)) {
    if (["api", "assets", "media", "www", "admin"].includes(alias))
      throw Error(`Reserved alias ${alias}`);
    const p = lib.pieces.get(t.ref);
    const c = lib.collections.find((c) => c.id === t.ref);
    if (t.edition && t.scenario)
      throw Error("An alias cannot target both an edition and a scenario");
    if (t.edition) {
      const edition = editions.find(
        (e) => e.collection === t.ref && e.id === t.edition,
      );
      if (!edition) throw Error("Unknown edition alias target");
      if (edition.status === "published")
        result[alias] = new URL(editionUrl(edition), origin).href;
      continue;
    }
    if (t.scenario)
      throw Error(
        "Scenario aliases must target an authored public experiment piece",
      );
    if (!p && !c) throw Error(`Unknown alias target ${t.ref}`);
    if (p && allowed(p, "standalone"))
      result[alias] = new URL(articleUrl(p), origin).href;
    else if (c?.status === "published")
      result[alias] = new URL(collectionUrl(c), origin).href;
  }
  const owned = new Map<string, string>();
  for (const p of [...lib.pieces.values(), ...lib.collections])
    if (p.shortCode) {
      if (owned.has(p.shortCode) && owned.get(p.shortCode) !== p.id)
        throw Error(`Short-code collision ${p.shortCode}`);
      owned.set(p.shortCode, p.id);
      if (
        config.links[p.shortCode]?.ref !== p.id ||
        config.links[p.shortCode]?.edition
      )
        throw Error(`Unregistered short code ${p.shortCode}`);
    }
  for (const edition of editions)
    if (edition.shortCode) {
      if (owned.has(edition.shortCode))
        throw Error(`Short-code collision ${edition.shortCode}`);
      owned.set(edition.shortCode, edition.collection + "@" + edition.id);
      const target = config.links[edition.shortCode];
      if (target?.ref !== edition.collection || target?.edition !== edition.id)
        throw Error(`Unregistered edition short code ${edition.shortCode}`);
    }
  return result;
}
