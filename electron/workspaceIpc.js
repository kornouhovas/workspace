import { createHash, randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { createRevealResponse } from "../src/localOpen.js";
import {
  createCreateViewResponse,
  createDeleteViewResponse,
  createFileResponse,
  createListEntriesResponse,
  createProjectFileTreeResponse,
  createListViewsResponse,
  createPropertiesResponse,
  createReorderViewsResponse,
  createScanResponse,
  createSetActiveViewResponse,
  createUpdateViewResponse,
  createViewProjectionResponse,
  defaultWorkspacePropertiesPath,
  defaultWorkspaceSettingsPath,
  readWorkspaceSettings,
  writeWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { projectFoldersToWorkspaceObjects } from "../src/workspaceObjects.js";
import { createFilePropertyStore } from "../src/workspacePropertyStore.js";
import {
  createDefaultPropertySchemas,
  isSystemPropertyId,
  normalizeProjectPropertyValue,
  normalizePropertyDefinition,
  normalizeSelectValue,
} from "../src/workspaceProperties.js";
import {
  createDefaultView,
  normalizeViewDocument,
  NO_STATUS_VALUE_ID,
  PROPERTY_NAME_ID,
  PROPERTY_STATUS_ID,
} from "../src/workspaceViews.js";

const ipcChannel = "workspace:request";
const statusValueColorTokens = new Set(["gray", "red", "orange", "yellow", "green", "blue", "purple"]);

const supportedMethods = new Set([
  "workspace.getRoot",
  "workspace.setRoot",
  "workspace.scan",
  "workspace.listEntries",
  "workspace.listProjectFileTree",
  "workspace.saveProperty",
  "workspace.listPropertyValues",
  "workspace.listProperties",
  "workspace.createProperty",
  "workspace.updateProperty",
  "workspace.reorderProperties",
  "workspace.deleteProperty",
  "workspace.createSelectValue",
  "workspace.updateSelectValue",
  "workspace.updateStatusValueColor",
  "workspace.reorderSelectValues",
  "workspace.deleteSelectValue",
  "workspace.updateProjectPropertyValue",
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
  const propertyStore = options.propertyStore || createFilePropertyStore(
    options.propertyStorePath || defaultWorkspacePropertiesPath,
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
      const sourceFolderId = workspaceId;
      await writeWorkspaceSettings(configPath, {
        rootPath,
        activeWorkspaceId: workspaceId,
        folderRules: {},
      });
      await ensureDefaultWorkspace({ viewStore, workspaceId, rootPath, now });
      const activeWorkspaceId = await getActiveWorkspaceId({
        configPath,
        viewStore,
        rootPath,
        fallbackWorkspaceId: sourceFolderId,
      });
      await writeWorkspaceSettings(configPath, {
        rootPath,
        activeWorkspaceId,
        folderRules: {},
      });
      return createRootResponse(rootPath, activeWorkspaceId);
    }

    const root = await getRootState();
    if (method === "workspace.getRoot") {
      return root;
    }

    if (!root) {
      throw createWorkspaceServiceError("SOURCE_FOLDER_MISSING", "Workspace source folder is not selected.", "rootPath");
    }

    const rootPath = root.root.rootPath;
    const sourceFolderId = createWorkspaceId(rootPath);

    if (method === "workspace.scan") {
      const settings = await readWorkspaceSettings(configPath);
      return unwrapBackendResponse(await createScanResponse({
        root: rootPath,
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
        rootPath,
        folderRules,
      });

      return {
        path,
        role: role === "card" ? "project" : role,
        folderRules,
      };
    }

    if (method === "workspace.listEntries") {
      return unwrapBackendResponse(await createListEntriesResponse({ root: rootPath, body }));
    }

    if (method === "workspace.listProjectFileTree") {
      return unwrapBackendResponse(await createProjectFileTreeResponse({ root: rootPath, body }));
    }

    if (method === "workspace.saveProperty") {
      return unwrapBackendResponse(await createPropertiesResponse({ root: rootPath, body }));
    }

    if (method === "workspace.listPropertyValues") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return {
        workspaceId,
        values: await propertyStore.listProjectPropertyValues(sourceFolderId, {
          projectId: typeof body.projectId === "string" ? body.projectId.trim() : "",
          propertyId: typeof body.propertyId === "string" ? body.propertyId.trim() : "",
        }),
      };
    }

    if (method === "workspace.listProperties") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return createListPropertiesResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
      });
    }

    if (method === "workspace.createProperty") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return createPropertyResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        idFactory,
        now,
      });
    }

    if (method === "workspace.updateProperty") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return updatePropertyResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        now,
      });
    }

    if (method === "workspace.reorderProperties") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return reorderPropertiesResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        now,
      });
    }

    if (method === "workspace.deleteProperty") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return deletePropertyResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        viewStore,
        now,
      });
    }

    if (method === "workspace.createSelectValue") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return createSelectValueResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        idFactory,
        now,
      });
    }

    if (method === "workspace.updateSelectValue") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return updateSelectValueResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        now,
      });
    }

    if (method === "workspace.updateStatusValueColor") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      const settings = await readWorkspaceSettings(configPath);
      const statusValues = await getStatusValues({
        rootPath,
        workspaceId,
        propertyStore,
        rules: normalizeFolderRules(settings.folderRules),
      });
      return updateStatusValueColorResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        statusValues,
        now,
      });
    }

    if (method === "workspace.reorderSelectValues") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return reorderSelectValuesResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        now,
      });
    }

    if (method === "workspace.deleteSelectValue") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      return deleteSelectValueResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        now,
      });
    }

    if (method === "workspace.updateProjectPropertyValue") {
      const workspaceId = requirePayloadString(body, "workspaceId");
      await requireSourceWorkspace({
        viewStore,
        workspaceId,
        rootPath,
      });
      const settings = await readWorkspaceSettings(configPath);
      return updateProjectPropertyValueResult({
        body,
        workspaceId,
        propertyScopeId: sourceFolderId,
        propertyStore,
        rootPath,
        rules: normalizeFolderRules(settings.folderRules),
        now,
      });
    }

    if (method === "workspace.listWorkspaces") {
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
          : "Workspace",
        order: workspaces.length === 0 ? 10 : maxOrder + 10,
        viewIdSeed: idSeed,
        now: timestamp,
      });

      await writeWorkspaceSettings(configPath, {
        ...settings,
        rootPath,
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
        rootPath,
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
        rootPath,
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
        rootPath,
      });
      await writeWorkspaceSettings(configPath, {
        ...settings,
        rootPath,
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
      const workspaceId = requirePayloadString(body, "workspaceId");
      const propertyDefinitions = await listAllPropertyDefinitions({
        workspaceId: sourceFolderId,
        propertyStore,
      });
      const selectValues = await propertyStore.listSelectValues(sourceFolderId);
      const settings = await readWorkspaceSettings(configPath);
      const statusValues = await getStatusValues({
        rootPath,
        workspaceId,
        propertyStore,
        rules: normalizeFolderRules(settings.folderRules),
      });
      return unwrapBackendResponse(await createUpdateViewResponse({
        body,
        viewStore,
        propertyDefinitions,
        selectValues,
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
      let projectsAndStatusValues = null;
      const loadProjectsAndStatusValues = (workspaceId) => {
        projectsAndStatusValues ||= getProjectsAndStatusValues({
          rootPath,
          workspaceId,
          propertyStore,
          rules,
        });
        return projectsAndStatusValues;
      };
      return unwrapBackendResponse(await createViewProjectionResponse({
        body,
        viewStore,
        projectProvider: async ({ workspaceId }) => {
          const { projects } = await loadProjectsAndStatusValues(workspaceId);
          const propertyValues = await propertyStore.listProjectPropertyValues(sourceFolderId);
          return attachProjectPropertyValues(projects, propertyValues);
        },
        propertyProvider: async ({ workspaceId, view }) => {
          const { statusValues } = await loadProjectsAndStatusValues(workspaceId);
          const propertyDefinitions = await listAllPropertyDefinitions({
            workspaceId: sourceFolderId,
            propertyStore,
          });
          return {
            visibleProperties: createVisiblePropertiesForView({
              view,
              propertyDefinitions,
            }),
            statusValues,
          };
        },
      }));
    }

    if (method === "workspace.reveal") {
      return unwrapBackendResponse(await createRevealResponse({ body, root: rootPath }));
    }

    if (method === "workspace.previewFile") {
      const response = await createFileResponse({ root: rootPath, path: body.path });
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
  const sourceFolderId = createWorkspaceId(rootPath);
  const existingSourceWorkspaces = await viewStore.listWorkspaces(sourceFolderId);

  if (existingWorkspace?.deletedAt && existingSourceWorkspaces.length > 0) {
    return;
  }

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
    sourceFolderId,
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
    : workspaces[0]?.id || fallbackWorkspaceId;
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

async function getProjectsAndStatusValues({ rootPath, workspaceId, propertyStore = null, rules = {} }) {
  const scan = await unwrapBackendResponse(await createScanResponse({ root: rootPath, rules }));
  const sourceFolderId = createWorkspaceId(rootPath);
  const workspaceObjects = scan.workspace || projectFoldersToWorkspaceObjects({
    workspaceId: sourceFolderId,
    rootPath,
    folders: scan.folders || [],
  });
  const statusValues = await createStatusValuesWithColors({
    workspaceId: sourceFolderId,
    objects: workspaceObjects.objects || [],
    propertyStore,
  });
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
        fileTree: Array.isArray(object.fileTree) ? object.fileTree : [],
      };
    }),
  };
}

async function getStatusValues({ rootPath, workspaceId, propertyStore = null, rules = {} }) {
  const { statusValues } = await getProjectsAndStatusValues({ rootPath, workspaceId, propertyStore, rules });
  return statusValues;
}

async function createListPropertiesResult({ body = {}, workspaceId, propertyScopeId, propertyStore }) {
  const result = {
    workspaceId,
    properties: await listAllPropertyDefinitions({ workspaceId: propertyScopeId, propertyStore }),
    selectValues: await propertyStore.listSelectValues(propertyScopeId),
  };

  if (body.includeUsage === true) {
    const propertyValues = await propertyStore.listProjectPropertyValues(propertyScopeId);
    result.usage = createPropertyUsageSummary(propertyValues);
  }

  return result;
}

async function createPropertyResult({ body, workspaceId, propertyScopeId, propertyStore, idFactory, now }) {
  const timestamp = now();
  const existingProperties = await listAllPropertyDefinitions({ workspaceId: propertyScopeId, propertyStore });
  const propertyId = normalizeNewDocumentId({
    prefix: "property",
    seed: body.propertyId || body.id || idFactory(),
  });

  if (isSystemPropertyId(propertyId) || existingProperties.some((property) => property.id === propertyId)) {
    throw createWorkspaceServiceError("PROPERTY_ALREADY_EXISTS", "Property already exists.", "propertyId");
  }

  const name = requireNonEmptyText(body.name, "name");
  const order = Number.isFinite(Number(body.order))
    ? Number(body.order)
    : existingProperties.reduce((max, property) => Math.max(max, Number(property.order) || 0), 0) + 10;
  let property;
  try {
    property = normalizePropertyDefinition({
      id: propertyId,
      workspaceId: propertyScopeId,
      name,
      type: body.type,
      hidden: body.hidden === true,
      order,
      config: body.config,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { workspaceId: propertyScopeId, now: timestamp });
  } catch (error) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", error.message, "type");
  }

  if (!property.name) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", "Property name is required.", "name");
  }

  return {
    workspaceId,
    property: await propertyStore.saveProperty(property),
  };
}

async function updatePropertyResult({ body, workspaceId, propertyScopeId, propertyStore, now }) {
  const propertyId = requirePayloadString(body, "propertyId");
  const property = await requireCustomProperty({ workspaceId: propertyScopeId, propertyId, propertyStore });
  const patch = normalizePatchObject(body.patch);

  if (Object.hasOwn(patch, "type") && patch.type !== property.type) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", "Property type cannot be changed.", "type");
  }

  const timestamp = now();
  let updatedProperty;
  try {
    updatedProperty = normalizePropertyDefinition({
      ...property,
      name: Object.hasOwn(patch, "name") ? requireNonEmptyText(patch.name, "name") : property.name,
      hidden: Object.hasOwn(patch, "hidden") ? patch.hidden === true : property.hidden,
      order: Object.hasOwn(patch, "order") ? patch.order : property.order,
      config: Object.hasOwn(patch, "config") ? patch.config : property.config,
      updatedAt: timestamp,
    }, { workspaceId: propertyScopeId, now: timestamp });
  } catch (error) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", error.message, "type");
  }

  return {
    workspaceId,
    property: await propertyStore.saveProperty(updatedProperty),
  };
}

async function reorderPropertiesResult({ body, workspaceId, propertyScopeId, propertyStore, now }) {
  const customProperties = await propertyStore.listProperties(propertyScopeId);
  const properties = await listAllPropertyDefinitions({ workspaceId: propertyScopeId, propertyStore });
  const orderedPropertyIds = validateCustomDocumentOrder(body.orderedPropertyIds, properties, "orderedPropertyIds");
  const customPropertyById = new Map(customProperties.map((property) => [property.id, property]));
  const timestamp = now();
  const savedProperties = [];

  for (const [index, propertyId] of orderedPropertyIds.entries()) {
    if (!customPropertyById.has(propertyId)) {
      continue;
    }

    savedProperties.push(await propertyStore.saveProperty({
      ...customPropertyById.get(propertyId),
      order: (index + 1) * 10,
      updatedAt: timestamp,
    }));
  }

  return {
    workspaceId,
    properties: savedProperties.map((property) => ({ id: property.id, order: property.order })),
  };
}

async function deletePropertyResult({ body, workspaceId, propertyScopeId, propertyStore, viewStore, now }) {
  const propertyId = requirePayloadString(body, "propertyId");
  const property = await requireCustomProperty({ workspaceId: propertyScopeId, propertyId, propertyStore });
  const propertyValues = await propertyStore.listProjectPropertyValues(propertyScopeId, { propertyId });

  if (propertyValues.length > 0 && body.confirmDeleteValues !== true) {
    throw createWorkspaceServiceError("PROPERTY_IN_USE", "Property has values and needs delete confirmation.", "propertyId");
  }

  const timestamp = now();
  await propertyStore.saveProperty({
    ...property,
    deletedAt: timestamp,
    updatedAt: timestamp,
  });

  for (const selectValue of await propertyStore.listSelectValues(propertyScopeId, { propertyId })) {
    await propertyStore.saveSelectValue({
      ...selectValue,
      deletedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const valueDocument of propertyValues) {
    await propertyStore.saveProjectPropertyValue({
      ...valueDocument,
      deletedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (viewStore) {
    await removePropertyFromSourceViews({
      viewStore,
      sourceFolderId: propertyScopeId,
      propertyId,
      now: timestamp,
    });
  }

  return {
    workspaceId,
    deletedPropertyId: propertyId,
  };
}

async function removePropertyFromSourceViews({ viewStore, sourceFolderId, propertyId, now }) {
  const workspaces = await viewStore.listWorkspaces(sourceFolderId);

  for (const workspace of workspaces) {
    const views = await viewStore.listViews(workspace.id);

    for (const view of views) {
      const visiblePropertyIds = Array.isArray(view.visiblePropertyIds)
        ? view.visiblePropertyIds.filter((id) => id !== propertyId)
        : view.visiblePropertyIds;
      const hiddenPropertyIds = Array.isArray(view.hiddenPropertyIds)
        ? view.hiddenPropertyIds.filter((id) => id !== propertyId)
        : view.hiddenPropertyIds;
      const propertyOrder = view.propertyOrder && typeof view.propertyOrder === "object"
        ? { ...view.propertyOrder }
        : {};
      const valueVisibility = view.valueVisibility && typeof view.valueVisibility === "object"
        ? { ...view.valueVisibility }
        : {};

      const hadPropertyOrder = Object.hasOwn(propertyOrder, propertyId);
      const hadValueVisibility = Object.hasOwn(valueVisibility, propertyId);
      delete propertyOrder[propertyId];
      delete valueVisibility[propertyId];

      const changed =
        visiblePropertyIds !== view.visiblePropertyIds ||
        hiddenPropertyIds !== view.hiddenPropertyIds ||
        hadPropertyOrder ||
        hadValueVisibility;

      if (!changed) {
        continue;
      }

      await viewStore.saveView({
        ...view,
        visiblePropertyIds,
        hiddenPropertyIds,
        propertyOrder,
        valueVisibility,
        updatedAt: now,
      });
    }
  }
}

async function createSelectValueResult({ body, workspaceId, propertyScopeId, propertyStore, idFactory, now }) {
  const propertyId = requirePayloadString(body, "propertyId");
  const property = await requireSelectableProperty({ workspaceId: propertyScopeId, propertyId, propertyStore });
  const existingValues = await propertyStore.listSelectValues(propertyScopeId, { propertyId });
  const selectValueId = normalizeNewDocumentId({
    prefix: "selectValue",
    seed: `${property.id}:${body.selectValueId || body.id || idFactory()}`,
  });

  if (existingValues.some((selectValue) => selectValue.id === selectValueId)) {
    throw createWorkspaceServiceError("SELECT_VALUE_ALREADY_EXISTS", "Select value already exists.", "selectValueId");
  }

  const timestamp = now();
  const order = Number.isFinite(Number(body.order))
    ? Number(body.order)
    : existingValues.reduce((max, selectValue) => Math.max(max, Number(selectValue.order) || 0), 0) + 10;
  const selectValue = normalizeSelectValue({
    id: selectValueId,
    workspaceId: propertyScopeId,
    propertyId: property.id,
    name: requireNonEmptyText(body.name, "name"),
    color: body.color,
    hidden: body.hidden === true,
    order,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { workspaceId: propertyScopeId, propertyId, now: timestamp });

  return {
    workspaceId,
    selectValue: await propertyStore.saveSelectValue(selectValue),
  };
}

async function updateSelectValueResult({ body, workspaceId, propertyScopeId, propertyStore, now }) {
  const selectValueId = requirePayloadString(body, "selectValueId");
  const selectValue = await requireSelectValue({ workspaceId: propertyScopeId, selectValueId, propertyStore });
  const property = await requireSelectableProperty({
    workspaceId: propertyScopeId,
    propertyId: selectValue.propertyId,
    propertyStore,
  });
  const patch = normalizePatchObject(body.patch);
  const timestamp = now();
  const updatedSelectValue = normalizeSelectValue({
    ...selectValue,
    propertyId: property.id,
    name: Object.hasOwn(patch, "name") ? requireNonEmptyText(patch.name, "name") : selectValue.name,
    color: Object.hasOwn(patch, "color") ? patch.color : selectValue.color,
    hidden: Object.hasOwn(patch, "hidden") ? patch.hidden === true : selectValue.hidden,
    order: Object.hasOwn(patch, "order") ? patch.order : selectValue.order,
    updatedAt: timestamp,
  }, { workspaceId: propertyScopeId, propertyId: property.id, now: timestamp });

  return {
    workspaceId,
    selectValue: await propertyStore.saveSelectValue(updatedSelectValue),
  };
}

async function updateStatusValueColorResult({ body, workspaceId, propertyScopeId, propertyStore, statusValues, now }) {
  const statusValueId = requirePayloadString(body, "statusValueId");
  const statusValue = statusValues.find((value) => value.id === statusValueId);
  if (!statusValue) {
    throw createWorkspaceServiceError("STATUS_VALUE_NOT_FOUND", "Status value was not found.", "statusValueId");
  }

  const color = normalizeStatusValueColor(body.color ?? normalizePatchObject(body.patch).color);
  const existingValue = await propertyStore.getSelectValue(propertyScopeId, statusValueId);
  const timestamp = now();
  const order = existingValue?.order ?? ((statusValues.findIndex((value) => value.id === statusValueId) + 1) * 10);
  const savedValue = await propertyStore.saveSelectValue(normalizeSelectValue({
    ...existingValue,
    id: statusValue.id,
    workspaceId: propertyScopeId,
    propertyId: PROPERTY_STATUS_ID,
    name: statusValue.name,
    color,
    hidden: false,
    order,
    createdAt: existingValue?.createdAt || timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }, { workspaceId: propertyScopeId, propertyId: PROPERTY_STATUS_ID, now: timestamp }));

  return {
    workspaceId,
    statusValue: {
      ...statusValue,
      color: savedValue.color,
    },
  };
}

async function reorderSelectValuesResult({ body, workspaceId, propertyScopeId, propertyStore, now }) {
  const propertyId = requirePayloadString(body, "propertyId");
  await requireSelectableProperty({ workspaceId: propertyScopeId, propertyId, propertyStore });
  const selectValues = await propertyStore.listSelectValues(propertyScopeId, { propertyId });
  const orderedSelectValueIds = validateCustomDocumentOrder(body.orderedSelectValueIds, selectValues, "orderedSelectValueIds");
  const byId = new Map(selectValues.map((selectValue) => [selectValue.id, selectValue]));
  const timestamp = now();
  const savedSelectValues = [];

  for (const [index, selectValueId] of orderedSelectValueIds.entries()) {
    savedSelectValues.push(await propertyStore.saveSelectValue({
      ...byId.get(selectValueId),
      order: (index + 1) * 10,
      updatedAt: timestamp,
    }));
  }

  return {
    workspaceId,
    selectValues: savedSelectValues.map((selectValue) => ({ id: selectValue.id, order: selectValue.order })),
  };
}

async function deleteSelectValueResult({ body, workspaceId, propertyScopeId, propertyStore, now }) {
  const selectValueId = requirePayloadString(body, "selectValueId");
  const selectValue = await requireSelectValue({ workspaceId: propertyScopeId, selectValueId, propertyStore });
  const property = await requireSelectableProperty({
    workspaceId: propertyScopeId,
    propertyId: selectValue.propertyId,
    propertyStore,
  });
  const propertyValues = await propertyStore.listProjectPropertyValues(propertyScopeId, {
    propertyId: property.id,
  });
  const valuesUsingSelectValue = propertyValues.filter((valueDocument) =>
    projectPropertyValueUsesSelectValue(valueDocument.value, selectValue.id),
  );

  if (valuesUsingSelectValue.length > 0 && body.confirmDeleteUsages !== true) {
    throw createWorkspaceServiceError(
      "SELECT_VALUE_IN_USE",
      "Select value is used by project property values and needs delete confirmation.",
      "selectValueId",
    );
  }

  const timestamp = now();
  await propertyStore.saveSelectValue({
    ...selectValue,
    deletedAt: timestamp,
    updatedAt: timestamp,
  });

  for (const valueDocument of valuesUsingSelectValue) {
    const nextValue = property.type === "multi-select"
      ? valueDocument.value.filter((valueId) => valueId !== selectValue.id)
      : null;
    await propertyStore.saveProjectPropertyValue({
      ...valueDocument,
      value: nextValue,
      updatedAt: timestamp,
    });
    await propertyStore.appendPropertyHistory(createPropertyHistoryDocument({
      workspaceId: propertyScopeId,
      projectId: valueDocument.projectId,
      propertyId: property.id,
      oldValue: valueDocument.value,
      newValue: nextValue,
      timestamp,
      reason: "select-value-deleted",
    }));
  }

  return {
    workspaceId,
    deletedSelectValueId: selectValue.id,
  };
}

async function updateProjectPropertyValueResult({ body, workspaceId, propertyScopeId, propertyStore, rootPath, rules, now }) {
  const projectId = requirePayloadString(body, "projectId");
  const propertyId = requirePayloadString(body, "propertyId");
  const property = await requireCustomProperty({ workspaceId: propertyScopeId, propertyId, propertyStore });
  const { projects } = await getProjectsAndStatusValues({ rootPath, workspaceId, propertyStore, rules });
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    throw createWorkspaceServiceError("PROJECT_NOT_FOUND", "Project was not found.", "projectId");
  }

  const selectValues = await propertyStore.listSelectValues(propertyScopeId, { propertyId });
  let normalizedValue;
  try {
    normalizedValue = normalizeProjectPropertyValue({
      property,
      value: body.value,
      selectValues,
    });
  } catch (error) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", error.message, "value");
  }

  const timestamp = now();
  const existingValue = await propertyStore.getProjectPropertyValue(propertyScopeId, projectId, propertyId);
  const valueDocument = {
    id: existingValue?.id || createStableDocumentId("propertyValue", propertyScopeId, projectId, propertyId),
    type: "projectPropertyValue",
    schemaVersion: 1,
    workspaceId: propertyScopeId,
    projectId,
    propertyId,
    propertyType: normalizedValue.type,
    value: normalizedValue.value,
    createdAt: existingValue?.createdAt || timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };

  const savedValue = await propertyStore.saveProjectPropertyValue(valueDocument);
  await propertyStore.appendPropertyHistory(createPropertyHistoryDocument({
    workspaceId: propertyScopeId,
    projectId,
    propertyId,
    oldValue: existingValue?.value ?? null,
    newValue: savedValue.value,
    timestamp,
    reason: "user-update",
  }));

  return {
    workspaceId,
    projectId,
    propertyId,
    value: savedValue.value,
    updatedAt: savedValue.updatedAt,
  };
}

async function listAllPropertyDefinitions({ workspaceId, propertyStore }) {
  return [
    ...createDefaultPropertySchemas(workspaceId),
    ...await propertyStore.listProperties(workspaceId),
  ].sort(comparePropertyDefinitions);
}

function createVisiblePropertiesForView({ view, propertyDefinitions }) {
  const normalizedView = normalizeViewDocument(view);
  const propertyById = new Map(propertyDefinitions.map((property) => [property.id, property]));
  const visiblePropertyIds = normalizedView.visiblePropertyIds;

  return visiblePropertyIds
    .map((propertyId) => propertyById.get(propertyId))
    .filter(Boolean)
    .filter((property) => !property.deletedAt && !property.hidden)
    .sort((left, right) => (
      Number(normalizedView.propertyOrder?.[left.id] ?? left.order ?? 0)
      - Number(normalizedView.propertyOrder?.[right.id] ?? right.order ?? 0)
    ))
    .map(toVisibleProperty);
}

function attachProjectPropertyValues(projects, propertyValues) {
  const valuesByProject = new Map();

  for (const valueDocument of propertyValues) {
    const values = valuesByProject.get(valueDocument.projectId) || {};
    values[valueDocument.propertyId] = valueDocument.value;
    valuesByProject.set(valueDocument.projectId, values);
  }

  return projects.map((project) => ({
    ...project,
    propertyValues: {
      ...project.propertyValues,
      ...(valuesByProject.get(project.id) || {}),
    },
  }));
}

async function requireCustomProperty({ workspaceId, propertyId, propertyStore }) {
  if (isSystemPropertyId(propertyId)) {
    throw createWorkspaceServiceError("SYSTEM_PROPERTY_READONLY", "System properties cannot be changed.", "propertyId");
  }

  const property = await propertyStore.getProperty(workspaceId, propertyId);
  if (!property || property.deletedAt) {
    throw createWorkspaceServiceError("PROPERTY_NOT_FOUND", "Property was not found.", "propertyId");
  }

  return property;
}

async function requireSelectableProperty({ workspaceId, propertyId, propertyStore }) {
  const property = await requireCustomProperty({ workspaceId, propertyId, propertyStore });
  if (property.type !== "select" && property.type !== "multi-select") {
    throw createWorkspaceServiceError("INVALID_PROPERTY_TYPE", "Property must be select or multi-select.", "propertyId");
  }

  return property;
}

async function requireSelectValue({ workspaceId, selectValueId, propertyStore }) {
  const selectValue = await propertyStore.getSelectValue(workspaceId, selectValueId);
  if (!selectValue || selectValue.deletedAt) {
    throw createWorkspaceServiceError("SELECT_VALUE_NOT_FOUND", "Select value was not found.", "selectValueId");
  }

  return selectValue;
}

function validateCustomDocumentOrder(orderedIds, existingDocuments, field) {
  if (!Array.isArray(orderedIds)) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", `${field} must be an array.`, field);
  }

  const existingIds = new Set(existingDocuments.map((document) => document.id));
  const normalizedIds = orderedIds
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueIds = new Set(normalizedIds);

  if (normalizedIds.length !== existingDocuments.length || uniqueIds.size !== existingDocuments.length) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", `${field} must include each item once.`, field);
  }

  for (const id of normalizedIds) {
    if (!existingIds.has(id)) {
      throw createWorkspaceServiceError("VALIDATION_FAILED", `${field} references an unknown item.`, field);
    }
  }

  return normalizedIds;
}

function normalizePatchObject(patch) {
  return patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
}

function normalizeStatusValueColor(value) {
  const color = typeof value === "string" ? value.trim() : "";
  if (!statusValueColorTokens.has(color)) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", "Status value color is invalid.", "color");
  }

  return color;
}

function requireNonEmptyText(value, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw createWorkspaceServiceError("VALIDATION_FAILED", `${field} is required.`, field);
  }

  return text;
}

function normalizeNewDocumentId({ prefix, seed }) {
  const rawSeed = typeof seed === "string" && seed.trim() ? seed : randomUUID();
  const prefixText = `${prefix}:`;
  if (rawSeed.startsWith(prefixText)) {
    return `${prefixText}${createSlug(rawSeed.slice(prefixText.length))}`;
  }

  return `${prefix}:${createSlug(rawSeed)}`;
}

function createStableDocumentId(prefix, ...parts) {
  return `${prefix}:${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24)}`;
}

function createPropertyHistoryDocument({
  workspaceId,
  projectId,
  propertyId,
  oldValue,
  newValue,
  timestamp,
  reason,
}) {
  return {
    id: createStableDocumentId("propertyHistory", workspaceId, projectId, propertyId, timestamp, reason),
    type: "propertyHistory",
    schemaVersion: 1,
    workspaceId,
    projectId,
    propertyId,
    oldValue,
    newValue,
    reason,
    createdAt: timestamp,
  };
}

function projectPropertyValueUsesSelectValue(value, selectValueId) {
  return Array.isArray(value) ? value.includes(selectValueId) : value === selectValueId;
}

function createPropertyUsageSummary(propertyValues) {
  const propertyValueCounts = {};
  const selectValueCounts = {};

  for (const valueDocument of propertyValues) {
    propertyValueCounts[valueDocument.propertyId] = (propertyValueCounts[valueDocument.propertyId] || 0) + 1;

    if (Array.isArray(valueDocument.value)) {
      for (const valueId of valueDocument.value) {
        selectValueCounts[valueId] = (selectValueCounts[valueId] || 0) + 1;
      }
      continue;
    }

    if (typeof valueDocument.value === "string" && valueDocument.value) {
      selectValueCounts[valueDocument.value] = (selectValueCounts[valueDocument.value] || 0) + 1;
    }
  }

  return {
    propertyValueCounts,
    selectValueCounts,
  };
}

function comparePropertyDefinitions(left, right) {
  return (
    Number(left.order || 0) - Number(right.order || 0)
    || String(left.createdAt).localeCompare(String(right.createdAt))
    || String(left.id).localeCompare(String(right.id))
  );
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

async function createStatusValuesWithColors({ workspaceId, objects, propertyStore }) {
  const statusValues = createStatusValues(workspaceId, objects);
  if (!propertyStore) {
    return statusValues;
  }

  const colorValues = await propertyStore.listSelectValues(workspaceId, { propertyId: PROPERTY_STATUS_ID });
  const colorByStatusValueId = new Map(colorValues.map((value) => [value.id, value.color]));
  return statusValues.map((statusValue) => {
    const color = colorByStatusValueId.get(statusValue.id);
    return color ? { ...statusValue, color } : statusValue;
  });
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
    type: property.type,
    propertyType: property.type,
    system: property.system,
    hidden: property.hidden === true,
    order: property.order,
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
    if (error.code === "ENOENT") {
      return { workspaces: {}, views: {} };
    }
    if (error instanceof SyntaxError) {
      throw createStorageCorruptionError(filePath, error);
    }

    throw error;
  }
}

async function writeViewStoreData(filePath, data) {
  const directory = dirname(filePath);
  const tempPath = join(directory, `.${basename(filePath)}.${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
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

function createStorageCorruptionError(filePath, cause) {
  const error = new Error(`Workspace storage JSON is corrupt: ${filePath}`);
  error.code = "WORKSPACE_STORAGE_CORRUPT";
  error.field = "storage";
  error.filePath = filePath;
  error.cause = cause;
  return error;
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
