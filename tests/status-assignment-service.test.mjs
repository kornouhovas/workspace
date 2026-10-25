import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,existsSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {openSettingsService} from '../dist/service/settings.mjs';
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
function fixture(run){
 const directory=mkdtempSync(join(tmpdir(),'status-assignment-')),root=join(directory,'Root'),database=join(directory,'data','app.sqlite');
 for(const path of ['Clients/Active/App/Inside','Personal/Active','Work/Urgent/Task','Bare'])mkdirSync(join(root,path),{recursive:true});
 writeFileSync(join(root,'Clients/Active/App/Inside/keep.txt'),'Exact project bytes');
 let app=openSettingsService(database);
 try{
  const workspace=value(app.handleCommand({type:'workspace.create',name:'Statuses',rootPath:root,initialize:'status'}));
  const query=input=>value(app.handleQuery({workspaceId:workspace.workspaceId,...input}));
  const command=input=>value(app.handleCommand({workspaceId:workspace.workspaceId,...input}));
  const roles=[{relativePath:'Clients',role:'group'},{relativePath:'Personal',role:'group'},{relativePath:'Clients/Active',role:'status'},{relativePath:'Personal/Active',role:'status'},{relativePath:'Work/Urgent',role:'status'},{relativePath:'Bare',role:'project'},{relativePath:'Clients/Active/App/Inside',role:'group'}];
  const preview=query({type:'workspace.previewDiscovery',folderRoles:roles});command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});
  run({root,database,workspace,query,command,roles,get app(){return app;},restart(){app.close();app=openSettingsService(database);}});
 }finally{app.close();rmSync(directory,{recursive:true,force:true});}
}
test('status groups disambiguate paths and expose unavailable nested and No status destinations without hiding projects',()=>fixture(f=>{
 const list=f.query({type:'workspace.listProjects'}),category=path=>list.categories.find(c=>c.relativePath===path);
 assert.equal(category('Work/Urgent').statusMoveUnavailable,'nested_status');
 const view=f.query({type:'workspace.queryView',viewId:f.workspace.viewId,archived:false});
 assert.equal(view.groups.find(g=>g.value===category('Clients/Active').categoryId).label,'Clients/Active');
 assert.equal(view.groups.find(g=>g.value===category('Personal/Active').categoryId).label,'Personal/Active');
 assert.equal(view.groups.find(g=>g.value===category('Work/Urgent').categoryId).assignmentUnavailable,'nested_status');
 assert.equal(view.groups.find(g=>g.value===null).assignmentUnavailable,'no_status');
 assert.ok(view.groups.find(g=>g.value===null).projectIds.includes(list.projects.find(p=>p.relativePath==='Bare').projectId));
 assert.ok(view.groups.find(g=>g.value===category('Work/Urgent').categoryId).projectIds.includes(list.projects.find(p=>p.relativePath==='Work/Urgent/Task').projectId));
}));

for(const layout of ['table','board']) test(`${layout} status assignment moves whole folders by identity and preserves values and descendant roles after restart`,()=>fixture(f=>{
 let list=f.query({type:'workspace.listProjects'});const project=list.projects.find(p=>p.relativePath==='Clients/Active/App');
 const property=f.command({type:'workspace.createProperty',name:'Notes',propertyType:'text'});
 f.command({type:'workspace.setTextValue',projectId:project.projectId,propertyId:property.propertyId,value:'  Exact notes  '});
 f.command({type:'workspace.setViewLayout',viewId:f.workspace.viewId,kind:layout});
 const category=path=>list.categories.find(c=>c.relativePath===path).categoryId;
 const receipt=f.command({type:'workspace.assignProjectGroup',viewId:f.workspace.viewId,projectId:project.projectId,propertyId:list.categoryProperty.propertyId,fromKey:JSON.stringify(category('Clients/Active')),toKey:JSON.stringify(category('Personal/Active')),archived:false});
 assert.equal(receipt.filesystem.outcome,'completed',JSON.stringify(receipt));
 assert.equal(existsSync(join(f.root,'Clients/Active/App')),false);assert.equal(readFileSync(join(f.root,'Personal/Active/App/Inside/keep.txt'),'utf8'),'Exact project bytes');
 f.restart();list=f.query({type:'workspace.listProjects'});
 assert.equal(list.projects.find(p=>p.projectId===project.projectId).relativePath,'Personal/Active/App');
 assert.equal(f.query({type:'workspace.listTextProperties'}).values.find(v=>v.projectId===project.projectId).value,'  Exact notes  ');
 assert.ok(f.query({type:'workspace.getFolderChildren',parentRelativePath:''}).folderRoles.some(r=>r.relativePath==='Personal/Active/App/Inside'&&r.role==='group'));
}));

test('status command and group assignment reject nested destinations before any filesystem effect',()=>fixture(f=>{
 const list=f.query({type:'workspace.listProjects'}),project=list.projects.find(p=>p.relativePath==='Clients/Active/App'),nested=list.categories.find(c=>c.relativePath==='Work/Urgent');
 const result=f.command({type:'workspace.moveProjectCategory',projectId:project.projectId,destinationCategoryId:nested.categoryId,operationId:randomUUID(),expectedRevision:list.revision});
 assert.equal(result.outcome,'rejected');assert.equal(result.problem,'category_unavailable');
 const drop={type:'workspace.assignProjectGroup',viewId:f.workspace.viewId,projectId:project.projectId,propertyId:list.categoryProperty.propertyId,fromKey:JSON.stringify(project.categoryId),archived:false};
 assert.equal(f.app.handleCommand({workspaceId:f.workspace.workspaceId,...drop,toKey:JSON.stringify(nested.categoryId)}).ok,false);
 assert.equal(f.app.handleCommand({workspaceId:f.workspace.workspaceId,...drop,toKey:'null'}).ok,false);
 assert.equal(readFileSync(join(f.root,'Clients/Active/App/Inside/keep.txt'),'utf8'),'Exact project bytes');
 assert.equal(existsSync(join(f.root,'Work/Urgent/App')),false);
 assert.deepEqual(f.query({type:'workspace.listProjectCategoryMoves'}).operations,[]);
}));

for(const origin of ['Bare','Work/Urgent/Task']) test(`status assignment from ${origin} to a permitted physical status retains identity`,()=>fixture(f=>{
 const list=f.query({type:'workspace.listProjects'}),project=list.projects.find(p=>p.relativePath===origin),destination=list.categories.find(c=>c.relativePath==='Personal/Active');
 const result=f.command({type:'workspace.assignProjectGroup',viewId:f.workspace.viewId,projectId:project.projectId,propertyId:list.categoryProperty.propertyId,fromKey:JSON.stringify(project.categoryId),toKey:JSON.stringify(destination.categoryId),archived:false});
 assert.equal(result.filesystem.outcome,'completed',JSON.stringify(result));
 f.restart();const current=f.query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId);
 assert.equal(current.relativePath,`Personal/Active/${project.name}`);assert.equal(current.categoryId,destination.categoryId);
}));

for(const problem of ['collision','stale','changed_parent','foreign_status']) test(`status edit rejects ${problem} without overwriting files`,()=>fixture(f=>{
 const list=f.query({type:'workspace.listProjects'}),project=list.projects.find(p=>p.relativePath==='Clients/Active/App');let destination=list.categories.find(c=>c.relativePath==='Personal/Active').categoryId;
 if(problem==='collision'){mkdirSync(join(f.root,'Personal/Active/App'));writeFileSync(join(f.root,'Personal/Active/App/occupied.txt'),'Do not overwrite');}
 if(problem==='stale'){const preview=f.query({type:'workspace.previewDiscovery',folderRoles:f.roles.concat({relativePath:'Personal/Active',role:'group'}).filter((r,index,rows)=>rows.findLastIndex(other=>other.relativePath===r.relativePath)===index)});f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});}
 if(problem==='changed_parent'){renameSync(join(f.root,'Personal'),join(f.root,'OldPersonal'));mkdirSync(join(f.root,'Personal'));renameSync(join(f.root,'OldPersonal/Active'),join(f.root,'Personal/Active'));}
 if(problem==='foreign_status'){
  const other=join(f.root,'..','Other');mkdirSync(join(other,'Personal/Active'),{recursive:true});
  const workspace=value(f.app.handleCommand({type:'workspace.create',rootPath:other,name:'Foreign',initialize:'status'}));
  const preview=value(f.app.handleQuery({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,folderRoles:[{relativePath:'Personal',role:'group'},{relativePath:'Personal/Active',role:'status'}]}));
  destination=value(f.app.handleCommand({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken})).categories[0].categoryId;
 }
 const result=f.command({type:'workspace.moveProjectCategory',projectId:project.projectId,destinationCategoryId:destination,operationId:randomUUID(),expectedRevision:list.revision});
 assert.equal(result.outcome,'rejected',JSON.stringify(result));
 assert.equal(readFileSync(join(f.root,'Clients/Active/App/Inside/keep.txt'),'utf8'),'Exact project bytes');
 if(problem==='collision')assert.equal(readFileSync(join(f.root,'Personal/Active/App/occupied.txt'),'utf8'),'Do not overwrite');
 else assert.equal(existsSync(join(f.root,'Personal/Active/App')),false);
}));

test('interrupted status assignment is not replayed at restart and completes only after explicit current recovery review',()=>fixture(f=>{
 const list=f.query({type:'workspace.listProjects'}),project=list.projects.find(p=>p.relativePath==='Clients/Active/App'),destination=list.categories.find(c=>c.relativePath==='Personal/Active');
 const sql=new Database(f.database);try{
  sql.exec("CREATE TRIGGER interrupt_status BEFORE UPDATE OF relative_path ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const receipt=f.command({type:'workspace.assignProjectGroup',viewId:f.workspace.viewId,projectId:project.projectId,propertyId:list.categoryProperty.propertyId,fromKey:JSON.stringify(project.categoryId),toKey:JSON.stringify(destination.categoryId),archived:false}).filesystem;
  assert.equal(receipt.outcome,'recoverable',JSON.stringify(receipt));const operationId=receipt.operation.operationId;
  sql.exec('DROP TRIGGER interrupt_status');f.restart();
  assert.equal(f.query({type:'workspace.getProjectCategoryMove',operationId}).outcome,'recoverable');
  assert.equal(f.query({type:'workspace.listProjects'}).retainedProjects.concat(f.query({type:'workspace.listProjects'}).projects).find(p=>p.projectId===project.projectId).relativePath,project.relativePath);
  const preview=f.query({type:'workspace.previewProjectCategoryMoveRecovery',operationId});assert.deepEqual(preview.actions,['complete_destination']);
  const completed=f.command({type:'workspace.recoverProjectCategoryMove',operationId,previewToken:preview.previewToken,action:'complete_destination'});assert.equal(completed.outcome,'completed');
  f.restart();assert.equal(f.query({type:'workspace.getProjectCategoryMove',operationId}).outcome,'completed');
  assert.equal(readFileSync(join(f.root,'Personal/Active/App/Inside/keep.txt'),'utf8'),'Exact project bytes');
  assert.equal(f.query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId).relativePath,'Personal/Active/App');
 }finally{sql.close();}
}));

test('historical groups retain their projects but cannot receive status assignments',()=>fixture(f=>{
 const view=f.query({type:'workspace.queryView',viewId:f.workspace.viewId,archived:false});
 const old=view.groups.find(g=>g.label==='Clients');assert.ok(old.projectIds.length);assert.equal(old.assignmentUnavailable,'status_unavailable');
 const list=f.query({type:'workspace.listProjects'}),project=list.projects.find(p=>p.relativePath==='Bare');
 assert.equal(f.app.handleCommand({type:'workspace.assignProjectGroup',workspaceId:f.workspace.workspaceId,viewId:f.workspace.viewId,projectId:project.projectId,propertyId:list.categoryProperty.propertyId,fromKey:'null',toKey:old.key,archived:false}).ok,false);
 assert.equal(existsSync(join(f.root,'Bare')),true);
}));
