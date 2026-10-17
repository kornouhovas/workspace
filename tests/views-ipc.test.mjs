import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServiceProcess } from '../dist/service/entry.cjs';
import { isServiceEvent } from '../src/contracts/service-protocol.ts';

test('built IPC routes view lifecycle commands and validates payloads without partial collections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'views-ipc-')), root = join(directory, 'root'); mkdirSync(root);
  const parent = new EventEmitter(), port = new EventEmitter(), sent = [];
  parent.postMessage = () => {}; port.postMessage = message => sent.push(message); port.close = () => {};
  startServiceProcess(parent); let id = 0;
  const request = input => { port.emit('message', { data: { id: ++id, input } }); assert.equal(sent.at(-1).id, id); return sent.at(-1).result; };
  try {
    parent.emit('message', { data: { type: 'connect', databasePath: join(directory, 'app.sqlite') }, ports: [port] });
    const workspaceId = request({ type: 'workspace.create', rootPath: root, name: 'One' }).value.workspaceId;
    const initial = request({ type: 'workspace.listViews', workspaceId }); assert.equal(initial.ok, true);
    const board = request({ type: 'workspace.createView', workspaceId, name: 'Board', kind: 'board' }); assert.equal(board.ok, true);
    const viewId = board.value.activeViewId;
    assert.equal(request({ type: 'workspace.updateView', workspaceId, viewId, name: 'Overview', kind: 'table' }).ok, true);
    const copy = request({ type: 'workspace.duplicateView', workspaceId, viewId, name: 'Copy' }); assert.equal(copy.ok, true);
    assert.equal(request({ type: 'workspace.setViewLayout', workspaceId, viewId, kind: 'board' }).ok, true);
    assert.equal(request({ type: 'workspace.renameView', workspaceId, viewId, name: 'Renamed' }).ok, true);
    assert.equal(request({ type: 'workspace.reorderViews', workspaceId, viewIds: [...copy.value.views.map(v => v.viewId)].reverse() }).ok, true);
    assert.equal(request({ type: 'workspace.activateView', workspaceId, viewId }).ok, true);
    assert.equal(request({ type: 'workspace.deleteView', workspaceId, viewId: copy.value.activeViewId }).ok, true);
    const groupingConfig = {propertyId:'name',settings:[]};
    assert.equal(request({type:'workspace.setViewGrouping',workspaceId,viewId,config:groupingConfig}).ok,true);
    assert.deepEqual(request({type:'workspace.getViewGrouping',workspaceId,viewId}).value.config,groupingConfig);
    assert.deepEqual(request({type:'workspace.queryView',workspaceId,viewId,archived:false}).value.groups,[]);
    assert.equal(request({type:'workspace.setViewGrouping',workspaceId,viewId,config:{propertyId:null,settings:[],extra:true}}).error.code,'invalid_input');
    assert.equal(request({type:'workspace.getViewGrouping',workspaceId,viewId,extra:true}).error.code,'invalid_input');
    const filterConfig = { search: 'Alpha', rules: [{ propertyId: 'name', operator: 'contains', operand: 'a' }] };
    assert.equal(request({ type: 'workspace.setViewFilter', workspaceId, viewId, config: filterConfig }).ok, true);
    assert.deepEqual(request({ type: 'workspace.getViewFilter', workspaceId, viewId }).value.config, filterConfig);
    assert.deepEqual(request({ type: 'workspace.queryView', workspaceId, viewId, archived: false }).value.projectIds, []);
    const before = request({ type: 'workspace.listViews', workspaceId }), count = sent.length;
    for (const input of [
      { type: 'workspace.setViewFilter', workspaceId, viewId, config: { search: '', rules: [{ propertyId: 'name', operator: 'gt', operand: 0 }] } },
      { type: 'workspace.queryView', workspaceId, viewId, archived: 'false' },
      { type: 'workspace.getViewFilter', workspaceId, viewId, extra: true },
      { type: 'workspace.createView', workspaceId, name: 'Bad', kind: 'grid' },
      { type: 'workspace.duplicateView', workspaceId, viewId, name: 'Bad', extra: true },
      { type: 'workspace.updateView', workspaceId, viewId, name: '', kind: 'board' },
      { type: 'workspace.reorderViews', workspaceId, viewIds: [viewId, viewId] },
      { type: 'workspace.listViews', workspaceId, sourceId: workspaceId },
      { type: 'workspace.deleteView', workspaceId, viewId: 42 },
    ]) assert.equal(request(input).error.code, 'invalid_input');
    assert.deepEqual(request({ type: 'workspace.listViews', workspaceId }), before);
    assert.equal(sent.slice(count).filter(m => m.type === 'workspace.change').length, 0);
    const events = sent.filter(m => m.type === 'workspace.change'); assert.ok(events.length > 0); assert.ok(events.every(isServiceEvent));
  } finally { parent.emit('message', { data: { type: 'shutdown' }, ports: [] }); rmSync(directory, { recursive: true, force: true }); }
});

test('built IPC preserves option labels and repeated logical IDs in selection groups',()=>{
  const directory=mkdtempSync(join(tmpdir(),'selection-groups-ipc-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Project'));
  const parent=new EventEmitter(),port=new EventEmitter(),sent=[];
  parent.postMessage=()=>{};port.postMessage=message=>sent.push(message);port.close=()=>{};
  startServiceProcess(parent);let id=0;
  const request=input=>{port.emit('message',{data:{id:++id,input}});const result=sent.at(-1).result;assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
  try {
    parent.emit('message',{data:{type:'connect',databasePath:join(directory,'app.sqlite')},ports:[port]});
    const {workspaceId,viewId}=request({type:'workspace.create',rootPath:root,name:'One'});
    const call=(type,fields={})=>request({type:`workspace.${type}`,workspaceId,...fields});
    const projectId=call('applyDiscovery',{previewToken:call('previewDiscovery').previewToken}).projects[0].projectId;
    const propertyId=call('createProperty',{name:'Tags',propertyType:'multi_select'}).propertyId;
    const a=call('createSelectOption',{propertyId,name:'A',color:'default'}).snapshot.selectOptions[0].optionId;
    const b=call('createSelectOption',{propertyId,name:'B',color:'default'}).snapshot.selectOptions[1].optionId;
    call('setMultiSelectValue',{projectId,propertyId,optionIds:[a,b]});
    call('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const projection=call('queryView',{viewId,archived:false});
    assert.deepEqual(projection.projectIds,[projectId]);
    assert.deepEqual(projection.groups.map(g=>[g.value,g.label,g.projectIds]),[[a,'A',[projectId]],[b,'B',[projectId]],[null,undefined,[]]]);
    call('updateSelectOption',{propertyId,optionId:b,name:'Renamed',color:'blue'});
    assert.equal(call('queryView',{viewId,archived:false}).groups[1].label,'Renamed');
    assert.ok(sent.filter(m=>m.type==='workspace.change').every(isServiceEvent));
  }finally{parent.emit('message',{data:{type:'shutdown'},ports:[]});rmSync(directory,{recursive:true,force:true});}
});
