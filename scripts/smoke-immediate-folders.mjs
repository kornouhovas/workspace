/* global window, document */
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, realpath, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron, cleanupOwnedFixture, ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {openSettingsSection, returnToWorkspace, setInterfaceLanguage} from './runtime-settings.mjs';

const root=resolve(import.meta.dirname,'..');
const fixture=await realpath(await mkdtemp(join(tmpdir(),'immediate-folders-runtime-')));
const source=join(fixture,'Root'),data=join(fixture,'data');
for (const path of ['Archive/cpp/nested','Archive/design_system','Projects/Anytype','Projects/draw','Empty']) await mkdir(join(source,path),{recursive:true});
await writeFile(join(source,'Projects','draw','keep.txt'),'User project bytes');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-73-immediate-folders');
await mkdir(evidence,{recursive:true});
const parents=new Set(),backends=new Set(),checks=[];
let app,page,failed,launchUnverified=false;
const unwrap=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
const query=input=>page.evaluate(input=>window.workspace.workspace(input),input).then(unwrap);
async function launch() {
  launchUnverified=true;
  app=await _electron.launch({...runtimeSmokeLaunch(root),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:data},timeout:30000});
  parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
  const pids=await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid));
  assert.ok(pids.length);for (const pid of pids) backends.add(pid);launchUnverified=false;
}
async function close(){if(app){const current=app;app=null;await closeElectron(current);}}
const add=()=>page.getByRole('navigation',{name:/^(Workspaces|Рабочие пространства)$/}).getByRole('button',{name:/^(Add workspace|Добавить рабочее пространство)$/});
try {
  await launch();
  await app.evaluate(({dialog})=>{globalThis.savedPicker=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
  await add().press('Enter');
  await page.getByRole('heading',{name:'Folder selection cancelled',exact:true}).waitFor();
  assert.equal((await query({type:'workspace.load'})).workspaces.length,0);
  await app.evaluate(({dialog},source)=>{dialog.showOpenDialog=globalThis.savedPicker;process.env.WORKSPACE_TEST_ROOT_PICKER_PATH=source;},source);
  await add().press('Enter');
  await page.getByRole('cell',{name:'cpp',exact:true}).waitFor();
  await page.getByRole('cell',{name:'design_system',exact:true}).waitFor();
  await page.getByRole('cell',{name:'Anytype',exact:true}).waitFor();
  await page.getByRole('cell',{name:'draw',exact:true}).waitFor();
  const archive=page.getByRole('region',{name:'Archive',exact:true});
  const ordinaryProjects=page.getByRole('region',{name:'Projects',exact:true});
  for (const name of ['cpp','design_system']) assert.equal(await archive.getByRole('cell',{name,exact:true}).count(),1);
  for (const name of ['Anytype','draw']) assert.equal(await ordinaryProjects.getByRole('cell',{name,exact:true}).count(),1);
  for (const name of ['Archive','Projects']) assert.equal(await page.getByRole('cell',{name,exact:true}).count(),0);
  const first=(await query({type:'workspace.load'})).activeWorkspace;
  const projects=await query({type:'workspace.listProjects',workspaceId:first.workspaceId});
  assert.equal(first.name,'Workspace');assert.equal(projects.mode,'grouped');
  assert.deepEqual(projects.projects.map(p=>p.relativePath).sort(),['Archive/cpp','Archive/design_system','Projects/Anytype','Projects/draw']);
  assert.equal((await query({type:'workspace.getViewGrouping',workspaceId:first.workspaceId,viewId:first.viewId})).config.propertyId,projects.categoryProperty.propertyId);
  assert.equal((await query({type:'workspace.listSources'})).sources[0].archiveRelativePath,null);
  assert.equal(await page.getByRole('button',{name:/^(Set up later|Настроить позже)$/}).count(),0);
  checks.push({cancellationCreatesNothing:true,immediateProjects:true,archiveAndProjectsSections:true,ordinaryArchive:true,defaultGrouping:true});
  for (const language of ['en','ru']) {
    await setInterfaceLanguage(page,language);
    await page.getByRole('columnheader',{name:language==='ru'?'Статус':'Status',exact:true}).first().waitFor();
    for (const theme of ['light','dark']) {
      await openSettingsSection(page,'appearance');
      await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
      await returnToWorkspace(page);
      for (const size of [{width:1024,height:720},{width:1440,height:960}]) {
        await page.setViewportSize(size);
        await page.getByRole('cell',{name:'cpp',exact:true}).waitFor();
        await page.screenshot({path:join(evidence,`${language}-${theme}-${size.width}.png`)});
        checks.push({language,theme,size,projectsVisible:true});
      }
    }
  }
  await close();await launch();
  assert.deepEqual((await query({type:'workspace.listProjects',workspaceId:first.workspaceId})).projects,projects.projects);
  await page.getByRole('cell',{name:'draw',exact:true}).waitFor();
  await app.evaluate((_electron,source)=>{process.env.WORKSPACE_TEST_ROOT_PICKER_PATH=source;},source);
  await add().press('Enter');
  await page.waitForFunction(async()=>(await window.workspace.workspace({type:'workspace.load'})).value?.workspaces.length===2);
  const sibling=(await query({type:'workspace.load'})).activeWorkspace;
  assert.equal(sibling.sourceId,first.sourceId);assert.notEqual(sibling.workspaceId,first.workspaceId);
  assert.deepEqual((await query({type:'workspace.listProjects',workspaceId:sibling.workspaceId})).projects,projects.projects);
  assert.equal(await readFile(join(source,'Projects','draw','keep.txt'),'utf8'),'User project bytes');
  checks.push({restartPreservesProjects:true,sourceReuse:true,fileBytesPreserved:true});
} catch(error){failed=error;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});}
finally {
  try{await close();}catch(error){failed??=error;}
  const stopped=ownedProcessesStopped(parents,backends,{launchUnverified});
  let cleanup;
  try{await cleanupOwnedFixture(fixture,{processesStopped:stopped,record:result=>{cleanup=result;}});}catch(error){failed??=error;}
  await writeFile(join(evidence,'result.json'),JSON.stringify({issue:73,sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['diff','--name-only'],{cwd:root,encoding:'utf8'}).trim(),platform:process.platform,mode:process.env.WORKSPACE_SMOKE_MODE??'dev',checks,stopped,cleanup,status:failed?'failed':'passed',error:failed?.message},null,2));
}
if(failed)throw failed;
console.log('Immediate folder opening native journey passed');
