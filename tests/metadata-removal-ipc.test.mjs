import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServiceProcess } from '../dist/service/entry.cjs';
test('built IPC routes reviewed metadata deletion and rejects malformed, structural, foreign and unreviewed mutations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'removal-ipc-')), root = join(directory, 'root'); mkdirSync(root);
  const parent = new EventEmitter(), port = new EventEmitter(), sent = []; parent.postMessage = () => {}; port.postMessage = m => sent.push(m); port.close = () => {}; startServiceProcess(parent);
  let id = 0;
  const request = input => { port.emit('message', { data: { id: ++id, input } }); assert.equal(sent.at(-1).id, id); return sent.at(-1).result; };
  try {
    parent.emit('message', { data: { type: 'connect', databasePath: join(directory, 'app.sqlite') }, ports: [port] });
    const { workspaceId } = request({ type: 'workspace.create', rootPath: root, name: 'One' }).value;
    const call = (type, fields = {}) => request({ type: `workspace.${type}`, workspaceId, ...fields });
    const propertyId = call('createProperty', { name: 'Notes', propertyType: 'text' }).value.propertyId;
    const preview = { propertyId, optionId: null, replacementOptionId: null };
    const before = call('listTextProperties');
    for (const fields of [{ ...preview, extra: true }, { ...preview, propertyId: 'name' }, { ...preview, propertyId: randomUUID() },
      { ...preview, optionId: [] }, { ...preview, replacementOptionId: randomUUID() }, { propertyId }, { ...preview, workspaceId: randomUUID() }]) assert.equal(call('previewMetadataRemoval', fields).error.code, 'invalid_input');
    for (const fields of [{}, { previewToken: 42 }, { previewToken: randomUUID(), propertyId }]) assert.equal(call('applyMetadataRemoval', fields).error.code, 'invalid_input');
    assert.deepEqual(call('listTextProperties'), before);
    const reviewed = call('previewMetadataRemoval', preview); assert.equal(reviewed.ok, true);
    assert.equal(call('applyMetadataRemoval', { previewToken: reviewed.value.previewToken }).ok, true);
    assert.equal(call('listTextProperties').value.definitions.length, 0);
    assert.equal(call('applyMetadataRemoval', { previewToken: reviewed.value.previewToken }).error.code, 'stale_preview');
  } finally { parent.emit('message', { data: { type: 'shutdown' }, ports: [] }); rmSync(directory, { recursive: true, force: true }); }
});
