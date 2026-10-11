import assert from "node:assert/strict";
import childProcess, { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { closeElectron, withDeadline } from "../scripts/runtime-lifecycle.mjs";

test("runtime deadlines preserve results and errors and reject stalled operations", async () => {
  assert.equal(await withDeadline(Promise.resolve("ready"), 100, "load"), "ready");
  const failure = new Error("load failed");
  await assert.rejects(withDeadline(Promise.reject(failure), 100, "load"), (error) => error === failure);
  await assert.rejects(withDeadline(new Promise(() => {}), 20, "load"), /load timed out/);
});

async function launchFixture() {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000); console.log('ready');"], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  await once(child.stdout, "data");
  return child;
}

test("normal runtime shutdown waits for the owned process to exit", async () => {
  const child = await launchFixture();
  const exited = once(child, "exit");
  try {
    await closeElectron({
      process: () => child,
      evaluate: async () => { child.kill(); },
      close: () => exited,
    }, 1000);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});

test("stalled runtime shutdown kills the owned process and reports failure within a deadline", async () => {
  const child = await launchFixture();
  try {
    await assert.rejects(closeElectron({
      process: () => child,
      evaluate: () => new Promise(() => {}),
      close: () => new Promise(() => {}),
    }, 20), /Electron shutdown timed out/);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});

test("Windows forced cleanup errors preserve the original shutdown failure and still await owned exit", async () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, signalCode: null });
  const primary = new Error("Electron shutdown timed out after 10000ms");
  Object.defineProperty(process, "platform", { value: "win32" });
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (program, args, options, callback) => {
    assert.equal(program, "taskkill");
    assert.deepEqual(args, ["/pid", "12345", "/T", "/F"]);
    assert.equal(options.timeout, 5000);
    callback(Object.assign(new Error("private taskkill stderr"), { code: 255 }));
    setImmediate(() => { child.exitCode = 1; child.emit("exit", 1); });
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(closeElectron({ process: () => child, evaluate: async () => {}, close: async () => { throw primary; } }), (error) => {
      assert.equal(error, primary);
      assert.equal(child.exitCode, 1, "Failed taskkill must not skip awaiting owned process termination");
      assert.deepEqual(error.forcedCleanup, { status: "failed", processStopped: true, errorCode: 255 });
      assert.equal(JSON.stringify(error.forcedCleanup).includes("private"), false);
      return true;
    });
  } finally {
    childProcess.execFile = originalExecFile; syncBuiltinESMExports(); Object.defineProperty(process, "platform", platform);
  }
});

test("a real configured backend with native root/category watches does not keep its Node process alive", async () => {
  const { mkdtemp, mkdir, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const directory = await mkdtemp(join(tmpdir(), "observer-exit-"));
  const root = join(directory, "root"), database = join(directory, "workspace.sqlite");
  let child;
  try {
    await mkdir(join(root, "Category/Project"), { recursive: true });
    const service = openSettingsService(database);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Exit", rootPath: root }).value;
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: "grouped" }).value;
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).ok, true);
    } finally { service.close(); }
    child = spawn(process.execPath, ["--input-type=module", "-e", `
      import { openSettingsService } from ${JSON.stringify(new URL("../dist/service/settings.mjs", import.meta.url).href)};
      const service = openSettingsService(process.argv[1]);
      if (service.workspaces.load().value.workspaces.length !== 1) process.exitCode = 1;
      // Deliberately leave service/watchers open: unreferenced resources must not
      // prevent a normal process exit. This is separate from native Electron #44.
    `, database], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    const [code, signal] = await withDeadline(once(child, "exit"), 5000, "Backend observer process exit");
    assert.equal(signal, null); assert.equal(code, 0, stderr);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGKILL"); await exited; }
    await rm(directory, { recursive: true, force: true });
  }
});

test("mode feature evidence survives failed normal quit without claiming restart or source reuse", async () => {
  const { createRuntimeStages, completeRuntimeStage } = await import("../scripts/runtime-evidence.mjs");
  const stages = createRuntimeStages();
  completeRuntimeStage(stages, "modeChangeCancel");
  completeRuntimeStage(stages, "modeChangeApply");
  assert.equal(stages.modeChangeRecovery, false);
  completeRuntimeStage(stages, "modeChangeRecovery");
  completeRuntimeStage(stages, "modeChangeFeatures");
  completeRuntimeStage(stages, "preQuitFeatures");
  const child = await launchFixture();
  try {
    await assert.rejects(closeElectron({ process: () => child, evaluate: () => new Promise(() => {}), close: () => new Promise(() => {}) }, 20), /Electron shutdown timed out/);
    const evidence = JSON.parse(JSON.stringify({ stages, shutdowns: [{ passed: false, error: "Electron shutdown timed out" }] }));
    assert.equal(evidence.stages.modeChangeFeatures, true);
    for (const name of ["firstShutdown", "modeChangeRestart", "modeChangeSourceReuse", "restartPersistence", "retainedSourceReuse"]) assert.equal(evidence.stages[name], false);
    assert.throws(() => completeRuntimeStage(stages, "modeChangeRestart"), /requires firstShutdown/);
    assert.throws(() => completeRuntimeStage(stages, "modeChangeSourceReuse"), /requires modeChangeRestart/);
    completeRuntimeStage(stages, "firstShutdown");
    assert.throws(() => completeRuntimeStage(stages, "modeChangeRestart"), /requires restartPersistence/);
    completeRuntimeStage(stages, "restartPersistence"); completeRuntimeStage(stages, "modeChangeRestart");
    assert.throws(() => completeRuntimeStage(stages, "modeChangeSourceReuse"), /requires retainedSourceReuse/);
    completeRuntimeStage(stages, "retainedSourceReuse"); completeRuntimeStage(stages, "modeChangeSourceReuse");
    assert.equal(stages.modeChangeSourceReuse, true);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});

test("creation evidence never promotes failed/skipped/unreached native or shutdown gates", async () => {
  const { createCreationEvidence, recordCreationEvidence } = await import("../scripts/runtime-evidence.mjs");
  const evidence = createCreationEvidence();
  assert.equal(evidence.direct.creation.status, "unreached");
  for (const status of ["failed", "skipped", "pending", "unreached"]) {
    recordCreationEvidence(evidence, "direct", "nativeInvocation", { status, reason: "fixture gate" });
    assert.throws(() => recordCreationEvidence(evidence, "direct", "fileManagerOutcome", { status: "passed", asserted: true, exactTargetObserved: true }), /requires/);
    assert.throws(() => recordCreationEvidence(evidence, "direct", "nativeAcknowledgment", { status: "passed", asserted: true }), /requires/);
    recordCreationEvidence(evidence, null, "normalShutdown", { status });
    assert.throws(() => recordCreationEvidence(evidence, null, "restartPersistence", { status: "passed", asserted: true }), /normal shutdown/);
  }
  assert.throws(() => recordCreationEvidence(evidence, "direct", "creation", { status: "passed" }), /completed assertion/);
  recordCreationEvidence(evidence, "direct", "nativeInvocation", { status: "passed", asserted: true, apiResult: "" });
  assert.throws(() => recordCreationEvidence(evidence, "direct", "fileManagerOutcome", { status: "passed", asserted: true }), /exact target/);
  recordCreationEvidence(evidence, "direct", "fileManagerOutcome", { status: "passed", asserted: true, exactTargetObserved: true });
  assert.equal(evidence.direct.fileManagerOutcome.status, "passed");
  assert.equal(evidence.direct.nativeAcknowledgment.status, "unreached");
  recordCreationEvidence(evidence, "direct", "nativeAcknowledgment", { status: "failed", reason: "UI feedback lost" });
  assert.equal(evidence.direct.nativeInvocation.status, "passed");
  assert.equal(evidence.direct.fileManagerOutcome.status, "passed");
  assert.equal(evidence.grouped.nativeInvocation.status, "unreached");
  recordCreationEvidence(evidence, null, "normalShutdown", { status: "failed", forcedCleanup: true });
  assert.equal(JSON.parse(JSON.stringify(evidence)).restartPersistence.status, "unreached");
});

test("native observation records only exact-target booleans and keeps unavailable OS checks pending", async () => {
  const { observeFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  const target = "C:\\Disposable\\Folder's name $value";
  let call;
  const run = async (...args) => { call = args; return { stdout: args[0] === "powershell.exe" ? JSON.stringify({
    exactParentFound: true, targetPresent: true, selectedTargetMatch: true, exactParentCount: 1, errorCount: 0, errors: [],
  }) : "true\n" }; };
  const windows = await observeFileManagerTarget(target, "win32", run);
  assert.equal(windows.status, "passed"); assert.equal(windows.exactTargetObserved, true);
  assert.equal(call[2].env.WORKSPACE_OBSERVE_TARGET, target);
  assert.equal(call[1].join(" ").includes(target), false, "Target must remain data, never PowerShell code");
  assert.deepEqual(await observeFileManagerTarget("/tmp/disposable", "darwin", run), { status: "passed", asserted: true, exactTargetObserved: true });
  assert.deepEqual(call[1].slice(-3), ["/tmp/disposable", "/tmp", "tmp"]);
  assert.ok(call[1][1].includes('windows whose name is (item 3 of argv)'));
  assert.ok(call[1][1].includes('target of candidate as alias is expectedParent'));
  assert.ok(call[1][1].includes('with timeout of 2 seconds'));
  assert.ok(call[1][1].includes('selectedItem as alias is expectedTarget'));
  assert.ok(call[1][1].includes('(get selection)'));
  for (const stdout of ["false", "", "some unrelated window"]) {
    const result = await observeFileManagerTarget("/tmp/disposable", "darwin", async () => ({ stdout }));
    assert.equal(result.status, "pending");
    assert.equal(JSON.stringify(result).includes("unrelated window"), false);
  }
  const denied = await observeFileManagerTarget("/tmp/disposable", "darwin", async () => { throw Object.assign(new Error("private user location"), { code: "EACCES" }); });
  assert.equal(denied.status, "pending"); assert.equal(JSON.stringify(denied).includes("private user"), false);
  assert.equal((await observeFileManagerTarget("/tmp/disposable", "linux")).status, "skipped");
});

test("file-manager cleanup confines window closure to the supplied disposable path", async () => {
  const { closeDisposableFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  const calls = [];
  const run = async (...args) => { calls.push(args); return { stdout: "" }; };
  for (const platform of ["darwin", "win32"]) {
    const target = platform === "darwin" ? "/tmp/owned-fixture" : "C:\\owned-fixture";
    assert.equal((await closeDisposableFileManagerTarget(target, platform, run)).status, "completed");
    const [program, args, options] = calls.at(-1);
    assert.ok(["osascript", "powershell.exe"].includes(program));
    assert.equal(args.join(" ").includes("kill"), false);
    if (platform === "darwin") { assert.deepEqual(args.slice(-3), [target, "/tmp", "tmp"]); assert.ok(args[1].includes("selectedItem as alias is expectedTarget then")); }
    else { assert.equal(options.env.WORKSPACE_OBSERVE_TARGET, target); assert.ok(args.at(-1).includes("OrdinalIgnoreCase")); }
  }
  assert.equal((await closeDisposableFileManagerTarget("/tmp/owned", "linux", run)).status, "skipped");
});

test("bounded observation waits for an asynchronous exact target without another native invocation", async () => {
  const { waitForFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  let elapsed = 0, reads = 0, nativeCalls = 0;
  const reveal = () => { nativeCalls++; };
  reveal();
  const result = await waitForFileManagerTarget("C:\\Disposable\\selected", "win32", async (_program, _args, options) => {
    assert.ok(options.timeout <= 10000 - elapsed);
    elapsed += 50;
    const matched = ++reads === 3;
    return { stdout: JSON.stringify({ exactParentFound: matched, targetPresent: matched, selectedTargetMatch: matched,
      exactParentCount: matched ? 1 : 0, errorCount: 0, errors: [] }) };
  }, { now: () => elapsed, sleep: async (ms) => { elapsed += ms; } });
  assert.equal(result.status, "passed");
  assert.equal(result.exactTargetObserved, true);
  assert.equal(result.completion, "exact_target");
  assert.equal(result.attempts.length, 3);
  assert.equal(result.elapsedMs, elapsed);
  assert.equal(nativeCalls, 1);
  assert.equal(result.deadlineMs, 10000);
});

test("observation exhausts one total deadline and caps each subprocess by the remaining budget", async () => {
  const { waitForFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  let elapsed = 0;
  const timeouts = [];
  const result = await waitForFileManagerTarget("/tmp/disposable", "darwin", async (_program, _args, options) => {
    timeouts.push(options.timeout);
    elapsed += options.timeout;
    throw Object.assign(new Error("private stderr"), { killed: true });
  }, { now: () => elapsed, sleep: async (ms) => { elapsed += ms; } });
  assert.equal(result.status, "pending");
  assert.equal(result.completion, "deadline");
  assert.equal(result.elapsedMs, 10000);
  assert.equal(result.attempts.length, 2);
  assert.deepEqual(timeouts, [5000, 4900]);
  assert.equal(JSON.stringify(result).includes("private stderr"), false);
});

test("observation preserves unavailable and unsupported outcomes without claiming OS success", async () => {
  const { waitForFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  let commands = 0;
  const run = async () => { commands++; throw Object.assign(new Error("user location"), { code: "EACCES" }); };
  const result = await waitForFileManagerTarget("/tmp/disposable", "darwin", run);
  assert.equal(result.status, "pending");
  assert.equal(result.completion, "unavailable");
  assert.equal(result.attempts.length, 1);
  assert.equal(JSON.stringify(result).includes("user location"), false);
  assert.equal((await waitForFileManagerTarget("/tmp/disposable", "linux", run)).status, "skipped");
  assert.equal(commands, 1);
});

test("an exact target returned after the total deadline cannot become passed evidence", async () => {
  const { waitForFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  let elapsed = 0;
  const result = await waitForFileManagerTarget("/tmp/disposable", "darwin", async () => {
    elapsed = 10001;
    return { stdout: "true" };
  }, { now: () => elapsed, sleep: async () => {} });
  assert.equal(result.status, "pending");
  assert.equal(result.completion, "deadline");
  assert.notEqual(result.exactTargetObserved, true);
});

test("owned fixture cleanup removes only the supplied tree after verified termination", async () => {
  const { cleanupOwnedFixture } = await import("../scripts/runtime-lifecycle.mjs");
  const { mkdtemp, mkdir, rm, stat } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const parent = await mkdtemp(join(tmpdir(), "owned-cleanup-"));
  const fixture = join(parent, "fixture"), unrelated = join(parent, "unrelated");
  await mkdir(fixture); await mkdir(unrelated);
  const outcomes = [];
  try {
    await cleanupOwnedFixture(fixture, { processesStopped: true, record: async (outcome) => outcomes.push(outcome) });
    await assert.rejects(stat(fixture), { code: "ENOENT" });
    assert.equal((await stat(unrelated)).isDirectory(), true);
    assert.equal(outcomes[0].status, "passed");
    assert.equal(outcomes[0].asserted, true);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("owned cleanup forwards bounded filesystem retries for transient Windows locks", async () => {
  const { cleanupOwnedFixture } = await import("../scripts/runtime-lifecycle.mjs");
  let attempts = 0;
  const outcomes = [];
  await cleanupOwnedFixture("owned-fixture", { processesStopped: true, record: async (outcome) => outcomes.push(outcome) }, async (path, options) => {
    assert.equal(path, "owned-fixture");
    assert.deepEqual(options, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    // Simulate fs.rm's transient-lock recovery, not an actual Windows OS result.
    for (let retry = 0; retry <= options.maxRetries; retry++) {
      attempts++;
      if (attempts === 3) return;
    }
    throw Object.assign(new Error("locked"), { code: "EBUSY" });
  });
  assert.equal(attempts, 3);
  assert.equal(outcomes[0].status, "passed");
});

test("exhausted cleanup is saved before throwing and cannot hide the primary scenario failure", async () => {
  const { cleanupOwnedFixture } = await import("../scripts/runtime-lifecycle.mjs");
  const locked = Object.assign(new Error("owned database remains locked"), { code: "EBUSY" });
  for (const primaryFailure of [undefined, new Error("Reveal acknowledgment failed")]) {
    const outcomes = [];
    await assert.rejects(cleanupOwnedFixture("owned-fixture", {
      processesStopped: true, primaryFailure, record: async (outcome) => outcomes.push(outcome),
    }, async () => { throw locked; }), (error) => {
      assert.equal(outcomes.length, 1, "Cleanup result must be saved before throwing");
      assert.equal(outcomes[0].status, "failed");
      assert.equal(outcomes[0].code, "EBUSY");
      return error === (primaryFailure ?? locked);
    });
  }
});

test("cleanup never removes a fixture while owned-process termination is unverified", async () => {
  const { cleanupOwnedFixture } = await import("../scripts/runtime-lifecycle.mjs");
  let removes = 0;
  const outcomes = [];
  await assert.rejects(cleanupOwnedFixture("owned-fixture", {
    processesStopped: false, record: async (outcome) => outcomes.push(outcome),
  }, async () => { removes++; }), /termination/);
  assert.equal(removes, 0);
  assert.equal(outcomes[0].status, "skipped");
});


test("repeated nonmatching observations remain pending at the deadline", async () => {
  const { waitForFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  let elapsed = 0;
  const result = await waitForFileManagerTarget("/tmp/disposable", "darwin", async (_program, _args, options) => {
    elapsed += Math.min(200, options.timeout);
    return { stdout: "false" };
  }, { now: () => elapsed, sleep: async (ms) => { elapsed += ms; } });
  assert.equal(result.status, "pending");
  assert.equal(result.completion, "deadline");
  assert.equal(result.elapsedMs, 10000);
  assert.ok(result.attempts.length > 1);
  assert.equal(result.attempts.some((attempt) => attempt.status === "passed"), false);
});

test('runtime fixture cleanup checks recorded parents/backends after the active UI session is cleared', async () => {
  const { ownedProcessesStopped, cleanupOwnedFixture } = await import('../scripts/runtime-lifecycle.mjs');
  const primary = new Error('Electron shutdown timed out after 10000ms');
  const child = { exitCode: null, signalCode: null };
  const children = new Set([child]), pids = new Set([23456]);
  const outcomes = []; let removes = 0;
  const gone = () => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); };
  async function cleanup() {
    return cleanupOwnedFixture('owned-fixture', {
      processesStopped: ownedProcessesStopped(children, pids, { probe: gone }), primaryFailure: primary,
      record: async outcome => outcomes.push(outcome),
    }, async () => { removes++; throw Object.assign(new Error('journal locked'), { code: 'EBUSY' }); });
  }
  await assert.rejects(cleanup(), error => error === primary);
  assert.equal(removes, 0); assert.equal(outcomes.at(-1).status, 'skipped');
  child.exitCode = 1;
  assert.equal(ownedProcessesStopped(children, pids, { probe: () => {} }), false, 'live utility process must block removal');
  assert.equal(ownedProcessesStopped(children, pids, { probe: () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); } }), false);
  assert.equal(ownedProcessesStopped(children, pids, { probe: gone, launchUnverified: true }), false);
  assert.equal(ownedProcessesStopped(children, pids, { probe: gone }), true);
  await assert.rejects(cleanup(), error => error === primary);
  assert.equal(removes, 1); assert.equal(outcomes.at(-1).code, 'EBUSY');
});

test('full runtime wiring retains launch ownership and uses guarded cleanup rather than unconditional removal', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/smoke-runtime.mjs', import.meta.url), 'utf8');
  assert.ok(source.indexOf('ownedProcesses.add(electron.process())') < source.indexOf('electron.firstWindow('));
  assert.match(source, /for \(const pid of pids\) ownedBackendPids.add\(pid\)/);
  assert.match(source, /await cleanupOwnedFixture\(fixture, \{\s*processesStopped: ownedProcessesStopped\(ownedProcesses, ownedBackendPids, \{ launchUnverified \}\), primaryFailure/);
  assert.match(source, /fixtureCleanup = outcome/);
  assert.match(source, /closeCurrent\(\{ kind: "failed-startup", requireBackend: false \}\)/);
  assert.doesNotMatch(source, /await rm\(fixture/);
  const launchSource = source.slice(source.indexOf('async function launch('), source.indexOf('async function backendPids('));
  assert.ok(launchSource.indexOf('launchUnverified = false') > launchSource.indexOf('await backendPids(electron)'));
  assert.match(source, /await closeRuntimeSession\(closing.electron/);
});

test('runtime close still attempts quit when backend metrics or pre-close evidence fails', async () => {
  const { closeRuntimeSession } = await import('../scripts/runtime-lifecycle.mjs');
  for (const failingStep of ['metrics', 'evidence']) {
    const primary = new Error(`${failingStep} failed`), shutdown = { passed: false };
    let closes = 0, verified = 0;
    const electron = {};
    await assert.rejects(closeRuntimeSession(electron, {
      shutdown,
      readBackendPids: async () => { if (failingStep === 'metrics') throw primary; return [12345]; },
      beforeClose: async () => { if (failingStep === 'evidence') throw primary; },
      assertBackendsStopped: async pids => { assert.deepEqual(pids, failingStep === 'metrics' ? [] : [12345]); verified++; },
    }, async app => { assert.equal(app, electron); closes++; }), error => error === primary);
    assert.equal(closes, 1); assert.equal(verified, 1); assert.equal(shutdown.passed, false);
    assert.equal(shutdown[failingStep === 'metrics' ? 'ownershipError' : 'evidenceError'], primary.message);
  }
});

test('runtime close keeps shutdown timeout separate from unavailable metrics and cleanup cannot promote it', async () => {
  const { closeRuntimeSession } = await import('../scripts/runtime-lifecycle.mjs');
  const timeout = Object.assign(new Error('Electron shutdown timed out after 10000ms'), {
    forcedCleanup: { status: 'failed', processStopped: false },
  });
  const shutdown = { passed: false };
  await assert.rejects(closeRuntimeSession({}, {
    shutdown, readBackendPids: async () => { throw new Error('metrics unavailable'); }, beforeClose: async () => {},
    assertBackendsStopped: async () => { assert.fail('normal exit is not established'); },
  }, async () => { throw timeout; }), error => error === timeout);
  assert.equal(shutdown.passed, false);
  assert.equal(shutdown.error, timeout.message);
  assert.equal(shutdown.ownershipError, 'metrics unavailable');
  assert.deepEqual(shutdown.forcedCleanup, timeout.forcedCleanup);
});

test('actual runtime launch keeps early window/path failures unverified after owned parent exits', async () => {
  const { readFile } = await import('node:fs/promises');
  const { ownedProcessesStopped } = await import('../scripts/runtime-lifecycle.mjs');
  const source = await readFile(new URL('../scripts/smoke-runtime.mjs', import.meta.url), 'utf8');
  const launchSource = source.slice(source.indexOf('async function launch('), source.indexOf('async function backendPids('));
  const invoke = new Function('dependencies', `return (async () => {
    const { mkdir, console, _electron, mode, executablePath, root, process, ownedProcesses,
      withDeadline, assert, backendPids, closeElectron } = dependencies;
    let launchUnverified = false;
    ${launchSource}
    try { await launch('owned-data'); throw new Error('Expected launch failure'); }
    catch (error) { return { error, launchUnverified }; }
  })()`);
  for (const step of ['window', 'paths']) {
    const primary = new Error(`${step} unavailable`);
    const child = { exitCode: null, signalCode: null }, ownedProcesses = new Set();
    let closes = 0;
    const page = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, on() {} };
    const result = await invoke({
      mkdir: async () => {}, console: { info() {} }, mode: 'dev', executablePath: 'electron', root: 'owned-root', process: { env: {} },
      ownedProcesses, withDeadline, assert, backendPids: async () => { assert.fail('backend capture was not reached'); },
      _electron: { launch: async () => ({ process: () => child,
        firstWindow: async () => { if (step === 'window') throw primary; return page; },
        evaluate: async () => { throw primary; },
      }) },
      closeElectron: async () => { closes++; child.exitCode = 1; },
    });
    assert.equal(result.error, primary); assert.equal(closes, 1);
    assert.equal(ownedProcesses.has(child), true); assert.equal(result.launchUnverified, true);
    assert.equal(ownedProcessesStopped(ownedProcesses, [], { launchUnverified: result.launchUnverified }), false);
  }
});

for (const lineEnding of ["LF", "CRLF"]) for (const forced of [false, true]) for (const evidenceFails of [false, true]) {
  test(`runtime source-move failure remains primary with ${lineEnding} through ${forced ? "forced" : "normal"} quit and ${evidenceFails ? "failed" : "saved"} evidence`, async (t) => {
    const { mkdir, mkdtemp, readFile, rm, stat, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { cleanupOwnedFixture, closeRuntimeSession, ownedProcessesStopped } = await import("../scripts/runtime-lifecycle.mjs");
    const { createRuntimeSourceDisconnect, createRuntimeSourceMoveEvidence } = await import("../scripts/runtime-source-disconnect.mjs");
    const parent = await mkdtemp(join(tmpdir(), "source-move-cleanup-"));
    const fixture = join(parent, "fixture"), unrelated = join(parent, "unrelated");
    await mkdir(fixture); await mkdir(unrelated); await mkdir(join(fixture, "source"));
    await writeFile(join(fixture, "source", "sentinel"), "Retained bytes");
    t.after(() => rm(parent, { recursive: true, force: true }));
    const sourceMoves = createRuntimeSourceMoveEvidence();
    const move = await createRuntimeSourceDisconnect({ ownedFixture: fixture, sourceName: "source" }, { rename: async () => {} });
    let primary;
    try { await sourceMoves.run("disconnect", move, async () => {}); } catch (error) { primary = error; }
    assert.equal(primary.code, "missing_effects");
    const source = (await readFile(new URL("../scripts/smoke-runtime.mjs", import.meta.url), "utf8"))
      .replace(/\r?\n/g, lineEnding === "CRLF" ? "\r\n" : "\n");
    const normalizedSource = source.replace(/\r\n/g, "\n");
    const tail = normalizedSource.slice(normalizedSource.indexOf('} catch (error) {\n  scenarioFailure = error;'), normalizedSource.lastIndexOf("\n\n}"));
    assert.ok(tail.startsWith("} catch (error)"));
    const child = await launchFixture(), exited = once(child, "exit");
    const electron = { process: () => child, evaluate: () => forced ? new Promise(() => {}) : Promise.resolve(child.kill()),
      close: () => forced ? new Promise(() => {}) : exited };
    const shutdown = { passed: false }, evidence = [];
    let quitAttempts = 0, backendChecks = 0;
    const recordEvidence = async (status) => {
      evidence.push({ status, sourceMoves: sourceMoves.snapshot(), shutdown: { ...shutdown } });
      if (evidenceFails) throw new Error("Evidence write failed");
    };
    const closeCurrent = async () => {
      quitAttempts++;
      await closeRuntimeSession(electron, {
        shutdown, readBackendPids: async () => [child.pid], beforeClose: () => recordEvidence("before quit"),
        assertBackendsStopped: async pids => {
          backendChecks++;
          assert.deepEqual(pids, [child.pid]);
          assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
        },
      }, app => closeElectron(app, forced ? 20 : 1000));
    };
    const dependencies = { primary, current: { page: { screenshot: async () => { throw new Error("Screenshot unavailable"); } } },
      evidenceDirectory: "owned-evidence", join, mode: "dev", recordEvidence, closeCurrent, cleanupOwnedFixture,
      fixture, ownedProcessesStopped, ownedProcesses: new Set([child]), ownedBackendPids: new Set([child.pid]), launchUnverified: false };
    const invoke = new Function("dependencies", `return (async () => {
      const { ${Object.keys(dependencies).join(", ")} } = dependencies;
      let scenarioFailure, cleanupFailure, fixtureCleanup;
      try { throw primary;
      ${tail}
    })();`);
    try {
      await assert.rejects(invoke(dependencies), error => error === primary);
      assert.equal(quitAttempts, 1);
      assert.equal(backendChecks, forced ? 0 : 1);
      assert.equal(shutdown.passed, !forced && !evidenceFails);
      if (forced) {
        assert.match(shutdown.error, /Electron shutdown timed out/);
        assert.deepEqual(shutdown.forcedCleanup, { status: "passed", processStopped: true });
      } else {
        assert.equal(shutdown.forcedCleanup, undefined);
        assert.equal(shutdown.error, evidenceFails ? "Evidence write failed" : undefined);
      }
      assert.equal(shutdown.evidenceError, evidenceFails ? "Evidence write failed" : undefined);
      assert.ok(child.exitCode !== null || child.signalCode !== null);
      assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
      assert.equal(evidence.at(-1).status, "failed");
      assert.equal(evidence.at(-1).sourceMoves.length, 4);
      assert.equal(evidence.at(-1).sourceMoves[0].status, "failed");
      assert.equal(evidence.at(-1).sourceMoves[0].finalCode, "missing_effects");
      assert.ok(evidence.at(-1).sourceMoves.slice(1).every(outcome => outcome.status === "unreached"));
      await assert.rejects(stat(fixture), { code: "ENOENT" });
      assert.equal((await stat(unrelated)).isDirectory(), true);
    } finally {
      if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
    }
  });
}

test("rename assertion failure survives normal owned shutdown, evidence failure and successful fixture cleanup", async () => {
  const { mkdtemp, stat, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { closeRuntimeSession, cleanupOwnedFixture, ownedProcessesStopped } = await import("../scripts/runtime-lifecycle.mjs");
  const { createRenameEvidence, recordRenameEvidence, assertRenameAcceptance } = await import("../scripts/runtime-evidence.mjs");
  const fixture = await mkdtemp(join(tmpdir(), "rename-lifecycle-"));
  const child = await launchFixture(), exited = once(child, "exit");
  const primary = new Error("Required rename preservation assertion failed"), evidence = createRenameEvidence();
  recordRenameEvidence(evidence.direct.recovery.final_effect, "preservation", { status: "failed", reason: primary.message });
  const shutdown = { passed: false };
  try {
    await assert.rejects(closeRuntimeSession({ process: () => child, evaluate: async () => { child.kill(); }, close: () => exited }, {
      shutdown, readBackendPids: async () => [child.pid], beforeClose: async () => { throw new Error("Evidence write failed"); },
      assertBackendsStopped: async () => assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" }),
    }), /Evidence write failed/);
    assert.equal(shutdown.passed, false);
    assert.equal(ownedProcessesStopped(new Set([child]), new Set([child.pid])), true);
    await assert.rejects(cleanupOwnedFixture(fixture, { processesStopped: true, primaryFailure: primary,
      record: async outcome => recordRenameEvidence(evidence, "fixtureCleanup", outcome) }), error => error === primary);
    assert.equal(evidence.fixtureCleanup.status, "passed");
    assert.equal(evidence.direct.recovery.final_effect.preservation.status, "failed");
    assert.throws(() => assertRenameAcceptance(evidence));
    await assert.rejects(stat(fixture), { code: "ENOENT" });
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
    await rm(fixture, { recursive: true, force: true });
  }
});
