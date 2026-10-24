import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServiceProcess } from '../dist/service/entry.cjs';

test('built backend routes group assignment and rejects malformed and stale drops', () => {
  const directory=mkdtempSync(join(tmpdir(),'assignment-ipc-')),root=join(directory,'root');mkdirSync(root);mkdirSync(join(root,'Alpha'));mkdirSync(join(root,'Beta'));
  const parent=new EventEmitter(),port=new EventEmitter(),sent=[];parent.postMessage=()=>{};port.postMessage=m=>sent.push(m);port.close=()=>{};startServiceProcess(parent);
  let id=0;const request=input=>{port.emit('message',{data:{id:++id,input}});assert.equal(sent.at(-1).id,id);return sent.at(-1).result;};
  try {
    parent.emit('message',{data:{type:'connect',databasePath:join(directory,'app.sqlite')},ports:[port]});
    const {workspaceId,viewId}=request({type:'workspace.create',rootPath:root,name:'One'}).value;
    const command=(type,fields={})=>request({type:`workspace.${type}`,workspaceId,...fields});
    const preview=command('previewDiscovery').value;
    const [a,b]=command('applyDiscovery',{previewToken:preview.previewToken}).value.projects;
    const propertyId=command('createProperty',{name:'Notes',propertyType:'text'}).value.propertyId;
    command('setTextValue',{projectId:b.projectId,propertyId,value:'B'});
    command('setViewGrouping',{viewId,config:{propertyId,settings:[]}});
    const drop={viewId,propertyId,projectId:a.projectId,fromKey:'null',toKey:'"B"',archived:false};
    assert.equal(command('assignProjectGroup',drop).ok,true);
    const before=command('listTextProperties'),count=sent.filter(m=>m.type==='workspace.change').length;
    for(const extra of [{},{extra:true},{toKey:42},{archived:'false'}])assert.equal(command('assignProjectGroup',{...drop,...extra}).ok,false);
    assert.deepEqual(command('listTextProperties'),before);
    assert.equal(sent.filter(m=>m.type==='workspace.change').length,count);
    const multi=command('createProperty',{name:'Tags',propertyType:'multi_select'}).value.propertyId;
    for(const name of ['A','B','C']) command('createSelectOption',{propertyId:multi,name,color:'green'});
    const options=command('listTextProperties').value.selectOptions.filter(o=>o.propertyId===multi).map(o=>o.optionId);
    command('setMultiSelectValue',{propertyId:multi,projectId:a.projectId,optionIds:options.slice(0,2)});
    command('setViewGrouping',{viewId,config:{propertyId:multi,settings:[]}});
    const multiDrop={...drop,propertyId:multi,fromKey:JSON.stringify(options[1]),toKey:JSON.stringify(options[2])};
    assert.equal(command('assignProjectGroup',multiDrop).ok,true);
    assert.deepEqual(command('listTextProperties').value.multiSelectValues.map(v=>v.optionId).sort(),[options[0],options[2]].sort());
    const actual=command('listTextProperties');
    assert.equal(command('assignProjectGroup',multiDrop).ok,false);
    assert.deepEqual(command('listTextProperties'),actual);
    command('setViewGrouping',{viewId,config:{propertyId:'name',settings:[]}});
    const collision=command('assignProjectGroup',{...drop,propertyId:'name',fromKey:JSON.stringify(a.name),toKey:JSON.stringify(b.name)});
    assert.equal(collision.ok,true,JSON.stringify(collision));assert.equal(collision.value.filesystem.outcome,'rejected');assert.equal(collision.value.filesystem.problem,'reserved_destination');
    assert.deepEqual(readdirSync(root).sort(),['Alpha','Beta']);assert.deepEqual(command('listTextProperties'),actual);
    assert.equal(command('assignProjectGroup',{...drop,propertyId:'name',fromKey:JSON.stringify(a.name),toKey:'null'}).ok,false);

  } finally {parent.emit('message',{data:{type:'shutdown'},ports:[]});rmSync(directory,{recursive:true,force:true});}
});
