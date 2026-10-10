import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { invokeExternalRename, parseFixtureResponse, parseRenameResponse, renameBounds, renameScenarios,
  runBoundedProcess, runRenameCli, runRenameDiagnostics, runRenameFixture } from '../scripts/windows-rename-diagnostics.mjs';

const privateText = 'C:\\private\\秘密\\do-not-record';
const nativeResponse = (extra = {}) => ({ version: 1, stage: 'completed', invocationCount: 1, renamed: true,
  win32Code: 0, lockOpened: false, lockReleased: false, startedUnixMs: 100, endedUnixMs: 101, ...extra });
const processResult = (extra = {}) => ({ status: 'completed', termination: 'confirmed', exitCode: 0, ...extra });
const metadata = async () => ({ codeSha: '4ac402620dd8139bdef9ff03625aae64bf60e132', platform: process.platform });
function fixture(t) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'rename-diagnostic-test-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
// Genuine separate-process rename for portable orchestration/service coverage.
// Windows API-specific conflict/collision codes are exercised separately below.
async function portableRename(directory, scenario, { onReady } = {}) {
  const r = await runBoundedProcess(process.execPath, ['--input-type=module', '--eval', `
    import fs from 'node:fs';
    import { join } from 'node:path';
    const root = join(process.env.WORKSPACE_RENAME_FIXTURE, 'root');
    if (process.env.WORKSPACE_RENAME_SCENARIO === 'concurrent_scan') {
      process.stdout.write('WORKSPACE_RENAME_READY\\n');
      await new Promise(resolve => process.stdin.once('data', resolve));
    }
    const start = Date.now();
    let renamed = false, win32Code = 0;
    try { fs.renameSync(join(root, 'Категория Ω'), join(root, process.env.WORKSPACE_RENAME_SCENARIO === 'collision_control' ? 'Occupied' : 'Renamed 文')); renamed = true; }
    catch (e) { win32Code = ['EEXIST', 'ENOTEMPTY'].includes(e.code) ? 183 : 5; }
    process.stdout.write(JSON.stringify({ version: 1, stage: 'completed', invocationCount: 1, renamed, win32Code,
      lockOpened: false, lockReleased: false, startedUnixMs: start, endedUnixMs: Date.now() }));
  `], { timeoutMs: 5000, readyMarker: scenario === 'concurrent_scan' ? 'WORKSPACE_RENAME_READY' : undefined, onReady,
    env: { ...process.env, WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: scenario } });
  return { process: processResult({ status: r.status, termination: r.termination, exitCode: r.exitCode }), response: parseRenameResponse(r.stdout) };
}

test('native protocol retains negative Win32 codes and only finite fields', () => {
  const response = nativeResponse({ renamed: false, win32Code: 32, lockOpened: true, lockReleased: true, exception: privateText });
  assert.deepEqual(parseRenameResponse(JSON.stringify(response)), nativeResponse({ renamed: false, win32Code: 32, lockOpened: true, lockReleased: true }));
  for (const extra of [{ renamed: true, win32Code: 5 }, { invocationCount: 2 }, { win32Code: -1 }, { stage: privateText },
    { lockReleased: true }, { startedUnixMs: null }, { endedUnixMs: 99 }, { renamed: 'true' }]) {
    assert.equal(parseRenameResponse(JSON.stringify(nativeResponse(extra))), null);
  }
  assert.equal(parseRenameResponse('x'.repeat(2049)), null);
  assert.equal(parseRenameResponse(privateText), null);
  assert.equal(parseRenameResponse(JSON.stringify(nativeResponse({ stage: 'rename', renamed: false,
    win32Code: null, endedUnixMs: null }))).invocationCount, 1);
  assert.equal(parseRenameResponse(JSON.stringify(nativeResponse({ stage: 'lock', invocationCount: 0, renamed: false,
    win32Code: 5, startedUnixMs: null, endedUnixMs: null }))).stage, 'lock');
});

for (const scenario of ['idle', 'observation', 'concurrent_scan', 'collision_control']) test(`real service, SQLite and external process preserve IDs/Text/history/inventory: ${scenario}`, async (t) => {
  const directory = fixture(t);
  const result = await runRenameFixture(directory, scenario, { rename: portableRename });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.ok(Object.values(result.invariants).every(Boolean));
  assert.equal(result.rename.response.invocationCount, 1);
  assert.equal(result.resources.liveWatches, 0); assert.equal(result.resources.liveTimers, 0);
  assert.ok(result.resources.watchesOpened > 0);
  assert.equal(result.resources.watchesOpened, result.resources.watchesClosed);
  if (scenario === 'observation') assert.ok(result.resources.healthCallbacks >= 1);
  if (scenario === 'concurrent_scan') {
    assert.ok(result.resources.explicitScans > 0); assert.equal(result.resources.explicitScans, result.scans.length);
    assert.ok(result.scans.length <= renameBounds.scanCount);
  }
  const sanitized = parseFixtureResponse(JSON.stringify({ ...result, private: directory }), scenario);
  assert.ok(sanitized); assert.equal(JSON.stringify(sanitized).includes(directory), false);
  assert.equal(JSON.stringify(sanitized).includes('Exact'), false);
  assert.equal(JSON.stringify(sanitized).includes('Текст'), false);
});

test('controlled negative response is retained without retry or fabricated reconciliation', async (t) => {
  let calls = 0;
  const result = await runRenameFixture(fixture(t), 'concurrent_scan', { rename: async (directory, scenario, { onReady }) => {
    onReady(); await new Promise(resolve => setTimeout(resolve, 30));
    calls++; return { process: processResult(), response: nativeResponse({ renamed: false, win32Code: 5 }) };
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'completed');
  assert.equal(result.rename.response.renamed, false); assert.equal(result.rename.response.win32Code, 5);
  assert.equal(result.invariants.logicalIds, true); assert.equal(result.invariants.history, true);
});

test('injected conflict requires an opened/released handle and blocked operation', async (t) => {
  const good = await runRenameFixture(fixture(t), 'injected_conflict', { rename: async () => ({ process: processResult(),
    response: nativeResponse({ renamed: false, win32Code: 32, lockOpened: true, lockReleased: true }) }) });
  assert.equal(good.status, 'completed'); assert.equal(good.invariants.controlDetected, true);
  const missing = await runRenameFixture(fixture(t), 'injected_conflict', { rename: async () => ({ process: processResult(),
    response: nativeResponse({ renamed: false, win32Code: 32 }) }) });
  assert.equal(missing.status, 'failed'); assert.equal(missing.invariants.controlDetected, false);
});

test('sentinel corruption remains a failed diagnostic with observer cleanup', async (t) => {
  const directory = fixture(t);
  const result = await runRenameFixture(directory, 'idle', { rename: async (...args) => {
    const response = await portableRename(...args);
    fs.writeFileSync(join(directory, 'root', 'Occupied', 'sentinel'), 'changed');
    return response;
  } });
  assert.equal(result.status, 'failed'); assert.equal(result.invariants.sentinels, false);
  assert.equal(result.invariants.observerCleanup, true);
});

test('nonempty caller directory is rejected without touching existing content', async (t) => {
  const directory = fixture(t); fs.writeFileSync(join(directory, 'sentinel'), 'retain');
  let calls = 0;
  const result = await runRenameFixture(directory, 'idle', { rename: async () => { calls++; } });
  assert.equal(result.status, 'failed'); assert.equal(result.stage, 'setup'); assert.equal(calls, 0);
  assert.deepEqual(fs.readdirSync(directory), ['sentinel']); assert.equal(fs.readFileSync(join(directory, 'sentinel'), 'utf8'), 'retain');
});

function controlledChild() {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.stdout.destroy = () => {}; child.stderr.destroy = () => {}; child.unref = () => {};
  child.kills = 0; child.kill = () => { child.kills++; };
  const timers = new Map(); let id = 0;
  const clock = { setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; }, clearTimeout(key) { timers.delete(key); } };
  const fire = (ms) => { const [key, timer] = [...timers].find(([, timer]) => timer.ms === ms); timers.delete(key); timer.fn(); };
  return { child, clock, timers, fire };
}

test('process bounds retain timeout and unconfirmed termination separately', async () => {
  const h = controlledChild();
  const pending = runBoundedProcess('owned', [], { timeoutMs: 50, spawnProcess: () => h.child, clock: h.clock });
  h.fire(50); assert.equal(h.child.kills, 1); h.fire(renameBounds.terminationMs);
  assert.deepEqual(await pending, { status: 'timeout', termination: 'unknown', exitCode: null, stdout: '' });
  assert.equal(h.timers.size, 0);
});

test('output including stderr is bounded, private error text never escapes', async () => {
  const h = controlledChild();
  const pending = runBoundedProcess('owned', [], { timeoutMs: 50, maxBytes: 32, spawnProcess: () => h.child, clock: h.clock });
  h.child.stderr.emit('data', Buffer.from(privateText.repeat(10))); h.child.emit('close', null);
  assert.deepEqual(await pending, { status: 'output_limit', termination: 'confirmed', exitCode: null, stdout: '' });
  assert.equal(h.child.kills, 1); assert.equal(h.timers.size, 0);
  const launch = await runBoundedProcess('owned', [], { timeoutMs: 50, spawnProcess: () => { throw new Error(privateText); } });
  assert.equal(launch.status, 'launch_error'); assert.equal(launch.termination, 'not_started');
});

test('readiness split across chunks sends one start signal and keeps only final JSON', async () => {
  const h = controlledChild(); h.child.stdin = new EventEmitter();
  const sent = []; h.child.stdin.end = value => sent.push(value);
  let ready = 0;
  const pending = runBoundedProcess('owned', [], { timeoutMs: 50, spawnProcess: () => h.child, clock: h.clock,
    readyMarker: 'WORKSPACE_RENAME_READY', onReady: () => { ready++; } });
  h.child.stdout.emit('data', Buffer.from('WORKSPACE_RENAME_'));
  assert.equal(ready, 0);
  h.child.stdout.emit('data', Buffer.from('READY\r\n'));
  h.child.stdout.emit('data', Buffer.from(JSON.stringify(nativeResponse()))); h.child.emit('close', 0);
  const response = await pending;
  assert.equal(ready, 1); assert.deepEqual(sent, ['rename\n']);
  assert.deepEqual(parseRenameResponse(response.stdout), nativeResponse()); assert.equal(h.timers.size, 0);
});

async function sampleEvidence(t) {
  return runRenameFixture(fixture(t), 'idle', { rename: async () => ({ process: processResult(),
    response: nativeResponse({ renamed: false, win32Code: 5 }) }) });
}

test('bounded orchestration uses distinct fixtures, retains every real failure and separates controls', async (t) => {
  const sample = await sampleEvidence(t), owned = [], calls = [];
  const evidenceDirectory = fixture(t);
  const result = await runRenameDiagnostics({ evidenceDirectory, platform: 'win32', metadata, operations: 2,
    worker: async (directory, scenario) => {
      owned.push(directory); calls.push(scenario);
      const evidence = structuredClone(sample); evidence.scenario = scenario;
      if (scenario !== 'idle') evidence.atRename.liveWatches = 1;
      if (scenario === 'observation') evidence.atRename.healthCallbacks = 1;
      if (scenario === 'concurrent_scan') { evidence.scans = [[100, 101]]; evidence.resources.explicitScans = 1; }
      if (scenario === 'injected_conflict') Object.assign(evidence.rename.response, { lockOpened: true, lockReleased: true, win32Code: 32 });
      if (scenario === 'collision_control') evidence.rename.response.win32Code = 183;
      return { ...processResult(), stdout: JSON.stringify({ ...evidence, private: privateText }) };
    } });
  assert.equal(result.status, 'completed'); assert.equal(result.operations.length, 10);
  assert.deepEqual(result.renameOperation, { api: 'MoveFileExW', flags: 0, replacing: false,
    historicalOperation: 'Node fs.promises.rename', historicalFlags: 1, equivalentToHistoricalOperation: false });
  assert.equal(new Set(owned).size, 10); assert.equal(result.realRenameFailures, 6);
  assert.deepEqual(calls, renameScenarios.flatMap((s) => [s, s]));
  assert.ok(result.operations.every((o) => o.cleanup === 'completed'));
  assert.ok(owned.every((path) => !fs.existsSync(path)));
  const saved = fs.readFileSync(join(evidenceDirectory, 'rename-observations.json'), 'utf8');
  assert.equal(saved.includes(privateText), false); assert.ok(owned.every((path) => !saved.includes(path)));
  assert.deepEqual(JSON.parse(saved), result);
});

test('protocol disagreement and incomplete invariants cannot become completed evidence', async (t) => {
  const sample = await sampleEvidence(t);
  for (const mutate of [v => { v.invariants.history = false; }, v => { v.scans = Array(129).fill([1, 2]); },
    v => { v.resources.liveTimers = privateText; }, v => { v.rename.response.invocationCount = 2; },
    v => { v.resources.liveTimers = 1; }, v => { v.atRename.liveWatches = 1; },
    v => { v.scenario = 'injected_conflict'; },
    v => { v.rename.process.status = privateText; }, v => { v.scenario = privateText; }]) {
    const value = structuredClone(sample); mutate(value);
    assert.equal(parseFixtureResponse(JSON.stringify(value), 'idle'), null);
  }
});

test('unverified worker/descendant termination or protocol preserves fixtures and negative evidence', async (t) => {
  const sample = await sampleEvidence(t), owned = [];
  t.after(() => { for (const directory of owned) fs.rmSync(directory, { recursive: true, force: true }); });
  const result = await runRenameDiagnostics({ evidenceDirectory: fixture(t), platform: 'win32', metadata, operations: 1,
    worker: async (directory, scenario) => {
      owned.push(directory);
      if (scenario === 'idle') return { ...processResult({ status: 'timeout', termination: 'unknown' }), stdout: privateText };
      if (scenario === 'observation') return { ...processResult(), stdout: privateText };
      const evidence = structuredClone(sample); evidence.scenario = scenario; evidence.status = 'failed';
      evidence.rename.process.termination = 'unknown'; evidence.rename.process.status = 'timeout'; evidence.rename.response = null;
      return { ...processResult(), stdout: JSON.stringify(evidence) };
    } });
  assert.equal(result.status, 'failed'); assert.equal(result.failure, 'operation_failed');
  assert.equal(result.operations[0].process.status, 'timeout');
  assert.ok(result.operations.every((o) => o.cleanup === 'unverified')); assert.ok(owned.every(fs.existsSync));
  assert.equal(JSON.stringify(result).includes(privateText), false);
});

test('unsupported host, missing revision and invalid operation budget never start fixtures', async (t) => {
  let calls = 0;
  const options = { evidenceDirectory: fixture(t), metadata, worker: async () => { calls++; } };
  const unavailable = await runRenameDiagnostics({ ...options, platform: 'darwin' });
  assert.equal(unavailable.failure, 'unsupported_host'); assert.deepEqual(unavailable.operations, []);
  const noSha = await runRenameDiagnostics({ ...options, metadata: async () => ({ codeSha: null }), platform: 'win32' });
  assert.equal(noSha.failure, 'revision_unavailable');
  for (const operations of [0, 3, -1, Infinity]) await assert.rejects(runRenameDiagnostics({ ...options, operations }));
  assert.equal(calls, 0);
});

test('CLI uses finite output, rejects caller targets and does not claim platform acceptance', async () => {
  let stdout = '', stderr = '', calls = 0;
  const options = { stdout: { write: s => { stdout += s; } }, stderr: { write: s => { stderr += s; } },
    diagnostics: async () => { calls++; throw new Error(privateText); } };
  assert.equal(await runRenameCli({ ...options, args: [privateText] }), 1); assert.equal(calls, 0);
  assert.equal(await runRenameCli({ ...options, args: [] }), 1); assert.equal(calls, 1);
  assert.equal(await runRenameCli({ ...options, args: [], diagnostics: async () => ({ status: 'completed', realRenameFailures: 1 }) }), 0);
  assert.equal(stdout, 'Windows rename diagnostic completed; inspect every operation.\n');
  assert.equal(stderr, 'Windows rename diagnostic failed (arguments).\nWindows rename diagnostic failed.\n');
});

test('actual internal worker entry rejects a caller path without writing fixtures', async (t) => {
  const directory = fixture(t);
  const result = await runBoundedProcess(process.execPath, ['scripts/windows-rename-diagnostics.mjs', '--fixture'], {
    timeoutMs: 5000, env: { ...process.env, WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: 'idle' },
  });
  assert.equal(result.status, 'process_error'); assert.equal(result.exitCode, 1); assert.equal(result.stdout, '');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('actual Windows bridge detects no-delete-sharing and occupied target without overwrite', { skip: process.platform !== 'win32' }, async (t) => {
  for (const scenario of renameScenarios) {
    const result = await runRenameFixture(fixture(t), scenario);
    assert.equal(result.status, 'completed', JSON.stringify(result));
    if (scenario === 'injected_conflict') {
      assert.equal(result.rename.response.lockOpened, true); assert.equal(result.rename.response.lockReleased, true);
      assert.equal(result.rename.response.renamed, false);
    }
  }
});

test('bridge contract is one nonreplacing native rename, environment-only paths and explicit handle cleanup', () => {
  const script = fs.readFileSync(new URL('../scripts/windows-rename-diagnostics.ps1', import.meta.url), 'utf8');
  assert.ok([...script].every(c => c.charCodeAt(0) < 128));
  assert.match(script, /MoveFileExW\(\$source, \$destination, 0\)/);
  assert.match(script, /CreateFileW\(\$source, 0x80, 3,/); assert.match(script, /CloseHandle\(\$handle\)/);
  assert.equal(Buffer.from('0JrQsNGC0LXQs9C+0YDQuNGPIM6p', 'base64').toString('utf8'), 'Категория Ω');
  assert.equal(Buffer.from('UmVuYW1lZCDmloc=', 'base64').toString('utf8'), 'Renamed 文');
  assert.equal(script.includes('Start-Process'), false); assert.equal(script.includes('Invoke-Expression'), false);
  assert.equal(typeof invokeExternalRename, 'function');
});
