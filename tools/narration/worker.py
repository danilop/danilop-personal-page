"""Serial JSON-lines worker. stdout is protocol; models and inputs stay local."""

import contextlib
import hashlib
import json
import os
import re
import subprocess  # nosec B404
import sys
import time
from importlib.metadata import version
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Fail before any model or phonemiser could attempt an implicit installation.
for package, expected in re.findall(
    r"^([\w.-]+)==([^\s\\]+)", Path("tools/narration/requirements.txt").read_text(), re.M
):
    if version(package) != expected:
        raise ValueError(f"Runtime changed: {package}; run npm run narration:setup")
if version("en-core-web-sm") != "3.8.0":
    raise ValueError("English phonemiser model changed; run narration:setup")


def sha(data):
    return hashlib.sha256(data).hexdigest()


protocol = sys.stdout


def emit(value):
    protocol.write(json.dumps(value) + "\n")
    protocol.flush()


with contextlib.redirect_stdout(sys.stderr):
    import imageio_ffmpeg
    import numpy as np
    import soundfile as sf
    from mlx_audio.tts.utils import load_model

    profile = json.loads(Path("tools/narration/profile.json").read_text())
    state = Path(".authoring-state/narration")
    installed = json.loads((state / "model.json").read_text())
    model_dir = Path(installed["path"])
    if installed["revision"] != profile["revision"]:
        raise ValueError("Run npm run narration:setup for this profile")
    for name, checksum in profile["files"].items():
        if sha((model_dir / name).read_bytes()) != checksum:
            raise ValueError(f"Model checksum mismatch: {name}")
    encoder = imageio_ffmpeg.get_ffmpeg_exe()
    if sha(Path(encoder).read_bytes()) != profile["encoderSha256"]:
        raise ValueError("Encoder checksum mismatch; run narration:setup on Apple Silicon")
    model = load_model(model_dir, model_type="kokoro")
    pipeline = model._get_pipeline("b")
    if pipeline.g2p.fallback is None:
        raise ValueError("British phonemiser fallback is unavailable")


def cached_audio(cache, receipt):
    try:
        if sha(cache.read_bytes()) == json.loads(receipt.read_text())["sha256"]:
            data, rate = sf.read(cache, dtype="float32")
            if rate == 24000 and data.ndim == 1 and len(data) and np.isfinite(data).all():
                return data
    except (OSError, ValueError, KeyError, RuntimeError):
        pass
    return None


def synthesize(request):
    started = time.monotonic()
    job = request["id"]
    if not re.fullmatch(r"[a-f0-9-]{36}", job):
        raise ValueError("Invalid job identity")
    voice = request["voice"]
    if f"voices/{voice}.safetensors" not in profile["files"]:
        raise ValueError("Unsupported voice")
    pace = request["pace"]
    if not 0.8 <= pace <= 1.2:
        raise ValueError("Unsupported speaking pace")
    voice_file = str(model_dir / "voices" / f"{voice}.safetensors")
    chunks_dir = state / "chunks"
    chunks_dir.mkdir(exist_ok=True)
    audio_parts, timings = [], []
    samples = 0
    reused = 0
    for index, segment in enumerate(request["segments"]):
        text = segment["text"]
        if not isinstance(text, str) or not text.strip() or len(text) > 100000:
            raise ValueError("Invalid spoken segment")
        # Tokenise first, then infer from checked phonemes. Never use the upstream
        # path that truncates a token longer than the model's context window.
        _, tokens = pipeline.g2p(text)
        if any(not t.phonemes and re.search(r"\w", t.text) for t in tokens):
            raise ValueError("Unpronounceable token; add a pronunciation override")
        chunks = list(pipeline.en_tokenize(tokens))
        if not chunks or any(not ps or len(ps) > 510 for _, ps, _ in chunks):
            raise ValueError("Speech exceeds phoneme limits; split or supply a spoken form")
        begin = samples / 24000
        for graphemes, phonemes, _ in chunks:
            key = sha(
                json.dumps([request["profileHash"], voice, pace, graphemes, phonemes]).encode()
            )
            cache = chunks_dir / (key + ".wav")
            receipt = chunks_dir / (key + ".json")
            audio = cached_audio(cache, receipt)
            if audio is not None:
                reused += 1
            if audio is None:
                result = next(pipeline.generate_from_tokens(phonemes, voice=voice_file, speed=pace))
                audio = np.array(result.audio).reshape(-1)
                if not len(audio) or not np.isfinite(audio).all() or np.max(np.abs(audio)) >= 1:
                    raise ValueError("Invalid or clipped synthesis")
                if not 0.05 < len(audio) / 24000 < max(30, len(graphemes) * 0.5):
                    raise ValueError("Implausible segment duration")
                temp = cache.with_suffix(".tmp.wav")
                sf.write(temp, audio, 24000, subtype="FLOAT")
                temp.replace(cache)
                receipt.write_text(json.dumps({"sha256": sha(cache.read_bytes())}))
            audio_parts.append(audio)
            samples += len(audio)
        pause = np.zeros(round(24000 * min(max(segment["pause"], 0), 2)), dtype=np.float32)
        audio_parts.append(pause)
        samples += len(pause)
        timings.append({"start": begin, "end": samples / 24000})
        emit({"id": job, "progress": index + 1, "total": len(request["segments"])})
    if not timings:
        raise ValueError("Empty narration")
    output = state / "jobs" / job
    output.mkdir(parents=True, exist_ok=True)
    wav = output / "audio.wav"
    sf.write(wav, np.concatenate(audio_parts), 24000, subtype="FLOAT")
    mp3 = output / "audio.mp3"
    subprocess.run(  # nosec B603 - checksum-verified encoder, fixed argv, no shell
        [
            encoder,
            "-v",
            "error",
            "-y",
            "-i",
            str(wav),
            "-map_metadata",
            "-1",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            profile["bitrate"],
            str(mp3),
        ],
        check=True,
    )
    decoded = subprocess.run(  # nosec B603 - checksum-verified encoder, fixed argv, no shell
        [encoder, "-v", "error", "-i", str(mp3), "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    if abs(len(decoded) / 4 / 24000 - samples / 24000) > 0.15:
        raise ValueError("Encoded narration duration/coverage mismatch")
    data = mp3.read_bytes()
    wav.unlink()
    return {
        "id": job,
        "done": True,
        "sha256": sha(data),
        "bytes": len(data),
        "duration": samples / 24000,
        "timings": timings,
        "reusedChunks": reused,
        "generationSeconds": time.monotonic() - started,
    }


emit({"ready": True})
for line in sys.stdin:
    request = {}
    try:
        if len(line) > 2000000:
            raise ValueError("Request too large")
        request = json.loads(line)
        with contextlib.redirect_stdout(sys.stderr):
            result = synthesize(request)
        emit(result)
    except Exception as error:
        emit({"id": request.get("id"), "error": str(error)})
