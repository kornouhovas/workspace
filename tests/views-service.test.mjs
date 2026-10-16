import { historicalWorkspace } from './helpers/historical-workspace.mjs';
import Database from 'better-sqlite3';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSettingsService } from '../dist/service/settings.mjs';

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-views-'));
  const root = join(directory, 'root'); mkdirSync(root); mkdirSync(join(root, 'Project'));
  const path = join(directory, 'workspace.sqlite'); let service = openSettingsService(path);
  const create = name => service.handleCommand({ type: 'workspace.create', rootPath: root, name }).value;
  const one = create('One'), sibling = create('Sibling');
  const f = { directory, path, one, sibling, get service() { return service; },
    command(type, input = {}, workspaceId = one.workspaceId) { return service.handleCommand({ type: `workspace.${type}`, workspaceId, ...input }); },
    list(workspaceId = one.workspaceId) { return service.handleQuery({ type: 'workspace.listViews', workspaceId }); },
    reopen() { service.close(); service = openSettingsService(path); } };
  try { run(f); } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('each workspace retains an independent view collection and selection through switching and restart', () => fixture(f => {
  const initial = f.list(); assert.equal(initial.ok, true);
  assert.deepEqual(initial.value, { workspaceId: f.one.workspaceId, activeViewId: f.one.viewId,
    views: [{ viewId: f.one.viewId, name: 'Table', kind: 'table' }] });
  const board = f.command('createView', { name: 'Мои проекты', kind: 'board' }); assert.equal(board.ok, true);
  const boardId = board.value.activeViewId;
  assert.equal(board.value.views[1].kind, 'board');
  const sibling = f.list(f.sibling.workspaceId);
  assert.equal(f.command('activate', {}, f.one.workspaceId).value.viewId, boardId);
  assert.equal(f.command('activate', {}, f.sibling.workspaceId).value.viewId, f.sibling.viewId);
  const before = f.list(); f.reopen(); assert.deepEqual(f.list(), before); assert.deepEqual(f.list(f.sibling.workspaceId), sibling);
  assert.equal(f.command('activate', {}, f.one.workspaceId).value.viewId, boardId);
}));

test('duplicate copies layout independently; rename, layout, reorder and delete retain a usable selection', () => fixture(f => {
  const created = f.command('createView', { name: 'Board', kind: 'board' }).value;
  const boardId = created.activeViewId;
  const duplicate = f.command('duplicateView', { viewId: boardId, name: 'Copy' }); assert.equal(duplicate.ok, true);
  const copyId = duplicate.value.activeViewId;
  assert.deepEqual(duplicate.value.views[2], { viewId: copyId, name: 'Copy', kind: 'board' });
  assert.equal(f.command('renameView', { viewId: copyId, name: '  Обзор  ' }).ok, true);
  assert.equal(f.command('setViewLayout', { viewId: copyId, kind: 'table' }).ok, true);
  assert.deepEqual(f.list().value.views[1], { viewId: boardId, name: 'Board', kind: 'board' });
  assert.deepEqual(f.list().value.views[2], { viewId: copyId, name: '  Обзор  ', kind: 'table' });
  assert.equal(f.command('reorderViews', { viewIds: [copyId, boardId, f.one.viewId] }).ok, true);
  assert.deepEqual(f.list().value.views.map(v => v.viewId), [copyId, boardId, f.one.viewId]);
  assert.equal(f.command('activateView', { viewId: boardId }).value.activeViewId, boardId);
  assert.equal(f.command('deleteView', { viewId: copyId }).value.activeViewId, boardId);
  assert.equal(f.command('deleteView', { viewId: boardId }).value.activeViewId, f.one.viewId);
  const before = f.list(); assert.equal(f.command('deleteView', { viewId: f.one.viewId }).error.code, 'invalid_input');
  assert.deepEqual(f.list(), before);
  f.reopen(); assert.deepEqual(f.list(), before);
}));

test('invalid ownership and malformed lifecycle commands leave collections and notifications unchanged', () => fixture(f => {
  const before = f.list(), sibling = f.list(f.sibling.workspaceId), events = [];
  f.service.workspaces.subscribe(e => events.push(e));
  for (const [type, input] of [
    ['activateView', { viewId: f.sibling.viewId }], ['duplicateView', { viewId: f.sibling.viewId, name: 'Copy' }],
    ['deleteView', { viewId: f.sibling.viewId }], ['renameView', { viewId: f.one.viewId, name: ' ' }],
    ['createView', { name: 'Bad', kind: 'grid' }], ['createView', { name: 'Bad', kind: 'board', extra: true }],
    ['setViewLayout', { viewId: f.sibling.viewId, kind: 'board' }],
    ['reorderViews', { viewIds: [f.one.viewId, f.one.viewId] }], ['reorderViews', { viewIds: [] }],
    ['reorderViews', { viewIds: [f.sibling.viewId] }], ['reorderViews', { viewIds: Array(1) }],
    ['duplicateView', { viewId: f.one.viewId, name: '' }],
  ]) { assert.equal(f.command(type, input).error.code, 'invalid_input', type); assert.deepEqual(f.list(), before); }
  assert.deepEqual(f.list(f.sibling.workspaceId), sibling); assert.deepEqual(events, []);
}));

test('workspace removal falls back to the sibling selected Board even when no Table remains', () => fixture(f => {
  const boardId = f.command('createView', { name: 'Only Board', kind: 'board' }, f.sibling.workspaceId).value.activeViewId;
  assert.equal(f.command('deleteView', { viewId: f.sibling.viewId }, f.sibling.workspaceId).ok, true);
  f.command('activate');
  const removed = f.command('remove'); assert.equal(removed.ok, true);
  assert.equal(removed.value.activeWorkspace.viewId, boardId);
  f.reopen(); assert.equal(f.service.workspaces.load().value.activeWorkspace.viewId, boardId);
}));

test('failed duplication rolls back the inserted view, order and active selection with no event', () => fixture(f => {
  const db = new Database(f.path), before = f.list(), events = [];
  f.service.workspaces.subscribe(e => events.push(e));
  try {
    db.exec("CREATE TRIGGER injected_selection_failure BEFORE UPDATE ON workspace_view_selection BEGIN SELECT RAISE(ABORT, 'selection failure'); END");
    const failed = f.command('duplicateView', { viewId: f.one.viewId, name: 'Must not survive' });
    assert.equal(failed.error.code, 'storage'); assert.deepEqual(f.list(), before); assert.deepEqual(events, []);
    db.exec('DROP TRIGGER injected_selection_failure');
    f.reopen(); assert.deepEqual(f.list(), before);
    assert.equal(f.command('duplicateView', { viewId: f.one.viewId, name: 'Successful copy' }).ok, true);
  } finally { db.close(); }
}));

test('populated pre-view-management migration preserves project values and each existing view identity', () => {
  const directory = mkdtempSync(join(tmpdir(), 'views-upgrade-')), root = join(directory, 'root'), migrations = join(directory, 'migrations');
  mkdirSync(root); mkdirSync(join(root, 'Project')); mkdirSync(join(migrations, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync('src/service/db/migrations/meta/_journal.json', 'utf8')); journal.entries = journal.entries.slice(0, 18);
  for (const entry of journal.entries) writeFileSync(join(migrations, `${entry.tag}.sql`), readFileSync(`src/service/db/migrations/${entry.tag}.sql`));
  writeFileSync(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
  const path = join(directory, 'workspace.sqlite'); let service = openSettingsService(path, migrations);
  try {
    const one = historicalWorkspace(path, root), workspaceId = one.workspaceId;
    const preview = service.handleQuery({ type: 'workspace.previewDiscovery', workspaceId }).value;
    const projectId = service.handleCommand({ type: 'workspace.applyDiscovery', workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
    const propertyId = service.handleCommand({ type: 'workspace.createProperty', workspaceId, name: 'Notes', propertyType: 'text' }).value.propertyId;
    service.handleCommand({ type: 'workspace.setTextValue', workspaceId, propertyId, projectId, value: '  Exact\nТекст  ' });
    const properties = service.handleQuery({ type: 'workspace.listTextProperties', workspaceId });
    const load = service.workspaces.load(); service.close(); service = openSettingsService(path);
    assert.deepEqual(service.workspaces.load(), load);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listTextProperties', workspaceId }), properties);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listViews', workspaceId }).value,
      { workspaceId, activeViewId: one.viewId, views: [{ viewId: one.viewId, name: 'Table', kind: 'table' }] });
    const board = service.handleCommand({ type: 'workspace.createView', workspaceId, name: 'After upgrade', kind: 'board' }); assert.equal(board.ok, true);
    service.close(); service = openSettingsService(path);
    assert.deepEqual(service.handleQuery({ type: 'workspace.listViews', workspaceId }), board);
  } finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
});
