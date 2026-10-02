import path from "node:path";
import YAML from "yaml";
import matter from "gray-matter";
import { AuthorStore } from "../core/author-store";
import { id as pieceId, loadLibrary, pieceSchema } from "../core/model";

async function main() {
  // This edits local source only. Commit and push are separate operator actions.
  const args = process.argv.slice(2);
  if (args.length !== 1)
    throw Error("Usage: npm run article:publish -- <piece-id>");
  const id = pieceId.parse(args[0]);
  const root = process.cwd(),
    store = new AuthorStore(root);
  const lib = await loadLibrary();
  const piece = lib.pieces.get(id);
  if (!piece) throw Error(`Unknown article: ${id}`);
  if (piece.status === "retired")
    throw Error("Restore the retired article before publishing it.");
  const file = path.relative(root, path.join(piece.dir, "index.md"));
  const old = await store.read(file);
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/.exec(old.text)!;
  const doc = YAML.parseDocument(match[2]);
  doc.delete("status");
  doc.set("draft", false);
  const saved = await store.save(
    file,
    match[1] + doc.toString().trimEnd() + match[3] + match[4],
    old.revision,
    async (text) => {
      pieceSchema.parse(
        matter(text, {
          engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
        }).data,
      );
    },
  );
  const data = matter(saved.text, {
    engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
  }).data;
  console.log(
    `Published locally: ${id} (${data.publishedAt}). Review, commit and push to main for Amplify delivery.`,
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
