import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { collectNativeSelectionMetadata, invokeNativeSelection, parseNativeSelectionResponse,
  runNativeSelectionCli, runNativeSelectionExperiment } from "../scripts/windows-native-selection.mjs";
import { closeDisposableFileManagerTarget } from "../scripts/file-manager-evidence.mjs";

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

const observedParent = { exactParentFound: true, targetPresent: true, selectedTargetMatch: false,
  exactParentCount: 1, errorCount: 0, errors: [] };
const observedSelected = { ...observedParent, selectedTargetMatch: true };

// Exercise the real orchestrator and observer with owned filesystem fixtures,
// substituting only process/COM boundaries. No real selection is performed.
async function experimentFixture(t, { native = completed, observation = observedSelected,
  termination = "confirmed", filesystem = {}, commandError = false, cleanupError = false } = {}) {
  const evidenceDirectory = await fs.mkdtemp(join(tmpdir(), "workspace-native-evidence-test-"));
  const roots = [], calls = [], removed = [];
  let generatedTarget, elapsed = 0;
  t.after(async () => {
    for (const root of [...roots, evidenceDirectory]) await fs.rm(root, { recursive: true, force: true });
  });
  const clock = controlledClock();
  const options = {
    evidenceDirectory, platform: "win32", clock,
    env: { WORKSPACE_NATIVE_SELECTION_TARGET: target },
    filesystem: { ...fs,
      mkdtemp: async (prefix) => { const root = await fs.mkdtemp(prefix); roots.push(root); return root; },
      rmdir: async (path) => { removed.push(path); await fs.rmdir(path); },
      ...filesystem,
    },
    spawnProcess: (_program, args, settings) => {
      calls.push("bridge");
      generatedTarget = settings.env.WORKSPACE_NATIVE_SELECTION_TARGET;
      assert.notEqual(generatedTarget, target);
      assert.equal(dirname(generatedTarget), roots[0]);
      assert.match(basename(generatedTarget), /日本語/);
      assert.equal(args.join(" ").includes(generatedTarget), false);
      assert.equal(settings.shell, false);
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stdout.destroy = () => {};
      child.unref = () => {};
      child.kill = () => {
        calls.push("kill");
        if (termination === "confirmed") queueMicrotask(() => child.emit("close", null, "SIGKILL"));
        else queueMicrotask(() => clock.advance(1000));
      };
      queueMicrotask(() => {
        if (native === null) clock.advance(30000);
        else { child.stdout.emit("data", encode(native)); child.emit("close", 0, null); }
      });
      return child;
    },
    runCommand: async (program, args, settings) => {
      assert.equal(program, "powershell.exe");
      assert.equal(settings.env.WORKSPACE_OBSERVE_TARGET, generatedTarget);
      assert.equal(args.join(" ").includes(generatedTarget), false);
      const script = args.at(-1);
      if (script.includes("$window.Quit()")) {
        calls.push("window_cleanup");
        if (cleanupError) throw Object.assign(new Error(target), { code: target });
        return { stdout: "private cleanup output " + target };
      }
      calls.push("observe");
      assert.equal(script.includes("SelectItem("), false);
      assert.equal(script.includes("SHOpenFolderAndSelectItems"), false);
      assert.equal(script.includes(".Quit()"), false);
      if (commandError) throw Object.assign(new Error(target), { code: target });
      elapsed += 50;
      return { stdout: encode({ ...observation, path: target, message: "private observation" }) };
    },
    timing: { now: () => elapsed, sleep: async (ms) => { elapsed += ms; } },
  };
  const persisted = async () => JSON.parse(await fs.readFile(join(evidenceDirectory, "result.json"), "utf8"));
  const run = async () => {
    try {
      const result = await runNativeSelectionExperiment(options);
      assert.deepEqual(await persisted(), result);
      return result;
    } catch (error) {
      // Failure must be observable only after its sanitized evidence is saved.
      assert.deepEqual(await persisted(), error.evidence);
      assert.equal(error.message.includes(target), false);
      return error.evidence;
    }
  };
  return { options, run, roots, calls, removed, persisted, clock,
    get target() { return generatedTarget; } };
}

test("experiment owns one fresh Unicode fixture, overrides inherited target and persists exact selection", async (t) => {
  const fixture = await experimentFixture(t);
  const result = await fixture.run();
  assert.equal(result.status, "passed");
  assert.equal(fixture.roots.length, 1);
  assert.deepEqual(fixture.calls, ["bridge", "observe", "window_cleanup"]);
  assert.deepEqual(fixture.removed, [fixture.target, fixture.roots[0]]);
  await assert.rejects(fs.stat(fixture.roots[0]), { code: "ENOENT" });
  assert.equal(result.fixture.status, "completed");
  assert.match(result.metadata.codeSha, /^[a-f0-9]{40}$/);
  assert.equal(result.metadata.nodeVersion, process.versions.node);
  assert.equal(result.metadata.platform, process.platform);
  assert.equal(result.native.invocationCount, 1);
  assert.equal(result.native.native.selectionHresult, 0);
  assert.equal(result.observation.completion, "exact_target");
  assert.equal(result.observation.attempts.length, 1);
  assert.equal(result.windowCleanup.status, "completed");
  assert.equal(result.windowCleanup.closure, "unverified");
  assert.equal(result.windowCleanup.unselectedParentMayRemain, true);
  assert.equal(result.fixtureRemoval.status, "completed");
  for (const privateValue of [target, fixture.target, fixture.roots[0], "private"]) {
    assert.equal(encode(result).includes(privateValue), false);
  }
});

test("prerequisite failure never observes or retries and still cleans and persists", async (t) => {
  const native = { ...completed, stage: "initialize", initializeHresult: -2147417850,
    parseHresult: null, selectionHresult: null, invocationCount: 0, pidlAllocated: false,
    pidlCleanup: "not_needed", comCleanup: "not_needed" };
  const fixture = await experimentFixture(t, { native });
  const result = await fixture.run();
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, { stage: "native", code: "initialize" });
  assert.equal(result.native.invocationCount, 0);
  assert.equal(result.observation.status, "not_attempted");
  assert.equal(result.windowCleanup.status, "not_attempted");
  assert.equal(result.fixtureRemoval.status, "completed");
  assert.deepEqual(fixture.calls, ["bridge"]);
});

test("selection HRESULT failure cannot pass even when read-only exact selection is observed", async (t) => {
  const fixture = await experimentFixture(t, { native: { ...completed, stage: "select", selectionHresult: -1 } });
  const result = await fixture.run();
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, { stage: "native", code: "select" });
  assert.equal(result.observation.status, "passed");
  assert.equal(fixture.calls.filter((call) => call === "bridge").length, 1);
});

test("unselected target exhausts the unchanged controlled ten-second budget without another dispatch", async (t) => {
  const fixture = await experimentFixture(t, { observation: observedParent });
  const result = await fixture.run();
  assert.deepEqual(result.failure, { stage: "observation", code: "deadline" });
  assert.equal(result.observation.deadlineMs, 10000);
  assert.equal(result.observation.elapsedMs, 10000);
  assert.equal(result.observation.completion, "deadline");
  assert.ok(result.observation.attempts.length > 1);
  assert.ok(result.observation.attempts.every((attempt) => attempt.diagnostics.stage === "target_not_selected"));
  assert.ok(result.observation.attempts.at(-1).timeoutMs <= 100);
  assert.equal(fixture.calls.filter((call) => call === "bridge").length, 1);
  assert.equal(result.windowCleanup.closure, "unverified");
  assert.equal(result.fixtureRemoval.status, "completed");
});

test("observer unavailability is distinct from a negative native or selection result", async (t) => {
  const fixture = await experimentFixture(t, { commandError: true });
  const result = await fixture.run();
  assert.deepEqual(result.failure, { stage: "observation", code: "unavailable" });
  assert.equal(result.native.status, "completed");
  assert.equal(result.observation.attempts.length, 1);
  assert.equal(result.observation.unavailable, true);
  assert.equal(encode(result).includes(target), false);
  assert.deepEqual(fixture.calls, ["bridge", "observe", "window_cleanup"]);
});

test("timed-out dispatch remains unknown even if later observation finds the exact target", async (t) => {
  const fixture = await experimentFixture(t, { native: null });
  const result = await fixture.run();
  assert.deepEqual(result.failure, { stage: "native", code: "timeout" });
  assert.equal(result.native.invocationCount, null);
  assert.equal(result.native.process.termination, "confirmed");
  assert.equal(result.observation.status, "passed");
  assert.equal(result.status, "failed");
  assert.equal(result.fixtureRemoval.status, "completed");
  assert.deepEqual(fixture.calls, ["bridge", "kill", "observe", "window_cleanup"]);
});

test("unknown subprocess termination leaves the owned fixture and window cleanup unverified", async (t) => {
  const fixture = await experimentFixture(t, { native: null, termination: "unknown" });
  const result = await fixture.run();
  assert.equal(result.native.process.termination, "unknown");
  assert.equal(result.fixtureRemoval.status, "unverified");
  assert.equal(result.fixtureRemoval.code, "process_termination_unknown");
  assert.equal(result.windowCleanup.status, "not_attempted");
  assert.equal(result.observation.status, "not_attempted");
  assert.deepEqual(fixture.removed, []);
  assert.ok((await fs.stat(fixture.target)).isDirectory());
  assert.deepEqual(fixture.calls, ["bridge", "kill"]);
});

test("setup failure saves sanitized evidence, performs no dispatch and removes its partial root", async (t) => {
  const fixture = await experimentFixture(t, { filesystem: {
    mkdir: async (path, options) => {
      if (options?.recursive) return fs.mkdir(path, options);
      throw Object.assign(new Error(target), { code: "EACCES" });
    },
  } });
  const result = await fixture.run();
  assert.deepEqual(result.failure, { stage: "fixture", code: "EACCES" });
  assert.equal(result.fixture.rootCreated, true);
  assert.equal(result.fixture.targetCreated, false);
  assert.equal(result.fixtureRemoval.status, "completed");
  assert.deepEqual(fixture.calls, []);
  assert.deepEqual(fixture.removed, [fixture.roots[0]]);
});

test("cleanup failures are independent and preserve the original observation failure", async (t) => {
  const fixture = await experimentFixture(t, { commandError: true, cleanupError: true,
    filesystem: { rmdir: async () => { throw Object.assign(new Error(target), { code: "EPERM" }); } } });
  const result = await fixture.run();
  assert.deepEqual(result.failure, { stage: "observation", code: "unavailable" });
  assert.equal(result.windowCleanup.status, "failed");
  assert.equal(result.windowCleanup.code, "cleanup_unavailable");
  assert.equal(result.fixtureRemoval.status, "failed");
  assert.equal(result.fixtureRemoval.code, "EPERM");
  assert.equal(encode(result).includes(target), false);
});

test("successful selection does not hide a failed cleanup", async (t) => {
  const fixture = await experimentFixture(t, { cleanupError: true });
  const result = await fixture.run();
  assert.equal(result.observation.status, "passed");
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, { stage: "window_cleanup", code: "cleanup_unavailable" });
  assert.equal(result.fixtureRemoval.status, "completed");
});

test("filesystem cleanup is bounded and reports unresolved removal without masking native failure", async (t) => {
  let removalStarted;
  const started = new Promise((resolve) => { removalStarted = resolve; });
  const fixture = await experimentFixture(t, { native: { ...completed, stage: "select", selectionHresult: -1 },
    filesystem: { rmdir: () => { removalStarted(); return new Promise(() => {}); } } });
  const pending = fixture.run();
  await started;
  fixture.clock.advance(5000);
  const result = await pending;
  assert.deepEqual(result.failure, { stage: "native", code: "select" });
  assert.equal(result.fixtureRemoval.status, "unverified");
  assert.equal(result.fixtureRemoval.code, "timeout");
  assert.equal(fixture.clock.pending, 0);
});

test("unexpected content in the fixture survives bounded nonrecursive cleanup", async (t) => {
  const fixture = await experimentFixture(t);
  const runCommand = fixture.options.runCommand;
  fixture.options.runCommand = async (...args) => {
    await fs.writeFile(join(fixture.target, "sentinel.txt"), "retain this content");
    return runCommand(...args);
  };
  const result = await fixture.run();
  assert.equal(result.fixtureRemoval.status, "failed");
  assert.equal(result.fixtureRemoval.code, "ENOTEMPTY");
  assert.equal(await fs.readFile(join(fixture.target, "sentinel.txt"), "utf8"), "retain this content");
  assert.ok((await fs.stat(fixture.roots[0])).isDirectory());
});

test("failed evidence persistence rejects with finite diagnostics and preserves the first failure", async (t) => {
  const fixture = await experimentFixture(t, { commandError: true });
  fixture.options.filesystem.writeFile = async () => { throw new Error(target); };
  await assert.rejects(runNativeSelectionExperiment(fixture.options), (error) => {
    assert.deepEqual(error.evidence.failure, { stage: "observation", code: "unavailable" });
    assert.equal(error.evidence.persistence.status, "failed");
    assert.equal(error.message.includes(target), false);
    assert.equal(encode(error.evidence).includes(target), false);
    return true;
  });
  await assert.rejects(fixture.persisted(), { code: "ENOENT" });
});

function cliOutput() {
  const output = { stdout: "", stderr: "" };
  return { output, stdout: { write: (text) => { output.stdout += text; } },
    stderr: { write: (text) => { output.stderr += text; } } };
}

test("CLI preserves negative selection evidence before returning sanitized failure", async (t) => {
  const fixture = await experimentFixture(t, { observation: observedParent });
  const streams = cliOutput();
  const exitCode = await runNativeSelectionCli({ ...streams, args: [],
    experiment: () => runNativeSelectionExperiment(fixture.options) });
  assert.equal(exitCode, 1);
  assert.equal(streams.output.stdout, "");
  assert.equal(streams.output.stderr, "Windows native selection experiment failed.\n");
  const evidence = await fixture.persisted();
  assert.deepEqual(evidence.failure, { stage: "observation", code: "deadline" });
  assert.equal(evidence.native.invocationCount, 1);
  assert.equal(evidence.persistence.status, "completed");
  assert.equal(fixture.calls.filter((call) => call === "bridge").length, 1);
  for (const value of [target, fixture.target, fixture.roots[0]]) {
    assert.equal(encode(streams.output).includes(value), false);
    assert.equal(encode(evidence).includes(value), false);
  }
});

test("CLI unsupported host persists unavailable evidence without fixtures or subprocesses", async (t) => {
  const fixture = await experimentFixture(t);
  const streams = cliOutput();
  const exitCode = await runNativeSelectionCli({ ...streams, args: [],
    experiment: () => runNativeSelectionExperiment({ ...fixture.options, platform: "linux" }) });
  assert.equal(exitCode, 1);
  const evidence = await fixture.persisted();
  assert.deepEqual(evidence.failure, { stage: "host", code: "unsupported" });
  assert.equal(evidence.native.invocationCount, 0);
  assert.equal(evidence.fixture.status, "not_attempted");
  assert.deepEqual(fixture.calls, []);
  assert.deepEqual(fixture.roots, []);
  assert.equal(streams.output.stderr, "Windows native selection experiment failed.\n");
});

test("CLI rejects target arguments and never emits arbitrary exception or subprocess output", async () => {
  const streams = cliOutput();
  let calls = 0;
  const experiment = async () => { calls++; throw new Error(target + " private stdout/stderr"); };
  assert.equal(await runNativeSelectionCli({ ...streams, args: [target], experiment }), 1);
  assert.equal(calls, 0);
  assert.equal(await runNativeSelectionCli({ ...streams, args: [], experiment }), 1);
  assert.equal(calls, 1);
  assert.equal(streams.output.stdout, "");
  assert.equal(streams.output.stderr,
    "Windows native selection experiment failed (arguments).\nWindows native selection experiment failed.\n");
});

test("CLI reports a controlled successful experiment without another invocation", async (t) => {
  const fixture = await experimentFixture(t);
  const streams = cliOutput();
  assert.equal(await runNativeSelectionCli({ ...streams, args: [],
    experiment: () => runNativeSelectionExperiment(fixture.options) }), 0);
  assert.equal(streams.output.stdout, "Windows native selection experiment passed.\n");
  assert.equal(streams.output.stderr, "");
  assert.equal(fixture.calls.filter((call) => call === "bridge").length, 1);
});

test("actual CLI entry rejects arbitrary arguments without performing native selection", async () => {
  const execute = promisify(execFile);
  await assert.rejects(execute(process.execPath, ["scripts/windows-native-selection.mjs", target]), (error) => {
    assert.equal(error.code, 1);
    assert.equal(error.stdout, "");
    assert.equal(error.stderr, "Windows native selection experiment failed (arguments).\n");
    return true;
  });
});

test("metadata uses the checked-out code SHA and only finite runner/OS/Node fields", async () => {
  const sha = "4ac402620dd8139bdef9ff03625aae64bf60e132";
  const metadata = await collectNativeSelectionMetadata({
    readCodeRevision: async () => ({ stdout: sha + "\n", stderr: target }),
    env: { GITHUB_SHA: "f".repeat(40), RUNNER_OS: "Windows", RUNNER_ARCH: "X64",
      RUNNER_ENVIRONMENT: "github-hosted", ImageOS: "win25", ImageVersion: "20261001.1.0",
      RUNNER_NAME: target, SECRET: target },
  });
  assert.equal(metadata.codeSha, sha);
  assert.equal(metadata.nodeVersion, process.versions.node);
  assert.equal(metadata.platform, process.platform);
  assert.deepEqual(metadata.runner, { os: "Windows", architecture: "X64", environment: "github-hosted",
    image: "win25", imageVersion: "20261001.1.0" });
  assert.equal(encode(metadata).includes(target), false);
  const privateMetadata = await collectNativeSelectionMetadata({
    readCodeRevision: async () => ({ stdout: target }),
    env: { RUNNER_OS: target, RUNNER_ARCH: target, RUNNER_ENVIRONMENT: target,
      ImageOS: target, ImageVersion: target },
  });
  assert.equal(privateMetadata.codeSha, null);
  assert.ok(Object.values(privateMetadata.runner).every((value) => value === null));
  assert.equal(encode(privateMetadata).includes(target), false);
  const unavailable = await collectNativeSelectionMetadata({ readCodeRevision: async () => { throw new Error(target); } });
  assert.equal(unavailable.codeSha, null);
  assert.equal(encode(unavailable).includes(target), false);
});

test("missing code revision persists finite failure before any fixture or native dispatch", async (t) => {
  const fixture = await experimentFixture(t);
  await assert.rejects(runNativeSelectionExperiment({ ...fixture.options,
    readCodeRevision: async () => { throw new Error(target); },
  }), (error) => {
    assert.deepEqual(error.evidence.failure, { stage: "metadata", code: "revision_unavailable" });
    return true;
  });
  const evidence = await fixture.persisted();
  assert.equal(evidence.metadata.codeSha, null);
  assert.equal(evidence.persistence.status, "completed");
  assert.deepEqual(fixture.calls, []);
  assert.deepEqual(fixture.roots, []);
  assert.equal(encode(evidence).includes(target), false);
});

// Run the unchanged production cleanup script against controlled Shell views.
// No Explorer instance, real window or native selection is used by this test.
test("Windows cleanup closes only exact parent with exact selected target, preserving other windows", {
  skip: process.platform !== "win32",
}, async () => {
  const execute = promisify(execFile);
  const fixture = String.raw`
$expected = $env:WORKSPACE_OBSERVE_TARGET
$parent = [IO.Path]::GetDirectoryName($expected)
$closed = [Collections.Generic.List[string]]::new()
function Make-Window($id, $path, $selectedPath) {
  $document = [pscustomobject]@{ Folder = [pscustomobject]@{ Self = [pscustomobject]@{ Path = $path } }; selectedPath = $selectedPath }
  $document | Add-Member ScriptMethod SelectedItems {
    if ($null -ne $this.selectedPath) { [pscustomobject]@{ Path = $this.selectedPath } }
  }
  $window = [pscustomobject]@{ Document = $document; id = $id }
  $window | Add-Member ScriptMethod Quit { $closed.Add($this.id) }
  return $window
}
$views = @(
  (Make-Window 'unrelated_parent' 'C:\Other' $expected),
  (Make-Window 'same_parent_wrong_target' $parent ([IO.Path]::Combine($parent, 'other'))),
  (Make-Window 'same_parent_unselected' $parent $null),
  (Make-Window 'exact' $parent $expected)
)
$controlledShell = [pscustomobject]@{}
$controlledShell | Add-Member ScriptMethod Windows { return $views }
function New-Object { param([string]$ComObject) return $controlledShell }
`;
  let closed;
  const result = await closeDisposableFileManagerTarget(target, "win32", async (program, args, options) => {
    const output = await execute(program, [...args.slice(0, -1), `${fixture}\n& { ${args.at(-1)} }\nConvertTo-Json -InputObject @($closed.ToArray()) -Compress`], options);
    closed = JSON.parse(output.stdout);
    return output;
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(closed, ["exact"]);
});
