import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createWorkspaceIpcHandler} from '../electron/workspaceIpc.js';import {duplicateWorkspaceView} from '../src/duplicateWorkspaceView.js';
test('JSON view order survives service restart and independent duplication without changing project data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workspace-9bp-order-'));const root=join(dir,'source');const configPath=join(dir,'settings.json'),viewStorePath=join(dir,'views.json'),propertyStorePath=join(dir,'properties.json');
 try{
  for(const name of ['Alpha','Beta','Gamma']){await mkdir(join(root,'Active',name),{recursive:true});await writeFile(join(root,'Active',name,'content'),name);}
  const make=()=>createWorkspaceIpcHandler({configPath,viewStorePath,propertyStorePath,chooseRoot:async()=>root});let h=make();const workspaceId=(await h(null,'workspace.setRoot',{})).root.workspaceId;const call=(method,payload={})=>h(null,'workspace.'+method,{workspaceId,...payload});
  const rows=(await call('getViewProjection',{viewId:'view:default-table'})).projection.rows;const ids=rows.map(p=>p.id);const order=[ids[2],ids[0],ids[1],'opaque-retained-unavailable'];
  await call('updateView',{viewId:'view:default-table',patch:{rowOrder:order}});h=make();assert.deepEqual((await call('getViewProjection',{viewId:'view:default-table'})).projection.rows.map(p=>p.id),order.slice(0,3));
  const client=Object.fromEntries(['listViews','createView','updateView','reorderViews','setActiveView','deleteView'].map(method=>[method,payload=>call(method,payload)]));const copyId=await duplicateWorkspaceView(client,workspaceId,'view:default-table','Table copy');
  await call('updateView',{viewId:copyId,patch:{rowOrder:ids}});const views=(await call('listViews')).views;assert.deepEqual(views.find(v=>v.id==='view:default-table').rowOrder,order);assert.deepEqual(views.find(v=>v.id===copyId).rowOrder,ids);
  for(const row of rows)assert.equal(await readFile(join(root,row.currentRelativePath,'content'),'utf8'),row.name);
  assert.equal(JSON.parse(await readFile(configPath)).projectMove,undefined);
 }finally{await rm(dir,{recursive:true,force:true});}
});
