import { app, BrowserWindow, ipcMain } from "electron";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    backgroundColor: "#181818",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.js"),
    },
  });

  window.loadFile(join(__dirname, "../index.html"));
}

function registerWorkspaceHandlers() {
  ipcMain.handle("workspace:getRoot", () => createRootResponse());
  ipcMain.handle("workspace:selectRoot", () => createSelectRootResponse());
  ipcMain.handle("workspace:scan", async (_event, payload = {}) => {
    const settings = await readWorkspaceSettings();
    return createScanResponse({ root: settings.rootPath, rules: payload.rules });
  });
  ipcMain.handle("workspace:listEntries", async (_event, payload = {}) => {
    const settings = await readWorkspaceSettings();
    return createListEntriesResponse({ root: settings.rootPath, body: payload });
  });
  ipcMain.handle("workspace:reveal", async (_event, payload = {}) => {
    const settings = await readWorkspaceSettings();
    return createRevealResponse({ root: settings.rootPath, body: payload });
  });
}

app.whenReady().then(() => {
  registerWorkspaceHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
