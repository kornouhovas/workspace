import { installRenameSubmissionReceipt } from "./rename-submission-receipt.mjs";
import assert from "node:assert/strict";
import { waitForRenameEditor } from "./rename-editor-readiness.mjs";
import { execFileSync, fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { packagedExecutablePath } from "./runtime-executable.mjs";
import { cleanupOwnedFixture, closeRuntimeSession, inspectOwnedProcesses, withDeadline } from "./runtime-lifecycle.mjs";
import { assertRenameAcceptance, createRenameEvidence, recordRenameEvidence } from "./runtime-evidence.mjs";
import { closeDisposableFileManagerTarget, waitForFileManagerTarget } from "./file-manager-evidence.mjs";
import { createRenameRuntimeStartup } from "./rename-runtime-startup.mjs";
import { nativeBridgeCleanupEvidence } from "./native-bridge-evidence.mjs";
import { installNativeRevealReceipt, retainNativeRevealReceipt } from "./native-reveal-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
export async function fillExactRenameDraft(input, draft) {
  // One standard replacement action owns the complete authored draft. A
  // separate empty fill relies on keyboard Delete delivery before replacement.
  await input.fill(draft);
  assert.equal(await input.inputValue() === draft, true, "Rename driver must author the exact draft before submitting");
  return true;
}
const query = async (page, type, workspaceId, extra = {}) => unwrap(await page.evaluate(input => globalThis.window.workspace.workspace(input), { type: `workspace.${type}`, ...(workspaceId === undefined ? {} : { workspaceId }), ...extra }));

// The driver alone prepares owned disposable roots/SQLite before Electron opens
// them. Production renderer/preload/service are untouched by failure injection.
export async function seedRenameFixture(data, discoveryMode) {
  await mkdir(data, { recursive: true });
  const sourceRoot = join(data, "root"), otherRoot = join(data, "other");
  const parent = discoveryMode === "grouped" ? join(sourceRoot, "Category") : sourceRoot;
  await mkdir(join(parent, "Original", "nested"), { recursive: true });
  await mkdir(join(parent, "Occupied")); await mkdir(otherRoot);
  await writeFile(join(parent, "Original", "sentinel"), "original bytes\0日本語\n");
  await writeFile(join(parent, "Original", "nested", "note"), "nested bytes\n");
  await writeFile(join(parent, "Occupied", "sentinel"), "occupied bytes\0retained");
  const database = join(data, "workspace.sqlite");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const service = openSettingsService(database);
  try {
    const workspace = unwrap(service.workspaces.create({ type: "workspace.create", name: "Rename", rootPath: sourceRoot }));
    const sibling = unwrap(service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: sourceRoot }));
    const other = unwrap(service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }));
    const preview = unwrap(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: discoveryMode }));
    const projection = unwrap(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }));
    const project = projection.projects.find(project => project.name === "Original"); assert.ok(project);
    const property = unwrap(service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Notes", propertyType: "text" }));
    unwrap(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст\t  " }));
    const properties = unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId }));
    const configurations = unwrap(service.workspaces.load());
    return { data, database, sourceRoot, parent, workspace, sibling, other, project, projection, properties, configurations,
      request: { type: "workspace.renameProject", workspaceId: workspace.workspaceId, projectId: project.projectId, operationId: randomUUID(), name: "original", expectedRevision: projection.revision } };
  } finally { service.close(); }
}

export async function interruptRenameFixture(setup, checkpoint, ownedProcesses) {
  const marker = join(setup.data, "cleanup-marker");
  const child = fork(join(root, "tests/fixtures/project-rename-crash-worker.mjs"), [setup.database, checkpoint, JSON.stringify(setup.request), marker],
    { cwd: root, execArgv: [], stdio: ["ignore", "ignore", "pipe", "ipc"] });
  ownedProcesses.add(child);
  const exited = once(child, "exit");
  // Attach before waiting so early errors/exit always terminate the bounded wait.
  let reached;
  const result = new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", () => { if (!reached) reject(new Error("Rename interruption worker exited before its checkpoint")); });
    child.once("message", message => {
      if (message.checkpoint !== checkpoint) reject(new Error("Rename interruption worker returned without its checkpoint"));
      else { reached = message; done(message); }
    });
  });
  // Drain without storing private raw errors or fixture journal/identity fields.
  child.stderr.resume();
  try {
    const message = await withDeadline(result, 10000, "Rename interruption checkpoint");
    child.kill("SIGKILL");
    await withDeadline(exited, 5000, "Rename interruption termination");
    await assert.rejects(stat(marker), { code: "ENOENT" });
    const stage = { intent: "intent", first_effect: "intent", staged_evidence: "staged", final_effect: "staged", destination_evidence: "destination_recorded", commit: "completed" }[checkpoint];
    assert.equal(message.operation.stage, stage);
    return { checkpoint, stage, cleanupExecuted: false, staging: message.actualSelfAlias ? "mounted_self_alias" : "injected_alias_policy", operationId: setup.request.operationId };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL"); await withDeadline(exited, 5000, "Rename interruption cleanup");
    }
  }
}

async function inventory(path) {
  const result = [];
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = join(path, entry.name), info = await lstat(child);
    assert.equal(info.isSymbolicLink(), false);
    if (entry.isDirectory()) result.push([entry.name, await inventory(child)]);
    else {
      assert.equal(entry.isFile(), true);
      result.push([entry.name, (await readFile(child)).toString("hex"), info.mode & 0o777]);
    }
  }
  return result;
}
const labels = {
  en: { rename: "Rename project folder", saved: "Project folder renamed.", unchanged: "The folder already has this exact name.", invalid: "Enter a valid folder name. Your exact authored text is retained.", collision: "This folder name or identity is occupied or reserved. Choose another name.", review: "Review interrupted rename", retry_original: "Retry original rename", finish_staged: "Finish staged rename", complete_destination: "Complete destination rename", keep_original: "Keep original folder", kept: "Original folder retained. Rename resolved.", reveal: "Reveal folder", dispatched: "Request sent to the system file manager." },
  ru: { rename: "Переименовать папку проекта", saved: "Папка проекта переименована.", unchanged: "У папки уже есть это точное имя.", invalid: "Введите допустимое имя папки. Введённый текст сохраняется без изменений.", collision: "Это имя или идентификатор папки занят или зарезервирован. Выберите другое имя.", review: "Проверить прерванное переименование", retry_original: "Повторить исходное переименование", finish_staged: "Завершить промежуточное переименование", complete_destination: "Подтвердить переименование в запрошенную папку", keep_original: "Сохранить исходную папку", kept: "Исходная папка сохранена. Переименование разрешено.", reveal: "Показать папку", dispatched: "Запрос отправлен системному файловому менеджеру." },
};

export async function runProjectRenameUi(mode = "dev") {
  assert.ok(["dev", "release"].includes(mode));
  const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
  const evidenceDirectory = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work", `rename-ui-${mode}-${Date.now()}`);
  await mkdir(evidenceDirectory, { recursive: true });
  const evidence = createRenameEvidence(), observations = [], shutdowns = [];
  const ownedProcesses = new Set(), backendPids = new Set(), nativeTargets = new Set();
  let failure, active, nativeStopped = true;
  // Identify exercised build inputs; screenshots/results of separate invocations
  // must never be attributed to a different development/packaged artifact.
  const digest = createHash("sha256");
  for (const path of ["package-lock.json", "scripts/smoke-project-rename-ui.mjs", "scripts/rename-editor-readiness.mjs", "scripts/rename-submission-receipt.mjs", "scripts/runtime-evidence.mjs", "scripts/rename-runtime-startup.mjs", "scripts/runtime-startup.mjs", "scripts/runtime-lifecycle.mjs", "tests/fixtures/project-rename-crash-worker.mjs", "dist/desktop/main.cjs", "dist/desktop/preload.cjs", "dist/service/entry.cjs", "dist/service/settings.mjs", "dist/service/native/project-rename.node"]) digest.update(path).update(await readFile(join(root, path)));
  if (mode === "release") {
    const resources = process.platform === "darwin" ? resolve(dirname(executablePath), "../Resources") : join(dirname(executablePath), "resources");
    digest.update(await readFile(join(resources, "app.asar")));
  }
  async function hashTree(path) {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${path}/${entry.name}`;
      if (entry.isDirectory()) await hashTree(relative);
      else { assert.equal(entry.isFile(), true); digest.update(relative).update(await readFile(join(root, relative))); }
    }
  }
  await hashTree("dist/renderer"); await hashTree("dist/service/db/migrations");
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const inputDigest = digest.digest("hex");
  const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-rename-ui-")));
  const save = async () => writeFile(join(evidenceDirectory, `${mode}-rename-observations.json`), JSON.stringify({
    mode, platform: process.platform, arch: process.arch, node: process.version, sourceRevision, inputDigest,
    status: failure ? "failed" : evidence.fixtureCleanup.status === "passed" ? "passed" : "pending",
    scope: "production graphical UI/preload/utilityProcess; interruption in driver-owned real-service child; injected alias policy only where mounted alias absent",
    evidence, observations, shutdowns, ...(failure ? { error: failure.message } : {}),
  }, null, 2) + "\n");
  const check = async (target, stage, assertion) => {
    const previous = active;
    active = { target, stage };
    const details = await assertion() ?? {};
    recordRenameEvidence(target, stage, { status: "passed", asserted: true, ...details });
    active = previous; await save();
  };
  const startup = createRenameRuntimeStartup({ launchElectron: options => _electron.launch(options), ownedProcesses, backendPids,
    recordStartup: async outcome => { observations.push({ startup: outcome }); await save(); } });
  async function launch(data) {
    const page = await startup.launch({ executablePath, args: mode === "dev" ? [root] : [], cwd: root, env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
    const { electron } = startup.current;
    await check(evidence, "isolation", async () => {
      assert.deepEqual(await electron.evaluate(({ BrowserWindow, app }) => {
        const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return { contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, sandbox: p.sandbox, userData: app.getPath("userData"), sessionData: app.getPath("sessionData") };
      }), { contextIsolation: true, nodeIntegration: false, sandbox: true, userData: data, sessionData: data });
      assert.equal(await page.evaluate(() => typeof process), "undefined"); assert.equal(await page.evaluate(() => typeof require), "undefined");
    });
    return page;
  }
  async function shutdown() {
    const closing = startup.current; startup.clearCurrent();
    const shutdown = { passed: false }; shutdowns.push(shutdown);
    try {
      await closeRuntimeSession(closing.electron, { shutdown, readBackendPids: startup.readBackendPids,
      beforeClose: save,
      assertBackendsStopped: async pids => {
        for (const pid of pids) {
          await withDeadline((async () => {
            for (let attempt = 0; attempt < 50; attempt++) {
              if (startup.confirmBackendExit(closing.electron, pid)) return;
              await new Promise(done => setTimeout(done, 100));
            }
            throw new Error("Rename backend survived normal quit");
          })(), 5000, "Rename backend exit");
        }
      } });
    } catch (error) {
      recordRenameEvidence(evidence, "normalShutdown", { status: "failed", reason: error.message, forcedCleanup: error.forcedCleanup });
      await save().catch(() => {});
      throw error;
    }
    await save();
  }
  async function select(page, workspace, language) {
    await page.locator("#interface-language").selectOption(language);
    await page.waitForFunction(lang => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
    await page.locator("#workspace-switcher").selectOption(workspace.workspaceId);
    await page.getByRole("heading", { name: workspace.name, exact: true }).waitFor();
    await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false" && globalThis.document.querySelector(".rename-operations")?.getAttribute("aria-busy") === "false");
  }
  async function capture(page, discoveryMode, language, state) {
    for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
      await page.setViewportSize(size);
      assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
      for (const button of await page.locator(".project-rename button").all()) {
        const bounds = await button.evaluate(async node => {
          node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          await new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done)));
          const r = node.getBoundingClientRect();
          return { label: node.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: globalThis.innerWidth, height: globalThis.innerHeight };
        });
        observations.push({ layout: { discoveryMode, language, state, viewport: size, bounds } });
        await save();
        assert.equal(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, true, `Unreachable runtime rename control: ${JSON.stringify(bounds)}`);
      }
      await page.screenshot({ path: join(evidenceDirectory, `${mode}-${discoveryMode}-${language}-${state}-${size.width}.png`), fullPage: true });
    }
  }
  async function preserved(page, setup, name, expectedInventory) {
    const list = await query(page, "listProjects", setup.workspace.workspaceId);
    const project = list.projects.find(project => project.projectId === setup.project.projectId); assert.ok(project);
    assert.equal(project.name, name); assert.equal(project.categoryId, setup.project.categoryId);
    assert.equal(project.relativePath, setup.project.relativePath.split("/").slice(0, -1).concat(name).join("/"));
    assert.deepEqual(list.categories, setup.projection.categories);
    assert.equal(list.projects.length, 2); assert.equal(list.retainedProjects.length, 0);
    assert.deepEqual(await query(page, "listTextProperties", setup.workspace.workspaceId), setup.properties);
    assert.deepEqual(await inventory(join(setup.parent, name)), expectedInventory);
    assert.deepEqual(await inventory(join(setup.parent, "Occupied")), [["sentinel", Buffer.from("occupied bytes\0retained").toString("hex"), (await lstat(join(setup.parent, "Occupied", "sentinel"))).mode & 0o777]]);
    assert.equal((await readdir(setup.parent)).includes(name), true, "Exact enumerated Name spelling");
    const configuration = await query(page, "load", undefined);
    assert.deepEqual(configuration.workspaces, setup.configurations.workspaces);
    const other = await query(page, "listProjects", setup.other.workspaceId);
    assert.equal(other.projects.length, 0);
    return list;
  }
  async function edit(page, name, draft, t, expectedMessage) {
    const { electron } = startup.current;
    await electron.evaluate(installRenameSubmissionReceipt, { draft });
    const observation = { renameSubmission: { editorMatchesDraft: null, receipt: null } };
    observations.push(observation);
    let primaryFailure;
    try {
      const trigger = page.getByRole("button", { name: `${t.rename}: ${name}`, exact: true });
      await trigger.press("Enter");
      await waitForRenameEditor(page, { record: readiness => observations.push({ editorReadiness: readiness }) });
      const input = page.locator("#project-rename-name");
      observation.renameSubmission.editorMatchesDraft = await fillExactRenameDraft(input, draft);
      await input.press("Enter");
      await page.getByText(expectedMessage, { exact: true }).waitFor();
    } catch (error) { primaryFailure = error; }
    try { observation.renameSubmission.receipt = await withDeadline(electron.evaluate(() => globalThis.renameSubmissionReceipt.snapshot()), 3000, "Rename submission receipt"); }
    catch { observation.renameSubmission.captureFailed = true; }
    try { await withDeadline(electron.evaluate(() => globalThis.renameSubmissionReceipt.dispose()), 3000, "Rename submission observer disposal"); }
    catch { observation.renameSubmission.disposalFailed = true; }
    try { await save(); } catch (error) { primaryFailure ??= error; }
    if (primaryFailure) throw primaryFailure;
  }

  async function closeEditor(page) {
    if (await page.locator("#project-rename-name").count()) await page.locator("#project-rename-name").press("Escape");
    await page.locator("#project-rename-name").waitFor({ state: "detached" });
  }
  async function reveal(page, setup, name, t, targetEvidence) {
    const target = join(setup.parent, name); nativeTargets.add(target);
    const receiptTracking = process.platform === "darwin" || process.platform === "win32";
    let receiptObservation;
    const retainReceipt = async primaryFailure => {
      if (!receiptTracking) return;
      await retainNativeRevealReceipt({ electron: startup.current.electron, primaryFailure,
        retain: nativeRevealReceipt => {
          const observation = { renameNativeRevealReceipt: nativeRevealReceipt };
          if (receiptObservation === undefined) { receiptObservation = observations.length; observations.push(observation); }
          else observations[receiptObservation] = observation;
        }, persist: save });
    };
    if (receiptTracking) await withDeadline(startup.current.electron.evaluate(installNativeRevealReceipt,
      { workspaceId: setup.workspace.workspaceId }), 1000, "Rename native receipt installation");
    try {
    await startup.current.electron.evaluate(({ shell }) => {
      globalThis.renameNativeCalls = []; globalThis.renameNativeOpens = [];
      globalThis.renameNativeBridge = { started: 0, stopped: 0, active: 0, unknown: false, failure: null, trace: [] };
      if (process.platform === "win32") {
        process.on("workspace:native-reveal", ({ stage, path, phase, reason, elapsedMs, boundary, exceptionKind }) => {
          const bridge = globalThis.renameNativeBridge;
          if (stage === "started") { bridge.started++; bridge.active++; }
          if (stage === "stopped") { bridge.stopped++; bridge.active--; }
          if (stage === "unknown") bridge.unknown = true;
          if (stage === "failure" && /^(input|navigation|readiness|permit|precommand|selection|postcheck|initial|opened|authorizing|permitted|selected|done)$/.test(phase) &&
              /^(input|deadline|binding|unready|permit|exception|owner_deadline)$/.test(reason)) {
                bridge.failure = { phase, reason };
                if (/^(enumeration|collection|window_candidate|document|parent|owner|uia_root|uia_properties|uia_tabs|readiness|item|document_recheck|readiness_recheck|item_returned)$/.test(boundary) && /^(null_argument|invalid_operation|invalid_cast|com|element_unavailable|other|collection_count_result|collection_count_range|collection_enum_result|collection_terminal_value|collection_terminal_count|collection_changed_count|collection_enum_status|collection_extra_entry|collection_limit|collection_null_entry|collection_non_com_entry|collection_duplicate_identity)$/.test(exceptionKind)) Object.assign(bridge.failure, { boundary, exceptionKind });
              }
          if (stage === "trace" && /^(assemblies|compile|shell|open|enumeration|collection|window_candidate|document|parent|owner|uia_root|uia_properties|uia_tabs|readiness|item|document_recheck|readiness_recheck|binding_returned|item_returned)$/.test(phase) && Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 12000 && bridge.trace.length < 19) bridge.trace.push({ phase, elapsedMs });
          if (stage === "open") globalThis.renameNativeOpens.push(path);
          if (stage === "select") globalThis.renameNativeCalls.push({ path, returned: false });
          if (stage === "done") { const call = globalThis.renameNativeCalls.at(-1); if (call?.path === path) call.returned = true; }
        });
      } else {
        const original = shell.showItemInFolder.bind(shell);
        shell.showItemInFolder = path => { const call = { path, returned: false }; globalThis.renameNativeCalls.push(call); const result = original(path); call.returned = true; return result; };
      }
    });
    await check(targetEvidence, "revealInvocation", async () => {
      await page.getByRole("button", { name: `${t.reveal}: ${name}`, exact: true }).press("Enter");
      await page.waitForFunction(() => globalThis.document.querySelector(".project-reveal .bb-status") !== null);
      const calls = await withDeadline((async () => {
        for (let attempt = 0; attempt < (process.platform === "win32" ? 150 : 50); attempt++) {
          const calls = await startup.current.electron.evaluate(() => globalThis.renameNativeCalls);
          if (calls.some(call => call.returned)) return calls;
          await new Promise(done => setTimeout(done, 100));
        }
        throw new Error("Native rename Reveal did not return");
      })(), process.platform === "win32" ? 17000 : 10000, "Native rename Reveal");
      assert.deepEqual(calls, [{ path: target, returned: true }]);
      if (process.platform === "win32") {
        assert.deepEqual(await startup.current.electron.evaluate(() => globalThis.renameNativeOpens), [target]);
        const boundary = await startup.current.electron.evaluate(() => globalThis.renameNativeBridge);
        const bridge = nativeBridgeCleanupEvidence(boundary);
        observations.push({ bridge, nativeReadTrace: boundary.trace }); nativeStopped &&= bridge.status === "passed"; assert.equal(nativeStopped, true);
      }
      return { exactCommittedLocation: true, invocationCount: 1 };
    });
    await retainReceipt();
    await check(targetEvidence, "revealAcknowledgment", async () => {
      await page.getByText(t.dispatched, { exact: true }).waitFor();
      assert.equal((await startup.current.electron.evaluate(() => globalThis.renameNativeCalls)).length, 1);
    });
    await check(targetEvidence, "fileManagerOutcome", async () => {
      const outcome = await waitForFileManagerTarget(target, process.platform, undefined, { windowsDiagnostics: true });
      observations.push({ fileManagerOutcome: outcome }); await save(); assert.equal(outcome.status, "passed"); return outcome;
    });
    await check(targetEvidence, "fileManagerCleanup", async () => {
      const outcome = await closeDisposableFileManagerTarget(target, process.platform, undefined, { ownedParent: true });
      assert.equal(outcome.status, "completed"); nativeTargets.delete(target); return { outcome };
    });
    } catch (error) {
      if (process.platform === "win32") {
        try {
          const boundary = await withDeadline(startup.current.electron.evaluate(() => ({
            bridge: globalThis.renameNativeBridge,
            opens: globalThis.renameNativeOpens.length,
            selections: globalThis.renameNativeCalls.length,
            returns: globalThis.renameNativeCalls.filter(call => call.returned).length,
          })), 1000, "Rename native boundary failure evidence");
          observations.push({ renameNativeBoundary: boundary });
        } catch { observations.push({ renameNativeBoundary: { collectionFailed: true } }); }
      }
      await retainReceipt(error);
      throw error;
    }
  }

  try {
    await save();
    for (const discoveryMode of ["direct", "grouped"]) {
      const targetEvidence = evidence[discoveryMode];
      const language = discoveryMode === "direct" ? "en" : "ru", t = labels[language];
      console.info(`Rename ${mode}: ${discoveryMode} Name submission, rejection, mounted case, Reveal and restart`);
      const setup = await seedRenameFixture(join(fixture, `${discoveryMode}-normal`), discoveryMode);
      const originalInventory = await inventory(join(setup.parent, "Original"));
      let page = await launch(setup.data); await select(page, setup.workspace, language);
      await page.evaluate(() => {
        globalThis.renameEvents = [];
        globalThis.window.workspace.onWorkspaceChange(event => { if (event.type === "workspace.projectsChanged") globalThis.renameEvents.push(event); });
      });
      const authoredName = "  Renamed 日本語";
      await check(targetEvidence, "submission", async () => {
        const trigger = page.getByRole("button", { name: `${t.rename}: Original`, exact: true });
        await trigger.press("Enter"); await page.locator("#project-rename-name").fill("Cancelled draft");
        await capture(page, discoveryMode, language, "editing");
        await closeEditor(page);
        assert.equal(await trigger.evaluate(node => node === globalThis.document.activeElement), true);
        await edit(page, "Original", authoredName, t, t.saved);
        await page.getByRole("button", { name: `${t.rename}: ${authoredName}`, exact: true }).waitFor();
        await capture(page, discoveryMode, language, "saved");
        await preserved(page, setup, authoredName, originalInventory);
        await assert.rejects(stat(join(setup.parent, "Original")), { code: "ENOENT" });
        const events = await page.evaluate(() => globalThis.renameEvents);
        assert.equal(events.length, 1); assert.deepEqual(new Set(events[0].workspaceIds), new Set([setup.workspace.workspaceId, setup.sibling.workspaceId]));
        await closeEditor(page);

      });
      await check(targetEvidence, "rejections", async () => {
        for (const [draft, message, state] of [["bad/name", t.invalid, "invalid"], ["Occupied", t.collision, "occupied"], [authoredName, t.unchanged, "unchanged"]]) {
          const before = await query(page, "listProjects", setup.workspace.workspaceId);
          await edit(page, authoredName, draft, t, message);
          if (state !== "unchanged") assert.equal(await page.locator("#project-rename-name").inputValue(), draft);
          else await page.locator("#project-rename-name").waitFor({ state: "detached" });
          await capture(page, discoveryMode, language, state);
          assert.deepEqual(await query(page, "listProjects", setup.workspace.workspaceId), before);
          await preserved(page, setup, authoredName, originalInventory); await closeEditor(page);
        }
      });
      let committedName = authoredName;
      await check(targetEvidence, "caseOnly", async () => {
        const requestedName = "  rENAMED 日本語";
        let actualAlias = false;
        try {
          const original = await lstat(join(setup.parent, authoredName), { bigint: true }), alias = await lstat(join(setup.parent, requestedName), { bigint: true });
          actualAlias = original.dev === alias.dev && original.ino === alias.ino && original.birthtimeNs === alias.birthtimeNs;
        } catch (error) { if (error.code !== "ENOENT") throw error; }
        await edit(page, authoredName, requestedName, t, t.saved);
        await page.getByRole("button", { name: `${t.rename}: ${requestedName}`, exact: true }).waitFor();
        await preserved(page, setup, requestedName, originalInventory);
        const names = await readdir(setup.parent); assert.equal(names.includes(authoredName), false); assert.equal(names.includes(requestedName), true);
        committedName = requestedName; await closeEditor(page);
        return { actualMountedAlias: actualAlias, exactEnumeratedSpelling: true, outcome: "completed" };
      });
      await check(targetEvidence, "sibling", async () => {
        await select(page, setup.sibling, language);
        await page.getByRole("button", { name: `${t.rename}: ${committedName}`, exact: true }).waitFor();
        const sibling = await query(page, "listProjects", setup.sibling.workspaceId);
        assert.equal(sibling.projects.find(project => project.projectId === setup.project.projectId).name, committedName);
        assert.deepEqual(await query(page, "listTextProperties", setup.sibling.workspaceId), { ...setup.properties, workspaceId: setup.sibling.workspaceId });
        await select(page, setup.workspace, language);
      });
      await reveal(page, setup, committedName, t, targetEvidence);
      await shutdown();
      page = await launch(setup.data); await select(page, setup.workspace, language);
      await check(targetEvidence, "restartPersistence", async () => {
        await preserved(page, setup, committedName, originalInventory);
        await page.getByRole("button", { name: `${t.rename}: ${committedName}`, exact: true }).waitFor();
      });
      await shutdown();
      for (const checkpoint of Object.keys(targetEvidence.recovery)) {
        const recoveryEvidence = targetEvidence.recovery[checkpoint];
        console.info(`Rename ${mode}: ${discoveryMode} interruption ${checkpoint}, restart and explicit recovery`);
        const setup = await seedRenameFixture(join(fixture, `${discoveryMode}-${checkpoint}`), discoveryMode);
        const originalInventory = await inventory(join(setup.parent, "Original"));
        await check(recoveryEvidence, "seed", async () => interruptRenameFixture(setup, checkpoint === "keep_original" ? "intent" : checkpoint, ownedProcesses));
        const before = await inventory(setup.parent);
        let page = await launch(setup.data); await select(page, setup.sibling, language);
        await check(recoveryEvidence, "restartNoReplay", async () => {
          const listed = await query(page, "listProjectRenames", setup.sibling.workspaceId);
          assert.equal(listed.operations.length, checkpoint === "commit" ? 0 : 1);
          assert.equal(listed.workspaceId, setup.sibling.workspaceId); assert.equal(listed.sourceId, setup.workspace.sourceId);
          if (listed.operations.length) assert.equal(listed.operations[0].operationId, setup.request.operationId);
          const expectedStage = recoveryEvidence.seed.stage;
          const assertNoReplay = async () => {
            const projection = await query(page, "listProjects", setup.sibling.workspaceId);
            assert.equal([...projection.projects, ...projection.retainedProjects].filter(project => project.projectId === setup.project.projectId).length, 1);
            const status = await query(page, "getProjectRename", setup.sibling.workspaceId, { operationId: setup.request.operationId });
            assert.equal(status.operation.stage, expectedStage);
            assert.equal(status.operation.projectId, setup.project.projectId); assert.equal(status.operation.name, setup.request.name);
            assert.equal(status.outcome, checkpoint === "commit" ? "completed" : "recoverable");
            assert.deepEqual(await query(page, "listTextProperties", setup.sibling.workspaceId), { ...setup.properties, workspaceId: setup.sibling.workspaceId });
          };
          for (let count = 0; count < 2; count++) await assertNoReplay();
          assert.deepEqual(await inventory(setup.parent), before);
          await shutdown();
          page = await launch(setup.data); await select(page, setup.sibling, language);
          assert.equal((await query(page, "listProjectRenames", setup.sibling.workspaceId)).operations.length, listed.operations.length);
          await assertNoReplay();
          assert.deepEqual(await inventory(setup.parent), before);
        });
        await check(recoveryEvidence, "resolution", async () => {
          if (checkpoint === "commit") {
            const result = await query(page, "getProjectRename", setup.sibling.workspaceId, { operationId: setup.request.operationId });
            assert.equal(result.outcome, "completed");
            return { outcome: "completed_before_interruption", mutationRequired: false };
          }
          const action = checkpoint === "keep_original" ? "keep_original" : checkpoint === "intent" ? "retry_original" : ["first_effect", "staged_evidence"].includes(checkpoint) ? "finish_staged" : "complete_destination";
          await page.getByRole("button", { name: `${t.review}: Original → original`, exact: true }).press("Enter");
          await page.locator(".rename-review").waitFor();
          await page.getByRole("button", { name: t[action], exact: true }).waitFor();
          assert.equal(await page.locator("#rename-review-title").evaluate(node => node === globalThis.document.activeElement), true);
          await capture(page, discoveryMode, language, checkpoint);
          await page.getByRole("button", { name: t[action], exact: true }).press("Enter");
          await page.getByText(checkpoint === "keep_original" ? t.kept : t.saved, { exact: true }).waitFor();
          const status = await query(page, "getProjectRename", setup.sibling.workspaceId, { operationId: setup.request.operationId });
          assert.equal(status.outcome, checkpoint === "keep_original" ? "rejected" : "completed");
          if (checkpoint === "keep_original") assert.equal(status.problem, "kept_original");
          assert.equal((await query(page, "listProjectRenames", setup.sibling.workspaceId)).operations.length, 0);
          return { action, outcome: status.outcome };
        });
        const finalName = checkpoint === "keep_original" ? "Original" : "original";
        await check(recoveryEvidence, "preservation", async () => {
          await preserved(page, setup, finalName, originalInventory);
          const names = await readdir(setup.parent); assert.deepEqual(names.sort(), ["Occupied", finalName].sort());
        });
        await shutdown(); page = await launch(setup.data); await select(page, setup.workspace, language);
        await check(recoveryEvidence, "restartPersistence", async () => {
          await preserved(page, setup, finalName, originalInventory);
          assert.equal((await query(page, "listProjectRenames", setup.workspace.workspaceId)).operations.length, 0);
        });
        await shutdown();
      }
    }
    assert.ok(shutdowns.length && shutdowns.every(shutdown => shutdown.passed));
    recordRenameEvidence(evidence, "normalShutdown", { status: "passed", asserted: true, invocations: shutdowns.length });
  } catch (error) {
    failure = error;
    if (active) recordRenameEvidence(active.target, active.stage, { status: "failed", reason: error.message });
    if (startup.current?.page) await startup.current.page.screenshot({ path: join(evidenceDirectory, `${mode}-rename-failed.png`), fullPage: true, timeout: 3000 }).catch(() => {});
    await save().catch(() => {});
  } finally {
    if (startup.current) {
      try { await shutdown(); } catch (error) { failure ??= error; recordRenameEvidence(evidence, "normalShutdown", { status: "failed", reason: error.message }); }
    }
    for (const target of nativeTargets) {
      const cleanup = await closeDisposableFileManagerTarget(target, process.platform, undefined, { ownedParent: true });
      observations.push({ failureFileManagerCleanup: cleanup });
      if (cleanup.status !== "completed") failure ??= new Error("Rename file-manager cleanup unverified");
      else nativeTargets.delete(target);
    }
    const termination = inspectOwnedProcesses(ownedProcesses, startup.pendingBackendPids, { launchUnverified: startup.launchUnverified });
    // Retain the predicate that actually governs cleanup, without PIDs, paths or
    // raw probe exceptions. Diagnostics never turn uncertainty into a pass.
    observations.push({ fixtureOwnership: { ...termination, backendExitEvidence: startup.backendExitEvidence, nativeStopped, nativeTargetCount: nativeTargets.size } });
    await cleanupOwnedFixture(fixture, { processesStopped: nativeStopped && nativeTargets.size === 0 && termination.stopped, primaryFailure: failure,
      record: async outcome => {
        recordRenameEvidence(evidence, "fixtureCleanup", outcome);
        try { if (!failure) assertRenameAcceptance(evidence); } catch (error) { failure = error; }
        await save();
        if (failure) throw failure;
      } });
  }
  assertRenameAcceptance(evidence);
  console.info(`Graphical rename ${mode} acceptance passed: direct/grouped Name, exact Text/inventory/identity, rejection, mounted case, sibling, native Reveal and seven interruption/restart scenarios per mode; evidence ${evidenceDirectory}`);
}
