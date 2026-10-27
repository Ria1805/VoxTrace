# VoxTrace: audio-first analysis and evidence

Academic prototype combining audio/video detection, local threat-intelligence correlation, response actions, and tamper-evident forensic records. The contribution is integration and auditability, not a claimed accuracy improvement. See [THREAT_MODEL.md](THREAT_MODEL.md).

## Current status

- Original futuristic frontend restored with all 13 page layouts, React Bits visual effects and the floating dock. ClickSpark remains removed. See frontend/README.md for supported and pending controls.
- Uploads, phone/domain observables, case inspection, JSON export and ledger verification are connected to FastAPI.
- A trained MFCC/spectral audio model and speaker-disjoint held-out score artifacts are supplied under `models/`; the Model Evaluation page recomputes metrics and ROC points from those scores. The source In-the-Wild audio dataset is not included, so training cannot be independently reproduced here. Video EfficientNet-B0 training/inference code exists, but video weights are not supplied and video uploads remain UNSCORED.
- Equal-weight fusion renormalises over available scores; weights and thresholds are not calibrated on a validation set.
- SHA-256 evidence hashes, HMAC ledger, verification and local event logging are implemented. A local event log is not an independent off-host SIEM anchor. HMAC is not non-repudiation.
- Local threat intel loads JSON feeds from `data/iocs/`, including example indicators and voice-cloning-tool references. The IOC rule escalates exact matches one severity tier (capped at HIGH); tool names are context-only. Use `tools/build_openphish_feed.py` to convert a separately downloaded, permitted OpenPhish community feed. Live feed refresh and online enrichment are not enabled.
- Wazuh rules and an attack harness exist. Live Wazuh integration and FGSM/PGD evaluation are not verified.
- Audio held-out metrics in the evaluation view are recomputed from branch-provided score CSVs; they are not independently reproduced because the source dataset is not included. Calibration and video accuracy remain unmeasured. Automatic demo seeding, random forensic timelines and synthetic live detections have been removed.
- Detection history starts empty and counts only analyzed uploads. The video preview inventory is shown separately and is not treated as evaluated detections.
- Video identity grouping currently uses the first filename identity token. Audit source and target identities before claiming fully identity-disjoint evaluation.

## Run on Windows / PowerShell

Use `C:\Users\Bhavika\Downloads\Deepfake_project\voxtrace`. The neighboring `VoxTrace-repo` is a separate copy and has not been changed by this cleanup.

From the repo root, install Python dependencies once, then launch both services from the frontend folder:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd C:\Users\Bhavika\Downloads\Deepfake_project\voxtrace\frontend
npm.cmd ci
npm.cmd run dev
```

The command starts FastAPI and Vite together, reuses a healthy VoxTrace API if one is already running, and selects the next free frontend port starting at 5181. Open the frontend URL printed in the terminal; API docs are at `http://127.0.0.1:8011/docs` unless `VOXTRACE_API_PORT` is set. Press Ctrl+C to stop services started by this command. `npm.cmd run dev:frontend` is available when you intentionally want to run Vite separately.
Dependencies are already installed here; `npm.cmd ci` is only needed for a clean reinstall. Stop Vite with Ctrl+C before reinstalling: Windows can lock native modules. Node 24 was used for validation.

### Data and keys

The default fresh data folder is `vt-runtime/`, with its key in `.secrets/ledger.key`, outside the data folder. Both are ignored by Git. A first run creates a key only if the default key and ledger are absent. Never replace an existing ledger's key.

Copied `vt-data/` files are preserved but not opened by default. They contain a sample event log and copied SQLite sidecar bytes, not a complete portable database. SQLite manages `.db-wal` and `.db-shm`; do not hand-edit them.

For an existing ledger set `VOXTRACE_HOME` and exactly one of `VOXTRACE_KEY_FILE` or `VOXTRACE_LEDGER_KEY`. Both together are rejected. Set `VOXTRACE_KEY_FP` to an independently recorded fingerprint for pinning. Off-host anchoring requires deployment work.

### Video dataset preview

`data/video_preview/download/` contains a small, public five-pair preview from UniDataPro, marked CC BY-NC-ND 4.0. Its source, attribution and limitations are documented in [data/video_preview/README.md](data/video_preview/README.md). It is inspection-only and is not used by the detector: the preview is insufficient for training or held-out evaluation. A suitable licensed dataset and trained `models/video.pt` are still required for video scores; otherwise video uploads return `UNSCORED` with the reason.

### Train the video detector with UADFV

The video training CLI accepts an extracted dataset with `real/` and `fake/`
subfolders. For UADFV, keep its downloaded files under
`data/datasets/UADFV/`; the numeric IDs in `0000.mp4` and `0000_fake.mp4` are
grouped together so paired clips stay in the same split. The dataset itself and
trained weights are not committed.

```powershell
python -m voxtrace.video_detector prepare --data-root data\datasets\UADFV --cache data\video_frames --seed 42
python -m voxtrace.video_detector train --cache data\video_frames --out models\video.pt --epochs 5 --workers 0
python -m voxtrace.video_detector test --cache data\video_frames --model models\video.pt --workers 0
```

Install dependencies from `requirements.txt` first. The first training run may
download ImageNet EfficientNet weights. Check the prepared manifest and
identity grouping before training; UADFV is small, so report its results only
as an experiment and do not claim generalization to other deepfake datasets.

### Validation

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests require installed Microsoft Edge. They launch servers on separate test ports with isolated temporary evidence and a test-only key. Synthetic smoke tests prove integration, not detection quality.

Audio training command (requires the In-the-Wild dataset files under `data/itw/release_in_the_wild/`):

```powershell
.\.venv\Scripts\python.exe audio_train.py --phone-aug
```

The provided audio model can run inference without those training files. Its accuracy scores are supplied test artifacts and should not be presented as independently reproduced measurements.

See the current test output for API, pipeline, audio inference, IOC rules, and browser coverage. Synthetic smoke tests prove integration, not detection quality.

## Team

- Ria: audio classifier, datasets and telephony testing.
- Bhavika: video classifier, fusion, frontend and integration.
- Shaurya: training support and robustness evaluation.
- Harshita: real IOC feeds, enrichment and response thresholds.
- Tanay: ledger, backend, threat model and live SIEM integration.

Every future research metric needs a run ID, dataset/split, model hash and measurement method. Inference records show their signed record hash and `not applicable (user upload)` split; they are not evaluation runs.
