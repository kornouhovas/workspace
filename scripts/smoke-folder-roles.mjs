/* global window */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,realpath,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openSettingsSection,returnToWorkspace,setInterfaceLanguage} from './runtime-settings.mjs';
const root=resolve(import.meta.dirname,'..'),fixture=await realpath(await mkdtemp(join(tmpdir(),'folder-roles-')));
const source=join(fixture,'Source'),data=join(fixture,'data'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-74-folder-roles');
await mkdir(evidence,{recursive:true});
for(const path of ['Clients/Acme/App','Clients/Bare','Work/Urgent/Task','Archive/cpp'])await mkdir(join(source,path),{recursive:true});
await writeFile(join(source,'Clients','Bare','keep.txt'),'Preserved project bytes');
const parents=new Set(),backends=new Set(),checks=[];let app,page,failed,launchUnverified=false;
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
const query=input=>page.evaluate(input=>window.workspace.workspace(input),input).then(value);
async function launch(){
  launchUnverified=true;app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:data},timeout:30000});parents.add(app.process());
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
  for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(item=>item.type==='Utility'&&item.serviceName?.includes('Node')).map(item=>item.pid)))backends.add(pid);
  launchUnverified=false;
}
async function close(){if(app){const current=app;app=null;await closeElectron(current);}}
async function settings(){await openSettingsSection(page,'workspaces');await page.getByRole('region',{name:source,exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:/^(Sources|Источники)$/}).count(),0);}
async function expand(path){
  const escaped=path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const expand=page.getByRole('button',{name:new RegExp(`^(Expand|Раскрыть): ${escaped}$`)});
  const collapse=page.getByRole('button',{name:new RegExp(`^(Collapse|Свернуть): ${escaped}$`)});
  await expand.or(collapse).waitFor();if(await expand.count())await expand.click();
  await collapse.waitFor();
}
async function role(path,next){await page.getByRole('combobox',{name:new RegExp(`^(Role|Роль): ${path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).selectOption(next);}
async function apply(){
  await page.getByRole('button',{name:/^(Review changes|Проверить изменения)$/}).click();
  const review=page.locator('.folder-role-review');await review.waitFor();
  assert.equal(await review.getByText('First',{exact:true}).count(),1);assert.equal(await review.getByText('Second',{exact:true}).count(),1);
  const apply=review.getByRole('button',{name:/^(Apply folder configuration|Применить настройку папок)$/});assert.equal(await apply.isEnabled(),false);
  await review.getByRole('checkbox').check();await apply.click();await review.waitFor({state:'hidden'});
  await page.getByRole('button',{name:/^(Refresh|Обновить)$/,exact:true}).filter({visible:true}).first().waitFor();
}
try{
  await launch();
  const first=await query({type:'workspace.create',name:'First',rootPath:source,initialize:'status'});
  const sibling=await query({type:'workspace.create',name:'Second',rootPath:source,initialize:'status'});
  const before=await query({type:'workspace.listProjects',workspaceId:first.workspaceId}),bare=before.projects.find(project=>project.relativePath==='Clients/Bare');
  const property=await query({type:'workspace.createProperty',workspaceId:first.workspaceId,name:'Notes',propertyType:'text'});
  await query({type:'workspace.setTextValue',workspaceId:first.workspaceId,projectId:bare.projectId,propertyId:property.propertyId,value:'Keep metadata'});
  await query({type:'workspace.setViewGrouping',workspaceId:first.workspaceId,viewId:first.viewId,config:{propertyId:null,settings:[]}});
  await settings();await expand('Clients');await expand('Work');await expand('Work/Urgent');
  assert.equal(await page.getByRole('combobox',{name:'Role: Work/Urgent/Task',exact:true}).count(),1);
  await role('Clients','group');await role('Clients/Acme','status');await role('Work/Urgent','status');
  await page.getByRole('button',{name:'Review changes',exact:true}).click();
  await page.locator('.folder-role-review').waitFor();await page.screenshot({path:join(evidence,'en-impact-review.png')});
  await page.locator('.folder-role-review').getByRole('checkbox').check();await page.getByRole('button',{name:'Apply folder configuration',exact:true}).click();
  await page.locator('.folder-role-review').waitFor({state:'hidden'});
  const projects=await query({type:'workspace.listProjects',workspaceId:sibling.workspaceId});
  assert.deepEqual(projects.projects.map(project=>project.relativePath).sort(),['Archive/cpp','Clients/Acme/App','Clients/Bare','Work/Urgent/Task']);
  assert.equal(projects.projects.find(project=>project.projectId===bare.projectId).categoryId,null);
  assert.equal((await query({type:'workspace.getViewGrouping',workspaceId:first.workspaceId,viewId:first.viewId})).config.propertyId,null);
  for(const language of ['en','ru']){
    await setInterfaceLanguage(page,language);
    for(const theme of ['light','dark']){
      await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
      for(const size of [{width:1024,height:720},{width:1440,height:960}]){
        await page.setViewportSize(size);await settings();await expand('Clients');await expand('Clients/Acme');await expand('Work');await expand('Work/Urgent');
        await page.locator('.folder-role-settings').scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`${language}-${theme}-${size.width}-roles.png`)});
        await returnToWorkspace(page);
        const noStatus=page.getByRole('heading',{name:new RegExp(`^${language==='en'?'No status':'Без статуса'} `)});
        await noStatus.waitFor();await noStatus.scrollIntoViewIfNeeded();await page.getByRole('cell',{name:'Bare',exact:true}).waitFor();
        await page.screenshot({path:join(evidence,`${language}-${theme}-${size.width}-projects.png`)});
      }
    }
  }
  checks.push('EN/RU, both themes and sizes: contextual roles, no Sources navigation, nearest status and No status projects');
  await settings();await role('Work','group');
  await page.getByRole('combobox',{name:'Роль: Work',exact:true}).press('Escape');
  assert.equal(await page.getByRole('combobox',{name:'Роль: Work',exact:true}).inputValue(),'status');
  await role('Work','group');await apply();
  const saved=(await query({type:'workspace.getFolderChildren',workspaceId:sibling.workspaceId,parentRelativePath:''})).folderRoles;
  assert.equal(saved.find(row=>row.relativePath==='Work/Urgent').role,'status');
  await setInterfaceLanguage(page,'en');await settings();
  await page.getByRole('region',{name:source,exact:true}).locator('.project-archive summary').click();
  await page.getByRole('textbox',{name:'Archive folder relative to the source',exact:true}).fill('Stored');
  await page.getByRole('button',{name:/Review archive folder/}).click();await page.getByRole('button',{name:/Confirm archive folder/}).click();
  await page.waitForFunction(async()=>(await window.workspace.workspace({type:'workspace.listSources'})).value.sources[0].archiveRelativePath==='Stored');
  await page.getByRole('button',{name:'Refresh source',exact:true}).click();
  await returnToWorkspace(page);await close();await launch();
  const reopened=await query({type:'workspace.listProjects',workspaceId:sibling.workspaceId});
  assert.deepEqual(reopened.projects.map(project=>[project.projectId,project.categoryId]),projects.projects.map(project=>[project.projectId,project.categoryId]));
  assert.equal((await query({type:'workspace.listSources'})).sources[0].archiveRelativePath,'Stored');
  assert.equal((await query({type:'workspace.listTextProperties',workspaceId:sibling.workspaceId})).values.find(row=>row.projectId===bare.projectId).value,'Keep metadata');
  assert.equal(await readFile(join(source,'Clients','Bare','keep.txt'),'utf8'),'Preserved project bytes');
  checks.push('explicit project expansion, shared impact confirmation, Escape cancellation, independent views, parent edit preserves child override, shared archive controls and restart IDs/values/files');
}catch(error){failed=error;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally{
  try{await close();}catch(error){failed??=error;}
  const stopped=ownedProcessesStopped(parents,backends,{launchUnverified});let cleanup;
  try{await cleanupOwnedFixture(fixture,{processesStopped:stopped,record:result=>{cleanup=result;}});}catch(error){failed??=error;}
  await writeFile(join(evidence,'result.json'),JSON.stringify({issue:74,sha:process.env.WORKSPACE_SMOKE_SOURCE_SHA??process.env.GITHUB_SHA??null,platform:process.platform,checks,stopped,cleanup,status:failed?'failed':'passed',error:failed?.message},null,2));
}
if(failed)throw failed;
console.log('Folder role settings native journey passed');
