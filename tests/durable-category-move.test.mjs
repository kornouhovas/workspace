import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {renameNoReplace} from '../dist/service/project-rename-filesystem.mjs';
import {openSettingsService} from '../dist/service/settings.mjs';

function fixture(run,options={}) {
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'durable-move-'))),root=join(directory,'source'),dbPath=join(directory,'data','settings.sqlite');
 mkdirSync(join(root,'From/Project'),{recursive:true});mkdirSync(join(root,'To'));writeFileSync(join(root,'From/Project/sentinel'),'exact contents');
 const open=()=>openSettingsService(dbPath,undefined,undefined,options.observer,options.filesystem,options.native,options.reader);
 let service=open();
 const workspace=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 const list=command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).value,projectId=list.projects[0].projectId;
 const propertyId=command({type:'workspace.createProperty',propertyType:'text',name:'Notes'}).value.propertyId;
 command({type:'workspace.setTextValue',projectId,propertyId,value:'exact\nmetadata'});
 const sql=new Database(dbPath);
 try{const result=run({root,dbPath,sql,query,command,projectId,workspaceId,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),fromId:list.categories.find(c=>c.name==='From').categoryId,toId:list.categories.find(c=>c.name==='To').categoryId,
  get service(){return service;},restart(){service.close();service=open();}});if(result instanceof Promise)return result.finally(()=>{sql.close();service.close();rmSync(directory,{recursive:true,force:true});});}
 catch(error){sql.close();service.close();rmSync(directory,{recursive:true,force:true});throw error;}
 sql.close();service.close();rmSync(directory,{recursive:true,force:true});
}

test('category move reacquires both parent mounts after stored device changes while preserving IDs and values',()=>fixture(f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);
 f.restart();
 const request={type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 const result=f.command(request);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed',JSON.stringify(result));
 assert.equal(result.value.project.projectId,f.projectId);assert.equal(result.value.project.categoryId,f.toId);
 assert.equal(existsSync(join(f.root,'From/Project')),false);assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'exact contents');
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');
 f.restart();assert.deepEqual(f.command(request),result);assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].categoryId,f.toId);
}));

test('uncertain move completes through explicit current review after both parent mounts change',()=>{
 let device=null;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return value.ok && device ? {...value,mount:{...value.mount,dev:device}} : value;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const value=nativeProjectFilesystem.inspect(path);return device?{...value,identity:{...value.identity,dev:device}}:value;}};
 const native=(from,to)=>{const result=renameNoReplace(from,to);if(result==='renamed')throw new Error('lost native result');return result;};
 fixture(f=>{
  const request={type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');device='888';f.restart();assert.deepEqual(f.command(request),pending);
  const preview=f.query({type:'workspace.previewProjectCategoryMoveRecovery',operationId:request.operationId});
  assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.actions,['complete_destination']);
  const completed=f.command({type:'workspace.recoverProjectCategoryMove',operationId:request.operationId,action:'complete_destination',previewToken:preview.value.previewToken});
  assert.equal(completed.ok,true,JSON.stringify(completed));assert.equal(completed.value.outcome,'completed');
  device=null;f.restart();assert.deepEqual(f.command(request),completed);assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].categoryId,f.toId);
  assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'exact contents');
 },{reader,filesystem,native});
});

test('a mount change after category-move review invalidates both-parent authorization',()=>{
 let device=null;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);return value.ok && device ? {...value,mount:{...value.mount,dev:device}}:value;};
 const filesystem={...nativeProjectFilesystem,inspect(path){const value=nativeProjectFilesystem.inspect(path);return device?{...value,identity:{...value.identity,dev:device}}:value;}};
 const native=(from,to)=>{const outcome=renameNoReplace(from,to);if(outcome==='renamed')throw new Error('lost reply');return outcome;};
 fixture(f=>{
  const request={type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');
  const preview=f.query({type:'workspace.previewProjectCategoryMoveRecovery',operationId:request.operationId}).value;assert.ok(preview.previewToken);
  device='888';
  const denied=f.command({type:'workspace.recoverProjectCategoryMove',operationId:request.operationId,action:'complete_destination',previewToken:preview.previewToken});
  assert.equal(denied.ok,false);assert.equal(denied.error.code,'stale_preview');assert.deepEqual(f.command(request),pending);
  assert.equal(f.query({type:'workspace.listProjectCategoryMoves'}).value.operations.length,1);
 },{reader,filesystem,native});
});
for(const role of ['source','project','original','destination'])test(`category move refuses unverified ${role} evidence without a native effect`,()=>fixture(f=>{
 const revision=f.query({type:'workspace.listProjects'}).value.revision;
 if(role==='source')f.sql.exec('UPDATE sources SET durable_evidence=NULL');
 else if(role==='project')f.sql.exec('UPDATE projects SET durable_evidence=NULL');
 else f.sql.prepare('UPDATE categories SET durable_evidence=NULL WHERE id=?').run(role==='original'?f.fromId:f.toId);
 const result=f.command({type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:revision});
 assert.equal(result.ok,true);assert.equal(result.value.outcome,'rejected');
 assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'To/Project')),false);
 assert.equal(f.query({type:'workspace.listProjectCategoryMoves'}).value.operations.length,0);
},{native(){assert.fail('Unverified evidence must prevent native dispatch');}}));

test('category-move collision never overwrites or renames either folder',()=>fixture(f=>{
 mkdirSync(join(f.root,'To/Project'));writeFileSync(join(f.root,'To/Project/sentinel'),'keep other');
 const result=f.command({type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision});
 assert.equal(result.value.outcome,'rejected');assert.equal(result.value.problem,'occupied');
 assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'keep other');
}));

test('category-move scope loss remains reserved after root-only reassociation',()=>fixture(f=>{
 const request={type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');
 rmSync(join(dirname(f.dbPath),'installation-scope.json'));f.restart();
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.ok(review.previewToken);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.previewToken}).ok,true);
 const preview=f.query({type:'workspace.previewProjectCategoryMoveRecovery',operationId:request.operationId});assert.equal(preview.ok,true);assert.deepEqual(preview.value.actions,[]);
 assert.deepEqual(f.command(request),pending);assert.equal(f.query({type:'workspace.listProjectCategoryMoves'}).value.operations.length,1);
 assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');
},{native(){throw new Error('Interrupted before effect');}}));

test('move restore rejects missing, mixed-root and malformed two-parent authorization',()=>fixture(f=>{
 const request={type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
 const completed=f.command(request);assert.equal(completed.value.outcome,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec('UPDATE project_category_move_operations SET project_evidence=NULL'),
  db=>db.exec('UPDATE project_category_move_operations SET destination_authorization=NULL'),
  db=>db.exec("UPDATE project_category_move_operations SET destination_authorization=json_set(destination_authorization,'$.generation',999)"),
  db=>db.exec("UPDATE project_category_move_operations SET destination_authorization=json_set(destination_authorization,'$.root.mount.dev','999')"),
  db=>db.exec("UPDATE project_category_move_operations SET project_evidence=json_set(project_evidence,'$.evidence.scope','foreign')"),
  db=>db.exec("UPDATE project_category_move_operations SET original_authorization=json_set(original_authorization,'$.version',2)"),
 ]) {
  assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
  assert.deepEqual(f.command(request),completed);
 }
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),completed);
 assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'exact contents');
}));

test('move attestations preserve immutable requests, recorded history and both durable parents',()=>{
 const native=(from,to)=>{const outcome=renameNoReplace(from,to);if(outcome==='renamed')throw new Error('lost native response');return outcome;};
 fixture(f=>{
  const request={type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:f.query({type:'workspace.listProjects'}).value.revision};
  assert.equal(f.command(request).value.outcome,'recoverable');
  const preview=f.query({type:'workspace.previewProjectCategoryMoveRecovery',operationId:request.operationId}).value;
  const result=f.command({type:'workspace.recoverProjectCategoryMove',operationId:request.operationId,action:'complete_destination',previewToken:preview.previewToken});assert.equal(result.value.outcome,'completed');
  const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
  for(const mutate of [
   db=>db.exec("UPDATE project_category_move_attestations SET journal=json_set(journal,'$.destinationParentRelativePath','Other')"),
   db=>db.exec("UPDATE project_category_move_attestations SET journal=json_set(journal,'$.destinationIdentity','{}')"),
   db=>db.exec("UPDATE project_category_move_attestations SET destination_authorization=json_set(destination_authorization,'$.parent.evidence.created','999999999999999999')"),
   db=>db.exec("UPDATE project_category_move_attestations SET project_evidence=json_set(project_evidence,'$.evidence.created','999999999999999999')"),
  ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
  assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),result);
 },{native});
});

for(const role of ['root','original','destination','project'])for(const change of ['created','volume','scope'])test(`category move rejects ${change} substitution in ${role} proof before native dispatch`,()=>{
 let substitute=false,selectedPath;
 const reader=(path,scope)=>{
  const value=observeFolder(path,scope);
  if(!substitute || path!==selectedPath || !value.ok)return value;
  const evidence={...value.evidence};
  if(change==='created')evidence.created=(BigInt(evidence.created)+1n).toString();
  if(change==='scope')evidence.scope='another-installation';
  if(change==='volume')evidence.volume=evidence.provider==='apfs'?'1234567890abcdef1234567890abcdef':'\\\\?\\Volume{12345678-1234-1234-1234-123456789abc}\\';
  return {...value,evidence};
 };
 fixture(f=>{
  const revision=f.query({type:'workspace.listProjects'}).value.revision;
  selectedPath=role==='root'?f.root:join(f.root,role==='original'?'From':role==='destination'?'To':'From/Project');substitute=true;
  const result=f.command({type:'workspace.moveProjectCategory',operationId:randomUUID(),projectId:f.projectId,destinationCategoryId:f.toId,expectedRevision:revision});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'rejected',JSON.stringify(result));
  assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'To/Project')),false);
  assert.equal(f.query({type:'workspace.listProjectCategoryMoves'}).value.operations.length,0);
 },{reader,native(){assert.fail('Substitution must prevent native dispatch');}});
});
