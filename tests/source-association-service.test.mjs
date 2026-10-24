import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {join,basename,dirname} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { openSettingsService } from '../dist/service/settings.mjs';
import { observeFolder } from '../src/service/folder-evidence.ts';

function fixture(run, mode = "direct", reader = observeFolder) {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), 'workspace-association-')));
  const root = join(directory,'source'), dbPath = join(directory,'data','settings.sqlite');
  mkdirSync(join(root,mode==='grouped'?'Category/Project':'Project'),{recursive:true});
  let service = openSettingsService(dbPath,undefined,undefined,undefined,undefined,undefined,reader);
  const created = service.handleCommand({type:'workspace.create', name:'Workspace',rootPath:root});
  assert.equal(created.ok,true,JSON.stringify(created));
  const workspaceId = created.value.workspaceId;
  const query = input => service.handleQuery({workspaceId,...input});
  const command = input => service.handleCommand({workspaceId,...input});
  const sql = new Database(dbPath);
  const cleanup=()=>{sql.close();service.close();rmSync(directory,{recursive:true,force:true});};
  let result;
  try {result=run({root,dbPath,sql,query,command,workspaceId,mode,get service(){return service;},restart(){service.close();service=openSettingsService(dbPath,undefined,undefined,undefined,undefined,undefined,reader);}});}
  catch(error){cleanup();throw error;}
  if(result instanceof Promise)return result.finally(cleanup);
  cleanup();
}
function discover(f) {
  const preview=f.query({type:'workspace.previewDiscovery',mode:f.mode});
  assert.equal(preview.ok,true,JSON.stringify(preview));
  assert.equal(preview.value.state,'ready',JSON.stringify(preview));
  const applied=f.command({type:'workspace.applyDiscovery',previewToken:preview.value.previewToken});
  assert.equal(applied.ok,true,JSON.stringify(applied));
  return applied.value;
}

test('enrolled source preserves project IDs and metadata across stored dev-only changes and restart',()=>fixture(f=>{
  const original=discover(f), id=original.projects[0].projectId;
  const property=f.command({type:'workspace.createProperty',name:'Note',propertyType:'text'});
  assert.equal(property.ok,true);
  assert.equal(f.command({type:'workspace.setTextValue',projectId:id,propertyId:property.value.snapshot.definitions[0].propertyId,value:'Keep'}).ok,true);
  f.sql.prepare("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')").run();
  f.sql.prepare("UPDATE projects SET native_identity=json_set(native_identity,'$.dev','999')").run();
  f.restart();
  const current=f.query({type:'workspace.listProjects'});
  assert.equal(current.ok,true,JSON.stringify(current));
  assert.equal(current.value.state,'ready');
  assert.equal(current.value.projects[0].projectId,id);
  assert.equal(f.sql.prepare('SELECT value FROM text_property_values').get().value,'Keep');
  assert.equal(JSON.parse(f.sql.prepare('SELECT native_identity FROM projects').get().native_identity).dev,'999');
}));

test('legacy dev control requires explicit root and separate project enrollment, with single-use tokens',()=>fixture(f=>{
  const original=discover(f), id=original.projects[0].projectId;
  f.sql.prepare('UPDATE sources SET durable_evidence=NULL').run();
  f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
  const before=f.query({type:'workspace.listProjects'});
  assert.equal(before.value.state,'association_review_required');
  const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]});
  assert.equal(root.ok,true,JSON.stringify(root));
  assert.equal(root.value.candidates[0].selected,false);
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.value.previewToken}).ok,true);
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);
  assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
  const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]});
  assert.equal(preview.ok,true,JSON.stringify(preview));
  assert.ok(preview.value.previewToken,JSON.stringify(preview));
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:preview.value.previewToken}).ok,true);
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,id);
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:preview.value.previewToken}).ok,false);
}));

test('fresh and legacy sources cannot dispatch unconverted filesystem consumers',()=>fixture(f=>{
  discover(f);
  const initial=readdirSync(f.root);
  const denied=f.query({type:'workspace.listProjectFiles',relativePath:'',projectId:f.query({type:'workspace.listProjects'}).value.projects[0].projectId});
  assert.equal(denied.ok,false);
  assert.match(denied.error.message,/safety update/);
  assert.deepEqual(readdirSync(f.root),initial);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM project_creation_operations').get().n,0);
}));

test('binding rejects stale configuration, restart and changed folder evidence without partial enrollment',()=>fixture(f=>{
  const original=discover(f), id=original.projects[0].projectId;
  f.sql.prepare('UPDATE sources SET durable_evidence=NULL').run();
  f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
  const mappings=[{kind:'project',id,relativePath:'Project'}];
  const review=()=>f.query({type:'workspace.previewSourceAssociation',mappings}).value;
  const first=review();assert.ok(first.previewToken);
  f.sql.prepare('UPDATE sources SET evidence_generation=evidence_generation+1').run();
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:first.previewToken}).ok,false);
  assert.equal(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence,null);
  const second=review();assert.ok(second.previewToken);f.restart();
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:second.previewToken}).ok,false);
  const third=review();assert.ok(third.previewToken);
  f.sql.exec("CREATE TRIGGER reject_binding BEFORE UPDATE OF durable_evidence ON projects BEGIN SELECT RAISE(ABORT,'injected storage failure'); END");
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:third.previewToken}).ok,false);
  assert.equal(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence,null);
  assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
}));

test('wrong volume and changed durable folder evidence remain distinct and cannot be rebound',()=>fixture(f=>{
  discover(f);
  const saved=f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence;
  const evidence=JSON.parse(saved);evidence.volume=evidence.provider==='apfs'?'10000000000000000000000000000000':'\\\\?\\Volume{10000000-0000-4000-8000-000000000000}\\';
  f.sql.prepare('UPDATE sources SET durable_evidence=?').run(JSON.stringify(evidence));
  assert.equal(f.query({type:'workspace.listProjects'}).value.state,'different_volume');
  assert.equal(f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value.previewToken,null);
  const changed={...JSON.parse(saved),fileId:evidence.provider==='apfs'?'999999999999999':'f'.repeat(32)};
  f.sql.prepare('UPDATE sources SET durable_evidence=?').run(JSON.stringify(changed));
  assert.equal(f.query({type:'workspace.listProjects'}).value.state,'root_identity_conflict');
  assert.equal(f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value.previewToken,null);
}));

test('lost installation scope requires review even when volume and folder evidence still match',()=>fixture(f=>{
  const original=discover(f),id=original.projects[0].projectId;
  for(const table of ['sources','projects']) f.sql.prepare(`UPDATE ${table} SET durable_evidence=json_set(durable_evidence,'$.scope','foreign-installation')`).run();
  const before=f.query({type:'workspace.listProjects'});
  assert.equal(before.value.state,'association_review_required');
  const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]}).value;
  assert.equal(preview.reason,'scope_unverified');assert.ok(preview.previewToken);
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:preview.previewToken}).ok,true);
  assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,id);
}));

test('ordinary discovery never persists synthetic unresolved state for unapproved legacy descendants',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const preview=f.query({type:'workspace.previewDiscovery'}).value;
 const applied=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
 assert.equal(applied.ok,true,JSON.stringify(applied));
 assert.equal(f.sql.prepare('SELECT association_state FROM projects').get().association_state,'active');
 const reviewed=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]}).value;
 assert.ok(reviewed.previewToken);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:reviewed.previewToken}).ok,true);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,id);
}));

test('cancel revokes backend authority and independent property edits do not invalidate explicit association consent',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const request={type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]};
 const first=f.query(request).value;
 assert.equal(f.command({type:'workspace.cancelSourceAssociation',previewToken:first.previewToken}).ok,true);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:first.previewToken}).ok,false);
 const second=f.query(request).value;
 assert.equal(f.command({type:'workspace.createProperty',name:'Independent',propertyType:'text'}).ok,true);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:second.previewToken}).ok,true);
}));

test('unsupported evidence retains names and values while folder authority stays unavailable',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare("UPDATE sources SET durable_evidence=json_set(durable_evidence,'$.version',999)").run();
 const current=f.query({type:'workspace.listProjects'});
 assert.equal(current.ok,true,JSON.stringify(current));
 assert.equal(current.value.state,'identity_unverified');
 assert.equal(current.value.retainedProjects[0].projectId,id);
 assert.equal(f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value.previewToken,null);
}));

test('explicit mapping to another eligible contained folder preserves logical identity without moving folders',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 mkdirSync(join(f.root,'Mapped folder'));
 const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Mapped folder'}]}).value;
 assert.ok(preview.previewToken,JSON.stringify(preview));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:preview.previewToken}).ok,true);
 const current=f.query({type:'workspace.listProjects'}).value;
 assert.equal(current.projects[0].projectId,id);assert.equal(current.projects[0].relativePath,'Mapped folder');
 assert.deepEqual(readdirSync(f.root),['Mapped folder','Project']);
}));

test('grouped projects require explicit category consent before enrollment and preserve logical parent links',()=>fixture(f=>{
 const original=discover(f),project=original.projects[0],category=original.categories[0];
 for(const table of ['sources','projects','categories'])f.sql.prepare(`UPDATE ${table} SET durable_evidence=NULL`).run();
 const child={kind:'project',id:project.projectId,relativePath:'Category/Project'},parent={kind:'category',id:category.categoryId,relativePath:'Category'};
 const insufficient=f.query({type:'workspace.previewSourceAssociation',mappings:[child]}).value;
 assert.equal(insufficient.previewToken,null);
 const complete=f.query({type:'workspace.previewSourceAssociation',mappings:[child,parent]}).value;
 assert.ok(complete.previewToken,JSON.stringify(complete));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:complete.previewToken}).ok,true);
 const current=f.query({type:'workspace.listProjects'}).value;
 assert.equal(current.projects[0].projectId,project.projectId);assert.equal(current.projects[0].categoryId,category.categoryId);
},'grouped'));

test('folder substitution after preview rejects the complete association transaction',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]}).value;
 rmSync(join(f.root,'Project'),{recursive:true});mkdirSync(join(f.root,'Project'));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.previewToken}).ok,false);
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
}));

test('every unconverted direct service and native entry point fails closed without filesystem effects',async()=>{
 // Keep the fixture synchronous: all gated functions reject synchronously before any native dispatch.
 fixture(f=>{
  discover(f);
  const names=['previewProjectArchiveRecovery','recoverProjectArchive',

   'listProjectFiles',
   ];
  const before=readdirSync(f.root);let dispatches=0;
  for(const name of names){const result=f.service.workspaces[name]({type:`workspace.${name}`,workspaceId:f.workspaceId},()=>{dispatches++;});assert.equal(result.ok,false,name);assert.match(result.error.message,/safety update/,name);}
  assert.equal(dispatches,0);assert.deepEqual(readdirSync(f.root),before);
  for(const table of ['project_creation_operations','project_rename_operations','project_category_move_operations','project_archive_operations','category_folder_operations','category_removal_operations']) assert.equal(f.sql.prepare(`SELECT count(*) n FROM ${table}`).get().n,0);
 });
});

test('immutable terminal creation retries remain readable offline while unfinished originals cannot execute',()=>fixture(f=>{
 discover(f);
 const source=f.sql.prepare('SELECT * FROM sources').get(),operationId='10000000-0000-4000-8000-000000000001',projectId='10000000-0000-4000-8000-000000000002';
 const insert=f.sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,category_id,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,archive_relative_path,stage)
 VALUES (?,?,?,?,?,'direct',?,NULL,?,'',?,?,?,'[]',NULL,'intent')`);
 insert.run(operationId,source.id,f.workspaceId,projectId,'Never created',source.discovery_revision,f.root,'Never created',source.applied_root_identity,source.applied_root_identity);
 const request={type:'workspace.createProject',operationId,name:'Never created',mode:'direct',expectedRevision:source.discovery_revision};
 const unfinished=f.sql.prepare('SELECT * FROM project_creation_operations').get();
 assert.equal(f.command(request).value.outcome,'recoverable');assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations').get(),unfinished);
 f.sql.prepare("UPDATE project_creation_operations SET stage='failed',problem='occupied' WHERE operation_id=?").run(operationId);
 const receipt=f.sql.prepare('SELECT * FROM project_creation_operations').get();
 rmSync(f.root,{recursive:true});
 const retried=f.command(request);assert.equal(retried.ok,true,JSON.stringify(retried));assert.equal(retried.value.outcome,'rejected');assert.equal(retried.value.problem,'occupied');
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations').get(),receipt);
 assert.equal(f.command({...request,name:'Changed payload'}).ok,false);
}));

test('valid IPC requests cannot bypass the gate and association cancellation revokes its token across transport',()=>fixture(async f=>{
 const {EventEmitter}=await import('node:events');
 const {startServiceProcess}=await import('../dist/service/entry.cjs');
 const {isServiceResponse}=await import('../src/contracts/service-protocol.ts');
 const current=discover(f),projectId=current.projects[0].projectId;
 class Port extends EventEmitter { sent=[];postMessage(message){this.sent.push(message);}start(){}close(){} }
 const parent=new Port(),port=new Port();
 startServiceProcess(parent,()=>f.service);
 parent.emit('message',{data:{type:'connect',databasePath:f.dbPath},ports:[port]});
 assert.ok(parent.sent.some(m=>m.type==='ready'));
 let id=0;
 const send=async input=>{
  const requestId=++id;port.emit('message',{data:{id:requestId,input:{workspaceId:f.workspaceId,...input}}});
  await new Promise(resolve=>setImmediate(resolve));
  const response=port.sent.find(m=>m.id===requestId);assert.ok(response,JSON.stringify(input));assert.equal(isServiceResponse(response),true);return response.result;
 };
 for(const input of [
  {type:'workspace.revealProject',projectId},
  {type:'workspace.openProjectFile',projectId,relativePath:'keep.txt'},
  {type:'workspace.revealProjectFile',projectId,relativePath:'keep.txt'},
  {type:'workspace.listProjectFiles',projectId,relativePath:''},
 ]){const denied=await send(input);assert.equal(denied.ok,false,JSON.stringify(input));assert.equal(denied.error.code,'identity_update_required');}
 assert.equal(port.sent.some(m=>m.type==='project.reveal.native'),false);assert.deepEqual(readdirSync(f.root),['Project']);
 const review=await send({type:'workspace.previewSourceAssociation',mappings:[]});assert.equal(review.ok,true);
 assert.equal((await send({type:'workspace.cancelSourceAssociation',previewToken:review.value.previewToken})).ok,true);
 assert.equal((await send({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken})).ok,false);
}));

test('legacy grouped category enrollment preserves legitimate dormant direct-project role history',()=>fixture(f=>{
 mkdirSync(join(f.root,'Project','Nested'));
 const direct=discover(f),dormantId=direct.projects[0].projectId;
 const grouped=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 const applied=f.command({type:'workspace.applyDiscovery',previewToken:grouped.previewToken});assert.equal(applied.ok,true,JSON.stringify(applied));
 const category=applied.value.categories[0],child=applied.value.projects[0];
 for(const table of ['sources','categories','projects'])f.sql.prepare(`UPDATE ${table} SET durable_evidence=NULL`).run();
 const mappings=[{kind:'category',id:category.categoryId,relativePath:'Project'},{kind:'project',id:child.projectId,relativePath:'Project/Nested'}];
 const review=f.query({type:'workspace.previewSourceAssociation',mappings}).value;assert.ok(review.previewToken,JSON.stringify(review));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.previewToken}).ok,true);
 const old=f.sql.prepare('SELECT * FROM projects WHERE id=?').get(dormantId);assert.equal(old.mode_inactive,1);assert.equal(old.durable_evidence,null);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,child.projectId);
}));

test('sufficient evidence for a different child folder reports changed identity without overwriting its logical record',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 rmSync(join(f.root,'Project'),{recursive:true});mkdirSync(join(f.root,'Project'));
 const current=f.query({type:'workspace.listProjects'}).value;
 assert.equal(current.state,'ready');assert.equal(current.retainedProjects[0].projectId,id);
 assert.equal(current.retainedProjects[0].resolution,'replaced');assert.equal(current.retainedProjects[0].identityReason,'folder_changed');
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;
 assert.equal(review.candidates[0].reason,'folder_changed');assert.equal(review.candidates[0].eligible,false);
 assert.equal(f.sql.prepare('SELECT association_state FROM projects').get().association_state,'active');
}));

test('a failure after the first mapping rolls back all evidence writes and publishes no committed event',()=>fixture(f=>{
 mkdirSync(join(f.root,'Other'));const current=discover(f);
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const mappings=['Project','Other'].map(path=>({kind:'project',id:current.projects.find(p=>p.relativePath===path).projectId,relativePath:path}));
 const review=f.query({type:'workspace.previewSourceAssociation',mappings}).value;assert.ok(review.previewToken);
 const events=[],stop=f.service.workspaces.subscribe(event=>events.push(event));
 f.sql.exec("CREATE TRIGGER second_mapping_failure BEFORE UPDATE OF durable_evidence ON projects WHEN OLD.relative_path='Other' BEGIN SELECT RAISE(ABORT,'injected second mapping failure'); END");
 try{assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.previewToken}).ok,false);assert.equal(f.sql.prepare('SELECT count(*) n FROM projects WHERE durable_evidence IS NOT NULL').get().n,0);assert.deepEqual(events,[]);}finally{stop();}
}));

test('explicit legacy mapping cannot steal a folder carrying another retained record evidence',()=>fixture(f=>{
 mkdirSync(join(f.root,'Other'));const current=discover(f);
 const project=current.projects.find(p=>p.relativePath==='Project'),other=current.projects.find(p=>p.relativePath==='Other');
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 // Preserve Other history but place its physical folder at a previously unknown path.
 renameSync(join(f.root,'Other'),join(f.root,'Moved other'));
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:project.projectId,relativePath:'Moved other'}]}).value;
 assert.equal(review.previewToken,null);
 assert.equal(f.sql.prepare('SELECT relative_path FROM projects WHERE id=?').get(other.projectId).relative_path,'Other');
}));

test('stable retained-project reads and independent property edits do not revoke legacy root review',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare('UPDATE sources SET durable_evidence=NULL').run();f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]}).value;
 assert.ok(preview.previewToken);
 assert.equal(f.query({type:'workspace.listProjects'}).ok,true);
 assert.equal(f.command({type:'workspace.createProperty',name:'Independent during root review',propertyType:'text'}).ok,true);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:preview.previewToken}).ok,true);
}));

test('background reconciliation enrolls a needed category with durable evidence while preserving project ownership',()=>fixture(f=>{
 const original=discover(f),projectId=original.projects[0].projectId;
 mkdirSync(join(f.root,'Needed'));renameSync(join(f.root,'Category','Project'),join(f.root,'Needed','Moved'));
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 const current=f.query({type:'workspace.listProjects'}).value;
 assert.equal(current.projects[0].projectId,projectId);assert.equal(current.projects[0].relativePath,'Needed/Moved');
 const category=current.categories.find(c=>c.relativePath==='Needed');assert.ok(category);assert.equal(current.projects[0].categoryId,category.categoryId);
 assert.ok(f.sql.prepare('SELECT durable_evidence FROM categories WHERE id=?').get(category.categoryId).durable_evidence);
 f.restart();assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
},'grouped'));


for(const renumbered of [false,true]) test(`background reconciliation cannot discard a legacy historical ownership conflict (renumbered=${renumbered})`,()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 const row=f.sql.prepare('SELECT * FROM projects WHERE id=?').get(id);
 f.sql.prepare("INSERT INTO projects (id,source_id,relative_path,native_identity,association_state) VALUES (?,?,?,?, 'replaced')")
  .run('10000000-0000-4000-8000-000000000001',row.source_id,'Historical',JSON.stringify({...JSON.parse(row.native_identity),birthtimeNs:String(BigInt(JSON.parse(row.native_identity).birthtimeNs)+1n)}));
 if(renumbered){
  f.sql.prepare("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')").run();
  f.sql.prepare("UPDATE projects SET native_identity=json_set(native_identity,'$.dev','999')").run();
 }
 renameSync(join(f.root,'Project'),join(f.root,'Moved'));
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 assert.equal(f.sql.prepare('SELECT relative_path FROM projects WHERE id=?').get(id).relative_path,'Project');
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);
}));


test('source binding cannot relocate an already verified record',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 renameSync(join(f.root,'Project'),join(f.root,'Moved'));
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Moved'}]}).value;
 assert.equal(review.previewToken,null);
 assert.equal(review.candidates.find(c=>c.id===id).eligible,false);
 assert.equal(f.sql.prepare('SELECT relative_path FROM projects WHERE id=?').get(id).relative_path,'Project');
}));


for(const renumbered of [false,true]) test(`grouped reconciliation retains historical category conflicts (renumbered=${renumbered})`,()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 const category=f.sql.prepare('SELECT * FROM categories').get();
 f.sql.prepare("INSERT INTO categories (id,source_id,relative_path,native_identity,association_state) VALUES (?,?,?,?, 'replaced')")
  .run('10000000-0000-4000-8000-000000000002',category.source_id,'Historical',category.native_identity);
 if(renumbered){
  f.sql.prepare("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')").run();
  for(const table of ['categories','projects'])f.sql.prepare(`UPDATE ${table} SET native_identity=json_set(native_identity,'$.dev','999')`).run();
 }
 renameSync(join(f.root,'Category'),join(f.root,'Moved'));
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 assert.equal(f.sql.prepare('SELECT relative_path FROM categories WHERE id=?').get(category.id).relative_path,'Category');
 assert.equal(f.sql.prepare('SELECT relative_path FROM projects WHERE id=?').get(id).relative_path,'Category/Project');
},'grouped'));

test('matching stale role triples cannot excuse a current creation-time conflict',()=>fixture(f=>{
 mkdirSync(join(f.root,'Project','Nested'));
 discover(f);
 const preview=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).ok,true);
 for(const table of ['categories','projects'])f.sql.prepare(`UPDATE ${table} SET native_identity=json_set(native_identity,'$.birthtimeNs','1') WHERE relative_path='Project'`).run();
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL WHERE mode_inactive=1').run();
 const before=f.sql.prepare('SELECT * FROM categories').all();
 renameSync(join(f.root,'Project'),join(f.root,'Moved'));
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM categories').all(),before);
}));

for(const failure of ['different_volume','unsupported','changed_during_commit','duplicate_folder_id']) test(`needed-category adoption rejects ${failure} evidence without partial state`,()=>{
 let moved=false,calls=0;
 const reader=(path,scope)=>{
  const observed=observeFolder(path,scope);
  if(!moved || basename(path)!=='Needed')return observed;
  if(failure==='unsupported')return {ok:false,reason:'unsupported'};
  if(failure==='duplicate_folder_id' && observed.ok){const root=observeFolder(dirname(path),scope);return root.ok?{...observed,evidence:root.evidence}:root;}
  if(observed.ok && (failure==='different_volume'||failure==='changed_during_commit'&&++calls>=3))return {...observed,evidence:{...observed.evidence,volume:'1234567890abcdef1234567890abcdef'}};
  return observed;
 };
 fixture(f=>{
  discover(f);
  mkdirSync(join(f.root,'Needed'));renameSync(join(f.root,'Category','Project'),join(f.root,'Needed','Moved'));moved=true;
  const before=f.sql.prepare('SELECT * FROM projects').all(),categories=f.sql.prepare('SELECT * FROM categories').all(),source=f.sql.prepare('SELECT * FROM sources').all();
  const result=f.command({type:'workspace.refreshSource'});
  assert.equal(result.ok,failure!=='changed_during_commit',JSON.stringify(result));
  assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
  assert.deepEqual(f.sql.prepare('SELECT * FROM categories').all(),categories);
  assert.deepEqual(f.sql.prepare('SELECT * FROM sources').all(),source);
 },'grouped',reader);
});


test('binding rolls back unexpected association-state changes inside the transaction',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]}).value;
 f.sql.exec("CREATE TRIGGER injected_state_change AFTER UPDATE OF durable_evidence ON projects BEGIN UPDATE projects SET association_state='missing' WHERE id=NEW.id; END");
 const before=f.sql.prepare('SELECT * FROM projects').all();
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:preview.previewToken}).ok,false);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
}));


test('durable alias veto cannot prove dormant role history when creation evidence differs',()=>fixture(f=>{
 mkdirSync(join(f.root,'Project','Nested'));discover(f);
 const preview=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).ok,true);
 const dormant=f.sql.prepare('SELECT * FROM projects WHERE mode_inactive=1').get();
 const evidence=JSON.parse(dormant.durable_evidence);
 f.sql.prepare("UPDATE projects SET durable_evidence=?,native_identity=json_set(native_identity,'$.dev','999','$.birthtimeNs','1') WHERE id=?")
  .run(JSON.stringify({...evidence,created:String(BigInt(evidence.created)+1n)}),dormant.id);
 const before=f.sql.prepare('SELECT * FROM categories').all();
 renameSync(join(f.root,'Project'),join(f.root,'Moved'));
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM categories').all(),before);
}));


test('root-only review cannot accept duplicate root and descendant durable IDs',()=>{
 let duplicate=false;
 fixture(f=>{
  discover(f);f.sql.prepare('UPDATE sources SET durable_evidence=NULL').run();duplicate=true;
  const preview=f.query({type:'workspace.previewSourceAssociation',mappings:[]});
  assert.equal(preview.ok,true);assert.equal(preview.value.previewToken,null);
  assert.equal(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence,null);
 },'direct',(path,scope)=>{
  const current=observeFolder(path,scope);
  if(!duplicate||basename(path)!=='Project'||!current.ok)return current;
  const root=observeFolder(dirname(path),scope);
  return root.ok?{...current,evidence:root.evidence}:root;
 });
});


for(const stale of [false,true]) test(`legacy role after device renumbering needs exact original relationship and unchanged creation (stale=${stale})`,()=>fixture(f=>{
 mkdirSync(join(f.root,'Project','Nested'));discover(f);
 const preview=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).ok,true);
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL WHERE mode_inactive=1').run();
 f.sql.prepare("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')").run();
 for(const table of ['categories','projects'])f.sql.prepare(`UPDATE ${table} SET native_identity=json_set(native_identity,'$.dev','999')`).run();
 if(stale)f.sql.prepare("UPDATE projects SET native_identity=json_set(native_identity,'$.birthtimeNs','1') WHERE mode_inactive=1").run();
 const before=f.sql.prepare('SELECT * FROM categories').all();
 renameSync(join(f.root,'Project'),join(f.root,'Moved'));
 assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM categories').all(),stale?before:before.map(row=>({...row,relative_path:'Moved'})));
}));


test('an existing unconfigured source without volume evidence cannot bypass explicit root review',()=>fixture(f=>{
 const saved=f.sql.prepare('SELECT * FROM sources').get();assert.equal(saved.discovery_mode,null);assert.equal(saved.applied_root_identity,null);
 f.sql.prepare('UPDATE sources SET durable_evidence=NULL').run();f.restart();
 const sibling=f.service.handleCommand({type:'workspace.create',rootPath:f.root,name:'Reused source'});assert.equal(sibling.ok,true);
 const review=f.query({type:'workspace.previewDiscovery'});assert.equal(review.ok,true);
 assert.equal(review.value.state,'association_review_required');assert.equal(review.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence,null);
 const binding=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.ok(binding.value.previewToken);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:binding.value.previewToken}).ok,true);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM projects').get().n,0);
 assert.equal(f.query({type:'workspace.previewDiscovery'}).value.state,'ready');
}));


test('a second source cannot enroll a duplicate durable root under a distinct locator',()=>{
 let firstRoot;
 fixture(f=>{
  firstRoot=f.root;
  const other=join(f.root,'..','other');mkdirSync(other);
  const before=f.sql.prepare('SELECT * FROM sources').all();
  const duplicate=f.service.handleCommand({type:'workspace.create',name:'Duplicate root',rootPath:other});
  assert.equal(duplicate.ok,false);assert.equal(duplicate.error.code,'invalid_input');
  assert.deepEqual(f.sql.prepare('SELECT * FROM sources').all(),before);
 },'direct',(path,scope)=>{
  const current=observeFolder(path,scope);
  if(!firstRoot||basename(path)!=='other'||!current.ok)return current;
  const original=observeFolder(firstRoot,scope);return original.ok?{...current,evidence:original.evidence}:original;
 });
});


for(const enrolled of [false,true]) test(`competing retained source roots block binding and continuity (enrolled=${enrolled})`,()=>{
 let root;
 fixture(f=>{
  root=f.root;const first=discover(f),id=first.projects[0].projectId;
  const other=join(f.root,'..','other');mkdirSync(other);
  const source=f.sql.prepare('SELECT * FROM sources').get();
  f.sql.prepare('INSERT INTO sources (id,canonical_root,durable_evidence) VALUES (?,?,?)')
   .run('20000000-0000-4000-8000-000000000001',other,enrolled?source.durable_evidence:null);
  if(!enrolled)f.sql.prepare('UPDATE sources SET durable_evidence=NULL').run();
  const before=f.sql.prepare('SELECT * FROM sources ORDER BY id').all(),projects=f.sql.prepare('SELECT * FROM projects').all();
  const review=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.equal(review.ok,true);assert.equal(review.value.previewToken,null);
  const current=f.query({type:'workspace.listProjects'});assert.equal(current.ok,true);assert.equal(current.value.state,'changed');
  assert.equal(current.value.projects.length,0);assert.equal(current.value.retainedProjects[0].projectId,id);
  assert.equal(f.command({type:'workspace.refreshSource'}).ok,true);
  assert.deepEqual(f.sql.prepare('SELECT * FROM sources ORDER BY id').all(),before);
  assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),projects);
 },'direct',(path,scope)=>{
  const current=observeFolder(path,scope);
  if(!root||basename(path)!=='other'||!current.ok)return current;
  const original=observeFolder(root,scope);return original.ok?{...current,evidence:original.evidence}:original;
 });
});

test('macOS non-symlink Data-volume alias cannot create a second enrolled source',{skip:process.platform!=='darwin'},()=>fixture(f=>{
 const alias=`/System/Volumes/Data${f.root}`;
 assert.notEqual(realpathSync(alias),f.root);
 const duplicate=f.service.handleCommand({type:'workspace.create',name:'Alias source',rootPath:alias});
 assert.equal(duplicate.ok,false);assert.equal(duplicate.error.code,'invalid_input');
 assert.equal(f.sql.prepare('SELECT count(*) n FROM sources').get().n,1);
}));


test('root consent and clearing exclusions cannot enroll or reactivate an excluded legacy project',()=>fixture(f=>{
 const original=discover(f),id=original.projects[0].projectId;
 const excluded=f.query({type:'workspace.previewDiscovery',excludedRelativePaths:['Project']}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:excluded.previewToken}).ok,true);
 f.sql.prepare('UPDATE projects SET durable_evidence=NULL').run();
 const before=f.sql.prepare('SELECT * FROM projects').all();assert.equal(before[0].association_state,'excluded');
 const mapping=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id,relativePath:'Project'}]});
 assert.equal(mapping.value.previewToken,null);
 const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.previewToken}).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
 const clear=f.query({type:'workspace.previewDiscovery',excludedRelativePaths:[]}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:clear.previewToken}).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);
 assert.equal(f.query({type:'workspace.listProjects'}).value.retainedProjects[0].projectId,id);
}));

for(const contradictory of [false,true])test(`mixed legacy enrollment respects ${contradictory?'contradictory':'matching'} durable dormant-role evidence with equal native triples`,()=>fixture(f=>{
 mkdirSync(join(f.root,'Project','Nested'));const direct=discover(f);
 const preview=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 const grouped=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});assert.equal(grouped.ok,true);
 const dormantId=direct.projects[0].projectId;
 const old=JSON.parse(f.sql.prepare('SELECT durable_evidence FROM projects WHERE id=?').get(dormantId).durable_evidence);
 for(const table of ['sources','categories','projects'])f.sql.prepare(`UPDATE ${table} SET durable_evidence=NULL`).run();
 f.sql.prepare('UPDATE projects SET durable_evidence=? WHERE id=?').run(JSON.stringify(contradictory?{...old,created:String(BigInt(old.created)+1n)}:old),dormantId);
 const mappings=[{kind:'category',id:grouped.value.categories[0].categoryId,relativePath:'Project'},
  {kind:'project',id:grouped.value.projects[0].projectId,relativePath:'Project/Nested'}];
 const before=['sources','categories','projects'].map(table=>f.sql.prepare(`SELECT * FROM ${table}`).all());
 const review=f.query({type:'workspace.previewSourceAssociation',mappings});assert.equal(review.ok,true);
 assert.equal(!!review.value.previewToken,!contradictory,JSON.stringify(review));
 assert.equal(review.value.candidates.find(c=>c.kind==='category').eligible,!contradictory);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken}).ok,!contradictory);
 if(contradictory)assert.deepEqual(['sources','categories','projects'].map(table=>f.sql.prepare(`SELECT * FROM ${table}`).all()),before);
}));

for(const conflictingScope of [false,true])test(`reviewed grouped scope renewal ${conflictingScope?'rejects conflicting':'preserves matching'} dormant role history`,()=>fixture(f=>{
 mkdirSync(join(f.root,'Project','Nested'));const direct=discover(f);
 const preview=f.query({type:'workspace.previewDiscovery',mode:'grouped'}).value;
 const grouped=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});assert.equal(grouped.ok,true);
 for(const table of ['sources','categories','projects'])f.sql.prepare(`UPDATE ${table} SET durable_evidence=json_set(durable_evidence,'$.scope','lost-installation')`).run();
 if(conflictingScope)f.sql.prepare("UPDATE projects SET durable_evidence=json_set(durable_evidence,'$.scope','another-installation') WHERE id=?").run(direct.projects[0].projectId);
 const mappings=[{kind:'category',id:grouped.value.categories[0].categoryId,relativePath:'Project'},
  {kind:'project',id:grouped.value.projects[0].projectId,relativePath:'Project/Nested'}];
 const dormantBefore=f.sql.prepare('SELECT * FROM projects WHERE id=?').get(direct.projects[0].projectId);
 const review=f.query({type:'workspace.previewSourceAssociation',mappings});assert.equal(review.ok,true);
 assert.equal(!!review.value.previewToken,!conflictingScope,JSON.stringify(review));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken}).ok,!conflictingScope);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects WHERE id=?').get(direct.projects[0].projectId),dormantBefore);
 if(!conflictingScope){f.restart();assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,grouped.value.projects[0].projectId);}
}));

test('compiled recovery IPC enrolls only the reviewed retained project and exposes no private proof',()=>fixture(async f=>{
 const {EventEmitter}=await import('node:events'),{startServiceProcess}=await import('../dist/service/entry.cjs');
 const {isServiceResponse}=await import('../src/contracts/service-protocol.ts');
 const projectId=discover(f).projects[0].projectId;
 renameSync(join(f.root,'Project'),join(dirname(f.root),'away'));
 const missing=f.query({type:'workspace.previewDiscovery',mode:'direct'}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:missing.previewToken}).ok,true);
 renameSync(join(dirname(f.root),'away'),join(f.root,'Target'));
 class Port extends EventEmitter {sent=[];postMessage(message){this.sent.push(message);}start(){}close(){}}
 const parent=new Port(),port=new Port();startServiceProcess(parent,()=>f.service);
 parent.emit('message',{data:{type:'connect',databasePath:f.dbPath},ports:[port]});assert.ok(parent.sent.some(message=>message.type==='ready'));
 let id=0;
 const send=async input=>{
  const requestId=++id;port.emit('message',{data:{id:requestId,input:{workspaceId:f.workspaceId,...input}}});
  await new Promise(resolve=>setImmediate(resolve));
  const response=port.sent.find(message=>message.id===requestId);assert.ok(response);assert.equal(isServiceResponse(response),true);
  const encoded=JSON.stringify(response);for(const key of [f.root,'durableEvidence','nativeIdentity','evidenceGeneration','authorization'])assert.equal(encoded.includes(key),false,key);
  return response.result;
 };
 const preview=await send({type:'workspace.previewProjectRecovery',projectId});assert.equal(preview.ok,true,JSON.stringify(preview));
 const applied=await send({type:'workspace.reassociateProject',projectId,previewToken:preview.value.previewToken,relativePath:'Target'});
 assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(applied.value.projects[0].projectId,projectId);assert.equal(applied.value.projects[0].relativePath,'Target');
 const replay=await send({type:'workspace.reassociateProject',projectId,previewToken:preview.value.previewToken,relativePath:'Target'});assert.equal(replay.error.code,'stale_preview');
 assert.equal(port.sent.some(message=>message.type==='project.reveal.native'),false);assert.ok(f.sql.prepare('SELECT durable_evidence FROM projects WHERE id=?').get(projectId).durable_evidence);
}));
