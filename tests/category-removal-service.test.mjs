import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { startServiceProcess } from "../dist/service/entry.cjs";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { openSettingsService } from "../dist/service/settings.mjs";

const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
function fixture(run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-options-")));
  const root = join(directory, "root"), database = join(directory, "app.sqlite");
  fs.mkdirSync(root); fs.mkdirSync(join(root, "Original")); fs.mkdirSync(join(root, "Original", "Project"));
  fs.writeFileSync(join(root, "Original", "Project", "sentinel"), "exact bytes\n");
  let service;
  const open = () => service = openSettingsService(database, undefined, undefined, observer, options.filesystem, options.native);
  try {
    open();
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, rest = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...rest });
    const command = (type, rest = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...rest });
    const preview = query("workspace.previewDiscovery", { mode: "grouped" }).value;
    const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
    run({ root, directory, database, query, command, initial, workspace, sibling,
      restart() { service.close(); open(); } });
  } finally { service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("removal preview names projects, destination and collisions without changing folders", () => fixture(f => {
  const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Destination", categoryId: null }).value;
  const destination = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
  const categoryId = f.initial.projects[0].categoryId;
  const request = { categoryId, destinationCategoryId: destination };
  const before = f.query("workspace.listProjects");
  const preview = f.query("workspace.previewCategoryRemoval", request);
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.value.projects, [{ projectId: f.initial.projects[0].projectId, originalRelativePath: "Original/Project", requestedRelativePath: "Destination/Project" }]);
  assert.deepEqual(preview.value.blockers, []);
  assert.deepEqual(f.query("workspace.listProjects"), before);
  fs.mkdirSync(join(f.root, "Destination", "Project"));
  const collision = f.query("workspace.previewCategoryRemoval", request);
  assert.equal(collision.ok, true);
  assert.deepEqual(collision.value.blockers, [{ relativePath: "Destination/Project", problem: "occupied" }]);
  assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
}));

test("an occupied category requires a different destination from its own source", () => fixture(f => {
  const categoryId = f.initial.categories[0].categoryId;
  for (const destinationCategoryId of [null, categoryId, randomUUID()]) {
    assert.equal(f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId }).ok, false);
  }
  assert.equal(f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId: null, path: "../escape" }).ok, false);
  assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
}));

test("an empty category can be previewed without a destination; unexpected files are blockers", () => fixture(f => {
  const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Empty", categoryId: null }).value;
  const categoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
  const preview = f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId: null });
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.value.projects, []); assert.deepEqual(preview.value.blockers, []);
  assert.equal(preview.value.destinationRelativePath, null);
  fs.writeFileSync(join(f.root, "Empty", ".DS_Store"), "retain even hidden files");
  fs.mkdirSync(join(f.root, "Empty", "Arrived"));
  const blocked = f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId: null });
  assert.equal(blocked.ok, true);
  assert.deepEqual(blocked.value.blockers, [
    { relativePath: "Empty/.DS_Store", problem: "unexpected_entry" },
    { relativePath: "Empty/Arrived", problem: "unexpected_entry" },
  ]);
  assert.equal(fs.readFileSync(join(f.root, "Empty", ".DS_Store"), "utf8"), "retain even hidden files");
}));

test("planned destinations that share a filesystem alias are exposed before moving any project", t => fixture(f => {
  fs.mkdirSync(join(f.root, "Original", "ProjectA"));
  if (fs.existsSync(join(f.root, "Original", "projecta"))) { t.skip("Requires a case-sensitive fixture filesystem"); return; }
  fs.mkdirSync(join(f.root, "Original", "projecta"));
  const discovery = f.query("workspace.previewDiscovery", { mode: "grouped" }).value;
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).ok, true);
  const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Destination", categoryId: null }).value;
  const destinationCategoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
  const preview = f.query("workspace.previewCategoryRemoval", { categoryId: f.initial.categories[0].categoryId, destinationCategoryId });
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.value.blockers.map(b => b.relativePath).sort(), ["Destination/ProjectA", "Destination/projecta"].sort());
  assert.ok(preview.value.blockers.every(b => b.problem === "occupied"));
}));

test("a destination with an unrelated child exclusion remains eligible", () => fixture(f => {
  const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Destination", categoryId: null }).value;
  const destinationCategoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
  fs.mkdirSync(join(f.root, "Destination", "Private"));
  const discovery = f.query("workspace.previewDiscovery", { mode: "grouped", excludedRelativePaths: ["Destination/Private"] }).value;
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).ok, true);
  const preview = f.query("workspace.previewCategoryRemoval", { categoryId: f.initial.categories[0].categoryId, destinationCategoryId });
  assert.equal(preview.ok, true); assert.deepEqual(preview.value.blockers, []);
}));

test("preview traverses the typed client, narrow preload and production query validation", async () => {
  // The fixture runner is synchronous; all requests in this in-memory transport
  // are dispatched synchronously through the real service entry.
  let request;
  fixture(f => {
    const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Empty", categoryId: null }).value;
    const categoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
    const parent = new EventEmitter(), port = new EventEmitter(), replies = [];
    parent.postMessage = () => {};
    port.postMessage = message => replies.push(message);
    port.start = () => {}; port.close = () => {};
    startServiceProcess(parent, database => openSettingsService(database, undefined, undefined, observer));
    parent.emit("message", { data: { type: "connect", databasePath: f.database }, ports: [port] });
    let serial = 0;
    const ipc = new EventEmitter();
    ipc.invoke = (channel, input) => {
      assert.equal(channel, "workspace:command");
      const id = ++serial;
      port.emit("message", { data: { id, input } });
      const response = replies.find(r => r.id === id);
      assert.ok(response, "query must produce a service response");
      return Promise.resolve(response.result);
    };
    let api;
    runInNewContext(fs.readFileSync("dist/desktop/preload.cjs", "utf8"), { window: new EventTarget(), require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld(_name, exposed) { api = exposed; } } }) });
    const client = new WorkspaceServiceClient(api);
    request = client.previewCategoryRemoval({ workspaceId: f.workspace.workspaceId, categoryId, destinationCategoryId: null });
    port.emit("message", { data: { id: ++serial, input: { type: "workspace.previewCategoryRemoval", workspaceId: f.workspace.workspaceId, categoryId, destinationCategoryId: null, path: "../escape" } } });
    assert.equal(replies.find(r => r.id === serial).result.error.code, "invalid_input");
    parent.emit("message", { data: { type: "shutdown" } });
  });
  const result = await request;
  assert.equal(result.ok, true); assert.deepEqual(result.value.projects, []); assert.deepEqual(result.value.blockers, []);
});
