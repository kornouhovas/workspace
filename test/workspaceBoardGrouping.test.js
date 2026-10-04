import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewProjection, normalizeViewDocument } from '../src/workspaceViews.js';
import { groupingMenuOrder, normalizeGrouping } from '../src/workspaceGrouping.js';
const properties = [{id:'property:status',type:'select'}, ...['text','number','date','select','multi-select'].map(type=>({id:type,type}))];
const statuses = [{id:'s',name:'Status',order:10}];
const values = ['select','multi-select'].flatMap(propertyId=>[{id:propertyId+'a',propertyId,name:'Zulu',order:10},{id:propertyId+'b',propertyId,name:'Alpha',order:20}]);
const projects = [{id:'a',name:'A',status:{id:'s'},propertyValues:{text:'Zulu',number:10,date:'2026-10-01',select:'selecta','multi-select':['multi-selecta','multi-selectb']}},{id:'b',name:'B',status:{id:'statusValue:no-status'},propertyValues:{text:'Alpha',number:2,date:'2026-01-01',select:'selectb','multi-select':['multi-selecta']}},{id:'c',name:'C',status:{id:'s'},propertyValues:{}}];
const projection=(viewType,propertyId,extra={})=>createViewProjection({view:{viewType,boardGroupingVersion:1,grouping:propertyId ? normalizeGrouping({propertyId,...extra}):null},projects,statusValues:statuses,propertyDefinitions:properties,selectValues:values}).projection;
test('Board shares all Table typed memberships, sorts, unique counts and empty values without file capabilities',()=>{
 for(const property of properties)for(const sort of ['default','ascending','descending','manual']){
  const table=projection('table',property.id,{sort,manualOrder:['value:selectb','value:selecta']}),board=projection('board',property.id,{sort,manualOrder:['value:selectb','value:selecta']});
  assert.deepEqual(board.groupOptions,table.groupOptions);
  assert.deepEqual(board.columns.map(c=>c.projects.map(p=>p.id)),table.groups.map(g=>g.rows.map(p=>p.id)));
  assert.equal(board.capabilities.canMoveBetweenStatuses,property.id==='property:status');
  assert.equal(board.totalProjectCount,3);
 }
 const flat=projection('board',null);assert.deepEqual(flat.columns[0].projects,projects);assert.equal(flat.capabilities.canMoveBetweenStatuses,false);
});
test('visibility partitions menu only, including empty group within each partition; order never changes',()=>{
 const board=projection('board','select',{sort:'manual',manualOrder:['value:selectb','value:selecta'],hiddenGroupIds:['value:selectb']});
 const before=structuredClone(board.groupOptions),menu=groupingMenuOrder(board.groupOptions);
 assert.deepEqual(menu.map(g=>g.id),['value:selecta','empty','value:selectb']);assert.deepEqual(board.groupOptions,before);
 const hiddenEmpty=projection('board','select',{hiddenGroupIds:['empty','value:selecta']});
 assert.deepEqual(groupingMenuOrder(hiddenEmpty.groupOptions).map(g=>g.id),['value:selectb','value:selecta','empty']);
});
test('legacy null Board becomes Status while explicit None remains None across repeated normalization',()=>{
 const legacy=normalizeViewDocument({viewType:'board',grouping:null,columnOrder:['s'],hiddenColumnIds:['s','statusValue:no-status']});
 assert.equal(legacy.grouping.propertyId,'property:status');assert.equal(legacy.grouping.sort,'manual');assert.deepEqual(legacy.grouping.hiddenGroupIds,['value:s','empty']);
 assert.deepEqual(normalizeViewDocument(legacy),legacy);
 const none=normalizeViewDocument({...legacy,grouping:null});assert.equal(normalizeViewDocument(none).grouping,null);
});

test('Board JSON IPC preserves custom grouping and explicit None independently across views/workspaces and restart', async()=>{
 const {mkdtemp,mkdir,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {tmpdir}=await import('node:os');const {createWorkspaceIpcHandler}=await import('../electron/workspaceIpc.js');
 const dir=await mkdtemp(join(tmpdir(),'4r0-ipc-'));try{
  const root=join(dir,'source');await mkdir(join(root,'Active','Alpha'),{recursive:true});
  const options={configPath:join(dir,'settings.json'),viewStorePath:join(dir,'views.json'),propertyStorePath:join(dir,'properties.json'),chooseRoot:async()=>root};let h=createWorkspaceIpcHandler(options);
  const workspaceId=(await h(null,'workspace.setRoot',{})).root.workspaceId;const call=(method,payload={})=>h(null,'workspace.'+method,{workspaceId,...payload});
  const property=(await call('createProperty',{name:'Number',type:'number'})).property.id,second=(await call('createView',{viewType:'board',name:'None'})).view.id;
  const grouping=normalizeGrouping({propertyId:property,sort:'manual',manualOrder:['number:10','unavailable'],hiddenGroupIds:['number:10'],collapsedGroupIds:['empty'],hideEmpty:true});
  await call('updateView',{viewId:'view:default-board',patch:{grouping}});await call('updateView',{viewId:second,patch:{grouping:null}});
  const other=(await call('createWorkspace',{name:'Other'})).workspace.id;await call('setActiveWorkspace',{workspaceId:other});await call('setActiveWorkspace');h=createWorkspaceIpcHandler(options);
  assert.deepEqual((await call('getViewProjection',{viewId:'view:default-board'})).view.grouping,grouping);
  const none=await call('getViewProjection',{viewId:second});assert.equal(none.view.grouping,null);assert.equal(none.projection.columns.length,1);assert.equal(none.projection.columns[0].projects.length,1);
  assert.equal((await call('getViewProjection',{viewId:'view:default-table'})).view.grouping,null);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('menu pointer and keyboard reorder retain unavailable opaque slots in every sort',async()=>{
 const {reorderGroupingGroup,moveGroupingGroup}=await import('../src/workspaceGrouping.js');
 for(const sort of ['manual','default','ascending','descending']){
  const setting=normalizeGrouping({propertyId:'select',sort,manualOrder:['value:unavailable','value:a','value:gap','value:b','value:tail'],hiddenGroupIds:['value:b']});
  for(const result of [reorderGroupingGroup(setting,['value:a','value:b','empty'],'value:b','value:a'),moveGroupingGroup(setting,['value:a','value:b','empty'],'value:b',-1)]){
   assert.deepEqual(result.manualOrder,['value:unavailable','value:b','value:gap','value:a','value:tail']);assert.deepEqual(result.hiddenGroupIds,['value:b']);assert.equal(result.sort,'manual');
  }
  assert.equal(reorderGroupingGroup(setting,['value:a','value:b','empty'],'value:a','value:b'),setting);
 }
});
test('collapsed Board groups retain project memberships and service search counts',()=>{
 const result=createViewProjection({view:{viewType:'board',boardGroupingVersion:1,grouping:normalizeGrouping({propertyId:'text',collapsedGroupIds:['text:"Zulu"','text:"Alpha"','empty']})},projects,propertyDefinitions:properties,statusValues:statuses,searchQuery:'A'}).projection;
 const matched=result.columns.find(c=>c.count>0);assert.equal(result.totalProjectCount,1);assert.equal(matched.count,1);assert.equal(matched.projects[0].id,'a');assert.equal(matched.collapsed,true);
});
