import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServiceProcess } from '../dist/service/entry.cjs';

test('built backend IPC accepts Single Select option/value commands while rejecting malformed payloads without mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'select-ipc-')), root = join(directory, 'root');
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
    const propertyId = request({ type: 'workspace.createProperty', workspaceId, name: 'Status', propertyType: 'single_select' }).value.propertyId;
    const added = request({ type: 'workspace.createSelectOption', workspaceId, propertyId, name: 'Ready', color: 'blue' }); assert.equal(added.ok, true);
    const optionId = added.value.snapshot.selectOptions[0].optionId;
    const command = { type: 'workspace.setSelectValue', workspaceId, projectId, propertyId, optionId };
    assert.equal(request(command).ok, true);
    for (const input of [
      { type: 'workspace.updateSelectOption', workspaceId, propertyId, optionId, name: 'Done', color: 'green' },
      { type: 'workspace.reorderSelectOptions', workspaceId, propertyId, optionIds: [optionId] },
      { type: 'workspace.setSelectOptionHidden', workspaceId, propertyId, optionId, hidden: true },
      { ...command, optionId: null },
    ]) assert.equal(request(input).ok, true, JSON.stringify(input));
    const before = request({ type: 'workspace.listTextProperties', workspaceId });
    const count = sent.filter(message => message.type === 'workspace.change').length;
    for (const input of [{ ...command, optionId: '' }, { ...command, extra: true }, { ...command, optionId: 42 },
      { type: 'workspace.setSelectOptionHidden', workspaceId, propertyId, optionId, hidden: 1 },
      { type: 'workspace.reorderSelectOptions', workspaceId, propertyId, optionIds: [optionId, optionId] },
      { type: 'workspace.updateSelectOption', workspaceId, propertyId, optionId, name: '', color: 'invalid' },
      { type: 'workspace.renameProperty', workspaceId, propertyId, name: 'Wrong', propertyType: 'text' }]) {
      assert.equal(request(input).error.code, 'invalid_input'); assert.deepEqual(request({ type: 'workspace.listTextProperties', workspaceId }), before);
    }
    assert.equal(sent.filter(message => message.type === 'workspace.change').length, count);
  } finally { parent.emit('message', { data: { type: 'shutdown' }, ports: [] }); rmSync(directory, { recursive: true, force: true }); }
});
