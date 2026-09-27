import { parseOptions } from "../core/cli-options";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { stageAuthoring } from "../core/authoring-preview";
import type { ImportOptions } from "../core/content-import";
async function main() {
  const repository = process.cwd(),
    args = process.argv.slice(2);
  const options: ImportOptions = {
    from: "content",
    pieces: [],
    collections: [],
    excludePieces: [],
    excludeCollections: [],
  };
  let port = 4322,
    buildOnly = false;
  if (
    !parseOptions(args, {
      help: () => {
        console.log(
          "npm run preview -- --snapshot [--from LIBRARY] [--piece ID | --collection ID | --all] [--exclude-piece ID] [--exclude-collection ID] [--port 4322] [--build-only]\nNo selection includes all active content and drafts in content/. Selected drafts are visible only in an isolated local snapshot. Re-run to rebuild after edits.",
        );
      },
      values: {
        "--from": (value) => {
          options.from = value;
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
        "--port": (value) => {
          port = Number(value);
        },
      },
      flags: {
        "--all": () => {
          options.all = true;
        },
        "--build-only": () => {
          buildOnly = true;
        },
      },
    })
  )
    return;
  const select = validateSelection();
  // Review source files before creating the isolated rendering workspace.
  const qualityArgs = [
    "--import",
    "tsx",
    "scripts/quality.ts",
    "--source",
    options.from,
  ];
  if (
    options.collections!.length === 1 &&
    !options.pieces!.length &&
    !options.all
  )
    qualityArgs.push("--collection", options.collections![0]);
  execFileSync(process.execPath, qualityArgs, {
    cwd: repository,
    stdio: "inherit",
  });
  const { workspace, context } = await stageAuthoring(
    repository,
    options,
    select,
  );
  const output = path.join(repository, "exports/authoring-preview");
  const env = {
    ...process.env,
    NOTES_AUTHORING_PREVIEW: "1",
    NOTES_BASE_PATH: "/",
    GIT_DIR: execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
      encoding: "utf8",
    }).trim(),
    GIT_WORK_TREE: workspace,
  };
  try {
    for (const command of ["prepare:site", "build:prepared"])
      execFileSync(
        process.execPath,
        [process.env.npm_execpath!, "run", command],
        { cwd: workspace, env, stdio: "inherit" },
      );
    await fs.mkdir(output, { recursive: true });
    // Copy only finished public-shaped output, not the authoring workspace or source files.
    const incoming = path.join(output, "next");
    await fs.rm(incoming, { recursive: true, force: true });
    await fs.cp(path.join(workspace, "dist"), incoming, { recursive: true });
    await fs.rm(path.join(output, "site"), { recursive: true, force: true });
    await fs.rename(incoming, path.join(output, "site"));
    await fs.writeFile(
      path.join(output, "selection.json"),
      JSON.stringify({ ...context, workspace: undefined }, null, 2) + "\n",
    );
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
  console.log(
    `Authoring preview: ${context.pieces.length} draft pieces, ${context.collections.length} draft collections. Sources and release dist are unchanged.`,
  );
  if (buildOnly) {
    console.log(`Built ${output}/site`);
    return;
  }
  const child = spawn(
    process.execPath,
    [
      "scripts/preview-site.mjs",
      "--snapshot",
      "--serve-only",
      "--port",
      String(port),
    ],
    { stdio: "inherit" },
  );
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      process.exitCode = code ?? 0;
      resolve();
    });
  });

  function validateSelection() {
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw Error("Choose a port between 1024 and 65535");
    if (
      !args.includes("--from") &&
      !options.pieces!.length &&
      !options.collections!.length
    )
      options.all = true;
    const select = Boolean(
      options.all || options.pieces!.length || options.collections!.length,
    );
    if (
      !select &&
      (args.includes("--from") ||
        options.excludePieces!.length ||
        options.excludeCollections!.length)
    )
      throw Error(
        "Select --piece, --collection or --all for external sources/exclusions",
      );
    if (process.env.CI || process.env.AWS_BRANCH)
      throw Error("Authoring preview is local only");
    return select;
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
