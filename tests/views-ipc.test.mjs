import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServiceProcess } from '../dist/service/entry.cjs';
import { isServiceEvent } from '../src/contracts/service-protocol.ts';

test('built IPC routes view lifecycle commands and validates payloads without partial collections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'views-ipc-')), root = join(directory, 'root'); mkdirSync(root);
  const parent = new EventEmitter(), port = new EventEmitter(), sent = [];
  parent.postMessage = () => {}; port.postMessage = message => sent.push(message); port.close = () => {};
  startServiceProcess(parent); let id = 0;
  const request = input => { port.emit('message', { data: { id: ++id, input } }); assert.equal(sent.at(-1).id, id); return sent.at(-1).result; };
  try {
    parent.emit('message', { data: { type: 'connect', databasePath: join(directory, 'app.sqlite') }, ports: [port] });
    const workspaceId = request({ type: 'workspace.create', rootPath: root, name: 'One' }).value.workspaceId;
    const initial = request({ type: 'workspace.listViews', workspaceId }); assert.equal(initial.ok, true);
    const board = request({ type: 'workspace.createView', workspaceId, name: 'Board', kind: 'board' }); assert.equal(board.ok, true);
    const viewId = board.value.activeViewId;
    assert.equal(request({ type: 'workspace.updateView', workspaceId, viewId, name: 'Overview', kind: 'table' }).ok, true);
    const copy = request({ type: 'workspace.duplicateView', workspaceId, viewId, name: 'Copy' }); assert.equal(copy.ok, true);
    assert.equal(request({ type: 'workspace.setViewLayout', workspaceId, viewId, kind: 'board' }).ok, true);
    assert.equal(request({ type: 'workspace.renameView', workspaceId, viewId, name: 'Renamed' }).ok, true);
    assert.equal(request({ type: 'workspace.reorderViews', workspaceId, viewIds: [...copy.value.views.map(v => v.viewId)].reverse() }).ok, true);
    assert.equal(request({ type: 'workspace.activateView', workspaceId, viewId }).ok, true);
    assert.equal(request({ type: 'workspace.deleteView', workspaceId, viewId: copy.value.activeViewId }).ok, true);
    const before = request({ type: 'workspace.listViews', workspaceId }), count = sent.length;
    for (const input of [
      { type: 'workspace.createView', workspaceId, name: 'Bad', kind: 'grid' },
      { type: 'workspace.duplicateView', workspaceId, viewId, name: 'Bad', extra: true },
      { type: 'workspace.updateView', workspaceId, viewId, name: '', kind: 'board' },
      { type: 'workspace.reorderViews', workspaceId, viewIds: [viewId, viewId] },
      { type: 'workspace.listViews', workspaceId, sourceId: workspaceId },
      { type: 'workspace.deleteView', workspaceId, viewId: 42 },
    ]) assert.equal(request(input).error.code, 'invalid_input');
    assert.deepEqual(request({ type: 'workspace.listViews', workspaceId }), before);
    assert.equal(sent.slice(count).filter(m => m.type === 'workspace.change').length, 0);
    const events = sent.filter(m => m.type === 'workspace.change'); assert.ok(events.length > 0); assert.ok(events.every(isServiceEvent));
  } finally { parent.emit('message', { data: { type: 'shutdown' }, ports: [] }); rmSync(directory, { recursive: true, force: true }); }
});
