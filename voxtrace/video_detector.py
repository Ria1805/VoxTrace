"""
voxtrace/video_detector.py  --  Bhavika's module

Video deepfake detector: MediaPipe face crop -> EfficientNet-B0 (fine-tuned) -> P(fake) per video.

Two ways to use this file
-------------------------
1) As a library (what api.py / fusion.py / evaluate.py import):
       from voxtrace.video_detector import predict_video, score_video
       r = predict_video("call.mp4")
       # {"status": "ok", "p_fake": 0.87, "n_frames": 24, "model_version": "...", "error": None}
       # unreadable video -> {"status": "error", "p_fake": None, ...}  (NEVER a fake 0.5 verdict)

2) As a CLI for data prep / training / testing:
       python -m voxtrace.video_detector prepare --data-root D:/ds --cache data/video_frames --splits-json splits/ff_splits.json
       python -m voxtrace.video_detector train   --cache data/video_frames --out models/video.pt
       python -m voxtrace.video_detector test    --cache data/video_frames --model models/video.pt

Expected raw data layout (flat is fine):
       <data-root>/real/*.mp4
       <data-root>/fake/*.mp4

IMPORTANT: if your placeholder video_detector.py exposes a different function name/signature,
keep that name and make it call predict_video()/score_video() below, so api.py and fusion.py don't break.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import random
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

log = logging.getLogger("voxtrace.video")

# --------------------------------------------------------------------------- config
IMG_SIZE = 224
FRAME_INTERVAL_S = 0.5      # sample one frame every 0.5 s
MAX_FRAMES = 32             # cap per video at inference
TRAIN_FRAMES_PER_VIDEO = 16 # cap per video when caching training frames
FACE_MARGIN = 0.30          # expand the face box by 30%
DEFAULT_MODEL_PATH = Path(os.environ.get("VOXTRACE_VIDEO_MODEL", "models/video.pt"))
MODEL_VERSION = "video-effb0-v1"
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class VideoUnreadableError(Exception):
    """Raised when a video can't be opened or no usable face frames can be extracted."""


# --------------------------------------------------------------------------- face detection
class FaceCropper:
    """MediaPipe face detector with an OpenCV Haar fallback. Returns the largest face, square-cropped."""

    def __init__(self) -> None:
        self._mp = None
        self._haar = None
        try:
            import mediapipe as mp  # type: ignore

            self._mp = mp.solutions.face_detection.FaceDetection(
                model_selection=1, min_detection_confidence=0.5
            )
        except Exception as e:  # mediapipe missing or API changed
            log.warning("MediaPipe unavailable (%s); falling back to OpenCV Haar cascade", e)
            self._haar = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )

    def _box(self, rgb: np.ndarray):
        h, w = rgb.shape[:2]
        if self._mp is not None:
            res = self._mp.process(rgb)
            if not res.detections:
                return None
            best = max(
                res.detections,
                key=lambda d: d.location_data.relative_bounding_box.width
                * d.location_data.relative_bounding_box.height,
            )
            b = best.location_data.relative_bounding_box
            return b.xmin * w, b.ymin * h, b.width * w, b.height * h
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        faces = self._haar.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
        if len(faces) == 0:
            return None
        x, y, bw, bh = max(faces, key=lambda f: f[2] * f[3])
        return float(x), float(y), float(bw), float(bh)

    def crop(self, rgb: np.ndarray) -> Optional[np.ndarray]:
        box = self._box(rgb)
        if box is None:
            return None
        h, w = rgb.shape[:2]
        x, y, bw, bh = box
        side = max(bw, bh) * (1 + FACE_MARGIN)
        cx, cy = x + bw / 2, y + bh / 2
        x0, y0 = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
        x1, y1 = int(min(w, cx + side / 2)), int(min(h, cy + side / 2))
        if x1 - x0 < 20 or y1 - y0 < 20:
            return None
        face = rgb[y0:y1, x0:x1]
        return cv2.resize(face, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)


_cropper: Optional[FaceCropper] = None


def _get_cropper() -> FaceCropper:
    global _cropper
    if _cropper is None:
        _cropper = FaceCropper()
    return _cropper


def extract_face_frames(video_path: str | Path, max_frames: int = MAX_FRAMES) -> list[np.ndarray]:
    """Sample ~1 frame / FRAME_INTERVAL_S, crop the face, return RGB 224x224 uint8 arrays.
    Raises VideoUnreadableError if the file can't be read or no face is found."""
    video_path = str(video_path)
    if not os.path.isfile(video_path):
        raise VideoUnreadableError(f"file not found: {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise VideoUnreadableError(f"cannot open video: {video_path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0 or np.isnan(fps):
            fps = 25.0
        step = max(1, int(round(fps * FRAME_INTERVAL_S)))
        cropper = _get_cropper()
        faces: list[np.ndarray] = []
        idx = 0
        while True:
            if not cap.grab():
                break
            if idx % step == 0:
                ok, bgr = cap.retrieve()
                if ok and bgr is not None:
                    face = cropper.crop(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                    if face is not None:
                        faces.append(face)
            idx += 1
    finally:
        cap.release()
    if idx == 0:
        raise VideoUnreadableError(f"no frames decoded: {video_path}")
    if not faces:
        raise VideoUnreadableError(f"no face detected in any sampled frame: {video_path}")
    if len(faces) > max_frames:  # uniform subsample
        keep = np.linspace(0, len(faces) - 1, max_frames).round().astype(int)
        faces = [faces[i] for i in keep]
    return faces


# --------------------------------------------------------------------------- model
def _torch():
    import torch  # lazy so importing this module is cheap for non-video code paths
    return torch


def build_model(pretrained: bool = True):
    import torch.nn as nn
    from torchvision import models

    weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
    m = models.efficientnet_b0(weights=weights)
    in_f = m.classifier[1].in_features
    m.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(in_f, 1))  # single logit: P(fake)
    return m


def _to_tensor(frames: list[np.ndarray]):
    torch = _torch()
    x = torch.from_numpy(np.stack(frames)).float().div(255.0).permute(0, 3, 1, 2)
    mean = torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(1, 3, 1, 1)
    return (x - mean) / std


_model = None
_device = None
_loaded_path: Optional[Path] = None


def load_model(path: str | Path = DEFAULT_MODEL_PATH):
    """Load (and cache) the trained model. Raises FileNotFoundError if not trained yet."""
    global _model, _device, _loaded_path
    path = Path(path)
    if _model is not None and _loaded_path == path:
        return _model, _device
    if not path.is_file():
        raise FileNotFoundError(f"video model not found at {path} - train it first")
    torch = _torch()
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    m = build_model(pretrained=False)
    m.load_state_dict(torch.load(path, map_location=_device))
    _model = m.to(_device).eval()
    _loaded_path = path
    return _model, _device


def model_fingerprint(path: str | Path = DEFAULT_MODEL_PATH) -> Optional[str]:
    """SHA-256 of the weights file - log this in the evidence record next to model_version."""
    p = Path(path)
    if not p.is_file():
        return None
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------- inference API
def predict_video(video_path: str | Path, model_path: str | Path = DEFAULT_MODEL_PATH) -> dict:
    """Score one video. Never raises for bad input; returns status='error' instead of a verdict."""
    base = {"status": "ok", "p_fake": None, "n_frames": 0, "model_version": MODEL_VERSION, "error": None}
    try:
        faces = extract_face_frames(video_path)
    except VideoUnreadableError as e:
        log.warning("video unscored: %s", e)
        return {**base, "status": "error", "error": str(e)}
    try:
        model, device = load_model(model_path)
        torch = _torch()
        with torch.no_grad():
            logits = model(_to_tensor(faces).to(device)).squeeze(1)
            probs = torch.sigmoid(logits).cpu().numpy()
    except FileNotFoundError as e:
        return {**base, "status": "error", "error": str(e)}
    return {**base, "p_fake": float(np.mean(probs)), "n_frames": len(faces)}


def score_video(video_path: str | Path, model_path: str | Path = DEFAULT_MODEL_PATH) -> Optional[float]:
    """Convenience wrapper: P(fake) in [0,1], or None if the video could not be scored."""
    return predict_video(video_path, model_path)["p_fake"]


class VideoDetector:
    """Interface expected by pipeline.py / api.py:
         VideoDetector()            -> no-arg constructor (api.py)
         .score(video_path)         -> float P(fake) in [0,1], or None if unscorable (pipeline.py)
         .version                   -> str, logged in the evidence record (pipeline.py)
    score() returns None (never 0.5) for unreadable videos, no-face videos, or when no trained model exists,
    so fuse() drops the video modality instead of counting it as FAKE."""

    def __init__(self, model_path: str | Path = DEFAULT_MODEL_PATH) -> None:
        self.model_path = Path(model_path)
        self._version: Optional[str] = None
        self._version_mtime: Optional[float] = None

    @property
    def version(self) -> str:
        if not self.model_path.is_file():
            return f"{MODEL_VERSION}-untrained"
        mtime = self.model_path.stat().st_mtime
        if self._version is None or self._version_mtime != mtime:
            self._version = f"{MODEL_VERSION}:{(model_fingerprint(self.model_path) or '')[:12]}"
            self._version_mtime = mtime
        return self._version

    def score(self, video_path: str | Path) -> Optional[float]:
        result = predict_video(video_path, self.model_path)
        if result["p_fake"] is None:
            log.warning("video not scored (%s)", result["error"])
        return result["p_fake"]

    def predict(self, video_path: str | Path) -> dict:
        """Full result dict (status, p_fake, n_frames, error) for logging/debugging."""
        return predict_video(video_path, self.model_path)


# --------------------------------------------------------------------------- data prep
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def _group_of(stem: str) -> str:
    """Identity group = first token of the filename (FF++: '000_003' -> '000'; Celeb-DF: 'id0_id1_0000' -> 'id0').
    Known limitation: the second identity of a fake is not tracked. Prefer the official FF++ splits JSON."""
    return stem.split("_")[0]


def _assign_splits(groups: list[str], splits_json: Optional[str], seed: int) -> dict[str, str]:
    mapping: dict[str, str] = {}
    if splits_json:
        # official FF++ format: [["953","974"], ...] per split file, merged as {"train":[...],"val":[...],"test":[...]}
        data = json.loads(Path(splits_json).read_text())
        for split, pairs in data.items():
            for pair in pairs:
                for ident in pair:
                    mapping[str(ident)] = split
        missing = [g for g in set(groups) if g not in mapping]
        if missing:
            log.warning("%d identities not in splits JSON, they will be skipped", len(missing))
        return mapping
    uniq = sorted(set(groups))
    random.Random(seed).shuffle(uniq)
    n = len(uniq)
    n_tr, n_va = int(0.7 * n), int(0.15 * n)
    for i, g in enumerate(uniq):
        mapping[g] = "train" if i < n_tr else ("val" if i < n_tr + n_va else "test")
    return mapping


def cmd_prepare(a) -> None:
    root, cache = Path(a.data_root), Path(a.cache)
    cache.mkdir(parents=True, exist_ok=True)
    items = []
    for label_name, label in (("real", 0), ("fake", 1)):
        d = root / label_name
        for p in sorted(d.rglob("*")):
            if p.suffix.lower() in VIDEO_EXTS:
                items.append((p, label))
    if not items:
        raise SystemExit(f"no videos found under {root}/real and {root}/fake")
    splits = _assign_splits([_group_of(p.stem) for p, _ in items], a.splits_json, a.seed)

    rows, skipped = [], 0
    for i, (p, label) in enumerate(items, 1):
        group = _group_of(p.stem)
        split = splits.get(group)
        if split is None:
            continue
        vid = f"{'fake' if label else 'real'}_{p.stem}"
        vdir = cache / vid
        try:
            faces = extract_face_frames(p, max_frames=TRAIN_FRAMES_PER_VIDEO)
        except VideoUnreadableError as e:
            log.warning("skip %s: %s", p.name, e)
            skipped += 1
            continue
        vdir.mkdir(exist_ok=True)
        for j, f in enumerate(faces):
            cv2.imwrite(str(vdir / f"{j:03d}.jpg"), cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
        rows.append({"video_id": vid, "label": label, "group": group, "split": split, "n_frames": len(faces)})
        if i % 25 == 0:
            print(f"[prepare] {i}/{len(items)} videos")
    with open(cache / "manifest.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["video_id", "label", "group", "split", "n_frames"])
        w.writeheader()
        w.writerows(rows)
    _assert_disjoint(rows)
    print(f"[prepare] done: {len(rows)} videos cached, {skipped} skipped. manifest -> {cache/'manifest.csv'}")


def _assert_disjoint(rows: list[dict]) -> None:
    by_split: dict[str, set] = {}
    for r in rows:
        by_split.setdefault(r["split"], set()).add(r["group"])
    names = list(by_split)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            overlap = by_split[names[i]] & by_split[names[j]]
            assert not overlap, f"identity leak between {names[i]} and {names[j]}: {sorted(overlap)[:5]}"
    print("[prepare] identity-disjoint check passed:", {k: len(v) for k, v in by_split.items()})


# --------------------------------------------------------------------------- training
def _read_manifest(cache: Path) -> list[dict]:
    with open(cache / "manifest.csv") as f:
        return list(csv.DictReader(f))


def _make_dataset(cache: Path, rows: list[dict], train: bool):
    from torch.utils.data import Dataset
    from torchvision import transforms as T

    aug = T.Compose([
        T.ToPILImage(),
        T.RandomHorizontalFlip(),
        T.ColorJitter(0.2, 0.2, 0.2),
        T.RandomApply([T.GaussianBlur(3)], p=0.2),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    plain = T.Compose([T.ToPILImage(), T.ToTensor(), T.Normalize(IMAGENET_MEAN, IMAGENET_STD)])

    class FrameDS(Dataset):
        def __init__(self):
            self.samples = []
            for r in rows:
                for img in sorted((cache / r["video_id"]).glob("*.jpg")):
                    self.samples.append((img, int(r["label"]), r["video_id"]))
            self.tf = aug if train else plain

        def __len__(self):
            return len(self.samples)

        def __getitem__(self, i):
            path, label, vid = self.samples[i]
            img = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
            return self.tf(img), float(label), vid

    return FrameDS()


def _video_level_eval(model, loader, device) -> dict:
    torch = _torch()
    from sklearn.metrics import accuracy_score, roc_auc_score

    model.eval()
    per_video: dict[str, list[float]] = {}
    labels: dict[str, int] = {}
    with torch.no_grad():
        for x, y, vids in loader:
            p = torch.sigmoid(model(x.to(device)).squeeze(1)).cpu().numpy()
            for pi, yi, v in zip(p, y.numpy(), vids):
                per_video.setdefault(v, []).append(float(pi))
                labels[v] = int(yi)
    ids = sorted(per_video)
    y_true = np.array([labels[v] for v in ids])
    y_score = np.array([np.mean(per_video[v]) for v in ids])
    out = {"n_videos": len(ids), "accuracy": float(accuracy_score(y_true, y_score >= 0.5))}
    out["roc_auc"] = float(roc_auc_score(y_true, y_score)) if len(set(y_true)) > 1 else None
    return out


def cmd_train(a) -> None:
    torch = _torch()
    import torch.nn as nn
    from torch.utils.data import DataLoader

    cache = Path(a.cache)
    rows = _read_manifest(cache)
    _assert_disjoint(rows)
    tr = [r for r in rows if r["split"] == "train"]
    va = [r for r in rows if r["split"] == "val"]
    if not tr or not va:
        raise SystemExit("need non-empty train and val splits in manifest.csv")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train] device={device}  train videos={len(tr)}  val videos={len(va)}")
    tr_ds, va_ds = _make_dataset(cache, tr, True), _make_dataset(cache, va, False)
    tr_dl = DataLoader(tr_ds, batch_size=a.batch, shuffle=True, num_workers=a.workers, pin_memory=True)
    va_dl = DataLoader(va_ds, batch_size=a.batch, shuffle=False, num_workers=a.workers)

    model = build_model(True).to(device)
    n_fake = sum(int(r["label"]) for r in tr)
    pos_weight = torch.tensor([(len(tr) - n_fake) / max(1, n_fake)], device=device)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=a.epochs)

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    best_auc, history = -1.0, []
    for ep in range(1, a.epochs + 1):
        model.train()
        tot, n = 0.0, 0
        for x, y, _ in tr_dl:
            x, y = x.to(device), y.float().to(device)
            opt.zero_grad()
            loss = loss_fn(model(x).squeeze(1), y)
            loss.backward()
            opt.step()
            tot += loss.item() * len(y)
            n += len(y)
        sched.step()
        m = _video_level_eval(model, va_dl, device)
        history.append({"epoch": ep, "train_loss": tot / n, **m})
        print(f"[train] epoch {ep}/{a.epochs} loss={tot/n:.4f} val_acc={m['accuracy']:.4f} val_auc={m['roc_auc']}")
        score = m["roc_auc"] if m["roc_auc"] is not None else m["accuracy"]
        if score > best_auc:
            best_auc = score
            torch.save(model.state_dict(), out)
    (out.with_suffix(".history.json")).write_text(json.dumps(history, indent=2))
    print(f"[train] best val score {best_auc:.4f}; weights -> {out}")
    print(f"[train] sha256 = {model_fingerprint(out)}")


def cmd_test(a) -> None:
    """Run ONCE at the end on the held-out test split. Do not tune on this."""
    torch = _torch()
    from torch.utils.data import DataLoader

    cache = Path(a.cache)
    rows = [r for r in _read_manifest(cache) if r["split"] == "test"]
    if not rows:
        raise SystemExit("no test rows in manifest.csv")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(False)
    model.load_state_dict(torch.load(a.model, map_location=device))
    model.to(device)
    dl = DataLoader(_make_dataset(cache, rows, False), batch_size=a.batch, shuffle=False, num_workers=a.workers)
    res = _video_level_eval(model, dl, device)
    res["model_sha256"] = model_fingerprint(a.model)
    res["model_version"] = MODEL_VERSION
    print(json.dumps(res, indent=2))
    Path(a.model).with_suffix(".test.json").write_text(json.dumps(res, indent=2))


# --------------------------------------------------------------------------- CLI
def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="VoxTrace video deepfake detector")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("prepare", help="extract face crops + identity-disjoint manifest")
    p.add_argument("--data-root", required=True)
    p.add_argument("--cache", default="data/video_frames")
    p.add_argument("--splits-json", default=None, help='{"train":[[a,b],..],"val":..,"test":..}')
    p.add_argument("--seed", type=int, default=42)
    p.set_defaults(fn=cmd_prepare)

    p = sub.add_parser("train")
    p.add_argument("--cache", default="data/video_frames")
    p.add_argument("--out", default=str(DEFAULT_MODEL_PATH))
    p.add_argument("--epochs", type=int, default=5)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--workers", type=int, default=2)
    p.set_defaults(fn=cmd_train)

    p = sub.add_parser("test")
    p.add_argument("--cache", default="data/video_frames")
    p.add_argument("--model", default=str(DEFAULT_MODEL_PATH))
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--workers", type=int, default=2)
    p.set_defaults(fn=cmd_test)

    a = ap.parse_args()
    random.seed(42)
    np.random.seed(42)
    try:
        _torch().manual_seed(42)
    except Exception:
        pass
    a.fn(a)


if __name__ == "__main__":
    main()