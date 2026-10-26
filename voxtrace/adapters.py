"""PyTorch white-box adapters for VoxTrace audio and video detectors.

Contract:
- Model takes waveform tensor (B, T) in [-1.0, 1.0] (or video frames in [-1.0, 1.0])
- Preprocessing is performed internally via differentiable PyTorch operations
- Returns logits tensor of shape (B,), where higher = more likely FAKE
- Model loads weights and initializes in .eval() mode
"""
from __future__ import annotations

import os
from typing import Optional, Union

import joblib
import librosa
import numpy as np
import scipy.signal
import torch
import torch.nn as nn
import torch.nn.functional as F

DEFAULT_AUDIO_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "models", "audio.joblib"
)
DEFAULT_SR = 16000


class DifferentiableAudioFeatureExtractor(nn.Module):
    """Differentiable PyTorch port of Ria's 88-dimensional Librosa feature extraction.

    Extracts:
      - 20 MFCCs (mean, std) = 40
      - 20 Delta MFCCs (mean, std) = 40
      - Spectral Centroid (mean, std) = 2
      - Spectral Flatness (mean, std) = 2
      - Spectral Rolloff 85% (mean, std) = 2
      - Zero Crossing Rate (mean, std) = 2
    Total = 88 features.
    """

    def __init__(self, sr: int = DEFAULT_SR, n_fft: int = 2048, hop_length: int = 512,
                 n_mels: int = 128, n_mfcc: int = 20):
        super().__init__()
        self.sr = sr
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.n_mels = n_mels
        self.n_mfcc = n_mfcc

        # 1. Window
        self.register_buffer("window", torch.hann_window(n_fft))

        # 2. Mel filterbank (Librosa-compatible Slaney)
        mel_fb_np = librosa.filters.mel(sr=sr, n_fft=n_fft, n_mels=n_mels).astype(np.float32)
        self.register_buffer("mel_fb", torch.from_numpy(mel_fb_np))

        # 3. DCT-II orthonormal matrix
        k = torch.arange(n_mfcc).unsqueeze(1).float()
        m = torch.arange(n_mels).unsqueeze(0).float()
        dct_mat = torch.cos(torch.pi * k * (2 * m + 1) / (2 * n_mels)) * np.sqrt(2.0 / n_mels)
        dct_mat[0] *= 1.0 / np.sqrt(2.0)
        self.register_buffer("dct_mat", dct_mat)

        # 4. Delta Savitzky-Golay filter coefficients (width=9, order=1)
        kernel = torch.arange(-4, 5, dtype=torch.float32).view(1, 1, 9) / 60.0
        self.register_buffer("savgol_kernel", kernel)

        c_left = np.array([scipy.signal.savgol_coeffs(9, 1, deriv=1, pos=i)[::-1] for i in range(4)])
        self.register_buffer("savgol_left", torch.from_numpy(c_left).float())

        c_right = np.array([scipy.signal.savgol_coeffs(9, 1, deriv=1, pos=8 - i)[::-1] for i in reversed(range(4))])
        self.register_buffer("savgol_right", torch.from_numpy(c_right).float())

        # 5. FFT bin frequencies
        freqs_np = librosa.fft_frequencies(sr=sr, n_fft=n_fft).astype(np.float32)
        self.register_buffer("freqs", torch.from_numpy(freqs_np).view(1, n_fft // 2 + 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Extract 88 features for batch of waveforms x: (B, T) in [-1, 1]."""
        if x.dim() == 1:
            x = x.unsqueeze(0)
        B, T = x.shape

        # 1. STFT (matches librosa center=True with constant pad)
        pad_amount = self.n_fft // 2
        x_pad = F.pad(x, (pad_amount, pad_amount), mode="constant")
        stft = torch.stft(
            x_pad,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            win_length=self.n_fft,
            window=self.window,
            center=False,
            return_complex=True,
        )
        mag = torch.abs(stft)  # (B, 1025, T_frames)
        power = mag.pow(2)

        # 2. MFCC (20 coefficients)
        mel_spec = torch.matmul(self.mel_fb, power)
        log_mel = 10.0 * torch.log10(torch.clamp(mel_spec, min=1e-10))
        top_val = log_mel.amax(dim=(-2, -1), keepdim=True)
        log_mel = torch.clamp(log_mel, min=top_val - 80.0)
        mfcc = torch.matmul(self.dct_mat, log_mel)  # (B, 20, T_frames)

        # 3. Delta MFCC
        n_frames = mfcc.shape[-1]
        mfcc_flat = mfcc.view(B * self.n_mfcc, 1, n_frames)
        if n_frames >= 9:
            interior = F.conv1d(mfcc_flat, self.savgol_kernel).view(B, self.n_mfcc, n_frames - 8)
            left = torch.matmul(mfcc[:, :, :9], self.savgol_left.T)
            right = torch.matmul(mfcc[:, :, -9:], self.savgol_right.T)
            delta = torch.cat([left, interior, right], dim=-1)
        else:
            delta = torch.zeros_like(mfcc)

        # 4. Spectral Centroid
        cent = torch.sum(self.freqs * mag, dim=1, keepdim=True) / (torch.sum(mag, dim=1, keepdim=True) + 1e-12)

        # 5. Spectral Flatness
        power_c = torch.clamp(power, min=1e-10)
        gmean = torch.exp(torch.mean(torch.log(power_c), dim=1, keepdim=True))
        amean = torch.mean(power_c, dim=1, keepdim=True)
        flat = gmean / (amean + 1e-10)

        # 6. Spectral Rolloff (85% energy quantile with straight-through estimator)
        total_energy = torch.cumsum(mag, dim=1)
        thresh = 0.85 * total_energy[:, -1:, :]
        freqs_exp = self.freqs.expand(B, self.n_fft // 2 + 1, n_frames)
        mask = total_energy >= thresh
        first_idx = torch.argmax(mask.float(), dim=1, keepdim=True)
        roll_exact = torch.gather(freqs_exp, 1, first_idx)

        cdf = total_energy / (total_energy[:, -1:, :] + 1e-12)
        roll_soft = torch.sum(1.0 - torch.sigmoid((cdf - 0.85) * 50.0), dim=1, keepdim=True) * (self.sr / self.n_fft)
        roll = roll_soft + (roll_exact - roll_soft).detach()

        # 7. Zero Crossing Rate (with smooth tanh STE for gradient flow)
        x_zcr_pad = F.pad(x, (pad_amount, pad_amount), mode="replicate")
        frames = x_zcr_pad.unfold(dimension=-1, size=self.n_fft, step=self.hop_length)
        diffs = frames[..., 1:] * frames[..., :-1]
        cross_exact = (diffs < 0).float().mean(dim=-1, keepdim=True).transpose(1, 2)
        cross_soft = 0.5 * (1.0 - torch.tanh(10.0 * frames[..., 1:]) * torch.tanh(10.0 * frames[..., :-1])).mean(
            dim=-1, keepdim=True
        ).transpose(1, 2)
        zcr = cross_soft + (cross_exact - cross_soft).detach()

        # Concatenate time mean and std for each feature part
        parts = [mfcc, delta, cent, flat, roll, zcr]
        feat_list = []
        for p in parts:
            m_p = p.mean(dim=-1)
            s_p = p.std(dim=-1, unbiased=False)
            feat_list.append(m_p)
            feat_list.append(s_p)

        features = torch.cat(feat_list, dim=-1)  # (B, 88)
        return features


class AudioAdapter(nn.Module):
    """PyTorch white-box adapter wrapping Ria's AudioDetector."""

    def __init__(self, model_path: Optional[str] = None, sr: int = DEFAULT_SR):
        super().__init__()
        self.sr = sr
        self.extractor = DifferentiableAudioFeatureExtractor(sr=sr)

        # Normalization and linear classification parameters
        self.register_buffer("scaler_mean", torch.zeros(88))
        self.register_buffer("scaler_scale", torch.ones(88))
        self.fc = nn.Linear(88, 1)

        path = model_path or DEFAULT_AUDIO_MODEL_PATH
        if os.path.exists(path):
            self.load_from_joblib(path)
        self.eval()

    def load_from_joblib(self, path: str) -> AudioAdapter:
        """Load weights from Ria's scikit-learn pipeline (.joblib)."""
        m = joblib.load(path)
        scaler = m.named_steps["standardscaler"]
        clf = m.named_steps["logisticregression"]

        # Ensure compatibility across scikit-learn versions
        if not hasattr(clf, "multi_class"):
            clf.multi_class = "auto"

        mean_np = scaler.mean_.astype(np.float32)
        scale_np = np.sqrt(scaler.var_).astype(np.float32)
        w_np = clf.coef_.astype(np.float32)  # (1, 88)
        b_np = clf.intercept_.astype(np.float32)  # (1,)

        self.scaler_mean.copy_(torch.from_numpy(mean_np))
        self.scaler_scale.copy_(torch.from_numpy(scale_np))

        with torch.no_grad():
            self.fc.weight.copy_(torch.from_numpy(w_np))
            self.fc.bias.copy_(torch.from_numpy(b_np))
        self.eval()
        return self

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Compute logits: (B,) higher = more likely FAKE."""
        if x.dim() == 1:
            x = x.unsqueeze(0)
        feats = self.extractor(x)  # (B, 88)
        norm_feats = (feats - self.scaler_mean) / (self.scaler_scale + 1e-12)
        logits = self.fc(norm_feats).squeeze(-1)  # (B,)
        return logits

    @torch.no_grad()
    def score(self, x: Union[torch.Tensor, np.ndarray]) -> float:
        """Return probability P(fake) in [0, 1]."""
        if isinstance(x, np.ndarray):
            x = torch.from_numpy(x).float()
        if x.dim() == 1:
            x = x.unsqueeze(0)
        return float(torch.sigmoid(self.forward(x)).squeeze(0).item())


class VideoAdapter(nn.Module):
    """PyTorch white-box adapter for Bhavika's VideoDetector.

    Evaluates the Laplacian high-frequency sharpness heuristic differentiably.
    Contract: input frames in [-1, 1], returns fake-logits (B,).
    """

    def __init__(self):
        super().__init__()
        self.eval()

    def forward(self, frames: torch.Tensor) -> torch.Tensor:
        """Takes frames tensor in [-1, 1] and returns logits (B,).

        Supported shapes:
          - (B, H, W, 3) single frame per video
          - (B, T, H, W, 3) multiple frames per video
          - (H, W, 3) unbatched single frame
        """
        if frames.dim() == 3:  # (H, W, 3)
            frames = frames.unsqueeze(0)

        # Map from [-1, 1] to [0, 255] RGB intensity
        f_255 = (frames + 1.0) * 127.5
        g = f_255.mean(dim=-1)  # grayscale

        # Discrete 2D Laplacian operator (4*center - neighbors)
        lap = torch.abs(
            g[..., 1:-1, 1:-1] * 4.0
            - g[..., :-2, 1:-1]
            - g[..., 2:, 1:-1]
            - g[..., 1:-1, :-2]
            - g[..., 1:-1, 2:]
        )
        lap_mean = lap.mean(dim=(-2, -1))
        if lap_mean.dim() > 1:
            lap_mean = lap_mean.mean(dim=-1)

        # Logit such that sigmoid(logit) = 1 / (1 + exp(-(lap - 20) / 10))
        logits = (lap_mean - 20.0) / 10.0
        return logits

    @torch.no_grad()
    def score(self, frames: torch.Tensor) -> float:
        """Return probability P(fake) in [0, 1]."""
        return float(torch.sigmoid(self.forward(frames)).mean().item())
