import { parseOptions } from "../core/cli-options";
import {
  prepareImport,
  applyImport,
  type ImportOptions,
} from "../core/content-import";
async function main() {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    from: "",
    pieces: [],
    collections: [],
    excludePieces: [],
    excludeCollections: [],
  };
  let apply = false,
    json = false,
    expected: string | undefined;
  if (
    !parseOptions(args, {
      help: () => {
        console.log(`npm run content:import -- --from LIBRARY [--to content]
Default: dry-run all active canonical pieces and collections; no files changed.
--piece ID / --collection ID  Select content (repeatable); collections include dependencies.
--exclude-piece ID / --exclude-collection ID  Exclude selected candidates (repeatable).
--all                       Explicitly select all active canonical content.
--update                    Allow changes to existing identities; preserve destination publication settings.
--apply                     Copy the validated plan; requires --all or an explicit selection.
--expect SHA256             Require the fingerprint printed by a previous dry run.
--json                      Print a machine-readable plan.
New imports are drafts. No source removal, publication, Git operation, or code execution.`);
      },
      values: {
        "--from": (value) => {
          options.from = value;
        },
        "--to": (value) => {
          options.to = value;
        },
        "--piece": (value) => {
          options.pieces!.push(value);
        },
        "--collection": (value) => {
          options.collections!.push(value);
        },
        "--exclude-piece": (value) => {
          options.excludePieces!.push(value);
        },
        "--exclude-collection": (value) => {
          options.excludeCollections!.push(value);
        },
        "--expect": (value) => {
          expected = value;
        },
      },
      flags: {
        "--apply": () => {
          apply = true;
        },
        "--all": () => {
          options.all = true;
        },
        "--update": () => {
          options.update = true;
        },
        "--json": () => {
          json = true;
        },
      },
    })
  )
    return;
  if (!options.from)
    throw Error(
      "Specify --from with the canonical content library, not a generated preview directory",
    );
  if (
    apply &&
    !options.all &&
    !options.pieces!.length &&
    !options.collections!.length
  )
    throw Error(
      "--apply requires --all, --piece or --collection; review the dry run first",
    );
  const prepared = await prepareImport(options);
  if (apply) await applyImport(prepared, expected);
  printPlan();

  function printPlan() {
    if (json)
      console.log(
        JSON.stringify(
          { mode: apply ? "applied" : "dry-run", ...prepared.plan },
          null,
          2,
        ),
      );
    else {
      console.log(
        `${apply ? "Applied" : "Dry run"}: ${prepared.plan.source} → ${prepared.plan.destination}`,
      );
      console.log(prepared.plan.selected.join("\n"));
      for (const file of prepared.plan.files)
        console.log(`${file.action.padEnd(10)} ${file.path}`);
      for (const warning of prepared.plan.warnings)
        console.log(`Note: ${warning}`);
      console.log(`Plan fingerprint: ${prepared.plan.fingerprint}`);
      console.log(
        apply
          ? "Import complete. Review the diff and run prepublish:check; nothing was published."
          : "No destination files changed. Review every listed file; rerun with --apply and optionally --expect <fingerprint>.",
      );
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
