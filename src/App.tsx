import { useEffect, useMemo, useReducer, useState } from "react";
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
import {
  workspaceMockProjection,
  workspaceMockSettings,
  type WorkspaceMockProject,
} from "@/workspaceMockData";
import {
  createInitialWorkspaceAppState,
  workspaceAppStateReducer,
  type WorkspaceAppState,
  type WorkspaceProjectionResponse,
  type WorkspaceRootState,
  type WorkspaceViewsResponse,
} from "@/workspaceAppState";
import { createWorkspaceRendererTransport } from "@/workspaceRendererTransport";
import { WorkspaceServiceClient } from "@/workspaceServiceClient.js";

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

export default function App() {
  const [state, dispatch] = useReducer(
    workspaceAppStateReducer,
    undefined,
    createInitialWorkspaceAppState,
  );
  const [selectedProject, setSelectedProject] = useState<WorkspaceMockProject | null>(
    workspaceMockProjection.selectedProject,
  );
  const workspaceClient = useMemo(
    () => new WorkspaceServiceClient(createWorkspaceRendererTransport()),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceState() {
      dispatch({ type: "loadStarted" });

      try {
        const root = normalizeRootResponse(await workspaceClient.getRoot());
        if (cancelled) {
          return;
        }

        if (!root) {
          dispatch({ type: "sourceFolderMissing" });
          return;
        }

        const viewsResponse = normalizeViewsResponse(
          await workspaceClient.listViews({ workspaceId: root.workspaceId }),
          root.workspaceId,
        );
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

        if (!cancelled) {
          dispatch({
            type: "projectionLoaded",
            root,
            viewsResponse: { ...viewsResponse, activeViewId },
            projectionResponse,
          });
        }
      } catch (error) {
        const message = getServiceErrorMessage(error);
        if (!cancelled) {
          dispatch({ type: "serviceError", error: message });
          toast.error("Workspace service unavailable", {
            description: "Mock workspace data is shown while the service bridge is unavailable.",
          });
        }
      }
    }

    void loadWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [workspaceClient, state.activeViewId, state.searchQuery]);

  const viewState = {
    activeViewId: state.activeViewId || workspaceMockProjection.activeViewId,
    views: state.views.length > 0 ? state.views : workspaceMockProjection.views,
  };
  const sourceFolder = state.root
    ? {
        name: state.root.name,
        path: state.root.path || "Path unavailable",
        state: "connected",
      }
    : workspaceMockSettings.sourceFolder;
  const serviceProjection = state.projection;
  const visibleProperties =
    serviceProjection?.visibleProperties ?? workspaceMockProjection.visibleProperties;
  const boardProjection =
    serviceProjection?.projection.type === "board"
      ? serviceProjection.projection
      : workspaceMockProjection.projection;
  const tableProjection =
    serviceProjection?.projection.type === "table"
      ? serviceProjection.projection
      : workspaceMockProjection.tableProjection;

  return (
    <>
      <div className="dark flex h-screen min-h-0 bg-background text-foreground">
        <WorkspaceLeftPanel
          searchQuery={state.searchQuery}
          onSearchQueryChange={(searchQuery) => {
            dispatch({ type: "searchQueryChanged", searchQuery });
          }}
        />
        <main data-testid="workspace-main" className="flex min-w-0 flex-1 flex-col">
          <header className="electron-window-drag flex h-12 shrink-0 items-center border-b border-border px-4">
            <h1 className="text-sm font-medium">Workspace Project Board</h1>
          </header>
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
            />
            <div className="min-h-0 flex-1 overflow-auto">
              {state.status === "loading" || state.status === "idle" ? (
                <WorkspaceLoadingState />
              ) : state.sourceFolderMissing ? (
                <WorkspaceEmptyState />
              ) : (
                <>
                  <WorkspaceServiceError state={state} />
                  <WorkspaceSettingsView
                    sourceFolder={sourceFolder}
                    folderRoleTree={workspaceMockSettings.folderRoleTree}
                  />
                  <WorkspaceBoardView
                    projection={boardProjection as typeof workspaceMockProjection.projection}
                    visibleProperties={visibleProperties as typeof workspaceMockProjection.visibleProperties}
                  />
                  <WorkspaceTableView
                    projection={tableProjection as typeof workspaceMockProjection.tableProjection}
                    visibleProperties={visibleProperties as typeof workspaceMockProjection.visibleProperties}
                  />
                </>
              )}
            </div>
          </div>
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
