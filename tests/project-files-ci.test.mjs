import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {load} from 'js-yaml';

test('focused file Reveal route preserves the original Windows consumer, deadlines and failed exit',async()=>{
 const workflow=load(await readFile('.github/workflows/project-files-windows.yml','utf8'));
 assert.equal(workflow.on.workflow_dispatch.inputs.trace.default,false);
 assert.equal(workflow.on.workflow_call.inputs.trace.default,false);
 const desktop=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.equal(desktop.jobs['focused-project-files-windows'].uses,'./.github/workflows/project-files-windows.yml');
 for(const mode of ['project-files-windows','project-files-windows-trace']){
  assert.ok(desktop.on.workflow_dispatch.inputs.checks.options.includes(mode));
  assert.ok(desktop.jobs.common.if.includes(`inputs.checks != '${mode}'`));
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks:mode}};
  assert.equal(runInNewContext(desktop.jobs.common.if.slice(3,-2),context),false);
  assert.equal(runInNewContext(desktop.jobs['focused-project-files-windows'].if.slice(3,-2),context),true);
  assert.equal(runInNewContext(desktop.jobs['focused-project-files-windows'].with.trace.slice(3,-2),context),mode.endsWith('-trace'));
 }
 assert.equal(runInNewContext(desktop.jobs.common.if.slice(3,-2),{github:{event_name:'workflow_dispatch'},inputs:{checks:'full'}}),true);
 const job=workflow.jobs.files;
 assert.equal(job['runs-on'],'windows-latest');
 assert.equal(job.steps.find(step=>step.name==='Original project files Open and Reveal').run.includes('node scripts/smoke-project-files.mjs'),true);
 assert.equal(job.steps.find(step=>step.name==='Original project files Open and Reveal').run.includes('set -o pipefail'),true);
 assert.equal(job.steps.at(-1).if,'always()');
 assert.equal(job.steps.at(-1).with['if-no-files-found'],'error');
 assert.ok(job.steps.some(step=>step.run==='npm run build'));
 assert.equal(job.steps.some(step=>step.run?.includes('coherent')||step.run?.includes('test:all')),false);
 const directory=await mkdtemp(join(tmpdir(),'file-ci-exit-'));
 try {
  const original=job.steps.find(step=>step.name==='Original project files Open and Reveal').run;
  const probe=original.replace('node scripts/smoke-project-files.mjs','node -e "process.exit(23)"');
  assert.equal(spawnSync('bash',['-c',probe],{cwd:directory}).status,23);
  assert.equal(spawnSync('bash',['-c',probe.replace('set -o pipefail','set +o pipefail')],{cwd:directory}).status,0);
 }finally{await rm(directory,{recursive:true,force:true});}
});
