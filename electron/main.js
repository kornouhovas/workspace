import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename, dirname, join } from "node:path";
import {
  createFileResponse,
  createListEntriesResponse,
  createPropertiesResponse,
  createScanResponse,
  createSelectRootResponse,
  readWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { createRevealResponse } from "../src/localOpen.js";
import { createFolderObjectId, createPropertyValueId } from "../src/workspaceObjects.js";
import { WorkspaceServiceClient } from "../src/workspaceServiceClient.js";
import { createSidecarHttpTransport } from "./sidecarClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sidecarStartupTimeoutMs = 5000;

let workspaceClient = null;
let sidecarProcess = null;

app.setName("Workspace");

function createWindow() {
  const window = new BrowserWindow({
    title: "Workspace",
    width: 1440,
    height: 960,
    backgroundColor: "#00000000",
    transparent: true,
    vibrancy: "sidebar",
    visualEffectState: "followWindow",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 22, y: 19 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  window.loadFile(join(__dirname, "../dist/renderer/index.html"));
}

async function startWorkspaceSidecar() {
  const repoRoot = join(__dirname, "..");
  const sidecarPath = resolveWorkspaceSidecarPath(repoRoot);
  const sidecarCwd = resolveWorkspaceSidecarCwd(repoRoot);
  sidecarProcess = spawn(sidecarPath, ["-db", join(app.getPath("userData"), "workspace.db")], {
    cwd: sidecarCwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  sidecarProcess.stdout.setEncoding("utf8");
  sidecarProcess.stderr.setEncoding("utf8");
  sidecarProcess.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message) {
      console.error(message);
    }
  });

  const address = await waitForSidecarAddress(sidecarProcess);
  workspaceClient = new WorkspaceServiceClient(createSidecarHttpTransport(`http://${address}`));
}

function resolveWorkspaceSidecarPath(repoRoot) {
  if (!app.isPackaged) {
    return join(repoRoot, "workspace-sidecar");
  }

  return join(process.resourcesPath, "sidecar", getSidecarPlatformDirectory(), getSidecarExecutableName());
}

function getSidecarPlatformDirectory(platform = process.platform, arch = process.arch) {
  if (platform === "darwin" && arch === "arm64") {
    return "darwin-arm64";
  }

  if (platform === "win32" && arch === "x64") {
    return "win32-x64";
  }

  throw new Error(`Unsupported packaged sidecar platform: ${platform}-${arch}`);
}

function getSidecarExecutableName(platform = process.platform) {
  return platform === "win32" ? "workspace-sidecar.exe" : "workspace-sidecar";
}

function resolveWorkspaceSidecarCwd(repoRoot) {
  return app.isPackaged ? process.resourcesPath : repoRoot;
}

function stopWorkspaceSidecar() {
  if (sidecarProcess) {
    sidecarProcess.kill();
    sidecarProcess = null;
  }
}

async function waitForSidecarAddress(childProcess) {
  return Promise.race([
    readSidecarAddress(childProcess),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Workspace sidecar startup timed out."));
      }, sidecarStartupTimeoutMs);
    }),
    once(childProcess, "error").then(([error]) => {
      throw error;
    }),
    once(childProcess, "exit").then(([code, signal]) => {
      throw new Error(`Workspace sidecar exited before startup: ${code ?? signal}`);
    }),
  ]);
}

function readSidecarAddress(childProcess) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const handleData = (chunk) => {
      const text = String(chunk);
      chunks.push(text);
      const match = chunks.join("").match(/listening on (127\.0\.0\.1:\d+)/);
      if (match) {
        cleanup();
        resolve(match[1]);
      }
    };
    const handleEnd = () => {
      cleanup();
      reject(new Error(`Could not read sidecar address from: ${chunks.join("")}`));
    };
    const cleanup = () => {
      childProcess.stdout.off("data", handleData);
      childProcess.stderr.off("data", handleData);
      childProcess.stdout.off("end", handleEnd);
      childProcess.stderr.off("end", handleEnd);
    };

    childProcess.stdout.on("data", handleData);
    childProcess.stderr.on("data", handleData);
    childProcess.stdout.on("end", handleEnd);
    childProcess.stderr.on("end", handleEnd);
  });
}

function registerWorkspaceHandlers() {
  ipcMain.handle("workspace:getRoot", async () => {
    const rootPath = await readSelectedWorkspaceRootPath();
    return { status: 200, payload: { root: rootPath ? { name: basename(rootPath) } : null } };
  });
  ipcMain.handle("workspace:selectRoot", async () => {
    const response = await createSelectRootResponse({
      configPath: getWorkspaceSettingsPath(),
      chooseRoot: chooseElectronWorkspaceRoot,
    });
    if (response.status < 400) {
      const settings = await readWorkspaceSettings(getWorkspaceSettingsPath());
      await persistWorkspaceRoot(settings.rootPath);
    }
    return response;
  });
  ipcMain.handle("workspace:scan", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const rootPath = await readSelectedWorkspaceRootPath();
    const response = await createScanResponse({ root: rootPath, rules: body.rules, propertiesPath: getWorkspacePropertiesPath() });
    if (response.status < 400) {
      await attachStoredWorkspaceProperties(rootPath, response.payload);
    }
    return response;
  });
  ipcMain.handle("workspace:listEntries", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const rootPath = await readSelectedWorkspaceRootPath();
    return createListEntriesResponse({ root: rootPath, body });
  });
  ipcMain.handle("workspace:saveProperty", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const rootPath = await readSelectedWorkspaceRootPath();
    const response = await createPropertiesResponse({
      root: rootPath,
      propertiesPath: getWorkspacePropertiesPath(),
      body: {
        path: body.path,
        propertyId: body.propertyId,
      },
    });
    if (response.status < 400) {
      await persistWorkspacePropertyValue(rootPath, body);
    }
    return response;
  });
  ipcMain.handle("workspace:previewFile", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const rootPath = await readSelectedWorkspaceRootPath();
    const response = await createFileResponse({ root: rootPath, path: body.path });
    if (!response.filePath) {
      return response;
    }

    response.stream?.destroy();
    return {
      status: 200,
      payload: {
        contentType: response.contentType,
        url: pathToFileURL(response.filePath).href,
      },
    };
  });
  ipcMain.handle("workspace:reveal", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const rootPath = await readSelectedWorkspaceRootPath();
    return createRevealResponse({ root: rootPath, body });
  });
}

async function readSelectedWorkspaceRootPath() {
  if (workspaceClient) {
    try {
      const root = await workspaceClient.getRoot();
      if (root.rootPath) {
        return root.rootPath;
      }
    } catch (error) {
      console.error(`Could not read workspace root from sidecar: ${error.message}`);
    }
  }

  const settings = await readWorkspaceSettings(getWorkspaceSettingsPath());
  if (settings.rootPath) {
    await persistWorkspaceRoot(settings.rootPath);
  }
  return settings.rootPath;
}

async function chooseElectronWorkspaceRoot() {
  const result = await dialog.showOpenDialog({
    title: "Choose workspace root",
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths[0]) {
    return "";
  }

  return result.filePaths[0];
}

function getWorkspaceDataDirectory() {
  return join(app.getPath("userData"), ".workspace");
}

function getWorkspaceSettingsPath() {
  return join(getWorkspaceDataDirectory(), "settings.json");
}

function getWorkspacePropertiesPath() {
  return join(getWorkspaceDataDirectory(), "properties.json");
}

async function persistWorkspaceRoot(rootPath) {
  if (!workspaceClient || !rootPath) {
    return;
  }

  try {
    await workspaceClient.setRoot({
      rootPath,
      name: basename(rootPath),
    });
  } catch (error) {
    console.error(`Could not persist workspace root to sidecar: ${error.message}`);
  }
}

async function attachStoredWorkspaceProperties(rootPath, payload) {
  if (!workspaceClient || !rootPath || !payload?.workspace || !Array.isArray(payload.folders)) {
    return;
  }

  const workspaceId = createWorkspaceId(rootPath);
  try {
    const { values = [] } = await workspaceClient.listPropertyValues({ workspaceId });
    const storedValues = Array.isArray(values) ? values : [];
    const valuesByObjectId = new Map();
    storedValues.forEach((value) => {
      if (!value || value.workspaceId !== workspaceId || typeof value.objectId !== "string") {
        return;
      }

      const objectValues = valuesByObjectId.get(value.objectId) || {};
      objectValues[value.propertyId] = value.value;
      valuesByObjectId.set(value.objectId, objectValues);
    });

    payload.folders = payload.folders.map((folder) => {
      const objectId = createFolderObjectId(workspaceId, folder.path);
      const storedProperties = valuesByObjectId.get(objectId) || {};
      const properties = {
        ...(folder.properties || {}),
        ...storedProperties,
      };

      return {
        ...folder,
        properties,
      };
    });
    payload.workspace.propertyValues = storedValues;
  } catch (error) {
    console.error(`Could not attach stored workspace properties: ${error.message}`);
  }
}

async function persistWorkspacePropertyValue(rootPath, body) {
  if (!workspaceClient || !rootPath || typeof body.path !== "string") {
    return;
  }

  const propertyId = typeof body.propertyId === "string" && body.propertyId ? body.propertyId : "";
  if (!propertyId) {
    return;
  }

  const type = typeof body.type === "string" && body.type ? body.type : "text";
  const workspaceId = createWorkspaceId(rootPath);
  const objectId = createFolderObjectId(workspaceId, body.path);

  try {
    await workspaceClient.saveProperty({
      id: createPropertyValueId(objectId, propertyId),
      workspaceId,
      objectId,
      propertyId,
      type,
      value: body.value ?? body.text ?? "",
    });
  } catch (error) {
    console.error(`Could not persist property value to sidecar: ${error.message}`);
  }
}

function createWorkspaceId(rootPath) {
  return `workspace:${createHash("sha256").update(rootPath).digest("hex").slice(0, 16)}`;
}

function normalizePayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

app.whenReady().then(async () => {
  try {
    await startWorkspaceSidecar();
  } catch (error) {
    console.error(`Workspace sidecar unavailable: ${error.message}`);
    workspaceClient = null;
    stopWorkspaceSidecar();
  }

  registerWorkspaceHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopWorkspaceSidecar();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
