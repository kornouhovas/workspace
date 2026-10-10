import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";
import { packagedExecutablePath } from "./runtime-executable.mjs";
import { closeElectron, withDeadline } from "./runtime-lifecycle.mjs";
import { createCreationEvidence, recordCreationEvidence } from "./runtime-evidence.mjs";
import { observeFileManagerTarget, closeDisposableFileManagerTarget } from "./file-manager-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "dev";
assert.ok(["dev", "release"].includes(mode));
const executablePath = mode === "dev" ? createRequire(import.meta.url)("electron") : packagedExecutablePath(root, process.platform, process.arch);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "workspace-create-runtime-")));
const evidenceDirectory = process.env.WORKSPACE_SMOKE_EVIDENCE_DIR ?? join(root, "work", `creation-runtime-${mode}-${Date.now()}`);
await mkdir(evidenceDirectory, { recursive: true });
const selectedMode = process.argv.find((arg) => arg.startsWith("--discovery-mode="))?.split("=")[1];
const selectedCheckpoint = process.argv.find((arg) => arg.startsWith("--checkpoint="))?.split("=")[1];
assert.ok(!selectedMode || ["direct", "grouped"].includes(selectedMode));
assert.ok(!selectedCheckpoint || ["after_intent", "after_mkdir", "after_evidence", "after_commit"].includes(selectedCheckpoint));
const runs = (selectedMode ? [selectedMode] : ["direct", "grouped"]).flatMap((discoveryMode) =>
  (selectedCheckpoint ? [selectedCheckpoint] : ["after_intent", "after_mkdir", "after_evidence", "after_commit"]).map((checkpoint) => ({ discoveryMode, checkpoint, evidence: createCreationEvidence(), shutdowns: [] })));
let evidence = runs[0].evidence;
let activeRun;
let activeStage;
const observations = [];
const checkpointEvidence = [];
const nativeTargets = new Set();
let current;
let failure;
const save = async () => writeFile(join(evidenceDirectory, `${mode}-creation-observations.json`), JSON.stringify({
  mode, platform: process.platform, arch: process.arch, executablePath, fixedBase: "4ac402620dd8139bdef9ff03625aae64bf60e132",
  scope: "production UI/IPC/native adapter; interruption seeded by terminated real-service child, not an Electron backend crash",
  runs, checkpointEvidence, observations, ...(failure ? { error: failure.message } : {}),
}, null, 2) + "\n");
const record = async (discoveryMode, stage, result) => { recordCreationEvidence(evidence, discoveryMode, stage, result); await save(); };
const unwrap = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const query = async (page, type, workspaceId, extra = {}) => unwrap(await page.evaluate((input) => globalThis.window.workspace.workspace(input), { type: `workspace.${type}`, workspaceId, ...extra }));
const projectList = (page, workspaceId) => query(page, "listProjects", workspaceId);

async function seedCrash(data, discoveryMode, checkpoint, projectRoot, otherRoot) {
  await mkdir(data, { recursive: true });
  const marker = join(data, "cleanup-marker");
  const request = { type: "workspace.createProject", operationId: randomUUID(), name: "Interrupted" };
  const child = spawn(executablePath, [join(root, "tests/fixtures/project-creation-crash-worker.mjs"), join(data, "workspace.sqlite"), checkpoint,
    JSON.stringify(request), marker, JSON.stringify({ mode: discoveryMode, root: projectRoot, otherRoot })], {
    cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PATH: `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:${process.env.PATH}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "", message;
  const exited = once(child, "exit");
  child.stderr.on("data", (bytes) => { stderr += bytes; });
  try {
    await withDeadline(new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => { if (!message) reject(new Error(`Crash seed exited before checkpoint: ${stderr}`)); });
      child.stdout.on("data", (bytes) => {
        stdout += bytes;
        for (const line of stdout.split("\n").filter(Boolean)) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.checkpoint === checkpoint) { message = parsed; resolve(); }
            else if (parsed.unexpectedResult) reject(new Error(JSON.stringify(parsed)));
          } catch (error) { if (!(error instanceof SyntaxError)) reject(error); }
        }
      });
    }), 15000, "Crash seed checkpoint");
    child.kill("SIGKILL");
    await withDeadline(exited, 5000, "Crash seed termination");
    await assert.rejects(stat(marker), { code: "ENOENT" });
    assert.equal(message.operation.stage, checkpoint === "after_commit" ? "completed" : checkpoint === "after_evidence" ? "evidence_recorded" : "intent");
    checkpointEvidence.push({ discoveryMode, checkpoint, passed: true, cleanupExecuted: false, reservedProjectId: message.operation.project_id });
    await save();
    return message;
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await withDeadline(exited, 5000, "Crash seed cleanup"); }
  }
}
async function launch(data) {
  const electron = await _electron.launch({ executablePath, args: mode === "dev" ? [root] : [], cwd: root,
    env: { ...process.env, WORKSPACE_USER_DATA_DIR: data }, timeout: 30000 });
  current = { electron };
  const page = await electron.firstWindow(); current.page = page;
  page.setDefaultTimeout(15000);
  await page.locator("#interface-language").waitFor();
  assert.equal(await page.evaluate(() => typeof process), "undefined");
  assert.equal(await page.evaluate(() => typeof require), "undefined");
  assert.deepEqual(await electron.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, sandbox: p.sandbox };
  }), { contextIsolation: true, nodeIntegration: false, sandbox: true });
  return page;
}
async function select(page, workspace) {
  await page.locator("#workspace-switcher").selectOption(workspace.workspaceId);
  await page.getByRole("heading", { name: workspace.name, exact: true }).waitFor();
  await page.waitForFunction(() => !globalThis.document.querySelector("#workspace-switcher")?.disabled);
  await page.evaluate(() => new Promise((done) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
  await page.waitForFunction(() => globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false" && !globalThis.document.querySelector(".project-creation > button")?.disabled);
}
async function shutdown() {
  const closing = current; current = undefined;
  const pids = await closing.electron.evaluate(({ app }) => app.getAppMetrics().filter((metric) => metric.type === "Utility" && metric.serviceName?.includes("Node")).map((metric) => metric.pid));
  assert.ok(pids.length);
  try {
    await closeElectron(closing.electron); // Unchanged ten-second normal quit; forced cleanup throws.
    for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    activeRun.shutdowns.push({ status: "passed", backendStopped: true });
    await record(null, "normalShutdown", { status: "passed", asserted: true, backendStopped: true });
  } catch (error) {
    activeRun.shutdowns.push({ status: "failed", reason: error.message });
    await record(null, "normalShutdown", { status: "failed", reason: error.message }); throw error;
  }
}
const labels = {
  en: { create: "Create project folder", saved: "Project folder created.", review: "Review recovery", complete: "Complete the recorded folder association", retry: "Retry creation at the verified missing destination", associate: "Accept this reviewed folder for the reserved project", reveal: "Reveal folder", dispatched: "Request sent to the system file manager." },
  ru: { create: "Создать папку проекта", saved: "Папка проекта создана.", review: "Проверить восстановление", complete: "Завершить записанную связь с папкой", retry: "Повторить создание в проверенной отсутствующей папке", associate: "Принять проверенную папку для зарезервированного проекта", reveal: "Показать папку", dispatched: "Запрос отправлен системному файловому менеджеру." },
};
async function capture(page, discoveryMode, state) {
  for (const size of [{ width: 1440, height: 960 }, { width: 1024, height: 720 }, { width: 420, height: 800 }]) {
    await page.setViewportSize(size);
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
    for (const button of await page.locator(".project-creation button, .creation-review button").all()) {
      const bounds = await button.evaluate(async (node) => {
        node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        await new Promise((done) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done)));
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: globalThis.innerWidth, height: globalThis.innerHeight };
      });
      assert.equal(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, true, `Unreachable creation control: ${JSON.stringify(bounds)}`);
    }
    await page.screenshot({ path: join(evidenceDirectory, `${mode}-${discoveryMode}-${state}-${size.width}.png`), fullPage: true });
  }
}
try {
  await save();
  for (const discoveryMode of selectedMode ? [selectedMode] : ["direct", "grouped"]) {
    // All four abrupt boundaries are prepared independently; production UI
    // recovery covers intent, uncertain mkdir and sufficient recorded evidence.
    for (const checkpoint of selectedCheckpoint ? [selectedCheckpoint] : ["after_intent", "after_mkdir", "after_evidence", "after_commit"]) {
      activeRun = runs.find((run) => run.discoveryMode === discoveryMode && run.checkpoint === checkpoint);
      evidence = activeRun.evidence; activeStage = [discoveryMode, "interruptionRecovery"];
      const data = join(fixture, `${discoveryMode}-${checkpoint}`);
      const projectRoot = join(data, "root"), otherRoot = join(data, "other");
      const parent = discoveryMode === "grouped" ? join(projectRoot, "Category") : projectRoot;
      await mkdir(join(parent, "Existing"), { recursive: true }); await mkdir(otherRoot);
      await writeFile(join(parent, "Existing", "sentinel"), "existing bytes\0unchanged");
      await writeFile(join(otherRoot, "sentinel"), "unrelated bytes");
      const seed = await seedCrash(data, discoveryMode, checkpoint, projectRoot, otherRoot);
      const { workspace, sibling, other, properties } = seed.setup;
      const page = await launch(data);
      const language = discoveryMode === "direct" ? "en" : "ru";
      await page.locator("#interface-language").selectOption(language);
      await page.waitForFunction((lang) => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
      await select(page, workspace);
      const t = labels[language];
      const sourceObservation = await query(page, "getSourceObservation", workspace.workspaceId);
      assert.equal(sourceObservation.observation?.automaticUpdates, "active", "Production source observation must stay active");
      await page.evaluate(() => {
        globalThis.creationEvents = [];
        globalThis.stopCreationEvents = globalThis.window.workspace.onWorkspaceChange((event) => {
          if (event.type === "workspace.projectsChanged") globalThis.creationEvents.push(event);
        });
      });
      const preview = await query(page, "previewDiscovery", workspace.workspaceId);
      const applied = await query(page, "applyDiscovery", workspace.workspaceId, { previewToken: preview.previewToken });
      assert.equal(applied.projects.some((project) => project.name === "Interrupted"), checkpoint === "after_commit", "Apply must respect outstanding creation reservations");
      const operationList = await query(page, "listProjectCreations", workspace.workspaceId);
      assert.equal(operationList.operations.length, checkpoint === "after_commit" ? 0 : 1);
      if (checkpoint !== "after_commit") {
        assert.equal((await projectList(page, workspace.workspaceId)).projects.some((project) => project.name === "Interrupted"), false, "Startup must not silently enroll reserved destinations");
        await page.getByRole("button", { name: t.review, exact: true }).press("Enter");
        await page.locator(".creation-review").waitFor();
        await capture(page, discoveryMode, checkpoint);
        await page.getByRole("button", { name: checkpoint === "after_intent" ? t.retry : checkpoint === "after_mkdir" ? t.associate : t.complete, exact: true }).press("Enter");
        await page.getByText(t.saved, { exact: true }).waitFor();
      }
      if (checkpoint === "after_commit") {
        const beforeRetry = await projectList(page, workspace.workspaceId);
        const retried = await query(page, "createProject", workspace.workspaceId, seed.request);
        assert.equal(retried.outcome, "completed"); assert.equal(retried.project.projectId, seed.operation.project_id);
        assert.deepEqual(await projectList(page, workspace.workspaceId), beforeRetry, "A committed lost-response retry must preserve IDs and revision without filesystem replay");
      }
      const recovered = (await projectList(page, workspace.workspaceId)).projects.find((project) => project.name === "Interrupted");
      assert.equal(recovered.projectId, seed.operation.project_id);
      assert.equal((await query(page, "getProjectCreation", workspace.workspaceId, { operationId: seed.request.operationId })).outcome, "completed");
      await select(page, sibling);
      assert.equal((await projectList(page, sibling.workspaceId)).projects.find((project) => project.name === "Interrupted").projectId, recovered.projectId);
      assert.deepEqual(await query(page, "listTextProperties", workspace.workspaceId), properties);
      assert.equal((await projectList(page, other.workspaceId)).projects.length, 0);
      await select(page, workspace);
      await record(discoveryMode, "interruptionRecovery", checkpoint === "after_commit" ? { status: "skipped", reason: "Committed before response loss; status reconciliation verified, no recovery mutation required" } : { status: "passed", asserted: true, checkpoint, reservedProjectId: recovered.projectId });
      // Creation goes through keyboard-operated production form, typed preload,
      // controller and live observed service. New projects inherit no Text.
      activeStage = [discoveryMode, "creation"];
      const name = `Created-${checkpoint}-日本語`;
      await page.getByRole("button", { name: t.create, exact: true }).click();
      const input = page.locator("#project-creation-name"); await input.waitFor();
      assert.equal(await input.evaluate((node) => node === globalThis.document.activeElement), true);
      await input.fill(name);
      if (discoveryMode === "grouped") await page.locator(".project-creation select").selectOption(seed.request.categoryId);
      await capture(page, discoveryMode, `create-${checkpoint}`);
      await page.locator(".project-creation button[type=submit]").press("Enter");
      await page.locator(".project-creation form").waitFor({ state: "detached" });
      await page.getByText(t.saved, { exact: true }).waitFor();
      const created = (await projectList(page, workspace.workspaceId)).projects.find((project) => project.name === name);
      assert.ok(created); assert.notEqual(created.projectId, recovered.projectId);
      const destination = join(parent, name);
      assert.deepEqual(await readdir(destination), []);
      assert.deepEqual(await query(page, "listTextProperties", workspace.workspaceId), properties);
      await select(page, sibling);
      await page.getByRole("cell", { name, exact: true }).waitFor();
      assert.equal((await projectList(page, sibling.workspaceId)).projects.find((project) => project.name === name).projectId, created.projectId);
      assert.notEqual(workspace.viewId, sibling.viewId);
      await select(page, workspace);
      const events = await page.evaluate(() => { globalThis.stopCreationEvents(); return globalThis.creationEvents; });
      assert.ok(events.length > 0);
      for (const event of events) {
        assert.equal(event.sourceId, workspace.sourceId);
        assert.deepEqual(new Set(event.workspaceIds), new Set([workspace.workspaceId, sibling.workspaceId]));
      }
      observations.push({ discoveryMode, checkpoint, workspace, sibling, other, recovered, created, sourceObservation, events });
      await record(discoveryMode, "creation", { status: "passed", asserted: true, checkpoint, projectId: created.projectId });

      if (process.argv.includes("--skip-native")) {
        await record(discoveryMode, "nativeInvocation", { status: "skipped", reason: "Explicit recovery-only run; no native API invoked" });
        await record(discoveryMode, "fileManagerOutcome", { status: "skipped", reason: "Explicit recovery-only run" });
      } else {
        activeStage = [discoveryMode, "nativeInvocation"];
        // Wait for the explicitly requested Refresh and its committed UI load.
        // Observation remains active; lost dispatch feedback still fails below.
        await page.locator(".source-refresh > button").press("Enter");
        await page.waitForFunction(() => globalThis.document.querySelector(".source-refresh")?.getAttribute("aria-busy") === "false" && globalThis.document.querySelector(".table-view")?.getAttribute("aria-busy") === "false");
        await page.evaluate(() => new Promise((done) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
        const beforeRevealObservation = await query(page, "getSourceObservation", workspace.workspaceId);
        // Wrap, never mock, the actual Electron API used by main's native adapter.
        await current.electron.evaluate(({ shell }, target) => {
          const original = shell.openPath.bind(shell);
          globalThis.creationNativeCalls = [];
          shell.openPath = async (path) => {
            const result = await original(path);
            if (path === target) globalThis.creationNativeCalls.push({ path, result });
            return result;
          };
        }, destination);
        nativeTargets.add(destination);
        await page.getByRole("button", { name: `${t.reveal}: ${name}`, exact: true }).press("Enter");
        const calls = await withDeadline((async () => {
          for (let attempt = 0; attempt < 50; attempt++) {
            const calls = await current.electron.evaluate(() => globalThis.creationNativeCalls);
            if (calls.length) return calls;
            await new Promise((done) => setTimeout(done, 100));
          }
          return [];
        })(), 10000, "Real native invocation");
        assert.equal(calls.length, 1, "Reveal must invoke the real native API exactly once");
        const apiPassed = calls[0].result === "";
        await record(discoveryMode, "nativeInvocation", { status: apiPassed ? "passed" : "failed", asserted: apiPassed, api: "Electron shell.openPath", apiResult: calls[0].result, target: destination });
        activeStage = undefined; // Retain actual API results even if a later UI assertion fails.
        if (apiPassed) {
          await record(discoveryMode, "fileManagerOutcome", await observeFileManagerTarget(destination));
          const revealButton = page.getByRole("button", { name: `${t.reveal}: ${name}`, exact: true });
          await page.waitForFunction((name) => Array.from(globalThis.document.querySelectorAll(".project-reveal button")).some((node) => node.getAttribute("aria-label") === name && !node.disabled), `${t.reveal}: ${name}`);
          const feedback = await revealButton.locator("..").locator(".bb-status").innerText();
          const afterRevealObservation = await query(page, "getSourceObservation", workspace.workspaceId);
          observations.push({ nativeUiFeedback: feedback, beforeRevealObservation, afterRevealObservation });
          await save();
          assert.equal(feedback, t.dispatched, "A confirmed native dispatch must retain useful UI acknowledgment; source observation stays active");
        }
        assert.equal(apiPassed, true, "Native API returned an error");
      }
      assert.equal(await readFile(join(parent, "Existing", "sentinel"), "utf8"), "existing bytes\0unchanged");
      assert.equal(await readFile(join(otherRoot, "sentinel"), "utf8"), "unrelated bytes");
      assert.deepEqual(await readdir(join(parent, "Interrupted")), []);
      await save();
      activeStage = [null, "normalShutdown"];
      await shutdown();
      activeStage = [null, "restartPersistence"];
      const reopened = await launch(data);
      await select(reopened, workspace);
      const reopenedWorkspace = unwrap(await reopened.evaluate(() => globalThis.window.workspace.workspace({ type: "workspace.load" }))).activeWorkspace;
      for (const key of ["workspaceId", "sourceId", "viewId", "canonicalRoot"]) assert.equal(reopenedWorkspace[key], workspace[key]);
      assert.equal(await reopened.locator("html").getAttribute("lang"), language);
      const persisted = await projectList(reopened, workspace.workspaceId);
      assert.equal(persisted.projects.find((project) => project.name === name).projectId, created.projectId);
      assert.equal(persisted.projects.find((project) => project.name === "Interrupted").projectId, recovered.projectId);
      assert.deepEqual(await query(reopened, "listTextProperties", workspace.workspaceId), properties);
      assert.equal((await query(reopened, "listProjectCreations", workspace.workspaceId)).operations.length, 0);
      assert.deepEqual(await readdir(destination), []);
      assert.deepEqual(await readdir(join(parent, "Interrupted")), []);
      assert.equal(await readFile(join(parent, "Existing", "sentinel"), "utf8"), "existing bytes\0unchanged");
      assert.equal(await readFile(join(otherRoot, "sentinel"), "utf8"), "unrelated bytes");
      await record(null, "restartPersistence", { status: "passed", asserted: true, discoveryMode, checkpoint });
      activeStage = [null, "normalShutdown"];
      await shutdown(); activeStage = undefined;
    }
  }
} catch (error) {
  failure = error;
  if (activeStage) await record(...activeStage, { status: "failed", reason: error.message });
  if (current?.page) await current.page.screenshot({ path: join(evidenceDirectory, "failed.png"), fullPage: true, timeout: 3000 }).catch(() => {});
  await save();
} finally {
  if (current) {
    const closing = current; current = undefined;
    try { await closeElectron(closing.electron); observations.push({ cleanup: "normal quit passed", acceptance: "failure cleanup does not complete the scenario shutdown/restart stages" }); }
    catch (error) { failure ??= error; observations.push({ cleanup: "failed", error: error.message }); }
  }
  for (const target of nativeTargets) observations.push({ fileManagerCleanup: await closeDisposableFileManagerTarget(target), target });
  await save();
  await rm(fixture, { recursive: true, force: true });
}
if (failure) throw failure;
const nativeStatuses = runs.map((run) => run.evidence[run.discoveryMode].nativeInvocation.status);
console.info(`Creation/recovery ${mode} runtime completed; native API stages: ${nativeStatuses.filter((status) => status === "passed").length} passed, ${nativeStatuses.filter((status) => status === "skipped").length} skipped. Inspect separate exact-target file-manager and shutdown evidence in ${evidenceDirectory}`);
