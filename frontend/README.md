# VoxTrace original frontend

The original 13 page layouts and React Bits components are restored: landing, command center, live analysis, case detail, evidence locker, incident database, threat intelligence, SIEM, playbook, robustness, model evaluation, settings and team.

Galaxy particles, animated text, spotlight cards, star/electric borders, hover effects, gauges and the floating dock are included. ClickSpark remains removed. The missing stylesheet and cyber grid component have been supplied.

## Run

From this folder: `npm.cmd ci` (first install), then `npm.cmd run dev`. This starts the backend and frontend together, reuses a healthy VoxTrace API, and prints the frontend URL. Press Ctrl+C to stop services started by the command.

To run only Vite, use `npm.cmd run dev:frontend`; configure `VOXTRACE_API_TARGET` to point it at a running API.

For manual backend-only startup from the repo root, run:

```powershell
.\.venv\Scripts\python.exe -m uvicorn voxtrace.api:app --reload --host 127.0.0.1 --port 8011
```

Use this `voxtrace` checkout, not the neighboring `VoxTrace-repo`.

## Scope

Uploads, incident data, dashboard counts, verification and evidence JSON export use the local API. A trained audio model and held-out score artifacts are supplied; evaluation metrics are recomputed from those scores, but the source audio dataset is absent for independent reproduction. No trained video weights are supplied, so video uploads are recorded as unscored. Wazuh and live external enrichment are not connected. Live streaming, Grad-CAM and tampering with the real ledger are disabled. Settings controls preview proposed policy; only role/FX display preferences persist, with no backend authorization implied. Case waveform graphics are explicitly illustrative.

## Checks

`npm.cmd run build` builds production assets. `npm.cmd run test:e2e` checks navigation, uploads, mobile layout and error handling in installed Microsoft Edge, using isolated test evidence. A production deployment needs a same-origin /api reverse proxy.
