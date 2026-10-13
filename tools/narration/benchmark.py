"""Reproduce local candidate measurements using the saved article corpus.

Run after model setup; each candidate runs in a fresh process. Results are private.
"""

import json
import os
import resource
import sys
import time
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
started = time.monotonic()
import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

folder = Path(".authoring-state/narration/spike")
models = json.loads((folder / "models.json").read_text())
engine = sys.argv[1]
if engine == "mlx":
    from mlx_audio.tts.utils import load_model

    model_dir = Path(models["mlx-community/Kokoro-82M-bf16"]["path"])
    link = folder / "Kokoro-82M-bf16"
    if not link.exists():
        link.symlink_to(model_dir, target_is_directory=True)
    model = load_model(str(link))

    def generate(text, voice):
        return [
            np.array(r.audio)
            for r in model.generate(
                text,
                voice=str(model_dir / "voices" / f"{voice}.safetensors"),
                lang_code="b",
                speed=1.0,
            )
        ]
else:
    import torch
    from kokoro import KModel, KPipeline

    model_dir = Path(models["hexgrad/Kokoro-82M"]["path"])
    model = KModel(
        config=str(model_dir / "config.json"),
        model=str(model_dir / "kokoro-v1_0.pth"),
        repo_id="hexgrad/Kokoro-82M",
    ).eval()
    pipeline = KPipeline(lang_code="b", model=model, repo_id="hexgrad/Kokoro-82M")

    def generate(text, voice):
        pack = torch.load(model_dir / "voices" / f"{voice}.pt", weights_only=True)
        return [r.audio.numpy() for r in pipeline(text, voice=pack, speed=1.0)]


load_seconds = time.monotonic() - started
results = []
corpus = json.loads((folder / "corpus.json").read_text())
for sample in corpus + [{**corpus[0], "id": "first-paragraph-warm"}]:
    start = time.monotonic()
    audio = np.concatenate(generate(sample["text"], "bm_george")).reshape(-1)
    elapsed = time.monotonic() - start
    if not len(audio) or not np.isfinite(audio).all():
        raise ValueError("Empty or non-finite benchmark audio")
    sf.write(folder / f"{engine}-{sample['id']}.wav", audio, 24000)
    item = {
        "sample": sample["id"],
        "seconds": elapsed,
        "audioSeconds": len(audio) / 24000,
        "realTimeFactor": elapsed / (len(audio) / 24000),
        "peakRssMB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6,
        "peak": float(np.max(np.abs(audio))),
    }
    results.append(item)
    print(json.dumps(item), flush=True)
if engine == "mlx":
    audio = np.concatenate(generate(corpus[0]["text"], "bf_emma")).reshape(-1)
    sf.write(folder / "mlx-emma.wav", audio, 24000)
(folder / f"{engine}-results.json").write_text(
    json.dumps({"engine": engine, "loadSeconds": load_seconds, "results": results}, indent=2)
)
