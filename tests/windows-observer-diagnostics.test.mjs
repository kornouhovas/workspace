import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpath } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const provenance = { sha: 'a'.repeat(40), runId: 'local', attempt: 1, matrix: 'local', platform: process.platform, nodeVersion: process.version };

test('raw sync/async inequality alone permits ordinary evidence while canonical identity failures do not', async () => {
  const { collectObserverDiagnostics, validateEvidence } = await import('../scripts/windows-observer-diagnostics.mjs');
  const evidence = await collectObserverDiagnostics({ provenance });
  assert.equal(evidence.outcome, 'ordinary');
  for (const item of evidence.cases) {
    item.identity.directorySyncAsyncEqual = false;
    item.identity.logSyncAsyncEqual = false;
  }
  // Controlled finite-artifact validation, not a Windows filesystem reproduction.
  assert.equal(validateEvidence(evidence), true);
  for (const key of ['stateDirectoryMatchesSource', 'lockDirectoryMatchesSource', 'observerSourceDirectoryEqual', 'observerSourceLogEqual', 'lockPidMatchesOwnedProcess', 'lockTokenValid']) {
    const invalid = structuredClone(evidence);
    invalid.cases[0].identity[key] = false;
    assert.equal(validateEvidence(invalid), false, key);
  }
});

test('public diagnostic retains real ownership uncertainty without exposing or changing runner inputs', async t => {
  const { inspectObserverFixture } = await import('../scripts/windows-observer-diagnostics.mjs');
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'observer-diagnostic-private-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = { version: 1, runId: 'private-run', executionId: 'private-execution', runDirectory: `${dir}-foreign`, worktree: dir, status: 'running' };
  const lock = { pid: process.pid, token: 'private-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
  const files = ['current.json', 'executor.lock', 'full.log'];
  [state, lock, 'private-log-content'].forEach((value, i) => writeFileSync(join(dir, files[i]), typeof value === 'string' ? value : JSON.stringify(value)));
  const before = files.map(file => readFileSync(join(dir, file)));
  const evidence = await inspectObserverFixture({ source: { kind: 'runner', dir, log: join(dir, 'full.log') }, cursor: join(dir, 'observer.json') });
  assert.equal(evidence.observer.status, 'collected');
  assert.equal(evidence.observer.reason, 'ownership_unknown');
  assert.equal(evidence.observer.ownership, 'unknown');
  assert.equal(evidence.identity.stateDirectoryMatchesSource, false);
  assert.equal(evidence.identity.lockPidMatchesOwnedProcess, true);
  assert.equal(evidence.inputsUnchanged, true);
  assert.deepEqual(files.map(file => readFileSync(join(dir, file))), before);
  const output = JSON.stringify(evidence);
  for (const secret of [dir, String(process.pid), 'private-run', 'private-execution', 'private-token', 'private-log-content']) assert.ok(!output.includes(secret));
  assert.ok(Buffer.byteLength(output) < 12 * 1024);
});

test('public diagnostic compares observer identities to synchronous publication and retains raw filesystem comparisons', async t => {
  const { inspectObserverFixture } = await import('../scripts/windows-observer-diagnostics.mjs');
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'diagnostic-canonical-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = { version: 1, runId: 'fixture-run', executionId: 'fixture-execution', runDirectory: dir, worktree: dir, status: 'running' };
  const lock = { pid: process.pid, token: 'fixture-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
  writeFileSync(join(dir, 'current.json'), JSON.stringify(state));
  writeFileSync(join(dir, 'executor.lock'), JSON.stringify(lock));
  const log = join(dir, 'full.log'); writeFileSync(log, '');
  const evidence = await inspectObserverFixture({ source: { kind: 'runner', dir, log }, cursor: join(dir, 'observer.json') });
  assert.equal(evidence.observer.reason, 'deadline');
  assert.equal(evidence.observer.ownership, 'identified');
  assert.equal(evidence.identity.directorySyncAsyncEqual, dir === await realpath(dir));
  assert.equal(evidence.identity.logSyncAsyncEqual, realpathSync(log) === await realpath(log));
  for (const key of ['stateDirectoryMatchesSource', 'lockDirectoryMatchesSource', 'observerSourceDirectoryEqual', 'observerSourceLogEqual']) assert.equal(evidence.identity[key], true, key);
  assert.equal(evidence.inputsUnchanged, true);
});

test('two fixed cases collect finite private evidence and remove only their own fixture and child', async t => {
  const { collectObserverDiagnostics, validateEvidence, environmentProvenance, retainObserverCall } = await import('../scripts/windows-observer-diagnostics.mjs');
  const parent = mkdtempSync(join(tmpdir(), 'diagnostic-parent-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  writeFileSync(join(parent, 'unrelated'), 'preserve');
  const evidence = await collectObserverDiagnostics({ provenance: environmentProvenance(), fixtureParent: parent });
  retainObserverCall(process.env.WORKSPACE_OBSERVER_CALL_EVIDENCE_DIR, evidence);
  assert.equal(evidence.collection, 'complete');
  assert.deepEqual(evidence.cases.map(item => item.name), ['current_process', 'owned_child']);
  for (const item of evidence.cases) {
    assert.equal(item.observer.status, 'collected');
    assert.equal(item.observer.reason, 'deadline');
    assert.equal(item.observer.ownership, 'identified');
    assert.equal(item.inputsUnchanged, true);
    assert.ok(Object.values(item.identity).every(value => typeof value === 'boolean'));
  }
  assert.equal(evidence.cleanup.files, 'removed');
  assert.equal(evidence.outcome, 'ordinary');
  assert.equal(evidence.cleanup.child, 'exited');
  assert.equal(evidence.cleanup.childExitCode, 0);
  assert.deepEqual(readdirSync(parent), ['unrelated']);
  assert.equal(validateEvidence(evidence), true);
  assert.ok(Buffer.byteLength(JSON.stringify(evidence)) <= 12 * 1024);
  assert.ok(!JSON.stringify(evidence).includes(parent));
});

test('CLI writes one bounded provenance document and rejects invalid evidence without leaking values', t => {
  const dir = mkdtempSync(join(tmpdir(), 'diagnostic-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'diagnostic.json');
  const result = spawnSync(process.execPath, ['scripts/windows-observer-diagnostics.mjs', 'diagnostic', '--output', output], { encoding: 'utf8', timeout: 16000, env: { ...process.env, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', OBSERVER_MATRIX: 'local', PRIVATE_DIAGNOSTIC_SECRET: 'do-not-publish' } });
  assert.equal(result.error, undefined);
  assert.ok([0, 1].includes(result.status));
  const evidence = JSON.parse(result.stdout);
  assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), evidence);
  assert.equal(evidence.provenance.runId, '123');
  assert.equal(evidence.provenance.attempt, 2);
  assert.match(evidence.provenance.sha, /^[a-f0-9]{40}$/);
  assert.equal(evidence.provenance.nodeVersion, process.version);
  assert.equal(evidence.processExitCode, result.status);
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes('do-not-publish'));
});

test('strict artifact validation rejects private fields, invalid codes and forged passing statuses', async () => {
  const { collectObserverDiagnostics, validateEvidence } = await import('../scripts/windows-observer-diagnostics.mjs');
  const evidence = await collectObserverDiagnostics({ provenance });
  for (const change of [
    value => { value.cases[0].observer.diagnosticCode = 'private-error-message'; },
    value => { value.cases[0].observer.stack = 'private-stack'; },
    value => { value.cases[0].observer.status = 'invalid_result'; },
    value => { value.cases[0].identity.lockTokenValid = 'private-token'; },
    value => { value.cleanup.childExitCode = 65536; },
    value => { value.provenance.sha = [provenance.sha]; },
    value => { value.outcome = 'ordinary'; value.cases[0].observer.reason = 'ownership_unknown'; },
  ]) {
    const invalid = structuredClone(evidence); change(invalid);
    assert.equal(validateEvidence(invalid), false);
  }
  const status = { schemaVersion: 1, kind: 'focused_tests', provenance, status: 'passed', exitCode: 7, errno: 'unavailable' };
  assert.equal(validateEvidence(status), false);
  assert.equal(validateEvidence({ ...status, status: 'failed' }), true);
  assert.equal(validateEvidence({ ...status, status: 'timed_out', exitCode: 'unavailable' }), true);
  assert.equal(validateEvidence({ ...status, status: 'unreached', exitCode: 'unavailable' }), true);
});

test('real observer access errors and cursor rejection retain finite codes without exception text', async t => {
  const { inspectObserverFixture } = await import('../scripts/windows-observer-diagnostics.mjs');
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'diagnostic-error-private-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = { version: 99, runId: 'private-run', executionId: 'private-execution', runDirectory: dir, worktree: dir, status: 'running' };
  const lock = { pid: process.pid, token: 'private-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
  writeFileSync(join(dir, 'current.json'), JSON.stringify(state));
  writeFileSync(join(dir, 'executor.lock'), JSON.stringify(lock));
  writeFileSync(join(dir, 'full.log'), '');
  const options = { source: { kind: 'runner', dir, log: join(dir, 'full.log') }, cursor: join(dir, 'observer.json') };
  const access = await inspectObserverFixture(options);
  assert.equal(access.observer.reason, 'access_lost');
  assert.equal(access.observer.diagnosticCode, 'access_lost');
  assert.equal(access.inputsUnchanged, true);
  writeFileSync(`${options.cursor}.lock`, 'private-conflicting-lock');
  const rejected = await inspectObserverFixture(options);
  assert.equal(rejected.observer.status, 'error');
  assert.ok(Number.isSafeInteger(rejected.observer.errno));
  assert.equal(rejected.inputsUnchanged, true);
  const output = JSON.stringify([access, rejected]);
  for (const secret of [dir, 'private-token', 'Unsupported runner snapshot version', 'EEXIST', 'stack']) assert.ok(!output.includes(secret));
});

test('prepared unreached or missing CI evidence stays failed instead of passing artifact validation', t => {
  const dir = mkdtempSync(join(tmpdir(), 'diagnostic-status-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const command = mode => spawnSync(process.execPath, ['scripts/windows-observer-diagnostics.mjs', mode, '--output', dir], { encoding: 'utf8', timeout: 5000 });
  assert.equal(command('prepare').status, 0);
  assert.equal(JSON.parse(readFileSync(join(dir, 'test-status.json'), 'utf8')).status, 'unreached');
  assert.equal(command('validate').status, 1);
  rmSync(join(dir, 'diagnostic.json'));
  assert.equal(command('validate').status, 1);
  const invalid = spawnSync(process.execPath, ['scripts/windows-observer-diagnostics.mjs', 'diagnostic', '--output', join(dir, 'bad.json')], { encoding: 'utf8', timeout: 5000, env: { ...process.env, GITHUB_SHA: 'private-provenance-value' } });
  assert.equal(invalid.status, 1);
  assert.ok(!invalid.stderr.includes('private-provenance-value'));
  assert.equal(invalid.stdout, '');
});

test('CLI validation requires the diagnostic and focused-test document kinds at their selected paths', async t => {
  const { collectObserverDiagnostics } = await import('../scripts/windows-observer-diagnostics.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'diagnostic-kind-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const command = mode => spawnSync(process.execPath, ['scripts/windows-observer-diagnostics.mjs', mode, '--output', dir], { encoding: 'utf8', timeout: 5000 });
  assert.equal(command('prepare').status, 0);
  const tests = JSON.parse(readFileSync(join(dir, 'test-status.json'), 'utf8'));
  tests.status = 'failed'; tests.exitCode = 1;
  const diagnostic = await collectObserverDiagnostics({ provenance: tests.provenance });
  const writePair = (first, second) => {
    writeFileSync(join(dir, 'diagnostic.json'), JSON.stringify(first));
    writeFileSync(join(dir, 'test-status.json'), JSON.stringify(second));
  };
  writePair(diagnostic, tests);
  assert.equal(command('validate').status, 0, 'finite failed test evidence remains valid');
  for (const pair of [[tests, tests], [diagnostic, diagnostic], [tests, diagnostic]]) {
    writePair(...pair);
    assert.equal(command('validate').status, 1, 'duplicate or swapped document kinds must fail');
  }
});

test('two-second observation timeout is retained and releases the observer-owned cursor lock', async t => {
  const { inspectObserverFixture } = await import('../scripts/windows-observer-diagnostics.mjs');
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'diagnostic-timeout-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = { version: 1, runId: 'private-run', executionId: 'private-execution', runDirectory: dir, worktree: dir, status: 'running' };
  const lock = { pid: process.pid, token: 'private-token', runId: state.runId, executionId: state.executionId, runDirectory: dir, worktree: dir };
  writeFileSync(join(dir, 'current.json'), JSON.stringify(state));
  writeFileSync(join(dir, 'executor.lock'), JSON.stringify(lock));
  writeFileSync(join(dir, 'full.log'), '');
  const cursor = join(dir, 'observer.json'), start = Date.now();
  const evidence = await inspectObserverFixture({ source: { kind: 'runner', dir, log: join(dir, 'full.log') }, cursor, budgetMs: 2000 });
  assert.equal(evidence.observer.status, 'timed_out');
  assert.equal(evidence.observer.reason, 'unavailable');
  assert.ok(Date.now() - start < 3000);
  assert.equal(evidence.inputsUnchanged, true);
  assert.equal(existsSync(`${cursor}.lock`), false);
});

test('CI test command preserves a real failed Node test exit in the finite status artifact', t => {
  const dir = mkdtempSync(join(tmpdir(), 'diagnostic-test-exit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  mkdirSync(join(dir, 'tests'));
  for (const name of ['ralphex-observe', 'ralphex-run', 'windows-observer-diagnostics']) {
    writeFileSync(join(dir, 'tests', `${name}.test.mjs`), name === 'ralphex-observe' ? "import test from 'node:test'; test('controlled failure', () => { throw new Error('private-failure'); });" : '');
  }
  git('add', 'tests');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'fixture');
  const output = join(dir, 'test-status.json');
  const env = { ...process.env };
  for (const key of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'OBSERVER_MATRIX', 'NODE_TEST_CONTEXT']) delete env[key];
  const script = fileURLToPath(new URL('../scripts/windows-observer-diagnostics.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'tests', '--output', output], { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const evidence = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.exitCode, 1);
  assert.ok(!JSON.stringify(evidence).includes('private-failure'));
});

test('CI test timeout loads a preload with spaces and a fragment character, stops its owned test tree and retains a finite failed status', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'diagnostic-test-timeout-'));
  const pids = [];
  t.after(() => {
    for (const pid of pids) {
      try {
        if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: 3000, stdio: 'ignore' });
        else process.kill(pid, 'SIGKILL');
      } catch { /* The owned child may already be gone. */ }
    }
    rmSync(dir, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  mkdirSync(join(dir, 'tests'));
  for (const name of ['ralphex-observe', 'ralphex-run', 'windows-observer-diagnostics']) {
    writeFileSync(join(dir, 'tests', `${name}.test.mjs`), name === 'ralphex-observe'
      ? `import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const descendant = spawn(process.execPath, ['-e', "require('node:fs').writeFileSync('owned-descendant.pid', String(process.pid)); process.send('ready'); setInterval(() => {}, 1000);"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
descendant.once('message', value => { if (value === 'ready') writeFileSync('owned-child.pid', String(process.pid)); });
setInterval(() => {}, 1000);`
      : '');
  }
  git('add', 'tests');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'fixture');
  // Shorten only the CLI's production deadline; run the real Node test tree.
  const preload = join(dir, 'short deadline #.mjs');
  writeFileSync(preload, 'const timer = globalThis.setTimeout; globalThis.setTimeout = (fn, ms, ...args) => timer(fn, ms === 90000 ? 1500 : ms, ...args);');
  const env = { ...process.env };
  for (const key of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'OBSERVER_MATRIX', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS']) delete env[key];
  const script = fileURLToPath(new URL('../scripts/windows-observer-diagnostics.mjs', import.meta.url));
  const output = join(dir, 'test-status.json');
  const start = Date.now();
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, script, 'tests', '--output', output], { cwd: dir, env, encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 });
  const markers = ['owned-child.pid', 'owned-descendant.pid'].map(name => join(dir, name));
  // Inspect launcher and startup evidence before any PID-marker read. Keep
  // assertion diagnostics finite; raw child stderr may contain private paths.
  const startup = JSON.stringify({
    spawnError: result.error?.code ?? 'unavailable', exitStatus: result.status,
    signal: result.signal ?? 'unavailable', stderrBytes: Buffer.byteLength(result.stderr ?? ''),
    stderrCode: result.stderr?.match(/ERR_[A-Z_]+/)?.[0] ?? 'unavailable',
    statusAvailable: existsSync(output), pidMarkersAvailable: markers.map(marker => existsSync(marker)),
  });
  for (const marker of markers) {
    if (existsSync(marker)) {
      const pid = Number(readFileSync(marker, 'utf8'));
      assert.ok(Number.isSafeInteger(pid) && pid > 0, 'owned tree PID marker must be valid');
      pids.push(pid);
    }
  }
  assert.equal(Boolean(result.error), false, startup);
  assert.equal(result.signal, null, startup);
  assert.equal(result.status, 1, startup);
  assert.equal(existsSync(output), true, startup);
  const evidence = JSON.parse(readFileSync(output, 'utf8'));
  const { validateEvidence } = await import('../scripts/windows-observer-diagnostics.mjs');
  assert.equal(validateEvidence(evidence), true, 'timeout status must retain the strict finite schema');
  assert.ok(Buffer.byteLength(JSON.stringify(evidence)) <= 12 * 1024);
  assert.equal(evidence.status, 'timed_out');
  assert.notEqual(evidence.exitCode, 0);
  assert.equal(pids.length, 2, startup);
  assert.equal(new Set(pids).size, 2, 'test child and descendant must both have started');
  assert.ok(Date.now() - start < 10000, 'fixture timeout and cleanup must remain bounded');
  const stopped = pid => {
    try { process.kill(pid, 0); return false; }
    catch (error) { return error.code === 'ESRCH'; }
  };
  const deadline = Date.now() + 1000;
  while (!pids.every(stopped) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(pids.every(stopped), true, 'owned test child and descendant must stop before timeout handoff');
});


test('per-call retention preserves failed collection and rejects absent, malformed, private or foreign evidence', async t => {
  const { collectObserverDiagnostics, environmentProvenance, retainObserverCall, validateObserverCall } = await import('../scripts/windows-observer-diagnostics.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'observer-call-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'collector.json');
  assert.throws(() => validateObserverCall(dir));
  const failed = await collectObserverDiagnostics({ provenance: environmentProvenance(), fixtureParent: join(dir, 'absent') });
  assert.equal(failed.collection, 'failed');
  retainObserverCall(dir, failed);
  assert.deepEqual(validateObserverCall(dir), failed);
  const validate = () => spawnSync(process.execPath, ['scripts/windows-observer-diagnostics.mjs', 'validate-call', '--output', dir], { encoding: 'utf8', timeout: 5000 });
  assert.equal(validate().status, 0, 'validated failed collection is uploadable, not a passing test');

  assert.equal(failed.processExitCode, 1);
  writeFileSync(join(dir, 'unrelated'), 'preserve');
  for (const mutate of [
    value => { value.pid = process.pid; },
    value => { value.cases[0].observer.error = 'private-path-token'; },
    value => { value.provenance.sha = 'b'.repeat(40); },
    value => { value.provenance.runId = '999'; },
    value => { value.provenance.attempt += 1; },
    value => { value.provenance.matrix = value.provenance.matrix === 'windows-latest' ? 'windows-2022' : 'windows-latest'; },
    value => { value.provenance.platform = 'foreign'; },
    value => { value.provenance.nodeVersion = 'v1.0.0'; },
    value => { value.collection = 'unreached'; value.processExitCode = 'unavailable'; },
  ]) {
    const invalid = structuredClone(failed); mutate(invalid);
    assert.throws(() => retainObserverCall(dir, invalid));
    writeFileSync(file, JSON.stringify(invalid));
    assert.throws(() => validateObserverCall(dir));
    const rejected = validate();
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stdout, '');
    assert.equal(rejected.stderr, 'Observer diagnostic failed: missing or invalid finite evidence\n');
  }
  for (const raw of ['{', ' '.repeat(12 * 1024 + 1)]) {
    writeFileSync(file, raw);
    assert.throws(() => validateObserverCall(dir));
  }
  retainObserverCall(dir, failed);
  assert.deepEqual(readdirSync(dir).sort(), ['collector.json', 'unrelated']);
  assert.equal(readFileSync(join(dir, 'unrelated'), 'utf8'), 'preserve');
  assert.equal(retainObserverCall(undefined, failed), undefined);
});


const injections = {
  readiness: `const original = cp.spawn; cp.spawn = (exe, args, options) => original(exe, args.map(arg => arg.replace("process.send('ready')", "process.send('invalid')")), options);`,
  child_cleanup: `const original = cp.spawn; cp.spawn = (exe, args, options) => original(exe, args.map(arg => arg.replace('process.exit(0)', 'process.exit(1)')), options);`,
  case: `const original = fs.readFileSync; fs.readFileSync = (file, ...args) => { if (String(file).endsWith('/current_process/current.json') || String(file).endsWith('\\\\current_process\\\\current.json')) throw Object.assign(new Error('private-path-token'), { errno: -13 }); return original(file, ...args); };`,
  file_cleanup: `const original = fs.rmSync; fs.rmSync = (file, ...args) => { if (String(file).includes('observer-evidence-')) throw Object.assign(new Error('private-path-token'), { errno: -13 }); return original(file, ...args); };`,
};

test('generated case injection rejects POSIX and Windows collector paths without affecting other reads', () => {
  const fs = { readFileSync: () => 'preserved' };
  runInNewContext(injections.case, { fs });
  for (const file of ['/fixture/current_process/current.json', String.raw`C:\fixture\current_process\current.json`]) {
    assert.throws(() => fs.readFileSync(file), error => error.errno === -13);
  }
  for (const file of ['/fixture/owned_child/current.json', String.raw`C:\fixture\owned_child\current.json`]) {
    assert.equal(fs.readFileSync(file), 'preserved');
  }
});

for (const boundary of ['readiness', 'case', 'child_cleanup', 'file_cleanup']) {
  test(`injected ${boundary} failure retains its lifecycle boundary and preserves unrelated fixtures`, async t => {
    const { validateEvidence, environmentProvenance } = await import('../scripts/windows-observer-diagnostics.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'observer-boundary-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(join(dir, 'unrelated'), 'preserve');
    const preload = join(dir, 'inject.mjs');
    writeFileSync(preload, `import fs from 'node:fs'; import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module'; ${injections[boundary]} syncBuiltinESMExports();`);
    const module = new URL('../scripts/windows-observer-diagnostics.mjs', import.meta.url).href;
    const code = `import { collectObserverDiagnostics, environmentProvenance } from ${JSON.stringify(module)}; const evidence = await collectObserverDiagnostics({ provenance: environmentProvenance(), fixtureParent: ${JSON.stringify(dir)} }); console.log(JSON.stringify(evidence)); process.exitCode = evidence.processExitCode;`;
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, '--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    const evidence = JSON.parse(result.stdout);
    assert.equal(validateEvidence(evidence), true);
    assert.deepEqual(evidence.provenance, environmentProvenance());
    assert.equal(evidence.collection, 'failed');
    assert.equal(evidence.processExitCode, 1);
    assert.equal(evidence.cleanup.child, boundary === 'child_cleanup' ? 'failed' : 'exited');
    assert.equal(evidence.cleanup.files, boundary === 'file_cleanup' ? 'failed' : 'removed');
    assert.deepEqual(evidence.cases.map(item => item.observer.status), boundary === 'readiness' ? ['unreached', 'unreached'] : boundary === 'case' ? ['error', 'collected'] : ['collected', 'collected']);
    assert.equal(readFileSync(join(dir, 'unrelated'), 'utf8'), 'preserve');
    assert.equal(result.stderr, '');
    assert.ok(!result.stdout.includes(dir));
    assert.ok(!result.stdout.includes('private-path-token'));
    if (boundary !== 'file_cleanup') assert.equal(readdirSync(dir).some(name => name.startsWith('observer-evidence-')), false);
    if (process.env.WORKSPACE_OBSERVER_PROBE_EVIDENCE_DIR) {
      mkdirSync(process.env.WORKSPACE_OBSERVER_PROBE_EVIDENCE_DIR, { recursive: true });
      writeFileSync(join(process.env.WORKSPACE_OBSERVER_PROBE_EVIDENCE_DIR, `${boundary}.json`), JSON.stringify({ kind: 'injected-symptom', actualExit: result.status, unrelatedPreserved: true, evidence }) + '\n');
    }
  });
}

function fullSuiteJob(workflow) {
  workflow = workflow.replace(/\r\n/g, '\n');
  const marker = '\n  verify:\n';
  assert.equal(workflow.split(marker).length, 2, 'One actual full verify job is required');
  const start = workflow.indexOf(marker) + 1;
  const remainder = workflow.slice(start);
  const next = remainder.slice(1).search(/\n {2}[a-zA-Z0-9_-]+:\n/);
  return next < 0 ? remainder : remainder.slice(0, next + 1);
}
function assertFullSuiteWorkflow(workflow) {
  workflow = fullSuiteJob(workflow);
  assert.match(workflow, /- run: npm run test:platform\n {8}env:\n {10}OBSERVER_MATRIX: \$\{\{ matrix.os \}\}\n {10}WORKSPACE_OBSERVER_CALL_EVIDENCE_DIR: work\/ci-observer-full-suite/);
  assert.match(workflow, /id: observer-call-validation\n {8}if: always\(\)\n {8}run: node scripts\/windows-observer-diagnostics.mjs validate-call --output work\/ci-observer-full-suite\n {8}env:\n {10}OBSERVER_MATRIX: \$\{\{ matrix.os \}\}/);
  assert.match(workflow, /if: \$\{\{ always\(\) && steps.observer-call-validation.outcome == 'success' \}\}/);
  assert.match(workflow, /path: work\/ci-observer-full-suite\/collector.json\n {10}if-no-files-found: error/);
}

for (const [format, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`full-suite workflow validates one exact collector file before always-upload without replacing npm run test:platform (${format})`, () => {
    const workflow = readFileSync(new URL('../.github/workflows/desktop-ci.yml', import.meta.url), 'utf8').replace(/\r?\n/g, eol);
    assertFullSuiteWorkflow(workflow);
  });
}

const workflowMutations = [
  ['npm run test:platform command', '- run: npm run test:platform', '- run: npm run test:windows:early'],
  ['npm run test:platform matrix', '- run: npm run test:platform\n        env:\n          OBSERVER_MATRIX: ${{ matrix.os }}', '- run: npm run test:platform\n        env:\n          OBSERVER_MATRIX: local'],
  ['npm run test:platform evidence directory', 'WORKSPACE_OBSERVER_CALL_EVIDENCE_DIR: work/ci-observer-full-suite', 'WORKSPACE_OBSERVER_CALL_EVIDENCE_DIR: work/other'],
  ['validation always guard', 'id: observer-call-validation\n        if: always()', 'id: observer-call-validation\n        if: success()'],
  ['validation command', 'run: node scripts/windows-observer-diagnostics.mjs validate-call --output work/ci-observer-full-suite', 'run: node scripts/windows-observer-diagnostics.mjs validate --output work/ci-observer-full-suite'],
  ['validation matrix', 'validate-call --output work/ci-observer-full-suite\n        env:\n          OBSERVER_MATRIX: ${{ matrix.os }}', 'validate-call --output work/ci-observer-full-suite\n        env:\n          OBSERVER_MATRIX: local'],
  ['upload always guard', "always() && steps.observer-call-validation.outcome == 'success'", "success() && steps.observer-call-validation.outcome == 'success'"],
  ['upload validation outcome', "always() && steps.observer-call-validation.outcome == 'success'", "always() && steps.observer-call-validation.outcome == 'failure'"],
  ['exact collector path', 'path: work/ci-observer-full-suite/collector.json', 'path: work/ci-observer-full-suite/*.json'],
  ['missing collector error', 'path: work/ci-observer-full-suite/collector.json\n          if-no-files-found: error', 'path: work/ci-observer-full-suite/collector.json\n          if-no-files-found: warn'],
  ['missing collector policy indentation', 'path: work/ci-observer-full-suite/collector.json\n          if-no-files-found: error', 'path: work/ci-observer-full-suite/collector.json\n         if-no-files-found: error'],
];

for (const [format, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  for (const [requirement, before, after] of workflowMutations) {
    test(`full-suite workflow validates and rejects changed ${requirement} (${format})`, () => {
      const workflow = readFileSync(new URL('../.github/workflows/desktop-ci.yml', import.meta.url), 'utf8').replace(/\r?\n/g, '\n');
      const job = fullSuiteJob(workflow);
      assert.equal(job.split(before).length, 2, 'mutation must target exactly one fragment in the actual verify job');
      const mutated = workflow.replace(job, job.replace(before, after)).replace(/\n/g, eol);
      assert.throws(() => assertFullSuiteWorkflow(mutated), { code: 'ERR_ASSERTION' });
    });
  }
}
