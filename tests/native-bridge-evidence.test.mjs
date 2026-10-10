import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeBridgeCleanupEvidence } from '../scripts/native-bridge-evidence.mjs';

test('cleanup requires one confirmed owned bridge termination and never rescues unknown termination', () => {
  const confirmed = { started: 1, stopped: 1, active: 0, unknown: false };
  assert.equal(nativeBridgeCleanupEvidence(confirmed).status, 'passed');
  for (const value of [null, {}, { ...confirmed, started: 0 }, { ...confirmed, stopped: 0 },
    { ...confirmed, active: 1 }, { ...confirmed, unknown: true }, { ...confirmed, unknown: null },
    { ...confirmed, started: 2 }, { ...confirmed, stopped: 0.5 }, { ...confirmed, active: NaN }]) {
    assert.equal(nativeBridgeCleanupEvidence(value).status, 'unverified');
  }
  const lateCloseAfterUnknown = { ...confirmed, unknown: true, privateError: 'private process and path' };
  assert.deepEqual(nativeBridgeCleanupEvidence(lateCloseAfterUnknown),
    { status: 'unverified', started: 1, stopped: 1, active: 0, unknown: true });
});
