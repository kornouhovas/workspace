import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
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
    assert.equal(upload.if, name === 'windows-product-selection-diagnostic'
      ? "${{ always() && steps.native.outcome != 'skipped' }}" : 'always()'); assert.equal(upload.with.name, artifact);
    assert.equal(upload.with.path, path); assert.equal(upload.with['if-no-files-found'], 'error');
    assert.equal(job['continue-on-error'], undefined);
    assert.ok(job.steps.every((s) => s['continue-on-error'] === undefined));
  }
  const product = workflow.jobs['windows-product-selection-diagnostic'].steps;
  const early = product.find((s) => s.run === 'npm run test:windows:early');
  assert.ok(early, 'real creation/IPC/bridge checks must precede native acceptance');
  const invocation = product.find((s) => s.env?.WORKSPACE_WINDOWS_SELECTION_DIAGNOSTIC === '1');
  const args = invocation.run.split(' ').slice(2);
  validateProductDiagnostic({ ...config, args });
  assert.equal(invocation['timeout-minutes'], 3);
  assert.equal(invocation.id, 'native');
  assert.equal(product.filter((s) => /smoke-project-creation/.test(s.run ?? '')).length, 1);
  assert.deepEqual(product.slice(0, product.indexOf(invocation)).filter((s) => s.run).map((s) => s.run), ['npm ci', 'npm run build', 'npm run test:windows:early']);
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  const suites = manifest.scripts['test:windows:early'];
  for (const file of ['project-creation-service.test.mjs', 'project-creation-ui.test.tsx', 'project-reveal.test.mjs',
    'settings-service.test.mjs', 'windows-project-reveal.test.mjs', 'windows-project-reveal-com.test.mjs']) {
    assert.ok(suites.includes(`tests/${file}`), `${file} must run in early Windows feedback`);
  }
  assert.ok(!suites.includes('npm test'));
  const rename = workflow.jobs['windows-category-rename-diagnostic'].steps;
  assert.deepEqual(rename.filter((s) => s.run).slice(0, 3).map((s) => s.run),
    ['npm ci', 'npm run build:service-test-lib', 'node --import tsx scripts/windows-rename-diagnostics.mjs']);
  // The full platform acceptance matrix keeps its original independent scenarios.
  assert.deepEqual(workflow.jobs.verify.strategy.matrix.include.map((s) => s.os), ['macos-latest', 'windows-latest', 'windows-2022']);
  for (const os of ['windows-latest', 'windows-2022', 'macos-latest']) {
    const active = workflow.jobs.verify.steps.filter(step => /--creation --discovery-mode=/.test(step.run ?? '') &&
      (!step.if || runInNewContext(step.if.slice(3, -2), { matrix: { os } })));
    assert.equal(active.length, 4);
    assert.equal(new Set(active.map(step => step.env.WORKSPACE_SMOKE_EVIDENCE_DIR)).size, 4);
  }
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
  assert.equal(job.needs, 'common');
  assert.equal(job['continue-on-error'], undefined);
  assert.ok(job.steps.every((step) => step['continue-on-error'] === undefined));
  const runs = job.steps.filter((step) => step.run);
  const early = runs.find(step => step.name === 'Early Windows latest direct development creation/native evidence');
  const late = runs.find(step => step.name === 'Direct development creation/native evidence');
  assert.deepEqual(runs.filter(step => step !== early).map((step) => step.run), [
    'npm ci', 'npm run build', 'npm run smoke:shell', 'npm run smoke:workspaces', 'npm run smoke:sources', 'npm run test:platform', 'node scripts/windows-observer-diagnostics.mjs validate-call --output work/ci-observer-full-suite',
    'npm run build:ladle',
    'node scripts/smoke-discovery-layouts.mjs --creation',
    'node scripts/smoke-discovery-layouts.mjs --category-move',
    'npm run smoke:runtime -- dev --creation --skip-native',
    'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence',
    'npm run smoke:runtime -- dev --creation --discovery-mode=grouped --checkpoint=after_evidence',
    'npm run smoke:runtime -- dev', 'npm run smoke:views -- dev', 'npm run smoke:multiselect -- dev', 'npm run smoke:select -- dev', 'npm run smoke:date -- dev', 'npm run smoke:number -- dev', 'npm run smoke:archive -- dev', 'npm run smoke:data-recovery -- dev', 'npm run smoke:category-options -- dev', 'npm run package:built', 'npm run check:artifact -- release',
    'npm run smoke:views -- release', 'npm run smoke:multiselect -- release', 'npm run smoke:select -- release', 'npm run smoke:date -- release', 'npm run smoke:number -- release', 'npm run smoke:archive -- release', 'npm run smoke:data-recovery -- release', 'npm run smoke:category-options -- release',
    'npm run smoke:runtime -- release --creation --skip-native',
    'npm run smoke:runtime -- release --creation --discovery-mode=direct --checkpoint=after_evidence',
    'npm run smoke:runtime -- release --creation --discovery-mode=grouped --checkpoint=after_evidence',
    'npm run smoke:runtime -- release',
  ]);
  // Only the unchanged direct native command changes position. Each OS retains
  // the complete original command multiset plus shell acceptance, with no skipped route.
  assert.equal(early.run, late.run);
  for (const os of ['windows-latest', 'windows-2022', 'macos-latest']) {
    const active = runs.filter(step => step !== early && step !== late ||
      runInNewContext(step.if.slice(3, -2), { matrix: { os } }));
    assert.deepEqual(active.map(step => step.run).sort(), runs.filter(step => step !== early).map(step => step.run).sort());
  }
  const collectorValidation = runs.find((step) => step.id === 'observer-call-validation');
  assert.equal(collectorValidation.if, 'always()');
  assert.ok(runs.filter((step) => ![collectorValidation, early, late].includes(step)).every((step) => step.if === undefined || step.if === '${{ !cancelled() }}'));
  assert.ok(runs.filter(step => ![early, late].includes(step)).every(({ run, if: condition }) => !JSON.stringify({ run, condition }).includes('matrix.os')));
  assert.equal(job.steps.find((step) => step.uses === 'actions/setup-node@v4').with['node-version'], '22.21.1');
  const uploads = job.steps.filter((step) => step.uses === 'actions/upload-artifact@v4');
  const names = job.strategy.matrix.include.flatMap(({ os, artifact }) => uploads.map((step) =>
    step.with.name.replaceAll('${{ matrix.artifact }}', artifact).replaceAll('${{ matrix.os }}', os)));
  assert.equal(new Set(names).size, names.length);
  const creationUploads = uploads.filter((step) => step.with.path.includes('work/ci-creation-'));
  assert.equal(creationUploads.length, 1);
  assert.equal(creationUploads[0].if, 'always()');
  assert.equal(creationUploads[0].with.path, 'work/ci-creation-*/\nwork/ci-runtime-*/\nwork/ci-category-move-layouts/\nwork/ci-category-options-*/\nwork/ci-archive-*/\nwork/ci-number-*/\nwork/ci-date-*/\nwork/ci-select-*/\nwork/ci-multiselect-*/\nwork/ci-views-*/\nwork/ci-data-recovery-*/\n');
  assert.equal(creationUploads[0].with['if-no-files-found'], 'warn');
  const packageUploads = uploads.filter((step) => step.with.path === 'release/');
  assert.equal(packageUploads.length, 1);
  assert.equal(packageUploads[0].with['if-no-files-found'], 'error');
  const checkpointUploads = uploads.filter((step) => step.with.path.endsWith('/service-checkpoint.json'));
  assert.equal(checkpointUploads.length, 1);
  const checkpoint = checkpointUploads[0];
  const evidenceDirectory = runs.find((step) => step.run === 'npm run test:platform').env.WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR;
  assert.ok(evidenceDirectory.startsWith('work/ci-category-move-full-suite/'));
  assert.equal(checkpoint.with.path, `${evidenceDirectory}/*/service-checkpoint.json`);
  assert.equal(checkpoint.if, 'always()');
  assert.equal(checkpoint.with['if-no-files-found'], 'warn');
  assert.equal(checkpoint.with['retention-days'], 7);
  for (const provenance of ['${{ matrix.os }}', '${{ github.sha }}', '${{ github.run_id }}', '${{ github.run_attempt }}']) {
    assert.ok(evidenceDirectory.includes(provenance));
    assert.ok(checkpoint.with.name.includes(provenance));
  }
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


test('ready-parent command uses matched fresh jobs and preserves historical comparisons and product gates', async () => {
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
    'node scripts/windows-resolver-diagnosis.mjs',
    'node --test tests/windows-explorer-selection.test.mjs tests/windows-resolver-diagnosis.test.mjs',
    'node --test tests/windows-ready-selection.test.mjs tests/windows-ready-selection-com.test.mjs tests/file-manager-evidence.test.mjs',
  ]);
  assert.equal(runs[0].if, undefined);
  for (const step of runs.slice(1)) assert.equal(step.if, 'always()');
  const uploads = job.steps.filter((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].if, 'always()');
  assert.equal(uploads[0].with.name, 'issue-17-windows-ready-select-${{ matrix.os }}');
  assert.equal(uploads[0].with.path, 'work/windows-ready-selection-evidence/result.json');
  assert.equal(uploads[0].with['if-no-files-found'], 'error');
  assert.equal(uploads[1].if, 'always()');
  assert.equal(uploads[1].with.name, 'issue-18-windows-resolver-read-only-series-${{ matrix.os }}');
  assert.equal(uploads[1].with.path, 'work/issue-18/windows-resolver-diagnosis/read-only-series/');
  assert.equal(uploads[1].with['if-no-files-found'], 'error');
  assert.ok(jobs['windows-native-selection']); assert.ok(jobs['windows-explorer-selection']);
  assert.ok(jobs.verify.strategy.matrix.include.some(({ os }) => os === 'windows-latest'));
});

test('only historical Windows API and CLI comparisons require explicit manual boolean opt-in', async () => {
  const workflow = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.ok(Object.hasOwn(workflow.on, 'push'));
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  const input = workflow.on.workflow_dispatch.inputs.legacy_windows_diagnostics;
  assert.equal(input.type, 'boolean');
  assert.equal(input.default, false);
  const historical = ['windows-native-selection', 'windows-explorer-selection'];
  assert.ok(historical.every(name => workflow.jobs[name].if !== undefined));
  for (const name of historical) {
    const job = workflow.jobs[name];
    assert.match(job.name, /Historical manual/);
    assert.equal(job.if, "${{ github.event_name == 'workflow_dispatch' && inputs.legacy_windows_diagnostics == true }}");
    const expression = job.if.slice(3, -2).trim();
    for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
      for (const value of [undefined, false, true]) {
        // This expression uses the same boolean/equality subset in Actions and JS.
        const enabled = runInNewContext(expression, { github: { event_name: event },
          inputs: { legacy_windows_diagnostics: value } }, { timeout: 1000 });
        assert.equal(enabled, event === 'workflow_dispatch' && value === true, `${name}: ${event}/${value}`);
      }
    }
  }
  for (const name of ['windows-product-selection-diagnostic', 'windows-category-rename-diagnostic',
    'windows-ready-selection']) {
    const job = workflow.jobs[name];
    assert.ok(job);
    assert.equal(job.if, "${{ github.event_name == 'workflow_dispatch' && inputs.diagnostics == true }}");
    assert.equal(job.needs, undefined);
    assert.equal(job['continue-on-error'], undefined);
    assert.ok(job.steps.every((step) => step['continue-on-error'] === undefined));
    assert.ok(job.steps.every((step) => !JSON.stringify(step).includes('legacy_windows_diagnostics')));
  }
  assert.equal(workflow.jobs.verify.if, undefined);
  assert.equal(workflow.jobs.verify.needs, 'common');
  assert.equal(workflow.jobs.verify.steps.some((step) => step.run === 'npm run test:platform' && step.if === undefined), true);
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

test('strict snapshot retains terminal incomplete polling independently of cleanup and stage overwrite', () => {
  const evidence = createCreationEvidence();
  const polling = { completion: 'exhausted', attempts: 150, readStatus: 'available', navigationCount: 1,
    selectionCount: 1, returnedCount: 0, exactTarget: true, exactNavigationTarget: true, response: 'incomplete',
    renderer: 'error', bridgeCleanup: { status: 'passed', started: 1, stopped: 1, active: 0, unknown: false },
    privatePath: privateText };
  recordCreationEvidence(evidence, 'direct', 'nativeInvocation', { status: 'failed', reason: privateText });
  const result = snapshot(evidence, { nativeInvocationOutcome: polling, failed: true });
  assert.equal(result.invocation.terminal.completion, 'exhausted');
  assert.equal(result.invocation.terminal.selectionCount, 1);
  assert.equal(result.invocation.terminal.returnedCount, 0);
  assert.equal(result.invocation.terminal.response, 'incomplete');
  assert.equal(result.invocation.terminal.renderer, 'error');
  assert.equal(result.invocation.terminal.bridgeCleanup.status, 'passed');
  assert.equal(result.invocation.status, 'failed'); assert.equal(result.status, 'failed');
  assert.equal(JSON.stringify(result).includes(privateText), false);
});

test('terminal snapshot allowlists reject private values and invalid counts without promoting failed intent', () => {
  const evidence = createCreationEvidence();
  evidence.direct.nativeInvocation = { status: 'failed' };
  const result = snapshot(evidence, { nativeInvocationOutcome: {
    completion: privateText, attempts: 151, readStatus: privateText, selectionCount: 1001,
    navigationCount: -1, returnedCount: 0.5, exactTarget: privateText, exactNavigationTarget: true,
    response: privateText, renderer: privateText, bridgeCleanup: { unknown: false, privateText }, privateText,
  } });
  assert.deepEqual(result.invocation.terminal, { completion: 'unavailable', attempts: null, readStatus: 'unavailable',
    navigationCount: null, selectionCount: null, returnedCount: null, exactTarget: null, exactNavigationTarget: true,
    response: 'unavailable', renderer: 'unavailable',
    bridgeCleanup: { status: 'unverified', started: null, stopped: null, active: null, unknown: false } });
  assert.equal(result.invocation.status, 'failed');
  assert.equal(result.observation.exactTargetObserved, false);
  assert.equal(JSON.stringify(result).includes(privateText), false);
  assert.equal(snapshot(evidence).invocation.terminal, null);
});


test('raw-rename dispatch selects only Windows 2022 comparisons and original regression without weakening failures', async () => {
  const workflow = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('raw-rename'));
  const commonCondition = workflow.jobs.common.if.slice(3, -2).replaceAll('github.event_name', 'event').replaceAll('inputs.checks', 'checks');
  assert.equal(runInNewContext(commonCondition, { event: 'workflow_dispatch', checks: 'raw-rename' }), false);
  assert.equal(runInNewContext(commonCondition, { event: 'push', checks: 'raw-rename' }), true);
  assert.equal(runInNewContext(commonCondition, { event: 'workflow_dispatch', checks: 'full' }), true);
  const job = workflow.jobs['focused-raw-rename'];
  assert.equal(job.if, "${{ github.event_name == 'workflow_dispatch' && inputs.checks == 'raw-rename' }}");
  assert.equal(job['runs-on'], 'windows-2022'); assert.equal(job['timeout-minutes'], 10);
  assert.equal(job.needs, undefined); assert.equal(job['continue-on-error'], undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), ['npm ci', 'npm run build:service-test-lib',
    'node --import tsx --test tests/windows-rename-etw.test.mjs', 'node --import tsx scripts/debug/windows-rename-etw.mjs',
    'node --import tsx scripts/windows-rename-diagnostics.mjs', 'node --import tsx --test tests/windows-rename-diagnostics.test.mjs']);
  const control = job.steps.find(step => step.id === 'etw_controls');
  assert.equal(control.run, 'node --import tsx --test tests/windows-rename-etw.test.mjs');
  const probe = job.steps.find(step => step.run === 'node --import tsx scripts/debug/windows-rename-etw.mjs');
  assert.equal(probe.if, "${{ !cancelled() && steps.build.outcome == 'success' && steps.etw_controls.outcome == 'success' }}");
  assert.equal(probe.env.WORKSPACE_RENAME_EVIDENCE_DIR, 'work/ci-raw-rename/kernel-file');
  const comparisons = job.steps.find(step => step.run === 'node --import tsx scripts/windows-rename-diagnostics.mjs');
  assert.equal(comparisons.if, "${{ !cancelled() && steps.build.outcome == 'success' }}");
  const original = job.steps.find(step => step.run === 'node --import tsx --test tests/windows-rename-diagnostics.test.mjs');
  assert.equal(original.if, "${{ !cancelled() && steps.build.outcome == 'success' }}");
  for (const [cancelled, build, controls, expectedProbe, expectedOriginal] of [
    [false, 'success', 'success', true, true], [false, 'success', 'failure', false, true],
    [false, 'failure', 'success', false, false], [true, 'success', 'success', false, false],
  ]) {
    const context = { cancelled: () => cancelled, steps: { build: { outcome: build }, etw_controls: { outcome: controls }, probe: { outcome: 'failure' } } };
    assert.equal(runInNewContext(probe.if.slice(3, -2), context), expectedProbe);
    for (const step of [comparisons, original]) assert.equal(runInNewContext(step.if.slice(3, -2), context), expectedOriginal);
  }
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, 'work/ci-raw-rename/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.ok(upload.with.name.includes('${{ github.sha }}-run-${{ github.run_id }}-attempt-${{ github.run_attempt }}'));
});

test('source fixture route renews only canonical path scenarios across affected platforms', async () => {
  const { jobs } = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = jobs['source-settings-fixture'];
  assert.match(job.if, /inputs.checks == 'source-fixture'/);
  assert.deepEqual(job.strategy.matrix.os, ['windows-2022', 'windows-latest', 'macos-latest']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const commands = job.steps.filter(step => step.run).map(step => step.run).join('\n');
  assert.match(commands, /npm run build/);
  assert.match(commands, /--test-name-pattern="\[Ss\]ources\? settings" tests\/renderer-app\.test\.tsx tests\/workspaces-service\.test\.mjs/);
  assert.doesNotMatch(commands, /test:all|test:platform|smoke:/);
  assert.match(jobs.common.if, /inputs.checks != 'source-fixture'/);
  assert.equal(jobs.verify.needs, 'common');
});
