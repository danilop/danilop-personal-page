import fs from "node:fs/promises";
import path from "node:path";
import { deployment, siteOutput, sitePath } from "../core/deployment.mjs";

async function walk(dir: string): Promise<string[]> {
  return (
    await Promise.all(
      (await fs.readdir(dir, { withFileTypes: true })).map(async (e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
async function main() {
  // Remove prior root artifacts without touching the current nested build.
  if (deployment.basePath !== "/") {
    const top = deployment.basePath.split("/")[1];
    for (const entry of await fs.readdir("dist"))
      if (entry !== top)
        await fs.rm(path.join("dist", entry), { recursive: true, force: true });
  }
  if (!deployment.preserveOriginal) return;
  const original = "legacy/snapshot-2026-09-15";
  for (const name of await fs.readdir(original))
    await fs.cp(path.join(original, name), path.join("dist", name), {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  // Verify all original bytes, not just the homepage title.
  for (const file of await walk(original)) {
    const relative = path.relative(original, file);
    if (
      !(await fs.readFile(file)).equals(
        await fs.readFile(path.join("dist", relative)),
      )
    )
      throw Error(`Original site changed: ${relative}`);
  }
  await fs.copyFile(siteOutput + "/404.html", "dist/404.html");
  const previousRobots = await fs
    .readFile(original + "/robots.txt", "utf8")
    .catch((e) => {
      if (e.code !== "ENOENT") throw e;
      return "User-agent: *\nAllow: /\n";
    });
  if (!deployment.indexable)
    await fs.writeFile(
      "dist/robots.txt",
      previousRobots.trimEnd() +
        `\n\nUser-agent: *\nDisallow: ${sitePath("/")}\n`,
    );
  console.log(
    `Preserved original site at /; new site at ${deployment.basePath}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
