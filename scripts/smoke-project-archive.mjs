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
const fixture = await realpath(await mkdtemp(join(tmpdir(), "project-archive-runtime-")));
const dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-22-project-archive-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 22, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], shutdowns: [], cleanup: null, status: "running" };
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
  for (const discoveryMode of ["direct", "grouped"]) for (const language of ["en", "ru"]) {
    const source = join(fixture, `${discoveryMode}-${language}`);
    const original = discoveryMode === "direct" ? "Project" : "Client/Project";
    await mkdir(join(source, original), { recursive: true });
    await writeFile(join(source, original, "sentinel"), "exact bytes\n");
    const workspace = await query(page, { type: "workspace.create", name: `${discoveryMode} ${language}`, rootPath: source });
    const workspaceId = workspace.workspaceId;
    const preview = await query(page, { type: "workspace.previewDiscovery", workspaceId, mode: discoveryMode });
    const initial = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
    const projectId = initial.projects[0].projectId;
    await query(page, { type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" });
    await query(page, { type: "workspace.activate", workspaceId });
    unwrap(await page.evaluate(language => window.workspace.settings({ type: "settings.setLanguage", language }), language));
    await page.reload();
    const labels = language === "en" ? {
      title: "Project archive", folder: "Archive folder relative to the source", locationReview: "Review archive folder", confirm: "Confirm archive folder", project: "Project to archive", review: "Review archive", apply: "Archive project", archived: "Archived", edit: "Edit Text value", save: "Save value", restoreProject: "Project to restore", restoreReview: "Review restore", restore: "Restore project", completed: "Folder operation completed."
    } : {
      title: "Архив проектов", folder: "Папка архива относительно источника", locationReview: "Проверить папку архива", confirm: "Подтвердить папку архива", project: "Проект для архивирования", review: "Проверить архивирование", apply: "Архивировать проект", archived: "Архив", edit: "Редактировать Text-значение", save: "Сохранить значение", restoreProject: "Проект для восстановления", restoreReview: "Проверить восстановление", restore: "Восстановить проект", completed: "Операция с папкой завершена."
    };
    const panel = page.getByRole("region", { name: labels.title, exact: true });
    await panel.locator("summary").click();
    await panel.getByLabel(labels.folder, { exact: true }).fill("Archive");
    await panel.getByRole("button", { name: labels.locationReview, exact: true }).click();
    await panel.getByRole("button", { name: labels.confirm, exact: true }).click();
    await panel.getByLabel(labels.project, { exact: true }).selectOption(projectId);
    await panel.getByRole("button", { name: labels.review, exact: true }).click();
    await panel.getByRole("button", { name: labels.apply, exact: true }).click();
    await panel.getByText(labels.completed, { exact: true }).waitFor();
    assert.equal(await readFile(join(source, "Archive", original, "sentinel"), "utf8"), "exact bytes\n");
    await panel.getByRole("button", { name: labels.archived, exact: true }).click();
    const editLabel = `${labels.edit}: Project / Notes`;
    await panel.getByRole("button", { name: editLabel, exact: true }).click();
    await panel.getByRole("textbox", { name: editLabel, exact: true }).fill("  archived\nТекст  ");
    await panel.getByRole("button", { name: labels.save, exact: true }).click();
    await panel.getByRole("button", { name: editLabel, exact: true }).waitFor();
    for (const [width, height] of [[1440, 960], [1024, 720]]) {
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, "Archive screen fits its viewport");
      await page.screenshot({ path: join(evidenceDirectory, `${discoveryMode}-${language}-${width}-archived.png`), fullPage: true });
      evidence.checks.push({ scenario: "archive-layout", discoveryMode, language, width, passed: true });
    }
    await close(); ({ page } = await launch());
    const saved = await query(page, { type: "workspace.listArchivedProjects", workspaceId });
    assert.equal(saved.projects[0].projectId, projectId);
    assert.equal(saved.projects[0].originalRelativePath, original);
    const reopenedPanel = page.getByRole("region", { name: labels.title, exact: true });
    await reopenedPanel.getByRole("button", { name: labels.archived, exact: true }).click();
    await reopenedPanel.getByLabel(labels.restoreProject, { exact: true }).selectOption(projectId);
    await reopenedPanel.getByRole("button", { name: labels.restoreReview, exact: true }).click();
    await reopenedPanel.getByRole("button", { name: labels.restore, exact: true }).click();
    await reopenedPanel.getByText(labels.completed, { exact: true }).waitFor();
    assert.equal((await query(page, { type: "workspace.listProjects", workspaceId })).projects[0].projectId, projectId);
    assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId })).values.find(v => v.projectId === projectId).value, "  archived\nТекст  ");
    assert.equal(await readFile(join(source, original, "sentinel"), "utf8"), "exact bytes\n");
    evidence.checks.push({ scenario: "archive-text-restart-restore-ui", discoveryMode, language, passed: true });
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
console.info(`Project archive ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
