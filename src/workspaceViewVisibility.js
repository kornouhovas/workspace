export const requiredViewPropertyIds = ["property:name"];

export function createPropertyOrder(visiblePropertyIds = []) {
  return Object.fromEntries(
    uniqueStrings(visiblePropertyIds).map((propertyId, index) => [propertyId, (index + 1) * 10]),
  );
}

export function createNextVisiblePropertyIds({
  currentVisiblePropertyIds = [],
  fallbackVisiblePropertyIds = [],
  availablePropertyIds = [],
  propertyId,
  visible,
} = {}) {
  const availableIds = new Set([...requiredViewPropertyIds, ...normalizeStringArray(availablePropertyIds)]);
  const currentIds = normalizeStringArray(currentVisiblePropertyIds);
  const fallbackIds = normalizeStringArray(fallbackVisiblePropertyIds);
  const baseIds = currentIds.length > 0 ? currentIds : fallbackIds;
  const sanitizedIds = uniqueStrings([...requiredViewPropertyIds, ...baseIds])
    .filter((id) => availableIds.has(id));

  if (visible === true) {
    return uniqueStrings([...sanitizedIds, propertyId]).filter((id) => availableIds.has(id));
  }

  return sanitizedIds.filter((id) => requiredViewPropertyIds.includes(id) || id !== propertyId);
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];
}

function uniqueStrings(value) {
  return [...new Set(normalizeStringArray(value))];
}
