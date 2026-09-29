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
