import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,mkdirSync,realpathSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { openUnconvertedEngineFixture } from './support/unconverted-command-engines.mjs';

test('unconverted engine fixture cannot enable remaining application commands or silently enroll its output',()=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'workspace-engine-boundary-'))),root=join(directory,'source'),path=join(directory,'app.sqlite');mkdirSync(root);
 const fixture=openUnconvertedEngineFixture(path),application=fixture.application,sql=new Database(path);
 try{
  const workspace=application.handleCommand({type:'workspace.create',name:'Boundary',rootPath:root}).value,workspaceId=workspace.workspaceId;
  const preview=application.handleQuery({type:'workspace.previewDiscovery',workspaceId,mode:'direct'}).value;
  const configured=application.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken});assert.equal(configured.ok,true);
  const request={type:'workspace.createProject',workspaceId,mode:'direct',expectedRevision:configured.value.revision,operationId:randomUUID(),name:'Engine-created legacy record'};
  const blocked=application.handleCommand({type:'workspace.renameProject',workspaceId,projectId:randomUUID(),operationId:randomUUID(),expectedRevision:configured.value.revision,name:'Blocked'});assert.equal(blocked.ok,false);assert.equal(blocked.error.code,'identity_update_required');
  const created=fixture.engines.handleCommand(request);assert.equal(created.ok,true);assert.equal(created.value.outcome,'completed');
  const row=sql.prepare('SELECT * FROM projects WHERE id=?').get(created.value.project.projectId);assert.equal(row.durable_evidence,null);
  const displayed=application.handleQuery({type:'workspace.listProjects',workspaceId}).value;
  assert.equal(displayed.projects.length,0);assert.equal(displayed.retainedProjects[0].projectId,row.id);assert.equal(displayed.retainedProjects[0].identityReason,'review_required');
  assert.equal(application.handleCommand({type:'workspace.renameProject',workspaceId,projectId:row.id,operationId:randomUUID(),expectedRevision:displayed.revision,name:'Still blocked'}).error.code,'identity_update_required');
 }finally{sql.close();fixture.engines.close();rmSync(directory,{recursive:true,force:true});}
});
