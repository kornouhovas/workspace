import { createGroupingMutationQueue, type GroupingMutation } from "@/workspaceGroupingMutations.js";
import { normalizeGrouping } from "@/workspaceGrouping.js";
import { focusedPaneCloseCommand } from "@/workspacePaneKeyboard.js";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { WorkspaceBoardView } from "@/components/workspace/board-view";
import { WorkspaceLeftPanel } from "@/components/workspace/left-panel";
import { ProjectMoveIndicator } from "@/components/workspace/project-move-indicator";
import { createProjectMoveController, type ProjectMovePending, type ProjectStatusMoveOption } from "@/workspaceProjectMoveState.js";
import { WorkspaceProjectDetailPanel } from "@/components/workspace/project-detail-panel";
import { GlobalSettingsView, WorkspaceSettingsView } from "@/components/workspace/settings-view";
import { WorkspaceEmptyState } from "@/components/workspace/states";
import { WorkspaceTableView } from "@/components/workspace/table-view";
import { WorkspaceViewTabs } from "@/components/workspace/view-tabs";
import { WorkspaceProjectTabs } from "@/components/workspace/project-tabs";
import { Button } from "@/components/ui/button";
import { projectTabsReducer, projectTabCloseSelection } from "@/workspaceProjectTabs.js";
import { duplicateWorkspaceView } from "@/duplicateWorkspaceView.js";
import { readProjectSession, writeProjectSession } from "@/workspaceProjectSession.js";
import { installMenuHoverMemory } from "@/components/ui/menu-hover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createPaneLayout,
  paneLayoutReducer,
  readPaneLayouts,
  readSidebarWidth,
  writeSidebarWidth,
  writePaneLayouts,
} from "@/workspacePaneLayout.js";
import { WorkspaceSplitTree } from "@/components/workspace/split-tree";
import { listWorkspacePanes, type SplitSide } from "@/workspaceSplitTree.js";
import type { PaneAction } from "@/workspacePaneLayout";
import {
  ChromeAction,
  ChromeIcon,
  PaneResize,
  WorkspaceRightPanel,
} from "@/components/workspace/pane-chrome";
import ExpandIcon from "@hugeicons/core-free-icons/ExpandIcon";
import CollapseIcon from "@hugeicons/core-free-icons/CollapseIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useI18n } from "@/i18n";
import {
  RendererLocalizedError,
  createRendererErrorState,
  resolveRendererErrorState,
} from "@/i18n/errors.js";
import {
  FolderIcon,
  PanelLeftIcon,
  XIcon,
} from "@/lib/workspace-icons";
import {
  workspaceMockProjection,
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
  BOARD_COLUMN_WIDTH_DEFAULT,
  getBoardColumnWidthMax,
  normalizeBoardColumnWidth,
} from "@/workspaceBoardLayout.js";
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
import { createNextVisiblePropertyIds, createPropertyOrder } from "@/workspaceViewVisibility.js";
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

function normalizeViewPropertyLayout(
  value: unknown,
): NonNullable<WorkspaceViewState["propertyLayout"]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const propertyLayout = Object.fromEntries(
    Object.entries(value).flatMap(([propertyId, setting]) => {
      if (!isRecord(setting) || setting.wrapContent !== true) {
        return [];
      }

      return [[propertyId, { wrapContent: true }]];
    }),
  );

  return Object.keys(propertyLayout).length > 0 ? propertyLayout : {};
}

function normalizeViewBoardLayout(value: unknown): NonNullable<WorkspaceViewState["boardLayout"]> {
  return {
    columnWidth: normalizeBoardColumnWidth(isRecord(value) ? value.columnWidth : undefined),
  };
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
    ? response.views
        .filter(isRecord)
        .map((view) => ({
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

                  return [
                    [
                      propertyId,
                      {
                        valueIds: Array.isArray(setting.valueIds)
                          ? setting.valueIds.filter(
                              (valueId): valueId is string => typeof valueId === "string",
                            )
                          : [],
                        includeEmpty: setting.includeEmpty === true,
                      },
                    ],
                  ];
                }),
              )
            : undefined,
          propertyLayout: normalizeViewPropertyLayout(view.propertyLayout),
          boardLayout: normalizeViewBoardLayout(view.boardLayout),
          grouping: normalizeGrouping(view.grouping),
          groupingNotice: getString(view.groupingNotice) || null,
        }))
        .filter((view) => view.id)
    : [];

  return {
    workspaceId: getString(response.workspaceId) || workspaceId,
    activeViewId: getString(response.activeViewId) || null,
    views,
  };
}

function normalizeProjectionResponse(response: unknown): WorkspaceProjectionResponse {
  if (!isRecord(response) || !isRecord(response.view) || !isRecord(response.projection)) {
    throw new RendererLocalizedError("error.invalidProjectionResponse");
  }

  return response as WorkspaceProjectionResponse;
}

function normalizePropertiesResponse(
  response: unknown,
  workspaceId: string,
): WorkspacePropertyCatalogState {
  const body = isRecord(response) ? response : {};
  const properties = Array.isArray(body.properties)
    ? body.properties
        .filter(isRecord)
        .map(normalizePropertyDefinition)
        .filter((property) => property.id)
    : [];
  const selectValues = Array.isArray(body.selectValues)
    ? body.selectValues
        .filter(isRecord)
        .map(normalizeSelectValue)
        .filter((value) => value.id && value.propertyId)
    : [];

  return {
    workspaceId: getString(body.workspaceId) || workspaceId,
    properties,
    selectValues,
    usage: isRecord(body.usage)
      ? (body.usage as WorkspacePropertyCatalogState["usage"])
      : undefined,
  };
}

function normalizePropertyDefinition(
  property: Record<string, unknown>,
): WorkspacePropertyDefinitionState {
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

function normalizeProjectFileTreeNode(
  node: Record<string, unknown>,
): WorkspaceMockFileTreeNode | null {
  const name = getString(node.name);
  const relativePath = getString(node.relativePath) || getString(node.path);
  if (!name || !relativePath) {
    return null;
  }

  const kind = node.kind === "file" ? "file" : "folder";
  const children =
    kind === "folder" && Array.isArray(node.children)
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

function removeProjectPropertyValue(
  project: WorkspaceMockProject,
  propertyId: string,
): WorkspaceMockProject {
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
      visiblePropertyIds: Array.isArray(view.visiblePropertyIds)
        ? view.visiblePropertyIds.filter(
            (propertyId): propertyId is string => typeof propertyId === "string",
          )
        : fallbackView.visiblePropertyIds,
      propertyOrder: isRecord(view.propertyOrder)
        ? Object.fromEntries(
            Object.entries(view.propertyOrder)
              .filter(([, order]) => Number.isFinite(Number(order)))
              .map(([propertyId, order]) => [propertyId, Number(order)]),
          )
        : fallbackView.propertyOrder,
      valueVisibility: isRecord(view.valueVisibility)
        ? Object.fromEntries(
            Object.entries(view.valueVisibility).flatMap(([propertyId, setting]) => {
              if (!isRecord(setting)) {
                return [];
              }

              return [
                [
                  propertyId,
                  {
                    valueIds: Array.isArray(setting.valueIds)
                      ? setting.valueIds.filter(
                          (valueId): valueId is string => typeof valueId === "string",
                        )
                      : [],
                    includeEmpty: setting.includeEmpty === true,
                  },
                ],
              ];
            }),
          )
        : fallbackView.valueVisibility,
      propertyLayout:
        normalizeViewPropertyLayout(view.propertyLayout) || fallbackView.propertyLayout,
      boardLayout: normalizeViewBoardLayout(view.boardLayout || fallbackView.boardLayout),
      grouping: normalizeGrouping(view.grouping),
      groupingNotice: getString(view.groupingNotice) || null,
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

function normalizeFolderRoleNode(
  node: Record<string, unknown>,
  depth = 0,
): WorkspaceFolderRoleNode | null {
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

function getServiceErrorMessage(error: unknown, t: (key: string) => string) {
  return resolveRendererErrorState(createRendererErrorState(error), t);
}

function WorkspaceLoadingState() {
  const { t } = useI18n();

  return (
    <div className="grid gap-4 px-4 py-4" role="status" aria-label={t("common.loading")}>
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
  const { t } = useI18n();

  if (state.status !== "error" || !state.error) {
    return null;
  }

  return (
    <div role="alert" className="mx-4 mt-4 rounded-lg border border-surface-destructive-border bg-surface-destructive px-3 py-2 text-sm text-destructive-text">
      {t("state.serviceUnavailable", { error: resolveRendererErrorState(state.error, t) })}
    </div>
  );
}

type WorkspaceSurface = "workspace" | "settings" | "workspace-settings";

function createClientDocumentId(prefix: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${randomId}`;
}

export default function App() {
  const { t, locale } = useI18n();
  const [state, dispatch] = useReducer(
    workspaceAppStateReducer,
    undefined,
    createInitialWorkspaceAppState,
  );
  const [activeSurface, setActiveSurface] = useState<WorkspaceSurface>("workspace");
  const navigationSurfaceVersion = useRef(0);
  useEffect(installMenuHoverMemory, []);

  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    try {
      const saved = window.localStorage.getItem("workspace.theme");
      return saved === "dark" || saved === "light" ? saved : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    try {
      window.localStorage.setItem("workspace.theme", theme);
    } catch {
      /* An unavailable session store must not block the UI. */
    }
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const [selectedProject, setSelectedProject] = useState<WorkspaceMockProject | null>(null);
  const [activeProjectTabId, setActiveProjectTabId] = useState<string | null>(null);
  const [projectTabSelected, setProjectTabSelected] = useState(false);
  const [savedProjectSession] = useState(() => readProjectSession(window.localStorage));
  const [projectTabsByWorkspace, dispatchProjectTabs] = useReducer(
    projectTabsReducer,
    savedProjectSession.tabs,
  );
  const workspaceScreenMemory = useRef(new Map(Object.entries(savedProjectSession.screens)));
  const restoreStartupScreen = useRef(true);
  const pendingWorkspaceScreen = useRef<string | null>(null);
  const [paneLayouts, setPaneLayouts] = useState(() => readPaneLayouts(window.localStorage));
  const [sidebarWidth, setSidebarWidth] = useState(() => readSidebarWidth(window.localStorage, paneLayouts));
  useEffect(() => { writeSidebarWidth(window.localStorage, sidebarWidth); }, [sidebarWidth]);
  const workspaceSwitchVersion = useRef(0);
  const workspaceSwitchQueue = useRef(Promise.resolve());
  const [closedProjectTabs, setClosedProjectTabs] = useState<
    Record<string, (typeof savedProjectSession.tabs)[string]>
  >({});
  const [workspaceList, setWorkspaceList] = useState<WorkspaceListState>({
    activeWorkspaceId: null,
    workspaces: [],
  });
  const [reloadToken, setReloadToken] = useState(0);
  const projectTabsWorkspaceId = state.workspaceId || workspaceList.activeWorkspaceId || "preview";
  const paneLayout = { ...(paneLayouts[projectTabsWorkspaceId] || createPaneLayout()), sidebarWidth };
  const sidebarCollapsed = paneLayout.sidebarCollapsed;
  function sendPane(action: PaneAction) {
    if (action.type === "resizeSidebar") {
      setSidebarWidth(Math.min(460, Math.max(240, action.width)));
      return;
    }
    setPaneLayouts((current) => ({
      ...current,
      [projectTabsWorkspaceId]: paneLayoutReducer(
        current[projectTabsWorkspaceId] || createPaneLayout(),
        action,
      ),
    }));
  }
  useEffect(() => {
    writePaneLayouts(window.localStorage, paneLayouts);
  }, [paneLayouts]);
  const expandedProjectTabs = projectTabsByWorkspace[projectTabsWorkspaceId] || [];
  useEffect(() => {
    const valid = new Set(expandedProjectTabs.map((tab) => tab.tabId));
    for (const pane of listWorkspacePanes(paneLayout.tree))
      if (pane.tabId && !valid.has(pane.tabId))
        sendPane({ type: "closePane", paneId: pane.paneId });
  }, [projectTabsByWorkspace, projectTabsWorkspaceId]);
  const projectExpanded =
    selectedProject !== null &&
    expandedProjectTabs.some(
      (project) => project.tabId === activeProjectTabId && project.id === selectedProject.id,
    );

  const projectFullScreen = activeSurface === "workspace" && projectExpanded && (projectTabSelected || !listWorkspacePanes(paneLayout.tree).some((pane) => pane.tabId === activeProjectTabId));

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.workspaceSwitchPending ||
      pendingWorkspaceScreen.current ||
      restoreStartupScreen.current
    )
      return;
    if (activeSurface === "workspace") {
      workspaceScreenMemory.current.set(projectTabsWorkspaceId, {
        viewId: state.activeViewId,
        tabId: projectExpanded ? activeProjectTabId : null,
        fullScreen: projectFullScreen,
        previewId: !projectExpanded ? selectedProject?.id || null : null,
      });
    }
    writeProjectSession(
      window.localStorage,
      projectTabsByWorkspace,
      Object.fromEntries(workspaceScreenMemory.current),
    );
  }, [
    projectTabsByWorkspace,
    projectTabsWorkspaceId,
    projectExpanded,
    projectFullScreen,
    activeProjectTabId,
    selectedProject,
    state.status,
    state.workspaceSwitchPending,
    state.activeViewId,
    activeSurface,
  ]);

  useEffect(() => {
    if (selectedProject) {
      dispatchProjectTabs({
        type: "update",
        workspaceId: projectTabsWorkspaceId,
        project: selectedProject,
      });
    }
  }, [selectedProject, projectTabsWorkspaceId]);

  function createExpandedProject(project: WorkspaceMockProject, afterTabId?: string) {
    const existing = !afterTabId && expandedProjectTabs.find((tab) => tab.id === project.id);
    if (existing) {
      handleProjectOpen(project, existing.tabId, true);
      return existing.tabId;
    }
    const tabId = createClientDocumentId("project-tab");
    dispatchProjectTabs({
      type: "expand",
      workspaceId: projectTabsWorkspaceId,
      project,
      tabId,
      afterTabId,
    });
    handleProjectOpen(project, tabId, true);
    return tabId;
  }

  function openProjectInSplit(
    project: WorkspaceMockProject,
    tabId?: string,
    target?: string,
    side: SplitSide | "center" = "right",
  ) {
    const identity = tabId || createExpandedProject(project);
    if (tabId) handleProjectOpen(project, tabId);
    if (side === "center" && target) {
      const existing = listWorkspacePanes(paneLayout.tree).find((p) => p.tabId === identity);
      if (existing) sendPane({ type: "focus", pane: existing.paneId });
      else sendPane({ type: "replacePane", paneId: target, tabId: identity });
    } else
      sendPane({
        type: "split",
        tabId: identity,
        target,
        paneId: createClientDocumentId("pane"),
        side: side === "center" ? "right" : side,
      });
  }
  function closeLayoutPane(paneId: string) {
    const panes = listWorkspacePanes(paneLayout.tree);
    const closed = panes.find((p) => p.paneId === paneId);
    if (panes.length < 2) return;
    sendPane({ type: "closePane", paneId });
    if (paneLayout.focused === paneId || (closed?.tabId && activeProjectTabId === closed.tabId)) {
      const remaining = panes.filter((p) => p.paneId !== paneId);
      const next =
        remaining[
          Math.min(
            panes.findIndex((p) => p.paneId === paneId),
            remaining.length - 1,
          )
        ];
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(next.paneId)}"]`)
          ?.focus({ preventScroll: true }),
      );
      const project = expandedProjectTabs.find((p) => p.tabId === next.tabId);
      if (project) handleProjectOpen(project, project.tabId);
      else {
        setSelectedProject(null);
        setActiveProjectTabId(null);
      }
    }
  }

  function toggleProjectExpanded() {
    if (!selectedProject) return;
    if (projectExpanded && activeProjectTabId) {
      dispatchProjectTabs({
        type: "remove",
        workspaceId: projectTabsWorkspaceId,
        tabId: activeProjectTabId,
      });
      setActiveProjectTabId(null);
      sendPane({ type: "previewProject" });
    } else {
      createExpandedProject(selectedProject);
    }
  }

  function closeProjectTabs(tabIds: readonly string[]) {
    const closed = expandedProjectTabs.filter((tab) => tabIds.includes(tab.tabId));
    if (!closed.length) return;
    const fallback = projectTabCloseSelection(expandedProjectTabs, activeProjectTabId, tabIds);
    setClosedProjectTabs((current) => ({
      ...current,
      [projectTabsWorkspaceId]: [...(current[projectTabsWorkspaceId] || []), ...closed].slice(-20),
    }));
    for (const pane of listWorkspacePanes(paneLayout.tree))
      if (pane.tabId && tabIds.includes(pane.tabId))
        sendPane({ type: "closePane", paneId: pane.paneId });
    for (const tab of closed)
      dispatchProjectTabs({
        type: "remove",
        workspaceId: projectTabsWorkspaceId,
        tabId: tab.tabId,
      });
    if (!activeProjectTabId || !tabIds.includes(activeProjectTabId)) return;
    if (fallback) handleProjectOpen(fallback, fallback.tabId);
    else {
      setActiveProjectTabId(null);
      setSelectedProject(null);
      sendPane({ type: "closeSplit" });
    }
    requestAnimationFrame(() => {
      const target = fallback
        ? document.querySelector<HTMLButtonElement>(
            `[data-project-tab-id="${CSS.escape(fallback.tabId)}"]`,
          )
        : document.querySelector<HTMLButtonElement>('[data-view-tab-id][aria-selected="true"]');
      target?.focus({ preventScroll: true });
    });
  }
  function closeProjectTab(tabId: string) {
    closeProjectTabs([tabId]);
  }

  function reopenProjectTab() {
    const closed = closedProjectTabs[projectTabsWorkspaceId] || [];
    const project = closed.at(-1);
    if (!project) return;
    setClosedProjectTabs((current) => ({
      ...current,
      [projectTabsWorkspaceId]: closed.slice(0, -1),
    }));
    dispatchProjectTabs({
      type: "expand",
      workspaceId: projectTabsWorkspaceId,
      project,
      tabId: project.tabId,
    });
    handleProjectOpen(project, project.tabId);
  }
  function closeSelectedProject() {
    if (projectExpanded && activeProjectTabId) {
      closeProjectTab(activeProjectTabId);
      return;
    }
    setActiveProjectTabId(null);
    setSelectedProject(null);
    sendPane({ type: "closeSplit" });
  }
  const [workspaceFloatingDismissToken, setWorkspaceFloatingDismissToken] = useState(0);
  const [boardViewportWidth, setBoardViewportWidth] = useState(0);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      const editing =
        event.target instanceof Element &&
        event.target.closest("input,textarea,select,[contenteditable=true],[role=menu]");
      if (editing) return;
      const key = event.key.toLowerCase();
      if (key === "j") {
        event.preventDefault();
        sendPane({ type: "rightToggle" });
      }
      if (key === "\\") {
        event.preventDefault();
        sendPane({ type: "sidebarToggle" });
      }
      if (key === "t" && !event.shiftKey) {
        event.preventDefault();
        sendPane({ type: "rightOpen", id: "launcher" });
      }
      if (key === "t" && event.shiftKey) {
        event.preventDefault();
        if (paneLayout.focused === "right") sendPane({ type: "rightReopen" });
        else reopenProjectTab();
      }
      if (key === "w") {
        event.preventDefault();
        const command = focusedPaneCloseCommand(paneLayout, activeProjectTabId, projectExpanded);
        if (command?.kind === "rightTab") sendPane({ type: "rightClose", id: command.id });
        else if (command?.kind === "pane") closeLayoutPane(command.id);
        else if (command?.kind === "projectTab") closeProjectTab(command.id);
      }
      if (key === "e" && event.shiftKey) {
        event.preventDefault();
        sendPane({ type: "maximize", pane: paneLayout.focused });
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    paneLayout,
    projectTabsWorkspaceId,
    selectedProject,
    activeProjectTabId,
    expandedProjectTabs,
    closedProjectTabs,
  ]);

  const [selectingFolder, setSelectingFolder] = useState(false);
  const folderPickerWorkspaceRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const activeViewIdRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);
  const propertySaveRequestVersionsRef = useRef(new Map<string, number>());
  const folderSelectionPendingRef = useRef(false);
  const workspaceClient = useMemo(
    () => new WorkspaceServiceClient(createWorkspaceRendererTransport()),
    [],
  );

  const [projectMovePending, setProjectMovePending] = useState<ProjectMovePending | null>(null);
  const projectMoveController = useMemo(() => createProjectMoveController(workspaceClient, setProjectMovePending), [workspaceClient]);

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

  function isCurrentPropertySaveRequest(
    projectId: string,
    propertyId: string,
    requestVersion: number,
  ) {
    return (
      propertySaveRequestVersionsRef.current.get(createPropertySaveKey(projectId, propertyId)) ===
      requestVersion
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
        const root = normalizeRootResponse(await workspaceClient.getRoot({ workspaceId: pendingWorkspaceScreen.current || undefined }));
        if (!isCurrentLoad()) {
          return;
        }

        if (!root || !root.path) {
          const workspaces = await workspaceClient.listWorkspaces() as WorkspaceListState;
          if (!isCurrentLoad()) return;
          setWorkspaceList(workspaces);
          dispatch({ type: "sourceFolderMissing", root });
          workspaceIdRef.current = root?.workspaceId || null;
          pendingWorkspaceScreen.current = null;
          return;
        }

        const previousWorkspaceId = workspaceIdRef.current;
        const [scanResponse, viewsRawResponse, workspacesResponse, propertiesRawResponse] =
          await Promise.all([
            workspaceClient.scan({ workspaceId: root.workspaceId, includeCardChildren: activeSurface === "workspace-settings" }),
            workspaceClient.listViews({ workspaceId: root.workspaceId }),
            loadWorkspaceList(workspaceClient, root),
            workspaceClient.listProperties({ workspaceId: root.workspaceId, includeUsage: true }),
          ]);
        const folderRoleTree = normalizeFolderRoleTree(scanResponse);
        const viewsResponse = normalizeViewsResponse(viewsRawResponse, root.workspaceId);
        const propertiesResponse = normalizePropertiesResponse(
          propertiesRawResponse,
          root.workspaceId,
        );
        const requestedActiveViewId =
          restoreStartupScreen.current || pendingWorkspaceScreen.current === root.workspaceId
            ? workspaceScreenMemory.current.get(root.workspaceId)?.viewId ||
              viewsResponse.activeViewId
            : workspaceIdRef.current === root.workspaceId ||
                previousWorkspaceId === root.workspaceId
              ? activeViewIdRef.current
              : null;
        const requestedViewExists = viewsResponse.views.some(
          (view) => view.id === requestedActiveViewId,
        );
        const activeViewId = requestedViewExists
          ? requestedActiveViewId
          : viewsResponse.activeViewId || viewsResponse.views[0]?.id;
        if (!activeViewId) {
          throw new RendererLocalizedError("error.activeViewUnavailable");
        }

        const projectionResponse = normalizeProjectionResponse(
          await workspaceClient.getViewProjection({
            workspaceId: root.workspaceId,
            viewId: activeViewId,
            locale,
          }),
        );

        const savedScreen = workspaceScreenMemory.current.get(root.workspaceId);
        const restoreScreen = restoreStartupScreen.current || pendingWorkspaceScreen.current === root.workspaceId;
        const previewResponse = restoreScreen && savedScreen?.previewId
          ? await workspaceClient.getProject({ workspaceId: root.workspaceId, projectId: savedScreen.previewId })
          : null;
        const restoredPreview = isRecord(previewResponse) && isRecord(previewResponse.project) ? previewResponse.project : null;
        if (isCurrentLoad()) {
          setWorkspaceList(workspacesResponse);
          workspaceIdRef.current = root.workspaceId;
          dispatch({
            type: "projectionLoaded",
            replaceWorkspace: true,
            root,
            viewsResponse: { ...viewsResponse, activeViewId },
            projectionResponse,
            folderRoleTree,
          });
          dispatch({
            type: "propertiesLoaded",
            propertiesResponse,
          });
          if (restoreStartupScreen.current || pendingWorkspaceScreen.current === root.workspaceId) {
            restoreStartupScreen.current = false;
            pendingWorkspaceScreen.current = null;
            const tabId = workspaceScreenMemory.current.get(root.workspaceId)?.tabId;
            const cachedProject = projectTabsByWorkspace[root.workspaceId]?.find(
              (item) => item.tabId === tabId,
            );
            const projectId = cachedProject?.id || workspaceScreenMemory.current.get(root.workspaceId)?.previewId;
            const projects =
              projectionResponse.projection.type === "board"
                ? projectionResponse.projection.columns.flatMap((column) => column.projects)
                : projectionResponse.projection.rows;
            const freshProject = restoredPreview || projects.find((item) => isRecord(item) && item.id === projectId);
            const project = isRecord(freshProject)
              ? ({ ...cachedProject, ...freshProject } as WorkspaceMockProject)
              : cachedProject;
            // A removed preview cannot leave a visible empty shell. Expanded
            // tabs retain their existing cached behavior and identities.
            if (!project && projectId) {
              setPaneLayouts(current => ({ ...current, [root.workspaceId]: paneLayoutReducer(current[root.workspaceId] || createPaneLayout(), { type: "selectView" }) }));
              toast.error(t("error.projectUnavailable"));
            }
            setActiveProjectTabId(project ? tabId || null : null);
            setSelectedProject(project || null);
            setProjectTabSelected(workspaceScreenMemory.current.get(root.workspaceId)?.fullScreen === true);
            if (project) void loadProjectFileTree(project, root.workspaceId);
          }
          if (folderSelectionPendingRef.current) {
            folderSelectionPendingRef.current = false;
            setSelectingFolder(false);
            toast.success(t("toast.folderSelected"));
          }
        }
      } catch (error) {
        const errorState = createRendererErrorState(error);
        const message = resolveRendererErrorState(errorState, t);
        if (isCurrentLoad()) {
          // Keep navigation and the stored path available for source recovery.
          const root = normalizeRootResponse(await workspaceClient.getRoot({ workspaceId: pendingWorkspaceScreen.current || undefined }).catch(() => null));
          const recoveredWorkspaces = root ? await loadWorkspaceList(workspaceClient, root).catch(() => workspaceList) : null;
          if (!isCurrentLoad()) return;
          if (root && recoveredWorkspaces) {
            workspaceIdRef.current = root.workspaceId;
            dispatch({ type: "sourceFolderMissing" });
            dispatch({ type: "rootSelected", root });
            setWorkspaceList(recoveredWorkspaces);
            setSelectedProject(null);
          }
          pendingWorkspaceScreen.current = null;
          restoreStartupScreen.current = false;
          dispatch({ type: "serviceError", error: errorState });
          if (folderSelectionPendingRef.current) {
            folderSelectionPendingRef.current = false;
            setSelectingFolder(false);
            toast.error(t("toast.folderLoadFailed"), {
              description: message,
            });
          } else {
            toast.error(t("toast.serviceUnavailable"), {
              description: t("toast.serviceUnavailableDescription"),
            });
          }
        }
      }
    }

    void loadWorkspaceState();

    return () => {
      cancelled = true;
    };
  // Locale changes local presentation only. A later legitimate load uses the current locale.
  }, [activeSurface, reloadToken, workspaceClient]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.sourceFolderMissing ||
      state.workspaceSwitchPending ||
      !state.workspaceId ||
      !state.activeViewId ||
      !state.root ||
      (state.projection?.workspaceId === state.workspaceId &&
        state.projection.view.id === state.activeViewId &&
        !state.projectionRefreshing)
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
            locale,
          }),
        );

        if (!cancelled) {
          dispatch({ type: "projectionUpdated", projectionResponse });
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(t("toast.viewLoadFailed"), {
            description: getServiceErrorMessage(error, t),
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
    const requestWorkspaceId = state.workspaceId || workspaceList.activeWorkspaceId || undefined;
    const version = workspaceSwitchVersion.current;
    folderPickerWorkspaceRef.current = requestWorkspaceId || null;
    setSelectingFolder(true);
    try {
      const root = normalizeRootResponse(await workspaceClient.setRoot({ workspaceId: requestWorkspaceId }));
      if (!root) return; // Native picker cancellation leaves the session intact.
      if (workspaceSwitchVersion.current !== version || workspaceIdRef.current !== (requestWorkspaceId || null)) return;
      pendingWorkspaceScreen.current = root.workspaceId;
      folderSelectionPendingRef.current = true;
      loadRequestIdRef.current += 1;
      setReloadToken(value => value + 1);
    } catch (error) {
      toast.error(t("toast.folderLoadFailed"), { description: getServiceErrorMessage(error, t) });
    } finally {
      if (!folderSelectionPendingRef.current) setSelectingFolder(false);
    }
  }

  async function handleAddWorkspace() {
    const surfaceVersion = ++navigationSurfaceVersion.current;
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
              ? current.workspaces.map((item) => (item.id === workspace.id ? workspace : item))
              : [...current.workspaces, workspace],
          };
        });
        dispatch({ type: "workspaceActivated", workspaceId: activeWorkspaceId });
      }
      setSelectedProject(null);
      if (surfaceVersion === navigationSurfaceVersion.current) setActiveSurface("workspace-settings");
      toast.success(t("toast.workspaceAdded"));
      setReloadToken((value) => value + 1);
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.createWorkspace")) {
        setWorkspaceList((current) => addWorkspaceListFallback(current, workspaceName));
        setSelectedProject(null);
        if (surfaceVersion === navigationSurfaceVersion.current) setActiveSurface("workspace");
        toast.success(t("toast.workspaceAdded"));
        return;
      }

      toast.error(t("toast.workspaceAddFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleWorkspaceOpen(workspaceId: string, surface: WorkspaceSurface = "workspace") {
    const surfaceVersion = ++navigationSurfaceVersion.current;
    const activeWorkspaceId = workspaceList.activeWorkspaceId || state.workspaceId;
    if (workspaceId === activeWorkspaceId && !pendingWorkspaceScreen.current) {
      sendPane({ type: "showWorkspace" });
      setActiveSurface(surface);
      return;
    }
    if (!pendingWorkspaceScreen.current && activeSurface === "workspace") {
      workspaceScreenMemory.current.set(projectTabsWorkspaceId, {
        viewId: state.activeViewId,
        tabId: projectExpanded ? activeProjectTabId : null,
        fullScreen: projectFullScreen,
        previewId: !projectExpanded ? selectedProject?.id || null : null,
      });
    }
    const version = ++workspaceSwitchVersion.current;
    loadRequestIdRef.current += 1;
    pendingWorkspaceScreen.current = workspaceId;
    // Keep the outgoing workspace coherent until the destination is ready.
    // Serialize activation writes, then ignore superseded results.
    const request = workspaceSwitchQueue.current.then(() => workspaceClient.setActiveWorkspace({ workspaceId }));
    workspaceSwitchQueue.current = request.then(() => {}, () => {});
    try {
      await request;
      if (version !== workspaceSwitchVersion.current) return;
      // A later global-settings or back action owns the visible surface.
      if (surfaceVersion === navigationSurfaceVersion.current) setActiveSurface(surface);
      setReloadToken(value => value + 1);
    } catch (error) {
      if (version !== workspaceSwitchVersion.current) return;
      pendingWorkspaceScreen.current = null;
      toast.error(t("toast.workspaceOpenFailed"), { description: getServiceErrorMessage(error, t) });
    }
  }

  async function handleRenameWorkspace(workspaceId: string, name: string) {
    try {
      await workspaceClient.updateWorkspace({
        workspaceId,
        patch: { name },
      });
      setWorkspaceList((current) => renameWorkspaceListFallback(current, workspaceId, name));
      toast.success(t("toast.workspaceRenamed"));
      return true;
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.updateWorkspace")) {
        setWorkspaceList((current) => renameWorkspaceListFallback(current, workspaceId, name));
        toast.success(t("toast.workspaceRenamed"));
        return true;
      }

      toast.error(t("toast.workspaceRenameFailed"), {
        description: getServiceErrorMessage(error, t),
      });
      return false;
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    try {
      const response = await workspaceClient.deleteWorkspace({ workspaceId });
      const responseActiveWorkspaceId = isRecord(response)
        ? getString(response.activeWorkspaceId)
        : "";
      const currentActiveWorkspaceId = workspaceList.activeWorkspaceId || state.workspaceId;
      const wasActiveWorkspace = workspaceId === currentActiveWorkspaceId;
      const fallbackActiveWorkspaceId =
        workspaceList.workspaces.find((workspace) => workspace.id !== workspaceId)?.id || null;
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
      toast.success(t("toast.workspaceDeleted"));
      setReloadToken((value) => value + 1);
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.deleteWorkspace")) {
        setWorkspaceList((current) => deleteWorkspaceListFallback(current, workspaceId));
        setSelectedProject(null);
        toast.success(t("toast.workspaceDeleted"));
        return;
      }

      toast.error(t("toast.workspaceDeleteFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleReorderWorkspaces(orderedWorkspaceIds: readonly string[]) {
    const currentWorkspaceIds = workspaceList.workspaces.map((workspace) => workspace.id);
    const currentWorkspaceIdSet = new Set(currentWorkspaceIds);
    const nextOrderedWorkspaceIds = orderedWorkspaceIds.filter((workspaceId) =>
      currentWorkspaceIdSet.has(workspaceId),
    );

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

      toast.error(t("toast.workspaceReorderFailed"), {
        description: getServiceErrorMessage(error, t),
      });
      setReloadToken((value) => value + 1);
    }
  }

  async function handleCreateView(viewType: "board" | "table") {
    if (!state.workspaceId) {
      toast.error(t("toast.sourceRequiredViews"));
      return;
    }

    const label = viewType === "board" ? t("view.boardDefault") : t("view.tableDefault");
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
      toast.success(t("toast.viewCreated"));
      setSelectedProject(null);
    } catch (error) {
      toast.error(t("toast.viewCreateFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  const duplicatingViewRef = useRef(false);
  async function handleDuplicateView(sourceId: string) {
    if (!state.workspaceId || duplicatingViewRef.current) return;
    const source = state.views.find((view) => view.id === sourceId);
    if (!source) return;
    const workspaceId = state.workspaceId;
    duplicatingViewRef.current = true;
    try {
      const viewId = await duplicateWorkspaceView(
        workspaceClient,
        workspaceId,
        sourceId,
        t("view.copyName", { name: source.name }),
      );
      if (workspaceIdRef.current !== workspaceId) return;
      setSelectedProject(null);
      setActiveProjectTabId(null);
      dispatch({ type: "activeViewChanged", activeViewId: viewId });
      await refreshActiveViewAfterPatch(viewId);
    } catch (error) {
      toast.error(t("view.duplicateFailed"), { description: getServiceErrorMessage(error, t) });
      if (workspaceIdRef.current === workspaceId) setReloadToken((value) => value + 1);
    } finally {
      duplicatingViewRef.current = false;
    }
  }

  async function handleRenameView(viewId: string, name: string) {
    if (!state.workspaceId) {
      toast.error(t("toast.sourceRequiredViews"));
      return false;
    }

    try {
      await workspaceClient.updateView({
        workspaceId: state.workspaceId,
        viewId,
        patch: { name },
      });
      dispatch({ type: "viewRenamed", viewId, name });
      toast.success(t("toast.viewRenamed"));
      return true;
    } catch (error) {
      if (isUnsupportedWorkspaceMethodError(error, "workspace.updateView")) {
        dispatch({ type: "viewRenamed", viewId, name });
        toast.success(t("toast.viewRenamed"));
        return true;
      }

      toast.error(t("toast.viewRenameFailed"), {
        description: getServiceErrorMessage(error, t),
      });
      return false;
    }
  }

  async function handleDeleteView(viewId: string) {
    if (!state.workspaceId) {
      toast.error(t("toast.sourceRequiredViews"));
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
      toast.success(t("toast.viewDeleted"));
      setSelectedProject(null);
    } catch (error) {
      toast.error(t("toast.viewDeleteFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.error(t("toast.viewReorderFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function refreshActiveViewAfterPatch(viewId: string) {
    if (!state.workspaceId || !state.root) {
      return;
    }

    const [viewsRawResponse, projectionRawResponse] = await Promise.all([
      workspaceClient.listViews({ workspaceId: state.workspaceId }),
      workspaceClient.getViewProjection({ workspaceId: state.workspaceId, viewId, locale }),
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

  const groupingSaveQueue = useRef(createGroupingMutationQueue(async (target, grouping) => {
    await workspaceClient.updateView({ ...target, patch: { grouping } });
  }));

  function handleGroupingChange(mutation: GroupingMutation) {
    const workspaceId = state.workspaceId;
    const viewId = state.activeViewId;
    if (!workspaceId || !viewId) return;
    const initial = state.views.find(view => view.id === viewId)?.grouping;
    void groupingSaveQueue.current.enqueue({ workspaceId, viewId }, initial, mutation)
      .then(() => {
        if (workspaceIdRef.current === workspaceId) setReloadToken(value => value + 1);
      })
      .catch(error => {
        toast.error(t("group.saveFailed"), { description: getServiceErrorMessage(error, t) });
      });
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
    const currentVisiblePropertyIds = activeView?.visiblePropertyIds ||
      state.projection?.visibleProperties.map((property) => property.id) || [
        "property:name",
        "property:status",
      ];
    const nextVisiblePropertyIds = createNextVisiblePropertyIds({
      currentVisiblePropertyIds,
      fallbackVisiblePropertyIds:
        state.projection?.visibleProperties.map((property) => property.id) || [],
      availablePropertyIds: settingsProperties.map((property) => property.id),
      propertyId,
      visible,
    });
    const previousPropertyOrder =
      activeView?.propertyOrder || createPropertyOrder(currentVisiblePropertyIds);
    const propertyOrder = createPropertyOrder(nextVisiblePropertyIds);

    try {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: nextVisiblePropertyIds,
        propertyOrder,
      });
      await updateActiveViewPatch(
        {
          visiblePropertyIds: nextVisiblePropertyIds,
          propertyOrder,
        },
        {
          refreshProjection: false,
        },
      );
    } catch (error) {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: currentVisiblePropertyIds,
        propertyOrder: previousPropertyOrder,
      });
      toast.error(t("toast.propertyVisibilityFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.error(t("toast.valueFilterFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleTogglePropertyWrapContent(propertyId: string, wrapContent: boolean) {
    if (!state.activeViewId) {
      return;
    }

    const property = settingsProperties.find((item) => item.id === propertyId);
    if (!property || property.system || property.propertyType !== "text") {
      return;
    }

    const activeViewId = state.activeViewId;
    const activeView = getActiveViewState();
    const previousPropertyLayout = activeView?.propertyLayout || {};
    const propertyLayout = { ...previousPropertyLayout };

    if (wrapContent) {
      propertyLayout[propertyId] = { wrapContent: true };
    } else {
      delete propertyLayout[propertyId];
    }

    dispatch({
      type: "viewPropertyLayoutUpdated",
      viewId: activeViewId,
      propertyLayout,
    });

    try {
      await updateActiveViewPatch({ propertyLayout }, { refreshProjection: false });
    } catch (error) {
      dispatch({
        type: "viewPropertyLayoutUpdated",
        viewId: activeViewId,
        propertyLayout: previousPropertyLayout,
      });
      toast.error(t("toast.textWrapFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  function handleBoardColumnWidthPreview(columnWidth: number) {
    if (!state.activeViewId) {
      return;
    }

    dispatch({
      type: "viewBoardLayoutUpdated",
      viewId: state.activeViewId,
      boardLayout: { columnWidth: normalizeBoardColumnWidth(columnWidth) },
    });
  }

  async function handleBoardColumnWidthCommit(columnWidth: number, previousColumnWidth: number) {
    if (!state.activeViewId) {
      return;
    }

    const activeViewId = state.activeViewId;
    const boardLayout = { columnWidth: normalizeBoardColumnWidth(columnWidth) };

    dispatch({ type: "viewBoardLayoutUpdated", viewId: activeViewId, boardLayout });

    try {
      await updateActiveViewPatch({ boardLayout }, { refreshProjection: false });
    } catch (error) {
      dispatch({
        type: "viewBoardLayoutUpdated",
        viewId: activeViewId,
        boardLayout: {
          columnWidth: normalizeBoardColumnWidth(previousColumnWidth, BOARD_COLUMN_WIDTH_DEFAULT),
        },
      });
      toast.error(t("toast.boardWidthFailed"), {
        description: getServiceErrorMessage(error, t),
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
    const previousVisiblePropertyIds = activeView?.visiblePropertyIds ||
      state.projection?.visibleProperties.map((property) => property.id) || [
        "property:name",
        "property:status",
      ];
    const previousPropertyOrder =
      activeView?.propertyOrder || createPropertyOrder(previousVisiblePropertyIds);
    const propertyOrder = createPropertyOrder(nextVisiblePropertyIds);

    try {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: nextVisiblePropertyIds,
        propertyOrder,
      });
      await updateActiveViewPatch(
        {
          visiblePropertyIds: nextVisiblePropertyIds,
          propertyOrder,
        },
        {
          refreshProjection: false,
        },
      );
    } catch (error) {
      dispatch({
        type: "viewPropertiesUpdated",
        viewId: activeViewId,
        visiblePropertyIds: previousVisiblePropertyIds,
        propertyOrder: previousPropertyOrder,
      });
      toast.error(t("toast.propertyOrderFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleCreateVisibleProperty(input: {
    name: string;
    type: WorkspaceCustomPropertyType;
  }) {
    if (!state.workspaceId) {
      toast.error(t("toast.sourceRequiredProperties"));
      return;
    }

    try {
      const response = await workspaceClient.createProperty({
        id: createClientDocumentId("property"),
        workspaceId: state.workspaceId,
        name: input.name,
        type: input.type,
      });
      const property =
        isRecord(response) && isRecord(response.property)
          ? normalizePropertyDefinition(response.property)
          : null;

      await refreshPropertyCatalog();

      if (property?.id) {
        const activeView = getActiveViewState();
        const currentVisiblePropertyIds = [
          ...new Set([
            "property:name",
            "property:status",
            ...(activeView?.visiblePropertyIds ||
              state.projection?.visibleProperties.map((item) => item.id) ||
              []),
          ]),
        ];
        const nextVisiblePropertyIds = [...new Set([...currentVisiblePropertyIds, property.id])];
        await updateActiveViewPatch({
          visiblePropertyIds: nextVisiblePropertyIds,
          propertyOrder: createPropertyOrder(nextVisiblePropertyIds),
        });
      }

      toast.success(t("toast.propertyCreated"));
    } catch (error) {
      toast.error(t("toast.propertyCreateFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleFolderRoleChange(
    node: WorkspaceFolderRoleNode,
    role: WorkspaceFolderRoleNode["role"],
  ) {
    if (!state.root) {
      toast.error(t("toast.sourceRequiredFolderRoles"));
      return;
    }

    try {
      await workspaceClient.updateFolderRole({
        workspaceId: state.workspaceId,
        path: node.relativePath,
        role,
      });
      if (workspaceIdRef.current !== state.workspaceId) return;
      toast.success(t("toast.folderRoleUpdated"));
      setSelectedProject(null);
      setReloadToken((value) => value + 1);
    } catch (error) {
      toast.error(t("toast.folderRoleUpdateFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.error(t("toast.sourceRequiredProperties"));
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
      toast.success(t("toast.propertyCreated"));
    } catch (error) {
      toast.error(t("toast.propertyCreateFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.success(t("toast.propertyRenamed"));
    } catch (error) {
      toast.error(t("toast.propertyRenameFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.success(t(hidden ? "toast.propertyHidden" : "toast.propertyShown"));
    } catch (error) {
      toast.error(t("toast.propertyVisibilityFailed"), {
        description: getServiceErrorMessage(error, t),
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
      setSelectedProject((currentProject) =>
        currentProject ? removeProjectPropertyValue(currentProject, propertyId) : currentProject,
      );
      await refreshPropertyCatalog();
      if (state.activeViewId) {
        const projectionResponse = normalizeProjectionResponse(await workspaceClient.getViewProjection({
          workspaceId: state.workspaceId,
          viewId: state.activeViewId,
          locale,
        }));
        dispatch({ type: "projectionUpdated", projectionResponse });
      }
      toast.success(t("toast.propertyDeleted"));
    } catch (error) {
      toast.error(t("toast.propertyDeleteFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.error(t("toast.propertyOrderFailed"), {
        description: getServiceErrorMessage(error, t),
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
      const selectValue =
        isRecord(response) && isRecord(response.selectValue)
          ? normalizeSelectValue(response.selectValue)
          : null;
      await refreshPropertyCatalog();
      toast.success(t("toast.valueCreated"));
      return selectValue;
    } catch (error) {
      toast.error(t("toast.valueCreateFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.success(t("toast.valueRenamed"));
    } catch (error) {
      toast.error(t("toast.valueRenameFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.error(t("toast.valueColorFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleColorStatusValue(statusValueId: string, color: string) {
    if (!state.workspaceId) {
      return;
    }

    try {
      await workspaceClient.updateStatusValueColor({
        workspaceId: state.workspaceId,
        statusValueId,
        color,
      });
      if (workspaceIdRef.current !== state.workspaceId) return;
      setReloadToken((value) => value + 1);
    } catch (error) {
      toast.error(t("toast.statusColorFailed"), {
        description: getServiceErrorMessage(error, t),
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
      toast.success(t(hidden ? "toast.valueHidden" : "toast.valueShown"));
    } catch (error) {
      toast.error(t("toast.valueVisibilityFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleDeleteSelectValue(selectValueId: string) {
    if (!state.workspaceId) {
      return;
    }

    const selectValue =
      state.propertyCatalog?.selectValues.find((value) => value.id === selectValueId) || null;

    try {
      await workspaceClient.deleteSelectValue({
        workspaceId: state.workspaceId,
        selectValueId,
        confirmDeleteUsages: true,
      });
      if (selectValue) {
        setSelectedProject((currentProject) =>
          currentProject
            ? removeProjectSelectValue(currentProject, selectValue.propertyId, selectValue.id)
            : currentProject,
        );
      }
      await refreshPropertyCatalog();
      setReloadToken((value) => value + 1);
      toast.success(t("toast.valueDeleted"));
    } catch (error) {
      toast.error(t("toast.valueDeleteFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function handleReorderSelectValues(
    propertyId: string,
    orderedSelectValueIds: readonly string[],
  ) {
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
      toast.error(t("toast.valueOrderFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  async function loadProjectStatusOptions(projectId: string): Promise<readonly ProjectStatusMoveOption[]> {
    const response = await workspaceClient.getProjectStatusOptions({ workspaceId: state.workspaceId, projectId });
    if (!isRecord(response) || !Array.isArray(response.options)) throw new Error(t("move.optionsFailed"));
    return response.options as ProjectStatusMoveOption[];
  }

  async function handleProjectStatusChange(project: WorkspaceMockProject, option: ProjectStatusMoveOption) {
    const requestWorkspaceId = state.workspaceId;
    if (!requestWorkspaceId || !option.to || option.current || option.disabledReason) return;
    try {
      const result = await projectMoveController.move({ workspaceId: requestWorkspaceId, projectId: project.id,
        projectName: project.name, statusValueId: option.id, from: option.from, to: option.to });
      if (!result) return;
      if (isRecord(result) && result.state === "recovery-required") {
        if (isRecord(result.project)) {
          const recovered = result.project as unknown as WorkspaceMockProject;
          for (const workspaceId of Object.keys(projectTabsByWorkspace))
            dispatchProjectTabs({ type: "update", workspaceId, project: recovered });
          if (workspaceIdRef.current === requestWorkspaceId) setSelectedProject(current => current?.id === project.id ? recovered : current);
        }
        toast.error(t("move.recoveryRequired"), { description: isRecord(result.error) ? getString(result.error.message) : undefined, duration: 12000 });
        return;
      }
    } catch (error) {
      toast.error(t("move.failed"), { description: getServiceErrorMessage(error, t) });
      return;
    }
    try {
      const affected = new Set([requestWorkspaceId, ...Object.keys(projectTabsByWorkspace).filter(id => projectTabsByWorkspace[id]?.some(tab => tab.id === project.id))]);
      for (const workspaceId of affected) {
        const response = await workspaceClient.getProject({ workspaceId, projectId: project.id });
        if (!isRecord(response) || !isRecord(response.project)) continue;
        const fresh = response.project as unknown as WorkspaceMockProject;
        const fileTree = normalizeProjectFileTreeResponse(await workspaceClient.listProjectFileTree({ workspaceId, path: fresh.currentRelativePath }));
        const updated = { ...fresh, fileTree };
        dispatchProjectTabs({ type: "update", workspaceId, project: updated });
        if (workspaceIdRef.current === workspaceId) setSelectedProject(current => current?.id === project.id ? updated : current);
      }
      if (workspaceIdRef.current === requestWorkspaceId && activeViewIdRef.current) {
        const [projection, scan] = await Promise.all([
          workspaceClient.getViewProjection({ workspaceId: requestWorkspaceId, viewId: activeViewIdRef.current, locale }),
          workspaceClient.scan({ workspaceId: requestWorkspaceId }),
        ]);
        if (workspaceIdRef.current === requestWorkspaceId) {
          if (state.root) dispatch({ type: "projectionLoaded", root: state.root,
            viewsResponse: { workspaceId: requestWorkspaceId, activeViewId: activeViewIdRef.current, views: state.views },
            projectionResponse: normalizeProjectionResponse(projection), folderRoleTree: normalizeFolderRoleTree(scan) });
        }
      }
      toast.success(t("move.completed"));
    } catch (error) {
      toast.error(t("move.refreshFailed"), { description: getServiceErrorMessage(error, t) });
    }
  }

  async function handleProjectPropertyValueChange(
    projectId: string,
    propertyId: string,
    value: unknown,
  ) {
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
      const response = await workspaceClient.updateProjectPropertyValue({
        workspaceId: state.workspaceId,
        projectId,
        propertyId,
        value,
      });
      const savedValue =
        isRecord(response) && Object.hasOwn(response, "value") ? response.value : value;
      dispatch({
        type: "projectPropertyValueUpdated",
        projectId,
        propertyId,
        value: savedValue,
        requestVersion,
      });
      if (isCurrentPropertySaveRequest(projectId, propertyId, requestVersion)) {
        if (state.projection?.view.grouping && state.activeViewId) {
          const projectionResponse = normalizeProjectionResponse(await workspaceClient.getViewProjection({
            workspaceId: state.workspaceId,
            viewId: state.activeViewId,
            locale,
          }));
          if (workspaceIdRef.current === state.workspaceId && isCurrentPropertySaveRequest(projectId, propertyId, requestVersion)) {
            // The reducer also rejects a response for a view that is no longer active.
            dispatch({ type: "projectionUpdated", projectionResponse });
          }
        }
        dispatchProjectTabs({
          type: "valueSaved",
          workspaceId: projectTabsWorkspaceId,
          projectId,
          propertyId,
          value: savedValue,
        });
        setSelectedProject((currentProject) =>
          currentProject?.id === projectId
            ? {
                ...currentProject,
                propertyValues: {
                  ...currentProject.propertyValues,
                  [propertyId]: savedValue,
                },
              }
            : currentProject,
        );
      }
    } catch (error) {
      const message = getServiceErrorMessage(error, t);
      dispatch({
        type: "propertySaveFailed",
        error: message,
        projectId,
        propertyId,
        requestVersion,
      });
      if (isCurrentPropertySaveRequest(projectId, propertyId, requestVersion)) {
        toast.error(t("toast.propertySaveFailed"), {
          description: message,
        });
      }
    }
  }

  async function loadProjectFileTree(
    project: WorkspaceMockProject,
    requestWorkspaceId = state.workspaceId,
  ) {
    try {
      const fileTree = normalizeProjectFileTreeResponse(
        await workspaceClient.listProjectFileTree({ workspaceId: requestWorkspaceId, path: project.currentRelativePath }),
      );
      setSelectedProject((currentProject) =>
        workspaceIdRef.current === requestWorkspaceId && currentProject?.id === project.id
          ? { ...currentProject, fileTree }
          : currentProject,
      );
    } catch (error) {
      if (workspaceIdRef.current !== requestWorkspaceId) return;
      toast.error(t("toast.fileTreeLoadFailed"), {
        description: getServiceErrorMessage(error, t),
      });
    }
  }

  function handleProjectOpen(project: WorkspaceMockProject, tabId: string | null = null, fullScreen = false) {
    if (!tabId && !projectExpanded && paneLayout.rightVisible && paneLayout.activeRightTab === "navigation" && selectedProject?.id === project.id) {
      sendPane({ type: "rightToggle" });
      return;
    }
    setProjectTabSelected(fullScreen);
    setActiveProjectTabId(tabId);
    setSelectedProject(project);
    if (!tabId) sendPane({ type: "previewProject" });
    if (state.status === "ready" && state.root) {
      void loadProjectFileTree(project);
    }
  }

  function dismissWorkspaceFloatingMenus() {
    setWorkspaceFloatingDismissToken((currentToken) => currentToken + 1);
  }

  function openWorkspaceSurface() {
    navigationSurfaceVersion.current += 1;
    sendPane({ type: "showWorkspace" });
    setActiveSurface("workspace");
  }

  function openCurrentWorkspaceSettings() {
    navigationSurfaceVersion.current += 1;
    sendPane({ type: "showWorkspace" });
    setActiveSurface("workspace-settings");
  }

  function openSettingsSurface() {
    navigationSurfaceVersion.current += 1;
    sendPane({ type: "showWorkspace" });
    setActiveSurface("settings");
  }

  const shouldUseMockViews = !state.root && !state.workspaceId;
  const viewState = {
    activeViewId:
      state.activeViewId || (shouldUseMockViews ? workspaceMockProjection.activeViewId : ""),
    views:
      state.views.length > 0
        ? state.views
        : shouldUseMockViews
          ? workspaceMockProjection.views
          : [],
  };
  const navigationWorkspaces =
    workspaceList.workspaces.length > 0
      ? workspaceList.workspaces
      : state.root
        ? [
            {
              id: state.workspaceId || state.root.workspaceId,
              name: state.root.name || "Workspace",
              order: 10,
            },
          ]
        : [];
  const currentWorkspaceId = workspaceList.activeWorkspaceId || state.workspaceId;
  const currentWorkspaceName =
    navigationWorkspaces.find((workspace) => workspace.id === currentWorkspaceId)?.name ||
    navigationWorkspaces[0]?.name ||
    "Workspace";
  const sourceFolder = state.root?.path
    ? {
        name: state.root.name,
        path: state.root.path || t("common.pathUnavailable"),
        state: "connected",
      }
    : { name: t("state.noSourceTitle"), path: "", state: "missing" };
  const serviceProjection = useMemo(() => {
    if (!state.projection) {
      return null;
    }

    const projectionMatchesActiveWorkspace =
      state.projection.workspaceId === state.workspaceId &&
      state.projection.view.id === state.activeViewId;
    const projectionIsStaleWorkspaceSurface =
      state.workspaceSwitchPending && state.projection.workspaceId !== state.workspaceId;

    if (!projectionMatchesActiveWorkspace && !projectionIsStaleWorkspaceSurface) {
      return null;
    }

    return filterWorkspaceProjectionBySearch(state.projection, state.searchQuery);
  }, [
    state.activeViewId,
    state.projection,
    state.searchQuery,
    state.workspaceId,
    state.workspaceSwitchPending,
  ]);
  const mockBoardProjectionResponse = useMemo(
    () =>
      filterWorkspaceProjectionBySearch(
        workspaceMockProjection as unknown as WorkspaceProjectionResponse,
        state.searchQuery,
      ),
    [state.searchQuery],
  );
  const mockTableProjectionResponse = useMemo(
    () =>
      filterWorkspaceProjectionBySearch(
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
  const activeViewType =
    serviceProjection?.projection.type === "table"
      ? "table"
      : serviceProjection?.projection.type === "board"
        ? "board"
        : activeView?.viewType === "table"
          ? "table"
          : "board";
  const visibleProperties =
    serviceProjection?.visibleProperties ?? [];
  const statusValues = serviceProjection?.statusValues ?? [];
  const boardProjection =
    serviceProjection?.projection.type === "board"
      ? serviceProjection.projection
      : mockBoardProjectionResponse.projection;
  const tableProjection =
    serviceProjection?.projection.type === "table"
      ? serviceProjection.projection
      : mockTableProjectionResponse.projection;
  const folderRoleTree = state.root ? state.folderRoleTree : [];
  const settingsProperties = state.propertyCatalog?.properties ?? visibleProperties;
  const settingsSelectValues = state.propertyCatalog?.selectValues ?? [];
  const detailProperties = state.propertyCatalog?.properties ?? visibleProperties;
  const isWorkspaceSwitchPendingSurface =
    activeSurface === "workspace" &&
    state.workspaceSwitchPending &&
    serviceProjection !== null &&
    serviceProjection.workspaceId !== state.workspaceId;
  const shouldShowWorkspaceLoadingState =
    state.status === "loading" ||
    state.status === "idle" ||
    (state.status === "ready" && !!state.root && !state.sourceFolderMissing && !serviceProjection);
  const searchHasNoResults =
    state.searchQuery.trim().length > 0 &&
    (activeViewType === "board"
      ? boardProjection.type === "board" &&
        boardProjection.columns.every((column) => column.projects.length === 0)
      : tableProjection.type === "table" && tableProjection.rows.length === 0 && !tableProjection.groupOptions && !tableProjection.groupingNotice);

  const renderDetailPanel = (
    project = selectedProject,
    onClose = closeSelectedProject,
    keyboardActive = paneLayout.focused === "workspace" || paneLayout.focused === "right",
  ) => (
    <WorkspaceProjectDetailPanel
      inline
      keyboardActive={keyboardActive}
      expanded={projectExpanded}
      sidebarCollapsed={sidebarCollapsed}
      open={project !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      project={project}
      statusMovePending={projectMovePending !== null}
      onLoadStatusOptions={loadProjectStatusOptions}
      onStatusChange={handleProjectStatusChange}
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
      onOpenLocalItem={(node) => {
        void workspaceClient
          .reveal({ workspaceId: state.workspaceId, kind: node.kind === "folder" ? "directory" : "file", path: node.relativePath })
          .catch((error) =>
            toast.error(t("toast.previewUnavailable"), {
              description: getServiceErrorMessage(error, t),
            }),
          );
      }}
    />
  );
  const detailPanel = renderDetailPanel();
  const navigationPanel = (
    <nav className="bb-navigation" aria-label={t("chrome.navigation")}>
      <p className="bb-navigation-heading">
        {listWorkspacePanes(paneLayout.tree).some(
          (p) => p.paneId === paneLayout.focused && p.tabId,
        ) && selectedProject
          ? selectedProject.name
          : currentWorkspaceName}
      </p>
      {viewState.views.map((view) => (
        <button
          type="button"
          key={view.id}
          className="bb-navigation-row"
          onClick={() => {
            setSelectedProject(null);
            setActiveProjectTabId(null);
            openWorkspaceSurface();
            sendPane({ type: "selectView" });
            dispatch({ type: "activeViewChanged", activeViewId: view.id });
          }}
        >
          <FolderIcon className="size-4" aria-hidden="true" />
          {view.name}
        </button>
      ))}
      <button type="button" className="bb-navigation-row" onClick={openSettingsSurface}>
        {t("sidebar.settings")}
      </button>
    </nav>
  );

  const primaryPane = (
    <main
      onFocusCapture={() => sendPane({ type: "focus", pane: "workspace" })}
      data-testid="workspace-main"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <header
        className={[
          "electron-window-drag flex h-[var(--workspace-header-height)] shrink-0 items-center gap-2 border-b border-border pr-4",
          "pl-4",
        ].join(" ")}
      >
        {activeSurface === "workspace" ? (
          <div
            aria-busy={isWorkspaceSwitchPendingSurface || undefined}
            inert={isWorkspaceSwitchPendingSurface || undefined}
            className="electron-window-no-drag min-w-0 flex-1 overflow-hidden"
          >
            <WorkspaceViewTabs
              projectActive={projectFullScreen}
              projectActions={
                projectFullScreen ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="workspace-top-action"
                      aria-label={t(projectExpanded ? "detail.restore" : "detail.expand")}
                      title={t(projectExpanded ? "detail.restore" : "detail.expand")}
                      onClick={toggleProjectExpanded}
                    >
                      {projectExpanded ? (
                        <ChromeIcon icon={CollapseIcon} className="size-[13px]" />
                      ) : (
                        <ChromeIcon icon={ExpandIcon} className="size-[13px]" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="workspace-top-action"
                      aria-label={t("detail.close")}
                      title={t("detail.close")}
                      onClick={closeSelectedProject}
                    >
                      <XIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </>
                ) : null
              }
              onShowView={() => {
                setSelectedProject(null);
                setActiveProjectTabId(null);
                sendPane({ type: "selectView" });
              }}
              groupOptions={tableProjection.type === "table" ? tableProjection.groupOptions : undefined}
              onGroupingChange={handleGroupingChange}
              actionsHidden={projectFullScreen}
              projectTabs={
                <WorkspaceProjectTabs
                  key={projectTabsWorkspaceId}
                  projects={expandedProjectTabs}
                  activeProjectId={
                    projectFullScreen ? activeProjectTabId || "" : ""
                  }
                  onSelect={(id) => {
                    const project = expandedProjectTabs.find((item) => item.tabId === id);
                    if (project) {
                      handleProjectOpen(project, id, true);
                    }
                  }}
                  onDuplicate={(id) => {
                    const project = expandedProjectTabs.find((item) => item.tabId === id);
                    if (project) createExpandedProject(project, id);
                  }}
                  onRestore={(id) => {
                    const project = expandedProjectTabs.find((item) => item.tabId === id);
                    dispatchProjectTabs({
                      type: "remove",
                      workspaceId: projectTabsWorkspaceId,
                      tabId: id,
                    });
                    if (project) handleProjectOpen(project);
                  }}
                  onClose={closeProjectTab}
                  onSplit={(id, target, side) => {
                    const project = expandedProjectTabs.find((p) => p.tabId === id);
                    if (project) {
                      openProjectInSplit(project, id, target, side);
                    }
                  }}
                  onCloseOthers={(id) => {
                    closeProjectTabs(
                      expandedProjectTabs.filter((p) => p.tabId !== id).map((p) => p.tabId),
                    );
                    const project = expandedProjectTabs.find((p) => p.tabId === id);
                    if (project) handleProjectOpen(project, id);
                  }}
                  onCloseAfter={(id) =>
                    closeProjectTabs(
                      expandedProjectTabs
                        .slice(expandedProjectTabs.findIndex((p) => p.tabId === id) + 1)
                        .map((p) => p.tabId),
                    )
                  }
                  onReopen={reopenProjectTab}
                  canReopen={!!closedProjectTabs[projectTabsWorkspaceId]?.length}
                  onReorder={(tabIds) =>
                    dispatchProjectTabs({
                      type: "reorder",
                      workspaceId: projectTabsWorkspaceId,
                      tabIds,
                    })
                  }
                />
              }
              activeViewId={viewState.activeViewId}
              views={viewState.views}
              onActiveViewChange={(activeViewId) => {
                setSelectedProject(null);
                setActiveProjectTabId(null);
                sendPane({ type: "selectView" });
                dispatch({ type: "activeViewChanged", activeViewId });
                if (state.workspaceId) {
                  void workspaceClient
                    .setActiveView({
                      workspaceId: state.workspaceId,
                      viewId: activeViewId,
                    })
                    .catch((error: unknown) => {
                      toast.error(t("toast.activeViewSaveFailed"), {
                        description: getServiceErrorMessage(error, t),
                      });
                    });
                }
              }}
              onCreateView={handleCreateView}
              onDuplicateView={handleDuplicateView}
              onRenameView={handleRenameView}
              onDeleteView={handleDeleteView}
              onReorderViews={handleReorderViews}
              dismissSignal={workspaceFloatingDismissToken}
              properties={settingsProperties}
              selectValues={settingsSelectValues}
              statusValues={statusValues}
              onTogglePropertyVisibility={handleTogglePropertyVisibility}
              onToggleValueFilter={handleToggleValueFilter}
              boardColumnWidthMax={getBoardColumnWidthMax(boardViewportWidth)}
              onBoardColumnWidthPreview={handleBoardColumnWidthPreview}
              onBoardColumnWidthCommit={handleBoardColumnWidthCommit}
              onReorderViewProperties={handleReorderViewProperties}
              onRenameProperty={handleRenameProperty}
              onDeleteProperty={handleDeleteProperty}
            />
          </div>
        ) : null}
        {activeSurface !== "workspace" ? (
          <div className="electron-window-no-drag flex min-w-0 flex-1 items-center justify-between gap-3">
            <h1 className="truncate text-sm font-medium">{activeSurface === "workspace-settings" ? `${t("settings.workspaceTitle")} · ${currentWorkspaceName}` : t("settings.title")}</h1>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={openWorkspaceSurface}
            >
              {t("settings.back")}
            </Button>
          </div>
        ) : null}
        {!projectFullScreen && (paneLayout.split || paneLayout.maximized === "workspace") && (
          <ChromeAction
            label={t(
              paneLayout.maximized === "workspace" ? "chrome.restoreSplit" : "chrome.maximize",
            )}
            onClick={() => sendPane({ type: "maximize", pane: "workspace" })}
          >
            <ChromeIcon icon={paneLayout.maximized === "workspace" ? CollapseIcon : ExpandIcon} className="size-[13px]" />
          </ChromeAction>
        )}
        {!projectFullScreen && paneLayout.split && (
          <ChromeAction label={t("chrome.closePane")} onClick={() => closeLayoutPane("workspace")}>
            <ChromeIcon icon={Cancel01Icon} />
          </ChromeAction>
        )}
      </header>
      {projectFullScreen ? (
        detailPanel
      ) : activeSurface !== "workspace" ? (
        <div className="electron-window-no-drag min-h-0 flex-1 overflow-auto">
          {activeSurface === "settings" ? <GlobalSettingsView theme={theme} onThemeChange={setTheme} /> : state.status === "loading" || state.status === "idle" || pendingWorkspaceScreen.current ? (
            <WorkspaceLoadingState />
          ) : (
            <>
              <WorkspaceServiceError state={state} />
              <WorkspaceSettingsView
                workspaceName={workspaceList.workspaces.find(item => item.id === state.workspaceId)?.name}
                sourceFolder={sourceFolder}
                folderRoleTree={folderRoleTree}
                statusValues={statusValues}
                selectValues={settingsSelectValues}
                onSelectFolder={handleSelectFolder}
                onFolderRoleChange={handleFolderRoleChange}
                onColorStatusValue={handleColorStatusValue}
                selectingFolder={selectingFolder && folderPickerWorkspaceRef.current === state.workspaceId}
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
          <div className="min-h-0 flex-1 overflow-hidden">
            {shouldShowWorkspaceLoadingState ? (
              <WorkspaceLoadingState />
            ) : state.status === "error" && !serviceProjection ? (
              <><WorkspaceServiceError state={state} /><WorkspaceEmptyState onOpenSettings={openCurrentWorkspaceSettings} /></>
            ) : state.sourceFolderMissing ? (
              <WorkspaceEmptyState onOpenSettings={openCurrentWorkspaceSettings} />
            ) : (
              <>
                <WorkspaceServiceError state={state} />
                {searchHasNoResults ? (
                  <div
                    className="flex h-full min-h-0 items-center justify-center px-6 text-center"
                    role="status"
                  >
                    <p className="max-w-md break-words text-sm text-muted-foreground">
                      {t("state.noSearchResultsQuery", { query: state.searchQuery.trim() })}
                    </p>
                  </div>
                ) : activeViewType === "board" ? (
                  <WorkspaceBoardView
                    projection={boardProjection as typeof workspaceMockProjection.projection}
                    statusValues={statusValues}
                    columnWidth={activeView?.boardLayout?.columnWidth}
                    onViewportWidthChange={setBoardViewportWidth}
                    visibleProperties={
                      visibleProperties as typeof workspaceMockProjection.visibleProperties
                    }
                    selectValues={settingsSelectValues}
                    onProjectOpen={handleProjectOpen}
                    statusMovePending={projectMovePending !== null}
                    onLoadStatusOptions={loadProjectStatusOptions}
                    onStatusChange={handleProjectStatusChange}
                    onProjectPropertyValueChange={handleProjectPropertyValueChange}
                    onCreateSelectValue={handleCreateSelectValue}
                    onRenameSelectValue={handleRenameSelectValue}
                    onColorSelectValue={handleColorSelectValue}
                    onDeleteSelectValue={handleDeleteSelectValue}
                  />
                ) : null}
                {!searchHasNoResults && activeViewType === "table" ? (
                  <WorkspaceTableView
                    projection={tableProjection as typeof workspaceMockProjection.tableProjection}
                    searchQuery={state.searchQuery}
                    onClearSearch={() => dispatch({ type: "searchQueryChanged", searchQuery: "" })}
                    onGroupingChange={handleGroupingChange}
                    view={activeView ?? null}
                    visibleProperties={
                      visibleProperties as typeof workspaceMockProjection.visibleProperties
                    }
                    properties={settingsProperties}
                    selectValues={settingsSelectValues}
                    statusValues={statusValues}
                    onProjectOpen={handleProjectOpen}
                    statusMovePending={projectMovePending !== null}
                    onLoadStatusOptions={loadProjectStatusOptions}
                    onStatusChange={handleProjectStatusChange}
                    onCreateProperty={handleCreateVisibleProperty}
                    onRenameProperty={handleRenameProperty}
                    onDeleteProperty={handleDeleteProperty}
                    onReorderViewProperties={handleReorderViewProperties}
                    onTogglePropertyVisibility={handleTogglePropertyVisibility}
                    onToggleValueFilter={handleToggleValueFilter}
                    onTogglePropertyWrapContent={handleTogglePropertyWrapContent}
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
  );

  return (
    <TooltipProvider delayDuration={500}>
      <div
        className="workspace-shell relative flex h-screen min-h-0 bg-background text-foreground"
        data-sidebar-collapsed={sidebarCollapsed}
        style={
          { "--workspace-sidebar-width": `${paneLayout.sidebarWidth}px` } as React.CSSProperties
        }
      >
        <div
          className={[
            "workspace-sidebar-host h-full shrink-0",
            sidebarCollapsed
              ? "w-0"
              : "w-[var(--workspace-sidebar-width)]",
          ].join(" ")}
        >
          <WorkspaceLeftPanel
            collapsed={sidebarCollapsed}
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
            onOpenWorkspaceSettings={(id) => { void handleWorkspaceOpen(id, "workspace-settings"); }}
            onOpenSettings={openSettingsSurface}
          />
        </div>
        {!sidebarCollapsed && (
          <div className="bb-sidebar-resize">
            <PaneResize
              label={t("chrome.resizeSidebar")}
              value={paneLayout.sidebarWidth}
              min={240}
              max={460}
              growDirection={1}
              onResize={(width) => sendPane({ type: "resizeSidebar", width })}
            />
          </div>
        )}
        <div
          className="bb-center flex min-h-0 min-w-0 flex-1"
          style={{ display: !projectFullScreen && paneLayout.maximized === "right" ? "none" : undefined }}
          data-maximized={paneLayout.maximized || undefined}
        >
          {projectFullScreen ? primaryPane : <WorkspaceSplitTree
            layout={paneLayout}
            send={sendPane}
            primary={primaryPane}
            onPaneFocus={(pane) => {
              if (pane.tabId) {
                const project = expandedProjectTabs.find((tab) => tab.tabId === pane.tabId);
                if (project && activeProjectTabId !== pane.tabId)
                  handleProjectOpen(project, pane.tabId);
              }
            }}
            titleForPane={(pane) =>
              expandedProjectTabs.find((tab) => tab.tabId === pane.tabId)?.name ||
              t("chrome.newTab")
            }
            renderProject={(pane) =>
              renderDetailPanel(
                expandedProjectTabs.find((tab) => tab.tabId === pane.tabId) || null,
                () => closeLayoutPane(pane.paneId),
                paneLayout.focused === pane.paneId,
              )
            }
            onClosePane={closeLayoutPane}
          />}
        </div>
        {(
          <WorkspaceRightPanel
            key={projectTabsWorkspaceId}
            suppressed={activeSurface !== "workspace" || state.status === "error" || projectFullScreen || (!!paneLayout.maximized && paneLayout.maximized !== "right")}
            layout={paneLayout}
            send={sendPane}
            navigation={navigationPanel}
            project={
              !projectExpanded &&
              activeSurface === "workspace" &&
              selectedProject
                ? detailPanel
                : undefined
            }
            projectName={selectedProject?.name}
            onCloseProject={closeSelectedProject}
            onMaximizeProject={() => {
              if (selectedProject) createExpandedProject(selectedProject);
            }}
          />
        )}
        {/* Native no-drag exclusion must follow pane drag regions in DOM order. */}
        <button
          type="button"
          data-sidebar-toggle
          className={[
            "electron-window-no-drag workspace-top-action bb-chrome-action absolute top-[10px] z-40",
            "left-[84px]",
          ].join(" ")}
          aria-label={t(sidebarCollapsed ? "sidebar.show" : "sidebar.hide")}
          title={t(sidebarCollapsed ? "sidebar.show" : "sidebar.hide")}
          onClick={() => sendPane({ type: "sidebarToggle" })}
        >
          <PanelLeftIcon className="size-4" aria-hidden="true" />
        </button>
        <div className="electron-window-no-drag absolute left-[116px] top-[10px] z-40">
          <ProjectMoveIndicator pending={projectMovePending} />
        </div>
      </div>
      <Toaster theme={theme} duration={4000} closeButton />
    </TooltipProvider>
  );
}
