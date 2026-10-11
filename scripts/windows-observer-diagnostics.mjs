import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { observe } from './ralphex-observe.mjs';

const reasons = ['deadline', 'ownership_unknown', 'access_lost', 'needs_decision', 'failed', 'cancelled', 'diagnostic', 'lease_lost', 'completed', 'transition', 'progress'];
const ownerships = ['identified', 'legacy_limited', 'unknown'];
const diagnosticCodes = ['access_lost', 'source_mismatch', 'cursor_invalid', 'log_discontinuity', 'lease_lost', 'ci_identity_mismatch'];
const textValid = value => typeof value === 'string' && value.length > 0;
const numericCode = value => Number.isSafeInteger(value) && Math.abs(value) <= 65535 ? value : 'unavailable';
const emptyObserver = (status, errno = 'unavailable') => ({ status, reason: 'unavailable', ownership: 'unavailable', diagnosticCode: 'unavailable', exitCode: 'unavailable', errno });

// Public diagnostic boundary: observe the selected disposable runner, projecting
// only finite codes and comparisons. Never return the observer's private object.
export async function inspectObserverFixture({ source, cursor, budgetMs = 100, ownedPid = process.pid } = {}) {
  if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 2000) throw new Error('Invalid diagnostic budget');
  const files = ['current.json', 'executor.lock', 'full.log'].map(file => join(source.dir, file));
  const before = files.map(file => readFileSync(file));
  const state = JSON.parse(before[0]), lock = JSON.parse(before[1]);
  const syncDir = realpathSync(source.dir), syncLog = realpathSync(source.log);
  const [asyncDir, asyncLog] = await Promise.all([realpath(source.dir), realpath(source.log)]);
  let probe;
  try {
    if (!Number.isSafeInteger(ownedPid) || ownedPid <= 0) probe = { status: 'unavailable', errno: 'unavailable' };
    else { process.kill(ownedPid, 0); probe = { status: 'allowed', errno: 'unavailable' }; }
  }
  catch (error) { probe = { status: 'denied', errno: numericCode(error.errno) }; }
  const controller = new AbortController();
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, 2000); });
  let result, observer;
  try {
    const observation = observe({ source, cursor, budgetMs, pollMs: 10, signal: controller.signal });
    result = await Promise.race([observation, timeout]);
    if (result === null) {
      // Abort stops observation at two seconds. Give only its own cursor-lock
      // release a short bounded drain before the disposable tree is removed.
      await settledWithin(observation.catch(() => {}), 200);
      observer = emptyObserver('timed_out');
    }
    else if (!result || result.schemaVersion !== 1 || !reasons.includes(result.reason) || !ownerships.includes(result.ownership) || (result.diagnostic && !diagnosticCodes.includes(result.diagnostic.code))) observer = emptyObserver('invalid_result');
    else observer = { status: 'collected', reason: result.reason, ownership: result.ownership, diagnosticCode: result.diagnostic?.code ?? 'unavailable', exitCode: numericCode(result.exit), errno: 'unavailable' };
  } catch (error) { observer = emptyObserver('error', numericCode(error.errno)); }
  finally { clearTimeout(timer); }
  const identity = {
    stateVersionValid: state.version === 1,
    stateRunning: state.status === 'running',
    stateRunIdValid: textValid(state.runId), stateExecutionIdValid: textValid(state.executionId),
    stateDirectoryValid: textValid(state.runDirectory), stateWorktreeValid: textValid(state.worktree),
    lockTokenValid: textValid(lock.token), lockPidValid: Number.isSafeInteger(lock.pid) && lock.pid > 0,
    lockPidMatchesOwnedProcess: lock.pid === ownedPid,
    lockRunIdValid: textValid(lock.runId), lockExecutionIdValid: textValid(lock.executionId),
    lockDirectoryValid: textValid(lock.runDirectory), lockWorktreeValid: textValid(lock.worktree),
    sourceKindValid: source.kind === 'runner', sourceDirectoryValid: textValid(source.dir), sourceLogValid: textValid(source.log),
    directorySyncAsyncEqual: syncDir === asyncDir, logSyncAsyncEqual: syncLog === asyncLog,
    stateDirectoryMatchesSource: state.runDirectory === asyncDir, lockDirectoryMatchesSource: lock.runDirectory === asyncDir,
    stateLockDirectoryEqual: state.runDirectory === lock.runDirectory,
    stateLockRunIdEqual: state.runId === lock.runId, stateLockExecutionIdEqual: state.executionId === lock.executionId,
    stateLockWorktreeEqual: state.worktree === lock.worktree,
    observerSourceAvailable: Boolean(result?.source),
    observerSourceKindEqual: result?.source?.kind === source.kind,
    observerSourceDirectoryEqual: result?.source?.dir === asyncDir, observerSourceLogEqual: result?.source?.log === asyncLog,
    observerSourceRunIdEqual: result?.source?.runId === state.runId,
    observerSourceExecutionIdEqual: result?.source?.executionId === state.executionId,
    observerSourceWorktreeEqual: result?.source?.worktree === state.worktree,
  };
  return { identity, probe, observer, inputsUnchanged: files.every((file, i) => readFileSync(file).equals(before[i])) };
}

const identityKeys = [
  'stateVersionValid', 'stateRunning', 'stateRunIdValid', 'stateExecutionIdValid', 'stateDirectoryValid', 'stateWorktreeValid',
  'lockTokenValid', 'lockPidValid', 'lockPidMatchesOwnedProcess', 'lockRunIdValid', 'lockExecutionIdValid', 'lockDirectoryValid', 'lockWorktreeValid',
  'sourceKindValid', 'sourceDirectoryValid', 'sourceLogValid', 'directorySyncAsyncEqual', 'logSyncAsyncEqual',
  'stateDirectoryMatchesSource', 'lockDirectoryMatchesSource', 'stateLockDirectoryEqual', 'stateLockRunIdEqual', 'stateLockExecutionIdEqual',
  'stateLockWorktreeEqual', 'observerSourceAvailable', 'observerSourceKindEqual', 'observerSourceDirectoryEqual',
  'observerSourceLogEqual', 'observerSourceRunIdEqual', 'observerSourceExecutionIdEqual', 'observerSourceWorktreeEqual',
];
const caseNames = ['current_process', 'owned_child'];
const unavailableCase = name => ({ name, identity: Object.fromEntries(identityKeys.map(key => [key, false])), probe: { status: 'unavailable', errno: 'unavailable' }, observer: emptyObserver('unreached'), inputsUnchanged: false });
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const codeValid = value => value === 'unavailable' || numericCode(value) === value;
const provenanceValid = value => exactKeys(value, ['sha', 'runId', 'attempt', 'matrix', 'platform', 'nodeVersion']) && typeof value.sha === 'string' && /^[a-f0-9]{40}$/.test(value.sha) && typeof value.runId === 'string' && /^(local|[1-9][0-9]{0,19})$/.test(value.runId) && Number.isSafeInteger(value.attempt) && value.attempt >= 1 && value.attempt <= 10000 && ['local', 'windows-latest', 'windows-2022'].includes(value.matrix) && ['darwin', 'win32', 'linux'].includes(value.platform) && typeof value.nodeVersion === 'string' && /^v\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value.nodeVersion);
const observerValid = value => exactKeys(value, ['status', 'reason', 'ownership', 'diagnosticCode', 'exitCode', 'errno']) && ['collected', 'error', 'timed_out', 'invalid_result', 'unreached'].includes(value.status) && [...reasons, 'unavailable'].includes(value.reason) && [...ownerships, 'unavailable'].includes(value.ownership) && [...diagnosticCodes, 'unavailable'].includes(value.diagnosticCode) && codeValid(value.exitCode) && codeValid(value.errno) && (value.status !== 'collected' || (reasons.includes(value.reason) && ownerships.includes(value.ownership)));
const caseValid = value => exactKeys(value, ['name', 'identity', 'probe', 'observer', 'inputsUnchanged']) && caseNames.includes(value.name) && exactKeys(value.identity, identityKeys) && Object.values(value.identity).every(item => typeof item === 'boolean') && exactKeys(value.probe, ['status', 'errno']) && ['allowed', 'denied', 'unavailable'].includes(value.probe.status) && codeValid(value.probe.errno) && observerValid(value.observer) && typeof value.inputsUnchanged === 'boolean';

// Reject extra fields as well as unknown codes; upload validation cannot bless
// an exception, path, arbitrary observer field or malformed status document.
export function validateEvidence(value) {
  try {
    if (Buffer.byteLength(JSON.stringify(value)) > 12 * 1024 || value.schemaVersion !== 1 || !provenanceValid(value.provenance)) return false;
    if (value.kind === 'focused_tests') return exactKeys(value, ['schemaVersion', 'kind', 'provenance', 'status', 'exitCode', 'errno']) && ['passed', 'failed', 'timed_out', 'unreached'].includes(value.status) && codeValid(value.exitCode) && codeValid(value.errno) && (value.status !== 'passed' || value.exitCode === 0) && (value.status !== 'failed' || value.exitCode !== 0) && (value.status !== 'unreached' || value.exitCode === 'unavailable');
    if (value.outcome === 'ordinary' && !value.cases?.every(item => item.observer?.status === 'collected' && item.observer.reason === 'deadline' && item.observer.ownership === 'identified')) return false;
    if (value.collection !== 'unreached' && value.processExitCode !== (value.collection === 'complete' && value.outcome === 'ordinary' ? 0 : 1)) return false;
    if (value.cleanup?.child === 'exited' && value.cleanup.childExitCode !== 0) return false;
    return exactKeys(value, ['schemaVersion', 'kind', 'provenance', 'collection', 'outcome', 'processExitCode', 'cases', 'cleanup', 'errno']) && value.kind === 'observer_diagnostic' && ['complete', 'failed', 'timed_out', 'unreached'].includes(value.collection) && ['ordinary', 'anomalous', 'unavailable'].includes(value.outcome) && [0, 1, 'unavailable'].includes(value.processExitCode) && codeValid(value.errno) && Array.isArray(value.cases) && value.cases.length === 2 && value.cases.every((item, i) => caseValid(item) && item.name === caseNames[i]) && exactKeys(value.cleanup, ['files', 'child', 'childExitCode']) && ['removed', 'failed', 'unreached'].includes(value.cleanup.files) && ['exited', 'failed', 'unreached'].includes(value.cleanup.child) && codeValid(value.cleanup.childExitCode) && (value.collection !== 'complete' || (value.cases.every(item => item.observer.status === 'collected' && item.inputsUnchanged) && value.cleanup.files === 'removed' && value.cleanup.child === 'exited'));
  } catch { return false; }
}

const initialDiagnostic = provenance => ({ schemaVersion: 1, kind: 'observer_diagnostic', provenance, collection: 'unreached', outcome: 'unavailable', processExitCode: 'unavailable', cases: caseNames.map(unavailableCase), cleanup: { files: 'unreached', child: 'unreached', childExitCode: 'unavailable' }, errno: 'unavailable' });
const initialTests = provenance => ({ schemaVersion: 1, kind: 'focused_tests', provenance, status: 'unreached', exitCode: 'unavailable', errno: 'unavailable' });

export async function collectObserverDiagnostics({ provenance, fixtureParent = tmpdir() } = {}) {
  if (!provenanceValid(provenance)) throw new Error('Invalid diagnostic provenance');
  const evidence = initialDiagnostic(provenance);
  let root, child, childExit, closed;
  try {
    root = realpathSync(mkdtempSync(join(fixtureParent, 'observer-evidence-')));
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    child = spawn(process.execPath, ['-e', "const timer=setTimeout(()=>process.exit(1),7000);process.on('message',value=>{if(value==='stop'){clearTimeout(timer);process.exit(0)}});process.send('ready')"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env });
    closed = new Promise(resolve => child.once('close', code => { childExit = code; resolve(); }));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child readiness unavailable')), 1000);
      const finish = callback => value => { clearTimeout(timer); callback(value); };
      child.once('message', finish(value => value === 'ready' ? resolve() : reject(new Error('Invalid readiness'))));
      child.once('error', finish(reject));
      child.once('exit', finish(() => reject(new Error('Child exited before readiness'))));
    });
    for (const [index, pid] of [process.pid, child.pid].entries()) {
      const dir = realpathSync(mkdirCase(root, caseNames[index]));
      const state = { version: 1, runId: 'fixture-run', executionId: 'fixture-execution', runDirectory: dir, worktree: dir, status: 'running', phase: 'execute', lastExit: null, nextAction: 'Wait' };
      const lock = { pid, token: 'fixture-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
      writeFileSync(join(dir, 'current.json'), JSON.stringify(state));
      writeFileSync(join(dir, 'executor.lock'), JSON.stringify(lock));
      writeFileSync(join(dir, 'full.log'), '');
      try { evidence.cases[index] = { name: caseNames[index], ...await inspectObserverFixture({ source: { kind: 'runner', dir, log: join(dir, 'full.log') }, cursor: join(dir, 'observer.json'), ownedPid: pid }) }; }
      catch (error) { evidence.cases[index].observer = emptyObserver('error', numericCode(error.errno)); }
    }
    evidence.collection = evidence.cases.every(item => item.observer.status === 'collected' && item.inputsUnchanged) ? 'complete' : 'failed';
  } catch (error) { evidence.collection = 'failed'; evidence.errno = numericCode(error.errno); }
  finally {
    if (child) {
      try {
        if (child.connected) child.send('stop', () => {});
        if (!await settledWithin(closed, 1000)) { child.kill('SIGKILL'); await settledWithin(closed, 1000); }
        evidence.cleanup.childExitCode = numericCode(childExit);
        evidence.cleanup.child = childExit === 0 ? 'exited' : 'failed';
      } catch { evidence.cleanup.child = 'failed'; }
    }
    if (root) {
      try { rmSync(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 20 }); evidence.cleanup.files = 'removed'; }
      catch { evidence.cleanup.files = 'failed'; }
    }
  }
  if (evidence.cleanup.files !== 'removed' || evidence.cleanup.child !== 'exited') evidence.collection = 'failed';
  evidence.outcome = evidence.cases.every(item => item.observer.status === 'collected') ? (evidence.cases.every(item => item.observer.reason === 'deadline' && item.observer.ownership === 'identified') ? 'ordinary' : 'anomalous') : 'unavailable';
  evidence.processExitCode = evidence.collection === 'complete' && evidence.outcome === 'ordinary' ? 0 : 1;
  return evidence;
}

function mkdirCase(root, name) { const dir = join(root, name); mkdirSync(dir); return dir; }
async function settledWithin(promise, ms) {
  let timer;
  try { return await Promise.race([promise.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), ms); })]); }
  finally { clearTimeout(timer); }
}

function writeEvidence(output, evidence) {
  if (!validateEvidence(evidence)) throw new Error('Invalid finite evidence');
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, JSON.stringify(evidence) + '\n');
}
function environmentProvenance() {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) throw new Error('Checkout provenance mismatch');
  const value = { sha, runId: process.env.GITHUB_RUN_ID ?? 'local', attempt: Number(process.env.GITHUB_RUN_ATTEMPT ?? 1), matrix: process.env.OBSERVER_MATRIX ?? 'local', platform: process.platform, nodeVersion: process.version };
  if (!provenanceValid(value)) throw new Error('Invalid provenance');
  return value;
}

async function main() {
  const [mode, flag, output, ...extra] = process.argv.slice(2);
  if (flag !== '--output' || !output || extra.length || !['diagnostic', 'tests', 'prepare', 'validate'].includes(mode)) throw new Error('Invalid diagnostic command');
  const provenance = environmentProvenance();
  if (mode === 'prepare') {
    writeEvidence(join(output, 'diagnostic.json'), initialDiagnostic(provenance));
    writeEvidence(join(output, 'test-status.json'), initialTests(provenance));
  } else if (mode === 'validate') {
    for (const name of ['diagnostic.json', 'test-status.json']) {
      const value = JSON.parse(readFileSync(join(output, name), 'utf8'));
      const expectedKind = name === 'diagnostic.json' ? 'observer_diagnostic' : 'focused_tests';
      if (!validateEvidence(value) || value.kind !== expectedKind || JSON.stringify(value.provenance) !== JSON.stringify(provenance) || (name === 'diagnostic.json' ? value.collection === 'unreached' : value.status === 'unreached')) throw new Error('Missing or invalid evidence');
    }
  } else if (mode === 'diagnostic') {
    // Supervisor owns the worker's disposable parent. Even a stalled collector
    // is killed and its files removed; the owned grandchild self-expires at 7s.
    const parent = mkdtempSync(join(tmpdir(), 'observer-supervisor-'));
    let evidence = initialDiagnostic(provenance), result, timedOut = false;
    const worker = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const closed = new Promise(resolve => worker.once('close', resolve));
    const hardStop = setTimeout(() => { worker.kill('SIGKILL'); }, 12000);
    try {
      result = await new Promise(resolve => {
        const timer = setTimeout(() => { timedOut = true; worker.kill('SIGKILL'); resolve(null); }, 10000);
        const finish = value => { clearTimeout(timer); resolve(value); };
        worker.once('message', finish); worker.once('error', () => finish(null)); worker.once('exit', () => finish(null));
        worker.send({ provenance, fixtureParent: parent });
      });
      if (validateEvidence(result) && JSON.stringify(result.provenance) === JSON.stringify(provenance)) evidence = result;
      else { evidence.collection = timedOut ? 'timed_out' : 'failed'; evidence.processExitCode = 1; }
      if (!await settledWithin(closed, 1000)) { worker.kill('SIGKILL'); await settledWithin(closed, 500); }
    } finally {
      clearTimeout(hardStop);
      try { rmSync(parent, { recursive: true, force: true, maxRetries: 2, retryDelay: 20 }); evidence.cleanup.files = 'removed'; }
      catch { evidence.cleanup.files = 'failed'; evidence.collection = 'failed'; evidence.processExitCode = 1; }
    }
    writeEvidence(output, evidence);
    process.stdout.write(JSON.stringify(evidence) + '\n');
    process.exitCode = evidence.processExitCode;
  } else {
    const evidence = initialTests(provenance);
    writeEvidence(output, evidence);
    // POSIX descendants inherit this owned process group. On Windows, taskkill
    // selects the tree by the still-owned supervisor PID instead.
    const child = spawn(process.execPath, ['--test', 'tests/ralphex-observe.test.mjs', 'tests/ralphex-run.test.mjs', 'tests/windows-observer-diagnostics.test.mjs'], { stdio: 'inherit', detached: process.platform !== 'win32', windowsHide: true });
    let timedOut = false, code, timer;
    const closed = new Promise(resolve => {
      child.once('error', error => { evidence.errno = numericCode(error.errno); });
      child.once('close', value => { code = value; resolve(); });
    });
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { timeout: 3000, stdio: 'ignore', windowsHide: true });
          else process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          evidence.errno = numericCode(error.errno);
          try { child.kill('SIGKILL'); } catch { /* Preserve timeout even if cleanup fails. */ }
        }
        resolve();
      }, 90000);
    });
    await Promise.race([closed, deadline]);
    clearTimeout(timer);
    if (timedOut && !await settledWithin(closed, 1500)) child.unref();
    evidence.exitCode = numericCode(code);
    evidence.status = timedOut ? 'timed_out' : code === 0 ? 'passed' : 'failed';
    writeEvidence(output, evidence);
    process.exitCode = timedOut || code !== 0 ? (Number.isInteger(code) && code > 0 && code <= 255 ? code : 1) : 0;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--worker' && process.send) {
    process.once('message', async options => {
      try { const evidence = await collectObserverDiagnostics(options); process.send(evidence, () => process.disconnect()); }
      catch { process.disconnect(); process.exitCode = 1; }
    });
  } else {
    try { await main(); }
    catch { process.stderr.write('Observer diagnostic failed: missing or invalid finite evidence\n'); process.exitCode = 1; }
  }
}
