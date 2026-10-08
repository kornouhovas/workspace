import { createWorkspaceSession } from "./workspaceSession.js";
import { createWorkspaceSessionStorage } from "./workspaceSessionStorage.js";
import { pruneViewPreviews, rememberViewPreview, viewPreviewId, createPreviewRestoreTracker } from "./workspaceViewPreview.js";
import { createPaneLayout } from "./workspacePaneLayout.js";
import { listWorkspacePanes } from "./workspaceSplitTree.js";

const own = (record, key, fallback) => Object.hasOwn(record, key) ? record[key] : fallback;
function projectFromResponse(response, projectId) {
  const project = response?.project;
  return project && typeof project === "object" && !Array.isArray(project) && project.id === projectId ? project : null;
}

export function createWorkspaceSessionLifecycle({ storage, client, normalizeFileTree = response => Array.isArray(response?.fileTree) ? response.fileTree : [] }) {
  const adapter = createWorkspaceSessionStorage(storage);
  const initial = adapter.read();
  const session = createWorkspaceSession(initial);
  let chrome = session.getSnapshot();
  session.subscribe(() => {
    const snapshot = session.getSnapshot();
    if (chrome.layouts !== snapshot.layouts || chrome.sidebarWidth !== snapshot.sidebarWidth) adapter.writeChrome(snapshot);
    chrome = snapshot;
  });
  let screens = initial.screens;
  let startup = true;
  let pendingWorkspaceId = null;
  let generation = 0;
  let target = { workspaceId: null, viewId: null };
  let readyContext = target;
  const tracker = createPreviewRestoreTracker();
  const identity = ({ workspaceId, viewId }) => JSON.stringify([workspaceId, viewId]);
  const requestToken = () => ({ ...target, generation });
  const accepts = token => token.generation === generation && token.workspaceId === target.workspaceId && token.viewId === target.viewId;
  function persist() { return adapter.write(session.getSnapshot(), screens); }
  function rememberPreview(projectId, viewId = target.viewId, workspaceId = target.workspaceId) {
    if (!workspaceId || !viewId) return;
    screens = { ...screens, [workspaceId]: rememberViewPreview(own(screens, workspaceId, undefined), viewId, projectId) };
    persist();
  }
  const lifecycle = {
    ...session,
    dispatch(command) {
      const before = session.getSnapshot();
      const result = session.dispatch(command);
      if (result.projectToLoad || ["openProject", "closePreview", "closeTabs", "closePane"].includes(command.type)) generation++;
      if (command.type === "openProject" && !command.tabId) rememberPreview(command.project.id);
      if (command.type === "restoreProject" && result.projectToLoad) rememberPreview(result.projectToLoad.id);
      if (command.type === "closePreview" || command.type === "closeTabs" && command.tabIds.includes(before.activeProjectTabId))
        rememberPreview(null, readyContext.viewId, command.workspaceId);
      return result;
    },
    rememberPreview,
    get pendingWorkspaceId() { return pendingWorkspaceId; },
    needsWorkspaceRestore(workspaceId, pendingView = false) { return startup || pendingWorkspaceId === workspaceId || pendingView; },
    preferredView(workspaceId) { return startup || pendingWorkspaceId === workspaceId ? own(screens, workspaceId, undefined)?.viewId : null; },
    invalidatePreview() { generation++; },
    cancelWorkspace(failed = false) {
      generation++;
      pendingWorkspaceId = null;
      target = readyContext;
      if (failed) startup = false;
    },
    beginWorkspace(workspaceId) {
      generation++;
      pendingWorkspaceId = workspaceId;
      target = { workspaceId, viewId: null };
    },
    getScreen(workspaceId) { return own(screens, workspaceId, undefined); },
    selectView({ workspaceId, viewId, expanded = false, ready = false }) {
      generation++;
      target = { workspaceId, viewId };
      if (expanded) {
        rememberPreview(null);
        session.dispatch({ type: "restoreScreen", workspaceId, project: null });
        tracker.request();
      } else if (ready) tracker.markRestored(identity(target));
    },
    async restoreReadyView(context) {
      if (startup || pendingWorkspaceId || !context.workspaceId || !context.viewId || !tracker.needsRestore(identity(context))) return { accepted: false };
      tracker.markRestored(identity(context));
      generation++;
      target = context;
      session.dispatch({ type: "restoreScreen", workspaceId: context.workspaceId, project: null });
      return lifecycle.acceptPreview(await lifecycle.preparePreview(context));
    },
    async preparePreview(context) {
      if (identity(context) !== identity(target)) { generation++; target = context; }
      const token = requestToken();
      const projectId = viewPreviewId(own(screens, context.workspaceId, undefined), context.viewId);
      const response = projectId ? await client.getProject({ ...context, projectId }).catch(() => null) : null;
      const project = projectFromResponse(response, projectId);
      return { ...context, token, project, unavailable: !!projectId && !project };
    },
    async loadProjectFileTree(project, workspaceId = target.workspaceId) {
      const token = requestToken();
      const current = () => accepts(token) && workspaceId === target.workspaceId;
      try {
        const response = await client.listProjectFileTree({ workspaceId, path: project.currentRelativePath });
        const selected = session.getSnapshot().selectedProject;
        if (!current() || selected?.id !== project.id || selected.currentRelativePath !== project.currentRelativePath) return { accepted: false };
        session.dispatch({ type: "selection", workspaceId, selectedProject: { ...selected, fileTree: normalizeFileTree(response) } });
        return { accepted: true };
      } catch (error) {
        return current() ? { accepted: true, error } : { accepted: false };
      }
    },
    removeView(workspaceId, viewId) {
      const screen = own(screens, workspaceId, undefined);
      screens = { ...screens, [workspaceId]: pruneViewPreviews(screen, Object.keys(screen?.previewByView || {}).filter(id => id !== viewId)) };
      if (target.workspaceId === workspaceId && target.viewId === viewId) generation++;
      persist();
    },
    acceptPreview(prepared) {
      if (identity(prepared) === identity(target)) tracker.markRestored(identity(prepared));
      if (!accepts(prepared.token) || identity(prepared) !== identity(target)) return { accepted: false };
      readyContext = { workspaceId: prepared.workspaceId, viewId: prepared.viewId };
      if (prepared.unavailable) rememberPreview(null);
      session.dispatch({ type: "restoreScreen", workspaceId: prepared.workspaceId, project: prepared.project });
      return { accepted: true, project: prepared.project, unavailable: prepared.unavailable };
    },
    syncScreen({ workspaceId, viewId, ready }) {
      if (!ready || startup || pendingWorkspaceId) return;
      const snapshot = session.getSnapshot();
      if (snapshot.activeSurface === "workspace") {
        const tabs = own(snapshot.tabs, workspaceId, []);
        const expanded = snapshot.selectedProject && tabs.some(tab => tab.tabId === snapshot.activeProjectTabId && tab.id === snapshot.selectedProject.id);
        const layout = own(snapshot.layouts, workspaceId, createPaneLayout());
        const fullScreen = !!expanded && (snapshot.projectTabSelected || !listWorkspacePanes(layout.tree).some(pane => pane.tabId === snapshot.activeProjectTabId));
        screens = { ...screens, [workspaceId]: { ...own(screens, workspaceId, {}), viewId, tabId: expanded ? snapshot.activeProjectTabId : null, fullScreen, previewId: !expanded ? snapshot.selectedProject?.id || null : null } };
      }
      persist();
    },
    async prepareWorkspace({ workspaceId, viewId, viewIds, projects }) {
      target = { workspaceId, viewId };
      const token = requestToken();
      const screen = own(screens, workspaceId, undefined);
      const cached = own(session.getSnapshot().tabs, workspaceId, []).find(tab => tab.tabId === screen?.tabId);
      const projectId = viewPreviewId(screen, viewId);
      const response = !cached && projectId ? await client.getProject({ workspaceId, projectId }).catch(() => null) : null;
      const fresh = cached && projects.find(project => project?.id === cached.id);
      const preview = projectFromResponse(response, projectId);
      return { token, workspaceId, viewId, viewIds, project: fresh ? { ...cached, ...fresh } : cached || preview, tabId: cached?.tabId || null, fullScreen: screen?.fullScreen === true, unavailable: !cached && !!projectId && !preview };
    },
    acceptWorkspace(prepared) {
      if (!accepts(prepared.token)) return { accepted: false };
      const { workspaceId, viewId, viewIds, project, tabId, fullScreen } = prepared;
      readyContext = { workspaceId, viewId };
      screens = { ...screens, [workspaceId]: { ...pruneViewPreviews(own(screens, workspaceId, undefined), viewIds), viewId } };
      if (prepared.unavailable) screens = { ...screens, [workspaceId]: rememberViewPreview(screens[workspaceId], viewId, null) };
      startup = false;
      pendingWorkspaceId = null;
      tracker.markRestored(identity(prepared));
      session.dispatch({ type: "restoreScreen", workspaceId, project, tabId, fullScreen });
      if (prepared.unavailable) persist();
      return { accepted: true, project, unavailable: prepared.unavailable };
    },
  };
  return lifecycle;
}
