"""Smoke tests: verify the CODE works. The synthetic audio is NOT a deepfake dataset and
these tests say nothing about detection quality."""
import os, sqlite3, numpy as np, soundfile as sf, pytest
from voxtrace.audio_detector import AudioDetector
from voxtrace.pipeline import VoxTrace
from voxtrace.attacks import evasion_report
from voxtrace.fusion import fuse

SR = 16000


def make_wavs(d, n=12):
    rng = np.random.default_rng(1); paths, labels = [], []
    t = np.arange(SR * 2) / SR
    for i in range(n):
        fake = i % 2
        y = (np.sin(2 * np.pi * 200 * t) + (0.5 * rng.normal(size=t.size) if fake else 0.02 * rng.normal(size=t.size))) * 0.3
        p = os.path.join(d, f"s{i}.wav"); sf.write(p, y.astype("float32"), SR)
        paths.append(p); labels.append(fake)
    return paths, labels


def test_fusion_handles_missing_modality():
    assert fuse(0.8, None) == 0.8
    assert abs(fuse(0.8, 0.4) - 0.6) < 1e-9
    assert fuse(None, None) is None


def test_unreadable_video_gives_unscored_never_fake(tmp_path, make_ledger):
    from voxtrace.video_detector import VideoDetector
    from voxtrace.fusion import verdict_from_score
    vid = VideoDetector()
    # Unreadable or empty video frames should return None, not 0.5
    assert vid.score_frames([]) is None
    # Empty non-existent path
    assert vid.score(os.path.join(tmp_path, "corrupt.mp4")) is None
    assert verdict_from_score(None) == "UNSCORED"


def test_end_to_end_and_tamper_detection(tmp_path, make_ledger):
    paths, labels = make_wavs(tmp_path)
    det = AudioDetector().fit(paths, labels)
    vt = VoxTrace(det, None, make_ledger())
    out = vt.analyze(paths[1]); vt.analyze(paths[0])
    assert out["verdict"] in ("FAKE", "REAL")
    ok, _ = vt.ledger.verify(); assert ok
    # tamper with evidence file
    with open(paths[1], "ab") as f: f.write(b"x")
    ok, problems = vt.ledger.verify(); assert not ok and any("evidence file modified" in p for p in problems)


def test_ledger_edit_detected(tmp_path, make_ledger):
    paths, labels = make_wavs(tmp_path)
    led = make_ledger()
    for p in paths[:3]: led.log_incident(p, 0.9, None, 0.9, "FAKE")
    led.db.execute("UPDATE incidents SET fused_score=0.1 WHERE id=2")
    ok, problems = led.verify(); assert not ok and any("record modified" in p for p in problems)


def test_attack_harness_runs(tmp_path):
    paths, labels = make_wavs(tmp_path)
    det = AudioDetector().fit(paths, labels)
    fakes = [sf.read(p)[0].astype("float32") for p, l in zip(paths, labels) if l]
    rep = evasion_report(det, fakes); assert "telephony_300-3400Hz" in rep
