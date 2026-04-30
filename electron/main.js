import { app, BrowserWindow, ipcMain } from "electron";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createListEntriesResponse,
  createRootResponse,
  createScanResponse,
  createSelectRootResponse,
  readWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { createRevealResponse } from "../src/localOpen.js";
import { WorkspaceServiceClient } from "../src/workspaceServiceClient.js";
import { createSidecarHttpTransport } from "./sidecarClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let workspaceClient = null;
let sidecarProcess = null;

function createWindow() {
  const window = new BrowserWindow({
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

async function waitForSidecarAddress(childProcess) {
  return Promise.race([
    readSidecarAddress(childProcess),
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
      const match = text.match(/listening on (127\.0\.0\.1:\d+)/);
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
    if (!workspaceClient) {
      return createRootResponse();
    }

    const root = await workspaceClient.getRoot();
    return { status: 200, payload: { root: root.rootPath ? { name: root.name } : null } };
  });
  ipcMain.handle("workspace:selectRoot", () => createSelectRootResponse());
  ipcMain.handle("workspace:scan", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const settings = await readWorkspaceSettings();
    return createScanResponse({ root: settings.rootPath, rules: body.rules });
  });
  ipcMain.handle("workspace:listEntries", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const settings = await readWorkspaceSettings();
    return createListEntriesResponse({ root: settings.rootPath, body });
  });
  ipcMain.handle("workspace:reveal", async (_event, payload = {}) => {
    const body = normalizePayload(payload);
    const settings = await readWorkspaceSettings();
    return createRevealResponse({ root: settings.rootPath, body });
  });
}

function normalizePayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

app.whenReady().then(async () => {
  await startWorkspaceSidecar();
  registerWorkspaceHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (sidecarProcess) {
    sidecarProcess.kill();
    sidecarProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
