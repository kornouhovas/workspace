import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { openSettingsService } from '../dist/service/settings.mjs';

function fixture(run, mode = "direct") {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'workspace-association-')));
  const root = join(directory,'source'), dbPath = join(directory,'data','settings.sqlite');
  mkdirSync(join(root,mode==='grouped'?'Category/Project':'Project'),{recursive:true});
  let service = openSettingsService(dbPath);
  const created = service.handleCommand({type:'workspace.create', name:'Workspace',rootPath:root});
  assert.equal(created.ok,true,JSON.stringify(created));
  const workspaceId = created.value.workspaceId;
  const query = input => service.handleQuery({workspaceId,...input});
  const command = input => service.handleCommand({workspaceId,...input});
  const sql = new Database(dbPath);
  const cleanup=()=>{sql.close();service.close();rmSync(directory,{recursive:true,force:true});};
  let result;
  try {result=run({root,dbPath,sql,query,command,workspaceId,mode,get service(){return service;},restart(){service.close();service=openSettingsService(dbPath);}});}
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
  const denied=f.command({type:'workspace.createProject',operationId:'00000000-0000-4000-8000-000000000001',expectedRevision:1,name:'Unsafe',categoryId:null});
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
  const names=['previewProjectArchive','applyProjectArchive','previewProjectArchiveRecovery','recoverProjectArchive','previewArchiveLocation','applyArchiveLocation',
   'previewCategoryRemovalRecovery','recoverCategoryRemoval','applyCategoryRemoval','previewCategoryRemoval','previewCategoryFolder','applyCategoryFolder','previewCategoryFolderRecovery','recoverCategoryFolder',
   'moveProjectCategory','previewProjectCategoryMoveRecovery','recoverProjectCategoryMove','renameProject','previewProjectRenameRecovery','recoverProjectRename','listProjectFiles',
   'createProject','previewProjectCreationRecovery','recoverProjectCreation','previewProjectRecovery','reassociateProject'];
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
 assert.equal(f.command(request).ok,false);assert.deepEqual(f.sql.prepare('SELECT * FROM project_creation_operations').get(),unfinished);
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
  {type:'workspace.createProject',operationId:'20000000-0000-4000-8000-000000000001',mode:'direct',expectedRevision:current.revision,name:'Must not exist'},
  {type:'workspace.renameProject',operationId:'20000000-0000-4000-8000-000000000002',expectedRevision:current.revision,projectId,name:'Must not move'},
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
