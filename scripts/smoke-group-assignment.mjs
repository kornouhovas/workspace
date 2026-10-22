/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir,release,cpus} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {exerciseGroupAssignment} from './runtime-group-assignment.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {setInterfaceLanguage,openSettingsSection,returnToWorkspace} from './runtime-settings.mjs';
const root=resolve(import.meta.dirname,'..'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-59-assignment');
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-assignment-')));
const report={issue:59,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),cpu:cpus()[0]?.model,checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,failure,launchUnverified=false;
const query=async(_page,input)=>{console.info(`Assignment command: ${input.type}`);const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function close(){if(!app)return;const shutdown={normalQuit:false,backendsExited:false};report.shutdowns.push(shutdown);await closeElectron(app);shutdown.normalQuit=true;app=undefined;assert.equal(await ownedProcessesStopped(parents,backends),true);shutdown.backendsExited=true;}
try{
 launchUnverified=true;
 app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[root],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:join(fixture,'data')}});
 parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);
  const source=join(fixture,language);await mkdir(join(source,'Alpha'),{recursive:true});await mkdir(join(source,'Beta'));await writeFile(join(source,'Alpha','keep.txt'),'unchanged');
  report.checks.push({language,...await exerciseGroupAssignment({page,query,rootPath:source,language,evidenceDirectory:evidence})});
  assert.equal(await readFile(join(source,'Alpha','keep.txt'),'utf8'),'unchanged');
 }
 const source=join(fixture,'studio');for(const name of ['Brand refresh','Customer portal'])await mkdir(join(source,name),{recursive:true});
 const {workspaceId,viewId}=await query(page,{type:'workspace.create',name:'Design studio',rootPath:source});
 const call=(type,fields={})=>query(page,{type:`workspace.${type}`,workspaceId,...fields});
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery')).previewToken})).projects;
 const propertyId=(await call('createProperty',{name:'Stage',propertyType:'single_select'})).propertyId;
 const option=async(name,color)=>(await call('createSelectOption',{propertyId,name,color})).snapshot.selectOptions.find(o=>o.propertyId===propertyId&&o.name===name).optionId;
 const todo=await option('To do','blue');await option('Review','green');
 for(const project of projects)await call('setSelectValue',{projectId:project.projectId,propertyId,optionId:todo});
 await call('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
   for(const layout of ['table','board']){
    await call('setViewLayout',{viewId,kind:layout});await page.reload();
    for(const size of [{width:1024,height:720},{width:1440,height:960}]){
     await page.setViewportSize(size);await page.evaluate(()=>document.fonts.ready);
     const handle=page.getByRole('button',{name:`${language==='en'?'Drag to change group':'Перетащить для изменения группы'}: Brand refresh`,exact:true}).and(page.locator(':enabled'));
     await handle.waitFor();
     const capture=async state=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const stem=`${language}-${theme}-${layout}-${size.width}-${state}`;await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);};
     await capture('idle');
     const target=page.getByRole('region',{name:'Review',exact:true}).getByRole('heading');
     await handle.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
     const from=await handle.boundingBox(),to=await target.boundingBox();assert.ok(from&&to);
     await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
     await page.mouse.move(to.x+Math.min(to.width/2,40),to.y+to.height/2,{steps:16});
     await page.locator('[data-assignment-target="true"]').waitFor();await capture('drag');
     await page.keyboard.press('Escape');await page.mouse.up();
     await page.locator('[data-assignment-target="true"]').waitFor({state:'detached'});
     assert.deepEqual((await call('listTextProperties')).selectValues.filter(v=>v.propertyId===propertyId).map(v=>v.optionId),[todo,todo]);
    }
   }
  }
 }
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.failure={name:error.name,message:error.message};if(app)try{await page.screenshot({path:join(evidence,'failure.png'),timeout:2000});await close();}catch(error){report.shutdownFailure=error.message;}}
finally{await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:async cleanup=>{report.cleanup=cleanup;await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}});}
console.info(`Group assignment: ${report.checks.length} all-type journeys, ${report.screens.length} whole-screen captures; normal shutdown and owned cleanup verified.`);
