import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { load } from 'js-yaml';
import { createCreationEvidence, recordCreationEvidence } from '../scripts/runtime-evidence.mjs';
import { productDiagnosticSnapshot, validateProductDiagnostic } from '../scripts/windows-product-diagnostics.mjs';

const privateText = 'C:\\private\\秘密\\do-not-record';
const config = { enabled: true, platform: 'win32', mode: 'dev', selectedMode: 'direct', selectedCheckpoint: 'after_evidence',
  args: ['dev', '--discovery-mode=direct', '--checkpoint=after_evidence'] };
const metadata = { codeSha: '4ac402620dd8139bdef9ff03625aae64bf60e132', platform: 'win32',
  architecture: 'x64', nodeVersion: '22.21.1', osRelease: '10.0.26100', private: privateText };
const com = (selected) => ({ exactParentFound: true, targetPresent: true, selectedTargetMatch: selected,
  exactParentCount: 1, errorCount: 0, errors: [], private: privateText });
const ui = (selected) => ({ stage: selected ? 'selected' : 'unselected', windowVerified: true, targetVerified: true,
  selected, code: null, private: privateText });
const snapshot = (evidence, extra = {}) => productDiagnosticSnapshot({ metadata, evidence, runtime: { electron: '44.7.0', node: '24.21.0' }, ...extra });

test('diagnostic opt-in requires exactly one existing native product scenario', () => {
  assert.doesNotThrow(() => validateProductDiagnostic(config));
  assert.doesNotThrow(() => validateProductDiagnostic({ enabled: false }));
  for (const extra of [{ platform: 'darwin' }, { mode: 'release' }, { selectedMode: 'grouped' },
    { selectedCheckpoint: undefined }, { args: [...config.args, '--skip-native'] }, { args: [...config.args, privateText] }]) {
    assert.throws(() => validateProductDiagnostic({ ...config, ...extra }), /single direct/);
  }
});

for (const [selected, independent, agreement] of [[true, true, 'agree'], [false, false, 'agree'],
  [false, true, 'disagree'], [true, false, 'disagree'], [false, null, 'unavailable']]) {
  test(`strict product artifact preserves COM ${selected} and independent ${independent}`, () => {
    const evidence = createCreationEvidence();
    recordCreationEvidence(evidence, 'direct', 'nativeInvocation', { status: 'passed', asserted: true, target: privateText });
    const outcome = { status: selected ? 'passed' : 'pending', asserted: selected, exactTargetObserved: selected,
      diagnostics: com(selected), independentSelection: independent === null ? { stage: 'pattern_unavailable', windowVerified: true, targetVerified: false, selected: null, code: null } : ui(independent),
      completion: selected ? 'exact_target' : 'deadline', elapsedMs: 10000, reason: privateText };
    outcome.attempts = [{ ...outcome, attempt: 1, timeoutMs: 5000 }];
    recordCreationEvidence(evidence, 'direct', 'fileManagerOutcome', outcome);
    const result = snapshot(evidence, { invocationCount: 1, targetMatched: true });
    assert.equal(result.observation.status, outcome.status);
    assert.equal(result.observation.com.selectedTargetMatch, selected);
    assert.equal(result.observation.independentSelection.selected, independent);
    assert.equal(result.observation.selectionAgreement, agreement);
    assert.equal(result.observation.attempts[0].selectionAgreement, agreement);
    assert.equal(result.invocation.count, 1);
    assert.equal(result.acknowledgment.status, 'unreached');
    assert.equal(result.metadata.codeSha, metadata.codeSha);
    assert.equal(JSON.stringify(result).includes(privateText), false);
  });
}

test('unavailable timeout, unknown invocation, failures and cleanup stay separate and bounded', () => {
  const evidence = createCreationEvidence();
  evidence.direct.fileManagerOutcome = { status: 'pending', completion: 'unavailable', diagnostics: { stage: 'timeout' },
    attempts: Array(101).fill({ diagnostics: { stage: 'timeout' }, private: privateText }) };
  evidence.normalShutdown = { status: 'failed', reason: privateText };
  const result = snapshot(evidence, { invocationCount: null, failed: true, finished: true,
    fileManagerCleanup: { status: 'pending', reason: privateText }, fixtureCleanup: { status: 'skipped', reason: privateText },
    shutdowns: Array(10).fill({ status: 'failed', reason: privateText }) });
  assert.equal(result.status, 'failed'); assert.equal(result.invocation.count, null);
  assert.equal(result.observation.com.stage, 'timeout'); assert.equal(result.observation.com.unavailable, true);
  assert.equal(result.observation.independentSelection.status, 'unavailable');
  assert.equal(result.observation.exactTargetObserved, false);
  assert.equal(result.observation.attempts.length, 100); assert.equal(result.shutdowns.length, 2);
  assert.equal(result.normalShutdown.status, 'failed'); assert.equal(result.restartPersistence.status, 'unreached');
  assert.equal(result.windowCleanup.closure, 'unverified'); assert.equal(result.fixtureCleanup.status, 'skipped');
  assert.equal(JSON.stringify(result).includes(privateText), false);
  const invalid = snapshot(evidence, { metadata: { codeSha: privateText, osRelease: privateText }, runtime: { node: privateText }, invocationCount: Infinity });
  assert.equal(invalid.metadata.codeSha, null); assert.equal(invalid.metadata.osRelease, null);
  assert.equal(invalid.metadata.electronNodeVersion, null); assert.equal(invalid.invocation.count, null);
});

test('fractional observation durations survive snapshots while invalid timings and fractional counts do not', () => {
  for (const elapsedMs of [0, 5123.75, 10000.125, 60000, NaN, Infinity, -1, 60000.001, '5000']) {
    const evidence = createCreationEvidence();
    evidence.direct.fileManagerOutcome = { status: 'pending', elapsedMs,
      attempts: [{ elapsedMs, attempt: 1.5, timeoutMs: 4999.5 }] };
    const result = snapshot(evidence, { invocationCount: 1.5 });
    const expected = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 60000 ? elapsedMs : null;
    assert.equal(result.observation.elapsedMs, expected);
    assert.equal(result.observation.attempts[0].elapsedMs, expected);
    assert.equal(result.observation.attempts[0].attempt, null);
    assert.equal(result.observation.attempts[0].timeoutMs, null);
    assert.equal(result.invocation.count, null);
    assert.equal(result.observation.deadlineMs, 10000);
    assert.equal(result.observation.status, 'pending');
  }
});

test('published product snapshot retains sanitized unavailable owned-view counts without implying selection', () => {
  const evidence = createCreationEvidence();
  const queryShape = { stage: 'observed', viewCount: 0, itemCount: null, candidateCount: 1,
    candidates: [{ controlType: 'DataGrid', className: 'UIItemsView', automationId: 'other', name: privateText }], code: null };
  evidence.direct.fileManagerOutcome = { status: 'pending', diagnostics: com(false),
    independentSelection: { stage: 'view_absent', windowVerified: true, targetVerified: false, selected: null, code: null, queryShape } };
  const result = snapshot(evidence);
  assert.equal(result.observation.com.selectedTargetMatch, false);
  assert.equal(result.observation.independentSelection.stage, 'view_absent');
  assert.equal(result.observation.independentSelection.status, 'unavailable');
  assert.equal(result.observation.independentSelection.queryShape.viewCount, 0);
  assert.deepEqual(result.observation.independentSelection.queryShape.candidates,
    [{ controlType: 'DataGrid', className: 'UIItemsView', automationId: 'other' }]);
  assert.equal(result.observation.selectionAgreement, 'unavailable');
  assert.equal(result.observation.exactTargetObserved, false);
  assert.equal(JSON.stringify(result).includes(privateText), false);
});

test('workflow runs independent fresh Windows diagnostics and always uploads exact diagnostic files', async () => {
  const workflow = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const [name, artifact, path] of [
    ['windows-product-selection-diagnostic', 'issue-17-windows-product-selection-diagnostic', 'work/ci-windows-product-selection/result.json'],
    ['windows-category-rename-diagnostic', 'issue-17-windows-category-rename-diagnostic', 'work/ci-windows-category-rename/rename-observations.json'],
  ]) {
    const job = workflow.jobs[name];
    assert.equal(job['runs-on'], 'windows-latest'); assert.equal(job.needs, undefined);
    assert.ok(job['timeout-minutes'] <= 10);
    assert.equal(job.steps.find((s) => s.uses === 'actions/setup-node@v4').with['node-version'], '22.21.1');
    assert.equal(job.steps.filter((s) => s.run === 'npm test').length, 0);
    const upload = job.steps.find((s) => s.uses === 'actions/upload-artifact@v4');
    assert.equal(upload.if, 'always()'); assert.equal(upload.with.name, artifact);
    assert.equal(upload.with.path, path); assert.equal(upload.with['if-no-files-found'], 'error');
    assert.equal(job['continue-on-error'], undefined);
    assert.ok(job.steps.every((s) => s['continue-on-error'] === undefined));
  }
  const product = workflow.jobs['windows-product-selection-diagnostic'].steps;
  const invocation = product.find((s) => s.env?.WORKSPACE_WINDOWS_SELECTION_DIAGNOSTIC === '1');
  const args = invocation.run.split(' ').slice(2);
  validateProductDiagnostic({ ...config, args });
  assert.equal(invocation['timeout-minutes'], 3);
  assert.equal(product.filter((s) => /smoke-project-creation/.test(s.run ?? '')).length, 1);
  assert.deepEqual(product.slice(0, product.indexOf(invocation)).filter((s) => s.run).map((s) => s.run), ['npm ci', 'npm run build']);
  const rename = workflow.jobs['windows-category-rename-diagnostic'].steps;
  assert.deepEqual(rename.filter((s) => s.run).slice(0, 3).map((s) => s.run),
    ['npm ci', 'npm run build:service-test-lib', 'node --import tsx scripts/windows-rename-diagnostics.mjs']);
  // The full platform acceptance matrix keeps its original independent scenarios.
  assert.deepEqual(workflow.jobs.verify.strategy.matrix.include.map((s) => s.os), ['macos-latest', 'windows-latest', 'windows-2022']);
  assert.equal(workflow.jobs.verify.steps.filter((s) => /--creation --discovery-mode=/.test(s.run ?? '')).length, 4);
});

test('fixture cleanup failure cannot label a completed scenario successful', () => {
  const evidence = createCreationEvidence();
  const result = snapshot(evidence, { finished: true, fixtureCleanup: { status: 'failed', code: 'EPERM' },
    shutdowns: [{ status: 'failed', forcedCleanup: { status: 'failed', processStopped: true, errorCode: 255, private: privateText } }] });
  assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'fixture_cleanup_failed');
  assert.deepEqual(result.shutdowns[0].forcedCleanup, { status: 'failed', processStopped: true, code: 255, exitTimedOut: false });
  assert.equal(JSON.stringify(result).includes(privateText), false);
});

test('failure cleanup and wrong-window evidence cannot complete product acceptance', () => {
  const evidence = createCreationEvidence();
  evidence.direct.fileManagerOutcome = { status: 'pending', diagnostics: { ...com(false), exactParentCount: 2 }, independentSelection: ui(true) };
  const result = snapshot(evidence, { failed: true, failureCleanup: { status: 'passed', reason: privateText },
    fixtureCleanup: { status: 'passed', processesStopped: true } });
  assert.equal(result.observation.independentSelection.status, 'unavailable');
  assert.equal(result.observation.exactTargetObserved, false);
  assert.equal(result.failureCleanup.status, 'passed'); assert.equal(result.normalShutdown.status, 'unreached');
  assert.equal(result.restartPersistence.status, 'unreached'); assert.equal(result.status, 'failed');
  assert.equal(JSON.stringify(result).includes(privateText), false);
});

test('terminal view diagnostic compares one matched condition on two fresh OS runners with all outcomes preserved', async () => {
  const workflow = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['windows-native-selection'];
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.equal(job.strategy['fail-fast'], false);
  assert.deepEqual(job.strategy.matrix, { os: ['windows-latest', 'windows-2022'] });
  assert.equal(job.needs, undefined);
  assert.equal(job['timeout-minutes'], 5);
  assert.equal(job.steps.find((s) => s.uses === 'actions/setup-node@v4').with['node-version'], '22.21.1');
  assert.equal(job['continue-on-error'], undefined);
  assert.ok(job.steps.every((s) => s['continue-on-error'] === undefined));
  const commands = job.steps.filter((s) => s.run);
  assert.deepEqual(commands.map((s) => s.run), [
    'node scripts/windows-native-selection.mjs',
    'node --test tests/windows-native-selection.test.mjs tests/windows-native-view-diagnostics.test.mjs tests/windows-selection-diagnostics.test.mjs tests/file-manager-evidence.test.mjs',
  ]);
  assert.equal(commands[0].env.WORKSPACE_NATIVE_SELECTION_MODE, 'electron_absolute');
  assert.equal(commands[0].env.WORKSPACE_NATIVE_VIEW_DIAGNOSTIC, '1');
  assert.equal(commands[1].if, 'always()');
  const upload = job.steps.find((s) => s.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.with.name, 'issue-17-windows-native-terminal-view-${{ matrix.os }}');
  const artifactNames = job.strategy.matrix.os.map((os) => upload.with.name.replace('${{ matrix.os }}', os));
  assert.equal(new Set(artifactNames).size, 2);
  assert.deepEqual(artifactNames, ['issue-17-windows-native-terminal-view-windows-latest',
    'issue-17-windows-native-terminal-view-windows-2022']);
  assert.equal(upload.with.path, 'work/windows-native-selection-evidence/result.json');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
});


test('full product OS comparison retains identical checks and unique evidence/package artifacts', async () => {
  const { jobs } = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = jobs.verify;
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.equal(job.strategy['fail-fast'], false);
  assert.deepEqual(job.strategy.matrix.include, [
    { os: 'macos-latest', artifact: 'macos' },
    { os: 'windows-latest', artifact: 'windows' },
    { os: 'windows-2022', artifact: 'windows-2022' },
  ]);
  assert.equal(job.needs, undefined);
  assert.equal(job['continue-on-error'], undefined);
  assert.ok(job.steps.every((step) => step['continue-on-error'] === undefined));
  const runs = job.steps.filter((step) => step.run);
  assert.deepEqual(runs.map((step) => step.run), [
    'npm ci', 'npm test', 'npm run lint', 'npm run typecheck', 'npm run build', 'npm run build:ladle',
    'node scripts/smoke-discovery-layouts.mjs --creation',
    'npm run smoke:runtime -- dev --creation --skip-native',
    'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence',
    'npm run smoke:runtime -- dev --creation --discovery-mode=grouped --checkpoint=after_evidence',
    'npm run smoke:runtime -- dev', 'npm run package:dir', 'npm run check:artifact -- release',
    'npm run smoke:runtime -- release --creation --skip-native',
    'npm run smoke:runtime -- release --creation --discovery-mode=direct --checkpoint=after_evidence',
    'npm run smoke:runtime -- release --creation --discovery-mode=grouped --checkpoint=after_evidence',
    'npm run smoke:runtime -- release',
  ]);
  // No OS-dependent skip or alternate command in the shared acceptance sequence.
  assert.ok(runs.every((step) => step.if === undefined || step.if === '${{ !cancelled() }}'));
  assert.ok(runs.every((step) => !JSON.stringify(step).includes('matrix.os')));
  assert.equal(job.steps.find((step) => step.uses === 'actions/setup-node@v4').with['node-version'], '22.21.1');
  const uploads = job.steps.filter((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(uploads.length, 2);
  const names = job.strategy.matrix.include.flatMap(({ artifact }) => uploads.map((step) =>
    step.with.name.replace('${{ matrix.artifact }}', artifact)));
  assert.equal(new Set(names).size, 6);
  assert.equal(uploads[0].if, 'always()');
  assert.equal(uploads[0].with.path, 'work/ci-creation-*/\nwork/ci-runtime-*/\n');
  assert.equal(uploads[1].with.path, 'release/');
  assert.equal(uploads[1].with['if-no-files-found'], 'error');
});

test('Explorer CLI candidate uses identical fresh OS jobs and never replaces native or product acceptance', async () => {
  const { jobs } = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = jobs['windows-explorer-selection'];
  assert.ok(job);
  assert.equal(job.needs, undefined);
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.deepEqual(job.strategy, { 'fail-fast': false, matrix: { os: ['windows-latest', 'windows-2022'] } });
  assert.equal(job['timeout-minutes'], 5);
  assert.equal(job['continue-on-error'], undefined);
  assert.ok(job.steps.every((step) => step['continue-on-error'] === undefined));
  assert.equal(job.steps.find((step) => step.uses === 'actions/setup-node@v4').with['node-version'], '22.21.1');
  const runs = job.steps.filter((step) => step.run);
  assert.deepEqual(runs.map((step) => step.run), [
    'node scripts/windows-explorer-selection.mjs',
    'node --test tests/windows-explorer-selection.test.mjs tests/file-manager-evidence.test.mjs',
  ]);
  assert.equal(runs[0].if, undefined); assert.equal(runs[1].if, 'always()');
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.name, 'issue-17-windows-explorer-select-${{ matrix.os }}');
  assert.equal(upload.with.path, 'work/windows-explorer-selection-evidence/result.json');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.ok(jobs['windows-native-selection']);
  assert.ok(jobs.verify.strategy.matrix.include.some(({ os }) => os === 'windows-latest'));
});


test('ready-parent command uses matched fresh jobs and keeps API CLI and product gates', async () => {
  const { jobs } = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = jobs['windows-ready-selection'];
  assert.ok(job);
  assert.equal(job.needs, undefined);
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.deepEqual(job.strategy, { 'fail-fast': false, matrix: { os: ['windows-latest', 'windows-2022'] } });
  assert.equal(job['timeout-minutes'], 5);
  assert.equal(job['continue-on-error'], undefined);
  assert.ok(job.steps.every((step) => step['continue-on-error'] === undefined));
  assert.equal(job.steps.find((step) => step.uses === 'actions/setup-node@v4').with['node-version'], '22.21.1');
  const runs = job.steps.filter((step) => step.run);
  assert.deepEqual(runs.map((step) => step.run), [
    'node scripts/windows-ready-selection.mjs',
    'node --test tests/windows-ready-selection.test.mjs tests/windows-ready-selection-com.test.mjs tests/file-manager-evidence.test.mjs',
  ]);
  assert.equal(runs[0].if, undefined); assert.equal(runs[1].if, 'always()');
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.name, 'issue-17-windows-ready-select-${{ matrix.os }}');
  assert.equal(upload.with.path, 'work/windows-ready-selection-evidence/result.json');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.ok(jobs['windows-native-selection']); assert.ok(jobs['windows-explorer-selection']);
  assert.ok(jobs.verify.strategy.matrix.include.some(({ os }) => os === 'windows-latest'));
});


test('product artifact distinguishes actual Windows command counts from negative and unavailable observation', () => {
  for (const status of ['passed', 'failed', 'pending']) {
    const evidence = createCreationEvidence();
    evidence.direct.nativeInvocation = { status, api: 'Windows ready FolderView.SelectItem',
      navigationCount: 1, selectionCount: 1, rawError: privateText };
    evidence.direct.fileManagerOutcome = { status: 'pending', diagnostics: com(false) };
    const result = snapshot(evidence);
    assert.equal(result.invocation.api, 'Windows ready FolderView.SelectItem');
    assert.equal(result.invocation.status, status);
    assert.equal(result.invocation.navigationCount, 1); assert.equal(result.invocation.selectionCount, 1);
    assert.equal(result.observation.exactTargetObserved, false);
    assert.equal(JSON.stringify(result).includes(privateText), false);
  }
  const evidence = createCreationEvidence();
  evidence.direct.nativeInvocation = { status: 'failed', api: privateText, navigationCount: 2, selectionCount: 1.5 };
  const result = snapshot(evidence);
  assert.equal(result.invocation.api, 'unknown');
  assert.equal(result.invocation.navigationCount, null); assert.equal(result.invocation.selectionCount, null);
});
