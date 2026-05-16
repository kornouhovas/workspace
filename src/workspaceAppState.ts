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
  readonly visiblePropertyIds?: readonly string[];
  readonly propertyOrder?: Record<string, number>;
  readonly valueVisibility?: Record<string, { readonly valueIds: readonly string[]; readonly includeEmpty?: boolean }>;
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
  readonly propertyCatalog: WorkspacePropertyCatalogState | null;
  readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
  readonly views: readonly WorkspaceViewState[];
  readonly activeViewId: string | null;
  readonly searchQuery: string;
  readonly selectedProjectId: string | null;
  readonly detailOpen: boolean;
  readonly sourceFolderMissing: boolean;
  readonly error: string | null;
  readonly propertySaveError: string | null;
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
  | { readonly type: "propertiesLoaded"; readonly propertiesResponse: WorkspacePropertyCatalogState }
  | { readonly type: "propertyDeleted"; readonly propertyId: string }
  | {
      readonly type: "projectPropertyValueUpdated";
      readonly projectId: string;
      readonly propertyId: string;
      readonly value: unknown;
    }
  | { readonly type: "propertySaveFailed"; readonly error: string }
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
      propertyCatalog: null,
      folderRoleTree: [],
      views: [],
      activeViewId: null,
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: true,
      error: null,
      propertySaveError: null,
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
      propertySaveError: null,
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
      propertyCatalog: state.propertyCatalog?.workspaceId === (action.viewsResponse.workspaceId || action.root.workspaceId)
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
    return {
      ...state,
      projection: action.projectionResponse,
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

  if (action.type === "projectPropertyValueUpdated") {
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
    return {
      ...state,
      propertySaveError: action.error,
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
      propertyCatalog: null,
      views: [],
      activeViewId: null,
      searchQuery: "",
      selectedProjectId: null,
      detailOpen: false,
      sourceFolderMissing: false,
      error: null,
      propertySaveError: null,
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

function removeViewPropertyReference(
  view: WorkspaceViewState,
  propertyId: string,
): WorkspaceViewState {
  const propertyOrder = { ...(view.propertyOrder || {}) };
  const valueVisibility = { ...(view.valueVisibility || {}) };
  delete propertyOrder[propertyId];
  delete valueVisibility[propertyId];

  return {
    ...view,
    visiblePropertyIds: view.visiblePropertyIds?.filter((id) => id !== propertyId),
    propertyOrder,
    valueVisibility,
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
