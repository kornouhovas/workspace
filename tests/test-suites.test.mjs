import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { load } from 'js-yaml';
import { selectTestFiles } from '../scripts/test-suites.mjs';

const files = readdirSync('tests').filter(name => /\.test\.(mjs|tsx)$/.test(name)).sort();

test('common and platform suites cover every test exactly once', () => {
  const common = selectTestFiles(files, 'common');
  const platform = selectTestFiles(files, 'platform');
  assert.ok(common.length > 0 && platform.length > 0);
  assert.deepEqual([...common, ...platform].sort(), files);
  assert.equal(new Set([...common, ...platform]).size, files.length);
  for (const name of ['project-category-move-service.test.mjs', 'project-rename-native.test.mjs',
    'renderer-app.test.tsx', 'project-creation-ui.test.tsx', 'windows-observer-diagnostics.test.mjs']) {
    assert.ok(platform.includes(name), `${name} needs real platform coverage`);
  }
  assert.ok(common.includes('project-category-move-ui.test.tsx'));
});

test('new tests default to platform coverage and invalid suite names fail closed', () => {
  const expanded = [...files, 'new-filesystem.test.mjs'];
  assert.ok(selectTestFiles(expanded, 'platform').includes('new-filesystem.test.mjs'));
  assert.ok(!selectTestFiles(expanded, 'common').includes('new-filesystem.test.mjs'));
  assert.throws(() => selectTestFiles(files, 'typo'));
  assert.throws(() => selectTestFiles([...files, files[0]], 'all'));
});

test('suite CLI lists the selected real files and rejects unknown invocations', () => {
  for (const suite of ['all', 'common', 'platform']) {
    const result = spawnSync(process.execPath, ['scripts/test-suites.mjs', suite, '--list'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), selectTestFiles(files, suite).map(name => `tests/${name}`));
  }
  const result = spawnSync(process.execPath, ['scripts/test-suites.mjs', 'typo'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
});

test('ordinary CI runs common checks once and retains all three platform acceptance routes', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const { common, verify } = workflow.jobs;
  assert.equal(common.if, "${{ github.event_name != 'workflow_dispatch' || (inputs.checks != 'failed' && inputs.checks != 'readiness' && inputs.checks != 'windows-release' && inputs.checks != 'issue22-failures' && inputs.checks != 'creation-shutdown' && inputs.checks != 'raw-rename' && inputs.checks != 'issue24-failures' && inputs.checks != 'category-fixture' && inputs.checks != 'issue24-startup' && inputs.checks != 'multiselect' && inputs.checks != 'etw-controls') }}");
  assert.equal(common.strategy, undefined);
  assert.deepEqual(common.steps.filter(step => step.run).map(step => step.run), [
    'npm ci', 'npm run lint', 'npm run typecheck', 'npm run check:docs', 'npm run test:common',
  ]);
  assert.equal(verify.needs, 'common');
  assert.deepEqual(verify.strategy.matrix.include.map(row => row.os), ['macos-latest', 'windows-latest', 'windows-2022']);
  const runs = verify.steps.filter(step => step.run).map(step => step.run);
  assert.equal(runs.filter(run => run === 'npm run build').length, 1);
  assert.equal(runs.filter(run => run === 'npm run test:platform').length, 1);
  assert.ok(!runs.includes('npm test') && !runs.includes('npm run package:dir'));
  for (const mode of ['dev', 'release']) assert.ok(runs.includes(`npm run smoke:runtime -- ${mode}`));
  assert.ok(runs.includes('npm run package:built'));
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.ok(workflow.concurrency.group.includes('${{ github.ref }}'));
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.equal(scripts.test, 'npm run build && npm run test:all');
  assert.equal(scripts['package:built'], 'electron-builder --dir');
});

test('investigation jobs run only with explicit manual diagnostic inputs', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.diagnostics.default, false);
  const diagnostics = ['windows-observer-diagnostic', 'project-category-move-service-early',
    'project-rename-service-early', 'windows-product-selection-diagnostic',
    'windows-category-rename-diagnostic', 'windows-ready-selection'];
  assert.deepEqual(Object.keys(workflow.jobs).filter(name => !workflow.jobs[name].if), ['verify']);
  for (const name of diagnostics) {
    const expression = workflow.jobs[name].if.slice(3, -2).trim();
    for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
      for (const value of [undefined, false, true]) {
        const enabled = runInNewContext(expression, { github: { event_name: event }, inputs: { diagnostics: value } });
        assert.equal(enabled, event === 'workflow_dispatch' && value === true, `${name}: ${event}/${value}`);
      }
    }
  }
});

test('manual failed-check scope runs only the Windows observer and macOS rename routes', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.checks.default, 'full');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.checks.options, ['full', 'failed', 'readiness', 'windows-release', 'issue22-failures', 'creation-shutdown', 'raw-rename', 'issue24-failures', 'category-fixture', 'issue24-startup', 'multiselect', 'etw-controls']);
  const enabled = (job, event, checks) => runInNewContext(job.if.slice(3, -2), { github: { event_name: event }, inputs: { checks } });
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed']) {
    const focused = event === 'workflow_dispatch' && checks === 'failed';
    assert.equal(enabled(workflow.jobs.common, event, checks), !focused);
    for (const name of ['focused-windows-observer', 'focused-macos-rename']) assert.equal(enabled(workflow.jobs[name], event, checks), focused);
  }
  assert.equal(workflow.jobs['focused-windows-observer']['runs-on'], 'windows-latest');
  assert.equal(workflow.jobs['focused-macos-rename']['runs-on'], 'macos-latest');
  const commands = name => workflow.jobs[name].steps.filter(step => step.run).map(step => step.run);
  assert.ok(commands('focused-windows-observer').includes('node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs'));
  assert.ok(commands('focused-macos-rename').includes('npm run smoke:runtime -- dev --rename'));
  for (const name of ['focused-windows-observer', 'focused-macos-rename']) {
    const upload = workflow.jobs[name].steps.find(step => step.uses === 'actions/upload-artifact@v4');
    assert.ok(upload.if.includes('always()'));
    assert.ok(upload.with.name.includes('github.sha') && upload.with.name.includes('github.run_id') && upload.with.name.includes('github.run_attempt'));
    assert.equal(upload.with['if-no-files-found'], 'error');
  }
});

test('runtime failure investigation selects only the two original Windows routes', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.runtime_failures.default, false);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed']) {
    for (const runtime_failures of [undefined, false, true]) {
      const context = { github: { event_name: event }, inputs: { checks, runtime_failures } };
      const enabled = name => runInNewContext(workflow.jobs[name].if.slice(3, -2), context);
      const focused = event === 'workflow_dispatch' && checks === 'failed';
      assert.equal(enabled('focused-windows-runtime'), focused && runtime_failures === true);
      for (const name of ['focused-windows-observer', 'focused-macos-rename']) assert.equal(enabled(name), focused && runtime_failures !== true);
      assert.equal(enabled('common'), !focused);
    }
  }
  const job = workflow.jobs['focused-windows-runtime'];
  assert.equal(job.strategy['fail-fast'], false);
  assert.deepEqual(job.strategy.matrix.include, [
    { os: 'windows-latest', command: 'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence' },
    { os: 'windows-2022', command: 'npm run smoke:runtime -- dev' },
  ]);
  const run = job.steps.find(step => step.name === 'Exercise the original failed runtime route');
  assert.ok(run.if.includes("steps.runtime-build.outcome == 'success'"));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
});

test('integration failures select only original macOS layout and Windows 2022 creation routes', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.integration_failures.default, false);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed']) {
    for (const integration_failures of [undefined, false, true]) for (const runtime_failures of [undefined, false, true]) {
      const context = { github: { event_name: event }, inputs: { checks, integration_failures, runtime_failures } };
      const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
      const focused = event === 'workflow_dispatch' && checks === 'failed' && integration_failures === true;
      for (const name of ['focused-integration-layout', 'focused-integration-reveal']) assert.equal(active.includes(name), focused);
      if (focused) assert.deepEqual(active.sort(), ['focused-integration-layout', 'focused-integration-reveal']);
    }
  }
  for (const [name, os, command] of [
    ['focused-integration-layout', 'macos-latest', 'node scripts/smoke-discovery-layouts.mjs --category-move'],
    ['focused-integration-reveal', 'windows-2022', 'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence'],
  ]) {
    const job = workflow.jobs[name]; assert.equal(job['runs-on'], os);
    assert.ok(job.steps.some(step => step.run === command));
    const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
    assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
    for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
  }
});


test('readiness failure scope runs only the original macOS Electron suite', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const checks of [undefined, 'full', 'failed', 'readiness']) {
      const context = { github: { event_name: event }, inputs: { checks } };
      const active = Object.entries(workflow.jobs).filter(([, job]) => job.if &&
        runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
      const focused = event === 'workflow_dispatch' && checks === 'readiness';
      assert.equal(active.includes('focused-macos-readiness'), focused);
      if (focused) assert.deepEqual(active, ['focused-macos-readiness']);
    }
  }
  const job = workflow.jobs['focused-macos-readiness'];
  assert.equal(job['runs-on'], "${{ matrix.os }}");
  assert.equal(job.strategy['fail-fast'], false);
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_windows.default, false);
  for (const readiness_windows of [undefined, false, true])
    assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3, -2), { fromJSON: JSON.parse, inputs: { readiness_windows } })),
      readiness_windows ? ['windows-latest', 'windows-2022'] : ['macos-latest']);
  const commands = job.steps.filter(step => step.run).map(step => step.run);
  assert.equal(commands.length, 2);
  assert.equal(commands[0], 'npm ci');
  assert.ok(commands[1].includes('set -o pipefail'));
  assert.ok(commands[1].includes('node --test tests/rename-editor-readiness.test.mjs 2>&1 | tee'));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['matrix.os', 'github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('Windows release failure scope runs only the original packaged runtime with its prerequisites', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed', 'readiness', 'windows-release']) {
    const context = { github: { event_name: event }, inputs: { checks } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    if (event === 'workflow_dispatch' && checks === 'windows-release') assert.deepEqual(active, ['focused-windows-release-runtime']);
    else assert.equal(active.includes('focused-windows-release-runtime'), false);
  }
  const job = workflow.jobs['focused-windows-release-runtime'];
  assert.equal(job['runs-on'], 'windows-latest');
  const commands = job.steps.filter(step => step.run).map(step => step.run);
  assert.deepEqual(commands, ['npm ci', 'npm run build', 'node --import tsx --test tests/runtime-lifecycle.test.mjs tests/rename-runtime-startup.test.mjs tests/project-category-move-runtime.test.mjs tests/test-suites.test.mjs', 'npm run package:built', 'npm run check:artifact -- release', 'npm run smoke:runtime -- release']);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('issue 22 failure scope selects only the affected Windows suite and original macOS runtime', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed', 'readiness', 'windows-release', 'issue22-failures']) {
    const context = { github: { event_name: event }, inputs: { checks } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    if (event === 'workflow_dispatch' && checks === 'issue22-failures') assert.deepEqual(active, ['focused-issue22-failures']);
    else assert.equal(active.includes('focused-issue22-failures'), false);
  }
  const job = workflow.jobs['focused-issue22-failures'];
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest', 'windows-latest']);
  assert.equal(job.strategy['fail-fast'], false);
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 3).map(step => step.run), ['npm ci', 'npm run build', 'node --import tsx --test tests/rename-submission-receipt.test.mjs tests/test-suites.test.mjs']);
  assert.equal(commands[3].if, "matrix.os == 'windows-latest'");
  assert.ok(commands[3].run.includes('set -o pipefail'));
  assert.ok(commands[3].run.includes('node --import tsx --test tests/backend-lifecycle.test.mjs 2>&1 | tee'));
  assert.equal(commands[4].if, "matrix.os == 'macos-latest'");
  assert.equal(commands[4].run, 'npm run smoke:runtime -- dev');
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['matrix.os', 'github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});

test('creation shutdown failure route preserves the original Windows latest command and skips full acceptance', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed', 'readiness', 'windows-release', 'issue22-failures', 'creation-shutdown']) {
    const context = { github: { event_name: event }, inputs: { checks } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    if (event === 'workflow_dispatch' && checks === 'creation-shutdown') assert.deepEqual(active, ['focused-creation-shutdown']);
    else assert.equal(active.includes('focused-creation-shutdown'), false);
  }
  const job = workflow.jobs['focused-creation-shutdown'];
  assert.equal(job['runs-on'], 'windows-latest');
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), ['npm ci', 'npm run build', 'node --import tsx --test tests/runtime-quit-evidence.test.mjs tests/runtime-lifecycle.test.mjs tests/test-suites.test.mjs', 'npm run smoke:runtime -- dev --creation --skip-native']);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.run === 'npm run smoke:runtime -- dev --creation --skip-native');
  assert.equal(original.if, undefined); assert.equal(original.env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-focused-creation-shutdown');
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('raw rename and routing focused modes preserve strict original commands and disable unrelated acceptance', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of ['raw-rename', 'issue24-failures', 'category-fixture']) {
    const context = { github: { event_name: event }, inputs: { checks } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    if (event === 'workflow_dispatch') assert.deepEqual(active, {
      'raw-rename': ['focused-rename-runtime', 'focused-raw-rename'], 'issue24-failures': ['focused-issue24-failures'],
      'category-fixture': ['focused-category-fixture', 'focused-category-runtime'],
    }[checks]);
    else assert.deepEqual(active, ['common']);
  }
  const job = workflow.jobs['focused-issue24-failures'];
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest', 'windows-latest', 'windows-2022']);
  assert.equal(job.strategy['fail-fast'], false); assert.equal(job.needs, undefined);
  assert.equal(job['continue-on-error'], undefined);
  const commands = job.steps.filter(step => step.run);
  assert.equal(commands[0].run, 'npm ci');
  assert.equal(commands[1].shell, 'bash'); assert.ok(commands[1].run.includes('set -o pipefail'));
  assert.ok(commands[1].run.includes('node --test tests/test-suites.test.mjs 2>&1 | tee work/issue24-failures/tests.txt'));
  assert.equal(commands[2].if, "${{ matrix.os == 'windows-2022' && !cancelled() && steps.dependencies.outcome == 'success' }}");
  assert.equal(commands[2].shell, 'bash'); assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes("node --test --test-name-pattern='real runner' tests/ralphex-observe.test.mjs"));
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, 'work/issue24-failures/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['matrix.os', 'github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('category-fixture scope retains the original Windows latest regression and checkpoint artifacts', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-category-fixture'];
  assert.equal(job['runs-on'], 'windows-latest'); assert.equal(job['timeout-minutes'], 15);
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 2).map(step => step.run), ['npm ci', 'npm run build']);
  assert.equal(commands[2].shell, 'bash'); assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes('node --import tsx --test tests/project-category-move-fixture.test.mjs'));
  assert.equal(commands[2].env.WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR, 'work/ci-category-fixture');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, 'work/ci-category-fixture/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});

test('category-fixture also reproduces the original Windows 2022 development runtime failure', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-category-runtime'];
  assert.equal(job.if, workflow.jobs['focused-category-fixture'].if);
  assert.equal(job['runs-on'], 'windows-2022'); assert.equal(job['timeout-minutes'], 25);
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 2).map(step => step.run), ['npm ci', 'npm run build']);
  assert.equal(commands[2].shell, 'bash'); assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes('npm run smoke:runtime -- dev 2>&1 | tee'));
  assert.equal(commands[2].env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-category-runtime');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, 'work/ci-category-runtime/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});

test('raw-rename also retains the original macOS development runtime command and submission receipts', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-rename-runtime'];
  assert.equal(job.if, "${{ github.event_name == 'workflow_dispatch' && inputs.checks == 'raw-rename' && !inputs.raw_windows_only }}");
  assert.equal(job['runs-on'], 'macos-latest'); assert.equal(job['timeout-minutes'], 25);
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 2).map(step => step.run), ['npm ci', 'npm run build']);
  assert.equal(commands[2].shell, 'bash'); assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes('npm run smoke:runtime -- dev 2>&1 | tee'));
  assert.equal(commands[2].env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-rename-runtime');
  assert.equal(commands[3].if, "${{ !cancelled() && steps.dependencies.outcome == 'success' }}");
  assert.equal(commands[3].shell, 'bash'); assert.ok(commands[3].run.includes('set -o pipefail'));
  assert.ok(commands[3].run.includes("node --test --test-name-pattern='cancelling the actual observer CLI' tests/ralphex-observe.test.mjs"));
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, 'work/ci-rename-runtime/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('raw-rename can focus only the remaining Windows failure without changing ordinary defaults', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.raw_windows_only.default, false);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const checks of ['full', 'raw-rename']) for (const raw_windows_only of [undefined, false, true]) {
      const context = { github: { event_name: event }, inputs: { checks, raw_windows_only } };
      const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
      if (event === 'workflow_dispatch' && checks === 'raw-rename') assert.deepEqual(active,
        raw_windows_only ? ['focused-raw-rename'] : ['focused-rename-runtime', 'focused-raw-rename']);
      else { assert.deepEqual(active, ['common']); assert.equal(workflow.jobs.verify.if, undefined); }
    }
  }
});


test('issue24-startup runs only original Windows latest category and readiness files with independent results', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-issue24-startup'];
  assert.ok(job);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'issue24-startup' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-issue24-startup'] : ['common']);
  }
  assert.equal(job['runs-on'], 'windows-latest');
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 2).map(step => step.run), ['npm ci', 'npm run build']);
  for (const [step, file] of [[commands[2], 'project-category-move-fixture.test.mjs'], [commands[3], 'rename-editor-readiness.test.mjs']]) {
    assert.equal(step.shell, 'bash'); assert.ok(step.run.includes('set -o pipefail'));
    assert.ok(step.run.includes(`node --import tsx --test tests/${file} 2>&1 | tee`));
    assert.equal(step['continue-on-error'], undefined);
  }
  assert.equal(commands[3].if, "${{ !cancelled() && steps.build.outcome == 'success' && !inputs.startup_category_only }}");
  assert.equal(workflow.on.workflow_dispatch.inputs.startup_category_only.default, false);
  for (const startup_category_only of [undefined, false, true]) {
    const context = { cancelled: () => false, steps: { build: { outcome: 'success' } }, inputs: { startup_category_only } };
    assert.equal(runInNewContext(commands[3].if.slice(3, -2), context), !startup_category_only);
  }
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('readiness union adds the exact macOS packaged creation route only with its explicit flag', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-macos-package-creation'];
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_package_creation.default, false);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of ['full', 'readiness'])
    for (const readiness_package_creation of [undefined, false, true]) {
      const context = { github: { event_name: event }, inputs: { checks, readiness_package_creation } };
      assert.equal(runInNewContext(job.if.slice(3, -2), context), event === 'workflow_dispatch' && checks === 'readiness' && readiness_package_creation === true);
    }
  assert.equal(job['runs-on'], 'macos-latest');
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), [
    'npm ci', 'npm run build', 'node --import tsx --test tests/project-reveal.test.mjs', 'npm run package:built',
    'npm run check:artifact -- release', 'npm run smoke:runtime -- release --creation --discovery-mode=grouped --checkpoint=after_evidence',
  ]);
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('remaining Reveal scope replaces unrelated readiness with the original file on both Windows runners', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-windows-reveal'];
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_reveal_windows.default, false);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of ['full', 'readiness'])
    for (const readiness_reveal_windows of [undefined, false, true]) {
      const context = { github: { event_name: event }, inputs: { checks, readiness_reveal_windows, readiness_package_creation: true } };
      const active = Object.entries(workflow.jobs).filter(([, j]) => j.if && runInNewContext(j.if.slice(3, -2), context)).map(([name]) => name);
      assert.equal(active.includes('focused-windows-reveal'), event === 'workflow_dispatch' && checks === 'readiness' && readiness_reveal_windows === true);
      if (event === 'workflow_dispatch' && checks === 'readiness' && readiness_reveal_windows === true)
        assert.deepEqual(active.sort(), ['focused-macos-package-creation', 'focused-windows-reveal']);
    }
  assert.deepEqual(job.strategy.matrix.os, ['windows-latest', 'windows-2022']); assert.equal(job.strategy['fail-fast'], false);
  const commands = job.steps.filter(step => step.run).map(step => step.run);
  assert.deepEqual(commands.slice(0, 2), ['npm ci', 'npm run build']); assert.equal(commands.length, 8);
  assert.ok(commands[2].includes('set -o pipefail')); assert.ok(commands[2].includes('node --import tsx --test tests/project-reveal.test.mjs tests/windows-project-reveal.test.mjs tests/windows-project-reveal-com.test.mjs tests/windows-ready-selection-com.test.mjs 2>&1 | tee'));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['matrix.os', 'github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('remaining Reveal scope includes the exact Windows latest native failure independently after build', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-windows-reveal'];
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_native_windows.default, false);
  const native = job.steps.find(step => step.name === 'Original Windows latest direct creation native evidence');
  assert.equal(native.run, 'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence');
  assert.ok(job.steps.find(step => step.id === 'reveal-build').run === 'npm run build');
  for (const os of ['windows-latest', 'windows-2022']) for (const build of ['success', 'failure']) for (const flag of [undefined, false, true]) {
    const context = { cancelled: () => false, steps: { 'reveal-build': { outcome: build } }, inputs: { readiness_native_windows: flag }, matrix: { os } };
    const expression = native.if.slice(3, -2).replaceAll('steps.reveal-build', 'steps["reveal-build"]');
    assert.equal(runInNewContext(expression, context), build === 'success' && os === 'windows-latest' && flag === true);
  }
  assert.ok(!native.if.includes('reveal-tests')); // A regression failure cannot skip the original native command.
  assert.ok(native.env.WORKSPACE_SMOKE_EVIDENCE_DIR.startsWith('work/ci-focused-windows-reveal/'));
});


test('native prefix scope retains the exact original UI predecessors and bounded private trace', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_native_prefix.default, false);
  const job = workflow.jobs['focused-windows-reveal'];
  const prefix = job.steps.filter(step => step.name?.includes('predecessor'));
  assert.deepEqual(prefix.map(step => step.run), ['npm run build:ladle', 'node scripts/smoke-discovery-layouts.mjs --creation',
    'node scripts/smoke-discovery-layouts.mjs --category-move', 'npm run smoke:runtime -- dev --creation --skip-native']);
  for (const step of prefix) for (const native of [false, true]) for (const readiness_native_prefix of [undefined, false, true])
    for (const os of ['windows-latest', 'windows-2022']) {
      const context = { cancelled: () => false, steps: { 'reveal-build': { outcome: 'success' } },
        inputs: { readiness_native_windows: native, readiness_native_prefix }, matrix: { os } };
      assert.equal(runInNewContext(step.if.slice(3, -2).replaceAll('steps.reveal-build', 'steps["reveal-build"]'), context),
        native && readiness_native_prefix === true && os === 'windows-latest');
    }
  const native = job.steps.find(step => step.name === 'Original Windows latest direct creation native evidence');
  assert.equal(native.env.WORKSPACE_REVEAL_TRACE, '1');
  assert.ok(job.steps.indexOf(native) > job.steps.indexOf(prefix.at(-1)));
});


test('raw-rename App fixture repair is opt-in and retains its original file without changing Windows checks', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.raw_renderer_check.default, false);
  const job = workflow.jobs['focused-raw-renderer'];
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of ['full', 'raw-rename']) {
    for (const raw_renderer_check of [undefined, false, true]) {
      const context = { github: { event_name: event }, inputs: { checks, raw_renderer_check, raw_windows_only: true } };
      assert.equal(Boolean(runInNewContext(job.if.slice(3, -2), context)),
        event === 'workflow_dispatch' && checks === 'raw-rename' && raw_renderer_check === true);
      if (event === 'workflow_dispatch' && checks === 'raw-rename' && raw_renderer_check) {
        const active = Object.entries(workflow.jobs).filter(([, candidate]) => candidate.if && runInNewContext(candidate.if.slice(3, -2), context)).map(([name]) => name);
        assert.deepEqual(active, ['focused-raw-rename', 'focused-raw-renderer']);
      }
    }
  }
  assert.equal(job['runs-on'], 'macos-latest');
  assert.equal(job.needs, undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 2).map(step => step.run), ['npm ci', 'npm run build:service-test-lib']);
  assert.equal(commands.length, 3);
  assert.equal(commands[2].shell, 'bash');
  assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes('node --import tsx --test tests/renderer-app.test.tsx 2>&1 | tee work/ci-raw-renderer/tests.txt'));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.path, 'work/ci-raw-renderer/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});

test('MultiSelect failure route runs the original macOS packaged command independently after relevant regressions', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'multiselect' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-multiselect'] : ['common']);
  }
  const job = workflow.jobs['focused-multiselect'];
  assert.equal(job['runs-on'], 'macos-latest'); assert.equal(job.needs, undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const regressions = job.steps.find(step => step.id === 'regressions');
  assert.ok(regressions.run.includes('tests/property-editor-driver.test.mjs'));
  assert.ok(regressions.run.includes('tests/multi-select-ui.test.tsx'));
  assert.ok(regressions.run.includes('set -o pipefail'));
  const original = job.steps.find(step => step.run === 'npm run smoke:multiselect -- release');
  assert.equal(original.if, "${{ always() && steps.artifact.outcome == 'success' }}");
  assert.equal(original.env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-focused-multiselect/runtime');
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('ETW failure route runs only the original Windows latest file and retains its failure', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'etw-controls' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-etw-controls'] : ['common']);
  }
  const job = workflow.jobs['focused-etw-controls'];
  assert.equal(job['runs-on'], 'windows-latest'); assert.equal(job.needs, undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.name === 'Original Windows latest ETW regression file');
  assert.equal(original.if, "${{ !cancelled() && steps.install.outcome == 'success' }}");
  assert.equal(original.shell, 'bash'); assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('node --import tsx --test tests/windows-rename-etw.test.mjs 2>&1 | tee work/ci-focused-etw/tests.txt'));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});
