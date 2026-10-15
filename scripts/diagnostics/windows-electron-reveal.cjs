// Disposable diagnostic host. The optional Workspace mode restores production startup only.
const { app, BrowserWindow } = require('electron');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { env } = require('node:process');
const { runWindowsProjectReveal } = require(env.WORKSPACE_MINIMAL_REVEAL_MODULE);
if (env.WORKSPACE_MINIMAL_REVEAL_HOST !== 'workspace') for (const name of ['userData', 'sessionData']) {
  const directory = join(env.WORKSPACE_MINIMAL_REVEAL_PROFILE, name);
  mkdirSync(directory);
  app.setPath(name, directory);
}
globalThis.minimalReveal = async () => {
  const result = { outcome: 'failed', opens: 0, permits: 0, selections: 0, stopped: 0, unknown: false, trace: [] };
  try {
    await runWindowsProjectReveal(env.WORKSPACE_MINIMAL_REVEAL_TARGET,
      { isCurrent: () => true, permit: dispatch => { result.permits++; dispatch(); } },
      { nativeDirectory: env.WORKSPACE_MINIMAL_REVEAL_NATIVE, onEvent: event => {
        if (event.stage === 'open') result.opens++;
        if (event.stage === 'select') result.selections++;
        if (event.stage === 'stopped') result.stopped++;
        if (event.stage === 'unknown') result.unknown = true;
        if (event.stage === 'trace') result.trace.push({ phase: event.phase, elapsedMs: event.elapsedMs });
        if (event.stage === 'failure') result.failure = { phase: event.phase, reason: event.reason };
      } });
    result.outcome = 'dispatched';
  } catch { /* Finite boundary operands, never exception text or fixture paths. */ }
  return result;
};
if (env.WORKSPACE_MINIMAL_REVEAL_HOST !== 'workspace') app.whenReady().then(async () => {
  const window = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadURL('data:text/html,' + encodeURIComponent('<title>Minimal Reveal</title>'));
});
