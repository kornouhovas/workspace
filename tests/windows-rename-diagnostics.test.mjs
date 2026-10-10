import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renameFixtureNames, runExternalNodeRename } from '../scripts/windows-rename-node-worker.mjs';
import test from 'node:test';
import { invokeExternalRename, parseFixtureResponse, parseRealpathResponse, parseRenameResponse, renameBounds, renameScenarios,
  runBoundedProcess, runRenameCli, runRenameDiagnostics, runRenameFixture } from '../scripts/windows-rename-diagnostics.mjs';

const privateText = 'C:\\private\\秘密\\do-not-record';
const nativeResponse = (extra = {}) => ({ version: 1, api: 'node_fs_rename', stage: 'completed', invocationCount: 1, renamed: true,
  win32Code: null, nodeCode: null, syscall: null, lockOpened: false, lockReleased: false, startedUnixMs: 100, endedUnixMs: 101, ...extra });
const processResult = (extra = {}) => ({ status: 'completed', termination: 'confirmed', exitCode: 0, ...extra });
const metadata = async () => ({ codeSha: '4ac402620dd8139bdef9ff03625aae64bf60e132', platform: process.platform });
const stressResponse = (scenario, extra = {}) => ({ version: 1, target: scenario === 'stress_scan' ? 'grouped_source' : 'child', stage: 'completed', mode: scenario.slice(7),
  iterations: scenario === 'stress_idle' ? 0 : 1, successes: scenario === 'stress_idle' ? 0 : 1,
  errors: { ENOENT: 0, EPERM: 0, EACCES: 0, EBUSY: 0, ENOTDIR: 0, unknown: 0 },
  afterRenameSignalEnoent: 0, renameCompletedSignal: true, scanStates: scenario === 'stress_scan' ? { ready: 1, empty: 0, changed: 0, unavailable: 0, unreadable: 0, root_identity_conflict: 0 } : null, startedUnixMs: 99, readyUnixMs: 100, endedUnixMs: 1100, ...extra });
function fixture(t) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'workspace-rename-diagnostic-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
// The real external Node worker is portable; the flags0 native collision control
// is simulated here and executed only by the actual Windows bridge test below.
async function portableRename(directory, scenario, options = {}) {
  if (scenario === 'collision_control') return { process: processResult(), response: nativeResponse({
    api: 'move_file_ex', renamed: false, win32Code: 183 }) };
  return invokeExternalRename(directory, scenario, options);
}

test('protocol separates actual Node code/syscall from native Win32 codes and strips private fields', () => {
  const response = nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename', lockOpened: true, lockReleased: true, exception: privateText });
  assert.deepEqual(parseRenameResponse(JSON.stringify(response)), nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename', lockOpened: true, lockReleased: true }));
  for (const extra of [{ renamed: true, nodeCode: 'EPERM', syscall: 'rename' }, { invocationCount: 2 }, { win32Code: -1 }, { win32Code: 5 }, { syscall: privateText }, { nodeCode: privateText }, { renamed: false, nodeCode: 'EPERM', syscall: null }, { stage: privateText },
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
    calls++; return { process: processResult(), response: nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename' }) };
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'completed');
  assert.equal(result.rename.response.renamed, false); assert.equal(result.rename.response.nodeCode, 'EPERM');
  assert.equal(result.invariants.logicalIds, true); assert.equal(result.invariants.history, true);
});

test('injected conflict requires an opened/released handle and blocked operation', async (t) => {
  const good = await runRenameFixture(fixture(t), 'injected_conflict', { rename: async () => ({ process: processResult(),
    response: nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename', lockOpened: true, lockReleased: true }) }) });
  assert.equal(good.status, 'completed'); assert.equal(good.invariants.controlDetected, true);
  const missing = await runRenameFixture(fixture(t), 'injected_conflict', { rename: async () => ({ process: processResult(),
    response: nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename' }) }) });
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
    response: nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename' }) }) });
}

test('bounded orchestration uses distinct fixtures, retains every real failure and separates controls', async (t) => {
  const sample = await sampleEvidence(t), owned = [], calls = [];
  const evidenceDirectory = fixture(t);
  const result = await runRenameDiagnostics({ evidenceDirectory, platform: 'win32', metadata, operations: 2,
    worker: async (directory, scenario) => {
      owned.push(directory); calls.push(scenario);
      const evidence = structuredClone(sample); evidence.scenario = scenario;
      evidence.serviceState = scenario === 'idle' || scenario.startsWith('stress_') ? 'closed' : 'active';
      if (evidence.serviceState === 'active') evidence.atRename.liveWatches = 1;
      if (scenario === 'observation') evidence.atRename.healthCallbacks = 1;
      if (scenario === 'concurrent_scan') { evidence.scans = [[100, 101]]; evidence.resources.explicitScans = 1; }
      if (['injected_conflict', 'child_injected_conflict', 'child_delete_shared_control'].includes(scenario)) Object.assign(evidence.rename.response, { lockOpened: true, lockReleased: true });
      if (scenario === 'delete_shared_control') Object.assign(evidence.rename.response, { lockOpened: true, lockReleased: true, renamed: true, nodeCode: null, syscall: null });
      if (scenario === 'collision_control') Object.assign(evidence.rename.response, { api: 'move_file_ex', win32Code: 183, nodeCode: null, syscall: null });
      if (scenario.startsWith('stress_')) evidence.rename.stress = { process: processResult(), response: stressResponse(scenario) };
      return { ...processResult(), stdout: JSON.stringify({ ...evidence, private: privateText }) };
    } });
  assert.equal(result.status, 'completed'); assert.equal(result.operations.length, 32);
  assert.deepEqual(result.renameOperation, { api: 'Node fs.promises.rename', historicalOperation: 'Node fs.promises.rename',
    equivalentToHistoricalOperation: true, destinationInitiallyAbsent: true });
  assert.deepEqual(result.collisionOperation, { api: 'MoveFileExW', flags: 0, replacing: false });
  assert.equal(result.handleControls.access, 'GENERIC_READ');
  assert.equal(new Set(owned).size, 32); assert.equal(result.realRenameFailures, 22);
  assert.deepEqual(calls, renameScenarios.flatMap((s) => Array(s.startsWith('stress_') ? 4 : 2).fill(s)));
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
  const directory = fs.mkdtempSync(join(tmpdir(), 'caller-owned-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
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
    if (['injected_conflict', 'delete_shared_control', 'child_injected_conflict', 'child_delete_shared_control'].includes(scenario)) {
      assert.equal(result.rename.response.api, 'node_fs_rename');
      assert.equal(result.rename.response.lockOpened, true); assert.equal(result.rename.response.lockReleased, true);
      assert.equal(result.rename.response.renamed, scenario === 'delete_shared_control');
    }
  }
});

test('bridge uses GENERIC_READ holder with DELETE-shared contrast and explicit native collision API', () => {
  const script = fs.readFileSync(new URL('../scripts/windows-rename-diagnostics.ps1', import.meta.url), 'utf8');
  assert.ok([...script].every(c => c.charCodeAt(0) < 128));
  assert.match(script, /MoveFileExW\(\$source, \$destination, 0\)/);
  assert.match(script, /CreateFileW\(\$heldPath, \[uint32\]2147483648, \$share,/);
  assert.match(script, /'delete_shared_control', 'child_delete_shared_control'\)\) \{ 7 \} else \{ 3 \}/);
  assert.match(script, /CloseHandle\(\$handle\)/);
  assert.equal(renameFixtureNames.category, 'Категория-' + 'long-category-'.repeat(14));
  assert.equal(renameFixtureNames.project, '日本語-проект-' + 'long-project-'.repeat(14));
  assert.equal(script.includes('Start-Process'), false); assert.equal(script.includes('Invoke-Expression'), false);
});

test('external Node worker preserves real rename error codes/syscall without guessed native codes', async (t) => {
  const directory = fixture(t), root = join(directory, 'root');
  fs.mkdirSync(join(root, renameFixtureNames.category, renameFixtureNames.project), { recursive: true });
  fs.writeFileSync(join(root, renameFixtureNames.category, renameFixtureNames.project, 'sentinel'), 'retain');
  const result = await runBoundedProcess(process.execPath, ['scripts/windows-rename-node-worker.mjs'], {
    timeoutMs: 5000, readyMarker: 'WORKSPACE_RENAME_READY', waitForReadyCallback: true,
    onReady: () => { fs.mkdirSync(join(root, renameFixtureNames.target)); fs.writeFileSync(join(root, renameFixtureNames.target, 'occupied'), 'retain destination'); },
    env: { ...process.env, WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: 'concurrent_scan' },
  });
  assert.equal(result.status, 'completed');
  const response = parseRenameResponse(result.stdout);
  assert.equal(response.api, 'node_fs_rename'); assert.equal(response.invocationCount, 1);
  assert.equal(response.renamed, false); assert.equal(response.win32Code, null);
  assert.ok(['ENOTEMPTY', 'EEXIST', 'EPERM', 'EACCES'].includes(response.nodeCode), JSON.stringify(response));
  assert.equal(response.syscall, 'rename');
  assert.equal(fs.readFileSync(join(root, renameFixtureNames.category, renameFixtureNames.project, 'sentinel'), 'utf8'), 'retain');
  assert.equal(fs.readFileSync(join(root, renameFixtureNames.target, 'occupied'), 'utf8'), 'retain destination');
});

test('external Node worker rejects caller paths, reparse source and preoccupied noncontrol destinations before invocation', async (t) => {
  const caller = await runExternalNodeRename({ WORKSPACE_RENAME_FIXTURE: privateText, WORKSPACE_RENAME_SCENARIO: 'idle' });
  assert.equal(caller.invocationCount, 0); assert.equal(JSON.stringify(caller).includes(privateText), false);
  const directory = fixture(t), root = join(directory, 'root');
  fs.mkdirSync(join(root, renameFixtureNames.category, renameFixtureNames.project), { recursive: true });
  fs.mkdirSync(join(root, renameFixtureNames.target));
  const env = { WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: 'idle' };
  assert.equal((await runExternalNodeRename(env)).invocationCount, 0);
  fs.rmSync(join(root, renameFixtureNames.target), { recursive: true });
  fs.rmSync(join(root, renameFixtureNames.category), { recursive: true });
  fs.symlinkSync(root, join(root, renameFixtureNames.category), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await runExternalNodeRename(env)).invocationCount, 0);
  assert.equal(fs.lstatSync(join(root, renameFixtureNames.category)).isSymbolicLink(), true);
});

const holderResponse = (extra = {}) => nativeResponse({ stage: 'rename', invocationCount: 0, renamed: false,
  startedUnixMs: null, endedUnixMs: null, lockOpened: true, lockReleased: true, ...extra });

test('holder and Node are separate processes and handle release follows the one rename', async (t) => {
  const directory = fixture(t); let nodeCompleted = false, starts = 0;
  const response = await invokeExternalRename(directory, 'injected_conflict', { runProcess: async (program, args, options) => {
    assert.equal(options.env.WORKSPACE_RENAME_FIXTURE, directory); assert.equal(args.includes(directory), false);
    assert.equal(options.timeoutMs, renameBounds.bridgeMs);
    if (program === 'powershell.exe') {
      assert.equal(options.readyInput, 'release\n'); assert.equal(options.waitForReadyCallback, true);
      await options.onReady(); assert.equal(nodeCompleted, true);
      return { ...processResult(), stdout: JSON.stringify(holderResponse()) };
    }
    starts++; assert.equal(program, process.execPath);
    nodeCompleted = true;
    return { ...processResult(), stdout: JSON.stringify(nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename' })) };
  } });
  assert.equal(starts, 1); assert.equal(response.process.termination, 'confirmed');
  assert.equal(response.response.lockOpened, true); assert.equal(response.response.lockReleased, true);
  assert.equal(response.response.nodeCode, 'EPERM'); assert.equal(response.response.win32Code, null);
});

test('holder timeout awaits late Node completion and keeps unknown ownership from either process', async (t) => {
  for (const [holderTermination, nodeTermination] of [['unknown', 'confirmed'], ['confirmed', 'unknown']]) {
    let finishNode, returned = false;
    const nodePending = new Promise(resolve => { finishNode = resolve; });
    const pending = invokeExternalRename(fixture(t), 'injected_conflict', { runProcess: async (program, args, options) => {
      if (program !== 'powershell.exe') return nodePending;
      void options.onReady();
      return { ...processResult({ status: 'timeout', termination: holderTermination }), stdout: '' };
    } });
    void pending.then(() => { returned = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(returned, false);
    finishNode({ ...processResult({ termination: nodeTermination }), stdout: JSON.stringify(nativeResponse()) });
    const result = await pending;
    assert.equal(result.process.status, 'timeout'); assert.equal(result.process.termination, 'unknown');
    assert.equal(result.response.lockOpened, false); assert.equal(result.response.lockReleased, false);
  }
});

test('DELETE-shared contrast requires actual rename plus verified handle lifetime', async (t) => {
  const good = await runRenameFixture(fixture(t), 'delete_shared_control', { rename: async (...args) => {
    const response = await invokeExternalRename(...args.slice(0, 2), { runProcess: async (program, nativeArgs, options) => {
      if (program !== 'powershell.exe') return runBoundedProcess(program, nativeArgs, options);
      await options.onReady(); return { ...processResult(), stdout: JSON.stringify(holderResponse()) };
    } });
    return response;
  } });
  assert.equal(good.status, 'completed'); assert.equal(good.invariants.controlDetected, true);
  const negative = await runRenameFixture(fixture(t), 'delete_shared_control', { rename: async () => ({ process: processResult(),
    response: nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename', lockOpened: true, lockReleased: true }) }) });
  assert.equal(negative.status, 'failed'); assert.equal(negative.invariants.controlDetected, false);
});

test('Windows PowerShell binds positive GENERIC_READ to a managed uint argument', { skip: process.platform !== 'win32' }, async () => {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition 'public static class WorkspaceAccessArgument { public static bool Accept(uint access) { return access == 2147483648U; } }'
[WorkspaceAccessArgument]::Accept([uint32]2147483648)
`;
  const result = await runBoundedProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeoutMs: renameBounds.bridgeMs, maxBytes: 4096,
  });
  assert.equal(result.status, 'completed'); assert.equal(result.termination, 'confirmed');
  assert.equal(result.stdout.trim(), 'True');
});

test('child sharing controls hold only the fixed child while the category is renamed once', async (t) => {
  for (const scenario of ['child_injected_conflict', 'child_delete_shared_control']) {
    let starts = 0;
    const result = await invokeExternalRename(fixture(t), scenario, { runProcess: async (program, args, options) => {
      if (program === 'powershell.exe') {
        assert.equal(options.env.WORKSPACE_RENAME_HOLD_TARGET, 'child');
        assert.equal(options.env.WORKSPACE_RENAME_PROJECT, renameFixtureNames.project);
        assert.equal(options.readyInput, 'release\n');
        await options.onReady();
        assert.equal(starts, 1);
        return { ...processResult(), stdout: JSON.stringify(holderResponse()) };
      }
      starts++;
      return { ...processResult(), stdout: JSON.stringify(nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename' })) };
    } });
    assert.equal(starts, 1);
    assert.equal(result.response.lockOpened, true);
    assert.equal(result.response.lockReleased, true);
    assert.equal(result.response.renamed, false);
    assert.equal(result.response.nodeCode, 'EPERM');
  }
});

test('stress modes are distinct from real service scans and use a fixed four-fixture budget', () => {
  assert.ok(['child_injected_conflict', 'child_delete_shared_control', 'stress_idle', 'stress_native', 'stress_legacy', 'stress_scan']
    .every(scenario => renameScenarios.includes(scenario)));
  assert.equal(renameBounds.stressOperationsPerScenario, 4);
  assert.equal(renameBounds.stressMs, 1000);
});

test('realpath protocol keeps bounded child counters and strips paths without converting ENOENT to a rename result', () => {
  const sample = stressResponse('stress_native', { iterations: 5, successes: 2,
    errors: { ENOENT: 3, EPERM: 0, EACCES: 0, EBUSY: 0, ENOTDIR: 0, unknown: 0 }, afterRenameSignalEnoent: 2 });
  assert.deepEqual(parseRealpathResponse(JSON.stringify({ ...sample, path: privateText,
    errors: { ...sample.errors, private: privateText } }), 'stress_native'), sample);
  for (const mutate of [value => { value.mode = 'legacy'; }, value => { value.target = privateText; },
    value => { value.stage = 'input'; }, value => { value.iterations = renameBounds.stressIterations + 1; },
    value => { value.successes = 1; }, value => { value.errors.ENOENT = -1; },
    value => { value.afterRenameSignalEnoent = 4; }, value => { value.renameCompletedSignal = false; },
    value => { value.readyUnixMs = 98; }, value => { value.endedUnixMs = 99; },
    value => { value.endedUnixMs = value.startedUnixMs + renameBounds.bridgeMs + 1; }]) {
    const value = structuredClone(sample); mutate(value);
    assert.equal(parseRealpathResponse(JSON.stringify(value), 'stress_native'), null);
  }
  assert.equal(parseRealpathResponse(JSON.stringify(sample), 'toString'), null);
  assert.equal(parseRealpathResponse('x'.repeat(4097), 'stress_native'), null);
});

for (const scenario of ['stress_idle', 'stress_native', 'stress_legacy', 'stress_scan']) test(`real external child worker overlaps one rename with identical closed-service invariants: ${scenario}`, async (t) => {
  const result = await runRenameFixture(fixture(t), scenario);
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(result.serviceState, 'closed');
  assert.equal(result.atRename.liveWatches, 0); assert.equal(result.atRename.liveTimers, 0);
  assert.equal(result.rename.response.invocationCount, 1);
  const response = result.rename.response;
  if (process.platform === 'win32' && scenario === 'stress_native' && !response.renamed) {
    assert.equal(response.nodeCode, 'EPERM'); assert.equal(response.syscall, 'rename');
  } else { assert.equal(response.renamed, true); assert.equal(response.nodeCode, null); }
  assert.ok(Object.values(result.invariants).every(Boolean));
  const stress = result.rename.stress;
  assert.equal(stress.process.termination, 'confirmed');
  assert.equal(stress.response.renameCompletedSignal, true);
  assert.ok(stress.response.iterations <= renameBounds.stressIterations);
  if (scenario !== 'stress_idle') {
    assert.ok(stress.response.successes > 0);
    if (response.renamed && scenario !== 'stress_scan') {
      assert.ok(stress.response.errors.ENOENT > 0);
      assert.ok(stress.response.afterRenameSignalEnoent > 0);
    }
  } else assert.equal(stress.response.iterations, 0);
  const sanitized = parseFixtureResponse(JSON.stringify(result), scenario);
  assert.ok(sanitized, JSON.stringify(result));
  assert.equal(sanitized.rename.response.nodeCode, response.nodeCode);
});

test('stress evidence requires correct service state, true overlap and descendant termination before cleanup', async (t) => {
  const sample = await sampleEvidence(t);
  sample.scenario = 'stress_native'; sample.serviceState = 'closed';
  sample.rename.stress = { process: processResult(), response: stressResponse('stress_native') };
  assert.ok(parseFixtureResponse(JSON.stringify(sample), 'stress_native'));
  for (const mutate of [value => { value.serviceState = 'active'; },
    value => { value.atRename.liveWatches = 1; }, value => { value.rename.stress.response.readyUnixMs = 102; },
    value => { value.rename.stress.response.endedUnixMs = 100; },
    value => { value.rename.stress.process.termination = 'unknown'; },
    value => { value.rename.stress.process.status = 'timeout'; },
    value => { value.rename.stress.response.renameCompletedSignal = false; }]) {
    const value = structuredClone(sample); mutate(value);
    assert.equal(parseFixtureResponse(JSON.stringify(value), 'stress_native'), null);
  }
  for (const [stressTermination, renameTermination] of [['unknown', 'confirmed'], ['confirmed', 'unknown']]) {
    let starts = 0;
    const result = await invokeExternalRename(fixture(t), 'stress_native', { runProcess: async (_program, args, options) => {
      if (args.at(-1).endsWith('windows-rename-realpath-worker.mjs')) {
        assert.equal(options.timeoutMs, renameBounds.bridgeMs); assert.equal(options.readyInput, 'finished\n');
        assert.equal(options.waitForReadyCallback, true); await options.onReady();
        return { ...processResult({ status: 'timeout', termination: stressTermination }), stdout: '' };
      }
      starts++; return { ...processResult({ termination: renameTermination }), stdout: JSON.stringify(nativeResponse()) };
    } });
    assert.equal(starts, 1); assert.equal(result.process.termination, 'unknown');
  }
});

test('real child stress worker rejects caller paths, unknown modes and child reparses without reads', async (t) => {
  const directory = fixture(t), root = join(directory, 'root'), category = join(root, renameFixtureNames.category);
  const child = join(category, renameFixtureNames.project);
  fs.mkdirSync(child, { recursive: true });
  for (const env of [{ WORKSPACE_RENAME_FIXTURE: privateText, WORKSPACE_RENAME_SCENARIO: 'stress_native' },
    { WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: 'toString' },
    { WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: 'stress_legacy' }]) {
    if (env.WORKSPACE_RENAME_SCENARIO === 'stress_legacy') {
      fs.rmSync(child, { recursive: true });
      fs.symlinkSync(root, child, process.platform === 'win32' ? 'junction' : 'dir');
    }
    const result = await runBoundedProcess(process.execPath, ['--import', 'tsx', 'scripts/windows-rename-realpath-worker.mjs'], {
      timeoutMs: 5000, env: { ...process.env, ...env },
    });
    assert.equal(result.status, 'completed');
    const response = JSON.parse(result.stdout);
    assert.equal(response.stage, 'input'); assert.equal(response.iterations, 0);
    assert.equal(response.startedUnixMs, null); assert.equal(response.renameCompletedSignal, false);
    assert.equal(result.stdout.includes(privateText), false);
  }
});

test('a stress cap reached before completion retains its counters and the single actual rename as failed evidence', async (t) => {
  const reading = stressResponse('stress_native', { iterations: renameBounds.stressIterations,
    successes: renameBounds.stressIterations, renameCompletedSignal: false });
  assert.deepEqual(parseRealpathResponse(JSON.stringify(reading), 'stress_native'), reading);
  let calls = 0;
  const result = await runRenameFixture(fixture(t), 'stress_native', { rename: async () => {
    calls++;
    return { process: processResult(), response: nativeResponse(), stress: { process: processResult(), response: reading } };
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'failed');
  assert.equal(result.rename.response.invocationCount, 1);
  assert.equal(result.rename.response.renamed, true);
  const parsed = parseFixtureResponse(JSON.stringify(result), 'stress_native');
  assert.ok(parsed); assert.equal(parsed.rename.stress.response.iterations, renameBounds.stressIterations);
  assert.equal(parsed.rename.stress.response.renameCompletedSignal, false);
  assert.equal(parsed.invariants.observerCleanup, true);
});

test('Windows child holder rejects files, reparses and mismatched fixed target kinds before opening a handle', { skip: process.platform !== 'win32' }, async (t) => {
  const directory = fixture(t), root = join(directory, 'root'), category = join(root, renameFixtureNames.category);
  const child = join(category, renameFixtureNames.project);
  fs.mkdirSync(category, { recursive: true }); fs.writeFileSync(child, 'retain');
  const invoke = async (extra = {}) => {
    const process = await runBoundedProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', 'scripts/windows-rename-diagnostics.ps1'], {
      timeoutMs: renameBounds.bridgeMs, maxBytes: 4096, env: { ...globalThis.process.env,
        WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: 'child_injected_conflict',
        WORKSPACE_RENAME_CATEGORY: renameFixtureNames.category, WORKSPACE_RENAME_PROJECT: renameFixtureNames.project,
        WORKSPACE_RENAME_HOLD_TARGET: 'child', ...extra },
    });
    assert.equal(process.status, 'completed');
    const response = parseRenameResponse(process.stdout);
    assert.equal(response.stage, 'input'); assert.equal(response.invocationCount, 0); assert.equal(response.lockOpened, false);
  };
  await invoke(); assert.equal(fs.readFileSync(child, 'utf8'), 'retain');
  fs.rmSync(child); fs.symlinkSync(root, child, 'junction');
  await invoke(); assert.equal(fs.lstatSync(child).isSymbolicLink(), true);
  fs.rmSync(child); fs.mkdirSync(child);
  await invoke({ WORKSPACE_RENAME_HOLD_TARGET: 'category' });
});

test('child DELETE-sharing retains the observed blocked-parent EPERM while category sharing still requires success', async (t) => {
  const blocked = nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename', lockOpened: true, lockReleased: true });
  for (const scenario of ['child_delete_shared_control', 'delete_shared_control']) {
    const result = await runRenameFixture(fixture(t), scenario, { rename: async () => ({ process: processResult(), response: blocked }) });
    assert.equal(result.status, scenario === 'child_delete_shared_control' ? 'completed' : 'failed');
    assert.equal(result.rename.response.nodeCode, 'EPERM');
    assert.ok(parseFixtureResponse(JSON.stringify(result), scenario));
    assert.equal(result.invariants.logicalIds, true);
  }
  const unexpected = await runRenameFixture(fixture(t), 'child_delete_shared_control', { rename: async () => ({
    process: processResult(), response: { ...blocked, nodeCode: 'ENOENT' },
  }) });
  assert.equal(unexpected.status, 'failed');
});

test('native stress EPERM retains one rename and unchanged-path invariants without invented ENOENT reads', async (t) => {
  let calls = 0;
  const result = await runRenameFixture(fixture(t), 'stress_native', { rename: async () => {
    calls++;
    return { process: processResult(), response: nativeResponse({ renamed: false, nodeCode: 'EPERM', syscall: 'rename' }),
      stress: { process: processResult(), response: stressResponse('stress_native', { iterations: 11875, successes: 11875 }) } };
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'completed');
  assert.ok(Object.values(result.invariants).every(Boolean));
  const saved = parseFixtureResponse(JSON.stringify(result), 'stress_native');
  assert.equal(saved.rename.response.nodeCode, 'EPERM');
  assert.equal(saved.rename.response.renamed, false);
  assert.equal(saved.rename.stress.response.errors.ENOENT, 0);
  assert.equal(saved.rename.stress.response.successes, 11875);
});

test('production scan comparison retains finite scan states separately from rename errors', () => {
  const sample = stressResponse('stress_scan', { iterations: 3, successes: 2,
    scanStates: { ready: 2, empty: 0, changed: 1, unavailable: 0, unreadable: 0, root_identity_conflict: 0 },
    errors: { ENOENT: 0, EPERM: 0, EACCES: 0, EBUSY: 0, ENOTDIR: 0, unknown: 1 } });
  assert.deepEqual(parseRealpathResponse(JSON.stringify({ ...sample, path: privateText,
    scanStates: { ...sample.scanStates, private: privateText } }), 'stress_scan'), sample);
  for (const change of [v => { v.target = 'child'; }, v => { v.scanStates.ready = 3; },
    v => { v.scanStates.changed = -1; }, v => { v.errors.EPERM = 1; v.errors.unknown = 0; },
    v => { v.scanStates = null; }, v => { v.scanStates.unavailable = 0.5; }]) {
    const invalid = structuredClone(sample); change(invalid);
    assert.equal(parseRealpathResponse(JSON.stringify(invalid), 'stress_scan'), null);
  }
  assert.equal(parseRealpathResponse(JSON.stringify({ ...stressResponse('stress_native'), scanStates: sample.scanStates }), 'stress_native'), null);
});
