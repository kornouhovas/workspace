/* global window, document, requestAnimationFrame, DataTransfer */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { cpus, totalmem, tmpdir, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { _electron } from "playwright-core";
import { createPerformanceFixture } from "./performance-fixture.mjs";
import { packagedExecutablePath } from "./runtime-executable.mjs";
import { cleanupOwnedFixture, closeElectron, ownedProcessesStopped } from "./runtime-lifecycle.mjs";

const root = resolve(process.env.WORKSPACE_PERFORMANCE_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-41-performance/baseline");
await mkdir(evidence, { recursive: true });
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-performance-")));
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const report = { issue: 41, sha, run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
  sourceDiffSha256: createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--binary"], {cwd:root})).digest("hex"),
  harnessSha256: createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).digest("hex"),
  platform: process.platform, arch: process.arch, kernel: release(), cpu: cpus()[0]?.model, hostMemoryBytes: totalmem(),
  storage: "local temporary directory; physical SSD characteristics not independently verified",
  dataset: { projectsPerSource: 1000, propertiesPerSource: 20, viewsPerWorkspace: 10, filledFraction: 0.25 },
  limits: { startup: 5000, scan: 5000, interaction: 300, memoryBytes: 1_000_000_000 },
  measurements: [], memory: [], shutdowns: [], status: "running" };
const parents = new Set(), backends = new Set();
let app, page, failure, launchUnverified = false;
const unwrap = result => { assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result)); return result.value; };
const query = input => page.evaluate(input => window.workspace.workspace(input), input).then(unwrap);
const record = (source, scenario, started, limit = report.limits.interaction) => {
  const ms = performance.now() - started;
  report.measurements.push({ source, scenario, ms, limit, passed: ms <= limit });
  console.log(`${source} ${scenario}: ${ms.toFixed(1)} ms (limit ${limit})`);
};
async function startUiTiming(locator, event) {
  await locator.evaluate((element, event) => {
    window.__workspacePerformanceStarted = undefined;
    element.addEventListener(event, () => { window.__workspacePerformanceStarted = performance.now(); }, { capture: true, once: true });
  }, event);
}
async function recordUi(source, scenario, limit = report.limits.interaction) {
  const ms = await page.evaluate(() => performance.now() - window.__workspacePerformanceStarted);
  assert.equal(Number.isFinite(ms), true, "The measured user event must have occurred");
  report.measurements.push({ source, scenario, ms, limit, passed: ms <= limit, clock: "renderer event through committed paint" });
  console.log(`${source} ${scenario}: ${ms.toFixed(1)} ms (limit ${limit})`);
}
async function painted() { await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); }
async function ready(ids) {
  await page.waitForFunction(ids => {
    const content = document.querySelector(".text-properties");
    if (!content || content.getAttribute("aria-busy") !== "false") return false;
    if (document.querySelector('[aria-busy="true"]')) return false;
    const rows = [...content.querySelectorAll("[data-project-id]")].map(row => row.getAttribute("data-project-id"));
    return ids ? rows.length === ids.length && rows.every((id, index) => id === ids[index]) : rows.length > 0;
  }, ids);
  await painted();
}
async function memory(scenario) {
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics().map(m => ({ type: m.type, serviceName: m.serviceName,
    workingSetKiB: m.memory.workingSetSize, peakWorkingSetKiB: m.memory.peakWorkingSetSize, cumulativeCpuSeconds: m.cpu.cumulativeCPUUsage })));
  // Sum working sets conservatively; shared pages can be counted more than once.
  const bytes = metrics.reduce((sum, m) => sum + m.workingSetKiB * 1024, 0);
  const peakUpperBoundBytes = metrics.reduce((sum, m) => sum + Math.max(m.workingSetKiB, m.peakWorkingSetKiB) * 1024, 0);
  const dom = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-project-id]").length,
    loadedRows: document.querySelectorAll('[data-fields-ready="true"]').length, nodes: document.querySelectorAll("*").length }));
  report.memory.push({ scenario, bytes, peakUpperBoundBytes, processes: metrics, dom, passed: peakUpperBoundBytes <= report.limits.memoryBytes });
}
async function launch(data, executable, expected, mode) {
  launchUnverified = true;
  const started = performance.now();
  app = await _electron.launch({ executablePath: executable, cwd: fixture,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
  parents.add(app.process());
  const events = []; (report.lifecycle ??= []).push({ source: mode, events });
  app.process().once("exit", (code, signal) => events.push({ event: "parent-exit", code, signal }));
  app.on("close", () => events.push({ event: "protocol-close" }));
  app.process().stdout?.on("data", chunk => {
    for (const event of ["before-quit", "will-quit", "quit", "window-all-closed", "node-exit"]) if (chunk.toString().includes(`[performance-quit:${event}]`)) events.push({ event });
  });
  await app.evaluate(({ app }) => {
    for (const event of ["before-quit", "will-quit", "quit", "window-all-closed"]) app.on(event, () => process.stdout.write(`[performance-quit:${event}]\n`));
    process.on("exit", () => process.stdout.write("[performance-quit:node-exit]\n"));
  });
  page = await app.firstWindow(); page.setDefaultTimeout(30000);
  const runtime = await app.evaluate(({ app, BrowserWindow }) => ({ packaged: app.isPackaged,
    isolation: (() => { const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(); return [p.contextIsolation, p.nodeIntegration, p.sandbox]; })(),
    backends: app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid) }));
  runtime.backends.forEach(pid => backends.add(pid));
  assert.equal(runtime.packaged, true); assert.deepEqual(runtime.isolation, [true, false, true]); assert.ok(runtime.backends.length);
  launchUnverified = false;
  await ready(expected); record(mode, "saved-view startup", started, report.limits.startup);
  await memory(`${mode} startup`);
}
async function stop() {
  const closing = app; app = undefined;
  const shutdown = { normalQuit: false, backendExited: false }; report.shutdowns.push(shutdown);
  try {
    await closeElectron(closing); shutdown.normalQuit = true;
    for (let i = 0; i < 50 && !ownedProcessesStopped(parents, backends); i++) await new Promise(done => setTimeout(done, 100));
    assert.equal(ownedProcessesStopped(parents, backends), true); shutdown.backendExited = true;
  } catch (error) { shutdown.error = error.message; shutdown.forcedCleanup = error.forcedCleanup; throw error; }
}
try {
  // Copy the distribution outside the checkout; neither cwd nor a development
  // renderer supplies the measured backend. The installer itself is #39/#40.
  const packaged = packagedExecutablePath(root, process.platform, process.arch);
  const bundle = process.platform === "darwin" ? resolve(packaged, "../../..") : dirname(packaged);
  const installed = join(fixture, process.platform === "darwin" ? "Workspace.app" : "installed");
  // Relative framework links must stay relative: rewriting them to the build
  // directory breaks macOS helper resource resolution after relocation.
  report.artifactSha256 = createHash("sha256").update(await readFile(join(bundle, process.platform === "darwin" ? "Contents/Resources/app.asar" : "resources/app.asar"))).digest("hex");
  await cp(bundle, installed, { recursive: true, verbatimSymlinks: true });
  const executable = process.platform === "darwin" ? join(installed, "Contents/MacOS/Workspace") : join(installed, "Workspace.exe");
  const { openSettingsService } = await import(pathToFileURL(join(root, "dist/service/settings.mjs")));
  console.log("Preparing public-service fixture (excluded from timings)");
  const dataset = await createPerformanceFixture(fixture, openSettingsService);
  await writeFile(join(fixture, "dataset.json"), JSON.stringify(dataset));
  console.log("Fixture ready");
  for (const source of dataset.sources) {
    try {
    // Persist selection through the same service before a fresh process launch.
    const service = openSettingsService(join(dataset.data, "workspace.sqlite"));
    unwrap(service.handleCommand({ type: "workspace.activate", workspaceId: source.workspaceId }));
    unwrap(service.handleCommand({ type: "settings.setLanguage", language: "en" }));
    const initialIds = unwrap(service.handleQuery({ type: "workspace.queryView", workspaceId: source.workspaceId, viewId: source.viewId, archived: false })).projectIds;
    assert.equal(initialIds.length, 1000); assert.equal(new Set(initialIds).size, 1000);
    service.close();
    const { workspaceId } = source;
    let activeIds = initialIds;
    const command = (name, fields = {}) => query({ type: `workspace.${name}`, workspaceId, ...fields });
    await launch(dataset.data, executable, initialIds, source.mode);
    assert.equal((await command("listTextProperties")).definitions.length, 20);
    for (const kind of ["table", "board"]) {
      const viewId = source.views.find(v => v.kind === kind).viewId;
      await page.getByLabel("Current view", { exact: true }).selectOption(viewId);
      await page.locator(kind === "board" ? ".project-board" : ".project-table").first().waitFor();
      const expected = (await command("queryView", { viewId, archived: false })).projectIds;
      await ready(expected); activeIds = expected;
      for (let sample = 0; sample < 3; sample++) {
        const text = sample % 2 ? "Project 0" : "Project 00";
        const search = page.getByLabel("Search project names", { exact: true });
        await search.fill(text);
        const save = page.getByRole("button", { name: "Save search and filters", exact: true }); await save.focus();
        await startUiTiming(save, "keydown"); await save.press("Enter");
        const ids = expected.filter(id => source.projects.find(p => p.projectId === id).name.includes(text));
        await ready(ids); await recordUi(source.mode, `${kind} filter ${sample}`);
        assert.deepEqual((await command("queryView", { viewId, archived: false })).projectIds, ids);
      }
      // Ordinary Select grouping retains exact option identities and an empty group.
      const property = source.properties.find(p => p.type === "single_select");
      const groupBy = page.getByLabel("Group by", { exact: true });
      await startUiTiming(groupBy, "change"); await groupBy.selectOption(property.propertyId);
      await page.locator(".project-group").first().waitFor();
      await ready(); await recordUi(source.mode, `${kind} grouping`);
      // Correctness reads run after the event-to-paint clock. They are not an
      // additional user action and must not inflate the measured interaction.
      const projection = await command("queryView", { viewId, archived: false });
      const groupIds = projection.groups.filter(g => !g.hidden && !g.collapsed).flatMap(g => g.projectIds);
      await ready(groupIds);
      await memory(`${source.mode} ${kind} grouped`);
      // Filtered assignment uses the production drag data and DOM drop handler.
      const origin = projection.groups.find(g => g.projectIds.includes(source.projects[0].projectId));
      const destination = projection.groups.find(g => g.value === property.options[kind === "table" ? 2 : 1] && g.key !== origin.key);
      assert.ok(origin && destination);
      const projectId = source.projects[0].projectId;
      const originGroup = page.locator(".project-group").filter({ has: page.locator("h3", { hasText: `${origin.label} (` }) });
      const handle = originGroup.locator(`[data-project-id="${projectId}"] .group-assignment-controls button[draggable]`);
      await handle.scrollIntoViewIfNeeded();
      const transfer = await page.evaluateHandle(() => new DataTransfer());
      await handle.dispatchEvent("dragstart", { dataTransfer: transfer });
      const group = page.locator(".project-group").filter({ has: page.locator("h3", { hasText: `${destination.label} (` }) });
      await startUiTiming(group, "drop");
      await group.dispatchEvent("drop", { dataTransfer: transfer }); await transfer.dispose();
      await page.getByRole("heading", { name: "Group value saved. Filters may hide the project from this view.", exact: true }).waitFor();
      await group.locator(`[data-project-id="${projectId}"]`).waitFor();
      await ready(); await recordUi(source.mode, `${kind} filtered group drag`);
      const assigned = await command("queryView", { viewId, archived: false });
      await ready(assigned.groups.flatMap(g => g.projectIds));
      assert.ok(assigned.groups.find(g => g.key === destination.key).projectIds.includes(projectId));
      // Reset through UI for a full-view edit, then verify the durable value.
      await page.getByLabel("Group by", { exact: true }).selectOption("");
      await page.getByLabel("Search project names", { exact: true }).fill("");
      await page.getByRole("button", { name: "Save search and filters", exact: true }).press("Enter"); await ready(expected);
      const p = source.projects[0], field = source.properties.find(p => p.type === "text");
      const row = page.locator(`[data-project-id="${p.projectId}"]`);
      await row.getByRole("button", { name: `Edit Text value: ${p.name} / text 0`, exact: true }).press("Enter");
      await row.locator("textarea, input").fill(`Accepted ${kind}`);
      const saveValue = row.getByRole("button", { name: "Save value", exact: true }); await saveValue.focus();
      await startUiTiming(saveValue, "keydown"); await saveValue.press("Enter");
      await row.getByText(`Accepted ${kind}`, { exact: true }).waitFor(); await ready(expected);
      await recordUi(source.mode, `${kind} edit`);
      assert.equal((await command("listTextProperties")).values.find(v => v.projectId === p.projectId && v.propertyId === field.propertyId).value, `Accepted ${kind}`);
      await page.screenshot({ path: join(evidence, `${source.mode}-${kind}-en.png`) });
    }
    const p = source.projects[0]; const renamed = p.relativePath.replace(p.name, "External rename");
    await rename(join(source.root, p.relativePath), join(source.root, renamed));
    const refresh = page.getByRole("button", { name: "Refresh source", exact: true });
    await startUiTiming(refresh, "keydown"); await refresh.press("Enter");
    await page.locator(`[data-project-id="${p.projectId}"]`).getByText("External rename", { exact: true }).waitFor();
    await ready(activeIds);
    await recordUi(source.mode, "external-change full scan and refresh", report.limits.scan);
    assert.deepEqual((await command("queryView", { viewId: source.views.find(v => v.kind === "board").viewId, archived: false })).projectIds, activeIds);
    const refreshed = await command("listProjects"); assert.equal(refreshed.projects.length, 1000);
    assert.equal(refreshed.projects.find(row => row.projectId === p.projectId).relativePath, renamed);
    assert.equal(await readFile(join(source.root, renamed, "preserved.txt"), "utf8"), "Keep project contents.\n");
    assert.equal((await command("listTextProperties")).values.find(v => v.projectId === p.projectId && v.propertyId === source.properties[0].propertyId).value, "Accepted board");
    await page.locator("#interface-language").selectOption("ru"); await page.setViewportSize({ width: 720, height: 900 });
    await page.waitForFunction(() => document.documentElement.lang === "ru");
    const last = source.projects.at(-1), lastRow = page.locator(`[data-project-id="${last.projectId}"]`);
    await lastRow.scrollIntoViewIfNeeded();
    const lastButton = lastRow.getByRole("button", { name: `Редактировать Text-значение: ${last.name} / text 3`, exact: true });
    await lastButton.press("Enter"); await lastRow.locator("textarea").fill("Unsubmitted draft");
    const refreshRu = page.getByRole("button", { name: "Обновить источник", exact: true });
    await startUiTiming(refreshRu, "keydown"); await refreshRu.press("Enter");
    await ready(activeIds); await recordUi(source.mode, "RU refresh with offscreen draft", report.limits.scan);
    assert.equal(await lastRow.locator("textarea").inputValue(), "Unsubmitted draft");
    await lastRow.locator("textarea").press("Escape");
    assert.equal(await lastButton.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(evidence, `${source.mode}-ru-narrow.png`) }); await memory(`${source.mode} final`);
    await stop();
    await launch(dataset.data, executable, activeIds, `${source.mode} reopen`);
    const reopened = await command("listTextProperties");
    assert.equal(reopened.values.find(v => v.projectId === p.projectId && v.propertyId === source.properties[0].propertyId).value, "Accepted board");
    assert.equal(reopened.values.find(v => v.projectId === last.projectId && v.propertyId === source.properties.find(p => p.type === "text" && p.slot === 3).propertyId).value, "Notes 9 — описание");
    assert.deepEqual((await command("listProjects")).projects.map(p => p.projectId).sort(), source.projects.map(p => p.projectId).sort());
    await stop();
    } catch (error) {
      const sourceFailure = { source: source.mode, error: error.stack };
      if (app) try { await stop(); } catch (shutdownError) { sourceFailure.shutdownError = shutdownError.message; }
      (report.scenarioFailures ??= []).push(sourceFailure);
      // Baseline measurements retain failures and may proceed to the other
      // source only after owned process termination is independently confirmed.
      if (process.argv.includes("--enforce") || launchUnverified || !ownedProcessesStopped(parents, backends)) throw error;
    }
  }
  if (report.scenarioFailures?.length) throw new Error("Source scenarios failed; inspect retained per-source failures");
  report.status = report.measurements.every(m => m.passed) && report.memory.every(m => m.passed) ? "passed" : "targets-missed";
  if (process.argv.includes("--enforce")) assert.equal(report.status, "passed", "Representative-scale targets missed; inspect raw report");
} catch (error) {
  failure = error; report.status = "failed"; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, "failure.png") }).catch(() => {});
} finally {
  if (app) try { await stop(); } catch (error) { failure ??= error; report.status = "failed"; report.shutdownError = error.message; }
  await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2));
  await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(parents, backends, { launchUnverified }), primaryFailure: failure,
    record: async cleanup => { report.cleanup = cleanup; await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2)); } });
}
