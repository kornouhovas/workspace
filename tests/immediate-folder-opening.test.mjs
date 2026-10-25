import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, symlinkSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {openSettingsService} from '../dist/service/settings.mjs';

function value(result) { assert.equal(result.ok,true,JSON.stringify(result)); return result.value; }

test('opening a fresh root immediately discovers status projects and persists grouped Table', () => {
  const directory=mkdtempSync(join(tmpdir(),'immediate-folders-'));
  const root=join(directory,'Root');
  for(const path of ['Archive/cpp/nested','Projects/draw','Empty','.hidden/secret']) mkdirSync(join(root,path),{recursive:true});
  const outside=join(directory,'Outside');mkdirSync(join(outside,'secret'),{recursive:true});
  symlinkSync(outside,join(root,'External'),process.platform==='win32'?'junction':'dir');
  writeFileSync(join(root,'Projects','draw','keep.txt'),'User project bytes');
  const database=join(directory,'data','workspace.sqlite');
  let app=openSettingsService(database);
  try {
    const created=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const projects=value(app.handleQuery({type:'workspace.listProjects',workspaceId:created.workspaceId}));
    assert.equal(projects.configured,true);
    assert.equal(projects.mode,'grouped');
    assert.equal(readFileSync(join(root,'Projects','draw','keep.txt'),'utf8'),'User project bytes');
    assert.deepEqual(projects.projects.map(p=>p.relativePath).sort(),['Archive/cpp','Projects/draw']);
    assert.deepEqual(projects.categories.map(c=>c.relativePath).sort(),['Archive','Empty','Projects']);
    assert.equal(projects.categoryProperty.name,null);
    assert.equal(projects.categoryProperty.defaultLabel,'status');
    const grouping={type:'workspace.getViewGrouping',workspaceId:created.workspaceId,viewId:created.viewId};
    assert.equal(value(app.handleQuery(grouping)).config.propertyId,projects.categoryProperty.propertyId);
    assert.equal(value(app.handleQuery({type:'workspace.listSources'})).sources[0].archiveRelativePath,null);
    app.close();app=openSettingsService(database);
    assert.deepEqual(value(app.handleQuery({type:'workspace.listProjects',workspaceId:created.workspaceId})).projects,projects.projects);
    assert.equal(value(app.handleQuery(grouping)).config.propertyId,projects.categoryProperty.propertyId);
  } finally { app.close(); rmSync(directory,{recursive:true,force:true}); }
});

test('a sibling reuses shared projects and properties but owns its default grouping', () => {
  const directory=mkdtempSync(join(tmpdir(),'immediate-reuse-'));
  const root=join(directory,'Root');mkdirSync(join(root,'Projects','draw'),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const first=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    const projects=value(app.handleQuery({type:'workspace.listProjects',workspaceId:first.workspaceId}));
    const property=value(app.handleCommand({type:'workspace.createProperty',workspaceId:first.workspaceId,name:'Notes',propertyType:'text'}));
    value(app.handleCommand({type:'workspace.setTextValue',workspaceId:first.workspaceId,projectId:projects.projects[0].projectId,propertyId:property.propertyId,value:'Keep exact notes'}));
    value(app.handleCommand({type:'workspace.setViewGrouping',workspaceId:first.workspaceId,viewId:first.viewId,config:{propertyId:null,settings:[]}}));
    const sibling=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    assert.equal(sibling.sourceId,first.sourceId);
    assert.deepEqual(value(app.handleQuery({type:'workspace.listProjects',workspaceId:sibling.workspaceId})).projects,projects.projects);
    assert.equal(value(app.handleQuery({type:'workspace.listTextProperties',workspaceId:sibling.workspaceId})).values[0].value,'Keep exact notes');
    assert.equal(value(app.handleQuery({type:'workspace.getViewGrouping',workspaceId:sibling.workspaceId,viewId:sibling.viewId})).config.propertyId,projects.categoryProperty.propertyId);
    assert.equal(value(app.handleQuery({type:'workspace.getViewGrouping',workspaceId:first.workspaceId,viewId:first.viewId})).config.propertyId,null);
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('configured direct sources keep their interpretation, exclusions and archive when reused', () => {
  const directory=mkdtempSync(join(tmpdir(),'immediate-existing-'));
  const root=join(directory,'Root');
  for (const name of ['Keep','Excluded']) mkdirSync(join(root,name),{recursive:true});
  const app=openSettingsService(join(directory,'data','workspace.sqlite'));
  try {
    const first=value(app.handleCommand({type:'workspace.create',name:'Existing',rootPath:root}));
    const preview=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:first.workspaceId,mode:'direct',excludedRelativePaths:['Excluded']}));
    const projects=value(app.handleCommand({type:'workspace.applyDiscovery',workspaceId:first.workspaceId,previewToken:preview.previewToken}));
    const archive=value(app.handleQuery({type:'workspace.previewArchiveLocation',workspaceId:first.workspaceId,relativePath:'SavedArchive'}));
    value(app.handleCommand({type:'workspace.applyArchiveLocation',workspaceId:first.workspaceId,operationId:crypto.randomUUID(),previewToken:archive.previewToken}));
    const before=value(app.handleQuery({type:'workspace.listSources'}));
    const sibling=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    assert.equal(sibling.sourceId,first.sourceId);
    const after=value(app.handleQuery({type:'workspace.listProjects',workspaceId:sibling.workspaceId}));
    assert.equal(after.mode,'direct');assert.deepEqual(after.projects,projects.projects);
    const sources=value(app.handleQuery({type:'workspace.listSources'}));
    assert.equal(sources.sources[0].archiveRelativePath,'SavedArchive');
    const review=value(app.handleQuery({type:'workspace.previewDiscovery',workspaceId:sibling.workspaceId}));
    assert.deepEqual(review.excludedRelativePaths,['Excluded']);
    assert.equal(sources.sources[0].discoveryMode,before.sources[0].discoveryMode);
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('an existing unconfigured source is preserved instead of silently adopting folders', () => {
  const directory=mkdtempSync(join(tmpdir(),'immediate-unconfigured-'));
  const root=join(directory,'Root');mkdirSync(join(root,'Projects','draw'),{recursive:true});
  const database=join(directory,'data','workspace.sqlite');
  let app=openSettingsService(database);
  try {
    const first=value(app.handleCommand({type:'workspace.create',name:'Retained',rootPath:root}));
    app.close();app=openSettingsService(database);
    const sibling=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}));
    assert.equal(sibling.sourceId,first.sourceId);
    const projects=value(app.handleQuery({type:'workspace.listProjects',workspaceId:sibling.workspaceId}));
    assert.equal(projects.configured,false);assert.deepEqual(projects.projects,[]);
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

for (const failure of ['unsupported','changed']) test(`${failure} evidence rolls back immediate creation without committed events`, async () => {
  const {observeFolder}=await import('../src/service/folder-evidence.ts');
  const directory=mkdtempSync(join(tmpdir(),'immediate-failure-'));
  const root=join(directory,'Root');mkdirSync(join(root,'Projects','draw'),{recursive:true});
  let reads=0;
  const reader=(path,scope)=> failure==='unsupported' || ++reads>9 ? {ok:false,reason:failure} : observeFolder(path,scope);
  const app=openSettingsService(join(directory,'data','workspace.sqlite'),undefined,undefined,undefined,undefined,undefined,reader);
  const events=[];app.workspaces.subscribe(event=>events.push(event));
  try {
    assert.equal(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:root,initialize:'status'}).ok,false);
    assert.deepEqual(value(app.handleQuery({type:'workspace.load'})),{workspaces:[],activeWorkspace:null});
    assert.deepEqual(value(app.handleQuery({type:'workspace.listSources'})).sources,[]);
    assert.deepEqual(events,[]);
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});

test('upgrade preserves legacy null and authored category names without selecting the Status default', async () => {
  const {default:Database}=await import('better-sqlite3');
  const {drizzle}=await import('drizzle-orm/better-sqlite3');
  const {migrate}=await import('drizzle-orm/better-sqlite3/migrator');
  const {cpSync,mkdirSync,readFileSync,writeFileSync,realpathSync}=await import('node:fs');
  const directory=mkdtempSync(join(tmpdir(),'immediate-label-upgrade-'));
  const database=join(directory,'workspace.sqlite'),migrations=join(directory,'migrations');
  cpSync(join(process.cwd(),'src/service/db/migrations'),migrations,{recursive:true});
  const journalPath=join(migrations,'meta','_journal.json');
  const journal=JSON.parse(readFileSync(journalPath,'utf8'));
  journal.entries=journal.entries.slice(0,32);writeFileSync(journalPath,JSON.stringify(journal));
  const sqlite=new Database(database);
  const saved=[];
  try {
    migrate(drizzle(sqlite),{migrationsFolder:migrations});
    sqlite.prepare("INSERT INTO settings(key,value) VALUES('language','en')").run();
    for (const [index,name] of [null,'  Authored Status  '].entries()) {
      const root=join(directory,`Root${index}`);mkdirSync(root);
      const sourceId=crypto.randomUUID(),propertyId=crypto.randomUUID();
      sqlite.prepare("INSERT INTO sources(id,canonical_root,discovery_mode) VALUES(?,?,'grouped')").run(sourceId,realpathSync.native(root));
      sqlite.prepare('INSERT INTO category_properties(id,source_id,name) VALUES(?,?,?)').run(propertyId,sourceId,name);
      saved.push({root,sourceId,propertyId,name});
    }
  } finally {sqlite.close();}
  const app=openSettingsService(database);
  try {
    for (const previous of saved) {
      const workspace=value(app.handleCommand({type:'workspace.create',name:'Workspace',rootPath:previous.root,initialize:'status'}));
      assert.equal(workspace.sourceId,previous.sourceId);
      assert.deepEqual(value(app.handleQuery({type:'workspace.listProjects',workspaceId:workspace.workspaceId})).categoryProperty,
        {propertyId:previous.propertyId,sourceId:previous.sourceId,name:previous.name});
    }
  } finally {app.close();rmSync(directory,{recursive:true,force:true});}
});
