"""FastAPI service (owner: Tanay).

Setup once (key OUTSIDE the data folder):
    python -m voxtrace.custody genkey ~/.voxtrace/ledger.key
Run:
    VOXTRACE_HOME=./vt-data VOXTRACE_KEY_FILE=~/.voxtrace/ledger.key uvicorn voxtrace.api:app
(or set VOXTRACE_LEDGER_KEY to the 64-hex-char key instead of a key file)
"""
import os, shutil, uuid
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from .pipeline import VoxTrace
from .custody import CustodyLedger, LedgerError, read_trusted_head
from .audio_detector import AudioDetector
from .video_detector import VideoDetector
from .threat_intel import ThreatIntel

PKG_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.abspath(os.path.expanduser(os.environ.get("VOXTRACE_HOME", "~/voxtrace-data")))  # local disk only
EVIDENCE = os.path.join(HOME, "evidence")
SIEM_LOG = os.path.join(HOME, "voxtrace-events.jsonl")   # point Wazuh's <localfile> at this
os.makedirs(EVIDENCE, exist_ok=True)

key_file = os.environ.get("VOXTRACE_KEY_FILE")
ledger = CustodyLedger(os.path.join(HOME, "incidents.db"),
                       key_path=os.path.expanduser(key_file) if key_file else None,
                       siem_log_path=SIEM_LOG)
print(f"[voxtrace] data={HOME} key_fp={ledger.key_fp}  (record this fingerprint somewhere independent "
      "and set VOXTRACE_KEY_FP to it)")
EXPECTED_FP = os.environ.get("VOXTRACE_KEY_FP")

_audio = AudioDetector()
_model = os.path.join(PKG_ROOT, "models", "audio.joblib")
if os.path.exists(_model):
    _audio.load(_model)
vt = VoxTrace(_audio, VideoDetector(), ledger, ThreatIntel(os.path.join(PKG_ROOT, "data", "iocs")))
app = FastAPI(title="VoxTrace")


@app.post("/analyze")
def analyze(audio: Optional[UploadFile] = File(None), video: Optional[UploadFile] = File(None)):
    if not audio and not video:
        raise HTTPException(400, "upload an audio and/or video file")
    if audio and not _audio.trained:
        raise HTTPException(503, "audio model not trained yet (models/audio.joblib missing)")
    saved = {}
    for name, up in (("audio", audio), ("video", video)):
        if up:
            safe = os.path.basename(up.filename or name) or name
            dst = os.path.join(EVIDENCE, f"{uuid.uuid4().hex}_{safe}")
            with open(dst, "wb") as f:
                shutil.copyfileobj(up.file, f)
            saved[name] = dst
    primary = saved.get("audio") or saved["video"]
    try:
        return vt.analyze(primary, audio_path=saved.get("audio"), video_path=saved.get("video"))
    except LedgerError as e:
        for p in saved.values():          # nothing was logged, so don't keep orphan evidence
            try: os.remove(p)
            except OSError: pass
        raise HTTPException(409, f"evidence log refused the write: {e}")


@app.get("/verify")
def verify():
    # In a real deployment, read the trusted head from the SIEM server's copy of the log.
    trusted = read_trusted_head(SIEM_LOG, ledger.key) if os.path.exists(SIEM_LOG) else None
    ok, problems = ledger.verify(trusted_head=trusted, emit=True, expected_key_fp=EXPECTED_FP)
    return {"chain_intact": ok, "problems": problems, "key_fp": ledger.key_fp,
            "checked_against_external_head": trusted is not None,
            "checked_key_fingerprint": EXPECTED_FP is not None,
            "external_head_source": "local copy of the event log (demo only; use the SIEM server copy)"}


@app.get("/incidents")
def incidents(limit: int = 50):
    return ledger.list_incidents(limit)
