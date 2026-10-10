import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import { invokeNativeSelection, parseNativeSelectionResponse } from "../scripts/windows-native-selection.mjs";

const target = "C:\\Disposable\\Folder's 日本語 $value `quoted` & text";
const completed = {
  version: 1, stage: "completed", exception: false,
  initializeHresult: 0, parseHresult: 0, selectionHresult: 0,
  invocationCount: 1, pidlAllocated: true, pidlCleanup: "completed", comCleanup: "completed",
};
const encode = (value) => JSON.stringify(value);

function processFixture(action = (child) => {
  child.stdout.emit("data", Buffer.from(encode(completed)));
  child.emit("close", 0, null);
}) {
  let calls = 0;
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  let released = false;
  child.unref = () => { released = true; };
  child.stdout.destroy = () => { child.stdout.destroyed = true; };
  const kills = [];
  child.kill = (signal) => { kills.push(signal); return true; };
  return {
    child, kills, get calls() { return calls; }, get released() { return released; },
    spawnProcess: (program, args, options) => {
      calls++;
      assert.equal(program, "powershell.exe");
      assert.deepEqual(args.slice(0, 4), ["-NoProfile", "-NonInteractive", "-File", args[3]]);
      assert.ok(args[3].endsWith("windows-native-selection.ps1"));
      assert.equal(args.length, 4);
      assert.equal(args.join(" ").includes(target), false);
      assert.equal(options.env.WORKSPACE_NATIVE_SELECTION_TARGET, target);
      assert.equal(options.shell, false);
      assert.deepEqual(options.stdio, ["ignore", "pipe", "ignore"]);
      queueMicrotask(() => action(child));
      return child;
    },
  };
}

function controlledClock() {
  let now = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const token = {}; timers.set(token, { fn, at: now + ms }); return token; },
    clearTimeout: (token) => timers.delete(token),
    advance: (ms) => {
      now += ms;
      for (const [token, timer] of [...timers]) {
        if (timer.at <= now) { timers.delete(token); timer.fn(); }
      }
    },
    get pending() { return timers.size; },
  };
}

test("native protocol retains only finite fields and signed 32-bit HRESULTs", () => {
  for (const code of [-2147483648, -2147467259, 0, 2147483647]) {
    const payload = { ...completed, stage: code === 0 ? "completed" : "select", selectionHresult: code };
    assert.equal(parseNativeSelectionResponse(encode(payload)).selectionHresult, code);
  }
  const clean = parseNativeSelectionResponse(encode({ ...completed, path: target, message: "private exception", stdout: "secret" }));
  assert.deepEqual(clean, completed);
});

test("malformed, oversized and contradictory native telemetry never establishes an invocation", () => {
  const invalid = ["", "private output", "null", "[]", "true", encode({}), encode({ ...completed, version: 2 }),
    encode({ ...completed, stage: "C:\\private" }), encode({ ...completed, invocationCount: 2 }),
    encode({ ...completed, invocationCount: 0 }), encode({ ...completed, initializeHresult: -2147417850 }),
    encode({ ...completed, parseHresult: -1 }), encode({ ...completed, pidlAllocated: false }),
    encode({ ...completed, pidlCleanup: "not_needed" }), encode({ ...completed, comCleanup: "not_needed" }),
    encode({ ...completed, exception: true }), " ".repeat(8193)];
  for (const field of ["initializeHresult", "parseHresult", "selectionHresult"]) {
    for (const code of [null, "0", 0.5, 2147483648, -2147483649, true]) invalid.push(encode({ ...completed, [field]: code }));
  }
  for (const stdout of invalid) assert.equal(parseNativeSelectionResponse(stdout), null, stdout.slice(0, 100));
});

test("prerequisite failures and exceptions preserve zero/one attempts and cleanup outcomes", () => {
  const initial = { ...completed, stage: "initialize", initializeHresult: -2147417850, parseHresult: null,
    selectionHresult: null, invocationCount: 0, pidlAllocated: false, pidlCleanup: "not_needed", comCleanup: "not_needed" };
  const parseFailure = { ...initial, stage: "parse", initializeHresult: 1, parseHresult: -2147467259, comCleanup: "completed" };
  const selectException = { ...completed, stage: "select", exception: true, selectionHresult: null };
  for (const value of [initial, parseFailure, selectException, { ...completed, pidlCleanup: "failed" }, { ...completed, comCleanup: "failed" }]) {
    assert.deepEqual(parseNativeSelectionResponse(encode(value)), value);
  }
});

test("bridge dispatch uses a fixed file and environment-only Unicode target, once", async () => {
  const fixture = processFixture();
  const result = await invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess,
    env: { WORKSPACE_NATIVE_SELECTION_TARGET: "untrusted inherited value" } });
  assert.equal(fixture.calls, 1);
  assert.equal(result.status, "completed");
  assert.equal(result.invocationCount, 1);
  assert.deepEqual(result.native, completed);
  assert.equal(result.process.termination, "confirmed");
  assert.equal(JSON.stringify(result).includes(target), false);
});

test("negative native results and cleanup failures remain failures with their own counts", async () => {
  const initial = { ...completed, stage: "initialize", initializeHresult: -2147417850, parseHresult: null,
    selectionHresult: null, invocationCount: 0, pidlAllocated: false, pidlCleanup: "not_needed", comCleanup: "not_needed" };
  for (const payload of [initial, { ...initial, stage: "parse", initializeHresult: 1, parseHresult: -1, comCleanup: "completed" },
    { ...completed, stage: "select", selectionHresult: -2147467259 }, { ...completed, pidlCleanup: "failed" },
    { ...completed, comCleanup: "failed" }]) {
    const fixture = processFixture((child) => {
      child.stdout.emit("data", encode(payload));
      child.emit("close", 0, null);
    });
    const result = await invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess });
    assert.equal(result.status, "failed");
    assert.equal(result.invocationCount, payload.invocationCount);
    assert.deepEqual(result.native, payload);
    assert.equal(fixture.calls, 1);
  }
});

test("missing protocol, command failures and extra output cannot leak private data or retry", async () => {
  for (const action of [
    (child) => { child.stdout.emit("data", "private output " + target); child.emit("close", 0, null); },
    (child) => { child.emit("error", Object.assign(new Error(target), { code: target })); child.emit("close", -1, null); },
    (child) => { child.stdout.emit("data", encode(completed)); child.emit("close", 7, null); },
    (child) => { child.stdout.emit("data", encode(completed)); child.stdout.emit("data", "\nprivate"); child.emit("close", 0, null); },
  ]) {
    const fixture = processFixture(action);
    const result = await invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess });
    assert.notEqual(result.status, "completed");
    assert.equal(fixture.calls, 1);
    assert.equal(result.process.termination, "confirmed");
    if (result.stage === "protocol_error") assert.equal(result.invocationCount, null);
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.equal(JSON.stringify(result).includes(target), false);
  }
});

test("30-second deadline covers compilation; timeout invalidates even a complete protocol", async () => {
  const clock = controlledClock();
  const fixture = processFixture((child) => child.stdout.emit("data", encode(completed)));
  const pending = invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess, clock });
  await Promise.resolve();
  clock.advance(29999);
  assert.deepEqual(fixture.kills, []);
  clock.advance(1);
  assert.deepEqual(fixture.kills, ["SIGKILL"]);
  fixture.child.emit("close", null, "SIGKILL");
  const result = await pending;
  assert.equal(result.stage, "timeout");
  assert.equal(result.invocationCount, null);
  assert.equal(result.native, null);
  assert.equal(result.process.termination, "confirmed");
  assert.equal(clock.pending, 0);
  assert.equal(fixture.calls, 1);
});

test("unconfirmed kill is bounded and does not claim process termination", async () => {
  const clock = controlledClock();
  const fixture = processFixture(() => {});
  fixture.child.kill = () => { throw new Error(target); };
  const pending = invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess, clock });
  clock.advance(30000);
  clock.advance(1000);
  const result = await pending;
  assert.equal(result.stage, "timeout");
  assert.equal(result.process.termination, "unknown");
  assert.equal(result.process.killAttempted, true);
  assert.equal(result.invocationCount, null);
  assert.equal(JSON.stringify(result).includes(target), false);
  assert.equal(clock.pending, 0);
  assert.equal(fixture.released, true);
  assert.equal(fixture.child.stdout.destroyed, true);
});

test("oversized output terminates the owned process and remains unknown", async () => {
  const fixture = processFixture((child) => {
    child.stdout.emit("data", Buffer.alloc(8193, 65));
    child.emit("close", null, "SIGKILL");
  });
  const result = await invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess });
  assert.equal(result.stage, "output_limit");
  assert.equal(result.invocationCount, null);
  assert.deepEqual(fixture.kills, ["SIGKILL"]);
});

test("output stream failure terminates once without exporting exception text", async () => {
  const fixture = processFixture((child) => {
    child.stdout.emit("error", new Error(target));
    child.emit("close", null, "SIGKILL");
  });
  const result = await invokeNativeSelection(target, { platform: "win32", spawnProcess: fixture.spawnProcess });
  assert.equal(result.stage, "output_error");
  assert.equal(result.invocationCount, null);
  assert.equal(result.process.termination, "confirmed");
  assert.equal(fixture.calls, 1);
  assert.deepEqual(fixture.kills, ["SIGKILL"]);
  assert.equal(JSON.stringify(result).includes(target), false);
});

test("unsupported host, invalid target and failed spawn never dispatch", async () => {
  let calls = 0;
  const spawnProcess = () => { calls++; throw Object.assign(new Error(target), { code: "ENOENT" }); };
  for (const [input, platform, stage] of [[target, "darwin", "unsupported"], ["", "win32", "input"],
    ["a\0b", "win32", "input"], [target, "win32", "launch_error"]]) {
    const result = await invokeNativeSelection(input, { platform, spawnProcess });
    assert.equal(result.stage, stage);
    assert.equal(result.process.termination, "not_started");
    assert.equal(result.invocationCount, 0);
    assert.equal(JSON.stringify(result).includes(target), false);
  }
  assert.equal(calls, 1);
});

// Compile the production C# on Windows, replacing every native function with
// controlled delegates. These tests never invoke COM or Shell selection APIs.
test("compiled STA bridge balances COM/PIDL lifetime and preserves single-call ordering", { skip: process.platform !== "win32" }, async () => {
  const script = await readFile(new URL("../scripts/windows-native-selection.ps1", import.meta.url), "utf8");
  const source = script.match(/\$bridgeSource = @'\r?\n([\s\S]*?)\r?\n'@/)[1];
  const fixtureSource = String.raw`
public static class ControlledNativeSelection {
  public static object Run(string mode, string expected) {
    var events = new System.Collections.Generic.List<string>();
    int origin = System.Threading.Thread.CurrentThread.ManagedThreadId;
    System.Action<string> record = delegate(string step) {
      if (System.Threading.Thread.CurrentThread.ManagedThreadId == origin ||
          System.Threading.Thread.CurrentThread.GetApartmentState() != System.Threading.ApartmentState.STA)
        throw new System.Exception("wrong thread");
      events.Add(step);
    };
    var api = new WorkspaceNativeSelection.NativeCalls();
    api.Initialize = delegate(System.IntPtr reserved, uint flags) {
      record("initialize");
      if (reserved != System.IntPtr.Zero || flags != 2) throw new System.Exception("init arguments");
      if (mode == "initialize_exception") throw new System.Exception(expected);
      return mode == "changed_mode" ? -2147417850 : mode == "s_false" ? 1 : 0;
    };
    api.Parse = delegate(string path, System.IntPtr context, out System.IntPtr pidl, uint flags, out uint attributes) {
      record("parse");
      pidl = mode == "parse_failure" || mode == "null_pidl" ? System.IntPtr.Zero : new System.IntPtr(1234);
      attributes = 0;
      if (path != expected || context != System.IntPtr.Zero || flags != 0) throw new System.Exception("parse arguments");
      if (mode == "parse_exception") throw new System.Exception(expected);
      return mode == "parse_failure" || mode == "parse_failure_allocated" ? -2147467259 : 0;
    };
    api.Select = delegate(System.IntPtr pidl, uint count, System.IntPtr children, uint flags) {
      record("select");
      if (pidl != new System.IntPtr(1234) || count != 0 || children != System.IntPtr.Zero || flags != 0)
        throw new System.Exception("selection arguments");
      if (mode == "select_exception") throw new System.Exception(expected);
      return mode == "select_failure" ? -2147467259 : 0;
    };
    api.Free = delegate(System.IntPtr pidl) {
      record("free");
      if (pidl != new System.IntPtr(1234)) throw new System.Exception("free argument");
      if (mode == "free_exception") throw new System.Exception(expected);
    };
    api.Uninitialize = delegate() {
      record("uninitialize");
      if (mode == "uninitialize_exception") throw new System.Exception(expected);
    };
    var result = WorkspaceNativeSelection.Bridge.Run(expected, api);
    return new { result = result, events = events.ToArray() };
  }
}
`;
  const execute = promisify(execFile);
  const modes = ["s_ok", "s_false", "changed_mode", "parse_failure", "parse_failure_allocated", "null_pidl", "select_failure",
    "initialize_exception", "parse_exception", "select_exception", "free_exception", "uninitialize_exception"];
  const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition ($env:WORKSPACE_CONTROLLED_BRIDGE + [Environment]::NewLine + $env:WORKSPACE_CONTROLLED_FIXTURE)
$results = foreach ($mode in $env:WORKSPACE_CONTROLLED_MODES.Split(',')) {
  [ControlledNativeSelection]::Run($mode, $env:WORKSPACE_NATIVE_SELECTION_TARGET)
}
ConvertTo-Json -InputObject @($results) -Depth 5 -Compress
`], { timeout: 30000, windowsHide: true, env: { ...process.env,
    WORKSPACE_CONTROLLED_BRIDGE: source, WORKSPACE_CONTROLLED_FIXTURE: fixtureSource,
    WORKSPACE_CONTROLLED_MODES: modes.join(","), WORKSPACE_NATIVE_SELECTION_TARGET: target } });
  const results = JSON.parse(stdout);
  assert.equal(results.length, modes.length);
  for (const [index, mode] of modes.entries()) {
    const { result, events } = results[index];
    assert.deepEqual(parseNativeSelectionResponse(encode(result)), result, mode);
    const stopsAtInit = ["changed_mode", "initialize_exception"].includes(mode);
    const stopsAtParse = ["parse_failure", "parse_failure_allocated", "parse_exception", "null_pidl"].includes(mode);
    const hasPidl = !stopsAtInit && !["parse_failure", "null_pidl"].includes(mode);
    assert.deepEqual(events, ["initialize", ...(!stopsAtInit ? ["parse"] : []),
      ...(!stopsAtInit && !stopsAtParse ? ["select"] : []), ...(hasPidl ? ["free"] : []),
      ...(!stopsAtInit ? ["uninitialize"] : [])], mode);
    assert.equal(result.invocationCount, stopsAtInit || stopsAtParse ? 0 : 1, mode);
    assert.equal(result.initializeHresult, mode === "initialize_exception" ? null : mode === "changed_mode" ? -2147417850 : mode === "s_false" ? 1 : 0, mode);
    assert.equal(result.parseHresult, stopsAtInit || mode === "parse_exception" ? null :
      ["parse_failure", "parse_failure_allocated"].includes(mode) ? -2147467259 : 0, mode);
    assert.equal(result.selectionHresult, stopsAtInit || stopsAtParse || mode === "select_exception" ? null :
      mode === "select_failure" ? -2147467259 : 0, mode);
    assert.equal(result.stage, stopsAtInit ? "initialize" : stopsAtParse ? "parse" :
      ["select_failure", "select_exception"].includes(mode) ? "select" : "completed", mode);
    assert.equal(result.exception, ["initialize_exception", "parse_exception", "select_exception"].includes(mode), mode);
    assert.equal(result.pidlCleanup, !hasPidl ? "not_needed" : mode === "free_exception" ? "failed" : "completed", mode);
    assert.equal(result.comCleanup, stopsAtInit ? "not_needed" : mode === "uninitialize_exception" ? "failed" : "completed", mode);
    assert.equal(JSON.stringify(result).includes(target), false);
  }
});
