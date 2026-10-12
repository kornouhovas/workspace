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

test('terminal polling retains a recorded selection without done as failed incomplete evidence', async () => {
  const { pollNativeInvocation } = await import('../scripts/native-bridge-evidence.mjs');
  let reads = 0, pauses = 0;
  const result = await pollNativeInvocation({ target: 'owned', attempts: 3,
    read: async () => { reads++; return { calls: [{ path: 'owned', returned: false }], opens: ['owned'],
      bridge: { started: 1, stopped: 1, active: 0, unknown: false } }; },
    pause: async () => { pauses++; } });
  assert.equal(reads, 3); assert.equal(pauses, 3);
  assert.equal(result.completion, 'exhausted');
  assert.equal(result.selectionCount, 1); assert.equal(result.returnedCount, 0);
  assert.equal(result.exactTarget, true); assert.equal(result.response, 'incomplete');
  assert.equal(result.bridgeCleanup.status, 'passed');
  assert.equal(JSON.stringify(result).includes('owned'), false);
});

for (const [name, calls, completion, response] of [
  ['absent', [], 'exhausted', 'absent'],
  ['completed', [{ path: 'owned', returned: true }], 'observed', 'completed'],
  ['duplicate', [{ path: 'owned', returned: false }, { path: 'owned', returned: false }], 'observed', 'duplicate'],
  ['wrong target', [{ path: 'private-other', returned: true }], 'observed', 'completed'],
]) {
  test(`polling distinguishes ${name} without dispatch or leaking paths`, async () => {
    const { pollNativeInvocation } = await import('../scripts/native-bridge-evidence.mjs');
    let reads = 0;
    const result = await pollNativeInvocation({ target: 'owned', attempts: 2, pause: async () => {},
      read: async () => { reads++; return { calls, opens: [], private: 'secret' }; } });
    assert.equal(result.completion, completion); assert.equal(result.response, response);
    assert.equal(result.selectionCount, calls.length);
    assert.equal(result.exactTarget, name === 'completed');
    assert.equal(reads, name === 'absent' ? 2 : 1);
    assert.equal(/owned|private|secret/.test(JSON.stringify(result)), false);
  });
}

test('unavailable reads retain prior finite counts but never imply completion', async () => {
  const { pollNativeInvocation } = await import('../scripts/native-bridge-evidence.mjs');
  for (const next of [() => { throw new Error('private path'); }, () => null,
    () => ({ calls: [{ path: 'owned', returned: 'true' }], opens: [] })]) {
    let reads = 0;
    const result = await pollNativeInvocation({ target: 'owned', attempts: 2, pause: async () => {},
      read: async () => ++reads === 1 ? { calls: [{ path: 'owned', returned: false }], opens: ['owned'] } : next() });
    assert.equal(result.completion, 'unavailable'); assert.equal(result.readStatus, 'unavailable');
    assert.equal(result.selectionCount, 1); assert.equal(result.returnedCount, 0);
    assert.equal(result.response, 'unavailable');
    assert.equal(JSON.stringify(result).includes('private'), false);
  }
});

test('deadline retains last sample and prevents a late read from continuing the loop', async () => {
  const { pollNativeInvocation } = await import('../scripts/native-bridge-evidence.mjs');
  let reads = 0, release;
  const result = await pollNativeInvocation({ target: 'owned', attempts: 3, timeoutMs: 20, pause: async () => {},
    read: async () => ++reads === 1 ? { calls: [{ path: 'owned', returned: false }], opens: ['owned'] }
      : new Promise((done) => { release = done; }) });
  assert.equal(result.completion, 'deadline'); assert.equal(result.selectionCount, 1);
  assert.equal(result.returnedCount, 0); assert.equal(result.readStatus, 'unavailable');
  release({ calls: [{ path: 'owned', returned: true }], opens: ['owned'] });
  await new Promise((done) => setImmediate(done));
  assert.equal(reads, 2); assert.equal(result.returnedCount, 0);
});
