import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {load} from 'js-yaml';
import {commandSafetyJourneys} from '../scripts/command-safety-acceptance.mjs';

test('registered command-safety dispatch isolates its three-host route while ordinary full remains unchanged',()=>{
 const desktop=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')),workflow=load(readFileSync('.github/workflows/command-safety.yml','utf8'));
 assert.ok(Object.keys(desktop.on.workflow_dispatch.inputs).length <= 25);
 for(const choice of ['command-safety','command-safety-runtime','command-safety-packaged','command-safety-windows']) assert.ok(desktop.on.workflow_dispatch.inputs.checks.options.includes(choice));
 assert.equal(desktop.jobs['focused-command-safety'].uses,'./.github/workflows/command-safety.yml');
 for(const checks of ['command-safety','command-safety-runtime','command-safety-packaged','command-safety-windows','full','source-access']) {
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks}};
  assert.equal(runInNewContext(desktop.jobs['focused-command-safety'].if.slice(3,-2),context),checks.startsWith('command-safety'));
  if(checks.startsWith('command-safety')) assert.equal(runInNewContext(desktop.jobs['focused-command-safety'].with.phase.slice(3,-2),context),checks==='command-safety'?'full':checks==='command-safety-windows'?'runtime':checks.slice('command-safety-'.length));
  if(checks.startsWith('command-safety')) assert.equal(runInNewContext(desktop.jobs['focused-command-safety'].with.hosts.slice(3,-2),context),checks==='command-safety-windows'?'windows':'all');
  assert.equal(runInNewContext(desktop.jobs.common.if.slice(3,-2),context),checks==='full');
 }
 const job=workflow.jobs['command-safety'];
 assert.equal(workflow.on.workflow_call.inputs.hosts.default,'all');assert.equal(workflow.on.workflow_dispatch.inputs.hosts.default,'all');
 for(const hosts of ['all','windows']) assert.deepEqual(runInNewContext(job.strategy.matrix.os.slice(3,-2),{inputs:{hosts},fromJSON:JSON.parse}),hosts==='windows'?['windows-latest','windows-2022']:['macos-latest','windows-latest','windows-2022']);
 const suite=job.steps.find(step=>step.name==='Complete current suite'),dev=job.steps.find(step=>step.name==='Development command and native consumers');
 for(const phase of ['full','runtime','packaged']) {
  const context={inputs:{phase}};assert.equal(runInNewContext(suite.if.slice(3,-2),context),phase==='full');assert.equal(runInNewContext(dev.if.slice(3,-2),context),phase!=='packaged');
 }
 assert.ok(suite.run.includes('set -o pipefail'));assert.equal(job.steps.at(-1).if,'always()');
});

test('acceptance selection retains every affected boundary and makes a renewed tail explicit',()=>{
 assert.deepEqual(commandSafetyJourneys('release').map(row=>row.id),['source-enrollment','creation-recovery-native','rename','category-move','category-folders-removal','archive-restore','files-native','backup-recovery']);
 const result=spawnSync(process.execPath,['scripts/command-safety-acceptance.mjs','release','--from=archive-restore','--list'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const selected=JSON.parse(result.stdout);assert.deepEqual(selected.map(row=>row.id),['archive-restore','files-native','backup-recovery']);assert.ok(selected[0].args.includes('release'));
 const invalid=spawnSync(process.execPath,['scripts/command-safety-acceptance.mjs','dev','--from=unknown','--list']);assert.notEqual(invalid.status,0);
});

test('diagnostic failure retains the original nonzero exit and never accepts or reaches real native journeys',()=>{
 const directory=mkdtempSync(join(tmpdir(),'command-safety-probe-'));
 try {
  const result=spawnSync(process.execPath,['scripts/command-safety-acceptance.mjs','release','--failure-probe'],{env:{...process.env,WORKSPACE_SMOKE_EVIDENCE_DIR:directory},encoding:'utf8'});assert.equal(result.status,23,result.stderr);
  const report=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));assert.equal(report.status,'failed');assert.equal(report.diagnostic,true);assert.equal(report.packageBefore,null);assert.equal(report.journeys[0].exitCode,23);
  assert.ok(report.journeys.slice(1).every(row=>row.status==='unreached'));assert.equal(report.journeys.some(row=>row.status==='passed'),false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});


test('fixture diagnosis retains all failed files and separates only its concurrency from current acceptance',()=>{
 const desktop=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')),workflow=load(readFileSync('.github/workflows/command-safety-fixtures.yml','utf8'));
 assert.ok(desktop.on.workflow_dispatch.inputs.checks.options.includes('command-safety-fixtures'));
 assert.equal(desktop.jobs['focused-command-safety-fixtures'].uses,'./.github/workflows/command-safety-fixtures.yml');
 for(const checks of ['command-safety-fixtures','command-safety-archive-alias','command-safety','full']) {
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks}};
  assert.equal(runInNewContext(desktop.jobs['focused-command-safety-fixtures'].if.slice(3,-2),context),['command-safety-fixtures','command-safety-archive-alias'].includes(checks));
  if(['command-safety-fixtures','command-safety-archive-alias'].includes(checks)) assert.equal(runInNewContext(desktop.jobs['focused-command-safety-fixtures'].with.profile.slice(3,-2),context),checks==='command-safety-archive-alias'?'archive-alias':'all');
  assert.equal(runInNewContext(desktop.jobs.common.if.slice(3,-2),context),checks==='full');
 }
 const prefix='desktop-${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}';
 assert.ok(desktop.concurrency.group.startsWith(prefix));
 for(const checks of ['command-safety-fixtures','command-safety-archive-alias','command-safety','full'])
  assert.equal(runInNewContext(desktop.concurrency.group.slice(prefix.length+3,-2),{inputs:{checks}}),['command-safety-fixtures','command-safety-archive-alias'].includes(checks)?'-command-safety-fixtures':'');
 assert.equal(workflow.on.workflow_call.inputs.profile.default,'all');
 const job=workflow.jobs.fixtures;assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
 const step=job.steps.find(step=>step.name==='Original failed command safety fixtures');
 for(const outcome of ['success','failure']) for(const cancelled of [false,true])
  assert.equal(runInNewContext(step.if.slice(3,-2),{steps:{build:{outcome}},cancelled:()=>cancelled}),outcome==='success'&&!cancelled);
 assert.equal(job.steps.find(step=>step.id==='build').run,'npm run build');
 assert.equal(new Set(step.run.match(/tests\/[\w-]+\.test\.mjs/g)??[]).size,11);
 assert.ok(step.run.includes('files=(tests/durable-archive-location.test.mjs)'));
 assert.ok(step.run.includes('if [[ "$FIXTURE_PROFILE" == all ]]'));
 assert.equal(job.steps.find(step=>step.name==='Record disposable path and injection observations').if,"${{ inputs.profile == 'all' }}");
 assert.ok(step.run.includes('set -o pipefail'));assert.equal(job.steps.at(-1).if,'always()');
});

test('creation-entry diagnosis preserves the exact Windows prefix and cannot accept diagnostic success as a runtime matrix',()=>{
 const desktop=load(readFileSync('.github/workflows/desktop-ci.yml','utf8')),workflow=load(readFileSync('.github/workflows/command-safety-creation-entry.yml','utf8'));
 const job=workflow.jobs['creation-entry'];assert.equal(job['runs-on'],'windows-2022');
 const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'command-safety-creation-diagnostic'}};
 assert.equal(runInNewContext(desktop.jobs['focused-command-safety-creation-diagnostic'].if.slice(3,-2),context),true);
 assert.equal(runInNewContext(desktop.jobs['focused-command-safety'].if.slice(3,-2),context),false);
 assert.equal(runInNewContext(desktop.jobs.common.if.slice(3,-2),context),false);
 const prefix='desktop-${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}';
 assert.equal(runInNewContext(desktop.concurrency.group.slice(prefix.length+3,-2),context),'-command-safety-creation-diagnostic');
 const creation=job.steps.find(step=>step.name==='Original eight creation checkpoints with passive entry evidence');
 assert.ok(creation.run.includes('node scripts/smoke-project-creation.mjs dev'));assert.doesNotMatch(creation.run,/skip-native|checkpoint=|discovery-mode=/);
 assert.equal(creation.env.WORKSPACE_CREATION_CONTEXT_DIAGNOSTIC,'1');
 assert.ok(job.steps.findIndex(step=>step.id==='enrollment')<job.steps.indexOf(creation));
 assert.ok(job.steps.indexOf(creation)<job.steps.findIndex(step=>step.name==='Passive observation control'));
 const samples=job.steps.find(step=>step.name==='Bounded grouped after_commit diagnostic samples');
 assert.ok(samples.run.includes('set -euo pipefail'));assert.ok(samples.run.includes('for sample in {1..24}'));
 assert.ok(samples.run.includes('--discovery-mode=grouped --checkpoint=after_commit'));assert.doesNotMatch(samples.run,/skip-native|continue-on-error|\|\| true/);
 assert.equal(samples.env.WORKSPACE_CREATION_CONTEXT_DIAGNOSTIC,'1');assert.equal(creation.id,'creation');
 assert.equal(samples.if,"${{ !cancelled() && steps.creation.outcome == 'success' }}");
 assert.ok(job.steps.indexOf(creation)<job.steps.indexOf(samples));
 assert.ok(job.steps.indexOf(samples)<job.steps.findIndex(step=>step.name==='Passive observation control'));
 assert.equal(job.steps.at(-1).if,'always()');
});
