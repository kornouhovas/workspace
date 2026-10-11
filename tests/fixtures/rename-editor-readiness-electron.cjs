const { app, BrowserWindow } = require("electron");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { env } = require("node:process");
const profile = env.WORKSPACE_RENAME_EDITOR_PROFILE;
if (!profile) throw new Error("Disposable profile is required");
for (const name of ["userData", "sessionData"]) {
  const directory = join(profile, name);
  mkdirSync(directory);
  app.setPath(name, directory);
}
app.whenReady().then(() => {
  const window = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.loadURL("about:blank");
});
app.on("window-all-closed", () => app.quit());
