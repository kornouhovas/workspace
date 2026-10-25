import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
test('status assignment acceptance selects three hosts, complete suite and actual DEV/package consumers without changing full default',()=>{
 const dispatch=readFileSync('.github/workflows/desktop-ci.yml','utf8'),workflow=readFileSync('.github/workflows/status-moves.yml','utf8');
 assert.match(dispatch,/common:\n {4}if:.*inputs.checks != 'status-moves'/);
 assert.match(dispatch,/options: \[full, status-moves,/);assert.match(dispatch,/default: full/);
 assert.match(dispatch,/inputs.checks == 'status-moves'[\s\S]*?uses: .\/.github\/workflows\/status-moves.yml/);
 assert.match(workflow,/os: \[macos-latest, windows-latest, windows-2022\]/);
 for(const command of ['npm run test:all','node scripts/smoke-status-assignment.mjs','npm run smoke:folder-roles','node scripts/smoke-group-assignment.mjs --filesystem','npm run check:artifact -- release'])assert.ok(workflow.includes(command));
 assert.equal((workflow.match(/run: node scripts\/smoke-status-assignment.mjs/g)||[]).length,2);
 assert.match(workflow,/WORKSPACE_SMOKE_MODE: release/);assert.match(workflow,/if: always\(\)/);assert.match(workflow,/set -o pipefail/);
 assert.ok(!workflow.includes('continue-on-error'));
});

test('routing repair renews only the original failed inventory and runtime tails preserve full defaults',async()=>{
 const {load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const dispatch=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')),workflow=load(readFileSync('.github/workflows/status-moves.yml','utf8'));
 assert.equal(workflow.on.workflow_call.inputs.phase.default,'full');
 for(const [checks,phase] of [['status-moves','full'],['status-moves-routing','routing-repair'],['status-moves-runtime','runtime']]){
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks}};
  assert.equal(runInNewContext(dispatch.jobs.common.if.slice(3,-2),context),false);
  assert.equal(runInNewContext(dispatch.jobs['status-moves'].if.slice(3,-2),context),true);
  assert.equal(runInNewContext(dispatch.jobs['status-moves'].with.phase.slice(3,-2),context),phase);
  const runs=workflow.jobs['status-moves'].steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),{inputs:{phase}}))).map(step=>step.run);
  assert.equal(runs.some(run=>run.includes('npm run test:all')),phase==='full');
  assert.equal(runs.some(run=>run.includes('node --test tests/test-suites.test.mjs tests/status-moves-workflow.test.mjs')),phase==='routing-repair');
  assert.equal(runs.includes('npm run build'),phase!=='routing-repair');
  assert.equal(runs.includes('node scripts/smoke-status-assignment.mjs'),phase!=='routing-repair');
 }
});
