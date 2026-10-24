/* global window, document */
import assert from 'node:assert/strict';
import { runtimeSmokeLaunch } from './runtime-executable.mjs';
import { createHash } from 'node:crypto';
import { release } from 'node:os';
import { mkdtemp, mkdir, realpath, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import Database from 'better-sqlite3';
import { openSettingsService } from '../dist/service/settings.mjs';
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from './runtime-lifecycle.mjs';
import { openSettingsSection, setInterfaceLanguage } from './runtime-settings.mjs';
const root=resolve(import.meta.dirname,'..'),launchOptions=runtimeSmokeLaunch(root),mode=process.env.WORKSPACE_SMOKE_MODE??'dev',fixture=await realpath(await mkdtemp(join(tmpdir(),'source-association-runtime-')));
const data=join(fixture,'data'),source=join(fixture,'source'),evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??'work/issue-71-source-association');
await mkdir(join(source,'Project'),{recursive:true});await mkdir(evidence,{recursive:true});
const parents=new Set(),backends=new Set(),report={checks:[],screens:[],platform:process.platform,kernel:release(),mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,status:'running'};
let app,page,failed,launchUnverified=false;
const call=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function launch(){launchUnverified=true;app=await _electron.launch({...launchOptions,cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:data}});parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await page.waitForFunction(async()=>(await window.workspace.getBackendStatus()).state==='ready');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Utility'&&m.serviceName?.includes('Node')).map(m=>m.pid)))backends.add(pid);launchUnverified=false;}
async function close(){if(app){const current=app;app=null;await closeElectron(current);}}
async function openSource(){await openSettingsSection(page,'sources');const entry=page.getByRole('button',{name:source,exact:true}),region=page.getByRole('region',{name:source,exact:true});await entry.or(region).waitFor();if(await entry.isVisible())await entry.click();await region.waitFor();}
try{
 if(mode==='release'){const resources=process.platform==='darwin'?join(dirname(launchOptions.executablePath),'..','Resources'):join(dirname(launchOptions.executablePath),'resources');report.appAsarSha256=createHash('sha256').update(await readFile(join(resources,'app.asar'))).digest('hex');}
 const seed=openSettingsService(join(data,'workspace.sqlite'));
 let workspaceId,projectId;
 try {
  const created=seed.handleCommand({type:'workspace.create',name:'Identity recovery',rootPath:source});assert.equal(created.ok,true);workspaceId=created.value.workspaceId;
  const preview=seed.handleQuery({type:'workspace.previewDiscovery',workspaceId,mode:'direct'});assert.equal(preview.ok,true);
  const original=seed.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.value.previewToken});assert.equal(original.ok,true);projectId=original.value.projects[0].projectId;
 } finally {seed.close();}
 const database=new Database(join(data,'workspace.sqlite'));
 try{database.prepare('UPDATE sources SET durable_evidence=NULL').run();database.prepare('UPDATE projects SET durable_evidence=NULL').run();}finally{database.close();}
 await launch();
 assert.equal((await call({type:'workspace.listProjects',workspaceId})).state,'association_review_required');
 for(const language of ['en','ru']){
  await setInterfaceLanguage(page,language);
  for(const theme of ['light','dark']){
   await openSettingsSection(page,'appearance');await page.getByRole('radio',{name:theme==='light'?/^(Light|Светлая)$/:/^(Dark|Тёмная)$/}).click();
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
   await openSource();const panel=page.locator('.source-association');
   await panel.getByRole('button',{name:/^(Review folder association|Проверить связь с папкой)$/}).click();
   await panel.getByRole('checkbox').first().waitFor();assert.equal(await panel.getByRole('checkbox').first().isChecked(),false);
   for(const size of [{width:1024,height:720},{width:1440,height:960}]){
    await page.setViewportSize(size);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    const stem=`${language}-${theme}-${size.width}-review`;await page.screenshot({path:join(evidence,`${stem}.png`)});report.screens.push(stem);
   }
   await panel.getByRole('button',{name:/^(Cancel|Отмена)$/}).click();
   assert.equal((await call({type:'workspace.listProjects',workspaceId})).state,'association_review_required');
   report.checks.push({language,theme,cancel:true,explicitSelection:true});
  }
 }
 await setInterfaceLanguage(page,'en');await openSource();const panel=page.locator('.source-association');
 await panel.getByRole('button',{name:'Review folder association',exact:true}).click();await panel.getByRole('checkbox').first().check();
 await panel.getByRole('button',{name:'Preview selected mappings',exact:true}).click();
 await panel.getByRole('checkbox',{name:'I confirm that these folders should own the retained data',exact:true}).check();
 await panel.getByRole('button',{name:'Confirm association',exact:true}).click();
 await page.waitForFunction(async({workspaceId,projectId})=>{const r=await window.workspace.workspace({type:'workspace.listProjects',workspaceId});return r.ok&&r.value.projects.some(p=>p.projectId===projectId);},{workspaceId,projectId});
 const denied=await page.evaluate(({workspaceId,projectId})=>window.workspace.workspace({type:'workspace.revealProject',workspaceId,projectId}),{workspaceId,projectId});
 assert.equal(denied.ok,false);assert.match(denied.error.message,/safety update/);
 report.checks.push({reviewedEnrollment:true,logicalProjectPreserved:true,nativeDispatchGated:true});
 await close();assert.equal(await ownedProcessesStopped(parents,backends),true);report.status='passed';
}catch(error){failed=error;report.status='failed';report.error=error.stack;}
finally{try{await close();await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failed,record:result=>{report.cleanup=result;}});}catch(error){failed??=error;report.cleanupError=error.stack;report.status='failed';}await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));}
if(failed)throw failed;
console.log(JSON.stringify(report));
