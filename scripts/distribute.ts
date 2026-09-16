import { deployment, siteUrl } from "../core/deployment.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { execFileSync } from "node:child_process";
import { loadLibrary, readYaml } from "../core/model";
import { siteConfig } from "../core/config";
import { safeUrl } from "../core/assets";
import {
  assignmentSchema,
  exportPublication,
  devAdapter,
  mediumAdapter,
  syncCopy,
  withLedger,
  withRemoteLedger,
  payloadHash,
} from "../core/distribution";
async function main() {
  if (process.argv.includes("--apply") && !deployment.indexable)
    throw Error("External publication is disabled for this preview deployment");
  const args = process.argv.slice(2),
    apply = args.includes("--apply");
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    const v = args[i + 1];
    if (!v || v.startsWith("--")) throw Error(`Missing ${flag} value`);
    return v;
  };
  const selectedPiece = value("--piece"),
    selectedDestination = value("--destination");
  const adopt = value("--adopt"),
    completed = value("--complete-manual");
  if (
    (adopt || completed) &&
    (!apply || !selectedPiece || !selectedDestination)
  )
    throw Error("Mapping changes require --apply --piece ID --destination ID");
  const lib = await loadLibrary(),
    config = await siteConfig();
  const destinations = (await readYaml("publishing/destinations.yaml"))
    .destinations;
  const assignments = z
    .object({
      schemaVersion: z.literal(1),
      assignments: z.array(assignmentSchema),
    })
    .strict()
    .parse(await readYaml("publishing/distribution.yaml"))
    .assignments.filter(
      (a) =>
        (!selectedPiece || a.piece === selectedPiece) &&
        (!selectedDestination || a.destination === selectedDestination),
    );
  if (!assignments.length) {
    if (selectedPiece || selectedDestination)
      throw Error("No matching enrolled article");
    console.log("No articles enrolled for external publication.");
    return;
  }
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const verify = async () => {
    const r = await fetch(siteUrl("/build.json", config.url), { cache: "no-store" });
    if (!r.ok || (await r.json()).revision !== revision)
      throw Error("Exact source revision is not deployed");
  };
  if (apply) {
    await verify();
    if (
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim()
    )
      throw Error("Commit reviewed changes before external delivery");
  }
  const store = process.env.PUBLICATION_BUCKET ? withRemoteLedger : withLedger;
  let failures = 0;
  await store(
    process.env.PUBLICATION_BUCKET ?? ".publication-state",
    async (ledger, save) => {
      for (const a of assignments) {
        const destination = destinations[a.destination],
          key = [a.piece, a.destination, destination?.account].join("/"),
          out = path.join("exports", "distribution", a.destination, a.piece);
        try {
          await fs.rm(out, { recursive: true, force: true });
          await fs.mkdir(out, { recursive: true });
          const p = lib.pieces.get(a.piece);
          if (!p) throw Error("Unknown piece " + a.piece);
          if (!destination) throw Error("Unknown destination " + a.destination);
          const exported = await exportPublication(p, lib, a, config.url, {
              plugin: destination.plugin,
            }),
            payload = exported.payload;
          await fs.writeFile(
            path.join(out, "article.md"),
            `# ${payload.title}\n\n${payload.body_markdown}`,
          );
          await fs.writeFile(
            path.join(out, "payload.json"),
            JSON.stringify(payload, null, 2) + "\n",
          );
          await fs.writeFile(
            path.join(out, "media-review.json"),
            JSON.stringify(
              { profile: exported.profile, media: exported.review },
              null,
              2,
            ) + "\n",
          );
          await fs.writeFile(
            path.join(out, "media-review.md"),
            `# Media review\n\nDestination: ${exported.profile}\n\n` +
              (exported.review
                .map(
                  (item) =>
                    `- **${item.action}**${item.block ? ` (${item.block})` : ""}: ${item.detail}${item.url ? `\n  ${item.url}` : ""}`,
                )
                .join("\n") || "No media conversions or embeds.") +
              "\n",
          );
          await fs.writeFile(
            path.join(out, "previous.md"),
            ledger[key]?.remote?.payload.body_markdown ?? "",
          );
          if (!apply) {
            console.log(`${key}: preview ready at ${out}`);
            continue;
          }
          await verify();
          const token = process.env[destination.credentialEnv ?? "DEV_API_KEY"];
          const adapter =
            destination.plugin === "medium-assisted"
              ? mediumAdapter
              : destination.plugin === "dev" && token
                ? devAdapter(token, destination.account)
                : undefined;
          if (!adapter)
            throw Error(
              `Configure ${destination.credentialEnv} before delivery`,
            );
          if (completed) {
            if (
              exported.review.some((item) => item.action === "embed-review") &&
              !args.includes("--embeds-reviewed")
            )
              throw Error(
                "Verify the native embeds in the destination editor, then include --embeds-reviewed",
              );
            if (adapter.capabilities.create)
              throw Error("Use --adopt for API destinations");
            const url = safeUrl(completed);
            if (
              new URL(url).hostname !== "medium.com" &&
              !new URL(url).hostname.endsWith(".medium.com")
            )
              throw Error("Completion URL must be on Medium");
            ledger[key] = {
              sourceRevision: revision,
              payloadHash: payloadHash(payload),
              manualUrl: url,
              status: "current",
              verification: "author",
              lastVerifiedAt: new Date().toISOString(),
            };
            await save();
            console.log(`${key}: author-confirmed ${url}`);
            continue;
          }
          if (adopt) {
            if (!/^\d+$/.test(adopt)) throw Error("Remote ID must be numeric");
            const remote = await adapter.read(Number(adopt));
            if (remote.payload.canonical_url !== payload.canonical_url)
              throw Error("Remote canonical URL does not match");
            ledger[key] = {
              sourceRevision: revision,
              payloadHash: "",
              remote,
              status: "pending",
              verification: "api",
              lastVerifiedAt: new Date().toISOString(),
            };
            await save();
            console.log(
              `${key}: mapped existing ID ${remote.id}; run a reviewed delivery to reconcile`,
            );
            continue;
          }
          for (const match of payload.body_markdown.matchAll(
            /!\[[^\]]*\]\((https:\/\/[^\s)]+)\)/g,
          )) {
            const r = await fetch(match[1], { method: "HEAD" });
            if (!r.ok)
              throw Error("Published image is unavailable: " + match[1]);
          }
          const result = await syncCopy(
            adapter,
            payload,
            revision,
            ledger[key],
            async (entry) => {
              ledger[key] = entry;
              await save();
            },
            a,
            args.includes("--reviewed"),
          );
          console.log(`${key}: ${result.status}`);
          if (["conflict", "failed"].includes(result.status)) failures++;
        } catch (error) {
          failures++;
          await fs.mkdir(out, { recursive: true });
          await fs.writeFile(
            path.join(out, "blocked.json"),
            JSON.stringify(
              { status: "blocked", error: String(error) },
              null,
              2,
            ) + "\n",
          );
          if (apply) {
            ledger[key] = {
              ...(ledger[key] ?? { sourceRevision: revision, payloadHash: "" }),
              status: "failed",
              error: String(error),
            };
            await save();
          }
          console.error(`${key}: ${String(error)}`);
        }
      }
    },
  );
  if (failures)
    throw Error(
      `${failures} deliveries need attention; other destinations were processed`,
    );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
