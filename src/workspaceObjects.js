export function projectFoldersToWorkspaceObjects({ workspaceId, rootPath, folders }) {
  const objects = [];
  const propertyValues = [];

  for (const folder of Array.isArray(folders) ? folders : []) {
    const objectId = createFolderObjectId(workspaceId, folder.path);
    const object = {
      id: objectId,
      workspaceId,
      type: "project",
      source: {
        kind: "folder",
        path: folder.path,
        absoluteRoot: rootPath,
      },
      folderName: folder.name,
      folderStatus: folder.status,
    };

    objects.push(object);

    Object.entries(getUserPropertyValues(folder.properties)).forEach(([propertyId, value]) => {
      propertyValues.push({
        id: createPropertyValueId(objectId, propertyId),
        workspaceId,
        objectId,
        propertyId,
        type: inferPropertyValueType(value),
        value,
      });
    });
  }

  return { objects, propertyValues };
}

function getUserPropertyValues(properties) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties)
      .filter(([propertyId, value]) => (
        typeof propertyId === "string" &&
        propertyId.startsWith("property:") &&
        propertyId !== "property:name" &&
        propertyId !== "property:status" &&
        hasStoredPropertyValue(value)
      )),
  );
}

function hasStoredPropertyValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== undefined && value !== "";
}

function inferPropertyValueType(value) {
  if (Array.isArray(value)) {
    return "multi-select";
  }

  if (typeof value === "number") {
    return "number";
  }

  return "text";
}

export function createFolderObjectId(workspaceId, folderPath) {
  return `object:${createSlug(workspaceId)}:${createSlug(folderPath)}-${createHashSuffix(folderPath)}`;
}

export function createPropertyValueId(objectId, propertyId) {
  return `value:${objectId}:${propertyId}`;
}

export function readSystemPropertyValue(object, propertyId) {
  if (propertyId === "property:name") {
    return object.folderName;
  }

  if (propertyId === "property:status") {
    return object.folderStatus;
  }

  return undefined;
}

function createSlug(value) {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");

  return slug || "untitled";
}

function createHashSuffix(value) {
  let hash = 0;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }

  return hash.toString(36).padStart(6, "0").slice(0, 6);
}
