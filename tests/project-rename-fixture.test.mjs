import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile, writeFile, mkdir, rename, readdir, cp } from "node:fs/promises";
import { SCENARIOS } from "./fixtures/project-rename-service-electron.cjs";
import { superviseRenameService, inputDigest } from "../scripts/smoke-project-rename.mjs";

const require = createRequire(import.meta.url);
const { publishCommand, readCommand, startControlReceiver, MAX_COMMAND_BYTES } = require("./fixtures/project-rename-service-control.cjs");

const controlEvidence = name => process.env.WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR
  ? join(process.env.WORKSPACE_RENAME_SERVICE_EVIDENCE_DIR, name) : undefined;

const supported = ["darwin", "win32"].includes(process.platform);
const handshake = ["result", "ack_sent", "ack_received", "exit_sent", "main_exit"];
const privateValues = ["Original", "Category", "sentinel", "nativeIdentity", "birthtimeNs", "workspace.sqlite", "stack", "private injected",
  "workspace-rename-service-", "ack.control", "exit.control", "WORKSPACE_RENAME_SERVICE_ROOT", "EISDIR", "EEXIST", "Error:", "ack\\n", "exit\\n",
  "Invalid fixture command", "Duplicate fixture command", "Fixture control deadline", "Fixture publication deadline"];
function assertPrivate(result) {
  const encoded = JSON.stringify(result);
  for (const secret of privateValues) assert.equal(encoded.includes(secret), false, secret);
}
async function checkpoint(fault) {
  const temporary = !controlEvidence(fault ?? "success");
  const directory = controlEvidence(fault ?? "success") ?? await mkdtemp(join(tmpdir(), "rename-evidence-test-"));
  try {
    const result = await superviseRenameService({ fault, evidenceDirectory: directory });
    const stored = JSON.parse(await readFile(join(directory, "service-checkpoint.json"), "utf8"));
    assert.deepEqual(stored, result); // Every control must persist the final cleanup outcome.
    assertPrivate(stored);
    return result;
  } finally { if (temporary) await rm(directory, { recursive: true, force: true }); }
}
function assertStages(result, expected) {
  assert.deepEqual(result.events.filter(stage => handshake.includes(stage)), expected);
}
function assertOrderedOnce(result, stages) {
  let previous = -1;
  for (const stage of stages) {
    assert.equal(result.events.filter(value => value === stage).length, 1, stage);
    const index = result.events.indexOf(stage);
    assert.ok(index > previous, stage); previous = index;
  }
}
function assertProtocol(result, malformed = false) {
  assert.equal(result.protocolError, malformed);
  assert.equal(result.protocol.failed, malformed);
  assert.equal(result.protocol.pendingBytes, 0);
  const { ignoredWhitespaceRecords, ignoredWhitespaceTailBytes } = result.protocol.diagnostics;
  // Valid blank output remains acceptable on either platform; it is not the
  // historical Windows acknowledgment failure or a malformed record.
  for (const count of [ignoredWhitespaceRecords, ignoredWhitespaceTailBytes]) assert.ok(Number.isSafeInteger(count) && count >= 0);
  assert.deepEqual(result.protocol.diagnostics, { ignoredWhitespaceRecords, ignoredWhitespaceTailBytes,
    malformedJsonRecords: malformed ? 1 : 0, unknownStageRecords: 0, incompleteTrailingBytes: 0, outputLimits: 0 });
}
function assertScenarios(result, status = () => "passed") {
  assert.deepEqual(result.scenarios, Object.fromEntries(SCENARIOS.map(key => [key, { status: status(key) }])));
}
function assertMountedCase(result) {
  assert.deepEqual(Object.keys(result.mountedCase), ["direct", "grouped"]);
  for (const behavior of Object.values(result.mountedCase)) assert.ok(["self_alias_staged", "distinct_direct"].includes(behavior));
}
function assertUtilities(result, count = 5) {
  assert.equal(result.utilityCount, count);
  assert.equal(result.utilityExitCount, count);
  assert.equal(result.utilityExitFailure, false);
  assert.equal(result.events.filter(stage => stage === "utility_started").length, count);
  assert.equal(result.events.filter(stage => stage === "utility_exit").length, count);
}
function assertCleanup(result, failed = false) {
  assert.equal(result.shutdownConfirmed, true, JSON.stringify(result));
  assert.equal(result.cleanup, failed ? "failed" : "removed");
  assertOrderedOnce(result, ["launched", "main_ready", "main_exit", "cleanup_started", failed ? "cleanup_failed" : "cleanup_complete"]);
  assert.equal(result.events.includes("supervisor_failed"), false);
  assert.equal(result.events.includes("spawn_error"), false);
  assert.equal(result.evidenceWriteFailed ?? false, false);
}
function assertNormalHandshake(result, { exitCode = 0, malformed = false, cleanupFailed = false } = {}) {
  assertStages(result, handshake);
  assertOrderedOnce(result, handshake);
  assertCleanup(result, cleanupFailed);
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.signaled, false);
  assert.equal(result.timedOut ?? false, false);
  assert.equal(result.events.includes("supervisor_timeout"), false);
  assert.equal(result.controlError ?? false, false);
  assert.equal(result.events.includes("control_publish_failed"), false);
  assert.equal(result.events.includes("startup_failed"), false);
  assertProtocol(result, malformed);
}

test("real Electron service checkpoint requires every scenario, handshake, shutdown and cleanup", { skip: !supported }, async () => {
  const result = await checkpoint();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(SCENARIOS.length, 16);
  assertNormalHandshake(result);
  assertScenarios(result);
  assertUtilities(result);
  assertMountedCase(result);
});
for (const fault of ["failure", "malformed", "missing-assertion", "skipped", "cleanup"]) {
  test(`service ${fault} control proves its intended failure with a complete normal handshake`, { skip: !supported }, async () => {
    const result = await checkpoint(fault);
    assert.equal(result.ok, false, JSON.stringify(result));
    assertNormalHandshake(result, { exitCode: fault === "failure" ? 1 : 0, malformed: fault === "malformed", cleanupFailed: fault === "cleanup" });
    assertScenarios(result, key => fault === "failure" ? (key === "direct.rename" ? "failed" : "unreached")
      : key === "direct.rename" && fault === "missing-assertion" ? "unreached"
      : key === "direct.rename" && fault === "skipped" ? "skipped" : "passed");
    assertUtilities(result, fault === "failure" ? 1 : 5);
    if (fault === "failure") assert.deepEqual(result.mountedCase, {});
    else assertMountedCase(result);
  });
}
for (const fault of ["timeout", "missing-ack"]) {
  test(`service ${fault} control proves a genuine timeout at its own checkpoint`, { skip: !supported }, async () => {
    const result = await checkpoint(fault);
    assert.equal(result.ok, false, JSON.stringify(result));
    assertCleanup(result);
    assertProtocol(result);
    assert.equal(result.controlError ?? false, false);
    assert.equal(result.timedOut, true);
    assertStages(result, fault === "timeout" ? ["main_exit"] : ["result", "main_exit"]);
    assertOrderedOnce(result, [fault === "timeout" ? "worker_started" : "result", "supervisor_timeout", "main_exit"]);
    assertScenarios(result, () => fault === "timeout" ? "unreached" : "passed");
    if (fault === "timeout") {
      assert.deepEqual(result.mountedCase, {});
      assert.equal(result.utilityCount, 1);
      assert.equal(result.events.filter(stage => stage === "utility_started").length, 1);
      assert.ok(result.events.indexOf("utility_started") < result.events.indexOf("worker_started"));
      // Owned-worker termination codes/signals differ between platforms.
    } else { assertUtilities(result); assertMountedCase(result); }
  });
}
for (const fault of ["control-publication", "control-read", "premature-main-exit"]) {
  test(`service ${fault} control proves the specific control-seam failure`, { skip: !supported }, async () => {
    const result = await checkpoint(fault);
    assert.equal(result.ok, false, JSON.stringify(result));
    assertCleanup(result);
    assertProtocol(result);
    assert.equal(result.timedOut ?? false, false);
    assert.equal(result.events.includes("supervisor_timeout"), false);
    assertUtilities(result);
    if (fault === "premature-main-exit") {
      assertScenarios(result, () => "unreached");
      assert.deepEqual(result.mountedCase, {});
      assertStages(result, ["main_exit"]);
      assert.equal(result.exitCode, 7);
      assert.equal(result.signaled, false);
      assert.equal(result.controlError ?? false, false);
      assert.equal(result.events.includes("startup_failed"), false);
      assert.equal(result.events.includes("control_publish_failed"), false);
    } else {
      assertScenarios(result); assertMountedCase(result);
      assert.equal(result.controlError, true);
      assert.equal(result.controlFailure, fault === "control-read" ? "receive" : "publish");
      assertStages(result, fault === "control-read" ? ["result", "ack_sent", "main_exit"] : ["result", "main_exit"]);
      assertOrderedOnce(result, ["result", fault === "control-read" ? "startup_failed" : "control_publish_failed", "main_exit"]);
      assert.equal(result.events.includes(fault === "control-read" ? "control_publish_failed" : "startup_failed"), false);
      if (fault === "control-read") { assert.equal(result.exitCode, 1); assert.equal(result.signaled, false); }
    }
  });
}

test("evidence write failures cannot prevent confirmed shutdown and cleanup or overwrite an occupied file", { skip: !supported }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "rename-evidence-test-"));
  try {
    const file = join(directory, "occupied"); await writeFile(file, "Keep");
    const unavailable = await superviseRenameService({ fault: "failure", evidenceDirectory: file });
    assert.equal(unavailable.evidenceWriteFailed, true);
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.cleanup, "removed");
    assert.equal(unavailable.shutdownConfirmed, true);
    assertStages(unavailable, handshake);
    assert.equal(unavailable.exitCode, 1);
    assert.equal(unavailable.signaled, false);
    assert.equal(unavailable.timedOut ?? false, false);
    assert.equal(unavailable.controlError ?? false, false);
    assertProtocol(unavailable);
    assertPrivate(unavailable);
    assert.equal(await readFile(file, "utf8"), "Keep");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function withControlRoot(action) {
  const root = await mkdtemp(join(tmpdir(), "rename-control-test-"));
  try { await action(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function receive(root, milliseconds = 1000) {
  const events = [];
  let end, acknowledge;
  const ended = new Promise(resolve => { end = resolve; });
  const ack = new Promise(resolve => { acknowledge = resolve; });
  const receiver = startControlReceiver(root, {
    deadline: Date.now() + milliseconds,
    onAck: () => { events.push("ack"); acknowledge(); },
    onExit: () => { events.push("exit"); end(); },
    onError: () => { events.push("error"); end(); },
    onTimeout: () => { events.push("timeout"); end(); },
  });
  return { events, receiver, ended, ack };
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test("control ignores incomplete publication until atomic rename and consumes ack then exit once", async () => {
  await withControlRoot(async root => {
    const pending = join(root, "ack.control.pending");
    await writeFile(pending, "ac");
    assert.equal(await readCommand(root, "ack"), false);
    const control = receive(root);
    try {
      control.receiver.resultPublished();
      await pause(30);
      assert.deepEqual(control.events, []);
      await writeFile(pending, "ack\n");
      await rename(pending, join(root, "ack.control"));
      await control.ack;
      await publishCommand(root, "exit", Date.now() + 1000);
      await control.ended;
      assert.deepEqual(control.events, ["ack", "exit"]);
      assert.deepEqual(await readdir(root), []);
      await pause(30);
      assert.deepEqual(control.events, ["ack", "exit"]);
    } finally { control.receiver.dispose(); }
  });
});

test("control accepts only exact fixed records and bounded sizes", async () => {
  await withControlRoot(async root => {
    assert.equal(MAX_COMMAND_BYTES, 5);
    for (const command of ["ack", "exit"]) {
      await publishCommand(root, command, Date.now() + 1000);
      assert.equal(await readCommand(root, command), true);
      await assert.rejects(publishCommand(root, command, Date.now() + 1000));
      assert.equal(await readFile(join(root, `${command}.control`), "utf8"), `${command}\n`);
    }
    for (const invalid of ["", "ack", "ack\r\n", "ack\n ", "exit\n", "ack\0", "ack\n" + "x".repeat(10000)]) {
      await writeFile(join(root, "ack.control"), invalid);
      await assert.rejects(readCommand(root, "ack"));
    }
    for (const invalid of ["", "../ack", "ACK", "__proto__"]) {
      await assert.rejects(publishCommand(root, invalid, Date.now() + 1000));
      await assert.rejects(readCommand(root, invalid));
    }
  });
});

test("control rejects early, out-of-order, simultaneous and duplicate commands", async () => {
  for (const kind of ["early", "exit-first", "simultaneous", "duplicate", "invalid"]) {
    await withControlRoot(async root => {
      const control = receive(root);
      try {
        if (kind !== "early") control.receiver.resultPublished();
        if (kind === "exit-first") await publishCommand(root, "exit", Date.now() + 1000);
        else if (kind === "simultaneous") {
          // Both commands exist before polling starts: exit was never authorized.
          control.receiver.dispose();
          await publishCommand(root, "ack", Date.now() + 1000);
          await publishCommand(root, "exit", Date.now() + 1000);
          const simultaneous = receive(root);
          try {
            simultaneous.receiver.resultPublished(); await simultaneous.ended;
            assert.deepEqual(simultaneous.events, ["error"]);
          } finally { simultaneous.receiver.dispose(); }
          return;
        } else if (kind === "invalid") await writeFile(join(root, "ack.control"), "bad\n");
        else {
          await publishCommand(root, "ack", Date.now() + 1000);
          if (kind === "duplicate") { await control.ack; await publishCommand(root, "ack", Date.now() + 1000); }
        }
        await control.ended;
        assert.deepEqual(control.events, kind === "duplicate" ? ["ack", "error"] : ["error"], kind);
        await pause(20);
        assert.equal(control.events.filter(event => event === "error").length, 1);
      } finally { control.receiver.dispose(); }
    });
  }
});

test("control publication and read failures are caught and stop receiver polling", async () => {
  await withControlRoot(async root => {
    await assert.rejects(publishCommand(join(root, "missing"), "ack", Date.now() + 1000));
    await mkdir(join(root, "ack.control.pending"));
    await assert.rejects(publishCommand(root, "ack", Date.now() + 1000));
    assert.equal(await readCommand(root, "ack"), false);
    await rm(join(root, "ack.control.pending"), { recursive: true });
    await mkdir(join(root, "ack.control"));
    await assert.rejects(readCommand(root, "ack"));
    const control = receive(root);
    try {
      control.receiver.resultPublished(); await control.ended;
      assert.deepEqual(control.events, ["error"]);
      await pause(30); assert.deepEqual(control.events, ["error"]);
    } finally { control.receiver.dispose(); }
  });
});

test("control deadlines bound missing commands and disposal prevents callbacks or consumption", async t => {
  await withControlRoot(async root => {
    await assert.rejects(publishCommand(root, "ack", Date.now() - 1));
    assert.deepEqual(await readdir(root), []);
    let now = 0;
    const clock = t.mock.method(Date, "now", () => now++);
    try { await assert.rejects(publishCommand(root, "ack", 1)); }
    finally { clock.mock.restore(); }
    assert.deepEqual(await readdir(root), []); // Expiry during preparation leaves no command or temporary record.
    const expired = receive(root, 30);
    try {
      expired.receiver.resultPublished(); await expired.ended;
      await pause(30); assert.deepEqual(expired.events, ["timeout"]);
    } finally { expired.receiver.dispose(); }
    const disposed = receive(root, 30);
    disposed.receiver.resultPublished(); disposed.receiver.dispose();
    await publishCommand(root, "ack", Date.now() + 1000);
    await pause(60);
    assert.deepEqual(disposed.events, []);
    assert.equal(await readCommand(root, "ack"), true);
  });
});

test("input digest includes the executable control helper using disposable input copies", async () => {
  await withControlRoot(async root => {
    const repository = fileURLToPath(new URL("../", import.meta.url));
    // Copy the supervisor's finite input set; never edit running or live inputs.
    for (const relative of ["package-lock.json", "package.json", "src/service", "src/contracts", "native/project-rename/project_rename.c", "native/project-rename/binding.gyp",
      "src/desktop/backend-controller.ts", "dist/service", "dist/desktop/backend-controller.mjs",
      `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`,
      "scripts/smoke-project-rename.mjs", "tests/fixtures/project-rename-service-electron.cjs",
      "tests/fixtures/project-rename-native-protocol.cjs", "tests/fixtures/project-rename-service-control.cjs"]) {
      await cp(join(repository, relative), join(root, relative), { recursive: true });
    }
    const initial = await inputDigest(root);
    assert.equal(initial, await inputDigest());
    const helper = join(root, "tests/fixtures/project-rename-service-control.cjs"), bytes = await readFile(helper);
    await writeFile(helper, Buffer.concat([bytes, Buffer.from("\n// Disposable digest regression.\n")]));
    assert.notEqual(await inputDigest(root), initial);
    await writeFile(helper, bytes);
    assert.equal(await inputDigest(root), initial);
    await rm(helper);
    await assert.rejects(inputDigest(root));
  });
});

test("control publication deadline rejects a stalled callback and late completion cannot publish", async t => {
  await withControlRoot(async root => {
    const filesystem = require("node:fs/promises"), original = filesystem.lstat;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const pending = t.mock.method(filesystem, "lstat", async path => {
      if (path === join(root, "ack.control")) await blocked;
      return original(path);
    });
    try {
      await assert.rejects(publishCommand(root, "ack", Date.now() + 30), /deadline/);
      release();
      await pause(30);
      assert.deepEqual(await readdir(root), []);
    } finally { release(); pending.mock.restore(); }
  });
});

test("control removes its expired command when an already-started rename completes late", { timeout: 3000 }, async t => {
  await withControlRoot(async root => {
    const filesystem = require("node:fs/promises"), originalRename = filesystem.rename, originalRemove = filesystem.rm;
    const destination = join(root, "ack.control");
    let release, started, removed;
    const blocked = new Promise(resolve => { release = resolve; });
    const renaming = new Promise(resolve => { started = resolve; });
    const cleaned = new Promise(resolve => { removed = resolve; });
    const pendingRename = t.mock.method(filesystem, "rename", async (...args) => {
      started(); await blocked; return originalRename(...args);
    });
    const pendingRemove = t.mock.method(filesystem, "rm", async (...args) => {
      await originalRemove(...args);
      if (args[0] === destination) removed();
    });
    try {
      const publication = publishCommand(root, "ack", Date.now() + 100);
      await renaming;
      await assert.rejects(publication, /deadline/);
      release(); await cleaned;
      assert.deepEqual(await readdir(root), []);
    } finally { release(); pendingRename.mock.restore(); pendingRemove.mock.restore(); }
  });
});
