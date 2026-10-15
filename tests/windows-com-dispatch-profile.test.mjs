import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reflectionPrototype } from '../scripts/diagnostics/windows-com-dispatch.mjs';

test('isolated reflection prototype retains guards, bounds and the sole selection', async () => {
  const binding = await readFile(new URL('../src/desktop/native/windows-binding.ps1', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('../src/desktop/native/windows-project-reveal.ps1', import.meta.url), 'utf8');
  const changed = reflectionPrototype(binding);
  assert.match(changed, /InvokeMember\(\$name, \[Reflection.BindingFlags\]::GetProperty/);
  assert.match(changed, /Invoke-WorkspaceComMethod \$windows 'Item' @\(\$i\)/);
  assert.doesNotMatch(changed, /\$windows\.Count|\$candidate\.Document|\$document\.Folder|\$window\.(Document|HWND|Busy|ReadyState)|\$item\.Path/);
  for (const stage of ['ambiguous_parent', 'wrong_window', 'view_changed', 'property_unavailable', 'target_absent', 'parent_absent']) {
    assert.equal(changed.split(stage).length, binding.split(stage).length, stage);
  }
  const dispatch = reflectionPrototype(bridge);
  assert.equal((dispatch.match(/\$anchor.document.SelectItem\(\$anchor.item, 5\)/g) ?? []).length, 1);
  assert.doesNotMatch(dispatch, /Invoke-WorkspaceComMethod.*'SelectItem'/);
  assert.doesNotMatch(dispatch, /\$value.GetType\(\)/);
  assert.equal((dispatch.match(/10000/g) ?? []).length, (bridge.match(/10000/g) ?? []).length);
  assert.equal((dispatch.match(/\$shell.Open\(\$parent\)/g) ?? []).length, 1);
  assert.match(dispatch, /Read-WorkspaceRevealPermit/);
});
