import { app, BrowserWindow, dialog, shell, ipcMain, MessageChannelMain, utilityProcess } from "electron";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { BackendController } from "./backend-controller.js";
import { createNativeProjectReveal } from "./project-reveal.js";
import { resolveWindowsPowerShell, runWindowsProjectReveal } from "./windows-project-reveal.js";
import { isProjectRevealRequest } from "../contracts/project-reveal.js";
import { createRootPicker } from "./root-picker.js";

const appDataDirectory = process.env.WORKSPACE_USER_DATA_DIR ??
  (app.isPackaged ? app.getPath("userData") : join(app.getPath("userData"), "development"));
mkdirSync(appDataDirectory, { recursive: true });
app.setPath("userData", appDataDirectory);
app.setPath("sessionData", appDataDirectory);

// Resolve only from modules already loaded by our main process, never PATH or
// inherited SystemRoot. Missing runtime support gives useful unavailable feedback.
const windowsProgram = process.platform === "win32" ? resolveWindowsPowerShell() : undefined;
const nativeDirectory = app.isPackaged ? join(process.resourcesPath, "native") : join(__dirname, "native");
const controller = new BackendController((status) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("workspace:backend-status", status);
  }
}, createNativeProjectReveal((path, context) => process.platform === "win32"
  ? runWindowsProjectReveal(path, context, { program: windowsProgram, nativeDirectory })
  : shell.showItemInFolder(path)));

controller.onWorkspaceChange((change) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("workspace:change", change);
    }
  }
});

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1024,
    height: 720,
    useContentSize: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Minimum dimensions describe usable renderer content, accounting for OS chrome.
  const [outerWidth, outerHeight] = window.getSize();
  const [contentWidth, contentHeight] = window.getContentSize();
  window.setMinimumSize(1024 + outerWidth - contentWidth, 720 + outerHeight - contentHeight);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const rendererUrl = pathToFileURL(join(__dirname, "../renderer/index.html")).href;
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
  await window.loadFile(join(__dirname, "../renderer/index.html"));
}

ipcMain.handle("workspace:backend-status", () => controller.currentStatus);
const request = (input: unknown) => controller.request(input,
  process.platform === "win32" && isProjectRevealRequest(input) ? 17000 : 10000);
ipcMain.handle("workspace:settings", (_event, input: unknown) => request(input));
ipcMain.handle("workspace:command", (_event, input: unknown) => request(input));
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
  } catch (error) {
    controller.markStartupFailure(error);
  }
  await createWindow();
});
