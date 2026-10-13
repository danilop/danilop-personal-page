# Kokoro runtime comparison

Measured locally on the author's Apple Silicon Mac, 13 October 2026. These are
single-run development measurements, not a statistically controlled benchmark.
The author approved MLX George by listening. Production uses MLX-Audio 0.5.8 with
Kokoro 82M BF16; reference Python Kokoro 0.9.4/PyTorch 2.14.1 provided a comparison.
Both used British `bm_george`, language `b`, pace 1.0 and 24 kHz output.

## Performance

| Work | Audio length | MLX generation | Reference generation |
| --- | ---: | ---: | ---: |
| First paragraph, first request | 10.125 s | 20.031 s | 1.279 s |
| Same paragraph, warm worker | 10.125 s | 0.643 s | 1.207 s |
| Long article excerpt | 94.725 s | 6.318 s | 10.943 s |
| Technical passage | 20.625 s | 1.346 s | 2.250 s |
| Welcome article benchmark text | 47.575 s | 3.234 s | 5.576 s |

Model/import loading was 0.602 s for MLX and 11.544 s for reference. The first MLX
request includes additional initialisation/warm-up. A warm worker matters: MLX was
about 1.7–1.9× faster for these warm samples. Measured peak process RSS was 473 MB
and 3,320 MB respectively; RSS is not a separate accounting of all GPU allocations.
No ONNX benchmark was needed after the MLX listening approval.

The production speech compiler adds titles, structural pauses and explicit image
omissions. Its output therefore differs from the raw spike corpus: the welcome
article is 45.07 s (541,772 bytes), and the longer article 1,186.19 s (14,235,308
bytes). These are measured listening lengths, not silent-reading estimates.
Production includes chunk caching, checksum validation, MP3 encoding and a decode
check; do not extrapolate its total job latency from raw model inference alone.

## Numerical differences

[Full measurements](narration-comparison.json) compare PCM16 WAVs, not the lossy
MP3s. Both runtimes produced exactly the same number of samples for each benchmark
text. No time stretching or dynamic alignment was applied.

| Sample | Waveform correlation | MLX RMS difference | Spectral RMSE |
| --- | ---: | ---: | ---: |
| First paragraph | 0.7493 | −0.158 dB | 2.041 dB |
| Long excerpt | 0.6629 | −0.154 dB | 2.063 dB |
| Technical passage | 0.9740 | −0.156 dB | 1.850 dB |
| Welcome text | 0.7812 | −0.163 dB | 1.892 dB |
| MLX first versus warm repeat | 0.9960 | −0.003 dB | 1.244 dB |

The waveform differs numerically, while duration and the short-window energy
patterns are close (energy correlation 0.9988–0.9996 across runtimes). Sample-wise
correlation is phase-sensitive and is not a perceptual speech-quality score.
Spectral RMSE is also a descriptive difference, not an intelligibility metric.
The repeat control shows that MLX output is not bit-for-bit deterministic. Stored
prepared bytes, rather than regeneration in CI, define the release artifact.

`compare.py` uses equal-length mono samples, 20 ms symmetric Hann windows,
10 ms hops, a common peak-relative −60 dB spectral floor, and unwindowed frame RMS.
It rejects unequal sample rates or lengths rather than hiding timing differences.
Listening approval and numerical similarity answer different questions.

## Reproduction

Production setup is hash-locked; benchmark reference tooling is optional and stays
in a separate environment. These commands download only when explicitly requested:

```sh
npm run narration:setup
.venv-narration/bin/python tools/narration/benchmark-setup.py
.venv-narration/bin/python tools/narration/benchmark.py mlx
uv venv --python 3.12.13 .venv-narration-reference
uv pip install --python .venv-narration-reference/bin/python \
  'kokoro==0.9.4' 'torch==2.14.1' 'misaki[en]==0.9.4' 'soundfile==0.14.0' \
  'en-core-web-sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl'
.venv-narration-reference/bin/python tools/narration/benchmark.py reference
.venv-narration/bin/python tools/narration/compare.py \
  .authoring-state/narration/spike/mlx-long-excerpt.wav \
  .authoring-state/narration/spike/reference-long-excerpt.wav
```

The committed corpus comes from the two public articles and a technical passage.
Each candidate runs in a new process and repeats the first paragraph at the end.
Results and audio stay in ignored `.authoring-state/narration/spike/`. The production
model is pinned at `a71e4d38b236d968966a2002c4c895dbd12b1c3c`; the reference at
`f3ff3571791e39611d31c381e3a41a3af07b4987`. Reference transitive dependencies are not
part of the production lock and may affect later comparison runs. Do not install
reference packages into the production environment.

MP3 96 kbit/s was selected conservatively; 64 and 96 kbit/s comparison files were
prepared. The author's approval establishes the MLX voice choice, not a blind
codec preference test. Browser/device and first hosted-CDN checks are tracked in
[verification](verification.md).
