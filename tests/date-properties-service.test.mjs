import { historicalWorkspace } from "./helpers/historical-workspace.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { openSettingsService } from '../dist/service/settings.mjs';

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'date-properties-'));
  const root = join(directory, 'root'); mkdirSync(root); mkdirSync(join(root, 'Project'));
  writeFileSync(join(root, 'Project', 'keep'), 'unchanged');
  const path = join(directory, 'workspace.sqlite'); let service = openSettingsService(path);
  const create = name => service.handleCommand({ type: 'workspace.create', rootPath: root, name }).value;
  const one = create('One'), sibling = create('Sibling');
  const preview = service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId: one.workspaceId }).value;
  const projectId = service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId: one.workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
  const f = { root, directory, path, one, sibling, projectId, get service() { return service; }, reopen() { service.close(); service = openSettingsService(path); } };
  try { run(f); } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
}
const list = (f, workspaceId = f.one.workspaceId) => f.service.handleQuery({ type: 'workspace.listTextProperties', workspaceId });
const create = f => f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: '  Дата  ', propertyType: 'date' });
const set = (f, propertyId, value) => f.service.handleCommand({ type: 'workspace.setDateValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, value });

test('Date saves exact calendar source-owned value and reopens through sibling without touching files', () => fixture(f => {
  const created = create(f); assert.equal(created.ok, true);
  const propertyId = created.value.propertyId;
  assert.equal(created.value.snapshot.definitions[0].propertyType, 'date');
  const saved = set(f, propertyId, '2024-02-29'); assert.equal(saved.ok, true);
  assert.deepEqual(saved.value.snapshot.dateValues, [{ projectId: f.projectId, propertyId, value: '2024-02-29' }]);
  const before = list(f); assert.deepEqual(list(f, f.sibling.workspaceId).value, { ...before.value, workspaceId: f.sibling.workspaceId });
  f.reopen(); assert.deepEqual(list(f), before);
  assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
}));

test('calendar boundaries, Gregorian leap years, no-op events, language settings and clearing survive restart', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const events = [];
  for (const value of ['0001-01-01', '0099-12-31', '0100-03-01', '1900-02-28', '2000-02-29', '2024-02-29', '2025-03-09', '2025-11-02', '2011-12-30', '9999-12-31']) {
    f.service.workspaces.subscribe(e => events.push(e));
    const saved = set(f, propertyId, value); assert.equal(saved.ok, true, value);
    assert.deepEqual(saved.value.snapshot.dateValues, [{ projectId: f.projectId, propertyId, value }]);
    const count = events.length;
    assert.equal(set(f, propertyId, value).value.snapshot.revision, saved.value.snapshot.revision);
    assert.equal(events.length, count);
    for (const language of ['ru', 'en']) {
      assert.equal(f.service.handleCommand({ type: 'settings.setLanguage', language }).ok, true);
      f.reopen(); assert.deepEqual(list(f), { ok: true, value: saved.value.snapshot });
    }
  }
  assert.deepEqual(events[0].workspaceIds, [f.one.workspaceId, f.sibling.workspaceId]);
  for (const empty of ['', ' \t\n ', null]) {
    assert.deepEqual(set(f, propertyId, empty).value.snapshot.dateValues, []);
    f.reopen(); assert.deepEqual(list(f).value.dateValues, []);
    assert.equal(set(f, propertyId, '2025-01-01').ok, true);
  }
}));

test('invalid or noncanonical dates preserve previous value, revision and notifications', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  assert.equal(set(f, propertyId, '2024-02-29').ok, true);
  const before = list(f), events = []; f.service.workspaces.subscribe(e => events.push(e));
  for (const value of ['0000-01-01', '10000-01-01', '2025-00-01', '2025-13-01', '2025-01-00', '2025-01-32', '2025-04-31', '2025-02-29', '1900-02-29', '2100-02-29', '2024-02-30', '2025-2-01', '2025-02-1', ' 2025-02-01', '2025-02-01 ', '2025-02-01T00:00:00Z', '01/02/2025', '２０２５-０２-０１', 'x', 42, {}, undefined]) {
    assert.equal(set(f, propertyId, value).error.code, 'invalid_input', String(value));
    assert.deepEqual(list(f), before);
  }
  assert.deepEqual(events, []);
}));
test('Date commands reject foreign ownership, wrong type, type changes and extra keys', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const textId = f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: 'Text', propertyType: 'text' }).value.propertyId;
  const otherRoot = join(f.directory, 'other'); mkdirSync(otherRoot); mkdirSync(join(otherRoot, 'Foreign'));
  const other = f.service.handleCommand({ type: 'workspace.create', rootPath: otherRoot, name: 'Other' }).value;
  const foreignPreview = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId: other.workspaceId }).value;
  const foreignProject = f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId: other.workspaceId, previewToken: foreignPreview.previewToken }).value.projects[0].projectId;
  const numberId = f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: 'Number', propertyType: 'number' }).value.propertyId;
  const base = { type: 'workspace.setDateValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, value: '2025-01-01' };
  const before = list(f);
  for (const input of [{ ...base, projectId: foreignProject }, { ...base, propertyId: numberId }, { ...base, workspaceId: other.workspaceId }, { ...base, propertyId: textId }, { ...base, projectId: 'bad' }, { ...base, extra: true }, { ...base, propertyType: 'date' },
    { type: 'workspace.setTextValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, value: '2025-01-01' },
    { type: 'workspace.renameProperty', workspaceId: f.one.workspaceId, propertyId, name: 'Changed', propertyType: 'text' }]) {
    assert.equal(f.service.handleCommand(input).error.code, 'invalid_input'); assert.deepEqual(list(f), before);
  }
  const renamed = f.service.handleCommand({ type: 'workspace.renameProperty', workspaceId: f.sibling.workspaceId, propertyId, name: 'Renamed Date' });
  assert.equal(renamed.value.snapshot.definitions[0].propertyType, 'date');
  assert.deepEqual(list(f, other.workspaceId).value.definitions, []);
}));


test('Date persistence failures roll back value, revision and sibling notifications', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const sql = new Database(f.path); const events = []; f.service.workspaces.subscribe(e => events.push(e));
  try {
    for (const [table, action, value] of [['date_property_values', 'INSERT', '2025-01-01'], ['date_property_values', 'UPDATE', '2025-01-02'], ['date_property_values', 'DELETE', null], ['sources', 'UPDATE OF property_revision', '2025-01-02']]) {
      if (action !== 'INSERT') assert.equal(set(f, propertyId, '2025-01-01').ok, true);
      const before = list(f); events.length = 0;
      sql.exec(`CREATE TRIGGER injected_failure BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT, 'fixture'); END`);
      assert.equal(set(f, propertyId, value).error.code, 'storage');
      assert.deepEqual(list(f), before); assert.deepEqual(events, []);
      sql.exec('DROP TRIGGER injected_failure');
    }
  } finally { sql.close(); }
}));

test('upgrade from pre-Date database preserves Text/Number, identities, presentation and immutable types', () => {
  const directory = mkdtempSync(join(tmpdir(), 'date-upgrade-')), root = join(directory, 'root'), migrations = join(directory, 'migrations');
  mkdirSync(root); mkdirSync(join(root, 'Project')); mkdirSync(join(migrations, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json', 'utf8')); journal.entries = journal.entries.slice(0, 15);
  for (const entry of journal.entries) writeFileSync(join(migrations, `${entry.tag}.sql`), readFileSync(`src/service/db/migrations/${entry.tag}.sql`));
  writeFileSync(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
  const path = join(directory, 'workspace.sqlite'); let service = openSettingsService(path, migrations);
  try {
    const workspace = historicalWorkspace(path, root);
    const workspaceId = workspace.workspaceId;
    const preview = service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId }).value;
    const projects = service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: preview.previewToken }).value;
    const propertyId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: '  Exact Text  ', propertyType: 'text' }).value.propertyId;
    assert.equal(service.handleCommand({ type: 'workspace.setTextValue', workspaceId, projectId: projects.projects[0].projectId, propertyId, value: '  exact\nТекст  ' }).ok, true);
    const numberId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'Number', propertyType: 'number' }).value.propertyId;
    assert.equal(service.handleCommand({ type: 'workspace.setNumberValue', workspaceId, projectId: projects.projects[0].projectId, propertyId: numberId, expression: '42' }).ok, true);
    const before = service.handleQuery({ type: 'workspace.listTextProperties', workspaceId });
    const tables = ['sources', 'workspaces', 'views', 'active_workspace', 'projects', 'property_definitions', 'text_property_values', 'number_property_values'];
    const db = new Database(path); const rows = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table}`).all().map(row => table === 'views' ? { ...row, position: 0, filter_config: '{"search":"","rules":[]}', grouping_config: '{"propertyId":null,"settings":[]}' } : row)])); db.close();
    service.close(); service = openSettingsService(path);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }), before);
    const inspected = new Database(path); inspected.pragma('foreign_keys = ON');
    try {
      for (const table of tables) assert.deepEqual(inspected.prepare(`SELECT * FROM ${table}`).all(), rows[table]);
      assert.deepEqual(inspected.pragma('foreign_key_check'), []);
      assert.throws(() => inspected.prepare("UPDATE property_definitions SET property_type = 'number' WHERE id = ?").run(propertyId), /immutable/);
      const date = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'New Date', propertyType: 'date' }); assert.equal(date.ok, true);
      assert.throws(() => inspected.prepare('INSERT INTO number_property_values VALUES (?, ?, ?, 42)').run(projects.projects[0].projectId, propertyId, workspace.sourceId), /Number definition/);
      assert.throws(() => inspected.prepare("UPDATE property_definitions SET property_type = 'date' WHERE id = ?").run(numberId), /immutable/);
      for (const invalid of ['2025-02-29', '1900-02-29', '0000-01-01', '2024-04-31', '9999-12-32', '2025-01-01\0hidden']) assert.throws(() => inspected.prepare('INSERT INTO date_property_values VALUES (?, ?, ?, ?)').run(projects.projects[0].projectId, date.value.propertyId, workspace.sourceId, invalid), /CHECK/);
      assert.throws(() => inspected.prepare('INSERT INTO text_property_values VALUES (?, ?, ?, ?)').run(projects.projects[0].projectId, date.value.propertyId, workspace.sourceId, 'wrong'), /Text definition/);
    } finally { inspected.close(); }
    service.close(); service = openSettingsService(path);
    assert.equal(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }).value.values[0].value, '  exact\nТекст  ');
  } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('retained and archived projects keep editable Date metadata and do not transfer it to another source', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  assert.equal(set(f, propertyId, '2025-01-01').ok, true);
  const workspaceId = f.one.workspaceId;
  const excluded = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: ['Project'] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: excluded.previewToken }).ok, true);
  assert.equal(set(f, propertyId, '2025-01-02').ok, true);
  const active = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: [] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: active.previewToken }).ok, true);
  const archiveLocation = f.service.handleQuery({ type: 'workspace.previewArchiveLocation', workspaceId, relativePath: 'Archive' }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyArchiveLocation', workspaceId, operationId: randomUUID(), previewToken: archiveLocation.previewToken }).ok, true);
  const archive = f.service.handleQuery({ type: 'workspace.previewProjectArchive', workspaceId, projectId: f.projectId, action: 'archive', name: null, createParent: false }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyProjectArchive', workspaceId, operationId: randomUUID(), previewToken: archive.previewToken }).ok, true);
  assert.equal(set(f, propertyId, '2025-01-03').ok, true);
  f.reopen(); assert.equal(list(f).value.dateValues[0].value, '2025-01-03');
  assert.equal(readFileSync(join(f.root, 'Archive', 'Project', 'keep'), 'utf8'), 'unchanged');
}));
