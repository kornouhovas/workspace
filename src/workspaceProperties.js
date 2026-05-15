export const propertyTypeIds = ["text", "number", "date", "select", "multi-select"];
export const customPropertyTypeIds = propertyTypeIds;
export const systemPropertyIds = ["property:name", "property:status"];

const defaultPropertyDefinitions = [
  ["property:name", "Name", "text", true, 10],
  ["property:status", "Status", "select", true, 20],
];

export function createDefaultPropertySchemas(workspaceId) {
  return defaultPropertyDefinitions.map(([id, name, type, system, order]) =>
    normalizePropertySchema({
      id,
      workspaceId,
      name,
      type,
      system,
      order,
    }),
  );
}

export function normalizePropertySchema(schema = {}) {
  const type = normalizePropertyType(schema.type);

  return {
    id: normalizeString(schema.id),
    workspaceId: normalizeString(schema.workspaceId),
    name: normalizeString(schema.name),
    type,
    system: Boolean(schema.system),
    hidden: Boolean(schema.hidden),
    order: normalizeOrder(schema.order),
    config: normalizePropertyConfig(type, schema.config),
  };
}

export function normalizePropertyValue(type, value) {
  switch (normalizePropertyType(type)) {
    case "number":
      return normalizeNumberValue(value);
    case "date":
      return normalizeDateValue(value);
    case "select":
      return normalizeSelectValueId(value);
    case "multi-select":
      return normalizeMultiSelectValue(value);
    case "text":
    default:
      return value == null ? "" : String(value);
  }
}

export function isSystemPropertyId(propertyId) {
  return systemPropertyIds.includes(propertyId);
}

export function normalizePropertyDefinition(input = {}, context = {}) {
  const id = normalizeString(input.id);
  const now = normalizeTimestamp(context.now);
  const systemDefaults = getSystemPropertyDefaults(id);

  if (systemDefaults) {
    return {
      id,
      workspaceId: normalizeString(input.workspaceId || context.workspaceId),
      name: systemDefaults.name,
      type: systemDefaults.type,
      system: true,
      immutable: true,
      hidden: false,
      order: systemDefaults.order,
      config: normalizePropertyConfig(systemDefaults.type, input.config),
      createdAt: normalizeTimestamp(input.createdAt, now),
      updatedAt: now,
      deletedAt: null,
    };
  }

  const type = normalizePropertyTypeStrict(input.type);

  return {
    id,
    workspaceId: normalizeString(input.workspaceId || context.workspaceId),
    name: normalizeTrimmedString(input.name),
    type,
    system: false,
    immutable: false,
    hidden: Boolean(input.hidden),
    order: normalizeOrder(input.order),
    config: normalizePropertyConfig(type, input.config),
    createdAt: normalizeTimestamp(input.createdAt, now),
    updatedAt: now,
    deletedAt: normalizeNullableString(input.deletedAt),
  };
}

export function normalizeSelectValue(input = {}, context = {}) {
  const now = normalizeTimestamp(context.now);

  return {
    id: normalizeString(input.id),
    workspaceId: normalizeString(input.workspaceId || context.workspaceId),
    propertyId: normalizeString(input.propertyId || context.propertyId),
    name: normalizeTrimmedString(input.name),
    color: normalizeString(input.color),
    hidden: Boolean(input.hidden),
    order: normalizeOrder(input.order),
    createdAt: normalizeTimestamp(input.createdAt, now),
    updatedAt: now,
    deletedAt: normalizeNullableString(input.deletedAt),
  };
}

export function normalizeProjectPropertyValue({ property = {}, value, selectValues = [] } = {}) {
  const propertyId = normalizeString(property.id);
  if (property.system || isSystemPropertyId(propertyId)) {
    throw new TypeError("System property values are derived and cannot be stored.");
  }

  const type = normalizePropertyTypeStrict(property.type);
  const normalizedValue = normalizePropertyValue(type, value);

  if (type === "select" && normalizedValue !== null) {
    validateSelectValueReference(propertyId, normalizedValue, selectValues);
  }

  if (type === "multi-select") {
    for (const valueId of normalizedValue) {
      validateSelectValueReference(propertyId, valueId, selectValues);
    }
  }

  return {
    propertyId,
    type,
    value: normalizedValue,
  };
}

function normalizePropertyType(type) {
  return propertyTypeIds.includes(type) ? type : "text";
}

function normalizePropertyTypeStrict(type) {
  if (!customPropertyTypeIds.includes(type)) {
    throw new TypeError(`Unsupported property type: ${type}`);
  }
  return type;
}

function normalizePropertyConfig(type, config) {
  const normalizedConfig = clonePlainObject(config);

  if (type !== "select" && type !== "multi-select") {
    return normalizedConfig;
  }

  return {
    ...normalizedConfig,
    options: Array.isArray(normalizedConfig.options)
      ? normalizedConfig.options.map(normalizePropertyOption).filter(Boolean)
      : [],
  };
}

function normalizePropertyOption(option, index) {
  if (!isPlainObject(option)) {
    return null;
  }

  const id = normalizeRequiredOptionString(option.id);
  const name = normalizeRequiredOptionString(option.name);

  if (id === null || name === null) {
    return null;
  }

  return {
    id,
    name,
    color: normalizeString(option.color),
    order: normalizeOrder(option.order, (index + 1) * 10),
  };
}

function normalizeNumberValue(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeDateValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(0, month - 1, day));
  date.setUTCFullYear(year);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

function normalizeSelectValueId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function normalizeMultiSelectValue(value) {
  const values = Array.isArray(value) ? value : [value];
  const selectedValues = [];
  const seenValues = new Set();

  for (const item of values) {
    const selectedValue = normalizeSelectValueId(item);
    if (selectedValue && !seenValues.has(selectedValue)) {
      selectedValues.push(selectedValue);
      seenValues.add(selectedValue);
    }
  }

  return selectedValues;
}

function normalizeString(value) {
  return value == null ? "" : String(value);
}

function normalizeTrimmedString(value) {
  return normalizeString(value).trim();
}

function normalizeNullableString(value) {
  return typeof value === "string" && value ? value : null;
}

function normalizeTimestamp(value, fallback = new Date(0).toISOString()) {
  return typeof value === "string" && value ? value : fallback;
}

function normalizeRequiredOptionString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function normalizeOrder(value, fallback = 0) {
  const order = Number(value);
  return Number.isFinite(order) ? order : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clonePlainObject(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }

  return JSON.parse(JSON.stringify(value));
}

function getSystemPropertyDefaults(propertyId) {
  if (propertyId === "property:name") {
    return { name: "Name", type: "text", order: 10 };
  }

  if (propertyId === "property:status") {
    return { name: "Status", type: "select", order: 20 };
  }

  return null;
}

function validateSelectValueReference(propertyId, valueId, selectValues) {
  const match = selectValues.some((selectValue) => (
    selectValue &&
    selectValue.id === valueId &&
    selectValue.propertyId === propertyId &&
    selectValue.deletedAt == null
  ));

  if (!match) {
    throw new TypeError(`Select value does not exist for property: ${valueId}`);
  }
}
