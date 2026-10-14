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
  const initialURL = "data:text/html," + encodeURIComponent("<title>Initial readiness fixture</title>");
  const controlledURL = "data:text/html," + encodeURIComponent("<title>Controlled readiness fixture</title>");
  const initialLoad = window.loadURL(initialURL);
  if (env.WORKSPACE_RENAME_EDITOR_CONTROL_LOAD === "true") {
    let controlledLoad;
    // First read owns the controlled navigation: an unfixed driver reads only
    // after mounting, so it deterministically erases that editor. No timer.
    Object.defineProperty(globalThis, "renameEditorInitialLoad", { get() {
      controlledLoad ??= initialLoad.then(() => window.loadURL(controlledURL)).then(() => controlledURL);
      return controlledLoad;
    } });
  } else globalThis.renameEditorInitialLoad = initialLoad.then(() => initialURL);
});
app.on("window-all-closed", () => app.quit());
