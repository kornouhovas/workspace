import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { collectNativeSelectionMetadata } from './windows-native-selection.mjs';
import { renameFixtureNames, renameStressBounds, renameStressModes } from './windows-rename-node-worker.mjs';

const script = fileURLToPath(import.meta.url);
const nodeWorker = fileURLToPath(new URL('./windows-rename-node-worker.mjs', import.meta.url));
const realpathWorker = fileURLToPath(new URL('./windows-rename-realpath-worker.mjs', import.meta.url));
const bridge = fileURLToPath(new URL('./windows-rename-diagnostics.ps1', import.meta.url));
const migrations = fileURLToPath(new URL('../src/service/db/migrations', import.meta.url));
export const renameScenarios = Object.freeze(['idle', 'observation', 'concurrent_scan', 'injected_conflict', 'delete_shared_control', 'collision_control',
  'child_injected_conflict', 'child_delete_shared_control', ...Object.keys(renameStressModes)]);
export const renameBounds = Object.freeze({ operationsPerScenario: 2, workerMs: 25000, bridgeMs: 10000,
  terminationMs: 1000, outputBytes: 65536, scanCount: 128, scanMs: 6000, ...renameStressBounds });
const count = (n, max = 100000) => Number.isInteger(n) && n >= 0 && n <= max;
const timestamp = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000;
const code = (error) => ['EPERM', 'EACCES', 'ENOENT', 'ENOTEMPTY', 'EEXIST', 'EBUSY'].includes(error?.code) ? error.code : 'unknown';
const serviceClosed = scenario => scenario === 'idle' || Object.hasOwn(renameStressModes, scenario);
// Sharing DELETE on a child does not grant rename of its parent (exact c8
// Windows evidence). Keep this blocked-parent comparison distinct from the
// category DELETE-sharing success contrast.
const conflictControl = scenario => ['injected_conflict', 'child_injected_conflict', 'child_delete_shared_control'].includes(scenario);
const sharedControl = scenario => scenario === 'delete_shared_control';

export function parseRealpathResponse(text, scenario) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 4096 || !Object.hasOwn(renameStressModes, scenario)) return null;
  try {
    const v = JSON.parse(text), keys = ['ENOENT', 'EPERM', 'EACCES', 'EBUSY', 'ENOTDIR', 'unknown'];
    if (!v || v.version !== 1 || v.mode !== renameStressModes[scenario] || v.target !== (v.mode === 'scan' ? 'grouped_source' : 'child') || v.stage !== 'completed' ||
      !count(v.iterations, renameBounds.stressIterations) || !count(v.successes, v.iterations) ||
      !keys.every(key => count(v.errors?.[key], v.iterations)) ||
      v.successes + keys.reduce((sum, key) => sum + v.errors[key], 0) !== v.iterations ||
      !count(v.afterRenameSignalEnoent, v.errors.ENOENT) || typeof v.renameCompletedSignal !== 'boolean' ||
      (!v.renameCompletedSignal && v.afterRenameSignalEnoent !== 0) ||
      ![v.startedUnixMs, v.readyUnixMs, v.endedUnixMs].every(timestamp) || v.readyUnixMs < v.startedUnixMs ||
      v.endedUnixMs < v.readyUnixMs || v.endedUnixMs - v.startedUnixMs > renameBounds.bridgeMs ||
      (v.mode === 'idle' ? v.iterations !== 0 : v.iterations === 0 || v.successes === 0)) return null;
    let scanStates = null;
    if (v.mode === 'scan') {
      const states = ['ready', 'empty', 'changed', 'unavailable', 'unreadable', 'root_identity_conflict'];
      if (!states.every(key => count(v.scanStates?.[key], v.iterations)) ||
        states.reduce((sum, key) => sum + v.scanStates[key], 0) !== v.iterations ||
        v.successes !== v.scanStates.ready + v.scanStates.empty || v.errors.unknown !== v.iterations - v.successes ||
        keys.filter(key => key !== 'unknown').some(key => v.errors[key] !== 0)) return null;
      scanStates = Object.fromEntries(states.map(key => [key, v.scanStates[key]]));
    } else if (v.scanStates != null) return null;
    return { version: 1, mode: v.mode, target: v.target, stage: 'completed', iterations: v.iterations, successes: v.successes,
      errors: Object.fromEntries(keys.map(key => [key, v.errors[key]])), afterRenameSignalEnoent: v.afterRenameSignalEnoent,
      renameCompletedSignal: v.renameCompletedSignal, scanStates, startedUnixMs: v.startedUnixMs, readyUnixMs: v.readyUnixMs, endedUnixMs: v.endedUnixMs };
  } catch { return null; }
}

export function parseRenameResponse(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 2048) return null;
  try {
    const v = JSON.parse(text);
    if (!v || v.version !== 1 || !['input', 'compile', 'lock', 'rename', 'completed'].includes(v.stage) ||
      !['node_fs_rename', 'move_file_ex'].includes(v.api) ||
      ![0, 1].includes(v.invocationCount) || typeof v.renamed !== 'boolean' ||
      !(v.win32Code === null || count(v.win32Code, 4294967295)) ||
      !(v.nodeCode === null || ['EPERM', 'EACCES', 'ENOENT', 'ENOTEMPTY', 'EEXIST', 'EBUSY', 'EINVAL', 'ENAMETOOLONG', 'UNKNOWN', 'unknown'].includes(v.nodeCode)) ||
      !(v.syscall === null || v.syscall === 'rename') ||
      typeof v.lockOpened !== 'boolean' || typeof v.lockReleased !== 'boolean' || (v.lockReleased && !v.lockOpened) ||
      ![v.startedUnixMs, v.endedUnixMs].every((n) => n === null || timestamp(n))) return null;
    if (v.api === 'node_fs_rename' && v.invocationCount === 1 && v.win32Code !== null) return null;
    if (v.api === 'move_file_ex' && (v.nodeCode !== null || v.syscall !== null)) return null;
    if (v.stage === 'completed') {
      if (v.invocationCount !== 1 || !timestamp(v.startedUnixMs) || !timestamp(v.endedUnixMs) || v.endedUnixMs < v.startedUnixMs) return null;
      if (v.api === 'move_file_ex' ? v.win32Code === null || v.renamed !== (v.win32Code === 0)
        : v.renamed ? v.nodeCode !== null || v.syscall !== null : v.nodeCode === null || v.syscall !== 'rename') return null;
    } else if (v.stage === 'rename' && v.invocationCount === 1) {
      if (v.renamed || v.win32Code !== null || v.nodeCode !== null || v.syscall !== null || !timestamp(v.startedUnixMs) || v.endedUnixMs !== null) return null;
    } else if (v.invocationCount !== 0 || v.renamed || v.nodeCode !== null || v.syscall !== null || v.startedUnixMs !== null || v.endedUnixMs !== null) return null;
    if (['input', 'compile', 'lock'].includes(v.stage) && v.lockOpened) return null;
    return Object.fromEntries(['version', 'api', 'stage', 'invocationCount', 'renamed', 'win32Code', 'nodeCode', 'syscall',
      'lockOpened', 'lockReleased', 'startedUnixMs', 'endedUnixMs'].map((k) => [k, v[k]]));
  } catch { return null; }
}

// Bounded stdout/stderr, explicit process termination evidence; no raw exception
// or subprocess output escapes this boundary. PowerShell never starts children.
export function runBoundedProcess(program, args, { env = process.env, timeoutMs, maxBytes = renameBounds.outputBytes,
  spawnProcess = spawn, clock = { setTimeout, clearTimeout }, tree = false, readyMarker, readyInput = 'rename\n', waitForReadyCallback = false, onReady = () => {} } = {}) {
  return new Promise((resolveResult) => {
    let child, timer, killTimer, settled = false, reason = null, bytes = 0, stdout = '', ready = false;
    const finish = (termination, exitCode = null) => {
      if (settled) return;
      settled = true; clock.clearTimeout(timer); clock.clearTimeout(killTimer);
      if (termination === 'unknown') { child?.unref(); child?.stdin?.destroy(); child?.stdout.destroy(); child?.stderr.destroy(); }
      resolveResult({ status: reason ?? (exitCode === 0 ? 'completed' : 'process_error'), termination,
        exitCode: Number.isInteger(exitCode) && Math.abs(exitCode) <= 2147483648 ? exitCode : null,
        stdout: reason ? '' : stdout });
    };
    const stop = (why) => {
      if (settled || reason) return;
      reason = why;
      killTimer = clock.setTimeout(() => finish('unknown'), renameBounds.terminationMs);
      // Worker may own PowerShell: kill only this generated worker's process tree.
      if (tree && process.platform === 'win32' && count(child?.pid, 2147483647) && child.pid > 0) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => {}); killer.unref();
        const killBound = setTimeout(() => { try { killer.kill(); } catch { /* Still unverified. */ } }, 1000);
        killBound.unref(); killer.on('close', () => clearTimeout(killBound));
        // close of the worker alone cannot prove every descendant terminated.
      } else { try { child.kill('SIGKILL'); } catch { /* Wait for close. */ } }
    };
    timer = clock.setTimeout(() => stop('timeout'), timeoutMs);
    try { child = spawnProcess(program, args, { env, windowsHide: true, shell: false, stdio: [readyMarker ? 'pipe' : 'ignore', 'pipe', 'pipe'] }); }
    catch { reason = 'launch_error'; finish('not_started'); return; }
    child.on('error', () => { reason ??= 'launch_error'; });
    child.stdin?.on('error', () => { /* Closed input is classified by process/protocol outcome. */ });
    for (const [stream, retain] of [[child.stdout, true], [child.stderr, false]]) stream.on('data', (data) => {
      bytes += Buffer.byteLength(data);
      if (bytes > maxBytes) { stop('output_limit'); return; }
      if (retain) {
        stdout += data.toString('utf8');
        if (readyMarker && !ready && (stdout.startsWith(`${readyMarker}\n`) || stdout.startsWith(`${readyMarker}\r\n`))) {
          ready = true; stdout = stdout.slice(stdout.indexOf('\n') + 1);
          if (waitForReadyCallback) {
            Promise.resolve().then(onReady).then(() => { if (!settled && !reason) child.stdin.end(readyInput); }, () => stop('process_error'));
          } else { child.stdin.end(readyInput); onReady(); }
        }
      }
    });
    child.on('close', (exitCode) => finish(tree && reason && process.platform === 'win32' ? 'unknown' : 'confirmed', exitCode));
  });
}

export async function invokeExternalRename(directory, scenario, { onReady, runProcess = runBoundedProcess } = {}) {
  const env = { ...process.env, WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: scenario,
    WORKSPACE_RENAME_CATEGORY: renameFixtureNames.category, WORKSPACE_RENAME_PROJECT: renameFixtureNames.project,
    WORKSPACE_RENAME_HOLD_TARGET: scenario.startsWith('child_') ? 'child' : 'category' };
  const invokeNode = () => runProcess(process.execPath, [nodeWorker], { timeoutMs: renameBounds.bridgeMs, maxBytes: 4096,
    readyMarker: scenario === 'concurrent_scan' ? 'WORKSPACE_RENAME_READY' : undefined, onReady, env });
  if (Object.hasOwn(renameStressModes, scenario)) {
    let nodePending;
    const stress = await runProcess(process.execPath, ['--import', 'tsx', realpathWorker], { timeoutMs: renameBounds.bridgeMs, maxBytes: 4096, env,
      readyMarker: 'WORKSPACE_REALPATH_READY', readyInput: 'finished\n', waitForReadyCallback: true,
      onReady: async () => { nodePending = invokeNode(); await nodePending; } });
    const node = await nodePending;
    const processEvidence = withoutOutput(stress.status === 'completed' && node ? node : stress);
    if (stress.termination === 'unknown' || node?.termination === 'unknown') processEvidence.termination = 'unknown';
    if (stress.status === 'completed' && !node) processEvidence.status = 'process_error';
    return { process: processEvidence, response: node?.status === 'completed' ? parseRenameResponse(node.stdout) : null,
      stress: { process: withoutOutput(stress), response: stress.status === 'completed' ? parseRealpathResponse(stress.stdout, scenario) : null } };
  }
  const held = conflictControl(scenario) || sharedControl(scenario);
  if (scenario !== 'collision_control' && !held) {
    const result = await invokeNode();
    return { process: withoutOutput(result), response: result.status === 'completed' ? parseRenameResponse(result.stdout) : null };
  }
  let nodePending;
  const holder = await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', bridge], {
    timeoutMs: renameBounds.bridgeMs, maxBytes: 4096, env,
    ...(held ? { readyMarker: 'WORKSPACE_RENAME_LOCKED', readyInput: 'release\n', waitForReadyCallback: true,
      onReady: async () => { nodePending = invokeNode(); await nodePending; } } : {}),
  });
  const holderResponse = holder.status === 'completed' ? parseRenameResponse(holder.stdout) : null;
  if (!held) return { process: withoutOutput(holder), response: holderResponse };
  // Await the Node process even if the holder exhausted its deadline. Its handle
  // lifetime is then unverified and must not qualify as a completed control.
  const node = await nodePending;
  const response = node?.status === 'completed' ? parseRenameResponse(node.stdout) : null;
  if (holderResponse?.stage === 'rename' && holderResponse.invocationCount === 0 && response) {
    response.lockOpened = holderResponse.lockOpened;
    response.lockReleased = holderResponse.lockReleased;
  }
  const processEvidence = withoutOutput(holder.status === 'completed' && node ? node : holder);
  if (holder.termination === 'unknown' || node?.termination === 'unknown') processEvidence.termination = 'unknown';
  if (holder.status === 'completed' && !node) processEvidence.status = 'process_error';
  return { process: processEvidence, response: response ?? holderResponse };
}
const withoutOutput = ({ status, termination, exitCode }) => ({ status, termination, exitCode });
const invariantNames = ['controlDetected', 'sentinels', 'inventory', 'logicalIds', 'exactText', 'history', 'reconciliation', 'restart', 'observerCleanup'];
const resourceNames = ['watchesOpened', 'watchesClosed', 'liveWatches', 'peakWatches', 'timersScheduled', 'liveTimers', 'healthCallbacks', 'probes', 'explicitScans'];
const validProcess = value => value && ['not_started', 'confirmed', 'unknown'].includes(value.termination) &&
  ['completed', 'timeout', 'output_limit', 'launch_error', 'process_error', 'not_attempted'].includes(value.status) &&
  (value.exitCode === null || (Number.isInteger(value.exitCode) && Math.abs(value.exitCode) <= 2147483648));
const controlDetected = (scenario, response) => conflictControl(scenario)
  ? response.api === 'node_fs_rename' && response.lockOpened && response.lockReleased && !response.renamed &&
    (scenario.startsWith('child_') ? response.nodeCode === 'EPERM' : ['EPERM', 'EACCES', 'EBUSY'].includes(response.nodeCode))
  : sharedControl(scenario) ? response.api === 'node_fs_rename' && response.lockOpened && response.lockReleased && response.renamed
  : scenario === 'collision_control' ? response.api === 'move_file_ex' && !response.renamed && response.win32Code > 0
    : response.api === 'node_fs_rename' && !response.lockOpened && !response.lockReleased;

export function parseFixtureResponse(text, scenario) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > renameBounds.outputBytes) return null;
  try {
    const v = JSON.parse(text);
    if (!v || v.version !== 1 || v.scenario !== scenario || !renameScenarios.includes(scenario) ||
      v.serviceState !== (serviceClosed(scenario) ? 'closed' : 'active') ||
      !['completed', 'failed'].includes(v.status) || !['setup', 'rename', 'verification', 'completed'].includes(v.stage) ||
      !(v.errorCode === null || ['EPERM', 'EACCES', 'ENOENT', 'ENOTEMPTY', 'EEXIST', 'EBUSY', 'unknown'].includes(v.errorCode)) ||
      !invariantNames.every((k) => typeof v.invariants?.[k] === 'boolean') ||
      !resourceNames.every((k) => count(v.resources?.[k])) ||
      typeof v.resources.pollCategories !== 'boolean' ||
      !['liveWatches', 'liveTimers', 'healthCallbacks'].every((k) => count(v.atRename?.[k])) ||
      !Array.isArray(v.scans) || v.scans.length > renameBounds.scanCount ||
      !v.scans.every((s) => Array.isArray(s) && s.length === 2 && s.every(timestamp) && s[1] >= s[0]) ||
      !['not_started', 'confirmed', 'unknown'].includes(v.rename?.process?.termination) ||
      !['completed', 'timeout', 'output_limit', 'launch_error', 'process_error', 'not_attempted'].includes(v.rename?.process?.status) ||
      !(v.rename.process.exitCode === null || (Number.isInteger(v.rename.process.exitCode) && Math.abs(v.rename.process.exitCode) <= 2147483648))) return null;
    const response = v.rename.response === null ? null : parseRenameResponse(JSON.stringify(v.rename.response));
    if (v.rename.response !== null && response === null) return null;
    let stress = null;
    if (Object.hasOwn(renameStressModes, scenario)) {
      if (!validProcess(v.rename.stress?.process)) return null;
      const reading = v.rename.stress.response === null ? null : parseRealpathResponse(JSON.stringify(v.rename.stress.response), scenario);
      if ((v.rename.stress.response !== null && reading === null) ||
        (v.rename.stress.process.termination === 'unknown' && v.rename.process.termination !== 'unknown')) return null;
      stress = { process: withoutOutput(v.rename.stress.process), response: reading };
      if (v.status === 'completed' && (stress.process.status !== 'completed' || stress.process.termination !== 'confirmed' || !reading?.renameCompletedSignal ||
        response?.startedUnixMs < reading.readyUnixMs || response?.endedUnixMs > reading.endedUnixMs)) return null;
    } else if (v.rename.stress != null) return null;
    if (v.status === 'completed' && (v.stage !== 'completed' || v.errorCode !== null || !Object.values(v.invariants).every((n) => n === true) ||
      response?.stage !== 'completed' || v.rename.process.status !== 'completed' || v.rename.process.termination !== 'confirmed' ||
      !controlDetected(scenario, response) || v.resources.liveWatches !== 0 || v.resources.liveTimers !== 0 ||
      v.resources.watchesOpened !== v.resources.watchesClosed || v.resources.explicitScans !== v.scans.length ||
      (serviceClosed(scenario) ? v.atRename.liveWatches !== 0 || v.atRename.liveTimers !== 0 : v.atRename.liveWatches < 1) ||
      (scenario === 'observation' && v.atRename.healthCallbacks < 1) ||
      (scenario === 'concurrent_scan' && v.scans.length === 0))) return null;
    return { version: 1, scenario, serviceState: v.serviceState, status: v.status, stage: v.stage, errorCode: v.errorCode,
      rename: { process: withoutOutput(v.rename.process), response, ...(stress ? { stress } : {}) },
      invariants: Object.fromEntries(invariantNames.map((k) => [k, v.invariants[k]])),
      resources: Object.fromEntries([...resourceNames, 'pollCategories'].map((k) => [k, v.resources[k]])),
      atRename: Object.fromEntries(['liveWatches', 'liveTimers', 'healthCallbacks'].map((k) => [k, v.atRename[k]])), scans: v.scans };
  } catch { return null; }
}

// A single generated fixture, real production service and SQLite. Wrappers only
// count owned native resources; they do not change scheduling/watch policy.
export async function runRenameFixture(directory, scenario, { rename = invokeExternalRename } = {}) {
  if (!renameScenarios.includes(scenario)) throw new Error('Invalid diagnostic scenario');
  const result = { version: 1, scenario, serviceState: serviceClosed(scenario) ? 'closed' : 'active', status: 'failed', stage: 'setup', errorCode: null,
    rename: { process: { status: 'not_attempted', termination: 'not_started', exitCode: null }, response: null },
    invariants: Object.fromEntries(invariantNames.map((k) => [k, false])),
    resources: Object.fromEntries(resourceNames.map((k) => [k, 0])),
    atRename: { liveWatches: 0, liveTimers: 0, healthCallbacks: 0 }, scans: [] };
  const { openSettingsService } = await import('../dist/service/settings.mjs');
  const { nativeObserverDependencies: native } = await import('../src/service/source-observer.ts');
  const { default: Database } = await import('better-sqlite3');
  result.resources.pollCategories = native.pollCategories;
  const r = result.resources;
  const dependencies = { ...native,
    probe(path) { r.probes++; return native.probe(path); },
    watch(...args) {
      const watch = native.watch(...args); r.watchesOpened++; r.liveWatches++; r.peakWatches = Math.max(r.peakWatches, r.liveWatches);
      let active = true;
      return { close() { if (active) { active = false; watch.close(); r.watchesClosed++; r.liveWatches--; } } };
    },
    schedule(callback, ms) {
      r.timersScheduled++; r.liveTimers++; let active = true;
      const timer = native.schedule(() => { if (active) { active = false; r.liveTimers--; if (ms === 5000) r.healthCallbacks++; callback(); } }, ms);
      return { cancel() { if (active) { active = false; r.liveTimers--; timer.cancel(); } } };
    },
  };
  const root = join(directory, 'root'), { category, target, project } = renameFixtureNames;
  const bytes = Buffer.from([0, 255, 42, 10]), text = '  Exact\nТекст 文  ', historyText = '\n Historical  ';
  let service, sqlite, pendingRename;
  try {
    // The worker only populates an empty directory created by the coordinator
    // process. A mistaken caller path must never overwrite existing content.
    assert.equal(fs.realpathSync.native(directory), directory);
    assert.equal(fs.readdirSync(directory).length, 0);
    for (const name of [category, 'Occupied', ...Array.from({ length: 12 }, (_, n) => `Scan-${n}`)]) {
      fs.mkdirSync(join(root, name, project), { recursive: true }); fs.writeFileSync(join(root, name, project, 'sentinel'), bytes);
    }
    fs.writeFileSync(join(root, 'Occupied', 'sentinel'), 'never overwrite');
    const databasePath = join(directory, 'data', 'workspace.sqlite');
    const open = () => openSettingsService(databasePath, migrations, undefined, dependencies);
    service = open(); sqlite = new Database(databasePath);
    const workspace = service.workspaces.create({ type: 'workspace.create', name: 'Diagnostic', rootPath: root });
    assert.equal(workspace.ok, true);
    const workspaceId = workspace.value.workspaceId;
    const query = (type, extra = {}) => { const v = service.handleQuery({ type, workspaceId, ...extra }); assert.equal(v.ok, true); return v.value; };
    const command = (type, extra = {}) => { const v = service.handleCommand({ type, workspaceId, ...extra }); assert.equal(v.ok, true); return v.value; };
    const apply = (mode) => command('workspace.applyDiscovery', { previewToken: query('workspace.previewDiscovery', { mode }).previewToken });
    const direct = apply('direct');
    const historyId = direct.projects.find((p) => p.relativePath === category).projectId;
    const propertyId = command('workspace.createProperty', { name: 'Notes', propertyType: 'text' }).propertyId;
    command('workspace.setTextValue', { projectId: historyId, propertyId, value: historyText });
    const grouped = apply('grouped');
    const projectId = grouped.projects.find((p) => p.relativePath === `${category}/${project}`).projectId;
    const categoryId = grouped.categories.find((c) => c.relativePath === category).categoryId;
    command('workspace.setTextValue', { projectId, propertyId, value: text });
    const rows = (table, where = '') => sqlite.prepare(`SELECT * FROM ${table} ${where} ORDER BY 1`).all();
    const values = rows('text_property_values'), history = rows('projects', 'WHERE mode_inactive = 1');
    const metadata = ['property_definitions', 'category_properties', 'workspaces', 'views'].map((t) => rows(t));
    if (serviceClosed(scenario)) { service.close(); service = null; }
    if (scenario === 'observation') { await delay(5200); assert.ok(r.healthCallbacks >= 1); }
    result.stage = 'rename';
    result.atRename = { liveWatches: r.liveWatches, liveTimers: r.liveTimers, healthCallbacks: r.healthCallbacks };
    let done = false;
    let ready;
    const prepared = new Promise((resolveReady) => { ready = resolveReady; });
    // Attach rejection handling before yielding to scans. Even a failed service
    // scan must wait for its already started external operation before cleanup.
    pendingRename = Promise.resolve().then(() => rename(directory, scenario, { onReady: ready })).then((v) => v, () => ({
      process: { status: 'process_error', termination: 'unknown', exitCode: null }, response: null,
    })).finally(() => { done = true; });
    if (scenario === 'concurrent_scan') {
      await Promise.race([prepared, pendingRename]);
      const scanStart = Date.now();
      while (!done && result.scans.length < renameBounds.scanCount && Date.now() - scanStart < renameBounds.scanMs) {
        const start = Date.now(); command('workspace.refreshSource'); r.explicitScans++;
        result.scans.push([start, Date.now()]); await delay(20);
      }
    }
    result.rename = await pendingRename;
    const response = result.rename.response;
    assert.equal(result.rename.process.termination, 'confirmed'); assert.equal(response?.stage, 'completed');
    assert.equal(result.rename.process.status, 'completed');
    assert.equal(response.invocationCount, 1);
    if (Object.hasOwn(renameStressModes, scenario)) {
      const stress = result.rename.stress;
      assert.equal(stress?.process.status, 'completed'); assert.equal(stress.process.termination, 'confirmed');
      assert.ok(stress.response);
      assert.equal(stress.response.renameCompletedSignal, true);
      assert.ok(response.startedUnixMs >= stress.response.readyUnixMs && response.endedUnixMs <= stress.response.endedUnixMs);
    }
    if (scenario === 'concurrent_scan') assert.ok(result.scans.length > 0);
    result.invariants.controlDetected = controlDetected(scenario, response);
    result.stage = 'verification';
    if (!service) service = open();
    command('workspace.refreshSource');
    const current = query('workspace.listProjects'), expectedCategory = response.renamed ? target : category;
    result.invariants.logicalIds = current.projects.find((p) => p.relativePath === `${expectedCategory}/${project}`)?.projectId === projectId &&
      current.categories.find((c) => c.relativePath === expectedCategory)?.categoryId === categoryId;
    result.invariants.reconciliation = result.invariants.logicalIds && current.projects.length === grouped.projects.length && current.categories.length === grouped.categories.length;
    result.invariants.exactText = JSON.stringify(rows('text_property_values')) === JSON.stringify(values) &&
      JSON.stringify(['property_definitions', 'category_properties', 'workspaces', 'views'].map((t) => rows(t))) === JSON.stringify(metadata);
    result.invariants.history = JSON.stringify(rows('projects', 'WHERE mode_inactive = 1')) === JSON.stringify(history);
    const expectedNames = [expectedCategory, 'Occupied', ...Array.from({ length: 12 }, (_, n) => `Scan-${n}`)].sort();
    result.invariants.inventory = JSON.stringify(fs.readdirSync(root).sort()) === JSON.stringify(expectedNames) &&
      expectedNames.every((name) => JSON.stringify(fs.readdirSync(join(root, name)).sort()) === JSON.stringify((name === 'Occupied' ? [project, 'sentinel'] : [project]).sort()) &&
        JSON.stringify(fs.readdirSync(join(root, name, project))) === JSON.stringify(['sentinel']));
    result.invariants.sentinels = expectedNames.every((name) => fs.readFileSync(join(root, name, project, 'sentinel')).equals(bytes)) &&
      fs.readFileSync(join(root, 'Occupied', 'sentinel'), 'utf8') === 'never overwrite';
    service.close(); service = open();
    const reopened = query('workspace.listProjects');
    result.invariants.restart = reopened.projects.find((p) => p.projectId === projectId)?.relativePath === `${expectedCategory}/${project}` &&
      JSON.stringify(rows('text_property_values')) === JSON.stringify(values) && JSON.stringify(rows('projects', 'WHERE mode_inactive = 1')) === JSON.stringify(history);
  } catch (error) { result.errorCode = code(error); }
  finally {
    if (pendingRename) result.rename = await pendingRename;
    try { service?.close(); sqlite?.close(); } catch (error) { result.errorCode ??= code(error); }
    result.invariants.observerCleanup = r.liveWatches === 0 && r.liveTimers === 0 && r.watchesOpened === r.watchesClosed;
  }
  if (Object.values(result.invariants).every(Boolean) && !result.errorCode) { result.status = 'completed'; result.stage = 'completed'; }
  return result;
}

export async function runRenameDiagnostics({ evidenceDirectory = process.env.WORKSPACE_RENAME_EVIDENCE_DIR,
  platform = process.platform, operations = renameBounds.operationsPerScenario, scenarios = renameScenarios,
  metadata = collectNativeSelectionMetadata, worker = (directory, scenario) => runBoundedProcess(process.execPath,
    ['--import', 'tsx', script, '--fixture'], { timeoutMs: renameBounds.workerMs, tree: true,
      env: { ...process.env, WORKSPACE_RENAME_FIXTURE: directory, WORKSPACE_RENAME_SCENARIO: scenario } }),
} = {}) {
  if (!evidenceDirectory || !count(operations, 2) || operations < 1 || !Array.isArray(scenarios) || scenarios.length === 0 ||
    new Set(scenarios).size !== scenarios.length || scenarios.some(scenario => !renameScenarios.includes(scenario))) throw new Error('Invalid diagnostic configuration');
  const result = { version: 1, kind: 'real-service-external-category-rename', status: 'failed', metadata: await metadata(),
    limits: renameBounds, handleAttribution: 'owned-resources-only',
    renameOperation: { api: 'Node fs.promises.rename', historicalOperation: 'Node fs.promises.rename',
      equivalentToHistoricalOperation: true, destinationInitiallyAbsent: true },
    collisionOperation: { api: 'MoveFileExW', flags: 0, replacing: false },
    handleControls: { access: 'GENERIC_READ', conflictShare: 'READ|WRITE', contrastShare: 'READ|WRITE|DELETE', holder: 'separate-powershell-process', targets: ['category', 'child'] },
    realpathStress: { target: 'child', modes: renameStressModes, serviceState: 'closed', worker: 'separate-node-process',
      enoent: 'afterRenameSignalEnoent-is-separate-from-the-rename-result', timing: 'interval-overlap-not-OS-handle-attribution', scan: 'production-scanGroupedSource-no-injected-resolver' },
    pathShape: 'historical-long-unicode-category-and-project',
    scanTiming: 'wall-clock-intervals-not-OS-handle-attribution', operations: [], failure: null };
  if (!result.metadata.codeSha) result.failure = 'revision_unavailable';
  else if (platform !== 'win32') result.failure = 'unsupported_host';
  else {
    for (const scenario of scenarios) for (let attempt = 0;
      attempt < (Object.hasOwn(renameStressModes, scenario) ? renameBounds.stressOperationsPerScenario : operations); attempt++) {
      const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'workspace-rename-diagnostic-')));
      const operation = { scenario, index: attempt + 1, process: null, evidence: null, cleanup: 'unverified', cleanupCode: null };
      result.operations.push(operation);
      try {
        const response = await worker(directory, scenario);
        operation.process = withoutOutput(response);
        operation.evidence = response.status === 'completed' ? parseFixtureResponse(response.stdout, scenario) : null;
        if (response.termination === 'not_started' || (response.termination === 'confirmed' && operation.evidence &&
          operation.evidence.rename.process.termination !== 'unknown')) {
          fs.rmSync(directory, { recursive: true, force: true, maxRetries: 0 }); operation.cleanup = 'completed';
        }
      } catch (error) { operation.cleanupCode = code(error); }
      if (!operation.evidence || operation.evidence.status !== 'completed' || operation.cleanup !== 'completed') result.failure ??= 'operation_failed';
    }
  }
  result.realRenameFailures = result.operations.filter((o) => !conflictControl(o.scenario) && !sharedControl(o.scenario) &&
    o.scenario !== 'collision_control' && o.evidence?.rename.response?.renamed === false).length;
  if (!result.failure) result.status = 'completed';
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(join(evidenceDirectory, 'rename-observations.json'), JSON.stringify(result, null, 2));
  return result;
}

export async function runRenameCli({ args = process.argv.slice(2), diagnostics = runRenameDiagnostics,
  stdout = process.stdout, stderr = process.stderr } = {}) {
  if (args.length) { stderr.write('Windows rename diagnostic failed (arguments).\n'); return 1; }
  try {
    const result = await diagnostics();
    if (result.status !== 'completed') throw new Error('diagnostic');
    stdout.write('Windows rename diagnostic completed; inspect every operation.\n'); return 0;
  } catch { stderr.write('Windows rename diagnostic failed.\n'); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const directory = process.env.WORKSPACE_RENAME_FIXTURE;
  let ownedWorker = false;
  try { ownedWorker = Boolean(directory && dirname(directory) === fs.realpathSync.native(tmpdir()) &&
    /^workspace-rename-diagnostic-[A-Za-z0-9]{6}$/.test(basename(directory)) && fs.realpathSync.native(directory) === directory); }
  catch { /* An unavailable/non-owned path cannot start the internal worker. */ }
  if (process.argv[2] === '--fixture' && process.argv.length === 3 && ownedWorker) {
    try { process.stdout.write(JSON.stringify(await runRenameFixture(process.env.WORKSPACE_RENAME_FIXTURE, process.env.WORKSPACE_RENAME_SCENARIO))); }
    catch { process.exitCode = 1; }
  } else process.exitCode = await runRenameCli();
}
