/* global HTMLElement, document, MutationObserver */
// Serialized only into a disposable diagnostic page. Never store authored text.
export function installArchiveEntryTrace() {
  if (globalThis.__workspaceArchiveEntryTrace) return;
  const records = [];
  globalThis.__workspaceArchiveEntryTrace = records;
  const state = () => ({
    activeTag: document.activeElement?.tagName,
    activeClass: document.activeElement?.className,
    fieldsBusy: document.querySelector('.project-detail-fields')?.getAttribute('aria-busy'),
    editors: [...document.querySelectorAll('.project-area textarea')].map(node => ({ disabled: node.disabled, length: node.value.length, focused: node === document.activeElement })),
  });
  const record = (type, target, extra = {}) => {
    records.push({ type, at: performance.now(), tag: target?.tagName, className: target?.className, ...state(), ...extra });
    if (records.length > 128) records.shift();
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
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
}
