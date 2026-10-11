import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { explorerSelectionArgument, resolveSystemExplorer, runExplorerSelectionCli,
  runExplorerSelectionExperiment } from "../scripts/windows-explorer-selection.mjs";

const privateTarget = String.raw`C:\Owned fixture\日本語, & $x 'quoted' %literal% !^; ` + "`tick` (folder)";
const sha = "4ac402620dd8139bdef9ff03625aae64bf60e132";
const com = (selected) => JSON.stringify({ exactParentFound: true, targetPresent: true,
  selectedTargetMatch: selected, exactParentCount: 1, errorCount: 0, errors: [], private: privateTarget });
function controlledClock() {
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const token = {}; timers.set(token, { fn, ms }); return token; },
    clearTimeout: (token) => timers.delete(token),
    fire: (ms) => { for (const [token, timer] of [...timers]) if (timer.ms === ms) { timers.delete(token); timer.fn(); } },
    get pending() { return timers.size; },
  };
}

function fixture({ selected = true, unavailable = false, action, cleanupError = false,
  resolverError = false, fixtureError = false, removalError = false, persistenceError = false } = {}) {
  const clock = controlledClock(), events = [], removed = [], kills = [];
  let persisted, now = 0, calls = 0, unref = false;
  const child = new EventEmitter();
  child.unref = () => { unref = true; };
  child.kill = () => { kills.push(true); throw new Error("Explorer must never be killed"); };
  const filesystem = {
    mkdtemp: async (prefix) => {
      assert.ok(prefix.endsWith("workspace-native-selection-"));
      events.push("fixture"); return String.raw`C:\Owned fixture`;
    },
    mkdir: async (path) => { if (path.includes("Native selection") && fixtureError) throw { code: "EPERM" }; },
    rmdir: async (path) => { removed.push(path); if (removalError) throw { code: "ENOTEMPTY" }; },
    writeFile: async (_path, value) => { if (persistenceError) throw new Error(privateTarget); persisted = JSON.parse(value); },
  };
  const options = {
    platform: "win32", filesystem, clock,
    env: { PATH: privateTarget, SystemRoot: privateTarget, WORKSPACE_EXPLORER_TARGET: privateTarget },
    readCodeRevision: async () => ({ stdout: sha }),
    runResolver: async (program, args, settings) => {
      events.push("resolver");
      assert.equal(program, String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
      assert.equal(args.length, 4); assert.equal(settings.shell, false);
      if (resolverError) throw new Error(privateTarget);
      return { stdout: "C:\\Windows\r\n", stderr: "" };
    },
    spawnProcess: (program, args, settings) => {
      calls++; events.push("spawn");
      assert.equal(program, String.raw`C:\Windows\explorer.exe`);
      assert.equal(args.length, 1); assert.equal(args[0], explorerSelectionArgument(String.raw`C:\Owned fixture\Native selection 日本語`));
      assert.deepEqual(settings, { shell: false, windowsVerbatimArguments: true, stdio: "ignore" });
      if (action === "throw") throw new Error(privateTarget);
      queueMicrotask(() => {
        if (action === "error") { child.emit("error", new Error(privateTarget)); child.emit("close", -1, null); }
        else if (action !== "no_spawn") {
          child.emit("spawn");
          if (action === "late_error") child.emit("error", new Error(privateTarget));
          if (action !== "live" && action !== "close_on_cleanup") child.emit("close", action === "nonzero" ? 7 : 0, null);
        }
      });
      return child;
    },
    runCommand: async (_program, _args) => {
      if (_args.at(-1).includes("$result.closed")) {
        events.push("cleanup");
        if (action === "close_on_cleanup") child.emit("close", 0, null);
        return { stdout: JSON.stringify({ matched: 1, closed: cleanupError ? 0 : 1, errorCount: cleanupError ? 1 : 0 }) };
      }
      events.push("observe");
      return { stdout: unavailable ? "private malformed output" : com(selected) };
    },
    timing: { now: () => now, sleep: async (ms) => { now += ms; } },
  };
  return {
    options, child, clock, events, removed,
    run: async () => {
      let evidence;
      try { evidence = await runExplorerSelectionExperiment(options); }
      catch (error) { assert.equal(error.message, "Windows Explorer selection experiment failed"); evidence = error.evidence; }
      if (!persistenceError) assert.deepEqual(evidence, persisted);
      assert.equal(JSON.stringify(evidence).includes("C:\\"), false);
      assert.equal(clock.pending, 0);
      assert.deepEqual(kills, []);
      return evidence;
    },
    get calls() { return calls; }, get unref() { return unref; },
  };
}

test("Explorer argument retains literal spaces comma Unicode and metacharacters inside one quoted path", () => {
  assert.equal(explorerSelectionArgument(privateTarget), `/select,"${privateTarget}"`);
  for (const value of ["", null, "relative", "C:relative", "\\\\server\\share", "C:\\a\"b", "C:\\a\0b",
    "C:\\a\nb", "C:\\a\\", "C:\\a\\..\\b", "C:\\a:stream", "C:\\a" + "x".repeat(32000)]) {
    assert.throws(() => explorerSelectionArgument(value), { message: "Invalid Explorer selection target" });
  }
});

test("trusted directory resolver is fixed bounded private and rejects extra or redirected output", async () => {
  assert.equal(await resolveSystemExplorer(async () => ({ stdout: "C:\\Windows\n", stderr: "" })), String.raw`C:\Windows\explorer.exe`);
  for (const stdout of ["C:\\Windows", "D:\\Windows\n", "C:\\evil\n", "C:\\Windows\nprivate", "C:\\Windows\0\n", "x".repeat(1025)]) {
    await assert.rejects(resolveSystemExplorer(async () => ({ stdout, stderr: "" })), { message: "System directory unavailable" });
  }
  await assert.rejects(resolveSystemExplorer(async () => ({ stdout: "C:\\Windows\n", stderr: privateTarget })));
  const script = await fs.readFile(new URL("../scripts/windows-explorer-directory.ps1", import.meta.url), "utf8");
  assert.match(script, /GetSystemWindowsDirectoryW/);
  assert.doesNotMatch(script, /\$env:|Start-Process|Process.Start|Invoke-Expression/);
});

test("one launched process is observed immediately and exit zero stays separate from strict selection", async () => {
  const f = fixture(); const evidence = await f.run();
  assert.equal(evidence.status, "passed"); assert.equal(f.calls, 1);
  assert.deepEqual(f.events, ["resolver", "fixture", "spawn", "observe", "cleanup"]);
  assert.equal(evidence.launch.status, "launched"); assert.equal(evidence.launch.process.exitCode, 0);
  assert.equal(evidence.observation.exactTargetObserved, true);
  assert.equal(evidence.windowCleanup.closure, "unverified");
  assert.equal(evidence.fixtureRemoval.status, "completed"); assert.equal(f.removed.length, 2);
});

test("negative and unavailable exact observations persist without retry or exit-code acceptance", async () => {
  for (const options of [{ selected: false }, { unavailable: true }]) {
    const f = fixture(options); const evidence = await f.run();
    assert.equal(evidence.status, "failed"); assert.equal(evidence.failure.stage, "observation");
    assert.equal(evidence.launch.process.exitCode, 0); assert.equal(f.calls, 1);
    assert.equal(evidence.fixtureRemoval.status, "completed");
    if (!options.unavailable) {
      assert.equal(evidence.observation.deadlineMs, 10000); assert.equal(evidence.observation.elapsedMs, 10000);
      assert.ok(evidence.observation.attempts.every((a) => a.diagnostics.stage === "target_not_selected"));
    } else assert.equal(evidence.observation.completion, "unavailable");
  }
});

test("observer and exact owned cleanup run while Explorer is alive and close is independently confirmed", async () => {
  const f = fixture({ action: "close_on_cleanup" }); const evidence = await f.run();
  assert.equal(evidence.status, "passed"); assert.equal(evidence.launch.process.termination, "confirmed");
  assert.ok(f.events.indexOf("observe") < f.events.indexOf("cleanup"));
});

test("unknown termination is bounded without any Explorer kill and prevents fixture removal", async () => {
  for (const action of ["live", "no_spawn"]) {
    const f = fixture({ action }); const pending = f.run();
    // Drain finite orchestration to the close confirmation timer.
    for (let i = 0; i < 40; i++) await Promise.resolve();
    if (action === "no_spawn") { f.clock.fire(5000); for (let i = 0; i < 10; i++) await Promise.resolve(); }
    f.clock.fire(1000);
    const evidence = await pending;
    assert.equal(evidence.status, "failed"); assert.equal(evidence.launch.process.termination, "unknown");
    assert.equal(evidence.launch.process.killAttempted, false); assert.equal(f.unref, true);
    assert.equal(f.calls, 1); assert.deepEqual(f.removed, []);
    assert.deepEqual(evidence.fixtureRemoval, { status: "unverified", code: "process_termination_unknown" });
    f.child.emit("close", 0, null);
    assert.equal(evidence.launch.process.termination, "unknown");
  }
});

test("launch errors and nonzero exit never turn selection or cleanup into dispatch success", async () => {
  for (const action of ["throw", "error", "late_error", "nonzero"]) {
    const f = fixture({ action }); const evidence = await f.run();
    assert.equal(evidence.status, "failed"); assert.equal(f.calls, 1); assert.equal(f.removed.length, 2);
    if (["nonzero", "late_error"].includes(action)) assert.equal(evidence.observation.status, "passed");
    else assert.equal(evidence.observation.status, "not_attempted");
  }
});

test("resolver fixture cleanup and persistence failures retain finite independent failure evidence", async () => {
  for (const [options, stage] of [[{ resolverError: true }, "resolver"], [{ fixtureError: true }, "fixture"],
    [{ cleanupError: true }, "window_cleanup"], [{ removalError: true }, "fixture_removal"], [{ persistenceError: true }, "evidence"]]) {
    const f = fixture(options); const evidence = await f.run();
    assert.equal(evidence.status, "failed"); assert.equal(evidence.failure.stage, stage);
    if (options.resolverError) { assert.equal(f.calls, 0); assert.deepEqual(f.removed, []); }
    if (options.removalError) assert.equal(evidence.fixtureRemoval.code, "ENOTEMPTY");
  }
});

test("unsupported hosts and CLI inputs cannot supply a target program or script and emit fixed messages", async () => {
  const f = fixture(); f.options.platform = "darwin";
  const evidence = await f.run(); assert.equal(evidence.failure.stage, "host"); assert.equal(f.calls, 0);
  let calls = 0, out = "", err = "";
  const options = { stdout: { write: (s) => { out += s; } }, stderr: { write: (s) => { err += s; } },
    experiment: async () => { calls++; throw new Error(privateTarget); } };
  assert.equal(await runExplorerSelectionCli({ ...options, args: [privateTarget] }), 1); assert.equal(calls, 0);
  assert.equal(await runExplorerSelectionCli({ ...options, args: [] }), 1); assert.equal(calls, 1);
  assert.equal(out, ""); assert.equal(err.includes(privateTarget), false);
});

test("Windows verbatim transport preserves the exact raw select suffix without launching Explorer", { skip: process.platform !== "win32" }, async (t) => {
  assert.equal((await resolveSystemExplorer()).toLowerCase(), String.raw`c:\windows\explorer.exe`);
  const root = await fs.mkdtemp(join(tmpdir(), "workspace-cli-argv-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const script = join(root, "compile.ps1"), program = join(root, "argv.exe");
  await fs.writeFile(script, String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -OutputAssembly $env:WORKSPACE_ARGV_EXE -OutputType ConsoleApplication -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ArgumentProbe {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true)]
  static extern IntPtr GetCommandLineW();
  public static int Main() {
    string raw = Marshal.PtrToStringUni(GetCommandLineW());
    string expected = Environment.GetEnvironmentVariable("WORKSPACE_EXPECTED_ARG");
    Console.WriteLine(raw.EndsWith(" " + expected, StringComparison.Ordinal) ? "true" : "false");
    return 0;
  }
}
'@
`, "utf8");
  await promisify(execFile)(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, ["-NoProfile", "-NonInteractive", "-File", script],
    { timeout: 30000, maxBuffer: 1024, env: { ...process.env, WORKSPACE_ARGV_EXE: program } });
  const argument = explorerSelectionArgument(privateTarget);
  // execFile's callback follows close; timeout/output limits apply only to this
  // controlled short-lived executable, never to an Explorer process.
  const result = await promisify(execFile)(program, [argument], { shell: false, windowsVerbatimArguments: true,
    timeout: 5000, maxBuffer: 1024, env: { ...process.env, WORKSPACE_EXPECTED_ARG: argument } });
  assert.equal(result.stdout.trim(), "true");
  assert.equal(result.stderr, "");
});

test("resolver observation preserves LF and CRLF authorization without retaining output", async () => {
  for (const stdout of ["C:\\Windows\n", "c:\\WINDOWS\r\n"]) {
    let observation;
    const executable = await resolveSystemExplorer(async (program, args, options) => {
      assert.equal(program, String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
      assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-File"]);
      assert.ok(args[3].endsWith("windows-explorer-directory.ps1"));
      assert.deepEqual(options, { timeout: 10000, maxBuffer: 1024, windowsHide: true, shell: false });
      return { stdout, stderr: "", secret: privateTarget };
    }, (value) => { observation = value; });
    assert.equal(executable.toLowerCase(), String.raw`c:\windows\explorer.exe`);
    assert.equal(observation.outcome, "resolved");
    assert.equal(observation.stdout.expectedShape, true);
    assert.equal(observation.stderr.expectedShape, true);
    assert.equal(observation.termination, "unknown");
    assert.equal(observation.exitCode, null);
    assert.equal(JSON.stringify(observation).includes("Windows"), false);
    assert.equal(JSON.stringify(observation).includes(privateTarget), false);
    assert.ok(observation.elapsedMs >= 0 && observation.elapsedMs <= 60000);
  }
});

function resolverProcess({ output = { stdout: "C:\\Windows\n", stderr: "" }, error,
  close = true, exitCode = 0, signal = null } = {}) {
  const child = new EventEmitter();
  child.killed = error?.killed ?? false;
  const run = () => {
    const promise = new Promise((resolve, reject) => queueMicrotask(() => {
      if (close) child.emit("close", exitCode, signal);
      if (error) reject(error); else resolve(output);
    }));
    promise.child = child;
    return promise;
  };
  return { run, child };
}

test("resolver confirms only direct-child close and freezes its finite snapshot", async () => {
  const f = resolverProcess(); let observation;
  await resolveSystemExplorer(f.run, (value) => { observation = value; });
  assert.equal(observation.termination, "confirmed");
  assert.equal(observation.exitCode, 0); assert.equal(observation.signal, null);
  assert.equal(observation.killed, false);
  const persisted = JSON.stringify(observation);
  f.child.emit("close", 7, "SIGKILL");
  assert.equal(JSON.stringify(observation), persisted);
  assert.throws(() => { observation.stdout.bytes = 999; }, TypeError);
});

test("resolver records classified rejection and invalid output without broadening authorization", async () => {
  const cases = [
    [{ error: { code: "EPERM", stdout: privateTarget, stderr: privateTarget, killed: true, signal: "SIGTERM", message: privateTarget }, exitCode: 1 }, "execution_rejected"],
    [{ exitCode: 8 }, "nonzero_exit"],
    [{ output: { stdout: "C:\\Windows\n", stderr: privateTarget } }, "stderr_nonempty"],
    [{ output: { stdout: "x".repeat(1025), stderr: "" } }, "output_limit"],
    [{ output: { stdout: "C:\\Windows\n", stderr: "x".repeat(1025) } }, "output_limit"],
    [{ output: { stdout: "D:\\Windows\n", stderr: "" } }, "output_invalid"],
    [{ output: { stderr: "" } }, "output_invalid"],
    [{ output: null }, "output_invalid"],
    [{ error: { code: privateTarget, signal: privateTarget, killed: privateTarget, stdout: 77,
      stderr: {}, stack: privateTarget, pid: 45 }, close: false }, "execution_rejected"],
  ];
  for (const [options, outcome] of cases) {
    let observation;
    await assert.rejects(resolveSystemExplorer(resolverProcess(options).run, (value) => { observation = value; }));
    assert.equal(observation.outcome, outcome);
    assert.equal(JSON.stringify(observation).includes(privateTarget), false);
    assert.deepEqual(Object.keys(observation).sort(), ["version", "outcome", "elapsedMs", "exitCode", "errorCode",
      "signal", "killed", "termination", "stdout", "stderr"].sort());
    if (outcome === "output_limit") {
      const stream = observation.stdout.overflow ? observation.stdout : observation.stderr;
      assert.equal(stream.bytes, 1024); assert.equal(stream.overflow, true);
    }
    if (options.error?.code === "EPERM") assert.equal(observation.errorCode, "EPERM");
    if (options.close === false) {
      assert.equal(observation.termination, "unknown"); assert.equal(observation.errorCode, "unknown");
      assert.equal(observation.killed, null); assert.equal(observation.signal, "unknown");
      assert.equal(observation.stdout.bytes, null);
    }
  }
});

test("rejection and killed flags without close cannot prove termination or timeout", async () => {
  let observation;
  const f = resolverProcess({ error: { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", killed: true, signal: "SIGTERM" }, close: false });
  await assert.rejects(resolveSystemExplorer(f.run, (value) => { observation = value; }));
  assert.equal(observation.termination, "unknown"); assert.equal(observation.outcome, "execution_rejected");
  assert.equal(observation.errorCode, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"); assert.equal(observation.killed, true);
  f.child.emit("close", 0, null); assert.equal(observation.termination, "unknown");
  await assert.rejects(resolveSystemExplorer(async () => { throw privateTarget; }, (value) => { observation = value; }));
  assert.equal(observation.errorCode, "unknown"); assert.equal(observation.signal, "unknown");
  assert.equal(observation.killed, null); assert.equal(observation.termination, "unknown");
  // A diagnostic callback can neither rescue rejection nor invalidate success.
  await assert.rejects(resolveSystemExplorer(f.run, () => { throw new Error("consumer"); }));
  assert.equal(await resolveSystemExplorer(resolverProcess().run, () => { throw new Error("consumer"); }), String.raw`C:\Windows\explorer.exe`);
});

test("only an observed spawn failure establishes a child was not started", async () => {
  const child = new EventEmitter(); child.pid = undefined; child.killed = false; child.on("error", () => {});
  const error = { code: "ENOENT", stdout: "", stderr: "" }; let observation;
  const run = () => {
    const pending = new Promise((_resolve, reject) => queueMicrotask(() => {
      child.emit("error", error); reject(error);
    }));
    pending.child = child; return pending;
  };
  await assert.rejects(resolveSystemExplorer(run, (value) => { observation = value; }));
  assert.equal(observation.termination, "not_started");
  assert.equal(observation.errorCode, "ENOENT");
});

test("real execFile lifecycle supplies close evidence through the existing promise-child seam", async () => {
  for (const [program, expected] of [
    ['process.stdout.write("C:\\\\Windows\\n")', "resolved"],
    ['process.stdout.write("C:\\\\Windows\\n"); process.exitCode = 7', "execution_rejected"],
    ['process.stdout.write("x".repeat(2048))', "execution_rejected"],
  ]) {
    let observation;
    const invoke = (_fixedProgram, _fixedArgs, options) => promisify(execFile)(process.execPath, ["-e", program], options);
    if (expected === "resolved") await resolveSystemExplorer(invoke, (value) => { observation = value; });
    else await assert.rejects(resolveSystemExplorer(invoke, (value) => { observation = value; }));
    assert.equal(observation.outcome, expected); assert.equal(observation.termination, "confirmed");
    if (program.includes("repeat")) assert.equal(observation.errorCode, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
  }
});

test("unknown exit and signal fields are dropped and elapsed duration never proves timeout", async (t) => {
  let observation;
  const f = resolverProcess({ exitCode: 1e100, signal: privateTarget });
  await assert.rejects(resolveSystemExplorer(f.run, (value) => { observation = value; }));
  assert.equal(observation.exitCode, null); assert.equal(observation.signal, "unknown");
  assert.equal(JSON.stringify(observation).includes(privateTarget), false);
  let tick = 0;
  t.mock.method(performance, "now", () => tick++ === 0 ? 0 : 90000);
  await assert.rejects(resolveSystemExplorer(async () => { throw null; }, (value) => { observation = value; }));
  assert.equal(observation.elapsedMs, 60000); assert.equal(observation.outcome, "execution_rejected");
  assert.equal(observation.errorCode, "unknown"); assert.equal(observation.termination, "unknown");
});
