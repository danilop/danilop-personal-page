"""Compare two mono PCM recordings; numerical similarity is not a quality score."""

import json
import sys

import numpy as np
import soundfile as sf


def compare(first, second):
    a, rate = sf.read(first, dtype="float64")
    b, other_rate = sf.read(second, dtype="float64")
    if rate != other_rate or a.ndim != 1 or b.ndim != 1 or len(a) != len(b):
        raise ValueError("Compare equal-length mono recordings at the same sample rate")
    frame, hop = round(rate * 0.020), round(rate * 0.010)
    window = np.hanning(frame)
    frames_a = np.lib.stride_tricks.sliding_window_view(a, frame)[::hop]
    frames_b = np.lib.stride_tricks.sliding_window_view(b, frame)[::hop]
    spectrum_a = np.abs(np.fft.rfft(frames_a * window, axis=1))
    spectrum_b = np.abs(np.fft.rfft(frames_b * window, axis=1))
    floor = max(spectrum_a.max(), spectrum_b.max()) * 0.001
    spectral_difference = 20 * np.log10(np.maximum(spectrum_a, floor)) - 20 * np.log10(
        np.maximum(spectrum_b, floor)
    )
    return {
        "samples": len(a),
        "sampleRate": rate,
        "durationSeconds": len(a) / rate,
        "correlation": float(np.corrcoef(a, b)[0, 1]),
        "rmsDbfsA": float(20 * np.log10(np.sqrt(np.mean(a**2)))),
        "rmsDbfsB": float(20 * np.log10(np.sqrt(np.mean(b**2)))),
        "rmse": float(np.sqrt(np.mean((a - b) ** 2))),
        "spectralRmseDb": float(np.sqrt(np.mean(spectral_difference**2))),
        "frameEnergyCorrelation": float(
            np.corrcoef(
                np.sqrt(np.mean(frames_a**2, axis=1)), np.sqrt(np.mean(frames_b**2, axis=1))
            )[0, 1]
        ),
    }


if __name__ == "__main__":
    print(json.dumps(compare(*sys.argv[1:]), indent=2))
