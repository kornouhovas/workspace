import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

async function crash(f, checkpoint) {
  const marker = join(f.directory, "cleanup-marker");
  await new Promise((resolve, reject) => {
    const child = fork("tests/fixtures/project-creation-crash-worker.mjs", [f.databasePath, checkpoint, JSON.stringify(f.request), marker], {
      execArgv: [], env: { ...process.env, PATH: `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:${process.env.PATH}` },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    let reached = false, stderr = "";
    child.stderr.on("data", (data) => { stderr += data; });
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Crash checkpoint timed out: ${checkpoint}: ${stderr}`)); }, 10000);
    child.on("message", (message) => {
      if (message.checkpoint === checkpoint) { reached = true; child.kill("SIGKILL"); }
      else { child.kill("SIGKILL"); reject(new Error(JSON.stringify(message))); }
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (!reached || (process.platform !== "win32" && signal !== "SIGKILL")) reject(new Error(`Unexpected child exit ${code}/${signal}: ${stderr}`));
      else resolve();
    });
  });
  assert.equal(fs.existsSync(marker), false, "abrupt crash cannot execute cleanup");
}
async function fixture(mode, checkpoint, run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "creation-crash-")));
  const root = join(directory, "root"), otherRoot = join(directory, "other"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(root); fs.mkdirSync(otherRoot); fs.writeFileSync(join(otherRoot, "sentinel"), "unrelated");
  if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
  let service = openSettingsService(databasePath, "src/service/db/migrations");
  const sql = new Database(databasePath);
  const open = () => { service = openSettingsService(databasePath, "src/service/db/migrations"); return service; };
  try {
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Origin", rootPath: root }).value;
    const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode }).value;
    assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).ok, true);
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    const property = service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "  Notes  ", propertyType: "text" });
    assert.equal(property.ok, true);
    const source = sql.prepare("SELECT * FROM sources WHERE id = ?").get(workspace.sourceId);
    const request = { type: "workspace.createProject", workspaceId: workspace.workspaceId, operationId: randomUUID(), name: "Created",
      mode, expectedRevision: source.discovery_revision, ...(mode === "grouped" ? { categoryId: sql.prepare("SELECT id FROM categories WHERE source_id = ?").get(workspace.sourceId).id } : {}) };
    const destination = join(root, mode === "grouped" ? "Category/Created" : "Created");
    const views = sql.prepare("SELECT * FROM views ORDER BY id").all();
    service.close();
    const f = { directory, root, otherRoot, databasePath, request, destination, workspace, sibling, other, sql, open,
      row: () => sql.prepare("SELECT * FROM project_creation_operations WHERE operation_id = ?").get(request.operationId) };
    await crash(f, checkpoint);
    const crashed = f.row(); assert.ok(crashed); assert.equal(crashed.name, "Created");
    f.service = open();
    await run(f, crashed);
    const currentViews = sql.prepare("SELECT * FROM views ORDER BY id").all();
    const remaining = new Set(sql.prepare("SELECT id FROM workspaces").all().map((row) => row.id));
    assert.deepEqual(currentViews.filter((row) => views.some((old) => old.workspace_id === row.workspace_id)),
      views.filter((row) => remaining.has(row.workspace_id)));
    assert.equal(fs.readFileSync(join(otherRoot, "sentinel"), "utf8"), "unrelated");
    assert.deepEqual(fs.readdirSync(otherRoot), ["sentinel"]);
    assert.deepEqual(sql.prepare("SELECT * FROM text_property_values WHERE project_id = ?").all(crashed.project_id), []);
    if (fs.existsSync(destination) && !fs.lstatSync(destination).isSymbolicLink()) {
      assert.deepEqual(fs.readdirSync(destination), checkpoint === "after_mkdir" && fs.existsSync(join(destination, "third-party")) ? ["third-party"] : []);
    }
  } finally { service.close(); sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
const query = (f, type, workspaceId = f.workspace.workspaceId) => ({ type: `workspace.${type}`, workspaceId, operationId: f.request.operationId });
function recover(f, action, workspaceId = f.workspace.workspaceId) {
  const reviewed = f.service.handleQuery(query(f, "previewProjectCreationRecovery", workspaceId));
  assert.equal(reviewed.ok, true, JSON.stringify(reviewed));
  assert.ok(reviewed.value.actions.includes(action), JSON.stringify(reviewed));
  const result = f.service.handleCommand({ ...query(f, "recoverProjectCreation", workspaceId), previewToken: reviewed.value.previewToken, action });
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
}
for (const mode of ["direct", "grouped"]) {
  for (const checkpoint of ["after_intent", "after_mkdir", "after_evidence", "after_commit"]) {
    test(`${mode} abrupt process crash ${checkpoint} preserves one UUID and requires explicit recovery`, async () => {
      await fixture(mode, checkpoint, async (f, crashed) => {
        assert.equal(crashed.stage, checkpoint === "after_commit" ? "completed" : checkpoint === "after_evidence" ? "evidence_recorded" : "intent");
        assert.equal(fs.existsSync(f.destination), checkpoint !== "after_intent");
        const list = f.service.handleQuery({ type: "workspace.listProjectCreations", workspaceId: f.sibling.workspaceId });
        assert.equal(list.ok, true); assert.equal(list.value.operations.length, checkpoint === "after_commit" ? 0 : 1);
        assert.deepEqual(f.row(), crashed, "startup and status must not replay or mutate the journal");
        const retry = f.service.handleCommand(f.request);
        assert.equal(retry.value.outcome, checkpoint === "after_commit" ? "completed" : "recoverable");
        assert.equal(retry.value.operation.projectId, crashed.project_id);
        assert.equal(f.service.handleCommand({ ...f.request, name: "Changed" }).ok, false);
        assert.equal(f.service.handleQuery(query(f, "getProjectCreation", f.other.workspaceId)).ok, false);
        assert.equal(f.service.handleCommand({ ...f.request, workspaceId: f.sibling.workspaceId }).ok, false);
        if (checkpoint === "after_mkdir") fs.writeFileSync(join(f.destination, "third-party"), "authored");
        const events = [];
        f.service.workspaces.subscribe((event) => { if (event.type === "workspace.projectsChanged") events.push(event); });
        const completed = checkpoint === "after_commit" ? retry.value : recover(f,
          checkpoint === "after_intent" ? "retry_missing" : checkpoint === "after_evidence" ? "complete_recorded" : "associate_reviewed", f.sibling.workspaceId);
        assert.equal(completed.outcome, "completed"); assert.equal(completed.project.projectId, crashed.project_id);
        assert.equal(completed.project.revision, f.request.expectedRevision + 1);
        if (checkpoint !== "after_commit") {
          assert.equal(events.length, 1); assert.deepEqual(new Set(events[0].workspaceIds), new Set([f.workspace.workspaceId, f.sibling.workspaceId]));
        }
        assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects WHERE source_id = ?").get(f.workspace.sourceId).n, 1);
        assert.deepEqual(f.service.handleCommand(f.request).value, completed);
        for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
          assert.equal(f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }).value.projects[0].projectId, crashed.project_id);
          assert.equal(f.service.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId }).ok, true);
        }
        assert.equal(f.row().completed_revision, f.request.expectedRevision + 1);
      });
    });
  }
  test(`${mode} recorded crash destination replacement, link and missing outcomes never acquire new evidence`, async () => {
    for (const replacement of ["directory", "link", "missing"]) await fixture(mode, "after_evidence", (f, crashed) => {
      const moved = `${f.destination}-moved`; fs.renameSync(f.destination, moved);
      if (replacement === "directory") fs.mkdirSync(f.destination);
      if (replacement === "link") fs.symlinkSync(moved, f.destination, process.platform === "win32" ? "junction" : "dir");
      const reviewed = f.service.handleQuery(query(f, "previewProjectCreationRecovery")).value;
      assert.equal(reviewed.destinationState, replacement === "directory" ? "replaced" : replacement === "link" ? "link" : "missing");
      assert.deepEqual(reviewed.actions, []); assert.equal(reviewed.previewToken, null);
      assert.deepEqual(f.row(), crashed);
      const preview = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: f.workspace.workspaceId }).value;
      assert.equal(preview.projectEffects.added.length, 0, "path and moved native evidence are reserved");
      assert.equal(f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: preview.previewToken }).ok, true);
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects WHERE source_id = ?").get(f.workspace.sourceId).n, 0);
      assert.deepEqual(fs.readdirSync(moved), []);
    });
  });
  test(`${mode} crashed operation survives removal and is explicitly recoverable through a reused source`, async () => {
    await fixture(mode, "after_evidence", (f, crashed) => {
      for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId }).ok, true);
      const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
      assert.equal(reused.sourceId, f.workspace.sourceId);
      assert.equal(f.service.handleQuery({ type: "workspace.listProjectCreations", workspaceId: reused.workspaceId }).value.operations[0].projectId, crashed.project_id);
      assert.equal(recover(f, "complete_recorded", reused.workspaceId).project.projectId, crashed.project_id);
      assert.equal(f.row().initiating_workspace_id, f.workspace.workspaceId);
    });
  });
}

for (const mode of ["direct", "grouped"]) test(`${mode} runtime crash seed preserves existing Text/sentinels and emits a recoverable reserved identity`, async () => {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "creation-runtime-seed-")));
  const root = join(directory, "root"), otherRoot = join(directory, "other"), database = join(directory, "workspace.sqlite"), marker = join(directory, "cleanup");
  const parent = mode === "grouped" ? join(root, "Category") : root;
  fs.mkdirSync(join(parent, "Existing"), { recursive: true }); fs.mkdirSync(otherRoot);
  fs.writeFileSync(join(parent, "Existing", "sentinel"), "existing bytes");
  fs.writeFileSync(join(otherRoot, "sentinel"), "unrelated bytes");
  let child, service;
  try {
    const message = await new Promise((resolve, reject) => {
      child = fork("tests/fixtures/project-creation-crash-worker.mjs", [database, "after_evidence", JSON.stringify({ type: "workspace.createProject", operationId: randomUUID(), name: "Interrupted" }), marker, JSON.stringify({ mode, root, otherRoot })], {
        execArgv: [], env: { ...process.env, PATH: `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:${process.env.PATH}` }, stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      let result, stderr = "";
      child.stderr.on("data", (bytes) => { stderr += bytes; });
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Seed timed out: ${stderr}`)); }, 10000);
      child.on("message", (message) => { result = message; child.kill("SIGKILL"); });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("exit", () => { clearTimeout(timer); if (result?.checkpoint === "after_evidence") resolve(result); else reject(new Error(`Unexpected seed exit: ${stderr}`)); });
    });
    assert.equal(fs.existsSync(marker), false);
    service = openSettingsService(database, "src/service/db/migrations");
    const { workspace, sibling, other, properties } = message.setup;
    const list = service.handleQuery({ type: "workspace.listProjectCreations", workspaceId: sibling.workspaceId });
    assert.equal(list.ok, true); assert.equal(list.value.operations[0].projectId, message.operation.project_id);
    assert.equal(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }).value.projects.length, 1);
    assert.deepEqual(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId }).value, properties);
    assert.equal(properties.values[0].value, "  Retained 日本語\n  ");
    assert.equal(service.handleQuery({ type: "workspace.listProjectCreations", workspaceId: other.workspaceId }).value.operations.length, 0);
    assert.deepEqual(fs.readdirSync(join(parent, "Interrupted")), []);
    assert.equal(fs.readFileSync(join(parent, "Existing", "sentinel"), "utf8"), "existing bytes");
    assert.equal(fs.readFileSync(join(otherRoot, "sentinel"), "utf8"), "unrelated bytes");
  } finally { service?.close(); if (child && child.exitCode === null && child.signalCode === null) { const ended = new Promise((done) => child.once("exit", done)); child.kill("SIGKILL"); await ended; } fs.rmSync(directory, { recursive: true, force: true }); }
});
