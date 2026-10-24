import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cpSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, lstatSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openSettingsService } from '../dist/service/settings.mjs';
import { openSnapshot } from '../src/service/snapshot.ts';
const native=path=>{const stat=lstatSync(path,{bigint:true});return JSON.stringify({dev:String(stat.dev),ino:String(stat.ino),birthtimeNs:String(stat.birthtimeNs)});};

test('real populated pre-evidence SQLite upgrade preserves old identities, properties, views and sessions with a matching backup',()=>{
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'workspace-evidence-upgrade-'))),root=join(directory,'root'),path=join(directory,'settings.sqlite'),old=join(directory,'old');
 mkdirSync(join(root,'Project'),{recursive:true});cpSync('src/service/db/migrations',old,{recursive:true});
 const journalPath=join(old,'meta/_journal.json'),journal=JSON.parse(readFileSync(journalPath,'utf8'));
 journal.entries=journal.entries.slice(0,24);writeFileSync(journalPath,JSON.stringify(journal));
 const sourceId=randomUUID(),workspaceId=randomUUID(),projectId=randomUUID(),viewId=randomUUID(),propertyId=randomUUID();
 const sql=new Database(path);let service;
 try{
  migrate(drizzle(sql),{migrationsFolder:old});sql.pragma('foreign_keys=ON');
  sql.prepare("INSERT INTO settings VALUES ('language','ru')").run();
  sql.prepare("INSERT INTO sources (id,canonical_root,discovery_mode,discovery_revision,applied_root_identity) VALUES (?,?,'direct',7,?)").run(sourceId,root,native(root));
  sql.prepare("INSERT INTO workspaces (id,name,position,source_id) VALUES (?,'Before',0,?)").run(workspaceId,sourceId);
  sql.prepare("INSERT INTO views (id,workspace_id,name,kind) VALUES (?,?,'Retained board','board')").run(viewId,workspaceId);
  sql.prepare('INSERT INTO workspace_view_selection VALUES (?,?)').run(workspaceId,viewId);
  sql.prepare("INSERT INTO active_workspace VALUES ('active',?,?)").run(workspaceId,viewId);
  sql.prepare("INSERT INTO projects (id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'Project',?,'active')").run(projectId,sourceId,native(join(root,'Project')));
  sql.prepare("INSERT INTO property_definitions (id,source_id,name,property_type,position) VALUES (?,?,'Notes','text',0)").run(propertyId,sourceId);
  sql.prepare("INSERT INTO text_property_values VALUES (?,?,?,' Exact\nТекст ')").run(projectId,propertyId,sourceId);
  const before={source:sql.prepare('SELECT * FROM sources').get(),project:sql.prepare('SELECT * FROM projects').get(),views:sql.prepare('SELECT * FROM views').all(),sessions:sql.prepare('SELECT * FROM workspace_sessions').all()};
  service=openSettingsService(path);
  const source=sql.prepare('SELECT * FROM sources').get(),project=sql.prepare('SELECT * FROM projects').get();
  assert.deepEqual(source,{...before.source,durable_evidence:null,evidence_generation:0});
  assert.deepEqual(project,{...before.project,durable_evidence:null});
  assert.deepEqual(sql.prepare('SELECT * FROM views').all(),before.views);assert.deepEqual(sql.prepare('SELECT * FROM workspace_sessions').all(),before.sessions);
  assert.equal(service.handleQuery({type:'workspace.listProjects',workspaceId}).value.state,'association_review_required');
  assert.equal(sql.prepare('SELECT value FROM text_property_values').get().value,' Exact\nТекст ');
  const backups=service.handleQuery({type:'data.backups'}).value.backups.snapshots;
  const backup=backups.find(b=>b.kind==='pre-migration');assert.ok(backup);
  const content=service.handleQuery({type:'data.backupExport',backupId:backup.id}).value.content;
  assert.match(JSON.parse(content).localAuthority,/anchor excluded/);
  const snapshot=openSnapshot(content);
  try{assert.equal(snapshot.prepare('SELECT count(*) n FROM __drizzle_migrations').get().n,24);assert.deepEqual(snapshot.prepare('SELECT * FROM sources').get(),before.source);}finally{snapshot.close();}
  const exported=service.handleQuery({type:'data.export'}).value.content;
  assert.equal(service.handleCommand({type:'data.restore',content:exported}).ok,true);
  assert.equal(service.handleQuery({type:'workspace.listProjects',workspaceId}).value.retainedProjects[0].projectId,projectId);
  service.close();service=openSettingsService(path);
  assert.equal(sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence,null);
 }finally{service?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
});
