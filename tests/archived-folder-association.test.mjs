import {EventEmitter} from "node:events";
import {startServiceProcess} from "../dist/service/entry.cjs";
import {renameNoReplace} from "../dist/service/project-rename-filesystem.mjs";
import {randomUUID} from "node:crypto";
import {observeFolder} from "../src/service/folder-evidence.ts";
import {alteredSnapshot} from "./support/mutate-application-snapshot.mjs";
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,readFileSync,writeFileSync,copyFileSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {seedHistoricalFixture} from './support/identity-migration-fixtures.mjs';
import {nativeProjectFilesystem} from '../src/service/project-filesystem.ts';
import {openSettingsService} from '../dist/service/settings.mjs';

function fixture(run,reader,{mode="direct",missingParent=false,native}={}) {
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'archived-association-'))),root=join(directory,'root'),path=join(directory,'app.sqlite'),migrations=join(directory,'migrations');
 mkdirSync(join(root,'Project'),{recursive:true});mkdirSync(join(root,'Cold/Archive'),{recursive:true});writeFileSync(join(root,'Project/sentinel'),'exact archived bytes');mkdirSync(join(migrations,'meta'),{recursive:true});
 const journal=JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json','utf8'));journal.entries=journal.entries.slice(0,24);
 for(const entry of journal.entries)copyFileSync(`src/service/db/migrations/${entry.tag}.sql`,join(migrations,`${entry.tag}.sql`));writeFileSync(join(migrations,'meta/_journal.json'),JSON.stringify(journal));
 const seeded=seedHistoricalFixture(path,migrations,root,[{name:'Notes',type:'text',value:'  archived metadata\n'}]),sql=new Database(path);let service;
 try {
  const parents=['Cold','Cold/Archive'].map(relativePath=>({path:relativePath,identity:{...nativeProjectFilesystem.inspect(join(root,relativePath)).identity,dev:'999'}}));
  sql.prepare("UPDATE sources SET archive_relative_path='Cold/Archive',applied_root_identity=json_set(applied_root_identity,'$.dev','999')").run();
  sql.prepare("UPDATE projects SET mode_inactive=1,native_identity=json_set(native_identity,'$.dev','999')").run();
  if(mode==='direct')sql.prepare("INSERT INTO project_archives(project_id,source_id,relative_path,original_relative_path,mode,category_name,parent_identity,parents) VALUES (?,?,'Cold/Archive/Project','Project','direct',NULL,?,?)").run(seeded.projectId,seeded.sourceId,JSON.stringify({...JSON.parse(seeded.rows.sources[0].applied_root_identity),dev:'999'}),JSON.stringify(parents));
  renameSync(join(root,'Project'),join(root,'Cold/Archive/Project'));
  let categoryId=null;
  if(mode==='grouped') {
   categoryId=randomUUID();mkdirSync(join(root,'Category'));mkdirSync(join(root,'Cold/Archive/Category'));
   const parent=JSON.stringify({...nativeProjectFilesystem.inspect(join(root,'Category')).identity,dev:'999'});
   sql.prepare("UPDATE sources SET discovery_mode='grouped'").run();
   sql.prepare("INSERT INTO categories(id,source_id,relative_path,native_identity,association_state) VALUES (?,?,'Category',?,'active')").run(categoryId,seeded.sourceId,parent);
   sql.prepare("INSERT INTO category_properties(id,source_id,name) VALUES (?,?,NULL)").run(randomUUID(),seeded.sourceId);
   sql.prepare("UPDATE projects SET relative_path='Category/Project',category_id=?").run(categoryId);
   parents.push({path:'Cold/Archive/Category',identity:{...nativeProjectFilesystem.inspect(join(root,'Cold/Archive/Category')).identity,dev:'999'}});
   sql.prepare("INSERT INTO project_archives(project_id,source_id,relative_path,original_relative_path,mode,category_name,parent_identity,parents) VALUES (?,?,'Cold/Archive/Category/Project','Category/Project','grouped','Category',?,?)").run(seeded.projectId,seeded.sourceId,parent,JSON.stringify(parents));
   renameSync(join(root,'Cold/Archive/Project'),join(root,'Cold/Archive/Category/Project'));
   if(missingParent)rmSync(join(root,'Category'),{recursive:true});
  }
  const observer={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
  const open=()=>openSettingsService(path,undefined,undefined,observer,undefined,native,reader);service=open();
  const query=input=>service.handleQuery({workspaceId:seeded.workspaceId,...input}),command=input=>service.handleCommand({workspaceId:seeded.workspaceId,...input});
  run({directory,root,path,sql,query,command,projectId:seeded.projectId,categoryId,send:input=>input.type==='data.export'?service.handleQuery(input):service.handleCommand(input),restart(){service.close();service=open();}});
 }finally{service?.close();sql.close();rmSync(directory,{recursive:true,force:true});}
}

test('explicit designated archive mapping enrolls only the selected folder while preserving archived and original placement',()=>fixture(f=>{
 const project=f.sql.prepare('SELECT * FROM projects').get(),archive=f.sql.prepare('SELECT * FROM project_archives').get();
 const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]});assert.ok(root.value.previewToken);assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.value.previewToken}).ok,true);
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
 const mappings=[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}];
 const review=f.query({type:'workspace.previewSourceAssociation',mappings});assert.equal(review.ok,true,JSON.stringify(review));assert.ok(review.value.previewToken,JSON.stringify(review));
 assert.equal(review.value.candidates.find(row=>row.id===f.projectId).archived,true);
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken}).ok,true);
 const current=f.sql.prepare('SELECT * FROM projects').get();assert.deepEqual({...current,durable_evidence:null},project);assert.ok(current.durable_evidence);
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_archives').get(),archive);assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);assert.equal(f.query({type:'workspace.listArchivedProjects'}).value.projects[0].projectId,f.projectId);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'  archived metadata\n');assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
}));


test('archive association backups retain valid authority and reject malformed roles or future generations',()=>fixture(f=>{
 const mappings=[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}],review=f.query({type:'workspace.previewSourceAssociation',mappings});assert.ok(review.value.previewToken,JSON.stringify(review));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken}).ok,true);
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>{db.exec("UPDATE archived_folder_associations SET authorization=json_set(authorization,'$.project',json_extract(authorization,'$.root.root'))");db.exec("UPDATE projects SET durable_evidence=(SELECT json_extract(authorization,'$.root.root.evidence') FROM archived_folder_associations)");},
  db=>db.exec("UPDATE archived_folder_associations SET authorization=json_set(authorization,'$.version',2)"),
  db=>db.exec("UPDATE archived_folder_associations SET authorization=json_set(authorization,'$.projectId','00000000-0000-4000-8000-000000000001')"),
  db=>db.exec("UPDATE archived_folder_associations SET generation=999,authorization=json_set(authorization,'$.root.generation',999)"),
  db=>db.exec("UPDATE archived_folder_associations SET authorization=json_set(authorization,'$.parents[0].observation.evidence.scope','foreign')"),
 ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
}));

test('archived identity cannot be mapped through an ordinary path or another archive location',()=>fixture(f=>{
 mkdirSync(join(f.root,'Other'));mkdirSync(join(f.root,'Cold/Archive/Other'));
 for(const relativePath of ['Other','Cold/Archive/Other']) {
  const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath}]});assert.equal(review.value.previewToken,null,JSON.stringify(review));
 }
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,0);
 assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
}));

test('scope-unverified archive mapping preserves every old receipt and requires explicit new consent',()=>fixture(f=>{
 const mappings=[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}],first=f.query({type:'workspace.previewSourceAssociation',mappings}).value;assert.ok(first.previewToken);assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:first.previewToken}).ok,true);
 const before=f.sql.prepare('SELECT * FROM archived_folder_associations').get(),archive=f.sql.prepare('SELECT * FROM project_archives').get();rmSync(join(f.directory,'installation-scope.json'));f.restart();
 const review=f.query({type:'workspace.previewSourceAssociation',mappings});assert.ok(review.value.previewToken,JSON.stringify(review));assert.equal(review.value.candidates[0].reason,'scope_unverified');
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken}).ok,true);assert.deepEqual(f.sql.prepare('SELECT * FROM archived_folder_associations WHERE id=?').get(before.id),before);assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,2);
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_archives').get(),archive);assert.equal(f.query({type:'workspace.listProjects'}).value.projects.length,0);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
}));

test('designated archive binding refuses a full target alias in an unowned archived sibling',()=>{
 let projectPath;
 const reader=(path,scope)=>{const proof=observeFolder(path,scope);return proof.ok&&path.endsWith('/Other')?{...proof,evidence:observeFolder(projectPath,scope).evidence}:proof;};
 fixture(f=>{projectPath=join(f.root,'Cold/Archive/Project');mkdirSync(join(f.root,'Cold/Archive/Other'));
  const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.equal(review.value.previewToken,null,JSON.stringify(review));
  assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,0);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
 },reader);
});


test('restore uses explicitly bound archive placement across old parent device history without rewriting that history',()=>fixture(f=>{
 const archive=f.sql.prepare('SELECT * FROM project_archives').get(),native=f.sql.prepare('SELECT native_identity FROM projects').get();
 const mapped=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]}).value;
 assert.ok(mapped.previewToken);assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:mapped.previewToken}).ok,true);f.restart();
 const review=f.query({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false});assert.ok(review.value.previewToken,JSON.stringify(review));
 const restored=f.command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:review.value.previewToken});assert.equal(restored.value.operation.stage,'completed',JSON.stringify(restored));
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);assert.deepEqual(f.sql.prepare('SELECT native_identity FROM projects').get(),native);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact archived bytes');
 const binding=JSON.parse(f.sql.prepare('SELECT authorization FROM archived_folder_associations').get().authorization);assert.deepEqual(Object.fromEntries(Object.entries(binding.archive).map(([key,value])=>[key.replace(/[A-Z]/g,letter=>'_'+letter.toLowerCase()),value])),archive);
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));
 for(const mutate of [
  db=>db.exec("DELETE FROM archived_folder_associations"),
  db=>db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.authorization.associationId','00000000-0000-4000-8000-000000000001')"),
  db=>db.exec("UPDATE project_archive_operations SET binding=json_set(binding,'$.authorization.originalParent',json_extract(binding,'$.authorization.root.root'))"),
 ])assert.equal(f.send({type:'data.restore',content:alteredSnapshot(exported.value.content,mutate)}).ok,false);
 assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);

}));

test('an accepted archive placement also protects current shared ancestors when archiving another enrolled project',()=>fixture(f=>{
 const old=f.sql.prepare('SELECT * FROM project_archives').get();
 const mapped=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]}).value;assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:mapped.previewToken}).ok,true);
 mkdirSync(join(f.root,'New project'));writeFileSync(join(f.root,'New project/sentinel'),'new bytes');
 const discovered=f.query({type:'workspace.previewDiscovery',mode:'direct'}).value,projects=f.command({type:'workspace.applyDiscovery',previewToken:discovered.previewToken});assert.equal(projects.ok,true,JSON.stringify(projects));
 const projectId=projects.value.projects.find(project=>project.name==='New project').projectId;
 const review=f.query({type:'workspace.previewProjectArchive',projectId,action:'archive',name:null,createParent:false});assert.ok(review.value.previewToken,JSON.stringify(review));
 const archived=f.command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:review.value.previewToken});assert.equal(archived.value.operation.stage,'completed',JSON.stringify(archived));
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_archives WHERE project_id=?').get(f.projectId),old);assert.equal(readFileSync(join(f.root,'Cold/Archive/New project/sentinel'),'utf8'),'new bytes');assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
}));

test('archive mapping cannot enroll a folder already saved as another source root',()=>fixture(f=>{
 const path=join(f.root,'Cold/Archive/Project');assert.equal(f.command({type:'workspace.create',name:'Peer source',rootPath:path}).ok,true);
 const peer=f.sql.prepare('SELECT * FROM sources WHERE canonical_root=?').get(path);
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.equal(review.value.previewToken,null,JSON.stringify(review));
 assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);assert.deepEqual(f.sql.prepare('SELECT * FROM sources WHERE id=?').get(peer.id),peer);assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,0);
}));

for(const savedPath of ['Cold','Elsewhere'])test(`archive mapping refuses a retained owner of its ancestor under ${savedPath}`,()=>fixture(f=>{
 const sourceId=f.sql.prepare('SELECT source_id FROM projects').get().source_id;
 f.sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,association_state) VALUES (?,?,?,?,'missing')").run(randomUUID(),sourceId,savedPath,JSON.stringify({...nativeProjectFilesystem.inspect(join(f.root,'Cold')).identity,dev:'999'}));
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.equal(review.value.previewToken,null,JSON.stringify(review));
 assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,0);assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects WHERE id=?').get(f.projectId).durable_evidence,null);
}));

test('archive mapping and restore may observe an unchanged archive parent that is a separately saved source root',()=>fixture(f=>{
 const path=join(f.root,'Cold/Archive');assert.equal(f.command({type:'workspace.create',name:'Parent source',rootPath:path}).ok,true);
 const peer=f.sql.prepare('SELECT * FROM sources WHERE canonical_root=?').get(path);
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.ok(review.value.previewToken,JSON.stringify(review));assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.value.previewToken}).ok,true);
 const restore=f.query({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false});assert.ok(restore.value.previewToken,JSON.stringify(restore));assert.equal(f.command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:restore.value.previewToken}).value.operation.stage,'completed');
 assert.deepEqual(f.sql.prepare('SELECT * FROM sources WHERE id=?').get(peer.id),peer);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact archived bytes');
}));

for(const mode of ['direct','grouped'])test(`known ${mode} archive history keeps its old scope while explicitly rebound current roles authorize restore`,()=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'scoped-archive-association-'))),root=join(directory,'root'),path=join(directory,'app.sqlite'),relativePath=mode==='grouped'?'Category/Project':'Project';
 mkdirSync(join(root,relativePath),{recursive:true});writeFileSync(join(root,relativePath,'sentinel'),'known archive bytes');
 const observer={watch(){return{close(){}};},schedule(){return{cancel(){}};}};const open=()=>openSettingsService(path,undefined,undefined,observer);let service=open();const sql=new Database(path);
 try {
  const workspaceId=service.handleCommand({type:'workspace.create',name:'Known',rootPath:root}).value.workspaceId;
  const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
  const discovery=query({type:'workspace.previewDiscovery',mode}).value,list=command({type:'workspace.applyDiscovery',previewToken:discovery.previewToken}).value,projectId=list.projects[0].projectId,categoryId=list.projects[0].categoryId;
  const location=query({type:'workspace.previewArchiveLocation',relativePath:'Cold/Archive'}).value;assert.equal(command({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:location.previewToken}).ok,true);
  const archiveReview=query({type:'workspace.previewProjectArchive',projectId,action:'archive',name:null,createParent:false}).value;assert.equal(command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:archiveReview.previewToken}).value.operation.stage,'completed');
  const history=sql.prepare('SELECT * FROM project_archives').get(),old=JSON.parse(history.authorization);
  rmSync(join(directory,'installation-scope.json'));service.close();service=open();
  const rootOnly=query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.equal(command({type:'workspace.applySourceAssociation',previewToken:rootOnly.previewToken}).ok,true);
  assert.equal(query({type:'workspace.previewProjectArchive',projectId,action:'restore',name:null,createParent:false}).value.previewToken,null);
  const mappings=[{kind:'project',id:projectId,relativePath:`Cold/Archive/${relativePath}`},...(categoryId?[{kind:'category',id:categoryId,relativePath:'Category'}]:[])];
  const binding=query({type:'workspace.previewSourceAssociation',mappings});assert.ok(binding.value.previewToken,JSON.stringify(binding));assert.equal(command({type:'workspace.applySourceAssociation',previewToken:binding.value.previewToken}).ok,true);assert.deepEqual(sql.prepare('SELECT * FROM project_archives').get(),history);
  const restore=query({type:'workspace.previewProjectArchive',projectId,action:'restore',name:null,createParent:false});assert.ok(restore.value.previewToken,JSON.stringify(restore));
  const result=command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:restore.value.previewToken});assert.equal(result.value.operation.stage,'completed',JSON.stringify(result));assert.equal(query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);
  const authority=JSON.parse(sql.prepare("SELECT binding FROM project_archive_operations WHERE action='restore'").get().binding).authorization;
  assert.equal(authority.version,2);assert.deepEqual(authority.originalParent,old.originalParent);assert.notEqual(authority.root.root.evidence.scope,authority.originalParent.evidence.scope);assert.equal(readFileSync(join(root,relativePath,'sentinel'),'utf8'),'known archive bytes');
  const exported=service.handleQuery({type:'data.export'});assert.equal(exported.ok,true);assert.equal(service.handleCommand({type:'data.restore',content:exported.value.content}).ok,true);
 }finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
});

test('archive association rolls back all enrollment and its receipt if an ancestor changes after SQL insertion',()=>{
 let changed=false;const reader=(path,scope)=>{const proof=observeFolder(path,scope);return changed&&proof.ok&&path.endsWith('/Cold')?{...proof,evidence:{...proof.evidence,created:(BigInt(proof.evidence.created)+1n).toString()}}:proof;};
 fixture(f=>{
  const before=f.sql.prepare('SELECT * FROM sources').all(),project=f.sql.prepare('SELECT * FROM projects').get();
  const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]}).value;assert.ok(review.previewToken);
  const prepare=Database.prototype.prepare;
  Database.prototype.prepare=function(sql,...args){const statement=prepare.call(this,sql,...args);if(sql.trimStart().toLowerCase().startsWith('insert into "archived_folder_associations"')){const run=statement.run;statement.run=function(...values){const result=run.apply(this,values);changed=true;return result;};}return statement;};
  try{assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:review.previewToken}).ok,false);}finally{Database.prototype.prepare=prepare;}
  assert.equal(changed,true);assert.deepEqual(f.sql.prepare('SELECT * FROM sources').all(),before);assert.deepEqual(f.sql.prepare('SELECT * FROM projects').get(),project);assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,0);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
 },reader);
});

test('archive association cannot claim an out-of-path reserved creation object as an archive parent',()=>fixture(f=>{
 const root=f.query({type:'workspace.previewSourceAssociation',mappings:[]}).value;assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:root.previewToken}).ok,true);
 f.sql.exec("CREATE TRIGGER pause_project BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT,'paused'); END");
 const created=f.command({type:'workspace.createProject',mode:'direct',name:'Other',operationId:randomUUID(),expectedRevision:f.query({type:'workspace.listProjects'}).value.revision});assert.equal(created.value.outcome,'recoverable',JSON.stringify(created));f.sql.exec('DROP TRIGGER pause_project');
 renameSync(join(f.root,'Cold/Archive'),join(f.root,'Cold/Saved'));renameSync(join(f.root,'Other'),join(f.root,'Cold/Archive'));renameSync(join(f.root,'Cold/Saved/Project'),join(f.root,'Cold/Archive/Project'));
 const review=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.equal(review.value.previewToken,null,JSON.stringify(review));assert.equal(f.sql.prepare('SELECT count(*) n FROM archived_folder_associations').get().n,0);assert.equal(f.sql.prepare('SELECT durable_evidence FROM projects').get().durable_evidence,null);
 assert.equal(f.query({type:'workspace.listProjectCreations'}).value.operations.length,1);assert.equal(readFileSync(join(f.root,'Cold/Archive/Project/sentinel'),'utf8'),'exact archived bytes');
}));

for(const missingParent of [false,true])test(`legacy grouped archived binding restores with ${missingParent?'exclusive recreated':'separately bound'} original parent`,()=>fixture(f=>{
 const history=f.sql.prepare('SELECT * FROM project_archives').get(),category=f.sql.prepare('SELECT * FROM categories').get();
 const mappings=[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Category/Project'}];
 const bind=f.query({type:'workspace.previewSourceAssociation',mappings});assert.ok(bind.value.previewToken,JSON.stringify(bind));
 assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:bind.value.previewToken}).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM project_archives').get(),history);assert.deepEqual(f.sql.prepare('SELECT * FROM categories').get(),category);
 const request={type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false};
 assert.equal(f.query(request).value.previewToken,null);
 if(!missingParent){
  const parent=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'category',id:f.categoryId,relativePath:'Category'}]});assert.ok(parent.value.previewToken,JSON.stringify(parent));
  assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:parent.value.previewToken}).ok,true);
 }
 const review=f.query({...request,createParent:missingParent});assert.ok(review.value.previewToken,JSON.stringify(review));
 const restored=f.command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:review.value.previewToken});assert.equal(restored.value.operation.stage,'completed',JSON.stringify(restored));
 assert.equal(readFileSync(join(f.root,'Category/Project/sentinel'),'utf8'),'exact archived bytes');
 assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);
 if(missingParent){assert.notEqual(f.sql.prepare('SELECT category_id FROM projects').get().category_id,f.categoryId);assert.deepEqual(f.sql.prepare('SELECT * FROM categories WHERE id=?').get(f.categoryId),{...category,association_state:'replaced',mode_inactive:1});}
 const exported=f.send({type:'data.export'});assert.equal(exported.ok,true,JSON.stringify(exported));assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
},undefined,{mode:'grouped',missingParent}));

test('explicit v2 restore recovery completes a lost native response while preserving archive association history',()=>{
 let calls=0;
 fixture(f=>{
  const bind=f.query({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.equal(f.command({type:'workspace.applySourceAssociation',previewToken:bind.value.previewToken}).ok,true);
  const associations=f.sql.prepare('SELECT * FROM archived_folder_associations').all();
  const review=f.query({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false});assert.ok(review.value.previewToken);
  const operationId=randomUUID(),request={type:'workspace.applyProjectArchive',operationId,previewToken:review.value.previewToken},pending=f.command(request);assert.equal(pending.value.operation.stage,'intent',JSON.stringify(pending));assert.equal(calls,1);
  const original=f.sql.prepare('SELECT binding,parents,native_identity FROM project_archive_operations WHERE operation_id=?').get(operationId);f.restart();assert.deepEqual(f.command(request),pending);assert.equal(calls,1);
  const recovery=f.query({type:'workspace.previewProjectArchiveRecovery',operationId});assert.deepEqual(recovery.value.actions,['complete_destination'],JSON.stringify(recovery));
  const completed=f.command({type:'workspace.recoverProjectArchive',operationId,previewToken:recovery.value.previewToken,action:'complete_destination'});assert.equal(completed.value.operation.stage,'completed',JSON.stringify(completed));assert.equal(calls,1);
  assert.deepEqual(f.sql.prepare('SELECT binding,parents,native_identity FROM project_archive_operations WHERE operation_id=?').get(operationId),original);assert.deepEqual(f.sql.prepare('SELECT * FROM archived_folder_associations').all(),associations);
  assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact archived bytes');
  const exported=f.send({type:'data.export'});assert.equal(exported.ok,true);assert.equal(f.send({type:'data.restore',content:exported.value.content}).ok,true);
 },undefined,{native(from,to){calls++;renameNoReplace(from,to);throw new Error('lost restore response');}});
});

for(const conflictingRole of [false,'created','legacy','exactLegacy'])test(`archived grouped original parent ${conflictingRole==='exactLegacy'?'accepts exact current legacy role':conflictingRole?`rejects a contradictory ${conflictingRole} role`:'can be explicitly rebound after mode change and scope loss without activating dormant records'}`,()=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'archived-parent-role-'))),root=join(directory,'root'),path=join(directory,'app.sqlite');mkdirSync(join(root,'Category/Project'),{recursive:true});writeFileSync(join(root,'Category/Project/sentinel'),'retained');
 const observer={watch(){return{close(){}};},schedule(){return{cancel(){}};}};const open=()=>openSettingsService(path,undefined,undefined,observer);let service=open();const sql=new Database(path);
 try{
  const workspaceId=service.handleCommand({type:'workspace.create',name:'Roles',rootPath:root}).value.workspaceId,query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
  const discover=mode=>{const preview=query({type:'workspace.previewDiscovery',mode});assert.ok(preview.value.previewToken,JSON.stringify(preview));const applied=command({type:'workspace.applyDiscovery',previewToken:preview.value.previewToken});assert.equal(applied.ok,true,JSON.stringify(applied));return applied.value;};
  const grouped=discover('grouped'),projectId=grouped.projects[0].projectId,categoryId=grouped.projects[0].categoryId;
  const location=query({type:'workspace.previewArchiveLocation',relativePath:'Archive'});assert.equal(command({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:location.value.previewToken}).ok,true);
  const archive=query({type:'workspace.previewProjectArchive',projectId,action:'archive',name:null,createParent:false});assert.equal(command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:archive.value.previewToken}).value.operation.stage,'completed');
  const direct=discover('direct'),directId=direct.projects.find(row=>row.name==='Category').projectId;
  rmSync(join(directory,'installation-scope.json'));service.close();service=open();
  const bind=mappings=>{const preview=query({type:'workspace.previewSourceAssociation',mappings});assert.ok(preview.value.previewToken,JSON.stringify(preview));assert.equal(command({type:'workspace.applySourceAssociation',previewToken:preview.value.previewToken}).ok,true);};
  bind([]);const before=sql.prepare('SELECT * FROM categories WHERE id=?').get(categoryId),directBefore=sql.prepare('SELECT * FROM projects WHERE id=?').get(directId);
  if(conflictingRole){
   if(conflictingRole==='legacy'||conflictingRole==='exactLegacy'){
    const stale=JSON.stringify({...JSON.parse(before.native_identity),...(conflictingRole==='legacy'?{dev:'999'}:{})});sql.prepare('UPDATE categories SET durable_evidence=NULL,native_identity=? WHERE id=?').run(stale,categoryId);sql.prepare('UPDATE projects SET durable_evidence=NULL,native_identity=? WHERE id=?').run(stale,directId);
   }else{const saved=JSON.parse(directBefore.durable_evidence);sql.prepare('UPDATE projects SET durable_evidence=? WHERE id=?').run(JSON.stringify({...saved,created:(BigInt(saved.created)+1n).toString()}),directId);}
   const retainedCategory=sql.prepare('SELECT * FROM categories WHERE id=?').get(categoryId);
   if(conflictingRole==='exactLegacy'){bind([{kind:'category',id:categoryId,relativePath:'Category'}]);assert.deepEqual({...sql.prepare('SELECT * FROM categories WHERE id=?').get(categoryId),durable_evidence:null},retainedCategory);return;}
   const rejected=query({type:'workspace.previewSourceAssociation',mappings:[{kind:'category',id:categoryId,relativePath:'Category'}]});assert.equal(rejected.value.previewToken,null,JSON.stringify(rejected));assert.deepEqual(sql.prepare('SELECT * FROM categories WHERE id=?').get(categoryId),retainedCategory);return;
  }

  bind([{kind:'category',id:categoryId,relativePath:'Category'}]);
  assert.deepEqual({...sql.prepare('SELECT * FROM categories WHERE id=?').get(categoryId),durable_evidence:before.durable_evidence},before);assert.deepEqual(sql.prepare('SELECT * FROM projects WHERE id=?').get(directId),directBefore);
  bind([{kind:'project',id:directId,relativePath:'Category'}]);discover('grouped');
  bind([{kind:'project',id:projectId,relativePath:'Archive/Category/Project'}]);
  const restore=query({type:'workspace.previewProjectArchive',projectId,action:'restore',name:null,createParent:false});assert.ok(restore.value.previewToken,JSON.stringify(restore));assert.equal(command({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:restore.value.previewToken}).value.operation.stage,'completed');
  assert.equal(query({type:'workspace.listProjects'}).value.projects[0].projectId,projectId);assert.equal(readFileSync(join(root,'Category/Project/sentinel'),'utf8'),'retained');
 }finally{service.close();sql.close();rmSync(directory,{recursive:true,force:true});}
});

test('compiled production IPC explicitly binds a designated archive and restores with private v2 authority',()=>fixture(f=>{
 const parent=new EventEmitter(),port=new EventEmitter(),replies=[];parent.postMessage=()=>{};port.postMessage=message=>replies.push(message);port.start=()=>{};port.close=()=>{};
 startServiceProcess(parent);parent.emit('message',{data:{type:'connect',databasePath:f.path},ports:[port]});let serial=0;
 const workspaceId=f.query({type:'workspace.listArchivedProjects'}).value.workspaceId;
 const send=input=>{const id=++serial;port.emit('message',{data:{id,input:{workspaceId,...input}}});const reply=replies.find(message=>message.id===id);assert.ok(reply);return reply.result;};
 try{
  const review=send({type:'workspace.previewSourceAssociation',mappings:[{kind:'project',id:f.projectId,relativePath:'Cold/Archive/Project'}]});assert.ok(review.value.previewToken,JSON.stringify(review));
  assert.doesNotMatch(JSON.stringify(review),/"(?:authorization|binding|mount|evidence|scope)":/);
  const command={type:'workspace.applySourceAssociation',previewToken:review.value.previewToken};assert.equal(send({...command,authorization:{version:1}}).ok,false);assert.equal(send(command).ok,true);assert.equal(send(command).ok,false);
  assert.equal(send({type:'workspace.listArchivedProjects'}).value.projects[0].projectId,f.projectId);
  const restore=send({type:'workspace.previewProjectArchive',projectId:f.projectId,action:'restore',name:null,createParent:false});assert.ok(restore.value.previewToken,JSON.stringify(restore));
  const applied=send({type:'workspace.applyProjectArchive',operationId:randomUUID(),previewToken:restore.value.previewToken});assert.equal(applied.value.operation.stage,'completed',JSON.stringify(applied));
  assert.doesNotMatch(JSON.stringify(applied),/"(?:authorization|binding|mount|evidence|scope)":/);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact archived bytes');
 }finally{parent.emit('message',{data:{type:'shutdown'}});}
}));
