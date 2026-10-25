/* global window */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,realpath,writeFile,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright-core';
import {runtimeSmokeLaunch} from './runtime-executable.mjs';
import {closeElectron,cleanupOwnedFixture,ownedProcessesStopped} from './runtime-lifecycle.mjs';
import {waitForRuntimeInterface} from './runtime-startup.mjs';
import {createRuntimeSourceDisconnect,createRuntimeSourceMoveEvidence} from './runtime-source-disconnect.mjs';
const mode=process.argv[2]??'dev',root=resolve(import.meta.dirname,'..');
const evidence=resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR??`work/source-outage-${mode}`);
await mkdir(evidence,{recursive:true});
const fixture=await realpath(await mkdtemp(join(tmpdir(),'workspace-source-outage-')));
const source=join(fixture,'source'),otherRoot=join(fixture,'other'),external=join(fixture,'external'),data=join(fixture,'data');
for(const path of [join(source,'Active'),join(source,'Excluded'),join(otherRoot,'Other'),external])await mkdir(path,{recursive:true});
await writeFile(join(source,'Active','keep.txt'),'Active bytes');await writeFile(join(source,'Excluded','keep.txt'),'Excluded bytes');await writeFile(join(otherRoot,'Other','keep.txt'),'Other bytes');
await writeFile(join(external,'keep.txt'),'External bytes');await symlink(external,join(source,'link'),process.platform==='win32'?'junction':'dir');
const report={mode,sha:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,platform:process.platform,status:'running',checks:[],shutdowns:[]};
const parents=new Set(),backends=new Set(),moves=createRuntimeSourceMoveEvidence();let app,page,failure,launchUnverified=false;
const query=async input=>{const result=await page.evaluate(input=>window.workspace.workspace(input),input);assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
async function launch(){
 launchUnverified=true;app=await _electron.launch({...runtimeSmokeLaunch(root,mode),cwd:root,env:{...process.env,WORKSPACE_USER_DATA_DIR:data}});parents.add(app.process());page=await app.firstWindow();page.setDefaultTimeout(15000);
 await waitForRuntimeInterface(page,status=>{report.startup=status;});
 report.packaged=await app.evaluate(({app})=>app.isPackaged);assert.equal(report.packaged,mode==='release');
 for(const pid of await app.evaluate(({app})=>app.getAppMetrics().filter(item=>item.type==='Utility'&&item.serviceName?.includes('Node')).map(item=>item.pid)))backends.add(pid);
 assert.ok(backends.size);launchUnverified=false;
}
async function close(){if(!app)return;await closeElectron(app);app=null;assert.equal(await ownedProcessesStopped(parents,backends),true);report.shutdowns.push({normalQuit:true,backendsExited:true});}
async function capture(stem){await page.screenshot({path:join(evidence,`${stem}.png`)});}
try{
 await launch();
 const first=await query({type:'workspace.create',rootPath:source,name:'Shared first'});
 const sibling=await query({type:'workspace.create',rootPath:source,name:'Shared sibling'});
 const other=await query({type:'workspace.create',rootPath:otherRoot,name:'Isolated'});
 assert.equal(first.sourceId,sibling.sourceId);assert.notEqual(first.viewId,sibling.viewId);assert.notEqual(first.sourceId,other.sourceId);
 const call=(workspaceId,type,fields={})=>query({type:`workspace.${type}`,workspaceId,...fields});
 await call(first.workspaceId,'applyDiscovery',{previewToken:(await call(first.workspaceId,'previewDiscovery',{mode:'direct',excludedRelativePaths:[]})).previewToken});
 await call(first.workspaceId,'applyDiscovery',{previewToken:(await call(first.workspaceId,'previewDiscovery',{mode:'direct',excludedRelativePaths:['Excluded']})).previewToken});
 const saved=await call(first.workspaceId,'listProjects');assert.equal(saved.projects.length,1);assert.equal(saved.retainedProjects.length,1);
 const property=await call(first.workspaceId,'createProperty',{name:'Notes',propertyType:'text'});
 for(const row of [...saved.projects,...saved.retainedProjects])await call(first.workspaceId,'setTextValue',{projectId:row.projectId,propertyId:property.propertyId,value:`  ${row.name}\n日本語\t  `});
 const values=await call(first.workspaceId,'listTextProperties'),otherProjects=await call(other.workspaceId,'listProjects'),otherValues=await call(other.workspaceId,'listTextProperties');
 await query({type:'workspace.activate',workspaceId:first.workspaceId});
 const session=await call(first.workspaceId,'getSession');await call(first.workspaceId,'setSession',{epoch:session.epoch,expectedRevision:session.revision,state:{...session.state,tabs:[saved.projects[0].projectId],expanded:saved.projects[0].projectId}});
 await close();await launch();
 await page.getByRole('tab',{name:'Active',selected:true,exact:true}).waitFor();
 const move=await createRuntimeSourceDisconnect({ownedFixture:fixture,sourceName:'source'});
 await page.evaluate(()=>{window.outageEvents=[];window.stopOutageEvents=window.workspace.onWorkspaceChange(event=>{if(event.type==='workspace.sourceChanged')window.outageEvents.push(event);});});
 for(const cycle of [0,1]){
  if(cycle===1)await page.evaluate(()=>window.stopOutageEvents());
  const eventsBefore=await page.evaluate(()=>window.outageEvents.length);
  for(const direction of ['disconnect','restore']){
   await moves.run(direction,move,async()=>{report.moves=moves.snapshot();await writeFile(join(evidence,'progress.json'),JSON.stringify(report,null,2));});
   await call(first.workspaceId,'refreshSource');
   const unavailable=direction==='disconnect';
   for(const workspace of [first,sibling]){
    const actual=await call(workspace.workspaceId,'listProjects',{observed:true});
    const project=row=>unavailable?{...row,resolution:null,identityReason:'evidence_unavailable'}:row;
    assert.deepEqual(actual,{...saved,workspaceId:workspace.workspaceId,state:unavailable?'unavailable':saved.state,projects:saved.projects.map(project),retainedProjects:saved.retainedProjects.map(project)});
    assert.deepEqual(await call(workspace.workspaceId,'listTextProperties'),{...values,workspaceId:workspace.workspaceId});
   }
   assert.deepEqual(await call(other.workspaceId,'listProjects'),otherProjects);assert.deepEqual(await call(other.workspaceId,'listTextProperties'),otherValues);
   const current=unavailable?join(fixture,'temporarily-disconnected'):source;
   assert.equal(await readFile(join(current,'Active','keep.txt'),'utf8'),'Active bytes');assert.equal(await readFile(join(current,'Excluded','keep.txt'),'utf8'),'Excluded bytes');assert.equal(await readFile(join(otherRoot,'Other','keep.txt'),'utf8'),'Other bytes');assert.equal(await readFile(join(external,'keep.txt'),'utf8'),'External bytes');
   if(unavailable){await page.getByRole('tab',{name:'Active',selected:true,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Locate folder: Active',exact:true}).count(),0);}
   await capture(`cycle-${cycle}-${direction}`);
  }
  if(cycle===0){
   await page.waitForFunction(()=>window.outageEvents.some(event=>!event.source.sourceAvailable)&&window.outageEvents.some(event=>event.source.sourceAvailable));
   const events=await page.evaluate(()=>window.outageEvents);assert.deepEqual(events.map(event=>event.source.sourceAvailable),[false,true]);assert.ok(events.every(event=>event.source.sourceId===first.sourceId&&JSON.stringify([...event.source.workspaceIds].sort())===JSON.stringify([first.workspaceId,sibling.workspaceId].sort())));
  }else assert.equal(await page.evaluate(()=>window.outageEvents.length),eventsBefore);
 }
 moves.assertComplete();report.moves=moves.snapshot();
 await close();await launch();assert.deepEqual(await call(first.workspaceId,'listProjects'),saved);assert.deepEqual(await call(first.workspaceId,'listTextProperties'),values);
 report.checks.push('two verified outage/restore cycles retain active/excluded partition, exact values, identities, source fanout, unsubscribed isolation, restart and all file bytes');
 await close();report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=error.message;if(page)await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});try{await close();}catch(error){report.shutdownFailure=error.message;}}
finally{await cleanupOwnedFixture(fixture,{processesStopped:ownedProcessesStopped(parents,backends,{launchUnverified}),primaryFailure:failure,record:async cleanup=>{report.cleanup=cleanup;await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}});}
console.log(`Source outage ${mode}: two cycles, identity/value/byte retention and cleanup passed.`);
