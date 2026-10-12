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
  assert.equal(common.if, undefined);
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
  assert.deepEqual(Object.keys(workflow.jobs).filter(name => !workflow.jobs[name].if).sort(), ['common', 'verify']);
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
