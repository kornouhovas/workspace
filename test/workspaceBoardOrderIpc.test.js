import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceIpcHandler } from '../electron/workspaceIpc.js';
import { duplicateWorkspaceView } from '../src/duplicateWorkspaceView.js';

test('Board order persists across runtime restart, duplicate and Workspace switching; filters/new statuses preserve rank and Status card move keeps its target', async () => {
 const dir=await mkdtemp(join(tmpdir(),'workspace-fns-'));
 const root=join(dir,'source'), configPath=join(dir,'settings.json'),viewStorePath=join(dir,'views.json'),propertyStorePath=join(dir,'properties.json');
 try {
  for (const [status,names] of [['Active',['Alpha','Beta']],['Done',['Gamma']],['Empty',[]]]) {
   await mkdir(join(root,status),{recursive:true});
   for(const name of names) { await mkdir(join(root,status,name));await writeFile(join(root,status,name,'content'),name); }
  }
  await mkdir(join(root,'Unsorted'));await writeFile(join(root,'Unsorted','content'),'Unsorted');
  const make=()=>createWorkspaceIpcHandler({configPath,viewStorePath,propertyStorePath,chooseRoot:async()=>root});let handler=make();
  const workspaceId=(await handler(null,'workspace.setRoot',{})).root.workspaceId;
  const call=(method,payload={})=>handler(null,'workspace.'+method,{workspaceId,...payload});
  // Explicitly configure fixtures rather than relying on heuristic folder names.
  await call('updateFolderRole',{path:'Active',role:'status'});await call('updateFolderRole',{path:'Done',role:'status'});await call('updateFolderRole',{path:'Empty',role:'status'});
  await call('updateFolderRole',{path:'Unsorted',role:'project'});
  await call('createProperty',{propertyId:'property:fns-notes',name:'Notes',type:'text'});
  const original=await call('getViewProjection',{viewId:'view:default-board'});
  const columns=original.projection.columns;
  const ids=columns.map(c=>c.statusValueId);assert.equal(ids.length,4);
  assert.ok(ids.includes("statusValue:no-status"));
  const order=[ids[2],ids[0],ids[1],'opaque-unavailable',ids[3]];
  const projects=columns.flatMap(c=>c.projects), catalog=original.statusValues;
  const viewBefore=(await call("listViews")).views.find(view=>view.id==="view:default-board");
  const settingsBefore=JSON.parse(await readFile(configPath));
  const propertiesBefore=await readFile(propertyStorePath,'utf8');
  const tableBefore=await call('getViewProjection',{viewId:'view:default-table'});
  await call('updateView',{viewId:'view:default-board',patch:{columnOrder:order}});
  handler=make();
  const reordered=await call('getViewProjection',{viewId:'view:default-board'});
  assert.deepEqual(reordered.projection.columns.map(c=>c.statusValueId),order.filter(id=>id!=="opaque-unavailable"));
  assert.deepEqual(reordered.statusValues,catalog);
  const viewAfter=(await call("listViews")).views.find(view=>view.id==="view:default-board");
  const {columnOrder:beforeRank,grouping:beforeGrouping,updatedAt:beforeUpdated,...beforeSettings}=viewBefore;
  const {columnOrder:afterRank,grouping:afterGrouping,updatedAt:afterUpdated,...afterSettings}=viewAfter;
  assert.deepEqual(afterSettings,beforeSettings);

  assert.deepEqual(await call('getViewProjection',{viewId:'view:default-table'}),tableBefore);
  assert.deepEqual(JSON.parse(await readFile(configPath)),settingsBefore);
  assert.equal(await readFile(propertyStorePath,'utf8'),propertiesBefore);
  const searched=await call('getViewProjection',{viewId:'view:default-board',searchQuery:'Alpha'});
  assert.deepEqual(searched.view.columnOrder,order);assert.equal(searched.projection.columns.filter(c=>c.projects.length>0).length,1);
  assert.deepEqual((await call('getViewProjection',{viewId:'view:default-board'})).projection.columns.map(c=>c.statusValueId),order.filter(id=>id!=="opaque-unavailable"));
  const client=Object.fromEntries(['listViews','createView','updateView','reorderViews','setActiveView','deleteView'].map(method=>[method,payload=>call(method,payload)]));
  const copyId=await duplicateWorkspaceView(client,workspaceId,'view:default-board','Second Board');
  assert.deepEqual((await call('getViewProjection',{viewId:copyId})).view.columnOrder,order);
  await call('updateView',{viewId:copyId,patch:{columnOrder:ids}});
  await call('setActiveView',{viewId:'view:default-table'});await call('setActiveView',{viewId:'view:default-board'});
  assert.deepEqual((await call('getViewProjection',{viewId:'view:default-board'})).view.columnOrder,order);
  assert.deepEqual((await call('getViewProjection',{viewId:copyId})).view.columnOrder,ids);
  const filterStatus=columns.find(c=>c.name==='Done').statusValueId;
  await call('updateView',{viewId:copyId,patch:{valueVisibility:{'property:status':{valueIds:[filterStatus]}}}});
  const filteredCopy=await call('getViewProjection',{viewId:copyId});
  assert.deepEqual(filteredCopy.view.columnOrder,ids);
  assert.ok(filteredCopy.projection.columns.flatMap(c=>c.projects).every(p=>p.status.id===filterStatus));
  assert.deepEqual((await call('getViewProjection',{viewId:'view:default-board'})).view.columnOrder,order);
  const created=await call('createWorkspace' ,{name:'Other workspace'}); const otherId=created.workspace.id;
  await call('setActiveWorkspace',{workspaceId:otherId});await call('setActiveWorkspace',{workspaceId});handler=make();
  assert.deepEqual((await call('getViewProjection',{viewId:'view:default-board'})).view.columnOrder,order);
  await mkdir(join(root,'New'));await call('updateFolderRole',{path:'New',role:'status'});
  const added=await call('getViewProjection',{viewId:'view:default-board'});
  assert.deepEqual(added.view.columnOrder.filter(id=>!id.endsWith(":new")),order);assert.equal(added.view.columnOrder.length,6);
  for(const project of projects) assert.equal(await readFile(join(root,project.currentRelativePath,'content'),'utf8'),project.name);
  const alpha=projects.find(p=>p.name==='Alpha');const done=columns.find(c=>c.name==='Done');
  const options=(await call('getProjectStatusOptions',{projectId:alpha.id})).options;
  const target=options.find(o=>o.id===done.statusValueId);
  assert.ok(target && !target.disabledReason && !target.current);
  await call('moveProjectStatus',{projectId:alpha.id,statusValueId:target.id});
  const moved=await call('getViewProjection',{viewId:'view:default-board'});
  assert.ok(moved.projection.columns.find(c=>c.statusValueId===done.statusValueId).projects.some(p=>p.id===alpha.id));
  assert.deepEqual(moved.view.columnOrder.filter(id=>!id.endsWith(":new")),order);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
