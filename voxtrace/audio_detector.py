"""Audio deepfake detector (owner: Ria).

Baseline: MFCC + spectral features (librosa) -> logistic regression.
This is a BASELINE to prove the pipeline. Replace/extend with LFCC, CQCC, wav2vec2
embeddings or a CNN on spectrograms for real results.
"""
import numpy as np, librosa, joblib
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

SR = 16000


def extract_features(y: np.ndarray, sr: int = SR) -> np.ndarray:
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    delta = librosa.feature.delta(mfcc)
    cent = librosa.feature.spectral_centroid(y=y, sr=sr)
    flat = librosa.feature.spectral_flatness(y=y)
    roll = librosa.feature.spectral_rolloff(y=y, sr=sr)
    zcr = librosa.feature.zero_crossing_rate(y)
    parts = [mfcc, delta, cent, flat, roll, zcr]
    return np.concatenate([np.r_[p.mean(axis=1), p.std(axis=1)] for p in parts])


def load_audio(path: str, sr: int = SR) -> np.ndarray:
    y, _ = librosa.load(path, sr=sr, mono=True)
    return y


class AudioDetector:
    version = "audio-baseline-0.1"

    def __init__(self):
        self.model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))
        self.trained = False

    def fit(self, paths, labels):
        """labels: 1 = fake/cloned, 0 = real."""
        X = np.stack([extract_features(load_audio(p)) for p in paths])
        self.model.fit(X, labels)
        self.trained = True
        return self

    def score_waveform(self, y: np.ndarray) -> float:
        """Probability the audio is fake (0..1). Used directly by the attack harness."""
        return float(self.model.predict_proba(extract_features(y)[None])[0, 1])

    def score(self, path: str) -> float:
        return self.score_waveform(load_audio(path))

    def save(self, path): joblib.dump(self.model, path)

    def load(self, path):
        self.model = joblib.load(path); self.trained = True; return self
