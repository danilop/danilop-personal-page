import fs from "node:fs/promises";
import { leanpub } from "../core/leanpub";
import { verifyEdition } from "../core/books";
async function main() {
  const [action, folder, slug, ...args] = process.argv.slice(2);
  if (!["preview", "status", "publish"].includes(action))
    throw Error(
      "Usage: leanpub <preview|status|publish> <edition-folder> <existing-book-slug> --source-synced",
    );
  const manifest = await verifyEdition(folder);
  if (action === "publish" && manifest.preview)
    throw Error(
      "A preview manuscript cannot be published as a released edition",
    );
  if (action !== "status" && !args.includes("--source-synced"))
    throw Error(
      "Sync the reviewed manuscript to this existing Leanpub book before requesting preview or publication",
    );
  if (action === "publish" && !args.includes("--publish-reviewed-edition"))
    throw Error(
      "Review the Leanpub preview before using --publish-reviewed-edition",
    );
  const key = process.env.LEANPUB_API_KEY;
  if (!key)
    throw Error(
      "Set LEANPUB_API_KEY in the local environment; never in a source file",
    );
  const publisher = leanpub(key);
  const result =
    action === "preview"
      ? await publisher.preview(slug)
      : action === "publish"
        ? await publisher.publish(
            slug,
            args.includes("--notes")
              ? args[args.indexOf("--notes") + 1]
              : "Updated edition",
          )
        : await publisher.status(slug);
  await fs.writeFile(
    folder + "/leanpub-job.json",
    JSON.stringify(
      { action, slug, result, requestedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(
    `Leanpub ${action} response saved beside the local edition; private result URLs are not printed.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
