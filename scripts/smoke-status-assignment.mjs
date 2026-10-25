/* global window, document */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {showRuntimeProject,waitForRuntimeProjectPath} from './runtime-project-visibility.mjs';
import {dragRuntimeGroup} from './runtime-group-drag.mjs';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openRoleSettingsSection,returnRoleWorkspace,setRoleLanguage} from './folder-role-driver.mjs';
const root=resolve(import.meta.dirname,'..'),fixture=await realpath(await mkdtemp(join(tmpdir(),'status-assignment-')));
const source=join(fixture,'Source'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-75-status-moves');
await mkdir(evidence,{recursive:true});
await mkdir(source,{recursive:true});
const report={issue:75,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),mode:process.env.WORKSPACE_SMOKE_MODE??'dev',checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failed,launchUnverified=false,quitEvents,debuggerWait;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function launch(){
 launchUnverified=true;app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')},timeout:30000});parents.add(app.process());
 quitEvents=[];debuggerWait=false;app.process().stdout?.on('data',chunk=>{for(const match of String(chunk).matchAll(/\[status-quit:(before-quit|will-quit|quit|window-all-closed|node-exit)\]/g))quitEvents.push(match[1]);});app.process().stderr?.on('data',chunk=>{debuggerWait ||= String(chunk).includes('Waiting for the debugger to disconnect');});
 await app.evaluate(({app})=>{for(const event of ['before-quit','will-quit','quit','window-all-closed'])app.on(event,()=>process.stdout.write(`[status-quit:${event}]\n`));process.on('exit',()=>process.stdout.write('[status-quit:node-exit]\n'));});
 page=await app.firstWindow();page.setDefaultTimeout(15000);await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(item=>item.type==='Utility'&&item.serviceName?.includes('Node')).map(item=>item.pid)))backends.add(pid);
 launchUnverified=false;
}
async function close(){if(app){const shutdown={normalQuit:false};report.shutdowns.push(shutdown);try{await closeElectron(app);app=null;shutdown.normalQuit=true;shutdown.backendsExited=ownedProcessesStopped(parents,backends);assert.equal(shutdown.backendsExited,true);}catch(error){shutdown.error=error.message;shutdown.forcedCleanup=error.forcedCleanup;app=null;throw error;}finally{shutdown.quitEvents=quitEvents;shutdown.debuggerWait=debuggerWait;}}}
try{
 await launch();const workspace=await query({type:'workspace.create',name:'Studio',rootPath:source,initialize:'status'});
 const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
 for(const path of ['Clients/Active/App/Inside','Personal/Active','Work/Urgent/Task','Bare'])await mkdir(join(source,path),{recursive:true});
await writeFile(join(source,'Clients/Active/App/Inside/keep.txt'),'Exact project bytes');
 const roles=[{relativePath:'Clients',role:'group'},{relativePath:'Personal',role:'group'},{relativePath:'Clients/Active',role:'status'},{relativePath:'Personal/Active',role:'status'},{relativePath:'Work/Urgent',role:'status'},{relativePath:'Bare',role:'project'},{relativePath:'Clients/Active/App/Inside',role:'group'}];
 const preview=await call('previewDiscovery',{folderRoles:roles});await call('applyDiscovery',{previewToken:preview.previewToken});
 const list=await call('listProjects'),project=list.projects.find(p=>p.relativePath==='Clients/Active/App'),personal=list.categories.find(c=>c.relativePath==='Personal/Active'),clients=list.categories.find(c=>c.relativePath==='Clients/Active');
 const property=await call('createProperty',{name:'Notes',propertyType:'text'});await call('setTextValue',{projectId:project.projectId,propertyId:property.propertyId,value:'  Exact notes  '});
 const waitPath=relativePath=>waitForRuntimeProjectPath(page,workspace.workspaceId,project.projectId,relativePath);
 await page.reload();
 for(const language of ['en','ru']){
  await setRoleLanguage(page,language);const en=language==='en';
  for(const layout of ['table','board']){
   await call('setViewLayout',{viewId:workspace.viewId,kind:layout});await page.reload();
   const editor=()=>page.getByRole('button',{name:`${en?'Edit status':'Изменить статус'}: App`,exact:true}).and(page.locator(':enabled'));
   for(const theme of ['light','dark']){
    await openRoleSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnRoleWorkspace(page);
    for(const size of [{width:1024,height:720},{width:1440,height:960}]){
     await page.setViewportSize(size);await showRuntimeProject(page,'App',project.projectId,'Clients/Active');await editor().click();
     const dialog=page.getByRole('dialog',{name:en?'Edit status':'Изменить статус',exact:true}),select=dialog.getByRole('combobox');await select.and(page.locator(':enabled')).waitFor();
     const choices=await select.locator('option').evaluateAll(options=>options.map(o=>({value:o.value,label:o.textContent,disabled:o.disabled})));
     assert.ok(choices.some(o=>o.value===personal.categoryId&&o.label==='Personal/Active'&&!o.disabled));
     assert.ok(choices.some(o=>o.value===clients.categoryId&&o.label==='Clients/Active'&&!o.disabled));
     assert.ok(choices.some(o=>o.label.includes('Work/Urgent')&&o.disabled));assert.ok(choices.some(o=>o.value===''&&o.disabled));
     const name=`${language}-${theme}-${layout}-${size.width}-status.png`;await page.screenshot({path:join(evidence,name)});report.screens.push(name);
     await select.selectOption(personal.categoryId);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
     await editor().and(page.locator(':focus')).waitFor();assert.equal(await editor().evaluate(element=>element===document.activeElement),true);assert.equal((await call('listProjectCategoryMoves')).operations.length,0);
    }
   }
   await showRuntimeProject(page,'App',project.projectId,'Clients/Active');await editor().click();const dialog=page.getByRole('dialog',{name:en?'Edit status':'Изменить статус',exact:true});
   await dialog.getByRole('combobox').selectOption(personal.categoryId);await dialog.getByRole('combobox').press('Enter');await waitPath('Personal/Active/App');await dialog.waitFor({state:'detached'});
   const selector=()=>page.getByLabel(`${en?'Change group':'Изменить группу'}: App`,{exact:true}).and(page.locator(':enabled'));
   await showRuntimeProject(page,'App',project.projectId,'Personal/Active');await selector().waitFor();report.groupState={projection:await call('queryView',{viewId:workspace.viewId,archived:false}),roles:(await call('getFolderChildren',{parentRelativePath:''})).folderRoles,options:await selector().locator('option').evaluateAll(options=>options.map(o=>({label:o.textContent,value:o.value,disabled:o.disabled})))};assert.equal(await selector().locator('option[value="null"]').evaluate(option=>option.disabled),true);
   if(layout==='table')await selector().selectOption(JSON.stringify(clients.categoryId));
   else{
    const handle=page.getByRole('button',{name:`${en?'Drag to change group':'Перетащить для изменения группы'}: App`,exact:true}).and(page.locator(':enabled'));
    await dragRuntimeGroup(handle,page.getByRole('region',{name:'Clients/Active',exact:true}).getByRole('heading'));
   }
   await waitPath('Clients/Active/App');
   await showRuntimeProject(page,'App',project.projectId,'Clients/Active');
   await selector().waitFor();
   await editor().click();const settled=page.getByRole('dialog',{name:en?'Edit status':'Изменить статус',exact:true});await settled.getByRole('combobox').and(page.locator(':enabled')).waitFor();await page.keyboard.press('Escape');await settled.waitFor({state:'detached'});
   await editor().and(page.locator(':focus')).waitFor();assert.equal(await editor().evaluate(element=>element===document.activeElement),true);
   assert.equal(await readFile(join(source,'Clients/Active/App/Inside/keep.txt'),'utf8'),'Exact project bytes');
   assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId).value,'  Exact notes  ');
   report.checks.push({language,layout,paths:true,unavailableChoices:true,cancelFocus:true,statusEditor:true,groupAssignment:true,bytes:true,metadata:true});
  }
 }
 const before=await call('listProjects');await close();await launch();const after=await call('listProjects');
 assert.deepEqual(after.projects.map(p=>[p.projectId,p.relativePath,p.categoryId]),before.projects.map(p=>[p.projectId,p.relativePath,p.categoryId]));
 assert.ok((await call('getFolderChildren',{parentRelativePath:''})).folderRoles.some(r=>r.relativePath==='Clients/Active/App/Inside'&&r.role==='group'));
 await showRuntimeProject(page,'App',project.projectId,'Clients/Active');await page.getByRole('button',{name:'Изменить статус: App',exact:true}).and(page.locator(':enabled')).waitFor();
 report.restart=true;
}catch(error){failed=error;if(page)report.failureState=await page.evaluate(()=>({active:document.activeElement?{tag:document.activeElement.tagName,id:document.activeElement.id,label:document.activeElement.getAttribute("aria-label")}:null,edit:[...document.querySelectorAll('button')].filter(element=>/^(Edit status|Изменить статус): App$/.test(element.getAttribute('aria-label')??'')).map(element=>({disabled:element.disabled,focused:element===document.activeElement})),busy:[...document.querySelectorAll('[aria-busy=true]')].map(element=>element.className)})).catch(()=>null);if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 try{await close();}catch(error){failed??=error;}
 const stopped=ownedProcessesStopped(parents,backends,{launchUnverified});report.stopped=stopped;
 try{await cleanupOwnedFixture(fixture,{processesStopped:stopped,record:result=>{report.cleanup=result;}});}catch(error){failed??=error;}
 report.status=failed?'failed':'passed';report.error=failed?.stack;await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));
}
if(failed)throw failed;
console.log('Status editing and Board/Table assignment passed');
