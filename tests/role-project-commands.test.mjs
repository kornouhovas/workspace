import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,existsSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {alteredSnapshot} from './support/mutate-application-snapshot.mjs';
import {openSettingsService} from '../dist/service/settings.mjs';
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
function fixture(run,options={}){
  const directory=mkdtempSync(join(tmpdir(),'role-commands-')),root=join(directory,'Root'),database=join(directory,'data','workspace.sqlite');
  for(const path of ['Clients/Team/App','Work/Urgent/Task','Destinations/Ready','Archive/cpp','RootApp','Work/Team/GroupedTask'])mkdirSync(join(root,path),{recursive:true});
  writeFileSync(join(root,'Clients/Team/App','sentinel'),'Exact project bytes');
  const open=()=>openSettingsService(database,undefined,undefined,undefined,options.filesystem,options.native,options.reader);
  let app=open();
  try{
    const workspace=value(app.handleCommand({type:'workspace.create',name:'First',rootPath:root,initialize:'status'}));
    const query=input=>value(app.handleQuery({workspaceId:workspace.workspaceId,...input}));
    const command=input=>value(app.handleCommand({workspaceId:workspace.workspaceId,...input}));
    const roles=[{relativePath:'RootApp',role:'project'},{relativePath:'RootApp/Saved',role:'group'},{relativePath:'Work/Team',role:'group'},{relativePath:'Clients',role:'group'},{relativePath:'Clients/Team',role:'group'},{relativePath:'Work/Urgent',role:'status'},{relativePath:'Destinations',role:'group'},{relativePath:'Destinations/Ready',role:'status'}];
    const preview=query({type:'workspace.previewDiscovery',folderRoles:roles});
    const list=command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
    run({root,database,workspace,query,command,list,roles,get app(){return app;},restart(){app.close();app=open();}});
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
}

test('rename preserves a deeply nested no-status project, metadata and file bytes through restart',()=>fixture(f=>{
  const project=f.list.projects.find(project=>project.relativePath==='Clients/Team/App');
  const property=f.command({type:'workspace.createProperty',name:'Notes',propertyType:'text'});
  f.command({type:'workspace.setTextValue',projectId:project.projectId,propertyId:property.propertyId,value:'Preserved notes'});
  const request={type:'workspace.renameProject',projectId:project.projectId,operationId:crypto.randomUUID(),name:'Renamed',expectedRevision:f.list.revision};
  const result=f.command(request);assert.equal(result.outcome,'completed',JSON.stringify(result));
  assert.equal(result.project.relativePath,'Clients/Team/Renamed');assert.equal(result.project.categoryId,null);
  assert.equal(readFileSync(join(f.root,'Clients/Team/Renamed','sentinel'),'utf8'),'Exact project bytes');assert.equal(existsSync(join(f.root,'Clients/Team/App')),false);
  f.restart();assert.equal(f.query({type:'workspace.listProjects'}).projects.find(row=>row.projectId===project.projectId).relativePath,'Clients/Team/Renamed');
  assert.equal(f.query({type:'workspace.listTextProperties'}).values.find(row=>row.projectId===project.projectId).value,'Preserved notes');
  assert.equal(f.command(request).outcome,'completed');
}));

for (const parentRelativePath of ['Clients/Team','Work/Urgent','']) test(`create explicitly in role parent ${parentRelativePath || '(root)'} and retain placement after discovery`,()=>fixture(f=>{
  const result=f.command({type:'workspace.createProject',operationId:crypto.randomUUID(),name:'Created',mode:'grouped',parentRelativePath,expectedRevision:f.list.revision});
  assert.equal(result.outcome,'completed',JSON.stringify(result));
  const relativePath=parentRelativePath ? `${parentRelativePath}/Created` : 'Created';
  assert.equal(result.project.relativePath,relativePath);
  assert.equal(result.project.categoryId,parentRelativePath==='Work/Urgent' ? f.list.categories.find(c=>c.relativePath==='Work/Urgent').categoryId : null);
  f.restart();
  const preview=f.query({type:'workspace.previewDiscovery'});
  const list=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
  assert.equal(list.projects.find(p=>p.projectId===result.project.projectId)?.relativePath,relativePath);
}));

for(const parentRelativePath of ['Clients','Destinations/Ready',''])test(`move no-status project explicitly to ${parentRelativePath||'(root)'}`,()=>fixture(f=>{
  const project=f.list.projects.find(p=>p.relativePath==='Clients/Team/App');
  const request={type:'workspace.moveProjectCategory',projectId:project.projectId,operationId:crypto.randomUUID(),parentRelativePath,expectedRevision:f.list.revision};
  const result=f.command(request);assert.equal(result.outcome,'completed',JSON.stringify(result));
  const relativePath=parentRelativePath?`${parentRelativePath}/App`:'App';
  assert.equal(result.project.relativePath,relativePath);assert.equal(result.project.categoryId,parentRelativePath==='Destinations/Ready'?f.list.categories.find(c=>c.relativePath===parentRelativePath).categoryId:null);
  assert.equal(readFileSync(join(f.root,relativePath,'sentinel'),'utf8'),'Exact project bytes');
  f.restart();assert.equal(f.command(request).outcome,'completed');
  const preview=f.query({type:'workspace.previewDiscovery'}),list=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
  assert.equal(list.projects.find(p=>p.projectId===project.projectId)?.relativePath,relativePath);
}));

for(const path of ['Clients/Team/App','Work/Urgent/Task','RootApp','Work/Team/GroupedTask'])test(`archive and restore ${path} retains nearest status through restart`,()=>fixture(f=>{
  const location=f.query({type:'workspace.previewArchiveLocation',relativePath:'Stored'});
  assert.deepEqual(location.blockers,[]);
  f.command({type:'workspace.applyArchiveLocation',operationId:crypto.randomUUID(),previewToken:location.previewToken});
  const project=f.list.projects.find(p=>p.relativePath===path);
  const preview=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'archive',name:null,createParent:false});assert.deepEqual(preview.blockers,[]);
  const archived=f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:preview.previewToken});assert.equal(archived.operation.stage,'completed',JSON.stringify(archived));
  f.restart();assert.equal(f.query({type:'workspace.listArchivedProjects'}).projects.find(p=>p.projectId===project.projectId).originalRelativePath,path);
  assert.equal(f.query({type:'workspace.listProjectFiles',projectId:project.projectId,relativePath:''}).outcome,'listed');
  const restore=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'restore',name:null,createParent:false});assert.deepEqual(restore.blockers,[]);
  assert.equal(f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:restore.previewToken}).operation.stage,'completed');
  f.restart();const row=f.query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId);assert.equal(row.relativePath,path);assert.equal(row.categoryId,project.categoryId);
}));

function setArchive(f){const preview=f.query({type:'workspace.previewArchiveLocation',relativePath:'Stored'});assert.deepEqual(preview.blockers,[]);f.command({type:'workspace.applyArchiveLocation',operationId:crypto.randomUUID(),previewToken:preview.previewToken});}
function archive(f,projectId){const preview=f.query({type:'workspace.previewProjectArchive',projectId,action:'archive',name:null,createParent:false});assert.deepEqual(preview.blockers,[]);assert.equal(f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:preview.previewToken}).operation.stage,'completed');}
function restore(f,projectId,name=null){const preview=f.query({type:'workspace.previewProjectArchive',projectId,action:'restore',name,createParent:false});assert.deepEqual(preview.blockers,[],JSON.stringify(preview));return f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:preview.previewToken});}
test('alternative restore rebases a root project and its saved descendant overrides',()=>fixture(f=>{
 setArchive(f);const project=f.list.projects.find(p=>p.relativePath==='RootApp');archive(f,project.projectId);f.restart();
 assert.equal(restore(f,project.projectId,'Restored').operation.stage,'completed');f.restart();
 const preview=f.query({type:'workspace.previewDiscovery'}),list=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
 assert.equal(list.projects.find(p=>p.projectId===project.projectId)?.relativePath,'Restored');
 const tree=f.query({type:'workspace.getFolderChildren',parentRelativePath:''});assert.ok(tree.folderRoles.some(r=>r.relativePath==='Restored/Saved'&&r.role==='group'));
}));
for(const from of ['group','status'])test(`restore uses current nearest status after ${from} role changes`,()=>fixture(f=>{
 setArchive(f);const project=f.list.projects.find(p=>p.relativePath=== (from==='group'?'Clients/Team/App':'Work/Team/GroupedTask'));
 archive(f,project.projectId);
 const path=from==='group'?'Clients/Team':'Work';const roles=f.roles.filter(r=>r.relativePath!==path).concat({relativePath:path,role:from==='group'?'status':'group'});
 const preview=f.query({type:'workspace.previewDiscovery',folderRoles:roles});f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
 assert.equal(restore(f,project.projectId).operation.stage,'completed');f.restart();
 const list=f.query({type:'workspace.listProjects'}),row=list.projects.find(p=>p.projectId===project.projectId);assert.ok(row,JSON.stringify(list));
 assert.equal(row.categoryId,from==='group'?list.categories.find(c=>c.relativePath===path).categoryId:null);
}));
test('restore rejects a conflicting saved destination role before changing files',()=>fixture(f=>{
 setArchive(f);const project=f.list.projects.find(p=>p.relativePath==='RootApp');archive(f,project.projectId);
 const preview=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'restore',name:'Clients',createParent:false});
 assert.equal(preview.previewToken,null);assert.ok(preview.blockers.includes('reserved_destination'));assert.equal(existsSync(join(f.root,'Stored/RootApp')),true);
}));

for(const kind of ['creation','rename','move'])test(`interrupted deep role ${kind} recovers only through fresh explicit review`,()=>fixture(f=>{
 const sql=new Database(f.database);
 try{
  const project=f.list.projects.find(p=>p.relativePath==='Clients/Team/App'),operationId=crypto.randomUUID();
  sql.exec(kind==='creation'?"CREATE TRIGGER interrupt_command BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END":"CREATE TRIGGER interrupt_command BEFORE UPDATE OF relative_path ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const request=kind==='creation'?{type:'workspace.createProject',operationId,name:'Created',mode:'grouped',parentRelativePath:'Clients/Team',expectedRevision:f.list.revision}:kind==='rename'?{type:'workspace.renameProject',operationId,projectId:project.projectId,name:'Renamed',expectedRevision:f.list.revision}:{type:'workspace.moveProjectCategory',operationId,projectId:project.projectId,parentRelativePath:'Destinations/Ready',expectedRevision:f.list.revision};
  const pending=f.command(request);assert.equal(pending.outcome,'recoverable',JSON.stringify(pending));sql.exec('DROP TRIGGER interrupt_command');f.restart();assert.equal(f.command(request).outcome,'recoverable');
  const suffix=kind==='creation'?'ProjectCreation':kind==='rename'?'ProjectRename':'ProjectCategoryMove';
  const preview=f.query({type:`workspace.preview${suffix}Recovery`,operationId});assert.deepEqual(preview.actions,[kind==='creation'?'complete_recorded':'complete_destination'],JSON.stringify(preview));
  const completed=f.command({type:`workspace.recover${suffix}`,operationId,previewToken:preview.previewToken,action:preview.actions[0]});assert.equal(completed.outcome,'completed',JSON.stringify(completed));
  const content=value(f.app.handleQuery({type:'data.export'})).content;
  const table=kind==='creation'?'project_creation_operations':kind==='rename'?'project_rename_operations':'project_category_move_operations';
  const attestations=kind==='creation'?'project_creation_attestations':kind==='rename'?'project_rename_attestations':'project_category_move_attestations';
  const authority=kind==='move'?'original_authorization':'authorization';
  for(const mutate of [
   db=>db.exec(`UPDATE ${table} SET target_folder_roles='[]'`),
   db=>db.exec(`UPDATE ${table} SET ${authority}=json_set(${authority},'$.version',99)`),
   db=>db.exec(`UPDATE ${attestations} SET ${authority}=json_set(${authority},'$.ancestors[1].observation.evidence.created','999999999')`),
   db=>db.exec(`UPDATE ${attestations} SET journal=json_set(journal,'$.folderRoles','[]')`),
  ])assert.equal(f.app.handleCommand({type:'data.restore',content:alteredSnapshot(content,mutate)}).ok,false);
  assert.equal(f.app.handleCommand({type:'data.restore',content}).ok,true);
  f.restart();assert.equal(f.command(request).outcome,'completed');
 }finally{sql.close();}
}));

for(const kind of ['rename','move'])test(`${kind} preserves explicit root project and descendant roles`,()=>fixture(f=>{
 const project=f.list.projects.find(p=>p.relativePath==='RootApp');
 const request={operationId:crypto.randomUUID(),projectId:project.projectId,expectedRevision:f.list.revision,...(kind==='rename'?{type:'workspace.renameProject',name:'Renamed'}:{type:'workspace.moveProjectCategory',parentRelativePath:'Clients/Team'})};
 const result=f.command(request);assert.equal(result.outcome,'completed',JSON.stringify(result));f.restart();
 const preview=f.query({type:'workspace.previewDiscovery'}),list=f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});assert.equal(list.projects.find(p=>p.projectId===project.projectId)?.relativePath,result.project.relativePath);
 const tree=f.query({type:'workspace.getFolderChildren',parentRelativePath:''});assert.ok(tree.folderRoles.some(r=>r.relativePath===`${result.project.relativePath}/Saved`));
}));

test('an existing direct archive remains restorable after first role configuration',()=>{
 const directory=mkdtempSync(join(tmpdir(),'role-legacy-archive-')),root=join(directory,'Root'),database=join(directory,'app.sqlite');mkdirSync(join(root,'App'),{recursive:true});let app=openSettingsService(database);
 try{
  const workspace=value(app.handleCommand({type:'workspace.create',rootPath:root,name:'Before'}));
  const query=input=>value(app.handleQuery({workspaceId:workspace.workspaceId,...input})),command=input=>value(app.handleCommand({workspaceId:workspace.workspaceId,...input}));
  const discovery=query({type:'workspace.previewDiscovery',mode:'direct'});command({type:'workspace.applyDiscovery',previewToken:discovery.previewToken});
  const list=query({type:'workspace.listProjects'}),project=list.projects[0],f={query,command};setArchive(f);archive(f,project.projectId);
  const preview=query({type:'workspace.previewDiscovery',folderRoles:[]});assert.ok(preview.previewToken,JSON.stringify(preview));command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
  app.close();app=openSettingsService(database);
  assert.equal(restore(f,project.projectId).operation.stage,'completed');
  const row=query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId);assert.equal(row.relativePath,'App');assert.equal(row.categoryId,null);
 }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

for(const limit of ['depth','count'])test(`derived role ${limit} overflow rejects before filesystem effects`,()=>fixture(f=>{
 const roles=limit==='depth'?f.roles.concat({relativePath:'RootApp/'+Array(63).fill('Nested').join('/'),role:'group'}):Array.from({length:10000},(_,index)=>({relativePath:`Unused${index}`,role:'group'}));
 const preview=f.query({type:'workspace.previewDiscovery',folderRoles:roles});f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
 const list=f.query({type:'workspace.listProjects'});
 const request=limit==='depth'?{type:'workspace.moveProjectCategory',projectId:list.projects.find(p=>p.relativePath==='RootApp').projectId,parentRelativePath:'Clients/Team'}:{type:'workspace.createProject',mode:'grouped',name:'Created',parentRelativePath:''};
 const result=f.command({...request,operationId:crypto.randomUUID(),expectedRevision:list.revision});assert.equal(result.outcome,'rejected');assert.equal(result.problem,'reserved_destination');assert.equal(existsSync(join(f.root,'RootApp')),true);assert.equal(existsSync(join(f.root,'Created')),false);
}));

test('recovery refuses replaced intermediate Group while the final parent and project remain the same',()=>fixture(f=>{
 const sql=new Database(f.database);
 try{
  sql.exec("CREATE TRIGGER interrupt_command BEFORE UPDATE OF relative_path ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const project=f.list.projects.find(p=>p.relativePath==='Clients/Team/App'),operationId=crypto.randomUUID();
  assert.equal(f.command({type:'workspace.moveProjectCategory',projectId:project.projectId,operationId,parentRelativePath:'Destinations/Ready',expectedRevision:f.list.revision}).outcome,'recoverable');
  sql.exec('DROP TRIGGER interrupt_command');
  renameSync(join(f.root,'Destinations'),join(f.root,'OldDestinations'));mkdirSync(join(f.root,'Destinations'));renameSync(join(f.root,'OldDestinations/Ready'),join(f.root,'Destinations/Ready'));f.restart();
  const preview=f.query({type:'workspace.previewProjectCategoryMoveRecovery',operationId});assert.deepEqual(preview.actions,[]);assert.equal(preview.previewToken,null);
  assert.equal(readFileSync(join(f.root,'Destinations/Ready/App/sentinel'),'utf8'),'Exact project bytes');
 }finally{sql.close();}
}));

for(const path of ['Clients/Team/App','Work/Team/GroupedTask'])test(`restore explicitly recreates missing role parents for ${path}`,()=>fixture(f=>{
 setArchive(f);const project=f.list.projects.find(p=>p.relativePath===path);archive(f,project.projectId);
 const parent=path.split('/').slice(0,-1).join('/');rmSync(join(f.root,parent),{recursive:true});
 const preview=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'restore',name:null,createParent:true});assert.deepEqual(preview.blockers,[],JSON.stringify(preview));
 const result=f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:preview.previewToken});assert.equal(result.operation.stage,'completed',JSON.stringify(result));
 f.restart();const row=f.query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId);assert.equal(row.relativePath,path);assert.equal(row.categoryId,project.categoryId);
}));
test('restore refuses replaced original intermediate Group even when its immediate parent is unchanged',()=>fixture(f=>{
 setArchive(f);const project=f.list.projects.find(p=>p.relativePath==='Clients/Team/App');archive(f,project.projectId);
 renameSync(join(f.root,'Clients'),join(f.root,'OldClients'));mkdirSync(join(f.root,'Clients'));renameSync(join(f.root,'OldClients/Team'),join(f.root,'Clients/Team'));
 const preview=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'restore',name:null,createParent:false});assert.equal(preview.previewToken,null);assert.ok(preview.blockers.includes('parent_replaced'),JSON.stringify(preview));assert.equal(existsSync(join(f.root,'Stored/Clients/Team/App')),true);
}));

for(const parent of ['Clients/Team','Work/Team'])test(`archived siblings reuse explicitly recreated Group ${parent}`,()=>fixture(f=>{
 mkdirSync(join(f.root,parent,'Sibling'));const discovered=f.query({type:'workspace.previewDiscovery'});const list=f.command({type:'workspace.applyDiscovery',previewToken:discovered.previewToken});setArchive(f);
 const projects=list.projects.filter(p=>p.relativePath.startsWith(parent+'/'));assert.equal(projects.length,2);
 for(const project of projects)archive(f,project.projectId);rmSync(join(f.root,parent),{recursive:true});
 for(const [index,project] of projects.entries()){
  const preview=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'restore',name:null,createParent:index===0});assert.deepEqual(preview.blockers,[],JSON.stringify(preview));
  const result=f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:preview.previewToken});assert.equal(result.operation.stage,'completed',JSON.stringify(result));f.restart();
 }
 assert.equal(f.query({type:'workspace.listProjects'}).projects.filter(p=>projects.some(original=>original.projectId===p.projectId)).length,2);
}));

test('repeated root rename/move/archive retains dormant role history without blocking its current project',()=>fixture(f=>{
 const project=f.list.projects.find(p=>p.relativePath==='RootApp');
 for(const name of ['FirstName','SecondName']){const list=f.query({type:'workspace.listProjects'});assert.equal(f.command({type:'workspace.renameProject',projectId:project.projectId,operationId:crypto.randomUUID(),name,expectedRevision:list.revision}).outcome,'completed');f.restart();}
 let list=f.query({type:'workspace.listProjects'});assert.equal(f.command({type:'workspace.moveProjectCategory',projectId:project.projectId,operationId:crypto.randomUUID(),parentRelativePath:'Clients/Team',expectedRevision:list.revision}).outcome,'completed');
 setArchive(f);archive(f,project.projectId);assert.equal(f.query({type:'workspace.listProjectFiles',projectId:project.projectId,relativePath:''}).outcome,'listed');assert.equal(restore(f,project.projectId).operation.stage,'completed');
 list=f.query({type:'workspace.listProjects'});assert.equal(list.projects.find(p=>p.projectId===project.projectId).relativePath,'Clients/Team/SecondName');
}));

test('ordinary Archive stays active while a separate explicit archive survives review cancellation and restart',()=>fixture(f=>{
  const project=f.list.projects.find(p=>p.relativePath==='Archive/cpp');
  assert.ok(project);assert.equal(f.list.categories.find(c=>c.categoryId===project.categoryId).name,'Archive');
  assert.equal(f.query({type:'workspace.listArchivedProjects'}).relativePath,null);
  const before=f.query({type:'workspace.listProjects'});
  const ordinary=f.query({type:'workspace.previewArchiveLocation',relativePath:'Archive'});
  assert.equal(ordinary.previewToken,null);assert.ok(ordinary.blockers.includes('owned_location'));
  const separate=f.query({type:'workspace.previewArchiveLocation',relativePath:'Cold storage'});assert.ok(separate.previewToken);
  f.restart();
  assert.equal(f.query({type:'workspace.listArchivedProjects'}).relativePath,null);
  assert.deepEqual(f.query({type:'workspace.listProjects'}).projects,before.projects);
  assert.equal(existsSync(join(f.root,'Cold storage')),false);
  const property=f.command({type:'workspace.createProperty',name:'Retained',propertyType:'text'});
  f.command({type:'workspace.setTextValue',projectId:project.projectId,propertyId:property.propertyId,value:'Exact notes'});
  const selected=f.query({type:'workspace.previewArchiveLocation',relativePath:'Cold storage'});
  f.command({type:'workspace.applyArchiveLocation',operationId:crypto.randomUUID(),previewToken:selected.previewToken});
  f.restart();assert.equal(f.query({type:'workspace.listArchivedProjects'}).relativePath,'Cold storage');
  assert.equal(f.query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId).relativePath,'Archive/cpp');
  const reviewed=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'archive',name:null,createParent:false});
  assert.equal(reviewed.requestedRelativePath,'Cold storage/Archive/cpp');
  assert.equal(f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:reviewed.previewToken}).operation.stage,'completed');
  f.restart();assert.equal(f.query({type:'workspace.listArchivedProjects'}).projects[0].projectId,project.projectId);
  const restored=f.query({type:'workspace.previewProjectArchive',projectId:project.projectId,action:'restore',name:null,createParent:false});
  assert.equal(f.command({type:'workspace.applyProjectArchive',operationId:crypto.randomUUID(),previewToken:restored.previewToken}).operation.stage,'completed');
  const after=f.query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId);
  assert.equal(after.relativePath,'Archive/cpp');assert.equal(after.categoryId,project.categoryId);
  assert.equal(f.query({type:'workspace.listTextProperties'}).values.find(p=>p.projectId===project.projectId).value,'Exact notes');
}));

for(const populated of [false,true])test(`an un-enrolled ${populated?'populated':'empty'} ordinary Archive status cannot become the special archive`,()=>{
 const directory=mkdtempSync(join(tmpdir(),'unobserved-archive-status-')),root=join(directory,'Root');mkdirSync(join(root,'Work/App'),{recursive:true});
 const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
 const app=openSettingsService(join(directory,'data','workspace.sqlite'),undefined,undefined,observer);
 try{
  const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
  const query=input=>value(app.handleQuery({workspaceId:workspace.workspaceId,...input}));
  const before=query({type:'workspace.listProjects'});
  mkdirSync(join(root,populated?'Archive/cpp':'Archive'),{recursive:true});
  const review=query({type:'workspace.previewArchiveLocation',relativePath:'Archive'});
  assert.equal(review.previewToken,null);assert.ok(review.blockers.includes('owned_location'));
  assert.equal(query({type:'workspace.listArchivedProjects'}).relativePath,null);
  assert.deepEqual(query({type:'workspace.listProjects'}).projects,before.projects);
  const preview=query({type:'workspace.previewDiscovery'});
  assert.ok(preview.entries.some(entry=>entry.relativePath==='Archive'&&entry.reason!=='archive'));
 }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});

test('explicit empty archive designation can change without moving its former folder',()=>fixture(f=>{
 setArchive(f);mkdirSync(join(f.root,'Stored'),{recursive:true});
 const preview=f.query({type:'workspace.previewArchiveLocation',relativePath:'New archive'});assert.ok(preview.previewToken);
 const changed=f.command({type:'workspace.applyArchiveLocation',operationId:crypto.randomUUID(),previewToken:preview.previewToken});
 assert.equal(changed.relativePath,'New archive');assert.equal(existsSync(join(f.root,'Stored')),true);assert.equal(existsSync(join(f.root,'New archive')),false);
 f.restart();assert.equal(f.query({type:'workspace.listArchivedProjects'}).relativePath,'New archive');
}));

test('an ordinary status appearing after archive-location review rejects Apply without changing designation',()=>fixture(f=>{
 const preview=f.query({type:'workspace.previewArchiveLocation',relativePath:'New archive'});assert.ok(preview.previewToken);
 mkdirSync(join(f.root,'New archive','New project'),{recursive:true});
 const result=f.app.handleCommand({type:'workspace.applyArchiveLocation',workspaceId:f.workspace.workspaceId,operationId:crypto.randomUUID(),previewToken:preview.previewToken});
 assert.equal(result.ok,false);assert.equal(f.query({type:'workspace.listArchivedProjects'}).relativePath,null);
 assert.equal(existsSync(join(f.root,'New archive','New project')),true);
}));
