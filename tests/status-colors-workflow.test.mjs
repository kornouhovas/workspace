import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {load} from 'js-yaml';
test('status color route confines focused checks and preserves native packaged evidence on all hosts',()=>{
 const dispatch=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')),workflow=load(readFileSync('.github/workflows/status-colors.yml','utf8'));
 assert.ok(dispatch.on.workflow_dispatch.inputs.checks.options.includes('status-colors'));assert.equal(dispatch.on.workflow_dispatch.inputs.checks.default,'full');
 for(const event of ['push','pull_request','workflow_dispatch'])for(const checks of ['full','status-colors']){
  const context={github:{event_name:event},inputs:{checks}},focused=event==='workflow_dispatch'&&checks==='status-colors';
  assert.equal(runInNewContext(dispatch.jobs['status-colors'].if.slice(3,-2),context),focused);
  assert.equal(runInNewContext(dispatch.jobs.common.if.slice(3,-2),context),!focused);
 }
 assert.equal(dispatch.jobs['status-colors'].uses,'./.github/workflows/status-colors.yml');
 const job=workflow.jobs['status-colors'];assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
 assert.ok(job.steps.some(step=>step.run?.includes('tests/status-colors-service.test.mjs')));
 assert.equal(job.steps.filter(step=>step.run==='npm run smoke:status-colors').length,2);
 assert.equal(job.steps.filter(step=>step.run==='npm run smoke:status-colors')[1].env.WORKSPACE_SMOKE_MODE,'release');
 assert.ok(job.steps.some(step=>step.run==='npm run check:artifact -- release'));
 assert.ok(job.steps.some(step=>step.uses==='actions/upload-artifact@v4'&&step.if==='always()'));
 assert.ok(!job.steps.some(step=>step['continue-on-error']));
});
