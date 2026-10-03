import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readdir,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorkspaceIpcHandler} from '../electron/workspaceIpc.js';

test('IPC creates exactly one empty project, rejects invalid/conflicting/symlink destinations and retains view settings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workspace-rei-')); const root=join(dir,'source');
 try{
  await mkdir(join(root,'Active'),{recursive:true});
  const options={configPath:join(dir,'settings.json'),viewStorePath:join(dir,'views.json'),propertyStorePath:join(dir,'properties.json'),chooseRoot:async()=>root};
  let handler=createWorkspaceIpcHandler(options);
  const workspaceId=(await handler(null,'workspace.setRoot',{})).root.workspaceId;
  const call=(method,payload={})=>handler(null,'workspace.'+method,{workspaceId,...payload});
  const statusValueId=(await call('getViewProjection',{viewId:'view:default-board'})).statusValues.find(s=>s.name==='Active').id;
  await call('updateView',{viewId:'view:default-board',patch:{hiddenColumnIds:[statusValueId],columnOrder:[statusValueId]}});
  const results=await Promise.allSettled([call('createProject',{statusValueId,name:'Alpha'}),call('createProject',{statusValueId,name:'Alpha'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.deepEqual(await readdir(join(root,'Active','Alpha')),[]);
  handler=createWorkspaceIpcHandler(options);
  const projection=await call('getViewProjection',{viewId:'view:default-board',searchQuery:'zz'});
  assert.deepEqual(projection.view.hiddenColumnIds,[statusValueId]);assert.deepEqual(projection.projection.columns,[]);
  const projects=(await call('getViewProjection',{viewId:'view:default-table'})).projection.rows;
  assert.ok(projects.some(p=>p.name==='Alpha'&&p.status.id===statusValueId));
  for(const name of ['', '..','../escape','a/b','a\\b','.hidden',' a','a ','bad\0'])await assert.rejects(call('createProject',{statusValueId,name}));
  await assert.rejects(call('createProject',{statusValueId:'statusValue:no-status',name:'Unsorted'}));
  await writeFile(join(root,'Active','occupied'),'keep');await assert.rejects(call('createProject',{statusValueId,name:'occupied'}));assert.equal(await readFile(join(root,'Active','occupied'),'utf8'),'keep');
  await symlink(dir,join(root,'Active','link'));await assert.rejects(call('createProject',{statusValueId,name:'link'}));
  await call('updateFolderRole',{path:'Active/Future',role:'group'});await assert.rejects(call('createProject',{statusValueId,name:'Future'}));
  await call('updateFolderRole',{path:'Active',role:'group'});await assert.rejects(call('createProject',{statusValueId,name:'WrongRole'}));
  await rm(root,{recursive:true});await assert.rejects(call('createProject',{statusValueId,name:'Missing'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('missing helper fails before filesystem creation',async()=>{
 const {createEmptyProjectDirectory}=await import('../src/workspaceProjectCreate.js');
 await assert.rejects(createEmptyProjectDirectory({root:'/tmp',parent:'',name:'NeverCreated',helperPath:'/does-not-exist/workspace-sidecar'}),{code:'PROJECT_CREATE_UNAVAILABLE'});
});

test('fresh discovery rejects missing, unreadable and replaced symlink Status/source without creating parents',async()=>{
 const {chmod,rename}=await import('node:fs/promises');
 const dir=await mkdtemp(join(tmpdir(),'workspace-rei-safety-')),root=join(dir,'source'),outside=join(dir,'outside');
 try{
  await mkdir(join(root,'Active'),{recursive:true});await mkdir(join(outside,'Active'),{recursive:true});
  const handler=createWorkspaceIpcHandler({configPath:join(dir,'settings.json'),viewStorePath:join(dir,'views.json'),propertyStorePath:join(dir,'properties.json'),chooseRoot:async()=>root});
  const workspaceId=(await handler(null,'workspace.setRoot',{})).root.workspaceId;
  const call=(method,payload={})=>handler(null,'workspace.'+method,{workspaceId,...payload});
  const statusValueId=(await call('getViewProjection',{viewId:'view:default-board'})).statusValues.find(s=>s.name==='Active').id;
  await chmod(join(root,'Active'),0);
  try{await assert.rejects(call('createProject',{statusValueId,name:'Unreadable'}));}finally{await chmod(join(root,'Active'),0o700)}
  await rename(join(root,'Active'),join(root,'Held'));await assert.rejects(call('createProject',{statusValueId,name:'Missing'}));
  await symlink(outside,join(root,'Active'));await assert.rejects(call('createProject',{statusValueId,name:'Symlink'}));assert.deepEqual(await readdir(outside),['Active']);
  await rm(join(root,'Active'));await rename(join(root,'Held'),join(root,'Active'));
  await rename(root,join(dir,'held-source'));await symlink(outside,root);await assert.rejects(call('createProject',{statusValueId,name:'RootSymlink'}));assert.deepEqual(await readdir(join(outside,'Active')),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('concurrent visibility intents merge in the authoritative view and all hidden can restore',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workspace-rei-visibility-')),root=join(dir,'source');
 try{
  await mkdir(join(root,'Active'),{recursive:true});await mkdir(join(root,'Done'));
  const handler=createWorkspaceIpcHandler({configPath:join(dir,'settings.json'),viewStorePath:join(dir,'views.json'),propertyStorePath:join(dir,'properties.json'),chooseRoot:async()=>root});
  const workspaceId=(await handler(null,'workspace.setRoot',{})).root.workspaceId;
  const call=(method,payload={})=>handler(null,'workspace.'+method,{workspaceId,...payload});
  const ids=(await call('getViewProjection',{viewId:'view:default-board'})).statusValues.map(s=>s.id);
  await Promise.all(ids.map(statusValueId=>call('updateView',{viewId:'view:default-board',patch:{columnVisibility:{statusValueId,visible:false}}})));
  const hidden=await call('getViewProjection',{viewId:'view:default-board'});assert.deepEqual(hidden.view.hiddenColumnIds,ids);assert.deepEqual(hidden.projection.columns,[]);
  await Promise.all(ids.map(statusValueId=>call('updateView',{viewId:'view:default-board',patch:{columnVisibility:{statusValueId,visible:true}}})));
  assert.deepEqual((await call('getViewProjection',{viewId:'view:default-board'})).view.hiddenColumnIds,[]);
  await assert.rejects(call('updateView',{viewId:'view:default-board',patch:{columnVisibility:{statusValueId:ids[0],visible:'false'}}}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
