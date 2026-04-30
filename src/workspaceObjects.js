import { normalizePropertyValue } from "./workspaceProperties.js";

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
    const textValue = normalizePropertyValue("text", folder.text);

    objects.push(object);

    if (textValue.trim() !== "") {
      propertyValues.push({
        id: createPropertyValueId(objectId, "property:text"),
        objectId,
        propertyId: "property:text",
        type: "text",
        value: textValue,
      });
    }
  }

  return { objects, propertyValues };
}

export function createFolderObjectId(workspaceId, folderPath) {
  return `object:${createSlug(workspaceId)}:${createSlug(folderPath)}`;
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
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "untitled";
}
