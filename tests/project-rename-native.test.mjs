import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mkdir, writeFile, copyFile, mkdtemp, rm, lstat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";

import { tmpdir } from "node:os";
import { createPackageWithOptions } from "@electron/asar";

const require = createRequire(import.meta.url);
const { verifyAdapter } = require("./fixtures/project-rename-native-electron.cjs");
const supported = process.platform === "darwin" || process.platform === "win32";
const evidence = { platform: process.platform, arch: process.arch, node: process.versions.node, results: {} };

async function record(name, action) {
  try { const result = await action(); evidence.results[name] = { ok: true, observations: result }; return result; }
  catch (error) { evidence.results[name] = { ok: false, lifecycle: error.lifecycle }; throw error; }
  finally {
    if (process.env.WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR) {
      const directory = resolve(process.env.WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "native-adapter.json"), JSON.stringify(evidence, null, 2) + "\n");
    }
  }
}

test("real Node no-replace adapter preserves identities, bytes, occupied entries and late collisions", { skip: !supported }, async () => {
  await record("node", async () => {
    const adapter = await import("../dist/service/project-rename-filesystem.mjs");
    const observations = verifyAdapter(adapter.renameNoReplace);
    verifyAdapter(require("../dist/service-test-native/project-rename.node").renameNoReplace);
    return observations;
  });
});

// Finite fixture protocol: retain stages/codes, never child stderr, paths or stacks.
const stages = new Set(["main_ready", "utility_started", "worker_started", "missing_loading", "missing_verified",
  "corrupt_loading", "corrupt_verified", "fixed_loading", "fixed_loaded", "result", "ack_sent", "ack_received",
  "exit_sent", "utility_exit", "utility_timeout", "startup_failed"]);
const codes = new Set(["EPERM", "EACCES", "ENOENT", "ERR_ASSERTION", "ERR_DLOPEN_FAILED", "unknown"]);
const exists = async path => Boolean(await lstat(path).catch(() => null));
const alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
};

async function supervise({ runtime = "node", packaged = false, fault } = {}) {
  const root = await mkdtemp(join(tmpdir(), "workspace-native-supervisor-"));
  const lifecycle = { runtime, packaged, fault: fault ?? "none", events: [], cleanup: "pending" };
  let child, utilityPid, utilityExited = false, closed = false, timer, result, protocolError = false;
  let stderrBytes = 0, stdoutBytes = 0, pending = "";
  const event = (stage, details = {}) => lifecycle.events.push({ stage, ...details });
  try {
    let entry = fileURLToPath(new URL("./fixtures/project-rename-native-electron.cjs", import.meta.url));
    if (packaged) {
      const app = join(root, "app");
      for (const file of ["tests/fixtures/project-rename-native-electron.cjs", "dist/service/project-rename-filesystem.cjs", "dist/service/native/project-rename.node"]) {
        const target = join(app, file); await mkdir(dirname(target), { recursive: true });
        await copyFile(fileURLToPath(new URL(`../${file}`, import.meta.url)), target);
      }
      await writeFile(join(app, "package.json"), JSON.stringify({ name: "rename-native-fixture", main: "tests/fixtures/project-rename-native-electron.cjs" }));
      entry = join(root, "app.asar");
      await createPackageWithOptions(app, entry, { unpack: "project-rename.node" });
    }
    const env = { ...process.env, WORKSPACE_RENAME_FIXTURE_ROOT: root };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_TEST_CONTEXT; delete env.WORKSPACE_RENAME_FIXTURE_FAULT;
    if (fault) env.WORKSPACE_RENAME_FIXTURE_FAULT = fault;
    child = spawn(runtime === "electron" ? require("electron") : process.execPath, [entry],
      { env, cwd: root, stdio: runtime === "node" ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"] });
    event("launched");
    child.stdout.on("data", data => {
      stdoutBytes += data.length;
      if (stdoutBytes > 16384) { protocolError = true; return; }
      pending += data;
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          if (!stages.has(message.stage)) { protocolError = true; continue; }
          const code = Number.isInteger(message.code) ? message.code : codes.has(message.code) ? message.code : undefined;
          event(message.stage, code === undefined ? {} : { code });
          if (message.stage === "utility_started" && Number.isInteger(message.pid) && message.pid > 0) utilityPid = message.pid;
          if (message.stage === "utility_exit") utilityExited = true;
          if (message.stage === "ack_received" && runtime === "node") {
            event("exit_sent"); child.send({ exit: true }, error => { if (error) protocolError = true; });
          }
          if (message.stage === "result") {
            result = message;
            if (runtime === "node" && fault !== "missing-ack") {
              event("ack_sent"); child.send({ received: true }, error => { if (error) protocolError = true; });
            }
          }
        } catch { protocolError = true; }
      }
    });
    child.stderr.on("data", data => { stderrBytes += data.length; });
    // Install all process listeners before waiting or signaling. close confirms
    // the loader has exited and all its captured streams have closed.
    await new Promise(accept => {
      child.once("error", error => { event("spawn_error", { code: codes.has(error.code) ? error.code : "unknown" }); });
      child.once("close", (code, signal) => {
        closed = true; lifecycle.exit = code; lifecycle.signaled = signal !== null;
        event("loader_exit", { code }); clearTimeout(timer); accept();
      });
      timer = setTimeout(() => {
        lifecycle.timedOut = true; event("supervisor_timeout");
        // Stop only the owned utility, then its owned main. Never target shared processes.
        if (utilityPid && !utilityExited && alive(utilityPid)) {
          try { process.kill(utilityPid); } catch { /* Confirmation below decides cleanup. */ }
        }
        child.kill();
        timer = setTimeout(accept, 1000);
      }, 25000);
    });
    clearTimeout(timer);
    if (utilityPid && !utilityExited) {
      const limit = Date.now() + 1000;
      while (alive(utilityPid) && Date.now() < limit) await new Promise(accept => setTimeout(accept, 25));
      utilityExited = !alive(utilityPid);
    }
    lifecycle.shutdownConfirmed = closed && (runtime === "node" || utilityExited || !utilityPid && !lifecycle.events.some(e => e.stage === "main_ready"));
    lifecycle.protocolError = protocolError || pending.length !== 0;
    lifecycle.stderrBytes = stderrBytes;
    lifecycle.result = result;
    lifecycle.ok = lifecycle.shutdownConfirmed && !lifecycle.protocolError && !lifecycle.timedOut &&
      lifecycle.exit === 0 && result?.ok === true && lifecycle.events.some(e => e.stage === "ack_received");
    lifecycle.beforeCleanup = {
      loadedCopyPresent: await exists(join(root, "loading/fixed-location", runtime === "electron" ? "service/native/project-rename.node" : "service-test-native/project-rename.node")),
      userDataPresent: await exists(join(root, "user-data")),
    };
  } finally {
    clearTimeout(timer);
    if (!child || lifecycle.shutdownConfirmed) {
      event("cleanup_started");
      try {
        await rm(root, { recursive: true, force: true });
        lifecycle.cleanup = await exists(root) ? "failed" : "removed";
        event("cleanup_complete");
      } catch (error) {
        lifecycle.cleanup = "failed"; event("cleanup_failed", { code: codes.has(error.code) ? error.code : "unknown" });
      }
    } else {
      lifecycle.cleanup = "unverified_shutdown"; event("cleanup_withheld");
      child.stdout.destroy(); child.stderr.destroy();
      if (child.connected) child.disconnect(); child.unref();
    }
  }
  return lifecycle;
}

function assertCleanup(lifecycle) {
  const context = JSON.stringify(lifecycle);
  assert.equal(lifecycle.shutdownConfirmed, true, context);
  assert.equal(lifecycle.protocolError, false, context);
  assert.equal(lifecycle.cleanup, "removed", context);
  assert.equal(lifecycle.beforeCleanup.loadedCopyPresent, true, context);
  const stages = lifecycle.events.map(e => e.stage);
  assert.ok(stages.indexOf("loader_exit") < stages.indexOf("cleanup_started"), context);
  if (lifecycle.runtime === "electron") {
    assert.equal(lifecycle.beforeCleanup.userDataPresent, true, context);
    assert.ok(stages.indexOf("utility_exit") >= 0, context);
    assert.ok(stages.indexOf("utility_exit") < stages.indexOf("loader_exit"), context);
  }
}

function assertSuccess(lifecycle) {
  assertCleanup(lifecycle);
  assert.equal(lifecycle.ok, true, JSON.stringify(lifecycle));
  const stages = lifecycle.events.map(e => e.stage);
  for (const [before, after] of [["result", "ack_sent"], ["ack_sent", "ack_received"], ["ack_received", "exit_sent"], ["exit_sent", "loader_exit"]]) {
    assert.ok(stages.indexOf(before) >= 0 && stages.indexOf(before) < stages.indexOf(after), JSON.stringify(lifecycle));
  }
  assert.equal(lifecycle.result.runtime, lifecycle.runtime);
  assert.equal(lifecycle.result.scenarios.length, process.platform === "win32" ? 7 : 8);
  assert.deepEqual(lifecycle.result.loading, [
    { scenario: "missing", outcome: "native_unavailable" },
    { scenario: "corrupt", outcome: "native_unavailable" },
    { scenario: "fixed-location", outcome: "verified" },
  ]);
  if (lifecycle.runtime === "electron") assert.equal(lifecycle.result.versions.electron, "44.7.0");
}

async function checked(name, options, check) {
  return record(name, async () => {
    const lifecycle = await supervise(options);
    try { check(lifecycle); } catch (error) { error.lifecycle = lifecycle; throw error; }
    return lifecycle;
  });
}

test("native adapter fails closed on missing/corrupt binaries and uses only fixed emitted locations", { skip: !supported }, async () => {
  await checked("loading", {}, assertSuccess);
});

for (const packaged of [false, true]) {
  test(`actual Electron utilityProcess loads ${packaged ? "ASAR unpacked" : "development"} adapter and verifies disposable no-replace renames`, { skip: !supported, timeout: 30000 }, async () => {
    await checked(packaged ? "electron-asar" : "electron", { runtime: "electron", packaged }, assertSuccess);
  });
  test(`Electron ${packaged ? "ASAR" : "development"} injected failure acknowledges, exits and cleans only under supervisor`, { skip: !supported, timeout: 30000 }, async () => {
    await checked(packaged ? "failure-asar" : "failure-electron", { runtime: "electron", packaged, fault: "failure" }, lifecycle => {
      assertCleanup(lifecycle); assert.equal(lifecycle.ok, false);
      assert.equal(lifecycle.exit, 1); assert.equal(lifecycle.result.code, "ERR_ASSERTION");
      assert.ok(lifecycle.events.some(e => e.stage === "ack_received"));
    });
  });
}

test("Node injected failure acknowledges and exits before supervisor deletes the loaded copy", { skip: !supported }, async () => {
  await checked("failure-node", { fault: "failure" }, lifecycle => {
    assertCleanup(lifecycle); assert.equal(lifecycle.ok, false);
    assert.equal(lifecycle.exit, 1); assert.equal(lifecycle.result.code, "ERR_ASSERTION");
    assert.ok(lifecycle.events.some(e => e.stage === "ack_received"));
  });
});

for (const runtime of ["node", "electron"]) {
  for (const fault of ["abnormal-exit", "missing-ack"]) test(`${runtime} ${fault} fails with confirmed shutdown before cleanup`, { skip: !supported, timeout: 30000 }, async () => {
    await checked(`${runtime}-${fault}`, { runtime, fault, packaged: runtime === "electron" && fault === "abnormal-exit" }, lifecycle => {
      assertCleanup(lifecycle); assert.equal(lifecycle.ok, false);
      assert.equal(lifecycle.events.some(e => e.stage === "ack_received"), false);
      if (fault === "abnormal-exit") {
        assert.equal(lifecycle.result, undefined);
        assert.equal(lifecycle.exit, runtime === "node" ? 7 : 1);
        if (runtime === "electron") assert.ok(lifecycle.events.some(e => e.stage === "utility_exit" && e.code === 7));
      } else {
        assert.equal(lifecycle.result.ok, true);
        assert.equal(lifecycle.exit, runtime === "node" ? null : 1);
        if (runtime === "node") assert.equal(lifecycle.signaled, true);
        assert.ok(lifecycle.events.some(e => e.stage === (runtime === "node" ? "supervisor_timeout" : "utility_timeout")));
      }
    });
  });
}
