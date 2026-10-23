import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { load } from 'js-yaml';

test('integrated package acceptance propagates a failed journey and records unreached consumers', async () => {
  const evidence = await mkdtemp(join(tmpdir(), 'workspace-integration-probe-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/integrated-desktop.mjs', '--failure-probe'], {
      env: { ...process.env, WORKSPACE_SMOKE_EVIDENCE_DIR: evidence, WORKSPACE_PERFORMANCE_ROOT: 'another-candidate', WORKSPACE_REVEAL_TRACE: '1', WORKSPACE_ARCHIVE_ENTRY_TRACE:'1' }, encoding: 'utf8',
    });
    assert.equal(result.status, 23, result.stderr);
    const report = JSON.parse(await readFile(join(evidence, 'report.json'), 'utf8'));
    assert.equal(report.diagnostic, true);
    assert.equal(report.completeSelection, false);
    assert.equal(report.status, 'failed');
    assert.equal(report.journeys[0].exitCode, 23);
    assert.equal(report.journeys[0].status, 'failed');
    assert.ok(report.journeys.slice(1).every(row => row.status === 'unreached'));
    const childEnvironment = JSON.parse((await readFile(join(evidence, 'failure-probe/runtime.log'), 'utf8')).trim());
    assert.equal(childEnvironment.performanceRoot, resolve('.'));
    assert.equal(childEnvironment.revealTrace, '0');
    assert.equal(childEnvironment.archiveEntryTrace, '0');
  } finally { await rm(evidence, { recursive: true, force: true }); }
});

test('unknown integration selections fail before launching an application', () => {
  const result = spawnSync(process.execPath, ['scripts/integrated-desktop.mjs', '--from=missing'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown integrated journey/);
});

test('missing-tail selection excludes renewed consumers and cannot claim complete package acceptance',async()=>{
  const selection=spawnSync(process.execPath,['scripts/integrated-desktop.mjs','--list','--from=sources','--exclude=assignment,filesystem-assignment'],{encoding:'utf8'});
  assert.equal(selection.status,0,selection.stderr);
  const ids=JSON.parse(selection.stdout).map(row=>row.id);
  assert.equal(ids.length,26);assert.equal(ids[0],'sources');assert.equal(ids.at(-1),'strict-scale');
  assert.equal(ids.some(id=>['workspaces','assignment','filesystem-assignment'].includes(id)),false);
  for(const args of [['--exclude=missing'],['--from=strict-scale','--exclude=strict-scale']]){
    const invalid=spawnSync(process.execPath,['scripts/integrated-desktop.mjs',...args],{encoding:'utf8'});
    assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Unknown integrated journey|Empty integrated selection/);
  }
  const evidence=await mkdtemp(join(tmpdir(),'workspace-tail-probe-'));
  try{
    const result=spawnSync(process.execPath,['scripts/integrated-desktop.mjs','--from=sources','--exclude=assignment,filesystem-assignment','--failure-probe'],{env:{...process.env,WORKSPACE_SMOKE_EVIDENCE_DIR:evidence},encoding:'utf8'});
    assert.equal(result.status,23,result.stderr);
    const report=JSON.parse(await readFile(join(evidence,'report.json'),'utf8'));
    assert.equal(report.completeSelection,false);assert.equal(report.status,'failed');assert.equal(report.diagnostic,true);
    assert.deepEqual(report.excludedJourneys,['foundation','shell','workspaces','assignment','filesystem-assignment']);
    assert.equal(report.journeys.length,27);assert.ok(report.journeys.slice(1).every(row=>row.status==='unreached'));
  }finally{await rm(evidence,{recursive:true,force:true});}
});

test('registered desktop dispatch isolates integrated acceptance and retains ordinary full defaults', async () => {
  const workflow = load(await readFile('.github/workflows/desktop-ci.yml', 'utf8'));
  assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('integrated-desktop'));
  const integrated = workflow.jobs['integrated-desktop'];
  const enabled = (job, event, checks) => runInNewContext(job.if.slice(3, -2), {
    github: { event_name: event }, inputs: { checks },
  });
  for (const checks of ['integrated-desktop', 'integrated-regressions', 'integrated-layout', 'integrated-category-layout', 'integrated-operation-layout', 'integrated-runtime']) {
    assert.equal(enabled(integrated, 'workflow_dispatch', checks), true);
    assert.equal(enabled(workflow.jobs.common, 'workflow_dispatch', checks), false);
  }
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    assert.equal(enabled(integrated, event, 'full'), false);
    assert.equal(enabled(workflow.jobs.common, event, 'full'), true);
  }
  assert.deepEqual(integrated.strategy.matrix.os, ['macos-latest', 'windows-latest', 'windows-2022']);
  const commands = integrated.steps.filter(step => step.run).map(step => step.run);
  assert.ok(commands.some(command => command.includes('set -o pipefail') && command.includes('npm run test:all')));
  assert.ok(commands.indexOf('npm run package:built') < commands.findIndex(command => command.includes('node scripts/integrated-desktop.mjs')));
  const upload = integrated.steps.find(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
  const selected = checks => integrated.steps.filter(step => step.run && (!step.if || runInNewContext(step.if.slice(3, -2), { inputs: { checks } }))).map(step => step.run);
  const focused = selected('integrated-regressions');
  assert.ok(focused.some(command => command.includes('node --test tests/windows-install.test.mjs tests/test-suites.test.mjs')));
  assert.ok(!focused.some(command => /test:all|package:built|smoke-discovery-layouts|node scripts\/integrated-desktop/.test(command)));
  const layouts = selected('integrated-layout');
  assert.ok(layouts.includes('node scripts/smoke-discovery-layouts.mjs --applied'));
  assert.ok(!layouts.some(command => /test:all|package:built|node scripts\/integrated-desktop/.test(command)));
  const categoryLayouts = selected('integrated-category-layout');
  assert.ok(categoryLayouts.includes('node scripts/smoke-discovery-layouts.mjs --category-move'));
  assert.ok(!categoryLayouts.some(command => /test:all|package:built|node scripts\/integrated-desktop/.test(command)));
  const operations = selected('integrated-operation-layout');
  for (const flag of ['creation', 'rename']) assert.ok(operations.includes('node scripts/smoke-discovery-layouts.mjs --' + flag));
  assert.ok(!operations.some(command => /test:all|package:built|node scripts\/integrated-desktop/.test(command)));
  assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('integrated-archive-profile'));
  const archiveProfile=workflow.jobs['archive-entry-profile'];
  assert.equal(enabled(archiveProfile,'workflow_dispatch','integrated-archive-profile'),true);
  assert.equal(enabled(archiveProfile,'workflow_dispatch','full'),false);
  assert.equal(enabled(workflow.jobs.common,'workflow_dispatch','integrated-archive-profile'),false);
  assert.deepEqual(archiveProfile.strategy.matrix.mode,['dev','release']);
  assert.deepEqual(archiveProfile.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
  assert.equal(archiveProfile.env.WORKSPACE_ARCHIVE_ENTRY_TRACE,'1');
  assert.ok(!archiveProfile.steps.some(step=>/test:all|smoke-performance|smoke-discovery-layouts/.test(step.run??'')));
  const tail = selected('integrated-runtime');
  assert.ok(tail.includes('node scripts/smoke-discovery-layouts.mjs --remaining-after-operations'));
  assert.ok(!tail.some(command => command.includes('test:all')));
  assert.ok(tail.includes('npm run package:built'));
  assert.ok(tail.some(command => command.includes('node scripts/integrated-desktop.mjs')));
});

test('packaged fixture renewal selects workspace and assignment consumers without repeating full acceptance',async()=>{
  const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
  assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('integrated-fixture-repairs'));
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'integrated-fixture-repairs'},steps:{build:{outcome:'success'}},cancelled:()=>false,success:()=>true};
  const enabled=step=>!step.if||runInNewContext(step.if.slice(3,-2),context);
  const job=workflow.jobs['focused-workspace-sidebar'];
  assert.equal(enabled(job),true);assert.equal(enabled(workflow.jobs.common),false);assert.equal(enabled(workflow.jobs['integrated-desktop']),false);
  assert.deepEqual(job.strategy.matrix.os,['macos-latest','windows-latest','windows-2022']);
  const selected=job.steps.filter(step=>step.run&&enabled(step));
  assert.ok(selected.some(step=>step.run==='npm run package:built'));
  assert.ok(selected.some(step=>step.run==='npm run check:artifact -- release'));
  assert.ok(selected.some(step=>step.run.includes('workspace activation preparation waits')&&step.run.includes('group drag geometry preparation waits')));
  for(const command of ['node scripts/smoke-group-assignment.mjs 2>&1','node scripts/smoke-group-assignment.mjs --filesystem 2>&1'])assert.ok(selected.some(step=>step.run.includes(command)&&step.run.includes('set -o pipefail')));
  const original=selected.find(step=>step.run.includes('npm run smoke:workspaces'));
  assert.ok(original.run.includes('set -o pipefail'));
  assert.equal(runInNewContext(original.env.WORKSPACE_SMOKE_MODE.slice(3,-2),context),'release');
  assert.equal(selected.some(step=>/test:all|smoke-discovery-layouts|npm run smoke:shell/.test(step.run)),false);
  context.success=()=>false;
  assert.equal(enabled(original),false,'A failed readiness/package/resource prerequisite prevents native renewal');
  assert.equal(job.steps.some(step=>step.run&&/node scripts\/smoke-group-assignment/.test(step.run)&&enabled(step)),false);
  context.inputs.checks='workspace-sidebar';
  const ordinary=job.steps.filter(step=>step.run&&enabled(step));
  assert.ok(ordinary.some(step=>step.run.includes('npm run smoke:shell')));
  assert.equal(ordinary.some(step=>step.run==='npm run package:built'),false);
});

test('missing-tail route renews only unreached Mac and Windows2022 package journeys',async()=>{
  const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
  assert.ok(workflow.on.workflow_dispatch.inputs.checks.options.includes('integrated-missing-tails'));
  const context={github:{event_name:'workflow_dispatch'},inputs:{checks:'integrated-missing-tails'}};
  const enabled=job=>runInNewContext(job.if.slice(3,-2),context);
  const job=workflow.jobs['integrated-missing-tails'];
  assert.equal(enabled(job),true);assert.equal(enabled(workflow.jobs.common),false);assert.equal(enabled(workflow.jobs['integrated-desktop']),false);
  assert.deepEqual(job.strategy.matrix.include,[{os:'macos-latest',from:'sources',exclude:'assignment,filesystem-assignment'},{os:'windows-2022',from:'projects',exclude:''}]);
  const commands=job.steps.filter(step=>step.run).map(step=>step.run);
  assert.equal(commands.some(command=>/test:all|smoke-discovery-layouts/.test(command)),false);
  assert.ok(commands.includes('npm run package:built'));assert.ok(commands.includes('npm run check:artifact -- release'));
  assert.ok(commands.some(command=>command.includes('set -o pipefail')&&command.includes('--exclude=')&&command.includes('node scripts/integrated-desktop.mjs')));
  const upload=job.steps.find(step=>step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.if,'always()');assert.equal(upload.with['if-no-files-found'],'error');
});
