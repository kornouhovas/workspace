/* global window, document */
import assert from 'node:assert/strict';
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
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-scalars-')));
const source=join(fixture,'source'), data=join(fixture,'data');
await mkdir(join(source,'Atlas'),{recursive:true});await mkdir(join(source,'Beacon'));
await writeFile(join(source,'Atlas','notes.txt'),'Project bytes stay outside app backups.');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-56-scalars-${mode}`);await mkdir(evidence,{recursive:true});
const report={issue:56,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),cpu:cpus()[0]?.model,checks:[],screens:[],shutdowns:[],status:'running'};
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
 for(const [propertyType,name] of [['text','Notes'],['number','Budget'],['date','Deadline']]) properties[propertyType]=(await call('createProperty',{name,propertyType})).propertyId;
 await call('setTextValue',{propertyId:properties.text,projectId:atlas.projectId,value:'Research notes\nKeep exact authored content'});
 await call('createView',{name:'Board',kind:'board'});
 await query({type:'workspace.activate',workspaceId:one.workspaceId});
 await page.getByRole('button',{name:'Preview project: Atlas',exact:true}).waitFor();
 const snapshot=()=>call('listTextProperties');
 const label=(en,type)=>`${en?`Edit ${type} value`:`Редактировать ${type}-значение`}: Atlas / ${type==='Text'?'Notes':type==='Number'?'Budget':'Deadline'}`;
 const capture=async(name)=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
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
     if(surface!=='Details'){
      await page.getByRole('tab',{name:surface,exact:true}).click();
     }else await page.getByRole('button',{name:en?'Preview project: Atlas':'Открыть предпросмотр проекта: Atlas',exact:true}).click();
     const scope=surface==='Details'?page.locator('.project-area'):page.locator('.saved-view-content');
     await scope.getByRole('button',{name:label(en,'Text'),exact:true}).click();
     let editor=scope.getByRole('textbox',{name:label(en,'Text'),exact:true});
     await editor.fill('Line one');await editor.press('End');await editor.press('Enter');await editor.press('a');
     assert.equal(await editor.inputValue(),'Line one\na');
     await capture(`text-${stem}`);await editor.press('Control+Enter');
     await scope.getByRole('button',{name:label(en,'Text'),exact:true}).waitFor();
     assert.equal((await snapshot()).values.find(v=>v.projectId===atlas.projectId).value,'Line one\na');
     await scope.getByRole('button',{name:label(en,'Number'),exact:true}).click();
     editor=scope.getByRole('textbox',{name:label(en,'Number'),exact:true});await editor.fill('1/0');await editor.press('Enter');
     await scope.getByRole('alert').waitFor();await capture(`invalid-${stem}`);
     if(surface==='Details'){
      await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
      assert.equal(await page.locator('.project-area').count(),1);
     }else{
      await page.getByRole('button',{name:'Independent studio',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Design studio',exact:true}).getAttribute('aria-current'),'page');
     }
     assert.equal(await editor.inputValue(),'1/0');await editor.fill('10+5');await editor.press('Enter');
     await scope.getByRole('button',{name:label(en,'Number'),exact:true}).waitFor();
     assert.equal((await snapshot()).numberValues.find(v=>v.projectId===atlas.projectId).value,15);
     await scope.getByRole('button',{name:label(en,'Number'),exact:true}).click();
     editor=scope.getByRole('textbox',{name:label(en,'Number'),exact:true});assert.equal(await editor.inputValue(),'15');await editor.press('Escape');
     await scope.getByRole('button',{name:label(en,'Date'),exact:true}).click();
     editor=scope.getByRole('textbox',{name:label(en,'Date'),exact:true});await editor.fill('2024-02-29');
     await scope.getByRole('button',{name:en?'Choose calendar date':'Выбрать дату в календаре',exact:true}).click();
     await capture(`calendar-${stem}`);
     const calendar=scope.locator('input[type=date]');await calendar.fill('0001-01-01');
     await scope.getByRole('button',{name:label(en,'Date'),exact:true}).waitFor();
     assert.equal((await snapshot()).dateValues.find(v=>v.projectId===atlas.projectId).value,'0001-01-01');
     await scope.getByRole('button',{name:label(en,'Date'),exact:true}).click();
     await scope.getByRole('textbox',{name:label(en,'Date'),exact:true}).fill('2024-02-29');
     if(surface==='Details'){
      await page.getByRole('button',{name:en?'Close preview':'Закрыть предпросмотр',exact:true}).click();
      await page.locator('.project-area').waitFor({state:'detached'});
      await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,en?'Preview project: Atlas':'Открыть предпросмотр проекта: Atlas');
     }else{
      await page.getByRole('button',{name:'Independent studio',exact:true}).click();
      await page.getByRole('button',{name:'Independent studio',exact:true}).and(page.locator('[aria-current=page]')).waitFor();
      await page.getByRole('button',{name:'Design studio',exact:true}).click();
      await page.getByRole('button',{name:'Design studio',exact:true}).and(page.locator('[aria-current=page]')).waitFor();
     }
     assert.equal((await snapshot()).dateValues.find(v=>v.projectId===atlas.projectId).value,'2024-02-29');
     report.checks.push(`${stem}: multiline commit, invalid guard, correction, result-only Number, calendar immediate and manual Date before navigation`);
    }
   }
  }
 }
 assert.ok(sibling.workspaceId);
 assert.equal(await readFile(join(source,'Atlas','notes.txt'),'utf8'),'Project bytes stay outside app backups.');
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.stack;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
 try{if(app)await close();}catch(error){failure??=error;report.status='failed';report.shutdownError=error.message;}
 try{const stopped=await ownedProcessesStopped(parents,backends,{launchUnverified});assert.equal(stopped,true);report.cleanup=await cleanupOwnedFixture(fixture,{processesStopped:stopped,primaryFailure:failure,record:result=>{report.cleanup=result;}});}catch(error){failure??=error;report.status='failed';report.cleanupError=error.message;}
 await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));
}
if(failure)throw failure;console.log(`Scalar drafts (${mode}): ${report.checks.join('; ')}`);
