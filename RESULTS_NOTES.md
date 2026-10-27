# VoxTrace Adversarial Robustness Evaluation: Experimental Notes

**Author:** Shaurya Arvind (Adversarial Robustness Lead)  
**Date:** October 26, 2026  
**Git Commit:** `935ce95a3b0f94f34ddb3f77f311e5bbb966cd13`  
**Repository:** `Ria1805/VoxTrace` (Branch: `ria-audio-detector`)

---

## 1. Setup & Environment

* **Python Version:** 3.9.6
* **PyTorch / Torchaudio:** `torch==2.8.0`, `torchaudio==2.8.0`
* **Scikit-Learn:** `scikit-learn==1.6.1`
* **Librosa / Scipy / NumPy:** `librosa==0.11.0`, `scipy==1.13.1`, `numpy==2.0.2`
* **Plotting & Reporting:** `matplotlib==3.9.4`
* **Platform:** macOS Sonoma (arm64, Apple Silicon)
* **Reproducibility Seed:** `42` (applied to NumPy, PyTorch CPU, and Python random generators)

---

## 2. Models Evaluated & Architecture Contracts

### Audio Detector (Ria)
* **Model File:** `models/audio.joblib` (baseline trained on In-the-Wild audio)
* **Pipeline:** 88-dimensional Librosa feature extraction $\to$ `StandardScaler` $\to$ `LogisticRegression(max_iter=2000)`.
* **Adapter Implementation:** [voxtrace/adapters.py](file:///Users/shauryarvind/Projects/VoxTrace/voxtrace/adapters.py) (`AudioAdapter` and `DifferentiableAudioFeatureExtractor`).
* **Feature Extraction Port:** Differentiable PyTorch port of 20 MFCCs (mean/std), 20 Delta MFCCs (mean/std), Spectral Centroid, Spectral Flatness, Spectral Rolloff (85%), and Zero Crossing Rate (ZCR).
  * **Verified Port Accuracy:** Maximum feature absolute difference against native Librosa across test clips is **$0.000231$** ($< 2.5 \times 10^{-4}$); predicted probability difference is **$5.18 \times 10^{-15}$** (machine precision).

### Video Detector (Bhavika)
* **Model File:** None delivered (`version = "video-PLACEHOLDER-0.0"` in `voxtrace/video_detector.py`).
* **Adapter Implementation:** [voxtrace/adapters.py](file:///Users/shauryarvind/Projects/VoxTrace/voxtrace/adapters.py) (`VideoAdapter`).
* **Evaluated Contract:** Evaluates the discrete 2D Laplacian sharpness heuristic differentiably in PyTorch autograd.

---

## 3. Key Findings

### 3.1 White-Box Audio Attacks (FGSM vs. PGD)
* **Vulnerability:** Ria's audio detector is fragile against white-box gradient attacks.
* **PGD vs. FGSM:**
  * At $\epsilon = 0.0005$: PGD achieves **$88.89\%$ evasion** with **$57.5\text{ dB}$ median SNR**, whereas FGSM achieves only **$16.67\%$ evasion** ($56.4\text{ dB}$ SNR).
  * At $\epsilon = 0.0010$: PGD reaches **$100.00\%$ evasion** with **$52.1\text{ dB}$ median SNR** (inaudible perturbation).
* **Gradient Masking Check:** PGD with 50 and 100 steps and 5 random restarts achieves consistent 100% evasion, confirming smooth gradient surfaces and absence of artificial gradient masking.
* **Noise Control:** Random sign noise ($\pm \epsilon$) at $\epsilon = 0.0010$ causes only **$5.56\%$ evasion**, confirming that vulnerability is specifically adversarial rather than generic noise sensitivity.

### 3.2 Video Detector Attack (Pixel Budget)
* Evaluated against the Laplacian sharpness heuristic in pixel space:
  * At $\epsilon = 0.0100$ ($\pm 1.3/255$ pixel value change): PGD achieves **$86.67\%$ evasion**; FGSM achieves **$80.00\%$ evasion**.
  * At $\epsilon \ge 0.0200$ ($\pm 2.6/255$ pixel value change): Both achieve **$100.00\%$ evasion**.
  * At large step $\epsilon = 0.1000$ ($\pm 12.8/255$), FGSM overshoots and fails ($0.00\%$ evasion), whereas PGD projects iteratively and preserves **$100.00\%$ evasion**.

### 3.3 Telephony Band-Limiting Vulnerabilities (Open Item 12)
1. **Real Speech False-Alarm Explosion:**
   * On the 8,633 held-out real speech clips in `models/audio_test_scores.csv`:
     * Clean audio false positive rate (FPR): **$3.85\%$** (332 / 8,633).
     * Telephony band-limited audio (300–3400 Hz) FPR: **$42.29\%$** (3,651 / 8,633).
     * **Impact:** Applying telephony filtering causes an **$11.0\times$ surge in false alarms**, rendering the baseline unusable for phone surveillance without retraining or telephony data augmentation.
2. **Post-Hoc Filtering Does Not Stop Evasion:**
   * Filtering adversarial waveforms with standard 4th-order Butterworth bandpass (300–3400 Hz) preserves **$94.4\%$ to $100.0\%$ evasion rate**.
3. **Attacking Directly Through Differentiable Telephony Filter:**
   * Backpropagating white-box gradients directly through `torchaudio.functional.lfilter` achieves **$100.00\%$ evasion at $\epsilon = 0.0005$ with $58.2\text{ dB}$ SNR**.

### 3.4 Black-Box vs. White-Box Comparison
* **Additive Gaussian Noise:** Noise at 20 dB and 10 dB achieves 100% evasion, but degrades SNR to 20 dB / 10 dB (audible hiss).
* **Gain Scaling ($0.5\times$):** Achieves **$0.00\%$ evasion** because the feature pipeline standardizes energy and uses normalized spectral shapes.
* **Time Shift ($10\%$):** Achieves **$38.89\%$ evasion**.
* **Query-Only Random Search (budget=50):** Achieves **$100.00\%$ evasion**, but requires 50 score queries per clip and degrades SNR to $14.0\text{ dB}$, compared to white-box PGD which requires no black-box query budget and achieves $52.1\text{ dB}$ SNR.

---

## 4. Merged Robustness Summary Table

| Category | Attack Method | Evasion Rate | Median SNR | Threat Model / Notes |
| :--- | :--- | :---: | :---: | :--- |
| **White-Box Gradient** | FGSM ($\epsilon=0.001$) | **$33.33\%$** | $50.4\text{ dB}$ | 1-step gradient sign attack |
| **White-Box Gradient** | FGSM ($\epsilon=0.005$) | **$83.33\%$** | $36.4\text{ dB}$ | 1-step gradient sign attack |
| **White-Box Gradient** | FGSM ($\epsilon=0.010$) | **$88.89\%$** | $30.4\text{ dB}$ | 1-step gradient sign attack |
| **White-Box Gradient** | PGD-20 ($\epsilon=0.001$) | **$100.00\%$** | $52.1\text{ dB}$ | 20-step projected gradient descent |
| **White-Box Gradient** | PGD-20 ($\epsilon=0.005$) | **$100.00\%$** | $40.1\text{ dB}$ | 20-step projected gradient descent |
| **White-Box Gradient** | PGD-20 ($\epsilon=0.010$) | **$100.00\%$** | $34.0\text{ dB}$ | 20-step projected gradient descent |
| **White-Box Gradient** | Random Noise ($\epsilon=0.001$) | **$5.56\%$** | $50.4\text{ dB}$ | Isotropic Rademacher noise control |
| **White-Box Channel** | TelephonyFilter-PGD ($\epsilon=0.001$) | **$100.00\%$** | $53.2\text{ dB}$ | White-box backprop through channel filter |
| **White-Box Channel** | TelephonyFilter-PGD ($\epsilon=0.005$) | **$100.00\%$** | $40.1\text{ dB}$ | White-box backprop through channel filter |
| **Black-Box (Fixed)** | `noise_20dB` | **$100.00\%$** | $20.0\text{ dB}$ | Additive white Gaussian noise |
| **Black-Box (Fixed)** | `noise_10dB` | **$100.00\%$** | $10.0\text{ dB}$ | Additive white Gaussian noise |
| **Black-Box (Fixed)** | `telephony_300-3400Hz` | **$61.11\%$** | $-1.7\text{ dB}$ | Fixed bandpass filter |
| **Black-Box (Fixed)** | `gain_0.5` | **$0.00\%$** | $6.0\text{ dB}$ | Amplitude reduction |
| **Black-Box (Fixed)** | `shift_10pct` | **$38.89\%$** | $-3.9\text{ dB}$ | Circular time displacement |
| **Black-Box (Query)** | `random_search_b50` | **$100.00\%$** | $14.0\text{ dB}$ | 50 query score-guided random search |

---

## 5. Artifacts & Generated Files

* [adapters.py](file:///Users/shauryarvind/Projects/VoxTrace/adapters.py) and [voxtrace/adapters.py](file:///Users/shauryarvind/Projects/VoxTrace/voxtrace/adapters.py): Differentiable PyTorch white-box model adapters.
* [tests/test_adapters.py](file:///Users/shauryarvind/Projects/VoxTrace/tests/test_adapters.py): Pytest suite verifying clean metric reproduction, non-zero finite input gradients, $\epsilon=0$ evasion, and noise control.
* [run_whitebox.py](file:///Users/shauryarvind/Projects/VoxTrace/run_whitebox.py): Standalone reproducible experiment harness.
* [results/audio_whitebox_evasion.csv](file:///Users/shauryarvind/Projects/VoxTrace/results/audio_whitebox_evasion.csv): Raw sweep data for FGSM, PGD, and noise control.
* [results/video_whitebox_evasion.csv](file:///Users/shauryarvind/Projects/VoxTrace/results/video_whitebox_evasion.csv): Raw sweep data for video detector attack.
* [results/telephony_evasion.csv](file:///Users/shauryarvind/Projects/VoxTrace/results/telephony_evasion.csv): Telephony post-hoc and through-filter evasion data.
* [results/merged_robustness_table.csv](file:///Users/shauryarvind/Projects/VoxTrace/results/merged_robustness_table.csv): Merged robustness metrics across all white-box and black-box tests.
* [results/summary_metrics.json](file:///Users/shauryarvind/Projects/VoxTrace/results/summary_metrics.json): Complete machine-readable results dictionary with library versions and git commit.
* [results/audio_evasion_vs_eps.png](file:///Users/shauryarvind/Projects/VoxTrace/results/audio_evasion_vs_eps.png): Publication curve of Evasion Rate vs $\epsilon$.
* [results/audio_evasion_vs_snr.png](file:///Users/shauryarvind/Projects/VoxTrace/results/audio_evasion_vs_snr.png): Publication curve of Evasion Rate vs SNR (dB).
* [results/telephony_robustness.png](file:///Users/shauryarvind/Projects/VoxTrace/results/telephony_robustness.png): Publication comparison of clean vs telephony through-filter attack.

---

## 6. Caveats, Limitations & Open Items

1. **Video Model Status:** Bhavika has not delivered a trained deep-learning video detector. The evaluated video adapter targets the baseline Laplacian sharpness heuristic. When Bhavika delivers the MediaPipe + fine-tuned CNN model, a new adapter must map face cropping and CNN backpropagation.
2. **Raw Audio Storage:** The raw In-the-Wild audio clips (`data/itw/`) were excluded from git via `.gitignore`. Evaluated numbers for the full held-out set rely on the committed per-clip predictions (`models/audio_test_scores.csv` and `models/audio_eval.json`). Waveform attacks were performed on standardized evaluation batches.
3. **Non-Differentiable Feature Approximation:** Zero Crossing Rate and Spectral Rolloff quantile index operations are step-functions in Librosa. The PyTorch port resolves this using Straight-Through Estimators (STE) with smooth $\tanh$ and sigmoid backward passes, preserving exact forward outputs while supplying smooth gradients.
