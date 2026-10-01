import test from 'node:test';
import assert from 'node:assert/strict';
import {tableDragDisplacements} from '../src/workspaceDragGeometry.js';

test('downward preview moves every intervening real row by the captured source height', () => {
 const rows=[{height:78},{height:32},{height:112},{height:32}];
 assert.deepEqual(tableDragDisplacements(rows,0,2,true),[0,-78,-78,0]);
});
test('upward preview leaves a source-height gap before the target and restores no-op layouts', () => {
 const rows=[{height:32},{height:112},{height:78},{height:32}];
 assert.deepEqual(tableDragDisplacements(rows,2,0,false),[78,78,0,0]);
 assert.deepEqual(tableDragDisplacements(rows,2,1,true),[0,0,0,0]);
 assert.deepEqual(tableDragDisplacements(rows,2,null,false),[0,0,0,0]);
});
test('Status crossing displaces group headers and gaps along with rows, preserving grid', () => {
 const rows=[{height:32},{height:67},{height:20},{height:32},{height:32},{height:140}];
 assert.deepEqual(tableDragDisplacements(rows,1,5,false),[0,0,-67,-67,-67,0]);
 assert.deepEqual(tableDragDisplacements(rows,5,0,true),[0,140,140,140,140,0]);
});
