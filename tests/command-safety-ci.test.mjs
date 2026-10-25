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
 assert.ok(desktop.on.workflow_dispatch.inputs.checks.options.includes('command-safety'));
 assert.equal(desktop.jobs['focused-command-safety'].uses,'./.github/workflows/command-safety.yml');
 for(const checks of ['command-safety','full','source-access']) {
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks}};
  assert.equal(runInNewContext(desktop.jobs['focused-command-safety'].if.slice(3,-2),context),checks==='command-safety');
  assert.equal(runInNewContext(desktop.jobs.common.if.slice(3,-2),context),checks==='full');
 }
 const job=workflow.jobs['command-safety'];assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
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
