import { app, BrowserWindow, dialog, ipcMain, MessageChannelMain, utilityProcess } from "electron";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { BackendController } from "./backend-controller.js";
import { createRootPicker } from "./root-picker.js";

const appDataDirectory = process.env.WORKSPACE_USER_DATA_DIR ??
  (app.isPackaged ? app.getPath("userData") : join(app.getPath("userData"), "development"));
mkdirSync(appDataDirectory, { recursive: true });
app.setPath("userData", appDataDirectory);
app.setPath("sessionData", appDataDirectory);

const controller = new BackendController((status) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("workspace:backend-status", status);
  }
});

controller.onWorkspaceChange((change) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("workspace:change", change);
    }
  }
});

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const rendererUrl = pathToFileURL(join(__dirname, "../renderer/index.html")).href;
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
  await window.loadFile(join(__dirname, "../renderer/index.html"));
}

ipcMain.handle("workspace:backend-status", () => controller.currentStatus);
ipcMain.handle("workspace:settings", (_event, input: unknown) => controller.request(input));
ipcMain.handle("workspace:command", (_event, input: unknown) => controller.request(input));
ipcMain.handle("workspace:pick-root", () => createRootPicker(
  dialog,
  process.env.WORKSPACE_TEST_ROOT_PICKER_PATH,
)());

let quitInProgress = false;
app.on("before-quit", (event) => {
  if (quitInProgress) return;
  event.preventDefault();
  quitInProgress = true;
  void controller.stop().finally(() => app.quit());
});
app.on("window-all-closed", () => app.quit());

void app.whenReady().then(async () => {
  const backendPath = join(__dirname, "../service/entry.cjs");
  const workingDirectory = app.isPackaged ? dirname(app.getAppPath()) : app.getAppPath();
  try {
    const child = utilityProcess.fork(backendPath, [], { cwd: workingDirectory, stdio: "ignore" });
    const { port1, port2 } = new MessageChannelMain();
    await controller.start(
      child,
      port1,
      join(appDataDirectory, "workspace.sqlite"),
      port2,
    );
  } catch {
    controller.markStartupFailure();
  }
  await createWindow();
});
