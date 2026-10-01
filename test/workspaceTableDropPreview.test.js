import test from 'node:test';
import assert from 'node:assert/strict';
import { tableDropSections } from '../src/workspaceTableDropPreview.js';
const p=id=>({id});
test('pending same-group placement preserves the displayed rank across stale and refreshed responses',()=>{
 const sections=[{id:'flat',rows:['a','b','c','hidden'].map(p),count:4}];
 const drop={projectId:'c',sourceGroupId:'flat',targetGroupId:'flat',order:['c','a','b','hidden']};
 assert.deepEqual(tableDropSections(sections,drop)[0].rows.map(p=>p.id),['c','a','b','hidden']);
 assert.deepEqual(tableDropSections([{...sections[0],rows:['c','a','b','hidden'].map(p)}],drop)[0].rows.map(p=>p.id),['c','a','b','hidden']);
 assert.deepEqual(sections[0].rows.map(p=>p.id),['a','b','c','hidden']);
});
test('pending safe Status placement survives intermediate membership refresh including empty target',()=>{
 const drop={projectId:'b',sourceGroupId:'active',targetGroupId:'empty',order:['a','b','c']};
 const before=[{id:'active',rows:[p('a'),p('b')],count:2},{id:'empty',rows:[],count:0},{id:'done',rows:[p('c')],count:1}];
 const pending=tableDropSections(before,drop);
 assert.deepEqual(pending.map(s=>s.rows.map(p=>p.id)),[['a'],['b'],['c']]);
 assert.deepEqual(pending.map(s=>s.count),[1,1,1]);
 assert.deepEqual(tableDropSections(pending,drop).map(s=>s.rows.map(p=>p.id)),[['a'],['b'],['c']]);
});
test('Multi-select occurrences retain membership and share one pending rank',()=>{
 const sections=[{id:'red',rows:[p('a'),p('b')]},{id:'blue',rows:[p('a'),p('b'),p('c')]}];
 assert.deepEqual(tableDropSections(sections,{projectId:'b',sourceGroupId:'red',targetGroupId:'red',order:['b','a','c']}).map(s=>s.rows.map(p=>p.id)),[['b','a'],['b','a','c']]);
 assert.equal(tableDropSections(sections,null),sections);
});
test('pending Status placement respects hide-empty when the only source row moves',()=>{
 const sections=[{id:'source',rows:[p('a')],count:1},{id:'target',rows:[p('b')],count:1}];
 assert.deepEqual(tableDropSections(sections,{projectId:'a',sourceGroupId:'source',targetGroupId:'target',order:['a','b'],hideEmptyGroups:true}).map(s=>({id:s.id,rows:s.rows.map(p=>p.id)})),[{id:'target',rows:['a','b']}]);
});
test('a scaled CSS transition keeps its original timeline and ends at the new natural slot',async()=>{
 const {tableDropTransitionValues}=await import('../src/workspaceTableDropPreview.js');
 assert.deepEqual(tableDropTransitionValues([0,254],127,0.2,25.4,127),[-127,0]);
});
test('an unfinished return-to-zero transition normalizes from its computed CSS position',async()=>{
 const {tableDropTransitionValues}=await import('../src/workspaceTableDropPreview.js');
 assert.deepEqual(tableDropTransitionValues([254,0],0,0.25,95.25,0),[127,0]);
});
