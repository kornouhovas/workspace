import { app, BrowserWindow } from "electron";
import { join } from "node:path";

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

  await window.loadFile(join(__dirname, "../renderer/index.html"));
}

void app.whenReady().then(createWindow);
