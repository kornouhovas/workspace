/* global HTMLElement, document, MutationObserver */
// Serialized only into a disposable diagnostic page. Never store authored text.
export function installArchiveEntryTrace() {
  if (globalThis.__workspaceArchiveEntryTrace) return;
  const records = [];
  globalThis.__workspaceArchiveEntryTrace = records;
  const editorRecords = [];
  globalThis.__workspaceArchiveEditorTrace = editorRecords;
  let lastEditorAt = -Infinity;
  const state = () => ({
    activeTag: document.activeElement?.tagName,
    activeClass: document.activeElement?.className,
    fieldsBusy: document.querySelector('.project-detail-fields')?.getAttribute('aria-busy'),
    editors: [...document.querySelectorAll('.project-area textarea')].map(node => ({ disabled: node.disabled, length: node.value.length, focused: node === document.activeElement })),
  });
  const record = (type, target, extra = {}) => {
    const current = state(), at = performance.now();
    const event = { type, at, wallTime: Date.now(), tag: target?.tagName, className: target?.className, disabled: target?.disabled, ...current, ...extra };
    records.push(event);
    if (records.length > 128) records.shift();
    if (current.editors.length || target?.classList?.contains('text-value-button')) lastEditorAt = at;
    if (at - lastEditorAt < 250) {
      editorRecords.push(event);
      if (editorRecords.length > 128) editorRecords.shift();
    }
  };
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...args) {
    record('focus-call', this, { stack: new Error().stack?.split('\n').slice(1, 6) });
    return Reflect.apply(focus, this, args);
  };
  for (const type of ['focusin', 'focusout', 'input', 'keydown', 'click']) document.addEventListener(type, event => {
    record(type, event.target, type === 'keydown' ? { key: ['Enter','Escape','Tab'].includes(event.key) ? event.key : 'other' } : {});
  }, true);
  let previous = '';
  const observer = new MutationObserver(() => {
    const next = JSON.stringify(state());
    if (next !== previous) { previous = next; record('state', null); }
  });
  // Init scripts run before documentElement exists; Document is already a Node.
  observer.observe(document, { subtree: true, childList: true, attributes: true });
}


// Main-process observation only. Preserve the exact handler reply/Promise and
// error; lengths and timing distinguish stale submissions without storing text.
export function installArchiveCommandTrace({ ipcMain }) {
  const original = ipcMain._invokeHandlers?.get('workspace:command');
  if (typeof original !== 'function') throw new Error('Diagnostic workspace handler unavailable');
  const records = [];
  globalThis.__workspaceArchiveCommandTrace = records;
  ipcMain.removeHandler('workspace:command');
  ipcMain.handle('workspace:command', (event, input) => {
    if (input?.type !== 'workspace.setTextValue') return original(event, input);
    const record = { type: input.type, started: Date.now(), length: input.value === null ? null : input.value?.length };
    records.push(record);
    if (records.length > 64) records.shift();
    const completed = value => { record.finished = Date.now(); record.ok = value?.ok; };
    const failed = () => { record.finished = Date.now(); record.failed = true; };
    try {
      const result = original(event, input);
      if (result && typeof result.then === 'function') void result.then(completed, failed);
      else completed(result);
      return result;
    } catch (error) { failed(); throw error; }
  });
}
