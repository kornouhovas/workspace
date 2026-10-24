import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { load } from 'js-yaml';
import { selectTestFiles, selectTestBatches, runTestBatches } from '../scripts/test-suites.mjs';

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
  // Evaluate scheduling behavior instead of freezing the expression text.
  // Every focused dispatch must stay outside ordinary common/platform acceptance.
  const enabled = (event, checks) => runInNewContext(common.if.slice(3, -2), {
    github: { event_name: event }, inputs: { checks },
  });
  for (const event of ['push', 'pull_request']) {
    for (const checks of [undefined, ...workflow.on.workflow_dispatch.inputs.checks.options]) assert.equal(enabled(event, checks), true);
  }
  for (const checks of workflow.on.workflow_dispatch.inputs.checks.options) {
    assert.equal(enabled('workflow_dispatch', checks), checks === 'full', checks);
  }
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
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.checks.options, ['full', 'source-access', 'source-access-repair', 'integrated-desktop', 'integrated-regressions', 'integrated-layout', 'integrated-category-layout', 'integrated-operation-layout', 'integrated-archive-profile', 'integrated-fixture-repairs', 'integrated-filesystem-repair', 'integrated-project-entry-repair', 'integrated-category-entry-profile', 'integrated-missing-tails', 'integrated-runtime', 'desktop-ux', 'layout-fixtures', 'source-inventory', 'observer-cancellation', 'observer-workflow', 'native-owner-controls', 'native-lifecycle', 'project-files-windows', 'project-files-windows-trace', 'failed', 'readiness', 'windows-release', 'issue22-failures', 'creation-shutdown', 'raw-rename', 'issue24-failures', 'category-fixture', 'issue24-startup', 'multiselect', 'etw-controls', 'app-fixture', 'property-fixture', 'runtime-observation', 'view-fixtures', 'number', 'windows-property-fixture', 'rename-authoring', 'rename-fixture', 'viewport-runtime', 'workspace-root-runtime', 'archive-contexts', 'creation-ownership', 'desktop-shell', 'shell-runtime', 'views-readiness', 'view-contexts', 'workspace-sidebar', 'workspace-setup', 'workspace-setup-readiness', 'select-readiness', 'source-fixture', 'source-runtime']);
  const enabled = (job, event, checks) => runInNewContext(job.if.slice(3, -2), { github: { event_name: event }, inputs: { checks } });
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of [undefined, 'full', 'failed']) {
    const focused = event === 'workflow_dispatch' && checks === 'failed';
    assert.equal(enabled(workflow.jobs.common, event, checks), !focused);
    for (const name of ['focused-windows-observer', 'focused-macos-rename']) assert.equal(enabled(workflow.jobs[name], event, checks), focused);
  }
  assert.equal(workflow.jobs['focused-windows-observer']['runs-on'], 'windows-latest');
  assert.equal(workflow.jobs['focused-macos-rename']['runs-on'], 'macos-latest');
  const commands = name => workflow.jobs[name].steps.filter(step => step.run).map(step => step.run);
  assert.ok(commands('focused-windows-observer').some(command => command.includes('node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs 2>&1 | tee')));
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
    const job = workflow.jobs[name]; assert.equal(job['runs-on'], name === 'focused-integration-layout' ? '${{ matrix.os }}' : os);
    assert.ok(job.steps.some(step => step.run === command));
    const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
    assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
    for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
  }
});


test('category layout diagnosis selects only the original failed layouts on all affected platforms', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.category_layout_only.default, false);
  const selection=workflow.jobs['focused-integration-layout'].strategy.matrix.os;
  for(const [flag,expected] of [[false,['macos-latest']],[true,['macos-latest','windows-latest','windows-2022']]]) {
    assert.deepEqual(Array.from(runInNewContext(selection.slice(3,-2),{inputs:{category_layout_only:flag},fromJSON:JSON.parse})),expected);
  }
  for (const category_layout_only of [false,true]) {
    const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'failed',integration_failures:true,category_layout_only}};
    const active=Object.entries(workflow.jobs).filter(([,job])=>job.if&&runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name).sort();
    assert.deepEqual(active,category_layout_only?['focused-integration-layout']:['focused-integration-layout','focused-integration-reveal']);
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
  const matrixOs = flag => runInNewContext(job.strategy.matrix.os.slice(3, -2), { inputs: { recovery_windows_2022: flag }, fromJSON: JSON.parse });
  for (const flag of [undefined, false]) assert.deepEqual(matrixOs(flag), ['macos-latest', 'windows-latest']);
  assert.deepEqual(matrixOs(true), ['macos-latest', 'windows-2022']);
  assert.equal(workflow.on.workflow_dispatch.inputs.recovery_windows_2022.default, false);
  assert.equal(job.strategy['fail-fast'], false);
  const commands = job.steps.filter(step => step.run);
  assert.deepEqual(commands.slice(0, 3).map(step => step.run), ['npm ci', 'npm run build', 'node --import tsx --test tests/rename-submission-receipt.test.mjs tests/test-suites.test.mjs']);
  for (const os of ['windows-latest', 'windows-2022', 'macos-latest'])
    assert.equal(runInNewContext(commands[3].if, { matrix: { os } }), os !== 'macos-latest');
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
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), ['npm ci', 'npm run build', `node -e "require('electron')"`, 'node --import tsx --test tests/runtime-electron-quit.test.mjs tests/runtime-quit-evidence.test.mjs tests/runtime-lifecycle.test.mjs tests/property-editor-driver.test.mjs tests/test-suites.test.mjs', 'npm run smoke:runtime -- dev --creation --skip-native']);
  assert.equal(job.steps.find(step => step.id === 'creation-build').run, 'npm run build');
  assert.equal(job.steps.find(step => step.id === 'creation-electron').run, `node -e "require('electron')"`);
  assert.equal(job.steps.find(step => step.name === 'Original creation crash/recovery matrix').if,
    "${{ !cancelled() && steps.creation-build.outcome == 'success' && steps.creation-electron.outcome == 'success' }}");
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.run === 'npm run smoke:runtime -- dev --creation --skip-native');
  assert.equal(original.if, "${{ !cancelled() && steps.creation-build.outcome == 'success' && steps.creation-electron.outcome == 'success' }}"); assert.equal(original.env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-focused-creation-shutdown');
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
  assert.equal(job.if, "${{ github.event_name == 'workflow_dispatch' && ((inputs.checks == 'category-fixture' && inputs.category_fixture_only != true) || inputs.checks == 'runtime-observation') }}");
  assert.equal(job['runs-on'], '${{ matrix.os }}'); assert.equal(job['timeout-minutes'], 25);
  const context = { inputs: { checks: 'category-fixture' }, cancelled: () => false, steps: { runtime_build: { outcome: 'success' } } };
  const commands = job.steps.filter(step => step.run && (!step.if || runInNewContext(step.if.slice(3, -2), context)));
  assert.equal(commands[0].run, 'npm ci'); assert.ok(commands[1].run.includes('npm run build 2>&1 | tee'));
  assert.equal(commands[2].shell, 'bash'); assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes('npm run smoke:runtime -- dev 2>&1 | tee'));
  assert.equal(commands[2].env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-category-runtime');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const upload = job.steps.find(step => step.name === 'Preserve exact-SHA runtime proofs and original result');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, 'work/ci-category-runtime/');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});

test('raw-rename also retains the original macOS development runtime command and submission receipts', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-rename-runtime'];
  const enabled = (checks, raw_windows_only = false) => runInNewContext(job.if.slice(3, -2), { github: { event_name: 'workflow_dispatch' }, inputs: { checks, raw_windows_only } });
  assert.equal(enabled('raw-rename'), true); assert.equal(enabled('raw-rename', true), false);
  assert.equal(enabled('viewport-runtime'), true); assert.equal(enabled('full'), false);
  for (const checks of ['raw-rename', 'viewport-runtime']) {
    const platforms = runInNewContext(job.strategy.matrix.os.slice(3, -2), { inputs: { checks }, fromJSON: JSON.parse });
    assert.deepEqual(Array.from(platforms), checks === 'raw-rename' ? ['macos-latest'] : ['macos-latest', 'windows-latest', 'windows-2022']);
  }
  assert.equal(job['runs-on'], '${{ matrix.os }}'); assert.equal(job['timeout-minutes'], 25);
  const commands = job.steps.filter(step => step.run && !['Viewport draft and keyboard regressions','Source root ownership and capture preparation regressions'].includes(step.name));
  assert.deepEqual(commands.slice(0, 2).map(step => step.run), ['npm ci', 'npm run build']);
  assert.equal(commands[2].shell, 'bash'); assert.ok(commands[2].run.includes('set -o pipefail'));
  assert.ok(commands[2].run.includes('npm run smoke:runtime -- dev 2>&1 | tee'));
  assert.equal(commands[2].env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-rename-runtime');
  assert.equal(commands[3].if, "${{ !cancelled() && inputs.checks == 'raw-rename' && steps.dependencies.outcome == 'success' }}");
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
  for (const native of [undefined, false, true]) for (const early of [undefined, false, true]) {
    const selected = runInNewContext(job.strategy.matrix.os.slice(3, -2), {
      inputs: {readiness_native_windows: native, readiness_native_early: early}, fromJSON: JSON.parse,
    });
    assert.deepEqual(selected, native === true && early === true ? ['windows-latest'] : ['windows-latest', 'windows-2022']);
  }
  assert.equal(job.strategy['fail-fast'], false);
  const commands = job.steps.filter(step => step.run && !step.name?.startsWith('Early original') && step.name !== 'Selected workspace identity and CI inventory regressions' && step.name !== 'Record native host provenance without invoking Explorer').map(step => step.run);
  assert.match(commands[0], /set -o pipefail/);
  assert.match(commands[0], /npm ci --loglevel verbose 2>&1 \| tee work\/ci-focused-windows-reveal\/install.log/);
  assert.equal(commands[1], 'npm run build'); assert.equal(commands.length, 8);
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


test('focused cold originals default to production tracing-off while diagnosis explicitly opts in', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_native_trace.default, false);
  const job = workflow.jobs['focused-windows-reveal'];
  const originals = job.steps.filter(step => step.run === 'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence');
  assert.equal(originals.length, 2);
  for (const step of originals) for (const readiness_native_trace of [undefined, false, true]) {
    const trace = runInNewContext(step.env.WORKSPACE_REVEAL_TRACE.slice(3, -2), { inputs: { readiness_native_trace } });
    assert.equal(trace, readiness_native_trace === true ? '1' : '0');
  }
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
  assert.equal(native.env.WORKSPACE_REVEAL_TRACE, "${{ inputs.readiness_native_trace == true && '1' || '0' }}");
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
  for (const feature of ['multiselect','select']) {
    const development=job.steps.find(step=>step.run===`npm run smoke:${feature} -- dev`);
    assert.equal(development.if,"${{ always() && steps.build.outcome == 'success' }}");
    assert.ok(job.steps.indexOf(development)<job.steps.findIndex(step=>step.id==='package'));
    assert.ok(development.env.WORKSPACE_SMOKE_EVIDENCE_DIR.startsWith('work/ci-focused-multiselect/'));
  }
  const single=job.steps.find(step=>step.run==='npm run smoke:select -- release');
  assert.equal(single.if,"${{ always() && steps.artifact.outcome == 'success' }}");
  assert.equal(single.env.WORKSPACE_SMOKE_EVIDENCE_DIR,'work/ci-focused-multiselect/single-release');

  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('ETW and property fixture route retains the exact failed files on their original OS', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'etw-controls' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-property-fixture', 'focused-etw-controls'] : ['common']);
  }
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'property-fixture' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-property-fixture'] : ['common']);
  }
  const native = workflow.jobs['focused-property-fixture'];
  for(const checks of ['property-fixture','etw-controls'])assert.equal(runInNewContext(native['runs-on'].slice(3,-2),{inputs:{checks}}),'macos-latest');
  assert.equal(native.needs, undefined);
  assert.ok(native.steps.every(step => step['continue-on-error'] === undefined));
  const nativeOriginal = native.steps.find(step => step.name === 'Original property driver regression file');
  assert.equal(nativeOriginal.shell, 'bash'); assert.ok(nativeOriginal.run.includes('set -o pipefail'));
  assert.ok(nativeOriginal.run.includes('node --import tsx --test tests/property-editor-driver.test.mjs 2>&1 | tee work/ci-focused-property-fixture/tests.txt'));
  const nativeUpload = native.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(nativeUpload.if, 'always()'); assert.equal(nativeUpload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(nativeUpload.with.name.includes(field));
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


test('Windows utility exit controls have an exclusive batch while every selected file still runs once', () => {
  const control = 'tests/project-category-move-fixture.test.mjs';
  for (const suite of ['all', 'common', 'platform']) {
    const selected = selectTestFiles(files, suite).map(name => `tests/${name}`);
    for (const platform of ['win32', 'darwin', 'linux']) {
      const batches = selectTestBatches(selected, platform);
      assert.deepEqual(batches.flat().sort(), [...selected].sort());
      assert.equal(new Set(batches.flat()).size, selected.length);
      assert.ok(batches.every(batch => batch.length > 0));
      if (platform === 'win32' && selected.includes(control)) {
        assert.deepEqual(batches[0], [control]);
        assert.ok(!batches[1].includes(control));
      } else assert.deepEqual(batches, [selected]);
    }
  }
});


test('a failed or signaled exclusive batch remains failed after the remaining files pass', () => {
  const batches = [['exclusive'], ['remaining']];
  for (const statuses of [[1, 0], [null, 0], [0, 1], [0, 0]]) {
    const calls = [];
    const exit = runTestBatches(batches, batch => { calls.push(batch); return { status: statuses[calls.length - 1] }; });
    assert.deepEqual(calls, batches);
    assert.equal(exit, statuses.every(status => status === 0) ? 0 : 1);
  }
  const failure = new Error('Test process could not start');
  assert.throws(() => runTestBatches(batches, () => ({ error: failure })), error => error === failure);
});

test('category checkpoint-only selector avoids unrelated historical Windows runtime checks', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.category_fixture_only.default, false);
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const flag of [undefined, false, true]) {
    const context = { github: { event_name: event }, inputs: { checks: 'category-fixture', category_fixture_only: flag } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event !== 'workflow_dispatch' ? ['common']
      : flag === true ? ['focused-category-fixture'] : ['focused-category-fixture', 'focused-category-runtime']);
  }
});


test('App fixture scope matches the original file on both affected Windows runners and preserves failures', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'app-fixture' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-app-fixture'] : ['common']);
  }
  const job = workflow.jobs['focused-app-fixture'];
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.deepEqual(job.strategy.matrix.os, ['windows-latest', 'windows-2022']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.equal(job.steps.find(step => step.id === 'app-build').run, 'npm run build');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const regression = job.steps.find(step => step.name === 'Same-path rejected Reveal feedback regression');
  assert.equal(regression.run, 'node --import tsx --test tests/project-creation-ui.test.tsx');
  const original = job.steps.find(step => step.name === 'Original Windows App regression file');
  assert.equal(original.if, "${{ !cancelled() && steps.app-build.outcome == 'success' }}");
  assert.equal(original.shell, 'bash'); assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('node --import tsx --test tests/renderer-app.test.tsx 2>&1 | tee work/ci-focused-app/tests.txt'));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});

test('Windows latest direct native acceptance runs once before other desktop work and retains every later command', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const original = 'npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence';
  const steps = workflow.jobs.verify.steps;
  const native = steps.filter(step => step.run === original);
  for (const os of ['windows-latest', 'windows-2022', 'macos-latest']) {
    const active = native.filter(step => !step.if || runInNewContext(step.if.slice(3, -2), { matrix: { os } }));
    assert.equal(active.length, 1);
    const index = steps.indexOf(active[0]);
    assert.ok(index > steps.findIndex(step => step.run === 'npm run build'));
    assert.equal(index < steps.findIndex(step => step.run === 'npm run test:platform'), os === 'windows-latest');
    assert.equal(active[0].env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-creation-dev-direct');
    assert.equal(active[0].env.WORKSPACE_REVEAL_TRACE, os === 'windows-latest' ? '1' : undefined);
  }
  for (const command of ['npm run test:platform', 'npm run build:ladle', 'node scripts/smoke-discovery-layouts.mjs --creation',
    'node scripts/smoke-discovery-layouts.mjs --category-move', 'npm run smoke:runtime -- dev --creation --skip-native']) {
    assert.equal(steps.filter(step => step.run === command).length, 1);
  }
  const job = workflow.jobs['focused-windows-reveal'];
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_native_early.default, false);
  const focused = job.steps.filter(step => step.run === original);
  assert.equal(focused.length, 2);
  for (const early of [undefined, false, true]) for (const os of ['windows-latest', 'windows-2022'])
    for (const build of ['success', 'failure']) for (const flag of [undefined, false, true]) {
      const context = { cancelled: () => false, steps: { 'reveal-build': { outcome: build } },
        inputs: { readiness_native_early: early, readiness_native_windows: flag }, matrix: { os } };
      const active = focused.filter(step => runInNewContext(step.if.slice(3, -2).replaceAll('steps.reveal-build', 'steps["reveal-build"]'), context));
      assert.equal(active.length, build === 'success' && flag === true && os === 'windows-latest' ? 1 : 0);
      if (active.length) {
        const index = job.steps.indexOf(active[0]);
        const regressions = job.steps.findIndex(step => step.name === 'Original Reveal file including dirty and stable authority controls');
        assert.equal(index < regressions, early === true);
        assert.equal(runInNewContext(active[0].env.WORKSPACE_REVEAL_TRACE.slice(3, -2), context), '0');
        assert.equal(active[0].env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-focused-windows-reveal/native');
      }
    }
  assert.ok(steps.every(step => step['continue-on-error'] === undefined));
  assert.equal(job.steps.find(step => step.name === 'Original Reveal file including dirty and stable authority controls').if, "${{ !cancelled() && steps.reveal-build.outcome == 'success' }}");
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
});


test('runtime-observation runs both exact Windows runtimes independently of focused diagnosis', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'runtime-observation' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-category-runtime'] : ['common']);
  }
  const job = workflow.jobs['focused-category-runtime'];
  assert.equal(job['runs-on'], '${{ matrix.os }}'); assert.equal(job.strategy['fail-fast'], false);
  for (const checks of ['runtime-observation', 'category-fixture']) {
    assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3, -2), { fromJSON: JSON.parse, inputs: { checks } })),
      checks === 'runtime-observation' ? ['windows-latest', 'windows-2022'] : ['windows-2022']);
  }
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const build = job.steps.find(step => step.id === 'runtime_build');
  assert.ok(build.run.includes('set -o pipefail'));
  assert.ok(build.run.includes('npm run build 2>&1 | tee work/ci-category-runtime/build.txt'));
  assert.equal(build.env.npm_config_loglevel, 'verbose');
  const controls = job.steps.find(step => step.name === 'Retain observer and rename diagnostic controls');
  assert.ok(controls.run.includes('tests/source-observer.test.mjs tests/windows-rename-diagnostics.test.mjs'));
  const controlUpload = job.steps.find(step => step.name === 'Preserve completed control logs before original runtime');
  assert.equal(controlUpload.uses, 'actions/upload-artifact@v4');
  for (const checks of ['runtime-observation', 'category-fixture']) for (const outcome of ['success', 'failure']) for (const isCancelled of [false, true]) {
    assert.equal(runInNewContext(controlUpload.if.slice(3, -2), { cancelled: () => isCancelled, inputs: { checks }, steps: { runtime_build: { outcome } } }),
      !isCancelled && checks === 'runtime-observation' && outcome === 'success');
  }
  assert.equal(controlUpload.with.path.trim(), 'work/ci-category-runtime/controls.txt\nwork/ci-category-runtime/category-controls.txt');
  assert.equal(controlUpload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(controlUpload.with.name.includes(field));
  const comparison = job.steps.find(step => step.name === 'Compare isolated category rename and sharing contexts');
  assert.equal(comparison.run, 'node --import tsx scripts/windows-rename-diagnostics.mjs');
  assert.ok(comparison.if.includes("matrix.os == 'windows-2022'"));
  const category = job.steps.find(step => step.name === 'Minimized original category UI scenario');
  assert.equal(category.run, 'npm run smoke:runtime -- dev --category-move');
  assert.equal(category.env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-category-runtime/minimized-category');
  const original = job.steps.find(step => step.name === 'Original failed development runtime command');
  assert.ok(original.run.includes('npm run smoke:runtime -- dev 2>&1 | tee'));
  assert.equal(original.if, "${{ !cancelled() && steps.runtime_build.outcome == 'success' }}");
  for (const outcome of ['success', 'failure']) {
    const result = runInNewContext(original.if.slice(3, -2), { cancelled: () => false, steps: { 'runtime_build': { outcome } } });
    assert.equal(result, outcome === 'success');
  }
  const upload = job.steps.find(step => step.name === 'Preserve exact-SHA runtime proofs and original result');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
});

test('view fixture scope isolates all three original layout captures and retains exact-run evidence', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const checks of [undefined, 'full', 'view-fixtures']) {
      const context = { github: { event_name: event }, inputs: { checks } };
      const active = Object.entries(workflow.jobs)
        .filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context))
        .map(([name]) => name);
      assert.deepEqual(active, event === 'workflow_dispatch' && checks === 'view-fixtures'
        ? ['focused-view-fixtures'] : ['common']);
    }
  }
  const job = workflow.jobs['focused-view-fixtures'];
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest', 'windows-latest', 'windows-2022']);
  assert.equal(job.strategy['fail-fast'], false);
  const commands = job.steps.filter(step => step.run).map(step => step.run);
  assert.ok(commands.includes('npm ci'));
  assert.ok(commands.includes('node --import tsx --test tests/project-category-move-ui.test.tsx tests/project-rename-ui.test.tsx tests/project-recovery-ui.test.tsx'));
  assert.ok(commands.includes('npm run build:ladle'));
  assert.ok(commands.indexOf('npm run build:ladle') < commands.indexOf('node scripts/smoke-discovery-layouts.mjs --category-move'));
  const original = job.steps.find(step => step.run === 'node scripts/smoke-discovery-layouts.mjs --category-move');
  assert.equal(original.env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-focused-view-fixtures/category-move');
  const provenance = job.steps.find(step => step.name === 'Record focused provenance');
  for (const field of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'process.platform']) assert.ok(provenance.run.includes(field));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('observer-only selector preserves defaults and excludes unrelated macOS runtime', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.observer_fixture_only.default, false);
  for (const observer_fixture_only of [undefined, false, true]) {
    const context = { github: { event_name: 'workflow_dispatch' }, inputs: { checks: 'failed', observer_fixture_only } };
    const enabled = name => runInNewContext(workflow.jobs[name].if.slice(3, -2), context);
    assert.equal(enabled('focused-windows-observer'), true);
    assert.equal(enabled('focused-macos-rename'), observer_fixture_only !== true);
  }
  const steps = workflow.jobs['focused-windows-observer'].steps;
  const original = steps.find(step => step.name === 'Original Windows observer regression files');
  assert.ok(original.run.includes('set -o pipefail'));
  assert.equal(steps.find(step => step.name === 'Retain original observer test output').if, 'always()');
});

test('Number failure selector isolates Windows latest packaged original and preserves independent evidence', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-number'];
  assert.ok(job, 'The original packaged Number failure needs a focused Windows route');
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = { github: { event_name: event }, inputs: { checks: 'number' } };
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-number'] : ['common']);
  }
  assert.equal(job['runs-on'], 'windows-latest');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const build = job.steps.find(step => step.id === 'build');
  assert.ok(build.run.includes('set -o pipefail'));
  const controls = job.steps.find(step => step.name === 'Number creator and route regressions');
  assert.ok(controls.run.includes('tests/property-editor-driver.test.mjs'));
  const original = job.steps.find(step => step.name === 'Original Windows packaged Number command');
  assert.ok(original.run.includes('npm run smoke:number -- release'));
  for(const outcome of ['success','failure']) assert.equal(runInNewContext(original.if.slice(3,-2),{always:()=>true,steps:{artifact:{outcome}}}),outcome==='success');
  const upload=job.steps.find(step=>step.uses==='actions/upload-artifact@v4');
  assert.equal(upload.if,'always()');assert.equal(upload.with['if-no-files-found'],'error');
  for(const field of ['github.sha','github.run_id','github.run_attempt'])assert.ok(upload.with.name.includes(field));
});

test('Windows property creator fixtures run alone before remaining files without changing other platforms', () => {
  const creator='tests/property-editor-driver.test.mjs', other='tests/number-properties-service.test.mjs', category='tests/project-category-move-fixture.test.mjs';
  assert.deepEqual(selectTestBatches([other,creator], 'win32'), [[creator],[other]]);
  assert.deepEqual(selectTestBatches([other,creator,category], 'win32'), [[category],[creator],[other]]);
  for(const platform of ['darwin','linux'])assert.deepEqual(selectTestBatches([other,creator],platform),[[other,creator]]);
});

test('Windows property fixture selector runs only the failed original on Windows latest', () => {
  const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
  for(const event of ['push','pull_request','workflow_dispatch']){
    const context={github:{event_name:event},inputs:{checks:'windows-property-fixture'}};
    const active=Object.entries(workflow.jobs).filter(([,job])=>job.if&&runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name);
    assert.deepEqual(active,event==='workflow_dispatch'?['focused-property-fixture']:['common']);
  }
  const job=workflow.jobs['focused-property-fixture'];
  assert.equal(runInNewContext(job['runs-on'].slice(3,-2),{inputs:{checks:'windows-property-fixture'}}),'windows-latest');
  const original=job.steps.find(step=>step.name==='Original property driver regression file');
  for(const outcome of ['success','failure']) for(const isCancelled of [false,true])
    assert.equal(runInNewContext(original.if.slice(3,-2),{cancelled:()=>isCancelled,steps:{install:{outcome}}}),!isCancelled&&outcome==='success');
});

test('rename authoring selector isolates original Windows latest development runtime and preserves failed controls', () => {
  const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
  const job=workflow.jobs['focused-rename-authoring'];
  assert.ok(job,'The failed Windows latest original needs its own narrow route');
  for(const event of ['push','pull_request','workflow_dispatch']) {
    const active=Object.entries(workflow.jobs).filter(([,job])=>job.if&&runInNewContext(job.if.slice(3,-2),{github:{event_name:event},inputs:{checks:'rename-authoring'}})).map(([name])=>name);
    assert.deepEqual(active,event==='workflow_dispatch'?['focused-rename-authoring']:['common']);
  }
  assert.equal(job['runs-on'],'windows-latest');
  assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
  const original=job.steps.find(step=>step.name==='Original Windows latest development runtime');
  assert.ok(original.run.includes('npm run smoke:runtime -- dev'));
  for(const outcome of ['success','failure']) for(const isCancelled of [false,true])
    assert.equal(runInNewContext(original.if.slice(3,-2),{cancelled:()=>isCancelled,steps:{build:{outcome}}}),!isCancelled&&outcome==='success');
  assert.equal(job.steps.find(step=>step.uses==='actions/upload-artifact@v4').if,'always()');
});

test('rename fixture selector isolates the failed Windows 2022 original and retains strict artifacts',()=>{
  const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
  for(const event of ['push','pull_request','workflow_dispatch']) {
    const active=Object.entries(workflow.jobs).filter(([,job])=>job.if&&runInNewContext(job.if.slice(3,-2),{github:{event_name:event},inputs:{checks:'rename-fixture'}})).map(([name])=>name);
    assert.deepEqual(active,event==='workflow_dispatch'?['focused-rename-fixture']:['common']);
  }
  const job=workflow.jobs['focused-rename-fixture'];
  assert.equal(job['runs-on'],'windows-2022');
  assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
  const original=job.steps.find(step=>step.name==='Original rename fixture regression file');
  assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('node --import tsx --test tests/project-rename-fixture.test.mjs'));
  for(const outcome of ['success','failure']) for(const isCancelled of [false,true])
    assert.equal(runInNewContext(original.if.slice(3,-2),{cancelled:()=>isCancelled,steps:{build:{outcome}}}),!isCancelled&&outcome==='success');
  assert.equal(job.steps.find(step=>step.uses==='actions/upload-artifact@v4').if,'always()');
});

test('macOS installation workflow isolates the original Windows Date failure from full acceptance', () => {
  const workflow = load(readFileSync('.github/workflows/macos-install.yml', 'utf8'));
  const mac = workflow.jobs['macos-install'], date = workflow.jobs['windows-date'];
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const checks of ['macos', 'windows-date', 'windows-install']) {
      const context = { github: { event_name: event }, inputs: { checks } };
      assert.equal(runInNewContext(mac.if.slice(3, -2), context), event !== 'workflow_dispatch' || checks === 'macos');
      assert.equal(runInNewContext(date.if.slice(3, -2), context), event === 'workflow_dispatch' && checks === 'windows-date');
    }
  }
  assert.equal(workflow.on.workflow_dispatch.inputs.checks.default, 'macos');
  assert.equal(mac['runs-on'], 'macos-14'); assert.equal(date['runs-on'], 'windows-latest');
  const original = date.steps.find(step => step.name === 'Original development Date runtime');
  assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('npm run smoke:date -- dev 2>&1 | tee'));
  assert.equal(original.if, "${{ always() && steps.build.outcome == 'success' }}");
  assert.equal(date.steps.at(-1).if, 'always()');
  assert.ok(date.steps.at(-1).with.name.includes('${{ github.sha }}-run-${{ github.run_id }}-attempt-${{ github.run_attempt }}'));
  assert.ok(!date.steps.some(step => step.run?.includes('npm test') || step.run?.includes('test:platform')));
});


test('Windows installer acceptance runs independently without publishing downloads', () => {
  const workflow = load(readFileSync('.github/workflows/macos-install.yml', 'utf8'));
  const job = workflow.jobs['windows-install'];
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const checks of ['macos', 'windows-date', 'windows-install']) {
      assert.equal(runInNewContext(job.if.slice(3, -2), { github: { event_name: event }, inputs: { checks } }),
        event !== 'workflow_dispatch' || checks === 'windows-install');
    }
  }
  assert.equal(job['runs-on'], 'windows-latest');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  assert.ok(job.steps.some(step => step.run?.includes('npm run package:win')));
  assert.ok(job.steps.some(step => step.run?.includes('npm run smoke:install:win')));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.path, 'work/ci-windows-install/');
  assert.ok(upload.with.name.includes('${{ github.sha }}-run-${{ github.run_id }}-attempt-${{ github.run_attempt }}'));
});

test('desktop shell failure route retains the original journey on all affected OSes without invoking full acceptance', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['focused-desktop-shell'];
  const enabled = (event, checks) => runInNewContext(job.if.slice(3, -2), { github: { event_name: event }, inputs: { checks } });
  assert.equal(enabled('workflow_dispatch', 'desktop-shell'), true);
  assert.equal(enabled('workflow_dispatch', 'full'), false);
  assert.equal(enabled('push', 'desktop-shell'), false);
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest', 'windows-latest', 'windows-2022']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.equal(job.needs, undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.name === 'Original desktop shell native journey');
  assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('npm run smoke:shell'));
  assert.equal(runInNewContext(original.if.slice(3, -2), { cancelled: () => false, steps: { build: { outcome: 'success' } } }), true);
  const views = job.steps.find(step => step.name === 'Original Table and Board development lifecycle');
  assert.ok(views.run.includes('npm run smoke:views -- dev'));
  assert.ok(views.run.includes('set -o pipefail'));
  assert.equal(runInNewContext(views.if.slice(3, -2), { cancelled: () => false, steps: { build: { outcome: 'success' } } }), true);
  assert.equal(runInNewContext(views.if.slice(3, -2), { cancelled: () => false, steps: { build: { outcome: 'failure' } } }), false);
  const layouts = job.steps.find(step => step.name === 'Original Windows creation and recovery layouts');
  assert.ok(layouts.run.includes('npm run build:ladle'));
  assert.ok(layouts.run.includes('node scripts/smoke-discovery-layouts.mjs --creation'));
  for (const os of ['windows-2022', 'windows-latest', 'macos-latest']) {
    assert.equal(runInNewContext(layouts.if.slice(3, -2), { cancelled: () => false, steps: { build: { outcome: 'success' } }, matrix: { os } }), os !== 'macos-latest');
  }
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt', 'matrix.os']) assert.ok(upload.with.name.includes(field));
});


test('shell runtime failure selector replays only the affected original commands', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), { github: {event_name: event}, inputs: {checks: 'shell-runtime'} })).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-shell-runtime'] : ['common']);
  }
  const job = workflow.jobs['focused-shell-runtime'];
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  for (const [name, os, command] of [
    ['Original macOS development runtime', 'macos-latest', 'npm run smoke:runtime -- dev'],
  ]) {
    const step = job.steps.find(step => step.name === name);
    assert.ok(step.run.includes(command)); assert.ok(step.run.includes('set -o pipefail'));
    for (const selected of job.strategy.matrix.os) for (const outcome of ['success', 'failure']) {
      assert.equal(runInNewContext(step.if.slice(3, -2), {cancelled: () => false, steps: {build: {outcome}}, matrix: {os: selected}}), (os === 'macos-latest' ? selected === os : selected !== 'macos-latest') && outcome === 'success');
    }
  }
  assert.equal(job.steps.find(step => step.uses === 'actions/upload-artifact@v4').with['if-no-files-found'], 'error');
});


test('views readiness isolates the remaining Windows latest startup failure', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    const active = Object.entries(workflow.jobs).filter(([,job]) => job.if && runInNewContext(job.if.slice(3,-2), {github:{event_name:event}, inputs:{checks:'views-readiness'}})).map(([name]) => name);
    assert.deepEqual(active, event === 'workflow_dispatch' ? ['focused-views-readiness'] : ['common']);
  }
  const job = workflow.jobs['focused-views-readiness'];
  assert.ok(job.steps.find(step => step.id === 'build').run.includes('node -e "require(\'electron\')"'));
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{inputs:{checks:'views-readiness'},fromJSON:JSON.parse})), ['windows-latest']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.name === 'Original development views');
  assert.ok(original.run.includes('npm run smoke:views -- dev')); assert.ok(original.run.includes('set -o pipefail'));
  for (const outcome of ['success','failure']) for (const cancelled of [true,false]) {
    assert.equal(runInNewContext(original.if.slice(3,-2), {cancelled:()=>cancelled,inputs:{checks:'views-readiness'},steps:{build:{outcome}}}), !cancelled && outcome === 'success');
  }
  assert.equal(job.steps.find(step => step.uses === 'actions/upload-artifact@v4').with['if-no-files-found'], 'error');
});

test('workspace sidebar failure route runs only the original failed shell and related regressions', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const context = { github: { event_name:'workflow_dispatch' }, inputs: { checks:'workspace-sidebar' } };
  const active = Object.entries(workflow.jobs).filter(([,job]) => job.if && runInNewContext(job.if.slice(3,-2), context)).map(([name]) => name);
  assert.deepEqual(active, ['focused-workspace-sidebar']);
  const job = workflow.jobs['focused-workspace-sidebar'];
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest','windows-latest','windows-2022']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.equal(job.needs, undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.name === 'Original failed desktop shell journey');
  assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('npm run smoke:shell'));
  assert.ok(!job.steps.some(step => step.run?.includes('smoke:views') || step.run?.includes('test:all') || step.run?.includes('test:platform')));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if,'always()'); assert.equal(upload.with['if-no-files-found'],'error');
  for (const field of ['matrix.os','github.sha','github.run_id','github.run_attempt']) assert.ok(upload.with.name.includes(field));
  const nativeManagement = job.steps.find(step => step.name === 'Workspace setup focus and management native journey');
  assert.ok(nativeManagement.run.includes('npm run smoke:workspaces'));
  assert.ok(nativeManagement.run.includes('set -o pipefail'));
  const full = workflow.jobs.verify;
  const management = full.steps.find(step => step.name === 'Preserve workspace management evidence');
  for (const outcome of ['success','failure','skipped',undefined]) assert.equal(runInNewContext(management.if.slice(3,-2), {always:()=>true,steps:{workspace_management:{outcome}}}), outcome === 'success' || outcome === 'failure');
});

test('workspace Apply readiness failure selects only the original Windows 2022 journey', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const context = { github:{event_name:'workflow_dispatch'},inputs:{checks:'workspace-setup'} };
  assert.deepEqual(Object.entries(workflow.jobs).filter(([,job]) => job.if && runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name),['focused-workspace-setup']);
  const job = workflow.jobs['focused-workspace-setup'];
  assert.equal(job['runs-on'],'windows-2022'); assert.equal(job.needs,undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  const original = job.steps.find(step => step.name === 'Original failed workspace management journey');
  for (const checks of ['workspace-setup','workspace-setup-readiness']) {
    assert.equal(runInNewContext(job.if.slice(3,-2), {github:{event_name:'workflow_dispatch'},inputs:{checks}}), true);
    assert.equal(runInNewContext(original.if.slice(3,-2), {cancelled:()=>false,steps:{build:{outcome:'success'}},inputs:{checks}}), checks === 'workspace-setup');
  }
  assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('npm run smoke:workspaces'));
  assert.ok(!job.steps.some(step => step.run?.includes('smoke:shell') || step.run?.includes('test:platform')));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if,'always()'); assert.equal(upload.with['if-no-files-found'],'error');
  for (const field of ['github.sha','github.run_id','github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('Single Select readiness selects only the original Windows latest packaged journey', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  for (const event_name of ['push', 'pull_request', 'workflow_dispatch']) {
    const context = {github: {event_name}, inputs: {checks: 'select-readiness'}};
    const active = Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name);
    if (event_name === 'workflow_dispatch') assert.deepEqual(active, ['focused-select-readiness']);
    else assert.equal(active.includes('focused-select-readiness'), false);
  }
  const job = workflow.jobs['focused-select-readiness'];
  assert.equal(job['runs-on'], 'windows-latest'); assert.equal(job.needs, undefined);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  assert.ok(job.steps.some(step => step.run === 'npm run package:built'));
  assert.ok(job.steps.some(step => step.run === 'npm run check:artifact -- release'));
  const original = job.steps.find(step => step.name === 'Original failed packaged Single Select journey');
  assert.ok(original.run.includes('set -o pipefail'));
  assert.ok(original.run.includes('npm run smoke:select -- release'));
  assert.equal(runInNewContext(original.if.slice(3, -2), {cancelled: () => false, steps: {artifact: {outcome: 'success'}}}), true);
  assert.ok(!job.steps.some(step => step.run?.includes('test:platform') || step.run?.includes('smoke:workspaces')));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


test('performance readiness repair retains the original strict command after regression failure on both platforms', () => {
  const workflow = load(readFileSync('.github/workflows/performance.yml', 'utf8'));
  const job = workflow.jobs.performance;
  assert.ok(job.strategy.matrix.os.includes('macos-14') && job.strategy.matrix.os.includes('windows-latest'));
  const guardIndex = job.steps.findIndex(step => step.name === 'Verify clipped view readiness before the original measurement');
  const originalIndex = job.steps.findIndex(step => step.name === 'Require candidate correctness and approved targets');
  assert.ok(guardIndex >= 0 && guardIndex < originalIndex);
  const guard = job.steps[guardIndex], original = job.steps[originalIndex];
  assert.equal(guard.if, "${{ !cancelled() && (inputs.readiness_only || steps.candidate-package.outcome == 'success') }}");
  assert.equal(workflow.on.workflow_dispatch.inputs.readiness_only.default, false);
  assert.ok(workflow.concurrency.group.includes("inputs.readiness_only && format('-readiness-{0}', inputs.platform)"), 'Focused readiness cannot cancel full acceptance');
  assert.ok(job.steps.find(step => step.id === 'candidate-package').if.includes('!inputs.readiness_only'));
  for (const step of job.steps.filter(step => step.name?.includes('baseline') || step['working-directory'] === 'baseline-source')) {
    assert.ok(step.if.includes('!inputs.readiness_only'));
  }
  assert.equal(workflow.on.workflow_dispatch.inputs.diagnostic_only.default, false);
  assert.ok(workflow.concurrency.group.includes("inputs.diagnostic_only && format('-diagnostic-{0}', inputs.platform)"));
  const diagnosticGuard=job.steps.find(step=>step.name==='Require a selected diagnostic profile');
  for (const [selected, expected] of [[null,false],['diagnostic_only',true],['profile_backend',true],['profile_unthrottled',true],['profile_projects',true]]) {
    const inputs={diagnostic_only:false,profile_backend:false,profile_unthrottled:false,profile_projects:false};
    if(selected)inputs[selected]=true;
    assert.equal(runInNewContext(diagnosticGuard.if.slice(3,-2),{inputs}),expected);
  }
  assert.equal(workflow.on.workflow_dispatch.inputs.profile_projects.default,false);
  assert.equal(diagnosticGuard.env.PROFILE_PROJECTS,'${{ inputs.profile_projects }}');
  assert.equal(diagnosticGuard.env.DIAGNOSTIC_ONLY,'${{ inputs.diagnostic_only }}');
  const diagnosticSource=diagnosticGuard.run.match(/^node -e "(.*)"$/)[1];
  for(const [diagnostic,filters,valid] of [['false','true',false],['true','false',false],['true','true',true]]) {
    const run=()=>runInNewContext(diagnosticSource,{process:{env:{PROFILE_PROJECTS:'true',DIAGNOSTIC_ONLY:diagnostic,PROFILE_FILTERS:filters}}});
    if(valid)assert.doesNotThrow(run);else assert.throws(run,/Project profiling requires isolated diagnostic renderer profiles/);
  }
  assert.equal(workflow.on.workflow_dispatch.inputs.profile_unthrottled.default,false);
  assert.equal(diagnosticGuard.env.PROFILE_UNTHROTTLED,'${{ inputs.profile_unthrottled }}');
  assert.ok(diagnosticGuard.run.includes("Scheduling diagnostics require renderer profiles"));
  assert.ok(diagnosticGuard.run.includes("Backend diagnostics require renderer profiles"));
  assert.equal(workflow.on.workflow_dispatch.inputs.profile_backend.default,false);
  assert.ok(diagnosticGuard.run.includes("throw new Error('Select a diagnostic profile')"));
  assert.ok(diagnosticGuard.run.includes("process.env.READINESS_ONLY === 'true'"));
  assert.equal(diagnosticGuard.env.READINESS_ONLY,'${{ inputs.readiness_only }}');
  assert.equal(original.if, "${{ !cancelled() && !inputs.diagnostic_only && steps.candidate-package.outcome == 'success' }}", 'The original still runs after a failed regression if packaging passed');
  assert.ok(guard.run.includes('set -o pipefail') && guard.run.includes('node --test tests/runtime-view-readiness.test.mjs'));
  assert.ok(original.run.includes('set -o pipefail') && original.run.includes('node scripts/smoke-performance.mjs --enforce'));
  assert.equal(original.env.WORKSPACE_SMOKE_EVIDENCE_DIR, 'work/ci-performance/candidate');
});

test('unreached Windows runtime renewal can select only its missing host while preserving both-host default', () => {
  const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
  const input=workflow.on.workflow_dispatch.inputs.source_runtime_platform;
  assert.equal(input.default,'all');
  assert.deepEqual(input.options,['all','windows-latest','windows-2022','all-desktops','runtime-tails','package-tails','package-windows-latest']);
  const job=workflow.jobs['source-runtime'];
  const select=platform=>runInNewContext(job.strategy.matrix.include.slice(3,-2),{fromJSON:JSON.parse,inputs:{source_runtime_platform:platform}});
  for(const platform of [undefined,'all','windows-latest','windows-2022']) {
    assert.deepEqual(Array.from(select(platform),row=>row.os),platform&&platform!=='all'?[platform]:['windows-latest','windows-2022']);
  }
  const commands=job.steps.filter(step=>step.run).map(step=>step.run);
  for(const mode of ['dev','release']) {
    assert.ok(commands.includes(`npm run smoke:views -- ${mode}`));
    assert.ok(commands.includes(`npm run smoke:runtime -- ${mode}`));
  }
  assert.ok(!commands.includes('npm test'));
  assert.match(job.steps.find(step=>step.run==='npm run test:platform').if, /all-desktops.*windows-latest/);
  assert.equal(job.steps.find(step=>step.run==='npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence').if,"${{ (matrix.os != 'windows-latest' || inputs.source_runtime_platform == 'runtime-tails') && (inputs.source_runtime_platform != 'package-tails' && inputs.source_runtime_platform != 'package-windows-latest') }}");
});


test('early direct creation renews visible workspace identity and inventory without replacing the original consumer', () => {
  const job = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8')).jobs['focused-windows-reveal'];
  const original = job.steps.findIndex(step => step.name === 'Early original Windows latest direct creation native evidence');
  const regression = job.steps.findIndex(step => step.name === 'Selected workspace identity and CI inventory regressions');
  assert.ok(regression > original);
  assert.match(job.steps[regression].run, /set -o pipefail/);
  assert.match(job.steps[regression].run, /node --test tests\/runtime-workspace-identity.test.mjs tests\/test-suites.test.mjs/);
  assert.equal(job.steps[regression]['continue-on-error'], undefined);
});

test('explicit all-desktops continuation renews missing full prefix only on Windows latest', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['source-runtime'];
  assert.ok(workflow.on.workflow_dispatch.inputs.source_runtime_platform.options.includes('all-desktops'));
  const rows = runInNewContext(job.strategy.matrix.include.slice(3,-2), { fromJSON: JSON.parse, inputs: { source_runtime_platform: 'all-desktops' } });
  assert.deepEqual(Array.from(rows, row => row.os), ['macos-latest', 'windows-latest', 'windows-2022']);
  const original = workflow.jobs.verify.steps;
  const prefixCommands = ['npm run smoke:shell', 'npm run smoke:workspaces', 'npm run smoke:sources', 'npm run test:platform'];
  for (const command of prefixCommands) {
    const step = job.steps.find(candidate => candidate.run === command);
    assert.ok(step, command);
    assert.deepEqual(step.env, original.find(candidate => candidate.run === command).env);
    for (const platform of ['all', 'windows-latest', 'all-desktops']) for (const os of ['macos-latest', 'windows-latest', 'windows-2022']) {
      assert.equal(runInNewContext(step.if.slice(3,-2), { inputs: {source_runtime_platform: platform}, matrix: {os} }), platform === 'all-desktops' && os === 'windows-latest');
    }
  }
  const regressions = job.steps.find(step => step.name === 'Renew workspace identity and failed CI inventory');
  assert.match(regressions.run, /set -o pipefail/);
  assert.match(regressions.run, /tests\/runtime-workspace-identity.test.mjs tests\/test-suites.test.mjs/);
  assert.equal(regressions['continue-on-error'], undefined);
  const validation = job.steps.find(step => step.name === 'Validate the original full-suite collector document');
  assert.equal(validation.run, original.find(step => step.name === validation.name).run);
  assert.match(validation.if, /always\(\).*all-desktops.*windows-latest/);
  const collector = job.steps.find(step => step.name === 'Preserve the validated original collector call including failures');
  assert.match(collector.if, /always\(\).*all-desktops.*windows-latest.*observer-call-validation.outcome/);
  assert.equal(collector.with['if-no-files-found'], 'error');
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
});


test('desktop manual dispatch stays within the supported input limit', () => {
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(Object.keys(workflow.on.workflow_dispatch.inputs).length<=25);
});


test('native owner control renewal isolates the original failed file without repeating passed application consumers', () => {
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
 const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'native-owner-controls'}};
 assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>job.if&&runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name),['native-owner-controls']);
 const job=workflow.jobs['native-owner-controls'];assert.equal(job['runs-on'],'windows-latest');
 const runs=job.steps.filter(step=>step.run);assert.equal(runs.length,1);
 assert.match(runs[0].run,/set -o pipefail/);
 assert.match(runs[0].run,/node --test tests\/windows-native-view-diagnostics.test.mjs tests\/windows-process-owner.test.mjs/);
 assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
 assert.equal(job.steps.at(-1).if,'always()');assert.equal(job.steps.at(-1).with['if-no-files-found'],'error');
});


test('observer workflow renewal runs only original failed controls and retains collector validation on every affected host', () => {
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
 const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'observer-workflow'}};
 assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>job.if&&runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name),['observer-workflow']);
 const job=workflow.jobs['observer-workflow'];
 assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
 assert.equal(job.strategy['fail-fast'],false);
 const test=job.steps.find(step=>step.name==='Original observer file and workflow inventory');
 assert.match(test.run,/set -o pipefail/);assert.match(test.run,/node --test tests\/windows-observer-diagnostics.test.mjs tests\/test-suites.test.mjs/);
 assert.equal(test.env.OBSERVER_MATRIX,'${{ matrix.os }}');
 assert.equal(job.steps.find(step=>step.name==='Validate the original retained collector').if,'always()');
 assert.equal(job.steps.at(-1).if,'always()');assert.equal(job.steps.at(-1).with['if-no-files-found'],'error');
 assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
});


test('observer cancellation renewal isolates the original file on every fixture consumer host', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const context = { github: { event_name: 'workflow_dispatch' }, inputs: { checks: 'observer-cancellation' } };
  assert.deepEqual(Object.entries(workflow.jobs).filter(([, job]) => job.if && runInNewContext(job.if.slice(3, -2), context)).map(([name]) => name), ['observer-cancellation']);
  const job = workflow.jobs['observer-cancellation'];
  assert.deepEqual(job.strategy.matrix.os, ['macos-latest', 'windows-latest', 'windows-2022']);
  assert.equal(job.strategy['fail-fast'], false);
  const command = job.steps.find(step => step.name === 'Original observer file including partial-publication regression').run;
  assert.match(command, /set -o pipefail/);
  assert.match(command, /node --test tests\/ralphex-observe.test.mjs tests\/test-suites.test.mjs 2>&1 \| tee/);
  assert.ok(job.steps.every(step => step['continue-on-error'] === undefined));
  assert.equal(job.steps.at(-1).if, 'always()');
  assert.equal(job.steps.at(-1).with['if-no-files-found'], 'error');
});

test('runtime tails renew every shared story consumer and original missing modes without replaying passed platform suites', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const job = workflow.jobs['source-runtime'];
  const context = os => ({ inputs: {source_runtime_platform:'runtime-tails'}, matrix:{os}, fromJSON:JSON.parse });
  const rows = runInNewContext(job.strategy.matrix.include.slice(3,-2), context('macos-latest'));
  assert.deepEqual(Array.from(rows, row => row.os), ['macos-latest','windows-latest','windows-2022']);
  for (const {os} of rows) {
    const active = job.steps.filter(step => step.run && (!step.if || runInNewContext(step.if.slice(3,-2), {...context(os), always:()=>true})));
    const commands = active.map(step => step.run);
    assert.ok(!commands.includes('npm run test:platform'));
    assert.ok(!commands.includes('npm run smoke:shell'));
    assert.ok(commands.includes('node scripts/smoke-discovery-layouts.mjs'));
    assert.ok(!commands.includes('node scripts/smoke-discovery-layouts.mjs --category-move'));
    assert.ok(!commands.includes('node scripts/smoke-discovery-layouts.mjs --creation'));
    assert.ok(commands.includes('npm run smoke:runtime -- dev --creation --discovery-mode=direct --checkpoint=after_evidence'));
    for (const mode of ['dev','release']) {
      for (const feature of ['views','multiselect','select','date','number','archive','data-recovery','category-options']) {
        assert.ok(commands.includes(`npm run smoke:${feature} -- ${mode}`), `${os} ${feature} ${mode}`);
      }
      assert.ok(commands.includes(`npm run smoke:runtime -- ${mode}`));
    }
    assert.ok(active.findIndex(step=>step.run==='node scripts/smoke-discovery-layouts.mjs') < active.findIndex(step=>step.name==='Development creation crash/recovery matrix'));
  }
  assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
  const upload = job.steps.find(step=>step.with?.path?.includes('work/ci-all-layouts/'));
  assert.equal(upload.if,'always()');
});


test('source inventory repair isolates the original failed command before runtime renewal', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const context = {github:{event_name:'workflow_dispatch'}, inputs:{checks:'source-inventory'}};
  assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>job.if && runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name), ['source-inventory']);
  const job = workflow.jobs['source-inventory'];
  assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
  const run = job.steps.find(step=>step.name==='Original failed continuation guard and companion controls').run;
  assert.match(run,/set -o pipefail/);
  const original = workflow.jobs['source-runtime'].steps.find(step=>step.name==='Renew workspace identity and failed CI inventory').run;
  assert.ok(run.includes(original.trim().split('\n').at(-1).split(' 2>&1')[0]));
  assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
  assert.equal(job.steps.at(-1).if,'always()');
  assert.equal(job.steps.at(-1).with['if-no-files-found'],'error');
});


test('shared layout failure renewal retains the unfiltered original command and all failed hosts', () => {
  const workflow = load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
  const context = {github:{event_name:'workflow_dispatch'},inputs:{checks:'layout-fixtures'}};
  assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>job.if && runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name),['layout-fixtures']);
  const job = workflow.jobs['layout-fixtures'];
  assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
  assert.equal(job.strategy['fail-fast'],false);
  assert.deepEqual(job.steps.filter(step=>step.run && !step.name).map(step=>step.run),['npm ci','npm run build:renderer',`node -e "require('electron')"`,'node --test tests/category-header-layout-native.test.mjs tests/view-scroll-native.test.mjs','npm run build:ladle','node scripts/smoke-discovery-layouts.mjs']);
  assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
  assert.equal(job.steps.at(-1).if,'always()');
  assert.equal(job.steps.at(-1).with['if-no-files-found'],'error');
});


test('source-root runtime renewal isolates the original failed command and native ownership/layout regressions on all failed hosts',()=>{
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
 const inputs={checks:'workspace-root-runtime'};
 const context={github:{event_name:'workflow_dispatch'},inputs,fromJSON:JSON.parse,cancelled:()=>false};
 const active=Object.entries(workflow.jobs).filter(([,job])=>job.if && runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name);
 assert.deepEqual(active,['focused-rename-runtime']);
 const job=workflow.jobs['focused-rename-runtime'];
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const controls=job.steps.find(step=>step.name==='Source root ownership and capture preparation regressions');
 assert.equal(runInNewContext(controls.if.slice(3,-2),context),true);
 assert.ok(controls.run.includes('node --test tests/runtime-workspace-identity.test.mjs tests/runtime-layout.test.mjs tests/test-suites.test.mjs'));
 assert.ok(controls.run.includes('set -o pipefail') && controls.run.includes('provenance.json'));
 assert.equal(runInNewContext(job.steps.find(step=>step.name==='Viewport draft and keyboard regressions').if.slice(3,-2),context),false);
 assert.equal(runInNewContext(job.steps.find(step=>step.name==='Original observer CLI cancellation cases').if.slice(3,-2),context),false);
 const original=job.steps.find(step=>step.name==='Original failed development runtime command');
 assert.ok(original.run.includes('npm run smoke:runtime -- dev 2>&1 | tee'));
 assert.equal(original.env.WORKSPACE_SMOKE_EVIDENCE_DIR,'work/ci-rename-runtime');
 assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));
 const upload=job.steps.at(-1);assert.equal(upload.if,'always()');assert.equal(upload.with['if-no-files-found'],'error');
 for(const field of ['github.sha','github.run_id','github.run_attempt']) assert.ok(upload.with.name.includes(field));
});


for (const choice of ['archive-contexts','creation-ownership']) test(`retained ${choice} renews exact consumers on all supported hosts`,()=>{
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
 const context={github:{event_name:'workflow_dispatch'},inputs:{checks:choice}};
 assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>job.if && runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name),[`focused-${choice}`]);
 const job=workflow.jobs[`focused-${choice}`];assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);assert.equal(job.strategy['fail-fast'],false);
 const commands=job.steps.filter(step=>step.run).map(step=>step.run);
 assert.ok(commands.indexOf(`node -e "require('electron')"`)<commands.findIndex(command=>command.includes(' --test ')));
 const regression=commands.find(command=>command.includes(' --test '));assert.match(regression,/set -o pipefail/);
 if(choice==='archive-contexts')for(const mode of ['dev','release'])for(const feature of ['archive','category-options'])assert.ok(commands.includes(`npm run smoke:${feature} -- ${mode}`));
 else for(const suffix of ['--skip-native','--discovery-mode=direct --checkpoint=after_evidence','--discovery-mode=grouped --checkpoint=after_evidence'])assert.ok(commands.includes(`npm run smoke:runtime -- dev --creation ${suffix}`));
 assert.ok(job.steps.every(step=>step['continue-on-error']===undefined));const upload=job.steps.at(-1);assert.equal(upload.if,'always()');assert.equal(upload.with['if-no-files-found'],'error');for(const field of ['github.sha','github.run_id','github.run_attempt'])assert.ok(upload.with.name.includes(field));
});

test('package tails retain only missing recovery and packaged consumers after inspected focused success',()=>{
 const job=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')).jobs['source-runtime'];
 const context=os=>({inputs:{source_runtime_platform:'package-tails'},matrix:{os},fromJSON:JSON.parse,always:()=>true});
 const rows=runInNewContext(job.strategy.matrix.include.slice(3,-2),context('macos-latest'));assert.deepEqual(Array.from(rows,row=>row.os),['macos-latest','windows-latest','windows-2022']);
 for(const {os} of rows){
  const commands=job.steps.filter(step=>step.run && (!step.if || runInNewContext(step.if.slice(3,-2),context(os)))).map(step=>step.run);
  assert.ok(commands.includes('npm run build'));assert.ok(commands.includes('npm run build:ladle'));assert.ok(commands.includes('npm run smoke:data-recovery -- dev'));assert.ok(commands.includes('npm run package:built'));assert.ok(commands.includes('npm run check:artifact -- release'));
  for(const feature of ['views','multiselect','select','date','number','archive','data-recovery','category-options'])assert.ok(commands.includes(`npm run smoke:${feature} -- release`));
  for(const suffix of ['', ' --creation --skip-native',' --creation --discovery-mode=direct --checkpoint=after_evidence',' --creation --discovery-mode=grouped --checkpoint=after_evidence'])assert.ok(commands.includes(`npm run smoke:runtime -- release${suffix}`));
  assert.ok(!commands.includes('npm run test:platform'));assert.ok(!commands.some(command=>command.startsWith('node scripts/smoke-discovery-layouts.mjs')));assert.ok(!commands.some(command=>command.startsWith('npm run smoke:runtime -- dev')));
  assert.deepEqual(commands.filter(command=>/^npm run smoke:.* -- dev$/.test(command)),os==='windows-latest'?['views','multiselect','select','date','number','data-recovery'].map(feature=>`npm run smoke:${feature} -- dev`):['npm run smoke:data-recovery -- dev']);
 }
});


test('view contexts renew only the actual Views consumer in both modes on three hosts',()=>{
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'view-contexts'},fromJSON:JSON.parse};
 assert.deepEqual(Object.entries(workflow.jobs).filter(([,job])=>job.if && runInNewContext(job.if.slice(3,-2),context)).map(([name])=>name),['focused-views-readiness']);
 const job=workflow.jobs['focused-views-readiness'];assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const active=job.steps.filter(step=>!step.if || runInNewContext(step.if==='always()'?step.if:step.if.slice(3,-2),{...context,cancelled:()=>false,always:()=>true,steps:{build:{outcome:'success'},view_package:{outcome:'success'},view_artifact:{outcome:'success'}}}));
 const commands=active.filter(step=>step.run).map(step=>step.run);assert.ok(commands.some(command=>command.includes('tests/view-actions-native.test.mjs')));
 for(const mode of ['dev','release']){const command=commands.find(command=>command.includes(`npm run smoke:views -- ${mode}`));assert.ok(command);assert.ok(!command.includes('for attempt'));assert.ok(command.includes('set -o pipefail'));}
 assert.ok(commands.includes('npm run package:built'));assert.ok(commands.includes('npm run check:artifact -- release'));assert.ok(!commands.includes('npm run test:platform'));
 assert.equal(active.at(-1).if,'always()');assert.equal(active.at(-1).with['if-no-files-found'],'error');
});

test('package Windows latest continuation preserves missing dev and packaged rows without other hosts',()=>{
 const job=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')).jobs['source-runtime'];const context={inputs:{source_runtime_platform:'package-windows-latest'},matrix:{os:'windows-latest'},fromJSON:JSON.parse,always:()=>true};
 const rows=runInNewContext(job.strategy.matrix.include.slice(3,-2),context);assert.deepEqual(Array.from(rows,row=>row.os),['windows-latest']);
 const commands=job.steps.filter(step=>step.run && (!step.if || runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 for(const feature of ['views','multiselect','select','date','number','data-recovery'])assert.ok(commands.includes(`npm run smoke:${feature} -- dev`));
 for(const feature of ['views','multiselect','select','date','number','archive','data-recovery','category-options'])assert.ok(commands.includes(`npm run smoke:${feature} -- release`));
 for(const suffix of ['', ' --creation --skip-native',' --creation --discovery-mode=direct --checkpoint=after_evidence',' --creation --discovery-mode=grouped --checkpoint=after_evidence'])assert.ok(commands.includes(`npm run smoke:runtime -- release${suffix}`));
 assert.ok(commands.includes('npm run package:built'));assert.ok(commands.includes('npm run check:artifact -- release'));assert.ok(!commands.includes('npm run test:platform'));assert.ok(!commands.some(command=>command.startsWith('node scripts/smoke-discovery-layouts.mjs')));assert.ok(!commands.some(command=>command.startsWith('npm run smoke:runtime -- dev')));
});
