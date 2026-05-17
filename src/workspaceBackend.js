import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { spawn } from "node:child_process";
import { flattenAccessTreeCards } from "./folderModel.js";
import { isPreviewablePath, resolveExistingWorkspacePath, resolveWorkspacePath } from "./localOpen.js";
import { projectFoldersToWorkspaceObjects } from "./workspaceObjects.js";
import {
  WorkspaceViewError,
  createDefaultView,
  createViewProjection,
  normalizeViewDocument,
  validateViewPatch,
} from "./workspaceViews.js";

export const defaultWorkspaceDataDirectory = join(process.cwd(), ".workspace");
export const defaultLegacyWorkspaceDataDirectory = join(process.cwd(), ".folder-kanban");
export const defaultWorkspaceSettingsPath = join(defaultWorkspaceDataDirectory, "settings.json");
export const defaultWorkspacePropertiesPath = join(defaultWorkspaceDataDirectory, "properties.json");
export const defaultLegacyWorkspaceSettingsPath = join(defaultLegacyWorkspaceDataDirectory, "settings.json");
export const defaultLegacyWorkspacePropertiesPath = join(defaultLegacyWorkspaceDataDirectory, "properties.json");

const fileContentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

export async function createSelectRootResponse({
  configPath = defaultWorkspaceSettingsPath,
  chooseRoot = chooseMacWorkspaceRoot,
} = {}) {
  const rootPath = await chooseRoot();
  if (!rootPath) {
    return createJsonResponse(400, { error: "No folder selected." });
  }

  await writeWorkspaceSettings(configPath, { rootPath });
  return createJsonResponse(200, { root: createRootPayload(rootPath) });
}

export async function createScanResponse({
  root,
  rules = {},
  propertiesPath = defaultWorkspacePropertiesPath,
  includeCardChildren = false,
  includeFileTree = false,
}) {
  try {
    if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
      return createJsonResponse(404, { error: "Workspace root was not found." });
    }

    const tree = await listWorkspaceAccessTree(root, rules, [], { includeCardChildren, includeFileTree });
    const folders = flattenAccessTreeCards(tree, { rootStatus: basename(root) });
    const workspaceId = `workspace:${createRootPropertiesKey(root)}`;
    const workspace = {
      id: workspaceId,
      ...projectFoldersToWorkspaceObjects({
        workspaceId,
        rootPath: root,
        folders,
      }),
    };
    return createJsonResponse(200, {
      root: createRootPayload(root),
      tree,
      folders,
      workspace,
    });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not scan workspace root." });
  }
}

export async function createProjectFileTreeResponse({ root, body }) {
  try {
    if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
      return createJsonResponse(404, { error: "Workspace root was not selected." });
    }

    const folderPath = typeof body?.path === "string" ? body.path.trim() : "";
    if (!folderPath) {
      return createJsonResponse(400, { error: "Project folder path is required." });
    }

    const targetPath = resolveWorkspaceEntryPath(root, folderPath);
    if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
      return createJsonResponse(404, { error: "Project folder was not found." });
    }

    return createJsonResponse(200, {
      path: folderPath,
      fileTree: await listProjectFileTree(root, folderPath),
    });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not list project file tree." });
  }
}

export async function createPropertiesResponse({ root, body, propertiesPath = defaultWorkspacePropertiesPath }) {
  try {
    if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
      return createJsonResponse(404, { error: "Workspace root was not selected." });
    }

    const folderPath = body?.path;
    if (typeof folderPath !== "string" || !folderPath.trim()) {
      return createJsonResponse(400, { error: "Folder path is required." });
    }

    const targetPath = resolveWorkspaceEntryPath(root, folderPath);
    if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
      return createJsonResponse(404, { error: "Folder was not found." });
    }

    const propertyId = typeof body?.propertyId === "string" ? body.propertyId.trim() : "";
    if (!propertyId) {
      return createJsonResponse(400, { error: "Property id is required." });
    }

    const properties = await readWorkspaceProperties(propertiesPath);
    const rootKey = createRootPropertiesKey(root);
    const rootProperties = properties.roots[rootKey] || {};
    const folderProperties = rootProperties[folderPath] || {};
    return createJsonResponse(200, { properties: folderProperties });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not save folder properties." });
  }
}

export async function createListEntriesResponse({ root, body }) {
  try {
    if (!root) {
      return createJsonResponse(404, { error: "Workspace root was not selected." });
    }

    const targetPath = resolveWorkspaceEntryPath(root, body?.path || "");
    if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
      return createJsonResponse(404, { error: "Folder was not found." });
    }

    const entries = await listWorkspaceEntries(root, body?.path || "");
    return createJsonResponse(200, { entries });
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not list folder." });
  }
}

export async function createFileResponse({ root, path }) {
  try {
    if (!root) {
      return createJsonResponse(404, { error: "Workspace root was not selected." });
    }

    if (!isPreviewablePath(path)) {
      return createJsonResponse(415, { error: "File type is not previewable." });
    }

    const filePath = resolveExistingWorkspacePath(root, path);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return createJsonResponse(404, { error: "File was not found." });
    }

    return {
      status: 200,
      filePath,
      contentType: fileContentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      stream: createReadStream(filePath),
    };
  } catch (error) {
    return createJsonResponse(400, { error: error.message || "Could not open file." });
  }
}

export async function createListViewsResponse({ body, viewStore }) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const views = await viewStore.listViews(workspaceId);

    return createJsonResponse(200, {
      workspaceId,
      activeViewId: workspace.activeViewId || null,
      views: views.map(normalizeViewDocument),
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createViewProjectionResponse({
  body,
  viewStore,
  projectProvider,
  propertyProvider,
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const viewId = typeof body?.viewId === "string" && body.viewId.trim()
      ? body.viewId.trim()
      : workspace.activeViewId;

    if (!viewId) {
      throw new WorkspaceViewError("VIEW_NOT_FOUND", "Active view was not found.", "viewId");
    }

    const view = await requireActiveWorkspaceView(viewStore, workspaceId, viewId);
    const projects = await projectProvider({ workspaceId });
    const { visibleProperties, statusValues } = await propertyProvider({ workspaceId, view });

    return createJsonResponse(200, createViewProjection({
      view,
      projects,
      visibleProperties,
      statusValues,
      searchQuery: body?.searchQuery,
    }));
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createCreateViewResponse({
  body,
  viewStore,
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const viewType = requireBodyString(body, "viewType");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const views = await viewStore.listViews(workspaceId);
    const id = normalizeViewId(idFactory());
    const timestamp = now();
    const maxOrder = views.reduce((max, view) => Math.max(max, Number(view.order) || 0), 0);
    const view = createDefaultView({
      workspaceId,
      viewType,
      name: body?.name,
      id,
      order: views.length === 0 ? 10 : maxOrder + 10,
      now: timestamp,
    });
    const savedView = await viewStore.saveView(view);
    await viewStore.saveWorkspace({
      ...workspace,
      activeViewId: savedView.id,
      updatedAt: timestamp,
    });

    return createJsonResponse(200, {
      workspaceId,
      activeViewId: savedView.id,
      view: normalizeViewDocument(savedView),
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createSetActiveViewResponse({
  body,
  viewStore,
  now = () => new Date().toISOString(),
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const viewId = requireBodyString(body, "viewId");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const view = await requireActiveWorkspaceView(viewStore, workspaceId, viewId);
    const timestamp = now();

    await viewStore.saveWorkspace({
      ...workspace,
      activeViewId: view.id,
      updatedAt: timestamp,
    });

    return createJsonResponse(200, {
      workspaceId,
      activeViewId: view.id,
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createReorderViewsResponse({
  body,
  viewStore,
  now = () => new Date().toISOString(),
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    await requireWorkspace(viewStore, workspaceId);
    const views = await viewStore.listViews(workspaceId);
    const orderedViewIds = validateViewOrder(body?.orderedViewIds, views);
    const viewsById = new Map(views.map((view) => [view.id, view]));
    const timestamp = now();
    const savedViews = [];

    for (const [index, viewId] of orderedViewIds.entries()) {
      const order = (index + 1) * 10;
      const savedView = await viewStore.saveView(normalizeViewDocument({
        ...viewsById.get(viewId),
        order,
        updatedAt: timestamp,
      }));
      savedViews.push(savedView);
    }

    return createJsonResponse(200, {
      views: savedViews.map((view) => ({ id: view.id, order: view.order })),
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createUpdateViewResponse({
  body,
  viewStore,
  propertyDefinitions = [],
  selectValues = [],
  statusValues = [],
  now = () => new Date().toISOString(),
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const viewId = requireBodyString(body, "viewId");
    await requireWorkspace(viewStore, workspaceId);
    const view = await requireActiveWorkspaceView(viewStore, workspaceId, viewId);

    validateViewPatch({
      patch: body?.patch,
      propertyDefinitions,
      selectValues,
      statusValues,
    });
    validatePropertyOrderVisibleInView({ view, patch: body?.patch });

    const savedView = await viewStore.saveView(normalizeViewDocument({
      ...view,
      ...(body?.patch || {}),
      updatedAt: now(),
    }));

    return createJsonResponse(200, {
      workspaceId,
      view: normalizeViewDocument(savedView),
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function createDeleteViewResponse({
  body,
  viewStore,
  now = () => new Date().toISOString(),
}) {
  try {
    const workspaceId = requireBodyString(body, "workspaceId");
    const viewId = requireBodyString(body, "viewId");
    const workspace = await requireWorkspace(viewStore, workspaceId);
    const view = await requireActiveWorkspaceView(viewStore, workspaceId, viewId);
    const views = await viewStore.listViews(workspaceId);

    if (views.length <= 1) {
      throw new WorkspaceViewError(
        "LAST_VIEW_DELETE_BLOCKED",
        "Cannot delete the last workspace view.",
        "viewId",
      );
    }

    const timestamp = now();
    await viewStore.saveView(normalizeViewDocument({
      ...view,
      deletedAt: timestamp,
      updatedAt: timestamp,
    }));

    const remainingViews = await viewStore.listViews(workspaceId);
    const activeViewId = workspace.activeViewId === view.id
      ? remainingViews[0]?.id || null
      : workspace.activeViewId || null;

    if (activeViewId !== (workspace.activeViewId || null)) {
      await viewStore.saveWorkspace({
        ...workspace,
        activeViewId,
        updatedAt: timestamp,
      });
    }

    return createJsonResponse(200, {
      workspaceId,
      activeViewId,
      deletedViewId: view.id,
    });
  } catch (error) {
    return createWorkspaceViewErrorResponse(error);
  }
}

export async function readWorkspaceSettings(configPath = defaultWorkspaceSettingsPath, legacyConfigPath) {
  const settings = await readJsonFile(configPath);
  if (settings.ok) {
    return settings.value;
  }

  if (!settings.missing) {
    throw createStorageCorruptionError(configPath, settings.error);
  }

  const resolvedLegacyConfigPath =
    legacyConfigPath ?? resolveLegacyWorkspacePath(configPath, defaultWorkspaceSettingsPath, defaultLegacyWorkspaceSettingsPath);
  if (!resolvedLegacyConfigPath) {
    return {};
  }

  const legacySettings = await readJsonFile(resolvedLegacyConfigPath);
  if (!legacySettings.ok) {
    return {};
  }

  await writeWorkspaceSettings(configPath, legacySettings.value);
  return legacySettings.value;
}

export async function readWorkspaceProperties(
  propertiesPath = defaultWorkspacePropertiesPath,
  legacyPropertiesPath,
) {
  const properties = await readJsonFile(propertiesPath);
  if (properties.ok) {
    return normalizeWorkspaceProperties(properties.value);
  }

  if (!properties.missing) {
    throw createStorageCorruptionError(propertiesPath, properties.error);
  }

  const resolvedLegacyPropertiesPath =
    legacyPropertiesPath ??
    resolveLegacyWorkspacePath(propertiesPath, defaultWorkspacePropertiesPath, defaultLegacyWorkspacePropertiesPath);
  if (!resolvedLegacyPropertiesPath) {
    return { roots: {} };
  }

  const legacyProperties = await readJsonFile(resolvedLegacyPropertiesPath);
  if (!legacyProperties.ok) {
    return { roots: {} };
  }

  const normalizedProperties = normalizeWorkspaceProperties(legacyProperties.value);
  await writeWorkspaceProperties(propertiesPath, normalizedProperties);
  return normalizedProperties;
}

export async function writeWorkspaceProperties(propertiesPath, properties) {
  await writeJsonFileAtomically(propertiesPath, normalizeWorkspaceProperties(properties));
}

export async function writeWorkspaceSettings(configPath, settings) {
  await writeJsonFileAtomically(configPath, settings);
}

export async function chooseMacWorkspaceRoot() {
  const script = 'POSIX path of (choose folder with prompt "Choose workspace root")';
  const output = await runCommand("osascript", ["-e", script]);
  return output.trim();
}

async function readJsonFile(filePath) {
  try {
    return { ok: true, value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { missing: true };
    }

    return { ok: false, error };
  }
}

async function writeJsonFileAtomically(filePath, value) {
  const directory = dirname(filePath);
  const tempPath = join(directory, `.${basename(filePath)}.${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  await preserveCorruptJsonBeforeWrite(filePath);

  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function preserveCorruptJsonBeforeWrite(filePath) {
  try {
    JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    if (error instanceof SyntaxError) {
      const backupPath = `${filePath}.corrupt-${Date.now()}-${randomUUID()}.bak`;
      await rename(filePath, backupPath);
      return;
    }

    throw error;
  }
}

function createStorageCorruptionError(filePath, cause) {
  const error = new Error(`Workspace storage JSON is corrupt: ${filePath}`);
  error.code = "WORKSPACE_STORAGE_CORRUPT";
  error.field = "storage";
  error.filePath = filePath;
  error.cause = cause;
  return error;
}

function resolveLegacyWorkspacePath(filePath, defaultPath, legacyDefaultPath) {
  if (filePath === defaultPath) {
    return legacyDefaultPath;
  }

  const pathParts = filePath.split("/");
  const workspaceIndex = pathParts.lastIndexOf(".workspace");
  if (workspaceIndex === -1) {
    return null;
  }

  pathParts[workspaceIndex] = ".folder-kanban";
  return pathParts.join("/");
}

async function listWorkspaceAccessTree(root, rules, parentPath = [], options = {}) {
  const directoryPath = parentPath.length > 0 ? resolveWorkspacePath(root, parentPath.join("/")) : root;
  const entries = await readVisibleDirectoryEntries(directoryPath);
  const nodes = [];

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const pathParts = [...parentPath, entry.name];
    const path = pathParts.join("/");
    const rule = rules?.[path] || {};
    const role = normalizeFolderRole(rule.role, parentPath.length);
    const children = role === "card" && !options.includeCardChildren
      ? []
      : await listWorkspaceAccessTree(root, rules, pathParts, options);
    const fileTree = role === "card" && options.includeFileTree
      ? await listProjectFileTree(root, path)
      : null;

    const node = {
      id: createFolderIdFromPath(path),
      name: entry.name,
      kind: "directory",
      path,
      access: rule.access !== false,
      role,
      expanded: rule.expanded === true,
      children,
    };

    if (fileTree) {
      node.fileTree = fileTree;
    }

    nodes.push(node);
  }

  return nodes;
}

async function listProjectFileTree(root, folderPath) {
  const targetPath = resolveWorkspaceEntryPath(root, folderPath);
  const entries = await readVisibleDirectoryEntries(targetPath);
  const visibleEntries = entries
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => {
      const kind = entry.isDirectory() ? "directory" : "file";
      const path = [folderPath, entry.name].filter(Boolean).join("/");
      return {
        entry,
        kind,
        name: entry.name,
        path,
      };
    })
    .sort(compareFolderEntries);

  return Promise.all(visibleEntries.map(async ({ entry, kind, path }) => {
    const isDirectory = kind === "directory";
    const node = {
      id: createEntryId(kind, path),
      name: entry.name,
      kind: isDirectory ? "folder" : "file",
      relativePath: path,
      available: true,
    };

    if (isDirectory) {
      node.children = await listProjectFileTree(root, path);
    }

    return node;
  }));
}

async function listWorkspaceEntries(root, folderPath) {
  const targetPath = resolveWorkspaceEntryPath(root, folderPath);
  const entries = await readVisibleDirectoryEntries(targetPath);

  return entries
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => {
      const kind = entry.isDirectory() ? "directory" : "file";
      const path = [folderPath, entry.name].filter(Boolean).join("/");
      return {
        id: createEntryId(kind, path),
        name: entry.name,
        kind,
        path,
      };
    })
    .sort(compareFolderEntries);
}

async function readVisibleDirectoryEntries(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

function resolveWorkspaceEntryPath(root, relativePath) {
  return relativePath ? resolveExistingWorkspacePath(root, relativePath) : root;
}

function getRootFolderProperties(properties, root) {
  return properties.roots[createRootPropertiesKey(root)] || {};
}

function normalizeWorkspaceProperties(properties) {
  const roots = properties?.roots && typeof properties.roots === "object" ? properties.roots : {};

  return {
    roots: Object.fromEntries(
      Object.entries(roots)
        .filter(([rootKey, folders]) => typeof rootKey === "string" && folders && typeof folders === "object")
        .map(([rootKey, folders]) => [
          rootKey,
          Object.fromEntries(
            Object.entries(folders)
              .filter(([folderPath, folderProperties]) => (
                typeof folderPath === "string" &&
                folderProperties &&
                typeof folderProperties === "object"
              ))
              .map(([folderPath, folderProperties]) => [
                folderPath,
                { text: normalizeTextProperty(folderProperties.text) },
              ]),
          ),
        ]),
    ),
  };
}

function normalizeTextProperty(text) {
  return typeof text === "string" ? text : "";
}

function createRootPropertiesKey(root) {
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

function createRootPayload(rootPath) {
  return {
    name: basename(rootPath),
  };
}

function compareFolderEntries(left, right) {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function normalizeFolderRole(role, depth = 0) {
  if (role === "status" || role === "group") {
    return role;
  }
  if (role === "card") {
    return "card";
  }

  return depth === 0 ? "status" : "card";
}

function createFolderIdFromPath(path) {
  return createFolderId(path.replace(/\//g, "-"));
}

function createEntryId(kind, path) {
  return `${kind}-${createFolderId(path.replace(/\//g, "-")).replace(/^folder-/, "")}`;
}

function createFolderId(name) {
  const slug = String(name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");

  return `folder-${slug || "untitled"}`;
}

function requireBodyString(body, field) {
  const value = typeof body?.[field] === "string" ? body[field].trim() : "";
  if (!value) {
    throw new WorkspaceViewError("VALIDATION_FAILED", `${field} is required.`, field);
  }

  return value;
}

async function requireWorkspace(viewStore, workspaceId) {
  const workspace = await viewStore.getWorkspace(workspaceId);
  if (!workspace) {
    throw new WorkspaceViewError("WORKSPACE_NOT_FOUND", "Workspace was not found.", "workspaceId");
  }

  return workspace;
}

async function requireActiveWorkspaceView(viewStore, workspaceId, viewId) {
  const view = await viewStore.getView(viewId);
  if (!view || view.workspaceId !== workspaceId || view.deletedAt) {
    throw new WorkspaceViewError("VIEW_NOT_FOUND", "View was not found.", "viewId");
  }

  return view;
}

function validatePropertyOrderVisibleInView({ view, patch }) {
  if (!patch?.propertyOrder || typeof patch.propertyOrder !== "object" || Array.isArray(patch.propertyOrder)) {
    return;
  }

  const effectiveView = normalizeViewDocument({
    ...view,
    ...(Object.hasOwn(patch, "visiblePropertyIds") ? { visiblePropertyIds: patch.visiblePropertyIds } : {}),
  });
  const visiblePropertyIds = new Set(effectiveView.visiblePropertyIds);

  for (const propertyId of Object.keys(patch.propertyOrder)) {
    if (!visiblePropertyIds.has(propertyId)) {
      throw new WorkspaceViewError(
        "INVALID_PROPERTY_REFERENCE",
        "Property order references a hidden property.",
        "propertyOrder",
      );
    }
  }
}

function validateViewOrder(orderedViewIds, views) {
  if (!Array.isArray(orderedViewIds)) {
    throw new WorkspaceViewError("INVALID_VIEW_ORDER", "orderedViewIds must contain every active view exactly once.", "orderedViewIds");
  }

  const activeViewIds = new Set(views.map((view) => view.id));
  const seen = new Set();
  for (const viewId of orderedViewIds) {
    if (typeof viewId !== "string" || !viewId.trim() || seen.has(viewId) || !activeViewIds.has(viewId)) {
      throw new WorkspaceViewError("INVALID_VIEW_ORDER", "orderedViewIds must contain every active view exactly once.", "orderedViewIds");
    }
    seen.add(viewId);
  }

  if (seen.size !== activeViewIds.size) {
    throw new WorkspaceViewError("INVALID_VIEW_ORDER", "orderedViewIds must contain every active view exactly once.", "orderedViewIds");
  }

  return orderedViewIds;
}

function normalizeViewId(id) {
  const value = typeof id === "string" ? id : String(id || "");
  return value.startsWith("view:") ? value : `view:${value}`;
}

function createJsonResponse(status, payload) {
  return { status, payload };
}

function createWorkspaceViewErrorResponse(error) {
  if (error instanceof WorkspaceViewError) {
    return createJsonResponse(error.code === "LAST_VIEW_DELETE_BLOCKED" ? 409 : 400, {
      code: error.code,
      message: error.message,
      field: error.field,
    });
  }

  return createJsonResponse(400, {
    code: "VALIDATION_FAILED",
    message: error?.message || "View request failed.",
  });
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: homedir(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `Command exited with code ${code}.`));
    });
  });
}
