// Table grouping is a view projection. It never modifies projects or catalogs.
const groupSorts = ["default", "ascending", "descending", "manual"];
const groupStateFields = ["manualOrder", "hiddenGroupIds", "collapsedGroupIds"];

function uniqueStrings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(item => typeof item === "string" && item !== ""))]
    : [];
}

export function normalizeGrouping(value) {
  if (!value || typeof value !== "object" || typeof value.propertyId !== "string" || !value.propertyId) {
    return null;
  }
  return {
    propertyId: value.propertyId,
    sort: groupSorts.includes(value.sort) ? value.sort : "default",
    manualOrder: uniqueStrings(value.manualOrder),
    hiddenGroupIds: uniqueStrings(value.hiddenGroupIds),
    collapsedGroupIds: uniqueStrings(value.collapsedGroupIds),
    hideEmpty: value.hideEmpty === true,
  };
}

export function validateGrouping(value, properties, fail) {
  if (value === undefined || value === null) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("VALIDATION_FAILED", "Grouping must be an object.");
  }
  const property = properties.find(item => item.id === value.propertyId && !item.deletedAt);
  if (!property || !["text", "number", "date", "select", "multi-select"].includes(property.type || property.propertyType)) {
    fail("INVALID_PROPERTY_REFERENCE", "Grouping property does not exist.");
  }
  if (value.sort !== undefined && !groupSorts.includes(value.sort)) {
    fail("VALIDATION_FAILED", "Invalid group sort.");
  }
  for (const field of groupStateFields) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].some(item => typeof item !== "string"))) {
      fail("VALIDATION_FAILED", `Invalid ${field}.`);
    }
  }
  if (value.hideEmpty !== undefined && typeof value.hideEmpty !== "boolean") {
    fail("VALIDATION_FAILED", "Invalid hideEmpty.");
  }
}

export function removeGroupingValue(grouping, valueId) {
  const setting = normalizeGrouping(grouping);
  if (!setting) return null;
  const key = `value:${valueId}`;
  return {
    ...setting,
    ...Object.fromEntries(groupStateFields.map(field => [field, setting[field].filter(id => id !== key)])),
  };
}

export function createTableGrouping({
  grouping, projects, filteredProjects, propertyDefinitions, selectValues, statusValues, locale = "en",
}) {
  const setting = normalizeGrouping(grouping);
  if (!setting) return {};
  const property = propertyDefinitions.find(item => item.id === setting.propertyId && !item.deletedAt);
  if (!property) return { groupingNotice: "property-removed" };

  const type = property.type || property.propertyType;
  const isStatus = property.id === "property:status";
  const categorical = isStatus || ["select", "multi-select"].includes(type);
  const catalog = (isStatus ? statusValues : selectValues.filter(value => value.propertyId === property.id && !value.deletedAt))
    .slice().sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const catalogById = new Map(catalog.map(value => [value.id, value]));
  const groups = new Map();
  const memberships = new Map();

  function addGroup(id, name, value, color) {
    if (!groups.has(id)) {
      groups.set(id, { id, name, value, color, empty: id === "empty", rows: [], count: 0 });
    }
  }
  if (categorical) {
    for (const value of catalog) {
      if (value.id !== "statusValue:no-status") addGroup(`value:${value.id}`, value.name, value.id, value.color);
    }
  }

  function projectGroupKeys(project) {
    let value = project.propertyValues?.[property.id];
    if (property.id === "property:name") value = value ?? project.name;
    if (isStatus) value = project.status?.id || value;
    if (categorical) {
      const values = type === "multi-select" && !isStatus ? uniqueStrings(value) : value == null ? [] : [value];
      const valid = values.filter(id => id !== "statusValue:no-status" && catalogById.has(id));
      return valid.length ? [...new Set(valid)].map(id => `value:${id}`) : ["empty"];
    }
    if (value == null || value === "") return ["empty"];
    if (type === "number") {
      value = Number(value);
      if (!Number.isFinite(value)) return ["empty"];
    }
    const id = `${type}:${JSON.stringify(value)}`;
    addGroup(id, String(value), value);
    return [id];
  }

  addGroup("empty", isStatus ? "No status" : "No value", null);
  let hasEmptyValue = false;
  for (const project of projects) {
    if (projectGroupKeys(project).includes("empty")) hasEmptyValue = true;
  }
  for (const project of filteredProjects) {
    for (const id of projectGroupKeys(project)) {
      const group = groups.get(id);
      const seen = memberships.get(id) || new Set();
      if (!seen.has(project.id)) {
        group.rows.push(project);
        seen.add(project.id);
        memberships.set(id, seen);
      }
    }
  }
  // Scalar groups come from the original project set; categories also expose unused values.
  if (!categorical && !hasEmptyValue) groups.delete("empty");
  const ordered = [...groups.values()].filter(group => !group.empty);
  const compareValues = (left, right) => type === "number"
    ? left.value - right.value
    : String(categorical ? left.name : left.value).localeCompare(
      String(categorical ? right.name : right.value), locale === "ru" ? "ru" : "en",
    );
  if (setting.sort === "ascending" || setting.sort === "descending" || (!categorical && setting.sort === "default")) {
    ordered.sort((left, right) => (setting.sort === "descending" ? -1 : 1) * compareValues(left, right));
  }
  if (setting.sort === "manual") {
    const rank = new Map(setting.manualOrder.map((id, index) => [id, index]));
    ordered.sort((left, right) => (
      (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    ));
  }
  if (groups.has("empty")) ordered.push(groups.get("empty"));
  const groupOptions = ordered.map(group => ({
    ...group,
    count: group.rows.length,
    hidden: setting.hiddenGroupIds.includes(group.id),
    collapsed: setting.collapsedGroupIds.includes(group.id),
  }));
  return {
    groupOptions,
    groups: groupOptions.filter(group => !group.hidden && (!setting.hideEmpty || group.count > 0)),
    totalProjectCount: new Set(filteredProjects.map(project => project.id)).size,
  };
}

// Automatic sorts use the displayed universe; pending manual mutations compose on the draft.
function groupingOrder(setting, groupIds) {
  const available = new Set(groupIds.filter(id => id !== "empty"));
  const order = setting.sort === "manual" ? setting.manualOrder.filter(id => available.has(id)) : [];
  for (const id of groupIds) if (id !== "empty" && !order.includes(id)) order.push(id);
  return order;
}

export function reorderGroupingGroup(setting, groupIds, groupId, beforeId) {
  if (!setting || groupId === "empty" || beforeId === "empty") return setting;
  const order = groupingOrder(setting, groupIds);
  if (!order.includes(groupId) || (beforeId !== null && !order.includes(beforeId))) return setting;
  if (groupId === beforeId) return setting;
  const reordered = order.filter(id => id !== groupId);
  reordered.splice(beforeId === null ? reordered.length : reordered.indexOf(beforeId), 0, groupId);
  if (reordered.every((id, index) => id === order[index])) return setting;
  return { ...setting, sort: "manual", manualOrder: reordered };
}

export function moveGroupingGroup(setting, groupIds, groupId, direction) {
  if (!setting) return null;
  const order = groupingOrder(setting, groupIds);
  const index = order.indexOf(groupId), destination = index + direction;
  if (index < 0 || destination < 0 || destination >= order.length || destination === index) return setting;
  return reorderGroupingGroup(setting, groupIds, groupId, direction < 0 ? order[destination] : order[destination + 1] ?? null);
}
