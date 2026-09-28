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
    sidebarWidth: 320,
    sidebarCollapsed: false,
    split: false,
    splitRatio: 0.5,
    maximized: null,
    focused: "workspace",
    rightTabs: [],
    activeRightTab: "navigation",
    closedRightTabs: [],
  };
}
export function paneLayoutReducer(state, action) {
  switch (action.type) {
    case "rightToggle":
      return { ...state, rightVisible: !state.rightVisible };
    case "sidebarToggle":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "resizeRight":
      return { ...state, rightWidth: clamp(action.width, 280, 640, state.rightWidth) };
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
    case "rightOpen": {
      if (typeof action.id !== "string" || !action.id) return state;
      const tabs = state.rightTabs.includes(action.id)
        ? state.rightTabs
        : [...state.rightTabs, action.id];
      return {
        ...state,
        rightVisible: true,
        rightTabs: tabs,
        activeRightTab: action.id,
        focused: "right",
      };
    }
    case "rightSelect":
      return action.id === "navigation" || state.rightTabs.includes(action.id)
        ? { ...state, activeRightTab: action.id, focused: "right" }
        : state;
    case "rightClose": {
      const index = state.rightTabs.indexOf(action.id);
      if (index < 0) return state;
      const tabs = state.rightTabs.filter((id) => id !== action.id);
      return {
        ...state,
        rightTabs: tabs,
        activeRightTab:
          state.activeRightTab === action.id
            ? tabs[index - 1] || tabs[index] || "navigation"
            : state.activeRightTab,
        closedRightTabs:
          action.id === "launcher"
            ? state.closedRightTabs
            : [...state.closedRightTabs.filter((id) => id !== action.id), action.id].slice(-20),
      };
    }
    case "rightCloseOthers":
      return state.rightTabs.reduce(
        (next, id) =>
          id === action.id ? next : paneLayoutReducer(next, { type: "rightClose", id }),
        state,
      );
    case "rightCloseAfter": {
      const index = state.rightTabs.indexOf(action.id);
      return index < 0
        ? state
        : state.rightTabs
            .slice(index + 1)
            .reduce((next, id) => paneLayoutReducer(next, { type: "rightClose", id }), state);
    }
    case "rightReopen": {
      const id = state.closedRightTabs.at(-1);
      if (!id) return state;
      return {
        ...paneLayoutReducer(state, { type: "rightOpen", id }),
        closedRightTabs: state.closedRightTabs.slice(0, -1),
      };
    }
    case "rightReorder": {
      const ids = [...new Set(action.ids)].filter((id) => state.rightTabs.includes(id));
      return {
        ...state,
        rightTabs: [...ids, ...state.rightTabs.filter((id) => !ids.includes(id))],
      };
    }
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
          const ids = Array.isArray(value.rightTabs)
            ? [...new Set(value.rightTabs.filter((id) => typeof id === "string" && id))].slice(
                0,
                100,
              )
            : [];
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
              rightWidth: clamp(value.rightWidth, 280, 640, 560),
              sidebarWidth: clamp(value.sidebarWidth, 240, 460, 320),
              rightTabs: ids,
              activeRightTab: ids.includes(value.activeRightTab)
                ? value.activeRightTab
                : "navigation",
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
