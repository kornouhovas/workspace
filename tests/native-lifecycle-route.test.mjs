import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { load } from 'js-yaml';

test('native lifecycle diagnostics preserve every failed fixture, original concurrency and supported host', () => {
  const workflow = load(readFileSync('.github/workflows/native-lifecycle.yml', 'utf8'));
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.platform.options,
    ['all', 'macos-latest', 'windows-latest', 'windows-2022']);
  assert.equal(workflow.on.workflow_dispatch.inputs.platform.default, 'all');
  assert.equal(workflow.jobs.native.strategy['fail-fast'], false);
  const step = workflow.jobs.native.steps.find(step => step.name === 'Original concurrent native lifecycle fixtures');
  const command = step.run;
  for (const file of ['property-editor-driver', 'runtime-view-readiness', 'runtime-electron-quit', 'rename-editor-readiness']) {
    assert.ok(command.includes(`tests/${file}.test.mjs`));
  }
  assert.ok(!command.includes('--test-concurrency'), 'Keep the original concurrent failure boundary');
  assert.ok(workflow.jobs.native.steps.some(step => step.run === 'npm run build'));
  const artifact = workflow.jobs.native.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(artifact.if, 'always()');
  assert.equal(artifact.with['if-no-files-found'], 'error');
  for (const field of ['github.sha', 'github.run_id', 'github.run_attempt', 'matrix.os']) assert.ok(artifact.with.name.includes(field));
  const desktop = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const selected = desktop.jobs['focused-native-lifecycle'];
  assert.equal(selected.uses, './.github/workflows/native-lifecycle.yml');
  assert.equal(selected.with.platform, 'all');
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of ['full', 'native-lifecycle']) {
    const context = { github: { event_name: event }, inputs: { checks } };
    const focused = event === 'workflow_dispatch' && checks === 'native-lifecycle';
    assert.equal(runInNewContext(selected.if.slice(3, -2), context), focused);
    assert.equal(runInNewContext(desktop.jobs.common.if.slice(3, -2), context), !focused);
  }
});

test('native lifecycle log pipeline propagates an original fixture failure', () => {
  const workflow = load(readFileSync('.github/workflows/native-lifecycle.yml', 'utf8'));
  const command = workflow.jobs.native.steps.find(step => step.name === 'Original concurrent native lifecycle fixtures').run;
  // Exercise the actual selected pipeline; substitute only the deliberately
  // failing producer and a portable sink, not its error-propagation shell.
  const probe = command.replace(/node --import tsx --test[^\n]*? 2>&1/, 'node -e "process.exit(23)" 2>&1')
    .replace('tee work/ci-native-lifecycle/original.log', 'cat');
  assert.ok(probe.includes('process.exit(23)') && !probe.includes('tests/'), 'The negative producer must replace the native test invocation');
  const result = spawnSync('bash', ['-c', probe], { encoding: 'utf8' });
  assert.equal(result.status, 23, result.stderr);
});
