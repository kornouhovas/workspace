import {EventEmitter} from "node:events";
import {startServiceProcess} from "../dist/service/entry.cjs";
import {spawnSync} from "node:child_process";
import {nativeProjectFilesystem} from "../src/service/project-filesystem.ts";
import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import fs from "node:fs";
import {syncBuiltinESMExports} from "node:module";
import {renameNoReplace} from "../dist/service/project-rename-filesystem.mjs";
import {observeFolder} from "../src/service/folder-evidence.ts";
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {openSettingsService} from '../dist/service/settings.mjs';
const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
function fixture(run,{mode='direct',...options}={}) {
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'durable-project-archive-'))),root=join(directory,'root'),path=join(directory,'app.sqlite'),relativePath=mode==='grouped'?'Category/Project':'Project';
 mkdirSync(join(root,relativePath),{recursive:true});writeFileSync(join(root,relativePath,'sentinel'),'exact contents');
 const open=()=>openSettingsService(path,undefined,undefined,observer,options.filesystem,options.native,options.reader);
 let service=open();const workspace=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const discovery=query({type:'workspace.previewDiscovery',mode}).value,list=command({type:'workspace.applyDiscovery',previewToken:discovery.previewToken}).value,projectId=list.projects[0].projectId;
 const propertyId=command({type:'workspace.createProperty',propertyType:'text',name:'Notes'}).value.propertyId;command({type:'workspace.setTextValue',projectId,propertyId,value:'exact metadata'});
 const location=query({type:'workspace.previewArchiveLocation',relativePath:'Cold/Archive'}).value;assert.ok(location.previewToken);assert.equal(command({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:location.previewToken}).ok,true);
 const sql=new Database(path),review=action=>query({type:'workspace.previewProjectArchive',projectId,action,name:null,createParent:false}),apply=preview=>command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.previewToken});
 try{run({root,directory,path,relativePath,projectId,sql,query,command,review,apply,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),restart(){service.close();service=open();}});}
 finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
for(const mode of ['direct','grouped'])test(`durable ${mode} archive and restore preserve identity, contents and metadata after stored device changes`,()=>fixture(f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);
 const before=f.sql.prepare('SELECT * FROM projects').get();f.restart();
 const preview=f.review('archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.blockers,[]);assert.ok(preview.value.previewToken);
 const archived=f.apply(preview.value);assert.equal(archived.ok,true,JSON.stringify(archived));assert.equal(archived.value.operation.stage,'completed',JSON.stringify(archived));
 assert.equal(existsSync(join(f.root,f.relativePath)),false);assert.equal(readFileSync(join(f.root,'Cold/Archive',f.relativePath,'sentinel'),'utf8'),'exact contents');
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').get(),{...before,mode_inactive:1});assert.equal(f.query({type:'workspace.listArchivedProjects'}).value.projects[0].projectId,f.projectId);
 f.restart();const restore=f.review('restore');assert.equal(restore.ok,true,JSON.stringify(restore));assert.deepEqual(restore.value.blockers,[]);assert.ok(restore.value.previewToken);
 const restored=f.apply(restore.value);assert.equal(restored.value.operation.stage,'completed',JSON.stringify(restored));assert.deepEqual(f.sql.prepare('SELECT * FROM projects').get(),before);
 assert.equal(readFileSync(join(f.root,f.relativePath,'sentinel'),'utf8'),'exact contents');assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact metadata');
},{mode}));

test('a saved source appearing inside the project after archive Preview prevents the physical move',()=>fixture(f=>{
 const preview=f.review('archive');assert.ok(preview.value.previewToken);mkdirSync(join(f.root,'Project/Nested'));
 assert.equal(f.command({type:'workspace.create',name:'Nested source',rootPath:join(f.root,'Project/Nested')}).ok,true);
 const result=f.apply(preview.value);assert.equal(result.ok,false,JSON.stringify(result));assert.equal(existsSync(join(f.root,'Project/sentinel')),true);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_operations').get().n,0);assert.equal(existsSync(join(f.root,'Cold')),false);
}));

test('archive refuses a project durable alias in an unowned eligible folder',()=>{
 let rootPath,ambiguous=false;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return ambiguous&&value.ok&&basename(path)==='Other'?{...value,evidence:observeFolder(join(rootPath,'Project'),scope).evidence}:value;};
 fixture(f=>{rootPath=f.root;mkdirSync(join(f.root,'Other'));ambiguous=true;const preview=f.review('archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null,JSON.stringify(preview));assert.equal(existsSync(join(f.root,'Project/sentinel')),true);},{reader});
});

test('archive refuses another retained logical owner with the same full project identity',()=>fixture(f=>{
 const current=f.sql.prepare('SELECT source_id,native_identity,durable_evidence FROM projects WHERE id=?').get(f.projectId);
 f.sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,association_state,mode_inactive,durable_evidence) VALUES(?,?,'Retained',?,'missing',0,?)").run(randomUUID(),current.source_id,JSON.stringify({dev:'888',ino:'1',birthtimeNs:'2'}),current.durable_evidence);
 const preview=f.review('archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null,JSON.stringify(preview));assert.equal(existsSync(join(f.root,'Project/sentinel')),true);
}));

test('restore cannot enclose a missing legacy saved source below its destination',()=>fixture(f=>{
 const archived=f.apply(f.review('archive').value);assert.equal(archived.value.operation.stage,'completed');
 f.sql.prepare('INSERT INTO sources(id,canonical_root) VALUES(?,?)').run(randomUUID(),join(f.root,'Project/Peer'));
 const preview=f.review('restore');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null,JSON.stringify(preview));
 assert.equal(existsSync(join(f.root,'Project')),false);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
}));

test('late evidence-generation invalidation after terminal SQL rolls back archive metadata and completion',()=>fixture(f=>{
 const preview=f.review('archive').value,before=f.sql.prepare('SELECT * FROM sources').get(),project=f.sql.prepare('SELECT * FROM projects').get();
 const prepare=Database.prototype.prepare;let changed=false;
 Database.prototype.prepare=function(sql,...args){const statement=prepare.call(this,sql,...args);if(sql.trimStart().toLowerCase().startsWith('update "project_archive_operations"')){const run=statement.run;statement.run=function(...values){const result=run.apply(this,values);if(values.flat().includes('completed')){changed=true;prepare.call(this.database??f.sql,'UPDATE sources SET evidence_generation=evidence_generation+1').run();}return result;};}return statement;};
 let result;try{result=f.apply(preview);}finally{Database.prototype.prepare=prepare;}
 assert.equal(changed,true);assert.equal(result.value.operation.stage,'destination_recorded',JSON.stringify(result));
 assert.deepEqual(f.sql.prepare('SELECT * FROM sources').get(),before);assert.deepEqual(f.sql.prepare('SELECT * FROM projects').get(),project);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archives').get().n,0);
 assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'Project')),false);
}));

test('a changed full parent proof after Preview prevents archive intent and all effects',()=>{
 let changed=false;const reader=(path,scope)=>{const proof=observeFolder(path,scope);return changed&&proof.ok&&basename(path)==='Archive'?{...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}}:proof;};
 fixture(f=>{mkdirSync(join(f.root,'Cold/Archive'),{recursive:true});const preview=f.review('archive').value;assert.ok(preview.previewToken);changed=true;
  assert.equal(f.apply(preview).ok,false);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_operations').get().n,0);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 },{reader});
});

test('an unstable newly created archive parent retains intent before recording ownership or moving the project',()=>{
 let reads=0,calls=0;const reader=(path,scope)=>{const proof=observeFolder(path,scope);return proof.ok&&basename(path)==='Cold'&&++reads>1?{...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}}:proof;};
 fixture(f=>{const preview=f.review('archive').value;assert.ok(preview.previewToken);const result=f.apply(preview);assert.equal(result.value.operation.stage,'intent',JSON.stringify(result));assert.equal(calls,0);
  assert.equal(existsSync(join(f.root,'Cold')),true);assert.equal(existsSync(join(f.root,'Cold/Archive')),false);assert.equal(JSON.parse(f.sql.prepare('SELECT parents FROM project_archive_operations').get().parents)[0].identity,null);
  assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 },{reader,native(from,to){calls++;return renameNoReplace(from,to);}});
});

test('an observed project mount change after native archive retains uncertainty and original retry is read-only',()=>{
 const lstat=fs.lstatSync;let calls=0;
 fixture(f=>{const preview=f.review('archive').value,request={type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.previewToken};let result;
  try{result=f.command(request);}finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
  assert.equal(result.value.operation.stage,'intent',JSON.stringify(result));assert.equal(calls,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archives').get().n,0);
  assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');f.restart();assert.deepEqual(f.command(request),result);assert.equal(calls,1);
 },{native(from,to){calls++;const result=renameNoReplace(from,to);if(result==='renamed'){fs.lstatSync=(path,...options)=>{const stat=lstat(path,...options);if(path===to&&typeof stat.dev==='bigint')stat.dev=777n;return stat;};syncBuiltinESMExports();}return result;}});
});

test('archive Preview keeps property-only edits independent and preserves their latest value',()=>fixture(f=>{
 const preview=f.review('archive').value,propertyId=f.query({type:'workspace.listTextProperties'}).value.definitions[0].propertyId;
 assert.equal(f.command({type:'workspace.setTextValue',projectId:f.projectId,propertyId,value:'latest archive value'}).ok,true);
 const result=f.apply(preview);assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'latest archive value');
}));

test('restore reuses a parent created by a prior reviewed restore but refuses unknown receipt authority',()=>fixture(f=>{
 mkdirSync(join(f.root,'Category/Second'));const discovery=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 const list=f.command({type:'workspace.applyDiscovery',previewToken:discovery.previewToken}).value,secondId=list.projects.find(p=>p.name==='Second').projectId;
 assert.equal(f.apply(f.review('archive').value).value.operation.stage,'completed');
 const second=f.query({type:'workspace.previewProjectArchive',projectId:secondId,action:'archive',name:null,createParent:false}).value;assert.equal(f.apply(second).value.operation.stage,'completed');
 fs.rmdirSync(join(f.root,'Category'));
 const firstRestore=f.query({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:true}).value;
 assert.ok(firstRestore.previewToken,JSON.stringify(firstRestore));const first=f.apply(firstRestore);assert.equal(first.value.operation.stage,'completed',JSON.stringify(first));
 const next=f.query({type:'workspace.previewProjectArchive',projectId:secondId,action:'restore',name:null,createParent:false});assert.ok(next.value.previewToken,JSON.stringify(next));
 const trigger=f.sql.prepare("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='project_archive_operation_binding'").get().sql;
 f.sql.exec('DROP TRIGGER project_archive_operation_binding');f.sql.prepare("UPDATE project_archive_operations SET binding=json_set(binding,'$.authorization.version',2) WHERE operation_id=?").run(first.value.operation.operationId);f.sql.exec(trigger);
 const denied=f.query({type:'workspace.previewProjectArchive',projectId:secondId,action:'restore',name:null,createParent:false});assert.equal(denied.value.previewToken,null,JSON.stringify(denied));
 assert.equal(existsSync(join(f.root,'Category/Second')),false);assert.equal(existsSync(join(f.root,'Cold/Archive/Category/Second')),true);assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact metadata');
},{mode:'grouped'}));

test('matching archive backups restore while unknown or contradictory durable archive authority is rejected',()=>fixture(f=>{
 const preview=f.review('archive').value,request={type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.previewToken},completed=f.command(request);assert.equal(completed.value.operation.stage,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("UPDATE project_archives SET authorization=json_set(authorization,'$.version',2)"),
  db=>db.exec("UPDATE project_archives SET authorization=json_set(authorization,'$.project.evidence.created','999999999999')"),
  db=>db.exec("UPDATE project_archives SET authorization=json_set(authorization,'$.originalParent.evidence.created','999999999999')"),
  db=>db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.authorization.version',2)"),
  db=>db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.authorization.root.generation',999,'$.source.evidenceGeneration',999)"),
  db=>db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.project.id','00000000-0000-4000-8000-000000000001')"),
  db=>db.exec("UPDATE project_archive_operations SET parents=json_set(parents,'$[0].observation.evidence.scope','foreign')"),
 ]) {const content=alteredSnapshot(exported.value.content,mutate);assert.equal(f.send({type:'data.restore',content}).ok,false);assert.deepEqual(f.command(request),completed);}
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),completed);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
}));

test('archive and restore preserve a separately saved source used only as the unchanged original parent',()=>fixture(f=>{
 assert.equal(f.command({type:'workspace.create',name:'Nested source',rootPath:join(f.root,'Category')}).ok,true);
 const peer=f.sql.prepare('SELECT * FROM sources WHERE canonical_root=?').get(join(f.root,'Category'));
 const preview=f.review('archive');assert.ok(preview.value.previewToken,JSON.stringify(preview));assert.equal(f.apply(preview.value).value.operation.stage,'completed');
 assert.deepEqual(f.sql.prepare('SELECT * FROM sources WHERE id=?').get(peer.id),peer);assert.equal(existsSync(join(f.root,'Category')),true);
 const restored=f.review('restore');assert.ok(restored.value.previewToken,JSON.stringify(restored));assert.equal(f.apply(restored.value).value.operation.stage,'completed');
 assert.deepEqual(f.sql.prepare('SELECT * FROM sources WHERE id=?').get(peer.id),peer);assert.equal(readFileSync(join(f.root,'Category/Project/sentinel'),'utf8'),'exact contents');
},{mode:'grouped'}));

test('a mount change after archive Preview consumes the review before intent or parent creation',()=>fixture(f=>{
 const preview=f.review('archive').value;assert.ok(preview.previewToken);const lstat=fs.lstatSync;
 const request={type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.previewToken};
 try {
  fs.lstatSync=(path,...options)=>{const stat=lstat(path,...options);if(typeof stat.dev==='bigint')stat.dev=777n;return stat;};syncBuiltinESMExports();
  assert.equal(f.command(request).ok,false);
 }finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
 assert.equal(f.command(request).ok,false);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_operations').get().n,0);
 assert.equal(existsSync(join(f.root,'Cold')),false);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
}));

for(const field of ['volume','created','scope'])test(`fresh archive refuses changed ${field} in the selected project's durable proof`,()=>{
 let changed=false;
 const reader=(path,scope)=>{const proof=observeFolder(path,scope);if(!changed || !proof.ok || basename(path)!=='Project')return proof;
  return {...proof,evidence:{...proof.evidence,[field]:field==='volume'?(proof.evidence.provider==='apfs'?'a'.repeat(32):'\\\\?\\Volume{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}\\'):field==='scope'?'foreign-scope':(BigInt(proof.evidence.created)+1n).toString()}};
 };
 fixture(f=>{changed=true;const preview=f.review('archive');assert.equal(preview.value.previewToken,null,JSON.stringify(preview));
  assert.equal(existsSync(join(f.root,'Cold')),false);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 },{reader});
});

test('explicit archive recovery renews a between-run mount and completes a lost native response without replay',()=>{
 let calls=0;fixture(f=>{
  const preview=f.review('archive').value,request={type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:preview.previewToken};
  const result=f.command(request);assert.equal(result.value.operation.stage,'intent');assert.equal(calls,1);
  const before=f.sql.prepare('SELECT binding,native_identity,parents FROM project_archive_operations').get();f.restart();assert.deepEqual(f.command(request),result);assert.equal(calls,1);
  const lstat=fs.lstatSync;
  try {
   fs.lstatSync=(path,...options)=>{const stat=lstat(path,...options);if(typeof stat.dev==='bigint')stat.dev=777n;return stat;};syncBuiltinESMExports();
   const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId:request.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,['complete_destination']);assert.ok(review.value.previewToken);
   const recovered=f.command({type:'workspace.recoverProjectArchive',operationId:request.operationId,previewToken:review.value.previewToken,action:'complete_destination'});
   assert.equal(recovered.value.operation.stage,'completed',JSON.stringify(recovered));assert.equal(calls,1);
  }finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
  assert.deepEqual(f.sql.prepare('SELECT binding,native_identity,parents FROM project_archive_operations').get(),before);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,1);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
  assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact metadata');
 },{native(from,to){calls++;assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost native response');}});
});

test('Keep original rolls back its attestation and reservation release when the project moves after terminal SQL',()=>{
 fixture(f=>{
  const result=f.apply(f.review('archive').value),operationId=result.value.operation.operationId;assert.equal(result.value.operation.stage,'intent');
  const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.ok(review.value.actions.includes('keep_original'));
  const prepare=Database.prototype.prepare;let changed=false;
  Database.prototype.prepare=function(sql,...args){const statement=prepare.call(this,sql,...args);
   if(sql.trimStart().toLowerCase().startsWith('update "project_archive_operations"')){const run=statement.run;statement.run=function(...values){const result=run.apply(this,values);if(values.flat().includes('failed')){changed=true;fs.renameSync(join(f.root,'Project'),join(f.root,'Aside'));}return result;};}return statement;};
  try{f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.value.previewToken,action:'keep_original'});}finally{Database.prototype.prepare=prepare;}
  assert.equal(changed,true);assert.equal(f.sql.prepare('SELECT stage FROM project_archive_operations').get().stage,'intent');
  assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);assert.equal(readFileSync(join(f.root,'Aside/sentinel'),'utf8'),'exact contents');
  assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);
 },{native(){return 'occupied';}});
});

test('archive recovery backups reject forged attestation authority while retaining matching history',()=>fixture(f=>{
 const result=f.apply(f.review('archive').value),operationId=result.value.operation.operationId;assert.equal(result.value.operation.stage,'intent');
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId}).value;
 assert.equal(f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.previewToken,action:'complete_destination'}).value.operation.stage,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("UPDATE project_archive_attestations SET binding=json_set(binding,'$.authorization.version',2)"),
  db=>db.exec("UPDATE project_archive_attestations SET binding=json_set(binding,'$.authorization.project.evidence.created','999999999999')"),
  db=>db.exec("UPDATE project_archive_attestations SET journal=json_set(journal,'$.projectId','00000000-0000-4000-8000-000000000001')"),
  db=>db.exec("UPDATE project_archive_attestations SET parents=json_set(parents,'$[0].path','Other')"),
 ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
},{native(from,to){assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost response');}}));


test('recovery can keep the verified original without adopting an unrecorded archive parent',()=>fixture(f=>{
 const result=f.apply(f.review('archive').value),operationId=result.value.operation.operationId;assert.equal(result.value.operation.stage,'intent');
 assert.equal(JSON.parse(f.sql.prepare('SELECT parents FROM project_archive_operations').get().parents)[0].identity,null);
 writeFileSync(join(f.root,'Cold','late'),'unrelated bytes');
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,['keep_original']);
 const kept=f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.value.previewToken,action:'keep_original'});assert.equal(kept.value.operation.stage,'failed',JSON.stringify(kept));
 assert.equal(readFileSync(join(f.root,'Cold/late'),'utf8'),'unrelated bytes');assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 assert.equal(JSON.parse(f.sql.prepare('SELECT parents FROM project_archive_operations').get().parents)[0].identity,null);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archives').get().n,0);
},{filesystem:{...nativeProjectFilesystem,mkdir(path){nativeProjectFilesystem.mkdir(path);throw new Error('lost mkdir response');}}}));

test('unknown persisted recovery authority cannot be ignored by a later archive recovery review',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId}).value;
 const recovered=f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.previewToken,action:'retry_original'});assert.equal(recovered.value.operation.stage,'intent');
 const trigger=f.sql.prepare("SELECT sql FROM sqlite_schema WHERE name='project_archive_attestation_update'").get().sql;
 f.sql.exec('DROP TRIGGER project_archive_attestation_update');f.sql.exec("UPDATE project_archive_attestations SET binding=json_set(binding,'$.authorization.version',2)");f.sql.exec(trigger);
 const denied=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});
 assert.ok(!denied.ok || denied.value.previewToken===null,JSON.stringify(denied));assert.equal(existsSync(join(f.root,'Project/sentinel')),true);assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);
},{native(){return 'occupied';}}));

test('a second mount change after archive recovery Preview consumes consent without adding an attestation',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId}).value;assert.ok(review.previewToken);
 const request={type:'workspace.recoverProjectArchive',operationId,previewToken:review.previewToken,action:'retry_original'},lstat=fs.lstatSync;
 try{fs.lstatSync=(path,...options)=>{const stat=lstat(path,...options);if(typeof stat.dev==='bigint')stat.dev=888n;return stat;};syncBuiltinESMExports();assert.equal(f.command(request).ok,false);}
 finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
 assert.equal(f.command(request).ok,false);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);
 assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
},{native(){return 'occupied';}}));

test('property edits after archive recovery Preview remain independent of Keep original consent',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId}).value;assert.ok(review.previewToken);
 const propertyId=f.query({type:'workspace.listTextProperties'}).value.definitions[0].propertyId;
 assert.equal(f.command({type:'workspace.setTextValue',projectId:f.projectId,propertyId,value:'latest during recovery'}).ok,true);
 const kept=f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.previewToken,action:'keep_original'});assert.equal(kept.ok,true,JSON.stringify(kept));assert.equal(kept.value.operation.stage,'failed');
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'latest during recovery');assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
},{native(){return 'occupied';}}));

test('recovery retains the verified original when an unrelated directory occupies the archive destination',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 mkdirSync(join(f.root,'Cold/Archive/Project'));writeFileSync(join(f.root,'Cold/Archive/Project/other'),'other owner');
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,['keep_original']);
 assert.equal(f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.value.previewToken,action:'keep_original'}).value.operation.stage,'failed');
 assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/other'),'utf8'),'other owner');assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
},{native(){return 'occupied';}}));

for(const mode of ['direct','grouped'])test(`${mode} explicit restore recovery completes a lost native response without another move`,()=>{
 let interrupt=false,calls=0;fixture(f=>{
  const before=f.sql.prepare('SELECT * FROM projects WHERE id=?').get(f.projectId);
  assert.equal(f.apply(f.review('archive').value).value.operation.stage,'completed');interrupt=true;
  const pending=f.apply(f.review('restore').value),operationId=pending.value.operation.operationId;assert.equal(pending.value.operation.stage,'intent');assert.equal(calls,2);
  const history=f.sql.prepare('SELECT binding,parents,native_identity FROM project_archive_operations WHERE operation_id=?').get(operationId);f.restart();
  const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.deepEqual(review.value.actions,['complete_destination']);
  const recovered=f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.value.previewToken,action:'complete_destination'});assert.equal(recovered.value.operation.stage,'completed',JSON.stringify(recovered));assert.equal(calls,2);
  assert.deepEqual(f.sql.prepare('SELECT * FROM projects WHERE id=?').get(f.projectId),before);assert.deepEqual(f.sql.prepare('SELECT binding,parents,native_identity FROM project_archive_operations WHERE operation_id=?').get(operationId),history);
  assert.equal(readFileSync(join(f.root,f.relativePath,'sentinel'),'utf8'),'exact contents');
 },{mode,native(from,to){calls++;const result=renameNoReplace(from,to);if(interrupt)throw new Error('lost restore response');return result;}});
});

test('explicit archive retry creates only missing parents and retains a matching recovery backup',()=>{
 let interrupted=false;fixture(f=>{
  const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;assert.equal(pending.value.operation.stage,'intent');assert.equal(existsSync(join(f.root,'Cold')),false);f.restart();
  const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.deepEqual(review.value.actions,['retry_original','keep_original']);
  const recovered=f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:review.value.previewToken,action:'retry_original'});assert.equal(recovered.value.operation.stage,'completed',JSON.stringify(recovered));
  assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
  const exported=f.send({type:'data.export'});assert.equal(exported.ok,true);assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
 },{filesystem:{...nativeProjectFilesystem,mkdir(path){if(!interrupted){interrupted=true;throw new Error('before mkdir');}nativeProjectFilesystem.mkdir(path);}}});
});

test('lost installation scope and root-only binding leave a scoped archive operation reserved',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 rmSync(join(f.directory,'installation-scope.json'));f.restart();
 const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.ok(root.value.previewToken,JSON.stringify(root));assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.value.previewToken}).ok,true);
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,[]);assert.equal(review.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
},{native(){return 'occupied';}}));


for(const phase of ['intent','effect','recorded','completed','committed','parent_effect'])test(`production archive process exit at ${phase} retains history without replay`,()=>fixture(f=>{
 const operationId=randomUUID(),workspaceId=f.query({type:'workspace.listProjects'}).value.workspaceId;
 const child=spawnSync(process.execPath,['--import','tsx','tests/fixtures/project-archive-crash-worker.mjs',f.path,workspaceId,f.projectId,operationId,'archive',phase,'application'],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(child.status,71,child.stderr);const row=f.sql.prepare('SELECT * FROM project_archive_operations WHERE operation_id=?').get(operationId);assert.ok(JSON.parse(row.binding).authorization);
 f.restart();const request={type:'workspace.applyProjectArchive',operationId,previewToken:row.preview_token},receipt=f.command(request);assert.equal(receipt.ok,true,JSON.stringify(receipt));assert.equal(receipt.value.operation.stage,row.stage);assert.deepEqual(f.command(request),receipt);
 assert.equal(readFileSync(join(f.root,['intent','parent_effect'].includes(phase)?'Project/sentinel':'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
 assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,row.stage==='completed'?0:1);
}));

test('compiled production IPC settles archive recovery with IDs/token only and keeps proof fields private',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 const parent=new EventEmitter(),port=new EventEmitter(),replies=[];parent.postMessage=()=>{};port.postMessage=message=>replies.push(message);port.start=()=>{};port.close=()=>{};
 startServiceProcess(parent);parent.emit('message',{data:{type:'connect',databasePath:f.path},ports:[port]});let serial=0;
 const workspaceId=f.query({type:'workspace.listProjects'}).value.workspaceId;
 const send=input=>{const id=++serial;port.emit('message',{data:{id,input:{workspaceId,...input}}});const reply=replies.find(message=>message.id===id);assert.ok(reply);return reply.result;};
 try {
  const review=send({type:'workspace.previewProjectArchiveRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.ok(review.value.previewToken);
  assert.doesNotMatch(JSON.stringify(review),/"(?:authorization|binding|mount|evidence|scope)":/);
  const request={type:'workspace.recoverProjectArchive',operationId,previewToken:review.value.previewToken,action:'complete_destination'};
  assert.equal(send({...request,authorization:{version:1}}).error.code,'invalid_input');
  const result=send(request);assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));assert.equal(send(request).ok,false);
  assert.doesNotMatch(JSON.stringify(result),/"(?:authorization|binding|mount|evidence|scope)":/);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact contents');
 }finally{parent.emit('message',{data:{type:'shutdown'}});}
},{native(from,to){assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost response');}}));

test('removing new-policy archive authorization cannot reclassify the journal as legacy',()=>fixture(f=>{
 const pending=f.apply(f.review('archive').value),operationId=pending.value.operation.operationId;
 const trigger=f.sql.prepare("SELECT sql FROM sqlite_schema WHERE name='project_archive_operation_binding'").get().sql;
 f.sql.exec('DROP TRIGGER project_archive_operation_binding');f.sql.exec("UPDATE project_archive_operations SET binding=json_remove(binding,'$.authorization')");f.sql.exec(trigger);
 const review=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.ok(!review.ok || review.value.previewToken===null,JSON.stringify(review));assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_attestations').get().n,0);
 assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');assert.equal(f.query({type:'workspace.listProjectArchiveOperations'}).value.operations.length,1);
},{native(){return 'occupied';}}));
