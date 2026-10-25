import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
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
const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
for(const stale of [null,'root','category','destination','project','cleanup_missing','generation_shape','generation_future','native_extra'])test(`real0023 category removal recovery ${stale==='cleanup_missing'?'retains unprovable absent-category cleanup':stale?'retains changed-dev '+stale+' uncertainty':'attests exact old root/category/member triples'}`,()=>{
 const cleanupMissing=stale==='cleanup_missing';
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'legacy-removal-'))),root=join(directory,'root'),path=join(directory,'data','app.sqlite'),migrations=join(directory,'migrations');
 mkdirSync(join(root,'Category/Project'),{recursive:true});mkdirSync(join(root,'Destination'));mkdirSync(join(root,'Unrelated/Other'),{recursive:true});mkdirSync(join(directory,'data'));mkdirSync(join(migrations,'meta'),{recursive:true});writeFileSync(join(root,'Category/Project/sentinel'),'legacy bytes');
 const journal=JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json','utf8'));journal.entries=journal.entries.slice(0,24);
 for(const entry of journal.entries)copyFileSync(`src/service/db/migrations/${entry.tag}.sql`,join(migrations,entry.tag+'.sql'));writeFileSync(join(migrations,'meta/_journal.json'),JSON.stringify(journal));
 const sql=new Database(path),sourceId=randomUUID(),workspaceId=randomUUID(),categoryId=randomUUID(),destinationId=randomUUID(),projectId=randomUUID(),operationId=randomUUID(),propertyId=randomUUID();let service;
 const native=path=>{const identity=nativeProjectFilesystem.inspect(path).identity;const changed=path===(stale==='root'?root:stale==='category'?join(root,'Category'):stale==='destination'?join(root,'Destination'):stale==='project'?join(root,'Category/Project'):null);return JSON.stringify(changed?{...identity,dev:'999'}:identity);};
 try {
  migrate(drizzle(sql),{migrationsFolder:migrations});sql.pragma('foreign_keys=ON');sql.prepare("INSERT INTO settings VALUES('language','en')").run();
  const source={id:sourceId,canonicalRoot:root,discoveryMode:'grouped',discoveryRevision:1,propertyRevision:1,categoryPropertyRevision:0,excludedRelativePaths:'[]',archiveRelativePath:null,appliedRootIdentity:native(root)};
  const category={modeInactive:false,id:categoryId,sourceId,relativePath:'Category',nativeIdentity:native(join(root,'Category')),associationState:'active'};
  const project={modeInactive:false,id:projectId,sourceId,relativePath:'Category/Project',nativeIdentity:native(join(root,'Category/Project')),categoryId,associationState:'active'};
  const destination={...category,id:destinationId,relativePath:'Destination',nativeIdentity:native(join(root,'Destination'))};
  const binding={source,category,destination,members:cleanupMissing?[]:[project]},previewToken=randomUUID();
  sql.prepare("INSERT INTO sources(id,canonical_root,discovery_mode,discovery_revision,property_revision,applied_root_identity) VALUES(?,?,'grouped',1,1,?)").run(sourceId,root,source.appliedRootIdentity);
  sql.prepare("INSERT INTO workspaces(id,name,source_id,position) VALUES(?,'Legacy',?,0)").run(workspaceId,sourceId);sql.prepare("INSERT INTO views(id,workspace_id,name,kind) VALUES(?,?,'Table','table')").run(randomUUID(),workspaceId);
  sql.prepare("INSERT INTO category_properties VALUES(?,?,'Category')").run(randomUUID(),sourceId);
  sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) VALUES(?,?,'Category',?,'active')").run(categoryId,sourceId,category.nativeIdentity);
  sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) VALUES(?,?,'Destination',?,'active')").run(destinationId,sourceId,destination.nativeIdentity);
  if(!cleanupMissing)sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,category_id,association_state) VALUES(?,?,'Category/Project',?,?,'active')").run(projectId,sourceId,project.nativeIdentity,categoryId);
  sql.prepare("INSERT INTO property_definitions VALUES(?,?,'Notes','text',0)").run(propertyId,sourceId);if(!cleanupMissing)sql.prepare('INSERT INTO text_property_values VALUES(?,?,?,?)').run(projectId,propertyId,sourceId,'legacy metadata');
  sql.prepare("INSERT INTO category_removal_operations(operation_id,source_id,workspace_id,category_id,destination_category_id,original_relative_path,requested_relative_path,native_identity,preview_token,binding,stage) VALUES(?,?,?,?,?,'Category','Destination',?,?,?,'moving')").run(operationId,sourceId,workspaceId,categoryId,destinationId,category.nativeIdentity,previewToken,JSON.stringify(binding));
  if(cleanupMissing){rmSync(join(root,'Category'),{recursive:true});sql.prepare("UPDATE category_removal_operations SET stage='cleanup_intent'").run();}
  let before=sql.prepare('SELECT * FROM category_removal_operations').get();
  service=openSettingsService(path,undefined,undefined,observer);const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
  const reviewRoot=query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.ok(reviewRoot.previewToken);assert.equal(command({type:'workspace.applySourceAssociation',previewToken:reviewRoot.previewToken}).ok,true);
  assert.equal(sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence,null);if(!cleanupMissing)assert.equal(sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
  if(stale==='generation_shape'||stale==='generation_future') {
   const triggers=sql.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='category_removal_operations'").all();for(const trigger of triggers)sql.exec(`DROP TRIGGER "${trigger.name}"`);
   sql.prepare("UPDATE category_removal_operations SET binding=json_set(binding,'$.source.evidenceGeneration',?)").run(stale==='generation_shape'?'unknown':999);for(const trigger of triggers)sql.exec(trigger.sql);before=sql.prepare('SELECT * FROM category_removal_operations').get();
  }
  if(stale==='native_extra') {
   const native=JSON.stringify({...JSON.parse(before.native_identity),version:2}),triggers=sql.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='category_removal_operations'").all();for(const trigger of triggers)sql.exec(`DROP TRIGGER "${trigger.name}"`);
   sql.prepare("UPDATE category_removal_operations SET native_identity=?,binding=json_set(binding,'$.category.nativeIdentity',?)").run(native,native);sql.prepare('UPDATE categories SET native_identity=? WHERE id=?').run(native,categoryId);for(const trigger of triggers)sql.exec(trigger.sql);before=sql.prepare('SELECT * FROM category_removal_operations').get();
  }
  const review=query({type:'workspace.previewCategoryRemovalRecovery',operationId});assert.equal(review.ok,true,JSON.stringify(review));
  if(stale){assert.deepEqual(review.value.actions,[]);assert.equal(review.value.previewToken,null);assert.equal(sql.prepare('SELECT count(*) n FROM category_removal_attestations').get().n,0);}
  else {
   assert.deepEqual(review.value.actions,['retry_remaining','abandon']);const result=command({type:'workspace.recoverCategoryRemoval',operationId,previewToken:review.value.previewToken,action:'retry_remaining'});
   assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));assert.equal(query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
   assert.ok(sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence);assert.ok(sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence);
   assert.equal(sql.prepare('SELECT count(*) n FROM category_removal_attestations').get().n,1);
   const exported=service.handleQuery({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));

   for(const field of ['source.appliedRootIdentity','category.nativeIdentity','destination.nativeIdentity','members[0].nativeIdentity']){
    const content=alteredSnapshot(exported.value.content,db=>{const b=JSON.parse(db.prepare('SELECT binding FROM category_removal_operations').get().binding);const encoded=field==='source.appliedRootIdentity'?b.source.appliedRootIdentity:field==='category.nativeIdentity'?b.category.nativeIdentity:field==='destination.nativeIdentity'?b.destination.nativeIdentity:b.members[0].nativeIdentity;db.prepare('UPDATE category_removal_operations SET binding=json_set(binding,?,?)').run('$.'+field,JSON.stringify({...JSON.parse(encoded),version:2}));db.exec("UPDATE category_removal_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM category_removal_operations WHERE operation_id=category_removal_attestations.operation_id))");});assert.equal(service.handleCommand({type:'data.restore',content}).ok,false,field);
   }
   for(const generation of ['unknown',999]){
    const content=alteredSnapshot(exported.value.content,db=>{db.prepare("UPDATE category_removal_operations SET binding=json_set(binding,'$.source.evidenceGeneration',?)").run(generation);db.exec("UPDATE category_removal_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM category_removal_operations WHERE operation_id=category_removal_attestations.operation_id))");});
    assert.equal(service.handleCommand({type:'data.restore',content}).ok,false,`original generation ${generation}`);
   }
   for(const field of ['source','category','destination','members[0]'])for(const invalid of ['',0]){
    const content=alteredSnapshot(exported.value.content,db=>{db.prepare("UPDATE category_removal_operations SET binding=json_set(binding,?,?)").run(`$.${field}.durableEvidence`,invalid);db.exec("UPDATE category_removal_attestations SET journal=json_set(journal,'$.binding',(SELECT binding FROM category_removal_operations WHERE operation_id=category_removal_attestations.operation_id))");});
    assert.equal(service.handleCommand({type:'data.restore',content}).ok,false,`${field}:${JSON.stringify(invalid)}`);
   }
   assert.equal(service.handleCommand({type:'data.restore',content:exported.value.content}).ok,true);
  }
  const after=sql.prepare('SELECT * FROM category_removal_operations').get();for(const field of ['binding','native_identity','operation_id','preview_token'])assert.equal(after[field],before[field]);
if(!cleanupMissing)assert.equal(readFileSync(join(root,stale?'Category/Project/sentinel':'Destination/Project/sentinel'),'utf8'),'legacy bytes');
  if(!cleanupMissing)assert.equal(query({type:'workspace.listTextProperties'}).value.values[0].value,'legacy metadata');assert.equal(sql.prepare("SELECT count(*) n FROM projects WHERE relative_path LIKE 'Unrelated/%'").get().n,0);
 }finally{service?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
});
