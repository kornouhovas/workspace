import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../src/service/settings.ts';
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };

test('startup creates a verified automatic snapshot; restart preserves its schedule and saved WAL data restores', () => {
  const dir = mkdtempSync(join(tmpdir(), 'automatic-backups-')), path = join(dir, 'app.sqlite');
  let service = openSettingsService(path);
  try {
    const first = unwrap(service.handleQuery({type:'data.backups'})).backups;
    assert.equal(first.state, 'ready');
    assert.equal(first.snapshots.length, 1);
    assert.equal(first.snapshots[0].kind, 'automatic');
    assert.equal(first.destination, join(dir, 'backups'));
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'ru'}));
    const saved = unwrap(service.handleCommand({type:'data.backupNow'})).backups;
    const content = unwrap(service.handleQuery({type:'data.backupExport',backupId:saved.snapshots[0].id})).content;
    assert.equal(content, readFileSync(join(dir,'backups',saved.snapshots[0].id),'utf8'));
    service.close(); service = openSettingsService(path);
    assert.equal(unwrap(service.handleQuery({type:'data.backups'})).backups.snapshots.length, 2);
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'en'}));
    unwrap(service.handleCommand({type:'data.restore',content}));
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language, 'ru');
  } finally { service.close(); rmSync(dir,{recursive:true,force:true}); }
});

import Database from 'better-sqlite3';
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
const migrations = join(process.cwd(),'src/service/db/migrations');
function upgradeFixture(dir, sql) {
  const folder = join(dir,'migrations'); cpSync(migrations,folder,{recursive:true});
  const journalPath = join(folder,'meta/_journal.json'), journal = JSON.parse(readFileSync(journalPath,'utf8'));
  const last = journal.entries.at(-1);
  journal.entries.push({...last,idx:last.idx+1,when:last.when+1,tag:'0023_backup_upgrade'});
  writeFileSync(journalPath,JSON.stringify(journal));writeFileSync(join(folder,'0023_backup_upgrade.sql'),sql);
  return folder;
}

test('upgrade writes a usable pre-migration snapshot; failed migration rolls back and older service can restore it', () => {
  const dir=mkdtempSync(join(tmpdir(),'migration-backup-')),path=join(dir,'app.sqlite');
  let service=openSettingsService(path);
  try {
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'ru'})); service.close();
    const folder=upgradeFixture(dir,"CREATE TABLE upgrade_probe (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_table VALUES ('fail');");
    assert.throws(()=>openSettingsService(path,folder), error=>error.code==='MIGRATION_FAILED');
    const id=readdirSync(join(dir,'backups')).find(id=>id.startsWith('pre-migration-'));
    assert.ok(id);
    service=openSettingsService(path);
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'ru');
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'en'}));
    unwrap(service.handleCommand({type:'data.restore',content:readFileSync(join(dir,'backups',id),'utf8')}));
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'ru');
    const exportImage=JSON.parse(unwrap(service.handleQuery({type:'data.export'})).content);
    const image=Buffer.from(exportImage.database,'base64');image[18]=image[19]=1;
    const db=new Database(image);
    try { assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='upgrade_probe'").get(),undefined); } finally { db.close(); }
  } finally { service.close();rmSync(dir,{recursive:true,force:true}); }
});

test('successful upgrade preserves existing data and the old-schema backup remains usable with its matching service', () => {
  const dir=mkdtempSync(join(tmpdir(),'backup-upgrade-')),path=join(dir,'app.sqlite');
  let service=openSettingsService(path);
  try {
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'ru'}));service.close();
    const folder=upgradeFixture(dir,'CREATE TABLE upgrade_probe (id TEXT);');
    service=openSettingsService(path,folder);
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'ru');
    const status=unwrap(service.handleQuery({type:'data.backups'})).backups;
    const id=status.snapshots.find(item=>item.kind==='pre-migration').id;
    const content=unwrap(service.handleQuery({type:'data.backupExport',backupId:id})).content;
    assert.equal(service.handleCommand({type:'data.restore',content}).error.code,'invalid_input');
    const recovery=openSettingsService(join(dir,'recovered','app.sqlite'));
    try {
      unwrap(recovery.handleCommand({type:'data.restore',content}));
      assert.equal(unwrap(recovery.handleQuery({type:'settings.load'})).language,'ru');
    } finally { recovery.close(); }
  } finally { service.close();rmSync(dir,{recursive:true,force:true}); }
});

test('backup write failure blocks pending migration and automatic failure offers retry without changing live data', () => {
  const dir=mkdtempSync(join(tmpdir(),'backup-failure-')),path=join(dir,'app.sqlite');
  let service=openSettingsService(path);
  try {
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'ru'}));service.close();
    rmSync(join(dir,'backups'),{recursive:true});writeFileSync(join(dir,'backups'),'blocked');
    const folder=upgradeFixture(dir,'CREATE TABLE upgrade_probe (id TEXT);');
    assert.throws(()=>openSettingsService(path,folder),error=>error.code==='BACKUP_FAILED');
    service=openSettingsService(path);
    assert.equal(unwrap(service.handleQuery({type:'data.backups'})).backups.state,'failed');
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'ru');
    rmSync(join(dir,'backups'));mkdirSync(join(dir,'backups'));
    assert.equal(unwrap(service.handleCommand({type:'data.backupNow'})).backups.state,'ready');
    const db=new Database(path,{readonly:true});
    try { assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='upgrade_probe'").get(),undefined); } finally { db.close(); }
  } finally { service.close();rmSync(dir,{recursive:true,force:true}); }
});

test('due timer captures new WAL data; retention keeps seven automatic copies and the failed-upgrade recovery point', context => {
  context.mock.timers.enable({apis:['Date','setInterval'],now:1792300000000});
  const dir=mkdtempSync(join(tmpdir(),'backup-retention-')),path=join(dir,'app.sqlite');
  let service=openSettingsService(path);
  try {
    service.close();
    const folder=upgradeFixture(dir,'CREATE TABLE upgrade_probe (id TEXT);\n--> statement-breakpoint\nINVALID SQL;');
    assert.throws(()=>openSettingsService(path,folder));
    service=openSettingsService(path);
    const protectedId=unwrap(service.handleQuery({type:'data.backups'})).backups.snapshots.find(s=>s.kind==='pre-migration').id;
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'ru'}));
    context.mock.timers.tick(24*60*60*1000-1);
    assert.equal(unwrap(service.handleQuery({type:'data.backups'})).backups.snapshots.filter(s=>s.kind==='automatic').length,1);
    context.mock.timers.tick(1);
    let status=unwrap(service.handleQuery({type:'data.backups'})).backups;
    assert.equal(status.snapshots.filter(s=>s.kind==='automatic').length,2);
    const content=unwrap(service.handleQuery({type:'data.backupExport',backupId:status.snapshots[0].id})).content;
    unwrap(service.handleCommand({type:'settings.setLanguage',language:'en'}));
    unwrap(service.handleCommand({type:'data.restore',content}));
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'ru');
    for(let i=0;i<9;i++) { context.mock.timers.tick(24*60*60*1000); }
    status=unwrap(service.handleQuery({type:'data.backups'})).backups;
    assert.equal(status.snapshots.filter(s=>s.kind==='automatic').length,7);
    assert.ok(status.snapshots.some(s=>s.id===protectedId));
    const files=readdirSync(join(dir,'backups'));
    assert.equal(files.length,8);
  } finally { service.close();rmSync(dir,{recursive:true,force:true}); }
});

test('read-back verification failure preserves good backups; damaged copies cannot be selected and do not hide valid recovery points', () => {
  const dir=mkdtempSync(join(tmpdir(),'backup-verification-')),path=join(dir,'app.sqlite');
  const service=openSettingsService(path);
  try {
    const first=unwrap(service.handleQuery({type:'data.backups'})).backups.snapshots[0].id;
    const original=Database.prototype.serialize;
    Database.prototype.serialize=()=>Buffer.from('injected broken SQLite snapshot');
    try { assert.equal(unwrap(service.handleCommand({type:'data.backupNow'})).backups.state,'failed'); }
    finally { Database.prototype.serialize=original; }
    assert.deepEqual(readdirSync(join(dir,'backups')),[first]);
    assert.equal(unwrap(service.handleCommand({type:'data.backupNow'})).backups.state,'ready');
    writeFileSync(join(dir,'backups',first),'broken');
    const status=unwrap(service.handleQuery({type:'data.backups'})).backups;
    assert.equal(status.state,'failed');assert.equal(status.snapshots.length,1);
    assert.equal(service.handleQuery({type:'data.backupExport',backupId:first}).error.code,'storage');
    for(const input of [{type:'data.backupExport',backupId:'../app.sqlite'}, {type:'data.backups',path:dir}, {type:'data.backupNow',extra:true}]) {
      const method=input.type==='data.backupNow'?'handleCommand':'handleQuery';
      assert.equal(service[method](input).error.code,'invalid_input');
    }
    assert.equal(unwrap(service.handleQuery({type:'settings.load'})).language,'en');
  } finally { service.close();rmSync(dir,{recursive:true,force:true}); }
});

test('a snapshot rejected by recovery cannot report success or prune existing usable backups', () => {
  const dir=mkdtempSync(join(tmpdir(),'backup-usability-')),path=join(dir,'app.sqlite');
  const service=openSettingsService(path);
  try {
    const before=unwrap(service.handleQuery({type:'data.backups'})).backups.snapshots;
    const db=new Database(path);
    try { db.exec("UPDATE settings SET value='xx' WHERE key='language'"); } finally {db.close();}
    const after=unwrap(service.handleCommand({type:'data.backupNow'})).backups;
    assert.equal(after.state,'failed');
    assert.deepEqual(after.snapshots,before);
    const folder=upgradeFixture(dir,'CREATE TABLE upgrade_probe (id TEXT);');
    assert.throws(()=>openSettingsService(path,folder),error=>error.code==='BACKUP_FAILED');
  } finally {service.close();rmSync(dir,{recursive:true,force:true});}
});
