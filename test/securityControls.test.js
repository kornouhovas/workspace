import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const mainUrl = new URL("../electron/main.js", import.meta.url);
const preloadUrl = new URL("../electron/preload.cjs", import.meta.url);
const ipcUrl = new URL("../electron/workspaceIpc.js", import.meta.url);
const localOpenUrl = new URL("../src/localOpen.js", import.meta.url);
const backendUrl = new URL("../src/workspaceBackend.js", import.meta.url);
const propertyStoreUrl = new URL("../src/workspacePropertyStore.js", import.meta.url);

function extractMethodSet(source, name) {
  const body = source.match(
    new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`),
  )?.[1];
  assert.ok(body, `${name} must be declared as an explicit Set`);
  return [...body.matchAll(/"(workspace\.[^"]+)"/g)].map((match) => match[1]);
}

function extractStringSet(source, name) {
  const body = source.match(
    new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`),
  )?.[1];
  assert.ok(body, `${name} must be declared as an explicit Set`);
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
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
  assert.match(main, /if \(development\?\.rendererUrl\)/);
  assert.match(main, /loadURL\(development.rendererUrl\)/);
  const dev = await readFile(new URL("../electron/developmentRuntime.js", import.meta.url), "utf8");
  assert.match(dev, /env.WORKSPACE_DEV !== "1"/);
  assert.match(dev, /url.hostname !== "127.0.0.1"/);
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

test("filesystem boundary canonicalizes existing targets and opens them without a shell", async () => {
  const source = await readFile(localOpenUrl, "utf8");

  assert.match(source, /isAbsolute\(relativePath\)/);
  assert.match(source, /relative\(resolvedRoot,\s*targetPath\)/);
  assert.match(source, /realpathSync\(root\)/);
  assert.match(source, /realpathSync\(targetPath\)/);
  assert.match(source, /spawn\(command,\s*args,\s*\{\s*stdio:\s*"ignore"\s*\}\)/);
  assert.doesNotMatch(source, /shell:\s*true/);
});

test("preview allowlist excludes native executable and package extensions", async () => {
  const source = await readFile(localOpenUrl, "utf8");
  const extensions = extractStringSet(source, "previewExtensions");

  assert.ok(extensions.length > 0);
  assert.equal(new Set(extensions).size, extensions.length);
  for (const extension of ["app", "bat", "command", "dmg", "exe", "pkg", "ps1", "sh"]) {
    assert.equal(extensions.includes(extension), false, `.${extension} must not be previewable`);
  }
});

test("transitional JSON stores use same-directory atomic replacement and only remove temp files", async () => {
  const [backend, propertyStore, ipc] = await Promise.all([
    readFile(backendUrl, "utf8"),
    readFile(propertyStoreUrl, "utf8"),
    readFile(ipcUrl, "utf8"),
  ]);

  for (const source of [backend, propertyStore, ipc]) {
    assert.match(source, /const tempPath = join\(directory, `\.\$\{basename\(filePath\)\}\.\$\{randomUUID\(\)\}\.tmp`\)/);
    assert.match(source, /await writeFile\(tempPath,/);
    assert.match(source, /await rename\(tempPath,\s*filePath\)/);
    assert.match(source, /await rm\(tempPath,\s*\{ force:\s*true \}\)\.catch/);
    assert.doesNotMatch(source, /rm\((?!tempPath)/);
  }
});
