import {EventEmitter} from "node:events";
import {startServiceProcess} from "../dist/service/entry.cjs";
import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import fs from "node:fs";
import {syncBuiltinESMExports} from "node:module";
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {openSettingsService} from '../dist/service/settings.mjs';

function fixture(run,{action='archive',stale=null,native,mode='direct',missingArchiveParents=false,extraNative=null}={}) {
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'legacy-archive-'))),root=join(directory,'root'),path=join(directory,'app.sqlite'),migrations=join(directory,'migrations');
 mkdirSync(join(root,'Cold/Archive'),{recursive:true});mkdirSync(join(migrations,'meta'),{recursive:true});
 const original=mode==='grouped'?'Category/Project':'Project',archived=`Cold/Archive/${original}`,placement=action==='archive'?original:archived;
 if(mode==='grouped'){mkdirSync(join(root,'Category'),{recursive:true});mkdirSync(join(root,'Cold/Archive/Category'),{recursive:true});}mkdirSync(join(root,placement));writeFileSync(join(root,placement,'sentinel'),'exact legacy bytes');
 const journal=JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json','utf8'));journal.entries=journal.entries.slice(0,24);
 for(const entry of journal.entries)copyFileSync(`src/service/db/migrations/${entry.tag}.sql`,join(migrations,`${entry.tag}.sql`));writeFileSync(join(migrations,'meta/_journal.json'),JSON.stringify(journal));
 const sql=new Database(path),sourceId=randomUUID(),workspaceId=randomUUID(),projectId=randomUUID(),operationId=randomUUID(),categoryId=mode==='grouped'?randomUUID():null;let service;
 const identity=(path,role)=>{const value=nativeProjectFilesystem.inspect(path).identity;return {...value,...(stale===role?{dev:'999'}:{})};};
 const camel=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),key==='mode_inactive'?!!value:value]));
 try {
  migrate(drizzle(sql),{migrationsFolder:migrations});sql.pragma('foreign_keys=ON');sql.exec("INSERT INTO settings VALUES ('language','en')");
  const rootIdentity=JSON.stringify(identity(root,'root')),nativeIdentity=JSON.stringify(identity(join(root,placement),'project'));
  sql.prepare("INSERT INTO sources(id,canonical_root,discovery_mode,discovery_revision,applied_root_identity,archive_relative_path) VALUES (?,?,?,1,?,'Cold/Archive')").run(sourceId,root,mode,rootIdentity);
  sql.prepare("INSERT INTO workspaces(id,name,position,source_id) VALUES (?,'Legacy',0,?)").run(workspaceId,sourceId);sql.prepare("INSERT INTO views(id,workspace_id,name,kind) VALUES (?,?,'Table','table')").run(randomUUID(),workspaceId);
  if(categoryId){sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'Category',?,'active')").run(categoryId,sourceId,JSON.stringify(identity(join(root,'Category'),'category')));sql.prepare("INSERT INTO category_properties (id,source_id,name) VALUES (?,?,'Folder category')").run(randomUUID(),sourceId);}
  sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,association_state,mode_inactive,category_id) VALUES (?,?,?,?,'active',?,?)").run(projectId,sourceId,original,nativeIdentity,action==='restore'?1:0,categoryId);
  const propertyId=randomUUID();sql.prepare("INSERT INTO property_definitions(id,source_id,name,property_type,position) VALUES (?,?,'Notes','text',0)").run(propertyId,sourceId);sql.prepare('INSERT INTO text_property_values VALUES (?,?,?,?)').run(projectId,propertyId,sourceId,'  exact legacy value\n');
  const archiveParents=(mode==='grouped'?['Cold','Cold/Archive','Cold/Archive/Category']:['Cold','Cold/Archive']).map((path,index)=>({path,identity:missingArchiveParents?null:identity(join(root,path),`parent${index}`)}));
  if(action==='restore')sql.prepare("INSERT INTO project_archives(project_id,source_id,relative_path,original_relative_path,mode,category_name,parent_identity,parents) VALUES (?,?,?,?,?,?,?,?)").run(projectId,sourceId,archived,original,mode,categoryId?'Category':null,categoryId?JSON.stringify(identity(join(root,'Category'),'category')):rootIdentity,JSON.stringify(archiveParents));
  const binding={source:camel(sql.prepare('SELECT * FROM sources').get()),project:camel(sql.prepare('SELECT * FROM projects').get()),archive:action==='restore'?camel(sql.prepare('SELECT * FROM project_archives').get()):null,category:categoryId?camel(sql.prepare('SELECT * FROM categories').get()):null,
   sourceParents:action==='restore'?archiveParents:categoryId?[{path:'Category',identity:identity(join(root,'Category'),'category')}]:[],destinationParents:action==='archive'?archiveParents:categoryId?[{path:'Category',identity:identity(join(root,'Category'),'category')}]:[],createParent:false,mode,categoryName:categoryId?'Category':null};
  sql.prepare("INSERT INTO project_archive_operations(operation_id,source_id,workspace_id,project_id,action,original_relative_path,requested_relative_path,native_identity,binding,preview_token,parents,stage) VALUES (?,?,?,?,?,?,?,?,?,?,?,'intent')").run(operationId,sourceId,workspaceId,projectId,action,placement,action==='archive'?archived:original,nativeIdentity,JSON.stringify(binding),randomUUID(),JSON.stringify(binding.destinationParents));
  const observer={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
  const open=()=>openSettingsService(path,undefined,undefined,observer,undefined,native);
  let before=sql.prepare('SELECT * FROM project_archive_operations').get();if(missingArchiveParents)rmSync(join(root,'Cold'),{recursive:true});service=open();
  const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
  const rootBinding=query({type:'workspace.previewSourceAssociation',mappings:[]});assert.ok(rootBinding.value.previewToken,JSON.stringify(rootBinding));assert.equal(command({type:'workspace.applySourceAssociation',previewToken:rootBinding.value.previewToken}).ok,true);
  if(extraNative==='root') {
   const old=JSON.parse(before.binding),native=JSON.stringify({...JSON.parse(old.source.appliedRootIdentity),version:2}),triggers=sql.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='project_archive_operations'").all();for(const trigger of triggers)sql.exec(`DROP TRIGGER "${trigger.name}"`);
   sql.prepare("UPDATE project_archive_operations SET binding=json_set(binding,'$.source.appliedRootIdentity',?)").run(native);for(const trigger of triggers)sql.exec(trigger.sql);before=sql.prepare('SELECT * FROM project_archive_operations').get();
  }
  run({root,path,sql,query,command,operationId,projectId,categoryId,before,restart(){service.close();service=open();},send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input)});
 }finally{service?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
}

test('real 0023 archive journal recovers only through explicit exact-tuple attestation',()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,['retry_original','keep_original']);assert.ok(review.value.previewToken);
 const result=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'retry_original'});assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));
 const after=f.sql.prepare('SELECT * FROM project_archive_operations').get();for(const key of ['binding','native_identity','parents','preview_token','operation_id','project_id'])assert.equal(after[key],f.before[key],key);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,1);assert.ok(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence);
 assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact legacy bytes');assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'  exact legacy value\n');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
}));

for(const role of ['root','parent0','parent1','project'])test(`legacy archive cannot attest an unprovable old ${role} device tuple`,()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,[]);assert.equal(review.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
 assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact legacy bytes');
},{stale:role}));

test('real 0023 restore journal preserves archived identity and properties through exact-tuple consent',()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.ok(review.value.previewToken,JSON.stringify(review));
 const restored=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'retry_original'});assert.equal(restored.value.operation.stage,'completed',JSON.stringify(restored));
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);assert.equal(f.query({type:'workspace.listArchivedProjects'}).value.projects.length,0);
 assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact legacy bytes');assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'  exact legacy value\n');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
},{action:'restore'}));


test('a separately attested legacy archive can renew full continuity on a later mount without reusing old tuples',()=>fixture(f=>{
 const first=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId}).value;
 assert.equal(f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:first.previewToken,action:'retry_original'}).value.operation.stage,'intent');assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,1);
 f.restart();const lstat=fs.lstatSync;
 try {
  fs.lstatSync=(path,...options)=>{const stat=lstat(path,...options);if(typeof stat.dev==='bigint')stat.dev=777n;return stat;};syncBuiltinESMExports();
  const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.ok(review.value.previewToken,JSON.stringify(review));
  const kept=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'keep_original'});assert.equal(kept.value.operation.stage,'failed',JSON.stringify(kept));
 }finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,2);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact legacy bytes');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true);assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
},{native(){return 'occupied';}}));


test('real 0023 grouped archive enrolls only its selected project and category',()=>fixture(f=>{
 const category=f.sql.prepare('SELECT * FROM categories WHERE id=?').get(f.categoryId);
 mkdirSync(join(f.root,'Unrelated'));f.sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) SELECT ?,source_id,'Unrelated',?,'active' FROM categories WHERE id=?").run(randomUUID(),JSON.stringify(nativeProjectFilesystem.inspect(join(f.root,'Unrelated')).identity),f.categoryId);
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.ok(review.value.previewToken,JSON.stringify(review));
 const result=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'retry_original'});assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));
 const current=f.sql.prepare('SELECT * FROM categories WHERE id=?').get(f.categoryId);assert.deepEqual({...current,durable_evidence:null},category);assert.ok(current.durable_evidence);assert.equal(f.sql.prepare("SELECT durable_evidence FROM categories WHERE relative_path='Unrelated'").get().durable_evidence,null);
 assert.equal(readFileSync(join(f.root,'Cold/Archive/Category/Project/sentinel'),'utf8'),'exact legacy bytes');
},{mode:'grouped'}));


test('legacy recovery records exclusively created parents separately from consent and retains a valid backup',()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.ok(review.value.previewToken,JSON.stringify(review));
 const result=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'retry_original'});assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));
 assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact legacy bytes');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
},{missingArchiveParents:true}));

test('legacy Keep original immediately replaces a cached reserved projection with the explicitly enrolled project',()=>fixture(f=>{
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 const cached=f.query({type:'workspace.listProjects',observed:true});assert.equal(cached.value.projects.length,0);
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId}).value;assert.ok(review.previewToken);
 const kept=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.previewToken,action:'keep_original'});assert.equal(kept.value.operation.stage,'failed');
 const current=f.query({type:'workspace.listProjects',observed:true});assert.equal(current.value.projects[0]?.projectId,f.projectId,JSON.stringify(current));
 assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact legacy bytes');
}));


test('legacy archive recovery rejects an unknown native identity shape instead of matching only its old triple fields',()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.equal(review.value.previewToken,null,JSON.stringify(review));
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact legacy bytes');
},{extraNative:'root'}));

for(const action of ['archive','restore'])test(`real 0023 grouped ${action} refuses an unprovable category tuple`,()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.deepEqual(review.value.actions,[]);assert.equal(review.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);assert.equal(f.sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence,null);
},{mode:'grouped',action,stale:'category'}));

test('real 0023 grouped restore preserves its category ID after selected-only enrollment',()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.ok(review.value.previewToken,JSON.stringify(review));
 const restored=f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'retry_original'});assert.equal(restored.value.operation.stage,'completed',JSON.stringify(restored));
 const active=f.query({type:'workspace.listProjects'}).value.projects[0];assert.equal(active.projectId,f.projectId);assert.equal(active.categoryId,f.categoryId);assert.equal(readFileSync(join(f.root,'Category/Project/sentinel'),'utf8'),'exact legacy bytes');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true);assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
},{mode:'grouped',action:'restore'}));


test('legacy archive backups reject consistently rewritten policy/native history and broken attestation sequences',()=>fixture(f=>{
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId}).value;
 assert.equal(f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.previewToken,action:'retry_original'}).value.operation.stage,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true);
 for(const mutate of [
  db=>{db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.source.durableEvidence','{\"version\":2}')");db.exec("UPDATE project_archive_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM project_archive_operations))");},
  db=>{db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.source.appliedRootIdentity',json_set(json_extract(binding,'$.source.appliedRootIdentity'),'$.version',2))");db.exec("UPDATE project_archive_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM project_archive_operations))");},
  db=>db.exec("UPDATE project_archive_attestations SET sequence=999"),
  db=>db.exec("UPDATE project_archive_attestations SET parents=json_set(parents,'$[0].observation.evidence.scope','foreign')"),
 ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact legacy bytes');
}));


test('legacy archive consent cannot be renewed after installation scope loss and root-only binding',()=>fixture(f=>{
 const first=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId}).value;
 assert.equal(f.command({type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:first.previewToken,action:'retry_original'}).value.operation.stage,'intent');
 rmSync(join(f.root,'..','installation-scope.json'));f.restart();const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.ok(root.value.previewToken);assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.value.previewToken}).ok,true);
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,[]);assert.equal(review.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,1);assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact legacy bytes');
},{native(){return 'occupied';}}));

test('compiled production IPC attests a real legacy archive without accepting client-supplied proof',()=>fixture(f=>{
 const parent=new EventEmitter(),port=new EventEmitter(),replies=[];parent.postMessage=()=>{};port.postMessage=message=>replies.push(message);port.start=()=>{};port.close=()=>{};
 startServiceProcess(parent);parent.emit('message',{data:{type:'connect',databasePath:f.path},ports:[port]});let serial=0;
 const workspaceId=f.query({type:'workspace.listProjects'}).value.workspaceId;
 const send=input=>{const id=++serial;port.emit('message',{data:{id,input:{workspaceId,...input}}});const reply=replies.find(message=>message.id===id);assert.ok(reply);return reply.result;};
 try{
  const review=send({type:'workspace.previewProjectArchiveRecovery',operationId:f.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.ok(review.value.previewToken,JSON.stringify(review));
  assert.doesNotMatch(JSON.stringify(review),/"(?:authorization|binding|mount|evidence|scope)":/);
  const request={type:'workspace.recoverProjectArchive',operationId:f.operationId,previewToken:review.value.previewToken,action:'retry_original'};
  assert.equal(send({...request,binding:{version:1}}).error.code,'invalid_input');const result=send(request);assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));assert.equal(send(request).ok,false);
  assert.doesNotMatch(JSON.stringify(result),/"(?:authorization|binding|mount|evidence|scope)":/);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact legacy bytes');
 }finally{parent.emit('message',{data:{type:'shutdown'}});}
}));
