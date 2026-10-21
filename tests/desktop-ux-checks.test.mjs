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
