import { app, BrowserWindow, ipcMain } from "electron";
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
    backgroundColor: "#181818",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  window.loadFile(join(__dirname, "../index.html"));
}

async function startWorkspaceSidecar() {
  const repoRoot = join(__dirname, "..");
  const sidecarPath = join(repoRoot, "workspace-sidecar");
  sidecarProcess = spawn(sidecarPath, ["-db", join(app.getPath("userData"), "workspace.db")], {
    cwd: repoRoot,
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
    const response = await createSelectRootResponse();
    if (response.status < 400) {
      const settings = await readWorkspaceSettings();
      await persistWorkspaceRoot(settings.rootPath);
    }
    return response;
  });
  ipcMain.handle("workspace:scan", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const rootPath = await readSelectedWorkspaceRootPath();
    return createScanResponse({ root: rootPath, rules: body.rules });
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
      body: {
        path: body.path,
        text: body.value ?? body.text,
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

  const settings = await readWorkspaceSettings();
  if (settings.rootPath) {
    await persistWorkspaceRoot(settings.rootPath);
  }
  return settings.rootPath;
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

async function persistWorkspacePropertyValue(rootPath, body) {
  if (!workspaceClient || !rootPath || typeof body.path !== "string") {
    return;
  }

  const propertyId = typeof body.propertyId === "string" && body.propertyId ? body.propertyId : "property:text";
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
