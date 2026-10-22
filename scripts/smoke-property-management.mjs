/* global window, document */
import assert from 'node:assert/strict';
import { waitForSelectionFocus } from './selection-editor-driver.mjs';
import { activatePropertyView } from './property-editor-driver.mjs';
import { enterContextFor } from './runtime-context-tools.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, realpath, writeFile, readFile } from 'node:fs/promises';
import { tmpdir, release, cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from './runtime-lifecycle.mjs';
import { packagedExecutablePath } from './runtime-executable.mjs';
import { setInterfaceLanguage, openSettingsSection, returnToWorkspace } from './runtime-settings.mjs';
const root=resolve(import.meta.dirname,'..'), mode=process.argv[2]??'dev';
assert.ok(['dev','release'].includes(mode));
const executablePath=mode==='dev'?createRequire(import.meta.url)('electron'):packagedExecutablePath(root,process.platform,process.arch);
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-properties-')));
const source=join(fixture,'source'), data=join(fixture,'data');
await mkdir(join(source,'Atlas'),{recursive:true});await mkdir(join(source,'Beacon'));
await writeFile(join(source,'Atlas','notes.txt'),'Project bytes stay outside app backups.');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-58-properties-${mode}`);await mkdir(evidence,{recursive:true});
const report={issue:58,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),cpu:cpus()[0]?.model,checks:[],screens:[],shutdowns:[],status:'running'};
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
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery')).previewToken})).projects;
 const atlas=projects.find(project=>project.name==='Atlas');
 const propertyId=(await call('createProperty',{name:'Research notes',propertyType:'text'})).propertyId;
 await call('setTextValue',{propertyId,projectId:atlas.projectId,value:'Customer interviews and release checklist'});
 const selectionId=(await call('createProperty',{name:'State',propertyType:'single_select'})).propertyId;
 await call('createSelectOption',{propertyId:selectionId,name:'Ready',color:'blue'});
 await call('createView',{name:'Board',kind:'board'});await call('activate');
 const capture=async stem=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.waitForFunction(()=>{const box=document.querySelector('.property-management-popover')?.getBoundingClientRect();return box&&box.x>=0&&box.y>=0&&box.right<=window.innerWidth+1&&box.bottom<=window.innerHeight+1;});
  const menu=page.locator('.property-management-popover');const box=await menu.boundingBox(),size=page.viewportSize();
  assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,JSON.stringify({box,size}));
  await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
 };
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);const en=language==='en';
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);await returnToWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);
    for(const surface of ['Table','Board','Details']){
     if(surface!=='Details')await activatePropertyView(page,{name:surface,layout:surface.toLowerCase()});
     else await page.getByRole('button',{name:en?'Preview project: Atlas':'Открыть предпросмотр проекта: Atlas',exact:true}).click();
     const scope=surface==='Details'?page.locator('.project-area'):page.locator('.saved-view-content');
     const label=`${en?'Rename property':'Переименовать свойство'}: Research notes`;
     const trigger=(surface==='Details'?scope:page).getByRole('button',{name:label,exact:true,includeHidden:true});await enterContextFor(page,trigger);await trigger.click();
     const name=page.getByRole('textbox',{name:en?'Property name':'Название свойства',exact:true});
     await name.fill('Uncommitted research');await capture(`${surface}-${language}-${theme}-${size.width}-rename`);
     await name.press('Escape');await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,label);
     assert.equal((await call('listTextProperties')).definitions.find(property=>property.propertyId===propertyId).name,'Research notes');
     await trigger.click();await page.getByRole('button',{name:en?'Delete property':'Удалить свойство',exact:true}).click();
     const panel=page.locator('.metadata-removal');await panel.getByText('Customer interviews and release checklist',{exact:true}).waitFor();
     await capture(`${surface}-${language}-${theme}-${size.width}-review`);
     await page.getByRole('button',{name:en?'Cancel deletion':'Отменить удаление',exact:true}).click();
     await panel.waitFor({state:'detached'});
     await page.keyboard.press('Escape');await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,label);
     report.checks.push(`${surface}-${language}-${theme}-${size.width}: contextual rename, reviewed usages, cancel, focus`);
     if(theme==='light'&&size.width===1024)for(const type of ['text','number','date','single_select','multi_select']){
      const add=(surface==='Details'?scope:page).getByRole('button',{name:en?'Add property':'Добавить свойство',exact:true,includeHidden:true});
      await enterContextFor(page,add);await add.click();
      const name=page.getByRole('textbox',{name:en?'Property name':'Название свойства',exact:true});
      await name.fill(`Draft ${type}`);await page.getByRole('combobox',{name:en?'Property type':'Тип свойства',exact:true}).selectOption(type);
      await name.press('Enter');await page.locator('.property-management-popover').waitFor({state:'detached'});
      await waitForSelectionFocus(page,en?'Add property':'Добавить свойство');
      const created=(await call('listTextProperties')).definitions.find(property=>property.name===`Draft ${type}`);assert.equal(created.propertyType,type);
      const rename=(surface==='Details'?scope:page).getByRole('button',{name:`${en?'Rename property':'Переименовать свойство'}: Draft ${type}`,exact:true,includeHidden:true});
      await enterContextFor(page,rename);await rename.click();
      await page.getByRole('button',{name:en?'Delete property':'Удалить свойство',exact:true}).click();
      await page.getByRole('button',{name:en?'Confirm deletion':'Подтвердить удаление',exact:true}).and(page.locator(':enabled')).click();
      await page.locator('.metadata-removal').waitFor({state:'detached'});
      await page.waitForFunction(labels=>labels.includes(document.activeElement?.getAttribute('aria-label')),en?['Add property','View settings','Properties']:['Добавить свойство','Настройки представления','Свойства']);
      assert.ok(!(await call('listTextProperties')).definitions.some(property=>property.propertyId===created.propertyId));
      report.checks.push(`${surface}-${language}-${type}: contextual create/type and current reviewed deletion`);
     }
     if(surface==='Details')await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
    }
   }
  }
 }
 assert.equal((await query({type:'workspace.listTextProperties',workspaceId:sibling.workspaceId})).definitions.find(property=>property.propertyId===propertyId).name,'Research notes');
 const before=await call('listTextProperties');await close();await launch();assert.deepEqual(await call('listTextProperties'),before);
 assert.equal(await readFile(join(source,'Atlas','notes.txt'),'utf8'),'Project bytes stay outside app backups.');
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.stack;if(page){
 await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});
 report.focusState=await page.evaluate(()=>({active:{tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label')},creators:[...document.querySelectorAll('[data-add-property]')].map(button=>({label:button.getAttribute('aria-label'),disabled:button.disabled,hidden:!!button.closest('[hidden], [aria-hidden="true"]'),owner:button.closest('[data-context-owner]')?.getAttribute('data-context-owner')})),loading:[...document.querySelectorAll('.text-properties')].map(panel=>panel.getAttribute('aria-busy'))})).catch(()=>null);
 }}
finally{
 try{if(app)await close();}catch(error){failure??=error;report.status='failed';report.shutdownError=error.message;}
 try{const stopped=await ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);report.cleanup=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{report.cleanup=result;}});}catch(error){failure??=error;report.status='failed';report.cleanupError=error.message;}
 await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;console.log(`Property management (${mode}): ${report.checks.join('; ')}`);
