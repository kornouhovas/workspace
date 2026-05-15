export type WorkspaceAppStatus = "idle" | "loading" | "ready" | "error";

export type WorkspaceRootState = {
  readonly workspaceId: string;
  readonly name: string;
  readonly path: string;
};

export type WorkspaceViewState = {
  readonly id: string;
  readonly name: string;
  readonly viewType: string;
};

export type WorkspaceFolderRole = "group" | "status" | "project";

export type WorkspaceFolderRoleNode = {
  readonly id: string;
  readonly name: string;
  readonly relativePath: string;
  readonly role: WorkspaceFolderRole;
  readonly status: string;
  readonly children: readonly WorkspaceFolderRoleNode[];
};

export type WorkspaceProjectionResponse = {
  readonly workspaceId: string;
  readonly view: WorkspaceViewState;
  readonly visibleProperties: readonly {
    readonly id: string;
    readonly name: string;
    readonly propertyType: string;
    readonly system: boolean;
  }[];
  readonly statusValues: readonly {
    readonly id: string;
    readonly name: string;
    readonly relativePath: string | null;
    readonly source: string;
  }[];
  readonly projection:
    | {
        readonly type: "board";
        readonly capabilities: {
          readonly canMoveBetweenStatuses: boolean;
        };
        readonly columns: readonly {
          readonly statusValueId: string;
          readonly name: string;
          readonly projects: readonly unknown[];
        }[];
      }
    | {
        readonly type: "table";
        readonly rows: readonly unknown[];
      };
};

export type WorkspaceViewsResponse = {
  readonly workspaceId: string;
  readonly activeViewId: string | null;
  readonly views: readonly WorkspaceViewState[];
};

export type WorkspaceAppState = {
  readonly status: WorkspaceAppStatus;
  readonly root: WorkspaceRootState | null;
  readonly workspaceId: string | null;
  readonly projection: WorkspaceProjectionResponse | null;
  readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
  readonly views: readonly WorkspaceViewState[];
  readonly activeViewId: string | null;
  readonly searchQuery: string;
  readonly selectedProjectId: string | null;
  readonly detailOpen: boolean;
  readonly sourceFolderMissing: boolean;
  readonly error: string | null;
};

export type WorkspaceAppAction =
  | { readonly type: "loadStarted" }
  | { readonly type: "rootSelected"; readonly root: WorkspaceRootState }
  | { readonly type: "sourceFolderMissing" }
  | {
      readonly type: "projectionLoaded";
      readonly root: WorkspaceRootState;
      readonly viewsResponse: WorkspaceViewsResponse;
      readonly projectionResponse: WorkspaceProjectionResponse;
      readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
    }
  | { readonly type: "projectionUpdated"; readonly projectionResponse: WorkspaceProjectionResponse }
  | { readonly type: "workspaceActivated"; readonly workspaceId: string }
  | { readonly type: "serviceError"; readonly error: string }
  | { readonly type: "searchQueryChanged"; readonly searchQuery: string }
  | { readonly type: "activeViewChanged"; readonly activeViewId: string }
  | {
      readonly type: "viewCreated";
      readonly workspaceId: string;
      readonly activeViewId: string;
      readonly view: WorkspaceViewState;
    }
  | { readonly type: "viewRenamed"; readonly viewId: string; readonly name: string }
  | { readonly type: "viewDeleted"; readonly viewId: string; readonly activeViewId: string | null }
  | { readonly type: "projectSelected"; readonly selectedProjectId: string | null }
  | { readonly type: "detailOpenChanged"; readonly open: boolean };

export function createInitialWorkspaceAppState(): WorkspaceAppState {
  return {
    status: "idle",
    root: null,
    workspaceId: null,
    projection: null,
    folderRoleTree: [],
    views: [],
    activeViewId: null,
    searchQuery: "",
    selectedProjectId: null,
    detailOpen: false,
    sourceFolderMissing: false,
    error: null,
  };
}

export function workspaceAppStateReducer(
  state: WorkspaceAppState,
  action: WorkspaceAppAction,
): WorkspaceAppState {
  if (action.type === "loadStarted") {
    return {
      ...state,
      status: "loading",
      error: null,
      sourceFolderMissing: false,
    };
  }

  if (action.type === "sourceFolderMissing") {
    return {
      ...state,
      status: "ready",
      root: null,
      workspaceId: null,
      projection: null,
      folderRoleTree: [],
      views: [],
      activeViewId: null,
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: true,
      error: null,
    };
  }

  if (action.type === "rootSelected") {
    return {
      ...state,
      status: "loading",
      root: action.root,
      workspaceId: action.root.workspaceId,
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: false,
      error: null,
    };
  }

  if (action.type === "projectionLoaded") {
    const activeViewId =
      action.viewsResponse.activeViewId ||
      action.projectionResponse.view.id ||
      action.viewsResponse.views[0]?.id ||
      null;

    return {
      ...state,
      status: "ready",
      root: action.root,
      workspaceId: action.viewsResponse.workspaceId || action.root.workspaceId,
      projection: action.projectionResponse,
      folderRoleTree: action.folderRoleTree,
      views: action.viewsResponse.views,
      activeViewId,
      sourceFolderMissing: false,
      error: null,
    };
  }

  if (action.type === "projectionUpdated") {
    return {
      ...state,
      projection: action.projectionResponse,
      error: null,
    };
  }

  if (action.type === "workspaceActivated") {
    if (!state.root) {
      return state;
    }

    return {
      ...state,
      status: "loading",
      root: {
        ...state.root,
        workspaceId: action.workspaceId,
      },
      workspaceId: action.workspaceId,
      projection: null,
      views: [],
      activeViewId: null,
      searchQuery: "",
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: false,
      error: null,
    };
  }

  if (action.type === "serviceError") {
    return {
      ...state,
      status: "error",
      sourceFolderMissing: false,
      error: action.error,
    };
  }

  if (action.type === "searchQueryChanged") {
    return {
      ...state,
      searchQuery: action.searchQuery,
    };
  }

  if (action.type === "activeViewChanged") {
    return {
      ...state,
      activeViewId: action.activeViewId,
      searchQuery: "",
    };
  }

  if (action.type === "viewCreated") {
    if (action.workspaceId !== state.workspaceId) {
      return state;
    }

    const views = state.views.some((view) => view.id === action.view.id)
      ? state.views.map((view) => (view.id === action.view.id ? action.view : view))
      : [...state.views, action.view];

    return {
      ...state,
      views,
      activeViewId: action.activeViewId || action.view.id,
      searchQuery: "",
      selectedProjectId: null,
      detailOpen: false,
    };
  }

  if (action.type === "viewRenamed") {
    const name = action.name.trim();
    if (!name) {
      return state;
    }

    return {
      ...state,
      views: state.views.map((view) => (
        view.id === action.viewId ? { ...view, name } : view
      )),
      projection: state.projection
        ? {
            ...state.projection,
            view: state.projection.view.id === action.viewId
              ? { ...state.projection.view, name }
              : state.projection.view,
          }
        : state.projection,
    };
  }

  if (action.type === "viewDeleted") {
    const views = state.views.filter((view) => view.id !== action.viewId);
    const activeViewId = action.activeViewId && views.some((view) => view.id === action.activeViewId)
      ? action.activeViewId
      : views[0]?.id || null;

    return {
      ...state,
      views,
      activeViewId,
      projection: state.projection?.view.id === action.viewId ? null : state.projection,
      selectedProjectId: null,
      detailOpen: false,
    };
  }

  if (action.type === "projectSelected") {
    return {
      ...state,
      selectedProjectId: action.selectedProjectId,
      detailOpen: action.selectedProjectId !== null,
    };
  }

  if (action.type === "detailOpenChanged") {
    return {
      ...state,
      detailOpen: action.open,
      selectedProjectId: action.open ? state.selectedProjectId : null,
    };
  }

  return state;
}

export function filterWorkspaceProjectionBySearch(
  projectionResponse: WorkspaceProjectionResponse,
  searchQuery: string,
): WorkspaceProjectionResponse {
  const query = searchQuery.trim().toLocaleLowerCase();
  if (!query) {
    return projectionResponse;
  }

  if (projectionResponse.projection.type === "table") {
    return {
      ...projectionResponse,
      projection: {
        ...projectionResponse.projection,
        rows: projectionResponse.projection.rows.filter((project) => projectMatchesSearch(project, query)),
      },
    };
  }

  return {
    ...projectionResponse,
    projection: {
      ...projectionResponse.projection,
      columns: projectionResponse.projection.columns.map((column) => ({
        ...column,
        projects: column.projects.filter((project) => projectMatchesSearch(project, query)),
      })),
    },
  };
}

function projectMatchesSearch(project: unknown, query: string) {
  if (!isRecord(project)) {
    return false;
  }

  const propertyValues = isRecord(project.propertyValues) ? project.propertyValues : {};
  return [
    project.name,
    propertyValues["property:name"],
  ]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLocaleLowerCase().includes(query));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
