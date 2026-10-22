/* global window, document */
import assert from 'node:assert/strict';
import { removeChosenOption } from './selection-editor-driver.mjs';
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
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-selections-')));
const source=join(fixture,'source'), data=join(fixture,'data');
await mkdir(join(source,'Atlas'),{recursive:true});await mkdir(join(source,'Beacon'));
await writeFile(join(source,'Atlas','notes.txt'),'Project bytes stay outside app backups.');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-57-selections-${mode}`);await mkdir(evidence,{recursive:true});
const report={issue:57,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),cpu:cpus()[0]?.model,checks:[],screens:[],shutdowns:[],status:'running'};
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
 const atlas=projects.find(p=>p.name==='Atlas');
 const properties={};
 for(const [propertyType,name] of [['single_select','State'],['multi_select','Tags']]){
  const propertyId=(await call('createProperty',{name,propertyType})).propertyId;
  for(const [name,color] of [['Ready','blue'],['Done','green'],['Hidden','purple']])await call('createSelectOption',{propertyId,name,color});
  properties[propertyType]=propertyId;
 }
 await call('createView',{name:'Board',kind:'board'});
 await query({type:'workspace.activate',workspaceId:one.workspaceId});
 const snapshot=()=>call('listTextProperties');
 const capture=async(name)=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  const menu=page.locator('.selection-popover');const bounds=await menu.boundingBox();
  const viewport=page.viewportSize();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,JSON.stringify({bounds,viewport}));
  await page.screenshot({path:join(evidence,`${name}.png`)});report.screens.push(name);
 };
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);const en=language==='en';
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');
   await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);await returnToWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);
    for(const surface of ['Table','Board','Details']){
     const stem=`${surface}-${language}-${theme}-${size.width}`;
     if(surface!=='Details')await page.getByRole('tab',{name:surface,exact:true}).click();
     else await page.getByRole('button',{name:en?'Preview project: Atlas':'Открыть предпросмотр проекта: Atlas',exact:true}).click();
     const scope=surface==='Details'?page.locator('.project-area'):page.locator('.saved-view-content');
     for(const [kind,name] of [['single_select','State'],['multi_select','Tags']]){
      const propertyId=properties[kind];
      const options=(await snapshot()).selectOptions.filter(o=>o.propertyId===propertyId);
      const single=kind==='single_select';
      await call(single?'setSelectValue':'setMultiSelectValue',{propertyId,projectId:atlas.projectId,...(single?{optionId:options[0].optionId}:{optionIds:[options[0].optionId]})});
      await call('setSelectOptionHidden',{propertyId,optionId:options[0].optionId,hidden:true});
      const label=`${en?(single?'Edit Single Select value':'Edit MultiSelect value'):(single?'Редактировать Single Select-значение':'Редактировать MultiSelect-значение')}: Atlas / ${name}`;
      const trigger=scope.getByRole('button',{name:label,exact:true});await trigger.click();
      const menu=scope.getByRole('dialog',{name:label,exact:true});await menu.waitFor();
      await capture(`${kind}-${stem}`);
      if(single){
       await menu.getByRole('combobox',{name:label,exact:true}).selectOption(options[1].optionId);
       await menu.waitFor({state:'detached'});assert.equal((await snapshot()).selectValues.find(v=>v.propertyId===propertyId&&v.projectId===atlas.projectId).optionId,options[1].optionId);
      }else{
       const ready=menu.getByRole('checkbox',{name:en?'Ready (Hidden)':'Ready (Скрыта)',exact:true});await removeChosenOption(ready);
       await menu.getByRole('checkbox',{name:'Done',exact:true}).check();
       await page.waitForFunction(async({workspaceId,propertyId,projectId,optionId})=>{
        const values=(await window.workspace.workspace({type:'workspace.listTextProperties',workspaceId})).value.multiSelectValues.filter(v=>v.propertyId===propertyId&&v.projectId===projectId);
        return values.length===1&&values[0].optionId===optionId;
       },{workspaceId:one.workspaceId,propertyId,projectId:atlas.projectId,optionId:options[1].optionId});
       await menu.getByRole("button",{name:en ? "Close" : "Закрыть",exact:true}).and(page.locator(":enabled")).waitFor();
       assert.ok(await menu.isVisible());await capture(`chosen-${stem}`);
       await menu.locator('summary').click();
       await capture(`options-${stem}`);
       await menu.getByRole('button',{name:en?'Add option':'Добавить опцию',exact:true}).click();
       const optionName=menu.getByRole('textbox',{name:en?'Option name':'Название опции',exact:true});
       await optionName.press('Enter');await menu.getByRole('alert').waitFor();
       await page.getByRole('button',{name:'Independent studio',exact:true}).click();
       assert.equal(await page.getByRole('button',{name:'Design studio',exact:true}).getAttribute('aria-current'),'page');
       assert.equal(await optionName.isVisible(),true);await capture(`invalid-options-${stem}`);
       await optionName.fill('Retained option draft');await optionName.press('Escape');
       await optionName.waitFor({state:'detached'});assert.equal(await menu.isVisible(),true);
       await menu.getByRole('checkbox',{name:'Done',exact:true}).press('Escape');await menu.waitFor({state:'detached'});
      }
      await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,label);
      report.checks.push(`${kind}-${stem}: immediate save, chosen hidden, open menu, focus return`);
     }
     if(surface==='Details')await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
    }
   }
  }
 }
 const before=await snapshot();await close();await launch();assert.deepEqual(await snapshot(),before);
 assert.equal(await readFile(join(source,'Atlas','notes.txt'),'utf8'),'Project bytes stay outside app backups.');
 assert.equal((await query({type:'workspace.listTextProperties',workspaceId:sibling.workspaceId})).selectOptions.every(option=>!option.hidden),true);
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.stack;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 try{if(app)await close();}catch(error){failure??=error;report.status='failed';report.shutdownError=error.message;}
 try{const stopped=await ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);report.cleanup=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{report.cleanup=result;}});}catch(error){failure??=error;report.status='failed';report.cleanupError=error.message;}
 await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;console.log(`Selection editors (${mode}): ${report.checks.join('; ')}`);
