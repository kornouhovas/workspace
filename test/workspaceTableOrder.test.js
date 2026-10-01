import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTableRowOrder, reorderTableRows } from '../src/workspaceTableOrder.js';
import {createViewProjection,normalizeViewDocument,validateViewPatch} from '../src/workspaceViews.js';
test('visible reorder retains filtered and unavailable identities in their existing slots',()=>{
 assert.deepEqual(reorderTableRows(['a','hidden','b','gone','c'],['a','b','c'],'c','a',false),['c','hidden','a','gone','b']);
 assert.deepEqual(completeTableRowOrder(['gone','a'],['a','b','a']),['gone','a','b']);
});
test('same occurrence/current/outside reorder are no-ops, repeated multi-select IDs stay unique',()=>{
 const ids=['a','b','c'];assert.equal(reorderTableRows(ids,['a','b'],'a','a',false),null);assert.equal(reorderTableRows(ids,['a','b'],'a','outside',false),null);
 assert.deepEqual(reorderTableRows(ids,['a','b','a'],'a','b',true),['b','a','c']);
});
test('Table projection uses saved opaque rank before search and grouping while Board keeps source order',()=>{
 const projects=['a','b','c'].map(id=>({id,name:id,status:{id:'s',name:'Active'},propertyValues:{}}));
 const view={id:'v',workspaceId:'w',viewType:'table',rowOrder:['c','a','b']};
 const response=createViewProjection({view,projects});assert.deepEqual(response.projection.rows.map(p=>p.id),['c','a','b']);assert.deepEqual(response.view.rowOrder,['c','a','b']);
 assert.deepEqual(createViewProjection({view,projects,searchQuery:'b'}).projection.rows.map(p=>p.id),['b']);
 assert.equal(Object.hasOwn(normalizeViewDocument({...view,viewType:'board'}),'rowOrder'),false);
 assert.throws(()=>validateViewPatch({patch:{rowOrder:['a','a']}}),e=>e.code==='VALIDATION_FAILED');
});

test('canonical row rank is shared by Multi-select occurrences and leaves group order independent',()=>{
 const projects=['a','b','c'].map(id=>({id,name:id,propertyValues:{tags:['one','two']}}));
 const view={id:'v',workspaceId:'w',viewType:'table',rowOrder:['c','a','b'],grouping:{propertyId:'tags',sort:'manual',manualOrder:['value:two','value:one']}};
 const response=createViewProjection({view,projects,propertyDefinitions:[{id:'tags',type:'multi-select'}],selectValues:['one','two'].map(id=>({id,name:id,propertyId:'tags'}))});
 assert.deepEqual(response.projection.groups.map(g=>g.id),['value:two','value:one','empty']);for(const group of response.projection.groups.filter(g=>!g.empty))assert.deepEqual(group.rows.map(p=>p.id),['c','a','b']);
});
