import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { collectQuitEvidence } from '../scripts/runtime-quit-evidence.mjs';

test('owned quit-phase stdout retains only finite sanitized fields and detaches on every stop', () => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.exitCode = null; child.signalCode = null;
  const capture = collectQuitEvidence(child);
  child.stdout.emit('data', 'unrelated private output\nWORKSPACE_QUIT_');
  child.stdout.emit('data', 'PHASE {"event":"before-quit","prevented":true}\n');
  child.stdout.emit('data', 'WORKSPACE_QUIT_PHASE {"event":"quit","prevented":false,"private":"hidden"}\n');
  child.stdout.emit('data', 'WORKSPACE_QUIT_PHASE {"event":"unknown","prevented":false}\n');
  assert.deepEqual(capture.record.phases, [{ event: 'before-quit', prevented: true }]);
  assert.equal(capture.record.parentExited, false);
  child.exitCode = 0; child.emit('exit', 0);
  const result = capture.stop(); assert.equal(result.parentExited, true); assert.equal(result.status, 'retained');
  assert.equal(child.stdout.listenerCount('data'), 0); assert.equal(child.listenerCount('exit'), 0);
  assert.equal(capture.stop(), result);
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('quit phase capture remains bounded and missing exit never becomes successful shutdown evidence', () => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.exitCode = null; child.signalCode = null;
  const capture = collectQuitEvidence(child);
  for (let i = 0; i < 20; i++) child.stdout.emit('data', 'WORKSPACE_QUIT_PHASE {"event":"will-quit","prevented":false}\n');
  child.stdout.emit('data', 'x'.repeat(9000));
  const result = capture.stop(); assert.equal(result.phases.length, 16); assert.equal(result.captureTruncated, true);
  assert.equal(result.parentExited, false); assert.equal(Object.hasOwn(result, 'passed'), false);
});
