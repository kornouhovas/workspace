import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const mainUrl = new URL("../electron/main.js", import.meta.url);
const preloadUrl = new URL("../electron/preload.cjs", import.meta.url);
const ipcUrl = new URL("../electron/workspaceIpc.js", import.meta.url);

function extractMethodSet(source, name) {
  const body = source.match(
    new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`),
  )?.[1];
  assert.ok(body, `${name} must be declared as an explicit Set`);
  return [...body.matchAll(/"(workspace\.[^"]+)"/g)].map((match) => match[1]);
}

test("Electron window keeps the renderer isolated from Node privileges", async () => {
  const main = await readFile(mainUrl, "utf8");

  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.doesNotMatch(main, /webSecurity:\s*false/);
  assert.doesNotMatch(main, /allowRunningInsecureContent:\s*true/);
  assert.doesNotMatch(main, /webviewTag:\s*true/);
  assert.match(main, /loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
  assert.doesNotMatch(main, /loadURL\(/);
});

test("preload exposes only the allowlisted workspace request facade", async () => {
  const source = await readFile(preloadUrl, "utf8");
  const exposed = [];
  const invoked = [];
  const sandbox = {
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: {
          exposeInMainWorld(name, api) {
            exposed.push({ name, api });
          },
        },
        ipcRenderer: {
          invoke(...args) {
            invoked.push(args);
            return Promise.resolve({ ok: true });
          },
        },
      };
    },
    Set,
    Error,
    Promise,
  };

  vm.runInNewContext(source, sandbox, { filename: "electron/preload.cjs" });

  assert.equal(exposed.length, 1);
  assert.equal(exposed[0].name, "workspace");
  assert.deepEqual(Object.keys(exposed[0].api), ["request"]);
  await assert.rejects(
    exposed[0].api.request("workspace.notAllowed", {}),
    /Unsupported workspace method/,
  );
  assert.deepEqual(invoked, []);

  await exposed[0].api.request("workspace.getRoot", null);
  assert.equal(invoked.length, 1);
  assert.equal(invoked[0][0], "workspace:request");
  assert.equal(invoked[0][1], "workspace.getRoot");
  assert.equal(Object.keys(invoked[0][2]).length, 0);
});

test("preload and main process enforce the same explicit IPC method allowlist", async () => {
  const [preload, ipc] = await Promise.all([
    readFile(preloadUrl, "utf8"),
    readFile(ipcUrl, "utf8"),
  ]);
  const preloadMethods = extractMethodSet(preload, "allowedMethods");
  const mainMethods = extractMethodSet(ipc, "supportedMethods");

  assert.ok(preloadMethods.length > 0);
  assert.equal(new Set(preloadMethods).size, preloadMethods.length);
  assert.equal(new Set(mainMethods).size, mainMethods.length);
  assert.deepEqual(preloadMethods, mainMethods);
  assert.match(ipc, /ipcMain\.handle\(ipcChannel,\s*createWorkspaceIpcHandler\(options\)\)/);
});
