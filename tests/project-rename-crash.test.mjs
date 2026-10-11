import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

async function terminateAt(f, checkpoint) {
  const marker = join(f.directory, "cleanup");
  const message = await new Promise((resolve, reject) => {
    const child = fork("tests/fixtures/project-rename-crash-worker.mjs", [f.databasePath, checkpoint, JSON.stringify(f.request), marker],
      { execArgv: [], stdio: ["ignore", "ignore", "pipe", "ipc"] });
    let reached, stderr = "", failure;
    child.stderr.on("data", (data) => { stderr += data; });
    const timer = setTimeout(() => { failure = new Error(`Checkpoint timeout ${checkpoint}: ${stderr}`); child.kill("SIGKILL"); }, 10000);
    child.on("message", (message) => {
      if (message.checkpoint === checkpoint) reached = message;
      else failure = new Error(`Unexpected crash worker response: ${JSON.stringify(message)}`);
      child.kill("SIGKILL");
    });
    child.on("error", (error) => { failure = error; child.kill("SIGKILL"); });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (!reached || process.platform !== "win32" && signal !== "SIGKILL") reject(new Error(`Unexpected exit ${code}/${signal}: ${stderr}`));
      else resolve(reached);
    });
  });
  assert.equal(fs.existsSync(marker), false, "parent termination prevents cleanup");
  return message;
}
async function fixture(mode, checkpoint, run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "rename-crash-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  const relative = (name) => mode === "direct" ? name : `Category/${name}`;
  fs.mkdirSync(join(root, relative("Original")), { recursive: true });
  fs.writeFileSync(join(root, relative("Original"), "sentinel"), "  Authored 日本語\n");
  const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
  let service;
  const open = () => service = openSettingsService(databasePath, undefined, undefined, dependencies);
  const sql = new Database(databasePath);
  try {
    open();
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Origin", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode }).value;
    const applied = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).value;
    const project = applied.projects[0];
    const property = service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Notes", propertyType: "text" }).value;
    assert.equal(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст  " }).ok, true);
    const otherRoot = join(directory, "other"); fs.mkdirSync(otherRoot);
    const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    const request = { type: "workspace.renameProject", workspaceId: workspace.workspaceId, projectId: project.projectId, operationId: randomUUID(), name: "original", expectedRevision: applied.revision };
    const values = sql.prepare("SELECT * FROM text_property_values").all();
    const f = { directory, root, databasePath, relative, sql, workspace, sibling, other, project, request,
      get service() { return service; }, open, row: () => sql.prepare("SELECT * FROM project_rename_operations WHERE operation_id = ?").get(request.operationId) };
    service.close();
    const reached = await terminateAt(f, checkpoint);
    assert.deepEqual(reached.operation, f.row());
    open();
    await run(f, reached);
    assert.deepEqual(sql.prepare("SELECT * FROM text_property_values").all(), values);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM projects WHERE source_id = ?").get(workspace.sourceId).n, 1);
    const current = sql.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId);
    assert.equal(current.category_id, project.categoryId);
    const row = f.row();
    const located = row.stage === "completed" ? row.requested_relative_path : row.last_verified_placement === "staged" ? row.staging_relative_path : row.original_relative_path;
    assert.equal(fs.readFileSync(join(root, located, "sentinel"), "utf8"), "  Authored 日本語\n");
    assert.deepEqual(fs.readdirSync(join(root, located)), ["sentinel"]);
    const stat = fs.lstatSync(join(root, located), { bigint: true });
    assert.deepEqual({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }, JSON.parse(row.native_identity));
    if (row.stage === "completed") assert.ok(fs.readdirSync(mode === "grouped" ? join(root, "Category") : root).includes("original"), "exact requested spelling");
  } finally { service?.close(); sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
function preview(f, workspaceId) {
  return f.service.previewProjectRenameRecovery({ type: "workspace.previewProjectRenameRecovery", workspaceId, operationId: f.request.operationId }).value;
}
function recover(f, action, workspaceId) {
  const reviewed = preview(f, workspaceId);
  assert.ok(reviewed.actions.includes(action), JSON.stringify(reviewed));
  return f.service.recoverProjectRename({ type: "workspace.recoverProjectRename", workspaceId, operationId: f.request.operationId, previewToken: reviewed.previewToken, action });
}
for (const mode of ["direct", "grouped"]) {
  for (const checkpoint of ["intent", "first_effect", "staged_evidence", "final_effect", "destination_evidence", "commit"]) {
    test(`${mode}: abrupt parent termination at ${checkpoint}, restart and explicit recovery`, async (t) => fixture(mode, checkpoint, (f, reached) => {
      t.diagnostic(`staging=${reached.actualSelfAlias ? "mounted_self_alias" : "alias_policy_seam"}`);
      const crashed = f.row();
      const stage = { intent: "intent", first_effect: "intent", staged_evidence: "staged", final_effect: "staged", destination_evidence: "destination_recorded", commit: "completed" }[checkpoint];
      assert.equal(crashed.stage, stage);
      const q = { workspaceId: f.sibling.workspaceId, operationId: f.request.operationId };
      const listed = f.service.listProjectRenames({ type: "workspace.listProjectRenames", workspaceId: q.workspaceId });
      assert.equal(listed.value.operations.length, checkpoint === "commit" ? 0 : 1);
      assert.equal(f.service.getProjectRename({ type: "workspace.getProjectRename", ...q }).value.operation.stage, stage);
      assert.equal(f.service.getProjectRename({ type: "workspace.getProjectRename", ...q, workspaceId: f.other.workspaceId }).ok, false);
      const retry = f.service.renameProject(f.request);
      assert.equal(retry.value.outcome, checkpoint === "commit" ? "completed" : "recoverable");
      assert.equal(f.service.renameProject({ ...f.request, name: "Altered" }).ok, false);
      assert.equal(f.service.renameProject({ ...f.request, workspaceId: f.sibling.workspaceId }).ok, false);
      assert.deepEqual(f.row(), crashed, "restart, queries and retries never replay");
      const events = []; f.service.workspaces.subscribe((event) => { if (event.type === "workspace.projectsChanged") events.push(event); });
      const action = checkpoint === "intent" ? "retry_original" : ["first_effect", "staged_evidence"].includes(checkpoint) ? "finish_staged" : "complete_destination";
      const result = checkpoint === "commit" ? retry : recover(f, action, f.sibling.workspaceId);
      assert.equal(result.value.outcome, "completed", JSON.stringify(result));
      assert.equal(result.value.project.projectId, f.project.projectId);
      assert.equal(result.value.project.revision, f.request.expectedRevision + 1);
      assert.deepEqual(f.service.renameProject(f.request), result);
      assert.equal(events.length, checkpoint === "commit" ? 0 : 1);
      if (events.length) assert.deepEqual(new Set(events[0].workspaceIds), new Set([f.workspace.workspaceId, f.sibling.workspaceId]));
      assert.deepEqual(preview(f, f.sibling.workspaceId).actions, []);
      assert.equal(f.service.listProjectRenames({ type: "workspace.listProjectRenames", workspaceId: q.workspaceId }).value.operations.length, 0);
      for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
        assert.equal(f.service.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId }).ok, true);
        assert.equal(f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }).value.projects[0].projectId, f.project.projectId);
      }
      assert.equal(f.row().completed_revision, f.request.expectedRevision + 1);
    }));
  }
  test(`${mode}: interrupted rename survives initiating and final workspace removal, source reuse`, async () => fixture(mode, "destination_evidence", (f) => {
    const stale = preview(f, f.workspace.workspaceId);
    assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.workspace.workspaceId }).ok, true);
    assert.equal(f.service.recoverProjectRename({ type: "workspace.recoverProjectRename", workspaceId: stale.workspaceId, operationId: f.request.operationId, previewToken: stale.previewToken, action: "complete_destination" }).ok, false);
    assert.deepEqual(preview(f, f.sibling.workspaceId).actions, ["complete_destination"]);
    assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.sibling.workspaceId }).ok, true);
    const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
    assert.equal(reused.sourceId, f.workspace.sourceId);
    const result = recover(f, "complete_destination", reused.workspaceId);
    assert.equal(result.value.outcome, "completed");
    assert.equal(f.row().initiating_workspace_id, f.workspace.workspaceId);
  }));
}
