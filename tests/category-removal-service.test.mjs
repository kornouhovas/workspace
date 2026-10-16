import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { spawnSync } from "node:child_process";
import { renameNoReplace } from "../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";
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

test("reviewed occupied removal preserves project IDs, values and bytes across sibling restart", () => fixture(f => {
  const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Destination", categoryId: null }).value;
  const destinationCategoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
  const project = f.initial.projects[0];
  const propertyId = f.command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
  f.command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  exact\nТекст  " });
  const values = f.query("workspace.listTextProperties");
  const preview = f.query("workspace.previewCategoryRemoval", { categoryId: project.categoryId, destinationCategoryId }).value;
  const request = { operationId: randomUUID(), previewToken: preview.previewToken };
  const result = f.command("workspace.applyCategoryRemoval", request);
  assert.equal(result.ok, true); assert.equal(result.value.operation.stage, "completed");
  assert.deepEqual(result.value.operation.projects.map(p => p.outcome), ["completed"]);
  assert.equal(fs.existsSync(join(f.root, "Original")), false);
  assert.equal(fs.readFileSync(join(f.root, "Destination", "Project", "sentinel"), "utf8"), "exact bytes\n");
  f.restart();
  assert.deepEqual(f.command("workspace.applyCategoryRemoval", request), result);
  const list = f.query("workspace.listProjects", { workspaceId: f.sibling.workspaceId }).value;
  assert.deepEqual(list.categories.map(c => c.categoryId), [destinationCategoryId]);
  assert.equal(list.projects[0].projectId, project.projectId); assert.equal(list.projects[0].relativePath, "Destination/Project");
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.deepEqual(f.query("workspace.listCategoryRemovals").value.operations, []);
}));

function removal(f, additionalNames = []) {
  for (const name of additionalNames) fs.mkdirSync(join(f.root, "Original", name));
  if (additionalNames.length) {
    const discovery = f.query("workspace.previewDiscovery", { mode: "grouped" }).value;
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).ok, true);
  }
  const created = f.query("workspace.previewCategoryFolder", { action: "create", name: "Destination", categoryId: null }).value;
  const destinationCategoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: created.previewToken }).value.operation.categoryId;
  const preview = f.query("workspace.previewCategoryRemoval", { categoryId: f.initial.categories[0].categoryId, destinationCategoryId }).value;
  return { destinationCategoryId, operationId: randomUUID(), previewToken: preview.previewToken };
}
function retry(f, operationId, workspaceId = f.workspace.workspaceId) {
  const preview = f.query("workspace.previewCategoryRemovalRecovery", { operationId, workspaceId });
  assert.equal(preview.ok, true); assert.ok(preview.value.actions.includes("retry_remaining"), JSON.stringify(preview));
  return f.command("workspace.recoverCategoryRemoval", { operationId, workspaceId, previewToken: preview.value.previewToken, action: "retry_remaining" });
}

test("first failed project stops the batch; explicit sibling retry skips completed work", () => {
  let calls = 0, deny = true;
  fixture(f => {
    const prepared = removal(f, ["A", "B"]), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
    const partial = f.command("workspace.applyCategoryRemoval", request);
    assert.equal(partial.ok, true); assert.equal(partial.value.operation.stage, "moving");
    assert.deepEqual(partial.value.operation.projects.map(p => p.outcome), ["completed", "rejected", "pending"]);
    assert.equal(calls, 2); assert.equal(fs.existsSync(join(f.root, "Original", "Project")), true);
    assert.deepEqual(f.command("workspace.applyCategoryRemoval", request), partial); assert.equal(calls, 2);
    f.restart();
    assert.deepEqual(f.query("workspace.listCategoryRemovals", { workspaceId: f.sibling.workspaceId }).value.operations, [partial.value.operation]);
    assert.equal(calls, 2);
    deny = false;
    const done = retry(f, request.operationId, f.sibling.workspaceId);
    assert.equal(done.ok, true); assert.equal(done.value.operation.stage, "completed");
    assert.deepEqual(done.value.operation.projects.map(p => p.outcome), ["completed", "completed", "completed"]);
    assert.equal(calls, 4); assert.equal(fs.existsSync(join(f.root, "Original")), false);
  }, { native(from, to) { calls++; if (deny && calls === 2) return "permission_denied"; return renameNoReplace(from, to); } });
});

test("a lost native response after a physical move requires explicit recovery and never duplicates it", () => {
  let calls = 0, interrupt = true;
  fixture(f => {
    const prepared = removal(f), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
    const partial = f.command("workspace.applyCategoryRemoval", request);
    assert.equal(partial.value.operation.projects[0].outcome, "recoverable"); assert.equal(calls, 1);
    f.restart();
    assert.equal(f.query("workspace.getCategoryRemoval", { operationId: request.operationId }).value.operation.stage, "moving");
    assert.equal(calls, 1); interrupt = false;
    const done = retry(f, request.operationId);
    assert.equal(done.value.operation.stage, "completed"); assert.equal(calls, 1);
    assert.equal(fs.readFileSync(join(f.root, "Destination", "Project", "sentinel"), "utf8"), "exact bytes\n");
  }, { native(from, to) { calls++; const result = renameNoReplace(from, to); if (interrupt) throw new Error("Lost response"); return result; } });
});

test("new arrivals after preview reject Apply without moving or deleting anything", () => fixture(f => {
  const prepared = removal(f), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
  fs.mkdirSync(join(f.root, "Original", "New project"));
  assert.equal(f.command("workspace.applyCategoryRemoval", request).error.code, "stale_preview");
  assert.equal(fs.existsSync(join(f.root, "Original", "Project")), true);
  assert.equal(fs.existsSync(join(f.root, "Original", "New project")), true);
  assert.deepEqual(f.query("workspace.listCategoryRemovals").value.operations, []);
}));

test("late hidden files prevent nonrecursive cleanup; retry removes only a newly verified empty folder", () => {
  let inject = true;
  fixture(f => {
    const prepared = removal(f), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
    const partial = f.command("workspace.applyCategoryRemoval", request);
    assert.equal(partial.value.operation.stage, "cleanup_intent");
    assert.equal(partial.value.operation.projects[0].outcome, "completed");
    assert.equal(fs.readFileSync(join(f.root, "Original", ".keep"), "utf8"), "never delete");
    f.restart();
    assert.deepEqual(f.query("workspace.previewCategoryRemovalRecovery", { operationId: request.operationId }).value.actions, ["abandon"]);
    fs.unlinkSync(join(f.root, "Original", ".keep")); inject = false;
    assert.equal(retry(f, request.operationId).value.operation.stage, "completed");
  }, { filesystem: { ...nativeProjectFilesystem, removeEmptyDirectory(path) { if (inject) fs.writeFileSync(join(path, ".keep"), "never delete"); fs.rmdirSync(path); } } });
});

test("interruption after empty-directory removal recovers metadata without another filesystem effect", () => {
  let calls = 0;
  fixture(f => {
    const prepared = removal(f), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
    const partial = f.command("workspace.applyCategoryRemoval", request);
    assert.equal(partial.value.operation.stage, "cleanup_intent"); assert.equal(fs.existsSync(join(f.root, "Original")), false);
    f.restart();
    assert.equal(retry(f, request.operationId, f.sibling.workspaceId).value.operation.stage, "completed");
    assert.equal(calls, 1); assert.equal(f.query("workspace.listProjects").value.projects[0].projectId, f.initial.projects[0].projectId);
  }, { filesystem: { ...nativeProjectFilesystem, removeEmptyDirectory(path) { calls++; fs.rmdirSync(path); throw new Error("Response interrupted"); } } });
});

test("an empty reviewed category is removed without a destination or project-file deletion", () => fixture(f => {
  const preview = f.query("workspace.previewCategoryFolder", { action: "create", name: "Empty", categoryId: null }).value;
  const categoryId = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: preview.previewToken }).value.operation.categoryId;
  const review = f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId: null }).value;
  const removed = f.command("workspace.applyCategoryRemoval", { operationId: randomUUID(), previewToken: review.previewToken });
  assert.equal(removed.value.operation.stage, "completed"); assert.deepEqual(removed.value.operation.projects, []);
  assert.equal(fs.existsSync(join(f.root, "Empty")), false);
  assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
}));

for (const phase of ["batch_intent", "intent", "effect", "recorded", "first_completed", "cleanup_intent", "cleanup_effect"]) {
  test(`process exit at ${phase} preserves observable state and requires explicit recovery`, () => fixture(f => {
    const prepared = removal(f, phase === "first_completed" ? ["A"] : []);
    const child = spawnSync(process.execPath, ["--import", "tsx", "tests/fixtures/category-removal-crash-worker.mjs", f.database, f.workspace.workspaceId,
      f.initial.categories[0].categoryId, prepared.destinationCategoryId, prepared.operationId, phase], { encoding: "utf8", timeout: 15000 });
    assert.equal(child.status, 71, child.stderr);
    f.restart();
    const operation = f.query("workspace.listCategoryRemovals", { workspaceId: f.sibling.workspaceId }).value.operations[0];
    assert.equal(operation.operationId, prepared.operationId);
    const originalBefore = fs.existsSync(join(f.root, "Original", "Project")), destinationBefore = fs.existsSync(join(f.root, "Destination", "Project"));
    for (let i = 0; i < 2; i++) {
      assert.equal(f.query("workspace.getCategoryRemoval", { operationId: prepared.operationId }).value.operation.stage, operation.stage);
      f.query("workspace.listProjects");
    }
    assert.equal(fs.existsSync(join(f.root, "Original", "Project")), originalBefore);
    assert.equal(fs.existsSync(join(f.root, "Destination", "Project")), destinationBefore);
    const discovery = f.query("workspace.previewDiscovery", { mode: "direct" }).value;
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).ok, false);
    const revision = f.query("workspace.listProjects").value.revision;
    assert.equal(f.command("workspace.createProject", { operationId: randomUUID(), categoryId: prepared.destinationCategoryId, mode: "grouped", name: "Blocked", expectedRevision: revision }).value.outcome, "rejected");
    assert.equal(f.query("workspace.previewCategoryFolder", { action: "create", name: "Blocked", categoryId: null }).ok, false);
    const done = retry(f, prepared.operationId, f.sibling.workspaceId);
    assert.equal(done.value.operation.stage, "completed");
    f.restart();
    assert.equal(f.query("workspace.listProjects").value.projects.find(p => p.projectId === f.initial.projects[0].projectId).relativePath, "Destination/Project");
    assert.equal(fs.readFileSync(join(f.root, "Destination", "Project", "sentinel"), "utf8"), "exact bytes\n");
    assert.equal(fs.existsSync(join(f.root, "Original")), false);
  }));
}

test("a project arriving after the first move remains untouched and is never added to retry", () => {
  let calls = 0;
  fixture(f => {
    const prepared = removal(f, ["A"]), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
    const partial = f.command("workspace.applyCategoryRemoval", request).value.operation;
    assert.equal(calls, 1); assert.equal(partial.problem, "unexpected_entry");
    assert.deepEqual(partial.projects.map(p => p.outcome), ["completed", "pending"]);
    const preview = f.query("workspace.previewCategoryRemovalRecovery", { operationId: request.operationId }).value;
    assert.deepEqual(preview.actions, ["abandon"]);
    const stopped = f.command("workspace.recoverCategoryRemoval", { operationId: request.operationId, previewToken: preview.previewToken, action: "abandon" });
    assert.equal(stopped.value.operation.stage, "abandoned"); assert.equal(calls, 1);
    assert.equal(fs.existsSync(join(f.root, "Original", "Arrived")), true);
    assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
    assert.equal(fs.existsSync(join(f.root, "Destination", "A")), true);
  }, { native(from, to) { calls++; const result = renameNoReplace(from, to); fs.mkdirSync(join(from, "..", "Arrived")); return result; } });
});

test("replaced category identity blocks retry and never removes the replacement", () => fixture(f => {
  const prepared = removal(f), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
  const partial = f.command("workspace.applyCategoryRemoval", request);
  assert.equal(partial.value.operation.stage, "moving");
  fs.renameSync(join(f.root, "Original"), join(f.directory, "Retained original"));
  fs.mkdirSync(join(f.root, "Original")); fs.writeFileSync(join(f.root, "Original", "foreign"), "preserve");
  const review = f.query("workspace.previewCategoryRemovalRecovery", { operationId: request.operationId }).value;
  assert.equal(review.actions.includes("retry_remaining"), false);
  assert.equal(f.command("workspace.recoverCategoryRemoval", { operationId: request.operationId, previewToken: review.previewToken, action: "retry_remaining" }).error.code, "stale_preview");
  f.restart();
  assert.equal(fs.readFileSync(join(f.root, "Original", "foreign"), "utf8"), "preserve");
  assert.equal(fs.readFileSync(join(f.directory, "Retained original", "Project", "sentinel"), "utf8"), "exact bytes\n");
}, { native() { return "permission_denied"; } }));

test("stale/restarted preview tokens and changed operation bindings cannot cause effects", () => fixture(f => {
  const prepared = removal(f), categoryId = f.initial.categories[0].categoryId;
  const second = f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId: prepared.destinationCategoryId }).value;
  assert.equal(f.command("workspace.applyCategoryRemoval", { operationId: prepared.operationId, previewToken: prepared.previewToken }).error.code, "stale_preview");
  f.restart();
  assert.equal(f.command("workspace.applyCategoryRemoval", { operationId: randomUUID(), previewToken: second.previewToken }).error.code, "stale_preview");
  const latest = f.query("workspace.previewCategoryRemoval", { categoryId, destinationCategoryId: prepared.destinationCategoryId }).value;
  const request = { operationId: randomUUID(), previewToken: latest.previewToken };
  assert.equal(f.command("workspace.applyCategoryRemoval", request).value.operation.stage, "completed");
  assert.equal(f.command("workspace.applyCategoryRemoval", { ...request, previewToken: randomUUID() }).ok, false);
  assert.equal(f.command("workspace.applyCategoryRemoval", { ...request, workspaceId: f.sibling.workspaceId }).ok, false);
}));

test("migration 0012 preserves populated 0011 data, presentation and receipts across reopen", () => fixture(f => {
  removal(f);
  const project = f.initial.projects[0], propertyId = f.command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
  f.command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "exact authored value" });
  const folder = join(f.directory, "old-migrations"); fs.mkdirSync(join(folder, "meta"), { recursive: true });
  const journal = JSON.parse(fs.readFileSync("src/service/db/migrations/meta/_journal.json", "utf8"));
  journal.entries = journal.entries.slice(0, 12);
  fs.writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) fs.copyFileSync(`src/service/db/migrations/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`));
  const oldPath = join(f.directory, "previous.sqlite"), previous = new Database(oldPath), current = new Database(f.database);
  const tables = ["sources", "workspaces", "views", "active_workspace", "categories", "category_properties", "projects", "property_definitions", "text_property_values", "settings", "project_creation_operations", "project_rename_operations", "project_category_move_operations", "category_folder_operations", "category_presentation"];
  let snapshot;
  try {
    migrate(drizzle(previous), { migrationsFolder: folder });
    snapshot = Object.fromEntries(tables.map(table => [table, current.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
    for (const table of tables) for (const row of snapshot[table]) {
      const columns = Object.keys(row).filter(key => table !== "views" || key !== "position");
      previous.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...columns.map(key => row[key]));
    }
  } finally { previous.close(); current.close(); }
  for (let i = 0; i < 2; i++) {
    const reopened = openSettingsService(oldPath, undefined, undefined, observer), sql = new Database(oldPath);
    try {
      for (const table of tables) assert.deepEqual(sql.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(), snapshot[table], table);
      assert.equal(sql.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get().n, 19);
      assert.deepEqual(sql.prepare("SELECT * FROM category_removal_operations").all(), []);
      assert.deepEqual(sql.prepare("SELECT * FROM category_removal_attempts").all(), []);
      assert.deepEqual(sql.pragma("foreign_key_check"), []);
      const list = reopened.handleQuery({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId });
      assert.equal(list.value.projects[0].projectId, project.projectId);
      assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
    } finally { reopened.close(); sql.close(); }
  }
}));

test("native no-replace preserves a destination inserted after validation", () => fixture(f => {
  const prepared = removal(f);
  const partial = f.command("workspace.applyCategoryRemoval", { operationId: prepared.operationId, previewToken: prepared.previewToken }).value.operation;
  assert.equal(partial.stage, "moving"); assert.equal(partial.projects[0].outcome, "rejected"); assert.equal(partial.problem, "occupied");
  assert.equal(fs.readFileSync(join(f.root, "Destination", "Project", "foreign"), "utf8"), "untouched");
  assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
  assert.equal(f.query("workspace.previewCategoryRemovalRecovery", { operationId: prepared.operationId }).value.actions.includes("retry_remaining"), false);
}, { native(from, to) { fs.mkdirSync(to); fs.writeFileSync(join(to, "foreign"), "untouched"); return renameNoReplace(from, to); } }));

test("cleanup permission failure remains recoverable without repeating completed project moves", () => {
  let denied = true, moves = 0;
  fixture(f => {
    const prepared = removal(f);
    const partial = f.command("workspace.applyCategoryRemoval", { operationId: prepared.operationId, previewToken: prepared.previewToken }).value.operation;
    assert.equal(partial.stage, "cleanup_intent"); assert.equal(partial.problem, "permission_denied"); assert.equal(moves, 1);
    f.restart(); denied = false;
    assert.equal(retry(f, prepared.operationId).value.operation.stage, "completed"); assert.equal(moves, 1);
  }, { native(from, to) { moves++; return renameNoReplace(from, to); }, filesystem: { ...nativeProjectFilesystem, removeEmptyDirectory(path) { if (denied) throw Object.assign(new Error("Injected permissions"), { code: "EPERM" }); fs.rmdirSync(path); } } });
});

test("completed removal bindings, attempts and child receipts cannot be rewritten or erased", () => fixture(f => {
  const prepared = removal(f), request = { operationId: prepared.operationId, previewToken: prepared.previewToken };
  const completed = f.command("workspace.applyCategoryRemoval", request);
  assert.equal(completed.value.operation.stage, "completed");
  const sql = new Database(f.database);
  try {
    const row = sql.prepare("SELECT * FROM category_removal_operations WHERE operation_id = ?").get(prepared.operationId);
    assert.throws(() => sql.prepare("UPDATE category_removal_operations SET stage = 'moving' WHERE operation_id = ?").run(prepared.operationId));
    assert.throws(() => sql.prepare("DELETE FROM category_removal_operations WHERE operation_id = ?").run(prepared.operationId));
    const fields = Object.keys(row);
    assert.throws(() => sql.prepare(`INSERT OR REPLACE INTO category_removal_operations (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).run(...Object.values(row)));
    const attempt = sql.prepare("SELECT * FROM category_removal_attempts WHERE removal_id = ?").get(prepared.operationId);
    assert.throws(() => sql.prepare("UPDATE category_removal_attempts SET project_id = ? WHERE move_id = ?").run(randomUUID(), attempt.move_id));
    assert.throws(() => sql.prepare("DELETE FROM category_removal_attempts WHERE move_id = ?").run(attempt.move_id));
    assert.throws(() => sql.prepare("UPDATE category_removal_attempts SET problem = 'occupied' WHERE move_id = ?").run(attempt.move_id));
    assert.throws(() => sql.prepare("DELETE FROM project_category_move_operations WHERE operation_id = ?").run(attempt.move_id));
  } finally { sql.close(); }
  f.restart(); assert.deepEqual(f.command("workspace.applyCategoryRemoval", request), completed);
}));
