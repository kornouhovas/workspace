/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {setInterfaceLanguage,openSettingsSection,returnToWorkspace} from './runtime-settings.mjs';
import {packagedExecutablePath} from './runtime-executable.mjs';
import {enterContextFor} from './runtime-context-tools.mjs';
const mode=process.argv[2]??'dev';assert.ok(['dev','release'].includes(mode));
const root=resolve(import.meta.dirname,'..'), evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-61-categories-${mode}`);
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-contextual-categories-')));
const report={issue:61,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failure,launchUnverified=false;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
try {
 launchUnverified=true;
 app=await _electron.launch({executablePath:mode==='dev'?createRequire(import.meta.url)('electron'):packagedExecutablePath(root,process.platform,process.arch),args:mode==='dev'?[root]:[],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
 for(const language of ['en','ru']) {
  await setInterfaceLanguage(page,language);const en=language==='en';
  const source=join(fixture,language);await mkdir(join(source,'Planning','Brand refresh'),{recursive:true});await mkdir(join(source,'Delivered'));await writeFile(join(source,'Planning','Brand refresh','keep.txt'),'retained');
  const {workspaceId,viewId}=await query({type:'workspace.create',name:'Design studio',rootPath:source});
  const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
  const initial=await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:'grouped'})).previewToken});
  const project=initial.projects[0], destination=initial.categories.find(c=>c.name==='Delivered').categoryId;
  const propertyId=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
  await call('setTextValue',{projectId:project.projectId,propertyId,value:'Keep this exact note'});
  for(const layout of ['table','board']) {
   await call('setViewLayout',{viewId,kind:layout});await page.reload();
   for(const location of ['list','preview','expanded']) {
    if(location!=='list')await page.getByRole('button',{name:`${en?'Preview project':'Открыть предпросмотр проекта'}: Brand refresh`,exact:true}).click();
    if(location==='expanded')await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
    const scope=location==='list'?page.locator('.saved-view-content'):page.locator('.project-area');
    const moveLabel=en?'Move project category':'Переместить проект в категорию';
    const action=scope.getByRole('button',{name:`${moveLabel}: Brand refresh`,exact:true,includeHidden:true});
    await (await enterContextFor(page,action)).click();
    let dialog=page.getByRole('dialog',{name:moveLabel,exact:true});
    await dialog.getByRole('combobox').selectOption(destination);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    assert.equal((await call('listProjects')).projects[0].relativePath,'Planning/Brand refresh');
    await (await enterContextFor(page,action)).click();dialog=page.getByRole('dialog',{name:moveLabel,exact:true});
    await dialog.getByRole('combobox').press('Escape');
    for(const theme of ['light','dark']) {
     await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
     await (await enterContextFor(page,action)).click();dialog=page.getByRole('dialog',{name:moveLabel,exact:true});await dialog.getByRole('combobox').selectOption(destination);
     for(const [width,height] of [[1024,720],[1440,960]]) {
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const stem=`${language}-${theme}-${layout}-${location}-${width}`;await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
     }
     await dialog.getByRole('combobox').press('Escape');await dialog.waitFor({state:'detached'});
    }
    await (await enterContextFor(page,action)).click();dialog=page.getByRole('dialog',{name:moveLabel,exact:true});await dialog.getByRole('combobox').selectOption(destination);
    await dialog.getByRole('button',{name:en?'Move project folder':'Переместить папку проекта',exact:true}).press('Enter');await dialog.waitFor({state:'detached'});
    const moved=(await call('listProjects')).projects.find(p=>p.projectId===project.projectId);assert.equal(moved.relativePath,'Delivered/Brand refresh');
    assert.equal(await readFile(join(source,moved.relativePath,'keep.txt'),'utf8'),'retained');
    assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId&&v.propertyId===propertyId).value,'Keep this exact note');
    if(location==='expanded')assert.equal(await page.locator(`[data-project-tab="${project.projectId}"]`).count(),1);
    await (await enterContextFor(page,action)).click();dialog=page.getByRole('dialog',{name:moveLabel,exact:true});
    await dialog.getByRole('combobox').selectOption(project.categoryId);
    await dialog.getByRole('button',{name:en?'Move project folder':'Переместить папку проекта',exact:true}).press('Enter');await dialog.waitFor({state:'detached'});
    assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,'Planning/Brand refresh');
    if(location==='expanded')await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
    if(location!=='list')await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
    report.checks.push({language,layout,location,cancelNoEffect:true,identity:true,metadata:true,move:true,return:true});
   }
  }
  const renameProperty=page.getByRole('button',{name:new RegExp(`^${en?'Rename category property':'Переименовать свойство категории'}:`),includeHidden:true});
  await (await enterContextFor(page,renameProperty)).click();
  const labelInput=page.getByRole('textbox',{name:en?'Category property name':'Название свойства категории',exact:true});
  await labelInput.fill('Project stage');await page.getByRole('button',{name:en?'Save category property name':'Сохранить название свойства категории',exact:true}).click();
  await page.getByText(en?'Category property name saved.':'Название свойства категории сохранено.',{exact:true}).waitFor();
  const relabeled=await call('listProjects');assert.equal(relabeled.categoryProperty.name,'Project stage');assert.equal(relabeled.projects[0].relativePath,'Planning/Brand refresh');
  assert.equal(await readFile(join(source,'Planning','Brand refresh','keep.txt'),'utf8'),'retained');
  report.checks.push({language,labelOnly:true,foldersUnchanged:true});
  for(const theme of ['light','dark']) {
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
   for(const reviewKind of ['rename','removal']) {
    const optionsLabel=en?'Category options':'Настроить категории';
    await (await enterContextFor(page,page.getByRole('button',{name:optionsLabel,exact:true,includeHidden:true}))).click();
    const dialog=page.getByRole('dialog',{name:optionsLabel,exact:true});
    if(reviewKind==='rename') {
     await dialog.getByLabel(en?'Folder action':'Действие с папкой',{exact:true}).selectOption('rename');
     await dialog.getByLabel(en?'Category to rename':'Категория для переименования',{exact:true}).selectOption(project.categoryId);
     await dialog.getByLabel(en?'Folder name':'Имя папки',{exact:true}).fill('Campaigns');
     await dialog.getByRole('button',{name:en?'Preview folder effect':'Просмотреть изменения',exact:true}).click();
     await dialog.getByRole('button',{name:en?'Apply folder operation':'Применить к папке',exact:true}).waitFor();
    } else {
     await dialog.getByRole('button',{name:en?'Remove category':'Удалить категорию',exact:true}).click();
     await dialog.getByLabel(en?'Category to remove':'Категория для удаления',{exact:true}).selectOption(project.categoryId);
     await dialog.getByLabel(en?'Destination for its projects':'Куда перенести её проекты',{exact:true}).selectOption(destination);
     await dialog.getByRole('button',{name:en?'Preview category removal':'Предпросмотр удаления категории',exact:true}).click();
     await dialog.getByRole('button',{name:en?'Move projects and remove empty category':'Перенести проекты и удалить пустую категорию',exact:true}).waitFor();
     await dialog.getByText('Planning/Brand refresh → Delivered/Brand refresh',{exact:true}).waitFor();
    }
    for(const [width,height] of [[1024,720],[1440,960]]) {
     await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
     const stem=`${language}-${theme}-${reviewKind}-${width}`;await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
    }
    if(reviewKind==='removal')await dialog.getByRole('button',{name:en?'Close category removal':'Закрыть удаление категории',exact:true}).click();
    await dialog.getByRole('button',{name:en?'Close category options':'Закрыть настройки категорий',exact:true}).click();
    assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,'Planning/Brand refresh');
    report.checks.push({language,theme,reviewKind,cancelNoEffect:true});
   }
  }
 }
 report.status='passed';
} catch(error){failure=error;report.status='failed';report.error=String(error.stack??error);}
finally {
 try{if(app){await closeElectron(app);app=undefined;assert.equal(await ownedProcessesStopped(parents,backends),true);report.shutdowns.push({normalQuit:true,backendsExited:true});}}catch(error){failure??=error;report.status='failed';report.shutdownError=String(error);}
 try{await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:async cleanup=>{report.cleanup=cleanup;await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));}});}catch(error){failure??=error;report.status='failed';report.cleanupError=String(error);}
 await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;
console.log(`Contextual categories ${mode}: ${report.checks.length} journeys, ${report.screens.length} captures, normal shutdown and owned cleanup passed.`);
