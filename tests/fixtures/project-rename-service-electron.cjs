/* global __dirname, process, setTimeout, clearTimeout */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { startControlReceiver } = require("./project-rename-service-control.cjs");
const { pathToFileURL } = require("node:url");
const checks = ["rename", "mounted_case", "collision", "retention", "events", "reveal", "restart", "recovery"];
const SCENARIOS = ["direct", "grouped"].flatMap(mode => checks.map(check => `${mode}.${check}`));
module.exports = { SCENARIOS };

if (process.versions.electron) {
  const { app, utilityProcess, MessageChannelMain } = require("electron");
  const root = process.env.WORKSPACE_RENAME_SERVICE_ROOT;
  const fault = process.env.WORKSPACE_RENAME_SERVICE_FAULT;
  const scenarios = Object.fromEntries(SCENARIOS.map(key => [key, { status: "unreached" }]));
  const mountedCase = {};
  const send = (value, flushed) => process.stdout.write(JSON.stringify(value) + "\n", flushed);
  const own = new Set();
  let activeCheck, sql, controller, deadline, finishing = false, finalOK = false;
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
  async function stop() {
    if (controller) { await controller.stop(1500); controller = undefined; }
    // The controller's timeout alone is not termination evidence.
    await Promise.all([...own].map(child => new Promise(resolve => {
      const timer = setTimeout(() => { child.kill(); resolve(); }, 1000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
      child.kill();
    })));
    assert.equal(own.size, 0);
  }
  async function finish(ok) {
    if (finishing) return; finishing = true; clearTimeout(deadline);
    try { await stop(); } catch { ok = false; }
    sql?.close(); sql = undefined;
    finalOK = ok;
    // Exit at the control seam after workers stop, before publishing any result.
    if (fault === "premature-main-exit") { app.exit(7); return; }
    // Exclusive publication must fail on an occupied temporary record. The
    // supervisor still uses the bounded real publisher without mocked I/O.
    if (fault === "control-publication") fs.mkdirSync(join(root, "ack.control.pending"));
    control.resultPublished();
    send({ stage: "result", ok, scenarios, mountedCase,
      versions: { electron: process.versions.electron, node: process.versions.node } });
    // The receiver cannot read a directory as an exact exit command. Ack
    // publication remains valid; exit publication is never authorized.
    if (fault === "control-read") fs.mkdirSync(join(root, "exit.control"));
    // Receiver remains live until the supervisor observes this result, publishes
    // ack, observes ack_received and explicitly publishes exit.
  }

  const runCheck = async (mode, check, action) => {
    activeCheck = `${mode}.${check}`;
    try { await action(); scenarios[activeCheck] = { status: "passed" }; }
    catch (error) { scenarios[activeCheck] = { status: "failed" }; throw error; }
  };
  deadline = setTimeout(() => { void finish(false); }, 35000);
  app.whenReady().then(async () => {
    send({ stage: "main_ready" });
    if (fault === "malformed") process.stdout.write("private injected protocol error\n");
    const { BackendController } = await import(pathToFileURL(join(__dirname, "../../dist/desktop/backend-controller.mjs")));
    const Database = require("better-sqlite3");
    const native = require("../../dist/service/project-rename-filesystem.cjs");
    const databasePath = join(root, "workspace.sqlite");
    let expectedReveal, revealCount = 0;
    async function connect() {
      controller = new BackendController(undefined, async (target, current, authorize) => {
        assert.ok(current());
        const authorization = await authorize();
        assert.equal(authorization.outcome, "verified");
        assert.equal(join(target.canonicalRoot, target.relativePath), expectedReveal);
        identity(expectedReveal); revealCount++;
        // Only authorization is under test. No Finder/Explorer invocation.
        return { outcome: "dispatched" };
      });
      const child = utilityProcess.fork(join(__dirname, "../../dist/service/entry.cjs"), [],
        { stdio: "pipe", serviceName: "Project rename service checkpoint" });
      own.add(child);
      let pid;
      child.once("spawn", () => { pid = child.pid; send({ stage: "utility_started", pid }); });
      child.once("exit", code => { own.delete(child); send({ stage: "utility_exit", code, pid }); });
      child.stdout?.resume(); child.stderr?.resume();
      const { port1, port2 } = new MessageChannelMain();
      assert.equal(await controller.start(child, port1, databasePath, port2, 6000), true);
    }
    const request = async input => {
      const result = await controller.request(input, 6000);
      assert.equal(result.ok, true);
      return result.value;
    };
    await connect(); sql = new Database(databasePath);
    if (fault === "timeout") { send({ stage: "worker_started" }); return; } // Outer deadline kills only these owned processes.
    for (const mode of ["direct", "grouped"]) {
      const sourceRoot = join(root, mode); fs.mkdirSync(sourceRoot);
      const parent = mode === "grouped" ? join(sourceRoot, "Category") : sourceRoot;
      if (mode === "grouped") fs.mkdirSync(parent);
      for (const name of ["Original", "Other"]) {
        fs.mkdirSync(join(parent, name)); fs.writeFileSync(join(parent, name, "sentinel"), `  ${name}\nТекст  `);
      }
      const workspace = await request({ type: "workspace.create", name: "Primary", rootPath: sourceRoot });
      const sibling = await request({ type: "workspace.create", name: "Sibling", rootPath: sourceRoot });
      const unrelatedRoot = join(root, `${mode}-unrelated`); fs.mkdirSync(unrelatedRoot);
      const unrelated = await request({ type: "workspace.create", name: "Unrelated", rootPath: unrelatedRoot });
      const preview = await request({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode });
      const initial = await request({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken });
      const project = initial.projects.find(row => row.name === "Original"); assert.ok(project);
      const property = await request({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Notes", propertyType: "text" });
      await request({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId,
        projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст  " });
      const snapshot = () => Object.fromEntries(["text_property_values", "categories", "category_properties", "property_definitions", "views", "settings", "project_creation_operations"]
        .map(table => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
      const before = snapshot(), originalIdentity = identity(join(parent, "Original"));
      let events = [], unsubscribe = controller.onWorkspaceChange(event => events.push(event));
      const input = { type: "workspace.renameProject", workspaceId: workspace.workspaceId,
        projectId: project.projectId, operationId: randomUUID(), name: "Renamed 📝", expectedRevision: initial.revision };
      let renamed, caseResult, recoverRequest, unfinished;
      await runCheck(mode, "rename", async () => {
        if (fault === "failure") throw new Error("private injected failure");
        renamed = await request(input); assert.equal(renamed.outcome, "completed");
        assert.deepEqual(identity(join(parent, input.name)), originalIdentity);
        assert.ok(fs.readdirSync(parent).includes(input.name));
        assert.deepEqual(await request(input), renamed);
      });
      await runCheck(mode, "events", async () => {
        const changes = events.filter(event => event.type === "workspace.projectsChanged");
        assert.deepEqual(changes, [{ type: "workspace.projectsChanged", sourceId: workspace.sourceId,
          workspaceIds: [workspace.workspaceId, sibling.workspaceId], revision: renamed.project.revision }]);
        assert.equal(changes[0].workspaceIds.includes(unrelated.workspaceId), false);
        const list = await request({ type: "workspace.listProjects", workspaceId: sibling.workspaceId });
        assert.equal(list.revision, renamed.project.revision);
        assert.equal(list.projects.find(row => row.projectId === project.projectId).name, input.name);
      });
      await runCheck(mode, "mounted_case", async () => {
        const name = "renamed 📝";
        let aliases = false;
        try { aliases = JSON.stringify(identity(join(parent, name))) === JSON.stringify(originalIdentity); }
        catch (error) { assert.equal(error.code, "ENOENT"); }
        const operationId = randomUUID();
        caseResult = await request({ ...input, operationId, name, expectedRevision: renamed.project.revision });
        assert.equal(caseResult.outcome, "completed");
        assert.deepEqual(identity(join(parent, name)), originalIdentity);
        const names = fs.readdirSync(parent); assert.ok(names.includes(name)); assert.ok(!names.includes(input.name));
        const row = sql.prepare("SELECT staged_identity, native_identity FROM project_rename_operations WHERE operation_id = ?").get(operationId);
        assert.equal(row.staged_identity, aliases ? row.native_identity : null);
        assert.equal(names.some(value => value.startsWith(".workspace-rename-")), false);
        mountedCase[mode] = aliases ? "self_alias_staged" : "distinct_direct";
      });
      await runCheck(mode, "collision", async () => {
        const otherIdentity = identity(join(parent, "Other"));
        const result = await request({ ...input, operationId: randomUUID(), name: "Other", expectedRevision: caseResult.project.revision });
        assert.equal(result.outcome, "rejected");
        // Exercise the loaded Electron adapter against a destination inserted
        // after the fixture's absence observation, immediately before the call.
        const late = join(parent, "Late"); assert.equal(fs.existsSync(late), false);
        fs.mkdirSync(late); fs.writeFileSync(join(late, "guard"), "Keep");
        const lateIdentity = identity(late);
        assert.equal(native.renameNoReplace(join(parent, caseResult.project.name), late), "occupied");
        assert.deepEqual(identity(late), lateIdentity); assert.equal(fs.readFileSync(join(late, "guard"), "utf8"), "Keep");
        assert.deepEqual(identity(join(parent, "Other")), otherIdentity);
        assert.equal(fs.readFileSync(join(parent, "Other", "sentinel"), "utf8"), "  Other\nТекст  ");
        assert.deepEqual(identity(join(parent, caseResult.project.name)), originalIdentity);
        fs.rmSync(late, { recursive: true });
      });
      await runCheck(mode, "retention", async () => {
        assert.equal(caseResult.project.projectId, project.projectId);
        assert.equal(caseResult.project.categoryId, project.categoryId);
        assert.deepEqual(snapshot(), before);
        assert.equal(fs.readFileSync(join(parent, caseResult.project.name, "sentinel"), "utf8"), "  Original\nТекст  ");
      });
      await runCheck(mode, "reveal", async () => {
        expectedReveal = join(parent, caseResult.project.name); const count = revealCount;
        const result = await request({ type: "workspace.revealProject", workspaceId: sibling.workspaceId, projectId: project.projectId });
        assert.equal(result.outcome, "dispatched"); assert.equal(revealCount, count + 1);
      });
      await runCheck(mode, "restart", async () => {
        unsubscribe(); await stop(); await connect();
        assert.deepEqual(await request(input), renamed);
        const list = await request({ type: "workspace.listProjects", workspaceId: workspace.workspaceId });
        assert.equal(list.projects.find(row => row.projectId === project.projectId).name, caseResult.project.name);
        assert.deepEqual(snapshot(), before);
      });
      await runCheck(mode, "recovery", async () => {
        events = []; unsubscribe = controller.onWorkspaceChange(event => events.push(event));
        // A real SQLite completion failure interrupts metadata after the native
        // effect. The emitted entry and default service/native adapter are intact.
        sql.exec("CREATE TRIGGER fixture_interrupt BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = 'completed' BEGIN SELECT RAISE(ABORT, 'Fixture completion interruption'); END");
        recoverRequest = { ...input, operationId: randomUUID(), name: "Recovered", expectedRevision: caseResult.project.revision };
        unfinished = await request(recoverRequest); assert.equal(unfinished.outcome, "recoverable");
        assert.deepEqual(identity(join(parent, recoverRequest.name)), originalIdentity);
        assert.equal(events.filter(event => event.type === "workspace.projectsChanged").length, 0);
        const journal = () => sql.prepare("SELECT * FROM project_rename_operations WHERE operation_id = ?").get(recoverRequest.operationId);
        const saved = journal();
        unsubscribe(); await stop(); sql.exec("DROP TRIGGER fixture_interrupt"); await connect();
        events = []; unsubscribe = controller.onWorkspaceChange(event => events.push(event));
        assert.deepEqual(await request(recoverRequest), unfinished);
        assert.deepEqual(await request({ type: "workspace.getProjectRename", workspaceId: sibling.workspaceId, operationId: recoverRequest.operationId }), unfinished);
        const pending = await request({ type: "workspace.listProjectRenames", workspaceId: sibling.workspaceId });
        assert.ok(pending.operations.some(row => row.operationId === recoverRequest.operationId));
        assert.deepEqual(journal(), saved);
        assert.equal(events.filter(event => event.type === "workspace.projectsChanged").length, 0);
        const review = await request({ type: "workspace.previewProjectRenameRecovery", workspaceId: sibling.workspaceId, operationId: recoverRequest.operationId });
        assert.deepEqual(review.actions, ["complete_destination"]);
        const recovered = await request({ type: "workspace.recoverProjectRename", workspaceId: sibling.workspaceId,
          operationId: recoverRequest.operationId, previewToken: review.previewToken, action: "complete_destination" });
        assert.equal(recovered.outcome, "completed"); assert.equal(recovered.project.revision, caseResult.project.revision + 1);
        assert.equal(recovered.project.projectId, project.projectId); assert.equal(recovered.project.categoryId, project.categoryId);
        assert.deepEqual(snapshot(), before); assert.deepEqual(identity(join(parent, recoverRequest.name)), originalIdentity);
        assert.deepEqual(events.filter(event => event.type === "workspace.projectsChanged"), [{ type: "workspace.projectsChanged",
          sourceId: workspace.sourceId, workspaceIds: [workspace.workspaceId, sibling.workspaceId], revision: recovered.project.revision }]);
        expectedReveal = join(parent, recoverRequest.name); const count = revealCount;
        assert.equal((await request({ type: "workspace.revealProject", workspaceId: sibling.workspaceId, projectId: project.projectId })).outcome, "dispatched");
        assert.equal(revealCount, count + 1);
        assert.deepEqual(await request(recoverRequest), recovered);
        assert.equal(fs.readFileSync(join(parent, recoverRequest.name, "sentinel"), "utf8"), "  Original\nТекст  ");
      });
      unsubscribe();
    }
    if (fault === "missing-assertion") scenarios[SCENARIOS[0]] = { status: "unreached" };
    if (fault === "skipped") scenarios[SCENARIOS[0]] = { status: "skipped" };
    await finish(true);
  }).catch(async () => {
    if (activeCheck && scenarios[activeCheck].status !== "failed") scenarios[activeCheck] = { status: "failed" };
    await finish(false);
  });
}
