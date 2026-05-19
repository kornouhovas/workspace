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
  type WorkspaceMockFileTreeNode,
  type WorkspaceMockProject,
} from "@/workspaceMockData";
import {
  createInitialWorkspaceAppState,
  filterWorkspaceProjectionBySearch,
  workspaceAppStateReducer,
  type WorkspaceAppState,
  type WorkspacePropertyCatalogState,
  type WorkspacePropertyDefinitionState,
  type WorkspaceSelectValueState,
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
import {
  createNextVisiblePropertyIds,
  createPropertyOrder,
} from "@/workspaceViewVisibility.js";
import type { WorkspaceCustomPropertyType } from "@/components/workspace/property-controls";

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
        visiblePropertyIds: Array.isArray(view.visiblePropertyIds)
          ? view.visiblePropertyIds.filter((id): id is string => typeof id === "string")
          : undefined,
        propertyOrder: isRecord(view.propertyOrder)
          ? Object.fromEntries(
              Object.entries(view.propertyOrder)
                .filter(([, order]) => Number.isFinite(Number(order)))
                .map(([propertyId, order]) => [propertyId, Number(order)]),
            )
          : undefined,
        valueVisibility: isRecord(view.valueVisibility)
          ? Object.fromEntries(
              Object.entries(view.valueVisibility).flatMap(([propertyId, setting]) => {
                if (!isRecord(setting)) {
                  return [];
                }

                return [[
                  propertyId,
                  {
                    valueIds: Array.isArray(setting.valueIds)
                      ? setting.valueIds.filter((valueId): valueId is string => typeof valueId === "string")
                      : [],
                    includeEmpty: setting.includeEmpty === true,
                  },
                ]];
              }),
            )
          : undefined,
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

function normalizePropertiesResponse(response: unknown, workspaceId: string): WorkspacePropertyCatalogState {
  const body = isRecord(response) ? response : {};
  const properties = Array.isArray(body.properties)
    ? body.properties.filter(isRecord).map(normalizePropertyDefinition).filter((property) => property.id)
    : [];
  const selectValues = Array.isArray(body.selectValues)
    ? body.selectValues.filter(isRecord).map(normalizeSelectValue).filter((value) => value.id && value.propertyId)
    : [];

  return {
    workspaceId: getString(body.workspaceId) || workspaceId,
    properties,
    selectValues,
    usage: isRecord(body.usage) ? body.usage as WorkspacePropertyCatalogState["usage"] : undefined,
  };
}

function normalizePropertyDefinition(property: Record<string, unknown>): WorkspacePropertyDefinitionState {
  const propertyType = getString(property.propertyType) || getString(property.type) || "text";

  return {
    id: getString(property.id),
    name: getString(property.name) || "Untitled property",
    type: getString(property.type) || propertyType,
    propertyType,
    system: property.system === true,
    hidden: property.hidden === true,
    order: Number.isFinite(Number(property.order)) ? Number(property.order) : undefined,
  };
}

function normalizeSelectValue(value: Record<string, unknown>): WorkspaceSelectValueState {
  return {
    id: getString(value.id),
    workspaceId: getString(value.workspaceId) || undefined,
    propertyId: getString(value.propertyId),
    name: getString(value.name) || "Untitled value",
    color: getString(value.color) || undefined,
    hidden: value.hidden === true,
    order: Number.isFinite(Number(value.order)) ? Number(value.order) : undefined,
  };
}

function normalizeProjectFileTreeNode(node: Record<string, unknown>): WorkspaceMockFileTreeNode | null {
  const name = getString(node.name);
  const relativePath = getString(node.relativePath) || getString(node.path);
  if (!name || !relativePath) {
    return null;
  }

  const kind = node.kind === "file" ? "file" : "folder";
  const children = kind === "folder" && Array.isArray(node.children)
    ? node.children
        .filter(isRecord)
        .map(normalizeProjectFileTreeNode)
        .filter((child): child is WorkspaceMockFileTreeNode => child !== null)
    : undefined;

  return {
    id: getString(node.id) || `${kind}:${relativePath}`,
    name,
    kind,
    relativePath,
    available: node.available !== false,
    ...(children ? { children } : {}),
  };
}

function normalizeProjectFileTreeResponse(response: unknown): readonly WorkspaceMockFileTreeNode[] {
  const fileTree = isRecord(response) && Array.isArray(response.fileTree) ? response.fileTree : [];
  return fileTree
    .filter(isRecord)
    .map(normalizeProjectFileTreeNode)
    .filter((node): node is WorkspaceMockFileTreeNode => node !== null);
}

function removeProjectPropertyValue(project: WorkspaceMockProject, propertyId: string): WorkspaceMockProject {
  if (!Object.hasOwn(project.propertyValues, propertyId)) {
    return project;
  }

  const propertyValues = { ...project.propertyValues };
  delete propertyValues[propertyId];

  return {
    ...project,
    propertyValues,
  };
}

function removeProjectSelectValue(
  project: WorkspaceMockProject,
  propertyId: string,
  selectValueId: string,
): WorkspaceMockProject {
  const currentValue = project.propertyValues[propertyId as keyof typeof project.propertyValues];

  if (currentValue === selectValueId) {
    const propertyValues = { ...project.propertyValues };
    delete propertyValues[propertyId as keyof typeof project.propertyValues];
    return { ...project, propertyValues };
  }

  if (!Array.isArray(currentValue) || !currentValue.includes(selectValueId)) {
    return project;
  }

  return {
    ...project,
    propertyValues: {
      ...project.propertyValues,
      [propertyId]: currentValue.filter((valueId) => valueId !== selectValueId),
    },
  };
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

function createClientDocumentId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${randomId}`;
}

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
  const [workspaceFloatingDismissToken, setWorkspaceFloatingDismissToken] = useState(0);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const loadRequestIdRef = useRef(0);
  const activeViewIdRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);
  const propertySaveRequestVersionsRef = useRef(new Map<string, number>());
  const folderSelectionPendingRef = useRef(false);
  const workspaceClient = useMemo(
    () => new WorkspaceServiceClient(createWorkspaceRendererTransport()),
    [],
  );

  useEffect(() => {
    activeViewIdRef.current = state.activeViewId;
  }, [state.activeViewId]);

  useEffect(() => {
    workspaceIdRef.current = state.workspaceId;
  }, [state.workspaceId]);

  function createPropertySaveKey(projectId: string, propertyId: string) {
    return `${projectId}\0${propertyId}`;
  }

  function createPropertySaveRequestVersion(projectId: string, propertyId: string) {
    const key = createPropertySaveKey(projectId, propertyId);
    const requestVersion = (propertySaveRequestVersionsRef.current.get(key) || 0) + 1;
    propertySaveRequestVersionsRef.current.set(key, requestVersion);
    return requestVersion;
  }

  function isCurrentPropertySaveRequest(projectId: string, propertyId: string, requestVersion: number) {
    return (
      propertySaveRequestVersionsRef.current.get(createPropertySaveKey(projectId, propertyId)) === requestVersion
    );
  }

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

        const previousWorkspaceId = workspaceIdRef.current;
        dispatch({ type: "rootSelected", root });

        const [scanResponse, viewsRawResponse, workspacesResponse, propertiesRawResponse] = await Promise.all([
          workspaceClient.scan({ includeCardChildren: activeSurface === "settings" }),
          workspaceClient.listViews({ workspaceId: root.workspaceId }),
          loadWorkspaceList(workspaceClient, root),
          workspaceClient.listProperties({ workspaceId: root.workspaceId, includeUsage: true }),
        ]);
        const folderRoleTree = normalizeFolderRoleTree(scanResponse);
        const viewsResponse = normalizeViewsResponse(viewsRawResponse, root.workspaceId);
        const propertiesResponse = normalizePropertiesResponse(propertiesRawResponse, root.workspaceId);
        const requestedActiveViewId = workspaceIdRef.current === root.workspaceId ||
          previousWorkspaceId === root.workspaceId
          ? activeViewIdRef.current
          : null;
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
          dispatch({
            type: "propertiesLoaded",
            propertiesResponse,
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
  }, [activeSurface, reloadToken, workspaceClient]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.sourceFolderMissing ||
      state.workspaceSwitchPending ||
      !state.workspaceId ||
      !state.activeViewId ||
      !state.root ||
      (
        state.projection?.workspaceId === state.workspaceId &&
        state.projection.view.id === state.activeViewId &&
        !state.projectionRefreshing
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
    state.workspaceSwitchPending,
    state.root,
    state.workspaceId,
    state.activeViewId,
    state.projectionRefreshing,
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

    const workspaceName = "Workspace";

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
        dispatch({ type: "workspaceActivated", workspaceId });
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
      const response = await workspaceClient.deleteWorkspace({ workspaceId });
      const responseActiveWorkspaceId = isRecord(response) ? getString(response.activeWorkspaceId) : "";
      const currentActiveWorkspaceId = workspaceList.activeWorkspaceId || state.workspaceId;
      const wasActiveWorkspace = workspaceId === currentActiveWorkspaceId;
      const fallbackActiveWorkspaceId = workspaceList.workspaces.find((workspace) => workspace.id !== workspaceId)?.id || null;
      const nextActiveWorkspaceId = responseActiveWorkspaceId || fallbackActiveWorkspaceId;

      setWorkspaceList((current) => {
        const nextWorkspaceList = deleteWorkspaceListFallback(current, workspaceId);
        return responseActiveWorkspaceId
          ? { ...nextWorkspaceList, activeWorkspaceId: responseActiveWorkspaceId }
          : nextWorkspaceList;
      });
      setSelectedProject(null);
      if (wasActiveWorkspace && nextActiveWorkspaceId) {
        dispatch({ type: "workspaceActivated", workspaceId: nextActiveWorkspaceId });
      }
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

  async function handleReorderViews(orderedViewIds: readonly string[]) {
    if (!state.workspaceId) {
      return;
    }

    const currentViewIds = state.views.map((view) => view.id);
    const currentViewIdSet = new Set(currentViewIds);
    const nextOrderedViewIds = orderedViewIds.filter((viewId) => currentViewIdSet.has(viewId));

    for (const viewId of currentViewIds) {
      if (!nextOrderedViewIds.includes(viewId)) {
        nextOrderedViewIds.push(viewId);
      }
    }

    if (
      nextOrderedViewIds.length !== currentViewIds.length ||
      nextOrderedViewIds.join("\0") === currentViewIds.join("\0")
    ) {
      return;
    }

    dispatch({ type: "viewsReordered", orderedViewIds: nextOrderedViewIds });

    try {
      await workspaceClient.reorderViews({
        workspaceId: state.workspaceId,
        orderedViewIds: nextOrderedViewIds,
      });
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.reorderViews")) {
        return;
      }

      dispatch({ type: "viewsReordered", orderedViewIds: currentViewIds });
      toast.error("Could not reorder views", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function refreshActiveViewAfterPatch(viewId: string) {
    if (!state.workspaceId || !state.root) {
      return;
    }

    const [viewsRawResponse, projectionRawResponse] = await Promise.all([
      workspaceClient.listViews({ workspaceId: state.workspaceId }),
      workspaceClient.getViewProjection({ workspaceId: state.workspaceId, viewId }),
    ]);
    const viewsResponse = normalizeViewsResponse(viewsRawResponse, state.workspaceId);
    const projectionResponse = normalizeProjectionResponse(projectionRawResponse);

    dispatch({
      type: "projectionLoaded",
      root: state.root,
      viewsResponse: { ...viewsResponse, activeViewId: viewId },
      projectionResponse,
      folderRoleTree: state.folderRoleTree,
    });
  }

  async function updateActiveViewPatch(
    patch: Record<string, unknown>,
    options: { readonly refreshProjection?: boolean } = { refreshProjection: true },
  ) {
    if (!state.workspaceId || !state.activeViewId) {
      return;
    }

    const activeViewId = state.activeViewId;
    await workspaceClient.updateView({
      workspaceId: state.workspaceId,
      viewId: activeViewId,
      patch,
    });
    if (options.refreshProjection !== false) {
      await refreshActiveViewAfterPatch(activeViewId);
    }
  }

  function getActiveViewState() {
    return state.views.find((view) => view.id === state.activeViewId) || null;
  }

  async function handleTogglePropertyVisibility(propertyId: string, visible: boolean) {
    if (!state.workspaceId || !state.activeViewId) {
      return;
    }

    const activeViewId = state.activeViewId;
    const activeView = getActiveViewState();
    const currentVisiblePropertyIds = activeView?.visiblePropertyIds
      || state.projection?.visibleProperties.map((property) => property.id)
      || ["property:name", "property:status"];
    const nextVisiblePropertyIds = createNextVisiblePropertyIds({
      currentVisiblePropertyIds,
      fallbackVisiblePropertyIds: state.projection?.visibleProperties.map((property) => property.id) || [],
      availablePropertyIds: settingsProperties.map((property) => property.id),
      propertyId,
      visible,
    });
    const previousPropertyOrder = activeView?.propertyOrder || createPropertyOrder(currentVisiblePropertyIds);
    const propertyOrder = createPropertyOrder(nextVisiblePropertyIds);

    try {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: nextVisiblePropertyIds,
        propertyOrder,
      });
      await updateActiveViewPatch({
        visiblePropertyIds: nextVisiblePropertyIds,
        propertyOrder,
      }, {
        refreshProjection: false,
      });
    } catch (error) {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: currentVisiblePropertyIds,
        propertyOrder: previousPropertyOrder,
      });
      toast.error("Could not update view properties", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleToggleValueFilter(propertyId: string, valueId: string, included: boolean) {
    if (!state.activeViewId) {
      return;
    }

    const activeViewId = state.activeViewId;
    const activeView = getActiveViewState();
    const previousValueVisibility = activeView?.valueVisibility || {};
    const valueVisibility = { ...(activeView?.valueVisibility || {}) };
    const existingValueIds = valueVisibility[propertyId]?.valueIds || [];
    const nextValueIds = included
      ? [...new Set([...existingValueIds, valueId])]
      : existingValueIds.filter((id) => id !== valueId);

    if (nextValueIds.length === 0) {
      delete valueVisibility[propertyId];
    } else {
      valueVisibility[propertyId] = {
        valueIds: nextValueIds,
      };
    }

    dispatch({
      type: "viewValueVisibilityUpdated",
      viewId: activeViewId,
      valueVisibility,
    });

    try {
      await updateActiveViewPatch({ valueVisibility });
    } catch (error) {
      dispatch({
        type: "viewValueVisibilityUpdated",
        viewId: activeViewId,
        valueVisibility: previousValueVisibility,
      });
      toast.error("Could not update view filter", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleReorderViewProperties(orderedPropertyIds: readonly string[]) {
    if (!state.workspaceId || !state.activeViewId) {
      return;
    }

    const activeViewId = state.activeViewId;
    const nextVisiblePropertyIds = [...new Set(orderedPropertyIds)];
    const activeView = getActiveViewState();
    const previousVisiblePropertyIds = activeView?.visiblePropertyIds
      || state.projection?.visibleProperties.map((property) => property.id)
      || ["property:name", "property:status"];
    const previousPropertyOrder = activeView?.propertyOrder || createPropertyOrder(previousVisiblePropertyIds);
    const propertyOrder = createPropertyOrder(nextVisiblePropertyIds);

    try {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: nextVisiblePropertyIds,
        propertyOrder,
      });
      await updateActiveViewPatch({
        visiblePropertyIds: nextVisiblePropertyIds,
        propertyOrder,
      }, {
        refreshProjection: false,
      });
    } catch (error) {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: previousVisiblePropertyIds,
        propertyOrder: previousPropertyOrder,
      });
      toast.error("Could not reorder view properties", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleCreateVisibleProperty(input: { name: string; type: WorkspaceCustomPropertyType }) {
    if (!state.workspaceId) {
      toast.error("Select a source folder before adding properties.");
      return;
    }

    try {
      const response = await workspaceClient.createProperty({
        id: createClientDocumentId("property"),
        workspaceId: state.workspaceId,
        name: input.name,
        type: input.type,
      });
      const property = isRecord(response) && isRecord(response.property)
        ? normalizePropertyDefinition(response.property)
        : null;

      await refreshPropertyCatalog();

      if (property?.id) {
        const activeView = getActiveViewState();
        const currentVisiblePropertyIds = [
          ...new Set([
            "property:name",
            "property:status",
            ...(activeView?.visiblePropertyIds
              || state.projection?.visibleProperties.map((item) => item.id)
              || []),
          ]),
        ];
        const nextVisiblePropertyIds = [...new Set([...currentVisiblePropertyIds, property.id])];
        await updateActiveViewPatch({
          visiblePropertyIds: nextVisiblePropertyIds,
          propertyOrder: createPropertyOrder(nextVisiblePropertyIds),
        });
      }

      toast.success("Property added");
    } catch (error) {
      toast.error("Could not add property", {
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

  async function refreshPropertyCatalog() {
    if (!state.workspaceId) {
      return;
    }

    const propertiesResponse = normalizePropertiesResponse(
      await workspaceClient.listProperties({ workspaceId: state.workspaceId, includeUsage: true }),
      state.workspaceId,
    );
    dispatch({
      type: "propertiesLoaded",
      propertiesResponse,
    });
  }

  async function handleCreateProperty(input: { name: string; type: WorkspaceCustomPropertyType }) {
    if (!state.workspaceId) {
      toast.error("Select a source folder before adding properties.");
      return;
    }

    try {
      await workspaceClient.createProperty({
        id: createClientDocumentId("property"),
        workspaceId: state.workspaceId,
        name: input.name,
        type: input.type,
      });
      await refreshPropertyCatalog();
      toast.success("Property added");
    } catch (error) {
      toast.error("Could not add property", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleRenameProperty(propertyId: string, name: string) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.updateProperty({
        workspaceId: state.workspaceId,
        propertyId,
        patch: { name },
      });
      await refreshPropertyCatalog();
      toast.success("Property renamed");
    } catch (error) {
      toast.error("Could not rename property", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleHideProperty(propertyId: string, hidden: boolean) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.updateProperty({
        workspaceId: state.workspaceId,
        propertyId,
        patch: { hidden },
      });
      await refreshPropertyCatalog();
      toast.success(hidden ? "Property hidden" : "Property shown");
    } catch (error) {
      toast.error("Could not update property", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleDeleteProperty(propertyId: string) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.deleteProperty({
        workspaceId: state.workspaceId,
        propertyId,
        confirmDeleteValues: true,
      });
      dispatch({ type: "propertyDeleted", propertyId });
      setSelectedProject((currentProject) => (
        currentProject ? removeProjectPropertyValue(currentProject, propertyId) : currentProject
      ));
      await refreshPropertyCatalog();
      toast.success("Property deleted");
    } catch (error) {
      toast.error("Could not delete property", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleReorderProperties(orderedPropertyIds: readonly string[]) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.reorderProperties({
        workspaceId: state.workspaceId,
        orderedPropertyIds,
      });
      await refreshPropertyCatalog();
      setReloadToken((value) => value + 1);
    } catch (error) {
      toast.error("Could not reorder properties", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleCreateSelectValue(
    propertyId: string,
    input: { name: string; color: string },
  ): Promise<WorkspaceSelectValueState | null> {
    if (!state.workspaceId) {
      return null;
    }

    try {
      const response = await workspaceClient.createSelectValue({
        workspaceId: state.workspaceId,
        propertyId,
        name: input.name,
        color: input.color,
      });
      const selectValue = isRecord(response) && isRecord(response.selectValue)
        ? normalizeSelectValue(response.selectValue)
        : null;
      await refreshPropertyCatalog();
      toast.success("Select value added");
      return selectValue;
    } catch (error) {
      toast.error("Could not add select value", {
        description: getServiceErrorMessage(error),
      });
      return null;
    }
  }

  async function handleRenameSelectValue(selectValueId: string, name: string) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.updateSelectValue({
        workspaceId: state.workspaceId,
        selectValueId,
        patch: { name },
      });
      await refreshPropertyCatalog();
      toast.success("Select value renamed");
    } catch (error) {
      toast.error("Could not rename select value", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleColorSelectValue(selectValueId: string, color: string) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.updateSelectValue({
        workspaceId: state.workspaceId,
        selectValueId,
        patch: { color },
      });
      await refreshPropertyCatalog();
    } catch (error) {
      toast.error("Could not update select value color", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleHideSelectValue(selectValueId: string, hidden: boolean) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.updateSelectValue({
        workspaceId: state.workspaceId,
        selectValueId,
        patch: { hidden },
      });
      await refreshPropertyCatalog();
      setReloadToken((value) => value + 1);
      toast.success(hidden ? "Select value hidden" : "Select value shown");
    } catch (error) {
      toast.error("Could not update select value", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleDeleteSelectValue(selectValueId: string) {
    if (!state.workspaceId) {
      return;
    }

    const selectValue = state.propertyCatalog?.selectValues.find((value) => value.id === selectValueId) || null;

    try {
      await workspaceClient.deleteSelectValue({
        workspaceId: state.workspaceId,
        selectValueId,
        confirmDeleteUsages: true,
      });
      if (selectValue) {
        setSelectedProject((currentProject) => (
          currentProject
            ? removeProjectSelectValue(currentProject, selectValue.propertyId, selectValue.id)
            : currentProject
        ));
      }
      await refreshPropertyCatalog();
      setReloadToken((value) => value + 1);
      toast.success("Select value deleted");
    } catch (error) {
      toast.error("Could not delete select value", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleReorderSelectValues(propertyId: string, orderedSelectValueIds: readonly string[]) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.reorderSelectValues({
        workspaceId: state.workspaceId,
        propertyId,
        orderedSelectValueIds,
      });
      await refreshPropertyCatalog();
    } catch (error) {
      toast.error("Could not reorder select values", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  async function handleProjectPropertyValueChange(projectId: string, propertyId: string, value: unknown) {
    if (!state.workspaceId) {
      return;
    }

    const requestVersion = createPropertySaveRequestVersion(projectId, propertyId);
    dispatch({
      type: "projectPropertyValueSaveStarted",
      projectId,
      propertyId,
      requestVersion,
    });

    try {
      await workspaceClient.updateProjectPropertyValue({
        workspaceId: state.workspaceId,
        projectId,
        propertyId,
        value,
      });
      dispatch({
        type: "projectPropertyValueUpdated",
        projectId,
        propertyId,
        value,
        requestVersion,
      });
      if (isCurrentPropertySaveRequest(projectId, propertyId, requestVersion)) {
        setSelectedProject((currentProject) => (
          currentProject?.id === projectId
            ? {
                ...currentProject,
                propertyValues: {
                  ...currentProject.propertyValues,
                  [propertyId]: value,
                },
              }
            : currentProject
        ));
      }
    } catch (error) {
      const message = getServiceErrorMessage(error);
      dispatch({ type: "propertySaveFailed", error: message, projectId, propertyId, requestVersion });
      if (isCurrentPropertySaveRequest(projectId, propertyId, requestVersion)) {
        toast.error("Could not save property value", {
          description: message,
        });
      }
    }
  }

  async function loadProjectFileTree(project: WorkspaceMockProject) {
    try {
      const fileTree = normalizeProjectFileTreeResponse(
        await workspaceClient.listProjectFileTree({ path: project.currentRelativePath }),
      );
      setSelectedProject((currentProject) => (
        currentProject?.id === project.id ? { ...currentProject, fileTree } : currentProject
      ));
    } catch (error) {
      toast.error("Could not load project files", {
        description: getServiceErrorMessage(error),
      });
    }
  }

  function handleProjectOpen(project: WorkspaceMockProject) {
    setSelectedProject(project);
    if (state.status === "ready" && state.root) {
      void loadProjectFileTree(project);
    }
  }

  function dismissWorkspaceFloatingMenus() {
    setWorkspaceFloatingDismissToken((currentToken) => currentToken + 1);
  }

  function openWorkspaceSurface() {
    setActiveSurface("workspace");
  }

  function openSettingsSurface() {
    setSelectedProject(null);
    setActiveSurface("settings");
  }

  const shouldUseMockViews = !state.root && !state.workspaceId;
  const viewState = {
    activeViewId: state.activeViewId || (shouldUseMockViews ? workspaceMockProjection.activeViewId : ""),
    views: state.views.length > 0 ? state.views : shouldUseMockViews ? workspaceMockProjection.views : [],
  };
  const navigationWorkspaces = workspaceList.workspaces.length > 0
    ? workspaceList.workspaces
    : state.root
      ? [{ id: state.workspaceId || state.root.workspaceId, name: state.root.name || "Workspace", order: 10 }]
      : [{ id: viewState.activeViewId, name: "Operations", order: 10 }];
  const sourceFolder = state.root
    ? {
        name: state.root.name,
        path: state.root.path || "Path unavailable",
        state: "connected",
      }
    : workspaceMockSettings.sourceFolder;
  const serviceProjection = useMemo(
    () => {
      if (!state.projection) {
        return null;
      }

      const projectionMatchesActiveWorkspace = state.projection.workspaceId === state.workspaceId &&
        state.projection.view.id === state.activeViewId;
      const projectionIsStaleWorkspaceSurface = state.workspaceSwitchPending &&
        state.projection.workspaceId !== state.workspaceId;

      if (!projectionMatchesActiveWorkspace && !projectionIsStaleWorkspaceSurface) {
        return null;
      }

      return filterWorkspaceProjectionBySearch(state.projection, state.searchQuery);
    },
    [state.activeViewId, state.projection, state.searchQuery, state.workspaceId, state.workspaceSwitchPending],
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
  const statusValues =
    serviceProjection?.statusValues ?? workspaceMockProjection.statusValues;
  const boardProjection =
    serviceProjection?.projection.type === "board"
      ? serviceProjection.projection
      : mockBoardProjectionResponse.projection;
  const tableProjection =
    serviceProjection?.projection.type === "table"
      ? serviceProjection.projection
      : mockTableProjectionResponse.projection;
  const folderRoleTree = state.root ? state.folderRoleTree : workspaceMockSettings.folderRoleTree;
  const settingsProperties = state.propertyCatalog?.properties ?? visibleProperties;
  const settingsSelectValues = state.propertyCatalog?.selectValues ?? [];
  const detailProperties = state.propertyCatalog?.properties ?? visibleProperties;
  const isWorkspaceSwitchPendingSurface = activeSurface === "workspace" &&
    state.workspaceSwitchPending &&
    serviceProjection !== null &&
    serviceProjection.workspaceId !== state.workspaceId;
  const shouldShowWorkspaceLoadingState =
    (
      state.status === "loading" ||
      state.status === "idle" ||
      (state.status === "ready" && !!state.root && !state.sourceFolderMissing && !serviceProjection)
    );

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
        <main data-testid="workspace-main" className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header
            className={[
              "electron-window-drag flex h-12 shrink-0 items-center gap-2 pr-4",
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
                    properties={settingsProperties}
                    selectValues={settingsSelectValues}
                    onSelectFolder={handleSelectFolder}
                    onCloseSettings={openWorkspaceSurface}
                    onFolderRoleChange={handleFolderRoleChange}
                    onCreateProperty={handleCreateProperty}
                    onRenameProperty={handleRenameProperty}
                    onHideProperty={handleHideProperty}
                    onDeleteProperty={handleDeleteProperty}
                    onReorderProperties={handleReorderProperties}
                    onCreateSelectValue={handleCreateSelectValue}
                    onRenameSelectValue={handleRenameSelectValue}
                    onColorSelectValue={handleColorSelectValue}
                    onHideSelectValue={handleHideSelectValue}
                    onDeleteSelectValue={handleDeleteSelectValue}
                    onReorderSelectValues={handleReorderSelectValues}
                    selectingFolder={selectingFolder}
                  />
                </>
              )}
            </div>
          ) : (
            <div
              aria-busy={isWorkspaceSwitchPendingSurface || undefined}
              className={[
                "electron-window-no-drag flex min-h-0 flex-1 flex-col overflow-hidden",
                isWorkspaceSwitchPendingSurface ? "pointer-events-none select-none" : "",
              ].join(" ")}
            >
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
                onReorderViews={handleReorderViews}
                dismissSignal={workspaceFloatingDismissToken}
                properties={settingsProperties}
                selectValues={settingsSelectValues}
                statusValues={statusValues}
                onTogglePropertyVisibility={handleTogglePropertyVisibility}
                onToggleValueFilter={handleToggleValueFilter}
                onReorderViewProperties={handleReorderViewProperties}
                onRenameProperty={handleRenameProperty}
                onDeleteProperty={handleDeleteProperty}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                {shouldShowWorkspaceLoadingState ? (
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
                        selectValues={settingsSelectValues}
                        onProjectOpen={handleProjectOpen}
                      />
                    ) : null}
                    {activeViewType === "table" ? (
                      <WorkspaceTableView
                        projection={tableProjection as typeof workspaceMockProjection.tableProjection}
                        view={activeView ?? null}
                        visibleProperties={visibleProperties as typeof workspaceMockProjection.visibleProperties}
                        properties={settingsProperties}
                        selectValues={settingsSelectValues}
                        statusValues={statusValues}
                        onProjectOpen={handleProjectOpen}
                        onCreateProperty={handleCreateVisibleProperty}
                        onRenameProperty={handleRenameProperty}
                        onDeleteProperty={handleDeleteProperty}
                        onReorderViewProperties={handleReorderViewProperties}
                        onTogglePropertyVisibility={handleTogglePropertyVisibility}
                        onToggleValueFilter={handleToggleValueFilter}
                        onProjectPropertyValueChange={handleProjectPropertyValueChange}
                        onCreateSelectValue={handleCreateSelectValue}
                        onRenameSelectValue={handleRenameSelectValue}
                        onColorSelectValue={handleColorSelectValue}
                        onDeleteSelectValue={handleDeleteSelectValue}
                        onDismissFloatingMenus={dismissWorkspaceFloatingMenus}
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
          visibleProperties={detailProperties}
          selectValues={settingsSelectValues}
          onProjectPropertyValueChange={handleProjectPropertyValueChange}
          onCreateSelectValue={handleCreateSelectValue}
          onRenameSelectValue={handleRenameSelectValue}
          onColorSelectValue={handleColorSelectValue}
          onDeleteSelectValue={handleDeleteSelectValue}
          onCreateProperty={handleCreateVisibleProperty}
          onRenameProperty={handleRenameProperty}
          onHideProperty={handleHideProperty}
          onDeleteProperty={handleDeleteProperty}
        />
      </div>
      <Toaster richColors />
    </>
  );
}
