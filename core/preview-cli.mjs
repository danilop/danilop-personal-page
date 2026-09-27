export function previewOptions(args) {
  const flags = new Set([
    "--release",
    "--snapshot",
    "--serve-only",
    "--build-only",
    "--all",
    "--help",
    "--watch",
  ]);
  const values = new Set([
    "--port",
    "--from",
    "--piece",
    "--collection",
    "--exclude-piece",
    "--exclude-collection",
  ]);
  const seen = new Set(),
    snapshotArgs = [];
  let port = 4322;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!flags.has(arg) && !values.has(arg))
      throw Error(`Unknown option: ${arg}. Use npm run preview -- --help.`);
    seen.add(arg);
    if (flags.has(arg)) {
      if (arg === "--all" || arg === "--build-only") snapshotArgs.push(arg);
      continue;
    }
    const value = args[++i];
    if (!value || value.startsWith("--"))
      throw Error(`Missing value for ${arg}`);
    if (arg !== "--port") {
      snapshotArgs.push(arg, value);
      continue;
    }
    if (!/^\d+$/.test(value))
      throw Error("Choose a port between 1024 and 65535");
    port = Number(value);
  }
  validateOptions(seen, snapshotArgs, port);
  return {
    mode: previewMode(seen),
    port,
    help: seen.has("--help"),
    watch: seen.has("--watch"),
    snapshotArgs: [...snapshotArgs, "--port", String(port)],
  };
}
function previewMode(seen) {
  if (seen.has("--release")) return "release";
  if (!seen.has("--snapshot")) return "live";
  return seen.has("--serve-only") ? "snapshot-output" : "snapshot";
}
function validateOptions(seen, snapshotArgs, port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Choose a port between 1024 and 65535");
  if (seen.has("--release") && seen.has("--snapshot"))
    throw Error("Choose --release or --snapshot, not both");
  if (seen.has("--watch") && (seen.has("--release") || seen.has("--snapshot")))
    throw Error(
      "--watch is for the live editor; omit --release and --snapshot",
    );
  if (
    (snapshotArgs.length || seen.has("--serve-only")) &&
    !seen.has("--snapshot")
  )
    throw Error(
      "Selection, --build-only and --serve-only options require --snapshot",
    );
  if (seen.has("--serve-only") && snapshotArgs.length)
    throw Error(
      "--serve-only uses the existing snapshot; omit selection/build options",
    );
}

export function previewLaunchArgs(options) {
  return [
    ...(options.watch ? ["--watch", "--watch-preserve-output"] : []),
    "--import",
    "tsx",
    options.mode === "live"
      ? "scripts/author.ts"
      : "scripts/preview-authoring.ts",
    ...(options.mode === "live"
      ? ["--port", String(options.port)]
      : options.snapshotArgs),
  ];
}
export const previewHelp = `npm run preview -- [--watch] [--port 4322]
  Full local site with drafts, Edit links, editor and automatic refresh.
  --watch also restarts the server when its imported application code changes.
  Refresh the editor tab to load changed browser scripts; unsaved work is not auto-reloaded.
npm run preview -- --release [--port 4322]
  Serve the existing production dist/; build it first. No drafts or editor.
npm run preview -- --snapshot [--from LIBRARY] [--piece ID | --collection ID | --all]
  [--exclude-piece ID] [--exclude-collection ID] [--build-only] [--port 4322]
  Read-only snapshot, with content checks before building. Repeat selections as needed.
npm run preview -- --snapshot --serve-only [--port 4322]
  Serve the existing snapshot without rebuilding.
All modes bind to 127.0.0.1. Stop with Ctrl+C before switching modes.`;
