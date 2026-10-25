import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
for(const ending of ['\n','\r\n']) test(`status acceptance preserves commands and guards with ${ending==='\n'?'LF':'CRLF'} workflow files`,()=>{
 const dispatch=readFileSync('.github/workflows/desktop-ci.yml','utf8').replace(/\r?\n/g,ending),workflow=readFileSync('.github/workflows/status-moves.yml','utf8').replace(/\r?\n/g,ending);
 assert.match(dispatch,/common:\r?\n {4}if:.*inputs.checks != 'status-moves'/);
 const choices=load(dispatch).on.workflow_dispatch.inputs.checks;
 assert.ok(choices.options.includes('status-moves'));assert.equal(choices.default,'full');
 assert.match(dispatch,/inputs.checks == 'status-moves'[\s\S]*?uses: .\/.github\/workflows\/status-moves.yml/);

 for(const command of ['npm run test:all','node scripts/smoke-status-assignment.mjs','npm run smoke:folder-roles','node scripts/smoke-group-assignment.mjs --filesystem','npm run check:artifact -- release'])assert.ok(workflow.includes(command));
 assert.equal((workflow.match(/run: node scripts\/smoke-status-assignment.mjs/g)||[]).length,2);
 assert.match(workflow,/WORKSPACE_SMOKE_MODE: release/);assert.match(workflow,/if: always\(\)/);assert.match(workflow,/set -o pipefail/);
 assert.ok(!workflow.includes('continue-on-error'));
});

test('routing repair renews only the original failed inventory and runtime tails preserve full defaults',async()=>{
 const {load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const dispatch=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')),workflow=load(readFileSync('.github/workflows/status-moves.yml','utf8'));
 assert.equal(workflow.on.workflow_call.inputs.phase.default,'full');
 for(const [checks,phase] of [['status-moves','full'],['status-moves-routing','routing-repair'],['status-moves-runtime','runtime'],['status-moves-entry-repair','entry-repair'],['status-moves-native-renewal','native-renewal']]){
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks}};
  assert.equal(runInNewContext(dispatch.jobs.common.if.slice(3,-2),context),false);
  assert.equal(runInNewContext(dispatch.jobs['status-moves'].if.slice(3,-2),context),true);
  assert.equal(runInNewContext(dispatch.jobs['status-moves'].with.phase.slice(3,-2),context),phase);
  const matrix=workflow.jobs['status-moves'].strategy.matrix.os;
  assert.deepEqual(Array.from(runInNewContext(matrix.slice(3,-2),{inputs:{phase},fromJSON:JSON.parse})),phase==='routing-repair'?['windows-latest','windows-2022']:phase==='entry-repair'?['macos-latest','windows-latest']:['macos-latest','windows-latest','windows-2022']);
  const scheduled=os=>workflow.jobs['status-moves'].steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),{inputs:{phase},matrix:{os}}))).map(step=>step.run);
  const runs=scheduled('macos-latest');
  assert.equal(runs.some(run=>run.includes('npm run test:all')),phase==='full');
  assert.equal(runs.some(run=>run.includes('node --test tests/test-suites.test.mjs tests/status-moves-workflow.test.mjs')),phase==='routing-repair');
  assert.equal(runs.some(run=>run.includes('tests/project-category-move-ui.test.tsx')),phase==='runtime');
  assert.equal(runs.includes('npm run build'),phase!=='routing-repair');
  assert.equal(runs.includes('node scripts/smoke-status-assignment.mjs'),phase!=='routing-repair');
  assert.equal(runs.includes('npx electron-builder --dir'),['full','runtime','native-renewal'].includes(phase));
  assert.equal(runs.includes('npm run smoke:folder-roles'),['full','runtime','native-renewal'].includes(phase));
  for(const os of ['macos-latest','windows-latest','windows-2022']){
   const commands=scheduled(os);
   const statusCount=commands.filter(run=>run==='node scripts/smoke-status-assignment.mjs').length;
   assert.equal(statusCount,phase==='routing-repair'?0:phase==='entry-repair'?1:phase==='native-renewal'?(os==='windows-2022'?2:1):2);
   assert.equal(commands.filter(run=>run==='npm run smoke:folder-roles').length,['full','runtime'].includes(phase)||phase==='native-renewal'&&os!=='windows-2022'?2:0);
   assert.equal(commands.includes('node scripts/smoke-group-assignment.mjs --filesystem'),['full','runtime'].includes(phase)||phase==='native-renewal'&&os!=='windows-2022');
  }
 }
});
