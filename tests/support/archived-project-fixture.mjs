import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openUnconvertedEngineFixture } from './unconverted-command-engines.mjs';

/** Arrange a historical archived project; assertions use the current application afterwards. */
export function archiveProjectFixture(databasePath,workspaceId,projectId,relativePath='Archive'){
 const quiet={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
 const fixture=openUnconvertedEngineFixture(databasePath,undefined,undefined,quiet),engine=fixture.engines;
 const unwrap=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
 try{
  const denied=fixture.application.handleQuery({type:'workspace.previewProjectArchive',workspaceId,projectId,action:'archive',name:null,createParent:false});
  assert.equal(denied.ok,false);assert.equal(denied.error.code,'identity_update_required');
  const location=unwrap(fixture.application.handleQuery({type:'workspace.previewArchiveLocation',workspaceId,relativePath}));
  unwrap(fixture.application.handleCommand({type:'workspace.applyArchiveLocation',workspaceId,operationId:randomUUID(),previewToken:location.previewToken}));
  const preview=unwrap(engine.handleQuery({type:'workspace.previewProjectArchive',workspaceId,projectId,action:'archive',name:null,createParent:false}));
  const result=unwrap(engine.handleCommand({type:'workspace.applyProjectArchive',workspaceId,operationId:randomUUID(),previewToken:preview.previewToken}));
  assert.equal(result.operation.stage,'completed');return result;
 }finally{engine.close();}
}


/** Restore historical engine placement; current application metadata checks follow. */
export function restoreProjectFixture(databasePath,workspaceId,projectId){
 const fixture=openUnconvertedEngineFixture(databasePath),engine=fixture.engines;
 try{
  const review=engine.handleQuery({type:'workspace.previewProjectArchive',workspaceId,projectId,action:'restore',name:null,createParent:false});
  assert.equal(review.ok,true,JSON.stringify(review));
  const result=engine.handleCommand({type:'workspace.applyProjectArchive',workspaceId,operationId:randomUUID(),previewToken:review.value.previewToken});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.operation.stage,'completed');return result.value;
 }finally{engine.close();}
}
