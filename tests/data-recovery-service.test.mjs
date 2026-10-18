import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };

test('a live WAL export restores multiple workspaces, exact Text, independent views and language after reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'data-recovery-')), path = join(dir, 'app.sqlite'), root = join(dir, 'root');
  mkdirSync(root); mkdirSync(join(root, 'Project'));
  let service = openSettingsService(path);
  try {
    const a = unwrap(service.handleCommand({ type: 'workspace.create', rootPath: root, name: 'One' }));
    const b = unwrap(service.handleCommand({ type: 'workspace.create', rootPath: root, name: 'Two' }));
    const workspaceId = a.workspaceId;
    const cmd = (type, fields = {}) => unwrap(service.handleCommand({ type: `workspace.${type}`, workspaceId, ...fields }));
    const query = (type, fields = {}) => unwrap(service.handleQuery({ type: `workspace.${type}`, workspaceId, ...fields }));
    const projectId = cmd('applyDiscovery', { previewToken: query('previewDiscovery').previewToken }).projects[0].projectId;
    const propertyId = cmd('createProperty', { name: 'Notes', propertyType: 'text' }).propertyId;
    cmd('setTextValue', { projectId, propertyId, value: ' exact\nТекст ' });
    const board = cmd('createView', { name: 'Board', kind: 'board' });
    for (const propertyType of ['number','date','single_select','multi_select']) {
      const property = cmd('createProperty', {name: propertyType,propertyType}).propertyId;
      if (propertyType === 'number') cmd('setNumberValue',{projectId,propertyId:property,expression:'2+3'});
      if (propertyType === 'date') cmd('setDateValue',{projectId,propertyId:property,value:'2026-10-18'});
      if (propertyType.includes('select')) {
        const option = cmd('createSelectOption',{propertyId:property,name:'Ready',color:'blue'}).snapshot.selectOptions.find(o=>o.propertyId===property);
        cmd(propertyType==='single_select'?'setSelectValue':'setMultiSelectValue',{projectId,propertyId:property,...(propertyType==='single_select'?{optionId:option.optionId}:{optionIds:[option.optionId]})});
      }
    }
    cmd('setViewFilter',{viewId:a.viewId,config:{search:'Project',rules:[]}});
    cmd('setTableLayout',{viewId:a.viewId,config:{columns:[{propertyId,hidden:true,width:240,wrap:false}],rowOrder:[projectId]}});
    const otherRoot=join(dir,'other');mkdirSync(otherRoot);
    const c=unwrap(service.handleCommand({type:'workspace.create',rootPath:otherRoot,name:'Other source'}));
    const layout=query('getTableLayout',{viewId:a.viewId});
    const filter=query('getViewFilter',{viewId:a.viewId});
    const siblingViews=unwrap(service.handleQuery({type:'workspace.listViews',workspaceId:b.workspaceId}));
    assert.ok(board.views.some(v=>v.kind==='board'));
    unwrap(service.handleCommand({ type: 'settings.setLanguage', language: 'ru' }));
    const creation = cmd('createProject',{operationId:randomUUID(),name:'Created',mode:'direct',expectedRevision:query('listProjects').revision});
    assert.equal(creation.outcome,'completed');
    const receipt = query('getProjectCreation',{operationId:creation.operation.operationId});
    const before = query('listTextProperties'), views = query('listViews');
    const { content } = unwrap(service.handleQuery({ type: 'data.export' }));
    cmd('setTextValue', { projectId, propertyId, value: 'changed' });
    const changeType = (db, type, replacement) => {
      const trigger=db.prepare("SELECT sql FROM sqlite_schema WHERE name='property_type_immutable'").get().sql;
      db.exec('DROP TRIGGER property_type_immutable');
      db.prepare('UPDATE property_definitions SET property_type=? WHERE property_type=?').run(replacement,type);
      db.exec(trigger);
    };
    for (const corrupt of [
      ...['text','number','date','single_select','multi_select'].map(type => db => changeType(db,type,type==='text'?'number':'text')),
      db => {
        const trigger=db.prepare("SELECT sql FROM sqlite_schema WHERE name='select_visibility_owner_insert'").get().sql;
        db.exec('DROP TRIGGER select_visibility_owner_insert');
        const optionId=db.prepare('SELECT id FROM select_options LIMIT 1').get().id;
        db.prepare('INSERT INTO select_option_visibility(workspace_id,option_id,hidden) VALUES(?,?,1)').run(c.workspaceId,optionId);
        db.exec(trigger);
      },
      db => {
        const trigger=db.prepare("SELECT sql FROM sqlite_schema WHERE name='grouped_project_update'").get().sql;
        db.exec('DROP TRIGGER grouped_project_update');
        db.prepare('UPDATE projects SET relative_path=? WHERE id=?').run('Nested/Project',projectId);
        db.exec(trigger);
      },
      db => db.exec("UPDATE views SET board_config='[]'"),
      db => db.exec("UPDATE sources SET excluded_relative_paths='null'"),
      db => db.prepare("UPDATE workspace_view_selection SET view_id=? WHERE workspace_id=?").run(a.viewId,b.workspaceId),
    ]) {
      const result=service.handleCommand({type:'data.restore',content:altered(content,corrupt)});
      assert.equal(result.ok,false);assert.equal(result.error.code,'invalid_input');
      assert.equal(query('listTextProperties').values[0].value,'changed');
    }
    unwrap(service.handleCommand({ type: 'settings.setLanguage', language: 'en' }));
    unwrap(service.handleCommand({ type: 'data.restore', content }));
    service.close(); service = openSettingsService(path);
    assert.equal(unwrap(service.handleQuery({ type: 'settings.load' })).language, 'ru');
    assert.deepEqual(query('listTextProperties'), before);
    assert.deepEqual(query('listViews'), views);
    assert.deepEqual(query('getProjectCreation',{operationId:creation.operation.operationId}),receipt);
    assert.deepEqual(query('getTableLayout',{viewId:a.viewId}),layout);
    assert.deepEqual(query('getViewFilter',{viewId:a.viewId}),filter);
    assert.deepEqual(unwrap(service.handleQuery({type:'workspace.listViews',workspaceId:b.workspaceId})),siblingViews);
    const workspaces = unwrap(service.handleQuery({ type: 'workspace.load' }));
    assert.deepEqual(workspaces.workspaces.map(w => w.workspaceId), [a.workspaceId, b.workspaceId, c.workspaceId]);
  } finally { service.close(); rmSync(dir, { recursive: true, force: true }); }
});

import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'restore-safety-')), path = join(dir, 'app.sqlite');
  const service = openSettingsService(path);
  try {
    unwrap(service.handleCommand({ type: 'settings.setLanguage', language: 'ru' }));
    const content = unwrap(service.handleQuery({ type: 'data.export' })).content;
    unwrap(service.handleCommand({ type: 'settings.setLanguage', language: 'en' }));
    run({ dir, path, service, content });
  } finally { service.close(); rmSync(dir, { recursive: true, force: true }); }
}
function altered(content, mutate) {
  const envelope = JSON.parse(content), image = Buffer.from(envelope.database, 'base64'); image[18] = 1; image[19] = 1;
  const db = new Database(image);
  try { db.pragma("foreign_keys=OFF"); mutate(db); const bytes = db.serialize(); return JSON.stringify({ ...envelope, database: bytes.toString('base64'), checksum: createHash('sha256').update(bytes).digest('hex') }); }
  finally { db.close(); }
}

test('malformed, future, corrupt, foreign schema, invalid language and FK exports preserve current data', () => fixture(({service,content}) => {
  const envelope = JSON.parse(content);
  const inputs = ['{', '{}', JSON.stringify({...envelope, version: 2}), JSON.stringify({...envelope, extra: true}),
    JSON.stringify({...envelope, checksum: 'bad'}), JSON.stringify({...envelope, database: '////'}),
    altered(content, db => db.exec('CREATE TABLE unexpected (id TEXT)')),
    altered(content, db => db.exec("UPDATE settings SET value='xx' WHERE key='language'")),
    altered(content, db => db.exec("UPDATE __drizzle_migrations SET hash='invalid'")),
    altered(content, db => db.exec("INSERT INTO workspaces(id,name,source_id,position) VALUES('foreign','Invalid','missing',0)"))];
  for (const input of inputs) {
    assert.equal(service.handleCommand({ type: 'data.restore', content: input }).error.code, 'invalid_input');
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language, 'en');
  }
  for (const input of [{type:'data.restore'}, {type:'data.restore',content,extra:true}, {type:'data.export',path:'/outside'}]) {
    assert.equal((input.type === 'data.export' ? service.handleQuery(input) : service.handleCommand(input)).error.code,'invalid_input');
  }
}));

test('an engine error midway through replacement rolls back rows and immutable triggers', () => fixture(({service,content,path}) => {
  const prepare = Database.prototype.prepare;
  Database.prototype.prepare = function(sql) {
    if (sql.startsWith('INSERT INTO "settings"')) throw new Error('Injected SQLite write failure');
    return prepare.call(this,sql);
  };
  try { assert.equal(service.handleCommand({type:'data.restore',content}).error.code,'storage'); }
  finally { Database.prototype.prepare = prepare; }
  assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'en');
  // A successful subsequent restore confirms trigger schema and migration ledger survived.
  unwrap(service.handleCommand({type:'data.restore',content}));
  assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'ru');
  const db = new Database(path); try { assert.deepEqual(db.pragma('foreign_key_check'),[]); } finally {db.close();}
}));

test('process death after deletion rolls back the restore on reopen', () => fixture(({dir,path,content}) => {
  const input = join(dir,'export.json'), marker=join(dir,'inside-transaction'); writeFileSync(input,content);
  const script = `
    import Database from 'better-sqlite3'; import { readFileSync,writeFileSync } from 'node:fs';
    import { openSettingsService } from './dist/service/settings.mjs';
    const service=openSettingsService(process.env.RESTORE_TEST_DB);
    const exec=Database.prototype.exec;
    Database.prototype.exec=function(sql){ const result=exec.call(this,sql); if(sql==='DELETE FROM "settings"'){writeFileSync(process.env.RESTORE_TEST_MARKER,'inside');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}return result;};
    service.handleCommand({type:'data.restore',content:readFileSync(process.env.RESTORE_TEST_INPUT,'utf8')});
  `;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,RESTORE_TEST_DB:path,RESTORE_TEST_INPUT:input,RESTORE_TEST_MARKER:marker},timeout:3000,killSignal:'SIGKILL'});
  assert.ok(existsSync(marker),child.stderr?.toString());assert.equal(child.signal,'SIGKILL');
  const reopened=openSettingsService(path);
  try { assert.equal(unwrap(reopened.handleQuery({type:'settings.load'})).language,'en');unwrap(reopened.handleCommand({type:'data.restore',content})); }
  finally {reopened.close();}
}));

test('restored missing folders retain logical IDs and values and use explicit reassociation without recreating contents', () => {
  const dir=mkdtempSync(join(tmpdir(),'restore-missing-')),root=join(dir,'root'),path=join(dir,'app.sqlite');mkdirSync(root);mkdirSync(join(root,'Gone'));
  let service=openSettingsService(path);
  const call=(type,fields={})=>unwrap(service[type.startsWith('workspace.preview')||type==='workspace.listProjects'||type==='workspace.listTextProperties'?'handleQuery':'handleCommand']({type,...fields}));
  try {
    const {workspaceId}=call('workspace.create',{rootPath:root,name:'Missing'});
    const {projectId}=call('workspace.applyDiscovery',{workspaceId,previewToken:call('workspace.previewDiscovery',{workspaceId}).previewToken}).projects[0];
    const {propertyId}=call('workspace.createProperty',{workspaceId,name:'Notes',propertyType:'text'});
    call('workspace.setTextValue',{workspaceId,projectId,propertyId,value:'retained'});
    const {content}=unwrap(service.handleQuery({type:'data.export'}));
    const oldReview=call('workspace.previewDiscovery',{workspaceId});
    rmSync(join(root,'Gone'),{recursive:true});
    unwrap(service.handleCommand({type:'data.restore',content}));
    assert.equal(service.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:oldReview.previewToken}).error.code,'stale_preview');
    service.close();service=openSettingsService(path);
    const list=call('workspace.listProjects',{workspaceId});
    assert.equal(list.projects.length,0);assert.equal(list.retainedProjects[0].projectId,projectId);
    assert.equal(existsSync(join(root,'Gone')),false);
    mkdirSync(join(root,'Located'));writeFileSync(join(root,'Located','keep'),'separate project bytes');
    const review=call('workspace.previewProjectRecovery',{workspaceId,projectId});
    call('workspace.reassociateProject',{workspaceId,projectId,previewToken:review.previewToken,relativePath:'Located'});
    service.close();service=openSettingsService(path);
    assert.equal(call('workspace.listProjects',{workspaceId}).projects[0].projectId,projectId);
    assert.equal(call('workspace.listTextProperties',{workspaceId}).values[0].value,'retained');
  }finally{service.close();rmSync(dir,{recursive:true,force:true});}
});

test('restore preserves completed removal children, archive receipts, dormant category metadata and removed initiating workspaces',()=>{
  const dir=mkdtempSync(join(tmpdir(),'restore-history-')),root=join(dir,'root'),path=join(dir,'app.sqlite');
  mkdirSync(join(root,'Original','Project'),{recursive:true});writeFileSync(join(root,'Original','Project','keep'),'separate files');
  let service=openSettingsService(path),workspaceId;
  const cmd=(type,fields={})=>unwrap(service.handleCommand({type:`workspace.${type}`,workspaceId,...fields}));
  const query=(type,fields={})=>unwrap(service.handleQuery({type:`workspace.${type}`,workspaceId,...fields}));
  try{
    workspaceId=unwrap(service.handleCommand({type:'workspace.create',name:'Original owner',rootPath:root})).workspaceId;
    const sibling=unwrap(service.handleCommand({type:'workspace.create',name:'Retained owner',rootPath:root}));
    const initial=cmd('applyDiscovery',{previewToken:query('previewDiscovery',{mode:'grouped'}).previewToken});
    const {projectId,categoryId}=initial.projects[0];
    const folder=cmd('applyCategoryFolder',{operationId:randomUUID(),previewToken:query('previewCategoryFolder',{action:'create',name:'Destination',categoryId:null}).previewToken});
    const removal=cmd('applyCategoryRemoval',{operationId:randomUUID(),previewToken:query('previewCategoryRemoval',{categoryId,destinationCategoryId:folder.operation.categoryId}).previewToken});
    assert.equal(removal.operation.stage,'completed');
    cmd('applyArchiveLocation',{operationId:randomUUID(),previewToken:query('previewArchiveLocation',{relativePath:'Archive'}).previewToken});
    const archived=cmd('applyProjectArchive',{operationId:randomUUID(),previewToken:query('previewProjectArchive',{projectId,action:'archive',name:null,createParent:false}).previewToken});
    assert.equal(archived.operation.stage,'completed');
    cmd('applyDiscovery',{previewToken:query('previewDiscovery',{mode:'direct'}).previewToken});
    cmd('remove'); workspaceId=sibling.workspaceId;
    const before=query('listArchivedProjects');
    const content=unwrap(service.handleQuery({type:'data.export'})).content;
    for (const [triggerName, mutation] of [
      ['project_archive_update', "UPDATE project_archives SET original_relative_path='Invalid/Original'"],
      ['project_archive_operation_binding', `UPDATE project_archive_operations SET operation_id='${folder.operation.operationId}'`],
      ['category_update', 'UPDATE categories SET mode_inactive=0'],
    ]) {
      const corrupt=altered(content,db=>{
        const trigger=db.prepare('SELECT sql FROM sqlite_schema WHERE name=?').get(triggerName).sql;
        db.exec(`DROP TRIGGER ${triggerName}`);db.exec(mutation);db.exec(trigger);
      });
      assert.equal(service.handleCommand({type:'data.restore',content:corrupt}).error.code,'invalid_input');
      assert.deepEqual(query('listArchivedProjects'),before);
    }
    unwrap(service.handleCommand({type:'data.restore',content}));
    service.close();service=openSettingsService(path);
    assert.deepEqual(query('listArchivedProjects'),before);
    assert.deepEqual(query('getCategoryRemoval',{operationId:removal.operation.operationId}).operation,removal.operation);
    assert.equal(existsSync(join(root,'Original')),false);
    assert.equal(existsSync(join(root,'Archive','Destination','Project','keep')),true);
  }finally{service.close();rmSync(dir,{recursive:true,force:true});}
});
