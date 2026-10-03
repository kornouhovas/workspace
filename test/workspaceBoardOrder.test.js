import test from 'node:test';
import assert from 'node:assert/strict';
import { boardOrderDragGeometry, boardOrderPointerActivated, boardOrderPointerInside, boardOrderPointerIndex, boardOrderScrollSpeed, completeBoardColumnOrder, reorderBoardColumns, createBoardOrderSession } from '../src/workspaceBoardOrder.js';
import { normalizeViewDocument, validateViewPatch, createViewProjection } from '../src/workspaceViews.js';

test('header preview leaves bodies fixed; drop applies whole order immediately and acknowledgement never resets it', () => {
 const session = createBoardOrderSession(['a','b','c']);
 session.start('a'); session.preview(2);
 assert.deepEqual(session.snapshot().headers, ['b','c','a']);
 assert.deepEqual(session.snapshot().bodies, ['a','b','c']);
 const drop = session.drop(true);
 assert.deepEqual(drop.order, ['b','c','a']);
 assert.deepEqual(session.snapshot().bodies, ['b','c','a']);
 assert.equal(session.start('b'), false);
 session.settle(drop.token, true);
 assert.deepEqual(session.snapshot().headers, session.snapshot().bodies);
 assert.deepEqual(session.snapshot().bodies, ['b','c','a']);
});
test('cancel, outside, unchanged and reset discard previews without save; late replies cannot replace another scope', () => {
 for (const cancel of ['cancel','outside','unchanged']) {
  const session = createBoardOrderSession(['a','b','c']); session.start('c');
  if(cancel !== 'unchanged') session.preview(0);
  if(cancel === 'cancel') session.cancel();
  assert.equal(session.drop(cancel !== 'outside'), null);
  assert.deepEqual(session.snapshot().headers, ['a','b','c']);
  assert.deepEqual(session.snapshot().bodies, ['a','b','c']);
 }
 const session = createBoardOrderSession(['a','b']); session.start('a');session.preview(1);
 const drop=session.drop(true);session.reset(['x','y']);session.settle(drop.token,true);
 assert.deepEqual(session.snapshot().bodies,['x','y']);
});
test('save failure restores matching confirmed headers and bodies; moving left across several neighbours works', () => {
 const session=createBoardOrderSession(['a','b','c','d']);session.start('d');session.preview(0);
 const drop=session.drop(true); assert.deepEqual(session.snapshot().bodies,['d','a','b','c']);
 session.settle(drop.token,false);
 assert.deepEqual(session.snapshot().headers,['a','b','c','d']);
 assert.deepEqual(session.snapshot().headers,session.snapshot().bodies);
});
test('filtered reorder retains hidden slots, unavailable identities and appends new status identities stably', () => {
 assert.deepEqual(completeBoardColumnOrder(['c','hidden','a','c'],['a','b','c','new']),['c','hidden','a','b','new']);
 assert.deepEqual(reorderBoardColumns(['a','hidden','b','c'],['a','c'],'c',0),['c','hidden','b','a']);
 assert.equal(reorderBoardColumns(['a','b'],['a','b'],'a',0),null);
});
test('view normalization and projection use independent Board rank without changing status catalog, projects or Table', () => {
 const view={id:'v',workspaceId:'w',viewType:'board',columnOrder:['c','hidden','a']};
 assert.deepEqual(normalizeViewDocument(view).columnOrder,['c','hidden','a']);
 assert.deepEqual(normalizeViewDocument({...view,columnOrder:['c','c',null,2,'a']}).columnOrder,['c','a']);
 const statusValues=['a','b','c','statusValue:no-status'].map(id=>({id,name:id}));
 const projects=['a','b','c','statusValue:no-status'].map(id=>({id:'p-'+id,name:id,status:{id},propertyValues:{}}));
 const before=structuredClone({statusValues,projects});
 const response=createViewProjection({view,projects,statusValues});
 assert.deepEqual(response.projection.columns.map(c=>c.statusValueId),['c','a','b','statusValue:no-status']);
 assert.deepEqual(response.view.columnOrder,['c','hidden','a','b','statusValue:no-status']);
 assert.deepEqual({statusValues,projects},before);
 assert.deepEqual(createViewProjection({view:{...view,viewType:'table'},projects,statusValues}).projection.rows,projects);
});
test('malformed Board order rejected; unknown opaque IDs retained for temporarily unavailable statuses', () => {
 for (const columnOrder of [null,'a',['a','a'],[''],[2]]) assert.throws(()=>validateViewPatch({patch:{columnOrder}}),e=>e.code==='VALIDATION_FAILED' && e.field==='columnOrder');
 assert.doesNotThrow(()=>validateViewPatch({patch:{columnOrder:['opaque-unavailable','statusValue:no-status']}}));
});


test('ordinary click does not activate; horizontal scrolling compensates the pointer index and edge scrolling stops away from edges', () => {
 assert.equal(boardOrderPointerActivated(100,80,103,83),false);
 assert.equal(boardOrderPointerActivated(100,80,106,80),true);
 const rect={left:320,right:1440,top:48,bottom:960};
 assert.equal(boardOrderPointerInside(rect,400,100),true);
 assert.equal(boardOrderPointerInside(rect,400,40),false);
 assert.equal(boardOrderPointerInside(rect,1500,100),false);
 assert.equal(boardOrderScrollSpeed(rect,800),0);
 assert.ok(boardOrderScrollSpeed(rect,330)<0);
 assert.ok(boardOrderScrollSpeed(rect,1430)>0);
 assert.equal(boardOrderPointerIndex(484,0,484,300),0);
 assert.equal(boardOrderPointerIndex(484,600,484,300),2);
 assert.equal(boardOrderPointerIndex(1084,0,484,300),2);
});
test('hidden-only changes cannot start from a missing column and obsolete failures cannot rollback a later successful view', () => {
 const session=createBoardOrderSession(['a','hidden','b'],['a','b']);
 assert.equal(session.start('hidden'),false);
 session.start('b');session.preview(0);const old=session.drop(true);
 session.reset(['x','y']);session.start('y');session.preview(0);const current=session.drop(true);
 assert.equal(session.settle(old.token,false),false);assert.deepEqual(session.snapshot().bodies,['y','x']);
 session.settle(current.token,true);assert.deepEqual(session.snapshot().bodies,['y','x']);
});


test('drag follows fractional pointer movement and scrolling without snapping to insertion slots', () => {
 const origin={startX:180,startY:80,scrollLeft:40,scrollTop:10,sourceIndex:1,step:300};
 const small=boardOrderDragGeometry(origin,192.5,84.25,40,10);
 assert.deepEqual(small,{x:12.5,y:0,index:1});
 assert.deepEqual(boardOrderDragGeometry(origin,192.5,84.25,340,30),{x:312.5,y:0,index:2});
 assert.deepEqual(boardOrderDragGeometry(origin,480,80,40,10),{x:300,y:0,index:2});
 assert.deepEqual(boardOrderDragGeometry(origin,-420,80,40,10),{x:-600,y:0,index:-1});
});
test('insertion follows the dragged centre independent of grab point, neighbours and reverse motion', () => {
 for(const startX of [110,250,390]) {
  const origin={startX,startY:60,scrollLeft:0,scrollTop:0,sourceIndex:0,step:300};
  assert.equal(boardOrderDragGeometry(origin,startX+149,60,0,0).index,0);
  assert.equal(boardOrderDragGeometry(origin,startX+151,60,0,0).index,1);
  assert.equal(boardOrderDragGeometry(origin,startX+751,60,0,0).index,3);
  assert.equal(boardOrderDragGeometry(origin,startX+149,60,0,0).index,0);
 }
});

test('only horizontal displacement activates Board header drag; vertical and steep diagonal gestures below the X threshold stay inactive', () => {
 for(const y of [-1000,0,80,1000]) {
  assert.equal(boardOrderPointerActivated(100,80,100,y),false);
  assert.equal(boardOrderPointerActivated(100,80,105.99,y),false);
  assert.equal(boardOrderPointerActivated(100,80,106,y),true);
  assert.equal(boardOrderPointerActivated(100,80,94,y),true);
 }
});
test('header stays on the Board header line independently of pointer Y and vertical scroll; targets use only X', () => {
 const origin={startX:180,startY:80,scrollLeft:40,scrollTop:10,sourceIndex:1,step:300};
 for(const y of [-500,80,900]) for(const top of [0,10,200]) {
  assert.deepEqual(boardOrderDragGeometry(origin,492.5,y,40,top),{x:312.5,y:0,index:2});
  assert.deepEqual(boardOrderDragGeometry(origin,-132.5,y,40,top),{x:-312.5,y:0,index:0});
 }
});
