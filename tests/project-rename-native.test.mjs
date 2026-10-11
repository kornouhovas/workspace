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
const { createProtocol, MAX_BYTES, MAX_MESSAGES, MAX_EVENTS } = require("./fixtures/project-rename-native-protocol.cjs");
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
const codes = new Set(["EPERM", "EACCES", "ENOENT", "ERR_ASSERTION", "ERR_DLOPEN_FAILED", "unknown"]);
const exists = async path => Boolean(await lstat(path).catch(() => null));
const alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
};

function replay(chunks) {
  const messages = [], protocol = createProtocol(message => messages.push(message));
  for (const chunk of chunks) protocol.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  protocol.finish();
  return { messages, ...protocol.snapshot() };
}

test("supervisor parser preserves messages across LF/CRLF, whitespace and arbitrary byte chunks", () => {
  const messages = [{ stage: "main_ready" }, { stage: "result", ok: true, label: "🧪" }, { stage: "ack_received" }];
  const bytes = Buffer.from(`\n\r\n \t\r\n${messages.map(message => JSON.stringify(message)).join("\r\n")}\n \t\r`);
  // One chunk tests multiple records; byte chunks split JSON, UTF-8 and CRLF.
  for (const chunks of [[bytes], [...bytes].map(byte => Buffer.from([byte]))]) {
    const result = replay(chunks);
    assert.deepEqual(result.messages, messages);
    assert.equal(result.failed, false);
    assert.equal(result.pendingBytes, 0);
    assert.equal(result.bytes, bytes.length);
    assert.deepEqual(result.diagnostics, { ignoredWhitespaceRecords: 3, ignoredWhitespaceTailBytes: 3,
      malformedJsonRecords: 0, unknownStageRecords: 0, incompleteTrailingBytes: 0, outputLimits: 0 });
  }
});

test("supervisor parser keeps malformed and unknown nonblank records sticky while delivering subsequent lifecycle messages", () => {
  const messages = [], protocol = createProtocol(message => messages.push(message));
  protocol.write(Buffer.from('not-json\n{"stage":"unexpected"}\nnull\n'));
  assert.equal(protocol.snapshot().failed, true);
  protocol.write(Buffer.from('{"stage":"result","ok":true}\n\r\n{"stage":"ack_received"}\n'));
  protocol.finish();
  assert.deepEqual(messages, [{ stage: "result", ok: true }, { stage: "ack_received" }]);
  assert.equal(protocol.snapshot().failed, true);
  assert.deepEqual(protocol.snapshot().diagnostics, { ignoredWhitespaceRecords: 1, ignoredWhitespaceTailBytes: 0,
    malformedJsonRecords: 1, unknownStageRecords: 2, incompleteTrailingBytes: 0, outputLimits: 0 });
});

test("supervisor parser rejects incomplete or unterminated non-whitespace tails with byte-only diagnostics", () => {
  for (const tail of ['{"stage":', '{"stage":"result","ok":true}', " \t🧪"]) {
    const result = replay(['{"stage":"main_ready"}\n', tail]);
    assert.equal(result.failed, true);
    assert.deepEqual(result.messages, [{ stage: "main_ready" }]);
    assert.equal(result.diagnostics.incompleteTrailingBytes, Buffer.byteLength(tail));
    assert.equal(result.diagnostics.malformedJsonRecords, 0);
    assert.equal(result.pendingBytes, 0);
  }
});

test("supervisor parser counts ignored whitespace in the unchanged byte budget and bounds pending input", () => {
  for (const whitespace of ["\n", " "]) {
    const exact = replay([whitespace.repeat(MAX_BYTES)]);
    assert.equal(exact.failed, false);
    assert.equal(exact.diagnostics[whitespace === " " ? "ignoredWhitespaceTailBytes" : "ignoredWhitespaceRecords"], MAX_BYTES);
    const protocol = createProtocol(() => assert.fail("whitespace cannot produce a message"));
    protocol.write(Buffer.from(whitespace.repeat(MAX_BYTES)));
    assert.equal(protocol.snapshot().failed, false);
    assert.equal(protocol.snapshot().pendingBytes, whitespace === " " ? MAX_BYTES : 0);
    protocol.write(Buffer.from("\n"));
    for (let i = 0; i < 100; i++) protocol.write(Buffer.alloc(MAX_BYTES));
    protocol.finish();
    assert.equal(protocol.snapshot().failed, true);
    assert.equal(protocol.snapshot().bytes, MAX_BYTES + 1);
    assert.equal(protocol.snapshot().pendingBytes, 0);
    assert.equal(protocol.snapshot().diagnostics.outputLimits, 1);
  }
  const pending = createProtocol(() => assert.fail("unterminated input cannot produce a message"));
  pending.write(Buffer.alloc(MAX_BYTES, 120));
  assert.equal(pending.snapshot().pendingBytes, MAX_BYTES);
  pending.write(Buffer.from("x"));
  pending.finish();
  assert.equal(pending.snapshot().pendingBytes, 0);
  assert.equal(pending.snapshot().diagnostics.outputLimits, 1);
});

test("supervisor parser rejects oversized chunks and excessive valid-stage events without accumulating them", () => {
  assert.equal(replay(["\n".repeat(MAX_BYTES + 1)]).diagnostics.outputLimits, 1);
  const record = '{"stage":"ack_received"}\n';
  for (const chunks of [[record.repeat(MAX_MESSAGES + 10)], Array(MAX_MESSAGES + 10).fill(record)]) {
    const result = replay(chunks);
    assert.equal(result.failed, true);
    assert.equal(result.messages.length, MAX_MESSAGES);
    assert.equal(result.messageCount, MAX_MESSAGES);
    assert.equal(result.pendingBytes, 0);
    assert.equal(result.diagnostics.outputLimits, 1);
    assert.equal(result.diagnostics.unknownStageRecords, 0);
    assert.ok(result.bytes < MAX_BYTES);
  }
});

async function supervise({ runtime = "node", packaged = false, fault, framing } = {}) {
  const root = await mkdtemp(join(tmpdir(), "workspace-native-supervisor-"));
  const lifecycle = { runtime, packaged, fault: fault ?? "none", events: [], cleanup: "pending" };
  let child, utilityPid, utilityExited = false, closed = false, timer, result, protocolError = false;
  let stderrBytes = 0;
  const event = (stage, details = {}) => {
    if (lifecycle.events.length === MAX_EVENTS) { protocol.rejectLimit(); return; }
    lifecycle.events.push({ stage, ...details });
  };
  const protocol = createProtocol(message => {
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
  });
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
    delete env.WORKSPACE_RENAME_FIXTURE_FRAMING;
    if (fault) env.WORKSPACE_RENAME_FIXTURE_FAULT = fault;
    if (framing) env.WORKSPACE_RENAME_FIXTURE_FRAMING = framing;
    child = spawn(runtime === "electron" ? require("electron") : process.execPath, [entry],
      { env, cwd: root, stdio: runtime === "node" ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"] });
    event("launched");
    child.stdout.on("data", data => {
      try { protocol.write(data); } catch { protocolError = true; }
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
    if (runtime === "electron") lifecycle.utilityTerminationConfirmed = Boolean(utilityPid) && !alive(utilityPid);
    lifecycle.shutdownConfirmed = closed && (runtime === "node" || utilityExited || !utilityPid && !lifecycle.events.some(e => e.stage === "main_ready"));
    protocol.finish();
    lifecycle.protocol = protocol.snapshot();
    lifecycle.protocolError = protocolError || lifecycle.protocol.failed;
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

function assertCleanup(lifecycle, expectedProtocolError = false) {
  const context = JSON.stringify(lifecycle);
  assert.equal(lifecycle.shutdownConfirmed, true, context);
  assert.equal(lifecycle.protocolError, expectedProtocolError, context);
  assert.equal(lifecycle.cleanup, "removed", context);
  assert.equal(lifecycle.beforeCleanup.loadedCopyPresent, true, context);
  assert.ok(lifecycle.events.length <= MAX_EVENTS, context);
  assert.ok(lifecycle.protocol.messageCount <= MAX_MESSAGES, context);
  const stages = lifecycle.events.map(e => e.stage);
  assert.ok(stages.indexOf("loader_exit") < stages.indexOf("cleanup_started"), context);
  if (lifecycle.runtime === "electron") {
    assert.equal(lifecycle.utilityTerminationConfirmed, true, context);
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
  test(`Electron ${packaged ? "ASAR" : "development"} CRLF framing preserves acknowledged lifecycle`, { skip: !supported, timeout: 30000 }, async () => {
    await checked(packaged ? "crlf-asar" : "crlf-electron", { runtime: "electron", packaged, framing: "crlf" }, lifecycle => {
      assertSuccess(lifecycle);
      assert.ok(lifecycle.protocol.diagnostics.ignoredWhitespaceRecords >= 1);
    });
  });
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

for (const framing of ["malformed", "unknown", "incomplete"]) {
  test(`Electron ${framing} stdout cannot pass despite acknowledged success and clean shutdown`, { skip: !supported, timeout: 30000 }, async () => {
    await checked(`protocol-${framing}`, { runtime: "electron", framing }, lifecycle => {
      assertCleanup(lifecycle, true);
      assert.equal(lifecycle.exit, 0);
      assert.equal(lifecycle.result.ok, true);
      assert.ok(lifecycle.events.some(event => event.stage === "ack_received"));
      assert.equal(lifecycle.ok, false);
      const category = { malformed: "malformedJsonRecords", unknown: "unknownStageRecords", incomplete: "incompleteTrailingBytes" }[framing];
      assert.equal(lifecycle.protocol.diagnostics[category], framing === "incomplete" ? 9 : 1);
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

for (const [runtime, packaged] of [["node", false], ["electron", false], ["electron", true]]) {
  for (const fault of ["abnormal-exit", "missing-ack"]) test(`${runtime}${packaged ? " ASAR" : ""} ${fault} fails with confirmed shutdown before cleanup`, { skip: !supported, timeout: 30000 }, async () => {
    await checked(`${runtime}${packaged ? "-asar" : ""}-${fault}`, { runtime, fault, packaged }, lifecycle => {
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
