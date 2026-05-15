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
  "workspace.updateFolderRole",
  "workspace.listWorkspaces",
  "workspace.createWorkspace",
  "workspace.updateWorkspace",
  "workspace.reorderWorkspaces",
  "workspace.deleteWorkspace",
  "workspace.setActiveWorkspace",
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
    const activeWorkspaceId = await getActiveWorkspaceId({
      configPath,
      viewStore,
      rootPath,
      fallbackWorkspaceId: workspaceId,
    });
    return createRootResponse(rootPath, activeWorkspaceId);
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

      const workspaceId = createWorkspaceId(rootPath);
      await writeWorkspaceSettings(configPath, {
        rootPath,
        activeWorkspaceId: workspaceId,
        folderRules: {},
      });
      await ensureDefaultWorkspace({ viewStore, workspaceId, rootPath, now });
      return createRootResponse(rootPath, workspaceId);
    }

    const root = await getRootState();
    if (method === "workspace.getRoot") {
      return root;
    }

    if (!root) {
      throw createWorkspaceServiceError("SOURCE_FOLDER_MISSING", "Workspace source folder is not selected.", "rootPath");
    }

    if (method === "workspace.scan") {
      const settings = await readWorkspaceSettings(configPath);
      return unwrapBackendResponse(await createScanResponse({
        root: root.root.rootPath,
        rules: body.rules || normalizeFolderRules(settings.folderRules),
        includeCardChildren: body.includeCardChildren === true,
      }));
    }

    if (method === "workspace.updateFolderRole") {
      const path = requirePayloadString(body, "path");
      const role = normalizeRequestedFolderRole(body.role);
      const settings = await readWorkspaceSettings(configPath);
      const folderRules = normalizeFolderRules(settings.folderRules);
      folderRules[path] = {
        ...(folderRules[path] || {}),
        role,
      };

      await writeWorkspaceSettings(configPath, {
        ...settings,
        rootPath: root.root.rootPath,
        folderRules,
      });

      return {
        path,
        role: role === "card" ? "project" : role,
        folderRules,
      };
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

    if (method === "workspace.listWorkspaces") {
      const sourceFolderId = createWorkspaceId(root.root.rootPath);
      const settings = await readWorkspaceSettings(configPath);
      const workspaces = await viewStore.listWorkspaces(sourceFolderId);
      const activeWorkspaceId = workspaces.some((workspace) => workspace.id === settings.activeWorkspaceId)
        ? settings.activeWorkspaceId
        : workspaces[0]?.id || null;

      return {
        activeWorkspaceId,
        workspaces: workspaces.map(toWorkspaceListItem),
      };
    }

    if (method === "workspace.createWorkspace") {
      const sourceFolderId = createWorkspaceId(root.root.rootPath);
      const settings = await readWorkspaceSettings(configPath);
      const workspaces = await viewStore.listWorkspaces(sourceFolderId);
      const timestamp = now();
      const idSeed = idFactory();
      const workspaceId = `workspace:${sourceFolderId.replace(/^workspace:/, "")}:${createSlug(idSeed)}`;
      const maxOrder = workspaces.reduce((max, workspace) => Math.max(max, Number(workspace.order) || 0), 0);
      const workspace = await createWorkspaceDocument({
        viewStore,
        workspaceId,
        sourceFolderId,
        name: typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : `Workspace ${workspaces.length + 1}`,
        order: workspaces.length === 0 ? 10 : maxOrder + 10,
        viewIdSeed: idSeed,
        now: timestamp,
      });

      await writeWorkspaceSettings(configPath, {
        ...settings,
        rootPath: root.root.rootPath,
        activeWorkspaceId: workspace.id,
      });

      return {
        activeWorkspaceId: workspace.id,
        workspace: toWorkspaceListItem(workspace),
      };
    }

    if (method === "workspace.updateWorkspace") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      const workspace = await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath: root.root.rootPath,
      });
      const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
        ? body.patch
        : {};
      const name = typeof patch.name === "string" && patch.name.trim()
        ? patch.name.trim()
        : workspace.name;
      const savedWorkspace = await viewStore.saveWorkspace({
        ...workspace,
        name,
        updatedAt: now(),
      });

      return {
        workspace: toWorkspaceListItem(savedWorkspace),
      };
    }

    if (method === "workspace.reorderWorkspaces") {
      const sourceFolderId = createWorkspaceId(root.root.rootPath);
      const workspaces = await viewStore.listWorkspaces(sourceFolderId);
      const orderedWorkspaceIds = validateWorkspaceOrder(body.orderedWorkspaceIds, workspaces);
      const workspacesById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
      const timestamp = now();
      const savedWorkspaces = [];

      for (const [index, workspaceId] of orderedWorkspaceIds.entries()) {
        const workspace = workspacesById.get(workspaceId);
        savedWorkspaces.push(await viewStore.saveWorkspace({
          ...workspace,
          order: (index + 1) * 10,
          updatedAt: timestamp,
        }));
      }

      return {
        workspaces: savedWorkspaces.map(toWorkspaceListItem),
      };
    }

    if (method === "workspace.deleteWorkspace") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      const sourceFolderId = createWorkspaceId(root.root.rootPath);
      const settings = await readWorkspaceSettings(configPath);
      const workspaces = await viewStore.listWorkspaces(sourceFolderId);
      const workspace = workspaces.find((item) => item.id === workspaceId);

      if (!workspace) {
        throw createWorkspaceServiceError("WORKSPACE_NOT_FOUND", "Workspace was not found.", "workspaceId");
      }
      if (workspaces.length <= 1) {
        throw createWorkspaceServiceError(
          "LAST_WORKSPACE_DELETE_BLOCKED",
          "Cannot delete the last workspace.",
          "workspaceId",
        );
      }

      await viewStore.saveWorkspace({
        ...workspace,
        deletedAt: now(),
        updatedAt: now(),
      });

      const remainingWorkspaces = await viewStore.listWorkspaces(sourceFolderId);
      const activeWorkspaceId = settings.activeWorkspaceId === workspace.id
        ? remainingWorkspaces[0]?.id || null
        : settings.activeWorkspaceId || remainingWorkspaces[0]?.id || null;
      await writeWorkspaceSettings(configPath, {
        ...settings,
        rootPath: root.root.rootPath,
        activeWorkspaceId,
      });

      return {
        activeWorkspaceId,
        deletedWorkspaceId: workspace.id,
      };
    }

    if (method === "workspace.setActiveWorkspace") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      const settings = await readWorkspaceSettings(configPath);
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath: root.root.rootPath,
      });
      await writeWorkspaceSettings(configPath, {
        ...settings,
        rootPath: root.root.rootPath,
        activeWorkspaceId: workspaceId,
      });

      return {
        activeWorkspaceId: workspaceId,
      };
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
      const settings = await readWorkspaceSettings(configPath);
      const statusValues = await getStatusValues({
        rootPath: root.root.rootPath,
        workspaceId: body.workspaceId,
        rules: normalizeFolderRules(settings.folderRules),
      });
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
      const settings = await readWorkspaceSettings(configPath);
      const rules = normalizeFolderRules(settings.folderRules);
      return unwrapBackendResponse(await createViewProjectionResponse({
        body,
        viewStore,
        projectProvider: async ({ workspaceId }) => {
          const { projects } = await getProjectsAndStatusValues({
            rootPath: root.root.rootPath,
            workspaceId,
            rules,
          });
          return projects;
        },
        propertyProvider: async ({ workspaceId }) => {
          const { statusValues } = await getProjectsAndStatusValues({
            rootPath: root.root.rootPath,
            workspaceId,
            rules,
          });
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

function createRootResponse(rootPath, activeWorkspaceId) {
  const workspaceId = activeWorkspaceId || createWorkspaceId(rootPath);
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
    name: existingWorkspace?.name || "Operations",
    order: Number.isFinite(Number(existingWorkspace?.order)) ? Number(existingWorkspace.order) : 10,
    activeViewId: existingWorkspace?.activeViewId || existingViews[0]?.id || "view:default-board",
    createdAt: existingWorkspace?.createdAt || timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });
}

async function getActiveWorkspaceId({ configPath, viewStore, rootPath, fallbackWorkspaceId }) {
  const settings = await readWorkspaceSettings(configPath);
  const sourceFolderId = createWorkspaceId(rootPath);
  const workspaces = await viewStore.listWorkspaces(sourceFolderId);
  return workspaces.some((workspace) => workspace.id === settings.activeWorkspaceId)
    ? settings.activeWorkspaceId
    : fallbackWorkspaceId;
}

async function createWorkspaceDocument({
  viewStore,
  workspaceId,
  sourceFolderId,
  name,
  order,
  viewIdSeed,
  now,
}) {
  const boardViewId = `view:${createSlug(viewIdSeed)}-board`;
  const tableViewId = `view:${createSlug(viewIdSeed)}-table`;

  await viewStore.saveView(createDefaultView({
    workspaceId,
    viewType: "board",
    id: boardViewId,
    name: "Board",
    order: 10,
    now,
  }));
  await viewStore.saveView(createDefaultView({
    workspaceId,
    viewType: "table",
    id: tableViewId,
    name: "Table",
    order: 20,
    now,
  }));

  return viewStore.saveWorkspace({
    id: workspaceId,
    type: "workspace",
    schemaVersion: 1,
    sourceFolderId,
    name,
    order,
    activeViewId: boardViewId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

async function getProjectsAndStatusValues({ rootPath, workspaceId, rules = {} }) {
  const scan = await unwrapBackendResponse(await createScanResponse({ root: rootPath, rules }));
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

async function getStatusValues({ rootPath, workspaceId, rules = {} }) {
  const { statusValues } = await getProjectsAndStatusValues({ rootPath, workspaceId, rules });
  return statusValues;
}

function requirePayloadString(body, field) {
  const value = typeof body?.[field] === "string" ? body[field].trim() : "";
  if (!value) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", `${field} is required.`, field);
  }

  return value;
}

function normalizeRequestedFolderRole(role) {
  if (role === "group" || role === "status") {
    return role;
  }
  if (role === "project" || role === "card") {
    return "card";
  }

  throw createWorkspaceServiceError(
    "VALIDATION_FAILED",
    "Folder role must be group, status, or project.",
    "role",
  );
}

function normalizeFolderRules(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([path, rule]) => typeof path === "string" && path.trim() && rule && typeof rule === "object")
      .map(([path, rule]) => {
        const role = rule.role === "group" || rule.role === "status" || rule.role === "card"
          ? rule.role
          : "card";
        return [
          path.trim(),
          {
            ...rule,
            role,
          },
        ];
      }),
  );
}

async function requireSourceWorkspace({ viewStore, workspaceId, rootPath }) {
  const workspace = await viewStore.getWorkspace(workspaceId);
  if (!workspace || workspace.deletedAt) {
    throw createWorkspaceServiceError("WORKSPACE_NOT_FOUND", "Workspace was not found.", "workspaceId");
  }

  if (workspace.sourceFolderId !== createWorkspaceId(rootPath)) {
    throw createWorkspaceServiceError("WORKSPACE_NOT_FOUND", "Workspace was not found.", "workspaceId");
  }

  return workspace;
}

function validateWorkspaceOrder(orderedWorkspaceIds, workspaces) {
  if (!Array.isArray(orderedWorkspaceIds)) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", "orderedWorkspaceIds must be an array.", "orderedWorkspaceIds");
  }

  const existingIds = new Set(workspaces.map((workspace) => workspace.id));
  const orderedIds = orderedWorkspaceIds
    .filter((workspaceId) => typeof workspaceId === "string")
    .map((workspaceId) => workspaceId.trim());
  const uniqueIds = new Set(orderedIds);

  if (orderedIds.length !== workspaces.length || uniqueIds.size !== workspaces.length) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", "Workspace order must include each workspace once.", "orderedWorkspaceIds");
  }

  for (const workspaceId of orderedIds) {
    if (!existingIds.has(workspaceId)) {
      throw createWorkspaceServiceError("VALIDATION_FAILED", "Workspace order references an unknown workspace.", "orderedWorkspaceIds");
    }
  }

  return orderedIds;
}

function toWorkspaceListItem(workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    order: workspace.order,
  };
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
  let storeOperation = Promise.resolve();

  function runStoreOperation(action) {
    const result = storeOperation.then(action, action);
    storeOperation = result.catch(() => {});
    return result;
  }

  return {
    async getWorkspace(workspaceId) {
      return runStoreOperation(async () => {
        const data = await readViewStoreData(filePath);
        return clone(data.workspaces[workspaceId]) || null;
      });
    },
    async saveWorkspace(workspacePatchOrDocument) {
      return runStoreOperation(async () => {
        const data = await readViewStoreData(filePath);
        const existing = data.workspaces[workspacePatchOrDocument.id] || {};
        const workspace = { ...existing, ...clone(workspacePatchOrDocument) };
        data.workspaces[workspace.id] = workspace;
        await writeViewStoreData(filePath, data);
        return clone(workspace);
      });
    },
    async listViews(workspaceId) {
      return runStoreOperation(async () => {
        const data = await readViewStoreData(filePath);
        return Object.values(data.views)
          .filter((view) => view.workspaceId === workspaceId && !view.deletedAt)
          .sort((left, right) => (
            left.order - right.order
            || String(left.createdAt).localeCompare(String(right.createdAt))
            || left.id.localeCompare(right.id)
          ))
          .map(clone);
      });
    },
    async listWorkspaces(sourceFolderId) {
      return runStoreOperation(async () => {
        const data = await readViewStoreData(filePath);
        return Object.values(data.workspaces)
          .filter((workspace) => workspace.sourceFolderId === sourceFolderId && !workspace.deletedAt)
          .sort((left, right) => (
            left.order - right.order
            || String(left.createdAt).localeCompare(String(right.createdAt))
            || left.id.localeCompare(right.id)
          ))
          .map(clone);
      });
    },
    async getView(viewId) {
      return runStoreOperation(async () => {
        const data = await readViewStoreData(filePath);
        return clone(data.views[viewId]) || null;
      });
    },
    async saveView(viewDocument) {
      return runStoreOperation(async () => {
        const data = await readViewStoreData(filePath);
        data.views[viewDocument.id] = clone(viewDocument);
        await writeViewStoreData(filePath, data);
        return clone(viewDocument);
      });
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
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}
