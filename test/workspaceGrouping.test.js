import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewProjection, normalizeViewDocument, validateViewPatch } from '../src/workspaceViews.js';
const properties = [{ id: 'property:name', type: 'text', system: true }, { id: 'property:status', type: 'select', system: true }, ...['text', 'number', 'date', 'select', 'multi-select'].map(type => ({ id: type, type }))];
const projects = [{ id: 'a', name: 'Alpha', status: { id: 'active' }, propertyValues: { text: ' A\n', number: 0, date: '2026-09-01', select: 'one', 'multi-select': ['two', 'one', 'one'] } }, { id: 'b', name: 'Beta', status: { id: 'active' }, propertyValues: { text: 'A', number: 10, date: '2026-01-01', select: 'two', 'multi-select': ['one'] } }, { id: 'c', name: 'Gamma', propertyValues: { text: 'a', number: 2, date: null, 'multi-select': [] } }];
const selectValues = ['one', 'two', 'unused'].flatMap((id, order) => ['select', 'multi-select'].map(propertyId => ({ id, propertyId, name: id, color: 'orange', order })));
const statusValues = [{ id: 'active', name: 'Active', color: 'blue' }];
const project = (propertyId, setting = {}, extra = {}) => createViewProjection({ view: { viewType: 'table', grouping: { propertyId, ...setting } }, projects, propertyDefinitions: properties, selectValues, statusValues, ...extra }).projection;
test('legacy views remain flat and grouping settings normalize without aliases', () => { assert.equal(normalizeViewDocument({ viewType: 'table' }).grouping, null); const raw = { propertyId: 'number', sort: 'manual', manualOrder: ['number:0', 'number:0'], hiddenGroupIds: ['empty'], collapsedGroupIds: ['number:0'], hideEmpty: true }; const normalized = normalizeViewDocument({ viewType: 'table', grouping: raw }); assert.deepEqual(normalized.grouping, { ...raw, manualOrder: ['number:0'] }); raw.manualOrder.push('number:2'); assert.deepEqual(normalized.grouping.manualOrder, ['number:0']); });
test('grouping accepts hidden existing properties and rejects invalid references and sorts', () => { validateViewPatch({ patch: { grouping: { propertyId: 'number', sort: 'ascending' } }, propertyDefinitions: properties }); assert.throws(() => validateViewPatch({ patch: { grouping: { propertyId: 'missing' } }, propertyDefinitions: properties }), { code: 'INVALID_PROPERTY_REFERENCE' }); assert.throws(() => validateViewPatch({ patch: { grouping: { propertyId: 'number', sort: 'oops' } }, propertyDefinitions: properties }), { code: 'VALIDATION_FAILED' }); });
test('all types use exact typed values, numeric/date ordering and empty last', () => { assert.deepEqual(project('number').groups.map(g => g.id), ['number:0', 'number:2', 'number:10']); assert.deepEqual(project('number', { sort: 'descending' }).groups.map(g => g.id), ['number:10', 'number:2', 'number:0']); assert.deepEqual(project('date').groups.map(g => g.name), ['2026-01-01', '2026-09-01', 'No value']); assert.equal(project('text').groups.length, 3); assert.deepEqual(project('property:name').groups.map(g => g.name), ['Alpha', 'Beta', 'Gamma']); assert.deepEqual(project('property:status').groups.map(g => g.name), ['Active', 'No status']); });
test('catalog order and multi-select membership use unique project IDs without copies', () => { const p = project('multi-select'); assert.deepEqual(p.groups.map(g => g.id), ['value:one', 'value:two', 'value:unused', 'empty']); assert.deepEqual(p.groups.map(g => g.count), [2, 1, 0, 1]); assert.equal(p.totalProjectCount, 3); assert.equal(p.groups[0].rows[0], projects[0]); });
test('filters/search precede counts but preserve unfiltered group universe', () => { const p = project('number', {}, { searchQuery: 'Alpha' }); assert.deepEqual(p.groups.map(g => g.count), [1, 0, 0]); assert.equal(p.totalProjectCount, 1); const tags = project('multi-select', {}, { view: { viewType: 'table', grouping: { propertyId: 'multi-select' }, valueVisibility: { select: { valueIds: ['two'] } } } }); assert.deepEqual(tags.groups.map(g => g.count), [1, 0, 0, 0]); });
test('manual order, visibility, collapse and hide-empty never mutate catalog or projects', () => { const before = JSON.stringify({ projects, selectValues }); const p = project('multi-select', { sort: 'manual', manualOrder: ['value:two', 'value:one'], hiddenGroupIds: ['value:one'], collapsedGroupIds: ['value:two'], hideEmpty: true }); assert.deepEqual(p.groups.map(g => g.id), ['value:two', 'empty']); assert.equal(p.groups[0].collapsed, true); assert.equal(p.groupOptions.find(g => g.id === 'value:one').hidden, true); assert.equal(p.totalProjectCount, 3); assert.equal(JSON.stringify({ projects, selectValues }), before); });
test('deleted grouping property safely disables and reports recovery; deleted values normalize to empty', () => { const p = project('missing'); assert.equal(p.groups, undefined); assert.equal(p.groupingNotice, 'property-removed'); const q = project('select', { manualOrder: ['value:deleted'], hiddenGroupIds: ['value:deleted'] }, { selectValues: selectValues.filter(v => v.id !== 'one') }); assert.equal(q.groupOptions.some(g => g.id === 'value:one'), false); assert.deepEqual(q.groupOptions.find(g => g.id === 'empty').rows.map(p => p.id), ['a', 'c']); });
test('deleted category removes all grouping references while preserving unrelated settings', async () => { const { removeGroupingValue } = await import('../src/workspaceGrouping.js'); assert.deepEqual(removeGroupingValue({ propertyId: 'select', manualOrder: ['value:gone', 'value:one'], hiddenGroupIds: ['value:gone'], collapsedGroupIds: ['value:gone'], hideEmpty: true }, 'gone'), { propertyId: 'select', sort: 'default', manualOrder: ['value:one'], hiddenGroupIds: [], collapsedGroupIds: [], hideEmpty: true }); });
test('categorical ascending and descending sort display labels rather than opaque IDs',()=>{
 const options=selectValues.map(v=>({...v,name:v.id==='one'?'Zulu':v.id==='two'?'Alpha':'Middle'}));
 assert.deepEqual(project('select',{sort:'ascending'},{selectValues:options}).groups.map(g=>g.name),['Alpha','Middle','Zulu','No value']);
 assert.deepEqual(project('select',{sort:'descending'},{selectValues:options}).groups.map(g=>g.name),['Zulu','Middle','Alpha','No value']);
});
test('manual keyboard moves compose against latest saved draft order',async()=>{
 const {moveGroupingGroup}=await import('../src/workspaceGrouping.js');const base={propertyId:'select',sort:'manual',manualOrder:[],hiddenGroupIds:[],collapsedGroupIds:[],hideEmpty:false};
 const first=moveGroupingGroup(base,['a','b','c'],'c',-1);const second=moveGroupingGroup(first,['a','b','c'],'c',-1);
 assert.deepEqual(first.manualOrder,['a','c','b']);assert.deepEqual(second.manualOrder,['c','a','b']);
});
test('filtered duplicate input rows cannot inflate group or workspace counts',()=>{
 const p=project('multi-select',{}, {projects:[projects[0],projects[0],projects[1]]});
 assert.equal(p.totalProjectCount,2);assert.equal(p.groups.find(g=>g.id==='value:one').count,2);
});

test('moves from automatic display order despite retained manual order, preserving independent settings', async () => {
 const {moveGroupingGroup}=await import('../src/workspaceGrouping.js');
 for(const sort of ['default','ascending','descending']) {
  const base={propertyId:'tags',sort,manualOrder:['c','a','b'],hiddenGroupIds:['b'],collapsedGroupIds:['a'],hideEmpty:true};
  const result=moveGroupingGroup(base,['a','b','c','empty'],'c',-1);
  assert.deepEqual(result.manualOrder,['a','c','b']);assert.equal(result.sort,'manual');
  assert.deepEqual(result.hiddenGroupIds,['b']);assert.deepEqual(result.collapsedGroupIds,['a']);assert.equal(result.hideEmpty,true);
  assert.equal(moveGroupingGroup(base,['a','b','c','empty'],'a',-1),base);
  assert.equal(moveGroupingGroup(base,['a','b','c','empty'],'empty',-1),base);
 }
});

test('insertion uses stable IDs, keeps empty last, and returns unchanged settings for cancellation/no-op',async()=>{
 const {reorderGroupingGroup}=await import('../src/workspaceGrouping.js');
 const base={propertyId:'tags',sort:'descending',manualOrder:['a','b','c'],hiddenGroupIds:['b'],collapsedGroupIds:['c'],hideEmpty:true};
 const ids=['c','b','a','empty'];
 assert.equal(reorderGroupingGroup(base,ids,'b','b'),base);
 assert.equal(reorderGroupingGroup(base,ids,'b','a'),base);
 assert.equal(reorderGroupingGroup(base,ids,'a',null),base);
 assert.equal(reorderGroupingGroup(base,ids,'empty','c'),base);
 assert.equal(reorderGroupingGroup(base,ids,'c','empty'),base);
 const moved=reorderGroupingGroup(base,ids,'a','c');
 assert.deepEqual(moved.manualOrder,['a','c','b']);assert.equal(moved.sort,'manual');
 assert.deepEqual(moved.hiddenGroupIds,['b']);assert.deepEqual(moved.collapsedGroupIds,['c']);
 assert.deepEqual(reorderGroupingGroup(moved,ids,'b','c').manualOrder,['a','b','c']);
});
