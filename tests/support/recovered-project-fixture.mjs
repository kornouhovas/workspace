import assert from 'node:assert/strict';

/** Recover through the converted production API; no legacy engine or backfill. */
export function recoverProjectFixture(_path,application,workspaceId,projectId,relativePath){
 const review=application.handleQuery({type:'workspace.previewProjectRecovery',workspaceId,projectId});
 assert.equal(review.ok,true,JSON.stringify(review));
 const result=application.handleCommand({type:'workspace.reassociateProject',workspaceId,projectId,relativePath,previewToken:review.value.previewToken});
 assert.equal(result.ok,true,JSON.stringify(result));
}
