// Tab identity is separate from project identity: multiple tabs can show one project.
export function projectTabsReducer(state, action) {
  const tabs = state[action.workspaceId] || [];
  if (action.type === "reorder") {
    const byId = new Map(tabs.map(tab => [tab.tabId, tab]));
    const ids = [...new Set(action.tabIds)].filter(id => byId.has(id));
    const seen = new Set(ids);
    return { ...state, [action.workspaceId]: [...ids.map(id => byId.get(id)), ...tabs.filter(tab => !seen.has(tab.tabId))] };
  }
  if (action.type === "remove") {
    return { ...state, [action.workspaceId]: tabs.filter(tab => tab.tabId !== action.tabId) };
  }
  if (action.type === "valueSaved") {
    return { ...state, [action.workspaceId]: tabs.map(tab => tab.id === action.projectId
      ? { ...tab, propertyValues: { ...tab.propertyValues, [action.propertyId]: action.value } }
      : tab) };
  }
  if (action.type === "expand") {
    if (tabs.some(tab => tab.tabId === action.tabId)) return state;
    const sourceIndex = tabs.findIndex(tab => tab.tabId === action.afterTabId);
    const insertionIndex = sourceIndex < 0 ? tabs.length : sourceIndex + 1;
    return { ...state, [action.workspaceId]: [
      ...tabs.slice(0, insertionIndex),
      { ...action.project, tabId: action.tabId },
      ...tabs.slice(insertionIndex),
    ] };
  }
  if (!tabs.some(tab => tab.id === action.project.id)) return state;
  return { ...state, [action.workspaceId]: tabs.map(tab => tab.id === action.project.id
    ? { ...action.project, tabId: tab.tabId } : tab) };
}
