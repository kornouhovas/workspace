import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViewDocument, validateViewPatch, createViewProjection } from '../src/workspaceViews.js';
const properties = ['property:name','property:status','property:custom'].map(id=>({id,propertyType:'text'}));
test('Table widths survive document/projection normalization without a maximum',()=>{
 const widths={'property:name':2600,'property:status':800,'property:custom':1e12};
 const view=normalizeViewDocument({id:'v',workspaceId:'w',viewType:'table',tableColumnWidths:widths});
 assert.deepEqual(view.tableColumnWidths,widths);
 assert.deepEqual(createViewProjection({view}).view.tableColumnWidths,widths);
});
test('Table widths reject non-finite, non-number and below-minimum values',()=>{
 for(const width of [NaN,Infinity,-10,0,131,'900',null]) assert.throws(()=>validateViewPatch({patch:{tableColumnWidths:{'property:name':width}},propertyDefinitions:properties}),{code:'VALIDATION_FAILED'});
 validateViewPatch({patch:{tableColumnWidths:{'property:name':132,'property:custom':1e15}},propertyDefinitions:properties});
 assert.throws(()=>validateViewPatch({patch:{tableColumnWidths:[]},propertyDefinitions:properties}),{code:'VALIDATION_FAILED'});
});
test('legacy views default widths to empty and corrupted persisted widths are omitted',()=>{
 assert.deepEqual(normalizeViewDocument({viewType:'table'}).tableColumnWidths,{});
 assert.deepEqual(normalizeViewDocument({viewType:'table',tableColumnWidths:{ok:140,bad:Infinity,small:1}}).tableColumnWidths,{ok:140});
});

import { createTableColumnWidthQueue, normalizeTableColumnWidth } from '../src/workspaceTableLayout.js';
test('resize has the existing minimum and no viewport/product maximum',()=>{
 for(const width of [600,1025,1441,2600,1e15,Number.MAX_VALUE]) assert.equal(normalizeTableColumnWidth(width),width);
 assert.equal(normalizeTableColumnWidth(-50),132);
 for(const width of [NaN,Infinity,-Infinity]) assert.equal(normalizeTableColumnWidth(width),132);
});
test('pending widths are scoped by workspace/view and stale projections never reset first frame', async()=>{
 const pending=[];const writes=[];
 const q=createTableColumnWidthQueue((target,widths)=>new Promise((resolve,reject)=>{writes.push({target,widths});pending.push({resolve,reject});}));
 const a={workspaceId:'w',viewId:'a'},b={workspaceId:'w',viewId:'b'},other={workspaceId:'other',viewId:'a'};
 q.preview(a,'property:name',1600);const first=q.commit(a,'property:name',1600,260);
 await Promise.resolve();
 q.preview(a,'property:status',800);const second=q.commit(a,'property:status',800,180);
 q.preview(b,'property:name',900);
 assert.deepEqual(q.read(a,{'property:name':260}),{'property:name':1600,'property:status':800});
 assert.deepEqual(q.read(b,{}),{'property:name':900});assert.deepEqual(q.read(other,{}),{});
 pending.shift().resolve();await first;await Promise.resolve();pending.shift().resolve();await second;
 assert.deepEqual(writes.map(w=>w.widths),[{'property:name':1600},{'property:status':800}]);
 assert.equal(q.read(a,{'property:name':260})['property:name'],1600);
});
test('late failed save does not roll back a newer width or change another view',async()=>{
 const pending=[];const q=createTableColumnWidthQueue(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
 const a={workspaceId:'w',viewId:'a'},b={workspaceId:'w',viewId:'b'};
 const first=q.commit(a,'property:name',700,260).catch(()=>{});await Promise.resolve();
 const second=q.commit(a,'property:name',1100,700);q.preview(b,'property:name',900);
 pending.shift().reject(new Error('old failure'));await first;await Promise.resolve();
 assert.equal(q.read(a,{})['property:name'],1100);assert.equal(q.read(b,{})['property:name'],900);
 pending.shift().resolve();await second;
});

import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorkspaceIpcHandler } from '../electron/workspaceIpc.js';
test('active JSON IPC persists widths independently through restart, hide/reorder/group patches and duplication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workspace-bja-unit-'));
 try {
 const root=join(dir,'source');await mkdir(join(root,'Active','Project'),{recursive:true});
 const options={configPath:join(dir,'settings.json'),viewStorePath:join(dir,'views.json'),propertyStorePath:join(dir,'properties.json'),chooseRoot:async()=>root};
 let h=createWorkspaceIpcHandler(options);const selected=await h(null,'workspace.setRoot',{});const workspaceId=selected.root.workspaceId;
 const call=(method,payload={})=>h(null,'workspace.'+method,{workspaceId,...payload});
 const table='view:default-table';const other=(await call('createView',{viewType:'table',name:'Independent'})).view.id;
 const widths={'property:name':3600,'property:status':900};
 await call('updateView',{viewId:table,patch:{tableColumnWidths:widths}});
 await call('updateView',{viewId:table,patch:{tableColumnWidths:{'property:name':4800}}});
 await call('updateView',{viewId:other,patch:{tableColumnWidths:{'property:name':700}}});
 await call('updateView',{viewId:table,patch:{visiblePropertyIds:['property:name'],hiddenPropertyIds:['property:status'],grouping:{propertyId:'property:status'}}});
 h=createWorkspaceIpcHandler(options);
 const stored=(await call('listViews')).views;
 assert.deepEqual(stored.find(v=>v.id===table).tableColumnWidths,{'property:name':4800,'property:status':900});
 assert.deepEqual(stored.find(v=>v.id===other).tableColumnWidths,{'property:name':700});
 assert.deepEqual((await call('getViewProjection',{viewId:table})).view.tableColumnWidths,{'property:name':4800,'property:status':900});
 const {duplicateWorkspaceView}=await import('../src/duplicateWorkspaceView.js');
 const client=Object.fromEntries(['listViews','createView','updateView','reorderViews','setActiveView','deleteView'].map(method=>[method,payload=>call(method,payload)]));
 const duplicateId=await duplicateWorkspaceView(client,workspaceId,table,'Copy');
 assert.deepEqual((await call('listViews')).views.find(v=>v.id===duplicateId).tableColumnWidths,{'property:name':4800,'property:status':900});
 const before=await readFile(options.viewStorePath,'utf8');
 await assert.rejects(call('updateView',{viewId:table,patch:{tableColumnWidths:{'property:name':Infinity}}}),{code:'VALIDATION_FAILED'});assert.equal(await readFile(options.viewStorePath,'utf8'),before);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('failed prior gesture never overwrites a newer in-progress preview',async()=>{
 let reject;const q=createTableColumnWidthQueue(()=>new Promise((_resolve,r)=>{reject=r}));const target={workspaceId:'w',viewId:'v'};
 const old=q.commit(target,'property:name',800,260).catch(()=>{});await Promise.resolve();
 q.preview(target,'property:name',950);reject(new Error('prior write failed'));await old;
 assert.equal(q.read(target,{})['property:name'],950);
});
test('after sequential failures rollback reaches confirmed width, not a failed optimistic draft',async()=>{
 const pending=[];const q=createTableColumnWidthQueue(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));const target={workspaceId:'w',viewId:'v'};
 const first=q.commit(target,'property:name',800,260).catch(()=>{});await Promise.resolve();
 const second=q.commit(target,'property:name',900,800).catch(()=>{});
 pending.shift().reject(new Error('first'));await first;await Promise.resolve();pending.shift().reject(new Error('second'));await second;
 assert.equal(q.read(target,{})['property:name'],260);
});
