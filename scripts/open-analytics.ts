import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { analyticsDashboardUrl } from "../core/analytics-dashboard";
import { openBrowser } from "../core/preview-browser.mjs";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      print: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
      notes: { type: "string" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: npm run analytics:open -- [traffic|collections|dashboards] [--print] [--notes PATH]\nReads the private operations note on each run. Traffic is the default; sign in to PostHog if prompted.",
    );
    return;
  }
  if (positionals.length > 1)
    throw new Error("Choose a single dashboard target. Use --help for usage.");
  const file =
    values.notes ??
    join(homedir(), ".config", "notes-along-the-way", "operations.md");
  let note: string;
  try {
    note = await readFile(file, "utf8");
  } catch {
    throw new Error(
      `Cannot read the private operations note at ${file}. See docs/private-operations.md to recover it.`,
    );
  }
  const url = analyticsDashboardUrl(note, positionals[0]);
  if (values.print) console.log(url);
  else {
    openBrowser(url);
    console.log(
      "Opening PostHog in your default browser using the private operations note.",
    );
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
