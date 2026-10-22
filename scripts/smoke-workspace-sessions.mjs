/* global window, document */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, realpath, writeFile, readFile, rename } from 'node:fs/promises';
import { tmpdir, release, cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from './runtime-lifecycle.mjs';
import { packagedExecutablePath } from './runtime-executable.mjs';
import { setInterfaceLanguage } from './runtime-settings.mjs';
const root=resolve(import.meta.dirname,'..'), mode=process.argv[2]??'dev';
assert.ok(['dev','release'].includes(mode));
const executablePath=mode==='dev'?createRequire(import.meta.url)('electron'):packagedExecutablePath(root,process.platform,process.arch);
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-sessions-')));
const source=join(fixture,'source'), data=join(fixture,'data');
await mkdir(join(source,'Atlas'),{recursive:true});await mkdir(join(source,'Beacon'));
await writeFile(join(source,'Atlas','notes.txt'),'Project bytes stay outside app backups.');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-55-sessions-${mode}`);await mkdir(evidence,{recursive:true});
const report={issue:55,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),cpu:cpus()[0]?.model,checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failure,launchUnverified=false;
const unwrap=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
const query=input=>page.evaluate(input=>window.workspace.workspace(input),input).then(unwrap);
async function launch(){
 launchUnverified=true;
 app=await _electron.launch({executablePath,args:mode==='dev'?[root]:[],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:data}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 const pids=await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid));assert.ok(pids.length);for(const pid of pids)backends.add(pid);
 launchUnverified=false;
}
async function close(){
 if(!app)return;const closing=app;const shutdown={normalQuit:false,backendsExited:false};report.shutdowns.push(shutdown);
 try{await closeElectron(closing);shutdown.normalQuit=true;app=undefined;assert.equal(await ownedProcessesStopped(parents,backends),true);shutdown.backendsExited=true;}
 catch(error){shutdown.error=error.message;shutdown.forcedCleanup=error.forcedCleanup;throw error;}
}
try{
 await launch();
 const one=await query({type:'workspace.create',rootPath:source,name:'Design studio'});
 const sibling=await query({type:'workspace.create',rootPath:source,name:'Independent studio'});
 const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId:one.workspaceId,...fields});
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:'direct'})).previewToken})).projects;
 const atlas=projects.find(p=>p.name==='Atlas'),beacon=projects.find(p=>p.name==='Beacon');
 const propertyId=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
 await call('setTextValue',{propertyId,projectId:atlas.projectId,value:'Fresh after restart'});
 const initial=await call('getSession');
 await call('setSession',{epoch:initial.epoch,expectedRevision:initial.revision,state:{...initial.state,tabs:[atlas.projectId,beacon.projectId],expanded:atlas.projectId,previews:{[one.viewId]:atlas.projectId},sidebarWidth:260,projectWidth:440}});
 await query({type:'workspace.activate',workspaceId:one.workspaceId});
 await close();await writeFile(join(source,'Atlas','fresh.txt'),'Fresh current files');await launch();
 await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();
 await page.locator('.project-detail-fields[aria-busy="false"]').waitFor();
 assert.ok(await page.locator('.project-area').getByText('Fresh after restart',{exact:true}).count());
 await page.getByText('fresh.txt',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.project-tab [role="tab"]').allTextContents(),['Atlas','Beacon']);
 assert.equal(await page.getByRole('separator',{name:'Sidebar width',exact:true}).getAttribute('aria-valuenow'),'260');
 assert.equal(await page.getByRole('button',{name:'Back',exact:true}).isDisabled(),true);
 report.checks.push('real quit/reopen resumes unique ordered tabs, expanded project and sidebar; current properties/files; fresh-run Back disabled');
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);const en=language==='en';
  for(const theme of ['light','dark']){
   unwrap(await page.evaluate(appearance=>window.workspace.settings({type:'settings.setAppearance',appearance}),theme));
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);
    const stem=`${language}-${theme}-${size.width}`;
    await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
    await page.getByRole('separator',{name:en?'Project area width':'Ширина области проекта',exact:true}).waitFor();
    await page.screenshot({path:join(evidence,`preview-${stem}.png`)});
    await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
    await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    await page.screenshot({path:join(evidence,`expanded-${stem}.png`)});report.screens.push({language,theme,...size});
   }
  }
 }
 const sidebar=page.getByRole('separator',{name:'Ширина боковой панели',exact:true});await sidebar.focus();await sidebar.press('End');
 await page.getByRole('button',{name:'Свернуть боковую панель',exact:true}).click();
 await page.waitForFunction(async id=>{const s=await window.workspace.workspace({type:'workspace.getSession',workspaceId:id});return s.ok&&s.value.state.sidebarCollapsed&&s.value.state.sidebarWidth===320;},one.workspaceId);
 const saved=await call('getSession');const exported=unwrap(await page.evaluate(()=>window.workspace.recovery({type:'data.export'}))).content;
 const backup=unwrap(await page.evaluate(()=>window.workspace.recovery({type:'data.backupNow'})));
 const backupContent=unwrap(await page.evaluate(backupId=>window.workspace.recovery({type:'data.backupExport',backupId}),backup.backups.snapshots[0].id)).content;
 await close();await rename(join(source,'Atlas'),join(fixture,'missing-atlas'));await launch();
 await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();await page.getByRole('button',{name:'Восстановить боковую панель',exact:true}).waitFor();
 assert.deepEqual((await call('getSession')).state,saved.state);
 assert.equal(await page.locator('.project-area').getByText('fresh.txt',{exact:true}).count(),0);
 report.checks.push('missing project retains selected tab and persisted collapsed sidebar without replaying cached file content');
 for(const content of [exported,backupContent]){
  unwrap(await page.evaluate(content=>window.workspace.recovery({type:'data.restore',content}),content));await page.reload();
  await page.getByRole('tab',{name:'Atlas',selected:true,exact:true}).waitFor();assert.deepEqual((await call('getSession')).state,saved.state);
 }
 assert.deepEqual((await query({type:'workspace.getSession',workspaceId:sibling.workspaceId})).state,{tabs:[],expanded:null,previews:{},sidebarWidth:220,sidebarCollapsed:false,projectWidth:360});
 assert.equal(await readFile(join(fixture,'missing-atlas','notes.txt'),'utf8'),'Project bytes stay outside app backups.');
 report.checks.push('manual export and verified backup restore resume session independently of sibling and leave project bytes untouched');
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.stack;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 try{if(app)await close();}catch(error){failure??=error;report.status='failed';report.shutdownError=error.message;}
 try{const stopped=await ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);report.cleanup=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{report.cleanup=result;}});}catch(error){failure??=error;report.status='failed';report.cleanupError=error.message;}
 await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;console.log(`Workspace sessions (${mode}): ${report.checks.join('; ')}`);
