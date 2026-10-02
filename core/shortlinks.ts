import { siteUrl } from "./deployment.mjs";
import { z } from "zod";
import { editionUrl, type Edition } from "./editions";
import { allowed, articleUrl, collectionUrl, type Library } from "./model";
const code = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const linksSchema = z
  .object({
    schemaVersion: z.literal(1),
    removed: z.record(code, z.string().min(1)).default({}),
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
  resolveAliases();
  validateOwnership();
  return result;

  function resolveAliases() {
    for (const [alias, t] of Object.entries(config.links))
      resolveAlias(alias, t);
  }
  function resolveAlias(
    alias: string,
    t: z.infer<typeof linksSchema>["links"][string],
  ) {
    if (
      ["api", "assets", "media", "www", "admin", "index", "not-found"].includes(
        alias,
      )
    )
      throw Error(`Reserved alias ${alias}`);
    if (config.removed[alias])
      throw Error(`Removed alias ${alias} cannot be reused`);
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
        result[alias] = siteUrl(editionUrl(edition), origin);
      return;
    }
    if (t.scenario)
      throw Error(
        "Scenario aliases must target an authored public experiment piece",
      );
    if (!p && !c) throw Error(`Unknown alias target ${t.ref}`);
    if (p && allowed(p, "standalone"))
      result[alias] = siteUrl(articleUrl(p), origin);
    else if (c?.status === "published")
      result[alias] = siteUrl(collectionUrl(c), origin);
  }

  function validateOwnership() {
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
    validateEditionOwnership();

    function validateEditionOwnership() {
      for (const edition of editions)
        if (edition.shortCode) {
          if (owned.has(edition.shortCode))
            throw Error(`Short-code collision ${edition.shortCode}`);
          owned.set(edition.shortCode, edition.collection + "@" + edition.id);
          const target = config.links[edition.shortCode];
          if (
            target?.ref !== edition.collection ||
            target?.edition !== edition.id
          )
            throw Error(`Unregistered edition short code ${edition.shortCode}`);
        }
    }
  }
}

// Remove only explicitly managed aliases. Unrelated keys and ownership history survive.
export function reconcileLinks(
  input: unknown,
  links: Record<string, string>,
  existing: Record<string, string>,
  owners: Record<string, string>,
) {
  const manifest = linksSchema.parse(input);
  const after = { ...existing, ...links };
  const nextOwners = { ...owners };
  const deletions: string[] = [];
  for (const [alias, target] of Object.entries(manifest.links)) {
    if (manifest.removed[alias])
      throw Error(`Removed alias ${alias} cannot be reused`);
    const owner = [target.ref, target.edition].filter(Boolean).join("@");
    if (owners[alias] && owners[alias] !== owner)
      throw Error(`Alias ${alias} already belongs to ${owners[alias]}`);
    // Refuse to adopt or delete an existing cloud key with unknown ownership.
    if (alias in existing && !owners[alias])
      throw Error(`Missing owner for ${alias}`);
    nextOwners[alias] = owner;
    if (!(alias in links) && alias in existing) {
      delete after[alias];
      deletions.push(alias);
    }
  }
  removeDeletedAliases();
  return { after, owners: nextOwners, deletions };

  function removeDeletedAliases() {
    for (const [alias, owner] of Object.entries(manifest.removed)) {
      if (owners[alias] && owners[alias] !== owner)
        throw Error(`Alias ${alias} already belongs to ${owners[alias]}`);
      if (alias in existing && !owners[alias])
        throw Error(`Missing owner for ${alias}`);
      nextOwners[alias] = owner;
      if (alias in existing) {
        delete after[alias];
        deletions.push(alias);
      }
    }
  }
}
