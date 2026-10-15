// Disposable diagnostic host. The optional Workspace mode restores production startup only.
const { app, BrowserWindow } = require('electron');
const { mkdirSync, watch } = require('node:fs');
const { dirname, join } = require('node:path');
const { env } = require('node:process');
const { runWindowsProjectReveal, resolveWindowsPowerShell } = require(env.WORKSPACE_MINIMAL_REVEAL_MODULE);
// Production resolves the trusted executable once at main startup, before intent.
const program = resolveWindowsPowerShell();
if (['bare', 'watch'].includes(env.WORKSPACE_MINIMAL_REVEAL_HOST)) for (const name of ['userData', 'sessionData']) {
  const directory = join(env.WORKSPACE_MINIMAL_REVEAL_PROFILE, name);
  mkdirSync(directory);
  app.setPath(name, directory);
}
const watchState = { active: false, error: false };
globalThis.minimalWatchState = () => ({ ...watchState });
globalThis.minimalWatchSetup = () => {
  const watcher = watch(dirname(env.WORKSPACE_MINIMAL_REVEAL_TARGET), { recursive: false, persistent: false }, () => {});
  watchState.active = true;
  watcher.on('error', () => { watchState.active = false; watchState.error = true; watcher.close(); });
  app.once('will-quit', () => { watchState.active = false; watcher.close(); });
  return { ...watchState };
};
globalThis.minimalReveal = async () => {
  const result = { outcome: 'failed', opens: 0, permits: 0, selections: 0, stopped: 0, unknown: false, trace: [] };
  try {
    await runWindowsProjectReveal(env.WORKSPACE_MINIMAL_REVEAL_TARGET,
      { isCurrent: () => true, permit: dispatch => { result.permits++; dispatch(); } },
      { program, nativeDirectory: env.WORKSPACE_MINIMAL_REVEAL_NATIVE, onEvent: event => {
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
if (['bare', 'watch'].includes(env.WORKSPACE_MINIMAL_REVEAL_HOST)) app.whenReady().then(async () => {
  const window = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadURL('data:text/html,' + encodeURIComponent('<title>Minimal Reveal</title>'));
});
