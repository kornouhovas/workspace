// Opt-in Phase-2 minimization, never a substitute for original cold acceptance.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { _electron } from 'playwright-core';
import { closeElectron, withDeadline } from '../runtime-lifecycle.mjs';
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from '../file-manager-evidence.mjs';

assert.equal(process.platform, 'win32');
const output = process.env.WORKSPACE_MINIMAL_REVEAL_OUTPUT;
assert.ok(output, 'An explicit evidence destination is required');
const root = await realpath(await mkdtemp(join(tmpdir(), 'workspace-minimal-reveal-')));
const evidence = { kind: 'minimal-electron-native-reveal', acceptance: false, native: null, normalQuit: false };
const target = join(root, 'root', 'Project 日本語'), profile = join(root, 'profile'), bundle = join(root, 'native.cjs');
let app, child, primary, bridgeStopped = true, launchUnverified = false;
try {
  await mkdir(target, { recursive: true }); await mkdir(profile);
  await build({ entryPoints: ['src/desktop/windows-project-reveal.ts'], platform: 'node', bundle: true, format: 'cjs', outfile: bundle });
  launchUnverified = true;
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'),
    args: [fileURLToPath(new URL('./windows-electron-reveal.cjs', import.meta.url))],
    env: { ...process.env, WORKSPACE_REVEAL_TRACE: '1', WORKSPACE_MINIMAL_REVEAL_PROFILE: profile,
      WORKSPACE_MINIMAL_REVEAL_MODULE: bundle, WORKSPACE_MINIMAL_REVEAL_TARGET: await realpath(target),
      WORKSPACE_MINIMAL_REVEAL_NATIVE: fileURLToPath(new URL('../../src/desktop/native/', import.meta.url)) }, timeout: 10000 });
  child = app.process();
  launchUnverified = false;
  const page = await app.firstWindow({ timeout: 30000 });
  await page.waitForURL('data:text/html,' + encodeURIComponent('<title>Minimal Reveal</title>'), { waitUntil: 'load', timeout: 30000 });
  bridgeStopped = false;
  evidence.native = await withDeadline(app.evaluate(() => globalThis.minimalReveal()), 17000, 'Minimal native Reveal');
  bridgeStopped = evidence.native.stopped === 1 && evidence.native.unknown === false;
  assert.equal(bridgeStopped, true, 'Owned native bridge must stop');
  assert.equal(evidence.native.opens, 1, 'Minimal reproduction must reach actual navigation');
  assert.ok(evidence.native.trace.some(event => event.phase === 'enumeration'), 'Minimal reproduction must reach COM');
  if (evidence.native.outcome === 'dispatched') {
    const observed = await waitForFileManagerTarget(target, 'win32');
    evidence.exactTargetObserved = observed.status === 'passed' && observed.exactTargetObserved === true;
  }
  assert.equal(evidence.native.selections, 1, 'Minimal native Reveal must select exactly once');
  assert.equal(evidence.native.permits, 1);
  assert.equal(evidence.native.outcome, 'dispatched');
  assert.equal(evidence.exactTargetObserved, true);
} catch (error) { primary = error; }
finally {
  if (app) {
    try { await closeElectron(app); evidence.normalQuit = true; }
    catch (error) { primary ??= error; evidence.normalQuit = false; }
  }
  const mainStopped = !launchUnverified && (!child || child.exitCode !== null || child.signalCode !== null);
  evidence.mainStopped = mainStopped; evidence.bridgeStopped = bridgeStopped;
  if (mainStopped && bridgeStopped) {
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
