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
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'durable-category-folder-'))),root=join(directory,'root'),path=join(directory,'app.sqlite');
 mkdirSync(join(root,'From/Project'),{recursive:true});mkdirSync(join(root,'To'));writeFileSync(join(root,'From/Project/sentinel'),'exact contents');
 const open=()=>openSettingsService(path,undefined,undefined,observer,options.filesystem,options.native,options.reader);
 let service=open();const workspace=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode:'grouped'}).value,list=command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).value;
 const projectId=list.projects[0].projectId,categoryId=list.categories.find(row=>row.name==='From').categoryId;
 const propertyId=command({type:'workspace.createProperty',propertyType:'text',name:'Notes'}).value.propertyId;
 command({type:'workspace.setTextValue',projectId,propertyId,value:'exact\nmetadata'});
 const sql=new Database(path),review=(action,name,id=null)=>query({type:'workspace.previewCategoryFolder',action,name,categoryId:id}),apply=preview=>command({type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken});
 try{run({root,directory,path,sql,query,command,review,apply,projectId,categoryId,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),restart(){service.close();service=open();}});}
 finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
test('category creation reacquires durable root after stored device changes and enrolls the empty category',()=>fixture(f=>{
 f.sql.exec("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')");f.restart();
 const preview=f.review('create','Created');assert.equal(preview.ok,true,JSON.stringify(preview));assert.ok(preview.value.previewToken);
 const result=f.apply(preview.value);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed');assert.equal(existsSync(join(f.root,'Created')),true);
 const category=f.sql.prepare("SELECT * FROM categories WHERE relative_path='Created'").get();assert.ok(category.durable_evidence);f.restart();
 assert.ok(f.query({type:'workspace.listProjects'}).value.categories.some(row=>row.categoryId===category.id));
}));
test('category rename preserves child IDs, values, contents and historical raw identities across saved device changes',()=>fixture(f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);
 const before=f.sql.prepare('SELECT * FROM projects').get();f.restart();
 const preview=f.review('rename','Renamed',f.categoryId);assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.affectedProjects[0].projectId,f.projectId);
 const request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.value.previewToken};
 const result=f.command(request);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed',JSON.stringify(result));
 assert.equal(readFileSync(join(f.root,'Renamed/Project/sentinel'),'utf8'),'exact contents');assert.equal(existsSync(join(f.root,'From')),false);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').get(),{...before,relative_path:'Renamed/Project'});
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');f.restart();assert.deepEqual(f.command(request),result);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);
}));
test('explicit category association enrolls only previewed new category/children and leaves unrelated folders undiscovered',()=>fixture(f=>{
 mkdirSync(join(f.root,'Incoming/Child'),{recursive:true});mkdirSync(join(f.root,'Unrelated/Other'),{recursive:true});writeFileSync(join(f.root,'Incoming/Child/sentinel'),'incoming bytes');
 const preview=f.review('associate','Incoming');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.affectedProjects.length,1);
 assert.equal(preview.value.affectedProjects[0].name,'Child');const result=f.apply(preview.value);assert.equal(result.value.outcome,'completed',JSON.stringify(result));
 const category=f.sql.prepare("SELECT * FROM categories WHERE relative_path='Incoming'").get(),child=f.sql.prepare("SELECT * FROM projects WHERE relative_path='Incoming/Child'").get();
 assert.ok(category.durable_evidence);assert.ok(child.durable_evidence);assert.equal(f.sql.prepare('SELECT count(*) n FROM projects').get().n,2);
 assert.equal(readFileSync(join(f.root,'Incoming/Child/sentinel'),'utf8'),'incoming bytes');f.restart();assert.ok(f.query({type:'workspace.listProjects'}).value.projects.some(row=>row.projectId===child.id));
}));
test('category folder preview cannot authorize a remount occurring before Apply',()=>{
 let changed=false;const reader=(path,scope)=>{const value=observeFolder(path,scope);return changed&&value.ok?{...value,mount:{...value.mount,dev:'777'}}:value;};
 fixture(f=>{
  const preview=f.review('create','Created');assert.equal(preview.ok,true,JSON.stringify(preview));assert.ok(preview.value.previewToken);changed=true;
  assert.equal(f.apply(preview.value).ok,false);assert.equal(existsSync(join(f.root,'Created')),false);assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_operations').get().n,0);
 },{reader});
});

test('category association refuses full-ID aliases in another unowned category',()=>{
 let ambiguous=false;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);if(!ambiguous || !value.ok || !['Child','Other'].includes(path.split(/[\\/]/).at(-1)))return value;
  return {...value,evidence:{...value.evidence,fileId:value.evidence.provider==='apfs'?'999999999999':'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',created:'999999999999'}};};
 fixture(f=>{
  mkdirSync(join(f.root,'Incoming/Child'),{recursive:true});mkdirSync(join(f.root,'Unrelated/Other'),{recursive:true});ambiguous=true;
  const preview=f.review('associate','Incoming');assert.equal(preview.ok,false,JSON.stringify(preview));assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_operations').get().n,0);
 },{reader});
});
for(const change of ['category','project'])test(`category rename refuses changed full ${change} proof after preview before native dispatch`,()=>{
 let changed=false;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);const target=change==='category'?'From':'Project';return changed&&value.ok&&path.split(/[\\/]/).at(-1)===target?{...value,evidence:{...value.evidence,created:(BigInt(value.evidence.created)+1n).toString()}}:value;};
 fixture(f=>{
  const preview=f.review('rename','Renamed',f.categoryId);assert.equal(preview.ok,true,JSON.stringify(preview));changed=true;
  assert.equal(f.apply(preview.value).ok,false);assert.equal(existsSync(join(f.root,'Renamed')),false);assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_operations').get().n,0);
  assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');
 },{reader,native(){assert.fail('Changed proof must prevent native effect');}});
});


test('category folder backup restore rejects contradictory authorization roles and preserves matching receipts',()=>fixture(f=>{
 const preview=f.review('rename','Renamed',f.categoryId).value;
 const request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};const completed=f.command(request);assert.equal(completed.value.outcome,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("UPDATE category_folder_operations SET authorization=json_set(authorization,'$.version',2)"),
  db=>db.exec("UPDATE category_folder_operations SET authorization=json_set(authorization,'$.binding.generation',999)"),
  db=>db.exec("UPDATE category_folder_operations SET authorization=json_set(authorization,'$.projects[0].id','00000000-0000-4000-8000-000000000001')"),
  db=>db.exec("UPDATE category_folder_operations SET authorization=json_set(authorization,'$.category.evidence.created','999999999999')"),
  db=>db.exec("UPDATE category_folder_operations SET destination_evidence=NULL"),
  db=>db.exec("UPDATE category_folder_operations SET destination_evidence=json_set(destination_evidence,'$.evidence.scope','foreign')"),
 ]){assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);assert.deepEqual(f.command(request),completed);}
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),completed);
}));


for(const after of [false,true])test(`explicit category recovery ${after?'completes destination':'keeps original'} after a lost native response without replay`,()=>{
 let calls=0;const native=(from,to)=>{calls++;if(after)assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost native response');};
 fixture(f=>{
  const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
  const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');const bytes=f.sql.prepare('SELECT * FROM category_folder_operations').get();f.restart();
  assert.deepEqual(f.command(request),pending);assert.equal(calls,1);
  const review=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId});assert.equal(review.ok,true,JSON.stringify(review));
  const action=after?'complete_destination':'keep_original';assert.ok(review.value.actions.includes(action),JSON.stringify(review));
  const recovered=f.command({type:'workspace.recoverCategoryFolder',operationId:request.operationId,previewToken:review.value.previewToken,action});
  assert.equal(recovered.ok,true,JSON.stringify(recovered));assert.equal(recovered.value.outcome,after?'completed':'rejected');assert.equal(calls,1);
  const current=f.sql.prepare('SELECT * FROM category_folder_operations').get();for(const field of ['binding','native_identity','authorization'])assert.equal(current[field],bytes[field]);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,1);
  assert.equal(readFileSync(join(f.root,after?'Renamed/Project/sentinel':'From/Project/sentinel'),'utf8'),'exact contents');
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);f.restart();assert.deepEqual(f.command(request),recovered);
 },{native});
});

test('a category Apply that observes a remount consumes its token even when the old observation returns',()=>{
 let changed=false;const reader=(path,scope)=>{const value=observeFolder(path,scope);return changed&&value.ok?{...value,mount:{...value.mount,dev:'777'}}:value;};
 fixture(f=>{
  const preview=f.review('create','Created').value;changed=true;assert.equal(f.apply(preview).ok,false);changed=false;
  assert.equal(f.apply(preview).ok,false);assert.equal(existsSync(join(f.root,'Created')),false);assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_operations').get().n,0);
 },{reader});
});
test('new association backup cannot replace both raw association tuples while retaining unrelated full evidence',()=>fixture(f=>{
 mkdirSync(join(f.root,'Incoming/Child'),{recursive:true});const preview=f.review('associate','Incoming').value;
 const result=f.apply(preview);assert.equal(result.value.outcome,'completed');const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 const content=alteredSnapshot(exported.value.content,db=>{
  const row=db.prepare('SELECT * FROM category_folder_operations').get(),binding=JSON.parse(row.binding),bad=JSON.stringify({dev:'999',ino:'999999',birthtimeNs:'999999'});
  binding.associationIdentity=bad;db.prepare('UPDATE category_folder_operations SET native_identity=?,binding=?').run(bad,JSON.stringify(binding));
 });
 assert.equal(f.send({type:'data.restore',content}).ok,false);
}));
test('category keep_original rolls back attestation and reservation release on a change after its SQL write',()=>fixture(f=>{
 const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
 assert.equal(f.command(request).value.outcome,'recoverable');const review=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId}).value;assert.ok(review.actions.includes('keep_original'));
 const prepare=Database.prototype.prepare;let changed=false;
 Database.prototype.prepare=function(sql,...args){
  const statement=prepare.call(this,sql,...args);
  if(sql.trimStart().toLowerCase().startsWith('update "category_folder_operations"')) {
   const run=statement.run;
   statement.run=function(...values){const result=run.apply(this,values);if(values.flat().includes('kept_original')){changed=true;renameSync(join(f.root,'From'),join(f.root,'Aside'));}return result;};
  }
  return statement;
 };
 let recovered;
 try{recovered=f.command({type:'workspace.recoverCategoryFolder',operationId:request.operationId,previewToken:review.previewToken,action:'keep_original'});}
 finally{Database.prototype.prepare=prepare;}
 assert.equal(changed,true);assert.equal(recovered.value.outcome,'recoverable',JSON.stringify(recovered));
 assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,0);assert.equal(f.query({type:'workspace.listCategoryFolderOperations'}).value.operations.length,1);
 assert.equal(readFileSync(join(f.root,'Aside/Project/sentinel'),'utf8'),'exact contents');
},{native(){throw new Error('lost reply before effect');}}));

for(const stale of [false,true])test(`modeled category recovery ${stale?'rejects another mount after review':'renews recorded full proofs after a between-run mount change'}`,()=>{
 fixture(f=>{
  const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
  assert.equal(f.command(request).value.outcome,'recoverable');
  const lstat=fs.lstatSync;let device=777n;
  fs.lstatSync=(path,...args)=>{const value=lstat(path,...args);if(typeof path==='string'&&(path===f.root||path.startsWith(f.root+sep))&&typeof value.dev==='bigint')value.dev=device;return value;};syncBuiltinESMExports();
  try {
   f.restart();const review=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId});assert.equal(review.ok,true,JSON.stringify(review));assert.deepEqual(review.value.actions,['complete_destination']);
   if(stale)device=888n;
   const recovered=f.command({type:'workspace.recoverCategoryFolder',operationId:request.operationId,previewToken:review.value.previewToken,action:'complete_destination'});
   if(stale){assert.equal(recovered.ok,false);assert.equal(recovered.error.code,'stale_preview');assert.equal(f.query({type:'workspace.listCategoryFolderOperations'}).value.operations.length,1);}
   else{assert.equal(recovered.value.outcome,'completed',JSON.stringify(recovered));assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,1);}
  }finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
  assert.equal(readFileSync(join(f.root,'Renamed/Project/sentinel'),'utf8'),'exact contents');
 },{native(from,to){assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost effect reply');}});
});
for(const phase of ['apply','recovery'])test(`category ${phase} keeps property-only edits independent and preserves the latest value`,()=>fixture(f=>{
 const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
 let recovery;
 if(phase==='recovery'){assert.equal(f.command(request).value.outcome,'recoverable');recovery=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId}).value;}
 const propertyId=f.query({type:'workspace.listTextProperties'}).value.definitions[0].propertyId;
 assert.equal(f.command({type:'workspace.setTextValue',projectId:f.projectId,propertyId,value:'latest independent value'}).ok,true);
 const result=phase==='apply'?f.command(request):f.command({type:'workspace.recoverCategoryFolder',operationId:request.operationId,previewToken:recovery.previewToken,action:'complete_destination'});
 assert.equal(result.value.outcome,'completed',JSON.stringify(result));assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'latest independent value');
},phase==='apply'?{}:{native(from,to){assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost reply');}}));
test('lost installation scope cannot bless a pending category operation through root-only re-enrollment',()=>fixture(f=>{
 const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
 const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');rmSync(join(f.directory,'installation-scope.json'));f.restart();
 const source=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.ok(source.previewToken);assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:source.previewToken}).ok,true);
 const recovery=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId});assert.equal(recovery.ok,true);assert.deepEqual(recovery.value.actions,[]);
 assert.deepEqual(f.command(request),pending);assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,0);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');
},{native(){throw new Error('lost before-effect reply');}}));

test('an observed mount change of an empty category after native rename retains uncertainty',()=>{
 const lstat=fs.lstatSync;
 fixture(f=>{
  const categoryId=f.sql.prepare("SELECT id FROM categories WHERE relative_path='To'").get().id,preview=f.review('rename','Moved empty',categoryId).value;
  let result;
  try{result=f.apply(preview);}finally{fs.lstatSync=lstat;syncBuiltinESMExports();}
  assert.equal(result.value.outcome,'recoverable',JSON.stringify(result));assert.equal(f.sql.prepare('SELECT relative_path FROM categories WHERE id=?').get(categoryId).relative_path,'To');
  assert.equal(f.sql.prepare('SELECT destination_evidence FROM category_folder_operations').get().destination_evidence,null);
  assert.equal(existsSync(join(f.root,'Moved empty')),true);
 },{native(from,to){const result=renameNoReplace(from,to);if(result==='renamed'){fs.lstatSync=(path,...args)=>{const stat=lstat(path,...args);if(path===to&&typeof stat.dev==='bigint')stat.dev=777n;return stat;};syncBuiltinESMExports();}return result;}});
});

test('category preview refuses relocating another saved source root nested in a member project',()=>fixture(f=>{
 assert.equal(f.send({type:'workspace.create',name:'Nested source',rootPath:join(f.root,'From/Project')}).ok,true);
 const preview=f.review('rename','Renamed',f.categoryId);assert.equal(preview.ok,false,JSON.stringify(preview));
 assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_operations').get().n,0);assert.equal(existsSync(join(f.root,'Renamed')),false);
}));

test('category preview rejects a full-proof change seen between its two inventories',()=>{
 let armed=false,calls=0;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);if(!armed||!value.ok||path.split(/[\\/]/).at(-1)!=='From')return value;
  return ++calls<2?value:{...value,evidence:{...value.evidence,created:(BigInt(value.evidence.created)+1n).toString()}};};
 fixture(f=>{armed=true;const preview=f.review('rename','Renamed',f.categoryId);assert.equal(preview.ok,false,JSON.stringify(preview));assert.ok(calls>=2);assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_operations').get().n,0);},{reader});
});

test('category attestation restore retains original bindings, full evidence and feasible source generation',()=>fixture(f=>{
 f.sql.exec('UPDATE sources SET evidence_generation=5');
 const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
 assert.equal(f.command(request).value.outcome,'recoverable');const review=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId}).value;
 const completed=f.command({type:'workspace.recoverCategoryFolder',operationId:request.operationId,previewToken:review.previewToken,action:'complete_destination'});assert.equal(completed.value.outcome,'completed');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("UPDATE category_folder_attestations SET journal=json_set(journal,'$.requestedRelativePath','Different')"),
  db=>db.exec("UPDATE category_folder_attestations SET authorization=json_set(authorization,'$.category.evidence.created','999999999999')"),
  db=>db.exec("UPDATE category_folder_attestations SET authorization=json_set(authorization,'$.projects[0].observation.evidence.created','999999999999')"),
  db=>db.exec("UPDATE category_folder_attestations SET authorization=json_set(authorization,'$.binding.generation',999)"),
  db=>db.exec("UPDATE category_folder_attestations SET authorization=json_set(authorization,'$.binding.generation',1)"),
 ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.deepEqual(f.command(request),completed);
},{native(from,to){assert.equal(renameNoReplace(from,to),'renamed');throw new Error('lost effect reply');}}));

for(const lostScope of [false,true])test(`removing scoped category authority cannot downgrade ${lostScope?'lost-scope':'same-scope'} history to legacy recovery`,()=>fixture(f=>{
 const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};
 const pending=f.command(request);assert.equal(pending.value.outcome,'recoverable');
 if(lostScope){rmSync(join(f.directory,'installation-scope.json'));f.restart();const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.previewToken}).ok,true);}
 const triggers=f.sql.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='category_folder_operations'").all();for(const trigger of triggers)f.sql.exec(`DROP TRIGGER "${trigger.name}"`);f.sql.exec('UPDATE category_folder_operations SET authorization=NULL');for(const trigger of triggers)f.sql.exec(trigger.sql);
 const review=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId});assert.ok(!review.ok||review.value.previewToken===null,JSON.stringify(review));if(review.ok)assert.deepEqual(review.value.actions,[]);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM category_folder_attestations').get().n,0);assert.equal(f.query({type:'workspace.listCategoryFolderOperations'}).value.operations.length,1);assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');
},{native(){throw new Error('lost before-effect response');}}));

test('backup restore cannot relabel a scoped category recovery receipt as legacy by removing its original authorization',()=>fixture(f=>{
 const preview=f.review('rename','Renamed',f.categoryId).value,request={type:'workspace.applyCategoryFolder',operationId:randomUUID(),previewToken:preview.previewToken};assert.equal(f.command(request).value.outcome,'recoverable');
 const review=f.query({type:'workspace.previewCategoryFolderRecovery',operationId:request.operationId});assert.ok(review.value.actions.includes('keep_original'));
 const kept=f.command({type:'workspace.recoverCategoryFolder',operationId:request.operationId,previewToken:review.value.previewToken,action:'keep_original'});assert.equal(kept.value.outcome,'rejected');
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true);
 const downgraded=alteredSnapshot(exported.value.content,db=>{db.exec('UPDATE category_folder_operations SET authorization=NULL');db.exec("UPDATE category_folder_attestations SET journal=json_set(journal,'$.authorization',NULL)");});
 assert.equal(f.send({type:'data.restore',content:downgraded}).ok,false);assert.deepEqual(f.command(request),kept);assert.equal(readFileSync(join(f.root,'From/Project/sentinel'),'utf8'),'exact contents');assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
},{native(){throw new Error('lost before-effect response');}}));
