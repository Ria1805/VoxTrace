"""Robustness harness (owner: Shaurya).

Works on ANY detector exposing score_waveform(y)->P(fake). Included:
  - black-box: additive noise, gain, time shift, band-limiting (telephony-like), random-search perturbation
  - hook for white-box (FGSM/PGD) once the detector is a differentiable PyTorch model.

Metric to report: evasion rate = fraction of correctly-detected fakes that drop below the threshold.
"""
import numpy as np
from scipy.signal import butter, lfilter


def add_noise(y, snr_db=20, rng=None):
    rng = rng or np.random.default_rng(0)
    p = np.mean(y ** 2) + 1e-12
    n = rng.normal(0, np.sqrt(p / 10 ** (snr_db / 10)), size=y.shape)
    return (y + n).astype(y.dtype)


def telephony_bandlimit(y, sr=16000, lo=300, hi=3400):
    b, a = butter(4, [lo / (sr / 2), hi / (sr / 2)], btype="band")
    return lfilter(b, a, y).astype(y.dtype)


def gain(y, factor=0.5): return (y * factor).astype(y.dtype)


def time_shift(y, frac=0.1): return np.roll(y, int(len(y) * frac))


def random_search_attack(detector, y, budget=200, eps=0.01, rng=None):
    """Black-box: query-only random perturbations, keep the one with the lowest fake score."""
    rng = rng or np.random.default_rng(0)
    best, best_s = y, detector.score_waveform(y)
    for _ in range(budget):
        cand = np.clip(best + rng.normal(0, eps, size=y.shape).astype(y.dtype), -1, 1)
        s = detector.score_waveform(cand)
        if s < best_s:
            best, best_s = cand, s
    return best, best_s


TRANSFORMS = {
    "noise_20dB": lambda y: add_noise(y, 20),
    "noise_10dB": lambda y: add_noise(y, 10),
    "telephony_300-3400Hz": telephony_bandlimit,
    "gain_0.5": gain,
    "shift_10pct": time_shift,
}


def evasion_report(detector, fake_waveforms, threshold=0.5):
    detected = [y for y in fake_waveforms if detector.score_waveform(y) >= threshold]
    rep = {"n_fakes": len(fake_waveforms), "n_detected_clean": len(detected)}
    for name, fn in TRANSFORMS.items():
        ev = sum(detector.score_waveform(fn(y)) < threshold for y in detected)
        rep[name] = ev / max(len(detected), 1)
    ev = sum(random_search_attack(detector, y, budget=50)[1] < threshold for y in detected)
    rep["random_search_blackbox"] = ev / max(len(detected), 1)
    return rep
