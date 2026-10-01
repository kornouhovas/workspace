import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectMoveController } from '../src/workspaceProjectMoveState.js';
import { WorkspaceServiceClient } from '../src/workspaceServiceClient.js';

test('move client passes stable IDs through transport without destination paths', async () => {
  const calls = [];
  const client = new WorkspaceServiceClient({ request: async (method, payload) => { calls.push({ method, payload }); return payload; } });
  await client.getProjectStatusOptions({ workspaceId: 'w', projectId: 'p' });
  await client.moveProjectStatus({ workspaceId: 'w', projectId: 'p', statusValueId: 's' });
  assert.deepEqual(calls, [ { method: 'workspace.getProjectStatusOptions', payload: { workspaceId: 'w', projectId: 'p' } }, { method: 'workspace.moveProjectStatus', payload: { workspaceId: 'w', projectId: 'p', statusValueId: 's' } } ]);
});

test('renderer pending details exist only while the backend request runs and repeated selections are prevented', async () => {
  let release, calls = 0;
  const backend = new Promise(resolve => release = resolve);
  const events = [];
  const controller = createProjectMoveController({ moveProjectStatus: async () => { calls++; return backend; } }, value => events.push(value));
  const input = { workspaceId: 'w', projectId: 'p', projectName: 'Alpha', statusValueId: 's', from: 'Active/Alpha', to: 'Done/Alpha' };
  const first = controller.move(input);
  assert.deepEqual(events[0], { ...input, state: 'pending' });
  assert.equal(await controller.move(input), null);
  assert.equal(calls, 1);
  release({ state: 'completed' });
  await first;
  assert.equal(events.at(-1), null);
});

test('renderer clears pending after failure and a subsequent request can recover', async () => {
  let fail = true;
  const events = [];
  const controller = createProjectMoveController({ moveProjectStatus: async () => { if (fail) throw new Error('disk unavailable'); return { state: 'completed' }; } }, value => events.push(value));
  const input = { workspaceId: 'w', projectId: 'p', projectName: 'Alpha', statusValueId: 's', from: 'Active/Alpha', to: 'Done/Alpha' };
  await assert.rejects(controller.move(input), /disk unavailable/);
  assert.equal(events.at(-1), null);
  fail = false; await controller.move(input);
  assert.equal(events.filter(Boolean).length, 2);
  assert.equal(events.at(-1), null);
});
