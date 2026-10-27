"""White-box attacks (FGSM, PGD) on PyTorch deepfake detectors.

Re-exports from voxtrace.blackbox to support both whitebox.py and blackbox.py naming.
"""
from voxtrace.blackbox import (
    FAKE,
    REAL,
    StandInDetector,
    fgsm,
    pgd,
    ATTACKS,
    snr_db,
    predict,
    evasion_report,
    print_report,
)

__all__ = [
    "FAKE",
    "REAL",
    "StandInDetector",
    "fgsm",
    "pgd",
    "ATTACKS",
    "snr_db",
    "predict",
    "evasion_report",
    "print_report",
]
