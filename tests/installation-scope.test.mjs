import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installationScope } from '../src/service/installation-scope.ts';
test('installation authority survives restart independently of database and corrupt anchors acquire a new scope', () => {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-scope-'));
  try {
    const first = installationScope(directory);
    assert.equal(installationScope(directory), first);
    writeFileSync(join(directory, 'installation-scope.json'), 'corrupt');
    const replaced = installationScope(directory);
    assert.notEqual(replaced, first);
    assert.equal(installationScope(directory), replaced);
    writeFileSync(join(directory, 'installation-scope.json'), JSON.stringify({version:1,id:'-'.repeat(36)}));
    assert.notEqual(installationScope(directory), '-'.repeat(36));
  } finally { rmSync(directory, {recursive:true,force:true}); }
});
