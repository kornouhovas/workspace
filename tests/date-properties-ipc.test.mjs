import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServiceProcess } from '../dist/service/entry.cjs';

test('built backend IPC accepts Date creation and calendar dates while rejecting malformed payloads without mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'date-ipc-')), root = join(directory, 'root');
  mkdirSync(root); mkdirSync(join(root, 'Project'));
  const parent = new EventEmitter(), port = new EventEmitter(), sent = [];
  parent.postMessage = () => {}; port.postMessage = message => sent.push(message); port.close = () => {};
  startServiceProcess(parent);
  let id = 0;
  const request = input => { port.emit('message', { data: { id: ++id, input } }); assert.equal(sent.at(-1).id, id); return sent.at(-1).result; };
  try {
    parent.emit('message', { data: { type: 'connect', databasePath: join(directory, 'app.sqlite') }, ports: [port] });
    const workspaceId = request({ type: 'workspace.create', rootPath: root, name: 'One' }).value.workspaceId;
    const preview = request({ type: 'workspace.previewDiscovery', workspaceId }).value;
    const projectId = request({ type: 'workspace.applyDiscovery', workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
    const created = request({ type: 'workspace.createProperty', workspaceId, name: 'Date', propertyType: 'date' }); assert.equal(created.ok, true);
    const propertyId = created.value.propertyId;
    const command = { type: 'workspace.setDateValue', workspaceId, projectId, propertyId, value: '2024-02-29' };
    const saved = request(command); assert.equal(saved.ok, true); assert.equal(saved.value.snapshot.dateValues[0].value, '2024-02-29');
    const before = request({ type: 'workspace.listTextProperties', workspaceId });
    const count = sent.filter(message => message.type === 'workspace.change').length;
    for (const input of [{ ...command, value: '2025-02-29' }, { ...command, value: 20 }, { ...command, expression: '20' }, { ...command, extra: true },
      { type: 'workspace.renameProperty', workspaceId, propertyId, name: 'Wrong', propertyType: 'text' }]) {
      assert.equal(request(input).error.code, 'invalid_input'); assert.deepEqual(request({ type: 'workspace.listTextProperties', workspaceId }), before);
    }
    assert.equal(sent.filter(message => message.type === 'workspace.change').length, count);
  } finally { parent.emit('message', { data: { type: 'shutdown' }, ports: [] }); rmSync(directory, { recursive: true, force: true }); }
});
