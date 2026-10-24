import {spawnSync} from "node:child_process";
import {alteredSnapshot} from './support/mutate-application-snapshot.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,existsSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {renameNoReplace} from '../dist/service/project-rename-filesystem.mjs';
import {openSettingsService} from '../dist/service/settings.mjs';
const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
function fixture(run,options={}) {
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'durable-category-removal-'))),root=join(directory,'root'),path=join(directory,'app.sqlite');
 mkdirSync(join(root,'From/Project'),{recursive:true});mkdirSync(join(root,'To'));writeFileSync(join(root,'From/Project/sentinel'),'exact contents');
 const open=()=>openSettingsService(path,undefined,undefined,observer,options.filesystem,options.native,options.reader);
 let service=open();const workspace=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode:'grouped'}).value,list=command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).value;
 const projectId=list.projects[0].projectId,categoryId=list.categories.find(row=>row.name==='From').categoryId,destinationCategoryId=list.categories.find(row=>row.name==='To').categoryId;
 const propertyId=command({type:'workspace.createProperty',propertyType:'text',name:'Notes'}).value.propertyId;
 command({type:'workspace.setTextValue',projectId,propertyId,value:'exact\nmetadata'});
 const sql=new Database(path),review=(action,name,id=null)=>query({type:'workspace.previewCategoryFolder',action,name,categoryId:id}),apply=preview=>command({type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken});
 try{run({root,directory,path,sql,query,command,review,apply,projectId,categoryId,destinationCategoryId,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),restart(){service.close();service=open();}});}
 finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
test('category removal preserves projects and metadata across stored device changes and deletes only the empty category',()=>fixture(f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);
 const before=f.sql.prepare('SELECT * FROM projects').get();f.restart();
 const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId});
 assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.blockers,[]);
 const request={type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.value.previewToken};const result=f.command(request);
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));
 assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'From')),false);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').get(),{...before,relative_path:'To/Project',category_id:f.destinationCategoryId});
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');f.restart();assert.deepEqual(f.command(request),result);
}));

test('a source rooted in the removed category added after preview invalidates removal before any child effect',()=>fixture(f=>{
 const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
 const peer=f.command({type:'workspace.create',name:'Nested source',rootPath:join(f.root,'From')});assert.equal(peer.ok,true,JSON.stringify(peer));
 const result=f.command({type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken});
 assert.equal(result.ok,false,JSON.stringify(result));assert.equal(existsSync(join(f.root,'From/Project/sentinel')),true);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM category_removal_operations').get().n,0);
}));

test('removal refuses a project durable alias in an unowned branch',()=>{
 let rootPath,ambiguous=false;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);if(!ambiguous||!value.ok||!path.endsWith('/Other'))return value;
  return {...value,evidence:observeFolder(join(rootPath,'From/Project'),scope).evidence};};
 fixture(f=>{
  rootPath=f.root;mkdirSync(join(f.root,'Unowned/Other'),{recursive:true});ambiguous=true;
  const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId});
  assert.equal(preview.ok,false,JSON.stringify(preview));assert.equal(existsSync(join(f.root,'From/Project/sentinel')),true);
 },{reader});
});

test('a mount change after the durable child assignment cannot mint a fresh child move permit',()=>{let calls=0;fixture(f=>{
 const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
 const prepare=Database.prototype.prepare,lstat=fs.lstatSync;let changed=false;
 Database.prototype.prepare=function(sql,...args){const statement=prepare.call(this,sql,...args);
  if(sql.trimStart().toLowerCase().startsWith('insert into "category_removal_attempts"')){const run=statement.run;statement.run=function(...values){const value=run.apply(this,values);changed=true;
   fs.lstatSync=(path,...options)=>{const stat=lstat(path,...options);if(typeof path==='string'&&(path===f.root||path.startsWith(f.root+sep))&&typeof stat.dev==='bigint')stat.dev=777n;return stat;};syncBuiltinESMExports();return value;};}
  return statement;};
 let result;try{result=f.command({type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken});}
 finally{Database.prototype.prepare=prepare;fs.lstatSync=lstat;syncBuiltinESMExports();}
 assert.equal(changed,true);assert.equal(result.value.operation.stage,'moving',JSON.stringify(result));assert.equal(calls,0);
 assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'To/Project')),false);
},{native(){calls++;return 'occupied';}});});

test('removal cannot relocate a project retained as another source root under a stale locator',()=>fixture(f=>{
 mkdirSync(join(f.directory,'Other'));const peer=f.command({type:'workspace.create',name:'Peer',rootPath:join(f.directory,'Other')});assert.equal(peer.ok,true);
 const proof=f.sql.prepare('SELECT durable_evidence,native_identity FROM projects WHERE id=?').get(f.projectId);
 f.sql.prepare('UPDATE sources SET durable_evidence=?,applied_root_identity=? WHERE canonical_root=?').run(proof.durable_evidence,proof.native_identity,join(f.directory,'Other'));
 const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId});
 assert.equal(preview.ok,false,JSON.stringify(preview));assert.equal(existsSync(join(f.root,'From/Project/sentinel')),true);
}));

test('matching category removal backups restore while malformed or contradictory batch proof roles are rejected',()=>fixture(f=>{
 const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
 const request={type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken};const result=f.command(request);assert.equal(result.value.operation.stage,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const change of [
  "'$.authorization.version',2",
  "'$.authorization.root.generation',999",
  "'$.authorization.category.evidence.created','999999999999'",
  "'$.authorization.projects[0].id','00000000-0000-4000-8000-000000000001'",
 ]) {
  const content=alteredSnapshot(exported.value.content,db=>db.exec(`UPDATE category_removal_operations SET binding=json_set(binding,${change})`));
  assert.equal(f.send({type:'data.restore',content}).ok,false,change);assert.deepEqual(f.command(request),result);
 }
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),result);
}));

for(const target of ['From','To','Project'])test(`removal refuses a changed full ${target} proof before Apply and consumes its review`,()=>{
 let changed=false;
 const reader=(path,scope)=>{const proof=observeFolder(path,scope);return changed&&proof.ok&&path.split(/[\\/]/).at(-1)===target?{...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}}:proof;};
 fixture(f=>{
  const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
  const request={type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken};changed=true;assert.equal(f.command(request).ok,false);changed=false;
  assert.equal(f.command(request).ok,false);assert.equal(f.sql.prepare('SELECT count(*) n FROM category_removal_operations').get().n,0);assert.equal(existsSync(join(f.root,'From/Project/sentinel')),true);
 },{reader});
});

test('removal preserves independent property edits after Preview and terminal retries never replay a child',()=>{
 let calls=0;fixture(f=>{
  const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
  const propertyId=f.query({type:'workspace.listTextProperties'}).value.definitions[0].propertyId;
  assert.equal(f.command({type:'workspace.setTextValue',projectId:f.projectId,propertyId,value:'new value'}).ok,true);
  const request={type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken},result=f.command(request);assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));
  assert.equal(calls,1);assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'new value');
  f.restart();assert.deepEqual(f.command(request),result);assert.equal(calls,1);assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'exact contents');
 },{native(from,to){calls++;return renameNoReplace(from,to);}});
});

test('uncertain child effect retains the batch and original retry is read-only across restart',()=>{
 let calls=0;fixture(f=>{
  const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
  const request={type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken},result=f.command(request);assert.equal(result.value.operation.stage,'moving',JSON.stringify(result));assert.equal(result.value.operation.projects[0].outcome,'recoverable');
  assert.equal(calls,1);f.restart();assert.deepEqual(f.command(request),result);assert.equal(calls,1);
  assert.equal(readFileSync(join(f.root,'To/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'From')),true);
  assert.equal(f.query({type:'workspace.listCategoryRemovals'}).value.operations.length,1);
 },{native(from,to){calls++;assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost child response');}});
});

test('late member relocation after terminal SQL write rolls back completion and keeps cleanup intent',()=>fixture(f=>{
 const preview=f.query({type:'workspace.previewCategoryRemoval',categoryId:f.categoryId,destinationCategoryId:f.destinationCategoryId}).value;
 const prepare=Database.prototype.prepare;let changed=false;
 Database.prototype.prepare=function(sql,...args){const statement=prepare.call(this,sql,...args);
  if(sql.trimStart().toLowerCase().startsWith('update "category_removal_operations"')){const run=statement.run;statement.run=function(...values){const result=run.apply(this,values);if(values.flat().includes('completed')){changed=true;renameSync(join(f.root,'To/Project'),join(f.root,'To/Aside'));}return result;};}
  return statement;};
 let result;try{result=f.command({type:'workspace.applyCategoryRemoval',operationId:randomUUID(),previewToken:preview.previewToken});}finally{Database.prototype.prepare=prepare;}
 assert.equal(changed,true);assert.equal(result.value.operation.stage,'cleanup_intent',JSON.stringify(result));
 assert.equal(f.sql.prepare('SELECT association_state FROM categories WHERE id=?').get(f.categoryId).association_state,'active');
 assert.equal(readFileSync(join(f.root,'To/Aside/sentinel'),'utf8'),'exact contents');assert.equal(f.query({type:'workspace.listCategoryRemovals'}).value.operations.length,1);
}));

for(const phase of ['batch_intent','intent','effect','recorded','cleanup_intent','cleanup_effect'])test(`production removal process exit at ${phase} retains its journal without retry effects`,()=>fixture(f=>{
 const operationId=randomUUID();
 const child=spawnSync(process.execPath,['--import','tsx','tests/fixtures/category-removal-crash-worker.mjs',f.path,f.query({type:'workspace.listProjects'}).value.workspaceId,f.categoryId,f.destinationCategoryId,operationId,phase,'application'],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(child.status,71,child.stderr);const row=f.sql.prepare('SELECT * FROM category_removal_operations WHERE operation_id=?').get(operationId);assert.ok(JSON.parse(row.binding).authorization);
 f.restart();const request={type:'workspace.applyCategoryRemoval',operationId,previewToken:row.preview_token},result=f.command(request);
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.operation.stage,row.stage);assert.deepEqual(f.command(request),result);
 assert.equal(f.query({type:'workspace.listCategoryRemovals'}).value.operations.length,1);
 const destination=['effect','recorded','cleanup_intent','cleanup_effect'].includes(phase);
 assert.equal(readFileSync(join(f.root,destination?'To/Project/sentinel':'From/Project/sentinel'),'utf8'),'exact contents');
 assert.equal(existsSync(join(f.root,'From')),phase!=='cleanup_effect');
}));
