"""Audio-video fusion (owner: Bhavika).

Handles missing modalities (audio-only call, video-only clip) by renormalising weights.
`fit_logistic_fusion` is the stretch goal: learn the combination from validation scores.
"""
import numpy as np
from sklearn.linear_model import LogisticRegression


def fuse(audio_score, video_score, w_audio=0.5, w_video=0.5):
    parts = [(audio_score, w_audio), (video_score, w_video)]
    parts = [(s, w) for s, w in parts if s is not None]
    if not parts:
        raise ValueError("need at least one modality score")
    tot = sum(w for _, w in parts)
    return float(sum(s * w for s, w in parts) / tot)


def fit_logistic_fusion(audio_scores, video_scores, labels):
    X = np.column_stack([audio_scores, video_scores])
    return LogisticRegression().fit(X, labels)


def verdict_from_score(score, threshold=0.5):
    return "FAKE" if score >= threshold else "REAL"
