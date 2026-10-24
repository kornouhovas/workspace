import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import fs from "node:fs";
import {syncBuiltinESMExports} from "node:module";
import {renameNoReplace} from "../dist/service/project-rename-filesystem.mjs";
import {observeFolder} from "../src/service/folder-evidence.ts";
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {openSettingsService} from '../dist/service/settings.mjs';
const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
function fixture(run,{mode='direct',...options}={}) {
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'durable-project-archive-'))),root=join(directory,'root'),path=join(directory,'app.sqlite'),relativePath=mode==='grouped'?'Category/Project':'Project';
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
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return ambiguous&&value.ok&&path.endsWith('/Other')?{...value,evidence:observeFolder(join(rootPath,'Project'),scope).evidence}:value;};
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
 let changed=false;const reader=(path,scope)=>{const proof=observeFolder(path,scope);return changed&&proof.ok&&path.endsWith('/Archive')?{...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}}:proof;};
 fixture(f=>{mkdirSync(join(f.root,'Cold/Archive'),{recursive:true});const preview=f.review('archive').value;assert.ok(preview.previewToken);changed=true;
  assert.equal(f.apply(preview).ok,false);assert.equal(f.sql.prepare('SELECT count(*) n FROM project_archive_operations').get().n,0);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 },{reader});
});

test('an unstable newly created archive parent retains intent before recording ownership or moving the project',()=>{
 let reads=0,calls=0;const reader=(path,scope)=>{const proof=observeFolder(path,scope);return proof.ok&&path.endsWith('/Cold')&&++reads>1?{...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}}:proof;};
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
 const reader=(path,scope)=>{const proof=observeFolder(path,scope);if(!changed || !proof.ok || !path.endsWith('/Project'))return proof;
  return {...proof,evidence:{...proof.evidence,[field]:field==='volume'?(proof.evidence.provider==='apfs'?'a'.repeat(32):'\\\\?\\Volume{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}\\'):field==='scope'?'foreign-scope':(BigInt(proof.evidence.created)+1n).toString()}};
 };
 fixture(f=>{changed=true;const preview=f.review('archive');assert.equal(preview.value.previewToken,null,JSON.stringify(preview));
  assert.equal(existsSync(join(f.root,'Cold')),false);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 },{reader});
});
