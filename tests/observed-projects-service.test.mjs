import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openSettingsService } from "../dist/service/settings.mjs";

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "observed-projects-")), root = join(directory,"root");
  mkdirSync(root); mkdirSync(join(root,"Original")); mkdirSync(join(root,"Other"));
  const path = join(directory,"app.sqlite"); let service = openSettingsService(path);
  const unwrap = result => { assert.equal(result.ok,true,result.ok ? undefined : JSON.stringify(result)); return result.value; };
  const workspace = unwrap(service.handleCommand({type:"workspace.create",rootPath:root,name:"One"}));
  const command = (type, fields={}) => service.handleCommand({type:`workspace.${type}`,workspaceId:workspace.workspaceId,...fields});
  const query = (fields={}) => service.handleQuery({type:"workspace.listProjects",workspaceId:workspace.workspaceId,...fields});
  const preview = unwrap(service.handleQuery({type:"workspace.previewDiscovery",workspaceId:workspace.workspaceId}));
  unwrap(command("applyDiscovery",{previewToken:preview.previewToken}));
  try { run({root,command,query,unwrap,workspace,preview:fields=>service.handleQuery({type:"workspace.previewDiscovery",workspaceId:workspace.workspaceId,...fields}),reopen(){service.close();service=openSettingsService(path);}}); }
  finally { service.close(); rmSync(directory,{recursive:true,force:true}); }
}
test("explicit observed project reads reuse the last complete source observation; default reads and filesystem authorization stay fresh", () => fixture(f => {
  const before = f.unwrap(f.query());
  assert.deepEqual(f.unwrap(f.query({observed:true})), before);
  const project = before.projects.find(p=>p.name==="Original");
  renameSync(join(f.root,"Original"),join(f.root,"External"));
  const observed = f.unwrap(f.query({observed:true}));
  assert.deepEqual(observed,before,"Displayed state explicitly remains the last validated observation");
  assert.ok(f.unwrap(f.query()).retainedProjects.some(p=>p.projectId===project.projectId));
  const denied = f.unwrap(f.command("renameProject",{projectId:project.projectId,operationId:randomUUID(),name:"Unauthorized",expectedRevision:before.revision}));
  assert.equal(denied.outcome,"rejected");
  f.unwrap(f.command("refreshSource"));
  const refreshed = f.unwrap(f.query({observed:true}));
  assert.equal(refreshed.projects.find(p=>p.projectId===project.projectId).name,"External");
  assert.deepEqual(refreshed,f.unwrap(f.query()));
  for (const observed of [false,null,"true",0]) assert.equal(f.query({observed}).error.code,"invalid_input");
  assert.equal(f.query({observed:true,workspaceId:randomUUID()}).error.code,"invalid_input");
}));
test("observed snapshots expire across discovery changes and a service restart reconciles current disk before returning them", () => fixture(f => {
  const initial = f.unwrap(f.query({observed:true}));
  const preview = f.unwrap(f.preview({mode:"direct",excludedRelativePaths:["Other"]}));
  f.unwrap(f.command("applyDiscovery",{previewToken:preview.previewToken}));
  const excluded = f.unwrap(f.query({observed:true}));
  assert.equal(excluded.revision,initial.revision+1);
  assert.deepEqual(excluded,f.unwrap(f.query()));
  assert.ok(excluded.retainedProjects.some(p=>p.name==="Other"&&p.associationState==="excluded"));
  renameSync(join(f.root,"Original"),join(f.root,"After restart"));
  f.reopen();
  const reopened = f.unwrap(f.query({observed:true}));
  assert.equal(reopened.projects.find(p=>p.projectId===initial.projects.find(p=>p.name==="Original").projectId).name,"After restart");
  assert.deepEqual(reopened,f.unwrap(f.query()));
}));
