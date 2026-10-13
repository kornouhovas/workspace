/* global window, document, innerWidth */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { closeElectron, cleanupOwnedFixture, ownedProcessesStopped } from "./runtime-lifecycle.mjs";
import { packagedExecutablePath } from "./runtime-executable.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "dev";
assert.ok(["dev", "release"].includes(mode));
const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "category-options-runtime-")));
const source = join(fixture, "source"), dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-20-category-options-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 20, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], shutdowns: [], cleanup: null, status: "running" };
const children = new Set(), backendPids = new Set();
let session, failure, launchUnverified = false;
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = (page, input) => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
async function launch() {
  launchUnverified = true;
  const app = await _electron.launch({ executablePath, args: mode === "dev" ? [root] : [], cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: dataDirectory }, timeout: 30000 });
  children.add(app.process()); session = app;
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid));
  assert.ok(pids.length > 0); for (const pid of pids) backendPids.add(pid);
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === "ready");
  launchUnverified = false;
  return { app, page };
}
async function close() {
  if (!session) return;
  await closeElectron(session); session = undefined;
  for (const pid of backendPids) {
    let stopped = false;
    for (let i = 0; i < 50; i++) {
      try { process.kill(pid, 0); } catch (error) { if (error.code !== "ESRCH") throw error; stopped = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(stopped, true, "Backend exited after ordinary quit");
  }
  evidence.shutdowns.push({ normalQuit: true, backendExited: true });
}
try {
  await mkdir(join(source, "Original", "Project"), { recursive: true });
  await writeFile(join(source, "Original", "Project", "sentinel"), "  exact bytes\n");
  let { app, page } = await launch();
  const workspace = await query(page, { type: "workspace.create", name: "Category options fixture", rootPath: source });
  const sibling = await query(page, { type: "workspace.create", name: "Sibling", rootPath: source });
  const workspaceId = workspace.workspaceId;
  const review = await query(page, { type: "workspace.previewDiscovery", workspaceId, mode: "grouped" });
  const initial = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: review.previewToken });
  await query(page, { type: "workspace.activate", workspaceId });
  const project = initial.projects[0], categoryId = project.categoryId;
  const property = await query(page, { type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" });
  await query(page, { type: "workspace.setTextValue", workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  exact\nТекст  " });
  const beforeValues = await query(page, { type: "workspace.listTextProperties", workspaceId });
  const labels = {
    en: { options: "Category options", action: "Folder action", name: "Folder name", choose: "Category to rename", preview: "Preview folder effect", apply: "Apply folder operation", color: "Color", hidden: "Hidden", save: "Save presentation", saved: "Category changes saved.", close: "Close category options" },
    ru: { options: "Настроить категории", action: "Действие с папкой", name: "Имя папки", choose: "Категория для переименования", preview: "Просмотреть изменения", apply: "Применить к папке", color: "Цвет", hidden: "Скрыта", save: "Сохранить оформление", saved: "Изменения категорий сохранены.", close: "Закрыть настройки категорий" },
  };
  for (const language of ["en", "ru"]) {
    const l = labels[language];
    unwrap(await page.evaluate(language => window.workspace.settings({ type: "settings.setLanguage", language }), language));
    await page.reload();
    await page.getByRole("button", { name: l.options, exact: true }).click();
    await page.getByLabel(l.name, { exact: true }).waitFor();
    await page.getByLabel(l.action, { exact: true }).selectOption("rename");
    await page.getByLabel(l.choose, { exact: true }).selectOption(categoryId);
    const current = (await query(page, { type: "workspace.listProjects", workspaceId })).categories.find(c => c.categoryId === categoryId).name;
    const next = language === "en" ? "Renamed category" : "Переименованная категория";
    await page.getByLabel(l.name, { exact: true }).fill(next);
    await page.getByRole("button", { name: l.preview, exact: true }).click();
    await page.getByRole("button", { name: l.apply, exact: true }).waitFor();
    for (const [width, height] of [[1440, 960], [1024, 720]]) {
      await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, "No horizontal viewport overflow");
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-${mode}-preview.png`), fullPage: true });
      evidence.checks.push({ scenario: "preview-layout", language, width, height, passed: true });
    }
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: l.apply, exact: true }).count(), 0);
    assert.equal(await readFile(join(source, current, "Project", "sentinel"), "utf8"), "  exact bytes\n");
    await page.getByRole("button", { name: l.preview, exact: true }).click();
    await page.getByRole("button", { name: l.apply, exact: true }).click();
    await page.getByText(l.saved, { exact: true }).waitFor();
    const siblingList = await query(page, { type: "workspace.listProjects", workspaceId: sibling.workspaceId });
    assert.equal(siblingList.projects[0].projectId, project.projectId); assert.equal(siblingList.projects[0].categoryId, categoryId);
    assert.equal(siblingList.projects[0].relativePath, `${next}/Project`);
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId }), beforeValues);
    await page.getByLabel(`${l.color}: ${next}`, { exact: true }).selectOption("purple");
    const option = page.locator(".category-options__list li").filter({ hasText: next });
    await option.getByRole("checkbox").check();
    await page.getByRole("button", { name: l.save, exact: true }).click();
    await page.waitForFunction(async ({ workspaceId }) => (await window.workspace.workspace({ type: "workspace.listCategoryPresentation", workspaceId })).value?.options[0]?.hidden === true, { workspaceId });
    const presentation = await query(page, { type: "workspace.listCategoryPresentation", workspaceId });
    assert.equal(presentation.options[0].color, "purple"); assert.equal(presentation.options[0].hidden, true);
    const otherPresentation = await query(page, { type: "workspace.listCategoryPresentation", workspaceId: sibling.workspaceId });
    assert.equal(otherPresentation.options[0].hidden, false);
    evidence.checks.push({ scenario: "rename-cancel-apply-identity-values-presentation-siblings", language, passed: true });
    await page.getByRole("button", { name: l.close, exact: true }).click();
  }
  // Separate create and association UI routes; no folder is silently adopted by
  // the new-folder action. The explicit reload observes the fixture's external
  // folder addition before a human-style read-only association review.
  const l = labels.ru;
  await page.getByRole("button", { name: l.options, exact: true }).click();
  await page.getByLabel(l.action, { exact: true }).selectOption("create");
  await page.getByLabel(l.name, { exact: true }).fill("Empty category");
  await page.getByRole("button", { name: l.preview, exact: true }).click();
  await page.getByRole("button", { name: l.apply, exact: true }).click();
  await page.getByText(l.saved, { exact: true }).waitFor();
  assert.deepEqual(await readdir(join(source, "Empty category")), []);
  await mkdir(join(source, "Existing category", "Second project"), { recursive: true });
  await writeFile(join(source, "Existing category", "Second project", "sentinel"), "associated bytes");
  await query(page, { type: "workspace.refreshSource", workspaceId });
  await page.reload();
  await page.getByRole("button", { name: l.options, exact: true }).click();
  await page.getByLabel(l.action, { exact: true }).selectOption("associate");
  await page.getByLabel(l.name, { exact: true }).fill("Existing category");
  await page.getByRole("button", { name: l.preview, exact: true }).click();
  await page.locator(".category-options__review").getByText("Existing category/Second project → Existing category/Second project", { exact: true }).waitFor();
  await page.getByRole("button", { name: l.apply, exact: true }).click();
  await page.getByText(l.saved, { exact: true }).waitFor();
  const associated = await query(page, { type: "workspace.listProjects", workspaceId });
  assert.equal(associated.projects.length, 2);
  assert.ok(associated.projects.some(p => p.relativePath === "Existing category/Second project"));
  assert.equal(await readFile(join(source, "Existing category", "Second project", "sentinel"), "utf8"), "associated bytes");
  evidence.checks.push({ scenario: "explicit-create-empty-and-associate-existing-ui", passed: true });
  const invalid = await page.evaluate(workspaceId => window.workspace.workspace({ type: "workspace.previewCategoryFolder", workspaceId, action: "create", name: "Escape", categoryId: null, path: "../escape" }), workspaceId);
  assert.equal(invalid.ok, false); assert.equal(invalid.error.code, "invalid_input");
  evidence.checks.push({ scenario: "production-ipc-exact-validation", passed: true });
  const expected = await query(page, { type: "workspace.listProjects", workspaceId });
  await close();
  ({ app, page } = await launch());
  const reopened = await query(page, { type: "workspace.listProjects", workspaceId });
  assert.deepEqual(reopened, expected);
  assert.equal(await readFile(join(source, "Переименованная категория", "Project", "sentinel"), "utf8"), "  exact bytes\n");
  assert.deepEqual((await readdir(source)).sort(), ["Empty category", "Existing category", "Переименованная категория"]);
  evidence.checks.push({ scenario: "electron-restart-persistence", passed: true });
  await close(); evidence.status = "passed";
} catch (error) {
  failure = error; evidence.status = "failed"; evidence.failure = { name: error.name, message: error.message };
  if (session) try { await close(); } catch (closeError) { evidence.shutdownFailure = closeError.message; }
} finally {
  await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(children, backendPids, { launchUnverified }), primaryFailure: failure,
    record: async cleanup => { evidence.cleanup = cleanup; await writeFile(join(evidenceDirectory, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n"); } });
}
console.info(`Category options ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
