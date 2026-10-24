import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,readdirSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {openSettingsService} from '../dist/service/settings.mjs';

function fixture(run,mode='direct',options={}) {
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'durable-create-'))),root=join(directory,'source'),dbPath=join(directory,'data','settings.sqlite');
 mkdirSync(mode==='grouped'?join(root,'Category'):root,{recursive:true});
 const open=()=>openSettingsService(dbPath,undefined,undefined,undefined,options.filesystem,undefined,options.reader);
 let service=open();
 const created=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root});
 assert.equal(created.ok,true,JSON.stringify(created));const workspaceId=created.value.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}), command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode});assert.ok(['ready','empty'].includes(preview.value.state));
 assert.equal(command({type:'workspace.applyDiscovery',previewToken:preview.value.previewToken}).ok,true);
 const sql=new Database(dbPath);
 try {run({root,sql,query,command,workspaceId,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),restart(){service.close();service=open();}});}
 finally {sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
for(const mode of ['direct','grouped'])test(`${mode} creation after stored device renumbering remains visible with a stable receipt after restart`,()=>fixture(f=>{
 f.sql.exec("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999'); UPDATE categories SET native_identity=json_set(native_identity,'$.dev','999')");
 f.restart();
 const before=f.query({type:'workspace.listProjects'}).value;
 const request={type:'workspace.createProject',mode,name:'Created',operationId:randomUUID(),expectedRevision:before.revision,...(mode==='grouped'?{categoryId:before.categories[0].categoryId}:{})};
 const result=f.command(request);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed',JSON.stringify(result));
 const id=result.value.project.projectId;
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects.find(p=>p.projectId===id)?.name,'Created');
 f.restart();assert.deepEqual(f.command(request),result);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects.find(p=>p.projectId===id)?.name,'Created');
 assert.deepEqual(readdirSync(mode==='grouped'?join(f.root,'Category'):f.root),['Created']);
},mode));

for(const mode of ['direct','grouped'])test(`${mode} creation refuses a legacy or wrong-volume parent without making a directory`,()=>fixture(f=>{
 const before=f.query({type:'workspace.listProjects'}).value;
 if(mode==='grouped')f.sql.exec('UPDATE categories SET durable_evidence=NULL');
 else f.sql.exec('UPDATE sources SET durable_evidence=NULL');
 const request={type:'workspace.createProject',mode,name:'Denied',operationId:randomUUID(),expectedRevision:before.revision,...(mode==='grouped'?{categoryId:before.categories[0].categoryId}:{})};
 const result=f.command(request);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'rejected');
 assert.ok(!readdirSync(mode==='grouped'?join(f.root,'Category'):f.root).includes('Denied'));
 assert.equal(f.query({type:'workspace.listProjectCreations'}).value.operations.length,0);
},mode));

test('recorded creation recovers only after explicit current review across a between-run mount change',()=>{
 let device=null;
 const reader=(path,scope)=>{const observed=observeFolder(path,scope);return observed.ok && device ? {...observed,mount:{...observed.mount,dev:device}} : observed;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const observed=nativeProjectFilesystem.inspect(path);return device?{...observed,identity:{...observed.identity,dev:device}}:observed;}};
 fixture(f=>{
  const before=f.query({type:'workspace.listProjects'}).value;
  f.sql.exec("CREATE TRIGGER interrupt_creation BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const request={type:'workspace.createProject',mode:'direct',name:'Interrupted',operationId:randomUUID(),expectedRevision:before.revision};
  const result=f.command(request);assert.equal(result.value.outcome,'recoverable',JSON.stringify(result));
  assert.equal(result.value.operation.evidenceRecorded,true);
  f.sql.exec('DROP TRIGGER interrupt_creation');device='888';f.restart();
  assert.equal(f.command(request).value.outcome,'recoverable');
  const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId:request.operationId});
  assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.actions,['complete_recorded']);
  const complete=f.command({type:'workspace.recoverProjectCreation',operationId:request.operationId,previewToken:preview.value.previewToken,action:'complete_recorded'});
  assert.equal(complete.ok,true,JSON.stringify(complete));assert.equal(complete.value.outcome,'completed',JSON.stringify(complete));
  assert.equal(complete.value.project.projectId,result.value.operation.projectId);
  device=null;f.restart();assert.deepEqual(f.command(request),complete);
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,complete.value.project.projectId);
 },'direct',{reader,filesystem});
});

test('a remount after creation recovery Preview invalidates Apply without consuming the reservation',()=>{
 let device=null;
 const reader=(path,scope)=>{const observed=observeFolder(path,scope);return observed.ok && device ? {...observed,mount:{...observed.mount,dev:device}} : observed;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const observed=nativeProjectFilesystem.inspect(path);return device?{...observed,identity:{...observed.identity,dev:device}}:observed;}};
 fixture(f=>{
  f.sql.exec("CREATE TRIGGER interrupt_creation BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const request={type:'workspace.createProject',mode:'direct',name:'Pending',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');
  f.sql.exec('DROP TRIGGER interrupt_creation');
  const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId:request.operationId}).value;
  assert.ok(preview.previewToken);device='888';
  const rejected=f.command({type:'workspace.recoverProjectCreation',operationId:request.operationId,previewToken:preview.previewToken,action:'complete_recorded'});
  assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'stale_preview');
  assert.equal(f.query({type:'workspace.listProjectCreations'}).value.operations.length,1);
  assert.deepEqual(f.command(request),pending);
 },'direct',{reader,filesystem});
});

test('creation intent and destination evidence remain immutable through uncertainty and terminal retries',()=>fixture(f=>{
 const request={type:'workspace.createProject',mode:'direct',name:'Saved',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 const result=f.command(request);assert.equal(result.value.outcome,'completed');
 const before=f.sql.prepare('SELECT * FROM project_creation_operations WHERE operation_id=?').get(request.operationId);
 assert.ok(before.authorization);assert.ok(before.destination_evidence);
 for(const column of ['authorization','destination_evidence'])assert.throws(()=>f.sql.prepare(`UPDATE project_creation_operations SET ${column}=NULL WHERE operation_id=?`).run(request.operationId),/immutable/);
 f.sql.exec('UPDATE sources SET durable_evidence=NULL');
 assert.deepEqual(f.command(request),result);
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations WHERE operation_id=?').get(request.operationId),before);
}));

test('an unfinished legacy creation requires exact old triples and a separate explicit attestation',()=>fixture(f=>{
 const request={type:'workspace.createProject',mode:'direct',name:'Legacy',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 // Seed a genuine old-engine intent without durable authorization, not a modified new-policy journal.
 const source=f.sql.prepare('SELECT * FROM sources').get(),projectId=randomUUID();
 f.sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,archive_relative_path,stage) VALUES (?,?,?,?,?,'direct',?,?,'',?,?,?,? ,?,'intent')`)
  .run(request.operationId,source.id,f.workspaceId,projectId,'Legacy',request.expectedRevision,f.root,'Legacy',source.applied_root_identity,source.applied_root_identity,source.excluded_relative_paths,source.archive_relative_path);
 const before=f.sql.prepare('SELECT * FROM project_creation_operations').get();
 f.restart();assert.equal(f.command(request).value.outcome,'recoverable');
 const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId:request.operationId});
 assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.actions,['retry_missing']);
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations').get(),before);
 const recovered=f.command({type:'workspace.recoverProjectCreation',operationId:request.operationId,previewToken:preview.value.previewToken,action:'retry_missing'});
 assert.equal(recovered.value.outcome,'completed',JSON.stringify(recovered));assert.equal(recovered.value.project.projectId,projectId);
 const history=f.sql.prepare('SELECT * FROM project_creation_operations').get();assert.equal(history.authorization,null);assert.equal(history.root_identity,before.root_identity);
 const attestations=f.sql.prepare('SELECT * FROM project_creation_attestations').all();assert.equal(attestations.length,1);
 assert.throws(()=>f.sql.exec('DELETE FROM project_creation_attestations'),/retained/);
 f.restart();assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
}));

test('unrecorded creation review pins the full durable destination until Apply',()=>{
 let substitute=false;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return substitute && path.endsWith('/Unrecorded') && value.ok ? {...value,evidence:{...value.evidence,fileId:value.evidence.provider==='apfs'?'999999999999':'f'.repeat(32)}} : value;};
 const filesystem={...nativeProjectFilesystem,mkdir(path){nativeProjectFilesystem.mkdir(path);throw new Error('lost mkdir outcome');}};
 fixture(f=>{
  const request={type:'workspace.createProject',mode:'direct',name:'Unrecorded',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');assert.equal(pending.value.operation.evidenceRecorded,false);
  const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId:request.operationId}).value;
  assert.deepEqual(preview.actions,['associate_reviewed']);substitute=true;
  const denied=f.command({type:'workspace.recoverProjectCreation',operationId:request.operationId,previewToken:preview.previewToken,action:'associate_reviewed'});
  assert.equal(denied.ok,false,JSON.stringify(denied));assert.equal(denied.error.code,'stale_preview');
  assert.deepEqual(f.command(request),pending);
 },'direct',{reader,filesystem});
});

test('restore rejects malformed and contradictory creation authorization while retaining current projects',()=>fixture(f=>{
 const request={type:'workspace.createProject',mode:'direct',name:'Backed up',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 const created=f.command(request);assert.equal(created.value.outcome,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 const content=exported.value.content;
 const projectId=created.value.project.projectId;
 for(const mutate of [
  db=>db.exec("UPDATE project_creation_operations SET authorization=json_set(authorization,'$.root.mount.dev',123)"),
  db=>db.exec("UPDATE project_creation_operations SET authorization=json_set(authorization,'$.parent.evidence.scope','other')"),
  db=>db.exec("UPDATE project_creation_operations SET destination_evidence=json_set(destination_evidence,'$.mount.dev','999')"),
  db=>db.exec("UPDATE project_creation_operations SET authorization=json_set(authorization,'$.version',2)"),
  db=>db.exec("UPDATE project_creation_operations SET destination_evidence=NULL"),
  db=>db.exec("UPDATE sources SET evidence_generation='invalid'"),
 ]) {
  const rejected=f.send({type:'data.restore',content:alteredSnapshot(content,mutate)});assert.equal(rejected.ok,false,JSON.stringify(rejected));
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
 }
 assert.equal(f.send({type:'data.restore',content}).ok,true);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
}));

test('restore binds each attestation to immutable operation request and root evidence',()=>fixture(f=>{
 f.sql.exec("CREATE TRIGGER interrupt_creation BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
 const request={type:'workspace.createProject',mode:'direct',name:'Attested',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 assert.equal(f.command(request).value.outcome,'recoverable');f.sql.exec('DROP TRIGGER interrupt_creation');
 const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId:request.operationId}).value;
 const result=f.command({type:'workspace.recoverProjectCreation',operationId:request.operationId,previewToken:preview.previewToken,action:'complete_recorded'});
 assert.equal(result.value.outcome,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("UPDATE project_creation_attestations SET journal=json_set(journal,'$.name','Changed request')"),
  db=>db.exec("UPDATE project_creation_attestations SET journal=json_remove(journal,'$.rootIdentity')"),
  db=>db.exec("UPDATE project_creation_attestations SET journal=json_set(journal,'$.destinationEvidence','{}')"),
  db=>db.exec("UPDATE project_creation_attestations SET destination_evidence=json_set(destination_evidence,'$.evidence.created','999999999999999999')"),
 ]) assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
 assert.deepEqual(f.command(request),result);
}));

test('pending creation durable ownership survives two mount changes and a different reserved path',()=>{
 let device=null,loseOutcome=false;
 const reader=(path,scope)=>{const observed=observeFolder(path,scope);return observed.ok && device ? {...observed,mount:{...observed.mount,dev:device}} : observed;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const observed=nativeProjectFilesystem.inspect(path);return device?{...observed,identity:{...observed.identity,dev:device}}:observed;},mkdir(path){nativeProjectFilesystem.mkdir(path);if(loseOutcome)throw new Error('lost mkdir result');}};
 fixture(f=>{
  const revision=f.query({type:'workspace.listProjects'}).value.revision;
  f.sql.exec("CREATE TRIGGER interrupt_creation BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  device='222';
  const a={type:'workspace.createProject',mode:'direct',name:'Reserved A',operationId:randomUUID(),expectedRevision:revision};
  const pendingA=f.command(a);assert.equal(pendingA.value.outcome,'recoverable');assert.equal(pendingA.value.operation.evidenceRecorded,true);
  f.sql.exec('DROP TRIGGER interrupt_creation');device='333';loseOutcome=true;
  const b={type:'workspace.createProject',mode:'direct',name:'Reserved B',operationId:randomUUID(),expectedRevision:revision};
  const pendingB=f.command(b);assert.equal(pendingB.value.outcome,'recoverable');assert.equal(pendingB.value.operation.evidenceRecorded,false);
  rmSync(join(f.root,'Reserved B'),{recursive:true});renameSync(join(f.root,'Reserved A'),join(f.root,'Reserved B'));
  const review=f.query({type:'workspace.previewProjectCreationRecovery',operationId:b.operationId});
  assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,[],JSON.stringify(review));
  assert.equal(review.value.problem,'native_conflict');
  assert.deepEqual(f.command(a),pendingA);assert.deepEqual(f.command(b),pendingB);
 },'direct',{reader,filesystem});
});

test('old journal device mismatch remains unresolved after source rebinding and preserves every reservation',()=>fixture(f=>{
 const before=f.sql.prepare('SELECT * FROM sources').get();
 f.sql.exec("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')");
 const source=f.sql.prepare('SELECT * FROM sources').get(),operationId=randomUUID();
 f.sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,archive_relative_path,stage) VALUES (?,?,?,?,?,'direct',?,?,'',?,?,?,? ,?,'intent')`)
  .run(operationId,source.id,f.workspaceId,randomUUID(),'Legacy mismatch',source.discovery_revision,f.root,'Legacy mismatch',source.applied_root_identity,source.applied_root_identity,source.excluded_relative_paths,source.archive_relative_path);
 const history=f.sql.prepare('SELECT * FROM project_creation_operations').get();
 const binding=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.equal(binding.ok,true);assert.ok(binding.value.previewToken);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:binding.value.previewToken}).ok,true);
 const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId});assert.equal(preview.ok,true);assert.deepEqual(preview.value.actions,[]);
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations').get(),history);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM project_creation_attestations').get().n,0);
 assert.equal(f.query({type:'workspace.listProjectCreations'}).value.operations[0].operationId,operationId);
 assert.deepEqual(readdirSync(f.root),[]);assert.equal(f.query({type:'workspace.listProjects'}).value.sourceId,before.id);
}));

test('Windows command adapter does not open a descendant through native realpath',()=>{
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'command-route-'))),child=join(directory,'Child');mkdirSync(child);
 const platform=Object.getOwnPropertyDescriptor(process,'platform'),original=fs.realpathSync,originalNative=original.native;let childOpens=0;
 const replacement=(path,...args)=>original(path,...args);
 replacement.native=(path,...args)=>{if(path===child)childOpens++;return originalNative(path,...args);};
 try {
  Object.defineProperty(process,'platform',{value:'win32'});fs.realpathSync=replacement;syncBuiltinESMExports();
  assert.equal(nativeProjectFilesystem.realpath(child),child);assert.equal(childOpens,0);
 }finally{fs.realpathSync=original;syncBuiltinESMExports();Object.defineProperty(process,'platform',platform);rmSync(directory,{recursive:true,force:true});}
});

test('discovery cannot enroll a pending durable creation moved outside its reserved path after remount',()=>{
 let device=null;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return value.ok && device?{...value,mount:{...value.mount,dev:device}}:value;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const value=nativeProjectFilesystem.inspect(path);return device?{...value,identity:{...value.identity,dev:device}}:value;}};
 fixture(f=>{
  const revision=f.query({type:'workspace.listProjects'}).value.revision;device='222';
  f.sql.exec("CREATE TRIGGER interrupt_creation BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const request={type:'workspace.createProject',operationId:randomUUID(),name:'Pending',mode:'direct',expectedRevision:revision};
  assert.equal(f.command(request).value.outcome,'recoverable');f.sql.exec('DROP TRIGGER interrupt_creation');
  device=null;renameSync(join(f.root,'Pending'),join(f.root,'External'));f.restart();
  const preview=f.query({type:'workspace.previewDiscovery'});assert.equal(preview.ok,true,JSON.stringify(preview));
  assert.equal(preview.value.entries.find(row=>row.relativePath==='External').reason,'unresolved');
  assert.equal(preview.value.projectEffects.added.length,0);
  assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:preview.value.previewToken}).ok,true);
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);
  assert.equal(f.query({type:'workspace.listProjectCreations'}).value.operations[0].operationId,request.operationId);
 },'direct',{reader,filesystem});
});

test('grouped legacy creation can attest exact parents without bypassing generic reserved-parent enrollment',()=>fixture(f=>{
 const source=f.sql.prepare('SELECT * FROM sources').get(),category=f.sql.prepare('SELECT * FROM categories').get(),operationId=randomUUID();
 f.sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,category_id,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,archive_relative_path,stage) VALUES (?,?,?,?,?,'grouped',?,?,?,'Category','Category/Legacy',?,?,?,?,'intent')`)
  .run(operationId,source.id,f.workspaceId,randomUUID(),'Legacy',source.discovery_revision,category.id,f.root,source.applied_root_identity,category.native_identity,source.excluded_relative_paths,source.archive_relative_path);
 f.sql.exec('UPDATE sources SET durable_evidence=NULL; UPDATE categories SET durable_evidence=NULL');f.restart();
 const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.ok(root.previewToken);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.previewToken}).ok,true);
 const mapping={kind:'category',id:category.id,relativePath:'Category'};
 assert.equal(f.query({type:'workspace.previewSourceAssociation',mappings:[mapping]}).value.previewToken,null);
 const preview=f.query({type:'workspace.previewProjectCreationRecovery',operationId});assert.equal(preview.ok,true);assert.deepEqual(preview.value.actions,['retry_missing']);
 const result=f.command({type:'workspace.recoverProjectCreation',operationId,action:'retry_missing',previewToken:preview.value.previewToken});
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed');
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence,null,'Per-operation parent consent must not enroll its other children');
 const binding=f.query({type:'workspace.previewSourceAssociation',mappings:[mapping]}).value;assert.ok(binding.previewToken,JSON.stringify(binding));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:binding.previewToken}).ok,true);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,result.value.project.projectId);
},'grouped'));

test('unprovable legacy native evidence still vetoes enrollment outside the recorded path',()=>fixture(f=>{
 const source=f.sql.prepare('SELECT * FROM sources').get(),operationId=randomUUID();mkdirSync(join(f.root,'Legacy'));
 const native={...nativeProjectFilesystem.inspect(join(f.root,'Legacy')).identity,dev:'222'};
 f.sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,archive_relative_path,stage) VALUES (?,?,?,?,'Legacy','direct',?,?,'','Legacy',?,?,?,?,'intent')`)
  .run(operationId,source.id,f.workspaceId,randomUUID(),source.discovery_revision,f.root,source.applied_root_identity,source.applied_root_identity,source.excluded_relative_paths,source.archive_relative_path);
 f.sql.prepare("UPDATE project_creation_operations SET stage='evidence_recorded',native_identity=? WHERE operation_id=?").run(JSON.stringify(native),operationId);
 renameSync(join(f.root,'Legacy'),join(f.root,'External'));f.restart();
 const preview=f.query({type:'workspace.previewDiscovery'});assert.equal(preview.ok,true);
 assert.equal(preview.value.entries.find(row=>row.relativePath==='External').reason,'unresolved');
 assert.equal(preview.value.projectEffects.added.length,0);
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:preview.value.previewToken}).ok,true);
 assert.equal(f.query({type:'workspace.listProjectCreations'}).value.operations[0].operationId,operationId);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);
}));

test('root reassociation cannot adopt a physical folder reserved by its own interrupted operation',()=>fixture(f=>{
 const source=f.sql.prepare('SELECT * FROM sources').get(),operationId=randomUUID();mkdirSync(join(f.root,'Legacy'));
 const native=JSON.stringify(nativeProjectFilesystem.inspect(join(f.root,'Legacy')).identity);
 f.sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,archive_relative_path,stage) VALUES (?,?,?,?,'Legacy','direct',?,?,'','Legacy',?,?,?,?,'intent')`)
  .run(operationId,source.id,f.workspaceId,randomUUID(),source.discovery_revision,f.root,source.applied_root_identity,source.applied_root_identity,source.excluded_relative_paths,source.archive_relative_path);
 f.sql.prepare("UPDATE project_creation_operations SET stage='evidence_recorded',native_identity=? WHERE operation_id=?").run(native,operationId);
 f.sql.exec('UPDATE sources SET durable_evidence=NULL');
 const oldRoot=join(f.root,'..','Held root');renameSync(f.root,oldRoot);renameSync(join(oldRoot,'Legacy'),f.root);f.restart();
 const before=f.sql.prepare('SELECT * FROM project_creation_operations').get();
 const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.equal(preview.ok,true);
 assert.equal(preview.value.previewToken,null);assert.equal(preview.value.reason,'unsafe');
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations').get(),before);
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence,null);
}));
