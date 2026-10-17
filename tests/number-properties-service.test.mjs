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
  const directory = mkdtempSync(join(tmpdir(), 'number-properties-'));
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
const create = f => f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: '  Число  ', propertyType: 'number' });
const set = (f, propertyId, expression) => f.service.handleCommand({ type: 'workspace.setNumberValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, expression });

test('Number expression saves computed source-owned value and reopens through sibling without touching files', () => fixture(f => {
  const created = create(f); assert.equal(created.ok, true);
  const propertyId = created.value.propertyId;
  assert.equal(created.value.snapshot.definitions[0].propertyType, 'number');
  const saved = set(f, propertyId, '-(2 + 3) * 4 / 2 + 1,5'); assert.equal(saved.ok, true);
  assert.deepEqual(saved.value.snapshot.numberValues, [{ projectId: f.projectId, propertyId, value: -8.5 }]);
  const before = list(f); assert.deepEqual(list(f, f.sibling.workspaceId).value, { ...before.value, workspaceId: f.sibling.workspaceId });
  f.reopen(); assert.deepEqual(list(f), before);
  assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
}));

test('supported EN/RU arithmetic, zero, exponent, precedence, limits and clearing use numeric equality', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const events = []; f.service.workspaces.subscribe(e => events.push(e));
  for (const [expression, expected] of [['2+3*4', 14], ['(2+3)*4', 20], ['8/2/2', 2], ['1,25 + .5', 1.75], ['1e3 / 4', 250], ['--2', 2], ['-0', 0], ['9007199254740991', 9007199254740991], ['5e-324', 5e-324], ['0.1+0.2', 0.30000000000000004]]) {
    const result = set(f, propertyId, expression); assert.equal(result.ok, true, expression);
    assert.equal(result.value.snapshot.numberValues[0].value, expected, expression);
    const count = events.length, revision = result.value.snapshot.revision;
    assert.equal(set(f, propertyId, String(expected)).value.snapshot.revision, revision);
    assert.equal(events.length, count, 'equivalent results emit no change');
  }
  assert.deepEqual(events[0].workspaceIds, [f.one.workspaceId, f.sibling.workspaceId]);
  for (const empty of ['', ' \t\n ', null]) {
    assert.deepEqual(set(f, propertyId, empty).value.snapshot.numberValues, []);
    assert.equal(set(f, propertyId, '42').ok, true);
  }
}));

test('malformed, unsafe and nonfinite arithmetic leaves the previous numeric result and revision unchanged', () => fixture(f => {
  const propertyId = create(f).value.propertyId; assert.equal(set(f, propertyId, '42').ok, true);
  const before = list(f); const events = []; f.service.workspaces.subscribe(e => events.push(e));
  for (const expression of ['1/0', '0/0', '1e309', '1e-999', '5e-324/2', '9007199254740992', '1e10*1e10', '1+', '(1+2', '2(3)', '1 000', '1,2.3', 'NaN', 'Infinity', 'Math.random()', 'process.exit()', 'globalThis.x=1', '2**3', '3%2', '0x10', '1;2', '1'.repeat(513), '('.repeat(33)+'1'+')'.repeat(33), '+'.repeat(33)+'1', '1+'.repeat(128)+'1', 42, {}, undefined]) {
    assert.equal(set(f, propertyId, expression).error.code, 'invalid_input', String(expression));
    assert.deepEqual(list(f), before);
  }
  assert.deepEqual(events, []);
}));

test('Number commands reject foreign ownership, wrong type, type changes and extra keys', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const textId = f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: 'Text', propertyType: 'text' }).value.propertyId;
  const otherRoot = join(f.directory, 'other'); mkdirSync(otherRoot);
  const other = f.service.handleCommand({ type: 'workspace.create', rootPath: otherRoot, name: 'Other' }).value;
  const base = { type: 'workspace.setNumberValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, expression: '10' };
  const before = list(f);
  for (const input of [{ ...base, workspaceId: other.workspaceId }, { ...base, propertyId: textId }, { ...base, projectId: 'bad' }, { ...base, extra: true }, { ...base, value: '10' },
    { type: 'workspace.setTextValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, value: '10' },
    { type: 'workspace.renameProperty', workspaceId: f.one.workspaceId, propertyId, name: 'Changed', propertyType: 'text' }]) {
    assert.equal(f.service.handleCommand(input).error.code, 'invalid_input'); assert.deepEqual(list(f), before);
  }
  const renamed = f.service.handleCommand({ type: 'workspace.renameProperty', workspaceId: f.sibling.workspaceId, propertyId, name: 'Renamed Number' });
  assert.equal(renamed.value.snapshot.definitions[0].propertyType, 'number');
  assert.deepEqual(list(f, other.workspaceId).value.definitions, []);
}));


test('Number persistence failures roll back value, revision and sibling notifications', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const sql = new Database(f.path); const events = []; f.service.workspaces.subscribe(e => events.push(e));
  try {
    for (const [table, action, expression] of [['number_property_values', 'INSERT', '42'], ['number_property_values', 'UPDATE', '43'], ['number_property_values', 'DELETE', null], ['sources', 'UPDATE OF property_revision', '43']]) {
      if (action !== 'INSERT') assert.equal(set(f, propertyId, '42').ok, true);
      const before = list(f); events.length = 0;
      sql.exec(`CREATE TRIGGER injected_failure BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT, 'fixture'); END`);
      assert.equal(set(f, propertyId, expression).error.code, 'storage');
      assert.deepEqual(list(f), before); assert.deepEqual(events, []);
      sql.exec('DROP TRIGGER injected_failure');
    }
  } finally { sql.close(); }
}));

test('upgrade from pre-Number database preserves Text, identities, presentation and immutable types', () => {
  const directory = mkdtempSync(join(tmpdir(), 'number-upgrade-')), root = join(directory, 'root'), migrations = join(directory, 'migrations');
  mkdirSync(root); mkdirSync(join(root, 'Project')); mkdirSync(join(migrations, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json', 'utf8')); journal.entries = journal.entries.slice(0, 14);
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
    const before = service.handleQuery({ type: 'workspace.listTextProperties', workspaceId });
    const tables = ['sources', 'workspaces', 'views', 'active_workspace', 'projects', 'property_definitions', 'text_property_values'];
    const db = new Database(path); const rows = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table}`).all().map(row => table === 'views' ? { ...row, position: 0, filter_config: '{"search":"","rules":[]}' } : row)])); db.close();
    service.close(); service = openSettingsService(path);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }), before);
    const inspected = new Database(path); inspected.pragma('foreign_keys = ON');
    try {
      for (const table of tables) assert.deepEqual(inspected.prepare(`SELECT * FROM ${table}`).all(), rows[table]);
      assert.deepEqual(inspected.pragma('foreign_key_check'), []);
      assert.throws(() => inspected.prepare("UPDATE property_definitions SET property_type = 'number' WHERE id = ?").run(propertyId), /immutable/);
      const number = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'New Number', propertyType: 'number' }); assert.equal(number.ok, true);
      assert.throws(() => inspected.prepare('INSERT INTO number_property_values VALUES (?, ?, ?, 42)').run(projects.projects[0].projectId, propertyId, workspace.sourceId), /Number definition/);
      assert.throws(() => inspected.prepare('INSERT INTO text_property_values VALUES (?, ?, ?, ?)').run(projects.projects[0].projectId, number.value.propertyId, workspace.sourceId, 'wrong'), /Text definition/);
    } finally { inspected.close(); }
    service.close(); service = openSettingsService(path);
    assert.equal(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }).value.values[0].value, '  exact\nТекст  ');
  } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('retained and archived projects keep editable Number metadata and do not transfer it to another source', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  assert.equal(set(f, propertyId, '2*21').ok, true);
  const workspaceId = f.one.workspaceId;
  const excluded = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: ['Project'] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: excluded.previewToken }).ok, true);
  assert.equal(set(f, propertyId, '43').ok, true);
  const active = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: [] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: active.previewToken }).ok, true);
  const archiveLocation = f.service.handleQuery({ type: 'workspace.previewArchiveLocation', workspaceId, relativePath: 'Archive' }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyArchiveLocation', workspaceId, operationId: randomUUID(), previewToken: archiveLocation.previewToken }).ok, true);
  const archive = f.service.handleQuery({ type: 'workspace.previewProjectArchive', workspaceId, projectId: f.projectId, action: 'archive', name: null, createParent: false }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyProjectArchive', workspaceId, operationId: randomUUID(), previewToken: archive.previewToken }).ok, true);
  assert.equal(set(f, propertyId, '44').ok, true);
  f.reopen(); assert.equal(list(f).value.numberValues[0].value, 44);
  assert.equal(readFileSync(join(f.root, 'Archive', 'Project', 'keep'), 'utf8'), 'unchanged');
}));
