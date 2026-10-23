import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { runtimeSmokeLaunch } from '../scripts/runtime-executable.mjs';

// Actual Electron installation lookup belongs to platform preparation, not common.
test('development journeys use the installed Electron with the source entry argument', () => {
  const root = join('fixture', 'workspace');
  const development = runtimeSmokeLaunch(root, 'dev');
  assert.deepEqual(development.args, [root]);
  assert.ok(/electron/i.test(development.executablePath));
});
