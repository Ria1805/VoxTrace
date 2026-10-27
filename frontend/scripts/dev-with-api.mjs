import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoDir = resolve(frontendDir, '..');
const args = process.argv.slice(2);
const portArg = args.findIndex((arg) => arg === '--port');
const explicitFrontendPort = portArg >= 0 ? Number(args[portArg + 1]) : null;
const requestedFrontendPort = explicitFrontendPort || Number(process.env.VOXTRACE_FRONTEND_PORT || 5181);
const apiTarget = process.env.VOXTRACE_API_TARGET ||
  `http://127.0.0.1:${process.env.VOXTRACE_API_PORT || 8011}`;
const apiUrl = new URL(apiTarget);
const apiPort = Number(process.env.VOXTRACE_API_PORT || apiUrl.port || 8011);
const apiBase = `${apiUrl.protocol}//${apiUrl.host}`;
const children = [];
let stopping = false;

function canBind(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
  });
}

async function pickFrontendPort() {
  for (let port = requestedFrontendPort; port < requestedFrontendPort + 100; port += 1) {
    if (await canBind(port)) return port;
    if (explicitFrontendPort) break;
  }
  throw new Error(`No available frontend port starting at ${requestedFrontendPort}.`);
}

async function apiIsReady() {
  try {
    const response = await fetch(new URL('/status', apiBase), { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json()).api === 'online';
  } catch {
    return false;
  }
}

function stopChildren(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill(signal);
  }
}

process.once('SIGINT', () => stopChildren('SIGINT'));
process.once('SIGTERM', () => stopChildren('SIGTERM'));

function launch(command, commandArgs, options) {
  const child = spawn(command, commandArgs, { stdio: 'inherit', windowsHide: true, ...options });
  children.push(child);
  child.once('error', (error) => {
    console.error(`Could not start ${command}: ${error.message}`);
    stopChildren();
  });
  child.once('exit', (code) => {
    if (!stopping) {
      console.error(`${command} exited${code === null ? '' : ` with code ${code}`}. Shutting down VoxTrace dev services.`);
      stopChildren();
    }
  });
  return child;
}

async function waitForApi(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error('The VoxTrace API exited before becoming ready.');
    if (await apiIsReady()) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`VoxTrace API did not become ready at ${apiBase}/status.`);
}

try {
  if (await apiIsReady()) {
    console.log(`Using the running VoxTrace API at ${apiBase}.`);
  } else {
    if (!(await canBind(apiPort))) {
      throw new Error(`Port ${apiPort} is occupied by a service that did not answer as VoxTrace. Set VOXTRACE_API_PORT to a free port.`);
    }
    const pythonVenv = join(repoDir, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
    const python = process.env.VOXTRACE_PYTHON || (existsSync(pythonVenv) ? pythonVenv : 'python');
    const api = launch(python, ['-m', 'uvicorn', 'voxtrace.api:app', '--host', '127.0.0.1', '--port', String(apiPort)], {
      cwd: repoDir,
      env: process.env,
    });
    await waitForApi(api);
  }

  const frontendPort = await pickFrontendPort();
  if (frontendPort !== requestedFrontendPort) {
    console.log(`Port ${requestedFrontendPort} is busy; using ${frontendPort} for the frontend.`);
  }
  console.log(`VoxTrace API: ${apiBase}`);
  console.log(`VoxTrace frontend: http://127.0.0.1:${frontendPort}`);

  launch(process.execPath, [
    join(frontendDir, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort',
  ], {
    cwd: frontendDir,
    env: { ...process.env, VOXTRACE_API_TARGET: apiBase },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stopChildren();
  process.exitCode = 1;
}
