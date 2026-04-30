export const propertyTypeIds = ["text", "number", "date", "select", "multi-select"];

const defaultPropertyDefinitions = [
  ["property:name", "Name", "text", true, 10],
  ["property:status", "Status", "select", true, 20],
  ["property:text", "Text", "text", false, 30],
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
      return normalizeSelectValue(value);
    case "multi-select":
      return normalizeMultiSelectValue(value);
    case "text":
    default:
      return value == null ? "" : String(value);
  }
}

function normalizePropertyType(type) {
  return propertyTypeIds.includes(type) ? type : "text";
}

function normalizePropertyConfig(type, config) {
  const normalizedConfig = isPlainObject(config) ? { ...config } : {};

  if (type !== "select" && type !== "multi-select") {
    return normalizedConfig;
  }

  return {
    ...normalizedConfig,
    options: Array.isArray(normalizedConfig.options)
      ? normalizedConfig.options.map(normalizePropertyOption)
      : [],
  };
}

function normalizePropertyOption(option, index) {
  const source = isPlainObject(option) ? option : {};

  return {
    id: normalizeString(source.id),
    name: normalizeString(source.name),
    color: normalizeString(source.color),
    order: normalizeOrder(source.order, (index + 1) * 10),
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
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

function normalizeSelectValue(value) {
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
    const selectedValue = normalizeSelectValue(item);
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

function normalizeOrder(value, fallback = 0) {
  const order = Number(value);
  return Number.isFinite(order) ? order : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
