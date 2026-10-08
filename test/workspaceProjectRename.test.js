import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceIpcHandler } from '../electron/workspaceIpc.js';

async function fixture(t, hooks = {}) {
 const dir = await mkdtemp(join(tmpdir(), 'workspace-rename-'));
 t.after(() => rm(dir, { recursive:true, force:true }));
 const root = join(dir,'source'); await mkdir(join(root,'Active','Alpha','docs'),{recursive:true});
 await writeFile(join(root,'Active','Alpha','docs','plan.txt'),'retained');
 const options={configPath:join(dir,'settings.json'),propertyStorePath:join(dir,'properties.json'),viewStorePath:join(dir,'views.json'),chooseRoot:async()=>root,renameTestHooks:hooks};
 const handler=createWorkspaceIpcHandler(options);const {root:selected}=await handler(null,'workspace.setRoot',{});
 const workspaceId=selected.workspaceId;const call=(method,payload={})=>handler(null,`workspace.${method}`,{workspaceId,...payload});
 const {projection}=await call('getViewProjection',{viewId:'view:default-table'}); const project=projection.rows[0];
 return {root,options,call,workspaceId,project};
}

test('rename physically retains project identity, values, history, roles and shared source after restart',async t=>{
 const f=await fixture(t);const id=f.project.id;
 await f.call('createProperty',{propertyId:'property:notes',name:'Notes',type:'text'});
 await f.call('updateProjectPropertyValue',{projectId:id,propertyId:'property:notes',value:'same'});
 await f.call('updateFolderRole',{path:'Active/Alpha/docs',role:'group'});
 const sibling=(await f.call('createWorkspace',{name:'Sibling'})).workspace.id;
 const before=await readFile(f.options.propertyStorePath,'utf8');
 const result=await f.call('renameProject',{projectId:id,name:'Бета 🗂'});
 assert.equal(result.state,'completed');assert.equal(result.projectId,id);assert.equal(result.to,'Active/Бета 🗂');
 await assert.rejects(lstat(join(f.root,'Active/Alpha')),{code:'ENOENT'});
 assert.equal(await readFile(join(f.root,result.to,'docs/plan.txt'),'utf8'),'retained');
 assert.equal(await readFile(f.options.propertyStorePath,'utf8'),before);
 const restarted=createWorkspaceIpcHandler(f.options);
 for(const workspaceId of [f.workspaceId,sibling]){
 const {project}=await restarted(null,'workspace.getProject',{workspaceId,projectId:id});
 assert.equal(project.name,'Бета 🗂');assert.equal(project.currentRelativePath,result.to);assert.equal(project.status.id,f.project.status.id);assert.equal(project.propertyValues['property:notes'],'same');
 }
 await mkdir(join(f.root,'Active/Alpha'));
 const {projection}=await f.call('getViewProjection',{viewId:'view:default-table'});
 const occupant=projection.rows.find(p=>p.currentRelativePath==='Active/Alpha');assert.notEqual(occupant.id,id);assert.equal(occupant.propertyValues['property:notes'],undefined);
});

test('unchanged name is a no-op and malformed/conflicting names never mutate disk',async t=>{
 const f=await fixture(t);const ino=(await lstat(join(f.root,'Active/Alpha'))).ino;
 assert.equal((await f.call('renameProject',{projectId:f.project.id,name:'Alpha'})).state,'unchanged');
 for(const name of ['', ' ', '..','../escaped','a/b','a\\b','a\0b']) await assert.rejects(f.call('renameProject',{projectId:f.project.id,name}),{code:'INVALID_PROJECT_NAME'});
 await writeFile(join(f.root,'Active/occupied'),'foreign');
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'occupied'}),{code:'PROJECT_NAME_CONFLICT'});
 assert.equal((await lstat(join(f.root,'Active/Alpha'))).ino,ino);assert.equal(await readFile(join(f.root,'Active/occupied'),'utf8'),'foreign');
});

test('case-only rename and long-name error retain inode and contents',async t=>{
 const f=await fixture(t);const ino=(await lstat(join(f.root,'Active/Alpha'))).ino;
 const result=await f.call('renameProject',{projectId:f.project.id,name:'alpha'});assert.equal(result.state,'completed');assert.equal((await lstat(join(f.root,'Active/alpha'))).ino,ino);
 assert.equal((await f.call('getProject',{projectId:f.project.id})).project.name,'alpha');
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'x'.repeat(300)}));
 assert.equal(await readFile(join(f.root,'Active/alpha/docs/plan.txt'),'utf8'),'retained');
});

for(const phase of ['beforeStage','afterStage','beforeFinalize','afterFinalize','afterMetadataCommit'])test(`restart recovers interruption at ${phase}`,async t=>{
 const f=await fixture(t,{[phase]:async()=>{throw Object.assign(new Error('interrupted'),{simulateCrash:true})}});
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'Beta'}),/interrupted/);
 const restart=createWorkspaceIpcHandler({...f.options,renameTestHooks:{}});
 const {project}=await restart(null,'workspace.getProject',{workspaceId:f.workspaceId,projectId:f.project.id});
 assert.equal(project.name,['afterFinalize','afterMetadataCommit'].includes(phase)?'Beta':'Alpha');
 assert.equal(await readFile(join(f.root,project.currentRelativePath,'docs/plan.txt'),'utf8'),'retained');
 assert.equal(JSON.parse(await readFile(f.options.configPath,'utf8')).projectRename,undefined);
});

test('repeat rename and simultaneous status move are rejected while pending',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const f=await fixture(t,{beforeStage:async()=>{entered();await gate}});
 const renaming=f.call('renameProject',{projectId:f.project.id,name:'Beta'});await started;
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'Other'}),{code:'PROJECT_MOVE_PENDING'});
 await assert.rejects(f.call('moveProjectStatus',{projectId:f.project.id,statusValueId:f.project.status.id}),{code:'PROJECT_MOVE_PENDING'});
 release();assert.equal((await renaming).state,'completed');
});

test('native IPC registration preserves structured rename failure codes for renderer localization',async t=>{
 const f=await fixture(t);const {registerWorkspaceIpc}=await import('../electron/workspaceIpc.js');let registered;
 registerWorkspaceIpc({handle:(_channel,handler)=>registered=handler},f.options);
 const result=await registered(null,'workspace.renameProject',{workspaceId:f.workspaceId,projectId:f.project.id,name:'../escape'});
 assert.equal(result.state,'failed');assert.equal(result.error.code,'INVALID_PROJECT_NAME');assert.match(result.error.message,/folder name/);
});

test('rename preserves saved row order and all shared source role snapshots',async t=>{
 const f=await fixture(t);const sibling=(await f.call('createWorkspace',{name:'Shared'})).workspace.id;
 await f.call('updateFolderRole',{path:'Active/Alpha/docs',role:'group'});
 await f.call('updateFolderRole',{workspaceId:sibling,path:'Active/Alpha/docs',role:'group'});
 await f.call('updateView',{viewId:'view:default-table',patch:{rowOrder:['retained:hidden',f.project.id]}});
 const views=await readFile(f.options.viewStorePath,'utf8');
 await f.call('renameProject',{projectId:f.project.id,name:'Beta'});
 assert.equal(await readFile(f.options.viewStorePath,'utf8'),views);
 const settings=JSON.parse(await readFile(f.options.configPath,'utf8'));
 for(const id of [f.workspaceId,sibling]) {const rules=settings.workspaceSources[id].rulesByRoot[f.root];assert.equal(rules['Active/Beta/docs'].role,'group');assert.equal(rules['Active/Alpha/docs'],undefined);}
});

test('external source symlink substitution is retained and blocks recovery without renaming foreign data',async t=>{
 const {rename,symlink}=await import('node:fs/promises');let original;
 const f=await fixture(t,{beforeStage:async j=>{original=join(j.rootPath,j.from)+'-original';await rename(join(j.rootPath,j.from),original);await symlink(f.root,join(j.rootPath,j.from));}});
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'Beta'}),{code:'RENAME_RECOVERY_REQUIRED'});
 assert.equal(await readFile(join(original,'docs/plan.txt'),'utf8'),'retained');
 await assert.rejects(lstat(join(f.root,'Active/Beta')),{code:'ENOENT'});
 assert.ok(JSON.parse(await readFile(f.options.configPath,'utf8')).projectRename);
});

test('foreign target created after staging is never replaced and retains recovery journal',async t=>{
 const f=await fixture(t,{beforeFinalize:async j=>{await mkdir(join(j.rootPath,j.to));await writeFile(join(j.rootPath,j.to,'foreign'),'untouched')}});
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'Beta'}),{code:'RENAME_RECOVERY_REQUIRED'});
 const j=JSON.parse(await readFile(f.options.configPath,'utf8')).projectRename;
 assert.equal(await readFile(join(f.root,'Active/Beta/foreign'),'utf8'),'untouched');assert.equal(await readFile(join(f.root,j.stage,'docs/plan.txt'),'utf8'),'retained');
});

test('replaced same-source parent is rejected before any rename mutation',async t=>{
 const {rename}=await import('node:fs/promises');
 const f=await fixture(t,{beforeStage:async j=>{await rename(join(j.rootPath,j.parent),join(j.rootPath,j.parent+'-retained'));await mkdir(join(j.rootPath,j.parent));await rename(join(j.rootPath,j.parent+'-retained','Alpha'),join(j.rootPath,j.parent,'Alpha'));}});
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'Beta'}),{code:'RENAME_RECOVERY_REQUIRED'});
 assert.equal(await readFile(join(f.root,'Active/Alpha/docs/plan.txt'),'utf8'),'retained');await assert.rejects(lstat(join(f.root,'Active/Beta')),{code:'ENOENT'});
});

test('persistent metadata failure after physical rename exposes new locator as explicit recovery error',async t=>{
 const f=await fixture(t);const {writeWorkspaceSettings}=await import('../src/workspaceBackend.js');
 const handler=createWorkspaceIpcHandler({...f.options,renameWriteSettings:async(path,settings)=>{
  if(settings.projectRename?.phase==='committed')throw Object.assign(new Error('metadata unavailable'),{code:'EIO'});
  return writeWorkspaceSettings(path,settings);
 }});
 const result=await handler(null,'workspace.renameProject',{workspaceId:f.workspaceId,projectId:f.project.id,name:'Beta'});
 assert.equal(result.state,'recovery-required');assert.equal(result.project.name,'Beta');assert.equal(result.project.currentRelativePath,'Active/Beta');assert.deepEqual(result.project.fileTree,[]);
 assert.equal(await readFile(join(f.root,'Active/Beta/docs/plan.txt'),'utf8'),'retained');
 assert.ok(JSON.parse(await readFile(f.options.configPath,'utf8')).projectRename);
 const restart=createWorkspaceIpcHandler(f.options);assert.equal((await restart(null,'workspace.getProject',{workspaceId:f.workspaceId,projectId:f.project.id})).project.name,'Beta');
});

test('replaced staged project never gets original identity or metadata and retains all folders',async t=>{
 const {rename}=await import('node:fs/promises');let original;
 const f=await fixture(t,{beforeFinalize:async j=>{original=join(j.rootPath,j.stage)+'-retained';await rename(join(j.rootPath,j.stage),original);await mkdir(join(j.rootPath,j.stage));await writeFile(join(j.rootPath,j.stage,'foreign'),'untouched')}});
 const properties=await readFile(f.options.propertyStorePath,'utf8').catch(()=>null);
 await assert.rejects(f.call('renameProject',{projectId:f.project.id,name:'Beta'}),{code:'RENAME_RECOVERY_REQUIRED'});
 const settings=JSON.parse(await readFile(f.options.configPath,'utf8'));const j=settings.projectRename;
 assert.equal(await readFile(join(original,'docs/plan.txt'),'utf8'),'retained');assert.equal(await readFile(join(f.root,j.stage,'foreign'),'utf8'),'untouched');
 assert.equal(settings.projectLocators?.[j.sourceId]?.[f.project.id],undefined);
 assert.equal(await readFile(f.options.propertyStorePath,'utf8').catch(()=>null),properties);
 const restart=createWorkspaceIpcHandler(f.options);await assert.rejects(restart(null,'workspace.getProject',{workspaceId:f.workspaceId,projectId:f.project.id}),{code:'RENAME_RECOVERY_REQUIRED'});
});
