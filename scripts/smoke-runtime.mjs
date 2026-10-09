import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { packagedExecutablePath } from "./runtime-executable.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "dev";
assert.ok(mode === "dev" || mode === "release", "Expected dev or release mode");

const require = createRequire(import.meta.url);
const executablePath = mode === "dev"
  ? require("electron")
  : packagedExecutablePath(root, process.platform, process.arch);

await stat(executablePath);
const fixture = await mkdtemp(join(tmpdir(), "workspace-runtime-"));
const workspaceName = "Runtime-workspace-with-a-very-long-unbroken-name-for-layout-verification";

async function launch(dataDirectory, rootPickerPath) {
  await mkdir(dataDirectory, { recursive: true });
  console.info(`Launching Electron ${mode}`);
  const electron = await _electron.launch({
    executablePath,
    args: mode === "dev" ? [root] : [],
    cwd: root,
    env: {
      ...process.env,
      WORKSPACE_USER_DATA_DIR: dataDirectory,
      ...(rootPickerPath ? { WORKSPACE_TEST_ROOT_PICKER_PATH: rootPickerPath } : {}),
    },
    timeout: 30000,
  });
  console.info("Electron launched; waiting for the first window");
  const page = await electron.firstWindow({ timeout: 30000 });
  page.on("console", (message) => { if (message.type() === "error") console.error(`Renderer: ${message.text()}`); });
  page.on("pageerror", (error) => console.error(`Renderer error: ${error.message}`));
  const paths = await electron.evaluate(({ app }) => ({
    userData: app.getPath("userData"),
    sessionData: app.getPath("sessionData"),
  }));
  assert.deepEqual(paths, { userData: dataDirectory, sessionData: dataDirectory });
  return { electron, page };
}

async function backendPids(electron) {
  return electron.evaluate(({ app }) => app.getAppMetrics()
    .filter((metric) => metric.type === "Utility" && metric.serviceName?.includes("Node"))
    .map((metric) => metric.pid));
}

async function assertStopped(pids) {
  for (const pid of pids) {
    let running = true;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { process.kill(pid, 0); } catch (error) {
        if (error.code === "ESRCH") { running = false; break; }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(running, false, `Backend process ${pid} survived application shutdown`);
  }
}

let current;
try {
  const dataDirectory = join(fixture, "normal");
  const projectRoot = join(fixture, `SelectedProjectRoot-${"a".repeat(90)}`);
  await mkdir(projectRoot, { recursive: true });
  const canonicalProjectRoot = await realpath(projectRoot);
  current = await launch(dataDirectory, projectRoot);
  const { page } = current;
  await page.getByRole("combobox", { name: "Interface language" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.evaluate(() => typeof process), "undefined");
  assert.equal(await page.evaluate(() => typeof require), "undefined");
  assert.deepEqual(await page.evaluate(() => globalThis.window.workspace.getBackendStatus()), { state: "ready" });
  const firstPids = await backendPids(current.electron);
  console.info("Settings loaded; creating workspace through the UI");
  assert.ok(firstPids.length > 0, "No owned Node utility process is running");
  await page.getByRole("textbox").fill(workspaceName);
  await page.getByRole("button", { name: "Choose project folder" }).click();
  await page.getByText(projectRoot, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("heading", { name: workspaceName }).waitFor();
  console.info("Workspace created; checking language and layouts");
  await page.getByRole("heading", { name: "Table" }).waitFor();
  console.info("Default Table view is visible");
  await page.getByText("Project discovery will be available in a future update.").waitFor();
  console.info("Empty Table guidance is visible");
  const firstWorkspace = await page.evaluate(() => globalThis.window.workspace.workspace({ type: "workspace.load" }));
  console.info("Loaded workspace identity through the preload API");
  assert.equal(firstWorkspace.ok, true);
  assert.equal(firstWorkspace.value.activeWorkspace.name, workspaceName);
  assert.equal(firstWorkspace.value.activeWorkspace.canonicalRoot, canonicalProjectRoot);
  assert.equal(firstWorkspace.value.activeWorkspace.sourceAvailable, true);
  const persistedIdentity = {
    workspaceId: firstWorkspace.value.activeWorkspace.workspaceId,
    sourceId: firstWorkspace.value.activeWorkspace.sourceId,
    viewId: firstWorkspace.value.activeWorkspace.viewId,
  };
  await page.setViewportSize({ width: 420, height: 800 });
  assert.equal(await page.locator(".workspace-screen").evaluate((node) => node.scrollWidth <= globalThis.innerWidth), true);
  assert.equal(await page.locator("#workspace-title").evaluate((node) => node.scrollWidth <= node.parentElement.clientWidth), true);
  assert.equal(await page.locator(".workspace-root").evaluate((node) => node.scrollWidth <= node.clientWidth), true);
  console.info("Narrow layout fits the viewport");
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("ru");
  console.info("Russian language setting selected");
  await page.getByRole("combobox", { name: "Язык интерфейса" }).waitFor();
  await page.waitForFunction(() => !globalThis.document.querySelector("#interface-language")?.disabled);
  await page.getByRole("heading", { name: "Таблица" }).waitFor();
  await page.getByText("Поиск проектов появится в одном из следующих обновлений.").waitFor();
  await page.setViewportSize({ width: 1200, height: 800 });
  assert.equal(await page.locator(".workspace-screen").evaluate((node) => node.scrollWidth <= globalThis.innerWidth), true);
  assert.equal(await page.locator("#workspace-title").evaluate((node) => node.scrollWidth <= node.parentElement.clientWidth), true);
  assert.equal(await page.locator(".workspace-root").evaluate((node) => node.scrollWidth <= node.clientWidth), true);
  assert.equal(await page.locator("html").getAttribute("lang"), "ru");
  const savedSettings = await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" }));
  assert.equal(savedSettings.ok && savedSettings.value.language, "ru");
  console.info("Russian copy and wide layout verified");
  console.info("Closing the app for restart verification");
  void current.electron.evaluate(({ app }) => app.quit()).catch(() => undefined);
  await current.electron.close();
  current = undefined;
  console.info("App closed; checking backend exit");
  await assertStopped(firstPids);
  await stat(join(dataDirectory, "workspace.sqlite"));

  current = await launch(dataDirectory);
  console.info("Reopened app; checking persisted workspace and language");
  const languageSelect = current.page.locator("#interface-language");
  await languageSelect.waitFor();
  assert.equal(await languageSelect.inputValue(), "ru");
  assert.equal(await current.page.locator("html").getAttribute("lang"), "ru");
  await current.page.getByRole("heading", { name: workspaceName }).waitFor();
  await current.page.getByText(canonicalProjectRoot, { exact: true }).waitFor();
  await current.page.getByRole("heading", { name: "Таблица" }).waitFor();
  const reopenedWorkspace = await current.page.evaluate(() => globalThis.window.workspace.workspace({ type: "workspace.load" }));
  assert.equal(reopenedWorkspace.ok, true);
  assert.deepEqual({
    workspaceId: reopenedWorkspace.value.activeWorkspace.workspaceId,
    sourceId: reopenedWorkspace.value.activeWorkspace.sourceId,
    viewId: reopenedWorkspace.value.activeWorkspace.viewId,
  }, persistedIdentity);
  const secondPids = await backendPids(current.electron);
  assert.ok(secondPids.length > 0, "No owned Node utility process is running after restart");
  await current.electron.close();
  current = undefined;
  await assertStopped(secondPids);

  const failureDirectory = join(fixture, "failed-startup");
  await mkdir(join(failureDirectory, "workspace.sqlite"), { recursive: true });
  current = await launch(failureDirectory);
  await current.page.getByRole("heading", { name: "Local service unavailable" }).waitFor();
  assert.deepEqual(await current.page.evaluate(() => globalThis.window.workspace.getBackendStatus()), {
    state: "unavailable",
    message: "Workspace could not start its local service. Close and reopen the app to try again.",
  });
  await current.electron.close();
  current = undefined;
  console.info(`Electron ${mode} runtime verified: isolation, language restart, backend exit, startup failure`);
} finally {
  if (current) await current.electron.close();
  await rm(fixture, { recursive: true, force: true });
}
