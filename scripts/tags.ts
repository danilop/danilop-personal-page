import { parseOptions } from "../core/cli-options";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildTagInventory,
  loadTagRegistry,
  readTagPieces,
} from "../core/tags";
import { renderTagReview } from "../core/tag-review";

async function main() {
  const args = process.argv.slice(2);
  const roots: string[] = [],
    files: string[] = [];
  let registry = "content/tags.yaml",
    review = "",
    json = false;
  if (
    !parseOptions(args, {
      help: () => {
        console.log(
          "npm run tags -- [--source ROOT] [--piece-file FILE] [--registry FILE] [--review PIECE_ID] [--json]\nRepeat --source or --piece-file as needed. Default source: content. HTML and JSON are written only to exports/tag-review/; serve that folder on loopback for private review.",
        );
      },
      values: {
        "--source": (value) => {
          roots.push(value);
        },
        "--piece-file": (value) => {
          files.push(value);
        },
        "--registry": (value) => {
          registry = value;
        },
        "--review": (value) => {
          review = value;
        },
      },
      flags: {
        "--json": () => {
          json = true;
        },
      },
    })
  )
    return;
  const inventory = buildTagInventory(
    await readTagPieces(roots.length ? roots : ["content"], files),
    await loadTagRegistry(registry),
  );
  if (review && !inventory.pieces.some((p) => p.id === review))
    throw Error(`Unknown review piece: ${review}`);
  const output = path.resolve("exports/tag-review");
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(output, "index.html"),
    renderTagReview(inventory, review),
  );
  await fs.writeFile(
    path.join(output, "inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );
  if (json) console.log(JSON.stringify(inventory, null, 2));
  else {
    console.table(
      inventory.rows.map((r) => ({
        tag: r.id,
        published: r.published,
        draft: r.draft,
        retired: r.retired,
        registered: r.registered,
      })),
    );
    if (review)
      for (const finding of inventory.reviews[review])
        console.log(`${finding.kind}: ${finding.message}`);
    console.log(
      `Private tag review: ${path.join(output, "index.html")}\nSource status counts; no publication or tag changes performed.`,
    );
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
