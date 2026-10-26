"""Evaluation metrics for the paper's results section (owner: whoever finishes first; suggested: Ria + Bhavika)."""
import numpy as np
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score, confusion_matrix


def report(y_true, scores, threshold=0.5):
    y_pred = (np.asarray(scores) >= threshold).astype(int)
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    out = dict(precision=p, recall=r, f1=f, accuracy=(tp + tn) / len(y_true),
               fpr=fp / max(fp + tn, 1), fnr=fn / max(fn + tp, 1))
    try: out["roc_auc"] = roc_auc_score(y_true, scores)
    except ValueError: out["roc_auc"] = None
    return out


def ablation(y_true, audio_scores, video_scores, fused_scores):
    """The paper's key table: audio-only vs video-only vs fused."""
    return {"audio_only": report(y_true, audio_scores), "video_only": report(y_true, video_scores),
            "fused": report(y_true, fused_scores)}
