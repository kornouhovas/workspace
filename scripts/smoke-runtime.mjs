import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
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
const stages = { preQuitFeatures: false, firstShutdown: false, restartPersistence: false, retainedSourceReuse: false, startupFailure: false };

async function recordEvidence(status, error) {
  if (evidenceDirectory) await writeFile(join(evidenceDirectory, `${mode}-observations.json`), JSON.stringify({
    mode, platform: process.platform, arch: process.arch, executablePath, status, stages,
    ...(error ? { error: error.message } : {}), observations,
  }, null, 2) + "\n");
}

async function projects(page, workspaceId) {
  const result = await page.evaluate((id) => globalThis.window.workspace.workspace({ type: "workspace.listProjects", workspaceId: id }), workspaceId);
  assert.equal(result.ok, true);
  return result.value;
}

async function properties(page, workspaceId) {
  const result = await page.evaluate((id) => globalThis.window.workspace.workspace({ type: "workspace.listTextProperties", workspaceId: id }), workspaceId);
  assert.equal(result.ok, true);
  return result.value;
}
const propertyLabels = {
  en: { create: "Create Text property", name: "Property name", rename: "Rename property", edit: "Edit Text value", save: "Save value", clear: "Clear value", saved: "Value saved.", absent: "No value", empty: "Empty text" },
  ru: { create: "Создать Text-свойство", name: "Название свойства", rename: "Переименовать свойство", edit: "Редактировать Text-значение", save: "Сохранить значение", clear: "Очистить значение", saved: "Значение сохранено.", absent: "Нет значения", empty: "Пустой текст" },
};
const accessibleName = (name) => name.replace(/\s+/g, " ").trim();
async function editValue(page, projectName, propertyName, value, language = "en") {
  const labels = propertyLabels[language];
  const cell = page.getByRole("button", { name: accessibleName(`${labels.edit}: ${projectName} / ${propertyName}`), exact: true });
  await cell.press("Enter");
  const editor = page.getByRole("textbox", { name: accessibleName(`${labels.edit}: ${projectName} / ${propertyName}`), exact: true });
  if (value === null) await page.getByRole("button", { name: labels.clear, exact: true }).press("Enter");
  else { await editor.fill(value); await editor.press("Control+Enter"); }
  await editor.waitFor({ state: "detached" });
  await cell.locator("..").getByText(labels.saved, { exact: true }).waitFor();
  assert.equal(await cell.textContent(), value === null ? labels.absent : value === "" ? labels.empty : value);
}

// Test-side byte/entry inventory follows no links, including external targets.
async function folderBytes(path) {
  const entries = [];
  for (const name of (await readdir(path)).sort()) {
    const child = join(path, name), info = await lstat(child);
    entries.push([name, info.isSymbolicLink() ? ["link", await readlink(child)]
      : info.isDirectory() ? ["directory", await folderBytes(child)]
      : ["file", (await readFile(child)).toString("base64")]]);
  }
  return entries;
}

const discoveryLabels = {
  en: { preview: "Preview project folders", apply: "Apply reviewed projects", cancel: "Cancel",
    exclude: "Exclude", stale: "The preview changed. Review the refreshed folders, then apply again." },
  ru: { preview: "Посмотреть папки проектов", apply: "Применить проверенные проекты", cancel: "Отмена",
    exclude: "Исключить", stale: "Предпросмотр изменился. Проверьте обновлённые папки и примените ещё раз." },
};
async function previewFolders(page, language = "en") {
  await page.getByRole("button", { name: discoveryLabels[language].preview, exact: true }).press("Enter");
  await page.waitForFunction(() => globalThis.document.querySelector(".discovery-panel")?.getAttribute("aria-busy") === "false");
}
async function excludeFolder(page, name, checked, language = "en") {
  const checkbox = page.getByRole("checkbox", { name: `${discoveryLabels[language].exclude}: ${name}`, exact: true });
  if (await checkbox.isChecked() !== checked) await checkbox.press("Space");
  await page.waitForFunction(() => globalThis.document.querySelector(".discovery-panel")?.getAttribute("aria-busy") === "false");
  assert.equal(await checkbox.isChecked(), checked);
}
async function applyFolders(page, language = "en") {
  await page.getByRole("button", { name: discoveryLabels[language].apply, exact: true }).press("Enter");
  await page.locator(".discovery-panel").waitFor({ state: "detached" });
}
async function captureDiscovery(page, language, state) {
  for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
    await page.setViewportSize(size);
    if (await page.locator(".text-value-editor").count()) await page.locator(".text-value-editor").scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => ({
      document: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      clippedControls: Array.from(globalThis.document.querySelectorAll(".text-value-editor button")).filter((node) => {
        const bounds = node.getBoundingClientRect(), scroll = node.closest(".project-table-scroll").getBoundingClientRect();
        return bounds.left < scroll.left - 1 || bounds.right > scroll.right + 1;
      }).map((node) => node.textContent),
      elements: Array.from(globalThis.document.querySelectorAll(".discovery-panel, .discovery-entries li, .workspace-root, .project-table td, .project-table th, .workspace-form-actions, .text-value-button, .text-value-editor"))
        .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className || node.tagName),
    }));
    assert.deepEqual(overflow, { document: false, clippedControls: [], elements: [] }, `${language} discovery ${state} ${size.width} overflow`);
    if (evidenceDirectory) await page.screenshot({ path: join(evidenceDirectory, `${mode}-${language}-${size.width}-${state}.png`), fullPage: true });
  }
}

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
  const projectName = "Authored-проект-" + "long-name-".repeat(14);
  const externalRoot = join(fixture, "ExternalTarget");
  for (const path of [join(projectRoot, projectName, "Nested-not-a-project"), join(projectRoot, "Excluded"),
    join(projectRoot, "Archive"), join(projectRoot, ".hidden"), join(projectRoot, "$RECYCLE.BIN"), externalRoot]) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "sentinel.txt"), sentinel);
  }
  await symlink(externalRoot, join(projectRoot, "External-link"), process.platform === "win32" ? "junction" : "dir");
  let originalBytes = await folderBytes(projectRoot);
  const externalBytes = await folderBytes(externalRoot);
  const otherBytes = await folderBytes(otherRoot);
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
  await page.getByText("Preview folders, choose exclusions and apply the reviewed projects to this Table.", { exact: true }).waitFor();
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
  const unconfigured = await projects(page, first.workspaceId);
  await previewFolders(page);
  for (const name of [".hidden", "$RECYCLE.BIN", "External-link"]) {
    assert.equal(await page.getByRole("checkbox", { name: `Exclude: ${name}`, exact: true }).isDisabled(), true);
  }
  assert.equal(await page.getByRole("checkbox", { name: /Nested-not-a-project/ }).count(), 0);
  assert.equal(await page.getByRole("checkbox", { name: "Exclude: Archive", exact: true }).isDisabled(), false);
  await excludeFolder(page, "Excluded", true);
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
  assert.deepEqual(await projects(page, first.workspaceId), unconfigured);
  assert.deepEqual(await folderBytes(projectRoot), originalBytes);
  await previewFolders(page);
  assert.equal(await page.getByRole("checkbox", { name: "Exclude: Excluded", exact: true }).isChecked(), false);
  await excludeFolder(page, "Excluded", true);
  await captureDiscovery(page, "en", "preview");
  await applyFolders(page);
  await page.getByRole("cell", { name: projectName, exact: true }).waitFor();
  let savedProjects = await projects(page, first.workspaceId);
  assert.deepEqual(savedProjects.projects.map((row) => row.name).sort(), ["Archive", projectName].sort());
  const initialIds = savedProjects.projects;
  await select(page, sibling);
  assert.deepEqual((await projects(page, sibling.workspaceId)).projects, savedProjects.projects);
  await page.getByRole("cell", { name: projectName, exact: true }).waitFor();
  await select(page, other);
  await previewFolders(page);
  await captureDiscovery(page, "en", "empty-preview");
  await applyFolders(page);
  assert.equal((await projects(page, other.workspaceId)).state, "empty");
  await select(page, first);
  await page.evaluate(() => {
    globalThis.smokeProjectChanges = [];
    globalThis.stopProjectChanges = globalThis.window.workspace.onWorkspaceChange((event) => {
      if (event.type === "workspace.projectsChanged") globalThis.smokeProjectChanges.push(event);
    });
  });
  // Filesystem change refreshes the draft but requires another explicit Apply.
  await previewFolders(page);
  await mkdir(join(projectRoot, "Late project"));
  await writeFile(join(projectRoot, "Late project", "sentinel.txt"), sentinel);
  originalBytes = await folderBytes(projectRoot);
  await page.getByRole("button", { name: "Apply reviewed projects", exact: true }).press("Enter");
  await page.getByRole("heading", { name: discoveryLabels.en.stale, exact: true }).waitFor();
  await page.getByRole("checkbox", { name: "Exclude: Late project", exact: true }).waitFor();
  assert.deepEqual((await projects(page, first.workspaceId)).projects, savedProjects.projects);
  await captureDiscovery(page, "en", "filesystem-stale");
  await applyFolders(page);
  savedProjects = await projects(page, first.workspaceId);
  assert.deepEqual(savedProjects.projects.filter((row) => row.name !== "Late project"), initialIds);
  await page.getByRole("cell", { name: "Late project", exact: true }).waitFor();
  // Sibling Apply uses the production utilityProcess/preload route while our preview stays open.
  await previewFolders(page);
  const siblingApply = await page.evaluate(async (workspaceId) => {
    const preview = await globalThis.window.workspace.workspace({ type: "workspace.previewDiscovery", workspaceId, excludedRelativePaths: [] });
    if (!preview.ok) return preview;
    return globalThis.window.workspace.workspace({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.value.previewToken });
  }, sibling.workspaceId);
  assert.equal(siblingApply.ok, true);
  await page.getByRole("heading", { name: discoveryLabels.en.stale, exact: true }).waitFor();
  await page.getByRole("cell", { name: "Excluded", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Apply reviewed projects", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Refresh preview", exact: true }).press("Enter");
  await page.getByRole("checkbox", { name: "Exclude: Excluded", exact: true }).waitFor();
  assert.equal(await page.getByRole("checkbox", { name: "Exclude: Excluded", exact: true }).isChecked(), true);
  await applyFolders(page);
  savedProjects = await projects(page, first.workspaceId);
  assert.equal(savedProjects.retainedCount, 1);
  assert.deepEqual(savedProjects.projects.filter((row) => row.name !== "Late project"), initialIds);
  const projectChanges = await page.evaluate(() => globalThis.smokeProjectChanges);
  assert.equal(projectChanges.length, 3);
  assert.ok(projectChanges.every((event) => event.sourceId === first.sourceId &&
    JSON.stringify(event.workspaceIds) === JSON.stringify([first.workspaceId, sibling.workspaceId])));
  await previewFolders(page); await applyFolders(page);
  assert.deepEqual(await projects(page, first.workspaceId), savedProjects);
  assert.equal(await page.evaluate(() => globalThis.smokeProjectChanges.length), 3, "Unchanged rescan emitted an event");
  await page.evaluate(() => globalThis.stopProjectChanges());
  assert.deepEqual(await folderBytes(projectRoot), originalBytes);
  assert.deepEqual(await folderBytes(externalRoot), externalBytes);
  observations.push({ scenario: "preview/exclude/cancel/apply, stale filesystem, sibling invalidation, retained exclusions, unchanged rescan", savedProjects, projectChanges });
  // Text commands use the actual UI, typed preload and utilityProcess database.
  const otherProperties = await properties(page, other.workspaceId);
  const initialProperties = await properties(page, first.workspaceId);
  await page.evaluate(() => {
    globalThis.smokePropertyChanges = [];
    globalThis.stopPropertyChanges = globalThis.window.workspace.onWorkspaceChange((event) => {
      if (event.type === "workspace.propertiesChanged") globalThis.smokePropertyChanges.push(event);
    });
  });
  const initialPropertyName = "  Notes 日本語  ";
  const propertyName = "  Renamed-свойство-" + "long-name-".repeat(18) + "  ";
  const authoredValue = "  日本語 📝 " + "authored-text-".repeat(20) + "\nСтрока с пробелами  ";
  await page.getByRole("button", { name: propertyLabels.en.create, exact: true }).press("Enter");
  await page.getByRole("textbox", { name: propertyLabels.en.name, exact: true }).fill(initialPropertyName);
  await page.getByRole("textbox", { name: propertyLabels.en.name, exact: true }).press("Enter");
  await page.getByRole("button", { name: accessibleName(`${propertyLabels.en.rename}: ${initialPropertyName}`), exact: true }).waitFor();
  const createdProperties = await properties(page, first.workspaceId);
  assert.equal(createdProperties.revision, initialProperties.revision + 1);
  const propertyId = createdProperties.definitions[0].propertyId;
  await page.getByRole("button", { name: accessibleName(`${propertyLabels.en.rename}: ${initialPropertyName}`), exact: true }).press("Enter");
  await page.getByRole("textbox", { name: propertyLabels.en.name, exact: true }).fill(propertyName);
  await page.getByRole("textbox", { name: propertyLabels.en.name, exact: true }).press("Enter");
  await page.getByRole("button", { name: accessibleName(`${propertyLabels.en.rename}: ${propertyName}`), exact: true }).waitFor();
  assert.equal((await properties(page, first.workspaceId)).definitions[0].propertyId, propertyId);
  await editValue(page, projectName, propertyName, authoredValue);
  await editValue(page, "Archive", propertyName, "");
  await captureDiscovery(page, "en", "text-authored-and-empty");
  await editValue(page, "Archive", propertyName, null);
  assert.equal((await properties(page, first.workspaceId)).values.some((entry) => entry.projectId === savedProjects.projects.find((project) => project.name === "Archive").projectId), false);
  await captureDiscovery(page, "en", "text-cleared");
  await editValue(page, "Archive", propertyName, "");
  await editValue(page, "Late project", propertyName, "  \n\t  ");
  const savedProperties = await properties(page, first.workspaceId);
  assert.equal(savedProperties.revision, initialProperties.revision + 7);
  assert.equal(savedProperties.definitions[0].name, propertyName);
  assert.deepEqual(savedProperties.values.map((entry) => entry.value).sort(), [authoredValue, "", "  \n\t  "].sort());
  await select(page, sibling);
  assert.deepEqual(await properties(page, sibling.workspaceId), { ...savedProperties, workspaceId: sibling.workspaceId });
  await page.getByRole("button", { name: accessibleName(`${propertyLabels.en.edit}: ${projectName} / ${propertyName}`), exact: true }).waitFor();
  await select(page, other);
  assert.deepEqual(await properties(page, other.workspaceId), otherProperties);
  assert.equal(await page.locator(".property-authored").count(), 0);
  await select(page, first);
  const propertyChanges = await page.evaluate(() => globalThis.smokePropertyChanges);
  assert.equal(propertyChanges.length, 7);
  assert.deepEqual(propertyChanges.map((event) => event.revision), Array.from({ length: 7 }, (_, index) => initialProperties.revision + index + 1));
  assert.ok(propertyChanges.every((event) => event.sourceId === first.sourceId &&
    JSON.stringify(event.workspaceIds) === JSON.stringify([first.workspaceId, sibling.workspaceId])));
  await page.evaluate(() => globalThis.stopPropertyChanges());
  assert.deepEqual(await projects(page, first.workspaceId), savedProjects);
  assert.deepEqual(identity((await load(page)).activeWorkspace), identity(first));
  assert.deepEqual(await folderBytes(projectRoot), originalBytes);
  assert.deepEqual(await folderBytes(otherRoot), otherBytes);
  observations.push({ scenario: "Text create/rename/authored/empty/clear/whitespace, sibling visibility and other-source isolation", identities: [first, sibling, other].map(identity), savedProperties, otherProperties, savedProjects, propertyChanges, unchangedProjectInventory: originalBytes });
  for (const language of ["en", "ru"]) {
    await page.locator("#interface-language").selectOption(language);
    await page.waitForFunction((lang) => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
    await captureDiscovery(page, language, "applied-table");
    const valueLabel = `${propertyLabels[language].edit}: ${projectName} / ${propertyName}`;
    await page.getByRole("button", { name: accessibleName(valueLabel), exact: true }).press("Enter");
    const textEditor = page.getByRole("textbox", { name: accessibleName(valueLabel), exact: true });
    assert.equal(await textEditor.inputValue(), authoredValue);
    await textEditor.fill("  Unsaved screenshot draft 日本語  ");
    await captureDiscovery(page, language, "text-editing");
    await textEditor.press("Escape");
    assert.equal(await page.getByRole("button", { name: accessibleName(valueLabel), exact: true }).textContent(), authoredValue);
    await previewFolders(page, language);
    await captureDiscovery(page, language, "preview");
    await page.getByRole("button", { name: discoveryLabels[language].cancel, exact: true }).press("Enter");
    await select(page, other); await captureDiscovery(page, language, "applied-empty"); await select(page, first);
  }
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
  const disconnectedProjects = await projects(page, sibling.workspaceId);
  assert.equal(disconnectedProjects.state, "unavailable");
  assert.deepEqual(disconnectedProjects.projects, savedProjects.projects);
  assert.equal(disconnectedProjects.retainedCount, savedProjects.retainedCount);
  await previewFolders(page, "ru");
  assert.equal(await page.getByRole("button", { name: discoveryLabels.ru.apply, exact: true }).isDisabled(), true);
  await captureDiscovery(page, "ru", "unavailable");
  await page.getByRole("button", { name: discoveryLabels.ru.cancel, exact: true }).press("Enter");
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
    await recordEvidence("feature assertions before quit");
    const closing = current; current = undefined;
    await closeElectron(closing.electron);
    await assertStopped(pids);
  }
  stages.preQuitFeatures = true;
  await closeCurrent();
  stages.firstShutdown = true;
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
  assert.deepEqual(await projects(page, first.workspaceId), savedProjects);
  await page.getByRole("cell", { name: projectName, exact: true }).waitFor();
  await previewFolders(page, "ru");
  assert.equal(await page.getByRole("checkbox", { name: "Исключить: Excluded", exact: true }).isChecked(), true);
  await applyFolders(page, "ru");
  assert.deepEqual(await projects(page, first.workspaceId), savedProjects);
  assert.deepEqual(await properties(page, first.workspaceId), savedProperties);
  await select(page, sibling);
  assert.deepEqual(await properties(page, sibling.workspaceId), { ...savedProperties, workspaceId: sibling.workspaceId });
  assert.deepEqual(identity((await load(page)).activeWorkspace), identity(sibling));
  await select(page, other); assert.deepEqual(await properties(page, other.workspaceId), otherProperties);
  await select(page, first);
  stages.restartPersistence = true;
  observations.push({ scenario: "Text persisted after application restart with unchanged project/source/workspace/view identities", savedProperties, savedProjects });
  // Inactive different-root removal, active fallback, and final removal.
  assert.deepEqual(identity((await remove(page, other)).activeWorkspace), identity(first));
  assert.deepEqual(identity((await remove(page, first)).activeWorkspace), identity(sibling));
  assert.deepEqual(await properties(page, sibling.workspaceId), { ...savedProperties, workspaceId: sibling.workspaceId });
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
  assert.deepEqual(await projects(page, recreated.workspaceId), { ...savedProjects, workspaceId: recreated.workspaceId });
  await page.getByRole("cell", { name: projectName, exact: true }).waitFor();
  await previewFolders(page, "ru");
  assert.equal(await page.getByRole("checkbox", { name: "Исключить: Excluded", exact: true }).isChecked(), true);
  await applyFolders(page, "ru");
  assert.deepEqual(await folderBytes(projectRoot), originalBytes);
  assert.deepEqual(await folderBytes(externalRoot), externalBytes);
  for (const path of [projectRoot, otherRoot]) assert.deepEqual(await readFile(join(path, "sentinel.txt")), sentinel);
  assert.deepEqual(await properties(page, recreated.workspaceId), { ...savedProperties, workspaceId: recreated.workspaceId });
  assert.deepEqual(await folderBytes(otherRoot), otherBytes);
  stages.retainedSourceReuse = true;
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
  stages.startupFailure = true;
  const failurePids = await backendPids(current.electron);
  await recordEvidence("startup failure asserted before quit");
  const closing = current; current = undefined;
  await closeElectron(closing.electron);
  await assertStopped(failurePids);
  await recordEvidence("passed");
  console.info(`Electron ${mode} runtime verified: discovery/exclusions/cancel/Apply, persistent project IDs/Text definitions and values/Table, stale preview, shared-source notifications, unavailable-root retention, restart/removal/reuse, unchanged bytes, EN/RU layouts, isolation, backend exit, startup failure`);
} catch (error) {
  await recordEvidence("failed", error);
  throw error;
} finally {
  try { if (current) await closeElectron(current.electron); }
  finally { await rm(fixture, { recursive: true, force: true }); }
}
