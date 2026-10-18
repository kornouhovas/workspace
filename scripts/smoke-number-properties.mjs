import { openPropertyCreator } from "./property-editor-driver.mjs";
/* global window, document, innerWidth */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
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
const fixture = await realpath(await mkdtemp(join(tmpdir(), "number-property-runtime-")));
const dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-23-number-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 23, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], shutdowns: [], cleanup: null, status: "running" };
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
    const workspace = await query(page, { type: "workspace.create", rootPath: source, name: `Number ${language}` });
    const workspaceId = workspace.workspaceId;
    const sibling = await query(page, { type: "workspace.create", rootPath: source, name: `Sibling ${language}` });
    const preview = await query(page, { type: "workspace.previewDiscovery", workspaceId, mode: "direct" });
    const projects = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
    await query(page, { type: "workspace.activate", workspaceId });
    await page.reload();
    const name = await openPropertyCreator(page, {
      createLabel: language === "en" ? "Create Number property" : "Создать Number-свойство",
      propertyNameLabel: language === "en" ? "Property name" : "Название свойства",
    });
    await name.fill("Budget"); await name.press("Enter");
    const label = `${language === "en" ? "Edit Number value" : "Редактировать Number-значение"}: Project / Budget`;
    const button = page.getByRole("button", { name: label, exact: true });
    await button.focus(); await button.press("Enter");
    const editor = page.getByRole("textbox", { name: label, exact: true });
    await editor.fill(language === "en" ? "(2+3)*4/2+0.5" : "(2+3)*4/2+0,5"); await editor.press("Enter");
    await button.filter({ hasText: language === "en" ? "10.5" : "10,5" }).waitFor();
    assert.equal(await button.evaluate(element => element === document.activeElement), true);
    const snapshot = await query(page, { type: "workspace.listTextProperties", workspaceId });
    assert.equal(snapshot.numberValues[0].value, 10.5);
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId: sibling.workspaceId }), { ...snapshot, workspaceId: sibling.workspaceId });
    await button.press("Enter"); await editor.fill("1/0"); await editor.press("Enter");
    await page.getByRole("alert").filter({ hasText: language === "en" ? "Enter valid arithmetic" : "Введите корректное выражение" }).waitFor();
    assert.equal(await editor.inputValue(), "1/0");
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId }), snapshot);
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1024 ? 720 : 960 });
      assert.ok(await editor.isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-invalid.png`), fullPage: true });
    }
    assert.equal(await editor.evaluate(element => element === document.activeElement), true, "Failed save restores keyboard focus without locator refocusing");
    await page.keyboard.press("Escape");
    assert.equal(await button.evaluate(element => element === document.activeElement), true);
    await close(); ({ page } = await launch());
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId }), snapshot);
    const reopenedButton = page.getByRole("button", { name: label, exact: true });
    await reopenedButton.waitFor(); await reopenedButton.press("Enter");
    const reopenedEditor = page.getByRole("textbox", { name: label, exact: true });
    await reopenedEditor.fill(""); await reopenedEditor.press("Enter");
    await reopenedButton.waitFor();
    const cleared = await query(page, { type: "workspace.listTextProperties", workspaceId }); assert.deepEqual(cleared.numberValues, []);
    assert.equal(await readFile(join(source, "Project", "keep"), "utf8"), "unchanged");
    assert.equal(projects.projects[0].projectId, snapshot.numberValues[0].projectId);
    evidence.checks.push({ language, keyboard: true, computed: true, malformedPreserves: true, sibling: true, restart: true, clear: true, filesUnchanged: true, widths: [1024, 1440] });
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
console.info(`Number properties ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
