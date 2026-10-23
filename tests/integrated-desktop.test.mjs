import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { load } from 'js-yaml';

test('integrated package acceptance propagates a failed journey and records unreached consumers', async () => {
  const evidence = await mkdtemp(join(tmpdir(), 'workspace-integration-probe-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/integrated-desktop.mjs', '--failure-probe'], {
      env: { ...process.env, WORKSPACE_SMOKE_EVIDENCE_DIR: evidence, WORKSPACE_PERFORMANCE_ROOT: 'another-candidate', WORKSPACE_REVEAL_TRACE: '1' }, encoding: 'utf8',
    });
    assert.equal(result.status, 23, result.stderr);
    const report = JSON.parse(await readFile(join(evidence, 'report.json'), 'utf8'));
    assert.equal(report.diagnostic, true);
    assert.equal(report.completeSelection, false);
    assert.equal(report.status, 'failed');
    assert.equal(report.journeys[0].exitCode, 23);
    assert.equal(report.journeys[0].status, 'failed');
    assert.ok(report.journeys.slice(1).every(row => row.status === 'unreached'));
    const childEnvironment = JSON.parse((await readFile(join(evidence, 'failure-probe/runtime.log'), 'utf8')).trim());
    assert.equal(childEnvironment.performanceRoot, resolve('.'));
    assert.equal(childEnvironment.revealTrace, '0');
  } finally { await rm(evidence, { recursive: true, force: true }); }
});

test('unknown integration selections fail before launching an application', () => {
  const result = spawnSync(process.execPath, ['scripts/integrated-desktop.mjs', '--from=missing'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown integrated journey/);
});

test('registered desktop dispatch isolates integrated acceptance and retains ordinary full defaults', async () => {
  const workflow = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('integrated-desktop'));
  const integrated = workflow.jobs['integrated-desktop'];
  const enabled = (job, event, checks) => runInNewContext(job.if.slice(3, -2), {
    github: { event_name: event }, inputs: { checks },
  });
  for (const checks of ['integrated-desktop', 'integrated-regressions', 'integrated-runtime']) {
    assert.equal(enabled(integrated, 'workflow_dispatch', checks), true);
    assert.equal(enabled(workflow.jobs.common, 'workflow_dispatch', checks), false);
  }
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    assert.equal(enabled(integrated, event, 'full'), false);
    assert.equal(enabled(workflow.jobs.common, event, 'full'), true);
  }
  assert.deepEqual(integrated.strategy.matrix.os, ['macos-latest', 'windows-latest', 'windows-2022']);
  const commands = integrated.steps.filter(step => step.run).map(step => step.run);
  assert.ok(commands.some(command => command.includes('set -o pipefail') && command.includes('npm run test:all')));
  assert.ok(commands.indexOf('npm run package:built') < commands.findIndex(command => command.includes('node scripts/integrated-desktop.mjs')));
  const upload = integrated.steps.find(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
  const selected = checks => integrated.steps.filter(step => step.run && (!step.if || runInNewContext(step.if.slice(3, -2), { inputs: { checks } }))).map(step => step.run);
  const focused = selected('integrated-regressions');
  assert.ok(focused.some(command => command.includes('node --test tests/windows-install.test.mjs tests/test-suites.test.mjs')));
  assert.ok(!focused.some(command => /test:all|package:built|smoke-discovery-layouts|node scripts\/integrated-desktop/.test(command)));
  const tail = selected('integrated-runtime');
  assert.ok(!tail.some(command => command.includes('test:all')));
  assert.ok(tail.includes('npm run package:built'));
  assert.ok(tail.some(command => command.includes('node scripts/integrated-desktop.mjs')));
});
