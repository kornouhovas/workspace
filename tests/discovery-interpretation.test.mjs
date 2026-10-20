import assert from 'node:assert/strict';
import test from 'node:test';
import {interpretProjects} from '../src/service/discovery.ts';
const identity=(ino,birthtimeNs='100')=>({dev:'1',ino:String(ino),birthtimeNs});
const child=(relativePath,ino,birthtimeNs)=>({relativePath,kind:'directory',identity:identity(ino,birthtimeNs),mtimeNs:'1',ctimeNs:'1'});
const row=(id,relativePath,ino,associationState='active',birthtimeNs)=>({id,relativePath,nativeIdentity:JSON.stringify(identity(ino,birthtimeNs)),associationState});
const scan=children=>({state:'ready',snapshot:{mode:'direct',root:child('',1),children,archiveChild:null},entries:children.filter(c=>c.kind==='directory').map(c=>({kind:'project',relativePath:c.relativePath,name:c.relativePath,reason:null,categoryPath:null}))});

test('a complete thousand-project interpretation retains every logical record in original order without additions or input mutation',()=>{
  const children=Array.from({length:1000},(_,i)=>child(`Project ${i}`,i+2));
  const records=children.map((c,i)=>row(String(i),c.relativePath,i+2));
  const input=scan(children),before=JSON.stringify({input,records});
  const result=interpretProjects(input,records);
  assert.deepEqual(result.retained,records);assert.deepEqual(result.entries,input.entries);assert.deepEqual(result.additions,[]);
  assert.equal(JSON.stringify({input,records}),before);
});

test('replaced same-path history cannot shadow a continuously matching active owner, while new enrollment remains conservative',()=>{
  const records=[row('retired','Alpha',2,'replaced'),row('current','Alpha',2),row('old-other','Other',2,'replaced')];
  const continuous=interpretProjects(scan([child('Alpha',2)]),records);
  assert.deepEqual(continuous.retained,records);assert.deepEqual(continuous.additions,[]);assert.equal(continuous.entries[0].reason,null);
  const fresh=interpretProjects(scan([child('New',2)]),records.filter(r=>r.associationState==='replaced'));
  assert.equal(fresh.entries[0].reason,'unresolved');assert.deepEqual(fresh.additions,[]);
});

test('shared native aliases remain ambiguous across different birth evidence and placements',()=>{
  const result=interpretProjects(scan([child('Alpha',2),child('Beta',2,'200')]),[row('alpha','Alpha',2),row('beta','Beta',2,'active','200')]);
  assert.deepEqual(result.retained.map(r=>r.associationState),['unresolved','unresolved']);
  assert.deepEqual(result.entries.map(r=>r.reason),['unresolved','unresolved']);assert.deepEqual(result.additions,[]);
});

test('missing paths never reattach automatically and placement reservations still block discovery',()=>{
  const moved=interpretProjects(scan([child('New',2)]),[row('old','Old',2)]);
  assert.equal(moved.retained[0].associationState,'missing');assert.equal(moved.entries[0].reason,'unresolved');assert.deepEqual(moved.additions,[]);
  const reserved=interpretProjects(scan([child('Alpha',2)]),[row('alpha','Alpha',2)],[row('pending','Alpha',9)]);
  assert.equal(reserved.retained[0].associationState,'unresolved');assert.equal(reserved.entries[0].reason,'unresolved');assert.deepEqual(reserved.additions,[]);
});
