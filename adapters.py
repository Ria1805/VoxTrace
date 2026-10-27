"""PyTorch white-box adapters for VoxTrace audio and video detectors.

Re-exports from voxtrace.adapters.
"""
from voxtrace.adapters import (
    AudioAdapter,
    VideoAdapter,
    DifferentiableAudioFeatureExtractor,
    DEFAULT_AUDIO_MODEL_PATH,
    DEFAULT_SR,
)

__all__ = [
    "AudioAdapter",
    "VideoAdapter",
    "DifferentiableAudioFeatureExtractor",
    "DEFAULT_AUDIO_MODEL_PATH",
    "DEFAULT_SR",
]
