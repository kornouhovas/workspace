import { projectTabsReducer, projectTabCloseSelection } from "./workspaceProjectTabs.js";
import { createPaneLayout, paneLayoutReducer } from "./workspacePaneLayout.js";
import { listWorkspacePanes } from "./workspaceSplitTree.js";

const own = (record, key, fallback) => Object.hasOwn(record, key) ? record[key] : fallback;

// Renderer session transitions only. Storage, service requests and DOM effects
// are adapters; this owner can also run without React or Electron.
export function createWorkspaceSession({ tabs = {}, layouts = {}, sidebarWidth = 320 } = {}) {
  let snapshot = {
    tabs,
    layouts,
    sidebarWidth,
    selectedProject: null,
    activeProjectTabId: null,
    projectTabSelected: false,
    activeSurface: "workspace",
    closedProjectTabs: {},
  };
  const listeners = new Set();
  function pane(workspaceId) {
    return own(snapshot.layouts, workspaceId, createPaneLayout());
  }
  function updateTabs(action, state = snapshot.tabs) {
    const initialized = Object.hasOwn(state, action.workspaceId) ? state : { ...state, [action.workspaceId]: [] };
    return projectTabsReducer(initialized, action);
  }
  function setPane(workspaceId, action) {
    return { ...snapshot.layouts, [workspaceId]: paneLayoutReducer(pane(workspaceId), action) };
  }
  function withoutTabPanes(layout, tabIds) {
    for (const p of listWorkspacePanes(layout.tree))
      if (p.tabId && tabIds.includes(p.tabId))
        layout = paneLayoutReducer(layout, { type: "closePane", paneId: p.paneId });
    return layout;
  }
  for (const [workspaceId, layout] of Object.entries(snapshot.layouts)) {
    const valid = new Set(own(snapshot.tabs, workspaceId, []).map(tab => tab.tabId));
    const missing = listWorkspacePanes(layout.tree).filter(p => p.tabId && !valid.has(p.tabId)).map(p => p.tabId);
    if (missing.length)
      snapshot = { ...snapshot, layouts: { ...snapshot.layouts, [workspaceId]: withoutTabPanes(layout, missing) } };
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(command) {
      const workspaceId = command.workspaceId;
      const tabs = own(snapshot.tabs, workspaceId, []);
      let result = {};
      switch (command.type) {
        case "restoreScreen":
          snapshot = {
            ...snapshot,
            selectedProject: command.project,
            activeProjectTabId: command.project ? command.tabId || null : null,
            projectTabSelected: command.fullScreen === true,
            ...(!command.tabId ? { layouts: setPane(workspaceId, { type: command.project ? "previewProject" : "selectView" }) } : {}),
          };
          break;
        // Transitional adapters for restoration/data refresh, moved in issue #3.
        case "selection": {
          const selection = {};
          for (const key of ["selectedProject", "activeProjectTabId", "projectTabSelected"])
            if (Object.hasOwn(command, key))
              selection[key] = typeof command[key] === "function" ? command[key](snapshot[key]) : command[key];
          snapshot = { ...snapshot, ...selection };
          break;
        }
        case "tabs":
          snapshot = { ...snapshot, tabs: updateTabs(command.action) };
          break;
        case "surface":
          snapshot = { ...snapshot, activeSurface: command.surface };
          break;
        case "openProject":
          snapshot = {
            ...snapshot,
            selectedProject: command.project,
            activeProjectTabId: command.tabId || null,
            projectTabSelected: command.fullScreen === true,
            ...(!command.tabId ? { layouts: setPane(workspaceId, { type: "previewProject" }) } : {}),
          };
          result = { projectToLoad: command.project };
          break;
        case "closePreview":
          snapshot = {
            ...snapshot,
            selectedProject: null,
            activeProjectTabId: null,
            layouts: setPane(workspaceId, { type: "selectView" }),
          };
          break;
        case "restoreProject": {
          const project = tabs.find(tab => tab.tabId === command.tabId);
          if (!project) return { snapshot };
          snapshot = {
            ...snapshot,
            tabs: updateTabs({ type: "remove", workspaceId, tabId: command.tabId }),
            layouts: { ...snapshot.layouts, [workspaceId]: paneLayoutReducer(withoutTabPanes(pane(workspaceId), [command.tabId]), { type: "previewProject" }) },
            selectedProject: project,
            activeProjectTabId: null,
          };
          result = { projectToLoad: project };
          break;
        }
        case "showSurface":
          snapshot = { ...snapshot, activeSurface: command.surface, layouts: setPane(workspaceId, { type: "showWorkspace" }) };
          break;
        case "pane":
          snapshot = {
            ...snapshot,
            ...(command.action.type === "resizeSidebar"
              ? { sidebarWidth: Math.min(460, Math.max(240, command.action.width)) }
              : { layouts: setPane(workspaceId, command.action) }),
          };
          break;
        case "expandProject": {
          const existing = !command.afterTabId && tabs.find(tab => tab.id === command.project.id);
          const tabId = existing?.tabId || command.tabId;
          snapshot = {
            ...snapshot,
            tabs: updateTabs({ ...command, type: "expand", tabId }),
            selectedProject: command.project,
            activeProjectTabId: tabId,
            projectTabSelected: true,
          };
          result = { tabId, projectToLoad: command.project };
          break;
        }
        case "splitProject": {
          const existing = !command.tabId && tabs.find(tab => tab.id === command.project.id);
          const tabId = command.tabId || existing?.tabId || command.newTabId;
          const layout = pane(workspaceId);
          const samePane = listWorkspacePanes(layout.tree).find(p => p.tabId === tabId);
          const action = command.side === "center" && command.target
            ? samePane ? { type: "focus", pane: samePane.paneId }
              : { type: "replacePane", paneId: command.target, tabId }
            : { type: "split", tabId, target: command.target, paneId: command.paneId, side: command.side === "center" ? "right" : command.side || "right" };
          snapshot = {
            ...snapshot,
            tabs: command.tabId ? snapshot.tabs : updateTabs({ type: "expand", workspaceId, project: command.project, tabId }),
            layouts: { ...snapshot.layouts, [workspaceId]: paneLayoutReducer(layout, action) },
            selectedProject: command.project,
            activeProjectTabId: tabId,
            projectTabSelected: !command.tabId,
          };
          result = { tabId, projectToLoad: command.project };
          break;
        }
        case "closePane": {
          const layout = pane(workspaceId);
          const panes = listWorkspacePanes(layout.tree);
          const index = panes.findIndex(p => p.paneId === command.paneId);
          if (panes.length < 2 || index < 0) return { snapshot };
          const closed = panes[index];
          const nextLayout = paneLayoutReducer(layout, { type: "closePane", paneId: command.paneId });
          const selectionChanged = layout.focused === command.paneId || closed.tabId && snapshot.activeProjectTabId === closed.tabId;
          const remaining = panes.filter(p => p.paneId !== command.paneId);
          const next = remaining[Math.min(index, remaining.length - 1)];
          const project = tabs.find(tab => tab.tabId === next.tabId);
          snapshot = {
            ...snapshot,
            layouts: { ...snapshot.layouts, [workspaceId]: nextLayout },
            ...(selectionChanged ? { selectedProject: project || null, activeProjectTabId: project?.tabId || null, ...(project ? { projectTabSelected: false } : {}) } : {}),
          };
          if (selectionChanged) result = { projectToLoad: project, focus: { kind: "pane", id: next.paneId } };
          break;
        }
        case "closeTabs": {
          const closed = tabs.filter(tab => command.tabIds.includes(tab.tabId));
          if (!closed.length) return { snapshot };
          const fallback = projectTabCloseSelection(tabs, snapshot.activeProjectTabId, command.tabIds);
          const layout = withoutTabPanes(pane(workspaceId), command.tabIds);
          let nextTabs = snapshot.tabs;
          for (const tab of closed)
            nextTabs = updateTabs({ type: "remove", workspaceId, tabId: tab.tabId }, nextTabs);
          const activeClosed = command.tabIds.includes(snapshot.activeProjectTabId);
          snapshot = {
            ...snapshot,
            tabs: nextTabs,
            layouts: { ...snapshot.layouts, [workspaceId]: activeClosed && !fallback ? paneLayoutReducer(layout, { type: "closeSplit" }) : layout },
            closedProjectTabs: { ...snapshot.closedProjectTabs, [workspaceId]: [...own(snapshot.closedProjectTabs, workspaceId, []), ...closed].slice(-20) },
            ...(activeClosed ? { selectedProject: fallback, activeProjectTabId: fallback?.tabId || null, ...(fallback ? { projectTabSelected: false } : {}) } : {}),
          };
          if (activeClosed) result = {
            projectToLoad: fallback || undefined,
            focus: fallback ? { kind: "projectTab", id: fallback.tabId } : { kind: "viewTab" },
          };
          break;
        }
        case "reopenProject": {
          const closed = own(snapshot.closedProjectTabs, workspaceId, []);
          const project = closed.at(-1);
          if (!project) return { snapshot };
          snapshot = {
            ...snapshot,
            tabs: updateTabs({ type: "expand", workspaceId, project, tabId: project.tabId }),
            closedProjectTabs: { ...snapshot.closedProjectTabs, [workspaceId]: closed.slice(0, -1) },
            selectedProject: project,
            activeProjectTabId: project.tabId,
            projectTabSelected: false,
          };
          result = { projectToLoad: project };
          break;
        }
        default:
          throw new Error(`Unknown session command: ${command.type}`);
      }
      for (const listener of listeners) listener();
      return { snapshot, ...result };
    },
  };
}
