import { loadLibrary } from "../core/model";
import { freezeEdition, verifyEdition } from "../core/books";
async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => args[args.indexOf(name) + 1];
  if (args[0] === "verify") {
    console.log(await verifyEdition(args[1]));
    return;
  }
  const lib = await loadLibrary(
    args.includes("--root") ? value("--root") : "content",
  );
  const c = lib.collections.find((c) => c.id === value("--collection"));
  if (!c) throw Error("Specify --collection <ID>");
  const edition = value("--edition");
  if (!args.includes("--edition")) throw Error("Specify a new --edition <ID>");
  const output = await freezeEdition(
    c,
    lib,
    edition,
    args.includes("--output") ? value("--output") : "exports",
    {
      preview: args.includes("--preview"),
      excludePlanned: args.includes("--exclude-planned"),
      exporter: args.includes("--exporter") ? value("--exporter") : "markua",
    },
  );
  console.log(`Frozen manuscript: ${output}`);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
