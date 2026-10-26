/* global window, document */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openRoleSettingsSection,returnRoleWorkspace,setRoleLanguage,expandRoleFolder} from './folder-role-driver.mjs';
const root=resolve(import.meta.dirname,'..'),fixture=await realpath(await mkdtemp(join(tmpdir(),'status-colors-')));
const source=join(fixture,'Source'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-77-status-colors');
await mkdir(evidence,{recursive:true});
await mkdir(source,{recursive:true});
for(const path of ['Clients/Active/App/Inside','Personal/Active/Tool','Bare'])await mkdir(join(source,path),{recursive:true});
await writeFile(join(source,'Clients/Active/App/Inside/keep.txt'),'Exact project bytes');
const report={issue:77,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),mode:process.env.WORKSPACE_SMOKE_MODE??'dev',checks:[],screens:[],shutdowns:[],status:'running'};
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
 await launch();const workspace=await query({type:'workspace.create',name:'Studio',rootPath:source});
 const sibling=await query({type:'workspace.create',name:'Sibling',rootPath:source});
 const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
 const roles=[{relativePath:'Clients',role:'group'},{relativePath:'Personal',role:'group'},{relativePath:'Clients/Active',role:'status'},{relativePath:'Personal/Active',role:'status'},{relativePath:'Bare',role:'project'}];
 const preview=await call('previewDiscovery',{folderRoles:roles});await call('applyDiscovery',{previewToken:preview.previewToken});
 const before=await call('listProjects'),first=before.categories.find(c=>c.relativePath==='Clients/Active'),second=before.categories.find(c=>c.relativePath==='Personal/Active');
 assert.equal(first.name,'Active');assert.equal(second.name,'Active');assert.notEqual(first.categoryId,second.categoryId);
 await call('setViewGrouping',{viewId:workspace.viewId,config:{propertyId:before.categoryProperty.propertyId,settings:[]}});
 await call('activate');await page.reload();
 const settings=async()=>{await openRoleSettingsSection(page,'workspaces');await page.getByRole('tab',{name:/^(Workspaces|Рабочие пространства)$/}).press('Enter');await page.getByRole('region',{name:source,exact:true}).waitFor();await expandRoleFolder(page,'Clients');await expandRoleFolder(page,'Personal');};
 const saved=async(id,color)=>page.waitForFunction(async({workspaceId,id,color})=>{const result=await window.workspace.workspace({type:'workspace.listCategoryPresentation',workspaceId});return result.ok&&result.value.options.find(o=>o.categoryId===id)?.color===color;},{workspaceId:workspace.workspaceId,id,color});
 for(const language of ['en','ru']){
  await setRoleLanguage(page,language);const en=language==='en',label=en?'Status color':'Цвет статуса',actions=en?'Status actions':'Действия со статусом';
  for(const theme of ['light','dark']){
   await openRoleSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);await settings();
    const color=page.getByRole('combobox',{name:`${label}: Clients/Active`,exact:true}).and(page.locator(':enabled'));
    await color.selectOption('blue');await saved(first.categoryId,'blue');
    await page.waitForFunction(({label})=>document.querySelector(`select[aria-label="${label}: Clients/Active"]`)?.value==='blue',{label});
    await color.scrollIntoViewIfNeeded();let name=`${language}-${theme}-${size.width}-settings.png`;await page.screenshot({path:join(evidence,name)});report.screens.push(name);
    await returnRoleWorkspace(page);
    for(const layout of ['table','board']){
     await call('setViewLayout',{viewId:workspace.viewId,kind:layout});await page.reload();
     const trigger=page.getByRole('button',{name:`${actions}: Clients/Active`,exact:true});await trigger.and(page.locator(':enabled')).press('Enter');
     const menu=page.getByRole('dialog',{name:`${actions}: Clients/Active`,exact:true});
     const editor=menu.getByRole('combobox',{name:`${label}: Clients/Active`,exact:true});await editor.and(page.locator(':enabled')).waitFor();assert.equal(await editor.inputValue(),'blue');
     await editor.selectOption('purple');await saved(first.categoryId,'purple');
     await page.waitForFunction(()=>document.querySelector('.project-group-header h3[data-color="purple"]')!==null);
     name=`${language}-${theme}-${size.width}-${layout}-menu.png`;await page.screenshot({path:join(evidence,name)});report.screens.push(name);
     await editor.press('Escape');await trigger.and(page.locator(':focus')).waitFor();assert.equal(await trigger.evaluate(element=>element===document.activeElement),true);
     assert.equal((await call('listCategoryPresentation')).options.find(o=>o.categoryId===second.categoryId).color,'default');
     assert.ok((await call('listCategoryPresentation',{workspaceId:sibling.workspaceId})).options.every(o=>o.color==='default'));
     await settings();assert.equal(await page.getByRole('combobox',{name:`${label}: Clients/Active`,exact:true}).inputValue(),'purple');
     await page.getByRole('combobox',{name:`${label}: Clients/Active`,exact:true}).selectOption('blue');await saved(first.categoryId,'blue');await returnRoleWorkspace(page);
    }
    report.checks.push({language,theme,width:size.width,settings:true,table:true,board:true,immediateAgreement:true,keyboardEscapeFocus:true,duplicateAndSiblingIsolation:true});
   }
  }
 }
 const expected=await call('listCategoryPresentation');await close();await launch();
 assert.deepEqual(await call('listCategoryPresentation'),expected);
 const after=await call('listProjects');assert.deepEqual(after.projects,before.projects);report.discoveryRevisions={before:before.revision,after:after.revision};
 assert.equal(await readFile(join(source,'Clients/Active/App/Inside/keep.txt'),'utf8'),'Exact project bytes');
 await openRoleSettingsSection(page,'workspaces');await page.getByRole('tab',{name:/^(Workspaces|Рабочие пространства)$/}).press('Enter');await expandRoleFolder(page,'Clients');
 assert.equal(await page.getByRole('combobox',{name:'Цвет статуса: Clients/Active',exact:true}).inputValue(),'blue');
 report.restart=true;report.pathsAndBytes=true;
}catch(error){failed=error;if(page)report.failureState=await page.evaluate(()=>({active:document.activeElement?{tag:document.activeElement.tagName,id:document.activeElement.id,label:document.activeElement.getAttribute("aria-label")}:null,edit:[...document.querySelectorAll('button')].filter(element=>/^(Edit status|Изменить статус): App$/.test(element.getAttribute('aria-label')??'')).map(element=>({disabled:element.disabled,focused:element===document.activeElement})),busy:[...document.querySelectorAll('[aria-busy=true]')].map(element=>element.className)})).catch(()=>null);if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 try{await close();}catch(error){failed??=error;}
 const stopped=ownedProcessesStopped(parents,backends,{launchUnverified});report.stopped=stopped;
 try{await cleanupOwnedFixture(fixture,{processesStopped:stopped,record:result=>{report.cleanup=result;}});}catch(error){failed??=error;}
 report.status=failed?'failed':'passed';report.error=failed?.stack;await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));
}
if(failed)throw failed;
console.log('Status colors passed');
