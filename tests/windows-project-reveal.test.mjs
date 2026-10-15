import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { realpathSync, statSync } from "node:fs";
import { win32 } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createWindowsProjectReveal, resolveWindowsPowerShell, runWindowsProjectReveal } from "../src/desktop/windows-project-reveal.ts";

const program = "D:\\Operating System\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const target = "D:\\Owned 日本語\\Category, & literal\\Project $()";
const nativeDirectory = fileURLToPath(new URL("../fixed native/", import.meta.url));
const nativeScript = fileURLToPath(new URL("../fixed native/windows-project-reveal.ps1", import.meta.url));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function fixture({ permit = async (dispatch) => dispatch(), autoClose = true, timeoutMs = 5000, killConfirmationMs = 15, spawnProcess, onEvent } = {}) {
  const child = new EventEmitter(), writes = [], calls = [], events = [], abort = new AbortController();
  let current = true;
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(chunk, encoding, callback) { writes.push(chunk.toString()); callback(); } });
  child.kill = (signal) => { calls.push(signal); if (autoClose) queueMicrotask(() => child.emit("close", null, signal)); return autoClose; };
  const launched = [];
  const context = { isCurrent: () => current, signal: abort.signal, permit };
  const options = { nativeDirectory, program, timeoutMs, killConfirmationMs, pollMs: 2,
    spawnProcess: spawnProcess ?? ((...args) => { launched.push(args); return child; }),
    onEvent: onEvent ?? ((event) => events.push(event)), };
  return { child, writes, calls, events, abort, launched, context, options,
    stale() { current = false; }, start() { return runWindowsProjectReveal(target, context, options); },
    output(value) { child.stdout.write(value); }, close(code = 0, signal = null) { child.emit("close", code, signal); } };
}
const problem = (expected) => (error) => error.problem === expected && error.message === expected;

test("loaded canonical system modules resolve PowerShell on an alternate Windows drive without environment/PATH", () => {
  const paths = ["D:\\Operating System\\System32\\kernel32.dll", "D:\\Operating System\\System32\\ntdll.dll"];
  const options = { platform: "win32", report: () => ({ sharedObjects: paths }), realpath: (value) => value, isFile: () => true };
  assert.equal(resolveWindowsPowerShell(options), program);
  for (const sharedObjects of [[], [paths[0]], [...paths, paths[0]], [paths[0], "C:\\Windows\\System32\\ntdll.dll"],
    ["\\\\server\\System32\\kernel32.dll", "\\\\server\\System32\\ntdll.dll"],
    ["D:\\Other\\kernel32.dll", "D:\\Other\\ntdll.dll"], [paths[0], 42], [paths[0].replace("System32", "System32\\..\\System32"), paths[1]]]) {
    assert.equal(resolveWindowsPowerShell({ ...options, report: () => ({ sharedObjects }) }), undefined);
  }
  assert.equal(resolveWindowsPowerShell({ ...options, platform: "darwin" }), undefined);
  assert.equal(resolveWindowsPowerShell({ ...options, realpath: (value) => value.replace("System32", "redirected") }), undefined);
  assert.equal(resolveWindowsPowerShell({ ...options, isFile: (value) => !value.endsWith("powershell.exe") }), undefined);
  assert.equal(resolveWindowsPowerShell({ ...options, report: () => { throw new Error("private report"); } }), undefined);
});

test("real Windows Node report resolves a canonical installed system PowerShell", { skip: process.platform !== "win32" }, () => {
  const actual = resolveWindowsPowerShell();
  assert.equal(typeof actual, "string", "The real Windows runtime must expose both loaded system modules");
  assert.equal(win32.basename(actual).toLowerCase(), "powershell.exe");
  assert.match(actual, /^[a-z]:\\.+\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i);
  assert.equal(realpathSync.native(actual).toLowerCase(), actual.toLowerCase());
  assert.equal(statSync(actual).isFile(), true);
});

test("one valid split protocol waits for fresh permit, sends one GO and requires DONE plus close0", async () => {
  let allow; let permits = 0;
  const f = fixture({ permit: (dispatch) => { permits++; return new Promise((resolve) => { allow = () => { dispatch(); resolve(); }; }); } });
  const pending = f.start();
  f.output("OP"); f.output("EN\r\nREA"); f.output("DY\n");
  assert.equal(permits, 1); assert.deepEqual(f.writes, []);
  allow(); await tick();
  assert.deepEqual(f.writes, ["GO\n"]);
  f.output("SELECT\nDONE\n");
  let resolved = false; pending.then(() => { resolved = true; }); await tick(); assert.equal(resolved, false);
  f.close(); await pending;
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.events, ["started", "open", "select", "stopped", "done"].map((stage) => ({ stage, path: target })));
  assert.equal(f.launched.length, 1);
  const [executable, args, settings] = f.launched[0];
  assert.equal(executable, program);
  assert.deepEqual(args, ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", nativeScript]);
  assert.equal(settings.shell, false); assert.equal(settings.env.WORKSPACE_PROJECT_REVEAL_TARGET, target);
  assert.ok(!args.some((arg) => arg.includes(target)));
  assert.equal(f.child.stdout.listenerCount("data"), 0);
  assert.equal(f.child.listenerCount("close"), 0);
});

for (const output of ["READY\n", "OPEN\nOPEN\n", "OPEN\nREADY\nREADY\n", "OPEN\nSELECT\n", "FAIL\n", "OPEN\nprivate path\n", "OPEN\n\n", "x".repeat(1025), Buffer.from([0xcf, 0x50, 0x45, 0x4e, 10])]) {
  test(`rejects malformed/duplicate/oversized protocol ${JSON.stringify(output).slice(0, 65)}`, async () => {
    const f = fixture(); const pending = f.start(); f.output(output);
    await assert.rejects(pending, problem("native_error"));
    assert.equal(f.launched.length, 1); assert.deepEqual(f.calls, ["SIGKILL"]);
  });
}

for (const ending of ["trailing", "nonzero", "signal", "early", "unterminated"]) {
  test(`rejects ${ending} completion instead of inferring native success`, async () => {
    const f = fixture(); const pending = f.start();
    if (ending !== "early") { f.output("OPEN\nREADY\n"); await tick(); f.output("SELECT\nDONE\n"); }
    if (ending === "trailing") f.output("garbage\n");
    if (ending === "unterminated") f.output("garbage");
    f.close(ending === "nonzero" ? 1 : 0, ending === "signal" ? "SIGKILL" : null);
    await assert.rejects(pending, problem("native_error"));
    assert.ok(!f.events.some((event) => event.stage === "done"));
  });
}

for (const cancel of ["signal", "current", "deadline", "permit rejection"]) {
  test(`${cancel} while authorization waits prevents a late GO`, async () => {
    let allow, reject;
    const f = fixture({ timeoutMs: 25, permit: (dispatch) => new Promise((yes, no) => { allow = () => { dispatch(); yes(); }; reject = no; }) });
    const pending = f.start(); f.output("OPEN\nREADY\n");
    if (cancel === "signal") f.abort.abort();
    if (cancel === "current") f.stale();
    if (cancel === "permit rejection") reject(new Error("private backend failure"));
    await assert.rejects(pending, problem(cancel === "deadline" ? "native_unavailable" : cancel === "permit rejection" ? "native_error" : "request_expired"));
    allow(); await tick();
    assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, ["SIGKILL"]);
    assert.equal(f.child.stdout.listenerCount("data"), 0);
  });
}

test("post-permit cancellation kills only owned child and cannot accept subsequent successful output", async () => {
  const f = fixture(); const pending = f.start(); f.output("OPEN\nREADY\n"); await tick();
  assert.deepEqual(f.writes, ["GO\n"]);
  f.abort.abort(); f.output("SELECT\nDONE\n");
  await assert.rejects(pending, problem("request_expired"));
  assert.deepEqual(f.events.map((event) => event.stage), ["started", "open", "stopped"]);
  assert.deepEqual(f.calls, ["SIGKILL"]);
});

test("GO is written in the permit validation continuation before a queued microtask mutation", async () => {
  let mutation = false;
  const f = fixture({ permit: async (dispatch) => {
    await Promise.resolve();
    queueMicrotask(() => { mutation = true; });
    dispatch();
    assert.equal(mutation, false);
    assert.deepEqual(f.writes, ["GO\n"], "Final validation and dispatch cannot be separated by awaiting permit");
  } });
  const pending = f.start(); f.output("OPEN\nREADY\n"); await tick();
  assert.equal(mutation, true);
  f.output("SELECT\nDONE\n"); f.close(); await pending;
});

test("a permit that does not synchronously dispatch fails closed and cannot dispatch later", async () => {
  let lateDispatch;
  const f = fixture({ permit: async (dispatch) => { lateDispatch = dispatch; } });
  const pending = f.start(); f.output("OPEN\nREADY\n");
  await assert.rejects(pending, problem("native_error"));
  lateDispatch();
  assert.deepEqual(f.writes, []);
});

test("duplicate permit callbacks reject without a second GO", async () => {
  const f = fixture({ permit: async (dispatch) => { dispatch(); dispatch(); } });
  const pending = f.start(); f.output("OPEN\nREADY\n");
  await assert.rejects(pending, problem("native_error"));
  assert.deepEqual(f.writes, ["GO\n"]);
});

for (const output of ["SELECT\nSELECT\n", "SELECT\nDONE\nDONE\n", "DONE\n"]) {
  test(`rejects invalid post-permit order ${JSON.stringify(output)}`, async () => {
    const f = fixture(); const pending = f.start(); f.output("OPEN\nREADY\n"); await tick();
    f.output(output);
    await assert.rejects(pending, problem("native_error"));
    assert.deepEqual(f.writes, ["GO\n"]);
    assert.ok(!f.events.some((event) => event.stage === "done"));
  });
}

test("an actual failed GO write rejects without a second write or native launch", async () => {
  const f = fixture();
  f.child.stdin = new Writable({ write(chunk, encoding, callback) { callback(new Error("private broken pipe")); } });
  const pending = f.start(); f.output("OPEN\nREADY\n");
  await assert.rejects(pending, problem("native_error"));
  assert.equal(f.launched.length, 1); assert.deepEqual(f.calls, ["SIGKILL"]);
});

test("pre-dispatch abort racing synchronous spawn never grants permission", async () => {
  const f = fixture();
  f.options.spawnProcess = () => { f.abort.abort(); return f.child; };
  await assert.rejects(f.start(), problem("request_expired"));
  assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, ["SIGKILL"]);
});

test("a child without confirmed termination rejects within its bounded kill wait", async () => {
  const f = fixture({ autoClose: false, timeoutMs: 8, killConfirmationMs: 8 });
  await assert.rejects(f.start(), problem("native_unavailable"));
  assert.deepEqual(f.calls, ["SIGKILL"]);
  const expiredEvents = [{ stage: "started", path: target },
    { stage: "failure", path: target, phase: "initial", reason: "owner_deadline" }, { stage: "unknown", path: target }];
  assert.deepEqual(f.events, expiredEvents);
  f.child.emit("error", new Error("late owned child error"));
  f.child.stdin.emit("error", new Error("late pipe error"));
  f.close(null, "SIGKILL");
  assert.deepEqual(f.events, [...expiredEvents, { stage: "stopped", path: target }]);
  f.close(null, "SIGKILL");
  assert.equal(f.events.filter((event) => event.stage === "stopped").length, 1);
  assert.equal(f.child.listenerCount("error"), 0);
  assert.equal(f.child.stdin.listenerCount("error"), 0);
});

test("a failed confirmed child close is separately observable and never reports unknown termination", async () => {
  const f = fixture(); const pending = f.start(); f.close(1);
  await assert.rejects(pending, problem("native_error"));
  assert.deepEqual(f.events, ["started", "stopped"].map((stage) => ({ stage, path: target })));
});

for (const error of ["stderr", "stdin", "stdout pipe", "stderr pipe", "process", "spawn"]) {
  test(`${error} failure is sanitized and never retries native launch`, async () => {
    const f = fixture(error === "spawn" ? { spawnProcess: () => { throw new Error("private target"); } } : {});
    const pending = f.start();
    if (error === "stderr") f.child.stderr.write("private target and exception");
    if (error === "stdin") f.child.stdin.emit("error", new Error("private target"));
    if (error === "stdout pipe") f.child.stdout.emit("error", new Error("private target"));
    if (error === "stderr pipe") f.child.stderr.emit("error", new Error("private target"));
    if (error === "process") f.child.emit("error", new Error("private target"));
    await assert.rejects(pending, problem(["spawn", "process"].includes(error) ? "native_unavailable" : "native_error"));
    assert.ok(f.launched.length <= 1);
  });
}

test("unavailable resolver and already expired contexts do not start a process", async () => {
  const f = fixture(); f.options.program = undefined;
  await assert.rejects(f.start(), problem("native_unavailable"));
  f.options.program = program; f.abort.abort();
  await assert.rejects(f.start(), problem("request_expired"));
  assert.deepEqual(f.launched, []);
});

test("invalid path data cannot reach the process boundary", async () => {
  const f = fixture();
  for (const path of ["relative", `${target}\0injection`]) {
    await assert.rejects(runWindowsProjectReveal(path, f.context, f.options), problem("native_error"));
  }
  assert.deepEqual(f.launched, []);
});

test("trusted desktop factory resolves program only once and preserves unsupported resolution", async () => {
  let resolutions = 0, launches = 0;
  const reveal = createWindowsProjectReveal({ nativeDirectory: "/fixed/native", resolveProgram: () => { resolutions++; return undefined; },
    spawnProcess: () => { launches++; throw new Error("must not launch"); } });
  for (let i = 0; i < 2; i++) await assert.rejects(reveal(target, { isCurrent: () => true, permit: async () => undefined }), problem("native_unavailable"));
  assert.equal(resolutions, 1); assert.equal(launches, 0);
});

test("instrumentation failure cannot change actual command completion", async () => {
  const f = fixture({ onEvent: () => { throw new Error("observer failure"); } });
  const pending = f.start(); f.output("OPEN\nREADY\n"); await tick();
  f.output("SELECT\nDONE\n"); f.close(); await pending;
  await delay(3); assert.deepEqual(f.calls, []);
});

for (const [phase, reason] of [["permit", "deadline"], ["precommand", "binding"], ["readiness", "exception"]]) {
  test(`finite bridge failure retains ${phase}/${reason} without authorizing success`, async () => {
    const f = fixture(); const pending = f.start();
    f.output("OPEN\nREADY\n"); await tick();
    f.output(`FAIL:${phase}:${reason}\n`);
    await assert.rejects(pending, problem("native_error"));
    assert.deepEqual(f.events.filter(event => event.stage === "failure"), [{ stage: "failure", path: target, phase, reason }]);
    assert.equal(f.events.some(event => event.stage === "select" || event.stage === "done"), false);
    assert.deepEqual(f.calls, ["SIGKILL"]);
  });
}
for (const token of ["FAIL:private:deadline", "FAIL:permit:private path", "FAIL:permit:deadline:extra"]) {
  test(`unknown failure token stays private: ${token}`, async () => {
    const f = fixture(); const pending = f.start(); f.output(`${token}\n`);
    await assert.rejects(pending, problem("native_error"));
    assert.equal(f.events.some(event => event.stage === "failure"), false);
  });
}

for (const [output, phase] of [["", "initial"], ["OPEN\n", "opened"], ["OPEN\nREADY\n", "authorizing"]]) {
  test(`owned deadline retains its exact protocol state ${phase} without granting a late permit`, async (t) => {
    const timers = [], original = globalThis.setTimeout;
    t.mock.method(globalThis, "setTimeout", (callback, milliseconds, ...args) => {
      if (milliseconds === 12000) { const timer = { callback }; timers.push(timer); return timer; }
      return original(callback, milliseconds, ...args);
    });
    let allow;
    const f = fixture({ timeoutMs: 12000, permit: dispatch => new Promise(resolve => { allow = () => { dispatch(); resolve(); }; }) });
    const pending = f.start(); f.output(output);
    assert.equal(timers.length, 1); timers[0].callback();
    await assert.rejects(pending, problem("native_unavailable"));
    if (allow) { allow(); await tick(); }
    assert.deepEqual(f.events.filter(event => event.stage === "failure"), [{ stage: "failure", path: target, phase, reason: "owner_deadline" }]);
    assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, ["SIGKILL"]);
    assert.equal(f.events.some(event => event.stage === "select" || event.stage === "done"), false);
  });
}

test("finite readiness trace preserves ordering without authorizing a native command", async () => {
  const f = fixture(); const pending = f.start(); pending.catch(() => {});
  f.output("TRACE:assemblies\nOPEN\nTRACE:enumeration\n");
  assert.deepEqual(f.writes, []);
  f.output("READY\n"); await tick();
  f.output("SELECT\nDONE\n"); f.close(); await pending;
  assert.deepEqual(f.writes, ["GO\n"]);
  const trace = f.events.filter(event => event.stage === "trace");
  assert.deepEqual(trace.map(event => event.phase), ["assemblies", "enumeration"]);
  for (const event of trace) assert.ok(Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0 && event.elapsedMs < 5000);
});


for (const phase of ["binding_returned", "item_returned"]) test(`a ${phase} trace retains the owned deadline and never grants a permit`, async (t) => {
  let deadline;
  const original = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, milliseconds, ...args) => {
    if (milliseconds === 12000) { deadline = callback; return {}; }
    return original(callback, milliseconds, ...args);
  });
  const f = fixture({ timeoutMs: 12000 });
  const pending = f.start(); pending.catch(() => {});
  f.output(`OPEN\nTRACE:${phase}\n`);
  assert.deepEqual(f.events.filter(event => event.stage === "trace").map(event => event.phase), [phase]);
  assert.deepEqual(f.writes, []);
  deadline();
  await assert.rejects(pending, problem("native_unavailable"));
  assert.deepEqual(f.events.filter(event => event.stage === "failure"), [{ stage: "failure", path: target, phase: "opened", reason: "owner_deadline" }]);
  assert.deepEqual(f.calls, ["SIGKILL"]);
  assert.equal(f.events.some(event => event.stage === "select" || event.stage === "done"), false);
});

for (const output of ['TRACE:private path\n', 'TRACE:uia_tabs:extra\n', 'TRACE:uia_tabs\nTRACE:uia_tabs\n', 'OPEN\nREADY\nTRACE:assemblies\n']) {
  test(`invalid or late trace stays a failed protocol: ${JSON.stringify(output)}`, async () => {
    const f = fixture(); const pending = f.start(); f.output(output);
    await assert.rejects(pending, problem('native_error'));
    assert.equal(f.events.some(event => event.stage === 'select' || event.stage === 'done'), false);
    assert.deepEqual(f.calls, ['SIGKILL']);
    assert.equal(JSON.stringify(f.events).includes('private path'), false);
  });
}

async function withDeferredCheckpoint(enabled, run) {
  const previous = process.env.WORKSPACE_REVEAL_DEFERRED_TRACE;
  process.env.WORKSPACE_REVEAL_DEFERRED_TRACE = enabled ? "1" : "0";
  try { await run(); }
  finally { if (previous === undefined) delete process.env.WORKSPACE_REVEAL_DEFERRED_TRACE; else process.env.WORKSPACE_REVEAL_DEFERRED_TRACE = previous; }
}

test("one enabled deferred checkpoint retains ordering without authorizing GO", async () => withDeferredCheckpoint(true, async () => {
  const f = fixture(); const pending = f.start();
  f.output("OPEN\nCHECKPOINT:call_window_item:active:7:9001\n");
  assert.deepEqual(f.writes, []);
  const event = f.events.find(event => event.stage === "checkpoint");
  assert.deepEqual({ ...event, elapsedMs: 0 }, { stage: "checkpoint", path: target, phase: "call_window_item", reason: "active", sequence: 7, helperElapsedMs: 9001, elapsedMs: 0 });
  f.output("READY\n"); await tick(); f.output("SELECT\nDONE\n"); f.close(); await pending;
  assert.deepEqual(f.writes, ["GO\n"]);
}));

test("deferred checkpoint leaves the owner deadline and failed intent intact", async t => withDeferredCheckpoint(true, async () => {
  let deadline; const original = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, milliseconds, ...args) => {
    if (milliseconds === 12000) { deadline = callback; return {}; }
    return original(callback, milliseconds, ...args);
  });
  const f = fixture({ timeoutMs: 12000 }), pending = f.start(); pending.catch(() => {});
  f.output("OPEN\nCHECKPOINT:other_read:complete:9:9000\n"); deadline();
  await assert.rejects(pending, problem("native_unavailable"));
  assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, ["SIGKILL"]);
  assert.deepEqual(f.events.find(event => event.stage === "failure"), { stage: "failure", path: target, phase: "opened", reason: "owner_deadline" });
}));

for (const [enabled, output] of [[false, "CHECKPOINT:none:complete:0:9000\n"],
  [true, "CHECKPOINT:private_path:active:1:9000\n"], [true, "CHECKPOINT:read_count:complete:0:9000\n"],
  [true, "CHECKPOINT:none:active:0:9000\n"], [true, "CHECKPOINT:read_count:active:100001:9000\n"],
  [true, "CHECKPOINT:read_count:active:1:12001\n"], [true, "CHECKPOINT:read_count:active:1:9000:extra\n"],
  [true, "CHECKPOINT:read_count:active:1:9000\nCHECKPOINT:read_count:active:1:9000\n"], [true, "TRACE:assemblies\n"]])
  test(`unrequested/malformed/duplicate checkpoint cannot advance protocol: ${JSON.stringify(output)}`, async () => withDeferredCheckpoint(enabled, async () => {
    const f = fixture(), pending = f.start(); f.output(output);
    await assert.rejects(pending, problem("native_error")); assert.deepEqual(f.writes, []);
    assert.equal(f.events.some(event => event.stage === "select" || event.stage === "done"), false);
    assert.equal(JSON.stringify(f.events).includes("private_path"), false);
  }));

test("an already captured callback racing disposal may report after DONE without another command", async () => withDeferredCheckpoint(true, async () => {
  const f = fixture(), pending = f.start(); f.output("OPEN\nREADY\n"); await tick();
  f.output("SELECT\nDONE\nCHECKPOINT:call_select:complete:27:9000\n"); f.close(); await pending;
  assert.deepEqual(f.writes, ["GO\n"]); assert.equal(f.events.filter(event => event.stage === "checkpoint").length, 1);
  assert.equal(f.events.filter(event => event.stage === "done").length, 1);
}));
