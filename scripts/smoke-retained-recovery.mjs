/* global window, document, innerWidth */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,realpath,writeFile,readFile,rename} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped,withDeadline} from './runtime-lifecycle.mjs';
import {setInterfaceLanguage,openSettingsSection,returnToWorkspace} from './runtime-settings.mjs';
import {waitForRuntimeInterface} from './runtime-startup.mjs';
import {packagedExecutablePath} from './runtime-executable.mjs';
import {waitForRuntimeRecoverySource} from './runtime-recovery-readiness.mjs';
import {enterContextFor} from './runtime-context-tools.mjs';
const mode=process.argv[2]??'dev';assert.ok(['dev','release'].includes(mode));
const root=resolve(import.meta.dirname,'..'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/issue-65-recovery-${mode}`);
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-retained-recovery-'))),source=join(fixture,'source'),data=join(fixture,'data');
await mkdir(join(source,'Brand refresh'),{recursive:true});await mkdir(join(source,'Release planning'));
await writeFile(join(source,'Brand refresh','original.txt'),'Original bytes stay intact.');
const report={issue:65,mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,kernel:release(),checks:[],screens:[],shutdowns:[],status:'running'};
const parents=new Set(),backends=new Set();let app,page,area,failure,launchUnverified=false;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function launch(){
 launchUnverified=true;
 app=await _electron.launch({executablePath:mode==='dev'?createRequire(import.meta.url)('electron'):packagedExecutablePath(root,process.platform,process.arch),args:mode==='dev'?[root]:[],cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:data}});
 parents.add(app.process());page=await app.firstWindow();area=page.locator('.project-area');page.setDefaultTimeout(15000);
 await waitForRuntimeInterface(page,status=>{report.startup=status;});
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
}
async function close(){if(!app)return;const shutdown={normalQuit:false,backendsExited:false};report.shutdowns.push(shutdown);try { await closeElectron(app); } catch(error) { shutdown.error=error.message; shutdown.forcedCleanup=error.forcedCleanup; throw error; } shutdown.normalQuit=true;app=undefined;assert.equal(await ownedProcessesStopped(parents,backends),true);shutdown.backendsExited=true;}
async function capture(stem){
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Supported window contains the whole work area');
 const dialog=page.getByRole('dialog',{name:/^(Reassociate project folder|Переподключить папку проекта)$/});
 if(await dialog.count())assert.equal(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=window.innerHeight;}),true,'Review is contained in the window');
 await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
}
async function captureState(stem){
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);await returnToWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);
    if(stem==='source-unavailable')assert.equal(await page.locator('.project-navigation > .source-refresh').evaluate(el=>el.getBoundingClientRect().height<window.innerHeight*0.4),true,'Outage status must leave retained navigation usable');
    await capture(`${stem}-${language}-${theme}-${size.width}`);
   }
  }
 }
 await setInterfaceLanguage(page,'en');
}
try{
 await launch();
 const workspace=await query({type:'workspace.create',rootPath:source,name:'Design studio'}),workspaceId=workspace.workspaceId;
 const call=(type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
 const projects=(await call('applyDiscovery',{previewToken:(await call('previewDiscovery',{mode:'direct'})).previewToken})).projects;
 const project=projects.find(p=>p.name==='Brand refresh'),other=projects.find(p=>p.name==='Release planning');assert.ok(project&&other);
 const propertyId=(await call('createProperty',{name:'Notes',propertyType:'text'})).propertyId;
 await call('setTextValue',{projectId:project.projectId,propertyId,value:'Keep the approved brief.'});
 const session=await call('getSession');
 await call('setSession',{epoch:session.epoch,expectedRevision:session.revision,state:{...session.state,tabs:[project.projectId,other.projectId],expanded:project.projectId}});
 await close();await rename(join(source,'Brand refresh'),join(fixture,'held-brand'));await mkdir(join(source,'Recovered brand'));await writeFile(join(source,'Recovered brand','fresh.txt'),'Current target bytes.');await launch();
 await page.getByRole('tab',{name:'Brand refresh',selected:true,exact:true}).waitFor();
 await area.getByText('Folder missing. Project metadata is retained for recovery.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('treeitem',{name:'original.txt',exact:true}).count(),0);
 report.checks.push('restart revalidates missing availability and preserves unique ordered tabs without cached files');
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);const en=language==='en';
  const locateLabel=`${en?'Locate folder':'Найти папку'}: Brand refresh`;
  const title=en?'Reassociate project folder':'Переподключить папку проекта';
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();await returnToWorkspace(page);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);
    for(const placement of ['expanded','preview']){
     if(placement==='preview')await page.getByRole('button',{name:en?'Return project to the right':'Вернуть проект вправо',exact:true}).click();
     const stem=`${language}-${theme}-${size.width}-${placement}`;
     await capture(`${stem}-missing`);
     const locate=area.getByRole('button',{name:locateLabel,exact:true});await locate.press('Enter');
     const dialog=page.getByRole('dialog',{name:title,exact:true});await dialog.getByRole('radio',{name:'Recovered brand',exact:true}).waitFor();
     await capture(`${stem}-review`);
     await dialog.getByRole('button',{name:en?'Cancel':'Отмена',exact:true}).press('Escape');await dialog.waitFor({state:'detached'});
     assert.equal(await locate.evaluate(el=>el===document.activeElement),true,'Cancel returns to the visible current project');
     if(placement==='preview')await page.getByRole('button',{name:en?'Expand project':'Развернуть проект',exact:true}).click();
    }
   }
  }
  await area.getByRole('button',{name:en?'Source settings':'Настройки источника',exact:true}).click();
  await page.getByRole('tab',{name:en?'Workspaces':'Рабочие пространства',selected:true,exact:true}).waitFor();
  await waitForRuntimeRecoverySource(page,source);
  await returnToWorkspace(page);await page.getByRole('tab',{name:'Brand refresh',selected:true,exact:true}).waitFor();
 }
 report.checks.push('EN/RU light/dark both supported sizes: preview/expanded missing/review, Escape/focus, source settings and return');
 await setInterfaceLanguage(page,'en');
 await area.getByRole('button',{name:'Locate folder: Brand refresh',exact:true}).click();
 const review=page.getByRole('dialog',{name:'Reassociate project folder',exact:true});
 await review.getByRole('radio',{name:'Recovered brand',exact:true}).check();
 await mkdir(join(source,'Changed after review'));await call('refreshSource');
 await review.getByText('Folders or associations changed. Refresh, select a folder again and explicitly confirm.',{exact:true}).waitFor();
 assert.equal(await review.getByRole('button',{name:'Reassociate',exact:true}).isDisabled(),true);
 await review.getByRole('button',{name:'Refresh preview',exact:true}).click();
 await review.getByRole('radio',{name:'Recovered brand',exact:true}).waitFor();
 assert.equal(await review.getByRole('radio',{name:'Recovered brand',exact:true}).isChecked(),false);
 await review.getByRole('radio',{name:'Recovered brand',exact:true}).check();
 await review.getByRole('button',{name:'Reassociate',exact:true}).click();await review.waitFor({state:'detached'});
 await page.getByRole('tab',{name:'Recovered brand',selected:true,exact:true}).waitFor();await page.getByRole('treeitem',{name:'fresh.txt',exact:true}).waitFor();
 assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,'Recovered brand');
 assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId&&v.propertyId===propertyId).value,'Keep the approved brief.');
 assert.equal(await readFile(join(fixture,'held-brand','original.txt'),'utf8'),'Original bytes stay intact.');
 report.checks.push('explicit contained current review preserves logical identity, ordinary values and old bytes; fresh target tree replaces old content');
 await rename(join(source,'Recovered brand'),join(source,'Verified move'));await call('refreshSource');
 await page.getByRole('tab',{name:'Verified move',selected:true,exact:true}).waitFor();await page.getByRole('treeitem',{name:'fresh.txt',exact:true}).waitFor();
 assert.equal((await call('listProjects')).projects.find(p=>p.projectId===project.projectId).relativePath,'Verified move');
 report.checks.push('verified external rename refreshes the same retained project and tree');
 await call('applyArchiveLocation',{operationId:crypto.randomUUID(),previewToken:(await call('previewArchiveLocation',{relativePath:'Archive'})).previewToken});
 await call('applyProjectArchive',{operationId:crypto.randomUUID(),previewToken:(await call('previewProjectArchive',{projectId:project.projectId,action:'archive',name:null,createParent:false})).previewToken});
 await area.getByText('Archived',{exact:true}).waitFor();
 const edit=area.getByRole('button',{name:'Edit Text value: Verified move / Notes',exact:true,includeHidden:true});await enterContextFor(page,edit);await edit.click();
 await area.getByRole('textbox',{name:'Edit Text value: Verified move / Notes',exact:true}).fill('Archived brief stays editable.');
 await area.getByRole('button',{name:'Save value',exact:true}).click();
 assert.equal((await call('listTextProperties')).values.find(v=>v.projectId===project.projectId&&v.propertyId===propertyId).value,'Archived brief stays editable.');
 assert.equal(await area.getByRole('button',{name:'Refresh files',exact:true}).isDisabled(),true);
 await captureState('archived-editable');
 await call('applyProjectArchive',{operationId:crypto.randomUUID(),previewToken:(await call('previewProjectArchive',{projectId:project.projectId,action:'restore',name:null,createParent:false})).previewToken});
 await page.getByRole('treeitem',{name:'fresh.txt',exact:true}).waitFor();
 report.checks.push('archived retained context keeps ordinary editing and disables filesystem access; reviewed restore preserves identity');
 await close();await rename(source,join(fixture,'offline-source'));await launch();
 await page.getByRole('tab',{name:'Verified move',selected:true,exact:true}).waitFor();
 const outage=await call('listProjects',{observed:true});assert.equal(outage.state,'unavailable');
 assert.equal(outage.projects.some(p=>p.projectId===project.projectId&&p.resolution===null),true);
 assert.equal(await area.getByRole('button',{name:'Locate folder: Verified move',exact:true}).count(),0);
 assert.equal(await area.getByRole('button',{name:'Refresh files',exact:true}).isDisabled(),true);
 assert.equal(await page.locator('.project-navigation > .source-refresh').evaluate(el=>el.getBoundingClientRect().height<window.innerHeight*0.4),true,'Outage banner leaves retained navigation and recovery on screen');
 await captureState('source-unavailable');
 await area.getByRole('button',{name:'Source settings',exact:true}).click();await page.getByRole('tab',{name:'Workspaces',selected:true,exact:true}).waitFor();
 await openSettingsSection(page,'backup');await page.locator('.settings-page:not([hidden])').getByText('Backup and recovery',{exact:true}).first().waitFor();await returnToWorkspace(page);
 assert.equal(await page.locator('.project-tab [role="tab"]').count(),2);
 await rename(join(fixture,'offline-source'),source);await area.getByRole('button',{name:'Refresh source',exact:true}).click();await page.getByRole('treeitem',{name:'fresh.txt',exact:true}).waitFor();
 report.checks.push('root outage/restart retains tabs without mass missing; workspace settings and Backup remain reachable; reconnect revalidates files');
 const excluded=await call('previewDiscovery',{mode:'direct',excludedRelativePaths:['Verified move']});await call('applyDiscovery',{previewToken:excluded.previewToken});
 await area.getByText('Excluded from discovery. Use Preview folders to include it again.',{exact:true}).waitFor();assert.equal(await area.getByRole('button',{name:'Locate folder: Verified move',exact:true}).count(),0);await captureState('excluded-retained');
 const grouped=await call('previewDiscovery',{mode:'grouped',excludedRelativePaths:[]});await call('applyDiscovery',{previewToken:grouped.previewToken});
 await area.getByText('Retained after a mode change. Text remains editable; locate a folder to reassociate explicitly.',{exact:true}).waitFor();await captureState('mode-inactive-retained');
 assert.ok((await call('listTextProperties')).values.some(v=>v.projectId===project.projectId&&v.value==='Archived brief stays editable.'));
 report.checks.push('current exclusions and mode inactivity remain distinct retained states with preserved ordinary values');
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.failure={name:error.name,message:error.message};if(app)try{try{report.failedInterface=await withDeadline(page.evaluate(()=>({text:document.querySelector('.project-area')?.textContent,focus:{tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute("aria-label")}})),1000,'Recovery failure observation');}catch{report.failedInterface={unavailable:true};}await page.screenshot({path:join(evidence,'failure.png'),timeout:2000});await close();}catch(error){report.shutdownFailure=error.message;}}
finally{await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:async cleanup=>{report.cleanup=cleanup;await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}});}
console.info(`Retained recovery (${mode}): ${report.checks.length} journeys, ${report.screens.length} captures; normal shutdown and owned cleanup verified.`);
