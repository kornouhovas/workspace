import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import test from "node:test";
import { runResolverDiagnosisSeries, runResolverDiagnosisCli } from "../scripts/windows-resolver-diagnosis.mjs";

const privateValue = "private path 日本語 exception secret";
function seriesFixture(samples = [{}, {}, {}]) {
  const artifacts = new Map(), children = [], events = [], settlements = [];
  let calls = 0, active = 0, maximumActive = 0;
  const options = { platform: "win32", evidenceDirectory: "diagnostic-artifacts",
    filesystem: {
      mkdir: async (path, settings) => { assert.equal(path, "diagnostic-artifacts"); assert.deepEqual(settings, { recursive: true }); },
      writeFile: async (path, text, encoding) => {
        assert.equal(encoding, "utf8"); events.push("write"); artifacts.set(path, JSON.parse(text));
      },
    },
    runResolver: (program, args, settings) => {
      assert.equal(program, String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
      assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-File"]);
      assert.equal(args.length, 4); assert.ok(args[3].endsWith("windows-explorer-directory.ps1"));
      assert.deepEqual(settings, { timeout: 10000, maxBuffer: 1024, windowsHide: true, shell: false });
      const sample = samples[calls++]; assert.ok(sample, "at most three invocations"); events.push("resolver");
      active++; maximumActive = Math.max(maximumActive, active);
      const child = new EventEmitter(); child.killed = sample.killed ?? false; children.push(child);
      const pending = new Promise((resolve, reject) => {
        const settle = () => {
          if (sample.close !== false) child.emit("close", sample.exitCode ?? 0, sample.signal ?? null);
          active--;
          if (sample.error) reject(sample.error);
          else resolve(sample.output === undefined ? { stdout: "C:\\Windows\n", stderr: "", extra: privateValue } : sample.output);
        };
        settlements.push(settle);
        if (!sample.pending) queueMicrotask(settle);
      });
      pending.child = child; return pending;
    },
  };
  return { options, artifacts, children, events, settlements, get calls() { return calls; }, get maximumActive() { return maximumActive; },
    run: () => runResolverDiagnosisSeries(options) };
}

test("read-only series samples the actual resolver three times sequentially into separate finite artifacts", async () => {
  const f = seriesFixture(), result = await f.run();
  assert.equal(result.status, "passed"); assert.equal(f.calls, 3); assert.equal(f.maximumActive, 1);
  assert.equal(result.deadlineMs, 60000); assert.equal(result.samples.length, 3);
  for (let index = 1; index <= 3; index++) {
    const sample = f.artifacts.get(join("diagnostic-artifacts", `sample-${index}.json`));
    assert.equal(sample.index, index); assert.equal(sample.status, "passed");
    assert.equal(sample.observation.outcome, "resolved"); assert.equal(sample.observation.termination, "confirmed");
    assert.deepEqual(sample, result.samples[index - 1]);
  }
  const aggregate = f.artifacts.get(join("diagnostic-artifacts", "result.json"));
  assert.equal(aggregate.status, "unverified"); assert.equal(aggregate.persistence, "unverified");
  assert.equal(aggregate.acceptance, "requires_successful_cli_exit");
  assert.deepEqual(aggregate.samples, result.samples);
  assert.equal(result.persistence, "completed");
  assert.equal(JSON.stringify(result).includes(privateValue), false);
  assert.equal(JSON.stringify(result).includes("C:\\"), false);
});

test("a failed independent sample remains failed after later successful samples", async () => {
  const f = seriesFixture([{}, { error: { code: "EPERM", killed: true, stdout: privateValue,
    stderr: privateValue, message: privateValue, signal: "SIGTERM" }, exitCode: 1 }, {}]);
  const result = await f.run();
  assert.equal(result.status, "failed"); assert.equal(f.calls, 3);
  assert.deepEqual(result.samples.map((sample) => sample.status), ["passed", "failed", "passed"]);
  assert.equal(result.samples[1].observation.errorCode, "EPERM");
  assert.equal(result.samples[1].observation.termination, "confirmed");
  assert.equal(f.artifacts.get(join("diagnostic-artifacts", "result.json")).status, "failed");
  assert.equal(JSON.stringify(result).includes(privateValue), false);
});

test("unknown termination stops the series even after authorized output or a killed rejection", async () => {
  for (const sample of [{ close: false }, { close: false, killed: true, error: { code: "ETIMEDOUT" } }]) {
    const f = seriesFixture([sample]); const result = await f.run();
    assert.equal(result.status, "failed"); assert.equal(f.calls, 1);
    assert.deepEqual(result.samples.map((sample) => sample.status), ["failed", "unreached", "unreached"]);
    assert.equal(result.samples[0].observation.termination, "unknown");
    const persisted = JSON.stringify([...f.artifacts]);
    f.children[0].emit("close", 0, null);
    assert.equal(JSON.stringify([...f.artifacts]), persisted);
  }
});

test("malformed missing oversized and unknown output cannot pass the series", async () => {
  for (const output of [null, {}, { stdout: "C:\\Windows", stderr: "" }, { stdout: "x".repeat(1025), stderr: "" },
    { stdout: "C:\\Windows\n", stderr: privateValue }, { stdout: "C:\\Windows\n" }]) {
    const f = seriesFixture([{ output }, {}, {}]); const result = await f.run();
    assert.equal(result.status, "failed"); assert.equal(result.samples[0].status, "failed"); assert.equal(f.calls, 3);
    assert.equal(result.samples[2].status, "passed");
  }
});

function controlledClock() {
  const timers = new Map(); let now = 0;
  return { now: () => now,
    setTimeout: (fn, ms) => { const token = {}; timers.set(token, { fn, ms, at: now + ms }); return token; },
    clearTimeout: (token) => timers.delete(token),
    advance: (ms) => { now += ms; for (const [token, timer] of [...timers]) if (timer.at <= now) { timers.delete(token); timer.fn(); } },
    get pending() { return timers.size; } };
}
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

test("aggregate deadline retains a pending call as incomplete and never starts another child", async () => {
  const f = seriesFixture([{ pending: true }]), clock = controlledClock();
  f.options.clock = clock;
  const pending = f.run(); await flush(); assert.equal(f.calls, 1);
  clock.advance(45000); await flush();
  const result = await pending;
  assert.equal(result.status, "failed"); assert.equal(result.failure, "deadline_expired");
  assert.equal(result.elapsedMs, 45000); assert.equal(f.calls, 1); assert.equal(clock.pending, 0);
  assert.deepEqual(result.samples.map((sample) => sample.status), ["incomplete", "unreached", "unreached"]);
  assert.equal(result.samples[0].observation, null);
  assert.equal(f.artifacts.size, 4, "execution expiry retains separate incomplete/unreached artifacts");
  const snapshot = JSON.stringify(result), artifacts = JSON.stringify([...f.artifacts]);
  f.settlements[0](); await flush();
  assert.equal(JSON.stringify(result), snapshot); assert.equal(JSON.stringify([...f.artifacts]), artifacts);
  assert.equal(f.calls, 1);
});

test("a new sample requires the full existing ten-second budget", async () => {
  const f = seriesFixture(), clock = controlledClock(), run = f.options.runResolver;
  f.options.clock = clock;
  f.options.runResolver = (...args) => { const pending = run(...args); clock.advance(36000); return pending; };
  const result = await f.run();
  assert.equal(result.status, "failed"); assert.equal(result.failure, "deadline_expired"); assert.equal(f.calls, 1);
  assert.deepEqual(result.samples.map((sample) => sample.status), ["passed", "unreached", "unreached"]);
});

test("a resolver completing at the aggregate execution deadline stays incomplete", async () => {
  const f = seriesFixture(), clock = controlledClock(), run = f.options.runResolver;
  f.options.clock = clock;
  f.options.runResolver = (...args) => { const pending = run(...args); clock.advance(45000); return pending; };
  const result = await f.run();
  assert.equal(result.status, "failed"); assert.equal(result.samples[0].status, "incomplete");
  assert.equal(result.samples[0].observation, null); assert.equal(f.calls, 1);
});

test("unsupported hosts write unreached records without invoking any resolver", async () => {
  const f = seriesFixture(); f.options.platform = "darwin";
  const result = await f.run(); assert.equal(f.calls, 0); assert.equal(result.status, "failed");
  assert.equal(result.failure, "unsupported_host");
  assert.deepEqual(result.samples.map((sample) => sample.status), ["unreached", "unreached", "unreached"]);
  assert.equal(f.artifacts.size, 4);
});

test("every diagnostic artifact persistence failure fails the series", async () => {
  for (const failedFile of ["mkdir", "sample-1.json", "sample-2.json", "sample-3.json", "result.json"]) {
    const f = seriesFixture(), write = f.options.filesystem.writeFile;
    if (failedFile === "mkdir") f.options.filesystem.mkdir = async () => { throw new Error(privateValue); };
    else f.options.filesystem.writeFile = async (path, ...args) => {
      if (path.endsWith(failedFile)) throw new Error(privateValue);
      return write(path, ...args);
    };
    const result = await f.run();
    assert.equal(result.status, "failed"); assert.equal(result.persistence, "failed");
    assert.equal(result.failure, "persistence_failed");
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  }
});

test("hung persistence uses the remaining aggregate budget and cannot pass", async () => {
  const f = seriesFixture(), clock = controlledClock(); f.options.clock = clock;
  f.options.filesystem.writeFile = () => new Promise(() => {});
  const pending = f.run(); await flush(); assert.equal(f.calls, 3);
  clock.advance(60000); await flush(); const result = await pending;
  assert.equal(result.status, "failed"); assert.equal(result.persistence, "failed");
  assert.equal(clock.pending, 0); assert.equal(f.artifacts.size, 0);
});

test("late final persistence cannot publish a passing aggregate or rescue CLI failure", async () => {
  const f = seriesFixture(), clock = controlledClock(), write = f.options.filesystem.writeFile;
  f.options.clock = clock;
  f.options.filesystem.writeFile = async (path, ...args) => {
    await write(path, ...args);
    if (path.endsWith("result.json")) clock.advance(60001);
  };
  let result;
  const code = await runResolverDiagnosisCli({ args: [], stdout: { write: () => {} }, stderr: { write: () => {} },
    series: async () => { result = await f.run(); return result; } });
  assert.equal(code, 1); assert.equal(result.status, "failed"); assert.equal(result.persistence, "failed");
  const aggregate = f.artifacts.get(join("diagnostic-artifacts", "result.json"));
  assert.equal(aggregate.status, "unverified"); assert.equal(aggregate.persistence, "unverified");
  assert.equal(aggregate.acceptance, "requires_successful_cli_exit");
  assert.deepEqual(aggregate.samples.map((sample) => sample.status), ["passed", "passed", "passed"]);
  assert.equal(clock.pending, 0);
});

test("CLI rejects all overrides and prints only fixed success or failure messages", async () => {
  let calls = 0, out = "", err = "";
  const options = { stdout: { write: (value) => { out += value; } }, stderr: { write: (value) => { err += value; } },
    series: async () => { calls++; return { status: "failed", extra: privateValue }; } };
  for (const args of [["--samples=1"], ["--executable=" + privateValue], ["--path=" + privateValue], ["--env=x"], [privateValue]]) {
    assert.equal(await runResolverDiagnosisCli({ ...options, args }), 1);
  }
  assert.equal(calls, 0);
  assert.equal(await runResolverDiagnosisCli({ ...options, args: [] }), 1); assert.equal(calls, 1);
  assert.equal(await runResolverDiagnosisCli({ ...options, args: [], series: async () => { throw new Error(privateValue); } }), 1);
  assert.equal(await runResolverDiagnosisCli({ ...options, args: [], series: async () => ({ status: "passed" }) }), 0);
  assert.equal(out, "Windows resolver diagnosis passed.\n");
  assert.equal(err.includes(privateValue), false); assert.equal(err.includes("Error"), false);
});

test("CLI exits reflect the actual read-only resolver orchestration independently", async () => {
  let out = "", err = "";
  const io = { args: [], stdout: { write: (value) => { out += value; } }, stderr: { write: (value) => { err += value; } } };
  for (const [samples, code] of [[[{}, {}, {}], 0], [[{}, { exitCode: 5 }, {}], 1], [[{ close: false }], 1]]) {
    const f = seriesFixture(samples);
    assert.equal(await runResolverDiagnosisCli({ ...io, series: f.run }), code);
  }
  const f = seriesFixture(); f.options.platform = "linux";
  assert.equal(await runResolverDiagnosisCli({ ...io, series: f.run }), 1); assert.equal(f.calls, 0);
  assert.equal(out, "Windows resolver diagnosis passed.\n");
  assert.equal(err, "Windows resolver diagnosis failed.\n".repeat(3));
});

test("unknown killed state and unknown resolver elapsed evidence cannot pass a sample", async (t) => {
  const f = seriesFixture(), run = f.options.runResolver;
  f.options.runResolver = (...args) => { const pending = run(...args); delete pending.child.killed; return pending; };
  const result = await f.run();
  assert.equal(result.status, "failed"); assert.equal(result.samples[0].status, "failed");
  assert.equal(result.samples[0].observation.killed, null);
  const timed = seriesFixture(); timed.options.clock = controlledClock();
  t.mock.method(performance, "now", () => NaN);
  const unknownTime = await timed.run();
  assert.equal(unknownTime.status, "failed"); assert.equal(unknownTime.samples[0].observation.elapsedMs, null);
});
