import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("electron main process uses an isolated preload shell with workspace IPC handlers", async () => {
  const mainSource = await readFile(new URL("../electron/main.js", import.meta.url), "utf8");

  assert.match(mainSource, /new BrowserWindow\(/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /preload:\s*join\(__dirname,\s*"preload\.cjs"\)/);
  assert.match(mainSource, /import\s+\{\s*spawn\s*\}\s+from\s+"node:child_process"/);
  assert.match(mainSource, /import\s+\{\s*once\s*\}\s+from\s+"node:events"/);
  assert.match(mainSource, /import\s+\{\s*WorkspaceServiceClient\s*\}\s+from\s+"..\/src\/workspaceServiceClient\.js"/);
  assert.match(mainSource, /import\s+\{\s*createSidecarHttpTransport\s*\}\s+from\s+"\.\/sidecarClient\.js"/);
  assert.match(mainSource, /let\s+workspaceClient\s*=\s*null/);
  assert.match(mainSource, /let\s+sidecarProcess\s*=\s*null/);
  assert.match(mainSource, /async\s+function\s+startWorkspaceSidecar\(\)/);
  assert.match(mainSource, /spawn\(sidecarPath,\s*\["-db",\s*join\(app\.getPath\("userData"\),\s*"workspace\.db"\)\]/);
  assert.match(mainSource, /childProcess\.stderr\.on\("data",\s*handleData\)/);
  assert.match(mainSource, /chunks\.join\(""\)\.match\(/);
  assert.match(mainSource, /new\s+WorkspaceServiceClient\(createSidecarHttpTransport\(`http:\/\/\$\{address\}`\)\)/);
  assert.match(mainSource, /ipcMain\.handle\("workspace:getRoot"/);
  assert.match(mainSource, /await\s+workspaceClient\.getRoot\(\)/);
  assert.match(mainSource, /function normalizePayload\(payload\)/);
  assert.match(mainSource, /app\.whenReady\(\)\.then\(async\s*\(\)\s*=>\s*\{/);
  assert.match(mainSource, /await\s+startWorkspaceSidecar\(\)/);
  assert.match(mainSource, /Workspace sidecar unavailable:/);
  assert.match(mainSource, /workspaceClient\s*=\s*null/);
});

test("electron preload exposes only the narrow workspace API", async () => {
  const preloadSource = await readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8");

  assert.match(preloadSource, /require\("electron"\)/);
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld\("workspace"/);
  assert.match(preloadSource, /getRoot:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("workspace:getRoot"\)/);
  assert.match(preloadSource, /selectRoot:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("workspace:selectRoot"\)/);
  assert.match(preloadSource, /scan:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("workspace:scan",\s*payload\)/);
  assert.match(preloadSource, /listEntries:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("workspace:listEntries",\s*payload\)/);
  assert.match(preloadSource, /reveal:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("workspace:reveal",\s*payload\)/);
  assert.doesNotMatch(preloadSource, /require\("fs"\)/);
  assert.doesNotMatch(preloadSource, /from\s+["']electron["']/);
  assert.doesNotMatch(preloadSource, /from\s+["']node:fs["']/);
});
