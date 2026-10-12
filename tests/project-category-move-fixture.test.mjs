import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile, writeFile, cp } from "node:fs/promises";
import { SCENARIOS, performFixtureRecovery } from "./fixtures/project-category-move-service-electron.cjs";
import { superviseCategoryMoveService, inputDigest } from "../scripts/smoke-project-category-move.mjs";



const controlEvidence = name => process.env.WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR
  ? join(process.env.WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR, name) : undefined;

const supported = ["darwin", "win32"].includes(process.platform);
const handshake = ["result", "ack_sent", "ack_received", "exit_sent", "main_exit"];
const privateValues = ["Original", "Category", "sentinel", "nativeIdentity", "birthtimeNs", "workspace.sqlite", "stack", "private injected",
  "workspace-category-move-service-", "ack.control", "exit.control", "WORKSPACE_CATEGORY_MOVE_SERVICE_ROOT", "EISDIR", "EEXIST", "Error:", "ack\\n", "exit\\n",
  "Invalid fixture command", "Duplicate fixture command", "Fixture control deadline", "Fixture publication deadline",
  '"actual":', '"expected":', '"message":', '"name":', '"sql":', '"pid":', '"token":', '"errno":'];

// Response-shape controls only. Actual stale-preview/no-effect evidence uses
// the public service and real sourceObserved delivery in coordination tests.
const fixtureReview = () => ({ workspaceId: "fixture-workspace", sourceId: "fixture-source",
  operation: { operationId: "fixture-operation", sourceId: "fixture-source" }, previewToken: "fixture-token",
  originalState: "matching", destinationState: "missing", problem: null, actions: ["retry_original", "keep_original"] });
const fixtureRecover = review => ({ type: "workspace.recoverProjectCategoryMove", workspaceId: review.workspaceId,
  operationId: review.operation.operationId, previewToken: review.previewToken, action: "keep_original" });

test("fixture ordinary recovery performs exactly the chosen action without fresh preview", async () => {
  const review = fixtureReview(), recover = fixtureRecover(review), requests = [];
  const receipt = { outcome: "rejected", problem: "kept_original", operation: review.operation };
  const result = await performFixtureRecovery({ review, recover, readState: () => ({ unchanged: true }), request: input => {
    requests.push(input); return { ok: true, value: receipt };
  } });
  assert.deepEqual(requests, [recover]); assert.deepEqual(result, { recovered: receipt, recover });
});

for (const [name, response] of [
  ["missing", undefined], ["null", null], ["empty", {}], ["missing error", { ok: false }],
  ["malformed ok", { ok: "true" }], ["missing result", { ok: true }], ["null result", { ok: true, value: null }],
  ["wrong outcome", { ok: true, value: { outcome: "recoverable" } }],
  ["missing operation", { ok: true, value: { outcome: "rejected", problem: "kept_original" } }],
]) test(`fixture response corruption ${name} fails without another request`, async () => {
  const review = fixtureReview(), requests = [];
  await assert.rejects(() => performFixtureRecovery({ review, recover: fixtureRecover(review),
    readState: () => ({ unchanged: true }), request: input => { requests.push(input); return response; } }), { name: "AssertionError" });
  assert.equal(requests.length, 1); assert.equal(requests[0].type, "workspace.recoverProjectCategoryMove");
});
function assertPrivate(result) {
  const encoded = JSON.stringify(result);
  for (const secret of privateValues) assert.equal(encoded.includes(secret), false, secret);
  if (result.diagnostic) {
    assert.ok(Buffer.byteLength(JSON.stringify(result.diagnostic)) <= 512);
    for (const record of Object.values(result.diagnostic))
      assert.deepEqual(Object.keys(record).sort(), ["failure", "scenario", "seam"]);
  }
}
async function checkpoint(fault) {
  const temporary = !controlEvidence(fault ?? "success");
  const directory = controlEvidence(fault ?? "success") ?? await mkdtemp(join(tmpdir(), "category-move-evidence-test-"));
  try {
    const result = await superviseCategoryMoveService({ fault, evidenceDirectory: directory });
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
function assertProtocol(result, malformed = false, invalidDiagnostic = false) {
  assert.equal(result.protocolError, malformed || invalidDiagnostic);
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
function assertUtilities(result, count = 4) {
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
function assertNormalHandshake(result, { exitCode = 0, malformed = false, cleanupFailed = false, invalidDiagnostic = false } = {}) {
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
  assertProtocol(result, malformed, invalidDiagnostic);
}

test("real Electron service checkpoint requires every scenario, handshake, shutdown and cleanup", { skip: !supported }, async () => {
  const result = await checkpoint();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(SCENARIOS.length, 12);
  assert.equal(result.scenarioKinds["grouped.occupied_insertion"], "injected_adapter_collision");
  assert.equal(result.scenarioKinds["grouped.complete_destination"], "injected_sqlite_recovery");
  for (const action of ["retry_original", "keep_original"])
    assert.equal(result.scenarioKinds[`grouped.${action}`], "injected_external_return_recovery");
  assertNormalHandshake(result);
  assertScenarios(result);
  assertUtilities(result);
  assert.equal(Object.hasOwn(result, "diagnostic"), false);
});

test("controlled recovery assertion retains its exact seam and unreached restart in the persisted checkpoint", { skip: !supported }, async () => {
  const result = await checkpoint("recovery-assertion");
  assert.deepEqual(result.diagnostic, { firstFailure: {
    scenario: "grouped.keep_original", seam: "recovery_result", failure: "assertion_failed",
  } });
  assert.equal(result.ok, false);
  assertNormalHandshake(result, { exitCode: 1 });
  assertScenarios(result, key => key === "grouped.keep_original" ? "failed"
    : key === "grouped.recovery_restart" ? "unreached" : "passed");
  assertUtilities(result, 3);
});

test("controlled lifecycle failure is distinct from a recovery assertion", { skip: !supported }, async () => {
  const result = await checkpoint("lifecycle-connect");
  assert.deepEqual(result.diagnostic, { firstFailure: {
    scenario: "fixture", seam: "connect", failure: "lifecycle_failed",
  } });
  assert.equal(result.ok, false);
  assertNormalHandshake(result, { exitCode: 1 });
  assertScenarios(result, () => "unreached");
  assertUtilities(result, 1);
});

test("a later stop failure cannot replace the first recovery assertion", { skip: !supported }, async () => {
  const result = await checkpoint("recovery-assertion-lifecycle-stop");
  assert.deepEqual(result.diagnostic, {
    firstFailure: { scenario: "grouped.keep_original", seam: "recovery_result", failure: "assertion_failed" },
    lifecycleFailure: { scenario: "fixture", seam: "final_stop", failure: "lifecycle_failed" },
  });
  assert.equal(result.ok, false);
  assertNormalHandshake(result, { exitCode: 1 });
  assertScenarios(result, key => key === "grouped.keep_original" ? "failed"
    : key === "grouped.recovery_restart" ? "unreached" : "passed");
  assertUtilities(result, 3);
});

test("a later fixture cleanup failure retains the recovery assertion and failed removal outcome", { skip: !supported }, async () => {
  const result = await checkpoint("recovery-assertion-cleanup");
  assert.deepEqual(result.diagnostic, {
    firstFailure: { scenario: "grouped.keep_original", seam: "recovery_result", failure: "assertion_failed" },
    lifecycleFailure: { scenario: "fixture", seam: "final_cleanup", failure: "lifecycle_failed" },
  });
  assert.equal(result.ok, false);
  assertNormalHandshake(result, { exitCode: 1, cleanupFailed: true });
  assertScenarios(result, key => key === "grouped.keep_original" ? "failed"
    : key === "grouped.recovery_restart" ? "unreached" : "passed");
  assertUtilities(result, 3);
});

test("an unknown diagnostic seam cannot be persisted or accepted", { skip: !supported }, async () => {
  const result = await checkpoint("diagnostic-unknown-seam");
  assert.equal(result.ok, false);
  assert.equal(Object.hasOwn(result, "diagnostic"), false);
  assertNormalHandshake(result, { exitCode: 1, invalidDiagnostic: true });
  assertScenarios(result, key => key === "grouped.keep_original" ? "failed"
    : key === "grouped.recovery_restart" ? "unreached" : "passed");
  assertUtilities(result, 3);
});

test("invalid diagnostic records fail closed and discard private or unbounded fields", { skip: !supported }, async () => {
  for (const fault of ["diagnostic-private-field", "diagnostic-unknown-scenario", "diagnostic-unknown-failure",
    "diagnostic-numeric", "diagnostic-null", "diagnostic-array", "diagnostic-missing", "diagnostic-lifecycle", "diagnostic-success"]) {
    const result = await checkpoint(fault);
    assert.equal(result.ok, false, fault);
    assert.equal(Object.hasOwn(result, "diagnostic"), false, fault);
    const successfulProcess = fault === "diagnostic-success";
    assertNormalHandshake(result, { exitCode: successfulProcess ? 0 : 1, invalidDiagnostic: true });
    assertScenarios(result, key => successfulProcess ? "passed" : key === "grouped.keep_original" ? "failed"
      : key === "grouped.recovery_restart" ? "unreached" : "passed");
    assertUtilities(result, successfulProcess ? 4 : 3);
  }
});

test("an earlier recovery failure never counts as reaching the malformed-result control", { skip: !supported }, async () => {
  const result = await checkpoint("recovery-assertion-malformed-result");
  assert.deepEqual(result.diagnostic, { firstFailure: {
    scenario: "grouped.keep_original", seam: "recovery_result", failure: "assertion_failed",
  } });
  assert.equal(result.ok, false);
  assertNormalHandshake(result, { exitCode: 1 });
  assertScenarios(result, key => key === "grouped.keep_original" ? "failed"
    : key === "grouped.recovery_restart" ? "unreached" : "passed");
  assertUtilities(result, 3);
});
for (const fault of ["failure", "malformed", "missing-assertion", "skipped", "cleanup"]) {
  test(`service ${fault} control proves its intended failure with a complete normal handshake`, { skip: !supported }, async () => {
    const result = await checkpoint(fault);
    assert.equal(result.ok, false, JSON.stringify(result));
    assertNormalHandshake(result, { exitCode: fault === "failure" ? 1 : 0, malformed: fault === "malformed", cleanupFailed: fault === "cleanup" });
    assertScenarios(result, key => fault === "failure" ? (key === "grouped.move" ? "failed" : "unreached")
      : key === "grouped.move" && fault === "missing-assertion" ? "unreached"
      : key === "grouped.move" && fault === "skipped" ? "skipped" : "passed");
    assertUtilities(result, fault === "failure" ? 1 : 4);

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
      assert.equal(result.utilityCount, 1);
      assert.equal(result.events.filter(stage => stage === "utility_started").length, 1);
      assert.ok(result.events.indexOf("utility_started") < result.events.indexOf("worker_started"));
      // Owned-worker termination codes/signals differ between platforms.
    } else { assertUtilities(result); }
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
      assertStages(result, ["main_exit"]);
      assert.equal(result.exitCode, 7);
      assert.equal(result.signaled, false);
      assert.equal(result.controlError ?? false, false);
      assert.equal(result.events.includes("startup_failed"), false);
      assert.equal(result.events.includes("control_publish_failed"), false);
    } else {
      assertScenarios(result);
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
  const directory = await mkdtemp(join(tmpdir(), "category-move-evidence-test-"));
  try {
    const file = join(directory, "occupied"); await writeFile(file, "Keep");
    const unavailable = await superviseCategoryMoveService({ evidenceDirectory: file });
    assert.equal(unavailable.evidenceWriteFailed, true);
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.cleanup, "removed");
    assert.equal(unavailable.shutdownConfirmed, true);
    assertStages(unavailable, handshake);
    assert.equal(unavailable.exitCode, 0);
    assertScenarios(unavailable);
    assertUtilities(unavailable);
    assert.equal(unavailable.signaled, false);
    assert.equal(unavailable.timedOut ?? false, false);
    assert.equal(unavailable.controlError ?? false, false);
    assertProtocol(unavailable);
    assertPrivate(unavailable);
    assert.equal(await readFile(file, "utf8"), "Keep");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("category move input digest covers reused executable controls and the fixture", async () => {
  const root = await mkdtemp(join(tmpdir(), "category-move-digest-"));
  try {
    const repository = fileURLToPath(new URL("../", import.meta.url));
    for (const relative of ["package-lock.json", "package.json", "src/service", "src/contracts", "native/project-rename/project_rename.c", "native/project-rename/binding.gyp",
      "src/desktop/backend-controller.ts", "dist/service", "dist/desktop/backend-controller.mjs",
      `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`,
      "scripts/smoke-project-category-move.mjs", "tests/fixtures/project-category-move-service-electron.cjs",
      "tests/fixtures/project-rename-native-protocol.cjs", "tests/fixtures/project-rename-service-control.cjs"]) {
      await cp(join(repository, relative), join(root, relative), { recursive: true });
    }
    const initial = await inputDigest(root);
    assert.equal(initial, await inputDigest());
    for (const relative of ["tests/fixtures/project-rename-service-control.cjs", "tests/fixtures/project-category-move-service-electron.cjs"]) {
      const path = join(root, relative), bytes = await readFile(path);
      await writeFile(path, Buffer.concat([bytes, Buffer.from("\n// Disposable digest control.\n")]));
      assert.notEqual(await inputDigest(root), initial);
      await writeFile(path, bytes);
      assert.equal(await inputDigest(root), initial);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a malformed scenario result fails despite a successful process and complete handshake", { skip: !supported }, async () => {
  const result = await checkpoint("malformed-result");
  assert.equal(result.ok, false);
  assertStages(result, handshake); assertOrderedOnce(result, handshake); assertCleanup(result);
  assert.equal(result.exitCode, 0); assert.equal(result.signaled, false); assert.equal(result.timedOut ?? false, false);
  assert.equal(result.protocolError, true); assert.equal(result.protocol.failed, false);
  assertScenarios(result, key => key === "grouped.move" ? "unreached" : "passed");
  assertUtilities(result);
});
