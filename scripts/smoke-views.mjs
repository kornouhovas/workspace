import { openRuntimeViewActions } from "./runtime-view-actions.mjs";
import { exerciseMetadataRemoval } from "./runtime-metadata-removal.mjs";
import { exerciseFolderGroupAssignment } from "./runtime-folder-group-assignment.mjs";
import { exerciseGroupAssignment } from "./runtime-group-assignment.mjs";
import { exerciseBoardLayout } from "./runtime-board-layout.mjs";
import { exerciseTableLayout } from "./runtime-table-layout.mjs";
/* global window, document, innerWidth */
import { exerciseViewGrouping, exerciseSelectionGrouping, exerciseCategoryGrouping, exerciseRetainedCategoryGrouping } from "./runtime-view-grouping.mjs";
import { exerciseViewFilters } from "./runtime-view-filters.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from "./runtime-lifecycle.mjs";
import { waitForRuntimeInterface } from "./runtime-startup.mjs";
import { packagedExecutablePath } from "./runtime-executable.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "dev";
assert.ok(["dev", "release"].includes(mode));
const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "views-runtime-")));
const dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-27-views-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 27, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], startups: [], shutdowns: [], cleanup: null, status: "running" };
const children = new Set(), backendPids = new Set();
let session, failure, launchUnverified = false;
const quitEvents = new WeakMap();
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = (page, input) => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
async function pressEnabled(page, button) {
  const enabled = button.and(page.locator(':not(:disabled):not([aria-disabled="true"])'));
  await enabled.focus();
  await enabled.press("Enter");
}
async function launch() {
  launchUnverified = true;
  const app = await _electron.launch({ executablePath, args: mode === "dev" ? [root] : [], cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: dataDirectory }, timeout: 30000 });
  children.add(app.process()); session = app;
  const events = []; quitEvents.set(app, events);
  const record = event => { if (!events.includes(event) && events.length < 16) events.push(event); };
  app.process().once("exit", () => record("parent-exit"));
  app.process().stdout?.on("data", chunk => {
    for (const event of ["before-quit", "will-quit", "quit", "window-all-closed"]) if (chunk.toString().includes(`[views-quit:${event}]`)) record(event);
  });
  await app.evaluate(({ app }) => {
    for (const event of ["before-quit", "will-quit", "quit", "window-all-closed"]) app.on(event, () => process.stdout.write(`[views-quit:${event}]\n`));
  });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await waitForRuntimeInterface(page, async outcome => { evidence.startups.push(outcome); });
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid));
  assert.ok(pids.length > 0); for (const pid of pids) backendPids.add(pid);
  launchUnverified = false;
  return { app, page };
}
async function close() {
  if (!session) return;
  const closing = session;
  const shutdown = { normalQuit: false, backendExited: false, events: quitEvents.get(closing) };
  evidence.shutdowns.push(shutdown);
  try { await closeElectron(closing); }
  catch (error) {
    shutdown.error = error.message; shutdown.forcedCleanup = error.forcedCleanup;
    throw error;
  }
  shutdown.normalQuit = true; session = undefined;
  for (const pid of backendPids) {
    let stopped = false;
    for (let i = 0; i < 50; i++) {
      try { process.kill(pid, 0); } catch (error) { if (error.code !== "ESRCH") throw error; stopped = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(stopped, true, "Backend exited after ordinary quit");
  }
  shutdown.backendExited = true;
}
try {
  let { page } = await launch();
  for (const language of ["en", "ru"]) {
    const source = join(fixture, language); await mkdir(source); await mkdir(join(source, "Project"));
    await writeFile(join(source, "Project", "keep"), "unchanged");
    await page.evaluate(language => window.workspace.settings({ type: "settings.setLanguage", language }), language);
    const workspace = await query(page, { type: "workspace.create", rootPath: source, name: `Views ${language}` });
    const workspaceId = workspace.workspaceId;
    const sibling = await query(page, { type: "workspace.create", rootPath: source, name: `Sibling ${language}` });
    const preview = await query(page, { type: "workspace.previewDiscovery", workspaceId });
    const projects = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
    const property = await query(page, { type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" });
    await query(page, { type: "workspace.setTextValue", workspaceId, projectId: projects.projects[0].projectId, propertyId: property.propertyId, value: "Initial notes" });
    await query(page, { type: "workspace.activate", workspaceId }); await page.reload();
    const en = language === "en";
    const selectView = async id => { const snapshot = await query(page, { type: "workspace.listViews", workspaceId }); await pressEnabled(page, page.getByRole("tab", { name: snapshot.views.find(view => view.viewId === id).name, exact: true })); };
    const actions = () => page.getByRole("button", { name: /^(View actions|Действия с представлением):/ });
    const name = () => page.getByLabel(en ? "View name" : "Название представления", { exact: true });
    const layout = () => page.getByLabel(en ? "Layout" : "Компоновка", { exact: true });
    const edit = () => page.getByRole("menuitem", { name: en ? "Edit view" : "Изменить представление", exact: true });
    await pressEnabled(page, page.getByRole("button", { name: en ? "New view" : "Новое представление", exact: true }));
    await name().press("Enter"); await page.getByRole("alert").waitFor();
    await name().fill("Review"); await layout().selectOption("board"); await name().press("Enter");
    const board = () => page.getByRole("list", { name: en ? "Project cards" : "Карточки проектов", exact: true });
    await board().getByText("Initial notes", { exact: true }).waitFor();
    const boardId = (await query(page, { type: "workspace.listViews", workspaceId })).activeViewId;
    const value = board().getByRole("button", { name: `${en ? "Edit Text value" : "Редактировать Text-значение"}: Project / Notes`, exact: true });
    await pressEnabled(page, value);
    await board().getByRole("textbox").fill("Board keyboard edit");
    await pressEnabled(page, board().getByRole("button", { name: en ? "Save value" : "Сохранить значение", exact: true }));
    await board().getByText("Board keyboard edit", { exact: true }).waitFor();
    assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId: sibling.workspaceId })).values[0].value, "Board keyboard edit");
    const filters = [], grouping = [];
    filters.push(await exerciseViewFilters({ page, query, workspaceId, projectId: projects.projects[0].projectId, propertyId: property.propertyId, language, layout: "board", evidenceDirectory }));
    grouping.push(await exerciseSelectionGrouping({ page, query, workspaceId, language, layout: "board", evidenceDirectory }));
    grouping.push(await exerciseViewGrouping({ page, query, workspaceId, propertyId: property.propertyId, language, layout: "board", evidenceDirectory }));
    await openRuntimeViewActions(page,actions()); await pressEnabled(page, page.getByRole("menuitem", { name: en ? "Duplicate view" : "Дублировать представление", exact: true }));
    await name().fill("Copy"); await name().press("Enter");
    await page.getByRole("tab", { name: "Copy", exact: true }).and(page.locator('[aria-selected="true"]')).waitFor();
    await openRuntimeViewActions(page,actions()); await pressEnabled(page, edit()); await layout().selectOption("table"); await name().press("Enter");
    await page.getByRole("table").getByText("Board keyboard edit", { exact: true }).waitFor();
    filters.push(await exerciseViewFilters({ page, query, workspaceId, projectId: projects.projects[0].projectId, propertyId: property.propertyId, language, layout: "table", evidenceDirectory }));
    grouping.push(await exerciseSelectionGrouping({ page, query, workspaceId, language, layout: "table", evidenceDirectory }));
    grouping.push(await exerciseViewGrouping({ page, query, workspaceId, propertyId: property.propertyId, language, layout: "table", evidenceDirectory }));
    for (const width of [360, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 960 : 720 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-table.png`), fullPage: true });
    }
    await openRuntimeViewActions(page,actions()); await pressEnabled(page, page.getByRole("menuitem", { name: en ? "Move view earlier" : "Переместить представление раньше", exact: true }));
    await openRuntimeViewActions(page,actions()); await pressEnabled(page, page.getByRole("menuitem", { name: en ? "Delete view" : "Удалить представление", exact: true }));
    await page.getByRole("button", { name: en ? "Confirm delete view" : "Подтвердить удаление представления", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label")?.match(/^(View actions|Действия с представлением):/));
    assert.equal(await actions().evaluate(element => element === document.activeElement), true);
    await openRuntimeViewActions(page,actions()); await pressEnabled(page, page.getByRole("menuitem", { name: en ? "Delete view" : "Удалить представление", exact: true }));
    await pressEnabled(page, page.getByRole("button", { name: en ? "Confirm delete view" : "Подтвердить удаление представления", exact: true }));
    await selectView(boardId); await board().waitFor();
    const snapshot = await query(page, { type: "workspace.listViews", workspaceId });
    assert.deepEqual(snapshot.views.map(v => [v.name, v.kind]), [["Table", "table"], ["Review", "board"]]);
    assert.equal((await query(page, { type: "workspace.listViews", workspaceId: sibling.workspaceId })).views.length, 1);
    for (const width of [360, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 960 : 720 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-board.png`), fullPage: true });
    }
    await close(); ({ page } = await launch());
    assert.deepEqual(await query(page, { type: "workspace.listViews", workspaceId }), snapshot);
    await board().getByText("Board keyboard edit", { exact: true }).waitFor();
    assert.deepEqual(await readdir(source), ["Project"]); assert.equal(await readFile(join(source, "Project", "keep"), "utf8"), "unchanged");
    const archiveLocation = await query(page, { type: "workspace.previewArchiveLocation", workspaceId, relativePath: "Archive" });
    await query(page, { type: "workspace.applyArchiveLocation", workspaceId, operationId: randomUUID(), previewToken: archiveLocation.previewToken });
    const archive = await query(page, { type: "workspace.previewProjectArchive", workspaceId, projectId: projects.projects[0].projectId, action: "archive", name: null, createParent: false });
    const archived = await query(page, { type: "workspace.applyProjectArchive", workspaceId, operationId: randomUUID(), previewToken: archive.previewToken });
    assert.equal(archived.operation.stage, "completed");
    await page.getByRole("button", { name: en ? "Archived" : "Архив", exact: true }).click();
    await board().getByText("Board keyboard edit", { exact: true }).waitFor();
    await selectView(workspace.viewId);
    await page.getByRole("table").getByText("Board keyboard edit", { exact: true }).waitFor();
    await selectView(boardId); await board().getByText("Board keyboard edit", { exact: true }).waitFor();
    await page.screenshot({ path: join(evidenceDirectory, `${language}-archived-board.png`), fullPage: true });
    assert.equal(await readFile(join(source, "Archive", "Project", "keep"), "utf8"), "unchanged");
    const categoryRoot = join(fixture, `categories-${language}`);
    await mkdir(join(categoryRoot, "Category", "Project"), { recursive: true }); await mkdir(join(categoryRoot, "Empty"));
    const categoryGrouping = await exerciseCategoryGrouping({ page, query, rootPath: categoryRoot, language, evidenceDirectory });
    const recoveryRoot = join(fixture, `recovery-${language}`);
    await mkdir(join(recoveryRoot, "Retained"), { recursive: true });
    const retainedGrouping = await exerciseRetainedCategoryGrouping({ page, query, rootPath: recoveryRoot, language, evidenceDirectory });
    assert.deepEqual(await readdir(recoveryRoot), ["Retained"]);
    const tableRoot = join(fixture, `table-layout-${language}`);
    await mkdir(join(tableRoot,"Alpha"), {recursive:true}); await mkdir(join(tableRoot,"Beta"));
    const tableLayout = await exerciseTableLayout({page,query,rootPath:tableRoot,language,evidenceDirectory});
    const boardRoot = join(fixture, `board-layout-${language}`);
    await mkdir(join(boardRoot,"Alpha"), {recursive:true}); await mkdir(join(boardRoot,"Beta"));
    const boardLayout = await exerciseBoardLayout({page,query,rootPath:boardRoot,language,evidenceDirectory});
    const assignmentRoot = join(fixture, `group-assignment-${language}`);
    await mkdir(join(assignmentRoot,"Alpha"), {recursive:true}); await mkdir(join(assignmentRoot,"Beta"));
    const groupAssignment = await exerciseGroupAssignment({page,query,rootPath:assignmentRoot,language,evidenceDirectory});
    const folderAssignment = await exerciseFolderGroupAssignment({page,query,rootPath:join(fixture,`${language}-folder-assignment`),language,evidenceDirectory});
    evidence.checks.push({language,folderAssignment});
    const metadataRemoval = await exerciseMetadataRemoval({page,query,rootPath:join(fixture,`${language}-metadata-removal`),language,evidenceDirectory});
    evidence.checks.push({language,metadataRemoval});
    evidence.checks.push({ language, groupAssignment, boardLayout, tableLayout, filters, grouping, categoryGrouping, retainedGrouping, keyboard: true, table: true, board: true, lifecycle: true, independentCopy: true, sourceSibling: true, activeArchived: true, restart: true, filesUnchanged: true, widths: [360, 1024, 1440] });
  }
  await close(); evidence.status = "passed";
} catch (error) {
  failure = error; evidence.status = "failed"; evidence.failure = { name: error.name, message: error.message };
  if (session) try {
    const page = await session.firstWindow();
    await page.screenshot({ path: join(evidenceDirectory, "failure.png"), fullPage: true });
    await writeFile(join(evidenceDirectory, "failure.txt"), await page.locator("body").innerText());
    await close();
  } catch (closeError) { evidence.shutdownFailure = closeError.message; }
} finally {
  await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(children, backendPids, { launchUnverified }), primaryFailure: failure,
    record: async cleanup => { evidence.cleanup = cleanup; await writeFile(join(evidenceDirectory, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n"); } });
}
console.info(`Views ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
