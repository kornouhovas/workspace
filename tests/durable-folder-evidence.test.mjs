import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { observeFolder, sameDurableFolder, validateEvidence } from '../src/service/folder-evidence.ts';

test('native evidence identifies a contained folder independently of device numbers and rejects links', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'workspace-evidence-')));
  try {
    const child = join(root, 'Project'); mkdirSync(child);
    const first = observeFolder(child, 'installation-test');
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(validateEvidence(first.evidence), true);
    assert.equal(sameDurableFolder(first.evidence, {...first.evidence}), true);
    assert.equal(sameDurableFolder(first.evidence, {...first.evidence, volume: 'another-volume'}), false);
    assert.equal(sameDurableFolder(first.evidence, {...first.evidence, scope: 'another-installation'}), false);
    assert.equal(validateEvidence({...first.evidence, version: 2}), false);
    assert.equal(validateEvidence({...first.evidence, fileId: '0'}), false);
    assert.equal(validateEvidence({...first.evidence, unexpected: true}), false);
    symlinkSync(child, join(root, 'Alias'));
    assert.equal(observeFolder(join(root, 'Alias'), 'installation-test').ok, false);
    assert.equal(observeFolder(join(root, 'Missing'), 'installation-test').reason, 'disconnected');
  } finally { rmSync(root, {recursive: true, force: true}); }
});
