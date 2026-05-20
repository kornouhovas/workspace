import { randomUUID } from "node:crypto";

export const PROPERTY_NAME_ID = "property:name";
export const PROPERTY_STATUS_ID = "property:status";
export const NO_STATUS_VALUE_ID = "statusValue:no-status";
export const viewTypeIds = ["board", "table"];

export class WorkspaceViewError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = "WorkspaceViewError";
    this.code = code;
    this.field = field;
  }
}

export function createDefaultView({
  workspaceId,
  viewType,
  name,
  id = `view:${randomUUID()}`,
  order = 10,
  now = new Date().toISOString(),
} = {}) {
  if (!viewTypeIds.includes(viewType)) {
    throw new WorkspaceViewError("INVALID_VIEW_TYPE", "View type must be board or table.", "viewType");
  }

  const normalizedName = normalizeString(name).trim() || (viewType === "board" ? "Board" : "Table");

  return normalizeViewDocument({
    id,
    type: "view",
    schemaVersion: 1,
    workspaceId: normalizeRequiredString(workspaceId, "workspaceId"),
    name: normalizedName,
    viewType,
    order,
    visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID],
    hiddenPropertyIds: [],
    propertyOrder: {
      [PROPERTY_NAME_ID]: 10,
      [PROPERTY_STATUS_ID]: 20,
    },
    valueVisibility: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

export function normalizeViewDocument(view = {}) {
  const viewType = viewTypeIds.includes(view.viewType) ? view.viewType : "board";
  const visiblePropertyIds = normalizeVisiblePropertyIds(view.visiblePropertyIds);

  return {
    id: normalizeString(view.id),
    type: "view",
    schemaVersion: Number.isFinite(Number(view.schemaVersion)) ? Number(view.schemaVersion) : 1,
    workspaceId: normalizeString(view.workspaceId),
    name: normalizeString(view.name).trim() || (viewType === "board" ? "Board" : "Table"),
    viewType,
    order: normalizeOrder(view.order),
    visiblePropertyIds,
    hiddenPropertyIds: normalizeStringArray(view.hiddenPropertyIds).filter((id) => !visiblePropertyIds.includes(id)),
    propertyOrder: normalizePropertyOrder(view.propertyOrder, visiblePropertyIds),
    valueVisibility: normalizeValueVisibility(view.valueVisibility),
    createdAt: normalizeString(view.createdAt),
    updatedAt: normalizeString(view.updatedAt),
    deletedAt: view.deletedAt == null ? null : normalizeString(view.deletedAt),
  };
}

export function validateViewPatch({ patch = {}, propertyDefinitions = [], selectValues = [], statusValues = [] } = {}) {
  if (!isPlainObject(patch)) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "View patch must be an object.", "patch");
  }

  const forbiddenKeys = ["id", "workspaceId", "type", "schemaVersion", "createdAt", "deletedAt"];
  for (const key of forbiddenKeys) {
    if (Object.hasOwn(patch, key)) {
      throw new WorkspaceViewError("VALIDATION_FAILED", `View patch cannot update ${key}.`, key);
    }
  }

  if (Object.hasOwn(patch, "viewType")) {
    throw new WorkspaceViewError("INVALID_VIEW_TYPE", "View type cannot be changed in MVP.", "viewType");
  }

  const propertyIds = new Set(propertyDefinitions.filter((item) => !item.deletedAt).map((item) => item.id));
  const hasVisiblePropertyIdsPatch = Object.hasOwn(patch, "visiblePropertyIds");
  const visiblePropertyIds = hasVisiblePropertyIdsPatch
    ? normalizeStringArray(patch.visiblePropertyIds)
    : null;

  if (hasVisiblePropertyIdsPatch) {
    for (const requiredId of [PROPERTY_NAME_ID]) {
      if (!visiblePropertyIds.includes(requiredId)) {
        throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", `${requiredId} is required in MVP.`, "visiblePropertyIds");
      }
    }

    for (const propertyId of visiblePropertyIds) {
      if (!propertyIds.has(propertyId)) {
        throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Visible property does not exist.", "visiblePropertyIds");
      }
    }
  }

  if (isPlainObject(patch.propertyOrder)) {
    const visiblePropertyIdSet = hasVisiblePropertyIdsPatch ? new Set(visiblePropertyIds) : null;
    for (const propertyId of Object.keys(patch.propertyOrder)) {
      if (!propertyIds.has(propertyId)) {
        throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Property order references an unknown property.", "propertyOrder");
      }

      if (visiblePropertyIdSet && !visiblePropertyIdSet.has(propertyId)) {
        throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Property order references a hidden property.", "propertyOrder");
      }
    }
  }

  validateValueVisibilityReferences({
    valueVisibility: patch.valueVisibility,
    propertyDefinitions,
    selectValues,
    statusValues,
  });
}

export function filterProjectsForView({ projects = [], view, searchQuery = "" } = {}) {
  const normalizedView = normalizeViewDocument(view);
  const query = normalizeString(searchQuery).trim().toLocaleLowerCase();

  return projects.filter((project) => {
    if (query && !projectNameSearchText(project).includes(query)) {
      return false;
    }

    return matchesValueVisibility(project, normalizedView.valueVisibility);
  });
}

export function createViewProjection({
  view,
  projects = [],
  visibleProperties = [],
  statusValues = [],
  searchQuery = "",
} = {}) {
  const normalizedView = normalizeViewDocument(view);
  const filteredProjects = filterProjectsForView({ projects, view: normalizedView, searchQuery });
  const response = {
    workspaceId: normalizedView.workspaceId,
    view: {
      id: normalizedView.id,
      name: normalizedView.name,
      viewType: normalizedView.viewType,
    },
    visibleProperties,
    statusValues,
  };

  if (normalizedView.viewType === "table") {
    return {
      ...response,
      projection: {
        type: "table",
        rows: filteredProjects,
      },
    };
  }

  const boardStatusValues = createBoardStatusValues({ statusValues, filteredProjects });

  return {
    ...response,
    statusValues: boardStatusValues,
    projection: {
      type: "board",
      capabilities: {
        canMoveBetweenStatuses: false,
      },
      columns: boardStatusValues.map((statusValue) => ({
        statusValueId: statusValue.id,
        name: statusValue.name,
        projects: filteredProjects.filter((project) => getProjectStatusValueId(project) === statusValue.id),
      })),
    },
  };
}

function normalizeVisiblePropertyIds(value) {
  const ids = normalizeStringArray(value);
  if (!Array.isArray(value)) {
    return [PROPERTY_NAME_ID, PROPERTY_STATUS_ID];
  }

  return uniqueStrings([PROPERTY_NAME_ID, ...ids]);
}

function normalizeValueVisibility(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([propertyId, setting]) => typeof propertyId === "string" && isPlainObject(setting))
      .map(([propertyId, setting]) => [
        propertyId,
        {
          mode: "include",
          valueIds: uniqueStrings(normalizeStringArray(setting.valueIds)),
          includeEmpty: setting.includeEmpty === true,
        },
      ])
      .filter(([, setting]) => setting.valueIds.length > 0 || setting.includeEmpty),
  );
}

function validateValueVisibilityReferences({ valueVisibility, propertyDefinitions, selectValues, statusValues }) {
  if (!isPlainObject(valueVisibility)) {
    return;
  }

  const propertiesById = new Map(propertyDefinitions.filter((item) => !item.deletedAt).map((item) => [item.id, item]));
  const selectValuesByProperty = new Map();

  for (const value of selectValues.filter((item) => !item.deletedAt)) {
    const values = selectValuesByProperty.get(value.propertyId) || new Set();
    values.add(value.id);
    selectValuesByProperty.set(value.propertyId, values);
  }

  const statusValueIds = new Set(statusValues.map((item) => item.id));

  for (const [propertyId, rawSetting] of Object.entries(valueVisibility)) {
    if (typeof propertyId !== "string" || !isPlainObject(rawSetting)) {
      continue;
    }

    const property = propertiesById.get(propertyId);
    if (!property) {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Filter property does not exist.", "valueVisibility");
    }

    const setting = {
      valueIds: uniqueStrings(normalizeStringArray(rawSetting.valueIds)),
    };

    if (propertyId === PROPERTY_STATUS_ID) {
      for (const valueId of setting.valueIds) {
        if (!statusValueIds.has(valueId)) {
          throw new WorkspaceViewError("INVALID_VALUE_REFERENCE", "Status filter value does not exist.", "valueVisibility");
        }
      }
      continue;
    }

    if (property.type !== "select" && property.type !== "multi-select") {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Only select properties can be filtered by value.", "valueVisibility");
    }

    const allowedValues = selectValuesByProperty.get(propertyId) || new Set();
    for (const valueId of setting.valueIds) {
      if (!allowedValues.has(valueId)) {
        throw new WorkspaceViewError("INVALID_VALUE_REFERENCE", "Select filter value does not exist for property.", "valueVisibility");
      }
    }
  }
}

function matchesValueVisibility(project, valueVisibility) {
  for (const [propertyId, setting] of Object.entries(valueVisibility)) {
    const value = propertyId === PROPERTY_STATUS_ID
      ? getProjectStatusValueId(project)
      : project.propertyValues?.[propertyId];

    if (propertyId === PROPERTY_STATUS_ID) {
      if (setting.valueIds.length === 0) {
        continue;
      }

      if (!setting.valueIds.includes(value)) {
        return false;
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        if (!setting.includeEmpty) {
          return false;
        }
        continue;
      }

      if (!value.some((item) => setting.valueIds.includes(item))) {
        return false;
      }
      continue;
    }

    if (!value) {
      if (!setting.includeEmpty) {
        return false;
      }
      continue;
    }

    if (!setting.valueIds.includes(value)) {
      return false;
    }
  }

  return true;
}

function createBoardStatusValues({ statusValues, filteredProjects }) {
  if (
    statusValues.some((statusValue) => statusValue.id === NO_STATUS_VALUE_ID)
    || !filteredProjects.some((project) => getProjectStatusValueId(project) === NO_STATUS_VALUE_ID)
  ) {
    return statusValues;
  }

  return [
    ...statusValues,
    {
      id: NO_STATUS_VALUE_ID,
      name: "No status",
      relativePath: null,
      source: "no-status",
    },
  ];
}

function projectNameSearchText(project) {
  return [
    project?.name,
    project?.propertyValues?.[PROPERTY_NAME_ID],
  ]
    .map((value) => normalizeString(value).toLocaleLowerCase())
    .join(" ");
}

function getProjectStatusValueId(project) {
  return project?.status?.id || project?.propertyValues?.[PROPERTY_STATUS_ID] || NO_STATUS_VALUE_ID;
}

function normalizePropertyOrder(value, visiblePropertyIds) {
  const input = isPlainObject(value) ? value : {};
  return Object.fromEntries(
    visiblePropertyIds.map((propertyId, index) => [
      propertyId,
      normalizeOrder(input[propertyId], (index + 1) * 10),
    ]),
  );
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? uniqueStrings(value.map(normalizeString).filter(Boolean)) : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value !== ""))];
}

function normalizeString(value) {
  return value == null ? "" : String(value);
}

function normalizeRequiredString(value, field) {
  const text = normalizeString(value).trim();
  if (!text) {
    throw new WorkspaceViewError("VALIDATION_FAILED", `${field} is required.`, field);
  }
  return text;
}

function normalizeOrder(value, fallback = 0) {
  const order = Number(value);
  return Number.isFinite(order) ? order : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
