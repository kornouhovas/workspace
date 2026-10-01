import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStatusDrop } from '../src/workspaceStatusDrop.js';
const options = [
  { id: 'status:active', current: true, to: 'Active/P' },
  { id: 'status:empty', current: false, to: 'Empty/P' },
  { id: 'status:filtered', current: false, to: 'Filtered/P' },
  { id: 'status:no-status', current: false, to: null, disabledReason: 'no-status-target' },
  { id: 'status:nested', current: false, to: 'Active/Nested/P', disabledReason: 'nested-status-target' },
];
test('only an available explicit status zone produces a move, including empty and filtered statuses', () => {
  assert.equal(resolveStatusDrop(options, 'status:empty', false), options[1]);
  assert.equal(resolveStatusDrop(options, 'status:filtered', false), options[2]);
  for (const id of [null, 'project:row', 'custom:value', 'status:active', 'status:no-status', 'status:nested']) {
    assert.equal(resolveStatusDrop(options, id, false), null);
  }
});
test('pending and unloaded options never authorize a drop', () => {
  assert.equal(resolveStatusDrop(options, 'status:empty', true), null);
  assert.equal(resolveStatusDrop(null, 'status:empty', false), null);
});
