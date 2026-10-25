import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {load} from 'js-yaml';

test('special archive is explicit, preserves ordinary scheduling and accepts all supported hosts in both runtime modes',()=>{
 const workflow=load(readFileSync('.github/workflows/desktop-ci.yml','utf8'));
 const job=workflow.jobs['special-archive'];
 assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('special-archive'));
 assert.equal(job.uses,'./.github/workflows/special-archive.yml');
 const group=checks=>workflow.concurrency.group.replace(/\$\{\{(.*?)\}\}/g,(_,expression)=>runInNewContext(expression,{inputs:{checks},github:{workflow:'Desktop',event_name:'workflow_dispatch',ref:'refs/heads/task'}}));
 assert.notEqual(group('special-archive'),group('special-archive-native'),'renewal cannot cancel full evidence collection');
 const enabled=(expression,event,checks)=>runInNewContext(expression.slice(3,-2),{github:{event_name:event},inputs:{checks}});
 for(const event of ['push','pull_request','workflow_dispatch'])for(const checks of workflow.on.workflow_dispatch.inputs.checks.options){
  assert.equal(enabled(job.if,event,checks),event==='workflow_dispatch'&&['special-archive','special-archive-native'].includes(checks));
  if(['special-archive','special-archive-native'].includes(checks))assert.equal(enabled(workflow.jobs.common.if,event,checks),event!=='workflow_dispatch');
 }
 const acceptance=load(readFileSync('.github/workflows/special-archive.yml','utf8')).jobs['special-archive'];
 assert.deepEqual(acceptance.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
 const steps=acceptance.steps,full=steps.findIndex(s=>s.name==='Final complete suite');
 for(const nativeOnly of [false,true])assert.equal(runInNewContext(steps[full].if.slice(3,-2),{inputs:{native_only:nativeOnly}}),!nativeOnly);
 for(const checks of ['special-archive','special-archive-native'])assert.equal(runInNewContext(job.with.native_only.slice(3,-2),{inputs:{checks}}),checks==='special-archive-native');
 const renewal=steps.find(s=>s.name==='Renew affected routing and startup checks');
 assert.ok(renewal.run.includes('tests/status-moves-workflow.test.mjs'));
 assert.equal(runInNewContext(renewal.if.slice(3,-2),{inputs:{native_only:true}}),true);
 assert.equal(steps.filter(s=>s.if&&s.if.includes('native_only')).length,2,'native-only replaces the already-inspected complete suite with affected regressions');
 assert.ok(steps[full].run.includes('set -o pipefail'));assert.ok(steps[full].run.includes('npm run test:all'));
 const native=steps.filter(s=>s.run==='node scripts/smoke-special-archive.mjs');assert.equal(native.length,2);
 assert.ok(steps.indexOf(native[0])>full);assert.equal(native[0].env.WORKSPACE_SMOKE_MODE,undefined);
 assert.equal(native[1].env.WORKSPACE_SMOKE_MODE,'release');
 const packaged=steps.findIndex(s=>s.run==='npx electron-builder --dir'),artifact=steps.findIndex(s=>s.run==='npm run check:artifact -- release');
 assert.ok(packaged>steps.indexOf(native[0]));assert.ok(artifact>packaged&&artifact<steps.indexOf(native[1]));
 for(const mode of ['dev','release'])assert.equal(steps.find(s=>s.run===`npm run smoke:archive -- ${mode}`).env.WORKSPACE_SMOKE_EVIDENCE_DIR,`work/ci-special-archive/retained-${mode}`);
 const upload=steps.find(s=>s.uses==='actions/upload-artifact@v4');assert.equal(upload.if,'always()');
 for(const key of ['github.sha','github.run_id','github.run_attempt','matrix.os'])assert.ok(upload.with.name.includes(key));
 assert.ok(upload.with.path.includes('work/ci-special-archive/'));assert.equal(upload.with['if-no-files-found'],'error');
});
