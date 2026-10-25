/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openRoleSettingsSection,returnRoleWorkspace,setRoleLanguage} from './folder-role-driver.mjs';
import {enterContextFor} from './runtime-context-tools.mjs';
import {waitForRuntimeInterface} from './runtime-startup.mjs';
const root=resolve(import.meta.dirname,'..'),fixture=await realpath(await mkdtemp(join(tmpdir(),'special-archive-')));
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-76-special-archive');await mkdir(evidence,{recursive:true});
const report={issue:76,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,mode:process.env.WORKSPACE_SMOKE_MODE??'dev',platform:process.platform,kernel:release(),checks:[],screens:[],startups:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failure,launchUnverified=false;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function launch(){
 launchUnverified=true;app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});parents.add(app.process());
 page=await app.firstWindow();page.setDefaultTimeout(15000);await waitForRuntimeInterface(page,status=>{report.startups.push(status);});
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(item=>item.type==='Utility'&&item.serviceName?.includes('Node')).map(item=>item.pid)))backends.add(pid);
 launchUnverified=false;
}
async function close(){if(!app)return;const current=app;app=null;await closeElectron(current);assert.equal(await ownedProcessesStopped(parents,backends),true);report.shutdowns.push({normalQuit:true,backendsExited:true});}
async function capture(stem){await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);}
try{
 await launch();
 for(const language of ['en','ru']){
  const en=language==='en';await setRoleLanguage(page,language);
  const source=join(fixture,language);await mkdir(join(source,'Archive','App'),{recursive:true});await writeFile(join(source,'Archive','App','keep.txt'),'Exact project bytes');
  const workspace=await query({type:'workspace.create',name:`Archive example ${language}`,rootPath:source,initialize:'status'});
  const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const before=await call('listProjects'),project=before.projects.find(p=>p.relativePath==='Archive/App');assert.ok(project);
  const property=await call('createProperty',{name:'Notes',propertyType:'text'});await call('setTextValue',{projectId:project.projectId,propertyId:property.propertyId,value:'Preserved exact notes'});
  await call('setViewGrouping',{viewId:workspace.viewId,config:{propertyId:null,settings:[]}});await page.reload();
  const archiveLabel=en?'Archive project':'Архивировать проект',cancelLabel=en?'Cancel archive review':'Отменить просмотр архива';
  async function open(){
   const button=page.locator('.saved-view-content').getByRole('button',{name:`${archiveLabel}: App`,exact:true,includeHidden:true});await enterContextFor(page,button);await button.press('Enter');
   const dialog=page.getByRole('dialog',{name:archiveLabel,exact:true});await dialog.waitFor();return dialog;
  }
  for(const theme of ['light','dark']){
   await openRoleSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnRoleWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);const dialog=await open();
    const field=dialog.getByLabel(en?'Archive folder relative to the source':'Папка архива относительно источника');await field.fill('Cold storage');
    await dialog.getByRole('button',{name:en?'Review archive folder':'Проверить папку архива',exact:true}).click();
    await dialog.getByRole('button',{name:en?'Confirm archive folder':'Подтвердить папку архива',exact:true}).waitFor();
    await capture(`${language}-${theme}-${size.width}-first-use`);
    await dialog.getByRole('button',{name:cancelLabel,exact:true}).press('Escape');await dialog.waitFor({state:'detached'});
    assert.equal((await call('listArchivedProjects')).relativePath,null);assert.deepEqual((await call('listProjects')).projects,before.projects);
    assert.equal(await readFile(join(source,'Archive','App','keep.txt'),'utf8'),'Exact project bytes');
    assert.equal(await page.evaluate(()=>document.activeElement===document.body||!!document.activeElement?.closest('[hidden]')),false);
   }
  }
  let dialog=await open();const field=dialog.getByLabel(en?'Archive folder relative to the source':'Папка архива относительно источника');
  await field.fill('Archive');await dialog.getByRole('button',{name:en?'Review archive folder':'Проверить папку архива',exact:true}).click();
  await dialog.getByRole('alert').first().waitFor();assert.equal(await dialog.getByRole('button',{name:en?'Confirm archive folder':'Подтвердить папку архива',exact:true}).count(),0);
  await field.fill('Cold storage');await dialog.getByRole('button',{name:en?'Review archive folder':'Проверить папку архива',exact:true}).click();
  await dialog.getByRole('button',{name:en?'Confirm archive folder':'Подтвердить папку архива',exact:true}).click();
  const review=dialog.getByRole('button',{name:en?'Review archive':'Проверить архивирование',exact:true});await review.waitFor();await review.click();
  await dialog.getByText('Archive/App → Cold storage/Archive/App',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:archiveLabel,exact:true}).click();await dialog.getByText(en?'Folder operation completed.':'Операция с папкой завершена.',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:en?'Done':'Готово',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.equal((await call('listArchivedProjects')).projects[0].projectId,project.projectId);
  assert.equal((await call('listProjectArchiveOperations')).operations.length,0);
  await close();await launch();
  assert.equal((await call('listArchivedProjects')).relativePath,'Cold storage');assert.equal((await call('listArchivedProjects')).projects[0].projectId,project.projectId);
  assert.equal(await readFile(join(source,'Cold storage','Archive','App','keep.txt'),'utf8'),'Exact project bytes');
  for(const theme of ['light','dark']){
   await openRoleSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
   await openRoleSettingsSection(page,'workspaces');
   const settings=page.getByRole('tabpanel',{name:en?'Workspaces':'Рабочие пространства',exact:true});
   const summary=settings.locator('summary').filter({hasText:en?'Archive folder relative to the source':'Папка архива относительно источника'});
   if(!await summary.evaluate(element=>element.parentElement.open))await summary.click();
   await settings.getByRole('textbox',{name:en?'Archive folder relative to the source':'Папка архива относительно источника',exact:true}).waitFor();
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);await summary.scrollIntoViewIfNeeded();await capture(`${language}-${theme}-${size.width}-settings`);
   }
  }
  await returnRoleWorkspace(page);
  // Public restore verifies the original path after actual first-use UI archive.
  const restore=await call('previewProjectArchive',{projectId:project.projectId,action:'restore',name:null,createParent:false});assert.deepEqual(restore.blockers,[]);
  assert.equal((await call('applyProjectArchive',{operationId:crypto.randomUUID(),previewToken:restore.previewToken})).operation.stage,'completed');
  await page.reload();dialog=await open();assert.equal(await dialog.getByLabel(en?'Archive folder relative to the source':'Папка архива относительно источника').count(),0);
  await dialog.getByRole('button',{name:cancelLabel,exact:true}).click();
  assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,'Archive/App');
  assert.equal((await call('listTextProperties')).values.find(p=>p.projectId===project.projectId).value,'Preserved exact notes');
  report.checks.push({language,ordinaryStatus:true,cancelNoWrites:true,ownedFolderRejected:true,separateDesignation:true,restart:true,reuse:true,identity:true,values:true,bytes:true,settings:true});
 }
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.message;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 try{await close();}catch(error){failure??=error;report.shutdownError=error.message;report.status='failed';}
 try{await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:result=>{report.cleanup=result;}});}finally{await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
if(failure)throw failure;
console.log(`Special archive: ${report.checks.length} journeys, ${report.screens.length} captures, restart and owned cleanup passed.`);
