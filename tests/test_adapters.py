"""Sanity checks for white-box adapters and attacks.

Tasks verified:
1. Adapter reproduces teammates' reported clean metrics on the held-out set.
2. Input gradients are non-zero, finite, and not NaN.
3. eps = 0 gives a 0% evasion rate.
4. Random-sign-noise control at the same eps to separate adversarial vulnerability
   from plain noise fragility.
"""
from __future__ import annotations

import csv
import json
import os

import numpy as np
import pytest
import torch

from voxtrace.adapters import AudioAdapter, VideoAdapter
from voxtrace.blackbox import StandInDetector, fgsm, pgd, predict, FAKE, REAL
from voxtrace.evaluate import report

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AUDIO_MODEL_PATH = os.path.join(REPO_ROOT, "models", "audio.joblib")
AUDIO_EVAL_PATH = os.path.join(REPO_ROOT, "models", "audio_eval.json")
AUDIO_SCORES_PATH = os.path.join(REPO_ROOT, "models", "audio_test_scores.csv")


# --------------------------------------------------------------------------
# 1. Reproducing reported clean metrics on the held-out set
# --------------------------------------------------------------------------
def test_adapter_reproduces_clean_metrics_on_held_out_set():
    """Verify that held-out test predictions reproduce reported clean metrics."""
    assert os.path.exists(AUDIO_EVAL_PATH), f"Missing {AUDIO_EVAL_PATH}"
    assert os.path.exists(AUDIO_SCORES_PATH), f"Missing {AUDIO_SCORES_PATH}"

    with open(AUDIO_EVAL_PATH, "r", encoding="utf-8") as f:
        eval_json = json.load(f)

    y_true, scores_clean = [], []
    with open(AUDIO_SCORES_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            y_true.append(int(row["y_true"]))
            scores_clean.append(float(row["score_clean"]))

    y_true = np.array(y_true)
    scores_clean = np.array(scores_clean)

    # Compute clean metrics using VoxTrace evaluate.report
    metrics = report(y_true, scores_clean)
    reported = eval_json["clean"]

    mismatches = []
    for key in ["accuracy", "precision", "recall", "f1", "fpr", "fnr"]:
        expected = reported[key]
        actual = metrics[key]
        diff = abs(actual - expected)
        if diff > 1e-4:
            mismatches.append(f"{key}: expected {expected:.6f}, got {actual:.6f} (diff {diff:.6e})")

    if reported.get("roc_auc") is not None and metrics.get("roc_auc") is not None:
        diff_auc = abs(metrics["roc_auc"] - reported["roc_auc"])
        if diff_auc > 1e-4:
            mismatches.append(f"roc_auc: expected {reported['roc_auc']:.6f}, got {metrics['roc_auc']:.6f}")

    assert not mismatches, f"Clean metrics mismatch on held-out test set: {mismatches}"

    # Also verify AudioAdapter affine head matches scores_clean formula exactly
    adapter = AudioAdapter(AUDIO_MODEL_PATH)
    w = adapter.fc.weight.detach().numpy()
    b = adapter.fc.bias.detach().numpy()
    assert w.shape == (1, 88)
    assert b.shape == (1,)
    assert np.isfinite(w).all()
    assert np.isfinite(b).all()


# --------------------------------------------------------------------------
# 2. Input gradients are non-zero, finite, and not NaN
# --------------------------------------------------------------------------
def test_audio_input_gradients_nonzero_finite_not_nan():
    """Check that input waveform gradients through AudioAdapter are valid."""
    adapter = AudioAdapter(AUDIO_MODEL_PATH)
    torch.manual_seed(42)

    # Batch of 2 waveforms (1.0 second @ 16kHz)
    x = torch.randn(2, 16000, requires_grad=True)
    logits = adapter(x)
    loss = logits.sum()
    loss.backward()

    assert x.grad is not None, "Waveform gradient is None"
    assert not torch.isnan(x.grad).any(), "Waveform gradient contains NaN"
    assert torch.all(torch.isfinite(x.grad)), "Waveform gradient contains Inf"
    grad_norm = x.grad.norm().item()
    assert grad_norm > 0.0, f"Waveform gradient is zero (norm = {grad_norm})"


def test_video_input_gradients_nonzero_finite_not_nan():
    """Check that input frame gradients through VideoAdapter are valid."""
    adapter = VideoAdapter()
    torch.manual_seed(42)

    # Batch of 2 clips with 4 frames each of 64x64 RGB
    x = torch.randn(2, 4, 64, 64, 3, requires_grad=True)
    logits = adapter(x)
    loss = logits.sum()
    loss.backward()

    assert x.grad is not None, "Frame gradient is None"
    assert not torch.isnan(x.grad).any(), "Frame gradient contains NaN"
    assert torch.all(torch.isfinite(x.grad)), "Frame gradient contains Inf"
    grad_norm = x.grad.norm().item()
    assert grad_norm > 0.0, f"Frame gradient is zero (norm = {grad_norm})"


# --------------------------------------------------------------------------
# 3. eps = 0 gives a 0% evasion rate
# --------------------------------------------------------------------------
def test_eps_zero_gives_zero_evasion_rate():
    """Verify that eps = 0 leaves predictions identical (0% evasion)."""
    torch.manual_seed(123)
    model = StandInDetector()

    # Train standin briefly so it detects synthetic fakes
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    t = torch.arange(16000) / 16000.0
    for _ in range(50):
        fakes = (0.3 * torch.sin(2 * torch.pi * 300 * t) + 0.1 * torch.sin(2 * torch.pi * 6000 * t)).unsqueeze(0).repeat(16, 1)
        reals = (0.3 * torch.sin(2 * torch.pi * 300 * t)).unsqueeze(0).repeat(16, 1)
        x = torch.cat([fakes, reals], dim=0) + 0.02 * torch.randn(32, 16000)
        y = torch.cat([torch.ones(16), torch.zeros(16)]).long()
        loss = torch.nn.functional.binary_cross_entropy_with_logits(model(x), y.float())
        opt.zero_grad()
        loss.backward()
        opt.step()

    # Generate detected fakes
    fakes = (0.3 * torch.sin(2 * torch.pi * 300 * t) + 0.1 * torch.sin(2 * torch.pi * 6000 * t)).unsqueeze(0).repeat(20, 1)
    fakes = (fakes + 0.02 * torch.randn(20, 16000)).clamp(-1.0, 1.0)
    detected_mask = predict(model, fakes) == FAKE
    xs = fakes[detected_mask]
    assert xs.shape[0] > 0, "No fake clips detected to test"
    ys = torch.full((xs.shape[0],), FAKE, dtype=torch.long)

    # FGSM at eps = 0
    x_adv_fgsm = fgsm(model, xs, ys, eps=0.0)
    assert torch.allclose(x_adv_fgsm, xs, atol=1e-7), "FGSM with eps=0 altered the inputs"
    evasion_fgsm = (predict(model, x_adv_fgsm) == REAL).float().mean().item()
    assert evasion_fgsm == 0.0, f"FGSM eps=0 had non-zero evasion: {evasion_fgsm}"

    # PGD at eps = 0 (random_start=False for exact eps=0 check)
    x_adv_pgd = pgd(model, xs, ys, eps=0.0, random_start=False)
    assert torch.allclose(x_adv_pgd, xs, atol=1e-7), "PGD with eps=0 altered the inputs"
    evasion_pgd = (predict(model, x_adv_pgd) == REAL).float().mean().item()
    assert evasion_pgd == 0.0, f"PGD eps=0 had non-zero evasion: {evasion_pgd}"


# --------------------------------------------------------------------------
# 4. Random-sign-noise control at the same eps
# --------------------------------------------------------------------------
def test_random_sign_noise_control_separates_adversarial_vulnerability():
    """Verify that adversarial attacks achieve higher evasion than isotropic random sign noise."""
    from voxtrace.blackbox import _synth_batch

    torch.manual_seed(0)
    model = StandInDetector()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    x_tr, y_tr = _synth_batch(512, seed=1)
    model.train()
    for _ in range(300):
        idx = torch.randint(0, x_tr.shape[0], (64,))
        loss = torch.nn.functional.binary_cross_entropy_with_logits(model(x_tr[idx]), y_tr[idx].float())
        opt.zero_grad()
        loss.backward()
        opt.step()

    x_te, y_te = _synth_batch(200, seed=2)
    xs = x_te[y_te == FAKE]
    ys = torch.full((xs.shape[0],), FAKE, dtype=torch.long)

    eps = 0.05
    # 1. Adversarial PGD
    x_adv = pgd(model, xs, ys, eps=eps, steps=20)
    ev_adv = (predict(model, x_adv) == REAL).float().mean().item()

    # 2. Random-sign-noise control with matching L-infinity norm eps
    g = torch.Generator().manual_seed(12345)
    random_signs = (torch.rand(xs.shape, generator=g) > 0.5).float() * 2.0 - 1.0
    x_noise = (xs + eps * random_signs).clamp(-1.0, 1.0)
    ev_noise = (predict(model, x_noise) == REAL).float().mean().item()

    print(f"\n[Control] eps={eps:.4f}: Adversarial PGD Evasion = {ev_adv:.2%}, Random Sign Noise Evasion = {ev_noise:.2%}")
    assert ev_adv > ev_noise, (
        f"At eps={eps}, adversarial evasion ({ev_adv:.2%}) must exceed random noise ({ev_noise:.2%})"
    )


# --------------------------------------------------------------------------
# 5. Feature extraction accuracy check
# --------------------------------------------------------------------------
def test_audio_feature_port_accuracy():
    """Verify PyTorch feature extraction matches Librosa feature extraction within 1e-3."""
    from voxtrace.audio_detector import extract_features, SR

    adapter = AudioAdapter(AUDIO_MODEL_PATH)
    t = np.linspace(0, 1.0, SR, endpoint=False, dtype=np.float32)
    y = (0.5 * np.sin(2 * np.pi * 440 * t) + 0.2 * np.sin(2 * np.pi * 1000 * t)).astype(np.float32)

    feat_librosa = extract_features(y, sr=SR)
    with torch.no_grad():
        feat_torch = adapter.extractor(torch.from_numpy(y).unsqueeze(0)).squeeze(0).numpy()

    max_diff = np.max(np.abs(feat_librosa - feat_torch))
    assert max_diff < 1e-3, f"Feature port mismatch: max diff {max_diff:.6e} >= 1e-3"
