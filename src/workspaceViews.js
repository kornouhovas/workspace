import { normalizeTableColumnWidths, TABLE_COLUMN_WIDTH_MIN } from './workspaceTableLayout.js';
import { normalizeGrouping, validateGrouping, createTableGrouping } from "./workspaceGrouping.js";
import { completeBoardColumnOrder } from "./workspaceBoardOrder.js";
import { completeTableRowOrder } from "./workspaceTableOrder.js";
import { randomUUID } from "node:crypto";

import {
  BOARD_COLUMN_WIDTH_DEFAULT,
  BOARD_COLUMN_WIDTH_MIN,
  BOARD_COLUMN_WIDTH_PERSISTED_MAX,
  normalizeBoardColumnWidth,
} from "./workspaceBoardLayout.js";

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
    propertyLayout: {},
    boardLayout: {
      columnWidth: BOARD_COLUMN_WIDTH_DEFAULT,
    },
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
    propertyLayout: normalizePropertyLayout(view.propertyLayout),
    boardLayout: normalizeBoardLayout(view.boardLayout),
    ...(viewType === "table" ? { tableColumnWidths: normalizeTableColumnWidths(view.tableColumnWidths) } : {}),
    ...(viewType === "board" ? { columnOrder: completeBoardColumnOrder(view.columnOrder), hiddenColumnIds: completeBoardColumnOrder(view.hiddenColumnIds) } : {}),
    ...(viewType === "table" ? { rowOrder: normalizeStringArray(view.rowOrder) } : {}),
    ...(viewType === "board" ? { boardGroupingVersion: 1 } : {}),
    grouping: viewType === "board" && !view.boardGroupingVersion && !view.grouping
      ? normalizeGrouping({ propertyId: PROPERTY_STATUS_ID,
          sort: view.columnOrder?.length ? "manual" : "default",
          manualOrder: (view.columnOrder || []).filter(id => id !== NO_STATUS_VALUE_ID).map(id => `value:${id}`),
          hiddenGroupIds: (view.hiddenColumnIds || []).map(id => id === NO_STATUS_VALUE_ID ? "empty" : `value:${id}`) })
      : normalizeGrouping(view.grouping),
    groupingNotice: view.groupingNotice === "property-removed" ? "property-removed" : null,
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

  if (Object.hasOwn(patch, "columnVisibility") && (!isPlainObject(patch.columnVisibility) || typeof patch.columnVisibility.statusValueId !== "string" || !patch.columnVisibility.statusValueId || typeof patch.columnVisibility.visible !== "boolean")) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "Column visibility requires a status ID and boolean visibility.", "columnVisibility");
  }
  if (Object.hasOwn(patch, "hiddenColumnIds") && (!Array.isArray(patch.hiddenColumnIds) || patch.hiddenColumnIds.some(id => typeof id !== "string" || !id) || new Set(patch.hiddenColumnIds).size !== patch.hiddenColumnIds.length)) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "Hidden columns require unique status IDs.", "hiddenColumnIds");
  }
  if (Object.hasOwn(patch, "columnOrder") && (!Array.isArray(patch.columnOrder) || patch.columnOrder.some(id => typeof id !== "string" || !id) || new Set(patch.columnOrder).size !== patch.columnOrder.length)) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "Column order requires unique status IDs.", "columnOrder");
  }

  if (Object.hasOwn(patch, "rowOrder") && (!Array.isArray(patch.rowOrder) || patch.rowOrder.some(id => typeof id !== "string" || !id) || new Set(patch.rowOrder).size !== patch.rowOrder.length)) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "Row order requires unique project IDs.", "rowOrder");
  }

  validateValueVisibilityReferences({
    valueVisibility: patch.valueVisibility,
    propertyDefinitions,
    selectValues,
    statusValues,
  });
  validatePropertyLayoutReferences({
    propertyLayout: patch.propertyLayout,
    propertyDefinitions,
  });
  if (Object.hasOwn(patch, "tableColumnWidths")) {
    if (!isPlainObject(patch.tableColumnWidths) || Object.entries(patch.tableColumnWidths).some(([id, width]) =>
      !id || typeof width !== "number" || !Number.isFinite(width) || width < TABLE_COLUMN_WIDTH_MIN)) {
      throw new WorkspaceViewError("VALIDATION_FAILED", "Table widths must be finite numbers at least 132px.", "tableColumnWidths");
    }
    for (const id of Object.keys(patch.tableColumnWidths)) {
      if (!propertyIds.has(id)) throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Column property does not exist.", "tableColumnWidths");
    }
  }
  validateBoardLayout(patch.boardLayout);
  validateGrouping(patch.grouping, propertyDefinitions, (code, message) => { throw new WorkspaceViewError(code, message, "grouping"); });
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
  propertyDefinitions = visibleProperties,
  selectValues = [],
  locale = "en",
} = {}) {
  const normalizedView = normalizeViewDocument(view);
  const statusFilter = normalizedView.valueVisibility[PROPERTY_STATUS_ID];
  if (statusFilter) {
    // A formerly name-based bucket can now describe multiple physical folders.
    // Expand its legacy filter in the response without rewriting saved settings.
    statusFilter.valueIds = [...new Set(statusFilter.valueIds.flatMap(id => {
      const matches = statusValues.filter(status => status.legacyId === id);
      return matches.length ? matches.map(status => status.id) : [id];
    }))];
  }
  const rowOrder = completeTableRowOrder(normalizedView.rowOrder, projects.map(project => project.id));
  if (normalizedView.viewType === "table") {
    const rank = new Map(rowOrder.map((id, index) => [id, index]));
    projects = [...projects].sort((a, b) => rank.get(a.id) - rank.get(b.id));
  }
  const filteredProjects = filterProjectsForView({ projects, view: normalizedView, searchQuery });
  const response = {
    workspaceId: normalizedView.workspaceId,
    view: {
      id: normalizedView.id,
      name: normalizedView.name,
      viewType: normalizedView.viewType,
      visiblePropertyIds: normalizedView.visiblePropertyIds,
      propertyOrder: normalizedView.propertyOrder,
      valueVisibility: normalizedView.valueVisibility,
      propertyLayout: normalizedView.propertyLayout,
      boardLayout: normalizedView.boardLayout,
      ...(normalizedView.viewType === "table" ? { tableColumnWidths: normalizedView.tableColumnWidths } : {}),
      ...(normalizedView.viewType === "table" ? { rowOrder } : {}),
      grouping: normalizedView.grouping,
      groupingNotice: normalizedView.groupingNotice,
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
        ...(normalizedView.groupingNotice ? { groupingNotice: normalizedView.groupingNotice } : {}),
        ...createTableGrouping({grouping: normalizedView.grouping, projects, filteredProjects, propertyDefinitions, selectValues, statusValues, locale}),
      },
    };
  }

  const boardStatusValues = createBoardStatusValues({ statusValues, filteredProjects });
  const grouped = createTableGrouping({ grouping: normalizedView.grouping, projects, filteredProjects,
    propertyDefinitions: propertyDefinitions.some(p => p.id === PROPERTY_STATUS_ID) ? propertyDefinitions : [...propertyDefinitions, { id: PROPERTY_STATUS_ID, type: "select" }], selectValues, statusValues: boardStatusValues, locale });
  const statusGrouping = normalizedView.grouping?.propertyId === PROPERTY_STATUS_ID;
  const toColumnId = group => statusGrouping ? group.empty ? NO_STATUS_VALUE_ID : group.value : group.id;
  // Unlike Table, the legacy Status Board exposes No status only when projects exist there.
  if (statusGrouping && !projects.some(project => getProjectStatusValueId(project) === NO_STATUS_VALUE_ID)) {
    grouped.groupOptions = grouped.groupOptions?.filter(group => !group.empty);
    grouped.groups = grouped.groups?.filter(group => !group.empty);
  }
  const allGroups = grouped.groupOptions || [];
  const projectedColumns = grouped.groups ? grouped.groups.map(group => ({
    statusValueId: toColumnId(group), groupId: group.id, name: group.name, color: group.color,
    empty: group.empty, collapsed: group.collapsed, projects: group.rows,
    count: group.count,
  })) : [{ statusValueId: "ungrouped", name: normalizedView.name, projects: filteredProjects }];
  return {
    ...response,
    view: { ...response.view, columnOrder: normalizedView.grouping?.sort === "manual"
      ? completeBoardColumnOrder(normalizedView.grouping.manualOrder.map(id => statusGrouping && id.startsWith("value:") ? id.slice(6) : id), allGroups.filter(g => !g.empty).map(toColumnId)).concat(allGroups.filter(g => g.empty).map(toColumnId))
      : allGroups.map(toColumnId), hiddenColumnIds: allGroups.filter(g => g.hidden).map(toColumnId) },
    statusValues: boardStatusValues,
    projection: { type: "board", capabilities: { canMoveBetweenStatuses: statusGrouping },
      columns: projectedColumns, groupOptions: allGroups, totalProjectCount: new Set(filteredProjects.map(p => p.id)).size,
      ...(grouped.groupingNotice || normalizedView.groupingNotice ? { groupingNotice: grouped.groupingNotice || normalizedView.groupingNotice } : {}) },
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

function normalizePropertyLayout(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([propertyId, setting]) => typeof propertyId === "string" && isPlainObject(setting))
      .flatMap(([propertyId, setting]) => (
        setting.wrapContent === true
          ? [[propertyId, { wrapContent: true }]]
          : []
      )),
  );
}

function normalizeBoardLayout(value) {
  return {
    columnWidth: normalizeBoardColumnWidth(value?.columnWidth),
    ...(value?.wrapContent === true ? { wrapContent: true } : {}),
  };
}

function validateBoardLayout(value) {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    throw new WorkspaceViewError("VALIDATION_FAILED", "Board layout must be an object.", "boardLayout");
  }

  if (Object.hasOwn(value, "wrapContent") && typeof value.wrapContent !== "boolean") {
    throw new WorkspaceViewError("VALIDATION_FAILED", "Board wrap content must be boolean.", "boardLayout.wrapContent");
  }

  if (!Object.hasOwn(value, "columnWidth")) {
    return;
  }

  const columnWidth = Number(value.columnWidth);
  if (
    !Number.isFinite(columnWidth)
    || columnWidth < BOARD_COLUMN_WIDTH_MIN
    || columnWidth > BOARD_COLUMN_WIDTH_PERSISTED_MAX
  ) {
    throw new WorkspaceViewError(
      "VALIDATION_FAILED",
      `Board column width must be between ${BOARD_COLUMN_WIDTH_MIN} and ${BOARD_COLUMN_WIDTH_PERSISTED_MAX}.`,
      "boardLayout.columnWidth",
    );
  }
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

  const statusValueIds = new Set(statusValues.flatMap((item) => [item.id, item.legacyId].filter(Boolean)));

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

function validatePropertyLayoutReferences({ propertyLayout, propertyDefinitions }) {
  if (!isPlainObject(propertyLayout)) {
    return;
  }

  const propertiesById = new Map(propertyDefinitions.filter((item) => !item.deletedAt).map((item) => [item.id, item]));

  for (const [propertyId, rawSetting] of Object.entries(propertyLayout)) {
    if (typeof propertyId !== "string" || !isPlainObject(rawSetting) || rawSetting.wrapContent !== true) {
      continue;
    }

    const property = propertiesById.get(propertyId);
    if (!property) {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Property layout references an unknown property.", "propertyLayout");
    }

    if (property.system === true || property.type !== "text") {
      throw new WorkspaceViewError("INVALID_PROPERTY_REFERENCE", "Only custom text properties can use wrap content.", "propertyLayout");
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
