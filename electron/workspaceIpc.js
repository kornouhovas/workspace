import { createHash, randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { createRevealResponse } from "../src/localOpen.js";
import {
  createCreateViewResponse,
  createDeleteViewResponse,
  createFileResponse,
  createListEntriesResponse,
  createListViewsResponse,
  createPropertiesResponse,
  createReorderViewsResponse,
  createScanResponse,
  createSetActiveViewResponse,
  createUpdateViewResponse,
  createViewProjectionResponse,
  defaultWorkspaceSettingsPath,
  readWorkspaceSettings,
  writeWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { projectFoldersToWorkspaceObjects } from "../src/workspaceObjects.js";
import { createDefaultPropertySchemas } from "../src/workspaceProperties.js";
import { createDefaultView, NO_STATUS_VALUE_ID, PROPERTY_NAME_ID, PROPERTY_STATUS_ID } from "../src/workspaceViews.js";

const ipcChannel = "workspace:request";

const supportedMethods = new Set([
  "workspace.getRoot",
  "workspace.setRoot",
  "workspace.scan",
  "workspace.listEntries",
  "workspace.saveProperty",
  "workspace.listPropertyValues",
  "workspace.listViews",
  "workspace.createView",
  "workspace.setActiveView",
  "workspace.updateView",
  "workspace.reorderViews",
  "workspace.deleteView",
  "workspace.getViewProjection",
  "workspace.reveal",
  "workspace.previewFile",
]);

export function registerWorkspaceIpc(ipcMain, options = {}) {
  ipcMain.handle(ipcChannel, createWorkspaceIpcHandler(options));
}

export function createWorkspaceIpcHandler(options = {}) {
  const configPath = options.configPath || defaultWorkspaceSettingsPath;
  const viewStore = options.viewStore || createFileViewStore(
    options.viewStorePath || join(dirname(configPath), "views.json"),
  );
  const idFactory = options.idFactory || randomUUID;
  const now = options.now || (() => new Date().toISOString());
  const chooseRoot = options.chooseRoot || (async () => "");

  async function getRootState() {
    const settings = await readWorkspaceSettings(configPath);
    const rootPath = normalizeRootPath(settings);

    if (!rootPath) {
      return null;
    }

    if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
      throw createWorkspaceServiceError(
        "SOURCE_FOLDER_UNAVAILABLE",
        "Workspace source folder is unavailable.",
        "rootPath",
      );
    }

    const workspaceId = createWorkspaceId(rootPath);
    await ensureDefaultWorkspace({ viewStore, workspaceId, rootPath, now });
    return createRootResponse(rootPath);
  }

  return async function handleWorkspaceRequest(_event, method, payload = {}) {
    if (!supportedMethods.has(method)) {
      throw createWorkspaceServiceError("VALIDATION_FAILED", `Unsupported workspace method: ${method}`, "method");
    }

    const body = normalizePayload(payload);

    if (method === "workspace.setRoot") {
      const rootPath = await chooseRoot();
      if (!rootPath) {
        throw createWorkspaceServiceError("VALIDATION_FAILED", "No folder selected.", "rootPath");
      }
      if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
        throw createWorkspaceServiceError(
          "SOURCE_FOLDER_UNAVAILABLE",
          "Workspace source folder is unavailable.",
          "rootPath",
        );
      }

      await writeWorkspaceSettings(configPath, { rootPath });
      const workspaceId = createWorkspaceId(rootPath);
      await ensureDefaultWorkspace({ viewStore, workspaceId, rootPath, now });
      return createRootResponse(rootPath);
    }

    const root = await getRootState();
    if (method === "workspace.getRoot") {
      return root;
    }

    if (!root) {
      throw createWorkspaceServiceError("SOURCE_FOLDER_MISSING", "Workspace source folder is not selected.", "rootPath");
    }

    if (method === "workspace.scan") {
      return unwrapBackendResponse(await createScanResponse({ root: root.root.rootPath, rules: body.rules || {} }));
    }

    if (method === "workspace.listEntries") {
      return unwrapBackendResponse(await createListEntriesResponse({ root: root.root.rootPath, body }));
    }

    if (method === "workspace.saveProperty") {
      return unwrapBackendResponse(await createPropertiesResponse({ root: root.root.rootPath, body }));
    }

    if (method === "workspace.listPropertyValues") {
      return { values: [] };
    }

    if (method === "workspace.listViews") {
      return unwrapBackendResponse(await createListViewsResponse({ body, viewStore }));
    }

    if (method === "workspace.createView") {
      return unwrapBackendResponse(await createCreateViewResponse({ body, viewStore, idFactory, now }));
    }

    if (method === "workspace.setActiveView") {
      return unwrapBackendResponse(await createSetActiveViewResponse({ body, viewStore, now }));
    }

    if (method === "workspace.updateView") {
      const propertyDefinitions = createDefaultPropertySchemas(body.workspaceId);
      const statusValues = await getStatusValues({ rootPath: root.root.rootPath, workspaceId: body.workspaceId });
      return unwrapBackendResponse(await createUpdateViewResponse({
        body,
        viewStore,
        propertyDefinitions,
        statusValues,
        now,
      }));
    }

    if (method === "workspace.reorderViews") {
      return unwrapBackendResponse(await createReorderViewsResponse({ body, viewStore, now }));
    }

    if (method === "workspace.deleteView") {
      return unwrapBackendResponse(await createDeleteViewResponse({ body, viewStore, now }));
    }

    if (method === "workspace.getViewProjection") {
      return unwrapBackendResponse(await createViewProjectionResponse({
        body,
        viewStore,
        projectProvider: async ({ workspaceId }) => {
          const { projects } = await getProjectsAndStatusValues({ rootPath: root.root.rootPath, workspaceId });
          return projects;
        },
        propertyProvider: async ({ workspaceId }) => {
          const { statusValues } = await getProjectsAndStatusValues({ rootPath: root.root.rootPath, workspaceId });
          return {
            visibleProperties: createDefaultPropertySchemas(workspaceId).map(toVisibleProperty),
            statusValues,
          };
        },
      }));
    }

    if (method === "workspace.reveal") {
      return unwrapBackendResponse(await createRevealResponse({ body, root: root.root.rootPath }));
    }

    if (method === "workspace.previewFile") {
      const response = await createFileResponse({ root: root.root.rootPath, path: body.path });
      if (response.status >= 400) {
        return unwrapBackendResponse(response);
      }
      return {
        filePath: response.filePath,
        contentType: response.contentType,
      };
    }

    throw createWorkspaceServiceError("VALIDATION_FAILED", `Unsupported workspace method: ${method}`, "method");
  };
}

function normalizePayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

function normalizeRootPath(settings) {
  if (typeof settings?.rootPath === "string") {
    return settings.rootPath.trim();
  }
  if (typeof settings?.root?.rootPath === "string") {
    return settings.root.rootPath.trim();
  }
  return "";
}

function createRootResponse(rootPath) {
  const workspaceId = createWorkspaceId(rootPath);
  return {
    root: {
      id: workspaceId,
      workspaceId,
      rootPath,
      path: rootPath,
      name: basename(rootPath),
    },
  };
}

function createWorkspaceId(rootPath) {
  return `workspace:${createHash("sha256").update(rootPath).digest("hex").slice(0, 16)}`;
}

async function ensureDefaultWorkspace({ viewStore, workspaceId, rootPath, now }) {
  const existingWorkspace = await viewStore.getWorkspace(workspaceId);
  const existingViews = await viewStore.listViews(workspaceId);
  const timestamp = now();

  if (existingViews.length === 0) {
    await viewStore.saveView(createDefaultView({
      workspaceId,
      viewType: "board",
      id: "view:default-board",
      name: "Board",
      order: 10,
      now: timestamp,
    }));
    await viewStore.saveView(createDefaultView({
      workspaceId,
      viewType: "table",
      id: "view:default-table",
      name: "Table",
      order: 20,
      now: timestamp,
    }));
  }

  await viewStore.saveWorkspace({
    id: workspaceId,
    type: "workspace",
    schemaVersion: 1,
    sourceFolderId: createWorkspaceId(rootPath),
    name: basename(rootPath),
    order: 10,
    activeViewId: existingWorkspace?.activeViewId || existingViews[0]?.id || "view:default-board",
    createdAt: existingWorkspace?.createdAt || timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });
}

async function getProjectsAndStatusValues({ rootPath, workspaceId }) {
  const scan = await unwrapBackendResponse(await createScanResponse({ root: rootPath, rules: {} }));
  const workspaceObjects = scan.workspace || projectFoldersToWorkspaceObjects({
    workspaceId,
    rootPath,
    folders: scan.folders || [],
  });
  const statusValues = createStatusValues(workspaceId, workspaceObjects.objects || []);
  const statusValueByName = new Map(statusValues.map((statusValue) => [statusValue.name, statusValue]));

  return {
    statusValues,
    projects: (workspaceObjects.objects || []).map((object) => {
      const status = statusValueByName.get(object.folderStatus) || createNoStatusValue();
      return {
        id: object.id,
        name: object.folderName,
        currentRelativePath: object.source?.path || object.folderName,
        status,
        propertyValues: {
          [PROPERTY_NAME_ID]: object.folderName,
          [PROPERTY_STATUS_ID]: status.id,
        },
        fileTree: [],
      };
    }),
  };
}

async function getStatusValues({ rootPath, workspaceId }) {
  const { statusValues } = await getProjectsAndStatusValues({ rootPath, workspaceId });
  return statusValues;
}

function createStatusValues(workspaceId, objects) {
  const byName = new Map();
  for (const object of objects) {
    const name = typeof object.folderStatus === "string" && object.folderStatus.trim()
      ? object.folderStatus.trim()
      : "No status";
    if (!byName.has(name)) {
      byName.set(name, {
        id: name === "No status" ? NO_STATUS_VALUE_ID : `statusValue:${createSlug(workspaceId)}:${createSlug(name)}`,
        name,
        relativePath: name === "No status" ? null : name,
        source: name === "No status" ? "no-status" : "folderRole",
      });
    }
  }

  if (byName.size === 0) {
    byName.set("No status", createNoStatusValue());
  }

  return [...byName.values()];
}

function createNoStatusValue() {
  return {
    id: NO_STATUS_VALUE_ID,
    name: "No status",
    relativePath: null,
    source: "no-status",
  };
}

function toVisibleProperty(property) {
  return {
    id: property.id,
    name: property.name,
    propertyType: property.type,
    system: property.system,
  };
}

function createFileViewStore(filePath) {
  return {
    async getWorkspace(workspaceId) {
      const data = await readViewStoreData(filePath);
      return clone(data.workspaces[workspaceId]) || null;
    },
    async saveWorkspace(workspacePatchOrDocument) {
      const data = await readViewStoreData(filePath);
      const existing = data.workspaces[workspacePatchOrDocument.id] || {};
      const workspace = { ...existing, ...clone(workspacePatchOrDocument) };
      data.workspaces[workspace.id] = workspace;
      await writeViewStoreData(filePath, data);
      return clone(workspace);
    },
    async listViews(workspaceId) {
      const data = await readViewStoreData(filePath);
      return Object.values(data.views)
        .filter((view) => view.workspaceId === workspaceId && !view.deletedAt)
        .sort((left, right) => (
          left.order - right.order
          || String(left.createdAt).localeCompare(String(right.createdAt))
          || left.id.localeCompare(right.id)
        ))
        .map(clone);
    },
    async getView(viewId) {
      const data = await readViewStoreData(filePath);
      return clone(data.views[viewId]) || null;
    },
    async saveView(viewDocument) {
      const data = await readViewStoreData(filePath);
      data.views[viewDocument.id] = clone(viewDocument);
      await writeViewStoreData(filePath, data);
      return clone(viewDocument);
    },
  };
}

async function readViewStoreData(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    return {
      workspaces: data?.workspaces && typeof data.workspaces === "object" ? data.workspaces : {},
      views: data?.views && typeof data.views === "object" ? data.views : {},
    };
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return { workspaces: {}, views: {} };
    }

    throw error;
  }
}

async function writeViewStoreData(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(`${filePath}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${filePath}.tmp`, filePath);
}

function unwrapBackendResponse(response) {
  if (!response || typeof response.status !== "number") {
    return response;
  }

  if (response.status >= 400) {
    const payload = response.payload || {};
    throw createWorkspaceServiceError(
      payload.code || "VALIDATION_FAILED",
      payload.message || payload.error || "Workspace request failed.",
      payload.field,
    );
  }

  return response.payload;
}

function createWorkspaceServiceError(code, message, field) {
  const error = new Error(message);
  error.code = code;
  error.field = field;
  return error;
}

function createSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}
