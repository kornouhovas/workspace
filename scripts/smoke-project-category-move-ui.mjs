import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { packagedExecutablePath } from "./runtime-executable.mjs";
import { cleanupOwnedFixture, closeRuntimeSession, ownedProcessesStopped, withDeadline } from "./runtime-lifecycle.mjs";
import { createRenameRuntimeStartup } from "./rename-runtime-startup.mjs";
import { measureDiscoveryLayout } from "./runtime-layout.mjs";
import { assertCategoryMoveAcceptance, createCategoryMoveEvidence, recordCategoryMoveEvidence } from "./runtime-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = async (page, type, workspaceId, extra = {}) => unwrap(await page.evaluate(input => globalThis.window.workspace.workspace(input), { type: `workspace.${type}`, ...(workspaceId === undefined ? {} : { workspaceId }), ...extra }));
const labels = {
  en: { move: "Move project category", submit: "Move project folder", saved: "Project folder moved to the selected category.", unchanged: "The current category was verified. No folder move was needed.", occupied: "The destination is occupied or reserved. Choose another category.", unavailable: "This folder or category is unavailable. Check source access and the project association." },
  ru: { move: "Переместить проект в категорию", submit: "Переместить папку проекта", saved: "Папка проекта перемещена в выбранную категорию.", unchanged: "Текущая категория проверена. Перемещение папки не потребовалось.", occupied: "Назначение занято или зарезервировано. Выберите другую категорию.", unavailable: "Папка или категория недоступна. Проверьте доступ к источнику и привязку проекта." },
};

// Bind by the intended project action and category, then assert exact authored
// text. No guessed composite accessible cell name; both may repeat across rows.
export async function assertRuntimeCategoryCell(page, projectName, categoryName, moveLabel, eligible = true) {
  moveLabel ??= labels[await page.locator("#interface-language").inputValue()].move;
  const normalize = value => value.replace(/\s+/g, " ").trim();
  let cell = page.getByRole("cell").filter({ hasText: categoryName.trim() });
  if (eligible) cell = cell.filter({ has: page.getByRole("button", { name: normalize(`${moveLabel}: ${projectName}`), exact: true }) });
  await cell.waitFor();
  assert.equal(await cell.count(), 1, "Unique intended project/category cell");
  assert.equal(await cell.locator("..").locator("td").nth(0).evaluate(node => node.querySelector(".property-authored")?.textContent), projectName);
  assert.equal(await cell.evaluate(node => node.firstChild?.textContent), categoryName, "Exact authored category text");
  assert.equal(await cell.getByRole("button").count(), eligible ? 1 : 0);
  if (eligible) {
    const action = cell.getByRole("button", { name: `${moveLabel}: ${projectName}`.replace(/\s+/g, " ").trim(), exact: true });
    assert.equal(await action.isDisabled(), false);
  }
  return cell;
}

export async function categoryMoveInventory(path) {
  const info = await lstat(path, { bigint: true });
  assert.equal(info.isSymbolicLink(), false, "No-follow fixture tree");
  const identity = { dev: String(info.dev), ino: String(info.ino), birthtimeNs: String(info.birthtimeNs) };
  if (info.isDirectory()) {
    const children = [];
    for (const name of (await readdir(path)).sort()) children.push([name, await categoryMoveInventory(join(path, name))]);
    return { identity, mode: Number(info.mode & 0o777n), children };
  }
  assert.equal(info.isFile(), true);
  return { identity, mode: Number(info.mode & 0o777n), bytes: (await readFile(path)).toString("hex") };
}

export async function categoryMoveMetadata(database) {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(database, { readonly: true });
  try {
    return Object.fromEntries(["workspaces", "views", "active_workspace", "sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "settings"].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()]));
  } finally { db.close(); }
}

// Fixture preparation uses the existing service only before the production app
// consumes the database. No production failure injection or mutation seam.
export async function seedCategoryMoveFixture(data) {
  await mkdir(data, { recursive: true });
  const sourceRoot = join(data, "root"), otherRoot = join(data, "other");
  const name = "  Exact 日本語 📝  ";
  for (const path of [join(sourceRoot, "Current", name, "nested"), join(sourceRoot, "Destination"), join(sourceRoot, "Occupied", name), join(sourceRoot, "Unavailable"), join(otherRoot, "Other project")]) await mkdir(path, { recursive: true });
  await writeFile(join(sourceRoot, "Current", name, "sentinel"), "original bytes\0日本語\n");
  await writeFile(join(sourceRoot, "Current", name, "nested", "note"), "nested bytes\n");
  await writeFile(join(sourceRoot, "Occupied", name, "sentinel"), "occupied bytes\0retained");
  await writeFile(join(otherRoot, "Other project", "sentinel"), "unrelated bytes\0");
  const database = join(data, "workspace.sqlite");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const service = openSettingsService(database);
  let setup;
  try {
    const command = input => unwrap(service.handleCommand(input));
    const read = input => unwrap(service.handleQuery(input));
    const workspace = command({ type: "workspace.create", name: "Category move", rootPath: sourceRoot });
    const sibling = command({ type: "workspace.create", name: "Sibling", rootPath: sourceRoot });
    const other = command({ type: "workspace.create", name: "Other", rootPath: otherRoot });
    for (const [entry, mode] of [[workspace, "grouped"], [other, "direct"]]) {
      const preview = read({ type: "workspace.previewDiscovery", workspaceId: entry.workspaceId, mode });
      command({ type: "workspace.applyDiscovery", workspaceId: entry.workspaceId, previewToken: preview.previewToken });
    }
    let projection = read({ type: "workspace.listProjects", workspaceId: workspace.workspaceId });
    const project = projection.projects.find(p => p.name === name && p.relativePath.startsWith("Current/")); assert.ok(project);
    command({ type: "workspace.renameCategoryProperty", workspaceId: workspace.workspaceId, propertyId: projection.categoryProperty.propertyId, name: "  Exact category label 📝  " });
    const property = command({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "  Notes 📝  ", propertyType: "text" });
    command({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст\t  " });
    command({ type: "workspace.activate", workspaceId: workspace.workspaceId });
    projection = read({ type: "workspace.listProjects", workspaceId: workspace.workspaceId });
    const properties = read({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId });
    const otherProjection = read({ type: "workspace.listProjects", workspaceId: other.workspaceId });
    const otherProperties = read({ type: "workspace.listTextProperties", workspaceId: other.workspaceId });
    const configurations = read({ type: "workspace.load" });
    setup = { data, database, sourceRoot, otherRoot, workspace, sibling, other, project, projection, properties, otherProjection, otherProperties, configurations };
  } finally { service.close(); }
  // Owned, distinct per-workspace view names make accidental sharing observable.
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(database);
  try { for (const entry of [setup.workspace, setup.sibling, setup.other]) db.prepare("UPDATE views SET name = ? WHERE id = ?").run(`${entry.name} independent view`, entry.viewId); }
  finally { db.close(); }
  setup.metadata = await categoryMoveMetadata(database);
  setup.tree = await categoryMoveInventory(sourceRoot);
  setup.projectTree = await categoryMoveInventory(join(sourceRoot, "Current", name));
  setup.otherTree = await categoryMoveInventory(otherRoot);
  return setup;
}

export async function categoryMoveRuntimeInputs(mode, executablePath) {
  const digest = createHash("sha256");
  const hashes = {};
  async function include(path) {
    const bytes = await readFile(join(root, path));
    hashes[path] = createHash("sha256").update(bytes).digest("hex");
    digest.update(path).update("\0").update(hashes[path]).update("\0");
  }
  async function tree(path) {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) await tree(`${path}/${entry.name}`);
      else { assert.equal(entry.isFile(), true); await include(`${path}/${entry.name}`); }
    }
  }
  for (const path of ["package.json", "package-lock.json", "scripts/smoke-runtime.mjs", "scripts/smoke-project-category-move-ui.mjs", "scripts/runtime-evidence.mjs", "scripts/runtime-executable.mjs", "scripts/rename-runtime-startup.mjs", "scripts/runtime-startup.mjs", "scripts/runtime-lifecycle.mjs", "scripts/runtime-layout.mjs", "dist/desktop/main.cjs", "dist/desktop/preload.cjs", "dist/service/settings.mjs", "dist/service/entry.cjs", "node_modules/better-sqlite3/package.json", "node_modules/better-sqlite3/lib/binding.js", `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`]) await include(path);
  for (const path of ["src/contracts", "src/service", "src/desktop", "src/renderer", "dist/renderer", "dist/service/db/migrations", "dist/service/native", "dist/desktop/native"]) await tree(path);
  if (mode === "release") {
    const resources = process.platform === "darwin" ? resolve(dirname(executablePath), "../Resources") : join(dirname(executablePath), "resources");
    async function artifact(path, logicalPath) {
      const info = await lstat(path); assert.equal(info.isSymbolicLink(), false);
      if (info.isDirectory()) {
        for (const name of (await readdir(path)).sort()) await artifact(join(path, name), `${logicalPath}/${name}`);
      } else {
        assert.equal(info.isFile(), true);
        hashes[logicalPath] = createHash("sha256").update(await readFile(path)).digest("hex");
        digest.update(logicalPath).update("\0").update(hashes[logicalPath]).update("\0");
      }
    }
    for (const path of ["app.asar", "app.asar.unpacked", "native"]) await artifact(join(resources, path), `packaged/${path}`);
  }
  return { inputs: { mode, platform: process.platform, arch: process.arch, node: process.version,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), inputDigest: digest.digest("hex") }, hashes };
}

export async function runProjectCategoryMoveUi(mode = "dev") {
  assert.ok(["dev", "release"].includes(mode));
  const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
  await stat(executablePath);
  const directory = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work", `category-move-ui-${mode}-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  const { inputs, hashes } = await categoryMoveRuntimeInputs(mode, executablePath);
  await writeFile(join(directory, `${mode}-category-move-inputs.json`), JSON.stringify({ inputs, hashes }, null, 2) + "\n");
  const evidence = createCategoryMoveEvidence(inputs), observations = [], shutdowns = [];
  const ownedProcesses = new Set(), backendPids = new Set();
  const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-category-move-ui-")));
  let failure, active;
  const save = async () => writeFile(join(directory, `${mode}-category-move-observations.json`), JSON.stringify({
    scope: "grouped production UI/preload/backend moves and rejections; recovery and final platform acceptance remain separate", inputs,
    status: failure ? "failed" : evidence.fixtureCleanup.status === "passed" ? "passed" : "pending", evidence, observations, shutdowns,
    ...(failure ? { error: failure.message } : {}),
  }, null, 2) + "\n");
  const check = async (target, stage, assertion) => {
    active = { target, stage };
    const details = await assertion() ?? {};
    recordCategoryMoveEvidence(target, stage, { status: "passed", asserted: true, ...details });
    active = undefined; await save();
  };
  const startup = createRenameRuntimeStartup({ launchElectron: options => _electron.launch(options), ownedProcesses, backendPids,
    recordStartup: async outcome => { observations.push({ startup: outcome }); await save(); } });
  async function launch(data) {
    const page = await startup.launch({ executablePath, args: mode === "dev" ? [root] : [], cwd: root, env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
    await check(evidence, "isolation", async () => {
      assert.deepEqual(await startup.current.electron.evaluate(({ BrowserWindow, app }) => {
        const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return { contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, sandbox: p.sandbox, userData: app.getPath("userData"), sessionData: app.getPath("sessionData") };
      }), { contextIsolation: true, nodeIntegration: false, sandbox: true, userData: data, sessionData: data });
      assert.equal(await page.evaluate(() => typeof process), "undefined"); assert.equal(await page.evaluate(() => typeof require), "undefined");
    });
    return page;
  }
  async function shutdown() {
    const closing = startup.current; startup.clearCurrent();
    const outcome = { passed: false }; shutdowns.push(outcome);
    try {
      await closeRuntimeSession(closing.electron, { shutdown: outcome, readBackendPids: startup.readBackendPids, beforeClose: save,
        assertBackendsStopped: async pids => {
          for (const pid of pids) await withDeadline((async () => {
            for (let attempt = 0; attempt < 50; attempt++) {
              try { process.kill(pid, 0); } catch (error) { if (error.code === "ESRCH") return; throw error; }
              await new Promise(done => setTimeout(done, 100));
            }
            throw new Error("Category move backend survived normal quit");
          })(), 5000, "Category move backend exit");
        } });
    } catch (error) { recordCategoryMoveEvidence(evidence, "normalShutdown", { status: "failed", reason: error.message, forcedCleanup: error.forcedCleanup }); throw error; }
    await save();
  }
  async function select(page, workspace, language) {
    await page.locator("#interface-language").selectOption(language);
    await page.waitForFunction(lang => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
    await page.locator("#workspace-switcher").selectOption(workspace.workspaceId);
    await page.getByRole("heading", { name: workspace.name, exact: true }).waitFor();
    await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false" && globalThis.document.querySelector(".category-move-operations")?.getAttribute("aria-busy") === "false");
  }
  async function capture(page, language, state) {
    for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
      await page.setViewportSize(size);
      const layout = await measureDiscoveryLayout(page);
      assert.equal(layout.document, false); assert.deepEqual(layout.clippedControls, []);
      for (const button of await page.locator(".project-category-move button, .project-category-move select").all()) {
        const reachable = await button.evaluate(async node => {
          node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          await new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done)));
          const r = node.getBoundingClientRect();
          return r.left >= 0 && r.right <= globalThis.innerWidth && r.top >= 0 && r.bottom <= globalThis.innerHeight;
        });
        assert.equal(reachable, true, "Reachable category move control");
      }
      observations.push({ layout: { language, state, viewport: size, ...layout } });
      await page.screenshot({ path: join(directory, `${mode}-${language}-${state}-${size.width}.png`), fullPage: true });
    }
    await save();
  }
  async function preserved(page, setup, categoryName) {
    const list = await query(page, "listProjects", setup.workspace.workspaceId);
    const category = setup.projection.categories.find(c => c.name === categoryName); assert.ok(category);
    const project = list.projects.find(p => p.projectId === setup.project.projectId); assert.ok(project);
    assert.equal(project.name, setup.project.name); assert.equal(project.categoryId, category.categoryId);
    assert.equal(project.relativePath, `${categoryName}/${setup.project.name}`);
    assert.deepEqual(list.projects.filter(p => p.projectId !== project.projectId), setup.projection.projects.filter(p => p.projectId !== project.projectId));
    assert.deepEqual(list.retainedProjects, []); assert.deepEqual(list.categories, setup.projection.categories);
    assert.deepEqual(list.categoryProperty, setup.projection.categoryProperty); assert.equal(list.categoryPropertyRevision, setup.projection.categoryPropertyRevision);
    assert.deepEqual(await query(page, "listTextProperties", setup.workspace.workspaceId), setup.properties);
    assert.deepEqual(await categoryMoveInventory(join(setup.sourceRoot, categoryName, setup.project.name)), setup.projectTree);
    assert.equal((await readdir(join(setup.sourceRoot, categoryName))).includes(setup.project.name), true, "Exact basename spelling");
    const expectedTree = structuredClone(setup.tree);
    if (categoryName !== "Current") {
      const original = expectedTree.children.find(([name]) => name === "Current")[1];
      const destination = expectedTree.children.find(([name]) => name === categoryName)[1];
      destination.children.push(original.children.pop()); destination.children.sort(([a], [b]) => a.localeCompare(b));
    }
    assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), expectedTree);
    assert.deepEqual(await categoryMoveInventory(setup.otherRoot), setup.otherTree);
    assert.deepEqual(await query(page, "listProjects", setup.other.workspaceId), setup.otherProjection);
    assert.deepEqual(await query(page, "listTextProperties", setup.other.workspaceId), setup.otherProperties);
    assert.deepEqual((await query(page, "load")).workspaces, setup.configurations.workspaces);
    const metadata = await categoryMoveMetadata(setup.database);
    const expectedMetadata = structuredClone(setup.metadata);
    const storedProject = expectedMetadata.projects.find(p => p.id === setup.project.projectId);
    storedProject.category_id = category.categoryId; storedProject.relative_path = project.relativePath;
    expectedMetadata.sources.find(s => s.id === setup.workspace.sourceId).discovery_revision = list.revision;
    assert.deepEqual(metadata, expectedMetadata);
    return list;
  }
  async function openEditor(page, setup, t) {
    const list = await query(page, "listProjects", setup.workspace.workspaceId);
    const project = list.projects.find(p => p.projectId === setup.project.projectId);
    const cell = await assertRuntimeCategoryCell(page, project.name, project.categoryName, t.move);
    const trigger = cell.getByRole("button", { name: `${t.move}: ${setup.project.name}`.replace(/\s+/g, " ").trim(), exact: true });
    await trigger.press("Enter");
    const input = page.locator("#project-category-move-destination"); await input.waitFor();
    await page.waitForFunction(() => { const node = globalThis.document.querySelector("#project-category-move-destination"); return node && !node.disabled && node === globalThis.document.activeElement; }, undefined, { timeout: 15000 });
    return input;
  }
  async function closeEditor(page) {
    const input = page.locator("#project-category-move-destination");
    if (await input.count()) await page.locator(".project-category-move form button[type=button]").press("Enter");
    await input.waitFor({ state: "detached" });
  }
  try {
    for (const language of ["en", "ru"]) {
      const target = evidence[language], t = labels[language];
      console.info(`Category move ${mode}: ${language} grouped moves/rejections/restart`);
      let setup;
      await check(target, "seed", async () => { setup = await seedCategoryMoveFixture(join(fixture, language)); return { realSQLite: true, noFollowTree: true }; });
      let page = await launch(setup.data); await select(page, setup.workspace, language);
      setup.metadata.settings = (await categoryMoveMetadata(setup.database)).settings;
      await check(target, "readOnlyReopen", async () => {
        await preserved(page, setup, "Current");
        assert.deepEqual((await query(page, "listProjectCategoryMoves", setup.workspace.workspaceId)).operations, []);
        await assertRuntimeCategoryCell(page, setup.project.name, "Current", t.move);
      });
      await page.evaluate(() => { globalThis.categoryMoveEvents = []; globalThis.window.workspace.onWorkspaceChange(event => { if (event.type === "workspace.projectsChanged") globalThis.categoryMoveEvents.push(event); }); });
      const destination = setup.projection.categories.find(c => c.name === "Destination");
      await check(target, "submission", async () => {
        const input = await openEditor(page, setup, t); await input.selectOption(destination.categoryId);
        await capture(page, language, "editing"); await input.press("Enter");
        await page.getByText(t.saved, { exact: true }).waitFor(); await input.waitFor({ state: "detached" });
        const list = await preserved(page, setup, "Destination");
        assert.equal(list.revision, setup.projection.revision + 1);
        const events = await page.evaluate(() => globalThis.categoryMoveEvents);
        assert.equal(events.length, 1); assert.deepEqual(new Set(events[0].workspaceIds), new Set([setup.workspace.workspaceId, setup.sibling.workspaceId]));
      });
      await check(target, "currentCategory", async () => {
        const before = await query(page, "listProjects", setup.workspace.workspaceId);
        const input = await openEditor(page, setup, t); await input.selectOption(destination.categoryId); await input.press("Enter");
        await page.getByText(t.unchanged, { exact: true }).waitFor(); await input.waitFor({ state: "detached" });
        assert.deepEqual(await query(page, "listProjects", setup.workspace.workspaceId), before);
        assert.equal((await page.evaluate(() => globalThis.categoryMoveEvents)).length, 1);
        await preserved(page, setup, "Destination"); await capture(page, language, "unchanged");
      });
      await check(target, "occupied", async () => {
        const before = await query(page, "listProjects", setup.workspace.workspaceId);
        const input = await openEditor(page, setup, t); const category = setup.projection.categories.find(c => c.name === "Occupied");
        await input.selectOption(category.categoryId); await input.press("Enter"); await page.getByText(t.occupied, { exact: true }).waitFor();
        assert.equal(await input.inputValue(), category.categoryId); await capture(page, language, "occupied");
        assert.deepEqual(await query(page, "listProjects", setup.workspace.workspaceId), before);
        await preserved(page, setup, "Destination"); await closeEditor(page);
      });
      await check(target, "unavailable", async () => {
        const input = await openEditor(page, setup, t); const category = setup.projection.categories.find(c => c.name === "Unavailable");
        await input.selectOption(category.categoryId);
        // Move only this owned empty category outside the selected root while
        // the editor is open. No permissions/global or production seam changes.
        const from = join(setup.sourceRoot, category.name), to = join(setup.data, "unavailable-category");
        const beforeTree = await categoryMoveInventory(setup.sourceRoot);
        await rename(from, to);
        const beforeSubmit = await categoryMoveInventory(setup.sourceRoot);
        await input.press("Enter");
        // Production revalidates the selected unavailable destination. A later
        // observer update may reset an unsubmitted editor; it must not move.
        await page.getByText(t.unavailable, { exact: true }).waitFor();
        assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), beforeSubmit);
        await capture(page, language, "unavailable"); await closeEditor(page);
        await rename(to, from);
        assert.deepEqual(await categoryMoveInventory(setup.sourceRoot), beforeTree);
        await page.getByRole("button", { name: language === "en" ? "Refresh source" : "Обновить источник", exact: true }).press("Enter");
        await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false");
      });
      await check(target, "sibling", async () => {
        await select(page, setup.sibling, language);
        await assertRuntimeCategoryCell(page, setup.project.name, "Destination", t.move);
        const list = await query(page, "listProjects", setup.sibling.workspaceId);
        assert.equal(list.projects.find(p => p.projectId === setup.project.projectId).categoryId, destination.categoryId);
        assert.deepEqual(await query(page, "listTextProperties", setup.sibling.workspaceId), { ...setup.properties, workspaceId: setup.sibling.workspaceId });
        await select(page, setup.workspace, language);
      });
      await check(target, "preservation", async () => { await preserved(page, setup, "Destination"); });
      await check(target, "layout", async () => {
        await assertRuntimeCategoryCell(page, setup.project.name, "Destination", t.move);
        await capture(page, language, "saved");
      });
      const settings = unwrap(await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" })));
      await shutdown(); page = await launch(setup.data); await select(page, setup.workspace, language);
      await check(target, "restartPersistence", async () => {
        await preserved(page, setup, "Destination"); await assertRuntimeCategoryCell(page, setup.project.name, "Destination", t.move);
        assert.deepEqual(unwrap(await page.evaluate(() => globalThis.window.workspace.settings({ type: "settings.load" }))), settings);
        assert.deepEqual((await query(page, "listProjectCategoryMoves", setup.workspace.workspaceId)).operations, []);
        assert.equal((await query(page, "load")).activeWorkspace.viewId, setup.workspace.viewId);
      });
      await shutdown();
    }
    assert.ok(shutdowns.length >= 4 && shutdowns.every(outcome => outcome.passed && !outcome.forcedCleanup));
    recordCategoryMoveEvidence(evidence, "normalShutdown", { status: "passed", asserted: true, normalQuit: true, backendExit: true, forcedCleanup: false, invocations: shutdowns.length });
    const finalInputs = (await categoryMoveRuntimeInputs(mode, executablePath)).inputs;
    assert.deepEqual(finalInputs, inputs, "Runtime inputs stayed unchanged for the entire fixture");
  } catch (error) {
    failure = error;
    if (active) recordCategoryMoveEvidence(active.target, active.stage, { status: "failed", reason: error.message });
    if (startup.current?.page) await startup.current.page.screenshot({ path: join(directory, `${mode}-category-move-failed.png`), fullPage: true, timeout: 3000 }).catch(() => {});
    await save().catch(() => {});
  } finally {
    if (startup.current) { try { await shutdown(); } catch (error) { failure ??= error; } }
    await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(ownedProcesses, backendPids, { launchUnverified: startup.launchUnverified }), primaryFailure: failure,
      record: async outcome => {
        if (outcome.status === "passed") await assert.rejects(stat(fixture), { code: "ENOENT" });
        recordCategoryMoveEvidence(evidence, "fixtureCleanup", { ...outcome, removed: outcome.status === "passed" });
        try { if (!failure) assertCategoryMoveAcceptance(evidence, inputs); } catch (error) { failure = error; }
        await save(); if (failure) throw failure;
      } });
  }
  assertCategoryMoveAcceptance(evidence, inputs);
  console.info(`Graphical category move ${mode} grouped EN/RU slice passed; evidence ${directory}`);
}
