import test from 'node:test';
import assert from 'node:assert/strict';
import { viewPreviewId, rememberViewPreview, pruneViewPreviews, createPreviewRequestGuard, createPreviewBackgroundGesture, isPreviewBackground } from '../src/workspaceViewPreview.js';

test('saved view memory isolates same-type views and workspaces; close survives return and deletion prunes only removed view', () => {
  let one = rememberViewPreview(undefined, 'opaque board one', 'A');
  one = rememberViewPreview(one, 'opaque board two', 'B');
  const two = rememberViewPreview(undefined, 'opaque board one', 'C');
  assert.equal(one.previewByView['opaque board one'], 'A');
  assert.equal(one.previewByView['opaque board two'], 'B');
  assert.equal(two.previewByView['opaque board one'], 'C');
  one = rememberViewPreview(one, 'opaque board one', null);
  assert.equal(one.previewByView['opaque board one'], null);
  assert.deepEqual(pruneViewPreviews(one, ['opaque board two']).previewByView, { 'opaque board two': 'B' });
});

test('late restore/file tree responses cannot update a newer selection or explicitly closed preview', async () => {
  const guard = createPreviewRequestGuard();
  const applied = [];
  let resolveA;
  const requestA = new Promise(resolve => { resolveA = resolve; });
  const tokenA = guard.invalidate();
  const pending = requestA.then(project => { if (guard.accepts(tokenA)) applied.push(project); });
  const tokenB = guard.invalidate();
  if (guard.accepts(tokenB)) applied.push('B');
  resolveA('A'); await pending;
  assert.deepEqual(applied, ['B']);
  const treeToken = guard.current();
  guard.invalidate(); // explicit close
  assert.equal(guard.accepts(treeToken), false);
});

const target = (blocked = false, row = false, gap = false) => ({ closest(selector) {
  if (selector === '[data-workspace-preview-surface]') return {};
  if (selector === 'tr') return row ? {} : null;
  if (selector === '[data-table-group-gap]') return gap ? {} : null;
  return blocked ? {} : null;
} });
const event = (overrides = {}) => ({ target: target(), button: 0, defaultPrevented: false, pointerId: 1, clientX: 20, clientY: 20, ...overrides });

test('only free background and table section gaps qualify; editable row blanks and controls stay protected', () => {
  assert.equal(isPreviewBackground(target()), true);
  assert.equal(isPreviewBackground(target(false, true, true)), true);
  assert.equal(isPreviewBackground(target(false, true)), false);
  assert.equal(isPreviewBackground(target(true)), false);
  assert.equal(isPreviewBackground({ closest: () => null }), false);
});

test('background close needs completed primary click; drag, scroll, selection, menu dismissal and context-click are ignored', () => {
  const gesture = createPreviewBackgroundGesture();
  gesture.start(event()); assert.equal(gesture.finish(event()), true);
  gesture.start(event({target:target(true)})); assert.equal(gesture.finish(event()), false);
  gesture.start(event()); gesture.move(event({ clientX: 28 })); assert.equal(gesture.finish(event()), false);
  gesture.start(event()); gesture.cancel(); assert.equal(gesture.finish(event()), false);
  gesture.start(event()); assert.equal(gesture.finish(event(), 'selected text'), false);
  gesture.start(event()); assert.equal(gesture.finish(event({defaultPrevented:true})), false);
  gesture.start(event({button:2})); assert.equal(gesture.finish(event()), false);
  gesture.start(event()); assert.equal(gesture.finish(event({ctrlKey:true})), false);
});

test('text-editor dismissal consumes exactly the next click without cancelling blur-save pointerdown', async t => {
  const { readFile } = await import('node:fs/promises');
  const ts = await import('typescript');
  const source = await readFile(new URL('../src/components/workspace/menu-dismissal.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const document = new class extends EventTarget {
    addEventListener(type, listener) { super.addEventListener(type, listener); }
    removeEventListener(type, listener) { super.removeEventListener(type, listener); }
  }();
  const previous = { document: globalThis.document, window: globalThis.window };
  Object.assign(globalThis, { document, window: { setTimeout: () => 1, clearTimeout() {} } });
  t.after(() => Object.assign(globalThis, previous));
  const { blockNextWorkspaceMenuClick } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  document.addEventListener('pointerdown', blockNextWorkspaceMenuClick);
  assert.equal(document.dispatchEvent(new Event('pointerdown', { cancelable: true })), true, 'focus and blur-save retain normal pointerdown');
  assert.equal(document.dispatchEvent(new Event('click', { cancelable: true })), false, 'outside-dismissal click cannot reach preview');
  assert.equal(document.dispatchEvent(new Event('click', { cancelable: true })), true, 'next ordinary background click may close preview');
});


test('removed saved view cannot lend its legacy preview to a new fallback view at startup', () => {
  const legacyMigrated = { viewId: 'deleted', tabId: null, previewId: 'A', previewByView: { deleted: 'A', remaining: 'B', closed: null } };
  const screen = pruneViewPreviews(legacyMigrated, ['remaining', 'closed', 'new']);
  assert.equal(viewPreviewId(screen, 'new'), null);
  assert.equal(viewPreviewId(screen, 'deleted'), null);
  assert.equal(viewPreviewId(screen, 'closed'), null);
  assert.equal(viewPreviewId(screen, 'remaining'), 'B');
});


test('opaque saved-view IDs never read inherited keys and prototype-like IDs retain their own selections', () => {
  let screen = rememberViewPreview(undefined, 'ordinary', 'A');
  assert.equal(viewPreviewId(screen, 'toString'), null);
  assert.equal(viewPreviewId(screen, 'constructor'), null);
  assert.equal(viewPreviewId(screen, '__proto__'), null);
  screen = rememberViewPreview(screen, '__proto__', 'B');
  screen = rememberViewPreview(screen, 'constructor', 'C');
  assert.equal(viewPreviewId(screen, '__proto__'), 'B');
  assert.equal(viewPreviewId(screen, 'constructor'), 'C');
  assert.equal(viewPreviewId(screen, 'ordinary'), 'A');
  assert.deepEqual(Object.keys(pruneViewPreviews(screen, ['__proto__']).previewByView), ['__proto__']);
});

test('exit lifecycle retains an explicitly closed card only inside its own saved view', async () => {
  const { retainViewPreview } = await import('../src/workspaceViewPreview.js');
  let retained = retainViewPreview(undefined, 'workspace-one/board', { id: 'Alpha', content: 'Alpha contents' }, true);
  retained = retainViewPreview(retained, 'workspace-one/board', undefined, false);
  assert.equal(retained.project.id, 'Alpha', 'explicit close keeps outgoing content during width release');
  retained = retainViewPreview(retained, 'workspace-one/table', undefined, false);
  assert.equal(retained.project, undefined, 'delayed Table lookup cannot expose outgoing Board Alpha');
  retained = retainViewPreview(retained, 'workspace-one/table', { id: 'Beta' }, true);
  assert.equal(retained.project.id, 'Beta');
  retained = retainViewPreview(retained, 'workspace-two/table', undefined, false);
  assert.equal(retained.project, undefined, 'same view ID in another Workspace cannot inherit content');
});

test('rapid V1→V2→V1 before intermediate ready render still requests restoration of V1', async () => {
  const { createPreviewRestoreTracker } = await import('../src/workspaceViewPreview.js');
  const restore = createPreviewRestoreTracker();
  restore.markRestored('V1');
  assert.equal(restore.needsRestore('V1'), false);
  restore.request(); // V2 selected, its projection is pending
  restore.request(); // V1 selected before V2 restoration effect consumed
  assert.equal(restore.needsRestore('V1'), true, 'returning identity still needs its preview restored');
  restore.markRestored('V1');
  assert.equal(restore.needsRestore('V1'), false, 'ordinary file-tree/property renders do not restore again');
  restore.request(); // explicitly selecting the same active view after clearing preview
  assert.equal(restore.needsRestore('V1'), true);
});

test('unavailable cleanup survives session persistence without needing another selected-project render', async () => {
  const { writeProjectSession, readProjectSession } = await import('../src/workspaceProjectSession.js');
  let value;
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const screen = rememberViewPreview({ viewId: 'V1', tabId: null, previewId: 'missing', previewByView: { V1: 'missing', V2: 'B' } }, 'V1', null);
  writeProjectSession(storage, {}, { workspace: screen });
  const restored = readProjectSession(storage).screens.workspace;
  assert.equal(restored.previewId, null);
  assert.equal(viewPreviewId(restored, 'V1'), null);
  assert.equal(viewPreviewId(restored, 'V2'), 'B');
});

test('inactive deletion keeps newer view selections and lets current delayed restore complete', async () => {
  const guard = createPreviewRequestGuard();
  const token = guard.invalidate();
  let screen = rememberViewPreview(undefined, 'current', 'A');
  screen = rememberViewPreview(screen, 'deleted', 'B');
  screen = rememberViewPreview(screen, 'created-during-request', 'C');
  // Prune by the deleted opaque ID, rather than a stale listViews snapshot.
  screen = pruneViewPreviews(screen, Object.keys(screen.previewByView).filter(id => id !== 'deleted'));
  assert.equal(guard.accepts(token), true);
  assert.equal(viewPreviewId(screen, 'current'), 'A');
  assert.equal(viewPreviewId(screen, 'created-during-request'), 'C');
  assert.equal(viewPreviewId(screen, 'deleted'), null);
});
