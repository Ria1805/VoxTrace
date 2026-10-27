"""Local VoxTrace API. No demo seeding or fabricated research results.

Run with one key source: VOXTRACE_LEDGER_KEY or VOXTRACE_KEY_FILE.
A first local run creates a key outside the fresh vt-runtime data directory.
"""
import csv
import hashlib
import json
import math
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

from audioread.exceptions import NoBackendError
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile

from .audio_detector import AudioDetector
from .custody import CustodyLedger, LedgerError, generate_key_file, read_trusted_head
from .pipeline import VoxTrace
from .threat_intel import ThreatIntel
from .video_detector import VideoDetector

ROOT = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get("VOXTRACE_HOME", str(ROOT / "vt-runtime"))).expanduser().resolve()
EVIDENCE = HOME / "evidence"
SIEM_LOG = HOME / "voxtrace-events.jsonl"
VIDEO_PREVIEW_DIR = ROOT / "data" / "video_preview" / "download"
EVIDENCE.mkdir(parents=True, exist_ok=True)
key_file = os.environ.get("VOXTRACE_KEY_FILE")
if not os.environ.get("VOXTRACE_LEDGER_KEY") and not key_file:
    default_key = ROOT / ".secrets" / "ledger.key"
    if not default_key.exists():
        if (HOME / "incidents.db").exists():
            raise LedgerError("Existing ledger: supply its original key; refusing to generate a replacement")
        default_key.parent.mkdir(exist_ok=True)
        generate_key_file(str(default_key))
    key_file = str(default_key)
ledger = CustodyLedger(str(HOME / "incidents.db"),
                       key_path=os.path.expanduser(key_file) if key_file else None,
                       siem_log_path=str(SIEM_LOG))
EXPECTED_FP = os.environ.get("VOXTRACE_KEY_FP")


class AvailableAudio(AudioDetector):
    def score(self, path):
        if not self.trained:
            return None
        try:
            return super().score(path)
        except (NoBackendError, OSError, ValueError, RuntimeError):
            return None


_audio = AvailableAudio()
_audio.version = "audio-baseline-0.1-untrained"
model = ROOT / "models" / "audio.joblib"
if model.is_file():
    import hashlib
    _audio.load(str(model))
    _audio.version = "audio-baseline-0.1:" + hashlib.sha256(model.read_bytes()).hexdigest()[:12]
vt = VoxTrace(_audio, VideoDetector(), ledger, ThreatIntel(str(ROOT / "data" / "iocs")))
app = FastAPI(title="VoxTrace Analysis & Evidence", version="0.2.0")


def provenance(record=None):
    return {"run_id": record["record_hash"] if record else None,
            "split": "not applicable (user upload)" if record else "not evaluated",
            "kind": "inference record; not an evaluation run" if record else "unmeasured"}


def decode_record(row, columns):
    rec = dict(zip(columns, row))
    for key in ("evidence_files", "model_versions", "ioc_matches", "playbook_actions"):
        rec[key] = json.loads(rec[key]) if rec.get(key) else ([] if key != "model_versions" else {})
    actions = rec["playbook_actions"]
    rec["severity"] = actions[0] if actions else "UNSCORED"
    rec["key_fp"] = ledger.key_fp
    rec["audio_timeline"] = []
    rec["video_frames"] = []
    a, v = rec["audio_score"], rec["video_score"]
    n = int(a is not None) + int(v is not None)
    wa = (1 / n) if n and a is not None else 0
    wv = (1 / n) if n and v is not None else 0
    rec["fusion_breakdown"] = {"w_audio": wa, "w_video": wv,
        "audio_contribution": a * wa if a is not None else None,
        "video_contribution": v * wv if v is not None else None,
        "formula": "Weighted mean over available modalities", "rationale": "Equal weights renormalised over scored inputs; not calibrated."}
    rec["provenance"] = provenance(rec)
    rec["simulated"] = any(Path(e["path"]).name.startswith("seed_") for e in rec["evidence_files"])
    if rec["simulated"]:
        rec["provenance"] = {"run_id": None, "split": "not evaluated", "kind": "legacy simulated incident"}
    return rec


@app.get("/status")
def status():
    video_available = vt.video.model_path.is_file()
    return {"api": "online", "audio": {"available": _audio.trained, "version": _audio.version},
            "video": {"available": video_available, "version": vt.video.version,
                      "reason": None if video_available else "No trained video model is installed."},
            "research": "unmeasured", "wazuh": "not verified", "provenance": provenance(),
            "notes": ["Model file availability does not establish detection quality.",
                      "Audio held-out score artifacts are available; the source dataset is not included.",
                      "Audio calibration and video accuracy/robustness remain unmeasured.",
                      "Video is secondary; equal weights are renormalised over scored modalities."]}


@app.get("/dataset/preview")
def dataset_preview():
    classes = []
    for label, folder in (("original", "video"), ("deepfake", "deepfake")):
        directory = VIDEO_PREVIEW_DIR / folder
        files = sorted(
            path for path in directory.iterdir()
            if directory.is_dir() and path.is_file() and path.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv", ".webm"}
        ) if directory.is_dir() else []
        classes.append({"label": label, "count": len(files), "files": [path.name for path in files]})
    return {
        "dataset": "UniDataPro DeepFake Videos Dataset preview",
        "source": "https://huggingface.co/datasets/UniDataPro/deepfake-videos-dataset",
        "license": "CC BY-NC-ND 4.0",
        "purpose": "Local preview inventory only; not used for training, evaluation, or inference.",
        "evaluated": False,
        "total_videos": sum(item["count"] for item in classes),
        "classes": classes,
    }


@app.post("/analyze")
def analyze(audio: Optional[UploadFile] = File(None), video: Optional[UploadFile] = File(None),
            observables: str = Form("{}")):
    if not audio and not video:
        raise HTTPException(400, "Upload an audio and/or video file")
    try:
        indicators = json.loads(observables)
        if not isinstance(indicators, dict) or any(
            not isinstance(k, str) or not isinstance(v, list) or
            any(not isinstance(item, str) for item in v) for k, v in indicators.items()
        ):
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(422, "Observables must be an object mapping indicator types to lists of strings")
    saved = {}
    for name, upload in (("audio", audio), ("video", video)):
        if upload:
            safe = Path((upload.filename or name).replace("\\", "/")).name or name
            dst = EVIDENCE / f"{uuid.uuid4().hex}_{safe}"
            with dst.open("wb") as target:
                shutil.copyfileobj(upload.file, target)
            saved[name] = str(dst)
    try:
        result = vt.analyze(saved.get("audio") or saved["video"], audio_path=saved.get("audio"),
                            video_path=saved.get("video"), observables=indicators)
    except LedgerError as exc:
        # Preserve received evidence for investigation if a ledger write was refused.
        raise HTTPException(409, f"Evidence retained, but ledger refused the write: {exc}")
    result["provenance"] = provenance(result)
    result["warnings"] = []
    if audio and result["audio_score"] is None:
        result["warnings"].append("Audio unscored: model unavailable or media unreadable.")
    if video and result["video_score"] is None:
        detail = (result.get("video_details") or {}).get("error")
        result["warnings"].append(f"Video unscored: {detail}" if detail else
                                  "Video unscored: missing model, unreadable media or no usable face.")
    result["warnings"].append("Scores are not calibrated or validated research results. Manual review is required.")
    return result


@app.get("/verify")
@app.post("/ledger/verify")
def verify():
    trusted = read_trusted_head(str(SIEM_LOG), ledger.key) if SIEM_LOG.exists() else None
    ok, problems = ledger.verify(trusted_head=trusted, emit=True, expected_key_fp=EXPECTED_FP)
    return {"chain_intact": ok, "problems": problems, "key_fp": ledger.key_fp,
            "checked_against_external_head": trusted is not None,
            "checked_key_fingerprint": EXPECTED_FP is not None,
            "external_head_source": "local event log; not an independent off-host SIEM copy",
            "scanned_at": time.time()}


@app.get("/incidents")
def list_incidents(limit: int = Query(100, ge=1, le=1000), verdict: Optional[str] = None,
                   search: Optional[str] = None):
    with ledger._lock:
        query = "SELECT * FROM incidents WHERE 1=1"
        params = []
        if verdict and verdict != "ALL":
            query += " AND verdict = ?"
            params.append(verdict)
        if search:
            query += " AND (evidence_path LIKE ? OR record_hash LIKE ? OR evidence_sha256 LIKE ?)"
            params.extend([f"%{search}%"] * 3)
        cur = ledger.db.execute(query + " ORDER BY seq DESC LIMIT ?", params + [limit])
        columns = [d[0] for d in cur.description]
        return [decode_record(row, columns) for row in cur.fetchall()]


@app.get("/incidents/{identifier}")
def get_incident(identifier: str):
    with ledger._lock:
        cur = ledger.db.execute("SELECT * FROM incidents WHERE record_hash = ? OR CAST(seq AS TEXT) = ?",
                                (identifier, identifier))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Incident not found")
        return decode_record(row, [d[0] for d in cur.description])


@app.get("/evidence/bundle/{identifier}")
def bundle(identifier: str):
    return {"exported_at": time.time(), "incident_record": get_incident(identifier),
            "verification": verify(), "format": "VoxTrace research evidence record",
            "limitations": "HMAC tamper evidence is not non-repudiation or a certification of legal admissibility."}


@app.get("/iocs")
def iocs():
    return [{"type": kind, "value": value, **entry}
            for (kind, value), entries in vt.intel.index.items() for entry in entries]


@app.get("/models/evaluation")
def evaluation():
    import numpy as np
    from sklearn.metrics import confusion_matrix, roc_curve

    def read_scores(filename, field):
        path = ROOT / "models" / filename
        if not path.is_file():
            return None
        labels, scores = [], []
        with path.open(newline="", encoding="utf-8") as source:
            for row in csv.DictReader(source):
                label, score = int(row["y_true"]), float(row[field])
                if label not in (0, 1):
                    raise ValueError(f"Invalid label in {path.name}: {label}")
                if math.isfinite(score) and 0 <= score <= 1:
                    labels.append(label)
                    scores.append(score)
        if not labels or len(set(labels)) != 2:
            return None
        return np.asarray(labels), np.asarray(scores)

    from .evaluate import report

    configurations = [
        ("Baseline (clean)", "audio_test_scores.csv", "score_clean", "Audio MFCC + spectral baseline", "audio_baseline.joblib"),
        ("Phone-augmented (clean)", "audio_phoneaug_test_scores.csv", "score_clean", "Phone-augmented MFCC + spectral model", "audio.joblib"),
        ("Phone-augmented (phone band-limited)", "audio_phoneaug_test_scores.csv", "score_phone", "Phone-augmented MFCC + spectral model", "audio.joblib"),
    ]
    table, measured, fingerprints = [], {}, []
    for label, scores_file, score_field, model_name, weights_file in configurations:
        evaluated = read_scores(scores_file, score_field)
        if evaluated is None:
            continue
        y_true, y_score = evaluated
        metrics = report(y_true, y_score)
        table.append({"modality": label, "model": model_name, **metrics,
                      "split": "speaker-disjoint held-out test", "status": "RECOMPUTED FROM SCORES"})
        measured[label] = (y_true, y_score)
        weights_path = ROOT / "models" / weights_file
        if weights_path.is_file():
            fingerprints.append((weights_file, hashlib.sha256(weights_path.read_bytes()).hexdigest()))

    clean = measured.get("Phone-augmented (clean)")
    phone = measured.get("Phone-augmented (phone band-limited)")
    baseline = measured.get("Baseline (clean)")
    roc_data = []
    if clean:
        grid = np.linspace(0, 1, 101)
        curves = {}
        for key, sample in (("tpr_baseline", baseline), ("tpr_audio", clean), ("tpr_phone", phone)):
            if sample:
                fpr, tpr, _ = roc_curve(*sample)
                curves[key] = np.interp(grid, fpr, tpr)
        for index, fpr in enumerate(grid):
            point = {"fpr": float(fpr)}
            point.update({key: float(values[index]) for key, values in curves.items()})
            roc_data.append(point)

    matrices = {}
    if clean:
        y_true, y_score = clean
        tn, fp, fn, tp = confusion_matrix(y_true, y_score >= 0.5, labels=[0, 1]).ravel()
        matrices["audio"] = {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
    for weights_file in ("audio_baseline.joblib", "audio.joblib"):
        weights_path = ROOT / "models" / weights_file
        if weights_path.is_file():
            fingerprints.append((weights_file, hashlib.sha256(weights_path.read_bytes()).hexdigest()))
    unique_fingerprints = sorted(set(fingerprints))
    digest = hashlib.sha256()
    for name, fingerprint in unique_fingerprints:
        digest.update(name.encode())
        digest.update(fingerprint.encode())
    run_id = f"audio-artifacts-{digest.hexdigest()[:16]}" if table else None
    registry = [
        {"name": "Audio baseline", "version": "audio-baseline-0.1",
         "dataset": "In-the-Wild; 38 train / 16 held-out speakers",
         "weights_sha256": fingerprint}
        for filename, fingerprint in unique_fingerprints if filename == "audio_baseline.joblib"
    ]
    registry.extend(
        {"name": "Audio phone-augmented", "version": "audio-phoneaug-0.1",
         "dataset": "In-the-Wild; 38 train / 16 held-out speakers",
         "weights_sha256": fingerprint}
        for filename, fingerprint in unique_fingerprints if filename == "audio.joblib"
    )
    return {
        "status": "measured" if table else "unmeasured",
        "run_id": run_id,
        "dataset": "In-the-Wild voice dataset",
        "split": "Speaker-disjoint held-out test (16 speakers)",
        "table": table,
        "roc_curve": roc_data,
        "confusion_matrices": matrices,
        "registry": registry,
        "provenance_policy": "Metrics recomputed from checked-in held-out score CSVs; source audio dataset is not included in this checkout.",
        "message": ("Evaluation scores are recomputed from the checked-in held-out-speaker results. "
                    "The source audio dataset is not present locally, so the training/evaluation run cannot be independently reproduced."
                    if table else "No held-out audio score files are available."),
    }

@app.get('/metrics')
def metrics():
    from collections import Counter
    from datetime import datetime, timezone
    with ledger._lock:
        cur = ledger.db.execute('SELECT * FROM incidents ORDER BY seq')
        rows = [decode_record(row, [d[0] for d in cur.description]) for row in cur.fetchall()]
    counts = Counter(r['verdict'] for r in rows)
    buckets = [0] * 10
    dates = {}
    for r in rows:
        if r['fused_score'] is not None:
            buckets[min(int(r['fused_score'] * 10), 9)] += 1
        day = datetime.fromtimestamp(r['ts'], timezone.utc).strftime('%Y-%m-%d')
        d = dates.setdefault(day, {'date': day, 'fakes': 0, 'reals': 0, 'unscored': 0})
        d[{'FAKE': 'fakes', 'REAL': 'reals'}.get(r['verdict'], 'unscored')] += 1
    verification = verify()
    return {'samples_analyzed': len(rows), 'fakes_flagged': counts['FAKE'], 'reals_count': counts['REAL'],
            'unscored_count': counts['UNSCORED'], 'open_incidents': sum(r['severity'] in ('HIGH','CRITICAL','MEDIUM') for r in rows),
            'ledger_integrity': verification['chain_intact'], 'integrity_problems': verification['problems'],
            'key_fp': ledger.key_fp, 'ioc_matches_today': sum(len(r['ioc_matches']) for r in rows if datetime.fromtimestamp(r['ts'], timezone.utc).date() == datetime.now(timezone.utc).date()),
            'fused_score_distribution': [{'range': f'{i*10}-{(i+1)*10}%', 'count': n} for i,n in enumerate(buckets)],
            'detections_over_time': list(dates.values()),
            'system_health': {'api': 'ONLINE', 'model_audio': _audio.version, 'model_video': vt.video.version,
                              'wazuh_agent': 'NOT VERIFIED', 'ledger': 'VERIFIED' if verification['chain_intact'] else 'CHECK FAILED',
                              'key_fingerprint': ledger.key_fp}}


@app.get('/ledger/chain')
def chain():
    check = verify()
    rows = list_incidents(limit=1000)
    return {'blocks': list(reversed(rows)), 'key_fp': ledger.key_fp,
            'chain_intact': check['chain_intact'], 'problems': check['problems']}


@app.get('/intel')
def intel_dashboard():
    indicators = [{**i, 'confidence': 'EXAMPLE ONLY', 'campaign': None, 'last_seen': 'Not observed'} for i in iocs()]
    nodes, links, seen_links = [], [], set()
    for record in list_incidents(limit=1000):
        if not record["ioc_matches"]:
            continue
        detection_id = f"detection-{record['seq']}"
        evidence_name = Path(record["evidence_path"]).name
        nodes.append({"id": detection_id, "label": evidence_name, "type": "detection",
                      "severity": record["severity"]})
        for match in record["ioc_matches"]:
            value = str(match["value"])
            kind = match["type"]
            node_type = "tool" if kind == "tts_tool" else kind
            indicator_id = f"indicator-{kind}-{hashlib.sha256(value.lower().encode()).hexdigest()[:12]}"
            if not any(node["id"] == indicator_id for node in nodes):
                nodes.append({"id": indicator_id, "label": value, "type": node_type})
            link_key = (detection_id, indicator_id)
            if link_key not in seen_links:
                links.append({"source": detection_id, "target": indicator_id, "relation": "matched"})
                seen_links.add(link_key)
    return {'iocs': indicators, 'graph': {'nodes': nodes, 'links': links},
            'enrichment': {'virustotal': {'domain': 'Not queried', 'positives': '—', 'total_engines': '—',
                'reputation_score': 'Not measured', 'registrar': 'Not queried', 'dns_resolution': 'Not queried'},
                'urlscan': {'url': 'Not queried', 'verdict': 'Not queried', 'targeted_brand': 'Not attributed', 'server_location': 'Not queried'}},
            'rule_card': {
                'title': 'IOC match escalation rule',
                'status': 'ACTIVE',
                'condition': 'Exact domain, phone, hash, or other IOC match; TTS tool names are context only.',
                'action': 'Raise severity one tier, capped at HIGH. CRITICAL requires a detector score of 0.90 or higher.',
                'rationale': 'An IOC is independent evidence, but false-positive indicators must not block a caller by themselves.',
            }}


@app.get('/alerts')
def alerts():
    return {'alerts': [], 'mitre_matrix': [], 'siem_log_path': str(SIEM_LOG),
            'status': 'Wazuh ingestion not configured or verified; local ledger events are available separately.'}


@app.post('/robustness/status')
def robustness_status():
    return {'evasion_rate': None, 'real_flagged_as_fake': None, 'curve': [],
            'honest_reporting': 'No robustness experiment has been run. Controls configure a proposed experiment only; no detector is being tested.',
            'provenance': {'run_id': 'Not run', 'status': 'UNMEASURED', 'split': 'Not evaluated'}}
