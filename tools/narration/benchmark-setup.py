"""Explicit optional comparison downloads; never invoked by generation or builds."""

import json
from pathlib import Path

from huggingface_hub import snapshot_download

profile = json.loads(Path("tools/narration/profile.json").read_text())
models = {}
for name, revision, files in [
    (profile["model"], profile["revision"], list(profile["files"])),
    (
        "hexgrad/Kokoro-82M",
        "f3ff3571791e39611d31c381e3a41a3af07b4987",
        ["config.json", "kokoro-v1_0.pth", "voices/bm_george.pt"],
    ),
]:
    folder = snapshot_download(name, revision=revision, allow_patterns=files)
    models[name] = {"path": folder, "revision": revision}
folder = Path(".authoring-state/narration/spike")
folder.mkdir(parents=True, exist_ok=True)
(folder / "models.json").write_text(json.dumps(models))
(folder / "corpus.json").write_bytes(Path("tools/narration/benchmark-corpus.json").read_bytes())
print("Pinned comparison models and article corpus ready.")
