import {archiveProjectFixture} from './support/archived-project-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openSettingsService } from '../dist/service/settings.mjs';

const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'metadata-removal-')), root = join(directory, 'root');
  mkdirSync(root); mkdirSync(join(root, 'Project')); writeFileSync(join(root, 'Project', 'keep'), 'unchanged');
  const path = join(directory, 'app.sqlite'); let service = openSettingsService(path);
  const create = (name, rootPath = root) => unwrap(service.handleCommand({ type: 'workspace.create', rootPath, name }));
  const one = create('One'), sibling = create('Sibling');
  const command = (type, fields = {}) => service.handleCommand({ type: `workspace.${type}`, workspaceId: one.workspaceId, ...fields });
  const query = (type, fields = {}) => service.handleQuery({ type: `workspace.${type}`, workspaceId: one.workspaceId, ...fields });
  const projectId = unwrap(command('applyDiscovery', { previewToken: unwrap(query('previewDiscovery')).previewToken })).projects[0].projectId;
  const f = { directory, root, path, one, sibling, projectId, command, query, create, get service() { return service; },
    property: propertyType => unwrap(command('createProperty', { name: propertyType, propertyType })).propertyId,
    preview: (propertyId, optionId = null, replacementOptionId = null) => query('previewMetadataRemoval', { propertyId, optionId, replacementOptionId }),
    apply: preview => command('applyMetadataRemoval', { previewToken: preview.previewToken }),
    reopen() { service.close(); service = openSettingsService(path); } };
  try { run(f); } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
}
const settings = propertyId => ({ propertyId, order: 'manual', manualOrder: [], hidden: [], collapsed: [], hideEmpty: true });
function configure(f, propertyId, optionId = null) {
  const views = [f.one, f.sibling];
  for (const { workspaceId, viewId } of views) {
    const send = (type, fields) => unwrap(f.command(type, { workspaceId, viewId, ...fields }));
    send('setViewFilter', { config: { search: 'Project', rules: [{ propertyId, operator: optionId ? 'any' : 'not_empty', operand: optionId ? [optionId] : null }] } });
    send('setViewGrouping', { config: { propertyId, settings: [{ ...settings(propertyId), ...(optionId ? { manualOrder: [JSON.stringify(optionId)], collapsed: [JSON.stringify(optionId)] } : {}) }] } });
    send('setTableLayout', { config: { columns: [{ propertyId, hidden: true, width: 250, wrap: false }], rowOrder: [f.projectId] } });
    send('setBoardLayout', { config: { properties: [{ propertyId, hidden: true }], widths: optionId ? [{ propertyId, key: JSON.stringify(optionId), width: 500 }] : [], wrap: false } });
  }
}
test('preview and cancellation preserve records; deleting a custom property cleans sibling view references atomically across restart', () => fixture(f => {
  const propertyId = f.property('text'), unrelated = f.property('number');
  unwrap(f.command('setTextValue', { propertyId, projectId: f.projectId, value: 'authored text' })); configure(f, propertyId);
  const before = f.query('listTextProperties'), events = []; f.service.workspaces.subscribe(e => events.push(e));
  const preview = unwrap(f.preview(propertyId));
  assert.equal(preview.projects.length, 1); assert.equal(preview.views.length, 2);
  assert.deepEqual(f.query('listTextProperties'), before); assert.deepEqual(events, []);
  unwrap(f.apply(preview));
  assert.equal(events.filter(e => e.type === 'workspace.propertiesChanged').length, 1);
  assert.deepEqual(events[0].workspaceIds, [f.one.workspaceId, f.sibling.workspaceId]);
  f.reopen();
  assert.deepEqual(unwrap(f.query('listTextProperties')).definitions.map(p => p.propertyId), [unrelated]);
  for (const { workspaceId, viewId } of [f.one, f.sibling]) {
    const get = type => unwrap(f.query(type, { workspaceId, viewId })).config;
    assert.deepEqual(get('getViewFilter'), { search: 'Project', rules: [] });
    assert.deepEqual(get('getViewGrouping'), { propertyId: null, settings: [] });
    assert.deepEqual(get('getTableLayout'), { columns: [], rowOrder: [f.projectId] });
    assert.deepEqual(get('getBoardLayout'), { properties: [], widths: [], wrap: false });
    assert.deepEqual(unwrap(f.query('queryView', { workspaceId, viewId, archived: false })).projectIds, [f.projectId]);
  }
  assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
}));
function option(f, propertyId, name) {
  return unwrap(f.command('createSelectOption', { propertyId, name, color: 'blue' })).snapshot.selectOptions.find(o => o.propertyId === propertyId && o.name === name).optionId;
}
for (const propertyType of ['single_select', 'multi_select']) for (const replace of [false, true]) {
  test(`${propertyType} option ${replace ? 'reassignment' : 'clear'} cleans configured views and preserves other memberships and destination presentation`, () => fixture(f => {
    const propertyId = f.property(propertyType), old = option(f, propertyId, 'Old'), next = option(f, propertyId, 'Next'), other = option(f, propertyId, 'Other');
    unwrap(f.command(propertyType === 'single_select' ? 'setSelectValue' : 'setMultiSelectValue', { projectId: f.projectId, propertyId, ...(propertyType === 'single_select' ? { optionId: old } : { optionIds: [old, next, other] }) }));
    unwrap(f.command('setSelectOptionHidden', { propertyId, optionId: old, hidden: true }));
    configure(f, propertyId, old);
    unwrap(f.command('setBoardLayout', { viewId: f.one.viewId, config: { properties: [{ propertyId, hidden: false }], widths: [{ propertyId, key: JSON.stringify(old), width: 500 }, { propertyId, key: JSON.stringify(next), width: 650 }], wrap: true } }));
    const preview = unwrap(f.preview(propertyId, old, replace ? next : null));
    assert.equal(preview.projects.length, 1); assert.equal(preview.optionName, 'Old');
    unwrap(f.apply(preview)); f.reopen();
    const snapshot = unwrap(f.query('listTextProperties'));
    assert.deepEqual(snapshot.selectOptions.map(o => o.optionId), [next, other]);
    if (propertyType === 'single_select') assert.deepEqual(snapshot.selectValues.map(v => v.optionId), replace ? [next] : []);
    else assert.deepEqual(snapshot.multiSelectValues.map(v => v.optionId).sort(), [next, other].sort());
    for (const { workspaceId, viewId } of [f.one, f.sibling]) {
      const get = type => unwrap(f.query(type, { workspaceId, viewId })).config;
      assert.deepEqual(get('getViewFilter').rules, replace ? [{ propertyId, operator: 'any', operand: [next] }] : []);
      assert.equal(get('getViewGrouping').propertyId, propertyId);
      assert.deepEqual(get('getViewGrouping').settings[0].collapsed, replace ? [JSON.stringify(next)] : []);
      assert.equal(get('getTableLayout').columns.length, 1);
      assert.equal(unwrap(f.query('queryView', { workspaceId, viewId, archived: false })).projectIds.length, 1);
    }
    const board = unwrap(f.query('getBoardLayout', { viewId: f.one.viewId })).config;
    assert.deepEqual(board.widths, [{ propertyId, key: JSON.stringify(next), width: 650 }]);
    assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
  }));
}
for (const propertyType of ['number', 'date', 'single_select', 'multi_select']) test(`deleting ${propertyType} removes every owned value/option/visibility but keeps an unrelated source`, () => fixture(f => {
  const propertyId = f.property(propertyType);
  if (propertyType.includes('select')) {
    const optionId = option(f, propertyId, 'Used');
    unwrap(f.command('setSelectOptionHidden', { workspaceId: f.sibling.workspaceId, propertyId, optionId, hidden: true }));
    unwrap(f.command(propertyType === 'single_select' ? 'setSelectValue' : 'setMultiSelectValue', { propertyId, projectId: f.projectId, ...(propertyType === 'single_select' ? { optionId } : { optionIds: [optionId] }) }));
  } else unwrap(f.command(propertyType === 'number' ? 'setNumberValue' : 'setDateValue', { propertyId, projectId: f.projectId, ...(propertyType === 'number' ? { expression: '2+3' } : { value: '2024-02-29' }) }));
  const foreignRoot = join(f.directory, 'foreign'); mkdirSync(foreignRoot);
  const foreign = f.create('Foreign', foreignRoot);
  unwrap(f.command('createProperty', { workspaceId: foreign.workspaceId, name: 'Keep', propertyType: 'text' }));
  const foreignBefore = f.query('listTextProperties', { workspaceId: foreign.workspaceId });
  configure(f, propertyId);
  assert.equal(unwrap(f.preview(propertyId)).projects.length, 1);
  unwrap(f.apply(unwrap(f.preview(propertyId)))); f.reopen();
  assert.deepEqual(unwrap(f.query('listTextProperties')).definitions, []);
  assert.deepEqual(f.query('listTextProperties', { workspaceId: foreign.workspaceId }), foreignBefore);
  assert.equal(unwrap(f.query('queryView', { viewId: f.one.viewId, archived: false })).projectIds.length, 1);
}));

test('stale reviews reject value/view/sibling changes, new previews, consumed tokens, wrong workspace and service restart without writes', () => fixture(f => {
  const propertyId = f.property('text');
  for (const change of [
    () => unwrap(f.command('setTextValue', { propertyId, projectId: f.projectId, value: 'new' })),
    () => unwrap(f.command('setViewFilter', { workspaceId: f.sibling.workspaceId, viewId: f.sibling.viewId, config: { search: 'changed', rules: [] } })),
    () => f.create('New sibling'),
    () => unwrap(f.preview(propertyId)),
    () => f.reopen(),
  ]) {
    const preview = unwrap(f.preview(propertyId)); change(); const before = f.query('listTextProperties');
    assert.equal(f.apply(preview).error.code, 'stale_preview'); assert.deepEqual(f.query('listTextProperties'), before);
  }
  const preview = unwrap(f.preview(propertyId));
  assert.equal(f.command('applyMetadataRemoval', { workspaceId: f.sibling.workspaceId, previewToken: preview.previewToken }).error.code, 'stale_preview');
  unwrap(f.apply(preview)); assert.equal(f.apply(preview).error.code, 'stale_preview');
}));

test('failed source revision commit rolls back property/option/value/view cleanup and publishes nothing', () => fixture(f => {
  const propertyId = f.property('multi_select'), old = option(f, propertyId, 'Old'), next = option(f, propertyId, 'Next');
  unwrap(f.command('setMultiSelectValue', { propertyId, projectId: f.projectId, optionIds: [old, next] })); configure(f, propertyId, old);
  const before = f.query('listTextProperties'), filterBefore = f.query('getViewFilter', { viewId: f.one.viewId }), boardBefore = f.query('getBoardLayout', { viewId: f.one.viewId });
  const events = []; f.service.workspaces.subscribe(e => events.push(e)); const db = new Database(f.path);
  db.exec("CREATE TRIGGER injected_failure BEFORE UPDATE OF property_revision ON sources BEGIN SELECT RAISE(ABORT, 'fixture'); END");
  try {
    for (const [optionId, replacement] of [[old, null], [old, next], [null, null]]) {
      const preview = unwrap(f.preview(propertyId, optionId, replacement));
      assert.equal(f.apply(preview).error.code, 'storage');
      assert.deepEqual(f.query('listTextProperties'), before); assert.deepEqual(f.query('getViewFilter', { viewId: f.one.viewId }), filterBefore);
      assert.deepEqual(f.query('getBoardLayout', { viewId: f.one.viewId }), boardBefore); assert.deepEqual(events, []);
    }
  } finally { db.close(); }
  f.reopen(); assert.deepEqual(f.query('listTextProperties'), before);
}));
test('new options append after surviving options when an earlier option is deleted', () => fixture(f => {
  const propertyId = f.property('single_select'), old = option(f, propertyId, 'Old'), next = option(f, propertyId, 'Next'), other = option(f, propertyId, 'Other');
  unwrap(f.apply(unwrap(f.preview(propertyId, old))));
  const added = option(f, propertyId, 'Added');
  assert.deepEqual(unwrap(f.query('listTextProperties')).selectOptions.map(o => [o.optionId, o.position]), [[next, 0], [other, 1], [added, 2]]);
}));

test('retained project usages participate in deletion without touching their folders or identities', () => fixture(f => {
  const propertyId = f.property('text'); unwrap(f.command('setTextValue', { propertyId, projectId: f.projectId, value: 'retained' }));
  // Exclusion retains the logical record and its value, outside the active projection.
  const excluded = unwrap(f.query('previewDiscovery', { excludedRelativePaths: ['Project'] }));
  unwrap(f.command('applyDiscovery', { previewToken: excluded.previewToken }));
  const preview = unwrap(f.preview(propertyId)); assert.equal(preview.projects[0].projectId, f.projectId);
  unwrap(f.apply(preview)); assert.equal(readFileSync(join(f.root, 'Project', 'keep'), 'utf8'), 'unchanged');
}));

test('dormant grouping settings and mixed filter operands are cleaned without erasing unrelated references', () => fixture(f => {
  const propertyId = f.property('multi_select'), old = option(f, propertyId, 'Old'), next = option(f, propertyId, 'Next');
  const other = f.property('text');
  unwrap(f.command('setViewFilter', { viewId: f.one.viewId, config: { search: 'Project', rules: [{ propertyId, operator: 'any', operand: [old, next, null] }, { propertyId: other, operator: 'empty', operand: null }] } }));
  unwrap(f.command('setViewGrouping', { viewId: f.one.viewId, config: { propertyId: other, settings: [{ ...settings(propertyId), manualOrder: [JSON.stringify(old), JSON.stringify(next)], hidden: [JSON.stringify(old)] }, settings(other)] } }));
  unwrap(f.apply(unwrap(f.preview(propertyId, old, next))));
  let config = unwrap(f.query('getViewFilter', { viewId: f.one.viewId })).config;
  assert.deepEqual(config.rules[0].operand, [next, null]); assert.equal(config.rules.length, 2);
  let grouping = unwrap(f.query('getViewGrouping', { viewId: f.one.viewId })).config;
  assert.equal(grouping.propertyId, other); assert.deepEqual(grouping.settings[0].manualOrder, [JSON.stringify(next)]);
  unwrap(f.apply(unwrap(f.preview(propertyId))));
  config = unwrap(f.query('getViewFilter', { viewId: f.one.viewId })).config; assert.equal(config.rules.length, 1); assert.equal(config.rules[0].propertyId, other);
  grouping = unwrap(f.query('getViewGrouping', { viewId: f.one.viewId })).config;
  assert.deepEqual(grouping, { propertyId: other, settings: [settings(other)] });
}));

test('archived values are included in previews and removed without changing archive location or stored project identity', () => fixture(f => {
  const propertyId = f.property('date'); unwrap(f.command('setDateValue', { propertyId, projectId: f.projectId, value: '2024-02-29' }));
  archiveProjectFixture(f.path,f.one.workspaceId,f.projectId);
  const before = f.query('listArchivedProjects');
  const preview = unwrap(f.preview(propertyId)); assert.equal(preview.projects[0].projectId, f.projectId);
  assert.deepEqual(preview.projects[0].values, ['2024-02-29']); unwrap(f.apply(preview)); f.reopen();
  assert.deepEqual(f.query('listArchivedProjects'), before);
  assert.equal(readFileSync(join(f.root, 'Archive', 'Project', 'keep'), 'utf8'), 'unchanged');
}));
