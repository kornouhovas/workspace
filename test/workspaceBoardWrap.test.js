import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/workspaceBoardLayout.js';
import { normalizeViewDocument, validateViewPatch } from '../src/workspaceViews.js';

test('Board packs whole measured cards downward then right at exact boundaries', () => {
 const result=layout.packBoardCards([88,100,200,30],200,12);
 assert.deepEqual(result.positions,[{segment:0,top:0},{segment:0,top:100},{segment:1,top:0},{segment:2,top:0}]);
 assert.equal(result.segments,3);assert.equal(result.height,200);assert.equal(result.oversized,false);
});
test('Board preserves fractional geometry, empty columns and oversized access', () => {
 assert.equal(layout.packBoardCards([],150,12).segments,1);
 assert.deepEqual(layout.packBoardCards([100.5,99.5],212,12).positions,[{segment:0,top:0},{segment:0,top:112.5}]);
 const tall=layout.packBoardCards([250,40,60],100,12);
 assert.equal(tall.oversized,true);assert.equal(tall.height,250);
 assert.deepEqual(tall.positions,[{segment:0,top:0},{segment:1,top:0},{segment:2,top:0}]);
 assert.equal(layout.packBoardCards([40,40],0,12).segments,2);
});
test('Board reflow preserves all occurrences and order over changing viewport/card dimensions', () => {
 for (const budget of [1,40,100,240,700]) {
  const heights=Array.from({length:50},(_,i)=>40+i*2.5), result=layout.packBoardCards(heights,budget,12);
  assert.equal(result.positions.length,heights.length);
  for(let i=0;i<heights.length;i++) {
   const p=result.positions[i];
   assert.ok(p.top===0||p.top+heights[i]<=budget);
   if(i) {const prev=result.positions[i-1];assert.ok(p.segment>prev.segment || p.segment===prev.segment&&p.top>=prev.top+heights[i-1]+12)}
  }
 }
});
test('Board wrap setting is opt in, preserved and validated independently of width', () => {
 assert.equal(normalizeViewDocument({viewType:'board'}).boardLayout.wrapContent??false,false);
 assert.equal(normalizeViewDocument({viewType:'board',boardLayout:{columnWidth:400,wrapContent:true}}).boardLayout.wrapContent,true);
 assert.equal(normalizeViewDocument({viewType:'board',boardLayout:{wrapContent:'true'}}).boardLayout.wrapContent??false,false);
 assert.doesNotThrow(()=>validateViewPatch({patch:{boardLayout:{wrapContent:true}}}));
 assert.throws(()=>validateViewPatch({patch:{boardLayout:{wrapContent:'true'}}}), e=>e.field==='boardLayout.wrapContent');
});

test('Variable-width Board groups use captured logical insertion slots during scroll', async () => {
 const { boardOrderDragGeometry }=await import('../src/workspaceBoardOrder.js');
 const origin={startX:200,startY:10,scrollLeft:0,scrollTop:0,sourceIndex:0,step:396,slotOffsets:[0,1188,1584]};
 assert.equal(boardOrderDragGeometry(origin,800,90,0,0).index,1);
 assert.equal(boardOrderDragGeometry(origin,1200,90,600,30).index,2);
});
