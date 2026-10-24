import assert from 'node:assert/strict';
import {openUnconvertedEngineFixture} from './unconverted-command-engines.mjs';
import {bindFixtureFolders} from './identity-migration-fixtures.mjs';

/** Arrange known historical recovery, then explicitly enroll it through the current API. */
export function recoverProjectFixture(path,application,workspaceId,projectId,relativePath){
 const quiet={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
 const fixture=openUnconvertedEngineFixture(path,undefined,undefined,quiet);
 try{
  assert.equal(application.handleQuery({type:'workspace.previewProjectRecovery',workspaceId,projectId}).error.code,'identity_update_required');
  const review=fixture.engines.handleQuery({type:'workspace.previewProjectRecovery',workspaceId,projectId});
  assert.equal(review.ok,true,JSON.stringify(review));
  const result=fixture.engines.handleCommand({type:'workspace.reassociateProject',workspaceId,projectId,relativePath,previewToken:review.value.previewToken});
  assert.equal(result.ok,true,JSON.stringify(result));
 }finally{fixture.engines.close();}
 bindFixtureFolders(application,workspaceId,[{kind:'project',id:projectId,relativePath}]);
}
