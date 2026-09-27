import fs from "node:fs";
import path from "node:path";
import { root, execute } from "./run.mjs";
const pins = JSON.parse(
  fs.readFileSync(
    path.join(root, "tools/code-analysis/native-versions.json"),
    "utf8",
  ),
);
let valid = true;
for (const [tool, expected] of Object.entries(pins)) {
  const result = execute(tool, [
    tool === "gitleaks"
      ? "version"
      : tool === "actionlint"
        ? "-version"
        : "--version",
  ]);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const actual = output.match(/\b\d+\.\d+\.\d+\b/)?.[0];
  console.log(`${tool}: ${actual ?? "unavailable"} (required ${expected})`);
  if (result.status !== 0 || actual !== expected) valid = false;
}
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const lock = JSON.parse(
  fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
for (const group of ["dependencies", "devDependencies"]) {
  for (const [name, declared] of Object.entries(manifest[group])) {
    const installed = JSON.parse(
      fs.readFileSync(
        path.join(root, "node_modules", name, "package.json"),
        "utf8",
      ),
    );
    const expected = lock.packages[`node_modules/${name}`]?.version;
    if (
      lock.packages[""][group]?.[name] !== declared ||
      installed.version !== expected
    ) {
      console.error(
        `${name}: installed ${installed.version}, locked ${expected}; run npm ci.`,
      );
      valid = false;
    }
  }
}
const python = execute(path.join(root, ".venv-analysis/bin/python"), [
  "-c",
  "import importlib.metadata,json; print(json.dumps({d.metadata['Name'].lower().replace('_','-'): d.version for d in importlib.metadata.distributions()}))",
]);
if (python.status !== 0)
  throw Error("Cannot inspect the installed Python analyzer environment.");
const installed = JSON.parse(python.stdout);
const requirements = fs.readFileSync(
  path.join(root, "tools/code-analysis/requirements.txt"),
  "utf8",
);
for (const [, name, version] of requirements.matchAll(
  /^([A-Za-z0-9_.-]+)==([^\s\\]+)/gm,
)) {
  if (installed[name.toLowerCase().replaceAll("_", "-")] !== version) {
    console.error(`${name}: required ${version}; run npm run analysis:setup.`);
    valid = false;
  }
}
console.log("Checked installed npm/Python versions against the lockfiles.");
process.exitCode = valid ? 0 : 1;
