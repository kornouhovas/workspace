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

test('Windows category diagnosis is separate from strict acceptance and retains default platform coverage',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {load}=await import('js-yaml');
  const {runInNewContext}=await import('node:vm');
  const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
  const inputs=workflow.on.workflow_dispatch.inputs;
  assert.equal(inputs.desktop_ux_category_only.default,false);
  assert.equal(inputs.desktop_ux_category_quit_trace.default,false);
  const job=workflow.jobs['desktop-ux'];
  const matrix=enabled=>Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{fromJSON:JSON.parse,inputs:{desktop_ux_category_only:enabled}}));
  assert.deepEqual(matrix(false),['macos-latest','windows-latest','windows-2022']);
  assert.deepEqual(matrix(true),['windows-latest']);
  const strict=job.steps.find(step=>step.name==='Strict Windows category runtime');
  assert.ok(strict.if.includes('!inputs.desktop_ux_category_quit_trace'));
  assert.equal(strict.env.WORKSPACE_CATEGORY_QUIT_TRACE,undefined);
  const diagnostic=job.steps.find(step=>step.name==='Diagnostic Windows category quit phases');
  assert.equal(diagnostic.env.WORKSPACE_CATEGORY_QUIT_TRACE,'1');
  assert.ok(diagnostic.if.includes('!cancelled()'));
});


test('Board profile selects scoped real-service and Electron acceptance without installer work',async()=>{
  const {boardCommands}=await import('../scripts/desktop-ux-checks.mjs');
  const commands=boardCommands(), text=JSON.stringify(commands);
  for(const required of ['board-layout-service.test.mjs','view-grouping-service.test.mjs','group-assignment-service.test.mjs','table-layout-ui.test.tsx','smoke-board.mjs','smoke:views']) assert.ok(text.includes(required),required);
  assert.equal(text.includes('package:'),false);
  const result=spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','board','--failure-probe'],{encoding:'utf8'});
  assert.equal(result.status,23);
  const {readFile}=await import('node:fs/promises');
  const {load}=await import('js-yaml');
  const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.default,'foundation');
  assert.ok(workflow.jobs['desktop-ux'].steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs board'));
});

test('navigation profile exercises shared shell, projects, real-service and native consumers and propagates failure',async()=>{
 const {navigationCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=navigationCommands(),text=JSON.stringify(commands);
 for(const required of ['project-navigation-ui.test.tsx','renderer-app.test.tsx','views-service.test.mjs','view-filters-service.test.mjs','project-archive-ui.test.tsx','smoke-project-navigation.mjs','smoke:shell','smoke:views'])assert.ok(text.includes(required),required);
 assert.equal(text.includes('package:'),false);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','navigation','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('navigation'));
 assert.ok(workflow.jobs['desktop-ux'].steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs navigation'));
});

test('focused navigation renewal retains the original native command and affected regressions without replaying other consumers',async()=>{
 const {navigationCommands}=await import('../scripts/desktop-ux-checks.mjs');const text=JSON.stringify(navigationCommands({nativeOnly:true}));
 for(const required of ['view-scroll-native.test.mjs','project-navigation-ui.test.tsx','viewport-projects-ui.test.tsx','views-ui.test.tsx','smoke-project-navigation.mjs'])assert.ok(text.includes(required));
 assert.equal(text.includes('smoke:shell'),false);assert.equal(text.includes('renderer-app.test.tsx'),false);
 const result=spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','navigation','--native-only','--failure-probe'],{encoding:'utf8'});assert.equal(result.status,23);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.equal(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.default,'foundation');assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('navigation-native'));assert.ok(Object.keys(workflow.on.workflow_dispatch.inputs).length<=25);
 assert.ok(workflow.jobs['desktop-ux'].steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs navigation --native-only'));
});

test('focused navigation failure renewal selects only the failed Windows hosts and retains the normal three-host profile',async()=>{
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));const expression=workflow.jobs['desktop-ux'].strategy.matrix.os.slice(3,-2);
 const matrix=focused=>Array.from(runInNewContext(expression,{fromJSON:JSON.parse,inputs:{desktop_ux_profile:focused?'navigation-native':'navigation',desktop_ux_category_only:false}}));
 assert.deepEqual(matrix(true),['windows-latest','windows-2022']);assert.deepEqual(matrix(false),['macos-latest','windows-latest','windows-2022']);
});

test('candidate provenance records focused navigation mode after shell quote processing',async()=>{
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));const command=workflow.jobs['desktop-ux'].steps.find(step=>step.name==='Candidate provenance').run;
 const argument=command.match(/-e ((?:'[^']*'|[^\s])+)/)?.[1];assert.ok(argument);
 const source=argument.replace(/'([^']*)'/g,'$1').replace(/^import \{writeFileSync\} from "node:fs"; /,'');
 for(const [flag,expected] of [['1',true],['0',false]]){
  let receipt;runInNewContext(source,{process:{env:{GITHUB_SHA:'candidate-sha',WORKSPACE_UX_PROFILE:'navigation',WORKSPACE_UX_NAVIGATION_ONLY:flag}},writeFileSync:(_path,content)=>{receipt=JSON.parse(content);}});
  assert.equal(receipt.sha,'candidate-sha');assert.equal(receipt.navigationOnly,expected);
 }
});

test('project files acceptance includes real filesystem/IPC/native regressions and actual Open/Reveal smoke',async()=>{
 const {projectFilesCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=projectFilesCommands(),text=JSON.stringify(commands);
 for(const required of ['project-files-service.test.mjs','project-files-ui.test.tsx','backend-lifecycle.test.mjs','project-reveal.test.mjs','windows-project-reveal.test.mjs','smoke-project-files.mjs','smoke-project-navigation.mjs','build-smoke.test.mjs','artifact-smoke.test.mjs','smoke:shell','smoke:views'])assert.ok(text.includes(required),required);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','project-files','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('project-files'));
 assert.ok(workflow.jobs['desktop-ux'].steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs project-files'));
 assert.ok(Object.keys(workflow.on.workflow_dispatch.inputs).length<=25);
});

test('focused project files renewal isolates original COM controls and preserves original failed native commands',async()=>{
 const {projectFilesCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=projectFilesCommands({nativeOnly:true});const text=JSON.stringify(commands);
 const com=commands.filter(([,args])=>args.includes('tests/windows-project-reveal-com.test.mjs'));
 assert.equal(com.length,1);assert.deepEqual(com[0][1],['--import','tsx','--test','tests/windows-project-reveal-com.test.mjs']);
 for(const file of ['project-files-service.test.mjs','runtime-project-visibility.test.mjs','smoke-project-files.mjs','smoke:views'])assert.ok(text.includes(file));
 assert.equal(text.includes('smoke-project-navigation.mjs'),false);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','project-files','--native-only','--failure-probe'],{encoding:'utf8'}).status,23);
});

test('coherent milestone runs every principal journey once on the full desktop matrix and preserves failure propagation',async()=>{
 const {coherentCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=coherentCommands();
 for(const command of ['scripts/smoke-visual-foundation.mjs','scripts/smoke-board.mjs','scripts/smoke-project-files.mjs','scripts/smoke-project-navigation.mjs','smoke:shell','smoke:workspaces','smoke:sources','smoke:views']) {
  assert.equal(commands.filter(([,args])=>args.includes(command)).length,1,command);
 }
 const tests=commands.flatMap(([,args])=>args.filter(arg=>arg.startsWith('tests/')));
 assert.equal(tests.length,new Set(tests).size,'Shared regressions run once');
 for(const file of ['project-files-service.test.mjs','group-assignment-service.test.mjs','views-service.test.mjs','viewport-projects-ui.test.tsx','property-editor-driver.test.mjs','runtime-view-readiness.test.mjs','windows-project-reveal-com.test.mjs'])assert.ok(tests.includes(`tests/${file}`),file);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','coherent','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));const job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('coherent'));
 assert.equal(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.default,'foundation');
 assert.ok(job.steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs coherent'));
 assert.ok(job.steps.find(step=>step.run==='npm run test:desktop-ux').if.includes("inputs.desktop_ux_profile != 'coherent'"));
 const inputs={desktop_ux_profile:'coherent',desktop_ux_category_only:false,desktop_ux_packaged_only:false,desktop_ux_failure_probe:false};
 const coherentStep=job.steps.find(step=>step.run==='node scripts/desktop-ux-checks.mjs coherent');
 for(const focused of ['desktop_ux_packaged_only','desktop_ux_category_only'])assert.equal(runInNewContext(coherentStep.if.slice(3,-2),{inputs:{...inputs,[focused]:true}}),false,focused);
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{inputs,fromJSON:JSON.parse})),['macos-latest','windows-latest','windows-2022']);
 for(const name of ['Package shared font and notices','Inspect packaged artifact','Packaged saved-view consumers'])assert.equal(runInNewContext(job.steps.find(step=>step.name===name).if.slice(3,-2),{inputs}),true,name);
});


test('scroll restoration renewal keeps all three native hosts and excludes unrelated package and foundation consumers', async () => {
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('scroll-restoration'));
 const job=workflow.jobs['desktop-ux'],context={fromJSON:JSON.parse,cancelled:()=>false,inputs:{desktop_ux_profile:'scroll-restoration',desktop_ux_category_only:false,desktop_ux_failure_probe:false,desktop_ux_packaged_only:false}};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 assert.ok(selected.includes('node scripts/desktop-ux-checks.mjs navigation --native-only'));
 assert.equal(selected.some(command=>/package:built|check:artifact|smoke:views|coherent|test:desktop-ux/.test(command)),false);
 assert.equal(runInNewContext(job.steps.find(step=>step.name==='Candidate provenance').env.WORKSPACE_UX_NAVIGATION_ONLY.slice(3,-2),context),'1');
});

test('session acceptance runs public migration/recovery and real dev/release consumers with failure propagation',()=>{
 const listed=spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','sessions','--list'],{encoding:'utf8'});
 assert.equal(listed.status,0,listed.stderr);
 const commands=JSON.parse(listed.stdout);
 for(const name of ['workspace-sessions-service.test.mjs','data-recovery-service.test.mjs','automatic-backups-service.test.mjs','project-navigation-ui.test.tsx','renderer-app.test.tsx'])assert.ok(JSON.stringify(commands).includes(name),name);
 assert.ok(commands.some(([,args])=>args.includes('scripts/smoke-workspace-sessions.mjs')&&args.includes('dev')));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','sessions','--failure-probe'],{encoding:'utf8'}).status,23);
});

test('scalar profile runs shared editors, navigation and native consumers and propagates failure',async()=>{
 const {scalarCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=scalarCommands(),text=JSON.stringify(commands);
 for(const name of ['scalar-drafts-ui.test.tsx','renderer-app.test.tsx','number-properties-service.test.mjs','date-properties-service.test.mjs','workspace-sessions-service.test.mjs','smoke-project-navigation.mjs','smoke:number','smoke:date'])assert.ok(text.includes(name),name);
 assert.ok(commands.some(([,args])=>args.includes('scripts/smoke-scalar-drafts.mjs')&&args.includes('dev')));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','scalars','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('scalars'));
 assert.ok(workflow.jobs['desktop-ux'].steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs scalars'));
 assert.ok(workflow.jobs['desktop-ux'].steps.some(step=>step.run?.includes('node scripts/smoke-scalar-drafts.mjs release')));
});

test('selection profile covers shared choices, retained service ownership and real Electron on every host without unrelated packaging',async()=>{
 const {selectionCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const text=JSON.stringify(selectionCommands());
 for(const name of ['selection-editors-ui.test.tsx','scalar-drafts-ui.test.tsx','single-select-service.test.mjs','multi-select-service.test.mjs','metadata-removal-ui.test.tsx','smoke-selection-editors.mjs','smoke:select','smoke:multiselect','smoke-scalar-drafts.mjs'])assert.ok(text.includes(name),name);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','selections','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('selections'));
 const job=workflow.jobs['desktop-ux'],context={inputs:{desktop_ux_profile:'selections',desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 assert.ok(selected.includes('node scripts/desktop-ux-checks.mjs selections'));
 assert.equal(selected.some(command=>/package:built|check:artifact|test:desktop-ux/.test(command)),false);
});

test('selection driver and unreached-tail renewal preserve original commands and isolate the selected hosts',async()=>{
 const {selectionNativeCommands,selectionTailCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const text=JSON.stringify(selectionNativeCommands());
 for(const name of ['selection-driver.test.mjs','selection-backend-readiness.test.mjs','smoke-selection-editors.mjs','smoke:select','smoke:multiselect'])assert.ok(text.includes(name),name);
 assert.equal(text.includes('views-service.test.mjs'),false);
 assert.ok(JSON.stringify(selectionNativeCommands({renewViews:true})).includes('smoke:views'));
 for(const name of ['smoke-scalar-drafts.mjs','smoke:views'])assert.ok(JSON.stringify(selectionTailCommands()).includes(name),name);
 for(const profile of ['selection-native','selection-tail'])assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs',profile,'--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 for(const [profile,hosts,command] of [['selection-native',['macos-latest','windows-latest','windows-2022'],'selection-native'],['selection-tail',['macos-latest','windows-latest'],'selection-tail']]){
  assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes(profile));
  const context={inputs:{desktop_ux_profile:profile,desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
  assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),hosts);
  const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
  assert.ok(selected.includes(`node scripts/desktop-ux-checks.mjs ${command}`));
  assert.equal(selected.some(value=>/package:built|check:artifact|test:desktop-ux|desktop-ux-checks.mjs selections$/.test(value)),false);
 }
});
