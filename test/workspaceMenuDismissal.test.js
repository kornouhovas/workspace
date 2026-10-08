import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as ts from 'typescript';

// Node has EventTarget but no DOM. Supply only the DOM target boundary used by
// the production guard; dispatch/cancellation and the guard itself are real.
class MenuElement extends EventTarget {
  constructor(selectors = [], parent = null) { super(); this.selectors = selectors; this.parent = parent; }
  closest(selector) {
    const alternatives = selector.split(',').map(value => value.trim());
    return alternatives.some(value => this.selectors.includes(value)) ? this : this.parent?.closest(selector) ?? null;
  }
}
async function guard(t) {
  const document = new class extends EventTarget {
    // Node's boolean capture removal differs from DOM; this fixture has only
    // document capture listeners, so normalize their matching options.
    addEventListener(type, listener) { super.addEventListener(type, listener); }
    removeEventListener(type, listener) { super.removeEventListener(type, listener); }
  }();
  t.mock.method(globalThis, 'setTimeout', () => 1);
  const previous = { Element: globalThis.Element, document: globalThis.document, window: globalThis.window };
  Object.assign(globalThis, { Element: MenuElement, document, window: { setTimeout, clearTimeout() {} } });
  t.after(() => Object.assign(globalThis, previous));
  const source = await readFile(new URL('../src/components/workspace/menu-dismissal.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return { document, ...(await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)) };
}

test('dropdown capture allows Group by and Sort portal item pointer events to reach selection', async t => {
  const { blockOutsideWorkspaceDropdownPointerDown } = await guard(t);
  const portal = new MenuElement(['[data-workspace-group-menu="true"]']);
  for (const value of ['property:name', 'property:status', 'descending']) {
    let open = true;
    let selected = null;
    const item = new MenuElement([], portal);
    item.addEventListener('pointerdown', event => blockOutsideWorkspaceDropdownPointerDown(event, () => { open = false; }));
    // At the input boundary the consumer can select only if capture kept its
    // mounted parent and did not cancel the pointer gesture.
    item.addEventListener('pointerdown', event => { if (open && !event.defaultPrevented) selected = value; });
    item.dispatchEvent(new Event('pointerdown', { cancelable: true, bubbles: true }));
    assert.equal(selected, value, 'the nested option must receive the pointer gesture');
    assert.equal(open, true, 'selection must retain the parent Group context');
  }
});

test('outside pointer still dismisses dropdown and blocks the next underlying click', async t => {
  const { document, blockOutsideWorkspaceDropdownPointerDown } = await guard(t);
  let open = true;
  const outside = new MenuElement();
  outside.addEventListener('pointerdown', event => blockOutsideWorkspaceDropdownPointerDown(event, () => { open = false; }));
  assert.equal(outside.dispatchEvent(new Event('pointerdown', { cancelable: true })), false);
  assert.equal(open, false);
  assert.equal(document.dispatchEvent(new Event('click', { cancelable: true })), false);
  assert.equal(document.dispatchEvent(new Event('click', { cancelable: true })), true, 'only first click is consumed');
});

test('dropdown content and expanded trigger retain their existing pointer behavior', async t => {
  const { blockOutsideWorkspaceDropdownPointerDown } = await guard(t);
  for (const selector of ['.workspace-menu-surface', '[data-slot="dropdown-menu-sub-content"]', '[data-slot="dropdown-menu-trigger"][aria-expanded="true"]']) {
    const target = new MenuElement([selector]);
    let dismissed = false;
    target.addEventListener('pointerdown', event => blockOutsideWorkspaceDropdownPointerDown(event, () => { dismissed = true; }));
    assert.equal(target.dispatchEvent(new Event('pointerdown', { cancelable: true })), true);
    assert.equal(dismissed, false);
  }
});
