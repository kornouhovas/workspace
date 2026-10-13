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
  assert.equal(common.if, "${{ github.event_name != 'workflow_dispatch' || (inputs.checks != 'failed' && inputs.checks != 'readiness' && inputs.checks != 'windows-release' && inputs.checks != 'issue22-failures') }}");
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
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.checks.options, ['full', 'failed', 'readiness', 'windows-release', 'issue22-failures']);
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
  assert.equal(job['runs-on'], 'macos-latest');
  const commands = job.steps.filter(step => step.run).map(step => step.run);
  assert.equal(commands.length, 2);
  assert.equal(commands[0], 'npm ci');
  assert.ok(commands[1].includes('set -o pipefail'));
  assert.ok(commands[1].includes('node --test tests/rename-editor-readiness.test.mjs 2>&1 | tee'));
  const upload = job.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt']) assert.ok(upload.with.name.includes(field));
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
  assert.deepEqual(commands, ['npm ci', 'npm run build', 'node --import tsx --test tests/runtime-lifecycle.test.mjs tests/rename-runtime-startup.test.mjs tests/test-suites.test.mjs', 'npm run package:built', 'npm run check:artifact -- release', 'npm run smoke:runtime -- release']);
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
