import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, rm, lstat, writeFile, readFile, readdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const { SCENARIOS } = require("../tests/fixtures/project-category-move-service-electron.cjs");
const { publishCommand } = require("../tests/fixtures/project-rename-service-control.cjs");
const { createProtocol } = require("../tests/fixtures/project-rename-native-protocol.cjs");
const repository = fileURLToPath(new URL("../", import.meta.url));
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; } };
const exists = async path => Boolean(await lstat(path).catch(() => null));
const states = new Set(["passed", "failed", "skipped", "unreached"]);

export async function inputDigest(inputRoot = repository) {
  const hash = createHash("sha256");
  async function include(relative) {
    const path = join(inputRoot, relative), stat = await lstat(path);
    if (stat.isDirectory()) { for (const name of (await readdir(path)).sort()) await include(`${relative}/${name}`); }
    else { hash.update(relative); hash.update("\0"); hash.update(await readFile(path)); hash.update("\0"); }
  }
  for (const relative of ["package-lock.json", "package.json", "src/service", "src/contracts", "native/project-rename/project_rename.c", "native/project-rename/binding.gyp",
    "src/desktop/backend-controller.ts", "dist/service", "dist/desktop/backend-controller.mjs",
    `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`,
    "scripts/smoke-project-category-move.mjs", "tests/fixtures/project-category-move-service-electron.cjs",
    "tests/fixtures/project-rename-native-protocol.cjs", "tests/fixtures/project-rename-service-control.cjs"]) await include(relative);
  return hash.digest("hex");
}

export async function superviseCategoryMoveService({ fault, evidenceDirectory = process.env.WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "workspace-category-move-service-")));
  const evidence = { platform: process.platform, arch: process.arch, supervisorNode: process.versions.node,
    inputSha256: null, ok: false, scenarios: Object.fromEntries(SCENARIOS.map(key => [key, { status: "unreached" }])),
    scenarioKinds: Object.fromEntries(SCENARIOS.map(key => [key,
      key === "grouped.occupied_insertion" ? "injected_adapter_collision"
        : ["grouped.retry_original", "grouped.keep_original"].includes(key) ? "injected_external_return_recovery"
          : key === "grouped.complete_destination" ? "injected_sqlite_recovery" : "production_service"])),
    events: [], cleanup: "pending", shutdownConfirmed: false };
  let child, timer, closed = false, resultOK = false, ack = false, resultSeen = false, protocolError = false;
  let utilityExits = 0, utilityExitFailure = false, mainReady = false, forceTimeout, stopOwned;
  const utilities = new Set(), activeUtilities = new Set();
  let utilityStarts = 0, terminal = false, ackPublished = false, exitPublished = false;
  const deadline = Date.now() + 45000;
  let publication = Promise.resolve();
  const publish = command => {
    // Serial, caught publication; an async filesystem failure cannot escape the
    // supervisor or turn a timeout/earlier protocol failure into acceptance.
    publication = publication.then(async () => {
      if (terminal) return;
      await publishCommand(root, command, deadline);
      if (terminal) return;
      if (command === "ack") ackPublished = true; else exitPublished = true;
      record(`${command}_sent`);
    }).catch(() => {
      if (!terminal) { evidence.controlError = true; evidence.controlFailure = "publish"; record("control_publish_failed"); stopOwned(); }
    });
  };
  const record = stage => { if (evidence.events.length < 80) evidence.events.push(stage); else protocolError = true; };
  const observe = message => {
    // The receiver can run before the rename callback returns to this process.
    // Defer that observation until publication is accounted for, never infer
    // delivery from a successful write or accept an unsolicited acknowledgment.
    if (message.stage === "ack_received" && resultSeen && !ackPublished && !terminal) {
      void publication.then(() => {
        if (ackPublished) observe(message); else protocolError = true;
      });
      return;
    }
    record(message.stage);
    if (message.stage === "utility_started") {
      if (Number.isSafeInteger(message.pid) && message.pid > 0 && message.pid !== process.pid) {
        utilities.add(message.pid); activeUtilities.add(message.pid); utilityStarts++;
      } else protocolError = true;
    } else if (message.stage === "utility_exit") {
      // PIDs stay private and are confirmed dead independently before cleanup.
      utilityExits++;
      if (!activeUtilities.delete(message.pid)) protocolError = true;
      if (!Number.isInteger(message.code)) protocolError = true;
      if (message.code !== 0) utilityExitFailure = true;
    } else if (message.stage === "result") {
      if (resultSeen) { protocolError = true; return; } resultSeen = true;
      resultOK = message.ok === true;
      for (const key of SCENARIOS) {
        const status = message.scenarios?.[key]?.status;
        if (states.has(status)) evidence.scenarios[key] = { status };
        else protocolError = true;
      }
      if (/^\d+\.\d+\.\d+$/.test(message.versions?.electron) && /^\d+\.\d+\.\d+$/.test(message.versions?.node))
        evidence.versions = { electron: message.versions.electron, node: message.versions.node };
      else protocolError = true;
      if (fault !== "missing-ack") publish("ack");
      else { clearTimeout(timer); timer = setTimeout(forceTimeout, 150); }
    } else if (message.stage === "ack_received") {
      if (!resultSeen || !ackPublished || ack || terminal) { protocolError = true; return; }
      ack = true; publish("exit");
    } else if (message.stage === "worker_started" && fault === "timeout") {
      clearTimeout(timer); timer = setTimeout(forceTimeout, 100);
    } else if (message.stage === "main_ready") {
      if (mainReady) protocolError = true;
      mainReady = true;
    } else if (message.stage === "startup_failed" && message.code === "fixture_control_failed") {
      // Retain only this finite receiver observation, never filesystem errors.
      evidence.controlError = true; evidence.controlFailure = "receive";
    } else protocolError = true;
  };
  const protocol = createProtocol(observe);
  const save = async () => {
    if (!evidenceDirectory) return;
    try {
      const directory = resolve(evidenceDirectory); await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "service-checkpoint.json"), JSON.stringify(evidence, null, 2) + "\n");
    } catch { evidence.ok = false; evidence.evidenceWriteFailed = true; record("evidence_write_failed"); }
  };
  const removeFixture = async () => {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (fault === "cleanup") throw new Error("Injected cleanup reporting failure");
  };
  try {
    evidence.inputSha256 = await inputDigest();
    const env = { ...process.env, WORKSPACE_CATEGORY_MOVE_SERVICE_ROOT: root };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_TEST_CONTEXT; delete env.WORKSPACE_CATEGORY_MOVE_SERVICE_FAULT;
    if (fault) env.WORKSPACE_CATEGORY_MOVE_SERVICE_FAULT = fault;
    child = spawn(require("electron"), [join(repository, "tests/fixtures/project-category-move-service-electron.cjs")],
      { cwd: repository, env, stdio: ["ignore", "pipe", "pipe"] });
    record("launched");
    child.stdout.on("data", data => { try { protocol.write(data); } catch { protocolError = true; } });
    let stderrBytes = 0; child.stderr.on("data", data => { stderrBytes = Math.min(1e9, stderrBytes + data.length); });
    await new Promise(accept => {
      child.once("error", () => { record("spawn_error"); });
      child.once("close", async (code, signal) => {
        closed = true; clearTimeout(timer);
        // Account for the completed publication before main's exit observation,
        // even if its close event beats the filesystem completion callback.
        await publication; terminal = true;
        evidence.exitCode = Number.isInteger(code) ? code : null; evidence.signaled = signal !== null;
        record("main_exit"); accept();
      });
      stopOwned = () => {
        terminal = true; clearTimeout(timer);
        for (const pid of activeUtilities) if (alive(pid)) { try { process.kill(pid); } catch { /* Confirm below. */ } }
        child.kill(); timer = setTimeout(accept, 1500);
      };
      forceTimeout = () => {
        evidence.timedOut = true; record("supervisor_timeout"); stopOwned();
      };
      timer = setTimeout(forceTimeout, Math.max(0, deadline - Date.now()));
    });
    clearTimeout(timer); terminal = true; await publication; protocol.finish();
    const limit = Date.now() + 1500;
    while ([...utilities].some(alive) && Date.now() < limit) await new Promise(accept => setTimeout(accept, 25));
    evidence.protocol = protocol.snapshot();
    evidence.protocolError = protocolError || evidence.protocol.failed;
    evidence.stderrBytes = stderrBytes;
    evidence.utilityCount = utilityStarts;
    evidence.utilityExitCount = utilityExits; evidence.utilityExitFailure = utilityExitFailure;
    evidence.shutdownConfirmed = closed && ![...utilities].some(alive);
    evidence.ok = evidence.shutdownConfirmed && !evidence.protocolError && !evidence.timedOut && evidence.exitCode === 0 &&
      resultOK && ack && ackPublished && exitPublished && !evidence.controlError && !evidence.signaled && mainReady && !utilityExitFailure && utilityExits === evidence.utilityCount && evidence.utilityCount === 4 && Object.values(evidence.scenarios).every(value => value.status === "passed");
  } catch {
    record("supervisor_failed");
  } finally {
    terminal = true; clearTimeout(timer); await publication;
    // Save finite failure observations before deleting any fixture data.
    await save();
    if (!child || evidence.shutdownConfirmed) {
      record("cleanup_started");
      try {
        await removeFixture();
        evidence.cleanup = await exists(root) ? "failed" : "removed";
      } catch { evidence.cleanup = "failed"; }
    } else {
      evidence.cleanup = "unverified_shutdown";
      child.kill(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
    }
    record(evidence.cleanup === "removed" ? "cleanup_complete" : "cleanup_failed");
    evidence.ok &&= evidence.cleanup === "removed";
    await save();
  }
  return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await superviseCategoryMoveService();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exitCode = result.ok ? 0 : 1;
}
