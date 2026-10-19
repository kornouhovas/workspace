/* global window, document, innerWidth */
import assert from "node:assert/strict";
import { openPropertyCreator } from "./property-editor-driver.mjs";
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
const fixture = await realpath(await mkdtemp(join(tmpdir(), "date-property-runtime-")));
const dataDirectory = join(fixture, "app-data");
const evidenceDirectory = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-24-date-runtime");
await mkdir(evidenceDirectory, { recursive: true });
const evidence = { issue: 24, mode, platform: process.platform, sha: process.env.GITHUB_SHA ?? null, checks: [], shutdowns: [], cleanup: null, status: "running" };
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
    const workspace = await query(page, { type: "workspace.create", rootPath: source, name: `Date ${language}` });
    const workspaceId = workspace.workspaceId;
    const sibling = await query(page, { type: "workspace.create", rootPath: source, name: `Sibling ${language}` });
    const preview = await query(page, { type: "workspace.previewDiscovery", workspaceId, mode: "direct" });
    const projects = await query(page, { type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
    await query(page, { type: "workspace.activate", workspaceId });
    await page.reload();
    const name = await openPropertyCreator(page, {
      createLabel: language === "en" ? "Create Date property" : "Создать Date-свойство",
      propertyNameLabel: language === "en" ? "Property name" : "Название свойства",
    });
    await name.fill("Deadline"); await name.press("Enter");
    const label = `${language === "en" ? "Edit Date value" : "Редактировать Date-значение"}: Project / Deadline`;
    const button = page.getByRole("button", { name: label, exact: true });
    await button.focus(); await button.press("Enter");
    const editor = page.getByRole("textbox", { name: label, exact: true });
    await editor.fill("2024-02-29"); await editor.press("Enter");
    await button.filter({ hasText: language === "en" ? "Feb 29, 2024" : "29 февр. 2024 г." }).waitFor();
    assert.equal(await button.evaluate(element => element === document.activeElement), true);
    const snapshot = await query(page, { type: "workspace.listTextProperties", workspaceId });
    assert.equal(snapshot.dateValues[0].value, "2024-02-29");
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId: sibling.workspaceId }), { ...snapshot, workspaceId: sibling.workspaceId });
    const cdp = await page.context().newCDPSession(page);
    for (const timezoneId of ["America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Apia"]) {
      await cdp.send("Emulation.setTimezoneOverride", { timezoneId });
      assert.equal(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), timezoneId);
      for (const [value, en, ru] of [["0001-01-01", "Jan 1, 1", "1 янв. 1 г."], ["0099-12-31", "Dec 31, 99", "31 дек. 99 г."], ["2011-12-30", "Dec 30, 2011", "30 дек. 2011 г."], ["2025-03-09", "Mar 9, 2025", "9 мар. 2025 г."], ["9999-12-31", "Dec 31, 9999", "31 дек. 9999 г."]]) {
        await query(page, { type: "workspace.setDateValue", workspaceId, projectId: projects.projects[0].projectId, propertyId: snapshot.definitions[0].propertyId, value });
        await button.filter({ hasText: language === "en" ? en : ru }).waitFor();
        assert.equal((await query(page, { type: "workspace.listTextProperties", workspaceId })).dateValues[0].value, value);
      }
    }
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "" });
    await cdp.detach();
    await query(page, { type: "workspace.setDateValue", workspaceId, projectId: projects.projects[0].projectId, propertyId: snapshot.definitions[0].propertyId, value: "2024-02-29" });
    const beforeInvalid = await query(page, { type: "workspace.listTextProperties", workspaceId });
    await button.filter({ hasText: language === "en" ? "Feb 29, 2024" : "29 февр. 2024 г." }).waitFor();
    await button.press("Enter"); await editor.fill("2025-02-29"); await editor.press("Enter");
    await page.getByRole("alert").filter({ hasText: language === "en" ? "Enter a real date" : "Введите существующую дату" }).waitFor();
    assert.equal(await editor.inputValue(), "2025-02-29");
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId }), beforeInvalid);
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1024 ? 720 : 960 });
      assert.ok(await editor.isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(evidenceDirectory, `${language}-${width}-invalid.png`), fullPage: true });
    }
    assert.equal(await editor.evaluate(element => element === document.activeElement), true, "Failed save restores focus before switching language");
    const otherLanguage = language === "en" ? "ru" : "en";
    await page.getByLabel(language === "en" ? "Interface language" : "Язык интерфейса", { exact: true }).selectOption(otherLanguage);
    const otherLabel = `${otherLanguage === "en" ? "Edit Date value" : "Редактировать Date-значение"}: Project / Deadline`;
    const switchedEditor = page.getByRole("textbox", { name: otherLabel, exact: true });
    assert.equal(await switchedEditor.inputValue(), "2025-02-29");
    await page.getByLabel(otherLanguage === "en" ? "Interface language" : "Язык интерфейса", { exact: true }).selectOption(language);
    await editor.focus();
    assert.equal(await editor.evaluate(element => element === document.activeElement), true, "Editor remains keyboard operable after switching language");
    await page.keyboard.press("Escape");
    assert.equal(await button.evaluate(element => element === document.activeElement), true);
    await close(); ({ page } = await launch());
    assert.deepEqual(await query(page, { type: "workspace.listTextProperties", workspaceId }), beforeInvalid);
    const reopenedButton = page.getByRole("button", { name: label, exact: true });
    await reopenedButton.waitFor(); await reopenedButton.press("Enter");
    const reopenedEditor = page.getByRole("textbox", { name: label, exact: true });
    await reopenedEditor.fill(""); await reopenedEditor.press("Enter");
    await reopenedButton.waitFor();
    const cleared = await query(page, { type: "workspace.listTextProperties", workspaceId }); assert.deepEqual(cleared.dateValues, []);
    assert.equal(await readFile(join(source, "Project", "keep"), "utf8"), "unchanged");
    assert.equal(projects.projects[0].projectId, snapshot.dateValues[0].projectId);
    evidence.checks.push({ language, keyboard: true, calendarDate: true, malformedPreserves: true, timezoneBoundaries: true, languageSwitch: true, sibling: true, restart: true, clear: true, filesUnchanged: true, widths: [1024, 1440] });
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
console.info(`Date properties ${mode} runtime: ${evidence.checks.length} checks passed, normal shutdown and fixture cleanup verified.`);
