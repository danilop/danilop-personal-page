import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
if (!existsSync(".venv-quality/bin/python"))
  execFileSync("uv", ["venv", "--python", "3.13", ".venv-quality"], {
    stdio: "inherit",
  });
execFileSync(
  "uv",
  [
    "pip",
    "sync",
    "--python",
    ".venv-quality/bin/python",
    "--require-hashes",
    "tools/content-quality/requirements.txt",
  ],
  { stdio: "inherit" },
);
execFileSync(
  ".venv-quality/bin/python",
  [
    "-c",
    "import spacy, snowballstemmer; nlp=spacy.load('en_core_web_sm'); print('NLP environment ready:', spacy.__version__, nlp.meta['version'])",
  ],
  { stdio: "inherit" },
);
