"""Video deepfake detector (owner: Bhavika).

`VideoDetector.score_frames` is the integration contract: take a list of RGB frames
(H,W,3 uint8) and return P(fake) in 0..1. The placeholder below uses a trivial
sharpness statistic ONLY so the pipeline runs end to end. It is NOT a detector.

TODO (the real work):
  1. Sample frames with OpenCV, crop faces with MediaPipe.
  2. Fine-tune a pretrained CNN (e.g. torchvision EfficientNet-B0) on FaceForensics++ / Celeb-DF
     with an identity-disjoint train/test split.
  3. Replace `_placeholder_frame_score` with the model; keep the same method signatures.
"""
import numpy as np


class VideoDetector:
    version = "video-PLACEHOLDER-0.0"

    def sample_frames(self, path: str, n: int = 16):
        import cv2
        cap = cv2.VideoCapture(path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        frames = []
        for idx in np.linspace(0, max(total - 1, 0), n).astype(int):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, f = cap.read()
            if ok:
                frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
        cap.release()
        return frames

    @staticmethod
    def _placeholder_frame_score(frame: np.ndarray) -> float:
        g = frame.mean(axis=2)
        lap = np.abs(g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]).mean()
        return float(1 / (1 + np.exp(-(lap - 20) / 10)))

    def score_frames(self, frames) -> float:
        if not frames:
            return 0.5
        return float(np.mean([self._placeholder_frame_score(f) for f in frames]))

    def score(self, path: str) -> float:
        return self.score_frames(self.sample_frames(path))
