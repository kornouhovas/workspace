import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { load } from 'js-yaml';

test('source access route preserves full suite, supported hosts and production packaged enrollment', () => {
  const workflow = load(readFileSync('.github/workflows/source-access.yml', 'utf8'));
  const job=workflow.jobs['source-access'];
  assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
  assert.equal(job.strategy['fail-fast'],false);
  const commands=job.steps.map(step=>step.run).filter(Boolean);
  for(const command of ['npm run build','npm run typecheck','npm run lint','npm run check:docs','npx electron-builder --dir','npm run check:artifact -- release']) assert.ok(commands.includes(command));
  const dev=job.steps.find(step=>step.name==='Development source enrollment');
  const packaged=job.steps.find(step=>step.name==='Packaged source enrollment');
  assert.equal(dev.env.WORKSPACE_SMOKE_MODE,'dev');assert.equal(packaged.env.WORKSPACE_SMOKE_MODE,'release');
  assert.equal(dev.run,'npm run smoke:source-association');assert.equal(packaged.run,dev.run);
  assert.ok(job.steps.indexOf(packaged)>job.steps.findIndex(step=>step.run==='npm run check:artifact -- release'));
  const smoke=readFileSync('scripts/smoke-source-association.mjs','utf8');
  assert.ok(smoke.includes('runtimeSmokeLaunch(root)')&&smoke.includes('...launchOptions'));
  assert.ok(smoke.includes('appAsarSha256')&&smoke.includes('GITHUB_RUN_ATTEMPT'));
  assert.ok(!smoke.includes('unconverted-engine'));
  const artifact=job.steps.find(step=>step.uses==='actions/upload-artifact@v4');
  assert.equal(artifact.if,'always()');assert.equal(artifact.with['if-no-files-found'],'error');
  for(const field of ['github.sha','github.run_id','github.run_attempt','matrix.os'])assert.ok(artifact.with.name.includes(field));
  const desktop = load(readFileSync('.github/workflows/desktop-ci.yml', 'utf8'));
  const selected = desktop.jobs['focused-source-access'];
  assert.equal(selected.uses, './.github/workflows/source-access.yml');
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) for (const checks of ['full', 'source-access']) {
    const context = { github: { event_name: event }, inputs: { checks } };
    const focused = event === 'workflow_dispatch' && checks === 'source-access';
    assert.equal(runInNewContext(selected.if.slice(3, -2), context), focused);
    assert.equal(runInNewContext(desktop.jobs.common.if.slice(3, -2), context), !focused);
  }
});

test('source access log pipeline propagates an original fixture failure', () => {
  const workflow = load(readFileSync('.github/workflows/source-access.yml', 'utf8'));
  const command = workflow.jobs['source-access'].steps.find(step => step.name === 'Complete current suite').run;
  // Exercise the actual selected pipeline; substitute only the deliberately
  // failing producer and a portable sink, not its error-propagation shell.
  const probe = command.replace(/npm run test:all 2>&1/, 'node -e "process.exit(23)" 2>&1')
    .replace('tee work/ci-source-access/full.log', 'cat');
  assert.ok(probe.includes('process.exit(23)') && !probe.includes('tests/'), 'The negative producer must replace the full-suite invocation');
  const result = spawnSync('bash', ['-c', probe], { encoding: 'utf8' });
  assert.equal(result.status, 23, result.stderr);
});
