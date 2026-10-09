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
const stages = { recoveryFeatures: false, preQuitFeatures: false, firstShutdown: false, restartPersistence: false, retainedSourceReuse: false, startupFailure: false };
const shutdowns = [];

async function recordEvidence(status, error) {
  if (evidenceDirectory) await writeFile(join(evidenceDirectory, `${mode}-observations.json`), JSON.stringify({
    mode, platform: process.platform, arch: process.arch, executablePath, status, stages, shutdowns,
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
async function excludeFolder(page, name, checked, language = "en", kind = null) {
  const checkbox = page.getByRole("checkbox", { name: `${discoveryLabels[language].exclude}: ${kind ? (language === "en" ? kind : kind === "Category" ? "Категория" : "Проект") + ": " : ""}${name}`, exact: true });
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
    if (await page.locator(".category-property-header").count()) await page.locator(".category-property-header").scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => ({
      document: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      clippedControls: Array.from(globalThis.document.querySelectorAll(".text-value-editor button, .category-property-header button")).filter((node) => {
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
  const groupedRoot = join(fixture, "GroupedRoot");
  const categoryName = "Категория-" + "long-category-".repeat(14);
  let groupedProjectName = "日本語-проект-" + "long-project-".repeat(14);
  for (const path of [join(groupedRoot, categoryName, groupedProjectName, "Never-recursive"), join(groupedRoot, categoryName, "Excluded child"),
    join(groupedRoot, categoryName, ".hidden"), join(groupedRoot, categoryName, "$RECYCLE.BIN"), join(groupedRoot, "Empty category"),
    join(groupedRoot, "Direct-looking project", "Immediate child"), join(groupedRoot, "Excluded category", "Hidden child"), join(groupedRoot, ".hidden")]) {
    await mkdir(path, { recursive: true }); await writeFile(join(path, "sentinel.txt"), sentinelForGrouped());
  }
  function sentinelForGrouped() { return Buffer.from("Grouped fixture bytes\0retained\n"); }
  await writeFile(join(groupedRoot, "ordinary-file.txt"), sentinelForGrouped());
  const sentinel = Buffer.from("Retained project bytes\0through workspace removal\n");
  for (const path of [projectRoot, otherRoot]) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "sentinel.txt"), sentinel);
  }
  let projectName = "Authored-проект-" + "long-name-".repeat(14);
  const externalRoot = join(fixture, "ExternalTarget");
  for (const path of [join(projectRoot, projectName, "Nested-not-a-project"), join(projectRoot, "Excluded"),
    join(projectRoot, "Archive"), join(projectRoot, ".hidden"), join(projectRoot, "$RECYCLE.BIN"), externalRoot]) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "sentinel.txt"), sentinel);
  }
  await symlink(externalRoot, join(projectRoot, "External-link"), process.platform === "win32" ? "junction" : "dir");
  await symlink(externalRoot, join(groupedRoot, "External-link"), process.platform === "win32" ? "junction" : "dir");
  await symlink(externalRoot, join(groupedRoot, categoryName, "External-link"), process.platform === "win32" ? "junction" : "dir");
  let groupedBytes = await folderBytes(groupedRoot);
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
  assert.equal(await page.getByRole("heading", { name: "Папка проекта недоступна", exact: true }).count(), 1);
  assert.deepEqual(disconnectedProjects.projects, savedProjects.projects.map((row) => ({ ...row, resolution: null })));
  assert.ok([...disconnectedProjects.projects, ...disconnectedProjects.retainedProjects].every((row) => row.resolution === null));
  assert.deepEqual(await properties(page, sibling.workspaceId), { ...savedProperties, workspaceId: sibling.workspaceId });
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

  // Grouped workflow runs through the UI and actual preload/utilityProcess route.
  await page.locator("#interface-language").selectOption("en");
  await page.waitForFunction(() => globalThis.document.documentElement.lang === "en" && !globalThis.document.querySelector("#interface-language")?.disabled);
  const grouped = await create(current, "Grouped configuration", groupedRoot);
  const groupedSibling = await create(current, "Grouped sibling", groupedRoot);
  assert.equal(grouped.sourceId, groupedSibling.sourceId);
  assert.notEqual(grouped.viewId, groupedSibling.viewId);
  await select(page, grouped);
  const groupedUnconfigured = await projects(page, grouped.workspaceId);
  await previewFolders(page);
  await page.getByRole("combobox", { name: "Folder interpretation", exact: true }).selectOption("grouped");
  await page.getByRole("heading", { name: "Grouped project preview", exact: true }).waitFor();
  await page.waitForFunction(() => globalThis.document.querySelector(".discovery-panel")?.getAttribute("aria-busy") === "false");
  assert.equal(await page.getByRole("checkbox", { name: /Never-recursive/ }).count(), 0);
  await excludeFolder(page, "Excluded child", true, "en", "Project");
  await excludeFolder(page, categoryName, true, "en", "Category");
  assert.equal(await page.getByRole("checkbox", { name: /Excluded child/ }).count(), 0);
  await excludeFolder(page, categoryName, false, "en", "Category");
  await excludeFolder(page, "Excluded child", true, "en", "Project");
  await excludeFolder(page, "Excluded category", true, "en", "Category");
  await captureDiscovery(page, "en", "grouped-preview-cancel");
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
  assert.deepEqual(await projects(page, grouped.workspaceId), groupedUnconfigured);
  assert.deepEqual(await folderBytes(groupedRoot), groupedBytes);
  await previewFolders(page);
  await page.getByRole("combobox", { name: "Folder interpretation", exact: true }).selectOption("grouped");
  await page.waitForFunction(() => globalThis.document.querySelector(".discovery-panel")?.getAttribute("aria-busy") === "false");
  for (const checkbox of await page.getByRole("checkbox").all()) {
    if (/External-link|\.hidden|\$RECYCLE.BIN/.test(await checkbox.getAttribute("aria-label") ?? await checkbox.locator("..").textContent())) assert.equal(await checkbox.isDisabled(), true);
  }
  await excludeFolder(page, "Excluded child", true, "en", "Project");
  await excludeFolder(page, "Excluded category", true, "en", "Category");
  await mkdir(join(groupedRoot, "Late empty category"));
  groupedBytes = await folderBytes(groupedRoot);
  await page.getByRole("button", { name: discoveryLabels.en.apply, exact: true }).press("Enter");
  await page.getByRole("heading", { name: discoveryLabels.en.stale, exact: true }).waitFor();
  await page.getByRole("checkbox", { name: "Exclude: Category: Late empty category", exact: true }).waitFor();
  assert.deepEqual(await projects(page, grouped.workspaceId), groupedUnconfigured);
  await applyFolders(page);
  const groupedApplied = await projects(page, grouped.workspaceId);
  assert.equal(groupedApplied.mode, "grouped");
  assert.deepEqual(groupedApplied.projects.map((entry) => entry.name).sort(), [groupedProjectName, "Immediate child"].sort());
  assert.equal(groupedApplied.categories.length, 4);
  assert.ok(groupedApplied.projects.every((entry) => groupedApplied.categories.some((category) => category.categoryId === entry.categoryId)));
  await page.getByRole("cell", { name: categoryName, exact: true }).waitFor();
  assert.equal(await page.getByRole("cell", { name: categoryName, exact: true }).getByRole("button").count(), 0);
  const categoryPropertyId = groupedApplied.categoryProperty.propertyId;
  const groupedTextName = "Grouped Notes";
  await page.getByRole("button", { name: propertyLabels.en.create, exact: true }).press("Enter");
  await page.getByRole("textbox", { name: propertyLabels.en.name, exact: true }).fill(groupedTextName);
  await page.getByRole("textbox", { name: propertyLabels.en.name, exact: true }).press("Enter");
  await page.getByRole("button", { name: `Rename property: ${groupedTextName}`, exact: true }).waitFor();
  await editValue(page, groupedProjectName, groupedTextName, "  Grouped authored 日本語\nText  ");
  const savedGroupedProperties = await properties(page, grouped.workspaceId);
  await page.evaluate(() => {
    globalThis.groupedLabelEvents = [];
    globalThis.stopGroupedLabelEvents = globalThis.window.workspace.onWorkspaceChange((event) => {
      if (event.type === "workspace.categoryPropertyChanged") globalThis.groupedLabelEvents.push(event);
    });
  });
  let groupedLabel;
  for (const language of ["en", "ru"]) {
    await page.locator("#interface-language").selectOption(language);
    await page.waitForFunction((lang) => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
    await previewFolders(page, language);
    assert.equal(await page.locator(".discovery-mode").count(), 0, "Configured mode switching exposed");
    await captureDiscovery(page, language, "grouped-configured-preview");
    await page.getByRole("button", { name: discoveryLabels[language].cancel, exact: true }).press("Enter");
    const rename = language === "en" ? "Rename category property" : "Переименовать свойство категории";
    const nameLabel = language === "en" ? "Category property name" : "Название свойства категории";
    const trigger = page.getByRole("button", { name: new RegExp(`^${rename}:`) });
    await trigger.press("Enter");
    const input = page.getByRole("textbox", { name: nameLabel, exact: true });
    assert.equal(await input.evaluate((node) => node === globalThis.document.activeElement), true);
    await input.fill("   "); await input.press("Enter");
    assert.equal(await input.getAttribute("aria-invalid"), "true");
    await captureDiscovery(page, language, "grouped-label-validation");
    groupedLabel = "  Authored-категория-" + "long-label-".repeat(16) + ` ${language}  `;
    await input.fill(groupedLabel);
    await captureDiscovery(page, language, "grouped-label-editing");
    await input.press("Enter"); await input.waitFor({ state: "detached" });
    await page.getByRole("button", { name: accessibleName(`${rename}: ${groupedLabel}`), exact: true }).waitFor();
    const renamed = await projects(page, grouped.workspaceId);
    assert.equal(renamed.revision, groupedApplied.revision);
    assert.deepEqual(renamed.projects, groupedApplied.projects);
    assert.deepEqual(renamed.categories, groupedApplied.categories);
    assert.equal(renamed.categoryProperty.propertyId, categoryPropertyId);
    assert.equal(renamed.categoryProperty.name, groupedLabel);
    assert.deepEqual(await properties(page, grouped.workspaceId), savedGroupedProperties);
    await captureDiscovery(page, language, "grouped-applied-label");
    await select(page, groupedSibling);
    assert.deepEqual(await projects(page, groupedSibling.workspaceId), { ...renamed, workspaceId: groupedSibling.workspaceId });
    assert.deepEqual(await properties(page, groupedSibling.workspaceId), { ...savedGroupedProperties, workspaceId: groupedSibling.workspaceId });
    await page.getByRole("button", { name: accessibleName(`${rename}: ${groupedLabel}`), exact: true }).waitFor();
    await select(page, other);
    assert.equal(await page.locator(".category-property-header").count(), 0);
    assert.deepEqual(await projects(page, first.workspaceId), savedProjects);
    assert.deepEqual(await properties(page, other.workspaceId), otherProperties);
    await select(page, grouped);
  }
  let savedGroupedProjects = await projects(page, grouped.workspaceId);
  const labelEvents = await page.evaluate(() => globalThis.groupedLabelEvents);
  assert.equal(labelEvents.length, 2);
  assert.ok(labelEvents.every((event) => event.sourceId === grouped.sourceId && JSON.stringify(event.workspaceIds) === JSON.stringify([grouped.workspaceId, groupedSibling.workspaceId])));
  await page.evaluate(() => globalThis.stopGroupedLabelEvents());
  assert.deepEqual(await folderBytes(groupedRoot), groupedBytes);
  assert.deepEqual(await folderBytes(externalRoot), externalBytes);
  observations.push({ scenario: "grouped EN/RU preview/cancel, two-level exclusions, explicit stale Apply, required categories, label-only rename, siblings and isolation", grouped, groupedSibling, savedGroupedProjects, savedGroupedProperties, labelEvents, unchangedGroupedInventory: groupedBytes });
  await select(page, first);


  // Externally prepared changes are confined to disposable roots. Recovery itself
  // must change only SQLite associations, never the inventory or sentinel bytes.
  await page.evaluate(() => {
    globalThis.recoveryEvents = [];
    globalThis.stopRecoveryEvents = globalThis.window.workspace.onWorkspaceChange((event) => {
      if (event.type === "workspace.projectsChanged") globalThis.recoveryEvents.push(event);
    });
  });
  const recoveryLabels = {
    en: { locate: "Locate folder", confirm: "Reassociate", refresh: "Refresh preview", saved: "Folder association saved. Project identity and Text values preserved.",
      stale: "Folders or associations changed. Refresh, select a folder again and explicitly confirm." },
    ru: { locate: "Найти папку", confirm: "Переподключить", refresh: "Обновить предпросмотр", saved: "Связь с папкой сохранена. Идентификатор проекта и значения Text сохранены.",
      stale: "Папки или связи изменились. Обновите список, выберите папку заново и явно подтвердите действие." },
  };
  async function recover(workspace, oldProject, target, language, expectedResolution, staleSwap) {
    const labels = recoveryLabels[language];
    await select(page, workspace);
    const before = await projects(page, workspace.workspaceId);
    const row = before.retainedProjects.find((entry) => entry.projectId === oldProject.projectId);
    assert.equal(row?.resolution, expectedResolution);
    const textBefore = await properties(page, workspace.workspaceId);
    const bytesBefore = await folderBytes(workspace.canonicalRoot);
    const locate = page.getByRole("button", { name: accessibleName(`${labels.locate}: ${row.name}`), exact: true });
    await locate.press("Enter");
    const panel = page.locator(".recovery-panel");
    await panel.locator("input[type=radio]").first().waitFor();
    assert.equal(await page.locator("#recovery-title").evaluate((node) => node === globalThis.document.activeElement), true);
    await captureDiscovery(page, language, `recovery-${workspace.sourceId}-${expectedResolution}-review`);
    await panel.press("Escape"); await panel.waitFor({ state: "detached" });
    assert.equal(await locate.evaluate((node) => node === globalThis.document.activeElement), true);
    assert.deepEqual(await projects(page, workspace.workspaceId), before);
    assert.deepEqual(await properties(page, workspace.workspaceId), textBefore);
    assert.deepEqual(await folderBytes(workspace.canonicalRoot), bytesBefore);
    // A disabled owned target is also rejected through the production service route.
    const rejected = await page.evaluate(async ({ workspaceId, projectId }) => {
      const review = await globalThis.window.workspace.workspace({ type: "workspace.previewProjectRecovery", workspaceId, projectId });
      if (!review.ok) return { review };
      const conflict = review.value.entries.find((entry) => entry.status === "reserved_path");
      if (!conflict) return { missingConflict: true };
      const result = await globalThis.window.workspace.workspace({ type: "workspace.reassociateProject", workspaceId, projectId,
        previewToken: review.value.previewToken, relativePath: conflict.relativePath });
      return { conflict, result };
    }, { workspaceId: workspace.workspaceId, projectId: row.projectId });
    assert.equal(rejected.result?.ok, false);
    assert.equal(rejected.result.error.code, "invalid_input");
    assert.deepEqual(await projects(page, workspace.workspaceId), before);
    assert.deepEqual(await properties(page, workspace.workspaceId), textBefore);
    assert.deepEqual(await folderBytes(workspace.canonicalRoot), bytesBefore);
    await locate.press("Enter");
    const targetRadio = panel.locator("input[type=radio]");
    await targetRadio.first().waitFor();
    const choose = async () => {
      const radio = panel.locator("input[type=radio]");
      const selected = await radio.evaluateAll((nodes, value) => nodes.findIndex((node) => node.value === value), target);
      assert.ok(selected >= 0, "Target missing from source-relative directory list");
      await radio.nth(selected).press("Space");
      assert.equal(await radio.nth(selected).isChecked(), true);
    };
    await choose();
    if (staleSwap) {
      await rename(join(workspace.canonicalRoot, target), staleSwap);
      await panel.getByRole("button", { name: labels.confirm, exact: true }).press("Enter");
      await page.getByRole("heading", { name: labels.stale, exact: true }).waitFor();
      assert.deepEqual(await properties(page, workspace.workspaceId), textBefore);
      await captureDiscovery(page, language, `recovery-${workspace.sourceId}-stale`);
      await rename(staleSwap, join(workspace.canonicalRoot, target));
      await panel.getByRole("button", { name: labels.refresh, exact: true }).press("Enter");
      await panel.locator("input[type=radio]").first().waitFor();
      assert.equal(await panel.locator("input:checked").count(), 0);
      assert.equal(await panel.getByRole("button", { name: labels.confirm, exact: true }).isDisabled(), true);
      await choose();
    }
    await captureDiscovery(page, language, `recovery-${workspace.sourceId}-${expectedResolution}-selected`);
    await panel.getByRole("button", { name: labels.confirm, exact: true }).press("Enter");
    await panel.waitFor({ state: "detached" });
    await page.getByRole("heading", { name: labels.saved, exact: true }).waitFor();
    assert.equal(await page.locator("#table-title").evaluate((node) => node === globalThis.document.activeElement), true);
    const after = await projects(page, workspace.workspaceId);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.projects.find((entry) => entry.projectId === row.projectId)?.relativePath, target);
    assert.deepEqual(await properties(page, workspace.workspaceId), textBefore);
    assert.deepEqual(identity((await load(page)).activeWorkspace), identity(workspace));
    assert.deepEqual(await folderBytes(workspace.canonicalRoot), bytesBefore);
    await captureDiscovery(page, language, `recovery-${workspace.sourceId}-${expectedResolution}-saved`);
    observations.push({ scenario: "production UI recovery cancellation/conflict/explicit save", expectedResolution, before, after, textBefore,
      identity: identity(workspace), rejected, unchangedPreparedInventory: bytesBefore, staleReconfirmed: Boolean(staleSwap) });
    await recordEvidence("recovery feature checkpoint");
    return after;
  }
  await select(page, sibling);
  const directOriginal = savedProjects.projects.find((entry) => entry.name === projectName);
  const recoveredName = "Recovered-日本語-" + "long-target-".repeat(14);
  await rename(join(projectRoot, projectName), join(projectRoot, recoveredName));
  savedProjects = await recover(first, directOriginal, recoveredName, "ru", "missing", join(fixture, "stale-direct-target"));
  projectName = recoveredName;
  // Persist a missing row, then restore the exact folder: conservative matching
  // yields unresolved, and only explicit recovery reconnects its authored Text.
  const ambiguous = savedProjects.projects.find((entry) => entry.name === "Late project");
  await rename(join(projectRoot, "Late project"), join(fixture, "ambiguous-held"));
  await previewFolders(page, "ru"); await applyFolders(page, "ru");
  await rename(join(fixture, "ambiguous-held"), join(projectRoot, "Late project"));
  await select(page, sibling);
  savedProjects = await recover(first, ambiguous, "Late project", "ru", "unresolved");
  const replaced = savedProjects.projects.find((entry) => entry.name === "Archive");
  await rename(join(projectRoot, "Archive"), join(projectRoot, "Recovered archive"));
  await mkdir(join(projectRoot, "Archive")); await writeFile(join(projectRoot, "Archive", "sentinel.txt"), sentinel);
  await select(page, sibling);
  savedProjects = await recover(first, replaced, "Recovered archive", "ru", "replaced");
  // The replacement becomes a distinct ID only in a later, explicitly reviewed Apply.
  await previewFolders(page, "ru"); await applyFolders(page, "ru");
  savedProjects = await projects(page, first.workspaceId);
  const replacement = savedProjects.projects.find((entry) => entry.name === "Archive");
  assert.notEqual(replacement.projectId, replaced.projectId);
  assert.equal((await properties(page, first.workspaceId)).values.some((entry) => entry.projectId === replacement.projectId), false);
  assert.deepEqual(await properties(page, first.workspaceId), savedProperties);
  originalBytes = await folderBytes(projectRoot);
  await select(page, sibling);
  assert.deepEqual(await projects(page, sibling.workspaceId), { ...savedProjects, workspaceId: sibling.workspaceId });

  await page.locator("#interface-language").selectOption("en");
  await page.waitForFunction(() => globalThis.document.documentElement.lang === "en" && !globalThis.document.querySelector("#interface-language")?.disabled);
  const groupedOriginal = savedGroupedProjects.projects.find((entry) => entry.name === groupedProjectName);
  const newCategory = "Recovery category-日本語-" + "long-category-".repeat(12);
  const groupedRecoveredName = "Recovered grouped project-日本語";
  await mkdir(join(groupedRoot, newCategory));
  await rename(join(groupedRoot, categoryName, groupedProjectName), join(groupedRoot, newCategory, groupedRecoveredName));
  savedGroupedProjects = await recover(grouped, groupedOriginal, `${newCategory}/${groupedRecoveredName}`, "en", "missing");
  groupedProjectName = groupedRecoveredName;
  assert.deepEqual(savedGroupedProjects.categoryProperty, { ...groupedApplied.categoryProperty, name: groupedLabel });
  assert.equal(savedGroupedProjects.categoryPropertyRevision, 2);
  assert.ok(savedGroupedProjects.categories.some((entry) => entry.name === newCategory));
  assert.ok(savedGroupedProjects.categories.some((entry) => entry.name === categoryName && entry.categoryId === groupedOriginal.categoryId));
  groupedBytes = await folderBytes(groupedRoot);
  await select(page, groupedSibling);
  assert.deepEqual(await projects(page, groupedSibling.workspaceId), { ...savedGroupedProjects, workspaceId: groupedSibling.workspaceId });
  assert.deepEqual(await properties(page, groupedSibling.workspaceId), { ...savedGroupedProperties, workspaceId: groupedSibling.workspaceId });
  const recoveryEvents = await page.evaluate(() => { globalThis.stopRecoveryEvents(); return globalThis.recoveryEvents; });
  for (const workspace of [first, grouped]) {
    const related = recoveryEvents.filter((event) => event.sourceId === workspace.sourceId);
    assert.ok(related.length > 0);
    const expectedIds = workspace.sourceId === first.sourceId ? [first.workspaceId, sibling.workspaceId] : [grouped.workspaceId, groupedSibling.workspaceId];
    assert.ok(related.every((event) => JSON.stringify(event.workspaceIds) === JSON.stringify(expectedIds)));
    assert.ok(related.every((event, index) => index === 0 || event.revision > related[index - 1].revision));
  }
  assert.ok(recoveryEvents.every((event) => event.sourceId !== other.sourceId));
  assert.deepEqual(await folderBytes(externalRoot), externalBytes);
  assert.deepEqual(await folderBytes(otherRoot), otherBytes);
  await page.locator("#interface-language").selectOption("ru");
  await page.waitForFunction(() => globalThis.document.documentElement.lang === "ru" && !globalThis.document.querySelector("#interface-language")?.disabled);
  observations.push({ scenario: "direct/grouped recovery identities, revisions, source events and independent Text/category revisions", recoveryEvents,
    savedProjects, savedProperties, savedGroupedProjects, savedGroupedProperties, savedSettings, identities: [first, sibling, grouped, groupedSibling].map(identity) });
  stages.recoveryFeatures = true;
  await select(page, first);

  async function closeCurrent() {
    const pids = await backendPids(current.electron);
    assert.ok(pids.length > 0, "No owned Node utility process is running");
    await recordEvidence("feature assertions before quit");
    const closing = current; current = undefined;
    const shutdown = { attempt: shutdowns.length + 1, passed: false }; shutdowns.push(shutdown);
    try { await closeElectron(closing.electron); await assertStopped(pids); shutdown.passed = true; }
    catch (error) { shutdown.error = error.message; throw error; }
    await recordEvidence("normal quit and backend exit passed");
  }
  stages.preQuitFeatures = true;
  await closeCurrent();
  stages.firstShutdown = true;
  await stat(join(dataDirectory, "workspace.sqlite"));
  current = await launch(dataDirectory);
  page = current.page;
  await page.getByRole("heading", { name: authoredName.trim(), exact: true }).waitFor();
  assert.equal(await page.locator("#interface-language").inputValue(), "ru");
  assert.deepEqual(await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" })), savedSettings);
  assert.equal(await page.locator("html").getAttribute("lang"), "ru");
  const reopened = await load(page);
  assert.deepEqual(identity(reopened.activeWorkspace), identity(first));
  assert.deepEqual(reopened.workspaces, [other, first, sibling, grouped, groupedSibling].map(({ workspaceId, name }) => ({ workspaceId, name })));
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
  await select(page, grouped);
  assert.deepEqual(await projects(page, grouped.workspaceId), savedGroupedProjects);
  assert.deepEqual(await properties(page, grouped.workspaceId), savedGroupedProperties);
  await page.getByRole("cell", { name: groupedProjectName, exact: true }).waitFor();
  await select(page, groupedSibling);
  assert.deepEqual(identity((await load(page)).activeWorkspace), identity(groupedSibling));
  assert.deepEqual(await projects(page, groupedSibling.workspaceId), { ...savedGroupedProjects, workspaceId: groupedSibling.workspaceId });
  await select(page, first);
  assert.deepEqual(identity((await remove(page, grouped)).activeWorkspace), identity(first));
  assert.deepEqual(identity((await remove(page, groupedSibling)).activeWorkspace), identity(first));
  assert.deepEqual(await folderBytes(groupedRoot), groupedBytes);
  stages.restartPersistence = true;
  observations.push({ scenario: "grouped restart identities/label/Text/settings and final grouped source removal", savedGroupedProjects, savedGroupedProperties });
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
  const reusedGrouped = await create(current, "Reused grouped source", groupedRoot, "ru");
  assert.equal(reusedGrouped.sourceId, grouped.sourceId);
  assert.notEqual(reusedGrouped.viewId, grouped.viewId);
  assert.notEqual(reusedGrouped.viewId, groupedSibling.viewId);
  assert.deepEqual(await projects(page, reusedGrouped.workspaceId), { ...savedGroupedProjects, workspaceId: reusedGrouped.workspaceId });
  assert.deepEqual(await properties(page, reusedGrouped.workspaceId), { ...savedGroupedProperties, workspaceId: reusedGrouped.workspaceId });
  await page.getByRole("cell", { name: groupedProjectName, exact: true }).waitFor();
  await previewFolders(page, "ru"); await applyFolders(page, "ru");
  assert.deepEqual(await projects(page, reusedGrouped.workspaceId), { ...savedGroupedProjects, workspaceId: reusedGrouped.workspaceId });
  assert.deepEqual(await folderBytes(groupedRoot), groupedBytes);
  observations.push({ scenario: "retained grouped source reuse after empty restart", reusedGrouped, savedGroupedProjects, savedGroupedProperties });
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
  console.info(`Electron ${mode} runtime verified: direct/grouped recovery/discovery/exclusions/cancel/Apply, metadata-only category label, persistent project IDs/Text definitions and values/Table, stale preview, shared-source notifications, unavailable-root retention, restart/removal/reuse, unchanged bytes, EN/RU layouts, isolation, backend exit, startup failure`);
} catch (error) {
  if (current && evidenceDirectory) await current.page.screenshot({ path: join(evidenceDirectory, `${mode}-failed.png`), fullPage: true, timeout: 3000 }).catch(() => {});
  await recordEvidence("failed", error);
  throw error;
} finally {
  try { if (current) await closeElectron(current.electron); }
  finally { await rm(fixture, { recursive: true, force: true }); }
}
