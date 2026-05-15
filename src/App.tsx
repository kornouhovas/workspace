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
  createWorkspaceListFallback,
  loadWorkspaceList,
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
  const folderSelectionPendingRef = useRef(false);
  const workspaceClient = useMemo(
    () => new WorkspaceServiceClient(createWorkspaceRendererTransport()),
    [],
  );

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
        const requestedViewExists = viewsResponse.views.some((view) => view.id === state.activeViewId);
        const activeViewId = requestedViewExists
          ? state.activeViewId
          : viewsResponse.activeViewId || viewsResponse.views[0]?.id;
        if (!activeViewId) {
          throw new Error("Workspace active view is unavailable.");
        }

        const projectionResponse = normalizeProjectionResponse(
          await workspaceClient.getViewProjection({
            workspaceId: root.workspaceId,
            viewId: activeViewId,
            searchQuery: state.searchQuery,
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
  }, [reloadToken, workspaceClient, state.activeViewId, state.searchQuery]);

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

    try {
      const nextIndex = workspaceList.workspaces.length + 1;
      await workspaceClient.createWorkspace({
        name: `Workspace ${nextIndex}`,
      });
      setSelectedProject(null);
      setActiveSurface("workspace");
      toast.success("Workspace added");
      setReloadToken((value) => value + 1);
    } catch (error) {
      toast.error("Could not add workspace", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleWorkspaceOpen(workspaceId: string) {
    if (!state.root || workspaceId === state.workspaceId) {
      openWorkspaceSurface();
      return;
    }

    try {
      await workspaceClient.setActiveWorkspace({ workspaceId });
      setSelectedProject(null);
      setActiveSurface("workspace");
      setReloadToken((value) => value + 1);
    } catch (error) {
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
      toast.success("Workspace renamed");
      setReloadToken((value) => value + 1);
    } catch (error) {
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
      toast.error("Could not delete workspace", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleReorderWorkspace(sourceWorkspaceId: string, targetWorkspaceId: string) {
    if (sourceWorkspaceId === targetWorkspaceId) {
      return;
    }

    const workspaceIds = workspaceList.workspaces.map((workspace) => workspace.id);
    const sourceIndex = workspaceIds.indexOf(sourceWorkspaceId);
    const targetIndex = workspaceIds.indexOf(targetWorkspaceId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const orderedWorkspaceIds = [...workspaceIds];
    const [movedWorkspaceId] = orderedWorkspaceIds.splice(sourceIndex, 1);
    orderedWorkspaceIds.splice(targetIndex, 0, movedWorkspaceId);

    try {
      setWorkspaceList((current) => ({
        ...current,
        workspaces: orderedWorkspaceIds
          .map((workspaceId) => current.workspaces.find((workspace) => workspace.id === workspaceId))
          .filter((workspace): workspace is WorkspaceListItem => workspace !== undefined),
      }));
      await workspaceClient.reorderWorkspaces({ orderedWorkspaceIds });
    } catch (error) {
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
      await workspaceClient.createView({
        workspaceId: state.workspaceId,
        viewType,
        name: `${label} ${nextIndex}`,
      });
      toast.success("View created");
      setReloadToken((value) => value + 1);
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
      toast.success("View renamed");
      setReloadToken((value) => value + 1);
    } catch (error) {
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
      await workspaceClient.deleteView({
        workspaceId: state.workspaceId,
        viewId,
      });
      toast.success("View deleted");
      setSelectedProject(null);
      setReloadToken((value) => value + 1);
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
  const serviceProjection = state.projection;
  const activeView = viewState.views.find((view) => view.id === viewState.activeViewId) as
    | WorkspaceViewState
    | undefined;
  const activeViewType = activeView?.viewType === "table" ? "table" : "board";
  const projectionMatchesActiveView = serviceProjection?.view.id === viewState.activeViewId;
  const visibleProperties =
    serviceProjection?.visibleProperties ?? workspaceMockProjection.visibleProperties;
  const boardProjection =
    projectionMatchesActiveView && serviceProjection?.projection.type === "board"
      ? serviceProjection.projection
      : workspaceMockProjection.projection;
  const tableProjection =
    projectionMatchesActiveView && serviceProjection?.projection.type === "table"
      ? serviceProjection.projection
      : workspaceMockProjection.tableProjection;
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
            activeWorkspaceId={state.workspaceId || workspaceList.activeWorkspaceId}
            workspaces={navigationWorkspaces}
            searchQuery={state.searchQuery}
            onAddWorkspace={handleAddWorkspace}
            onRenameWorkspace={handleRenameWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            onReorderWorkspace={handleReorderWorkspace}
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
