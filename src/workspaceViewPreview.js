export function viewPreviewId(screen, viewId) {
  const previews = screen?.previewByView;
  return previews && Object.hasOwn(previews, viewId) ? previews[viewId] : null;
}
// IDs stay opaque; each Workspace screen owns its own saved-view selections.
export function rememberViewPreview(screen, viewId, projectId) {
  return { viewId: null, tabId: null, ...screen, ...(screen?.viewId === viewId ? { previewId: projectId } : {}), previewByView: { ...screen?.previewByView, [viewId]: projectId } };
}
export function pruneViewPreviews(screen, viewIds) {
  const valid = new Set(viewIds);
  return { viewId: null, tabId: null, ...screen, previewByView: Object.fromEntries(Object.entries(screen?.previewByView || {}).filter(([id]) => valid.has(id))) };
}
export function createPreviewRequestGuard() {
  let generation = 0;
  return { invalidate: () => ++generation, current: () => generation, accepts: token => token === generation };
}
export function isPreviewBackground(target) {
  if (!target?.closest) return false;
  const surface = target.closest('[data-workspace-preview-surface]');
  if (!surface) return false;
  if (target.closest('button, input, textarea, select, a, [role="button"], [role="menu"], [contenteditable="true"], header, [data-workspace-project-drag], [data-workspace-project-row], [data-table-section-header], [data-table-group-id]')) return false;
  return !target.closest('tr') || Boolean(target.closest('[data-table-group-gap]'));
}
// A click must finish the same ordinary background gesture. Scroll, drag,
// selection, context menu and menu-dismissal clicks cannot close a preview.
export function createPreviewBackgroundGesture() {
  let down = null;
  return {
    start(event) { down = event.button === 0 && !event.defaultPrevented && isPreviewBackground(event.target) ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null; },
    move(event) { if (down && (event.pointerId !== down.id || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4)) down = null; },
    cancel() { down = null; },
    finish(event, selection = '') { const previous = down; down = null; return !!previous && event.button === 0 && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !selection && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 4 && isPreviewBackground(event.target); },
  };
}


// A repeated identity still needs restoration after any explicit navigation
// request, even when intervening projections never reached a ready render.
export function createPreviewRestoreTracker() {
  let revision = 0;
  let handledRevision = -1;
  let handledIdentity = null;
  return {
    request() { return ++revision; },
    needsRestore(identity) { return identity !== handledIdentity || revision !== handledRevision; },
    markRestored(identity) { handledIdentity = identity; handledRevision = revision; },
  };
}

// Keep exit content for an explicit close within one saved view, but never
// lend the outgoing project's DOM to a different view while lookup is pending.
export function retainViewPreview(previous, identity, project, visible) {
  return !previous || previous.identity !== identity || visible
    ? { identity, project: visible ? project : undefined }
    : previous;
}
