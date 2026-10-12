/* global __dirname, process, setTimeout, clearTimeout */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { startControlReceiver } = require("./project-rename-service-control.cjs");
const { pathToFileURL } = require("node:url");
const checks = ["move", "noop", "rejection", "collision", "occupied_insertion", "retention", "events", "restart",
  "complete_destination", "retry_original", "keep_original", "recovery_restart"];
const SCENARIOS = checks.map(check => `grouped.${check}`);
// Fixed fixture-only evidence vocabulary; never derive a code from thrown data.
const DIAGNOSTIC_SEAMS = ["setup", "scenario", "recovery_prepare", "unfinished_result", "destination_identity",
  "trigger_remove", "restart_journal", "external_return", "original_identity", "receipt_retry", "receipt_status",
  "pending_status", "pending_events", "pending_identity", "recovery_preview", "recovery_actions", "recovery_request",
  "recovery_result", "recovery_events", "recovery_project", "consumed_token", "retained_identity", "retained_state",
  "final_receipt", "restart_receipts", "restart_status", "stop", "connect", "final_stop", "final_cleanup"];
const DIAGNOSTIC_FAILURES = ["assertion_failed", "operation_failed", "lifecycle_failed", "deadline"];
// Fixture-only explicit action boundary, also exercised against the public
// service with controlled observer dependencies. It is not a service retry API.
async function performFixtureRecovery({ review, recover, request, readState }) {
  const assertReview = candidate => {
    assert.equal(candidate?.workspaceId, recover.workspaceId);
    assert.equal(candidate?.operation?.operationId, recover.operationId);
    assert.equal(typeof candidate.sourceId, "string"); assert.ok(candidate.sourceId.length > 0);
    assert.equal(candidate.operation.sourceId, candidate.sourceId);
    assert.equal(typeof candidate.previewToken, "string"); assert.ok(candidate.previewToken.length > 0);
    assert.ok(Array.isArray(candidate.actions) && candidate.actions.includes(recover.action));
    assert.equal(candidate.problem, null);
    assert.equal(candidate.originalState, recover.action === "complete_destination" ? "missing" : "matching");
    assert.equal(candidate.destinationState, recover.action === "complete_destination" ? "matching" : "missing");
  };
  assert.ok(["complete_destination", "retry_original", "keep_original"].includes(recover.action));
  assertReview(review); assert.equal(review.previewToken, recover.previewToken);
  const before = await readState();
  let submitted = recover, result = await request(submitted);
  if (result?.ok === false) {
    assert.equal(result.error?.code, "stale_preview");
    assert.deepEqual(await readState(), before);
    const fresh = await request({ type: "workspace.previewProjectCategoryMoveRecovery",
      workspaceId: recover.workspaceId, operationId: recover.operationId });
    assert.equal(fresh?.ok, true); assertReview(fresh.value);
    assert.notEqual(fresh.value.previewToken, review.previewToken);
    // The review may only change its token/action advertisement. The selected
    // action must still be present; all recovery evidence remains identical.
    const evidence = candidate => {
      const state = { ...candidate }; delete state.previewToken; delete state.actions;
      return state;
    };
    assert.deepEqual(evidence(fresh.value), evidence(review));
    assert.deepEqual(await readState(), before);
    submitted = { ...recover, previewToken: fresh.value.previewToken };
    result = await request(submitted); // One fresh explicit action; never loop.
  }
  assert.equal(result?.ok, true);
  assert.equal(result.value?.outcome, recover.action === "keep_original" ? "rejected" : "completed");
  if (recover.action === "keep_original") assert.equal(result.value.problem, "kept_original");
  assert.equal(result.value.operation?.operationId, recover.operationId);
  assert.equal(result.value.operation.sourceId, review.sourceId);
  return { recovered: result.value, recover: submitted };
}
module.exports = { SCENARIOS, DIAGNOSTIC_SEAMS, DIAGNOSTIC_FAILURES, performFixtureRecovery };

if (process.versions.electron) {
  const { app, utilityProcess, MessageChannelMain } = require("electron");
  const root = process.env.WORKSPACE_CATEGORY_MOVE_SERVICE_ROOT;
  const fault = process.env.WORKSPACE_CATEGORY_MOVE_SERVICE_FAULT;
  const diagnosticFaults = ["diagnostic-unknown-seam", "diagnostic-private-field", "diagnostic-unknown-scenario",
    "diagnostic-unknown-failure", "diagnostic-numeric", "diagnostic-null", "diagnostic-array", "diagnostic-missing",
    "diagnostic-lifecycle"];
  const scenarios = Object.fromEntries(SCENARIOS.map(key => [key, { status: "unreached" }]));
  const send = (value, flushed) => process.stdout.write(JSON.stringify(value) + "\n", flushed);
  const own = new Set();
  let activeCheck, activeSeam = "setup", diagnostic, sql, controller, deadline, finishing = false, finalOK = false;
  const seam = code => { activeSeam = code; };
  const fail = error => {
    diagnostic ??= { firstFailure: { scenario: activeCheck ?? "fixture", seam: activeSeam,
      failure: error instanceof assert.AssertionError ? "assertion_failed" : "operation_failed" } };
  };
  const lifecycle = async (code, action) => {
    const previous = activeSeam; seam(code);
    try { await action(); seam(previous); }
    catch (error) {
      const failure = { scenario: code.startsWith("final_") ? "fixture" : activeCheck ?? "fixture",
        seam: code, failure: "lifecycle_failed" };
      if (!diagnostic) diagnostic = { firstFailure: failure };
      else diagnostic.lifecycleFailure ??= failure;
      throw error;
    }
  };
  // Poll before main_ready; stdout remains the result/receiver-observation route.
  const control = startControlReceiver(root, {
    deadline: Date.now() + 45000,
    onAck: () => send({ stage: "ack_received" }),
    onExit: () => app.exit(finalOK ? 0 : 1),
    onError: () => {
      clearTimeout(deadline);
      send({ stage: "startup_failed", code: "fixture_control_failed" }, () => app.exit(1));
    },
    onTimeout: () => { clearTimeout(deadline); app.exit(1); },
  });
  app.once("will-quit", () => control.dispose());
  process.once("exit", () => control.dispose());
  const identity = path => {
    const stat = fs.lstatSync(path, { bigint: true });
    assert.equal(stat.isDirectory(), true); assert.equal(stat.isSymbolicLink(), false);
    assert.ok(stat.birthtimeNs > 0n);
    return [stat.dev, stat.ino, stat.birthtimeNs].map(String);
  };
  app.setPath("userData", join(root, "user-data"));
  async function stopWorkers() {
    if (controller) { await controller.stop(1500); controller = undefined; }
    // The controller's timeout alone is not termination evidence.
    await Promise.all([...own].map(child => new Promise(resolve => {
      const timer = setTimeout(() => { child.kill(); resolve(); }, 1000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
      child.kill();
    })));
    assert.equal(own.size, 0);
  }
  const stop = () => lifecycle("stop", stopWorkers);
  async function finish(ok) {
    if (finishing) return; finishing = true; clearTimeout(deadline);
    try { await lifecycle("final_stop", async () => {
      await stopWorkers();
      // Inject after real termination so this control never leaves a live worker.
      if (fault === "recovery-assertion-lifecycle-stop") throw new Error("private injected stop failure");
    }); } catch { ok = false; }
    try { await lifecycle("final_cleanup", () => { sql?.close(); sql = undefined; }); } catch { ok = false; }
    finalOK = ok;
    // Exit at the control seam after workers stop, before publishing any result.
    if (fault === "premature-main-exit") { app.exit(7); return; }
    // Exclusive publication must fail on an occupied temporary record. The
    // supervisor still uses the bounded real publisher without mocked I/O.
    if (fault === "control-publication") fs.mkdirSync(join(root, "ack.control.pending"));
    // Fixed malformed-evidence controls mutate only this disposable message.
    switch (fault) {
      case "diagnostic-unknown-seam": diagnostic.firstFailure.seam = "private injected unknown seam"; break;
      case "diagnostic-unknown-scenario": diagnostic.firstFailure.scenario = "private injected unknown scenario"; break;
      case "diagnostic-unknown-failure": diagnostic.firstFailure.failure = "private injected unknown failure"; break;
      case "diagnostic-private-field": diagnostic.firstFailure.actual = "private injected actual"; break;
      case "diagnostic-numeric": diagnostic.firstFailure.errno = Number.MAX_VALUE; break;
      case "diagnostic-null": diagnostic = null; break;
      case "diagnostic-array": diagnostic = []; break;
      case "diagnostic-missing": diagnostic = {}; break;
      case "diagnostic-lifecycle": diagnostic.lifecycleFailure = {
        scenario: "fixture", seam: "recovery_result", failure: "assertion_failed",
      }; break;
      case "diagnostic-success": diagnostic = { firstFailure: {
        scenario: "grouped.keep_original", seam: "recovery_result", failure: "assertion_failed",
      } }; break;
    }
    control.resultPublished();
    send({ stage: "result", ok, scenarios, ...(diagnostic !== undefined ? { diagnostic } : {}),
      versions: { electron: process.versions.electron, node: process.versions.node } });
    // The receiver cannot read a directory as an exact exit command. Ack
    // publication remains valid; exit publication is never authorized.
    if (fault === "control-read") fs.mkdirSync(join(root, "exit.control"));
    // Receiver remains live until the supervisor observes this result, publishes
    // ack, observes ack_received and explicitly publishes exit.
  }

  const runCheck = async (mode, check, action) => {
    activeCheck = `${mode}.${check}`; seam("scenario");
    try { await action(); scenarios[activeCheck] = { status: "passed" }; }
    catch (error) { fail(error); scenarios[activeCheck] = { status: "failed" }; throw error; }
  };
  deadline = setTimeout(() => {
    diagnostic ??= { firstFailure: { scenario: activeCheck ?? "fixture", seam: activeSeam, failure: "deadline" } };
    void finish(false);
  }, 35000);
  app.whenReady().then(async () => {
    send({ stage: "main_ready" });
    if (fault === "malformed") process.stdout.write("private injected protocol error\n");
    const { BackendController } = await import(pathToFileURL(join(__dirname, "../../dist/desktop/backend-controller.mjs")));
    const Database = require("better-sqlite3");
    const native = require("../../dist/service/project-rename-filesystem.cjs");
    const databasePath = join(root, "workspace.sqlite");
    async function connect() {
      await lifecycle("connect", async () => {
        controller = new BackendController();
        const child = utilityProcess.fork(join(__dirname, "../../dist/service/entry.cjs"), [],
          { stdio: "pipe", serviceName: "Project category move service checkpoint" });
        own.add(child);
        let pid;
        child.once("spawn", () => { pid = child.pid; send({ stage: "utility_started", pid }); });
        child.once("exit", code => { own.delete(child); send({ stage: "utility_exit", code, pid }); });
        child.stdout?.resume(); child.stderr?.resume();
        const { port1, port2 } = new MessageChannelMain();
        assert.equal(await controller.start(child, port1, databasePath, port2, 6000), true);
        if (fault === "lifecycle-connect") throw new Error("private injected connect failure");
      });
    }
    const request = async input => {
      const result = await controller.request(input, 6000);
      assert.equal(result.ok, true);
      return result.value;
    };
    await connect(); sql = new Database(databasePath);
    if (fault === "timeout") { send({ stage: "worker_started" }); return; } // Outer deadline kills only these owned processes.
    const mode = "grouped", name = "Original 📝", sentinel = "  Original bytes\nТекст  ";
    const sourceRoot = join(root, "grouped"), originalParent = join(sourceRoot, "Category"), destinationParent = join(sourceRoot, "Destination");
    fs.mkdirSync(sourceRoot); fs.mkdirSync(originalParent); fs.mkdirSync(destinationParent);
    const placement = category => join(category, name);
    fs.mkdirSync(placement(originalParent)); fs.writeFileSync(join(placement(originalParent), "sentinel"), sentinel);
    fs.mkdirSync(join(originalParent, "Other")); fs.writeFileSync(join(originalParent, "Other", "sentinel"), "Keep other");
    const workspace = await request({ type: "workspace.create", name: "Primary", rootPath: sourceRoot });
    const sibling = await request({ type: "workspace.create", name: "Sibling", rootPath: sourceRoot });
    const unrelatedRoot = join(root, "unrelated"); fs.mkdirSync(unrelatedRoot); fs.mkdirSync(join(unrelatedRoot, "Unrelated"));
    const unrelated = await request({ type: "workspace.create", name: "Unrelated", rootPath: unrelatedRoot });
    const preview = await request({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode });
    const initial = await request({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken });
    const project = initial.projects.find(row => row.name === name), destination = initial.categories.find(row => row.name === "Destination");
    assert.ok(project); assert.ok(destination);
    const property = await request({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Notes", propertyType: "text" });
    await request({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId,
      projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст  " });
    const query = (type, extra = {}) => request({ type, workspaceId: workspace.workspaceId, ...extra });
    const values = await query("workspace.listTextProperties"), settings = await request({ type: "settings.load" });
    assert.deepEqual(values.values, [{ projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст  " }]);
    const workspaces = await request({ type: "workspace.load" }), otherList = await query("workspace.listProjects", { workspaceId: unrelated.workspaceId });
    const originalIdentity = identity(placement(originalParent)), otherIdentity = identity(join(originalParent, "Other"));
    const moveInput = (categoryId, revision) => ({ type: "workspace.moveProjectCategory", workspaceId: workspace.workspaceId,
      projectId: project.projectId, operationId: randomUUID(), destinationCategoryId: categoryId, expectedRevision: revision });
    const input = moveInput(destination.categoryId, initial.revision);
    let events = [], unsubscribe = controller.onWorkspaceChange(event => events.push(event));
    const projectEvents = () => events.filter(event => event.type === "workspace.projectsChanged");
    const assertEvent = revision => assert.deepEqual(projectEvents(), [{ type: "workspace.projectsChanged", sourceId: workspace.sourceId,
      workspaceIds: [workspace.workspaceId, sibling.workspaceId], revision }]);
    const assertBytes = parent => {
      assert.deepEqual(identity(placement(parent)), originalIdentity);
      assert.equal(fs.readFileSync(join(placement(parent), "sentinel"), "utf8"), sentinel);
      assert.deepEqual(fs.readdirSync(placement(parent)), ["sentinel"]);
      assert.deepEqual(identity(join(originalParent, "Other")), otherIdentity);
      assert.equal(fs.readFileSync(join(originalParent, "Other", "sentinel"), "utf8"), "Keep other");
    };
    const assertRetained = async () => {
      assert.deepEqual(await query("workspace.listTextProperties"), values);
      assert.deepEqual(await query("workspace.listTextProperties", { workspaceId: sibling.workspaceId }), { ...values, workspaceId: sibling.workspaceId });
      assert.deepEqual(await request({ type: "settings.load" }), settings);
      assert.deepEqual(await request({ type: "workspace.load" }), workspaces);
      assert.deepEqual(await query("workspace.listProjects", { workspaceId: unrelated.workspaceId }), otherList);
    };
    let moved, noop, noopInput;
    await runCheck(mode, "move", async () => {
      if (fault === "failure") throw new Error("private injected failure");
      moved = await request(input); assert.equal(moved.outcome, "completed");
      assert.deepEqual(moved.project, { operationId: input.operationId, sourceId: workspace.sourceId, projectId: project.projectId,
        name, relativePath: `Destination/${name}`, categoryId: destination.categoryId, revision: initial.revision + 1 });
      assert.equal(fs.existsSync(placement(originalParent)), false); assertBytes(destinationParent);
      assert.deepEqual(await request(input), moved);
    });
    await runCheck(mode, "events", async () => {
      assertEvent(moved.project.revision);
      for (const workspaceId of [workspace.workspaceId, sibling.workspaceId]) {
        const list = await query("workspace.listProjects", { workspaceId });
        assert.equal(list.revision, moved.project.revision);
        assert.deepEqual(list.projects.find(row => row.projectId === project.projectId), { ...project,
          relativePath: `Destination/${name}`, categoryId: destination.categoryId, categoryName: "Destination" });
      }
    });
    await runCheck(mode, "noop", async () => {
      noopInput = moveInput(destination.categoryId, moved.project.revision); noop = await request(noopInput);
      assert.equal(noop.outcome, "unchanged"); assert.equal(noop.project.revision, moved.project.revision);
      assert.deepEqual(await request(noopInput), noop); assertBytes(destinationParent); assertEvent(moved.project.revision);
    });
    await runCheck(mode, "rejection", async () => {
      const rejected = await request(moveInput(randomUUID(), moved.project.revision));
      assert.equal(rejected.outcome, "rejected"); assert.equal(rejected.problem, "category_unavailable");
      assert.equal(rejected.operation, null); assertBytes(destinationParent); assertEvent(moved.project.revision);
    });
    await runCheck(mode, "collision", async () => {
      const target = placement(originalParent); fs.mkdirSync(target); fs.writeFileSync(join(target, "guard"), "Keep target");
      const occupiedIdentity = identity(target);
      const rejected = await request(moveInput(project.categoryId, moved.project.revision));
      assert.equal(rejected.outcome, "rejected"); assert.equal(rejected.problem, "occupied");
      assert.deepEqual(identity(target), occupiedIdentity); assert.equal(fs.readFileSync(join(target, "guard"), "utf8"), "Keep target");
      assertBytes(destinationParent); assertEvent(moved.project.revision); fs.rmSync(target, { recursive: true });
    });
    await runCheck(mode, "occupied_insertion", async () => {
      // Injected adapter-boundary control, separate from production service calls:
      // insert an empty target after observing absence, immediately before the
      // actual loaded Electron no-replace primitive. Never replace the service adapter.
      const target = placement(originalParent); assert.equal(fs.existsSync(target), false); fs.mkdirSync(target);
      const occupiedIdentity = identity(target);
      assert.equal(native.renameNoReplace(placement(destinationParent), target), "occupied");
      assert.deepEqual(identity(target), occupiedIdentity); assert.deepEqual(fs.readdirSync(target), []);
      assertBytes(destinationParent); fs.rmdirSync(target);
    });
    await runCheck(mode, "retention", async () => { await assertRetained(); assertBytes(destinationParent); });
    await runCheck(mode, "restart", async () => {
      unsubscribe(); await stop(); await connect();
      assert.deepEqual(await request(input), moved); assert.deepEqual(await request(noopInput), noop);
      assert.deepEqual(await query("workspace.getProjectCategoryMove", { workspaceId: sibling.workspaceId, operationId: input.operationId }), moved);
      assert.deepEqual((await query("workspace.listProjectCategoryMoves")).operations, []);
      assert.equal((await query("workspace.listProjects")).projects.find(row => row.projectId === project.projectId).categoryId, destination.categoryId);
      await assertRetained(); assertBytes(destinationParent);
    });
    let revision = moved.project.revision, currentParent = destinationParent, currentCategoryId = destination.categoryId;
    const recoveryReceipts = [];
    for (const action of ["complete_destination", "retry_original", "keep_original"]) {
      await runCheck(mode, action, async () => {
        seam("recovery_prepare");
        const nextParent = currentParent === destinationParent ? originalParent : destinationParent;
        const nextCategoryId = currentCategoryId === destination.categoryId ? project.categoryId : destination.categoryId;
        // Real SQLite transaction rejection after the native effect creates an
        // unfinished operation in the unmodified production utility service.
        sql.exec("CREATE TRIGGER fixture_interrupt BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'Fixture completion interruption'); END");
        const recoveryInput = moveInput(nextCategoryId, revision), unfinished = await request(recoveryInput);
        seam("unfinished_result"); assert.equal(unfinished.outcome, "recoverable");
        seam("destination_identity"); assertBytes(nextParent);
        seam("trigger_remove");
        sql.exec("DROP TRIGGER fixture_interrupt");
        if (action === "complete_destination") {
          seam("restart_journal");
          const saved = sql.prepare("SELECT * FROM project_category_move_operations WHERE operation_id = ?").get(recoveryInput.operationId);
          await stop(); await connect();
          seam("restart_journal");
          assert.deepEqual(sql.prepare("SELECT * FROM project_category_move_operations WHERE operation_id = ?").get(recoveryInput.operationId), saved);
        } else {
          // Injected external return of the same directory permits an original-
          // placement review. This does not establish an OS failure mechanism.
          seam("external_return"); assert.equal(native.renameNoReplace(placement(nextParent), placement(currentParent)), "renamed");
          seam("original_identity"); assertBytes(currentParent);
        }
        events = []; unsubscribe = controller.onWorkspaceChange(event => events.push(event));
        seam("receipt_retry"); assert.deepEqual(await request(recoveryInput), unfinished);
        seam("receipt_status");
        assert.deepEqual(await query("workspace.getProjectCategoryMove", { workspaceId: sibling.workspaceId, operationId: recoveryInput.operationId }), unfinished);
        seam("pending_status");
        const pending = await query("workspace.listProjectCategoryMoves", { workspaceId: sibling.workspaceId });
        assert.ok(pending.operations.some(row => row.operationId === recoveryInput.operationId));
        seam("pending_events"); assert.equal(projectEvents().length, 0);
        seam("pending_identity"); assertBytes(action === "complete_destination" ? nextParent : currentParent);
        seam("recovery_preview");
        const review = await query("workspace.previewProjectCategoryMoveRecovery", { workspaceId: sibling.workspaceId, operationId: recoveryInput.operationId });
        seam("recovery_actions"); assert.deepEqual(review.actions, action === "complete_destination" ? [action] : ["retry_original", "keep_original"]);
        let recover = { type: "workspace.recoverProjectCategoryMove", workspaceId: sibling.workspaceId,
          operationId: recoveryInput.operationId, previewToken: review.previewToken, action };
        const readState = async () => {
          assertBytes(action === "complete_destination" ? nextParent : currentParent);
          await assertRetained();
          return {
            receipt: await query("workspace.getProjectCategoryMove", { workspaceId: sibling.workspaceId, operationId: recoveryInput.operationId }),
            projects: await query("workspace.listProjects", { workspaceId: sibling.workspaceId }),
            tables: Object.fromEntries(["sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values",
              "views", "settings", "workspaces", "active_workspace", "project_category_move_operations", "project_rename_operations", "project_creation_operations"]
              .map(table => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()])),
            placements: [sourceRoot, originalParent, destinationParent, placement(originalParent), placement(destinationParent), join(originalParent, "Other")]
              .map(path => fs.existsSync(path) ? { identity: identity(path), entries: fs.readdirSync(path).sort() } : null),
            projectEventCount: projectEvents().length,
          };
        };
        seam("recovery_request");
        const performed = await performFixtureRecovery({ review, recover, readState, request: input => controller.request(input, 6000) });
        const recovered = performed.recovered; recover = performed.recover;
        seam("recovery_result");
        if (action === "keep_original" && ["recovery-assertion", "recovery-assertion-lifecycle-stop", "recovery-assertion-cleanup", "recovery-assertion-malformed-result",
          ...diagnosticFaults].includes(fault))
          assert.equal("private injected actual", "private injected expected");
        assert.equal(recovered.outcome, action === "keep_original" ? "rejected" : "completed");
        if (action === "keep_original") {
          assert.equal(recovered.problem, "kept_original"); seam("recovery_events"); assert.equal(projectEvents().length, 0);
        }
        else {
          revision++; currentParent = nextParent; currentCategoryId = nextCategoryId;
          seam("recovery_project"); assert.equal(recovered.project.categoryId, currentCategoryId); assert.equal(recovered.project.revision, revision);
          seam("recovery_events"); assertEvent(revision);
        }
        seam("consumed_token");
        const consumed = await controller.request(recover, 6000); assert.equal(consumed.ok, false); assert.equal(consumed.error.code, "stale_preview");
        seam("retained_identity"); assertBytes(currentParent);
        seam("retained_state"); await assertRetained();
        seam("final_receipt"); assert.deepEqual(await request(recoveryInput), recovered);
        recoveryReceipts.push([recoveryInput, recovered]); unsubscribe();
      });
    }
    await runCheck(mode, "recovery_restart", async () => {
      unsubscribe(); await stop(); await connect();
      seam("restart_receipts");
      // Reopen every final recovery receipt in a fresh production backend.
      assert.deepEqual(await request(input), moved); assert.deepEqual(await request(noopInput), noop);
      for (const [recoveryInput, receipt] of recoveryReceipts) assert.deepEqual(await request(recoveryInput), receipt);
      seam("restart_status"); const list = await query("workspace.listProjects", { workspaceId: sibling.workspaceId });
      assert.equal(list.revision, revision); assert.equal(list.projects.find(row => row.projectId === project.projectId).categoryId, currentCategoryId);
      assert.deepEqual((await query("workspace.listProjectCategoryMoves")).operations, []);
      seam("retained_state"); await assertRetained(); seam("retained_identity"); assertBytes(currentParent);
    });
    if (fault === "missing-assertion") scenarios[SCENARIOS[0]] = { status: "unreached" };
    if (fault === "skipped") scenarios[SCENARIOS[0]] = { status: "skipped" };
    if (["malformed-result", "recovery-assertion-malformed-result"].includes(fault)) scenarios[SCENARIOS[0]] = { status: "invalid" };
    await finish(true);
  }).catch(async error => {
    fail(error);
    if (activeCheck && scenarios[activeCheck].status !== "failed") scenarios[activeCheck] = { status: "failed" };
    await finish(false);
  });
}
