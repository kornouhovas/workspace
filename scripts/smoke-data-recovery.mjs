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
const fixture = await realpath(await mkdtemp(join(tmpdir(), "data-recovery-runtime-")));
const dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-37-data-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 37, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], shutdowns: [], cleanup: null, status: "running" };
const children = new Set(), backendPids = new Set();
let session, failure, launchUnverified = false;
const quitEvents = new WeakMap();
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = (page, input) => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
async function pressEnabled(page, button) {
  const enabled = button.and(page.locator(":enabled"));
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
    for (const event of ["before-quit", "will-quit", "quit", "window-all-closed"]) if (chunk.toString().includes(`[data-recovery-quit:${event}]`)) record(event);
  });
  await app.evaluate(({ app }) => {
    for (const event of ["before-quit", "will-quit", "quit", "window-all-closed"]) app.on(event, () => process.stdout.write(`[data-recovery-quit:${event}]\n`));
  });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid));
  assert.ok(pids.length > 0); for (const pid of pids) backendPids.add(pid);
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === "ready");
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
  let { app, page } = await launch();
  for (const language of ["en", "ru"]) {
    const en = language === "en", source = join(fixture, language);
    await mkdir(source); await mkdir(join(source, "Project"));
    await writeFile(join(source, "Project", "keep"), "separate project bytes");
    const workspace = await query(page, { type: "workspace.create", rootPath: source, name: `Restore ${language}` });
    const { workspaceId } = workspace;
    await query(page, { type: "workspace.create", rootPath: source, name: `Sibling ${language}` });
    const preview = await query(page, { type: "workspace.previewDiscovery", workspaceId });
    const list = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
    const { propertyId } = await query(page, { type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" });
    const projectId = list.projects[0].projectId;
    await query(page, { type: "workspace.setTextValue", workspaceId, projectId, propertyId, value: "Restored exact notes" });
    await query(page, { type: "workspace.createView", workspaceId, name: "Independent Board", kind: "board" });
    await page.evaluate(language => window.workspace.settings({ type: "settings.setLanguage", language }), language);
    await page.reload();
    const title = () => page.locator("#data-title");
    await title().click();
    const exportButton = page.getByRole("button", { name: en ? "Export application data" : "Экспортировать данные приложения", exact: true });
    const exportPath = join(fixture, `export-${language}.json`);
    const download = app.evaluate(({ session }, path) => new Promise(resolve => {
      session.defaultSession.once("will-download", (_event, item) => {
        item.setSavePath(path); item.once("done", (_event, state) => resolve(state));
      });
    }), exportPath);
    await pressEnabled(page, exportButton);
    assert.equal(await download, "completed");
    const beforeBackup = await query(page, { type: "data.backups" });
    assert.equal(beforeBackup.backups.state, "ready");
    const createBackup = page.getByRole("button", { name: en ? "Create backup / retry" : "Создать копию / повторить", exact: true });
    await pressEnabled(page, createBackup);
    await page.waitForFunction(() => !Array.from(document.querySelectorAll(".data-recovery button")).find(b => b.textContent === "Create backup / retry" || b.textContent === "Создать копию / повторить")?.disabled);
    const afterBackup = await query(page, { type: "data.backups" });
    assert.equal(afterBackup.backups.state, "ready");
    assert.equal(afterBackup.backups.snapshots.length, beforeBackup.backups.snapshots.length + 1);
    const selectedBackup = afterBackup.backups.snapshots[0].id;
    await page.locator("#backup-selection").selectOption(selectedBackup);
    const reviewBackup = page.getByRole("button", { name: en ? "Review restore from backup" : "Проверить восстановление из копии", exact: true });
    const envelope = JSON.parse(await readFile(exportPath, "utf8"));
    assert.equal(envelope.format, "workspace-application-data"); assert.equal(envelope.version, 1);
    await query(page, { type: "workspace.setTextValue", workspaceId, projectId, propertyId, value: "Changed since snapshot" });
    const input = () => page.locator("#data-file");
    const confirm = () => page.getByRole("button", { name: en ? "Replace application data" : "Заменить данные приложения", exact: true });
    const cancel = () => page.getByRole("button", { name: en ? "Cancel restore" : "Отменить восстановление", exact: true });
    await input().setInputFiles(exportPath); await confirm().waitFor({ state: "visible" });
    await confirm().focus(); await page.keyboard.press("Escape");
    await input().waitFor({ state: "visible" }); assert.equal(await input().evaluate(el => document.activeElement === el), true);
    await input().setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{invalid") });
    await pressEnabled(page, confirm()); await page.locator(".data-recovery [role='alert']").waitFor();
    await pressEnabled(page, cancel());
    assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId })).values[0].value, "Changed since snapshot");
    await pressEnabled(page, reviewBackup); await confirm().waitFor({ state: "visible" });
    for (const width of [360, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-confirm.png`), fullPage: true });
    }
    await pressEnabled(page, confirm());
    await page.waitForFunction(() => !document.querySelector("details.data-recovery")?.open);
    assert.equal((await page.evaluate(() => window.workspace.settings({ type: "settings.load" }))).value.language, language);
    assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId })).values[0].value, "Restored exact notes");
    assert.equal(await readFile(join(source, "Project", "keep"), "utf8"), "separate project bytes");
    await close(); ({ app, page } = await launch());
    assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId })).values[0].value, "Restored exact notes");
    evidence.checks.push({ language, actualDownload: true, backupStatus: true, backupCreate: true, backupSelectionRestore: true, keyboardCancel: true, invalidPreserves: true, restore: true, restart: true, projectFilesSeparate: true, widths: [360, 1024, 1440] });
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
console.info(`Data recovery ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
