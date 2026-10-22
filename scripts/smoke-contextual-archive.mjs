/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped,withDeadline} from './runtime-lifecycle.mjs';
import {setInterfaceLanguage,openSettingsSection,returnToWorkspace} from './runtime-settings.mjs';
import {packagedExecutablePath} from './runtime-executable.mjs';
import {openArchiveTextEditor,exerciseArchiveEditorEntry} from './archive-editor-driver.mjs';
import {waitForRuntimeInterface} from './runtime-startup.mjs';
import {enterContextFor} from './runtime-context-tools.mjs';
const focusOnly=process.argv[3]==='--focus-only';
const mode=process.argv[2]??'dev';assert.ok(['dev','release'].includes(mode));
const root=resolve(import.meta.dirname,'..'), evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-62-archive-${mode}`);
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-contextual-archive-')));
const report={issue:62,mode,focusOnly,phase:'startup',sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failure,launchUnverified=false;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function close(){if(!app)return;const shutdown={normalQuit:false,backendsExited:false};report.shutdowns.push(shutdown);await closeElectron(app);shutdown.normalQuit=true;app=undefined;assert.equal(await ownedProcessesStopped(parents,backends),true);shutdown.backendsExited=true;}
try {
 launchUnverified=true;
 app=await _electron.launch({executablePath:mode==='dev'?createRequire(import.meta.url)('electron'):packagedExecutablePath(root,process.platform,process.arch),args:[root],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await waitForRuntimeInterface(page,status=>{report.startup=status;});
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
 report.editorEntryControl=await exerciseArchiveEditorEntry(page);
 await waitForRuntimeInterface(page,status=>{report.reloadedStartup=status;});

 for(const discoveryMode of (focusOnly ? ['direct'] : ['direct','grouped'])) for(const language of (focusOnly ? ['en'] : ['en','ru'])) {
  await setInterfaceLanguage(page,language); const en=language==='en';
  const source=join(fixture,`${discoveryMode}-${language}`), original=discoveryMode==='direct'?'Brand refresh':'Client/Brand refresh';
  await mkdir(join(source,original),{recursive:true});await writeFile(join(source,original,'keep.txt'),'retained exact bytes');
  const {workspaceId,viewId}=await query({type:'workspace.create',name:'Design studio',rootPath:source});
  const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
  const list=await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:discoveryMode})).previewToken});
  const project=list.projects.find(p=>p.name==='Brand refresh');assert.ok(project);
  await page.reload();
  const actions=page.getByRole('button',{name:`${en?'Project actions':'Действия с проектом'}: Brand refresh`,exact:true});
  await actions.click();
  assert.equal(await page.getByRole('button',{name:`${en?'Archive project':'Архивировать проект'}: Brand refresh`,exact:true}).isDisabled(),true,'Archive is unavailable before source designation');
  await actions.click();
  await call('applyArchiveLocation',{operationId:crypto.randomUUID(),previewToken:(await call('previewArchiveLocation',{relativePath:'Archive'})).previewToken});
  const propertyId=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
  await call('setTextValue',{projectId:project.projectId,propertyId,value:'Keep this exact note'});
  const archiveLabel=en?'Archive project':'Архивировать проект',restoreLabel=en?'Restore project':'Восстановить проект',cancelLabel=en?'Cancel archive review':'Отменить просмотр архива';
  const openAction=async(scope,action)=>{
   const label=action==='archive'?archiveLabel:restoreLabel;
   const button=scope.getByRole('button',{name:`${label}: Brand refresh`,exact:true,includeHidden:true});
   await enterContextFor(page,button);await button.press('Enter');
   return page.getByRole('dialog',{name:label,exact:true});
  };
  const review=async(dialog,action)=>{
   const reviewLabel=action==='archive'?(en?'Review archive':'Проверить архивирование'):(en?'Review restore':'Проверить восстановление');
   await dialog.getByRole('button',{name:reviewLabel,exact:true}).click();
   await dialog.getByText(en?'The project keeps its identity and ordinary properties. The archive mirrors its original relative location. Nothing is overwritten.':'Идентификатор проекта и обычные свойства сохраняются. Архив повторяет исходное относительное размещение. Перезаписи нет.',{exact:true}).waitFor();
  };
  const finish=async(dialog,action)=>{
   await dialog.getByRole('button',{name:action==='archive'?archiveLabel:restoreLabel,exact:true}).click();
   await dialog.getByText(en?'Folder operation completed.':'Операция с папкой завершена.',{exact:true}).waitFor();
   await dialog.getByRole('button',{name:en?'Done':'Готово',exact:true}).click();await dialog.waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>document.activeElement===document.body || !!document.activeElement?.closest('[hidden]')),false,'Completed operation returns to a visible focus owner');
  };
  for(const layout of (focusOnly ? ['table'] : ['table','board'])) {
   await call('setViewLayout',{viewId,kind:layout});await page.reload();
   for(const location of (focusOnly ? ['list'] : ['list','preview','expanded'])) {
    if(location!=='list')await page.getByRole('button',{name:`${en?'Preview project':'Открыть предпросмотр проекта'}: Brand refresh`,exact:true}).click();
    if(location==='expanded')await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
    const scope=location==='list'?page.locator('.saved-view-content'):page.locator('.project-area');
    let dialog=await openAction(scope,'archive');await review(dialog,'archive');
    await dialog.getByRole('button',{name:cancelLabel,exact:true}).press('Escape');await dialog.waitFor({state:'detached'});
    assert.equal((await call('listArchivedProjects')).projects.length,0);
    assert.equal(await readFile(join(source,original,'keep.txt'),'utf8'),'retained exact bytes');
    // Whole-window comparison covers every new menu/dialog surface in both sizes/themes.
    for(const theme of (focusOnly ? [] : ['light','dark'])) {
     if(location==='expanded')await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
     await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
     if(location==='expanded')await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
     for(const size of [{width:1024,height:720},{width:1440,height:960}]) {
      await page.setViewportSize(size);await page.evaluate(()=>document.fonts.ready);
      dialog=await openAction(scope,'archive');await review(dialog,'archive');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const stem=`${discoveryMode}-${language}-${theme}-${layout}-${location}-${size.width}-archive`;
      await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
      await dialog.getByRole('button',{name:cancelLabel,exact:true}).click();await dialog.waitFor({state:'detached'});
     }
    }
    dialog=await openAction(scope,'archive');await review(dialog,'archive');await finish(dialog,'archive');
    const saved=(await call('listArchivedProjects')).projects.find(p=>p.projectId===project.projectId);assert.equal(saved.originalRelativePath,original);
    assert.equal(await readFile(join(source,'Archive',original,'keep.txt'),'utf8'),'retained exact bytes');
    if(location==='expanded')assert.equal(await page.locator(`[data-project-tab="${project.projectId}"]`).count(),1);
    if(location==='list')await page.getByRole('button',{name:en?'Archived':'Архив',exact:true}).click();
    const editLabel=`${en?'Edit Text value':'Редактировать Text-значение'}: Brand refresh / Notes`;
    report.phase={discoveryMode,language,layout,location,step:'archived-editor'};
    const editor=await openArchiveTextEditor(scope,editLabel);
    await editor.fill(`Archived ${layout} ${location}`);
    await scope.getByRole('button',{name:en?'Save value':'Сохранить значение',exact:true}).click();
    await scope.getByRole('button',{name:editLabel,exact:true}).waitFor();
    for(const theme of (focusOnly ? [] : ['light','dark'])) {
     if(location==='expanded')await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
     await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
     if(location==='expanded')await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
     for(const size of [{width:1024,height:720},{width:1440,height:960}]) {
      await page.setViewportSize(size);await page.evaluate(()=>document.fonts.ready);
      dialog=await openAction(scope,'restore');await review(dialog,'restore');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const stem=`${discoveryMode}-${language}-${theme}-${layout}-${location}-${size.width}-restore`;
      await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
      await dialog.getByRole('button',{name:cancelLabel,exact:true}).click();await dialog.waitFor({state:'detached'});
     }
    }
    dialog=await openAction(scope,'restore');await review(dialog,'restore');await finish(dialog,'restore');
    assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,original);
    assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId&&v.propertyId===propertyId).value,`Archived ${layout} ${location}`);
    assert.equal(await readFile(join(source,original,'keep.txt'),'utf8'),'retained exact bytes');
    if(location==='list')await page.getByRole('button',{name:en?'Active':'Активные',exact:true}).click();
    if(location==='expanded') {assert.equal(await page.locator(`[data-project-tab="${project.projectId}"]`).count(),1);await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();}
    if(location!=='list')await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
    report.checks.push({discoveryMode,language,layout,location,cancel:true,archiveRestore:true,identity:true,metadata:true,files:true,retainedTab:location==='expanded'});
   }
  }
 }
 await close();report.status='passed';
} catch(error) {failure=error;report.status='failed';report.failure={name:error.name,message:error.message};if(app)try{try {report.failedInterface=await withDeadline(page.evaluate(async()=>{const status=await window.workspace.getBackendStatus();return {state:status.state,diagnostic:status.diagnostic??null,interfaceReady:document.querySelector('.workspace-screen')?.getAttribute('data-ready')??null,activeTag:document.activeElement?.tagName??null,textareas:document.querySelectorAll('.project-area textarea').length};}),1000,'Archive failure observation');}catch {report.failedInterface={unavailable:true};}await page.screenshot({path:join(evidence,'failure.png'),timeout:2000});await close();}catch(error){report.shutdownFailure=error.message;}}
finally {await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:async cleanup=>{report.cleanup=cleanup;await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}});}
console.info(`Contextual archive: ${report.checks.length} journeys, ${report.screens.length} captures; normal shutdown and owned cleanup verified.`);
