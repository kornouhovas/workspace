import {rewindRoleJournals} from './support/identity-migration-fixtures.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cpSync,readFileSync,writeFileSync,mkdirSync,mkdtempSync,realpathSync,lstatSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {openSettingsService} from '../dist/service/settings.mjs';
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
const native=path=>{const stat=lstatSync(path,{bigint:true});return JSON.stringify({dev:String(stat.dev),ino:String(stat.ino),birthtimeNs:String(stat.birthtimeNs)});};

test('a populated pre-role database upgrades and reviewed reinterpretation preserves IDs, values and views',()=>{
  const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'folder-upgrade-'))),root=join(directory,'Root'),database=join(directory,'app.sqlite'),migrations=join(directory,'old');
  mkdirSync(join(root,'Clients','App'),{recursive:true});cpSync('src/service/db/migrations',migrations,{recursive:true});
  const journalPath=join(migrations,'meta/_journal.json'),journal=JSON.parse(readFileSync(journalPath,'utf8'));
  journal.entries=journal.entries.slice(0,33);writeFileSync(journalPath,JSON.stringify(journal));
  const sourceId=randomUUID(),workspaceId=randomUUID(),projectId=randomUUID(),categoryId=randomUUID(),viewId=randomUUID(),propertyId=randomUUID();
  const sql=new Database(database);let app;
  try{
    migrate(drizzle(sql),{migrationsFolder:migrations});sql.pragma('foreign_keys=ON');
    sql.prepare("INSERT INTO settings VALUES ('language','ru')").run();
    sql.prepare("INSERT INTO sources(id,canonical_root,discovery_mode,discovery_revision,applied_root_identity) VALUES (?,?,'grouped',7,?)").run(sourceId,root,native(root));
    sql.prepare("INSERT INTO workspaces(id,name,position,source_id) VALUES (?,'Before',0,?)").run(workspaceId,sourceId);
    sql.prepare("INSERT INTO views(id,workspace_id,name,kind) VALUES (?,?,'Retained Table','table')").run(viewId,workspaceId);
    sql.prepare('INSERT INTO workspace_view_selection VALUES (?,?)').run(workspaceId,viewId);
    sql.prepare("INSERT INTO active_workspace VALUES ('active',?,?)").run(workspaceId,viewId);
    sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'Clients',?,'active')").run(categoryId,sourceId,native(join(root,'Clients')));
    sql.prepare('INSERT INTO category_properties(id,source_id,name) VALUES (?, ?, NULL)').run(randomUUID(),sourceId);
    sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,category_id,association_state) VALUES (?,?,'Clients/App',?,?,'active')").run(projectId,sourceId,native(join(root,'Clients','App')),categoryId);
    sql.prepare("INSERT INTO property_definitions(id,source_id,name,property_type,position) VALUES (?,?,'Notes','text',0)").run(propertyId,sourceId);
    sql.prepare("INSERT INTO text_property_values VALUES (?,?,?,' Exact\nТекст ')").run(projectId,propertyId,sourceId);
    app=openSettingsService(database);
    assert.equal(value(app.handleQuery({type:'workspace.listProjects',workspaceId})).retainedProjects[0].projectId,projectId);
    for(const mappings of [[],[{kind:'category',id:categoryId,relativePath:'Clients'},{kind:'project',id:projectId,relativePath:'Clients/App'}]]) {
      const review=value(app.handleQuery({type:'workspace.previewSourceAssociation',workspaceId,mappings}));assert.ok(review.previewToken,JSON.stringify(review));
      value(app.handleCommand({type:'workspace.applySourceAssociation',workspaceId,previewToken:review.previewToken}));
      if(mappings.length===0){
        const unbound=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId,folderRoles:[{relativePath:'Clients',role:'group'}]}));
        assert.equal(unbound.previewToken,null);assert.equal(unbound.state,'association_review_required');
      }
    }
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId,folderRoles:[{relativePath:'Clients',role:'group'}]}));
    const applied=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId,previewToken:preview.previewToken}));
    assert.equal(applied.projects[0].projectId,projectId);assert.equal(applied.projects[0].categoryId,null);
    assert.equal(value(app.handleQuery({type:'workspace.listTextProperties',workspaceId})).values[0].value,' Exact\nТекст ');
    assert.equal(value(app.handleQuery({type:'workspace.load'})).activeWorkspace.viewId,viewId);
    assert.equal(value(app.handleQuery({type:'workspace.listViews',workspaceId})).views[0].name,'Retained Table');
    app.close();app=openSettingsService(database);
    assert.equal(value(app.handleQuery({type:'workspace.listProjects',workspaceId})).projects[0].projectId,projectId);
    assert.equal(value(app.handleQuery({type:'workspace.listTextProperties',workspaceId})).values[0].propertyId,propertyId);
  } finally {app?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
});


test('0034 rebuild preserves populated 0033 journals, dependent attestations and every existing cell',()=>{
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'role-journal-upgrade-'))),root=join(directory,'Root'),database=join(directory,'app.sqlite');
 mkdirSync(join(root,'From/App'),{recursive:true});mkdirSync(join(root,'To'));let app=openSettingsService(database),sql;
 try{
  const workspace=value(app.handleCommand({type:'workspace.create',rootPath:root,name:'Before',initialize:'status'}));
  const query=input=>value(app.handleQuery({workspaceId:workspace.workspaceId,...input})),command=input=>value(app.handleCommand({workspaceId:workspace.workspaceId,...input}));
  let list=query({type:'workspace.listProjects'}),project=list.projects[0];
  command({type:'workspace.createProject',mode:'grouped',categoryId:project.categoryId,operationId:randomUUID(),name:'Created',expectedRevision:list.revision});
  list=query({type:'workspace.listProjects'});sql=new Database(database);
  sql.exec("CREATE TRIGGER stop_rename BEFORE UPDATE OF relative_path ON projects BEGIN SELECT RAISE(ABORT,'interrupted'); END");
  const operationId=randomUUID(),request={type:'workspace.renameProject',projectId:project.projectId,operationId,name:'Renamed',expectedRevision:list.revision};
  assert.equal(command(request).outcome,'recoverable');sql.exec('DROP TRIGGER stop_rename');
  const review=query({type:'workspace.previewProjectRenameRecovery',operationId});assert.equal(command({type:'workspace.recoverProjectRename',operationId,previewToken:review.previewToken,action:'complete_destination'}).outcome,'completed');
  list=query({type:'workspace.listProjects'});assert.equal(command({type:'workspace.moveProjectCategory',projectId:project.projectId,operationId:randomUUID(),destinationCategoryId:list.categories.find(c=>c.relativePath==='To').categoryId,expectedRevision:list.revision}).outcome,'completed');
  app.close();app=null;
  sql.pragma('foreign_keys=ON');rewindRoleJournals(sql);sql.exec('DELETE FROM __drizzle_migrations WHERE created_at=(SELECT max(created_at) FROM __drizzle_migrations)');
  const tables=sql.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='__drizzle_migrations'").all().map(r=>r.name);
  const before=Object.fromEntries(tables.map(name=>[name,sql.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
  const beforeDefinitions=sql.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('index','trigger') AND sql IS NOT NULL").all();
  assert.equal(before.project_rename_attestations.length,1);assert.equal(before.project_creation_operations.length,1);assert.equal(before.project_category_move_operations.length,1);
  app=openSettingsService(database);
  for(const [table,rows] of Object.entries(before)) {
   const expected=table.match(/^project_(creation|rename|category_move)_operations$/)?rows.map(row=>({folder_roles:null,target_folder_roles:null,...row})):rows;
   assert.deepEqual(sql.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all(),expected,table);
  }
  for(const object of beforeDefinitions)assert.ok(sql.prepare('SELECT 1 FROM sqlite_schema WHERE type=? AND name=? AND tbl_name=?').get(object.type,object.name,object.tbl_name),object.name);
  assert.deepEqual(sql.pragma('foreign_key_check'),[]);assert.equal(sql.pragma('legacy_alter_table',{simple:true}),0);assert.equal(sql.pragma('defer_foreign_keys',{simple:true}),0);
  assert.ok(!sql.prepare("SELECT name FROM sqlite_schema WHERE sql LIKE '%_role_upgrade%'").get());
  const content=value(app.handleQuery({type:'data.export'})).content;assert.equal(app.handleCommand({type:'data.restore',content}).ok,true);
  assert.equal(query({type:'workspace.listProjects'}).projects.find(p=>p.projectId===project.projectId).relativePath,'To/Renamed');
 }finally{app?.close();sql?.close();rmSync(directory,{recursive:true,force:true});}
});
