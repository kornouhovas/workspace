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
import { openPropertyCreator } from "./property-editor-driver.mjs";
import { enterContextFor } from "./runtime-context-tools.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "dev";
assert.ok(["dev", "release"].includes(mode));
const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "select-property-runtime-")));
const dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-25-select-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 25, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], shutdowns: [], cleanup: null, status: "running" };
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
  let { page } = await launch();
  for (const language of ["en", "ru"]) {
    const source = join(fixture, language); await mkdir(source); await mkdir(join(source, "Project"));
    await writeFile(join(source, "Project", "keep"), "unchanged");
    await page.evaluate(language => window.workspace.settings({ type: "settings.setLanguage", language }), language);
    const workspace = await query(page, { type: "workspace.create", rootPath: source, name: `Select ${language}` });
    const workspaceId = workspace.workspaceId;
    const sibling = await query(page, { type: "workspace.create", rootPath: source, name: `Sibling ${language}` });
    const preview = await query(page, { type: "workspace.previewDiscovery", workspaceId, mode: "direct" });
    const projects = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
    await query(page, { type: "workspace.activate", workspaceId }); await page.reload();
    const en = language === "en";
    const propertyName = await openPropertyCreator(page, {
      createLabel: en ? "Create Single Select property" : "Создать Single Select-свойство",
      propertyNameLabel: en ? "Property name" : "Название свойства",
    });
    await propertyName.fill("Status"); await propertyName.press("Enter");
    await enterContextFor(page,page.locator("summary").filter({ hasText: en ? "Select options: Status" : "Опции Select: Status" }));
    const add = page.getByRole("button", { name: en ? "Add option" : "Добавить опцию", exact: true });
    await add.press("Enter");
    const name = page.getByLabel(en ? "Option name" : "Название опции", { exact: true });
    await name.press("Enter"); await page.getByRole("alert").waitFor();
    assert.equal(await name.inputValue(), "");
    await name.fill("Ready");
    await page.getByLabel(en ? "Color" : "Цвет", { exact: true }).selectOption("blue");
    await name.press("Enter");
    const hide = page.getByRole("button", { name: en ? "Hide option: Ready" : "Скрыть опцию: Ready", exact: true }); await hide.waitFor();
    const snapshot = await query(page, { type: "workspace.listTextProperties", workspaceId });
    const propertyId = snapshot.definitions[0].propertyId, optionId = snapshot.selectOptions[0].optionId;
    const label = `${en ? "Edit Single Select value" : "Редактировать Single Select-значение"}: Project / Status`;
    const button = page.getByRole("button", { name: label, exact: true });
    await button.press("Enter");
    const editor = page.getByRole("combobox", { name: label, exact: true });
    await editor.selectOption(optionId); await button.filter({ hasText: "Ready" }).waitFor();
    assert.equal(await button.evaluate(element => element === document.activeElement), true);
    await hide.click();
    await page.getByRole("button", { name: en ? "Show option: Ready" : "Показать опцию: Ready", exact: true }).waitFor();
    const hidden = await query(page, { type: "workspace.listTextProperties", workspaceId });
    assert.equal(hidden.selectValues[0].optionId, optionId); assert.equal(hidden.selectOptions[0].hidden, true);
    assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId: sibling.workspaceId })).selectOptions[0].hidden, false);
    await page.getByRole("button", { name: en ? "Edit option: Ready" : "Изменить опцию: Ready", exact: true }).click();
    await name.fill("Готово"); await page.getByLabel(en ? "Color" : "Цвет", { exact: true }).selectOption("green"); await name.press("Enter");
    await button.filter({ hasText: "Готово" }).waitFor();
    await add.click(); await name.fill("Second"); await name.press("Enter");
    await page.getByRole("button", { name: en ? "Move option up: Second" : "Переместить опцию выше: Second", exact: true }).click();
    await page.waitForFunction(async ({ workspaceId }) => (await window.workspace.workspace({ type: "workspace.listTextProperties", workspaceId })).value.selectOptions[0].name === "Second", { workspaceId });
    await button.press("Enter");
    assert.equal(await editor.inputValue(), optionId);
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1024 ? 720 : 960 });
      assert.ok(await editor.isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-select.png`), fullPage: true });
    }
    await editor.press("Escape");
    const beforeRestart = await query(page, { type: "workspace.listTextProperties", workspaceId });
    assert.equal(beforeRestart.selectOptions[1].optionId, optionId); assert.equal(beforeRestart.selectOptions[1].name, "Готово");
    await close(); ({ page } = await launch());
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId }), beforeRestart);
    const reopened = page.getByRole("button", { name: label, exact: true }); await reopened.press("Enter");
    await page.getByRole("button", { name: en ? "Clear value" : "Очистить значение", exact: true }).click();
    await reopened.waitFor();
    assert.deepEqual((await query(page, { type: "workspace.listTextProperties", workspaceId })).selectValues, []);
    await reopened.press("Enter");
    assert.equal(await page.getByRole("combobox", { name: label, exact: true }).getByRole("option").filter({ hasText: "Готово" }).count(), 0);
    await page.keyboard.press("Escape");
    await query(page, { type: "workspace.updateSelectOption", workspaceId: sibling.workspaceId, propertyId, optionId, name: "Sibling rename", color: "red" });
    await enterContextFor(page,page.locator("summary").filter({ hasText: en ? "Select options: Status" : "Опции Select: Status" }));
    await page.getByRole("button", { name: en ? "Show option: Sibling rename" : "Показать опцию: Sibling rename", exact: true }).waitFor();
    assert.deepEqual(await readdir(source), ["Project"]); assert.deepEqual(await readdir(join(source, "Project")), ["keep"]);
    assert.equal(await readFile(join(source, "Project", "keep"), "utf8"), "unchanged");
    const final = await query(page, { type: "workspace.listTextProperties", workspaceId });
    assert.equal(final.selectOptions[1].optionId, optionId);
    assert.equal(projects.projects[0].projectId, hidden.selectValues[0].projectId);
    evidence.checks.push({ language, keyboard: true, options: true, renameColorOrder: true, hiddenUsagesRetained: true, sibling: true, restart: true, clear: true, invalidDraft: true, filesUnchanged: true, widths: [1024, 1440] });
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
console.info(`Single Select ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
