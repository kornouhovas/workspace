import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("workspace runs as an Electron-only app shell", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const tsconfig = JSON.parse(await readFile(new URL("../tsconfig.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const electronMain = await readFile(new URL("../electron/main.js", import.meta.url), "utf8");
  const preload = await readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8");

  assert.equal(packageJson.name, "workspace");
  assert.equal(packageJson.main, "electron/main.js");
  assert.equal(packageJson.scripts.dev, undefined);
  assert.equal(packageJson.scripts.preview, undefined);
  assert.equal(packageJson.scripts.electron, "electron electron/main.js");
  assert.equal(packageJson.scripts["electron:build"], "npm run build:renderer && electron electron/main.js");
  assert.equal(packageJson.scripts["build:renderer"], "vite build");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.devDependencies?.typescript, "5.9.3");
  assert.deepEqual(tsconfig.compilerOptions.paths, { "@/*": ["./src/*"] });
  assert.deepEqual(tsconfig.compilerOptions.types, ["react", "react-dom"]);
  assert.deepEqual(tsconfig.include, [
    "src/main.tsx",
    "src/vite-env.d.ts",
    "src/components/workspace/**/*.ts",
    "src/components/workspace/**/*.tsx",
    "src/types/**/*.d.ts",
  ]);
  assert.equal(packageJson.scripts["build:sidecar"], "go build -o workspace-sidecar ./cmd/workspace-sidecar");
  assert.equal(packageJson.scripts["build:sidecar:mac"].includes("GOOS=darwin GOARCH=arm64"), true);
  assert.equal(packageJson.scripts["build:sidecar:win"].includes("GOOS=windows GOARCH=amd64"), true);
  assert.equal(packageJson.scripts["prepare:electron:mac"], undefined);
  assert.equal(packageJson.scripts["dist:mac"], undefined);
  assert.equal(packageJson.scripts["dist:win"], undefined);
  assert.equal(packageJson.scripts["dist:all"], undefined);
  assert.equal(packageJson.devDependencies?.electron.startsWith("^"), true);
  assert.equal(packageJson.devDependencies?.["electron-builder"], undefined);
  assert.equal(packageJson.devDependencies?.vite.startsWith("^"), true);
  assert.equal(packageJson.devDependencies?.["@vitejs/plugin-react"].startsWith("^"), true);
  assert.equal(packageJson.dependencies?.react.startsWith("^"), true);
  assert.equal(packageJson.dependencies?.["react-dom"].startsWith("^"), true);
  assert.equal(packageJson.dependencies?.shadcn.startsWith("^"), true);
  assert.equal(packageJson.build, undefined);
  assert.match(readme, /npm run electron/);
  assert.doesNotMatch(readme, /npm run dev/);
  assert.match(readme, /Workspace Project Board/);
  assert.match(readme, /npm run build:renderer/);
  assert.match(electronMain, /import\s+\{\s*app,\s*BrowserWindow,\s*dialog,\s*ipcMain\s*\}\s+from\s+"electron"/);
  assert.match(electronMain, /registerWorkspaceIpc\(ipcMain,\s*\{/);
  assert.match(electronMain, /dialog\.showOpenDialog/);
  assert.match(electronMain, /let\s+mainWindow\s*=\s*null/);
  assert.match(electronMain, /new BrowserWindow\(/);
  assert.match(electronMain, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(electronMain, /show:\s*false/);
  assert.match(electronMain, /contextIsolation:\s*true/);
  assert.match(electronMain, /nodeIntegration:\s*false/);
  assert.match(electronMain, /sandbox:\s*true/);
  assert.match(electronMain, /preload:\s*join\(__dirname,\s*"preload\.cjs"\)/);
  assert.match(electronMain, /mainWindow\.once\("closed"/);
  assert.match(electronMain, /function\s+showMainWindow\(\)/);
  assert.match(electronMain, /mainWindow\.show\(\)/);
  assert.match(electronMain, /mainWindow\.focus\(\)/);
  assert.match(electronMain, /mainWindow\.webContents\.setZoomFactor\(1\)/);
  assert.match(electronMain, /function\s+waitForRendererContent\(window\)/);
  assert.match(electronMain, /root\.childElementCount\s*>\s*0/);
  assert.match(electronMain, /function\s+lockRendererZoom\(window\)/);
  assert.match(electronMain, /setVisualZoomLevelLimits\(1,\s*1\)/);
  assert.doesNotMatch(electronMain, /ready-to-show/);
  assert.match(electronMain, /mainWindow\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
  assert.doesNotMatch(electronMain, /loadURL/);
  assert.match(preload, /contextBridge/);
  assert.match(preload, /ipcRenderer/);
  assert.match(preload, /require\("electron"\)/);
  assert.match(preload, /exposeInMainWorld\("workspace"/);
  assert.match(preload, /workspace:request/);
  await access(new URL("../electron/workspaceIpc.js", import.meta.url));
  await access(new URL("../electron/preload.cjs", import.meta.url));
  await access(new URL("../electron/main.js", import.meta.url));
  await access(new URL("../index.html", import.meta.url));
  await access(new URL("../components.json", import.meta.url));
  await access(new URL("../vite.config.ts", import.meta.url));
  await access(new URL("../src/App.tsx", import.meta.url));
  await access(new URL("../src/components/workspace/left-panel.tsx", import.meta.url));
  await access(new URL("../src/components/workspace/states.tsx", import.meta.url));
  await access(new URL("../src/workspaceSidecarClient.js", import.meta.url));
  await assert.rejects(access(new URL("../src/renderer/App.tsx", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../electron/preload.js", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../referens/index.html", import.meta.url)), { code: "ENOENT" });
});

test("legacy browser dev server is not shipped", async () => {
  await assert.rejects(access(new URL("../dev-server.js", import.meta.url)), { code: "ENOENT" });
});
