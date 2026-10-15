// Opt-in Phase-2 minimization, never a substitute for original cold acceptance.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { _electron } from 'playwright-core';
import { closeElectron, withDeadline } from '../runtime-lifecycle.mjs';
import { waitForRuntimeInterface } from '../runtime-startup.mjs';
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from '../file-manager-evidence.mjs';

assert.equal(process.platform, 'win32');
const output = process.env.WORKSPACE_MINIMAL_REVEAL_OUTPUT;
const host = process.env.WORKSPACE_MINIMAL_REVEAL_HOST ?? 'bare';
assert.ok(['bare', 'workspace'].includes(host));
assert.ok(output, 'An explicit evidence destination is required');
const root = await realpath(await mkdtemp(join(tmpdir(), 'workspace-minimal-reveal-')));
const evidence = { kind: 'minimal-electron-native-reveal', acceptance: false, host, native: null, normalQuit: false };
const target = join(root, 'root', 'Project 日本語'), profile = join(root, 'profile'), bundle = join(root, 'native.cjs');
let app, child, primary, bridgeStopped = true, launchUnverified = false, stage = 'build';
let backendVerified = host === 'bare';
const backendPids = new Set();
async function collectBackends() {
  if (host !== 'workspace') return;
  const pids = await withDeadline(app.evaluate(({ app }) => app.getAppMetrics().filter(metric =>
    metric.type === 'Utility' && metric.serviceName?.includes('Node')).map(metric => metric.pid)), 1000, 'Owned backend evidence');
  assert.ok(pids.length > 0 && pids.every(pid => Number.isSafeInteger(pid) && pid > 0));
  for (const pid of pids) backendPids.add(pid);
  backendVerified = true;
}
try {
  await mkdir(target, { recursive: true }); await mkdir(profile);
  await build({ entryPoints: ['src/desktop/windows-project-reveal.ts'], platform: 'node', bundle: true, format: 'cjs', outfile: bundle });
  launchUnverified = true; stage = 'launch';
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'),
    cwd: resolve(fileURLToPath(new URL('../../', import.meta.url))),
    args: [resolve(fileURLToPath(new URL(host === 'workspace' ? '../../' : './windows-electron-reveal.cjs', import.meta.url)))],
    env: { ...process.env, WORKSPACE_REVEAL_TRACE: '1', WORKSPACE_MINIMAL_REVEAL_PROFILE: profile, WORKSPACE_USER_DATA_DIR: profile,
      WORKSPACE_MINIMAL_REVEAL_HOST: host,
      WORKSPACE_MINIMAL_REVEAL_MODULE: bundle, WORKSPACE_MINIMAL_REVEAL_TARGET: await realpath(target),
      WORKSPACE_MINIMAL_REVEAL_NATIVE: fileURLToPath(new URL('../../src/desktop/native/', import.meta.url)) }, timeout: host === 'workspace' ? 30000 : 10000 });
  child = app.process();
  launchUnverified = false;
  stage = 'window';
  const page = await app.firstWindow({ timeout: 30000 });
  stage = 'startup';
  if (host === 'workspace') {
    // Load only the diagnostic callable into trusted main after actual app startup.
    await app.evaluate((_, script) => process.getBuiltinModule('node:module').createRequire(script)(script),
      fileURLToPath(new URL('./windows-electron-reveal.cjs', import.meta.url)));
    await collectBackends();
    await waitForRuntimeInterface(page, async status => { evidence.startup = status; });
  } else await page.waitForURL('data:text/html,' + encodeURIComponent('<title>Minimal Reveal</title>'), { waitUntil: 'load', timeout: 30000 });
  stage = 'native'; bridgeStopped = false;
  evidence.native = await withDeadline(app.evaluate(() => globalThis.minimalReveal()), 17000, 'Minimal native Reveal');
  bridgeStopped = evidence.native.stopped === 1 && evidence.native.unknown === false;
  assert.equal(bridgeStopped, true, 'Owned native bridge must stop');
  assert.equal(evidence.native.opens, 1, 'Minimal reproduction must reach actual navigation');
  assert.ok(evidence.native.trace.some(event => event.phase === 'enumeration'), 'Minimal reproduction must reach COM');
  if (evidence.native.outcome === 'dispatched') {
    stage = 'selection_evidence';
    const observed = await waitForFileManagerTarget(target, 'win32', undefined, { windowsDiagnostics: true });
    evidence.exactTargetObserved = observed.status === 'passed' && observed.exactTargetObserved === true;
    evidence.independentSelection = observed.independentSelection;
    evidence.selectionAgreement = observed.selectionAgreement;
    assert.equal(observed.independentSelection?.status, 'observed');
    assert.equal(observed.independentSelection?.windowVerified, true);
    assert.equal(observed.independentSelection?.targetVerified, true);
    assert.equal(observed.independentSelection?.selected, true);
    assert.equal(observed.selectionAgreement, 'agree');
  }
  stage = 'native_assertions';
  assert.equal(evidence.native.selections, 1, 'Minimal native Reveal must select exactly once');
  assert.equal(evidence.native.permits, 1);
  assert.equal(evidence.native.outcome, 'dispatched');
  assert.equal(evidence.exactTargetObserved, true);
} catch (error) {
  primary = error;
  evidence.failure = { stage, playwrightTimeout: error?.name === 'TimeoutError', assertion: error?.code === 'ERR_ASSERTION' };
}
finally {
  if (app) {
    if (!backendVerified) {
      try { await collectBackends(); } catch { primary ??= new Error('Owned backend evidence unavailable'); }
    }
    try { await closeElectron(app); evidence.normalQuit = true; }
    catch (error) { primary ??= error; evidence.normalQuit = false; }
  }
  const mainStopped = !launchUnverified && (!child || child.exitCode !== null || child.signalCode !== null);
  let backendsStopped = backendVerified;
  for (const pid of backendPids) {
    try { process.kill(pid, 0); backendsStopped = false; }
    catch (error) { if (error.code !== 'ESRCH') backendsStopped = false; }
  }
  evidence.backendsStopped = backendsStopped; evidence.backendCount = backendPids.size;
  evidence.mainStopped = mainStopped; evidence.bridgeStopped = bridgeStopped;
  if (mainStopped && bridgeStopped && backendsStopped) {
    const cleanup = await closeDisposableFileManagerTarget(target, 'win32', undefined, { ownedParent: true });
    evidence.windowCleanup = { status: cleanup.status, matched: cleanup.matched, closed: cleanup.closed, errorCount: cleanup.errorCount };
    if (cleanup.status === 'completed') {
      try { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); evidence.fixtureRemoval = 'completed'; }
      catch { evidence.fixtureRemoval = 'failed'; primary ??= new Error('Owned fixture removal failed'); }
    } else { evidence.fixtureRemoval = 'preserved'; primary ??= new Error('Owned Explorer cleanup unconfirmed'); }
  } else { evidence.fixtureRemoval = 'preserved'; primary ??= new Error('Owned process termination unconfirmed'); }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
}
if (primary) throw new Error('Minimal Electron Reveal diagnostic failed; inspect finite evidence');
