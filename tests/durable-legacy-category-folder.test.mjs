import {alteredSnapshot} from './support/mutate-application-snapshot.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,copyFileSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {scanGroupedSource} from '../src/service/discovery.ts';
import {openSettingsService} from '../dist/service/settings.mjs';
const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
for(const stale of [false,true,'generation_shape','generation_future','native_extra'])test(`real0023 category rename recovery ${typeof stale==='string'?stale:stale?'retains changed-dev uncertainty':'attests exact old root/category/member triples'}`,()=>{
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'legacy-category-'))),root=join(directory,'root'),path=join(directory,'data','app.sqlite'),migrations=join(directory,'migrations');
 mkdirSync(join(root,'Category/Project'),{recursive:true});mkdirSync(join(directory,'data'));mkdirSync(join(migrations,'meta'),{recursive:true});writeFileSync(join(root,'Category/Project/sentinel'),'legacy bytes');
 const journal=JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json','utf8'));journal.entries=journal.entries.slice(0,24);
 for(const entry of journal.entries)copyFileSync(`src/service/db/migrations/${entry.tag}.sql`,join(migrations,entry.tag+'.sql'));writeFileSync(join(migrations,'meta/_journal.json'),JSON.stringify(journal));
 const sql=new Database(path),sourceId=randomUUID(),workspaceId=randomUUID(),categoryId=randomUUID(),projectId=randomUUID(),operationId=randomUUID(),propertyId=randomUUID();let service;
 const native=path=>{const identity=nativeProjectFilesystem.inspect(path).identity;return JSON.stringify(stale===true?{...identity,dev:'999'}:identity);};
 try {
  migrate(drizzle(sql),{migrationsFolder:migrations});sql.pragma('foreign_keys=ON');sql.prepare("INSERT INTO settings VALUES('language','en')").run();
  const source={id:sourceId,canonicalRoot:root,discoveryMode:'grouped',discoveryRevision:1,propertyRevision:1,categoryPropertyRevision:0,excludedRelativePaths:'[]',archiveRelativePath:null,appliedRootIdentity:native(root)};
  const category={modeInactive:false,id:categoryId,sourceId,relativePath:'Category',nativeIdentity:native(join(root,'Category')),associationState:'active'};
  const project={modeInactive:false,id:projectId,sourceId,relativePath:'Category/Project',nativeIdentity:native(join(root,'Category/Project')),categoryId,associationState:'active'};
  const snapshot=scanGroupedSource(root,null,[]).snapshot;assert.ok(snapshot);
  if(stale){snapshot.root.identity.dev='999';for(const child of snapshot.children)if(child.kind==='directory')child.identity.dev='999';}
  const binding={source,snapshot,category,members:[project],additions:[],associationIdentity:null},previewToken=randomUUID();
  sql.prepare("INSERT INTO sources(id,canonical_root,discovery_mode,discovery_revision,property_revision,applied_root_identity) VALUES(?,?,'grouped',1,1,?)").run(sourceId,root,source.appliedRootIdentity);
  sql.prepare("INSERT INTO workspaces(id,name,source_id,position) VALUES(?,'Legacy',?,0)").run(workspaceId,sourceId);sql.prepare("INSERT INTO views(id,workspace_id,name,kind) VALUES(?,?,'Table','table')").run(randomUUID(),workspaceId);
  sql.prepare("INSERT INTO category_properties VALUES(?,?,'Category')").run(randomUUID(),sourceId);
  sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) VALUES(?,?,'Category',?,'active')").run(categoryId,sourceId,category.nativeIdentity);
  sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,category_id,association_state) VALUES(?,?,'Category/Project',?,?,'active')").run(projectId,sourceId,project.nativeIdentity,categoryId);
  sql.prepare("INSERT INTO property_definitions VALUES(?,?,'Notes','text',0)").run(propertyId,sourceId);sql.prepare('INSERT INTO text_property_values VALUES(?,?,?,?)').run(projectId,propertyId,sourceId,'legacy metadata');
  sql.prepare("INSERT INTO category_folder_operations(operation_id,source_id,workspace_id,preview_token,category_id,action,original_relative_path,requested_relative_path,binding,native_identity,stage) VALUES(?,?,?,?,?,'rename','Category','Renamed',?,?,'intent')").run(operationId,sourceId,workspaceId,previewToken,categoryId,JSON.stringify(binding),category.nativeIdentity);
  renameSync(join(root,'Category'),join(root,'Renamed'));let before=sql.prepare('SELECT * FROM category_folder_operations').get();
  service=openSettingsService(path,undefined,undefined,observer);const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
  const reviewRoot=query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.ok(reviewRoot.previewToken);assert.equal(command({type:'workspace.applySourceAssociation',previewToken:reviewRoot.previewToken}).ok,true);
  assert.equal(sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence,null);assert.equal(sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
  if(stale==='generation_shape'||stale==='generation_future') {
   const triggers=sql.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='category_folder_operations'").all();for(const trigger of triggers)sql.exec(`DROP TRIGGER "${trigger.name}"`);
   sql.prepare("UPDATE category_folder_operations SET binding=json_set(binding,'$.source.evidenceGeneration',?)").run(stale==='generation_shape'?'unknown':999);for(const trigger of triggers)sql.exec(trigger.sql);before=sql.prepare('SELECT * FROM category_folder_operations').get();
  }
  if(stale==='native_extra') {
   const native=JSON.stringify({...JSON.parse(before.native_identity),version:2}),triggers=sql.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='category_folder_operations'").all();for(const trigger of triggers)sql.exec(`DROP TRIGGER "${trigger.name}"`);
   sql.prepare("UPDATE category_folder_operations SET native_identity=?,binding=json_set(binding,'$.category.nativeIdentity',?)").run(native,native);sql.prepare('UPDATE categories SET native_identity=? WHERE id=?').run(native,categoryId);for(const trigger of triggers)sql.exec(trigger.sql);before=sql.prepare('SELECT * FROM category_folder_operations').get();
  }
  const review=query({type:'workspace.previewCategoryFolderRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));
  if(stale){assert.deepEqual(review.value.actions,[]);assert.equal(review.value.previewToken,null);assert.equal(sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,0);}
  else {
   assert.deepEqual(review.value.actions,['complete_destination']);const result=command({type:'workspace.recoverCategoryFolder',operationId,previewToken:review.value.previewToken,action:'complete_destination'});
   assert.equal(result.value.outcome,'completed',JSON.stringify(result));assert.equal(query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
   assert.ok(sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence);assert.ok(sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence);
   assert.equal(sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,1);
   const exported=service.handleQuery({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
   const malformedMember=alteredSnapshot(exported.value.content,db=>{const b=JSON.parse(db.prepare('SELECT binding FROM category_folder_operations').get().binding);db.prepare("UPDATE category_folder_operations SET binding=json_set(binding,'$.members[0].nativeIdentity',?)").run(JSON.stringify({...JSON.parse(b.members[0].nativeIdentity),version:2}));db.exec("UPDATE category_folder_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM category_folder_operations WHERE operation_id=category_folder_attestations.operation_id))");});assert.equal(service.handleCommand({type:'data.restore',content:malformedMember}).ok,false);
   for(const generation of ['unknown',999]) {
    const content=alteredSnapshot(exported.value.content,db=>{db.prepare("UPDATE category_folder_operations SET binding=json_set(binding,'$.source.evidenceGeneration',?)").run(generation);db.exec("UPDATE category_folder_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM category_folder_operations WHERE operation_id=category_folder_attestations.operation_id))");});
    assert.equal(service.handleCommand({type:'data.restore',content}).ok,false,`original generation ${generation}`);
   }
   assert.equal(service.handleCommand({type:'data.restore',content:exported.value.content}).ok,true);
  }
  const after=sql.prepare('SELECT * FROM category_folder_operations').get();for(const field of ['binding','native_identity','operation_id','preview_token'])assert.equal(after[field],before[field]);
  assert.equal(after.authorization,null);assert.equal(after.destination_evidence,null);assert.equal(readFileSync(join(root,'Renamed/Project/sentinel'),'utf8'),'legacy bytes');
  assert.equal(query({type:'workspace.listTextProperties'}).value.values[0].value,'legacy metadata');
 }finally{service?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
});
