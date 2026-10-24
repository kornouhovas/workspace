import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {renameNoReplace} from '../dist/service/project-rename-filesystem.mjs';
import {openSettingsService} from '../dist/service/settings.mjs';

function fixture(run,mode='direct',options={}) {
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'durable-rename-'))),root=join(directory,'source'),dbPath=join(directory,'data','settings.sqlite');
 const original=mode==='grouped'?'Category/Original':'Original';mkdirSync(join(root,original),{recursive:true});writeFileSync(join(root,original,'sentinel'),'exact contents');
 const open=()=>openSettingsService(dbPath,undefined,undefined,undefined,options.filesystem,options.native,options.reader);
 let service=open();
 const workspace=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode}).value;
 const list=command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).value;
 const projectId=list.projects[0].projectId;
 const property=command({type:'workspace.createProperty',propertyType:'text',name:'Notes'}).value.propertyId;
 assert.equal(command({type:'workspace.setTextValue',projectId,propertyId:property,value:'exact\nmetadata'}).ok,true);
 const sql=new Database(dbPath);
 try{run({root,sql,query,command,projectId,original,mode,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),restart(){service.close();service=open();}});}
 finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
for(const mode of ['direct','grouped'])test(`${mode} rename after prior device renumbering preserves project identity, values and contents`,()=>fixture(f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);
 f.restart();
 const current=f.query({type:'workspace.listProjects'}).value;
 const request={type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Renamed',expectedRevision:current.revision};
 const result=f.command(request);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed',JSON.stringify(result));
 assert.equal(result.value.project.projectId,f.projectId);
 const path=mode==='grouped'?'Category/Renamed':'Renamed';
 assert.equal(existsSync(join(f.root,f.original)),false);assert.equal(readFileSync(join(f.root,path,'sentinel'),'utf8'),'exact contents');
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].relativePath,path);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');
 f.restart();assert.deepEqual(f.command(request),result);
},mode));

test('uncertain new-policy rename requires fresh reviewed completion after a between-run remount',()=>{
 let device=null;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return value.ok && device ? {...value,mount:{...value.mount,dev:device}} : value;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const value=nativeProjectFilesystem.inspect(path);return device?{...value,identity:{...value.identity,dev:device}}:value;}};
 const native=(from,to)=>{const outcome=renameNoReplace(from,to);if(outcome==='renamed')throw new Error('lost native reply');return outcome;};
 fixture(f=>{
  const request={type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Moved',expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable',JSON.stringify(pending));
  assert.equal(readFileSync(join(f.root,'Moved','sentinel'),'utf8'),'exact contents');
  device='888';f.restart();assert.deepEqual(f.command(request),pending);
  const preview=f.query({type:'workspace.previewProjectRenameRecovery',operationId:request.operationId});
  assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.actions,['complete_destination']);
  const completed=f.command({type:'workspace.recoverProjectRename',operationId:request.operationId,action:'complete_destination',previewToken:preview.value.previewToken});
  assert.equal(completed.ok,true,JSON.stringify(completed));assert.equal(completed.value.outcome,'completed',JSON.stringify(completed));
  device=null;f.restart();assert.deepEqual(f.command(request),completed);
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);
  assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');
 },'direct',{reader,filesystem,native});
});

test('a remount after rename recovery Preview rejects Apply and leaves the uncertain operation reserved',()=>{
 let device=null;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return value.ok && device ? {...value,mount:{...value.mount,dev:device}} : value;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const value=nativeProjectFilesystem.inspect(path);return device?{...value,identity:{...value.identity,dev:device}}:value;}};
 const native=(from,to)=>{const outcome=renameNoReplace(from,to);if(outcome==='renamed')throw new Error('lost reply');return outcome;};
 fixture(f=>{
  const request={type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Moved',expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');
  const preview=f.query({type:'workspace.previewProjectRenameRecovery',operationId:request.operationId}).value;assert.ok(preview.previewToken);
  device='888';
  const result=f.command({type:'workspace.recoverProjectRename',operationId:request.operationId,action:'complete_destination',previewToken:preview.previewToken});
  assert.equal(result.ok,false);assert.equal(result.error.code,'stale_preview');assert.deepEqual(f.command(request),pending);
  assert.equal(f.query({type:'workspace.listProjectRenames'}).value.operations.length,1);
 },'direct',{reader,filesystem,native});
});
for(const scope of ['project','source','category'])test(`rename refuses unverified ${scope} evidence and leaves files and metadata intact`,()=>fixture(f=>{
 const current=f.query({type:'workspace.listProjects'}).value;
 const table={source:'sources',category:'categories',project:'projects'}[scope];f.sql.exec(`UPDATE ${table} SET durable_evidence=NULL`);
 const result=f.command({type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Denied',expectedRevision:current.revision});
 assert.equal(result.ok,true);assert.equal(result.value.outcome,'rejected',JSON.stringify(result));
 assert.equal(readFileSync(join(f.root,f.original,'sentinel'),'utf8'),'exact contents');
 assert.equal(f.query({type:'workspace.listProjectRenames'}).value.operations.length,0);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');
},scope==='category'?'grouped':'direct'));

test('rename retains no-overwrite semantics under durable authorization',()=>fixture(f=>{
 mkdirSync(join(f.root,'Occupied'));writeFileSync(join(f.root,'Occupied','sentinel'),'keep other');
 const result=f.command({type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Occupied',expectedRevision:f.query({type:'workspace.listProjects'}).value.revision});
 assert.equal(result.value.outcome,'rejected');assert.equal(result.value.problem,'occupied');
 assert.equal(readFileSync(join(f.root,'Occupied','sentinel'),'utf8'),'keep other');assert.equal(readFileSync(join(f.root,f.original,'sentinel'),'utf8'),'exact contents');
}));

test('legacy historical ownership vetoes rename across independent recorded device namespaces',()=>fixture(f=>{
 const before=f.query({type:'workspace.listProjects'}).value;
 const project=f.sql.prepare('SELECT * FROM projects WHERE id=?').get(f.projectId),historyId=randomUUID();
 const old={...JSON.parse(project.native_identity),dev:'100'};
 f.sql.prepare("UPDATE projects SET native_identity=json_set(native_identity,'$.dev','200') WHERE id=?").run(f.projectId);
 f.sql.prepare("INSERT INTO projects (id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'History',?,'missing')").run(historyId,project.source_id,JSON.stringify(old));
 const result=f.command({type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Denied',expectedRevision:before.revision});
 assert.equal(result.ok,true);assert.equal(result.value.outcome,'rejected');assert.equal(result.value.problem,'native_conflict');
 assert.equal(readFileSync(join(f.root,'Original/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'Denied')),false);
 assert.equal(f.query({type:'workspace.listProjectRenames'}).value.operations.length,0);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');
}));

test('rename backups reject incomplete, future and contradictory immutable authorization',()=>fixture(f=>{
 const request={type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Renamed',expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 const result=f.command(request);assert.equal(result.value.outcome,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("UPDATE project_rename_operations SET project_evidence=NULL"),
  db=>db.exec("UPDATE project_rename_operations SET authorization=NULL"),
  db=>db.exec("UPDATE project_rename_operations SET authorization=json_set(authorization,'$.version',2)"),
  db=>db.exec("UPDATE project_rename_operations SET authorization=json_set(authorization,'$.root.mount.dev',123)"),
  db=>db.exec("UPDATE project_rename_operations SET project_evidence=json_set(project_evidence,'$.evidence.scope','foreign')"),
 ]) {
  const denied=f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)});assert.equal(denied.ok,false);
  assert.deepEqual(f.command(request),result);
 }
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),result);
 assert.equal(readFileSync(join(f.root,'Renamed/sentinel'),'utf8'),'exact contents');
}));

test('restored rename attestations must bind the immutable request, durable parent and project',()=>{
 const native=(from,to)=>{const result=renameNoReplace(from,to);if(result==='renamed')throw new Error('lost native reply');return result;};
 fixture(f=>{
  const request={type:'workspace.renameProject',operationId:randomUUID(),projectId:f.projectId,name:'Renamed',expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  assert.equal(f.command(request).value.outcome,'recoverable');
  const preview=f.query({type:'workspace.previewProjectRenameRecovery',operationId:request.operationId}).value;
  const completed=f.command({type:'workspace.recoverProjectRename',operationId:request.operationId,previewToken:preview.previewToken,action:'complete_destination'});
  assert.equal(completed.value.outcome,'completed');
  const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
  for(const mutate of [
   db=>db.exec("UPDATE project_rename_attestations SET journal=json_set(journal,'$.name','Changed')"),
   db=>db.exec("UPDATE project_rename_attestations SET journal=json_set(journal,'$.stagedIdentity','{}')"),
   db=>db.exec("UPDATE project_rename_attestations SET project_evidence=json_set(project_evidence,'$.evidence.created','999999999999999999')"),
   db=>db.exec("UPDATE project_rename_attestations SET authorization=json_set(authorization,'$.parent.evidence.created','999999999999999999')"),
  ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
  assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),completed);
 },'direct',{native});
});
