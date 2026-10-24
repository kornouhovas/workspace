import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { openUnconvertedEngineFixture } from "./support/unconverted-command-engines.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";

const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
async function terminateAt(f, checkpoint) {
  const marker = join(f.directory, "cleanup");
  const reached = await new Promise((resolve, reject) => {
    const child = fork("tests/fixtures/project-category-move-crash-worker.mjs",
      [f.databasePath, checkpoint, JSON.stringify(f.request), marker], { execArgv: ["--import","tsx"], stdio: ["ignore", "ignore", "pipe", "ipc"] });
    let acknowledged, stderr = "", failure;
    child.stderr.on("data", (data) => { stderr = (stderr + data).slice(-16000); });
    const timer = setTimeout(() => { failure = new Error(`Checkpoint timeout ${checkpoint}: ${stderr}`); child.kill("SIGKILL"); }, 10000);
    child.on("message", (message) => {
      if (!acknowledged && message?.checkpoint === checkpoint && message.operationId === f.request.operationId && typeof message.stage === "string") acknowledged = message;
      else failure = new Error(`Unexpected crash worker acknowledgement: ${JSON.stringify(message)}`);
      child.kill("SIGKILL");
    });
    child.on("error", (error) => { failure = error; child.kill("SIGKILL"); });
    // Wait for confirmed exit and closed streams before reopening or cleanup.
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (!acknowledged || process.platform !== "win32" && signal !== "SIGKILL") reject(new Error(`Unexpected exit ${code}/${signal}: ${stderr}`));
      else resolve(acknowledged);
    });
  });
  assert.equal(fs.existsSync(marker), false, "parent termination prevents finally cleanup");
  return reached;
}
async function fixture(checkpoint, run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-move-crash-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  const original = join(root, "Original", "Project 日本語"), destination = join(root, "Destination", "Project 日本語");
  fs.mkdirSync(original, { recursive: true }); fs.mkdirSync(join(root, "Destination"));
  fs.writeFileSync(join(original, "sentinel"), "  Authored 日本語\n");
  const identity = nativeProjectFilesystem.inspect(original).identity;
  let service;
  const open = () => service = openEngineService(databasePath, undefined, undefined, dependencies);
  try {
    open();
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Origin", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, extra = {}) => service.handleQuery({ type: `workspace.${type}`, workspaceId: workspace.workspaceId, ...extra });
    const command = (type, extra = {}) => service.handleCommand({ type: `workspace.${type}`, workspaceId: workspace.workspaceId, ...extra });
    const preview = query("previewDiscovery", { mode: "grouped" }).value;
    const applied = command("applyDiscovery", { previewToken: preview.previewToken }).value;
    const project = applied.projects[0], category = applied.categories.find((c) => c.name === "Destination");
    const property = command("createProperty", { name: "Notes", propertyType: "text" }).value;
    assert.equal(command("setTextValue", { projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст  " }).ok, true);
    const values = query("listTextProperties");
    const otherRoot = join(directory, "other"); fs.mkdirSync(otherRoot);
    const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    const request = { type: "workspace.moveProjectCategory", workspaceId: workspace.workspaceId, projectId: project.projectId,
      operationId: randomUUID(), destinationCategoryId: category.categoryId, expectedRevision: applied.revision };
    const f = { directory, root, databasePath, original, destination, identity, workspace, sibling, other, project, category, request, values, load: service.handleQuery({ type: "workspace.load" }),
      get service() { return service; }, query, command, open,
      status: (workspaceId = f.sibling.workspaceId) => query("getProjectCategoryMove", { workspaceId, operationId: request.operationId }) };
    service.close();
    const reached = await terminateAt(f, checkpoint);
    open();
    assert.equal(f.status().value.operation.stage, reached.stage, "checkpoint acknowledged the durable stage");
    await run(f);
    assert.deepEqual(query("listTextProperties", { workspaceId: f.sibling.workspaceId }), { ok: true, value: { ...values.value, workspaceId: f.sibling.workspaceId } });
    const receipt = f.status().value;
    const located = receipt.outcome === "completed" ? destination : original;
    assert.equal(fs.readFileSync(join(located, "sentinel"), "utf8"), "  Authored 日本語\n");
    assert.deepEqual(fs.readdirSync(located), ["sentinel"]);
    assert.deepEqual(nativeProjectFilesystem.inspect(located).identity, identity);
    assert.equal(fs.existsSync(receipt.outcome === "completed" ? original : destination), false);
  } finally { service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
function review(f, workspaceId = f.sibling.workspaceId) {
  const result = f.query("previewProjectCategoryMoveRecovery", { workspaceId, operationId: f.request.operationId });
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
}
function recover(f, action, workspaceId = f.sibling.workspaceId) {
  const preview = review(f, workspaceId);
  assert.ok(preview.actions.includes(action), JSON.stringify(preview));
  return f.command("recoverProjectCategoryMove", { workspaceId, operationId: f.request.operationId, previewToken: preview.previewToken, action });
}
for (const checkpoint of ["intent", "native_effect", "destination_evidence", "commit"]) {
  test(`abrupt parent termination at ${checkpoint}: restart never replays and sibling recovery preserves identity and values`, async () => fixture(checkpoint, (f) => {
    const stage = { intent: "intent", native_effect: "intent", destination_evidence: "destination_recorded", commit: "completed" }[checkpoint];
    const crashed = f.status();
    assert.deepEqual(f.service.handleQuery({ type: "workspace.load" }), f.load);
    assert.equal(crashed.value.operation.stage, stage);
    const list = f.query("listProjectCategoryMoves", { workspaceId: f.sibling.workspaceId });
    assert.equal(list.value.operations.length, checkpoint === "commit" ? 0 : 1);
    assert.equal(f.status(f.other.workspaceId).ok, false);
    const retry = f.service.moveProjectCategory(f.request);
    assert.equal(retry.value.outcome, checkpoint === "commit" ? "completed" : "recoverable");
    assert.equal(f.service.moveProjectCategory({ ...f.request, destinationCategoryId: f.project.categoryId }).ok, false);
    assert.equal(f.service.moveProjectCategory({ ...f.request, workspaceId: f.sibling.workspaceId }).ok, false);
    for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
      assert.equal(f.command("refreshSource", { workspaceId }).ok, true);
      const current = f.query("listProjects", { workspaceId }).value;
      assert.equal(current.projects.length + current.retainedProjects.length, 1);
      assert.equal([...current.projects, ...current.retainedProjects][0].projectId, f.project.projectId);
    }
    review(f); assert.deepEqual(f.status(), crashed, "queries, previews, startup, Refresh and original retries do not replay");
    const located = checkpoint === "intent" ? f.original : f.destination;
    assert.deepEqual(nativeProjectFilesystem.inspect(located).identity, f.identity);
    f.service.close(); f.open(); assert.deepEqual(f.status(), crashed);
    const events = []; f.service.workspaces.subscribe((event) => { if (event.type === "workspace.projectsChanged") events.push(event); });
    const result = checkpoint === "commit" ? retry : recover(f, checkpoint === "intent" ? "retry_original" : "complete_destination");
    assert.equal(result.value.outcome, "completed", JSON.stringify(result));
    assert.equal(result.value.project.projectId, f.project.projectId);
    assert.equal(result.value.project.categoryId, f.category.categoryId);
    assert.equal(result.value.project.revision, f.request.expectedRevision + 1);
    assert.deepEqual(f.service.moveProjectCategory(f.request), result);
    assert.equal(events.length, checkpoint === "commit" ? 0 : 1);
    if (events.length) assert.deepEqual(new Set(events[0].workspaceIds), new Set([f.workspace.workspaceId, f.sibling.workspaceId]));
    assert.deepEqual(review(f).actions, []);
    assert.deepEqual(f.query("listProjectCategoryMoves", { workspaceId: f.sibling.workspaceId }).value.operations, []);
    f.service.close(); f.open(); assert.deepEqual(f.status(), result);
    assert.deepEqual(f.service.handleQuery({ type: "workspace.load" }), f.load);
    for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
      const project = f.query("listProjects", { workspaceId }).value.projects[0];
      assert.equal(project.categoryId, f.category.categoryId); assert.equal(project.relativePath, "Destination/Project 日本語");
    }
  }));
}

test("interrupted move retains initiating workspace history through final removal and source reuse", async () => fixture("destination_evidence", (f) => {
  const stale = review(f, f.workspace.workspaceId);
  assert.equal(f.command("remove").ok, true);
  assert.equal(f.command("recoverProjectCategoryMove", { operationId: f.request.operationId, previewToken: stale.previewToken, action: "complete_destination" }).ok, false);
  assert.deepEqual(review(f).actions, ["complete_destination"]);
  assert.equal(f.command("remove", { workspaceId: f.sibling.workspaceId }).ok, true);
  const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
  assert.equal(reused.sourceId, f.workspace.sourceId);
  const result = recover(f, "complete_destination", reused.workspaceId);
  assert.equal(result.value.outcome, "completed", JSON.stringify(result));
  assert.equal(result.value.operation.initiatingWorkspaceId, f.workspace.workspaceId);
  // Keep fixture final queries under the current same-source authorization.
  f.sibling = reused;
}));

test("intent interruption can explicitly keep the original after restart", async () => fixture("intent", (f) => {
  const result = recover(f, "keep_original");
  assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "kept_original");
  assert.equal(f.query("listProjects").value.revision, f.request.expectedRevision);
  assert.equal(f.query("listProjects").value.projects[0].categoryId, f.project.categoryId);
  assert.deepEqual(f.service.moveProjectCategory(f.request), result);
}));
