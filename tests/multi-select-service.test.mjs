import { archiveProjectFixture } from "./support/archived-project-fixture.mjs";
import { seedHistoricalFixture, assertHistoricalFixturePreserved, assertHistoricalPublicMetadata } from "./support/identity-migration-fixtures.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { openSettingsService } from '../dist/service/settings.mjs';

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'multi-select-'));
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
const create = f => f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: 'Tags', propertyType: 'multi_select' });
const option = (f, propertyId, name = 'Ready') => f.service.handleCommand({ type: 'workspace.createSelectOption', workspaceId: f.one.workspaceId, propertyId, name, color: 'blue' });
const set = (f, propertyId, optionIds) => f.service.handleCommand({ type: 'workspace.setMultiSelectValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, optionIds });

test('MultiSelect saves empty and multiple stable memberships shared by siblings after restart without duplicating or moving projects', () => fixture(f => {
  const created = create(f); assert.equal(created.ok, true);
  const propertyId = created.value.propertyId;
  assert.deepEqual(created.value.snapshot.multiSelectValues, []);
  option(f, propertyId, 'Ready');
  const [ready, done] = option(f, propertyId, 'Done').value.snapshot.selectOptions;
  const saved = set(f, propertyId, [done.optionId, ready.optionId]); assert.equal(saved.ok, true);
  const expected = [ready.optionId, done.optionId].sort().map(optionId => ({ projectId: f.projectId, propertyId, optionId }));
  assert.deepEqual(saved.value.snapshot.multiSelectValues, expected);
  assert.deepEqual(list(f, f.sibling.workspaceId).value.multiSelectValues, expected);
  const events = []; f.service.workspaces.subscribe(e => events.push(e));
  assert.equal(set(f, propertyId, [ready.optionId, done.optionId]).value.snapshot.revision, saved.value.snapshot.revision);
  assert.deepEqual(events, []);
  const before = list(f); f.reopen(); assert.deepEqual(list(f), before);
  assert.equal(f.service.handleQuery({ type: 'workspace.listProjects', workspaceId: f.one.workspaceId }).value.projects.length, 1);
  assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
  assert.deepEqual(set(f, propertyId, [done.optionId]).value.snapshot.multiSelectValues, [{ projectId: f.projectId, propertyId, optionId: done.optionId }]);
  assert.deepEqual(set(f, propertyId, []).value.snapshot.multiSelectValues, []);
}));

test('shared option presentation preserves stable MultiSelect memberships and workspace-local visibility', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  option(f, propertyId, 'Ready'); const [ready, done] = option(f, propertyId, 'Done').value.snapshot.selectOptions;
  set(f, propertyId, [ready.optionId, done.optionId]);
  const command = input => f.service.handleCommand({ workspaceId: f.one.workspaceId, propertyId, ...input });
  const before = list(f).value.multiSelectValues;
  for (const input of [
    { type: 'workspace.updateSelectOption', optionId: ready.optionId, name: '  Готово  ', color: 'green' },
    { type: 'workspace.reorderSelectOptions', optionIds: [done.optionId, ready.optionId] },
    { type: 'workspace.setSelectOptionHidden', optionId: ready.optionId, hidden: true },
  ]) assert.equal(command(input).ok, true);
  assert.deepEqual(list(f).value.multiSelectValues, before);
  assert.deepEqual(list(f).value.selectOptions.map(o => [o.optionId, o.name, o.color, o.hidden]), [
    [done.optionId, 'Done', 'blue', false], [ready.optionId, '  Готово  ', 'green', true]]);
  assert.equal(list(f, f.sibling.workspaceId).value.selectOptions[1].hidden, false);
  const snapshot = list(f); f.reopen(); assert.deepEqual(list(f), snapshot);
  // Hiding affects only this picker; the typed assignment contract remains source-owned.
  set(f, propertyId, []); assert.equal(set(f, propertyId, [ready.optionId]).ok, true);
  assert.equal(command({ type: 'workspace.setSelectOptionHidden', optionId: ready.optionId, hidden: false }).ok, true);
  assert.equal(list(f).value.selectOptions[1].hidden, false);
  assert.equal(f.service.handleCommand({ type: 'workspace.remove', workspaceId: f.one.workspaceId }).ok, true);
  assert.deepEqual(list(f, f.sibling.workspaceId).value.multiSelectValues, [{ projectId: f.projectId, propertyId, optionId: ready.optionId }]);
}));

test('invalid sets and wrong types never mutate either source, revisions or notifications', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const optionId = option(f, propertyId).value.snapshot.selectOptions[0].optionId;
  set(f, propertyId, [optionId]);
  const otherProperty = create(f).value.propertyId;
  const otherOption = option(f, otherProperty).value.snapshot.selectOptions.find(o => o.propertyId === otherProperty).optionId;
  const foreignRoot = join(f.directory, 'foreign'); mkdirSync(foreignRoot); mkdirSync(join(foreignRoot, 'Other'));
  const foreign = f.service.handleCommand({ type: 'workspace.create', rootPath: foreignRoot, name: 'Other' }).value;
  const workspaceId = foreign.workspaceId;
  const preview = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId }).value;
  const projectId = f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
  const foreignProperty = f.service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'Other tags', propertyType: 'multi_select' }).value.propertyId;
  const foreignOption = f.service.handleCommand({ type: 'workspace.createSelectOption', workspaceId, propertyId: foreignProperty, name: 'Other', color: 'red' }).value.snapshot.selectOptions[0].optionId;
  assert.equal(f.service.handleCommand({ type: 'workspace.setMultiSelectValue', workspaceId, projectId, propertyId: foreignProperty, optionIds: [foreignOption] }).ok, true);
  const base = { type: 'workspace.setMultiSelectValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, optionIds: [optionId] };
  const before = list(f), foreignBefore = list(f, workspaceId), events = []; f.service.workspaces.subscribe(e => events.push(e));
  for (const input of [
    ...[null, '', {}, 42, Array(1), [optionId, optionId], [optionId, otherOption], [foreignOption], [randomUUID()], [''], [42]].map(optionIds => ({ ...base, optionIds })),
    { ...base, extra: true }, { ...base, workspaceId }, { ...base, projectId }, { ...base, propertyId: foreignProperty },
    { ...base, propertyId: otherProperty },
    { type: 'workspace.setSelectValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, optionId },
    { type: 'workspace.setTextValue', workspaceId: f.one.workspaceId, projectId: f.projectId, propertyId, value: 'wrong' },
    { type: 'workspace.renameProperty', workspaceId: f.one.workspaceId, propertyId, name: 'Changed', propertyType: 'single_select' },
  ]) {
    assert.equal(f.service.handleCommand(input).error.code, 'invalid_input', JSON.stringify(input));
    assert.deepEqual(list(f), before); assert.deepEqual(list(f, workspaceId), foreignBefore);
  }
  assert.deepEqual(events, []);
  const single = f.service.handleCommand({ type: 'workspace.createProperty', workspaceId: f.one.workspaceId, name: 'Single', propertyType: 'single_select' }).value.propertyId;
  assert.equal(f.service.handleCommand({ ...base, propertyId: single, optionIds: [] }).error.code, 'invalid_input');
  set(f, propertyId, []); assert.deepEqual(list(f, workspaceId), foreignBefore);
  assert.deepEqual(events.at(-1).workspaceIds, [f.one.workspaceId, f.sibling.workspaceId]);
  const count = events.length, revision = list(f).value.revision;
  set(f, propertyId, []); assert.equal(list(f).value.revision, revision); assert.equal(events.length, count);
}));

test('failed replacement, clear and option writes roll back complete sets with revisions and events', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  option(f, propertyId, 'Ready'); const [ready, done] = option(f, propertyId, 'Done').value.snapshot.selectOptions;
  set(f, propertyId, [ready.optionId]);
  const events = []; f.service.workspaces.subscribe(e => events.push(e));
  const db = new Database(f.path);
  try {
    db.exec("CREATE TRIGGER injected_failure BEFORE UPDATE OF property_revision ON sources BEGIN SELECT RAISE(ABORT, 'fixture'); END");
    const before = list(f);
    for (const input of [
      { type: 'workspace.setMultiSelectValue', projectId: f.projectId, optionIds: [done.optionId] },
      { type: 'workspace.setMultiSelectValue', projectId: f.projectId, optionIds: [ready.optionId, done.optionId] },
      { type: 'workspace.setMultiSelectValue', projectId: f.projectId, optionIds: [] },
      { type: 'workspace.updateSelectOption', optionId: ready.optionId, name: 'Changed', color: 'red' },
      { type: 'workspace.createSelectOption', name: 'Another', color: 'red' },
      { type: 'workspace.reorderSelectOptions', optionIds: [done.optionId, ready.optionId] },
      { type: 'workspace.setSelectOptionHidden', optionId: ready.optionId, hidden: true },
    ]) {
      assert.equal(f.service.handleCommand({ workspaceId: f.one.workspaceId, propertyId, ...input }).error.code, 'storage');
      assert.deepEqual(list(f), before); assert.deepEqual(events, []);
    }
  } finally { db.close(); }
  f.reopen(); assert.deepEqual(list(f).value.multiSelectValues, [{ projectId: f.projectId, propertyId, optionId: ready.optionId }]);
}));
test('populated pre-MultiSelect migration preserves Text/Number/Date/Single Select and visibility and identities with typed ownership guards', () => {
  const directory = mkdtempSync(join(tmpdir(), 'select-upgrade-')), root = join(directory, 'root'), migrations = join(directory, 'migrations');
  mkdirSync(root); mkdirSync(join(root, 'Project')); mkdirSync(join(migrations, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json', 'utf8')); journal.entries = journal.entries.slice(0, 17);
  for (const entry of journal.entries) writeFileSync(join(migrations, `${entry.tag}.sql`), readFileSync(`src/service/db/migrations/${entry.tag}.sql`));
  writeFileSync(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
  const path = join(directory, 'workspace.sqlite');
  const workspace=seedHistoricalFixture(path,migrations,root,[{name:'text',type:'text',value:'  exact\nТекст  '},{name:'number',type:'number',value:42},{name:'date',type:'date',value:'2024-02-29'},{name:'Existing Select',type:'single_select',option:{name:'Existing option',color:'purple',hidden:true}}]);
  const workspaceId=workspace.workspaceId,projectId=workspace.projectId;
  let service=openSettingsService(path);
  try {
    assertHistoricalFixturePreserved(assert,path,workspace);
    const before=assertHistoricalPublicMetadata(assert,service,workspace);
    assert.equal(service.handleQuery({type:'workspace.listProjects',workspaceId}).value.state,'association_review_required');
    const singleId=workspace.definitions.at(-1).id,existingOptionId=workspace.definitions.at(-1).optionId;
    service.close();service=openSettingsService(path);
    assert.deepEqual(service.handleQuery({type:'workspace.listTextProperties',workspaceId}),before);
    const propertyId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'New MultiSelect', propertyType: 'multi_select' }).value.propertyId;
    const added = service.handleCommand({ type: 'workspace.createSelectOption', workspaceId, propertyId, name: 'Ready', color: 'green' }); assert.equal(added.ok, true);
    const optionId = added.value.snapshot.selectOptions.find(o => o.propertyId === propertyId).optionId;
    assert.equal(service.handleCommand({ type: 'workspace.setMultiSelectValue', workspaceId, projectId, propertyId, optionIds: [optionId] }).ok, true);
    const db = new Database(path); db.pragma('foreign_keys = ON');
    try {
      assert.throws(() => db.prepare("INSERT INTO select_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, workspace.sourceId, optionId), /Single Select definition/);
      assert.throws(() => db.prepare("INSERT INTO multi_select_property_values VALUES (?, ?, ?, ?)").run(projectId, singleId, workspace.sourceId, existingOptionId), /MultiSelect definition/);
      assert.throws(() => db.prepare("INSERT INTO multi_select_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, workspace.sourceId, optionId), /UNIQUE/);
      assert.deepEqual(db.pragma('foreign_key_check'), []);
      assert.throws(() => db.prepare("UPDATE property_definitions SET property_type = 'text' WHERE id = ?").run(propertyId), /immutable/);
      const textId = before.value.definitions[0].propertyId;
      assert.throws(() => db.prepare("INSERT INTO select_options VALUES (?, ?, ?, 'Wrong', 'blue', 1)").run(randomUUID(), workspace.sourceId, textId), /Single Select/);
      assert.throws(() => db.prepare("UPDATE select_options SET property_id = ? WHERE id = ?").run(textId, optionId), /immutable/);
      assert.throws(() => db.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, 'wrong')").run(projectId, propertyId, workspace.sourceId), /Text definition/);
      assert.throws(() => db.prepare("INSERT INTO number_property_values VALUES (?, ?, ?, 42)").run(projectId, propertyId, workspace.sourceId), /Number definition/);
      assert.throws(() => db.prepare("INSERT INTO date_property_values VALUES (?, ?, ?, '2024-02-29')").run(projectId, propertyId, workspace.sourceId), /Date definition/);
      assert.throws(() => db.prepare("UPDATE multi_select_property_values SET property_id = ?").run(textId), /MultiSelect definition|FOREIGN KEY/);
    } finally { db.close(); }
    service.close(); service = openSettingsService(path);
    assert.equal(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }).value.multiSelectValues[0].optionId, optionId);
  } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('retained and archived projects keep editable MultiSelect metadata and do not transfer it to another source', () => fixture(f => {
  const propertyId = create(f).value.propertyId;
  const optionId = option(f, propertyId).value.snapshot.selectOptions[0].optionId;
  assert.equal(set(f, propertyId, [optionId]).ok, true);
  const workspaceId = f.one.workspaceId;
  const excluded = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: ['Project'] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: excluded.previewToken }).ok, true);
  assert.equal(set(f, propertyId, [optionId]).ok, true);
  const active = f.service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId, excludedRelativePaths: [] }).value;
  assert.equal(f.service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: active.previewToken }).ok, true);
  archiveProjectFixture(f.path,workspaceId,f.projectId);
  assert.equal(set(f, propertyId, [optionId]).ok, true);
  f.reopen(); assert.equal(list(f).value.multiSelectValues[0].optionId, optionId);
  assert.equal(readFileSync(join(f.root, 'Archive', 'Project', 'keep'), 'utf8'), 'unchanged');
}));

