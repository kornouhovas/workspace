import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,renameSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {observeFolder} from '../src/service/folder-evidence.ts';
import {openSettingsService} from '../dist/service/settings.mjs';
const observer={watch(){return {close(){}};},schedule(){return {cancel(){}};}};
function fixture(run,reader) {
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'durable-archive-location-'))),root=join(directory,'root'),path=join(directory,'app.sqlite');
 mkdirSync(join(root,'Project'),{recursive:true});writeFileSync(join(root,'Project/sentinel'),'exact contents');
 const open=()=>openSettingsService(path,undefined,undefined,observer,undefined,undefined,reader);
 let service=open();const workspace=service.handleCommand({type:'workspace.create',rootPath:root,name:'Workspace'}).value,workspaceId=workspace.workspaceId;
 const query=input=>service.handleQuery({workspaceId,...input}),command=input=>service.handleCommand({workspaceId,...input});
 const preview=query({type:'workspace.previewDiscovery',mode:'direct'}).value;
 command({type:'workspace.applyDiscovery',previewToken:preview.previewToken});const sql=new Database(path);
 const review=relativePath=>query({type:'workspace.previewArchiveLocation',relativePath}),apply=preview=>command({type:'workspace.applyArchiveLocation',operationId:randomUUID(),previewToken:preview.previewToken});
 try{run({directory,root,sql,query,command,review,apply,get service(){return service;},restart(){service.close();service=open();}});}
 finally{sql.close();service.close();rmSync(directory,{recursive:true,force:true});}
}
test('archive designation reacquires stored root device changes and persists only selected policy across restart',()=>fixture(f=>{
 f.sql.exec("UPDATE sources SET applied_root_identity=json_set(applied_root_identity,'$.dev','999')");
 const projects=f.sql.prepare('SELECT * FROM projects').all();f.restart();
 const preview=f.review('Cold/Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.deepEqual(preview.value.blockers,[]);assert.ok(preview.value.previewToken);
 assert.equal(existsSync(join(f.root,'Cold')),false);assert.equal(f.apply(preview.value).ok,true);
 assert.deepEqual(f.sql.prepare('SELECT * FROM projects').all(),projects);assert.equal(readFileSync(join(f.root,'Project/sentinel'),'utf8'),'exact contents');
 f.restart();assert.equal(f.query({type:'workspace.listArchivedProjects'}).value.relativePath,'Cold/Archive');
}));
for(const change of ['created','volume','scope','mount'])test(`archive designation rejects ${change} substitution after preview`,()=>{
 let substituted=false;
 const reader=(path,scope)=>{
  const value=observeFolder(path,scope);if(!substituted || !value.ok || basename(path)!=='Archive')return value;
  if(change==='mount')return {...value,mount:{...value.mount,dev:'999'}};
  const evidence={...value.evidence};if(change==='created')evidence.created=(BigInt(evidence.created)+1n).toString();if(change==='scope')evidence.scope='foreign';
  if(change==='volume')evidence.volume=evidence.provider==='apfs'?'1234567890abcdef1234567890abcdef':'\\\\?\\Volume{12345678-1234-1234-1234-123456789abc}\\';
  return {...value,evidence};
 };
 fixture(f=>{
  mkdirSync(join(f.root,'Cold/Archive'),{recursive:true});const preview=f.review('Cold/Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.ok(preview.value.previewToken);
  const source=f.sql.prepare('SELECT * FROM sources').get();substituted=true;
  assert.equal(f.apply(preview.value).ok,false);assert.deepEqual(f.sql.prepare('SELECT * FROM sources').get(),source);
 },reader);
});
test('archive designation keeps property-only edits independent of folder authorization',()=>fixture(f=>{
 const preview=f.review('Archive');assert.equal(preview.ok,true,JSON.stringify(preview));
 assert.equal(f.command({type:'workspace.createProperty',propertyType:'text',name:'Independent'}).ok,true);
 assert.equal(f.apply(preview.value).ok,true);
 assert.equal(f.query({type:'workspace.listTextProperties'}).value.definitions[0].name,'Independent');
}));
test('archive designation cannot use another saved source root after it moves under this source',()=>fixture(f=>{
 const peer=join(f.directory,'peer');mkdirSync(peer);f.service.handleCommand({type:'workspace.create',name:'Peer',rootPath:peer});
 const prior=f.service.handleQuery({type:'workspace.load'});assert.equal(prior.ok,true);
 renameSync(peer,join(f.root,'Archive'));
 const preview=f.review('Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT archive_relative_path FROM sources WHERE canonical_root=?').get(f.root).archive_relative_path,null);
}));

test('archive designation rolls back policy if a component changes after its SQL write',()=>{
 let armed=false,reads=0;
 const reader=(path,scope)=>{
  const value=observeFolder(path,scope);if(!armed || !value.ok || basename(path)!=='Archive')return value;
  if(++reads!==3)return value;
  return {...value,evidence:{...value.evidence,created:(BigInt(value.evidence.created)+1n).toString()}};
 };
 fixture(f=>{
  mkdirSync(join(f.root,'Archive'));const preview=f.review('Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.ok(preview.value.previewToken);
  const events=[];f.service.workspaces.subscribe(event=>events.push(event));
  const before=f.sql.prepare('SELECT * FROM sources').all();armed=true;
  assert.equal(f.apply(preview.value).ok,false);assert.ok(reads>=3);
  assert.deepEqual(f.sql.prepare('SELECT * FROM sources').all(),before);assert.equal(existsSync(join(f.root,'Archive')),true);assert.deepEqual(events,[]);
 },reader);
});

for(const nested of [false,true])test(`archive designation protects legacy unconfigured saved root ${nested?'inside':'at'} its selected location`,()=>fixture(f=>{
 const peer=join(f.root,nested?'Archive/Peer':'Archive');mkdirSync(peer,{recursive:true});
 assert.equal(f.service.handleCommand({type:'workspace.create',name:'Legacy peer',rootPath:peer}).ok,true);
 f.sql.prepare('UPDATE sources SET durable_evidence=NULL,applied_root_identity=NULL WHERE canonical_root=?').run(peer);
 const preview=f.review('Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT archive_relative_path FROM sources WHERE canonical_root=?').get(f.root).archive_relative_path,null);
}));

test('unverified source evidence cannot configure an archive even with matching native triples',()=>fixture(f=>{
 f.sql.exec('UPDATE sources SET durable_evidence=NULL');const before=f.sql.prepare('SELECT * FROM sources').all(),preview=f.review('Archive');
 assert.equal(preview.ok,false);assert.deepEqual(f.sql.prepare('SELECT * FROM sources').all(),before);
}));
test('duplicate full durable identities in separate archive components cannot receive a review token',()=>{
 const reader=(path,scope)=>{
  const value=observeFolder(path,scope);if(!value.ok || !['Cold','Archive'].includes(basename(path)))return value;
  return {...value,evidence:{...value.evidence,fileId:value.evidence.provider==='apfs'?'999999999999':'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',created:'999999999999'}};
 };
 fixture(f=>{
  mkdirSync(join(f.root,'Cold/Archive'),{recursive:true});const preview=f.review('Cold/Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null);assert.ok(preview.value.blockers.includes('owned_location'));
  assert.equal(f.sql.prepare('SELECT archive_relative_path FROM sources').get().archive_relative_path,null);
 },reader);
});

test('archive designation protects missing legacy saved-root aliases without rewriting authored paths',()=>fixture(f=>{
 const peer=join(f.root,'archive','Peer');mkdirSync(peer,{recursive:true});assert.equal(f.service.handleCommand({type:'workspace.create',name:'Legacy alias',rootPath:peer}).ok,true);
 f.sql.prepare('UPDATE sources SET durable_evidence=NULL,applied_root_identity=NULL WHERE canonical_root=?').run(peer);rmSync(join(f.root,'archive'),{recursive:true});
 const preview=f.review('Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT canonical_root FROM sources WHERE canonical_root=?').get(peer).canonical_root,peer);
}));
test('a nested selected source may designate its own archive beneath a separately saved ancestor source',()=>fixture(f=>{
 const nested=join(f.root,'Sub');mkdirSync(nested);const workspace=f.service.handleCommand({type:'workspace.create',rootPath:nested,name:'Nested'}).value;
 const preview=f.query({type:'workspace.previewDiscovery',workspaceId:workspace.workspaceId,mode:'direct'}).value;
 assert.equal(f.command({type:'workspace.applyDiscovery',workspaceId:workspace.workspaceId,previewToken:preview.previewToken}).ok,true);
 const location=f.query({type:'workspace.previewArchiveLocation',workspaceId:workspace.workspaceId,relativePath:'Archive'});assert.equal(location.ok,true,JSON.stringify(location));assert.ok(location.value.previewToken);
 const saved=f.command({type:'workspace.applyArchiveLocation',workspaceId:workspace.workspaceId,operationId:randomUUID(),previewToken:location.value.previewToken});assert.equal(saved.ok,true,JSON.stringify(saved));
 assert.equal(saved.value.relativePath,'Archive');assert.equal(existsSync(join(nested,'Archive')),false);
}));

test('a legacy saved source alias equal to the selected root is not a strict ancestor exception',()=>fixture(f=>{
 const alias=f.root.toUpperCase();assert.notEqual(alias,f.root);
 f.sql.prepare('INSERT INTO sources(id,canonical_root) VALUES(?,?)').run(randomUUID(),alias);
 const preview=f.review('Archive');assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.value.previewToken,null);
 assert.equal(f.sql.prepare('SELECT archive_relative_path FROM sources WHERE canonical_root=?').get(f.root).archive_relative_path,null);
}));
