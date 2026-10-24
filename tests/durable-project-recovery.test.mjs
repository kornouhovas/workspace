import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,renameSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {openSettingsService} from '../dist/service/settings.mjs';

const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
function fixture(run,mode='direct',reader) {
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'durable-recovery-'))),root=join(directory,'source'),dbPath=join(directory,'settings.sqlite');
 const oldPath=mode==='direct'?'Project':'Category/Project',target=mode==='direct'?'Target':'Category/Target';
 mkdirSync(join(root,oldPath),{recursive:true});writeFileSync(join(root,oldPath,'sentinel'),'exact contents');
 const open=()=>openSettingsService(dbPath,undefined,undefined,observer,undefined,undefined,reader);
 let service=open();const workspace=service.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode}).value,list=command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).value,projectId=list.projects[0].projectId;
 const propertyId=command({type:'workspace.createProperty',propertyType:'text',name:'Notes'}).value.propertyId;
 command({type:'workspace.setTextValue',projectId,propertyId,value:'exact\nmetadata'});
 const sql=new Database(dbPath),review=()=>query({type:'workspace.previewProjectRecovery',projectId}),apply=(preview,path=target)=>command({type:'workspace.reassociateProject',projectId,previewToken:preview.previewToken,relativePath:path});
 try{run({directory,root,sql,projectId,workspaceId,query,command,review,apply,oldPath,target,subscribe:listener=>service.workspaces.subscribe(listener),restart(){service.close();service=open();}});}
 finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
for(const mode of ['direct','grouped'])test(`${mode} explicit reassociation enrolls only reviewed target after stored dev changes and preserves ID/values`,()=>fixture(f=>{
 for(const [table,column] of [['sources','applied_root_identity'],['categories','native_identity'],['projects','native_identity']])f.sql.exec(`UPDATE ${table} SET ${column}=json_set(${column},'$.dev','999')`);
 renameSync(join(f.root,f.oldPath),join(f.directory,'away'));
 const missing=f.query({type:'workspace.previewDiscovery',mode}).value;assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:missing.previewToken}).ok,true);
 renameSync(join(f.directory,'away'),join(f.root,f.target));f.restart();
 const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.entries.find(e=>e.relativePath===f.target).status,'selectable');
 const generation=f.sql.prepare('SELECT evidence_generation FROM sources').get().evidence_generation;
 const result=f.apply(preview.value);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.projects[0].projectId,f.projectId);
 assert.equal(f.sql.prepare('SELECT evidence_generation FROM sources').get().evidence_generation,generation+1);assert.equal(result.value.projects[0].relativePath,f.target);
 assert.ok(f.sql.prepare('SELECT durable_evidence FROM projects WHERE id=?').get(f.projectId).durable_evidence);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.values[0].value,'exact\nmetadata');assert.equal(readFileSync(join(f.root,f.target,'sentinel'),'utf8'),'exact contents');
 f.restart();assert.equal(f.query({type:'workspace.listProjects'}).value.projects[0].projectId,f.projectId);
 assert.equal(f.apply(preview.value).error.code,'stale_preview');
},mode));
for(const change of ['created','volume','scope','mount'])test(`reassociation review rejects target ${change} change before metadata writes`,()=>{
 let substituted=false;
 const reader=(path,scope)=>{const value=observeFolder(path,scope);if(!value.ok || !substituted || basename(path)!=='Target')return value;
  if(change==='mount')return {...value,mount:{...value.mount,dev:'999'}};
  const evidence={...value.evidence};if(change==='created')evidence.created=(BigInt(evidence.created)+1n).toString();if(change==='scope')evidence.scope='another-installation';
  if(change==='volume')evidence.volume=evidence.provider==='apfs'?'1234567890abcdef1234567890abcdef':'\\\\?\\Volume{12345678-1234-1234-1234-123456789abc}\\';
  return {...value,evidence};};
 fixture(f=>{
  renameSync(join(f.root,f.oldPath),join(f.root,f.target));const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));assert.ok(preview.value.previewToken);
  const before=f.sql.prepare('SELECT * FROM projects').all();substituted=true;
  const result=f.apply(preview.value);assert.equal(result.ok,false);assert.equal(result.error.code,'stale_preview');assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
 },'direct',reader);
});
test('grouped recovery refuses implicit enrollment of an existing unverified parent',()=>fixture(f=>{
 renameSync(join(f.root,f.oldPath),join(f.root,f.target));f.sql.exec('UPDATE categories SET durable_evidence=NULL');
 const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.entries.find(e=>e.relativePath===f.target).status,'category_unavailable');
 assert.equal(f.apply(preview.value).ok,false);assert.equal(f.sql.prepare('SELECT durable_evidence FROM categories').get().durable_evidence,null);
},'grouped'));
test('grouped recovery explicitly enrolls selected new parent and project while leaving its other child undiscovered',()=>fixture(f=>{
 renameSync(join(f.root,'Category'),join(f.directory,'away'));mkdirSync(join(f.root,'New/Chosen'),{recursive:true});mkdirSync(join(f.root,'New/Other'));
 const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.entries.find(e=>e.relativePath==='New/Chosen').status,'selectable');
 const result=f.apply(preview.value,'New/Chosen');assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.value.projects[0].projectId,f.projectId);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM projects').get().n,1);assert.ok(f.sql.prepare("SELECT durable_evidence FROM categories WHERE relative_path='New'").get().durable_evidence);
 assert.ok(f.sql.prepare('SELECT durable_evidence FROM projects WHERE id=?').get(f.projectId).durable_evidence);
},'grouped'));

for(const change of ['generation','root-unverified','root-scope'])test(`reassociation refuses ${change} without enrollment`,()=>fixture(f=>{
 renameSync(join(f.root,f.oldPath),join(f.root,f.target));
 const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));assert.ok(preview.value.previewToken);
 if(change==='generation')f.sql.exec('UPDATE sources SET evidence_generation=evidence_generation+1');
 if(change==='root-unverified')f.sql.exec('UPDATE sources SET durable_evidence=NULL');
 if(change==='root-scope')f.sql.exec("UPDATE sources SET durable_evidence=json_set(durable_evidence,'$.scope','foreign')");
 const before=f.sql.prepare('SELECT * FROM projects').all();
 const result=f.apply(preview.value);assert.equal(result.ok,false);assert.equal(result.error.code,'stale_preview');assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
}));
for(const proof of ['durable','legacy'])test(`reassociation cannot take a competing ${proof} owner after historical device changes`,()=>fixture(f=>{
 mkdirSync(join(f.root,'Other'));const discover=f.query({type:'workspace.previewDiscovery',mode:'direct'}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:discover.previewToken}).ok,true);
 renameSync(join(f.root,'Project'),join(f.directory,'away'));renameSync(join(f.root,'Other'),join(f.root,'Target'));
 f.sql.exec("UPDATE projects SET native_identity=json_set(native_identity,'$.dev','999') WHERE relative_path='Other'");
 if(proof==='legacy')f.sql.exec("UPDATE projects SET durable_evidence=NULL WHERE relative_path='Other'");
 const before=f.sql.prepare('SELECT * FROM projects ORDER BY id').all(),preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));
 assert.equal(preview.value.entries.find(row=>row.relativePath==='Target').status,'native_conflict');
 assert.equal(f.apply(preview.value).ok,false);assert.deepEqual(f.sql.prepare('SELECT * FROM projects ORDER BY id').all(),before);
}));
test('reassociation rolls back durable enrollment and emits no success on a late SQL failure',()=>fixture(f=>{
 renameSync(join(f.root,f.oldPath),join(f.root,f.target));const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));
 const events=[];f.subscribe(event=>events.push(event));
 const before=f.sql.prepare('SELECT * FROM projects').all();f.sql.exec("CREATE TRIGGER fail_reassociation BEFORE UPDATE ON sources BEGIN SELECT RAISE(ABORT,'late failure'); END");
 const result=f.apply(preview.value);assert.equal(result.ok,false);assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
 assert.equal(readFileSync(join(f.root,f.target,'sentinel'),'utf8'),'exact contents');assert.deepEqual(events,[]);
}));

test('root ownership conflict with another saved object cannot authorize a reassociation',()=>fixture(f=>{
 renameSync(join(f.root,f.oldPath),join(f.root,f.target));
 f.sql.exec("UPDATE projects SET association_state='missing'");
 f.sql.exec("INSERT INTO projects (id,source_id,relative_path,native_identity,durable_evidence,association_state) SELECT '00000000-0000-4000-8000-000000000001',id,'Conflicting',applied_root_identity,durable_evidence,'missing' FROM sources");
 const before=f.sql.prepare('SELECT * FROM projects ORDER BY id').all(),preview=f.review();
 assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects ORDER BY id').all(),before);
}));

for(const mode of ['direct','grouped'])test(`${mode} reassociation refuses duplicate full durable identities among unowned candidates`,()=>{
 let ambiguous=false;
 const reader=(path,scope)=>{
  const value=observeFolder(path,scope);if(!ambiguous || !value.ok || !(mode==='direct'?['Target','Twin']:['New','Other']).includes(basename(path)))return value;
  const fileId=value.evidence.provider==='apfs'?'999999999999':'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  return {...value,evidence:{...value.evidence,fileId,created:'999999999999'}};
 };
 fixture(f=>{
  renameSync(join(f.root,mode==='direct'?f.oldPath:'Category'),join(f.directory,'away'));
  if(mode==='direct'){mkdirSync(join(f.root,'Target'));mkdirSync(join(f.root,'Twin'));}
  else{mkdirSync(join(f.root,'New/Target'),{recursive:true});mkdirSync(join(f.root,'Other/Twin'),{recursive:true});}
  ambiguous=true;const before=f.sql.prepare('SELECT * FROM projects').all(),preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));
  const path=mode==='direct'?'Target':'New/Target';assert.notEqual(preview.value.entries.find(row=>row.relativePath===path).status,'selectable');
  assert.equal(f.apply(preview.value,path).ok,false);assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
 },mode,reader);
});
test('one recovery scan acquires a linear number of native folder proofs',()=>{
 let calls=0;const reader=(path,scope)=>{calls++;return observeFolder(path,scope);};
 fixture(f=>{
  renameSync(join(f.root,f.oldPath),join(f.directory,'away'));
  for(let i=0;i<30;i++)mkdirSync(join(f.root,`Target${i}`));
  calls=0;const preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.entries.filter(row=>row.status==='selectable').length,30);
  assert.ok(calls<300,`Expected linear acquisition; observed ${calls} evidence reads for30 candidates`);
 },'direct',reader);
});

for(const conflict of ['created','scope','missing','different-path','legacy'])test(`direct own-path role recovery keeps ${conflict} category ownership veto`,()=>fixture(f=>{
 for(const mode of ['grouped','direct']) {
  const review=f.query({type:'workspace.previewDiscovery',mode});assert.equal(review.ok,true);
  assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:review.value.previewToken}).ok,true);
 }
 if(conflict==='created')f.sql.exec("UPDATE categories SET durable_evidence=json_set(durable_evidence,'$.created','999999999999')");
 if(conflict==='scope')f.sql.exec("UPDATE categories SET durable_evidence=json_set(durable_evidence,'$.scope','foreign')");
 if(conflict==='missing')f.sql.exec("UPDATE categories SET association_state='missing'");
 if(conflict==='different-path')f.sql.exec("UPDATE categories SET relative_path='Different'");
 if(conflict==='legacy')f.sql.exec('UPDATE categories SET durable_evidence=NULL');
 const before=[f.sql.prepare('SELECT * FROM projects').all(),f.sql.prepare('SELECT * FROM categories').all()],review=f.review();assert.equal(review.ok,true,JSON.stringify(review));
 assert.notEqual(review.value.entries.find(entry=>entry.relativePath==='Project')?.status,'selectable');
 assert.equal(f.apply(review.value,'Project').ok,false);
 assert.deepEqual([f.sql.prepare('SELECT * FROM projects').all(),f.sql.prepare('SELECT * FROM categories').all()],before);
}));

test('new grouped parent cannot take another retained project path even when its old proof differs',()=>fixture(f=>{
 renameSync(join(f.root,'Category'),join(f.directory,'away'));mkdirSync(join(f.root,'New/Chosen'),{recursive:true});mkdirSync(join(f.directory,'historical'));
 const scope=JSON.parse(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence).scope;
 const old=observeFolder(join(f.directory,'historical'),scope);assert.equal(old.ok,true);
 f.sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,durable_evidence,association_state,mode_inactive) VALUES('00000000-0000-4000-8000-000000000001',?,'New',?,?,'missing',1)").run(f.sql.prepare('SELECT id FROM sources').get().id,JSON.stringify(old.mount),JSON.stringify(old.evidence));
 const before=f.sql.prepare('SELECT * FROM projects ORDER BY id').all(),review=f.review();assert.equal(review.ok,true,JSON.stringify(review));
 assert.equal(review.value.entries.find(row=>row.relativePath==='New/Chosen').status,'category_unavailable');assert.equal(f.apply(review.value,'New/Chosen').ok,false);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects ORDER BY id').all(),before);
},'grouped'));

test('direct own-path recovery cannot take a dormant category path with independently different object evidence',()=>fixture(f=>{
 for(const mode of ['grouped','direct']){const preview=f.query({type:'workspace.previewDiscovery',mode}).value;assert.equal(f.command({type:'workspace.applyDiscovery',previewToken:preview.previewToken}).ok,true);}
 mkdirSync(join(f.directory,'different-object'));
 const scope=JSON.parse(f.sql.prepare('SELECT durable_evidence FROM sources').get().durable_evidence).scope,other=observeFolder(join(f.directory,'different-object'),scope);assert.equal(other.ok,true);
 f.sql.prepare('UPDATE categories SET native_identity=?,durable_evidence=?').run(JSON.stringify(other.mount),JSON.stringify(other.evidence));
 const before=f.sql.prepare('SELECT * FROM projects').all(),preview=f.review();assert.equal(preview.ok,true,JSON.stringify(preview));
 assert.notEqual(preview.value.entries.find(row=>row.relativePath==='Project')?.status,'selectable');assert.equal(f.apply(preview.value,'Project').ok,false);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
}));
for(const stale of [false,true])test(`grouped recovery ${stale?'refuses stale':'permits exact'} legacy dormant parent-role triples`,()=>fixture(f=>{
 renameSync(join(f.root,f.oldPath),join(f.root,f.target));
 const category=f.sql.prepare('SELECT * FROM categories').get(),native=JSON.parse(category.native_identity);if(stale)native.dev='999';
 const bytes=JSON.stringify(native);f.sql.prepare('UPDATE categories SET native_identity=?').run(bytes);
 f.sql.prepare("INSERT INTO projects(id,source_id,relative_path,native_identity,association_state,mode_inactive) VALUES('00000000-0000-4000-8000-000000000001',?,'Category',?,'active',1)").run(category.source_id,bytes);
 const dormant=f.sql.prepare("SELECT * FROM projects WHERE id='00000000-0000-4000-8000-000000000001'").get(),review=f.review();assert.equal(review.ok,true,JSON.stringify(review));
 assert.equal(review.value.entries.find(row=>row.relativePath===f.target).status,stale?'category_unavailable':'selectable');
 const result=f.apply(review.value);assert.equal(result.ok,!stale,JSON.stringify(result));
 assert.deepEqual(f.sql.prepare("SELECT * FROM projects WHERE id='00000000-0000-4000-8000-000000000001'").get(),dormant);
},'grouped'));

test('a changed full root proof between root authorization and scan evidence cannot authorize recovery',()=>{
 let rootPath,armed=false,rootReads=0,changes=0;
 const reader=(path,scope)=>{
  const value=observeFolder(path,scope);
  if(!armed || !value.ok || path!==rootPath)return value;
  // Root/source authorization succeeds first; the independently acquired
  // complete-scan evidence must still reject a different full root identity.
  rootReads++;if(rootReads%6!==0)return value;changes++;
  return {...value,evidence:{...value.evidence,created:(BigInt(value.evidence.created)+1n).toString()}};
 };
 fixture(f=>{
  renameSync(join(f.root,f.oldPath),join(f.root,f.target));rootPath=f.root;armed=true;
  const before=f.sql.prepare('SELECT * FROM projects').all(),review=f.review();assert.equal(review.ok,false,JSON.stringify(review));assert.ok(changes>0);assert.equal(review.error.code,'stale_preview');
  assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),before);
 },'direct',reader);
});
