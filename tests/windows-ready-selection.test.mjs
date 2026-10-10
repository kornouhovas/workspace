import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { invokeReadySelection, parseReadySelectionResponse, runReadySelectionCli,
  runReadySelectionExperiment } from "../scripts/windows-ready-selection.mjs";

const target = String.raw`C:\Owned fixture\Native selection 日本語`;
const privateValue = "private target 日本語 and exception";
const systemExplorer = String.raw`C:\Windows\explorer.exe`;
const sha = "4ac402620dd8139bdef9ff03625aae64bf60e132";
const success = { version: 1, stage: "selected", deadlineMs: 10000, navigationCount: 1,
  navigationCompleted: true, selectionCount: 1, selectionCompleted: true, readinessAttempts: 2,
  confirmationAttempts: 1, readyMs: 20.5, selectionMs: 21, elapsedMs: 25.5, selected: true, code: null };
const absent = { ...success, stage: "parent_absent", selectionCount: 0, selectionCompleted: false,
  confirmationAttempts: 0, readyMs: null, selectionMs: null, selected: null };
function controlledClock() {
  const timers = new Map();
  return { setTimeout: (fn, ms) => { const token = {}; timers.set(token, { fn, ms }); return token; },
    clearTimeout: (token) => timers.delete(token),
    fire: (ms) => { for (const [token, timer] of [...timers]) if (timer.ms === ms) { timers.delete(token); timer.fn(); } },
    get pending() { return timers.size; } };
}

function bridgeFixture({ value = success, action, killCloses = true } = {}) {
  const clock = controlledClock(); let calls = 0, kills = 0;
  const child = new EventEmitter(); child.stdout = new EventEmitter();
  child.stdout.destroy = () => { child.destroyed = true; };
  child.unref = () => { child.released = true; };
  child.kill = (signal) => {
    assert.equal(signal, "SIGKILL"); kills++;
    if (action === "kill_throws") throw new Error(privateValue);
    if (killCloses) queueMicrotask(() => child.emit("close", null, signal));
  };
  const options = { platform: "win32", systemExplorer, clock, env: { PATH: privateValue, WORKSPACE_READY_SELECTION_TARGET: privateValue },
    spawnProcess: (program, args, settings) => {
      calls++;
      assert.equal(program, String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
      assert.deepEqual(args.slice(0, 4), ["-STA", "-NoProfile", "-NonInteractive", "-File"]);
      assert.equal(args.length, 5); assert.ok(args[4].endsWith("windows-ready-selection.ps1"));
      assert.equal(args.join(" ").includes(target), false);
      assert.deepEqual(settings.stdio, ["ignore", "pipe", "ignore"]); assert.equal(settings.shell, false);
      assert.equal(settings.env.WORKSPACE_READY_SELECTION_TARGET, target);
      if (action === "throw") throw new Error(privateValue);
      queueMicrotask(() => {
        if (["live", "kill_throws"].includes(action)) return;
        if (action === "error") child.emit("error", new Error(privateValue));
        if (action === "output_error") { child.stdout.emit("error", new Error(privateValue)); return; }
        const output = typeof value === "string" ? value : JSON.stringify({ ...value, path: privateValue, hwnd: 123 });
        child.stdout.emit("data", output.slice(0, 10)); child.stdout.emit("data", output.slice(10));
        child.emit("close", action === "nonzero" ? 7 : 0, action === "signal" ? "SIGTERM" : null);
      });
      return child;
    } };
  return { options, clock, child, run: () => invokeReadySelection(target, options),
    get calls() { return calls; }, get kills() { return kills; } };
}

test("ready protocol retains only finite scalar evidence and legitimate negative phases", () => {
  assert.deepEqual(parseReadySelectionResponse(JSON.stringify({ ...success, path: privateValue })), success);
  for (const stage of ["parent_absent", "ambiguous_parent", "target_absent", "wrong_window", "ambiguous_tabs",
    "property_unavailable", "view_changed", "unready", "iteration_limit", "deadline"]) {
    const value = { ...absent, stage };
    assert.deepEqual(parseReadySelectionResponse(JSON.stringify(value)), value);
  }
  for (const value of [
    { ...absent, stage: "input", navigationCount: 0, navigationCompleted: false, readinessAttempts: 0 },
    { ...absent, stage: "setup_error", navigationCount: 0, navigationCompleted: false, readinessAttempts: 0, code: -1 },
    { ...absent, stage: "navigation_error", navigationCompleted: false, readinessAttempts: 0, code: -1 },
    { ...success, stage: "selection_error", selectionCompleted: false, confirmationAttempts: 0, selected: null, code: -1 },
    { ...success, stage: "deadline", selected: false, elapsedMs: 10000 },
    { ...success, stage: "read_error", selected: null, code: -2147467259 },
    { ...absent, stage: "deadline", readyMs: 9999, elapsedMs: 10000 },
  ]) assert.deepEqual(parseReadySelectionResponse(JSON.stringify(value)), value);
});

test("ready protocol rejects malformed values, contradictory command counts, late success and unsafe output", () => {
  const invalid = [null, [], {}, { ...success, version: 2 }, { ...success, stage: privateValue },
    { ...success, deadlineMs: 20000 }, { ...success, navigationCount: 2 }, { ...success, selectionCount: 2 },
    { ...success, navigationCompleted: 1 }, { ...success, selectionCompleted: false },
    { ...success, navigationCount: 0 }, { ...success, selectionCount: 0 },
    { ...success, readinessAttempts: 0 }, { ...success, readinessAttempts: 129 },
    { ...success, confirmationAttempts: 0 }, { ...success, confirmationAttempts: 0.5 },
    { ...success, readyMs: null }, { ...success, readyMs: 22 }, { ...success, selectionMs: null },
    { ...success, selectionMs: 10000, elapsedMs: 10001 }, { ...success, readyMs: -1 },
    { ...success, elapsedMs: 10000 }, { ...success, elapsedMs: "25.5" }, { ...success, elapsedMs: 60001 },
    { ...success, selected: false }, { ...success, code: 0 }, { ...absent, selected: true },
    { ...absent, readyMs: 10000, elapsedMs: 10000 }, { ...absent, confirmationAttempts: 1 },
    { ...absent, stage: "setup_error", code: -1 }, { ...absent, stage: "read_error", code: null },
    { ...success, stage: "selection_error", selected: null, code: -1 },
    { ...absent, stage: "navigation_error", code: -1 },
    { ...absent, stage: "read_error", code: 2147483648 },
  ];
  for (const value of invalid) assert.equal(parseReadySelectionResponse(JSON.stringify(value)), null, JSON.stringify(value));
  for (const value of [privateValue, "x".repeat(8193), 1, undefined]) assert.equal(parseReadySelectionResponse(value), null);
});

test("one fixed trusted STA bridge carries owned target only as environment data", async () => {
  const f = bridgeFixture(), result = await f.run();
  assert.equal(result.status, "completed"); assert.equal(result.process.termination, "confirmed");
  assert.deepEqual(result.native, success); assert.equal(f.calls, 1); assert.equal(f.kills, 0);
  assert.equal(f.clock.pending, 0); assert.equal(JSON.stringify(result).includes(privateValue), false);
});

test("bridge failure, output limits and process errors stay distinct from selected evidence", async () => {
  for (const [options, stage] of [[{ value: absent }, "parent_absent"], [{ value: privateValue }, "protocol_error"],
    [{ action: "nonzero" }, "process_error"], [{ action: "signal" }, "process_error"],
    [{ action: "throw" }, "launch_error"], [{ action: "error" }, "launch_error"],
    [{ action: "output_error" }, "output_error"], [{ value: "x".repeat(8193) }, "output_limit"]]) {
    const f = bridgeFixture(options), result = await f.run();
    assert.equal(result.stage, stage); assert.notEqual(result.status, "completed"); assert.equal(f.calls, 1);
    assert.equal(result.process.termination, options.action === "throw" ? "not_started" : "confirmed");
    assert.equal(JSON.stringify(result).includes(privateValue), false); assert.equal(f.clock.pending, 0);
  }
});

test("thirty-second bridge bound kills only owned PowerShell and requires close within one second", async () => {
  for (const killCloses of [true, false]) {
    const f = bridgeFixture({ action: "live", killCloses }), pending = f.run();
    f.clock.fire(30000);
    if (!killCloses) f.clock.fire(1000);
    const result = await pending;
    assert.equal(result.stage, "timeout"); assert.equal(f.kills, 1); assert.equal(f.calls, 1);
    assert.equal(result.process.termination, killCloses ? "confirmed" : "unknown"); assert.equal(f.clock.pending, 0);
    if (!killCloses) {
      assert.equal(f.child.released, true); assert.equal(f.child.destroyed, true);
      f.child.emit("close", 0); assert.equal(result.process.termination, "unknown");
    }
  }
});

test("unsupported host, untrusted executable and unsafe target cannot launch", async () => {
  for (const options of [{ platform: "darwin" }, { systemExplorer: "explorer.exe" },
    { systemExplorer: String.raw`C:\Other\explorer.exe` }]) {
    const f = bridgeFixture(); Object.assign(f.options, options);
    assert.equal((await f.run()).process.termination, "not_started"); assert.equal(f.calls, 0);
  }
  const f = bridgeFixture();
  for (const value of ["", "relative", "C:\\a\0b", "C:\\a\"b"]) {
    assert.equal((await invokeReadySelection(value, f.options)).stage, "input");
  }
  assert.equal(f.calls, 0);
});

function experimentFixture({ bridge = {}, selected = true, resolverError, fixtureError,
  cleanupError, removalError, persistenceError, observerError } = {}) {
  const f = bridgeFixture(bridge), removed = [], events = [];
  let persisted, now = 0;
  const options = { ...f.options, readCodeRevision: async () => ({ stdout: sha }),
    runResolver: async () => { if (resolverError) throw new Error(privateValue); return { stdout: "C:\\Windows\n", stderr: "" }; },
    filesystem: {
      mkdtemp: async (prefix) => { assert.ok(prefix.endsWith("workspace-native-selection-")); return String.raw`C:\Owned fixture`; },
      mkdir: async (path) => { if (path === target && fixtureError) throw { code: "EPERM" }; },
      rmdir: async (path) => { removed.push(path); if (removalError) throw { code: "ENOTEMPTY" }; },
      writeFile: async (_path, contents) => { if (persistenceError) throw new Error(privateValue); persisted = JSON.parse(contents); },
    },
    runCommand: async (_program, args) => {
      assert.equal(f.child.closedForFixture, true, "observation/cleanup must follow child close");
      if (args.at(-1).includes("$result.closed")) {
        events.push("cleanup");
        assert.match(args.at(-1), /ParseName/);
        assert.match(args.at(-1), /Read-WorkspaceUiaWindow/);
        return { stdout: JSON.stringify({ matched: 1, closed: cleanupError ? 0 : 1, errorCount: cleanupError ? 1 : 0 }) };
      }
      events.push("observe"); if (observerError) throw new Error(privateValue);
      return { stdout: JSON.stringify({ exactParentFound: true, targetPresent: true, selectedTargetMatch: selected,
        exactParentCount: 1, errorCount: 0, errors: [] }) };
    }, timing: { now: () => now, sleep: async (ms) => { now += ms; } } };
  f.child.on("close", () => { f.child.closedForFixture = true; });
  return { ...f, options, events, removed, run: async () => {
    let result;
    try { result = await runReadySelectionExperiment(options); }
    catch (error) { assert.equal(error.message, "Windows ready selection experiment failed"); result = error.evidence; }
    if (!persistenceError) assert.deepEqual(result, persisted);
    assert.equal(JSON.stringify(result).includes(privateValue), false);
    assert.equal(JSON.stringify(result).includes("C:\\"), false);
    assert.equal(f.clock.pending, 0); return result;
  } };
}

test("candidate success requires timely command, later exact corroboration and owned cleanup", async () => {
  const f = experimentFixture(), result = await f.run();
  assert.equal(result.status, "passed"); assert.equal(result.command.native.stage, "selected");
  assert.equal(result.observation.exactTargetObserved, true); assert.equal(result.observation.rescuesCommand, false);
  assert.equal(result.observation.phase, "later_independent_corroboration");
  assert.deepEqual(f.events, ["observe", "cleanup"]); assert.equal(f.removed.length, 2);
});

test("late independent selection cannot rescue failed command or process exit", async () => {
  for (const bridge of [{ value: { ...success, stage: "deadline", selected: false, elapsedMs: 10000 } },
    { value: absent }, { action: "nonzero" }, { value: privateValue }]) {
    const f = experimentFixture({ bridge }), result = await f.run();
    assert.equal(result.status, "failed"); assert.equal(result.failure.stage, "command");
    assert.equal(result.observation.status, "passed"); assert.equal(result.observation.rescuesCommand, false);
    assert.equal(f.removed.length, 2);
  }
});

test("unknown bridge termination prevents observation, window cleanup and fixture deletion", async () => {
  const f = experimentFixture({ bridge: { action: "live", killCloses: false } }), pending = f.run();
  for (let i = 0; i < 30; i++) await Promise.resolve();
  f.clock.fire(30000); f.clock.fire(1000);
  const result = await pending;
  assert.equal(result.command.process.termination, "unknown"); assert.deepEqual(f.events, []); assert.deepEqual(f.removed, []);
  assert.equal(result.observation.status, "not_attempted"); assert.equal(result.windowCleanup.status, "not_attempted");
  assert.deepEqual(result.fixtureRemoval, { status: "unverified", code: "process_termination_unknown" });
});

test("resolver, fixture, corroboration and cleanup failures persist without hiding primary outcomes", async () => {
  for (const [options, stage] of [[{ resolverError: true }, "resolver"], [{ fixtureError: true }, "fixture"],
    [{ selected: false }, "observation"], [{ observerError: true }, "observation"],
    [{ cleanupError: true }, "window_cleanup"], [{ removalError: true }, "fixture_removal"],
    [{ persistenceError: true }, "evidence"], [{ bridge: { action: "throw" } }, "command"]]) {
    const f = experimentFixture(options), result = await f.run();
    assert.equal(result.status, "failed"); assert.equal(result.failure.stage, stage);
    if (options.resolverError) assert.equal(f.removed.length, 0);
    if (options.fixtureError) assert.equal(f.removed.length, 1);
    if (options.observerError) assert.deepEqual(f.events, ["observe", "cleanup"]);
    if (options.bridge) { assert.deepEqual(f.events, []); assert.equal(f.removed.length, 2); }
  }
});

test("CLI accepts no arguments and prints fixed private messages", async () => {
  let calls = 0, out = "", err = "";
  const options = { stdout: { write: (s) => { out += s; } }, stderr: { write: (s) => { err += s; } },
    experiment: async () => { calls++; throw new Error(privateValue); } };
  assert.equal(await runReadySelectionCli({ ...options, args: [target] }), 1); assert.equal(calls, 0);
  assert.equal(await runReadySelectionCli({ ...options, args: [] }), 1); assert.equal(calls, 1);
  assert.equal(await runReadySelectionCli({ ...options, args: [], experiment: async () => {} }), 0);
  assert.equal(out, "Windows ready selection experiment passed.\n"); assert.equal(err.includes(privateValue), false);
});
