import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reflectionPrototype, assertComparisonReachedRead } from '../scripts/diagnostics/windows-com-dispatch.mjs';

test('input rejection or navigation without a COM read cannot count as comparison execution', () => {
  // Exact finite shape from the first failed diagnostic: child stopped cleanly
  // after bootstrap, without opening or reading an Explorer view.
  assert.throws(() => assertComparisonReachedRead({ opens: 0, trace: [{ phase: 'assemblies' }, { phase: 'shell' }] }), /navigation/);
  assert.throws(() => assertComparisonReachedRead({ opens: 1, trace: [{ phase: 'open' }] }), /actual COM read/);
  assert.throws(() => assertComparisonReachedRead({ opens: 2, trace: [{ phase: 'enumeration' }] }), /navigation/);
  assertComparisonReachedRead({ opens: 1, trace: [{ phase: 'enumeration' }] });
});

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
