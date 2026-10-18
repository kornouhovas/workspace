import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'view-filters-')), root = join(directory, 'root'); mkdirSync(root);
  for (const name of ['Alpha', 'Beta', 'АЛЬФА']) mkdirSync(join(root, name));
  const path = join(directory, 'app.sqlite'); let service = openSettingsService(path);
  const workspace = service.handleCommand({ type: 'workspace.create', rootPath: root, name: 'One' }).value;
  const { workspaceId, viewId } = workspace;
  const command = (type, fields = {}) => service.handleCommand({ type: `workspace.${type}`, workspaceId, ...fields });
  const query = (type, fields = {}) => service.handleQuery({ type: `workspace.${type}`, workspaceId, ...fields });
  const preview = query('previewDiscovery').value;
  assert.equal(command('applyDiscovery', { previewToken: preview.previewToken }).ok, true);
  const f = { directory, root, path, workspace, command, query, get service() { return service; },
    save: config => command('setViewFilter', { viewId, config }),
    results: (fields = {}) => query('queryView', { viewId, archived: false, ...fields }),
    reopen() { service.close(); service = openSettingsService(path); } };
  try { run(f); } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('name search is case insensitive, trimmed and saved independently with duplicated views across restart', () => fixture(f => {
  const { viewId } = f.workspace;
  assert.deepEqual(f.query('getViewFilter', { viewId }).value.config, { search: '', rules: [] });
  assert.equal(f.save({ search: ' ALP ', rules: [] }).ok, true);
  const alpha = f.query('listProjects').value.projects.find(p => p.name === 'Alpha').projectId;
  assert.deepEqual(f.results().value.projectIds, [alpha]);
  const copyId = f.command('duplicateView', { viewId, name: 'Copy' }).value.activeViewId;
  assert.equal(f.save({ search: 'beta', rules: [] }).ok, true);
  f.reopen();
  assert.deepEqual(f.results({ viewId: copyId }).value.projectIds, [alpha]);
  assert.equal(f.results().value.projectIds.length, 1);
  assert.equal(f.query('getViewFilter', { viewId }).value.config.search, 'beta');
}));

test('typed conditions combine with search; each ordinary empty value and every comparison have explicit results', () => fixture(f => {
  const projects = f.query('listProjects').value.projects;
  const alpha = projects.find(p => p.name === 'Alpha').projectId;
  const beta = projects.find(p => p.name === 'Beta').projectId;
  const cyrillic = projects.find(p => p.name === 'АЛЬФА').projectId;
  const property = type => f.command('createProperty', { name: type, propertyType: type }).value.propertyId;
  const text = property('text'), number = property('number'), date = property('date'), select = property('single_select'), multi = property('multi_select');
  const option = (propertyId, name) => f.command('createSelectOption', { propertyId, name, color: 'default' }).value.snapshot.selectOptions.find(o => o.propertyId === propertyId && o.name === name).optionId;
  const red = option(select, 'Red'), a = option(multi, 'A'), b = option(multi, 'B');
  for (const result of [
    f.command('setTextValue', { projectId: alpha, propertyId: text, value: 'Hello World' }),
    f.command('setTextValue', { projectId: beta, propertyId: text, value: '  ' }),
    f.command('setNumberValue', { projectId: alpha, propertyId: number, expression: '2+3' }),
    f.command('setNumberValue', { projectId: beta, propertyId: number, expression: '0' }),
    f.command('setDateValue', { projectId: alpha, propertyId: date, value: '2024-02-29' }),
    f.command('setDateValue', { projectId: beta, propertyId: date, value: '2025-01-01' }),
    f.command('setSelectValue', { projectId: alpha, propertyId: select, optionId: red }),
    f.command('setMultiSelectValue', { projectId: alpha, propertyId: multi, optionIds: [a,b] }),
    f.command('setMultiSelectValue', { projectId: beta, propertyId: multi, optionIds: [b] }),
  ]) assert.equal(result.ok, true);
  const check = (propertyId, operator, operand, expected, search = '') => {
    assert.equal(f.save({ search, rules: [{ propertyId, operator, operand }] }).ok, true);
    assert.deepEqual([...f.results().value.projectIds].sort(), [...expected].sort(), `${operator} ${operand}`);
  };
  check(text, 'equals', 'HELLO WORLD', [alpha]); check(text, 'not_equals', 'hello world', [beta]);
  check(text, 'contains', 'WORLD', [alpha]); check(text, 'not_contains', 'world', [beta]);
  check(text, 'empty', null, [cyrillic]); check(text, 'not_empty', null, [alpha,beta]);
  for (const id of [number,date,select,multi]) check(id, 'empty', null, id === select ? [beta,cyrillic] : [cyrillic]);
  check(number, 'equals', 0, [beta]); check(number, 'not_equals', 0, [alpha]);
  check(number, 'gt', 0, [alpha]); check(number, 'gte', 5, [alpha]); check(number, 'lt', 5, [beta]); check(number, 'lte', 0, [beta]);
  check(date, 'equals', '2024-02-29', [alpha]); check(date, 'not_equals', '2024-02-29', [beta]);
  check(date, 'gt', '2024-02-29', [beta]); check(date, 'gte', '2025-01-01', [beta]); check(date, 'lt', '2025-01-01', [alpha]); check(date, 'lte', '2024-02-29', [alpha]);
  check(select, 'any', [red], [alpha]); check(select, 'any', [red,null], [alpha,beta,cyrillic]); check(select, 'none', [red], [beta,cyrillic]);
  check(multi, 'any', [a,b], [alpha,beta]); check(multi, 'all', [a,b], [alpha]); check(multi, 'none', [a,null], [beta]);
  check('name', 'contains', 'АЛЬ', [cyrillic], 'аль'); check('name', 'empty', null, []);
  assert.equal(f.save({ search: 'a', rules: [{ propertyId: number, operator: 'gt', operand: 0 }, { propertyId: multi, operator: 'any', operand: [a] }] }).ok, true);
  assert.deepEqual(f.results().value.projectIds, [alpha]);
  assert.equal(f.command('setNumberValue', { projectId: alpha, propertyId: number, expression: '-1' }).ok, true);
  assert.deepEqual(f.results().value.projectIds, []);
  f.reopen(); assert.deepEqual(f.results().value.projectIds, []);
}));

test('invalid operators, operands and foreign references are rejected atomically; stale and corrupt settings can be repaired explicitly', () => fixture(f => {
  const { viewId } = f.workspace;
  const propertyId = f.command('createProperty', { name: 'Number', propertyType: 'number' }).value.propertyId;
  const before = f.query('getViewFilter', { viewId });
  const rules = [
    { propertyId, operator: 'contains', operand: '1' }, { propertyId, operator: 'gt', operand: '1' },
    { propertyId, operator: 'equals', operand: Infinity }, { propertyId, operator: 'empty', operand: 0 },
    { propertyId: viewId, operator: 'empty', operand: null }, { propertyId: 'name', operator: 'any', operand: [null] },
    { propertyId: 'name', operator: 'equals', operand: null },
  ];
  const events = []; const stop = f.service.workspaces.subscribe(e => events.push(e));
  for (const rule of rules) { assert.equal(f.save({ search: '', rules: [rule] }).error.code, 'invalid_input'); assert.deepEqual(f.query('getViewFilter', { viewId }), before); }
  assert.equal(f.save({ search: '', rules: Array(1) }).error.code, 'invalid_input');
  assert.deepEqual(events, []); stop();
  const sibling = f.command('create', { rootPath: f.root, name: 'Sibling' }).value;
  assert.equal(f.results({ viewId: sibling.viewId }).error.code, 'invalid_input');
  assert.deepEqual(f.query('getViewFilter', { viewId: sibling.viewId }).error.code, 'invalid_input');
  assert.equal(f.command('setViewFilter', { viewId: sibling.viewId, config: { search: '', rules: [] } }).error.code, 'invalid_input');
  // Simulate stale/corrupt persisted data; service reads must not silently drop the condition.
  const db = new Database(f.path);
  try {
    const stale = { search: '', rules: [{ propertyId: randomUUID(), operator: 'empty', operand: null }] };
    db.prepare('UPDATE views SET filter_config = ? WHERE id = ?').run(JSON.stringify(stale), viewId);
    assert.deepEqual(f.query('getViewFilter', { viewId }).value.config, stale);
    assert.equal(f.results().error.code, 'invalid_input');
    assert.deepEqual(f.query('getViewFilter', { viewId }).value.config, stale);
    db.prepare('UPDATE views SET filter_config = ? WHERE id = ?').run('{bad', viewId);
    assert.equal(f.results().error.code, 'storage');
    assert.equal(f.query('getViewFilter', { viewId }).error.code, 'storage');
    assert.equal(f.save({ search: '', rules: [] }).ok, true);
    assert.equal(f.results().value.projectIds.length, 3);
  } finally { db.close(); }
}));

test('folder-backed Select uses category identities; retained empty values are explicit and mode changes retain stale rules with explicit errors', () => fixture(f => {
  mkdirSync(join(f.root, 'Alpha', 'Child')); mkdirSync(join(f.root, 'Beta', 'Other'));
  const preview = f.query('previewDiscovery', { mode: 'grouped' }).value;
  const list = f.command('applyDiscovery', { previewToken: preview.previewToken }); assert.equal(list.ok, true);
  const category = list.value.categories.find(c => c.name === 'Alpha').categoryId;
  const propertyId = list.value.categoryProperty.propertyId;
  const config = { search: '', rules: [{ propertyId, operator: 'any', operand: [category] }] };
  assert.equal(f.save(config).ok, true);
  assert.deepEqual(f.results().value.projectIds, [list.value.projects.find(p => p.name === 'Child').projectId]);
  assert.equal(f.save({ search: '', rules: [{ propertyId, operator: 'empty', operand: null }] }).ok, true);
  assert.deepEqual(f.results().value.projectIds.sort(), list.value.retainedProjects.map(p => p.projectId).sort());
  assert.equal(f.save(config).ok, true);
  assert.equal(f.save({ search: '', rules: [{ propertyId, operator: 'any', operand: [f.workspace.viewId] }] }).error.code, 'invalid_input');
  const direct = f.query('previewDiscovery', { mode: 'direct' }).value;
  assert.equal(f.command('applyDiscovery', { previewToken: direct.previewToken }).ok, true);
  assert.equal(f.results().error.code, 'invalid_input');
  assert.deepEqual(f.query('getViewFilter', { viewId: f.workspace.viewId }).value.config, config);
  f.reopen(); assert.equal(f.results().error.code, 'invalid_input');
}));

test('filter ownership is per workspace; foreign options, invalid dates, duplicate operands and injected save failures preserve settings', () => fixture(f => {
  const { viewId } = f.workspace;
  const make = (propertyType, name = propertyType) => f.command('createProperty', { name, propertyType }).value.propertyId;
  const date = make('date'), select = make('single_select'), other = make('single_select', 'Other');
  const makeOption = propertyId => f.command('createSelectOption', { propertyId, name: 'Choice', color: 'default' }).value.snapshot.selectOptions.find(o => o.propertyId === propertyId).optionId;
  const choice = makeOption(select), foreign = makeOption(other);
  assert.equal(f.command('setSelectOptionHidden', { propertyId: select, optionId: choice, hidden: true }).ok, true);
  const alpha = f.query('listProjects').value.projects.find(p => p.name === 'Alpha').projectId;
  // Existing hidden values remain searchable; hiding is presentation, not value deletion.
  assert.equal(f.command('setSelectOptionHidden', { propertyId: select, optionId: choice, hidden: false }).ok, true);
  assert.equal(f.command('setSelectValue', { propertyId: select, projectId: alpha, optionId: choice }).ok, true);
  assert.equal(f.command('setSelectOptionHidden', { propertyId: select, optionId: choice, hidden: true }).ok, true);
  assert.equal(f.save({ search: '', rules: [{ propertyId: select, operator: 'any', operand: [choice] }] }).ok, true);
  assert.deepEqual(f.results().value.projectIds, [alpha]);
  const sibling = f.command('create', { rootPath: f.root, name: 'Sibling' }).value;
  assert.deepEqual(f.query('getViewFilter', { workspaceId: sibling.workspaceId, viewId: sibling.viewId }).value.config, { search: '', rules: [] });
  const before = f.query('getViewFilter', { viewId });
  for (const rule of [
    { propertyId: date, operator: 'equals', operand: '2025-02-29' },
    { propertyId: select, operator: 'any', operand: [foreign] },
    { propertyId: select, operator: 'any', operand: [choice,choice] },
    { propertyId: select, operator: 'any', operand: [] },
  ]) assert.equal(f.save({ search: '', rules: [rule] }).error.code, 'invalid_input');
  const db = new Database(f.path);
  try {
    db.exec("CREATE TRIGGER filter_save_failure BEFORE UPDATE OF filter_config ON views BEGIN SELECT RAISE(ABORT, 'injected'); END");
    assert.equal(f.save({ search: 'Beta', rules: [] }).error.code, 'storage');
    assert.deepEqual(f.query('getViewFilter', { viewId }), before);
    db.exec('DROP TRIGGER filter_save_failure');
  } finally { db.close(); }
  f.reopen(); assert.deepEqual(f.query('getViewFilter', { viewId }), before);
}));

test('archive and active queries share saved filters while keeping lifecycle membership separate', () => fixture(f => {
  const alpha = f.query('listProjects').value.projects.find(p => p.name === 'Alpha').projectId;
  const location = f.query('previewArchiveLocation', { relativePath: 'Archive' }).value;
  assert.equal(f.command('applyArchiveLocation', { operationId: randomUUID(), previewToken: location.previewToken }).ok, true);
  const preview = f.query('previewProjectArchive', { projectId: alpha, action: 'archive', name: null, createParent: false }).value;
  assert.equal(f.command('applyProjectArchive', { operationId: randomUUID(), previewToken: preview.previewToken }).value.operation.stage, 'completed');
  assert.equal(f.save({ search: 'ALP', rules: [] }).ok, true);
  assert.deepEqual(f.results().value.projectIds, []);
  assert.deepEqual(f.results({ archived: true }).value.projectIds, [alpha]);
  f.reopen(); assert.deepEqual(f.results({ archived: true }).value.projectIds, [alpha]);
}));

test('pre-filter migration preserves populated view selection, identities and property data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'filter-upgrade-')), root = join(directory, 'root'); mkdirSync(root); mkdirSync(join(root, 'Alpha'));
  const path = join(directory, 'app.sqlite'); let service = openSettingsService(path);
  try {
    const workspace = service.handleCommand({ type: 'workspace.create', rootPath: root, name: 'Before' }).value;
    const { workspaceId, viewId } = workspace;
    const preview = service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId }).value;
    const projectId = service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
    const propertyId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'Note', propertyType: 'text' }).value.propertyId;
    service.handleCommand({ type: 'workspace.setTextValue', workspaceId, projectId, propertyId, value: '  Exact\nТекст  ' });
    const before = service.handleQuery({ type: 'workspace.listTextProperties', workspaceId });
    const views = service.handleCommand({ type: 'workspace.createView', workspaceId, name: 'Board', kind: 'board' });
    service.close();
    const db = new Database(path);
    try { db.exec('ALTER TABLE views DROP COLUMN board_config; ALTER TABLE views DROP COLUMN table_config; ALTER TABLE views DROP COLUMN grouping_config; ALTER TABLE views DROP COLUMN filter_config; DELETE FROM __drizzle_migrations WHERE created_at >= 1791504019000'); } finally { db.close(); }
    service = openSettingsService(path);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }), before);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listViews', workspaceId }), views);
    assert.deepEqual(service.handleQuery({ type: 'workspace.getViewFilter', workspaceId, viewId }).value.config, { search: '', rules: [] });
    assert.deepEqual(service.handleQuery({ type: 'workspace.queryView', workspaceId, viewId, archived: false }).value.projectIds, [projectId]);
  } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
});
