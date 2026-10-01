// Opaque project identities share one rank across all occurrences in a Table view.
export function completeTableRowOrder(saved = [], projectIds = []) {
  return [...new Set([...saved, ...projectIds])];
}
export function reorderTableRows(order, visibleIds, projectId, targetId, after = false) {
  const visible = [...new Set(visibleIds)];
  if (projectId === targetId || !visible.includes(projectId) || !visible.includes(targetId)) return null;
  const remaining = visible.filter(id => id !== projectId);
  remaining.splice(remaining.indexOf(targetId) + (after ? 1 : 0), 0, projectId);
  if (remaining.every((id, index) => id === visible[index])) return null;
  const visibleSet = new Set(visible);
  let index = 0;
  return completeTableRowOrder(order, visible).map(id => visibleSet.has(id) ? remaining[index++] : id);
}
