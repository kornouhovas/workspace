import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

app.setName("Workspace");

let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: "Workspace",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#171717",
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.setZoomFactor(1);
    mainWindow?.focus();
  });
  await mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  mainWindow.show();
  mainWindow.focus();
  await mainWindow.loadFile(join(__dirname, "../dist/renderer/index.html"));
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (mainWindow === null) {
      await createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
