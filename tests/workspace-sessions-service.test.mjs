import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-session-'));
  const root = join(directory, 'root'); mkdirSync(root); mkdirSync(join(root, 'Project'));
  const path = join(directory, 'workspace.sqlite'); let service = openSettingsService(path);
  const create = name => service.handleCommand({ type: 'workspace.create', rootPath: root, name }).value;
  const one = create('One'), sibling = create('Sibling');
  const get = (workspaceId = one.workspaceId) => service.handleQuery({ type: 'workspace.getSession', workspaceId });
  const save = (before, state, workspaceId = one.workspaceId) => service.handleCommand({ type: 'workspace.setSession', workspaceId,
    epoch: before.epoch, expectedRevision: before.revision, state });
  try { run({ directory, root, one, sibling, get, save, get service() { return service; },
    reopen() { service.close(); service = openSettingsService(path); } }); }
  finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('workspace layout resumes after real SQLite reopen independently of a sibling over the same source', () => fixture(f => {
  const initial = f.get(); assert.equal(initial.ok, true);
  const sibling = f.get(f.sibling.workspaceId); assert.equal(sibling.ok, true);
  assert.deepEqual(initial.value.state, { tabs: [], expanded: null, previews: {}, sidebarWidth: 220, sidebarCollapsed: false, projectWidth: 360 });
  const state = { ...initial.value.state, sidebarWidth: 280, sidebarCollapsed: true, projectWidth: 480 };
  const saved = f.save(initial.value, state); assert.equal(saved.ok, true);
  f.reopen();
  assert.deepEqual(f.get().value.state, state);
  assert.deepEqual(f.get(f.sibling.workspaceId).value.state, sibling.value.state);
  assert.equal(f.get().value.activeViewId, f.one.viewId);
}));

test('tabs retain logical identities, reject foreign references and obsolete writers without changing stored selection', () => fixture(f => {
  const preview = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId: f.one.workspaceId, mode: 'direct' }).value;
  const project = f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId: f.one.workspaceId, previewToken: preview.previewToken }).value.projects[0];
  const before = f.get().value;
  const state = { ...before.state, tabs: [project.projectId], expanded: project.projectId, previews: { [f.one.viewId]: project.projectId } };
  assert.equal(f.save(before, state).ok, true);
  assert.equal(f.save(before, { ...state, expanded: null }).error.code, 'stale_preview');
  const current = f.get().value;
  assert.equal(f.save(current, { ...state, previews: { [f.sibling.viewId]: project.projectId } }).ok, false);
  assert.equal(f.save(current, { ...state, tabs: ['00000000-0000-4000-8000-000000000001'], expanded: null }).ok, false);
  assert.deepEqual(f.get().value, current);
  f.reopen();
  assert.deepEqual(f.get().value.state, state);
  assert.equal(f.save(current, { ...state, expanded: null }).error.code, 'stale_preview');
}));

test('deleting a view removes only its preview and workspace removal keeps its sibling session', () => fixture(f => {
  const preview = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId: f.one.workspaceId, mode: 'direct' }).value;
  const project = f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId: f.one.workspaceId, previewToken: preview.previewToken }).value.projects[0];
  const boardId = f.service.handleCommand({ type: 'workspace.createView', workspaceId: f.one.workspaceId, name: 'Board', kind: 'board' }).value.activeViewId;
  const before = f.get().value;
  const state = { ...before.state, tabs: [project.projectId], expanded: project.projectId, previews: { [f.one.viewId]: project.projectId, [boardId]: project.projectId } };
  assert.equal(f.save(before, state).ok, true);
  const saved = f.get().value;
  assert.equal(f.service.handleCommand({ type: 'workspace.deleteView', workspaceId: f.one.workspaceId, viewId: boardId }).ok, true);
  assert.deepEqual(f.get().value.state.previews, { [f.one.viewId]: project.projectId });
  assert.equal(f.get().value.activeViewId, f.one.viewId);
  assert.equal(f.save(saved, state).error.code, 'stale_preview');
  const sibling = f.get(f.sibling.workspaceId).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.remove', workspaceId: f.one.workspaceId }).ok, true);
  assert.equal(f.get().ok, false);
  assert.deepEqual(f.get(f.sibling.workspaceId).value, sibling);
}));

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
function corruptExport(content, mutate) {
  const envelope = JSON.parse(content), image = Buffer.from(envelope.database, 'base64'); image[18] = image[19] = 1;
  const db = new Database(image);
  try { mutate(db); const changed = db.serialize(); return JSON.stringify({ ...envelope, database: changed.toString('base64'), checksum: createHash('sha256').update(changed).digest('hex') }); }
  finally { db.close(); }
}
test('backup and export restore sessions with a new writer epoch; invalid session restore preserves current app data', () => fixture(f => {
  const before = f.get().value;
  const saved = f.save(before, { ...before.state, sidebarWidth: 300 }).value;
  const content = f.service.handleQuery({ type: 'data.export' }).value.content;
  const backup = f.service.handleCommand({ type: 'data.backupNow' }); assert.equal(backup.ok, true);
  const backupContent = f.service.handleQuery({ type: 'data.backupExport', backupId: backup.value.backups.snapshots[0].id }).value.content;
  assert.equal(f.save(saved, { ...saved.state, projectWidth: 500 }).ok, true);
  const current = f.get().value;
  for (const mutate of [
    db => db.prepare('UPDATE workspace_sessions SET state=? WHERE workspace_id=?').run(JSON.stringify({ ...saved.state, tabs: ['00000000-0000-4000-8000-000000000001'] }), f.one.workspaceId),
    db => db.prepare('UPDATE workspace_sessions SET state=? WHERE workspace_id=?').run(JSON.stringify({ ...saved.state, previews: { [f.sibling.viewId]: null } }), f.one.workspaceId),
    db => db.prepare('UPDATE workspace_sessions SET state=? WHERE workspace_id=?').run(JSON.stringify({ ...saved.state, projectWidth: 1 }), f.one.workspaceId),
    db => db.prepare('DELETE FROM workspace_sessions WHERE workspace_id=?').run(f.one.workspaceId),
  ]) {
    assert.equal(f.service.handleCommand({ type: 'data.restore', content: corruptExport(content, mutate) }).ok, false);
    assert.deepEqual(f.get().value, current);
  }
  for (const snapshot of [content, backupContent]) {
    assert.equal(f.service.handleCommand({ type: 'data.restore', content: snapshot }).ok, true);
    assert.deepEqual(f.get().value.state, saved.state);
    assert.equal(f.save(saved, saved.state).error.code, 'stale_preview');
  }
}));

import { cpSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
test('populated pre-session schema upgrades without losing properties, views or settings and keeps a matching pre-migration backup', () => {
  const directory=mkdtempSync(join(tmpdir(),'session-upgrade-')), root=join(directory,'root'), path=join(directory,'app.sqlite');mkdirSync(root);mkdirSync(join(root,'Project'));
  const old=join(directory,'old');cpSync('src/service/db/migrations',old,{recursive:true});
  const journalPath=join(old,'meta/_journal.json'), journal=JSON.parse(readFileSync(journalPath,'utf8'));journal.entries=journal.entries.slice(0,23);writeFileSync(journalPath,JSON.stringify(journal));
  let service=openSettingsService(path,old);
  try {
    const one=service.handleCommand({type:'workspace.create',rootPath:root,name:'Before'}).value;
    const query=(type, fields={})=>service.handleQuery({type:`workspace.${type}`,workspaceId:one.workspaceId,...fields}).value;
    const command=(type,fields={})=>service.handleCommand({type:`workspace.${type}`,workspaceId:one.workspaceId,...fields}).value;
    const project=command('applyDiscovery',{previewToken:query('previewDiscovery').previewToken}).projects[0];
    const property=command('createProperty',{name:'Notes',propertyType:'text'}).propertyId;
    command('setTextValue',{projectId:project.projectId,propertyId:property,value:' exact\nТекст '});
    command('createView',{name:'Board',kind:'board'});service.handleCommand({type:'settings.setLanguage',language:'ru'});
    const properties=query('listTextProperties'), views=query('listViews');
    service.close();service=openSettingsService(path);
    assert.deepEqual(query('listTextProperties'),properties);assert.deepEqual(query('listViews'),views);
    assert.equal(service.handleQuery({type:'settings.load'}).value.language,'ru');
    assert.equal(query('getSession').activeViewId,views.activeViewId);
    assert.deepEqual(query('getSession').state.tabs,[]);
    const backup=service.handleQuery({type:'data.backups'}).value.backups.snapshots.find(s=>s.kind==='pre-migration');assert.ok(backup);
    const snapshot=service.handleQuery({type:'data.backupExport',backupId:backup.id});assert.equal(snapshot.ok,true);
    const previous=openSettingsService(join(directory,'previous.sqlite'),old);
    try { assert.equal(previous.handleCommand({type:'data.restore',content:snapshot.value.content}).ok,true);assert.deepEqual(previous.handleQuery({type:'workspace.listTextProperties',workspaceId:one.workspaceId}).value,properties); }
    finally{previous.close();}
  } finally{service.close();rmSync(directory,{recursive:true,force:true});}
});

for(const availability of ['missing','excluded','archived','unavailable-source']) test(`retained ${availability} project resumes by logical ID with current metadata`,()=>fixture(f=>{
 const workspaceId=f.one.workspaceId;
 const call=(type,fields={})=>{const result=f.service[/^(list|get|preview)/.test(type)?'handleQuery':'handleCommand']({type:`workspace.${type}`,workspaceId,...fields});assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
 const projectId=call('applyDiscovery',{previewToken:call('previewDiscovery',{mode:'direct'}).previewToken}).projects[0].projectId;
 const propertyId=call('createProperty',{name:'Notes',propertyType:'text'}).propertyId;
 call('setTextValue',{propertyId,projectId,value:'Before'});
 const before=f.get().value, state={...before.state,tabs:[projectId],expanded:projectId,previews:{[f.one.viewId]:projectId}};
 assert.equal(f.save(before,state).ok,true);call('setTextValue',{propertyId,projectId,value:'Current'});
 if(availability==='missing')rmSync(join(f.root,'Project'),{recursive:true});
 if(availability==='excluded')call('applyDiscovery',{previewToken:call('previewDiscovery',{mode:'direct',excludedRelativePaths:['Project']}).previewToken});
 if(availability==='archived'){
  const location=call('previewArchiveLocation',{relativePath:'Archive'});call('applyArchiveLocation',{previewToken:location.previewToken,operationId:crypto.randomUUID()});
  const archive=call('previewProjectArchive',{projectId,action:'archive',name:null,createParent:false});call('applyProjectArchive',{previewToken:archive.previewToken,operationId:crypto.randomUUID()});
 }
 if(availability==='unavailable-source')renameSync(f.root,join(f.directory,'offline'));
 f.reopen();assert.deepEqual(f.get().value.state,state);
 assert.equal(call('listTextProperties').values.find(v=>v.projectId===projectId&&v.propertyId===propertyId).value,'Current');
 if(availability==='archived')assert.equal(call('listArchivedProjects').projects[0].projectId,projectId);
 else {const list=call('listProjects');if(availability==='unavailable-source')assert.equal(list.state,'unavailable');else assert.equal(list.retainedProjects.find(p=>p.projectId===projectId).resolution,availability);}
}));

test('malformed session payloads, duplicate tabs, split states, foreign-source projects and out-of-bound sizes preserve the saved session',()=>fixture(f=>{
 const foreignRoot=join(f.directory,'foreign');mkdirSync(foreignRoot);mkdirSync(join(foreignRoot,'Foreign'));
 const foreign=f.service.handleCommand({type:'workspace.create',rootPath:foreignRoot,name:'Foreign'}).value;
 const preview=f.service.handleQuery({type:'workspace.previewDiscovery',workspaceId:foreign.workspaceId,mode:'direct'}).value;
 const foreignProject=f.service.handleCommand({type:'workspace.applyDiscovery',workspaceId:foreign.workspaceId,previewToken:preview.previewToken}).value.projects[0].projectId;
 const before=f.get().value;
 for(const state of [null,[],{...before.state,sidebarWidth:Infinity},{...before.state,projectWidth:601},{...before.state,sidebarCollapsed:'true'},
  {...before.state,tabs:[foreignProject]}, {...before.state,tabs:[foreignProject,foreignProject]}, {...before.state,expanded:foreignProject}, {...before.state,split:[]}]){
  assert.equal(f.save(before,state).error.code,'invalid_input');assert.deepEqual(f.get().value,before);
 }
}));
