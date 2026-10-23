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
 for(const profile of ['selection-native','selection-focus','selection-tail'])assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs',profile,'--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 for(const [profile,hosts,command] of [['selection-focus',['macos-latest'],'selection-focus'],['selection-native',['macos-latest','windows-latest','windows-2022'],'selection-native'],['selection-tail',['macos-latest','windows-latest'],'selection-tail']]){
  assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes(profile));
  const context={inputs:{desktop_ux_profile:profile,desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
  assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),hosts);
  const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
  assert.ok(selected.includes(`node scripts/desktop-ux-checks.mjs ${command}`));
  assert.equal(selected.some(value=>/package:built|check:artifact|test:desktop-ux|desktop-ux-checks.mjs selections$/.test(value)),false);
 }
});

test('property profile runs real metadata safety and contextual Electron consumers and propagates failures',async()=>{
 const {propertyCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const text=JSON.stringify(propertyCommands());
 for(const required of ['property-management-ui.test.tsx','metadata-removal-service.test.mjs','metadata-removal-ipc.test.mjs','smoke-property-management.mjs','smoke-selection-editors.mjs','smoke:views','property-editor-driver.test.mjs'])assert.ok(text.includes(required),required);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','properties','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('properties'));
 assert.ok(job.steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs properties'));
 for(const step of job.steps.filter(step=>step.run==='npm run test:desktop-ux'||step.name==='Package principal desktop consumers'))assert.ok(step.if.includes("inputs.desktop_ux_profile != 'properties'"));
});

test('property repair selects only failed hosts/commands before completing changed and unreached consumers',async()=>{
 const {propertyRepairCommands,propertyTailCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const repair=propertyRepairCommands('darwin');
 const install=repair.findIndex(([,args])=>args[0]==='-e'&&args[1]==="require('electron')");
 const native=repair.findIndex(([,args])=>args.includes('tests/property-editor-driver.test.mjs'));
 assert.ok(install>=0&&install<native,'Cold extraction must finish before parallel native workers');
 const mac=JSON.stringify(repair),windows=JSON.stringify(propertyRepairCommands('win32'));
 assert.ok(mac.includes('smoke-property-management.mjs'));assert.equal(mac.includes('smoke:views'),false);
 assert.ok(windows.includes('smoke:views'));assert.equal(windows.includes('smoke-property-management.mjs'),false);
 const macTail=JSON.stringify(propertyTailCommands({platform:'darwin'})),winTail=JSON.stringify(propertyTailCommands({platform:'win32'})),serverTail=JSON.stringify(propertyTailCommands({platform:'win32',renewViews:true}));
 for(const required of ['smoke-selection-editors.mjs','smoke:select','smoke:multiselect','smoke:views'])assert.ok(macTail.includes(required),required);
 assert.ok(winTail.includes('smoke-property-management.mjs'));assert.equal(winTail.includes('smoke:views'),false);assert.ok(serverTail.includes('smoke:views'));
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 const hosts=profile=>Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{fromJSON:JSON.parse,inputs:{desktop_ux_profile:profile}}));
 assert.deepEqual(hosts('property-repair'),['macos-latest','windows-latest']);assert.deepEqual(hosts('property-tail'),['macos-latest','windows-latest','windows-2022']);
 for(const profile of ['property-repair','property-tail']){
  assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes(profile));assert.ok(job.steps.some(step=>step.run===`node scripts/desktop-ux-checks.mjs ${profile}`));
  assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs',profile,'--failure-probe'],{encoding:'utf8'}).status,23);
 }
});

test('property renewal runs changed Windows MultiSelect and unreached macOS Views without replaying accepted prefixes',async()=>{
 const {propertyRenewalCommands}=await import('../scripts/desktop-ux-checks.mjs');
 for(const platform of ['darwin','win32']){
  const commands=propertyRenewalCommands(platform),text=JSON.stringify(commands);
  assert.ok(text.includes('desktop-ux-checks.test.mjs'));
  assert.ok(text.includes(platform==='darwin'?'smoke:views':'smoke:multiselect'));
  for(const excluded of ['smoke-property-management','smoke-selection-editors','smoke:select','package:built','property-management-ui.test'])assert.equal(text.includes(excluded),false,excluded);
  assert.equal(commands.length,2);
 }
 assert.ok(JSON.stringify(propertyRenewalCommands('win32',true)).includes('smoke:views'));
 assert.equal(propertyRenewalCommands('win32',true).length,3);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','property-renewal','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('property-renewal'));
 const context={inputs:{desktop_ux_profile:'property-renewal',desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 const renewal=job.steps.find(step=>step.run==='node scripts/desktop-ux-checks.mjs property-renewal');
 for(const os of ['macos-latest','windows-latest','windows-2022'])assert.equal(runInNewContext(renewal.env.WORKSPACE_PROPERTY_VIEWS_RENEW.slice(3,-2),{matrix:{os}}),os==='windows-latest'?'1':'0');
 assert.ok(selected.includes('node scripts/desktop-ux-checks.mjs property-renewal'));
 assert.equal(selected.some(command=>/test:desktop-ux|package:built|check:artifact|desktop-ux-checks.mjs properties$/.test(command)),false);
});

test('ordinary group assignment selects real service/IPC/UI and native journeys on all three hosts',async()=>{
 const {groupAssignmentCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const text=JSON.stringify(groupAssignmentCommands());
 for(const name of ['group-assignment-interactions.test.tsx','group-assignment-ui.test.tsx','group-assignment-service.test.mjs','group-assignment-ipc.test.mjs','scalar-drafts-ui.test.tsx','smoke-group-assignment.mjs','smoke:views'])assert.ok(text.includes(name),name);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','group-assignment','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('group-assignment'));
 const context={inputs:{desktop_ux_profile:'group-assignment',desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 assert.ok(selected.includes('node scripts/desktop-ux-checks.mjs group-assignment'));
 assert.equal(selected.some(command=>/package:built|check:artifact|test:desktop-ux/.test(command)),false);
});

test('contextual project acceptance retains filesystem/recovery seams and development/package consumers on all hosts',async()=>{
 const {contextualProjectCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=contextualProjectCommands(),text=JSON.stringify(commands);
 for(const required of ['project-creation-service.test.mjs','project-creation-crash.test.mjs','project-rename-ui.test.tsx','project-rename-service.test.mjs','project-reveal.test.mjs','smoke-contextual-projects.mjs','package:built','check:artifact','--rename','--creation','grouped','direct'])assert.ok(text.includes(required),required);
 assert.ok(commands.some(([,args])=>args.includes('release')));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','contextual-projects','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('contextual-projects'));
 const context={inputs:{desktop_ux_profile:'contextual-projects',desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 assert.ok(selected.includes('node scripts/desktop-ux-checks.mjs contextual-projects'));
 assert.equal(selected.some(command=>/test:desktop-ux|smoke:views|^npm run package:built$/.test(command)),false);
});

test('contextual regression renewal covers the repaired inherited DOM consumer without replaying unchanged native/package commands',async()=>{
 const {contextualProjectCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const text=JSON.stringify(contextualProjectCommands({regressionsOnly:true}));
 for(const name of ['project-category-move-ui.test.tsx','project-operation-dialog.test.tsx','project-creation-ui.test.tsx','project-rename-ui.test.tsx'])assert.ok(text.includes(name),name);
 assert.equal(/smoke-contextual-projects|smoke:runtime|package:built/.test(text),false);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','contextual-project-regressions','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('contextual-project-regressions'));
 const context={inputs:{desktop_ux_profile:'contextual-project-regressions',desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),context)),['macos-latest','windows-latest','windows-2022']);
 const selected=job.steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.slice(3,-2),context))).map(step=>step.run);
 assert.ok(selected.includes('node scripts/desktop-ux-checks.mjs contextual-project-regressions'));
 assert.equal(selected.some(command=>/test:desktop-ux|smoke:views|package:built|check:artifact/.test(command)),false);
});

test('contextual archive runs original recovery/restart and both native modes on the three-host route',async()=>{
 const {contextualArchiveCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=contextualArchiveCommands();
 for(const mode of ['dev','release']) {
  assert.ok(commands.some(([command,args])=>command===process.execPath && args[0]==='scripts/smoke-contextual-archive.mjs' && args[1]===mode));
  assert.ok(commands.some(([command,args])=>command==='npm' && args.join(' ' )===`run smoke:archive -- ${mode}`));
  const archive=commands.findIndex(([command,args])=>command==='npm' && args.join(' ' )===`run smoke:archive -- ${mode}`);
  assert.ok(commands[archive+1][1][1].includes(`work/issue-62-archive-original-${mode}`));
  assert.ok(commands[archive+3][1][1].includes(`work/issue-62-archive-views-${mode}`));
 }
 assert.ok(JSON.stringify(commands).includes('project-archive-crash.test.mjs'));
 assert.ok(JSON.stringify(commands).includes('workspace-sessions-service.test.mjs'));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','contextual-archive','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('contextual-archive'));
 const job=workflow.jobs['desktop-ux'],inputs={desktop_ux_profile:'contextual-archive'};
 const enabled=step=>!step.if || runInNewContext(step.if.startsWith('${{') ? step.if.slice(3,-2) : step.if,{inputs,cancelled:()=>false,always:()=>true,matrix:{os:'macos-latest'}});
 assert.ok(job.steps.some(step=>enabled(step)&&step.run==='node scripts/desktop-ux-checks.mjs contextual-archive'));
 assert.equal(job.steps.some(step=>enabled(step)&&step.run==='npm run test:desktop-ux'),false);
 assert.equal(job.steps.some(step=>enabled(step)&&step.run==='npm run package:built'),false,'package is sequenced inside the selected profile');
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{inputs,fromJSON:JSON.parse})),['macos-latest','windows-latest','windows-2022']);
});

test('archive native repair selects only the two failed hosts and original development consumer',async()=>{
 const {contextualArchiveCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=contextualArchiveCommands({nativeOnly:true});
 assert.equal(commands.filter(([,args])=>args[0]==='scripts/smoke-contextual-archive.mjs'&&args[1]==='dev').length,1);
 assert.equal(JSON.stringify(commands).includes('package:built'),false);
 assert.ok(JSON.stringify(commands).includes('rename-runtime-startup.test.mjs'));
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const job=load(await readFile('.github/workflows/desktop-ci.yml','utf8')).jobs['desktop-ux'];
 const inputs={desktop_ux_profile:'contextual-archive-native'};
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{inputs,fromJSON:JSON.parse})),['windows-latest','windows-2022']);
 assert.ok(job.steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs contextual-archive-native'));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','contextual-archive-native','--failure-probe'],{encoding:'utf8'}).status,23);
});

test('contextual categories select actual three-host folder and recovery consumers without the broad profile', async()=>{
 const {contextualCategoryCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');const {runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('contextual-categories'));
 const context={inputs:{desktop_ux_profile:'contextual-categories',desktop_ux_failure_probe:false,desktop_ux_category_only:false,desktop_ux_packaged_only:false},fromJSON:JSON.parse,cancelled:()=>false};
 const active=workflow.jobs['desktop-ux'].steps.filter(step=>step.run&&(!step.if||runInNewContext(step.if.replace(/^\$\{\{\s*|\s*\}\}$/g,''),context)));
 assert.ok(active.some(step=>step.run==='node scripts/desktop-ux-checks.mjs contextual-categories'));
 assert.equal(active.some(step=>step.run==='npm run test:desktop-ux'),false);
 const commands=contextualCategoryCommands(), text=JSON.stringify(commands);
 for(const file of ['category-options-service.test.mjs','category-removal-service.test.mjs','project-category-move-crash.test.mjs','project-category-move-ipc.test.mjs'])assert.ok(text.includes(file),file);
 for(const mode of ['dev','release']) {
  assert.ok(commands.some(([,args])=>args.join(' ')===`scripts/smoke-contextual-categories.mjs ${mode}`));
  assert.ok(commands.some(([,args])=>args.join(' ')===`scripts/smoke-category-options.mjs ${mode}`));
  assert.ok(commands.some(([,args])=>args.join(' ')===`run smoke:runtime -- ${mode} --category-move`));
 }
 assert.equal(runChecks(commands,()=>({status:23})),23);
});

test('filesystem assignment route retains all-type, native recovery and changed history consumers',async()=>{
 const {filesystemAssignmentCommands}=await import('../scripts/desktop-ux-checks.mjs');
 assert.equal(typeof filesystemAssignmentCommands,'function');
 const text=JSON.stringify(filesystemAssignmentCommands());
 for(const name of ['group-assignment-ui.test.tsx','group-assignment-service.test.mjs','group-assignment-ipc.test.mjs','project-rename-crash.test.mjs','project-category-move-crash.test.mjs','project-archive-service.test.mjs','smoke:views','smoke:runtime','--category-move','--rename','--filesystem'])assert.ok(text.includes(name),name);
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('filesystem-assignment'));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','filesystem-assignment','--failure-probe'],{encoding:'utf8'}).status,23);
});

test('filesystem assignment repair renews the original native command and projection regression on macOS',async()=>{
 const {filesystemAssignmentRepairCommands}=await import('../scripts/desktop-ux-checks.mjs');
 assert.equal(typeof filesystemAssignmentRepairCommands,'function');
 const text=JSON.stringify(filesystemAssignmentRepairCommands());
 for(const name of ['runtime-project-visibility.test.mjs','smoke-group-assignment.mjs','--filesystem'])assert.ok(text.includes(name),name);
 assert.equal(text.includes('smoke:views'),false,'Unreached consumers follow the focused gate');
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('filesystem-assignment-repair'));
 assert.ok(workflow.jobs['desktop-ux'].strategy.matrix.os.includes("inputs.desktop_ux_profile == 'filesystem-assignment-repair' && '[\"macos-latest\",\"windows-latest\"]'"));
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','filesystem-assignment-repair','--failure-probe'],{encoding:'utf8'}).status,23);
});

test('filesystem assignment tail renews all consumers of the changed shared visibility input',async()=>{
 const {filesystemAssignmentTailCommands}=await import('../scripts/desktop-ux-checks.mjs');
 assert.equal(typeof filesystemAssignmentTailCommands,'function');
 const renewed=JSON.stringify(filesystemAssignmentTailCommands());
 for(const item of ['runtime-project-visibility.test.mjs','--filesystem','smoke:views','--rename','--category-move'])assert.ok(renewed.includes(item),item);
});

test('Windows Reveal diagnostics cannot leak trace into strict contract validation',async()=>{
 const {readFile}=await import('node:fs/promises');const {load}=await import('js-yaml');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 const steps=workflow.jobs['desktop-ux'].steps;
 const validation=steps.find(step=>step.run==='node scripts/desktop-ux-checks.mjs filesystem-assignment-reveal');
 assert.equal(validation.env.WORKSPACE_REVEAL_TRACE,'0');
 const diagnostic=steps.find(step=>step.name==='Original Windows latest rename Reveal diagnostic');
 assert.equal(diagnostic.run,'npm run smoke:runtime -- dev --rename');assert.equal(diagnostic.env.WORKSPACE_REVEAL_TRACE,'1');
 const strict=steps.find(step=>step.name==='Original Windows latest rename Reveal strict renewal');assert.equal(strict.env.WORKSPACE_REVEAL_TRACE,'0');
});

test('retained recovery selects real identity/session and UI seams with native restart/package consumers on all desktops',async()=>{
 const {retainedRecoveryCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=retainedRecoveryCommands(),text=JSON.stringify(commands);
 for(const required of ['project-recovery-service.test.mjs','external-reconciliation-service.test.mjs','workspace-sessions-service.test.mjs','project-recovery-ui.test.tsx','renderer-app.test.tsx','project-operation-dialog.test.tsx','smoke-retained-recovery.mjs','smoke-workspace-sessions.mjs','smoke-project-navigation.mjs','package:built','check:artifact','smoke:data-recovery','smoke:archive','smoke:views'])assert.ok(text.includes(required),required);
 assert.deepEqual(commands.filter(([,args])=>args.includes('scripts/smoke-retained-recovery.mjs')).map(([,args])=>args.at(-1)),['dev','release']);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','retained-recovery','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8'));
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('retained-recovery'));
 const job=workflow.jobs['desktop-ux'];
 assert.ok(job.steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs retained-recovery'));
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{fromJSON:JSON.parse,inputs:{desktop_ux_profile:'retained-recovery'}})),['macos-latest','windows-latest','windows-2022']);
 for(const name of ['Affected UI, services and real Electron flows','Package shared font and notices','Inspect packaged artifact','Packaged saved-view consumers'])assert.ok(job.steps.find(step=>step.name===name).if.includes("inputs.desktop_ux_profile != 'retained-recovery'"),name);
});

test('integrated assignment and retained recovery renew both boundaries once on all hosts',async()=>{
 const {filesystemAssignmentIntegrationCommands}=await import('../scripts/desktop-ux-checks.mjs');
 const commands=filesystemAssignmentIntegrationCommands(),text=JSON.stringify(commands);
 const testCommands=commands.filter(([,args])=>args.includes('--test'));
 assert.equal(testCommands.length,1);
 const files=testCommands[0][1].filter(arg=>arg.startsWith('tests/'));assert.equal(files.length,new Set(files).size);
 for(const name of ['group-assignment-ui.test.tsx','project-recovery-ui.test.tsx','renderer-app.test.tsx','--filesystem','--rename','--category-move','smoke-retained-recovery.mjs','smoke-workspace-sessions.mjs','package:built','check:artifact','smoke:data-recovery','smoke:archive','smoke:views'])assert.ok(text.includes(name),name);
 assert.equal(spawnSync(process.execPath,['scripts/desktop-ux-checks.mjs','filesystem-assignment-integration','--failure-probe'],{encoding:'utf8'}).status,23);
 const {readFile}=await import('node:fs/promises'),{load}=await import('js-yaml'),{runInNewContext}=await import('node:vm');
 const workflow=load(await readFile('.github/workflows/desktop-ci.yml','utf8')),job=workflow.jobs['desktop-ux'];
 assert.ok(workflow.on.workflow_dispatch.inputs.desktop_ux_profile.options.includes('filesystem-assignment-integration'));
 assert.ok(job.steps.some(step=>step.run==='node scripts/desktop-ux-checks.mjs filesystem-assignment-integration'));
 assert.deepEqual(Array.from(runInNewContext(job.strategy.matrix.os.slice(3,-2),{fromJSON:JSON.parse,inputs:{desktop_ux_profile:'filesystem-assignment-integration'}})),['macos-latest','windows-latest','windows-2022']);
 for(const name of ['Affected UI, services and real Electron flows','Package shared font and notices','Inspect packaged artifact','Packaged saved-view consumers'])assert.ok(job.steps.find(step=>step.name===name).if.includes("inputs.desktop_ux_profile != 'filesystem-assignment-integration'"),name);
});
