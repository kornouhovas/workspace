import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { packagedExecutablePath } from "./runtime-executable.mjs";
import { closeElectron, withDeadline } from "./runtime-lifecycle.mjs";

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
  try {
    console.info("Electron launched; waiting for the first window");
    const page = await electron.firstWindow({ timeout: 30000 });
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    page.on("console", (message) => { if (message.type() === "error") console.error(`Renderer: ${message.text()}`); });
    page.on("pageerror", (error) => console.error(`Renderer error: ${error.message}`));
    const paths = await withDeadline(electron.evaluate(({ app }) => ({
      userData: app.getPath("userData"),
      sessionData: app.getPath("sessionData"),
    })), 10000, "Electron data paths");
    assert.deepEqual(paths, { userData: dataDirectory, sessionData: dataDirectory });
    return { electron, page };
  } catch (error) {
    try { await closeElectron(electron); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Electron launch and cleanup failed"); }
    throw error;
  }
}

async function backendPids(electron) {
  return withDeadline(electron.evaluate(({ app }) => app.getAppMetrics()
    .filter((metric) => metric.type === "Utility" && metric.serviceName?.includes("Node"))
    .map((metric) => metric.pid)), 10000, "Electron backend metrics");
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

const evidenceDirectory = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR;
if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });
const observations = [];

async function load(page) {
  const result = await page.evaluate(() => globalThis.window.workspace.workspace({ type: "workspace.load" }));
  assert.equal(result.ok, true);
  return result.value;
}

const identity = ({ workspaceId, sourceId, viewId }) => ({ workspaceId, sourceId, viewId });

async function create(current, name, rootPath, language = "en") {
  await current.electron.evaluate((_electron, path) => {
    process.env.WORKSPACE_TEST_ROOT_PICKER_PATH = path;
  }, rootPath);
  const { page } = current;
  if (await page.locator("#workspace-title").count()) {
    await page.getByRole("button", { name: language === "en" ? "Create another workspace" : "Создать ещё одно рабочее пространство", exact: true }).click();
  }
  await page.getByRole("textbox").fill(name);
  await page.getByRole("button", { name: language === "en" ? "Choose project folder" : "Выбрать папку проекта", exact: true }).click();
  await page.getByText(rootPath, { exact: true }).waitFor();
  await page.getByRole("button", { name: language === "en" ? "Create workspace" : "Создать рабочее пространство", exact: true }).click();
  await page.getByRole("heading", { name: name.trim(), exact: true }).waitFor();
  return (await load(page)).activeWorkspace;
}

async function select(page, workspace) {
  await page.locator("#workspace-switcher").selectOption(workspace.workspaceId);
  await page.getByRole("heading", { name: workspace.name.trim(), exact: true }).waitFor();
  await page.waitForFunction(() => !globalThis.document.querySelector("#workspace-switcher")?.disabled);
}

async function remove(page, workspace) {
  await page.getByRole("button", { name: `Удалить рабочее пространство: ${workspace.name.trim()}`, exact: true }).click();
  await page.getByText("Будут удалены только конфигурация этого рабочего пространства и её представления. Файлы проектов и метаданные источника сохранятся, даже если это последнее рабочее пространство для папки.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Удалить конфигурацию", exact: true }).press("Enter");
  await page.locator(".workspace-removal").waitFor({ state: "detached" });
  await page.waitForFunction(() => !globalThis.document.querySelector("#workspace-switcher")?.disabled);
  return load(page);
}

async function captureLayouts(page, language, name) {
  await page.locator("#interface-language").selectOption(language);
  await page.waitForFunction((lang) => globalThis.document.documentElement.lang === lang &&
    !globalThis.document.querySelector("#interface-language")?.disabled, language);
  const removeLabel = language === "en" ? "Remove workspace" : "Удалить рабочее пространство";
  for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
    await page.setViewportSize(size);
    for (const state of ["management", "confirmation"]) {
      if (state === "confirmation") {
        await page.getByRole("button", { name: `${removeLabel}: ${name.trim()}`, exact: true }).click();
      }
      const overflow = await page.evaluate(() => ({
        document: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        elements: Array.from(globalThis.document.querySelectorAll(".workspace-screen, #workspace-title, .workspace-root, .workspace-management__row, .workspace-removal"))
          .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className || node.id),
      }));
      assert.deepEqual(overflow, { document: false, elements: [] }, `${language} ${state} ${size.width} overflow`);
      if (evidenceDirectory) await page.screenshot({ path: join(evidenceDirectory, `${mode}-${language}-${size.width}-${state}.png`), fullPage: true });
      if (state === "confirmation") await page.locator(".workspace-removal").press("Escape");
    }
  }
}

let current;
try {
  const dataDirectory = join(fixture, "normal");
  const projectRoot = join(fixture, `SelectedProjectRoot-${"a".repeat(90)}`);
  const otherRoot = join(fixture, "OtherProjectRoot");
  const sentinel = Buffer.from("Retained project bytes\0through workspace removal\n");
  for (const path of [projectRoot, otherRoot]) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "sentinel.txt"), sentinel);
  }
  const canonicalProjectRoot = await realpath(projectRoot);
  const canonicalOtherRoot = await realpath(otherRoot);
  current = await launch(dataDirectory, projectRoot);
  let { page } = current;
  await page.getByRole("combobox", { name: "Interface language" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.evaluate(() => typeof process), "undefined");
  assert.equal(await page.evaluate(() => typeof require), "undefined");
  assert.deepEqual(await current.electron.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { contextIsolation: preferences.contextIsolation, nodeIntegration: preferences.nodeIntegration, sandbox: preferences.sandbox };
  }), { contextIsolation: true, nodeIntegration: false, sandbox: true });
  assert.deepEqual(await page.evaluate(() => globalThis.window.workspace.getBackendStatus()), { state: "ready" });
  assert.ok((await backendPids(current.electron)).length > 0, "No owned Node utility process is running");

  const first = await create(current, workspaceName, projectRoot);
  const sibling = await create(current, "Sibling configuration", projectRoot);
  const other = await create(current, "Different root", otherRoot);
  assert.equal(first.canonicalRoot, canonicalProjectRoot);
  assert.equal(sibling.sourceId, first.sourceId);
  assert.notEqual(sibling.workspaceId, first.workspaceId);
  assert.notEqual(sibling.viewId, first.viewId);
  assert.notEqual(other.sourceId, first.sourceId);
  assert.equal(other.canonicalRoot, canonicalOtherRoot);
  assert.equal(new Set([first, sibling, other].map((item) => item.viewId)).size, 3);
  assert.ok([first, sibling, other].every((item) => item.sourceAvailable));
  await page.getByText("Project discovery will be available in a future update.", { exact: false }).waitFor();
  await select(page, first);
  const authoredName = `  Renamed-${workspaceName}  `;
  await page.getByRole("button", { name: "Rename workspace", exact: true }).click();
  await page.getByRole("textbox").fill(authoredName);
  await page.getByRole("textbox").press("Enter");
  await page.getByRole("heading", { name: authoredName.trim(), exact: true }).waitFor();
  first.name = authoredName;
  assert.equal((await load(page)).activeWorkspace.name, authoredName);
  for (let index = 0; index < 2; index++) {
    await page.getByRole("button", { name: `Move up: ${other.name}`, exact: true }).press("Enter");
    await page.waitForFunction(() => globalThis.document.querySelector(".workspace-management")?.getAttribute("aria-busy") === "false");
  }
  const orderedIds = [other, first, sibling].map((item) => item.workspaceId);
  assert.deepEqual((await load(page)).workspaces.map((item) => item.workspaceId), orderedIds);
  assert.deepEqual(identity((await load(page)).activeWorkspace), identity(first));
  await captureLayouts(page, "en", authoredName);
  await captureLayouts(page, "ru", authoredName);
  await page.getByRole("heading", { name: "Таблица", exact: true }).waitFor();
  const savedSettings = await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" }));
  assert.equal(savedSettings.ok && savedSettings.value.language, "ru");

  // Observe the real utilityProcess -> main -> preload route. App's client
  // independently subscribes and must update the visible source state.
  await page.evaluate(() => {
    globalThis.smokeChanges = [];
    globalThis.stopSmokeChanges = globalThis.window.workspace.onWorkspaceChange((change) => globalThis.smokeChanges.push(change));
  });
  const disconnectedRoot = join(fixture, "temporarily-disconnected");
  await rename(projectRoot, disconnectedRoot);
  await select(page, sibling);
  await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).waitFor();
  await page.waitForFunction(() => globalThis.smokeChanges.some((event) => event.type === "workspace.sourceChanged"));
  const unavailable = await page.evaluate(() => globalThis.smokeChanges.filter((event) => event.type === "workspace.sourceChanged"));
  assert.equal(unavailable.length, 1);
  assert.deepEqual(unavailable[0].source, {
    sourceId: first.sourceId, workspaceIds: [first.workspaceId, sibling.workspaceId],
    canonicalRoot: canonicalProjectRoot, sourceAvailable: false,
  });
  await select(page, other);
  assert.equal(await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).count(), 0);
  assert.equal((await load(page)).activeWorkspace.sourceAvailable, true);
  await select(page, first);
  await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).waitFor();
  await rename(disconnectedRoot, projectRoot);
  await page.getByRole("button", { name: "Проверить доступ к папке", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).waitFor({ state: "detached" });
  await page.waitForFunction(() => globalThis.smokeChanges.some((event) => event.type === "workspace.sourceChanged" && event.source.sourceAvailable));
  const sourceChanges = await page.evaluate(() => globalThis.smokeChanges.filter((event) => event.type === "workspace.sourceChanged"));
  assert.equal(sourceChanges.length, 2);
  assert.deepEqual(sourceChanges[1].source, { ...unavailable[0].source, sourceAvailable: true });
  await select(page, sibling);
  assert.equal((await load(page)).activeWorkspace.sourceAvailable, true);
  await select(page, first);
  await page.evaluate(() => globalThis.stopSmokeChanges());
  await rename(projectRoot, disconnectedRoot);
  await select(page, sibling);
  await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).waitFor();
  await rename(disconnectedRoot, projectRoot);
  await page.getByRole("button", { name: "Проверить доступ к папке", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => globalThis.smokeChanges.filter((event) => event.type === "workspace.sourceChanged").length), 2);
  await select(page, first);
  observations.push({ scenario: "management and source notifications", identities: [first, sibling, other], sourceChanges });

  async function closeCurrent() {
    const pids = await backendPids(current.electron);
    assert.ok(pids.length > 0, "No owned Node utility process is running");
    await closeElectron(current.electron);
    current = undefined;
    await assertStopped(pids);
  }
  await closeCurrent();
  await stat(join(dataDirectory, "workspace.sqlite"));
  current = await launch(dataDirectory);
  page = current.page;
  await page.getByRole("heading", { name: authoredName.trim(), exact: true }).waitFor();
  assert.equal(await page.locator("#interface-language").inputValue(), "ru");
  assert.equal(await page.locator("html").getAttribute("lang"), "ru");
  const reopened = await load(page);
  assert.deepEqual(identity(reopened.activeWorkspace), identity(first));
  assert.deepEqual(reopened.workspaces, [other, first, sibling].map(({ workspaceId, name }) => ({ workspaceId, name })));
  await page.getByText(canonicalProjectRoot, { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Таблица", exact: true }).waitFor();
  // Inactive different-root removal, active fallback, and final removal.
  assert.deepEqual(identity((await remove(page, other)).activeWorkspace), identity(first));
  assert.deepEqual(identity((await remove(page, first)).activeWorkspace), identity(sibling));
  assert.deepEqual(await remove(page, sibling), { workspaces: [], activeWorkspace: null });
  await page.getByRole("heading", { name: "Создать рабочее пространство", exact: true }).waitFor();
  for (const path of [projectRoot, otherRoot]) assert.deepEqual(await readFile(join(path, "sentinel.txt")), sentinel);
  await closeCurrent();

  current = await launch(dataDirectory);
  page = current.page;
  await page.getByRole("heading", { name: "Создать рабочее пространство", exact: true }).waitFor();
  assert.deepEqual(await load(page), { workspaces: [], activeWorkspace: null });
  const recreated = await create(current, "Recreated retained source", projectRoot, "ru");
  assert.equal(recreated.sourceId, first.sourceId);
  assert.notEqual(recreated.workspaceId, first.workspaceId);
  assert.notEqual(recreated.workspaceId, sibling.workspaceId);
  assert.notEqual(recreated.viewId, first.viewId);
  assert.notEqual(recreated.viewId, sibling.viewId);
  assert.equal(recreated.canonicalRoot, canonicalProjectRoot);
  for (const path of [projectRoot, otherRoot]) assert.deepEqual(await readFile(join(path, "sentinel.txt")), sentinel);
  observations.push({ scenario: "restart, inactive/active/final removal, empty restart and retained-source reuse", recreated, sentinelBytes: sentinel.length });
  await closeCurrent();

  const failureDirectory = join(fixture, "failed-startup");
  await mkdir(join(failureDirectory, "workspace.sqlite"), { recursive: true });
  current = await launch(failureDirectory);
  await current.page.getByRole("heading", { name: "Local service unavailable" }).waitFor();
  assert.deepEqual(await current.page.evaluate(() => globalThis.window.workspace.getBackendStatus()), {
    state: "unavailable",
    message: "Workspace could not start its local service. Close and reopen the app to try again.",
  });
  const failurePids = await backendPids(current.electron);
  await closeElectron(current.electron);
  current = undefined;
  await assertStopped(failurePids);
  if (evidenceDirectory) await writeFile(join(evidenceDirectory, `${mode}-observations.json`), JSON.stringify({
    mode, platform: process.platform, arch: process.arch, executablePath, observations,
  }, null, 2) + "\n");
  console.info(`Electron ${mode} runtime verified: workspace management/restart/removal, retained files/source, source notification fanout/unsubscription, EN/RU layouts, isolation, backend exit, startup failure`);
} finally {
  try { if (current) await closeElectron(current.electron); }
  finally { await rm(fixture, { recursive: true, force: true }); }
}
