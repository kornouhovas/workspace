import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
    recordCreationEvidence(evidence, null, "normalShutdown", { status });
    assert.throws(() => recordCreationEvidence(evidence, null, "restartPersistence", { status: "passed", asserted: true }), /normal shutdown/);
  }
  assert.throws(() => recordCreationEvidence(evidence, "direct", "creation", { status: "passed" }), /completed assertion/);
  recordCreationEvidence(evidence, "direct", "nativeInvocation", { status: "passed", asserted: true, apiResult: "" });
  assert.throws(() => recordCreationEvidence(evidence, "direct", "fileManagerOutcome", { status: "passed", asserted: true }), /exact target/);
  recordCreationEvidence(evidence, "direct", "fileManagerOutcome", { status: "passed", asserted: true, exactTargetObserved: true });
  assert.equal(evidence.direct.fileManagerOutcome.status, "passed");
  assert.equal(evidence.grouped.nativeInvocation.status, "unreached");
  recordCreationEvidence(evidence, null, "normalShutdown", { status: "failed", forcedCleanup: true });
  assert.equal(JSON.parse(JSON.stringify(evidence)).restartPersistence.status, "unreached");
});

test("native observation records only exact-target booleans and keeps unavailable OS checks pending", async () => {
  const { observeFileManagerTarget } = await import("../scripts/file-manager-evidence.mjs");
  const target = "C:\\Disposable\\Folder's name $value";
  let call;
  const run = async (...args) => { call = args; return { stdout: "true\n" }; };
  assert.deepEqual(await observeFileManagerTarget(target, "win32", run), { status: "passed", asserted: true, exactTargetObserved: true });
  assert.equal(call[2].env.WORKSPACE_OBSERVE_TARGET, target);
  assert.equal(call[1].join(" ").includes(target), false, "Target must remain data, never PowerShell code");
  assert.deepEqual(await observeFileManagerTarget("/tmp/disposable", "darwin", run), { status: "passed", asserted: true, exactTargetObserved: true });
  assert.deepEqual(call[1].slice(-2), ["/tmp/disposable", "disposable"]);
  assert.ok(call[1][1].includes('windows whose name is (item 2 of argv)'));
  assert.ok(call[1][1].includes('target of candidate as alias is expectedTarget'));
  assert.ok(call[1][1].includes('with timeout of 2 seconds'));
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
    if (platform === "darwin") { assert.deepEqual(args.slice(-2), [target, "owned-fixture"]); assert.ok(args[1].includes("is expectedTarget then close candidate")); }
    else { assert.equal(options.env.WORKSPACE_OBSERVE_TARGET, target); assert.ok(args.at(-1).includes("OrdinalIgnoreCase")); }
  }
  assert.equal((await closeDisposableFileManagerTarget("/tmp/owned", "linux", run)).status, "skipped");
});
