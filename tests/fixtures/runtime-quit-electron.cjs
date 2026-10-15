const { app, BrowserWindow } = require("electron");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const profile = process.env.WORKSPACE_QUIT_CONTROL_PROFILE;
if (!profile) throw new Error("Disposable profile is required");
for (const name of ["userData", "sessionData"]) {
  mkdirSync(join(profile, name)); app.setPath(name, join(profile, name));
}
let quitting = false, cleanupComplete = false;
// Match the application's deferred backend-stop boundary: a second concurrent
// quit would bypass the first prevented event while cleanup is still pending.
app.on("before-quit", event => {
  if (quitting) return;
  event.preventDefault(); quitting = true;
  setTimeout(() => { cleanupComplete = true; app.quit(); }, 1000);
});
app.on("quit", () => process.stdout.write("WORKSPACE_QUIT_CONTROL " + JSON.stringify({ cleanupComplete }) + "\n"));
app.whenReady().then(() => {
  const window = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  return window.loadURL("data:text/html,<title>Quit control</title>");
});
