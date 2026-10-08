import { app, BrowserWindow, ipcMain, MessageChannelMain, utilityProcess } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BackendController } from "./backend-controller.js";

const controller = new BackendController((status) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("workspace:backend-status", status);
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

let quitInProgress = false;
app.on("before-quit", (event) => {
  if (quitInProgress) return;
  event.preventDefault();
  quitInProgress = true;
  void controller.stop().finally(() => app.quit());
});
app.on("window-all-closed", () => app.quit());

void app.whenReady().then(async () => {
  const appDataDirectory = app.isPackaged
    ? app.getPath("userData")
    : join(app.getPath("userData"), "development");
  const backendPath = join(__dirname, "../service/entry.cjs");
  const child = utilityProcess.fork(backendPath, [], { cwd: app.getAppPath(), stdio: "ignore" });
  const { port1, port2 } = new MessageChannelMain();
  await controller.start(
    child,
    port1,
    join(appDataDirectory, "workspace.sqlite"),
    port2,
  );
  await createWindow();
});
