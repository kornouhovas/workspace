import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import { createRenameRuntimeStartup } from "../scripts/rename-runtime-startup.mjs";
import { cleanupOwnedFixture, closeRuntimeSession, ownedProcessesStopped } from "../scripts/runtime-lifecycle.mjs";

function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const window = gate(), interfaceReady = gate();
  const child = { exitCode: null, signalCode: null };
  const ownedProcesses = new Set(), backendPids = new Set(), outcomes = [];
  const state = { metrics: [], metricsCalls: 0, windowCalls: 0, interfaceCalls: 0 };
  const page = {
    setDefaultTimeout: timeout => assert.equal(timeout, 15000),
    async waitForFunction(callback, argument, options) {
      assert.equal(options.timeout, 15000);
      state.interfaceCalls++;
      await interfaceReady.promise;
      if (state.interfaceError) throw state.interfaceError;
      assert.ok(runInNewContext(`(${callback.toString()})()`, { document: { querySelector: () => ({}) } }));
      return { dispose: async () => {} };
    },
    evaluate: callback => runInNewContext(`(${callback.toString()})()`, { window: { workspace: { getBackendStatus: async () => state.status ?? ({ state: "ready" }) } } }),
    locator: selector => ({ waitFor: async () => assert.equal(selector, "#interface-language") }),
  };
  const electron = {
    process: () => child,
    async firstWindow(options) {
      assert.equal(options.timeout, 30000);
      assert.equal(ownedProcesses.has(child), true);
      state.windowCalls++;
      await window.promise;
      if (state.windowError) throw state.windowError;
      return page;
    },
    async evaluate(callback) {
      state.metricsCalls++;
      if (state.metricsError) throw state.metricsError;
      return Array.from(runInNewContext(`(${callback.toString()})({app})`, { app: { getAppMetrics: () => state.metrics } }));
    },
  };
  const options = { timeout: 30000 };
  const startup = createRenameRuntimeStartup({
    launchElectron: async received => { assert.equal(received, options); if (state.launchError) throw state.launchError; return state.electron ?? electron; },
    ownedProcesses, backendPids, recordStartup: async outcome => { outcomes.push(outcome); if (state.recordError) throw state.recordError; },
    probeBackendPid: pid => state.probe(pid),
  });
  return { startup, electron, child, page, state, window, interfaceReady, ownedProcesses, backendPids, outcomes, options };
}

test("rename launch waits for delayed window and interface before reading backend ownership", async () => {
  const f = fixture();
  // Capture rejection immediately: the historical ordering fails before either gate.
  const result = f.startup.launch(f.options).then(page => ({ page }), error => ({ error }));
  try {
    await nextTurn();
    assert.equal(f.ownedProcesses.has(f.child), true);
    assert.equal(f.startup.current.electron, f.electron);
    assert.equal(f.startup.launchUnverified, true);
    assert.equal(f.state.metricsCalls, 0, "zero-metrics launch must await existing readiness");
    f.window.resolve();
    await nextTurn();
    assert.equal(f.state.interfaceCalls, 1);
    assert.equal(f.state.metricsCalls, 0);
    assert.equal(f.startup.current.page, f.page);
    f.state.metrics = [
      { type: "Browser", pid: 123 }, { type: "Utility", serviceName: "Other", pid: 456 },
      { type: "Utility", serviceName: "Node Service", pid: 789 },
    ];
    f.interfaceReady.resolve();
    assert.deepEqual(await result, { page: f.page });
    assert.equal(f.state.metricsCalls, 1);
    assert.deepEqual([...f.backendPids], [789]);
    assert.equal(f.startup.launchUnverified, false);
    assert.deepEqual(f.outcomes, [{ state: "ready" }]);
  } finally {
    f.window.resolve(); f.interfaceReady.resolve();
    await result;
  }
});

for (const metrics of [[], [{ type: "Utility", serviceName: "Other", pid: 789 }],
  ...[0, -1, 1.5, "789", Number.MAX_SAFE_INTEGER + 1].map(pid => [{ type: "Utility", serviceName: "Node", pid }]),
  [{ type: "Utility", serviceName: "Node", pid: 789 }, { type: "Utility", serviceName: "Node", pid: 0 }]]) {
  test(`rename ready interface cannot establish backend ownership from ${JSON.stringify(metrics)}`, async () => {
    const f = fixture(); f.state.metrics = metrics;
    f.window.resolve(); f.interfaceReady.resolve();
    await assert.rejects(f.startup.launch(f.options), /nonempty valid PIDs/);
    assert.deepEqual(f.outcomes, [{ state: "ready" }]);
    assert.equal(f.state.metricsCalls, 1);
    assert.equal(f.startup.launchUnverified, true);
    assert.deepEqual([...f.backendPids], []);
    assert.equal(f.ownedProcesses.has(f.child), true);
    f.child.exitCode = 0;
    assert.equal(ownedProcessesStopped(f.ownedProcesses, f.backendPids, { launchUnverified: f.startup.launchUnverified }), false);
  });
}

for (const step of ["launch", "window", "interface", "record", "metrics"]) {
  test(`rename ${step} failure preserves owned session and uncertainty for cleanup`, async () => {
    const f = fixture(), primary = new Error(`${step} failed`);
    f.state[`${step}Error`] = primary;
    f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
    f.window.resolve(); f.interfaceReady.resolve();
    await assert.rejects(f.startup.launch(f.options), error => error === primary);
    assert.equal(f.startup.launchUnverified, true);
    assert.equal(f.ownedProcesses.has(f.child), step !== "launch");
    assert.equal(f.startup.current?.electron, step === "launch" ? undefined : f.electron);
    assert.deepEqual([...f.backendPids], []);
    assert.equal(f.state.metricsCalls, step === "metrics" ? 1 : 0);
  });
}

test("rename terminal backend readiness failure is recorded without reading metrics", async () => {
  const f = fixture();
  f.state.status = { state: "unavailable", diagnostic: { stage: "service_open", code: "SQLITE_BUSY" }, message: "private details" };
  f.window.resolve(); f.interfaceReady.resolve();
  await assert.rejects(f.startup.launch(f.options), /startup failed/);
  assert.deepEqual(f.outcomes, [{ state: "unavailable", diagnostic: { stage: "service_open", code: "SQLITE_BUSY" } }]);
  assert.equal(f.state.metricsCalls, 0);
  assert.equal(f.startup.launchUnverified, true);
});

test("a later successful launch cannot clear another launch's unresolved ownership", async () => {
  const f = fixture(); f.window.resolve(); f.interfaceReady.resolve();
  await assert.rejects(f.startup.launch(f.options), /nonempty valid PIDs/);
  const secondChild = { exitCode: null, signalCode: null };
  f.state.electron = { ...f.electron, process: () => secondChild };
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
  assert.equal(await f.startup.launch(f.options), f.page);
  assert.equal(f.ownedProcesses.has(secondChild), true);
  assert.equal(f.startup.launchUnverified, true);
  await f.startup.readBackendPids(f.electron);
  assert.equal(f.startup.launchUnverified, false);
});

test("shutdown metrics failure closes the registered parent and cannot promote fixture cleanup or replace startup failure", async () => {
  const f = fixture(); f.window.resolve(); f.interfaceReady.resolve();
  let primary;
  try { await f.startup.launch(f.options); } catch (error) { primary = error; }
  assert.match(primary.message, /nonempty valid PIDs/);
  const closing = f.startup.current; f.startup.clearCurrent();
  const shutdown = { passed: false }; let closed = 0, removed = 0, cleanup;
  await assert.rejects(closeRuntimeSession(closing.electron, {
    shutdown, readBackendPids: f.startup.readBackendPids, beforeClose: async () => {},
    assertBackendsStopped: async pids => assert.deepEqual(pids, []),
  }, async electron => { assert.equal(electron, f.electron); closed++; f.child.exitCode = 0; }), /nonempty valid PIDs/);
  assert.equal(closed, 1); assert.equal(shutdown.passed, false);
  assert.match(shutdown.ownershipError, /nonempty valid PIDs/);
  await assert.rejects(cleanupOwnedFixture("owned-fixture", {
    processesStopped: ownedProcessesStopped(f.ownedProcesses, f.backendPids, { launchUnverified: f.startup.launchUnverified }),
    primaryFailure: primary, record: async outcome => { cleanup = outcome; },
  }, async () => { removed++; }), error => error === primary);
  assert.equal(removed, 0); assert.equal(cleanup.status, "skipped");
});

test("positive ownership during failure cleanup permits removal while preserving the primary readiness failure", async () => {
  const f = fixture(), primary = new Error("window failed");
  f.state.windowError = primary; f.window.resolve();
  await assert.rejects(f.startup.launch(f.options), error => error === primary);
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
  const shutdown = { passed: false };
  await closeRuntimeSession(f.startup.current.electron, {
    shutdown, readBackendPids: f.startup.readBackendPids, beforeClose: async () => {},
    assertBackendsStopped: async pids => assert.deepEqual(pids, [789]),
  }, async () => { f.child.exitCode = 0; });
  assert.equal(shutdown.passed, true); assert.equal(f.startup.launchUnverified, false);
  let removed = 0, cleanup;
  await assert.rejects(cleanupOwnedFixture("owned-fixture", {
    processesStopped: ownedProcessesStopped(f.ownedProcesses, f.backendPids, { probe: () => { throw Object.assign(new Error(), { code: "ESRCH" }); }, launchUnverified: f.startup.launchUnverified }),
    primaryFailure: primary, record: async outcome => { cleanup = outcome; },
  }, async () => { removed++; }), error => error === primary);
  assert.equal(removed, 1); assert.equal(cleanup.status, "passed");
});

test("successful startup still requires independent backend exit at normal shutdown", async () => {
  const f = fixture(); f.window.resolve(); f.interfaceReady.resolve();
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
  await f.startup.launch(f.options);
  const shutdown = { passed: false }, survivor = new Error("Backend survived normal quit");
  await assert.rejects(closeRuntimeSession(f.startup.current.electron, {
    shutdown, readBackendPids: f.startup.readBackendPids, beforeClose: async () => {},
    assertBackendsStopped: async pids => { assert.deepEqual(pids, [789]); throw survivor; },
  }, async () => { f.child.exitCode = 0; }), error => error === survivor);
  assert.equal(shutdown.passed, false);
  assert.equal(ownedProcessesStopped(f.ownedProcesses, f.backendPids, { probe: () => {}, launchUnverified: f.startup.launchUnverified }), false);
});

test("failed shutdown metrics retain earlier owned PIDs and uncertainty until a positive capture", async () => {
  const f = fixture(); f.window.resolve(); f.interfaceReady.resolve();
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
  await f.startup.launch(f.options);
  const failure = new Error("metrics unavailable"); f.state.metricsError = failure;
  await assert.rejects(f.startup.readBackendPids(f.electron), error => error === failure);
  assert.deepEqual([...f.backendPids], [789]);
  assert.equal(f.startup.launchUnverified, true);
  f.state.metricsError = undefined;
  await f.startup.readBackendPids(f.electron);
  assert.equal(f.startup.launchUnverified, false);
});

test("confirmed exit belongs to one owned launch occurrence despite later numeric PID reuse", async () => {
  const f = fixture(); f.window.resolve(); f.interfaceReady.resolve();
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
  await f.startup.launch(f.options); f.child.exitCode = 0;
  // The existing cumulative predicate mistakes a later unrelated process for
  // this already exited backend. Exit proof must attach to its owned launch.
  const absent = () => { throw Object.assign(new Error(), { code: "ESRCH" }); };
  assert.equal(ownedProcessesStopped(f.ownedProcesses, f.backendPids, { probe: absent }), true);
  assert.equal(ownedProcessesStopped(f.ownedProcesses, f.backendPids, { probe: () => {} }), false);
  f.state.probe = absent;
  const shutdown = { passed: false };
  await closeRuntimeSession(f.electron, { shutdown, readBackendPids: f.startup.readBackendPids,
    beforeClose: async () => {}, assertBackendsStopped: async pids => {
      for (const pid of pids) assert.equal(f.startup.confirmBackendExit(f.electron, pid), true);
    } }, async () => {
      f.child.exitCode = 0;
      f.electron.process = () => { throw new Error("Playwright no longer exposes a disposed application"); };
    });
  assert.equal(shutdown.passed, true);
  assert.deepEqual([...f.startup.pendingBackendPids], []);
  assert.deepEqual(f.startup.backendExitEvidence, { observedOccurrences: 1, confirmedExits: 1, pendingOccurrences: 0 });
  assert.equal(ownedProcessesStopped(f.ownedProcesses, f.startup.pendingBackendPids, { probe: () => {} }), true);

  const secondChild = { exitCode: null, signalCode: null };
  const second = { ...f.electron, process: () => secondChild }; f.state.electron = second;
  await f.startup.launch(f.options);
  assert.deepEqual([...f.startup.pendingBackendPids], [789], "A new owned occurrence cannot inherit the old exit proof");
  assert.throws(() => f.startup.confirmBackendExit(second, 789), /parent exit/);
  secondChild.exitCode = 0; f.state.probe = () => {};
  assert.equal(f.startup.confirmBackendExit(second, 789), false);
  assert.deepEqual(f.startup.backendExitEvidence, { observedOccurrences: 2, confirmedExits: 1, pendingOccurrences: 1 });
  const denied = Object.assign(new Error(), { code: "EPERM" }); f.state.probe = () => { throw denied; };
  assert.throws(() => f.startup.confirmBackendExit(second, 789), error => error === denied);
  assert.throws(() => f.startup.confirmBackendExit(second, 999), /owned backend/);
  f.state.probe = absent;
  assert.equal(f.startup.confirmBackendExit(second, 789), true);
  f.state.probe = () => { throw new Error("must not re-probe an exited occurrence"); };
  assert.equal(f.startup.confirmBackendExit(second, 789), true);
  assert.deepEqual(f.startup.backendExitEvidence, { observedOccurrences: 2, confirmedExits: 2, pendingOccurrences: 0 });
});

test("shutdown retains every backend observed in its owned launch, including one absent from later metrics", async () => {
  const f = fixture(); f.window.resolve(); f.interfaceReady.resolve();
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 789 }];
  await f.startup.launch(f.options);
  f.state.metrics = [{ type: "Utility", serviceName: "Node", pid: 790 }];
  assert.deepEqual(await f.startup.readBackendPids(f.electron), [789, 790]);
  assert.deepEqual([...f.startup.pendingBackendPids], [789, 790]);
  f.child.exitCode = 0;
  f.state.probe = pid => { if (pid === 789) throw Object.assign(new Error(), { code: "ESRCH" }); };
  assert.equal(f.startup.confirmBackendExit(f.electron, 789), true);
  assert.equal(f.startup.confirmBackendExit(f.electron, 790), false);
  assert.deepEqual([...f.startup.pendingBackendPids], [790]);
  assert.equal(ownedProcessesStopped(f.ownedProcesses, f.startup.pendingBackendPids, { probe: () => {} }), false);
  f.state.metricsError = new Error("metrics unavailable");
  await assert.rejects(f.startup.readBackendPids(f.electron), /metrics unavailable/);
  assert.equal(ownedProcessesStopped(f.ownedProcesses, f.startup.pendingBackendPids, {
    probe: () => { throw Object.assign(new Error(), { code: "ESRCH" }); }, launchUnverified: f.startup.launchUnverified,
  }), false, "Later absence cannot clear unresolved ownership evidence");
});
