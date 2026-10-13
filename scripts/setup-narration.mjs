import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
if (process.platform !== "darwin" || process.arch !== "arm64")
  throw Error(
    "Narration generation uses an Apple Silicon Mac. Checks and playback work without this runtime.",
  );
if (!existsSync(".venv-narration/bin/python"))
  execFileSync("uv", ["venv", "--python", "3.12.13", ".venv-narration"], {
    stdio: "inherit",
  });
execFileSync(
  "uv",
  [
    "pip",
    "sync",
    "--python",
    ".venv-narration/bin/python",
    "--require-hashes",
    "tools/narration/requirements.txt",
  ],
  { stdio: "inherit" },
);
execFileSync(".venv-narration/bin/python", ["tools/narration/setup.py"], {
  stdio: "inherit",
});
