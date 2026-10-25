import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {openSettingsService} from '../dist/service/settings.mjs';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {createNativeProjectReveal} from '../src/desktop/project-reveal.ts';
const observer={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
async function fixture(mode,run,reader){
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'durable-native-'))),root=join(directory,'root'),path=join(directory,'app.sqlite'),relativePath=mode==='grouped'?'Category/Project':'Project';mkdirSync(join(root,relativePath),{recursive:true});writeFileSync(join(root,relativePath,'sentinel'),'unchanged');
 const open=()=>openSettingsService(path,undefined,undefined,observer,undefined,undefined,reader);let service=open();const sql=new Database(path);
 try{
  const workspaceId=service.handleCommand({type:'workspace.create',name:'Native',rootPath:root}).value.workspaceId;
  const preview=service.handleQuery({type:'workspace.previewDiscovery',workspaceId,mode}).value,list=service.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken}).value,projectId=list.projects[0].projectId;
  await run({directory,root,path,relativePath,sql,workspaceId,projectId,get service(){return service;},restart(){service.close();service=open();}});
  assert.equal(readFileSync(join(root,relativePath,'sentinel'),'utf8'),'unchanged');
 }finally{service.close();sql.close();rmSync(directory,{recursive:true,force:true});}
}
for(const mode of ['direct','grouped'])test(`${mode} production Reveal renews stored device history but pins full current proofs at native permit`,()=>fixture(mode,async f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);f.restart();
 let dispatches=0;
 const native=createNativeProjectReveal(async(path,context)=>{await context.permit(()=>{assert.equal(path,join(f.root,f.relativePath));dispatches++;});});
 const result=await f.service.revealProject({type:'workspace.revealProject',workspaceId:f.workspaceId,projectId:f.projectId},(target,verify)=>{
  assert.ok(target.authorization);return native(target,()=>true,async()=>verify());
 });
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'dispatched',JSON.stringify(result));assert.equal(dispatches,1);assert.doesNotMatch(JSON.stringify(result),/authorization|scope|mount|evidence/);
}));

for(const scenario of ['generation','policy','full_identity','scope','peer_owner','cancel'])test(`production native permit rejects ${scenario} changes after readiness`,()=>fixture('grouped',async f=>{
 let entered,release,current=true,dispatches=0;const ready=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const native=createNativeProjectReveal(async(_path,context)=>{entered();await gate;await context.permit(()=>dispatches++);});
 const pending=f.service.revealProject({type:'workspace.revealProject',workspaceId:f.workspaceId,projectId:f.projectId},(target,verify)=>native(target,()=>current,async()=>verify()));await ready;
 if(scenario==='generation')f.sql.exec('UPDATE sources SET evidence_generation=evidence_generation+1');
 if(scenario==='policy')f.sql.exec("UPDATE sources SET excluded_relative_paths='[\"Category/Project\"]'");
 if(scenario==='full_identity')f.sql.exec("UPDATE projects SET durable_evidence=json_set(durable_evidence,'$.created','1')");
 if(scenario==='scope')f.sql.exec("UPDATE projects SET durable_evidence=json_set(durable_evidence,'$.scope','another-installation')");
 if(scenario==='peer_owner')assert.equal(f.service.handleCommand({type:'workspace.create',name:'Late peer',rootPath:join(f.root,f.relativePath)}).ok,true);
 if(scenario==='cancel')current=false;
 release();const result=await pending;assert.equal(result.value.outcome,'rejected',JSON.stringify(result));assert.equal(dispatches,0);
}));

test('main independently rejects contradictory full proof with unchanged native triples before dispatch',()=>fixture('direct',async f=>{
 let dispatches=0;const native=createNativeProjectReveal(()=>{dispatches++;});
 const result=await f.service.revealProject({type:'workspace.revealProject',workspaceId:f.workspaceId,projectId:f.projectId},target=>{
  const altered=structuredClone(target);altered.authorization.folders.at(-1).evidence.created='1';return native(altered,()=>true,async()=>({outcome:'verified'}));
 });
 assert.equal(result.value.outcome,'rejected',JSON.stringify(result));assert.equal(dispatches,0);
}));

for(const mode of ['direct','grouped'])test(`${mode} production file listing and Open pin nested folder proofs and preserve file bytes`,()=>fixture(mode,async f=>{
 mkdirSync(join(f.root,f.relativePath,'Nested'));writeFileSync(join(f.root,f.relativePath,'Nested/note.txt'),'authored file');
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);f.restart();
 const input={workspaceId:f.workspaceId,projectId:f.projectId,relativePath:'Nested'};
 const listed=f.service.handleQuery({type:'workspace.listProjectFiles',...input});assert.equal(listed.ok,true,JSON.stringify(listed));assert.deepEqual(listed.value.entries,[{name:'note.txt',relativePath:'Nested/note.txt',kind:'file'}]);
 let dispatches=0;const native=createNativeProjectReveal(async(path,context,action)=>{await context.permit(()=>{assert.equal(action,'open');assert.equal(path,join(f.root,f.relativePath,'Nested/note.txt'));dispatches++;});});
 const result=await f.service.projectFileCommand({type:'workspace.openProjectFile',...input,relativePath:'Nested/note.txt'},(target,verify)=>{
  assert.ok(target.authorization);assert.ok(target.item.components[0].observation);return native(target,()=>true,async()=>verify());
 });assert.equal(result.value.outcome,'dispatched',JSON.stringify(result));assert.equal(dispatches,1);assert.equal(readFileSync(join(f.root,f.relativePath,'Nested/note.txt'),'utf8'),'authored file');
}));

for(const mode of ['direct','grouped'])for(const renewScope of [false,true])test(`${mode} ${renewScope?'scope-rebound':'same-scope'} archived file targets use current full archive ancestry without changing archive metadata`,()=>fixture(mode,async f=>{
 const q=input=>f.service.handleQuery({workspaceId:f.workspaceId,...input}),c=input=>f.service.handleCommand({workspaceId:f.workspaceId,...input});
 const location=q({type:'workspace.previewArchiveLocation',relativePath:'Archive'});assert.equal(c({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:location.value.previewToken}).ok,true);
 const preview=q({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'archive',name:null,createParent:false});assert.equal(c({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.value.previewToken}).value.operation.stage,'completed');
 const before=f.sql.prepare('SELECT * FROM project_archives').get();
 if(renewScope){
  rmSync(join(f.directory,'installation-scope.json'));f.restart();
  const root=q({type:'workspace.previewSourceAssociation',mappings:[]});assert.equal(c({type:'workspace.applySourceAssociation',previewToken:root.value.previewToken}).ok,true);
  const denied=q({type:'workspace.listProjectFiles',projectId:f.projectId,relativePath:''});assert.equal(denied.value.outcome,'rejected',JSON.stringify(denied));
  const mappings=[{kind:'project',id:f.projectId,relativePath:`Archive/${f.relativePath}`},...(mode==='grouped'?[{kind:'category',id:f.sql.prepare('SELECT category_id FROM projects').get().category_id,relativePath:'Category'}]:[])];
  const bind=q({type:'workspace.previewSourceAssociation',mappings});assert.ok(bind.value.previewToken,JSON.stringify(bind));assert.equal(c({type:'workspace.applySourceAssociation',previewToken:bind.value.previewToken}).ok,true);
 }

 const listed=q({type:'workspace.listProjectFiles',projectId:f.projectId,relativePath:''});assert.equal(listed.value.outcome,'listed',JSON.stringify(listed));assert.equal(listed.value.entries[0].name,'sentinel');
 let calls=0;const native=createNativeProjectReveal(async(path,context)=>{await context.permit(()=>{assert.equal(path,join(f.root,'Archive',f.relativePath,'sentinel'));calls++;});});
 const opened=await f.service.projectFileCommand({type:'workspace.openProjectFile',workspaceId:f.workspaceId,projectId:f.projectId,relativePath:'sentinel'},(target,verify)=>native(target,()=>true,async()=>verify()));assert.equal(opened.value.outcome,'dispatched',JSON.stringify(opened));assert.equal(calls,1);assert.deepEqual(f.sql.prepare('SELECT * FROM project_archives').get(),before);
 const restore=q({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false});assert.equal(c({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:restore.value.previewToken}).value.operation.stage,'completed');
}));

test('archived native targets reject an unowned full identity alias outside the archive subtree',async()=>{
 let selected,alias=false;const reader=(path,scope)=>alias&&path.endsWith('/Other')?{...observeFolder(path,scope),evidence:observeFolder(selected,scope).evidence}:observeFolder(path,scope);
 await fixture('direct',async f=>{
  const q=input=>f.service.handleQuery({workspaceId:f.workspaceId,...input}),c=input=>f.service.handleCommand({workspaceId:f.workspaceId,...input});
  const location=q({type:'workspace.previewArchiveLocation',relativePath:'Archive'});c({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:location.value.previewToken});
  const preview=q({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'archive',name:null,createParent:false});assert.equal(c({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.value.previewToken}).value.operation.stage,'completed');
  selected=join(f.root,'Archive/Project');mkdirSync(join(f.root,'Other'));alias=true;let calls=0;
  const result=await f.service.projectFileCommand({type:'workspace.revealProjectFile',workspaceId:f.workspaceId,projectId:f.projectId,relativePath:'sentinel'},async()=>{calls++;return{outcome:'dispatched'};});assert.equal(result.value.outcome,'rejected',JSON.stringify(result));assert.equal(calls,0);
  alias=false;const restore=q({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false});assert.equal(c({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:restore.value.previewToken}).value.operation.stage,'completed');
 },reader);
});

for(const staleLocator of [false,true])test(`native target rejects a peer source owner with ${staleLocator?'stale':'current'} locator`,()=>fixture('direct',async f=>{
 const path=join(f.root,f.relativePath);assert.equal(f.service.handleCommand({type:'workspace.create',name:'Peer',rootPath:path}).ok,true);
 if(staleLocator)f.sql.prepare("UPDATE sources SET canonical_root=? WHERE canonical_root=?").run(join(f.directory,'missing-peer'),path);
 let calls=0;const result=await f.service.revealProject({type:'workspace.revealProject',workspaceId:f.workspaceId,projectId:f.projectId},async()=>{calls++;return{outcome:'dispatched'};});
 assert.ok(!result.ok||result.value.outcome==='rejected',JSON.stringify(result));assert.equal(calls,0);
}));

for(const role of ['root','parent'])test(`active native authorization rejects an unowned alias of protected ${role}`,async()=>{
 let protectedPath,ambiguous=false;const reader=(path,scope)=>ambiguous&&path.endsWith('/Other')?{...observeFolder(path,scope),evidence:observeFolder(protectedPath,scope).evidence}:observeFolder(path,scope);
 await fixture('grouped',async f=>{
  protectedPath=role==='root'?f.root:join(f.root,'Category');mkdirSync(join(f.root,'Other'));ambiguous=true;let calls=0;
  const result=await f.service.revealProject({type:'workspace.revealProject',workspaceId:f.workspaceId,projectId:f.projectId},async()=>{calls++;return{outcome:'dispatched'};});
  assert.ok(!result.ok||result.value.outcome==='rejected',JSON.stringify(result));assert.equal(calls,0);
 },reader);
});

test('main independently rejects a changed nested directory proof before file dispatch',()=>fixture('direct',async f=>{
 mkdirSync(join(f.root,'Project/Nested'));writeFileSync(join(f.root,'Project/Nested/file.txt'),'nested bytes');let calls=0;
 const native=createNativeProjectReveal(()=>{calls++;});
 const result=await f.service.projectFileCommand({type:'workspace.openProjectFile',workspaceId:f.workspaceId,projectId:f.projectId,relativePath:'Nested/file.txt'},target=>{
  const altered=structuredClone(target);altered.item.components[0].observation.evidence.created='1';return native(altered,()=>true,async()=>({outcome:'verified'}));
 });assert.equal(result.value.outcome,'rejected',JSON.stringify(result));assert.equal(calls,0);assert.equal(readFileSync(join(f.root,'Project/Nested/file.txt'),'utf8'),'nested bytes');
}));

for(const change of ['volume','mount'])test(`native readiness rejects a fresh ${change} observation change`,async()=>{
 let changed=false;const reader=(path,scope)=>{const result=observeFolder(path,scope);return !changed||!result.ok?result:change==='volume'?{...result,evidence:{...result.evidence,volume:'22222222222222222222222222222222'}}:{...result,mount:{...result.mount,dev:'777'}};};
 await fixture('direct',async f=>{
  let entered,release,calls=0;const ready=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const native=createNativeProjectReveal(async(_path,context)=>{entered();await gate;await context.permit(()=>calls++);});
  const pending=f.service.revealProject({type:'workspace.revealProject',workspaceId:f.workspaceId,projectId:f.projectId},(target,verify)=>native(target,()=>true,async()=>verify()));await ready;changed=true;release();
  const result=await pending;assert.equal(result.value.outcome,'rejected',JSON.stringify(result));assert.equal(calls,0);
 },reader);
});
