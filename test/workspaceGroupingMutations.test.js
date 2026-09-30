import test from 'node:test';import assert from 'node:assert/strict';
test('rapid grouping changes merge latest draft, serialize writes and isolate view targets',async()=>{
 const {createGroupingMutationQueue}=await import('../src/workspaceGroupingMutations.js');
 let unblock;const gate=new Promise(resolve=>{unblock=resolve});const saves=[];
 const queue=createGroupingMutationQueue(async(target,grouping)=>{saves.push({target,grouping});if(saves.length===1)await gate;});
 const initial={propertyId:'tags',hiddenGroupIds:[],collapsedGroupIds:[],hideEmpty:false};const a={workspaceId:'a',viewId:'one'},b={workspaceId:'b',viewId:'two'};
 const first=queue.enqueue(a,initial,g=>({...g,hiddenGroupIds:[...g.hiddenGroupIds,'value:a']}));
 const second=queue.enqueue(a,initial,g=>({...g,hiddenGroupIds:[...g.hiddenGroupIds,'value:b'],hideEmpty:true}));
 const third=queue.enqueue(b,initial,g=>({...g,collapsedGroupIds:['empty']}));
 await Promise.resolve();assert.equal(saves.length,1);unblock();await Promise.all([first,second,third]);
 assert.deepEqual(saves[1].grouping.hiddenGroupIds,['value:a','value:b']);assert.equal(saves[1].grouping.hideEmpty,true);assert.deepEqual(saves[2].grouping.hiddenGroupIds,[]);assert.deepEqual(saves[2].target,b);
});
test('resolved save keeps its draft until refreshed view arrives',async()=>{
 const {createGroupingMutationQueue}=await import('../src/workspaceGroupingMutations.js');const saves=[];const queue=createGroupingMutationQueue(async(_,g)=>saves.push(g));const target={workspaceId:'a',viewId:'one'},initial={propertyId:'tags',hiddenGroupIds:[]};
 await queue.enqueue(target,initial,g=>({...g,hiddenGroupIds:['a']}));
 await queue.enqueue(target,initial,g=>({...g,hiddenGroupIds:[...g.hiddenGroupIds,'b']}));
 assert.deepEqual(saves[1].hiddenGroupIds,['a','b']);
 await queue.enqueue(target,{propertyId:'date',hiddenGroupIds:[]},g=>({...g,hideEmpty:true}));
 assert.equal(saves[2].propertyId,'date');assert.deepEqual(saves[2].hiddenGroupIds,[]);
});

test('delayed automatic-to-manual insertions compose while another view and workspace are queued',async()=>{
 const {createGroupingMutationQueue}=await import('../src/workspaceGroupingMutations.js');
 const {reorderGroupingGroup}=await import('../src/workspaceGrouping.js');
 let release;const gate=new Promise(resolve=>{release=resolve});const saves=[];
 const queue=createGroupingMutationQueue(async(target,value)=>{if(!saves.length)await gate;saves.push({target,value});});
 const initial={propertyId:'tags',sort:'ascending',manualOrder:['c','b','a'],hiddenGroupIds:['b'],collapsedGroupIds:['a'],hideEmpty:true};
 const a={workspaceId:'one',viewId:'a'},b={workspaceId:'one',viewId:'b'},c={workspaceId:'two',viewId:'a'};
 const changes=[queue.enqueue(a,initial,g=>reorderGroupingGroup(g,['a','b','c','empty'],'c','a')),queue.enqueue(a,initial,g=>reorderGroupingGroup(g,['a','b','c','empty'],'b','a')),queue.enqueue(b,initial,g=>({...g,hideEmpty:false})),queue.enqueue(c,initial,g=>({...g,collapsedGroupIds:[]}))];
 release();await Promise.all(changes);
 assert.deepEqual(saves[1].value.manualOrder,['c','b','a']);assert.equal(saves[1].value.sort,'manual');
 assert.deepEqual(saves[1].value.hiddenGroupIds,['b']);assert.deepEqual(saves[1].value.collapsedGroupIds,['a']);
 assert.equal(saves[2].value.sort,'ascending');assert.deepEqual(saves[2].target,b);assert.deepEqual(saves[3].target,c);
});

test('intermediate own refresh after the last save resolves cannot discard a newer draft',async()=>{
 const {createGroupingMutationQueue}=await import('../src/workspaceGroupingMutations.js');
 const saves=[];const queue=createGroupingMutationQueue(async(_,g)=>{saves.push(g);return g;});
 const target={workspaceId:'one',viewId:'table'},initial={propertyId:'tags',hiddenGroupIds:[]};
 const first=queue.enqueue(target,initial,g=>({...g,hiddenGroupIds:['a']}));
 const second=queue.enqueue(target,initial,g=>({...g,hiddenGroupIds:[...g.hiddenGroupIds,'b']}));
 await Promise.all([first,second]);
 // UI has save1's projection while save2's projection is still in flight.
 await queue.enqueue(target,saves[0],g=>({...g,collapsedGroupIds:['c']}));
 assert.deepEqual(saves[2].hiddenGroupIds,['a','b']);assert.deepEqual(saves[2].collapsedGroupIds,['c']);
 // Once the final projection is observed, a different external config is a fresh baseline.
 await queue.enqueue(target,saves[2],g=>({...g,hideEmpty:true}));
 await queue.enqueue(target,{propertyId:'date'},g=>({...g,hideEmpty:true}));
 assert.equal(saves[4].propertyId,'date');assert.deepEqual(saves[4].hiddenGroupIds,[]);
});
