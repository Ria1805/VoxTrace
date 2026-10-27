# VoxTrace: Voice/Video Deepfake Forensics & Threat Intelligence Pipeline

Detection + DFIR (tamper-evident, signed evidence log) + threat-intel correlation + IR playbook.
Security properties and limitations: **THREAT_MODEL.md**.

## Status 
| Component | State |
|---|---|
| Evidence log (`custody.py`) | **Working**: hash chain + HMAC signatures + signed anchor + off-box head; 67 tests incl. 23-attack matrix; reviewed twice from attacker, correctness and forensics angles. Not "non-repudiation" (see THREAT_MODEL.md) |
| Fusion (`fusion.py`), playbook, threat-intel matcher, API, attack harness | **Working scaffolds** |
| Audio detector (`audio_detector.py`) | **Baseline only**, needs real dataset (ASVspoof / WaveFake / In-the-Wild) |
| Video detector (`video_detector.py`) | **PLACEHOLDER, not a detector.** Bhavika builds this |
| Wazuh rules (`siem/`) | Event log now written (`voxtrace-events.jsonl`); rules still untested against a live Wazuh |
| Results, accuracy, robustness numbers | **None yet. Do not claim any.** |

## Run
    pip install -r requirements.txt
    pytest -q
    python -m voxtrace.custody genkey ~/.voxtrace/ledger.key          # once; keep OUT of the data folder
    VOXTRACE_HOME=./vt-data VOXTRACE_KEY_FILE=~/.voxtrace/ledger.key uvicorn voxtrace.api:app
    # POST /analyze, GET /verify, GET /incidents   (Python 3.9+; keep vt-data on a LOCAL disk)

## Who does what (the real work left)
- **Ria**: train `AudioDetector` on a real dataset; add LFCC/wav2vec2/CNN; export scores for eval.
- **Bhavika**: implement `VideoDetector` (MediaPipe face crop + fine-tuned CNN on FF++/Celeb-DF, identity-disjoint split); fit fusion.
- **Shaurya**: extend `attacks.py` with white-box FGSM/PGD on the PyTorch models; run `evasion_report`.
- **Harshita**: build real IOC feeds, enrichment, finalise `playbook.py` against a documented rationale.
- **Tanay**: harden ledger/API, test Wazuh rules live, optional dashboard.

## Paper's key tables (generate with `evaluate.py`)
1. Audio-only vs video-only vs fused (precision/recall/F1/AUC, FPR)
2. Evasion rate per attack (clean vs perturbed, incl. telephony band-limit)
3. Security-property matrix for the evidence log (THREAT_MODEL.md; every row is a test)
