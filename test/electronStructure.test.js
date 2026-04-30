import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("electron main process uses an isolated preload shell with workspace IPC handlers", async () => {
  const mainSource = await readFile(new URL("../electron/main.js", import.meta.url), "utf8");

  assert.match(mainSource, /new BrowserWindow\(/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /preload:\s*join\(__dirname,\s*"preload\.js"\)/);
  assert.match(mainSource, /ipcMain\.handle\("workspace:getRoot"/);
});

test("electron preload exposes only the narrow workspace API", async () => {
  const preloadSource = await readFile(new URL("../electron/preload.js", import.meta.url), "utf8");

  assert.match(preloadSource, /contextBridge\.exposeInMainWorld\("workspace"/);
  assert.match(preloadSource, /getRoot:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("workspace:getRoot"\)/);
  assert.match(preloadSource, /scan:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("workspace:scan",\s*payload\)/);
  assert.doesNotMatch(preloadSource, /require\("fs"\)/);
});
