import assert from 'node:assert/strict';
import test from 'node:test';
import {createPerformanceQueries} from '../scripts/runtime-performance-queries.mjs';

test('metadata checks use the complete validated source projection and filesystem checks explicitly leave that phase',()=>{
  const inputs=[],reply={value:'unchanged'};
  const checks=createPerformanceQueries('workspace',{revision:7,projects:[{projectId:'active'}],retainedProjects:[{projectId:'retained'}]},input=>{inputs.push(input);return reply;});
  assert.equal(checks.query('queryView',{viewId:'table',archived:false}),reply);
  assert.deepEqual(inputs[0],{type:'workspace.queryView',workspaceId:'workspace',viewId:'table',archived:false,projection:{revision:7,projectIds:['active','retained']}});
  checks.query('listTextProperties');assert.deepEqual(inputs[1],{type:'workspace.listTextProperties',workspaceId:'workspace'});
  checks.beginFilesystemPhase();checks.query('queryView',{viewId:'board',archived:false});
  assert.deepEqual(inputs[2],{type:'workspace.queryView',workspaceId:'workspace',viewId:'board',archived:false});
  assert.equal(inputs.length,3);
});

test('query preparation never retries a failed public read',async()=>{
  let count=0;const failure=new Error('read failed');
  const checks=createPerformanceQueries('workspace',{revision:1,projects:[{projectId:'one'}]},()=>{count++;return Promise.reject(failure);});
  await assert.rejects(checks.query('queryView',{viewId:'table',archived:false}),error=>error===failure);
  assert.equal(count,1);
});
