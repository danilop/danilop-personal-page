import fs from "node:fs";

export function deploymentSettings(input, override = undefined) {
  const basePath = override ?? input.basePath;
  if (typeof basePath !== "string" || !/^\/(?:[a-z0-9-]+\/)*$/.test(basePath))
    throw Error(
      "Deployment basePath must be / or a slash-terminated lowercase path",
    );
  if (
    typeof input.indexable !== "boolean" ||
    typeof input.preserveOriginal !== "boolean"
  )
    throw Error(
      "Deployment requires explicit indexable and preserveOriginal flags",
    );
  // An explicit root override is used to verify the future cutover build.
  const preserveOriginal = override === "/" ? false : input.preserveOriginal;
  if (preserveOriginal && basePath === "/")
    throw Error("Preserving the original site requires a non-root basePath");
  return { basePath, indexable: input.indexable, preserveOriginal };
}

export const deployment = deploymentSettings(
  JSON.parse(fs.readFileSync("publishing/deployment.json", "utf8")),
  process.env.NOTES_BASE_PATH,
);

export function sitePath(value, base = deployment.basePath) {
  if (!value.startsWith("/") || value.startsWith("//") || base === "/")
    return value;
  const prefix = base.slice(0, -1);
  if (
    value === prefix ||
    value.startsWith(base) ||
    value.startsWith(prefix + "?") ||
    value.startsWith(prefix + "#")
  )
    return value;
  return prefix + value;
}

export function localPath(value, base = deployment.basePath) {
  return base !== "/" && value.startsWith(base)
    ? "/" + value.slice(base.length)
    : value;
}

export function siteUrl(value, origin, base = deployment.basePath) {
  return new URL(sitePath(value, base), origin).href;
}

// Astro outputs page paths without its base directory; packaging supplies it.
export const siteOutput =
  "dist" +
  (deployment.basePath === "/" ? "" : deployment.basePath.slice(0, -1));
