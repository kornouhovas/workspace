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
const create = f => f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: 'Status', propertyType: 'single_select' });
const option = (f, propertyId, name = 'Ready') => f.service.handleCommand({ type: 'workspace.createSelectOption', workspaceId: f.one.workspaceId, propertyId, name, color: 'blue' });
const set = (f, propertyId, optionId) => f.service.handleCommand({ type: 'workspace.setSelectValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, optionId });

test('ordinary Select keeps stable option IDs and source-owned values through sibling edits and restart without moving files', () => fixture(f => {
  const created = create(f); assert.equal(created.ok, true);
  const propertyId = created.value.propertyId;
  const added = option(f, propertyId); assert.equal(added.ok, true);
  const optionId = added.value.snapshot.selectOptions[0].optionId;
  const saved = set(f, propertyId, optionId); assert.equal(saved.ok, true);
  assert.deepEqual(saved.value.snapshot.selectValues, [{ projectId: f.projectId, propertyId, optionId }]);
  assert.deepEqual(list(f, f.sibling.workspaceId).value.selectValues, saved.value.snapshot.selectValues);
  const before = list(f); f.reopen(); assert.deepEqual(list(f), before);
  assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
  assert.deepEqual(set(f, propertyId, null).value.snapshot.selectValues, []);
}));

test('rename, color, ordering and workspace-local hiding preserve assigned values and sibling presentation', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  option(f, propertyId, 'Ready'); const options = option(f, propertyId, 'Done').value.snapshot.selectOptions;
  const [ready, done] = options;
  set(f, propertyId, ready.optionId);
  const command = input => f.service.handleCommand({ workspaceId: f.one.workspaceId, propertyId, ...input });
  assert.equal(command({ type: 'workspace.updateSelectOption', optionId: ready.optionId, name: '  Готово  ', color: 'green' }).ok, true);
  assert.equal(command({ type: 'workspace.reorderSelectOptions', optionIds: [done.optionId, ready.optionId] }).ok, true);
  assert.equal(command({ type: 'workspace.setSelectOptionHidden', optionId: ready.optionId, hidden: true }).ok, true);
  const snapshot = list(f).value;
  assert.deepEqual(snapshot.selectOptions.map(o => [o.optionId, o.name, o.color, o.hidden, o.position]), [
    [done.optionId, 'Done', 'blue', false, 0], [ready.optionId, '  Готово  ', 'green', true, 1]]);
  assert.equal(snapshot.selectValues[0].optionId, ready.optionId);
  assert.equal(list(f, f.sibling.workspaceId).value.selectOptions[1].hidden, false);
  f.reopen(); assert.deepEqual(list(f).value, snapshot);
  assert.equal(command({ type: 'workspace.setSelectOptionHidden', optionId: ready.optionId, hidden: false }).ok, true);
  assert.equal(list(f).value.selectOptions[1].hidden, false);
}));

test('invalid saves, foreign options/projects/sources and type mutations preserve the previous snapshot and notifications', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const optionId = option(f, propertyId).value.snapshot.selectOptions[0].optionId;
  set(f, propertyId, optionId);
  const otherProperty = create(f).value.propertyId;
  const otherOption = option(f, otherProperty).value.snapshot.selectOptions.find(o => o.propertyId === otherProperty).optionId;
  const otherRoot = join(f.directory, 'other'); mkdirSync(otherRoot); mkdirSync(join(otherRoot, 'Other'));
  const foreign = f.service.handleCommand({ type: 'workspace.create', rootPath: otherRoot, name: 'Other' }).value;
  const preview = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId: foreign.workspaceId }).value;
  const foreignProject = f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId: foreign.workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
  const base = { type: 'workspace.setSelectValue', workspaceId: f.one.workspaceId, propertyId, projectId: f.projectId, optionId };
  const before = list(f), events = []; f.service.workspaces.subscribe(e => events.push(e));
  for (const input of [{ ...base, optionId: otherOption }, { ...base, projectId: foreignProject }, { ...base, workspaceId: foreign.workspaceId }, { ...base, optionId: '' }, { ...base, optionId: {} }, { ...base, extra: true },
    { type: 'workspace.renameProperty', workspaceId: f.one.workspaceId, propertyId, name: 'Changed', propertyType: 'text' },
    { type: 'workspace.createSelectOption', workspaceId: f.one.workspaceId, propertyId, name: '   ', color: 'blue' },
    { type: 'workspace.createSelectOption', workspaceId: f.one.workspaceId, propertyId, name: 'Name', color: 'invalid' },
    { type: 'workspace.updateSelectOption', workspaceId: f.one.workspaceId, propertyId, optionId: otherOption, name: 'Name', color: 'blue' },
    { type: 'workspace.reorderSelectOptions', workspaceId: f.one.workspaceId, propertyId, optionIds: [otherOption] },
    { type: 'workspace.reorderSelectOptions', workspaceId: f.one.workspaceId, propertyId, optionIds: [optionId, optionId] },
    { type: 'workspace.reorderSelectOptions', workspaceId: f.one.workspaceId, propertyId, optionIds: [] },
    { type: 'workspace.setSelectOptionHidden', workspaceId: foreign.workspaceId, propertyId, optionId, hidden: true },
    { type: 'workspace.setTextValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, value: optionId }]) {
    assert.equal(f.service.handleCommand(input).error.code, 'invalid_input', JSON.stringify(input)); assert.deepEqual(list(f), before);
  }
  assert.deepEqual(events, []);
  assert.equal(set(f, propertyId, optionId).value.snapshot.revision, before.value.revision); assert.deepEqual(events, []);
  set(f, propertyId, null); assert.deepEqual(events[0].workspaceIds, [f.one.workspaceId, f.sibling.workspaceId]);
  const count = events.length; set(f, propertyId, null); assert.equal(events.length, count);
}));

test('storage failure rolls back option/value/visibility changes, revision and sibling events atomically', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const optionId = option(f, propertyId).value.snapshot.selectOptions[0].optionId;
  const events = []; f.service.workspaces.subscribe(e => events.push(e));
  const db = new Database(f.path);
  try {
    db.exec("CREATE TRIGGER injected_failure BEFORE UPDATE OF property_revision ON sources BEGIN SELECT RAISE(ABORT, 'fixture'); END");
    const before = list(f);
    for (const command of [
      { type: 'workspace.setSelectValue', projectId: f.projectId, optionId },
      { type: 'workspace.createSelectOption', name: 'Another', color: 'red' },
      { type: 'workspace.updateSelectOption', optionId, name: 'Changed', color: 'red' },
      { type: 'workspace.setSelectOptionHidden', optionId, hidden: true },
    ]) {
      const result = f.service.handleCommand({ workspaceId: f.one.workspaceId, propertyId, ...command });
      assert.equal(result.error.code, 'storage'); assert.deepEqual(list(f), before); assert.deepEqual(events, []);
    }
  } finally { db.close(); }
}));

test('populated pre-Select migration preserves Text/Number/Date and identities with typed ownership guards', () => {
  const directory = mkdtempSync(join(tmpdir(), 'select-upgrade-')), root = join(directory, 'root'), migrations = join(directory, 'migrations');
  mkdirSync(root); mkdirSync(join(root, 'Project')); mkdirSync(join(migrations, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json', 'utf8')); journal.entries = journal.entries.slice(0, 16);
  for (const entry of journal.entries) writeFileSync(join(migrations, `${entry.tag}.sql`), readFileSync(`src/service/db/migrations/${entry.tag}.sql`));
  writeFileSync(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
  const path = join(directory, 'workspace.sqlite'); let service = openSettingsService(path, migrations);
  try {
    const workspace = historicalWorkspace(path, root), workspaceId = workspace.workspaceId;
    const preview = service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId }).value;
    const projectId = service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
    for (const [propertyType, command, field, value] of [['text', 'setTextValue', 'value', '  exact\nТекст  '], ['number', 'setNumberValue', 'expression', '42'], ['date', 'setDateValue', 'value', '2024-02-29']]) {
      const propertyId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: propertyType, propertyType }).value.propertyId;
      assert.equal(service.handleCommand({ type: `workspace.${command}`, workspaceId, projectId, propertyId, [field]: value }).ok, true);
    }
    const before = service.handleQuery({ type: 'workspace.listTextProperties', workspaceId });
    const settings = service.handleQuery({ type: 'workspace.load' });
    service.close(); service = openSettingsService(path);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }), before);
    assert.deepEqual(service.handleQuery({ type: 'workspace.load' }), settings);
    const propertyId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'New Select', propertyType: 'single_select' }).value.propertyId;
    const added = service.handleCommand({ type: 'workspace.createSelectOption', workspaceId, propertyId, name: 'Ready', color: 'green' }); assert.equal(added.ok, true);
    const optionId = added.value.snapshot.selectOptions[0].optionId;
    assert.equal(service.handleCommand({ type: 'workspace.setSelectValue', workspaceId, projectId, propertyId, optionId }).ok, true);
    const db = new Database(path); db.pragma('foreign_keys = ON');
    try {
      assert.deepEqual(db.pragma('foreign_key_check'), []);
      assert.throws(() => db.prepare("UPDATE property_definitions SET property_type = 'text' WHERE id = ?").run(propertyId), /immutable/);
      const textId = before.value.definitions[0].propertyId;
      assert.throws(() => db.prepare("INSERT INTO select_options VALUES (?, ?, ?, 'Wrong', 'blue', 1)").run(randomUUID(), workspace.sourceId, textId), /Single Select/);
      assert.throws(() => db.prepare("UPDATE select_options SET property_id = ? WHERE id = ?").run(textId, optionId), /immutable/);
      assert.throws(() => db.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, 'wrong')").run(projectId, propertyId, workspace.sourceId), /Text definition/);
      assert.throws(() => db.prepare("INSERT INTO number_property_values VALUES (?, ?, ?, 42)").run(projectId, propertyId, workspace.sourceId), /Number definition/);
      assert.throws(() => db.prepare("INSERT INTO date_property_values VALUES (?, ?, ?, '2024-02-29')").run(projectId, propertyId, workspace.sourceId), /Date definition/);
      assert.throws(() => db.prepare("UPDATE select_property_values SET property_id = ?").run(textId), /Single Select definition|FOREIGN KEY/);
    } finally { db.close(); }
    service.close(); service = openSettingsService(path);
    assert.equal(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }).value.selectValues[0].optionId, optionId);
  } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('retained and archived projects keep editable Single Select metadata and do not transfer it to another source', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const optionId = option(f, propertyId).value.snapshot.selectOptions[0].optionId;
  assert.equal(set(f, propertyId, optionId).ok, true);
  const workspaceId = f.one.workspaceId;
  const excluded = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: ['Project'] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: excluded.previewToken }).ok, true);
  assert.equal(set(f, propertyId, optionId).ok, true);
  const active = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: [] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: active.previewToken }).ok, true);
  const archiveLocation = f.service.handleQuery({ type: 'workspace.previewArchiveLocation', workspaceId, relativePath: 'Archive' }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyArchiveLocation', workspaceId, operationId: randomUUID(), previewToken: archiveLocation.previewToken }).ok, true);
  const archive = f.service.handleQuery({ type: 'workspace.previewProjectArchive', workspaceId, projectId: f.projectId, action: 'archive', name: null, createParent: false }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyProjectArchive', workspaceId, operationId: randomUUID(), previewToken: archive.previewToken }).ok, true);
  assert.equal(set(f, propertyId, optionId).ok, true);
  f.reopen(); assert.equal(list(f).value.selectValues[0].optionId, optionId);
  assert.equal(readFileSync(join(f.root, 'Archive', 'Project', 'keep'), 'utf8'), 'unchanged');
}));

test('removing a workspace clears only its option visibility and retains source options and assignments', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const optionId = option(f, propertyId).value.snapshot.selectOptions[0].optionId;
  set(f, propertyId, optionId);
  assert.equal(f.service.handleCommand({ type: 'workspace.setSelectOptionHidden', workspaceId: f.one.workspaceId, propertyId, optionId, hidden: true }).ok, true);
  assert.equal(f.service.handleCommand({ type: 'workspace.remove', workspaceId: f.one.workspaceId }).ok, true);
  const snapshot = list(f, f.sibling.workspaceId).value;
  assert.equal(snapshot.selectOptions[0].optionId, optionId); assert.equal(snapshot.selectOptions[0].hidden, false);
  assert.equal(snapshot.selectValues[0].optionId, optionId);
  f.reopen(); assert.deepEqual(list(f, f.sibling.workspaceId).value, snapshot);
}));
