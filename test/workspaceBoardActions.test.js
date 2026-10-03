import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewProjection, normalizeViewDocument } from '../src/workspaceViews.js';

test('explicit hidden Board columns preserve rank and full catalog independently of filters',()=>{
 const statusValues=[{id:'a',name:'Active'},{id:'b',name:'Done'}];
 const view={id:'board',workspaceId:'w',viewType:'board',columnOrder:['b','a'],hiddenColumnIds:['b']};
 const project={id:'p',name:'Alpha',status:statusValues[0]};
 const result=createViewProjection({view,projects:[project],statusValues,searchQuery:'no match'});
 assert.deepEqual(result.view.hiddenColumnIds,['b']);
 assert.deepEqual(result.projection.columns.map(c=>c.statusValueId),['a']);
 assert.deepEqual(result.view.columnOrder,['b','a']);
 assert.equal(result.statusValues.length,2);
 const hidden=createViewProjection({view:{...view,hiddenColumnIds:['a','b']},statusValues});
 assert.deepEqual(hidden.projection.columns,[]);
 assert.deepEqual(normalizeViewDocument(view).hiddenColumnIds,['b']);
});
