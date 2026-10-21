import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { foundationCommands, runChecks } from '../scripts/desktop-ux-checks.mjs';
test('selected desktop UX check failure stops the profile and propagates a failing exit',()=>{
  const calls=[];
  assert.equal(runChecks([['first',[]],['fails',[]],['unreached',[]]],command=>{calls.push(command);return {status:command==='fails'?23:0};}),23);
  assert.deepEqual(calls,['first','fails']);
  const result=spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','foundation','--failure-probe'],{encoding:'utf8'});
  assert.equal(result.status,23);
});
test('foundation profile retains affected native consumers and real service suites',()=>{
  const text=JSON.stringify(foundationCommands());
  for(const required of ['views-service.test.mjs','table-layout-service.test.mjs','artifact-smoke.test.mjs','smoke:shell','smoke:workspaces','smoke:sources','smoke:views','smoke-visual-foundation.mjs']) assert.ok(text.includes(required),required);
});

test('packaged saved-view gate invokes the actual views entry point',async()=>{
  const { readFile }=await import('node:fs/promises');
  const { load }=await import('js-yaml');
  const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
  const step=workflow.jobs['desktop-ux'].steps.find(step=>step.name==='Packaged saved-view consumers');
  assert.equal(step.run,'npm run smoke:views -- release');
});

test('packaged renewal keeps the original reached runtime and defaults to the complete source profile',async()=>{
  const { readFile }=await import('node:fs/promises');
  const { load }=await import('js-yaml');
  const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.desktop_ux_packaged_only.default,false);
  const steps=workflow.jobs['desktop-ux'].steps;
  assert.ok(steps.find(step=>step.run==='npm run test:desktop-ux').if.includes('!inputs.desktop_ux_packaged_only'));
  assert.equal(steps.find(step=>step.name==='Retained packaged runtime after entry-point repair').run,'npm run smoke:runtime -- release');
});
