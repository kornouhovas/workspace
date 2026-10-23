import { enterContextFor } from "./runtime-context-tools.mjs";
import { createPerformanceQueries } from "./runtime-performance-queries.mjs";
import { inspectRuntimeProjectionFailure } from "./runtime-view-readiness.mjs";
import { instrumentPerformanceBackend, inspectPerformanceBackendBatches } from "./runtime-performance-backend-profile.mjs";
import { installPerformanceCommandProbe, inspectPerformanceWindow } from "./runtime-performance-probe.mjs";
import { openGroupingControls, closeGroupingControls } from "./runtime-presentation-controls.mjs";
import { activateRuntimeView, setRuntimeViewLanguage, pressRuntimeFilterSave } from "./runtime-view-controls.mjs";
import { readRuntimeInteraction, waitForRuntimeProjection } from "./runtime-performance-timing.mjs";
/* global window, document, DataTransfer, requestAnimationFrame */
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
const profileFilters = process.argv.includes("--profile-filters");
const profileBackend = process.argv.includes("--profile-backend");
const profileUnthrottled = process.argv.includes("--profile-unthrottled");
assert.ok(!profileUnthrottled || profileFilters, "Scheduling diagnostics require a separate renderer profile");
assert.ok(!profileBackend || profileFilters, "Backend probes require a separate diagnostic renderer profile");
assert.ok(!profileFilters || !process.argv.includes("--enforce"), "Profiled runs are diagnostic, never target acceptance");
const evidence = resolve(process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? "work/issue-41-performance/baseline");
await mkdir(evidence, { recursive: true });
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-performance-")));
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const report = { issue: 41, sha, run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, diagnostic: profileFilters, projectFlows: process.argv.includes('--project-flows'),
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
  await locator.evaluate((element, { event, trace }) => {
    window.__workspacePerformanceStarted = undefined;
    element.addEventListener(event, () => {
      window.__workspacePerformanceStarted = performance.now();
      if (trace) {
        window.__workspacePerformanceEnvironment={visibility:document.visibilityState,focused:document.hasFocus()};
        performance.mark("workspace-performance-event", { detail: { event } });
      }
    }, { capture: true, once: true });
  }, { event, trace: profileFilters });
}
async function startInteractionProfile(scheduling = false) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Profiler.enable"); await session.send("Profiler.start");
    await session.send("Tracing.start", { categories: "devtools.timeline,blink.user_timing,v8" + (scheduling ? ",toplevel,renderer.scheduler,cc,viz,gpu,disabled-by-default-devtools.timeline.frame" : ""), transferMode: "ReturnAsStream", streamFormat: "json" });
    return session;
  } catch (error) { await session.detach().catch(() => {}); throw error; }
}
async function stopInteractionProfile(session, name) {
  let handle, timer, completed, failure;
  try {
    const { profile } = await session.send("Profiler.stop");
    await writeFile(join(evidence, `${name}.cpuprofile`), JSON.stringify(profile));
    const completion = new Promise(resolve => {
      completed = resolve; session.once("Tracing.tracingComplete", completed);
    });
    const ending = Promise.all([session.send("Tracing.end"), completion]);
    const [, trace] = await Promise.race([ending, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Diagnostic tracing completion timed out")), 30000);
    })]);
    clearTimeout(timer);
    handle = trace.stream;
    assert.ok(handle, "Diagnostic trace must provide its stream");
    const chunks = [];
    let eof = false;
    while (!eof) {
      const part = await session.send("IO.read", { handle, size: 1048576 });
      chunks.push(Buffer.from(part.data, part.base64Encoded ? "base64" : "utf8")); eof = part.eof;
    }
    await writeFile(join(evidence, `${name}.trace.json`), Buffer.concat(chunks));
    assert.equal(trace.dataLossOccurred, false, "Diagnostic timeline must not lose events");
  } catch (error) { failure = error; }
  finally {
    clearTimeout(timer);
    if (completed) session.off("Tracing.tracingComplete", completed);
    try { if (handle) await session.send("IO.close", { handle }); } catch (error) { failure ??= error; }
    try { await session.detach(); } catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
}
let lastReadyTiming;
async function recordUi(source, scenario, limit = report.limits.interaction) {
  const timing = await readRuntimeInteraction(page, lastReadyTiming);
  const { ms } = timing;
  assert.equal(Number.isFinite(ms), true, "The measured user event must have occurred");
  report.measurements.push({ source, scenario, ...timing, limit, passed: ms <= limit, clock: "renderer event through committed paint" });
  console.log(`${source} ${scenario}: ${ms.toFixed(1)} ms (limit ${limit})`);
  if (profileFilters) {
    const eventWallTime = await page.evaluate(() => performance.timeOrigin + window.__workspacePerformanceStarted);
    const native = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {focused:window.isFocused(),visible:window.isVisible(),minimized:window.isMinimized(),commands:globalThis.__workspacePerformanceCommands ?? []};
    });
    const renderer = await page.evaluate(() => ({atEvent:window.__workspacePerformanceEnvironment,
      atObservation:{visibility:document.visibilityState,focused:document.hasFocus()}}));
    report.measurements[report.measurements.length - 1].diagnostic = {eventWallTime,...native,renderer,inspections:lastReadyTiming.inspections};
  }
}
async function ready(ids, endpoint) {
  try { lastReadyTiming = await waitForRuntimeProjection(page, ids, profileFilters, endpoint); }
  catch (error) {
    try { (report.readinessFailures ??= []).push(await page.evaluate(inspectRuntimeProjectionFailure, ids)); }
    catch { report.readinessInspectionFailed = true; }
    // Preserve the failed surface before per-source teardown closes the page.
    // This never retries an action or changes the original readiness deadline.
    try { await page.screenshot({ path: join(evidence, "projection-failure.png"), timeout: 3000 }); }
    catch { report.readinessScreenshotFailed = true; }
    throw error;
  }
}
// Expanded projects hide the saved view. Observe their own committed fields,
// tree and selected tab instead of weakening the list-projection readiness rule.
async function readyProject(projectId, expanded, text) {
  const handle = await page.waitForFunction(async ({ projectId, expanded, text }) => {
    const observationStartedAt = performance.now();
    const usable = () => {
      const area = document.querySelector('.project-area');
      const view = document.querySelector('.saved-view-content');
      const tab = document.querySelector(`[data-project-tab="${projectId}"][aria-selected="true"]`);
      return !!area && !!view && view.hidden === expanded && (!expanded || !!tab) &&
        area.querySelector('.project-detail-fields[aria-busy="false"]') &&
        !area.querySelector('[aria-busy="true"]') &&
        area.querySelector('.project-files [role="treeitem"]') &&
        (text === null || [...area.querySelectorAll('.text-value-button')].some(element => element.textContent.trim() === text));
    };
    if (!usable()) return false;
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const firstPaintedAt = performance.now();
    if (!usable()) return false;
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    if (!usable()) return false;
    return { observationStartedAt, firstPaintedAt, paintedAt: performance.now() };
  }, { projectId, expanded, text });
  try { lastReadyTiming = await handle.jsonValue(); }
  finally { await handle.dispose(); }
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
  const connectedMs = performance.now() - started;
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
  if (profileFilters) await app.evaluate(installPerformanceCommandProbe);
  page = await app.firstWindow(); page.setDefaultTimeout(30000);
  if (profileFilters) (report.windowDiagnostics ??= []).push(await app.evaluate(inspectPerformanceWindow,profileUnthrottled));
  const firstWindowMs = performance.now() - started;
  const runtime = await app.evaluate(({ app, BrowserWindow }) => ({ packaged: app.isPackaged,
    isolation: (() => { const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(); return [p.contextIsolation, p.nodeIntegration, p.sandbox]; })(),
    backends: app.getAppMetrics().filter(m => m.type === "Utility" && m.serviceName?.includes("Node")).map(m => m.pid) }));
  runtime.backends.forEach(pid => backends.add(pid));
  assert.equal(runtime.packaged, true); assert.deepEqual(runtime.isolation, [true, false, true]); assert.ok(runtime.backends.length);
  launchUnverified = false;
  await ready(expected); record(mode, "saved-view startup", started, report.limits.startup);
  (report.startupPhases ??= []).push({ source: mode, connectedMs, firstWindowMs, usableMs: performance.now() - started });
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
  if (profileBackend) report.backendDiagnostic = await instrumentPerformanceBackend(
    join(installed, process.platform === "darwin" ? "Contents/Resources" : "resources"),join(evidence,"backend-requests.jsonl"));
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
    const sourceSnapshot = unwrap(service.handleQuery({type:"workspace.listProjects",workspaceId:source.workspaceId}));
    const initialIds = unwrap(service.handleQuery({ type: "workspace.queryView", workspaceId: source.workspaceId, viewId: source.viewId, archived: false })).projectIds;
    assert.equal(initialIds.length, 1000); assert.equal(new Set(initialIds).size, 1000);
    service.close();
    const { workspaceId } = source;
    let activeIds = initialIds;
    const checks=createPerformanceQueries(workspaceId,sourceSnapshot,query);
    const command=checks.query;
    await launch(dataset.data, executable, initialIds, source.mode);
    assert.equal((await command("listTextProperties")).definitions.length, 20);
    for (const kind of ["table", "board"]) {
      const viewId = source.views.find(v => v.kind === kind).viewId;
      await activateRuntimeView(page, (await command("listViews")).views.find(view => view.viewId === viewId));
      await page.locator(kind === "board" ? ".project-board" : ".project-table").first().waitFor();
      const expected = (await command("queryView", { viewId, archived: false })).projectIds;
      await ready(expected); activeIds = expected;
      for (let sample = 0; sample < 3; sample++) {
        const profiler = profileFilters && ((kind === "table" && sample === 0) || (kind === "board" && sample === 1)) ? await startInteractionProfile(source.mode === "direct" && kind === "table") : undefined;
        const text = sample % 2 ? "Project 0" : "Project 00";
        // Fixture expectation preparation is outside the user-event clock.
        const ids = expected.filter(id => source.projects.find(p => p.projectId === id).name.includes(text));
        const filterPreparation = performance.now();
        const search = await enterContextFor(page,page.getByLabel("Search project names", { exact: true }));
        await search.fill(text);
        const save = page.getByRole("button", { name: "Save search and filters", exact: true }); await save.focus();
        await enterContextFor(page, save, { waitForPresentation: true }); await save.focus();
        (report.preparations ??= []).push({source:source.mode,scenario:`${kind} filter ${sample} controls presentation`,ms:performance.now()-filterPreparation});
        await startUiTiming(save, "keydown"); await save.press("Enter");
        await ready(ids); await recordUi(source.mode, `${kind} filter ${sample}`);
        if (profiler) {
          await stopInteractionProfile(profiler, `${source.mode}-${kind}-filter-${sample}`);
        }
        assert.deepEqual((await command("queryView", { viewId, archived: false })).projectIds, ids);
      }
      // Ordinary Select grouping retains exact option identities and an empty group.
      const property = source.properties.find(p => p.type === "single_select");
      const assignmentProfiler = profileFilters ? await startInteractionProfile(source.mode === "direct" && kind === "table") : undefined;
      const presentationStarted = performance.now();
      await openGroupingControls(page);
      (report.preparations ??= []).push({source:source.mode,scenario:`${kind} grouping controls presentation`,ms:performance.now()-presentationStarted});
      const groupBy = page.getByLabel("Group by", { exact: true });
      await startUiTiming(groupBy, "change"); await groupBy.selectOption(property.propertyId);
      await ready(undefined,[{selector:".project-group"}]);
      await page.locator(".project-group").first().waitFor();
      await recordUi(source.mode, `${kind} grouping`);
      await closeGroupingControls(page);
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
      await ready(undefined,[{selector:".text-properties .bb-status__title",text:"Group value saved. Filters may hide the project from this view."},
        {selector:`.project-group[aria-label=${JSON.stringify(destination.label ?? String(destination.value))}] [data-project-id=${JSON.stringify(projectId)}]`}]);
      await page.getByRole("heading", { name: "Group value saved. Filters may hide the project from this view.", exact: true }).waitFor();
      await group.locator(`[data-project-id="${projectId}"]`).waitFor();
      await recordUi(source.mode, `${kind} filtered group drag`);
      if (assignmentProfiler) {
        await stopInteractionProfile(assignmentProfiler, `${source.mode}-${kind}-grouping-assignment`);
      }
      const assigned = await command("queryView", { viewId, archived: false });
      await ready(assigned.groups.flatMap(g => g.projectIds));
      assert.ok(assigned.groups.find(g => g.key === destination.key).projectIds.includes(projectId));
      // Reset through UI for a full-view edit, then verify the durable value.
      await openGroupingControls(page);
      await page.getByLabel("Group by", { exact: true }).selectOption("");
      await closeGroupingControls(page);
      await (await enterContextFor(page,page.getByLabel("Search project names", { exact: true }))).fill("");
      await pressRuntimeFilterSave(page); await ready(expected);
      const p = source.projects[0], field = source.properties.find(p => p.type === "text");
      const row = page.locator(`[data-project-id="${p.projectId}"]`);
      const editPreparation = performance.now();
      await (await enterContextFor(page, row.getByRole("button", { name: `Edit Text value: ${p.name} / text 0`, exact: true }), { waitForPresentation: true })).press("Enter");
      await row.locator("textarea, input").fill(`Accepted ${kind}`);
      const saveValue = row.getByRole("button", { name: "Save value", exact: true }); await saveValue.focus();
      await enterContextFor(page, saveValue, { waitForPresentation: true }); await saveValue.focus();
      (report.preparations ??= []).push({source:source.mode,scenario:`${kind} edit controls presentation`,ms:performance.now()-editPreparation});
      const editProfiler = profileFilters ? await startInteractionProfile(source.mode === "direct" && kind === "table") : undefined;
      await startUiTiming(saveValue, "keydown"); await saveValue.press("Enter");
      await ready(expected,[{selector:`[data-project-id=${JSON.stringify(p.projectId)}] .text-value-button:not([hidden])`,text:`Accepted ${kind}`}]);
      await row.getByText(`Accepted ${kind}`, { exact: true }).waitFor();
      await recordUi(source.mode, `${kind} edit`);
      if (editProfiler) await stopInteractionProfile(editProfiler, `${source.mode}-${kind}-edit`);
      assert.equal((await command("listTextProperties")).values.find(v => v.projectId === p.projectId && v.propertyId === field.propertyId).value, `Accepted ${kind}`);
      await page.screenshot({ path: join(evidence, `${source.mode}-${kind}-en.png`) });
    }
    // Actual filesystem changes below retain the original unhinted public
    // queries, fresh scan/revision and project-list identity checks.
    checks.beginFilesystemPhase();
    const p = source.projects[0]; const renamed = p.relativePath.replace(p.name, "External rename");
    await rename(join(source.root, p.relativePath), join(source.root, renamed));
    const refresh = page.getByRole("button", { name: "Refresh source", exact: true });
    await startUiTiming(refresh, "keydown"); await refresh.press("Enter");
    await ready(activeIds,[{selector:`[data-project-id=${JSON.stringify(p.projectId)}] *`,text:"External rename"}]);
    await page.locator(`[data-project-id="${p.projectId}"]`).getByText("External rename", { exact: true }).waitFor();
    await recordUi(source.mode, "external-change full scan and refresh", report.limits.scan);
    assert.deepEqual((await command("queryView", { viewId: source.views.find(v => v.kind === "board").viewId, archived: false })).projectIds, activeIds);
    const refreshed = await command("listProjects"); assert.equal(refreshed.projects.length, 1000);
    assert.equal(refreshed.projects.find(row => row.projectId === p.projectId).relativePath, renamed);
    assert.equal(await readFile(join(source.root, renamed, "preserved.txt"), "utf8"), "Keep project contents.\n");
    assert.equal((await command("listTextProperties")).values.find(v => v.projectId === p.projectId && v.propertyId === source.properties[0].propertyId).value, "Accepted board");
    // Final #67 adds actual project-area/editor flows at the unchanged 1000/20/10
    // scale, with the original event-to-committed-paint 300ms limit.
    // Keep the immutable pre-desktop-UX #41 baseline's original inventory intact.
    if (report.projectFlows) {
    const preview = page.getByRole("button", { name: "Preview project: External rename", exact: true });
    await preview.scrollIntoViewIfNeeded();
    await startUiTiming(preview, "keydown"); await preview.press("Enter");
    await readyProject(p.projectId, false, "Accepted board");
    await recordUi(source.mode, "project preview");
    const expand = page.getByRole("button", { name: "Expand project", exact: true });
    await startUiTiming(expand, "keydown"); await expand.press("Enter");
    await readyProject(p.projectId, true, "Accepted board");
    await recordUi(source.mode, "project expand");
    const detail = page.locator('.project-detail-fields');
    const detailText = detail.getByRole("button", { name: "Edit Text value: External rename / text 0", exact: true });
    await detailText.press("Enter");
    await detail.locator('textarea').fill("Scale project editor");
    const saveDetail = detail.getByRole("button", { name: "Save value", exact: true });
    await saveDetail.focus();
    await startUiTiming(saveDetail, "keydown"); await saveDetail.press("Enter");
    await readyProject(p.projectId, true, "Scale project editor");
    await recordUi(source.mode, "expanded project edit");
    assert.equal((await command("listTextProperties")).values.find(v => v.projectId === p.projectId && v.propertyId === source.properties[0].propertyId).value, "Scale project editor");
    await memory(`${source.mode} expanded project`);
    // Cancel a real draft and restore the original retained-value assertion.
    await detailText.press("Enter"); await detail.locator('textarea').fill("Cancelled scale draft");
    await detail.locator('textarea').press("Escape");
    await detailText.press("Enter"); await detail.locator('textarea').fill("Accepted board");
    await saveDetail.press("Enter"); await readyProject(p.projectId, true, "Accepted board");
    const returnRight = page.getByRole("button", { name: "Return project to the right", exact: true });
    await startUiTiming(returnRight, "keydown"); await returnRight.press("Enter");
    await ready(activeIds); await recordUi(source.mode, "project return");
    assert.equal(await page.locator(`[data-project-tab="${p.projectId}"]`).count(), 0);
    await page.getByRole("button", { name: "Close preview", exact: true }).press("Enter");
    }
    await setRuntimeViewLanguage(page, "ru"); await page.setViewportSize({ width: 720, height: 900 });
    await page.waitForFunction(() => document.documentElement.lang === "ru");
    const last = source.projects.at(-1), lastRow = page.locator(`[data-project-id="${last.projectId}"]`);
    await lastRow.scrollIntoViewIfNeeded();
    const lastButton = lastRow.getByRole("button", { name: `Редактировать Text-значение: ${last.name} / text 3`, exact: true });
    await lastButton.press("Enter"); await lastRow.locator("textarea").fill("Committed on blur");
    const refreshRu = page.getByRole("button", { name: "Обновить источник", exact: true });
    await startUiTiming(refreshRu, "keydown"); await refreshRu.press("Enter");
    await ready(activeIds); await recordUi(source.mode, "RU refresh after scalar blur", report.limits.scan);
    const lastField = source.properties.find(p => p.type === "text" && p.slot === 3);
    assert.equal((await command("listTextProperties")).values.find(v => v.projectId === last.projectId && v.propertyId === lastField.propertyId).value, "Committed on blur");
    // D54 commits when the real Refresh control takes focus. Retain the separate
    // offscreen-draft guarantee with a public external refresh and unchanged focus.
    await lastRow.scrollIntoViewIfNeeded(); await lastButton.press("Enter");
    assert.equal(await lastRow.locator("textarea").inputValue(), "Committed on blur");
    await lastRow.locator("textarea").fill("Unsubmitted draft");
    await page.locator(".saved-view-content").evaluate(element => { element.scrollTop = 0; });
    const draftRefresh = performance.now();
    await command("refreshSource"); await ready(activeIds);
    record(source.mode, "RU external refresh with offscreen draft", draftRefresh, report.limits.scan);
    assert.equal(await lastRow.locator("textarea").inputValue(), "Unsubmitted draft");
    assert.equal(await lastRow.locator("textarea").evaluate(element => element === document.activeElement), true);
    await lastRow.locator("textarea").press("Escape");
    assert.equal(await lastButton.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(evidence, `${source.mode}-ru-narrow.png`) }); await memory(`${source.mode} final`);
    await stop();
    await launch(dataset.data, executable, activeIds, `${source.mode} reopen`);
    const reopened = await command("listTextProperties");
    assert.equal(reopened.values.find(v => v.projectId === p.projectId && v.propertyId === source.properties[0].propertyId).value, "Accepted board");
    assert.equal(reopened.values.find(v => v.projectId === last.projectId && v.propertyId === source.properties.find(p => p.type === "text" && p.slot === 3).propertyId).value, "Committed on blur");
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
  if (profileFilters) report.status = "diagnostic";
  if (process.argv.includes("--enforce")) assert.equal(report.status, "passed", "Representative-scale targets missed; inspect raw report");
} catch (error) {
  failure = error; report.status = "failed"; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, "failure.png") }).catch(() => {});
} finally {
  if (app) try { await stop(); } catch (error) { failure ??= error; report.status = "failed"; report.shutdownError = error.message; }
  if (profileBackend) {
    try { Object.assign(report.backendDiagnostic,await inspectPerformanceBackendBatches(join(evidence,"backend-requests.jsonl"),parents.size)); }
    catch { failure ??= new Error("Backend diagnostic batches were incomplete"); report.status="failed"; report.backendDiagnosticIncomplete=true; }
  }
  await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2));
  await cleanupOwnedFixture(fixture, { processesStopped: ownedProcessesStopped(parents, backends, { launchUnverified }), primaryFailure: failure,
    record: async cleanup => { report.cleanup = cleanup; await writeFile(join(evidence, "report.json"), JSON.stringify(report, null, 2)); } });
}
