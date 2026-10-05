import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceIpcHandler } from '../electron/workspaceIpc.js';
import { duplicateWorkspaceView } from '../src/duplicateWorkspaceView.js';

test('Wrap metadata survives isolated JSON restart, duplicate, Workspace/view switches and width-only updates without data mutation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workspace-y3m-'));
 const root=join(dir,'source'),configPath=join(dir,'settings.json'),viewStorePath=join(dir,'views.json'),propertyStorePath=join(dir,'properties.json');
 try {
  for(const [status,names] of [['Short',['Alpha']],['Long',['Beta','Gamma','Delta']],['Empty',[]]]) {
   await mkdir(join(root,status),{recursive:true});
   for(const name of names){await mkdir(join(root,status,name));await writeFile(join(root,status,name,'content'),name)}
  }
  const make=()=>createWorkspaceIpcHandler({configPath,viewStorePath,propertyStorePath,chooseRoot:async()=>root});let handler=make();
  const workspaceId=(await handler(null,'workspace.setRoot',{})).root.workspaceId;
  const call=(method,payload={})=>handler(null,'workspace.'+method,{workspaceId,...payload});
  for(const path of ['Short','Long','Empty'])await call('updateFolderRole',{path,role:'status'});
  await call('createProperty',{propertyId:'property:y3m-notes',name:'Notes',type:'text'});
  const boardId='view:default-board',tableId='view:default-table';
  const initial=await call('getViewProjection',{viewId:boardId});
  assert.equal(initial.view.boardLayout.wrapContent??false,false);
  const table=await call('getViewProjection',{viewId:tableId});
  const config=await readFile(configPath,'utf8'), properties=await readFile(propertyStorePath,'utf8');
  await call('updateView',{viewId:boardId,patch:{boardLayout:{columnWidth:450}}});
  await call('updateView',{viewId:boardId,patch:{boardLayout:{wrapContent:true}}});
  const wrapped=await call('getViewProjection',{viewId:boardId});
  assert.equal(wrapped.view.boardLayout.columnWidth,450);
  assert.equal(wrapped.view.boardLayout.wrapContent,true);
  assert.deepEqual(wrapped.projection,initial.projection);
  assert.deepEqual(await call('getViewProjection',{viewId:tableId}),table);
  const client=Object.fromEntries(['listViews','createView','updateView','reorderViews','setActiveView','deleteView'].map(method=>[method,payload=>call(method,payload)]));
  const copyId=await duplicateWorkspaceView(client,workspaceId,boardId,'Copy');
  assert.equal((await call('getViewProjection',{viewId:copyId})).view.boardLayout.wrapContent,true);
  await call('updateView',{viewId:copyId,patch:{boardLayout:{wrapContent:false}}});
  await call('updateView',{viewId:boardId,patch:{boardLayout:{columnWidth:510}}});
  for(const viewId of [tableId,copyId,boardId])await call('setActiveView',{viewId});
  assert.equal(await readFile(configPath,'utf8'),config);
  const otherId=(await call('createWorkspace',{name:'Other'})).workspace.id;
  await call('setActiveWorkspace',{workspaceId:otherId});await call('setActiveWorkspace',{workspaceId});
  handler=make();
  assert.deepEqual((await call('getViewProjection',{viewId:boardId})).view.boardLayout,{columnWidth:510,wrapContent:true});
  assert.deepEqual((await call('getViewProjection',{viewId:copyId})).view.boardLayout,{columnWidth:450});
  const searched=await call('getViewProjection',{viewId:boardId,searchQuery:'Gamma'});
  assert.equal(searched.view.boardLayout.wrapContent,true);
  assert.equal(searched.projection.columns.flatMap(c=>c.projects).length,1);
  const configAfter=JSON.parse(await readFile(configPath,'utf8')), configBefore=JSON.parse(config);
  assert.deepEqual(configAfter.workspaceSources[workspaceId],configBefore.workspaceSources[workspaceId]);
  assert.equal(configAfter.rootPath,configBefore.rootPath);
  assert.equal(configAfter.activeWorkspaceId,configBefore.activeWorkspaceId);
  assert.equal(await readFile(propertyStorePath,'utf8'),properties);
  for(const project of initial.projection.columns.flatMap(c=>c.projects))assert.equal(await readFile(join(root,project.currentRelativePath,'content'),'utf8'),project.name);
  await assert.rejects(call('updateView',{viewId:boardId,patch:{boardLayout:{wrapContent:'bad'}}}),e=>e.field==='boardLayout.wrapContent');
  assert.equal((await call('getViewProjection',{viewId:boardId})).view.boardLayout.wrapContent,true);
 } finally {await rm(dir,{recursive:true,force:true})}
});
