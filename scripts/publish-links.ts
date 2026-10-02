import { deployment, siteUrl } from "../core/deployment.mjs";
import { loadEditions } from "../core/editions";
import { execFileSync } from "node:child_process";
import { AmplifyClient, ListJobsCommand } from "@aws-sdk/client-amplify";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { loadLibrary, readYaml } from "../core/model";
import { compileLinks, linksSchema } from "../core/shortlinks";
import {
  ShortLinkStorage,
  shortLinkConfig,
  redirectTarget,
} from "../core/shortlink-storage";
import { siteConfig } from "../core/config";

async function main() {
  const apply = process.argv.includes("--apply");
  if (apply && !deployment.indexable)
    throw Error("External publication is disabled for this preview deployment");
  const config = await siteConfig(),
    lib = await loadLibrary(),
    manifest = linksSchema.parse(await readYaml("publishing/links.yaml"));
  const links = compileLinks(manifest, lib, config.url, await loadEditions());
  const revision =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const rollback = rollbackKey();
  if (!apply && !rollback) {
    console.log(
      JSON.stringify(
        {
          revision,
          links,
          deactivate: Object.keys(manifest.links).filter(
            (code) => !(code in links),
          ),
          removed: manifest.removed,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (apply) requireCommittedContent();
  const infra = await shortLinkConfig();
  if (infra.canonicalOrigin !== config.url)
    throw Error("Infrastructure canonical origin differs from the website");
  if (rollback) {
    await restoreTargets(infra, rollback, links, manifest, config.url);
    if (!apply) {
      console.log(JSON.stringify({ revision, rollback, links }, null, 2));
      return;
    }
  }
  if (process.argv.includes("--wait")) await waitForDeployment(infra, revision);
  const verify = async () => {
    const response = await fetch(
      siteUrl("/build.json", config.url) + "?revision=" + revision,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok || (await response.json()).revision !== revision)
      throw Error("This source revision is not the currently deployed website");
  };
  await verify();
  for (const url of Object.values(links)) {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200)
      throw Error(`Destination unavailable: ${url} (${response.status})`);
  }
  const result = await new ShortLinkStorage(infra).publish(
    manifest,
    links,
    revision,
    verify,
  );
  console.log(
    `Published ${result.changes.length} alias changes and ${result.removed.length} removals for ${revision}.`,
  );
}
function requireCommittedContent() {
  if (process.env.GITHUB_ACTIONS) return;
  const dirty = execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      "content",
      "publishing",
    ],
    { encoding: "utf8" },
  ).trim();
  if (dirty)
    throw Error(
      "Commit and deploy saved content and link reservations before publishing redirects",
    );
}
function rollbackKey() {
  const rollbackIndex = process.argv.indexOf("--rollback");
  const rollback =
    rollbackIndex < 0 ? undefined : process.argv[rollbackIndex + 1];
  if (
    rollbackIndex >= 0 &&
    (!rollback ||
      !/^publication\/shortlinks\/snapshots\/[a-zA-Z0-9-]+\.json$/.test(
        rollback,
      ))
  )
    throw Error("Specify an exact publication/shortlinks/snapshots/*.json key");
  return rollback;
}
async function waitForDeployment(
  infra: Awaited<ReturnType<typeof shortLinkConfig>>,
  revision: string,
) {
  if (!infra.amplifyAppId)
    throw Error("Configure amplifyAppId before waiting for deployment");
  const amplify = new AmplifyClient({ region: infra.region });
  for (let n = 0; n < 180; n++) {
    const jobs = await amplify.send(
      new ListJobsCommand({
        appId: infra.amplifyAppId,
        branchName: "main",
        maxResults: 20,
      }),
    );
    const job = jobs.jobSummaries?.find((j) => j.commitId === revision);
    if (job?.status === "SUCCEED") break;
    if (job && ["FAILED", "CANCELLED"].includes(job.status!))
      throw Error(`Site deployment ${job.status}`);
    if (n === 179) throw Error("Timed out waiting for exact site deployment");
    await new Promise((r) => setTimeout(r, 10000));
  }
}
async function restoreTargets(
  infra: Awaited<ReturnType<typeof shortLinkConfig>>,
  rollback: string,
  links: Record<string, string>,
  manifest: ReturnType<typeof linksSchema.parse>,
  canonicalOrigin: string,
) {
  const snapshot = await new S3Client({ region: infra.region }).send(
    new GetObjectCommand({ Bucket: infra.bucket, Key: rollback }),
  );
  const before = JSON.parse(await snapshot.Body!.transformToString())
    .before as Record<string, string>;
  for (const [code, target] of Object.entries(before))
    if (code in links && !manifest.links[code]?.edition)
      links[code] = redirectTarget(target, canonicalOrigin);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
