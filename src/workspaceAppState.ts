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
  | { readonly type: "sourceFolderMissing" }
  | {
      readonly type: "projectionLoaded";
      readonly root: WorkspaceRootState;
      readonly viewsResponse: WorkspaceViewsResponse;
      readonly projectionResponse: WorkspaceProjectionResponse;
      readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
    }
  | { readonly type: "serviceError"; readonly error: string }
  | { readonly type: "searchQueryChanged"; readonly searchQuery: string }
  | { readonly type: "activeViewChanged"; readonly activeViewId: string }
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
