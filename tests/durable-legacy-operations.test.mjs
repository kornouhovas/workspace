import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync,readFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {openSettingsService} from '../dist/service/settings.mjs';

for(const kind of ['creation','rename'])test(`real 0023 grouped ${kind} upgrade permits only explicitly attested exact-parent recovery`,()=>{
 const directory=realpathSync.native(mkdtempSync(join(tmpdir(),'legacy-operation-'))),root=join(directory,'source'),databasePath=join(directory,'data','settings.sqlite'),migrations=join(directory,'migrations');
 mkdirSync(join(root,'Category'),{recursive:true});mkdirSync(join(directory,'data'));mkdirSync(join(migrations,'meta'),{recursive:true});
 const journal=JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json','utf8'));journal.entries=journal.entries.slice(0,24);
 for(const entry of journal.entries)copyFileSync(`src/service/db/migrations/${entry.tag}.sql`,join(migrations,`${entry.tag}.sql`));
 writeFileSync(join(migrations,'meta/_journal.json'),JSON.stringify(journal));
 const sql=new Database(databasePath),workspaceId=randomUUID(),sourceId=randomUUID(),categoryId=randomUUID(),projectId=randomUUID(),operationId=randomUUID();
 const identity=path=>JSON.stringify(nativeProjectFilesystem.inspect(path).identity);
 let service;
 try {
  migrate(drizzle(sql),{migrationsFolder:migrations});sql.pragma('foreign_keys=ON');
  sql.prepare("INSERT INTO settings VALUES ('language','en')").run();
  const rootIdentity=identity(root),parentIdentity=identity(join(root,'Category'));
  sql.prepare("INSERT INTO sources (id,canonical_root,discovery_mode,discovery_revision,applied_root_identity) VALUES (?,?,'grouped',1,?)").run(sourceId,root,rootIdentity);
  sql.prepare("INSERT INTO workspaces (id,name,source_id,position) VALUES (?,'Legacy',?,0)").run(workspaceId,sourceId);
  sql.prepare("INSERT INTO views (id,workspace_id,name,kind) VALUES (?,?,'Table','table')").run(randomUUID(),workspaceId);
  sql.prepare("INSERT INTO categories (id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'Category',?,'active')").run(categoryId,sourceId,parentIdentity);
  sql.prepare("INSERT INTO category_properties VALUES (?,?,'Folder category')").run(randomUUID(),sourceId);
  if(kind==='creation') {
   sql.prepare(`INSERT INTO project_creation_operations (operation_id,source_id,initiating_workspace_id,project_id,name,mode,expected_revision,category_id,canonical_root,parent_relative_path,relative_path,root_identity,parent_identity,excluded_relative_paths,stage) VALUES (?,?,?,?,'Recovered','grouped',1,?,?,'Category','Category/Recovered',?,?,'[]','intent')`)
    .run(operationId,sourceId,workspaceId,projectId,categoryId,root,rootIdentity,parentIdentity);
  }else {
   mkdirSync(join(root,'Category/Original'));writeFileSync(join(root,'Category/Original/sentinel'),'preserved');
   const nativeIdentity=identity(join(root,'Category/Original')),propertyId=randomUUID();
   sql.prepare("INSERT INTO projects (id,source_id,relative_path,native_identity,category_id,association_state) VALUES (?,?,'Category/Original',?,?,'active')").run(projectId,sourceId,nativeIdentity,categoryId);
   sql.prepare("INSERT INTO property_definitions VALUES (?,?,'Notes','text',0)").run(propertyId,sourceId);
   sql.prepare('INSERT INTO text_property_values VALUES (?,?,?,?)').run(projectId,propertyId,sourceId,'exact legacy value');
   sql.prepare(`INSERT INTO project_rename_operations (operation_id,source_id,initiating_workspace_id,project_id,original_name,name,mode,expected_revision,category_id,canonical_root,parent_relative_path,original_relative_path,requested_relative_path,root_identity,parent_identity,native_identity,excluded_relative_paths,stage,last_verified_placement,last_verified_identity) VALUES (?,?,?,?,'Original','Renamed','grouped',1,?,?,'Category','Category/Original','Category/Renamed',?,?,?,'[]','intent','original',?)`)
    .run(operationId,sourceId,workspaceId,projectId,categoryId,root,rootIdentity,parentIdentity,nativeIdentity,nativeIdentity);
  }
  const table=`project_${kind}_operations`,before=sql.prepare(`SELECT * FROM ${table}`).get();
  service=openSettingsService(databasePath);
  const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
  assert.deepEqual(sql.prepare(`SELECT * FROM ${table}`).get(),{...before,authorization:null,...(kind==='creation'?{destination_evidence:null}:{project_evidence:null})});
  const binding=query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.ok(binding.previewToken);
  assert.equal(command({type:'workspace.applySourceAssociation',previewToken:binding.previewToken}).ok,true);
  const mapping={kind:'category',id:categoryId,relativePath:'Category'};
  assert.equal(query({type:'workspace.previewSourceAssociation',mappings:[mapping]}).value.previewToken,null);
  const method=kind==='creation'?'ProjectCreation':'ProjectRename';
  const review=query({type:`workspace.preview${method}Recovery`,operationId});assert.equal(review.ok,true,JSON.stringify(review));
  assert.ok(review.value.previewToken,JSON.stringify(review));
  const result=command({type:`workspace.recover${method}`,operationId,previewToken:review.value.previewToken,action:kind==='creation'?'retry_missing':'retry_original'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.outcome,'completed',JSON.stringify(result));assert.equal(result.value.project.projectId,projectId);
  assert.equal(sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence,null);
  const parentReview=query({type:'workspace.previewSourceAssociation',mappings:[mapping]}).value;assert.ok(parentReview.previewToken,JSON.stringify(parentReview));
  assert.equal(command({type:'workspace.applySourceAssociation',previewToken:parentReview.previewToken}).ok,true);
  assert.equal(query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
  if(kind==='rename') {
   assert.equal(readFileSync(join(root,'Category/Renamed/sentinel'),'utf8'),'preserved');
   assert.equal(query({type:'workspace.listTextProperties'}).value.values[0].value,'exact legacy value');
  }
  assert.equal(sql.prepare(`SELECT authorization FROM ${table}`).get().authorization,null);
  assert.equal(sql.prepare(`SELECT count(*) n FROM project_${kind}_attestations`).get().n,1);
 }finally{service?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
});
