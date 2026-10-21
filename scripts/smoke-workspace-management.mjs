import { enterContextFor } from "./runtime-context-tools.mjs";
import { applyReviewedDiscovery } from "./workspace-management-driver.mjs";
/* global window, document */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, realpath, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron } from "playwright-core";
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from "./runtime-lifecycle.mjs";
import { openSettingsSection, returnToWorkspace, setInterfaceLanguage, renameActiveWorkspace } from "./runtime-settings.mjs";

const root = resolve(import.meta.dirname, "..");
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-management-")));
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-49-workspace-management");
await mkdir(evidence, { recursive: true });
const data = join(fixture, "data"), source = join(fixture, "source");
await mkdir(source); await mkdir(join(source, "Project"));
await writeFile(join(source, "Project", "keep.txt"), "User project bytes");
const parents = new Set(), backends = new Set(), checks = [];
let app, page, failed, launchUnverified = false;
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = input => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
async function launch() {
  launchUnverified = true;
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)("electron"), args: [root], cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
  parents.add(app.process()); page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === "ready");
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid));
  assert.ok(pids.length > 0); for (const pid of pids) backends.add(pid);
  launchUnverified = false;
}
async function close() { if (app) { const current = app; app = null; await closeElectron(current); } }
const sidebar = () => page.getByRole("navigation", { name: /^(Workspaces|Рабочие пространства)$/ });
const add = () => sidebar().getByRole("button", { name: /^(Add workspace|Добавить рабочее пространство)$/ });
const actions = () => sidebar().getByRole("button", { name: /^(Workspace actions|Действия с рабочим пространством):/ });
async function selectRoot() { await app.evaluate((_electron, path) => { process.env.WORKSPACE_TEST_ROOT_PICKER_PATH = path; }, source); }
try {
  await launch();
  // Cancellation traverses the real preload/main route with a disposable dialog adapter.
  await app.evaluate(({ dialog }) => {
    globalThis.originalWorkspaceDialog = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await add().press("Enter");
  await page.getByRole("heading", { name: "Folder selection cancelled", exact: true }).waitFor();
  assert.equal((await query({ type: "workspace.load" })).workspaces.length, 0);
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = globalThis.originalWorkspaceDialog; });
  await selectRoot(); await add().press("Enter");
  await page.locator("#workspace-title").filter({ hasText: /^Workspace$/ }).waitFor();
  const first = (await query({ type: "workspace.load" })).activeWorkspace;
  const views = await query({ type: "workspace.listViews", workspaceId: first.workspaceId });
  assert.equal(views.views.length, 1); assert.equal(views.views[0].kind, "table");
  assert.equal(first.name, "Workspace");
  checks.push({ cancelledPickerCreatesNothing: true, automaticNameAndDefaultTable: true });
  for (const language of ["en", "ru"]) {
    await setInterfaceLanguage(page, language);
    for (const theme of ["light", "dark"]) {
      await openSettingsSection(page, "appearance");
      await page.getByRole("radio", { name: theme === "light" ? /^(Light|Светлая)$/ : /^(Dark|Тёмная)$/ }).click();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      await returnToWorkspace(page);
      for (const size of [{ width:1024, height:720 }, { width:1440, height:960 }]) {
        await page.setViewportSize(size);
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-setup.png`) });
        await actions().press("Enter");
        const group = page.getByRole("group", { name: /^(Workspace actions|Действия с рабочим пространством):/ });
        await group.waitFor();
        const bounds = await group.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= size.width && bounds.y + bounds.height <= size.height);
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-context.png`) });
        await group.getByRole("button", { name: /^(Settings|Настройки)$/ }).press("Enter");
        await page.getByRole("tab", { name: /^(Workspaces|Рабочие пространства)$/ }).waitFor();
        assert.equal(await page.getByRole("combobox", { name: /^(Saved workspaces|Сохранённые рабочие пространства)$/ }).inputValue(), first.workspaceId);
        await page.screenshot({ path: join(evidence, `${language}-${theme}-${size.width}-detail.png`) });
        await returnToWorkspace(page);
        checks.push({ language, theme, size, contextualSettings: true });
      }
    }
  }
  const configure = page.getByRole("button", { name: /^(Preview project folders|Посмотреть папки проектов)$/, includeHidden:true });
  await enterContextFor(page,configure);
  await configure.press("Enter");
  await page.getByRole("button", { name: /^(Apply reviewed projects|Применить проверенные проекты)$/ }).waitFor();
  await page.getByRole("button", { name: /^(Set up later|Настроить позже)$/ }).press("Enter");
  await page.waitForFunction(() => document.activeElement === document.querySelector(".source-tools > button"));
  await configure.press("Enter");
  await page.getByRole("button", { name: /^(Apply reviewed projects|Применить проверенные проекты)$/ }).waitFor();
  await page.getByRole("button", { name: /^(Cancel|Отмена)$/ }).press("Enter");
  assert.equal((await query({ type: "workspace.load" })).activeWorkspace.workspaceId, first.workspaceId);
  assert.equal((await query({ type: "workspace.listProjects", workspaceId: first.workspaceId })).configured, false);
  await configure.press("Enter");
  await applyReviewedDiscovery(page);
  await page.getByRole("cell", { name: "Project", exact: true }).waitFor();
  const before = await query({ type: "workspace.listProjects", workspaceId: first.workspaceId });
  await add().press("Enter");
  await page.waitForFunction(async () => (await window.workspace.workspace({ type:"workspace.load" })).value?.workspaces.length === 2);
  const second = (await query({ type: "workspace.load" })).activeWorkspace;
  assert.equal(second.name, "Workspace"); assert.equal(second.sourceId, first.sourceId);
  assert.notEqual(second.workspaceId, first.workspaceId); assert.notEqual(second.viewId, first.viewId);
  const reused = await query({ type: "workspace.listProjects", workspaceId: second.workspaceId });
  assert.equal(reused.configured, true); assert.equal(reused.mode, before.mode);
  assert.deepEqual(reused.projects, before.projects);
  assert.equal(await page.getByRole("button", { name: /^(Set up later|Настроить позже)$/ }).count(), 0);
  // Target an inactive workspace: real listChanged precedes the activate reply.
  await query({ type: "workspace.activate", workspaceId:first.workspaceId });
  await actions().nth(1).press("Enter");
  await page.getByRole("group", { name: /^(Workspace actions|Действия с рабочим пространством):/ }).getByRole("button", { name: /^(Rename workspace|Переименовать рабочее пространство)$/ }).press("Enter");
  const renameInput = page.getByRole("textbox", { name: /^(Workspace name|Название рабочего пространства)$/ });
  await renameInput.waitFor(); assert.equal(await renameInput.inputValue(), "Workspace");
  await renameInput.press("Escape"); await returnToWorkspace(page);
  await query({ type: "workspace.activate", workspaceId:first.workspaceId });
  await actions().nth(1).press("Enter");
  await page.getByRole("group", { name: /^(Workspace actions|Действия с рабочим пространством):/ }).getByRole("button", { name: /^(Settings|Настройки)$/ }).press("Enter");
  await page.getByRole("tab", { name: /^(Workspaces|Рабочие пространства)$/ }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: /^(Saved workspaces|Сохранённые рабочие пространства)$/ }).inputValue(), second.workspaceId);
  await renameActiveWorkspace(page, "Renamed workspace");
  await actions().nth(1).press("Enter");
  await page.getByRole("group", { name: /Renamed workspace$/ }).getByRole("button", { name: /^(Move up|Переместить выше)$/ }).press("Enter");
  assert.deepEqual((await query({ type: "workspace.load" })).workspaces.map(w => w.workspaceId), [second.workspaceId, first.workspaceId]);
  checks.push({ postponementAndCancelRetainWorkspace:true, configuredReuse:true, duplicateNamesDistinctIds:true, renameAndReorder:true });
  await close(); await launch();
  assert.deepEqual((await query({ type: "workspace.load" })).workspaces.map(w => w.workspaceId), [second.workspaceId, first.workspaceId]);
  assert.equal((await query({ type: "workspace.load" })).activeWorkspace.name, "Renamed workspace");
  for (const name of ["Renamed workspace", "Workspace"]) {
    await actions().first().press("Enter");
    await page.getByRole("group", { name: new RegExp(`${name}$`) }).getByRole("button", { name: /^(Remove workspace|Удалить рабочее пространство)$/ }).press("Enter");
    await page.getByRole("button", { name: /^(Remove configuration|Удалить конфигурацию)$/ }).press("Enter");
    await page.waitForFunction(async remaining => (await window.workspace.workspace({ type:"workspace.load" })).value?.workspaces.length === remaining, name === "Renamed workspace" ? 1 : 0);
    if (name === "Renamed workspace") await returnToWorkspace(page);
  }
  await page.getByRole("button", { name: /^(Choose project folder|Выбрать папку проекта)$/ }).waitFor();
  await page.waitForFunction(() => document.activeElement?.matches(".workspace-create .root-picker-row button"));
  assert.equal((await query({ type: "workspace.load" })).workspaces.length, 0);
  assert.equal(await readFile(join(source, "Project", "keep.txt"), "utf8"), "User project bytes");
  await selectRoot(); await add().press("Enter");
  await page.getByRole("cell", { name: "Project", exact: true }).waitFor();
  const recovered = (await query({ type: "workspace.load" })).activeWorkspace;
  assert.equal(recovered.sourceId, first.sourceId);
  assert.deepEqual((await query({ type: "workspace.listProjects", workspaceId: recovered.workspaceId })).projects, before.projects);
  checks.push({ postponementAndCancelRetainWorkspace:true, configuredReuse:true, duplicateNamesDistinctIds:true,
    renameReorderRestart:true, removalPreservesFilesAndOrphanSource:true });
} catch (error) { failed = error; if (page) await page.screenshot({ path:join(evidence, "failure.png") }).catch(() => {}); }
finally {
  try { await close(); } catch (error) { failed ??= error; }
  const stopped = ownedProcessesStopped(parents, backends, { launchUnverified });
  let cleanup;
  try { await cleanupOwnedFixture(fixture, { processesStopped:stopped, record:result => { cleanup = result; } }); } catch (error) { failed ??= error; }
  await writeFile(join(evidence, "result.json"), JSON.stringify({ issue:49, sha:process.env.GITHUB_SHA ?? null, platform:process.platform, checks,
    stopped, cleanup, status:failed ? "failed" : "passed", error:failed?.message }, null, 2));
}
if (failed) throw failed;
console.log("Workspace management native journey passed");
