import { projectDirectoryHelperPath } from "../src/workspaceProjectCreate.js";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDevelopmentRuntime } from "./developmentRuntime.js";
import { registerWorkspaceIpc } from "./workspaceIpc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const development = getDevelopmentRuntime({ checkout: join(__dirname, "..") });
if (development) app.setPath("userData", development.userData);

app.setName("Workspace");
registerWorkspaceIpc(ipcMain, {
  ...development?.storage,
  projectDirectoryHelperPath: projectDirectoryHelperPath({ packaged: app.isPackaged, resourcesPath: process.resourcesPath }),
  async chooseRoot() {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Choose workspace source folder",
    });
    return result.canceled ? "" : result.filePaths[0] || "";
  },
});

let mainWindow = null;

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.setZoomFactor(1);
  mainWindow.show();
  mainWindow.focus();
}

async function waitForRendererContent(window) {
  try {
    await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const root = document.getElementById("root");

        if (!root || root.childElementCount > 0) {
          resolve(true);
          return;
        }

        const observer = new MutationObserver(() => {
          if (root.childElementCount > 0) {
            observer.disconnect();
            resolve(true);
          }
        });

        observer.observe(root, { childList: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, 3000);
      });
    `);
  } catch (error) {
    console.error(`Renderer readiness check failed: ${error.message}`);
  }
}

async function lockRendererZoom(window) {
  try {
    await window.webContents.setVisualZoomLevelLimits(1, 1);
    window.webContents.setZoomFactor(1);
  } catch (error) {
    console.error(`Renderer zoom lock failed: ${error.message}`);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: "Workspace",
    titleBarStyle: "hiddenInset",
    ...(process.platform === "darwin" ? { trafficLightPosition: { x: 18, y: 18 } } : {}),
    backgroundColor: "#151515",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("closed", () => {
    mainWindow = null;
  });

  if (development?.rendererUrl) {
    await mainWindow.loadURL(development.rendererUrl);
  } else {
    await mainWindow.loadFile(join(__dirname, "../dist/renderer/index.html"));
  }
  await lockRendererZoom(mainWindow);
  await waitForRendererContent(mainWindow);
  showMainWindow();
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (mainWindow === null) {
      await createWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
