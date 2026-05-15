import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { WorkspaceBoardView } from "@/components/workspace/board-view";
import { WorkspaceLeftPanel } from "@/components/workspace/left-panel";
import { WorkspaceProjectDetailPanel } from "@/components/workspace/project-detail-panel";
import { WorkspaceSettingsView } from "@/components/workspace/settings-view";
import { WorkspaceEmptyState } from "@/components/workspace/states";
import { WorkspaceTableView } from "@/components/workspace/table-view";
import { WorkspaceViewTabs } from "@/components/workspace/view-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { PanelLeftIcon } from "@/lib/lucide-icons";
import {
  workspaceMockProjection,
  workspaceMockSettings,
  type WorkspaceMockProject,
} from "@/workspaceMockData";
import {
  createInitialWorkspaceAppState,
  filterWorkspaceProjectionBySearch,
  workspaceAppStateReducer,
  type WorkspaceAppState,
  type WorkspaceFolderRole,
  type WorkspaceFolderRoleNode,
  type WorkspaceProjectionResponse,
  type WorkspaceRootState,
  type WorkspaceViewState,
  type WorkspaceViewsResponse,
} from "@/workspaceAppState";
import { createWorkspaceRendererTransport } from "@/workspaceRendererTransport";
import { WorkspaceServiceClient } from "@/workspaceServiceClient.js";
import {
  addWorkspaceListFallback,
  createWorkspaceListFallback,
  deleteWorkspaceListFallback,
  isUnsupportedWorkspaceMethodError,
  loadWorkspaceList,
  renameWorkspaceListFallback,
  reorderWorkspaceListFallback,
  setActiveWorkspaceListFallback,
  type WorkspaceListItem,
  type WorkspaceListState,
} from "@/workspaceCompatibility";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "Workspace";
}

function normalizeRootResponse(response: unknown): WorkspaceRootState | null {
  const root = isRecord(response) && isRecord(response.root) ? response.root : response;
  if (!isRecord(root)) {
    return null;
  }

  const path = getString(root.rootPath) || getString(root.path);
  const name = getString(root.name) || getNameFromPath(path);
  const workspaceId = getString(root.id) || getString(root.workspaceId) || "workspace:root";

  if (!path && !getString(root.id) && !getString(root.workspaceId) && !getString(root.name)) {
    return null;
  }

  return { workspaceId, name, path };
}

function normalizeViewsResponse(response: unknown, workspaceId: string): WorkspaceViewsResponse {
  if (!isRecord(response)) {
    return { workspaceId, activeViewId: null, views: [] };
  }

  const views = Array.isArray(response.views)
    ? response.views.filter(isRecord).map((view) => ({
        id: getString(view.id),
        name: getString(view.name) || "Untitled view",
        viewType: getString(view.viewType) || "board",
      })).filter((view) => view.id)
    : [];

  return {
    workspaceId: getString(response.workspaceId) || workspaceId,
    activeViewId: getString(response.activeViewId) || null,
    views,
  };
}

function normalizeProjectionResponse(response: unknown): WorkspaceProjectionResponse {
  if (!isRecord(response) || !isRecord(response.view) || !isRecord(response.projection)) {
    throw new Error("Workspace projection response was invalid.");
  }

  return response as WorkspaceProjectionResponse;
}

function normalizeCreatedWorkspaceResponse(
  response: unknown,
  fallbackName: string,
): { activeWorkspaceId: string | null; workspace: WorkspaceListItem | null } {
  if (!isRecord(response)) {
    return { activeWorkspaceId: null, workspace: null };
  }

  const workspace = isRecord(response.workspace) ? response.workspace : null;
  const id = getString(workspace?.id);
  if (!id) {
    return {
      activeWorkspaceId: getString(response.activeWorkspaceId) || null,
      workspace: null,
    };
  }

  return {
    activeWorkspaceId: getString(response.activeWorkspaceId) || id,
    workspace: {
      id,
      name: getString(workspace?.name) || fallbackName,
      order: Number.isFinite(Number(workspace?.order)) ? Number(workspace?.order) : 10,
    },
  };
}

function normalizeCreatedViewResponse(
  response: unknown,
  workspaceId: string,
  fallbackView: WorkspaceViewState,
): { workspaceId: string; activeViewId: string; view: WorkspaceViewState } {
  const body = isRecord(response) ? response : {};
  const view = isRecord(body.view) ? body.view : {};
  const id = getString(view.id) || fallbackView.id;
  const viewType = getString(view.viewType) || fallbackView.viewType;

  return {
    workspaceId: getString(body.workspaceId) || workspaceId,
    activeViewId: getString(body.activeViewId) || id,
    view: {
      id,
      name: getString(view.name) || fallbackView.name,
      viewType,
    },
  };
}

function normalizeDeletedViewResponse(response: unknown) {
  if (!isRecord(response)) {
    return { activeViewId: null };
  }

  return { activeViewId: getString(response.activeViewId) || null };
}

function normalizeFolderRole(role: unknown, depth = 0): WorkspaceFolderRole {
  if (role === "group" || role === "status") {
    return role;
  }

  if (role === "project" || role === "card") {
    return "project";
  }

  return depth === 0 ? "status" : "project";
}

function getFolderRoleStatus(role: WorkspaceFolderRole, childCount: number) {
  if (role === "status") {
    return "Ready";
  }
  if (role === "group") {
    return "Group";
  }

  return childCount > 0 ? "Contains folders" : "Discovered";
}

function normalizeFolderRoleNode(node: Record<string, unknown>, depth = 0): WorkspaceFolderRoleNode | null {
  const relativePath = getString(node.path) || getString(node.relativePath);
  const name = getString(node.name) || getNameFromPath(relativePath);
  if (!relativePath && !name) {
    return null;
  }

  const children = Array.isArray(node.children)
    ? node.children
        .filter(isRecord)
        .map((child) => normalizeFolderRoleNode(child, depth + 1))
        .filter((child): child is WorkspaceFolderRoleNode => child !== null)
    : [];
  const role = normalizeFolderRole(node.role, depth);

  return {
    id: getString(node.id) || `folder:${relativePath || name}`,
    name,
    relativePath,
    role,
    status: getString(node.status) || getFolderRoleStatus(role, children.length),
    children,
  };
}

function normalizeFolderRoleTree(response: unknown): WorkspaceFolderRoleNode[] {
  const tree = isRecord(response) && Array.isArray(response.tree) ? response.tree : [];

  return tree
    .filter(isRecord)
    .map(normalizeFolderRoleNode)
    .filter((node): node is WorkspaceFolderRoleNode => node !== null);
}

function getServiceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Workspace service request failed.";
}

function WorkspaceLoadingState() {
  return (
    <div className="grid gap-4 px-4 py-4" aria-label="Loading workspace">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

function WorkspaceServiceError({ state }: { readonly state: WorkspaceAppState }) {
  if (state.status !== "error" || !state.error) {
    return null;
  }

  return (
    <div className="mx-4 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      Workspace service unavailable. Showing deterministic mock workspace data. {state.error}
    </div>
  );
}

type WorkspaceSurface = "workspace" | "settings";

export default function App() {
  const [state, dispatch] = useReducer(
    workspaceAppStateReducer,
    undefined,
    createInitialWorkspaceAppState,
  );
  const [activeSurface, setActiveSurface] = useState<WorkspaceSurface>("workspace");
  const [selectedProject, setSelectedProject] = useState<WorkspaceMockProject | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceList, setWorkspaceList] = useState<WorkspaceListState>({
    activeWorkspaceId: null,
    workspaces: [],
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const loadRequestIdRef = useRef(0);
  const activeViewIdRef = useRef<string | null>(null);
  const folderSelectionPendingRef = useRef(false);
  const workspaceClient = useMemo(
    () => new WorkspaceServiceClient(createWorkspaceRendererTransport()),
    [],
  );

  useEffect(() => {
    activeViewIdRef.current = state.activeViewId;
  }, [state.activeViewId]);

  useEffect(() => {
    let cancelled = false;
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;

    function isCurrentLoad() {
      return !cancelled && loadRequestIdRef.current === loadRequestId;
    }

    async function loadWorkspaceState() {
      dispatch({ type: "loadStarted" });

      try {
        const root = normalizeRootResponse(await workspaceClient.getRoot());
        if (!isCurrentLoad()) {
          return;
        }

        if (!root) {
          dispatch({ type: "sourceFolderMissing" });
          return;
        }

        dispatch({ type: "rootSelected", root });

        const [scanResponse, viewsRawResponse, workspacesResponse] = await Promise.all([
          workspaceClient.scan({ includeCardChildren: true }),
          workspaceClient.listViews({ workspaceId: root.workspaceId }),
          loadWorkspaceList(workspaceClient, root),
        ]);
        const folderRoleTree = normalizeFolderRoleTree(scanResponse);
        const viewsResponse = normalizeViewsResponse(viewsRawResponse, root.workspaceId);
        const requestedActiveViewId = activeViewIdRef.current;
        const requestedViewExists = viewsResponse.views.some((view) => view.id === requestedActiveViewId);
        const activeViewId = requestedViewExists
          ? requestedActiveViewId
          : viewsResponse.activeViewId || viewsResponse.views[0]?.id;
        if (!activeViewId) {
          throw new Error("Workspace active view is unavailable.");
        }

        const projectionResponse = normalizeProjectionResponse(
          await workspaceClient.getViewProjection({
            workspaceId: root.workspaceId,
            viewId: activeViewId,
          }),
        );

        if (isCurrentLoad()) {
          setWorkspaceList(workspacesResponse);
          dispatch({
            type: "projectionLoaded",
            root,
            viewsResponse: { ...viewsResponse, activeViewId },
            projectionResponse,
            folderRoleTree,
          });
          if (folderSelectionPendingRef.current) {
            folderSelectionPendingRef.current = false;
            setSelectingFolder(false);
            toast.success("Workspace folder selected");
          }
        }
      } catch (error) {
        const message = getServiceErrorMessage(error);
        if (isCurrentLoad()) {
          setWorkspaceList({ activeWorkspaceId: null, workspaces: [] });
          dispatch({ type: "serviceError", error: message });
          if (folderSelectionPendingRef.current) {
            folderSelectionPendingRef.current = false;
            setSelectingFolder(false);
            toast.error("Could not load selected workspace folder", {
              description: message,
            });
          } else {
            toast.error("Workspace service unavailable", {
              description: "Mock workspace data is shown while the service bridge is unavailable.",
            });
          }
        }
      }
    }

    void loadWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [reloadToken, workspaceClient]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.sourceFolderMissing ||
      !state.workspaceId ||
      !state.activeViewId ||
      !state.root ||
      (
        state.projection?.workspaceId === state.workspaceId &&
        state.projection.view.id === state.activeViewId
      )
    ) {
      return;
    }

    let cancelled = false;

    async function loadActiveViewProjection() {
      try {
        const projectionResponse = normalizeProjectionResponse(
          await workspaceClient.getViewProjection({
            workspaceId: state.workspaceId,
            viewId: state.activeViewId,
          }),
        );

        if (!cancelled) {
          dispatch({ type: "projectionUpdated", projectionResponse });
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("Could not load view", {
            description: getServiceErrorMessage(error),
          });
        }
      }
    }

    void loadActiveViewProjection();

    return () => {
      cancelled = true;
    };
  }, [
    workspaceClient,
    state.status,
    state.sourceFolderMissing,
    state.root,
    state.workspaceId,
    state.activeViewId,
    state.projection?.workspaceId,
    state.projection?.view.id,
  ]);

  async function handleSelectFolder() {
    loadRequestIdRef.current += 1;
    folderSelectionPendingRef.current = false;
    setSelectingFolder(true);

    try {
      const root = normalizeRootResponse(await workspaceClient.setRoot({}));
      if (root) {
        dispatch({ type: "rootSelected", root });
        setWorkspaceList(createWorkspaceListFallback(root));
      } else {
        throw new Error("Selected workspace folder response was invalid.");
      }
      folderSelectionPendingRef.current = true;
      setReloadToken((value) => value + 1);
    } catch (error) {
      folderSelectionPendingRef.current = false;
      setSelectingFolder(false);
      toast.error("Could not select workspace folder", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleAddWorkspace() {
    if (!state.root) {
      toast.error("Select a source folder before adding workspaces.");
      return;
    }

    const nextIndex = workspaceList.workspaces.length + 1;
    const workspaceName = `Workspace ${nextIndex}`;

    try {
      const response = await workspaceClient.createWorkspace({
        name: workspaceName,
      });
      const createdWorkspace = normalizeCreatedWorkspaceResponse(response, workspaceName);
      if (createdWorkspace.workspace) {
        const workspace = createdWorkspace.workspace;
        const activeWorkspaceId = createdWorkspace.activeWorkspaceId || workspace.id;
        setWorkspaceList((current) => {
          const existing = current.workspaces.some((item) => item.id === workspace.id);
          return {
            activeWorkspaceId,
            workspaces: existing
              ? current.workspaces.map((item) => (
                  item.id === workspace.id ? workspace : item
                ))
              : [...current.workspaces, workspace],
          };
        });
        dispatch({ type: "workspaceActivated", workspaceId: activeWorkspaceId });
      }
      setSelectedProject(null);
      setActiveSurface("workspace");
      toast.success("Workspace added");
      setReloadToken((value) => value + 1);
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.createWorkspace")) {
        setWorkspaceList((current) => addWorkspaceListFallback(current, workspaceName));
        setSelectedProject(null);
        setActiveSurface("workspace");
        toast.success("Workspace added locally");
        return;
      }

      toast.error("Could not add workspace", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleWorkspaceOpen(workspaceId: string) {
    const activeWorkspaceId = workspaceList.activeWorkspaceId || state.workspaceId;

    if (!state.root || workspaceId === activeWorkspaceId) {
      openWorkspaceSurface();
      return;
    }

    try {
      await workspaceClient.setActiveWorkspace({ workspaceId });
      setWorkspaceList((current) => setActiveWorkspaceListFallback(current, workspaceId));
      dispatch({ type: "workspaceActivated", workspaceId });
      setSelectedProject(null);
      setActiveSurface("workspace");
      setReloadToken((value) => value + 1);
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.setActiveWorkspace")) {
        setWorkspaceList((current) => setActiveWorkspaceListFallback(current, workspaceId));
        setSelectedProject(null);
        setActiveSurface("workspace");
        return;
      }

      toast.error("Could not open workspace", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleRenameWorkspace(workspaceId: string, name: string) {
    try {
      await workspaceClient.updateWorkspace({
        workspaceId,
        patch: { name },
      });
      setWorkspaceList((current) => renameWorkspaceListFallback(current, workspaceId, name));
      toast.success("Workspace renamed");
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.updateWorkspace")) {
        setWorkspaceList((current) => renameWorkspaceListFallback(current, workspaceId, name));
        toast.success("Workspace renamed locally");
        return;
      }

      toast.error("Could not rename workspace", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    try {
      await workspaceClient.deleteWorkspace({ workspaceId });
      setSelectedProject(null);
      toast.success("Workspace deleted");
      setReloadToken((value) => value + 1);
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.deleteWorkspace")) {
        setWorkspaceList((current) => deleteWorkspaceListFallback(current, workspaceId));
        setSelectedProject(null);
        toast.success("Workspace deleted locally");
        return;
      }

      toast.error("Could not delete workspace", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleReorderWorkspaces(orderedWorkspaceIds: readonly string[]) {
    const currentWorkspaceIds = workspaceList.workspaces.map((workspace) => workspace.id);
    const currentWorkspaceIdSet = new Set(currentWorkspaceIds);
    const nextOrderedWorkspaceIds = orderedWorkspaceIds.filter((workspaceId) => (
      currentWorkspaceIdSet.has(workspaceId)
    ));

    for (const workspaceId of currentWorkspaceIds) {
      if (!nextOrderedWorkspaceIds.includes(workspaceId)) {
        nextOrderedWorkspaceIds.push(workspaceId);
      }
    }

    if (
      nextOrderedWorkspaceIds.length !== currentWorkspaceIds.length ||
      nextOrderedWorkspaceIds.join("\0") === currentWorkspaceIds.join("\0")
    ) {
      return;
    }

    try {
      setWorkspaceList((current) => reorderWorkspaceListFallback(current, nextOrderedWorkspaceIds));
      await workspaceClient.reorderWorkspaces({ orderedWorkspaceIds: nextOrderedWorkspaceIds });
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.reorderWorkspaces")) {
        return;
      }

      toast.error("Could not reorder workspaces", {
        description: getServiceErrorMessage(error),
      });
      setReloadToken((value) => value + 1);
    }
  }

  async function handleCreateView(viewType: "board" | "table") {
    if (!state.workspaceId) {
      toast.error("Select a source folder before creating views.");
      return;
    }

    const label = viewType === "board" ? "Board" : "Table";
    const currentViews = state.views.length > 0 ? state.views : workspaceMockProjection.views;
    const nextIndex = currentViews.filter((view) => view.viewType === viewType).length + 1;

    try {
      const fallbackView = {
        id: `view:pending-${viewType}-${Date.now()}`,
        name: `${label} ${nextIndex}`,
        viewType,
      };
      const response = await workspaceClient.createView({
        workspaceId: state.workspaceId,
        viewType,
        name: fallbackView.name,
      });
      const createdView = normalizeCreatedViewResponse(response, state.workspaceId, fallbackView);
      dispatch({
        type: "viewCreated",
        workspaceId: createdView.workspaceId,
        activeViewId: createdView.activeViewId,
        view: createdView.view,
      });
      toast.success("View created");
    } catch (error) {
      toast.error("Could not create view", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleRenameView(viewId: string, name: string) {
    if (!state.workspaceId) {
      toast.error("Select a source folder before renaming views.");
      return;
    }

    try {
      await workspaceClient.updateView({
        workspaceId: state.workspaceId,
        viewId,
        patch: { name },
      });
      dispatch({ type: "viewRenamed", viewId, name });
      toast.success("View renamed");
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.updateView")) {
        dispatch({ type: "viewRenamed", viewId, name });
        toast.success("View renamed locally");
        return;
      }

      toast.error("Could not rename view", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleDeleteView(viewId: string) {
    if (!state.workspaceId) {
      toast.error("Select a source folder before deleting views.");
      return;
    }

    try {
      const response = await workspaceClient.deleteView({
        workspaceId: state.workspaceId,
        viewId,
      });
      const deletedView = normalizeDeletedViewResponse(response);
      dispatch({
        type: "viewDeleted",
        viewId,
        activeViewId: deletedView.activeViewId,
      });
      toast.success("View deleted");
      setSelectedProject(null);
    } catch (error) {
      toast.error("Could not delete view", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleFolderRoleChange(
    node: WorkspaceFolderRoleNode,
    role: WorkspaceFolderRoleNode["role"],
  ) {
    if (!state.root) {
      toast.error("Select a source folder before changing folder roles.");
      return;
    }

    try {
      await workspaceClient.updateFolderRole({
        path: node.relativePath,
        role,
      });
      toast.success("Folder role updated");
      setSelectedProject(null);
      setReloadToken((value) => value + 1);
    } catch (error) {
      toast.error("Could not update folder role", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  function handleProjectOpen(project: WorkspaceMockProject) {
    setSelectedProject(project);
  }

  function openWorkspaceSurface() {
    setActiveSurface("workspace");
  }

  function openSettingsSurface() {
    setSelectedProject(null);
    setActiveSurface("settings");
  }

  const viewState = {
    activeViewId: state.activeViewId || workspaceMockProjection.activeViewId,
    views: state.views.length > 0 ? state.views : workspaceMockProjection.views,
  };
  const navigationWorkspaces = workspaceList.workspaces.length > 0
    ? workspaceList.workspaces
    : [{ id: viewState.activeViewId, name: "Operations", order: 10 }];
  const sourceFolder = state.root
    ? {
        name: state.root.name,
        path: state.root.path || "Path unavailable",
        state: "connected",
      }
    : workspaceMockSettings.sourceFolder;
  const serviceProjection = useMemo(
    () => state.projection
      ? filterWorkspaceProjectionBySearch(state.projection, state.searchQuery)
      : null,
    [state.projection, state.searchQuery],
  );
  const mockBoardProjectionResponse = useMemo(
    () => filterWorkspaceProjectionBySearch(
      workspaceMockProjection as unknown as WorkspaceProjectionResponse,
      state.searchQuery,
    ),
    [state.searchQuery],
  );
  const mockTableProjectionResponse = useMemo(
    () => filterWorkspaceProjectionBySearch(
      {
        ...workspaceMockProjection,
        view: workspaceMockProjection.tableView,
        projection: workspaceMockProjection.tableProjection,
      } as unknown as WorkspaceProjectionResponse,
      state.searchQuery,
    ),
    [state.searchQuery],
  );
  const activeView = viewState.views.find((view) => view.id === viewState.activeViewId) as
    | WorkspaceViewState
    | undefined;
  const activeViewType = serviceProjection?.projection.type === "table"
    ? "table"
    : serviceProjection?.projection.type === "board"
      ? "board"
      : activeView?.viewType === "table" ? "table" : "board";
  const visibleProperties =
    serviceProjection?.visibleProperties ?? workspaceMockProjection.visibleProperties;
  const boardProjection =
    serviceProjection?.projection.type === "board"
      ? serviceProjection.projection
      : mockBoardProjectionResponse.projection;
  const tableProjection =
    serviceProjection?.projection.type === "table"
      ? serviceProjection.projection
      : mockTableProjectionResponse.projection;
  const folderRoleTree = state.root ? state.folderRoleTree : workspaceMockSettings.folderRoleTree;

  return (
    <>
      <div className="dark flex h-screen min-h-0 bg-background text-foreground">
        <div
          aria-hidden={sidebarCollapsed}
          className={[
            "h-full shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out",
            sidebarCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-72 opacity-100",
          ].join(" ")}
        >
          <WorkspaceLeftPanel
            activeSurface={activeSurface}
            activeWorkspaceId={workspaceList.activeWorkspaceId || state.workspaceId}
            workspaces={navigationWorkspaces}
            searchQuery={state.searchQuery}
            onAddWorkspace={handleAddWorkspace}
            onRenameWorkspace={handleRenameWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            onReorderWorkspaces={handleReorderWorkspaces}
            onWorkspaceOpen={handleWorkspaceOpen}
            onSearchQueryChange={(searchQuery) => {
              dispatch({ type: "searchQueryChanged", searchQuery });
            }}
            onOpenSettings={openSettingsSurface}
          />
        </div>
        <main data-testid="workspace-main" className="flex min-w-0 flex-1 flex-col">
          <header
            className={[
              "electron-window-drag flex h-12 shrink-0 items-center gap-2 border-b border-border pr-4",
              sidebarCollapsed ? "pl-24" : "pl-4",
            ].join(" ")}
          >
            <button
              type="button"
              className="electron-window-no-drag inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              onClick={() => setSidebarCollapsed((value) => !value)}
            >
              <PanelLeftIcon className="size-4" aria-hidden="true" />
            </button>
            <h1 className="truncate text-sm font-medium">
              {activeSurface === "settings" ? "Settings" : "Workspace Project Board"}
            </h1>
          </header>
          {activeSurface === "settings" ? (
            <div className="electron-window-no-drag min-h-0 flex-1 overflow-auto">
              {state.status === "loading" || state.status === "idle" ? (
                <WorkspaceLoadingState />
              ) : (
                <>
                  <WorkspaceServiceError state={state} />
                  <WorkspaceSettingsView
                    sourceFolder={sourceFolder}
                    folderRoleTree={folderRoleTree}
                    onSelectFolder={handleSelectFolder}
                    onCloseSettings={openWorkspaceSurface}
                    onFolderRoleChange={handleFolderRoleChange}
                    selectingFolder={selectingFolder}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="electron-window-no-drag flex min-h-0 flex-1 flex-col overflow-hidden">
              <WorkspaceViewTabs
                activeViewId={viewState.activeViewId}
                views={viewState.views}
                onActiveViewChange={(activeViewId) => {
                  dispatch({ type: "activeViewChanged", activeViewId });
                  if (state.workspaceId) {
                    void workspaceClient.setActiveView({
                      workspaceId: state.workspaceId,
                      viewId: activeViewId,
                    }).catch((error: unknown) => {
                      toast.error("Could not save active view", {
                        description: getServiceErrorMessage(error),
                      });
                    });
                  }
                }}
                onCreateView={handleCreateView}
                onRenameView={handleRenameView}
                onDeleteView={handleDeleteView}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                {state.status === "loading" || state.status === "idle" ? (
                  <WorkspaceLoadingState />
                ) : state.sourceFolderMissing ? (
                  <WorkspaceEmptyState onOpenSettings={openSettingsSurface} />
                ) : (
                  <>
                    <WorkspaceServiceError state={state} />
                    {activeViewType === "board" ? (
                      <WorkspaceBoardView
                        projection={boardProjection as typeof workspaceMockProjection.projection}
                        visibleProperties={visibleProperties as typeof workspaceMockProjection.visibleProperties}
                        onProjectOpen={handleProjectOpen}
                      />
                    ) : null}
                    {activeViewType === "table" ? (
                      <WorkspaceTableView
                        projection={tableProjection as typeof workspaceMockProjection.tableProjection}
                        visibleProperties={visibleProperties as typeof workspaceMockProjection.visibleProperties}
                        onProjectOpen={handleProjectOpen}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
        <WorkspaceProjectDetailPanel
          open={selectedProject !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedProject(null);
            }
          }}
          project={selectedProject}
          visibleProperties={visibleProperties as typeof workspaceMockProjection.visibleProperties}
        />
      </div>
      <Toaster richColors />
    </>
  );
}
