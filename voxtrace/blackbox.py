"""White-box attacks (FGSM, PGD) on a PyTorch audio deepfake detector.

Model contract (what Ria's / Bhavika's model must satisfy to be swapped in):
    model(x) -> logits, shape (B,), higher = more likely FAKE
    x: float tensor (B, T) waveform in [-1, 1]
Any feature extraction (MFCC etc.) must happen INSIDE the model and be
differentiable (e.g. torchaudio.transforms.MFCC). An sklearn / librosa
pipeline gives no gradients, so it cannot be attacked white-box as is.

Run `python whitebox.py` for a self-test on synthetic data. Numbers from that
run say nothing about the real detectors and must not go in the paper.
"""
from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F

FAKE, REAL = 1, 0


# --------------------------------------------------------------------------
# Stand-in detector (replace with Ria's model when it exists)
# --------------------------------------------------------------------------
class StandInDetector(nn.Module):
    """Tiny raw-waveform 1D CNN. Output: one logit per clip (higher = FAKE)."""

    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(1, 8, 31, stride=4, padding=15), nn.ReLU(),
            nn.Conv1d(8, 16, 15, stride=4, padding=7), nn.ReLU(),
            nn.Conv1d(16, 16, 7, stride=2, padding=3), nn.ReLU(),
            nn.AdaptiveAvgPool1d(1), nn.Flatten(),
            nn.Linear(16, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() == 2:
            x = x.unsqueeze(1)
        return self.net(x).squeeze(-1)


# --------------------------------------------------------------------------
# Attacks
# --------------------------------------------------------------------------
def _grad_wrt_input(model: nn.Module, x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    x = x.clone().detach().requires_grad_(True)
    loss = F.binary_cross_entropy_with_logits(model(x), y.float(), reduction="sum")
    (grad,) = torch.autograd.grad(loss, x)
    return grad


def fgsm(model: nn.Module, x: torch.Tensor, y: torch.Tensor, eps: float) -> torch.Tensor:
    """Untargeted FGSM: one step of size eps along the sign of the loss gradient.
    L-inf budget eps, output clipped to the valid audio range [-1, 1]."""
    was_training = model.training
    model.eval()
    try:
        grad = _grad_wrt_input(model, x, y)
        return (x + eps * grad.sign()).clamp(-1.0, 1.0).detach()
    finally:
        model.train(was_training)


def pgd(model: nn.Module, x: torch.Tensor, y: torch.Tensor, eps: float,
        alpha: float | None = None, steps: int = 20, random_start: bool = True) -> torch.Tensor:
    """Untargeted L-inf PGD. alpha defaults to 2.5*eps/steps (Madry et al.)."""
    alpha = alpha if alpha is not None else 2.5 * eps / steps
    was_training = model.training
    model.eval()
    try:
        x0 = x.clone().detach()
        x_adv = x0.clone()
        if random_start:
            x_adv = (x_adv + torch.empty_like(x_adv).uniform_(-eps, eps)).clamp(-1.0, 1.0)
        for _ in range(steps):
            grad = _grad_wrt_input(model, x_adv, y)
            x_adv = x_adv.detach() + alpha * grad.sign()
            x_adv = torch.min(torch.max(x_adv, x0 - eps), x0 + eps).clamp(-1.0, 1.0)
        return x_adv.detach()
    finally:
        model.train(was_training)


ATTACKS = {"fgsm": fgsm, "pgd": pgd}


# --------------------------------------------------------------------------
# Metrics / report
# --------------------------------------------------------------------------
def snr_db(x: torch.Tensor, x_adv: torch.Tensor) -> torch.Tensor:
    """Per-clip signal-to-perturbation ratio in dB (higher = quieter attack)."""
    sig = x.pow(2).sum(dim=-1)
    noise = (x_adv - x).pow(2).sum(dim=-1).clamp_min(1e-12)
    return 10.0 * torch.log10(sig.clamp_min(1e-12) / noise)


@torch.no_grad()
def predict(model: nn.Module, x: torch.Tensor, threshold: float = 0.5) -> torch.Tensor:
    was_training = model.training
    model.eval()
    try:
        return (torch.sigmoid(model(x)) >= threshold).long()
    finally:
        model.train(was_training)


def evasion_report(model: nn.Module, x_fake: torch.Tensor, eps_list, attacks=("fgsm", "pgd"),
                   threshold: float = 0.5) -> list[dict]:
    """White-box evasion of FAKE clips.

    Only clips the model already flags as fake are attacked, so the evasion
    rate is not inflated by clips it missed anyway.
    evasion_rate = share of those clips classified REAL after the attack.
    """
    detected = predict(model, x_fake, threshold) == FAKE
    base_rate = detected.float().mean().item()
    xs = x_fake[detected]
    if xs.shape[0] == 0:
        raise ValueError("Model detects none of the supplied fake clips; nothing to attack.")
    ys = torch.full((xs.shape[0],), FAKE, dtype=torch.long)

    rows = []
    for name in attacks:
        for eps in eps_list:
            x_adv = ATTACKS[name](model, xs, ys, eps)
            still_fake = predict(model, x_adv, threshold) == FAKE
            rows.append({
                "attack": name,
                "eps": eps,
                "n_attacked": int(xs.shape[0]),
                "clean_detection_rate": base_rate,
                "evasion_rate": 1.0 - still_fake.float().mean().item(),
                "median_snr_db": snr_db(xs, x_adv).median().item(),
            })
    return rows


def print_report(rows: list[dict]) -> None:
    print(f"{'attack':<6} {'eps':>8} {'n':>5} {'clean det.':>11} {'evasion':>8} {'SNR dB':>8}")
    for r in rows:
        print(f"{r['attack']:<6} {r['eps']:>8.4f} {r['n_attacked']:>5} "
              f"{r['clean_detection_rate']:>11.2%} {r['evasion_rate']:>8.2%} {r['median_snr_db']:>8.1f}")


# --------------------------------------------------------------------------
# Self-test on synthetic data (stand-in only; NOT paper results)
# --------------------------------------------------------------------------
def _synth_batch(n: int, seed: int, sr: int = 16000, dur: float = 1.0):
    g = torch.Generator().manual_seed(seed)
    t = torch.arange(int(sr * dur)) / sr
    y = torch.randint(0, 2, (n,), generator=g)
    f0 = 100 + 200 * torch.rand(n, 1, generator=g)
    x = 0.3 * torch.sin(2 * math.pi * f0 * t) + 0.15 * torch.sin(2 * math.pi * 2 * f0 * t)
    x = x + 0.05 * torch.randn(n, t.numel(), generator=g)
    artifact = 0.1 * torch.sin(2 * math.pi * 6000 * t)  # the "fake" tell
    x = x + y.unsqueeze(1).float() * artifact
    return x.clamp(-1, 1), y


def _selftest() -> None:
    torch.manual_seed(0)
    model = StandInDetector()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    x_tr, y_tr = _synth_batch(512, seed=1)
    model.train()
    for step in range(300):
        idx = torch.randint(0, x_tr.shape[0], (64,))
        loss = F.binary_cross_entropy_with_logits(model(x_tr[idx]), y_tr[idx].float())
        opt.zero_grad()
        loss.backward()
        opt.step()
    x_te, y_te = _synth_batch(200, seed=2)
    acc = (predict(model, x_te) == y_te).float().mean().item()
    print(f"[stand-in] clean test accuracy on synthetic data: {acc:.2%}")
    rows = evasion_report(model, x_te[y_te == FAKE], eps_list=[0.0005, 0.001, 0.002, 0.005, 0.01])
    print_report(rows)
    print("\nSynthetic stand-in only. These numbers say nothing about the real detectors.")


if __name__ == "__main__":
    _selftest()
