"""Explicit network setup; production worker only opens verified local files."""

import hashlib
import json
from pathlib import Path

from huggingface_hub import snapshot_download

profile = json.loads(Path("tools/narration/profile.json").read_text())
folder = Path(
    snapshot_download(
        profile["model"], revision=profile["revision"], allow_patterns=list(profile["files"])
    )
)
for name, checksum in profile["files"].items():
    if hashlib.sha256((folder / name).read_bytes()).hexdigest() != checksum:
        raise ValueError(f"Model checksum mismatch: {name}")
state = Path(".authoring-state/narration")
state.mkdir(parents=True, exist_ok=True)
(state / "model.json").write_text(
    json.dumps({"path": str(folder), "revision": profile["revision"]})
)
print("Pinned Kokoro model and all eight British voices verified. Generation is offline.")
