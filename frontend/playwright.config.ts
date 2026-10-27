import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const testData = mkdtempSync(join(tmpdir(), 'voxtrace-browser-'));
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5175', trace: 'retain-on-failure',
    ...devices['Desktop Edge'], channel: 'msedge' },
  webServer: [
    { command: '..\\.venv\\Scripts\\python.exe -m uvicorn voxtrace.api:app --app-dir .. --host 127.0.0.1 --port 8001',
      url: 'http://127.0.0.1:8001/status', timeout: 60000,
      env: { VOXTRACE_HOME: testData, VOXTRACE_LEDGER_KEY: '23'.repeat(32), VOXTRACE_KEY_FILE: '', VOXTRACE_VIDEO_MODEL: join(testData, 'missing.pt') } },
    { command: 'npm.cmd run dev -- --port 5175', url: 'http://127.0.0.1:5175',
      env: { VOXTRACE_API_TARGET: 'http://127.0.0.1:8001' } },
  ],
});
