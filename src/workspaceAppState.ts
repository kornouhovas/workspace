export type WorkspaceAppStatus = "idle" | "loading" | "ready" | "error";

export type WorkspaceServiceErrorState =
  | string
  | { readonly kind: "localized"; readonly translationKey: string }
  | { readonly kind: "opaque"; readonly message: string };

export type WorkspaceRootState = {
  readonly workspaceId: string;
  readonly name: string;
  readonly path: string;
};

export type WorkspaceGroupingState = {
  readonly propertyId: string;
  readonly sort: "default" | "ascending" | "descending" | "manual";
  readonly manualOrder: readonly string[];
  readonly hiddenGroupIds: readonly string[];
  readonly collapsedGroupIds: readonly string[];
  readonly hideEmpty: boolean;
};
export type WorkspaceTableGroup = {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly empty: boolean;
  readonly rows: readonly unknown[];
  readonly count: number;
  readonly hidden: boolean;
  readonly collapsed: boolean;
};
export type WorkspaceViewState = {
  readonly columnOrder?: readonly string[];
  readonly hiddenColumnIds?: readonly string[];
  readonly rowOrder?: readonly string[];
  readonly grouping?: WorkspaceGroupingState | null;
  readonly groupingNotice?: string | null;
  readonly id: string;
  readonly name: string;
  readonly viewType: string;
  readonly visiblePropertyIds?: readonly string[];
  readonly propertyOrder?: Record<string, number>;
  readonly valueVisibility?: Record<string, { readonly valueIds: readonly string[]; readonly includeEmpty?: boolean }>;
  readonly propertyLayout?: Record<string, { readonly wrapContent?: boolean }>;
  readonly tableColumnWidths?: Record<string, number>;
  readonly boardLayout?: { readonly columnWidth: number; readonly wrapContent?: boolean };
};

export type WorkspacePropertyDefinitionState = {
  readonly id: string;
  readonly name: string;
  readonly type?: string;
  readonly propertyType: string;
  readonly system: boolean;
  readonly hidden?: boolean;
  readonly order?: number;
};

export type WorkspaceSelectValueState = {
  readonly id: string;
  readonly workspaceId?: string;
  readonly propertyId: string;
  readonly name: string;
  readonly color?: string;
  readonly hidden?: boolean;
  readonly order?: number;
};

export type WorkspacePropertyCatalogState = {
  readonly workspaceId: string;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly usage?: {
    readonly propertyValueCounts?: Record<string, number>;
    readonly selectValueCounts?: Record<string, number>;
  };
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
    readonly type?: string;
    readonly propertyType: string;
    readonly system: boolean;
    readonly hidden?: boolean;
    readonly order?: number;
  }[];
  readonly statusValues: readonly {
    readonly id: string;
    readonly name: string;
    readonly relativePath: string | null;
    readonly source: string;
    readonly color?: string;
  }[];
  readonly projection:
    | {
        readonly type: "board";
        readonly groupOptions?: readonly WorkspaceTableGroup[];
        readonly groupingNotice?: string;
        readonly totalProjectCount?: number;
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
        readonly groups?: readonly WorkspaceTableGroup[];
        readonly groupOptions?: readonly WorkspaceTableGroup[];
        readonly totalProjectCount?: number;
        readonly groupingNotice?: string;
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
  readonly projectionRefreshing: boolean;
  readonly viewRequestVersion: number;
  readonly projectionInvalidated: boolean;
  readonly workspaceSwitchPending: boolean;
  readonly propertyCatalog: WorkspacePropertyCatalogState | null;
  readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
  readonly views: readonly WorkspaceViewState[];
  readonly activeViewId: string | null;
  readonly searchQuery: string;
  readonly selectedProjectId: string | null;
  readonly detailOpen: boolean;
  readonly sourceFolderMissing: boolean;
  readonly error: WorkspaceServiceErrorState | null;
  readonly propertySaveError: string | null;
  readonly propertySaveVersions: Readonly<Record<string, number>>;
};

export type WorkspaceAppAction =
  | { readonly type: "loadStarted" }
  | { readonly type: "projectionInvalidated" }
  | { readonly type: "rootSelected"; readonly root: WorkspaceRootState }
  | { readonly type: "sourceFolderMissing"; readonly root?: WorkspaceAppState["root"] }
  | {
      readonly type: "projectionLoaded";
      readonly replaceWorkspace?: boolean;
      readonly viewRequestVersion?: number;
      readonly root: WorkspaceRootState;
      readonly viewsResponse: WorkspaceViewsResponse;
      readonly projectionResponse: WorkspaceProjectionResponse;
      readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
    }
  | { readonly type: "projectionUpdated"; readonly projectionResponse: WorkspaceProjectionResponse; readonly viewRequestVersion?: number }
  | { readonly type: "propertiesLoaded"; readonly propertiesResponse: WorkspacePropertyCatalogState }
  | { readonly type: "propertyDeleted"; readonly propertyId: string }
  | {
      readonly type: "projectPropertyValueSaveStarted";
      readonly projectId: string;
      readonly propertyId: string;
      readonly requestVersion: number;
    }
  | {
      readonly type: "projectPropertyValueUpdated";
      readonly projectId: string;
      readonly propertyId: string;
      readonly value: unknown;
      readonly requestVersion?: number;
    }
  | {
      readonly type: "viewPropertiesUpdated";
      readonly viewId: string;
      readonly visiblePropertyIds: readonly string[];
      readonly propertyOrder: Record<string, number>;
    }
  | {
      readonly type: "viewValueVisibilityUpdated";
      readonly viewId: string;
      readonly valueVisibility: NonNullable<WorkspaceViewState["valueVisibility"]>;
    }
  | {
      readonly type: "viewPropertyLayoutUpdated";
      readonly viewId: string;
      readonly propertyLayout: NonNullable<WorkspaceViewState["propertyLayout"]>;
    }
  | {
      readonly type: "viewBoardOrderUpdated";
      readonly workspaceId: string;
      readonly viewId: string;
      readonly viewRequestVersion: number;
      readonly columnOrder: readonly string[];
    }
  | {
      readonly type: "viewBoardLayoutUpdated";
      readonly viewId: string;
      readonly boardLayout: NonNullable<WorkspaceViewState["boardLayout"]>;
    }
  | {
      readonly type: "propertySaveFailed";
      readonly error: string;
      readonly projectId?: string;
      readonly propertyId?: string;
      readonly requestVersion?: number;
    }
  | { readonly type: "workspaceSwitchStarted" }
  | { readonly type: "workspaceSwitchCancelled" }
  | { readonly type: "workspaceActivated"; readonly workspaceId: string }
  | { readonly type: "serviceError"; readonly error: WorkspaceServiceErrorState }
  | { readonly type: "searchQueryChanged"; readonly searchQuery: string }
  | { readonly type: "activeViewChanged"; readonly activeViewId: string }
  | {
      readonly type: "viewCreated";
      readonly workspaceId: string;
      readonly activeViewId: string;
      readonly view: WorkspaceViewState;
    }
  | { readonly type: "viewRenamed"; readonly viewId: string; readonly name: string }
  | { readonly type: "viewsReordered"; readonly orderedViewIds: readonly string[] }
  | { readonly type: "viewDeleted"; readonly viewId: string; readonly activeViewId: string | null }
  | { readonly type: "projectSelected"; readonly selectedProjectId: string | null }
  | { readonly type: "detailOpenChanged"; readonly open: boolean };

export function createInitialWorkspaceAppState(): WorkspaceAppState {
  return {
    status: "idle",
    root: null,
    workspaceId: null,
    projection: null,
    projectionRefreshing: false,
    viewRequestVersion: 0,
    projectionInvalidated: false,
    workspaceSwitchPending: false,
    propertyCatalog: null,
    folderRoleTree: [],
    views: [],
    activeViewId: null,
    searchQuery: "",
    selectedProjectId: null,
    detailOpen: false,
    sourceFolderMissing: false,
    error: null,
    propertySaveError: null,
    propertySaveVersions: {},
  };
}

export function workspaceAppStateReducer(
  state: WorkspaceAppState,
  action: WorkspaceAppAction,
): WorkspaceAppState {
  if ((action.type === "projectionLoaded" || action.type === "projectionUpdated") &&
    action.viewRequestVersion !== undefined && action.viewRequestVersion !== state.viewRequestVersion) {
    return state;
  }
  if (action.type === "projectionInvalidated") {
    return { ...state, projectionInvalidated: true, projectionRefreshing: true, viewRequestVersion: state.viewRequestVersion + 1 };
  }
  if (action.type === "loadStarted") {
    if (state.status === "ready" && state.projection) {
      return {
        ...state,
        error: null,
        sourceFolderMissing: false,
      };
    }

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
      root: action.root ?? null,
      workspaceId: action.root?.workspaceId ?? null,
      projection: null,
      projectionRefreshing: false,
      workspaceSwitchPending: false,
      propertyCatalog: null,
      folderRoleTree: [],
      views: [],
      activeViewId: null,
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: true,
      error: null,
      propertySaveError: null,
      propertySaveVersions: {},
    };
  }

  if (action.type === "rootSelected") {
    if (
      state.status === "ready" &&
      state.projection &&
      state.root?.path &&
      state.root.path === action.root.path
    ) {
      const workspaceChanged = state.workspaceId !== action.root.workspaceId;

      if (workspaceChanged) {
        return clearWorkspaceScopedStateForSwitch(state, action.root);
      }

      const keepStaleWorkspaceSurface = state.workspaceSwitchPending &&
        state.projection !== null &&
        state.projection.workspaceId !== action.root.workspaceId;

      return {
        ...state,
        root: action.root,
        workspaceId: action.root.workspaceId,
        projection: state.projection,
        projectionRefreshing: false,
        workspaceSwitchPending: keepStaleWorkspaceSurface,
        propertyCatalog: state.propertyCatalog,
        views: state.views,
        activeViewId: state.activeViewId,
        searchQuery: state.searchQuery,
        selectedProjectId: null,
        detailOpen: false,
        sourceFolderMissing: false,
        error: null,
        propertySaveError: null,
        propertySaveVersions: state.propertySaveVersions,
      };
    }

    return {
      ...state,
      status: "loading",
      viewRequestVersion: state.viewRequestVersion + 1,
      projectionInvalidated: true,
      root: action.root,
      workspaceId: action.root.workspaceId,
      projectionRefreshing: false,
      workspaceSwitchPending: false,
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: false,
      error: null,
      propertySaveError: null,
    };
  }

  if (action.type === "projectionLoaded") {
    const activeViewId =
      action.viewsResponse.activeViewId ||
      action.projectionResponse.view.id ||
      action.viewsResponse.views[0]?.id ||
      null;
    const workspaceId = action.viewsResponse.workspaceId || action.root.workspaceId;

    if (!action.replaceWorkspace && state.workspaceId && state.workspaceId !== workspaceId) {
      return state;
    }

    if (!action.replaceWorkspace && state.activeViewId && state.activeViewId !== activeViewId && !state.workspaceSwitchPending) {
      return state;
    }

    if (
      action.projectionResponse.workspaceId !== workspaceId ||
      action.projectionResponse.view.id !== activeViewId
    ) {
      return state;
    }

    return {
      ...state,
      status: "ready",
      root: action.root,
      workspaceId,
      projection: action.projectionResponse,
      projectionInvalidated: false,
      projectionRefreshing: false,
      workspaceSwitchPending: false,
      searchQuery: state.workspaceId === workspaceId ? state.searchQuery : "",
      propertySaveVersions: state.workspaceId === workspaceId ? state.propertySaveVersions : {},
      propertyCatalog: state.propertyCatalog?.workspaceId === workspaceId
        ? state.propertyCatalog
        : null,
      folderRoleTree: action.folderRoleTree,
      views: action.viewsResponse.views,
      activeViewId,
      sourceFolderMissing: false,
      error: null,
      propertySaveError: null,
    };
  }

  if (action.type === "projectionUpdated") {
    if (
      action.projectionResponse.workspaceId !== state.workspaceId ||
      action.projectionResponse.view.id !== state.activeViewId
    ) {
      return state;
    }

    return {
      ...state,
      projection: action.projectionResponse,
      projectionInvalidated: false,
      views: state.views.map(view => view.id === action.projectionResponse.view.id ? action.projectionResponse.view : view),
      projectionRefreshing: false,
      workspaceSwitchPending: false,
      error: null,
    };
  }

  if (action.type === "viewPropertiesUpdated") {
    const views = state.views.map((view) => (
      view.id === action.viewId
        ? {
            ...view,
            visiblePropertyIds: action.visiblePropertyIds,
            propertyOrder: action.propertyOrder,
          }
        : view
    ));

    return {
      ...state,
      views,
      projection: state.projection?.view.id === action.viewId
        ? {
            ...state.projection,
            view: {
              ...state.projection.view,
              visiblePropertyIds: action.visiblePropertyIds,
              propertyOrder: action.propertyOrder,
            },
            visibleProperties: createProjectionVisibleProperties(state, action.visiblePropertyIds),
          }
        : state.projection,
      error: null,
    };
  }

  if (action.type === "viewValueVisibilityUpdated") {
    const views = state.views.map((view) => (
      view.id === action.viewId
        ? {
            ...view,
            valueVisibility: action.valueVisibility,
          }
        : view
    ));

    return {
      ...state,
      views,
      projection: state.projection?.view.id === action.viewId
        ? {
            ...state.projection,
            view: {
              ...state.projection.view,
              valueVisibility: action.valueVisibility,
            },
          }
        : state.projection,
      error: null,
    };
  }

  if (action.type === "viewPropertyLayoutUpdated") {
    const views = state.views.map((view) => (
      view.id === action.viewId
        ? {
            ...view,
            propertyLayout: action.propertyLayout,
          }
        : view
    ));

    return {
      ...state,
      views,
      projection: state.projection?.view.id === action.viewId
        ? {
            ...state.projection,
            view: {
              ...state.projection.view,
              propertyLayout: action.propertyLayout,
            },
          }
        : state.projection,
      error: null,
    };
  }

  if (action.type === "viewBoardOrderUpdated") {
    if (state.workspaceId !== action.workspaceId || state.activeViewId !== action.viewId ||
      state.viewRequestVersion !== action.viewRequestVersion) return state;
    return { ...state,
      views: state.views.map(view => view.id === action.viewId ? { ...view, columnOrder: action.columnOrder } : view),
      projection: state.projection?.view.id === action.viewId ? { ...state.projection,
        view: { ...state.projection.view, columnOrder: action.columnOrder } } : state.projection,
    };
  }

  if (action.type === "viewBoardLayoutUpdated") {
    const views = state.views.map((view) => (
      view.id === action.viewId
        ? { ...view, boardLayout: action.boardLayout }
        : view
    ));

    return {
      ...state,
      views,
      projection: state.projection?.view.id === action.viewId
        ? {
            ...state.projection,
            view: {
              ...state.projection.view,
              boardLayout: action.boardLayout,
            },
          }
        : state.projection,
      error: null,
    };
  }

  if (action.type === "propertiesLoaded") {
    if (action.propertiesResponse.workspaceId !== state.workspaceId) {
      return state;
    }

    return {
      ...state,
      projection: state.projection
        ? refreshProjectionVisibleProperties({
            projectionResponse: state.projection,
            properties: action.propertiesResponse.properties,
          })
        : state.projection,
      propertyCatalog: action.propertiesResponse,
      propertySaveError: null,
    };
  }

  if (action.type === "propertyDeleted") {
    const deletedSelectValueIds = new Set(
      state.propertyCatalog?.selectValues
        .filter((value) => value.propertyId === action.propertyId)
        .map((value) => value.id) || [],
    );

    return {
      ...state,
      projection: state.projection
        ? removeProjectionProperty({
            projectionResponse: state.projection,
            propertyId: action.propertyId,
          })
        : state.projection,
      propertyCatalog: state.propertyCatalog
        ? {
            ...state.propertyCatalog,
            properties: state.propertyCatalog.properties.filter((property) => property.id !== action.propertyId),
            selectValues: state.propertyCatalog.selectValues.filter((value) => value.propertyId !== action.propertyId),
            usage: removePropertyUsage(state.propertyCatalog.usage, action.propertyId, deletedSelectValueIds),
          }
        : state.propertyCatalog,
      views: state.views.map((view) => removeViewPropertyReference(view, action.propertyId)),
      propertySaveError: null,
    };
  }

  if (action.type === "projectPropertyValueSaveStarted") {
    return {
      ...state,
      propertySaveVersions: {
        ...state.propertySaveVersions,
        [createPropertySaveKey(action.projectId, action.propertyId)]: action.requestVersion,
      },
    };
  }

  if (action.type === "projectPropertyValueUpdated") {
    if (!isCurrentPropertySaveVersion(state, action)) {
      return state;
    }

    return {
      ...state,
      projection: state.projection
        ? updateProjectionProjectPropertyValue({
            projectionResponse: state.projection,
            projectId: action.projectId,
            propertyId: action.propertyId,
            value: action.value,
          })
        : state.projection,
      propertySaveError: null,
    };
  }

  if (action.type === "propertySaveFailed") {
    if (!isCurrentPropertySaveVersion(state, action)) {
      return state;
    }

    return {
      ...state,
      propertySaveError: action.error,
    };
  }

  if (action.type === "workspaceSwitchStarted") {
    return { ...state, workspaceSwitchPending: true, viewRequestVersion: state.viewRequestVersion + 1 };
  }

  if (action.type === "workspaceSwitchCancelled") {
    return { ...state, workspaceSwitchPending: false };
  }

  if (action.type === "workspaceActivated") {
    if (!state.root) {
      return state;
    }

    const nextRoot = {
      ...state.root,
      workspaceId: action.workspaceId,
    };

    if (state.workspaceId !== action.workspaceId) {
      return clearWorkspaceScopedStateForSwitch(state, nextRoot);
    }

    return {
      ...state,
      root: nextRoot,
      workspaceId: action.workspaceId,
      projection: state.projection,
      projectionRefreshing: false,
      workspaceSwitchPending: true,
      propertyCatalog: state.propertyCatalog,
      views: state.views,
      activeViewId: state.activeViewId,
      searchQuery: "",
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: false,
      error: null,
      propertySaveError: null,
      propertySaveVersions: {},
    };
  }

  if (action.type === "serviceError") {
    return {
      ...state,
      status: "error",
      sourceFolderMissing: false,
      error: action.error,
      projectionRefreshing: false,
      workspaceSwitchPending: false,
    };
  }

  if (action.type === "searchQueryChanged") {
    return {
      ...state,
      searchQuery: action.searchQuery,
    };
  }

  if (action.type === "activeViewChanged") {
    const transitionProjection = state.projection;

    return {
      ...state,
      activeViewId: action.activeViewId,
      projection: transitionProjection,
      projectionRefreshing: state.projectionInvalidated || transitionProjection?.view.id !== action.activeViewId,
      viewRequestVersion: state.viewRequestVersion + 1,
      workspaceSwitchPending: false,
      selectedProjectId: null,
      detailOpen: false,
    };
  }

  if (action.type === "viewCreated") {
    if (action.workspaceId !== state.workspaceId) {
      return state;
    }

    const views = state.views.some((view) => view.id === action.view.id)
      ? state.views.map((view) => (view.id === action.view.id ? action.view : view))
      : [...state.views, action.view];
    const activeViewId = action.activeViewId || action.view.id;
    const transitionProjection = state.projection;

    return {
      ...state,
      views,
      activeViewId,
      projection: transitionProjection,
      projectionRefreshing: state.projectionInvalidated || transitionProjection?.view.id !== activeViewId,
      viewRequestVersion: state.viewRequestVersion + 1,
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

  if (action.type === "viewsReordered") {
    const viewsById = new Map(state.views.map((view) => [view.id, view]));
    const reorderedViews = action.orderedViewIds
      .map((viewId) => viewsById.get(viewId))
      .filter((view): view is WorkspaceViewState => view !== undefined);
    const reorderedViewIds = new Set(reorderedViews.map((view) => view.id));
    const remainingViews = state.views.filter((view) => !reorderedViewIds.has(view.id));

    return {
      ...state,
      views: [...reorderedViews, ...remainingViews],
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
      projection: state.projection,
      viewRequestVersion: state.viewRequestVersion + 1,
      projectionRefreshing: state.projection?.view.id === action.viewId && activeViewId !== null,
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

// A service snapshot keeps its own identity throughout a saved-view transition.
// There is no cross-view cache: every newly activated target is read from the service.
export function getWorkspaceSurfaceState(state: WorkspaceAppState) {
  const projection = state.status === "loading" || state.status === "idle" ? null : state.projection;
  const interactionDisabled = projection !== null &&
    (state.workspaceSwitchPending || state.projectionInvalidated || projection.workspaceId !== state.workspaceId || projection.view.id !== state.activeViewId);
  return {
    projection,
    viewId: projection?.view.id ?? state.activeViewId,
    pendingViewId: interactionDisabled && !state.workspaceSwitchPending ? state.activeViewId : null,
    interactionDisabled,
  };
}

function clearWorkspaceScopedStateForSwitch(
  state: WorkspaceAppState,
  root: WorkspaceRootState | null,
): WorkspaceAppState {
  const hasRenderableWorkspaceState = state.status === "ready" && state.projection !== null;

  return {
    ...state,
    status: hasRenderableWorkspaceState ? "ready" : "loading",
    root,
    workspaceId: root?.workspaceId || null,
    projection: hasRenderableWorkspaceState ? state.projection : null,
    projectionRefreshing: false,
    workspaceSwitchPending: true,
    viewRequestVersion: state.viewRequestVersion + 1,
    propertyCatalog: hasRenderableWorkspaceState ? state.propertyCatalog : null,
    views: hasRenderableWorkspaceState ? state.views : [],
    activeViewId: hasRenderableWorkspaceState ? state.activeViewId : null,
    searchQuery: "",
    selectedProjectId: null,
    detailOpen: false,
    sourceFolderMissing: false,
    error: null,
    propertySaveError: null,
    propertySaveVersions: {},
  };
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
    const rows = projectionResponse.projection.rows.filter(project => projectMatchesSearch(project, query));
    const filterGroups = (groups: readonly WorkspaceTableGroup[] | undefined) => groups?.map(group => {
      const groupRows = group.rows.filter(project => projectMatchesSearch(project, query));
      return { ...group, rows: groupRows, count: groupRows.length };
    });
    return {
      ...projectionResponse,
      projection: {
        ...projectionResponse.projection,
        rows,
        totalProjectCount: new Set(rows.map(project => isRecord(project) ? project.id : project)).size,
        groups: filterGroups(projectionResponse.projection.groups)?.filter(group => !projectionResponse.view.grouping?.hideEmpty || group.count > 0),
        groupOptions: filterGroups(projectionResponse.projection.groupOptions),
      },
    };
  }

  return {
    ...projectionResponse,
    projection: {
      ...projectionResponse.projection,
      totalProjectCount: new Set((projectionResponse.projection.groupOptions?.length
        ? projectionResponse.projection.groupOptions.flatMap(group => group.rows)
        : projectionResponse.projection.columns.flatMap(column => column.projects))
        .filter(project => projectMatchesSearch(project, query)).map(project => isRecord(project) ? project.id : project)).size,
      groupOptions: projectionResponse.projection.groupOptions?.map(group => {
        const rows = group.rows.filter(project => projectMatchesSearch(project, query));
        return { ...group, rows, count: rows.length };
      }),
      columns: projectionResponse.projection.columns
        .map((column) => ({
          ...column,
          projects: column.projects.filter((project) => projectMatchesSearch(project, query)),
          count: column.projects.filter((project) => projectMatchesSearch(project, query)).length,
        })),
    },
  };
}

function createPropertySaveKey(projectId: string, propertyId: string) {
  return `${projectId}\0${propertyId}`;
}

function isCurrentPropertySaveVersion(
  state: WorkspaceAppState,
  action: {
    readonly projectId?: string;
    readonly propertyId?: string;
    readonly requestVersion?: number;
  },
) {
  if (action.requestVersion === undefined || !action.projectId || !action.propertyId) {
    return true;
  }

  return (
    state.propertySaveVersions[createPropertySaveKey(action.projectId, action.propertyId)] === action.requestVersion
  );
}

function removeViewPropertyReference(
  view: WorkspaceViewState,
  propertyId: string,
): WorkspaceViewState {
  const propertyOrder = { ...(view.propertyOrder || {}) };
  const valueVisibility = { ...(view.valueVisibility || {}) };
  const propertyLayout = { ...(view.propertyLayout || {}) };
  delete propertyOrder[propertyId];
  delete valueVisibility[propertyId];
  delete propertyLayout[propertyId];

  return {
    ...view,
    visiblePropertyIds: view.visiblePropertyIds?.filter((id) => id !== propertyId),
    propertyOrder,
    valueVisibility,
    propertyLayout,
    ...(view.grouping?.propertyId === propertyId ? { grouping: null, groupingNotice: "property-removed" } : {}),
  };
}

function removePropertyUsage(
  usage: WorkspacePropertyCatalogState["usage"],
  propertyId: string,
  selectValueIds: ReadonlySet<string>,
): WorkspacePropertyCatalogState["usage"] {
  if (!usage) {
    return usage;
  }

  const propertyValueCounts = { ...(usage.propertyValueCounts || {}) };
  const selectValueCounts = { ...(usage.selectValueCounts || {}) };
  delete propertyValueCounts[propertyId];
  for (const selectValueId of selectValueIds) {
    delete selectValueCounts[selectValueId];
  }

  return {
    ...usage,
    propertyValueCounts,
    selectValueCounts,
  };
}

function removeProjectionProperty({
  projectionResponse,
  propertyId,
}: {
  readonly projectionResponse: WorkspaceProjectionResponse;
  readonly propertyId: string;
}): WorkspaceProjectionResponse {
  const nextProjectionResponse = {
    ...projectionResponse,
    visibleProperties: projectionResponse.visibleProperties.filter((property) => property.id !== propertyId),
    view: removeViewPropertyReference(projectionResponse.view, propertyId),
  };

  if (projectionResponse.projection.type === "table") {
    return {
      ...nextProjectionResponse,
      projection: {
        ...projectionResponse.projection,
        ...(projectionResponse.view.grouping?.propertyId === propertyId ? {
          groups: undefined, groupOptions: undefined, groupingNotice: "property-removed",
        } : {}),
        rows: projectionResponse.projection.rows.map((project) =>
          removeProjectPropertyValue(project, propertyId),
        ),
      },
    };
  }

  return {
    ...nextProjectionResponse,
    projection: {
      ...projectionResponse.projection,
      columns: projectionResponse.projection.columns.map((column) => ({
        ...column,
        projects: column.projects.map((project) =>
          removeProjectPropertyValue(project, propertyId),
        ),
      })),
    },
  };
}

function refreshProjectionVisibleProperties({
  projectionResponse,
  properties,
}: {
  readonly projectionResponse: WorkspaceProjectionResponse;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
}): WorkspaceProjectionResponse {
  const propertiesById = new Map(properties.map((property) => [property.id, property]));
  let changed = false;
  const visibleProperties = projectionResponse.visibleProperties.map((property) => {
    const nextProperty = propertiesById.get(property.id);
    if (!nextProperty) {
      return property;
    }

    const refreshedProperty = refreshVisiblePropertyDefinition(property, nextProperty);
    if (refreshedProperty !== property) {
      changed = true;
    }
    return refreshedProperty;
  });

  return changed ? {
    ...projectionResponse,
    visibleProperties,
  } : projectionResponse;
}

function createProjectionVisibleProperties(
  state: WorkspaceAppState,
  visiblePropertyIds: readonly string[],
): WorkspaceProjectionResponse["visibleProperties"] {
  const currentPropertiesById = new Map(
    (state.projection?.visibleProperties || []).map((property) => [property.id, property]),
  );
  const catalogPropertiesById = new Map(
    (state.propertyCatalog?.properties || []).map((property) => [property.id, property]),
  );

  return visiblePropertyIds
    .map((propertyId) => {
      const currentProperty = currentPropertiesById.get(propertyId);
      const catalogProperty = catalogPropertiesById.get(propertyId);

      if (catalogProperty && currentProperty) {
        return refreshVisiblePropertyDefinition(currentProperty, catalogProperty);
      }

      if (catalogProperty) {
        return {
          id: catalogProperty.id,
          name: catalogProperty.name,
          type: catalogProperty.type,
          propertyType: catalogProperty.propertyType,
          system: catalogProperty.system,
          hidden: catalogProperty.hidden,
          order: catalogProperty.order,
        };
      }

      return currentProperty;
    })
    .filter((property): property is WorkspaceProjectionResponse["visibleProperties"][number] => (
      property !== undefined
    ));
}

function refreshVisiblePropertyDefinition(
  property: WorkspaceProjectionResponse["visibleProperties"][number],
  nextProperty: WorkspacePropertyDefinitionState,
): WorkspaceProjectionResponse["visibleProperties"][number] {
  let changed = false;
  const refreshedProperty = { ...property };

  if (property.name !== nextProperty.name) {
    refreshedProperty.name = nextProperty.name;
    changed = true;
  }

  if (property.propertyType !== nextProperty.propertyType) {
    refreshedProperty.propertyType = nextProperty.propertyType;
    changed = true;
  }

  if (property.system !== nextProperty.system) {
    refreshedProperty.system = nextProperty.system;
    changed = true;
  }

  if (
    (Object.hasOwn(property, "type") || nextProperty.type !== nextProperty.propertyType) &&
    property.type !== nextProperty.type
  ) {
    refreshedProperty.type = nextProperty.type;
    changed = true;
  }

  if (
    (Object.hasOwn(property, "hidden") || nextProperty.hidden !== undefined) &&
    property.hidden !== nextProperty.hidden
  ) {
    refreshedProperty.hidden = nextProperty.hidden;
    changed = true;
  }

  if (
    (Object.hasOwn(property, "order") || nextProperty.order !== undefined) &&
    property.order !== nextProperty.order
  ) {
    refreshedProperty.order = nextProperty.order;
    changed = true;
  }

  return changed ? refreshedProperty : property;
}

function removeProjectPropertyValue(project: unknown, propertyId: string) {
  if (!isRecord(project) || !isRecord(project.propertyValues) || !Object.hasOwn(project.propertyValues, propertyId)) {
    return project;
  }

  const propertyValues = { ...project.propertyValues };
  delete propertyValues[propertyId];

  return {
    ...project,
    propertyValues,
  };
}

function updateProjectionProjectPropertyValue({
  projectionResponse,
  projectId,
  propertyId,
  value,
}: {
  readonly projectionResponse: WorkspaceProjectionResponse;
  readonly projectId: string;
  readonly propertyId: string;
  readonly value: unknown;
}): WorkspaceProjectionResponse {
  if (projectionResponse.projection.type === "table") {
    return {
      ...projectionResponse,
      projection: {
        ...projectionResponse.projection,
        rows: projectionResponse.projection.rows.map((project) =>
          updateProjectPropertyValue(project, projectId, propertyId, value),
        ),
      },
    };
  }

  return {
    ...projectionResponse,
    projection: {
      ...projectionResponse.projection,
      columns: projectionResponse.projection.columns.map((column) => ({
        ...column,
        projects: column.projects.map((project) =>
          updateProjectPropertyValue(project, projectId, propertyId, value),
        ),
      })),
    },
  };
}

function updateProjectPropertyValue(project: unknown, projectId: string, propertyId: string, value: unknown) {
  if (!isRecord(project) || project.id !== projectId) {
    return project;
  }

  const propertyValues = isRecord(project.propertyValues) ? project.propertyValues : {};

  return {
    ...project,
    propertyValues: {
      ...propertyValues,
      [propertyId]: value,
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
