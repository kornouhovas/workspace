import {
  moveWorkspacePane,
  workspacePane,
  listWorkspacePanes,
  insertWorkspacePane,
  removeWorkspacePane,
  mapWorkspacePane,
  resizeWorkspaceSplit,
  readWorkspaceSplitTree,
  MAX_WORKSPACE_PANES,
} from "./workspaceSplitTree.js";
// Renderer session chrome only: never contains project data or filesystem paths.
const key = "workspace.pane-layout.v1";
const clamp = (value, min, max, fallback) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function createPaneLayout() {
  return {
    tree: workspacePane(),
    rightVisible: false,
    rightWidth: 560,
    rightWidthManual: false,
    sidebarWidth: 320,
    sidebarCollapsed: false,
    split: false,
    splitRatio: 0.5,
    maximized: null,
    focused: "workspace",
  };
}
export function paneLayoutReducer(state, action) {
  switch (action.type) {
    case "previewProject":
      return { ...state, rightVisible: true, maximized: null, focused: "right" };
    case "selectView":
      return { ...state, rightVisible: false, maximized: null, focused: "workspace" };
    case "sidebarToggle":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "resizeRight":
      return { ...state, rightWidth: clamp(action.width, 280, 16384, state.rightWidth), rightWidthManual: true };
    case "resizeSidebar":
      return { ...state, sidebarWidth: clamp(action.width, 240, 460, state.sidebarWidth) };
    case "resizeSplit":
      return { ...state, splitRatio: clamp(action.ratio, 0.2, 0.8, state.splitRatio) };
    case "focus":
      return { ...state, focused: action.pane };
    case "split": {
      if (!action.tabId)
        return { ...state, split: true, rightVisible: true, maximized: null, focused: "project" };
      const panes = listWorkspacePanes(state.tree);
      const existing = panes.find((p) => p.tabId === action.tabId);
      if (existing) return { ...state, focused: existing.paneId, maximized: null };
      const target = panes.some((p) => p.paneId === action.target)
        ? action.target
        : panes.some((p) => p.paneId === state.focused)
          ? state.focused
          : panes[0].paneId;
      if (panes.length >= MAX_WORKSPACE_PANES)
        return {
          ...state,
          tree: mapWorkspacePane(state.tree, target, { tabId: action.tabId }),
          focused: target,
        };
      const pane = { type: "pane", paneId: action.paneId, tabId: action.tabId };
      return {
        ...state,
        tree: insertWorkspacePane(state.tree, target, action.side || "right", pane),
        split: true,
        rightVisible: true,
        maximized: null,
        focused: pane.paneId,
      };
    }
    case "dropPane":
      return {
        ...state,
        tree: moveWorkspacePane(state.tree, action.source, action.target, action.side),
        focused: action.source,
        maximized: null,
      };
    case "closePane": {
      const panes = listWorkspacePanes(state.tree);
      if (panes.length === 1)
        return panes[0].paneId === action.paneId
          ? { ...state, tree: workspacePane(), split: false, maximized: null, focused: "workspace" }
          : state;
      const index = panes.findIndex((p) => p.paneId === action.paneId);
      if (index < 0) return state;
      const tree = removeWorkspacePane(state.tree, action.paneId) || workspacePane();
      const remaining = listWorkspacePanes(tree);
      return {
        ...state,
        tree,
        split: remaining.length > 1,
        maximized: null,
        focused:
          state.focused === action.paneId
            ? remaining[Math.min(index, remaining.length - 1)].paneId
            : state.focused,
      };
    }
    case "resizeTree":
      return {
        ...state,
        tree: resizeWorkspaceSplit(state.tree, action.path, action.index, action.fraction),
      };
    case "replacePane":
      return {
        ...state,
        tree: mapWorkspacePane(state.tree, action.paneId, { tabId: action.tabId }),
        focused: action.paneId,
      };
    case "showWorkspace": {
      const panes = listWorkspacePanes(state.tree);
      const existing = panes.find((p) => p.tabId === null);
      if (existing) return { ...state, focused: existing.paneId, maximized: null };
      const target =
        panes.find((p) => p.paneId === "workspace") ||
        panes.find((p) => p.paneId === state.focused) ||
        panes[0];
      return {
        ...state,
        tree: mapWorkspacePane(state.tree, target.paneId, { paneId: "workspace", tabId: null }),
        focused: "workspace",
        maximized: null,
      };
    }
    case "closeSplit":
      return {
        ...state,
        tree: workspacePane(),
        rightVisible: false,
        split: false,
        maximized: null,
        focused: "workspace",
      };
    case "maximize":
      return {
        ...state,
        maximized: state.maximized === action.pane ? null : action.pane,
        focused: action.pane,
      };
    default:
      return state;
  }
}
export function readPaneLayouts(storage) {
  try {
    const raw = JSON.parse(storage.getItem(key) || "null");
    if (!raw || raw.version !== 1 || !raw.layouts || typeof raw.layouts !== "object") return {};
    return Object.fromEntries(
      Object.entries(raw.layouts)
        .filter(([, value]) => value && typeof value === "object")
        .map(([id, value]) => {
          const base = createPaneLayout();
          const tree = readWorkspaceSplitTree(value.tree) || workspacePane();
          const panes = listWorkspacePanes(tree);
          const surviving = (id) =>
            panes.some((p) => p.paneId === id) || (id === "right" && value.rightVisible === true);
          return [
            id,
            {
              ...base,
              tree,
              focused: surviving(value.focused) ? value.focused : panes[0].paneId,
              maximized: surviving(value.maximized) ? value.maximized : null,
              rightVisible: value.rightVisible === true,
              sidebarCollapsed: value.sidebarCollapsed === true,
              split: panes.length > 1,
              splitRatio: clamp(value.splitRatio, 0.2, 0.8, 0.5),
              rightWidth: clamp(value.rightWidth, 280, 16384, 560),
              rightWidthManual: value.rightWidthManual === true || (Number.isFinite(value.rightWidth) && value.rightWidth !== 560),
              sidebarWidth: clamp(value.sidebarWidth, 240, 460, 320),

            },
          ];
        }),
    );
  } catch {
    return {};
  }
}
export function writePaneLayouts(storage, layouts) {
  try {
    storage.setItem(key, JSON.stringify({ version: 1, layouts }));
    return true;
  } catch {
    return false;
  }
}

// Only sidebar width is shared. Legacy per-workspace layouts remain untouched.
const sidebarWidthKey = "workspace.sidebar-width.v1";
export function readSidebarWidth(storage, layouts = {}) {
  try {
    const saved = JSON.parse(storage.getItem(sidebarWidthKey) || "null");
    if (Number.isFinite(saved)) return clamp(saved, 240, 460, 320);
  } catch { /* Fall back to a legacy width if storage is unavailable. */ }
  return clamp(Object.values(layouts)[0]?.sidebarWidth, 240, 460, 320);
}
export function writeSidebarWidth(storage, width) {
  try { storage.setItem(sidebarWidthKey, JSON.stringify(clamp(width, 240, 460, 320))); return true; }
  catch { return false; }
}
