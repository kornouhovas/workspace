// Capture the drag's Escape ownership before its cancellation removes DOM
// markers. Propagation continues so document/window drag handlers still cancel.
export function consumeDragEscape(event, dragging) {
  if (event.key !== "Escape" || !dragging) return false;
  event.preventDefault();
  return true;
}
// One focused presentation host owns Escape; editors/overlays retain it.
export function shouldClosePaneOnEscape({ key, defaultPrevented, editing, active, dragging = false }) {
  return key === "Escape" && !defaultPrevented && !editing && !dragging && active;
}
export function focusedPaneCloseCommand(layout, projectTabId = null, projectExpanded = false) {
  if (layout.focused === "right")
    return projectExpanded && projectTabId
      ? { kind: "projectTab", id: projectTabId }
      : layout.rightVisible ? { kind: "preview" } : null;
  const leaves = [];
  function walk(node) {
    if (node.type === "pane") leaves.push(node);
    else node.children.forEach(walk);
  }
  walk(layout.tree);
  const pane = leaves.find((p) => p.paneId === layout.focused);
  if (!pane) return null;
  if (pane.tabId) return { kind: "projectTab", id: pane.tabId };
  if (leaves.length > 1) return { kind: "pane", id: pane.paneId };
  return projectExpanded && projectTabId ? { kind: "projectTab", id: projectTabId } : null;
}
