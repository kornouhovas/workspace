import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { nativeObserverDependencies } from "../src/service/source-observer.ts";
import { openSettingsService } from "../dist/service/settings.mjs";

async function fixture(run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "move-coordination-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  for (const name of ["Original", "Other", "Missing"]) fs.mkdirSync(join(root, "Category", name), { recursive: true });
  fs.mkdirSync(join(root, "Destination"));
  fs.writeFileSync(join(root, "Category", "Original", "sentinel"), "  Exact bytes 📝\n");
  const watches = [], timers = new Set();
  const dependencies = { ...nativeObserverDependencies,
    watch(path, hint) { const handle = { path, hint, closed: false }; watches.push(handle); return { close() { handle.closed = true; } }; },
    schedule(callback, delay) { const timer = { callback, delay }; timers.add(timer); return { cancel() { timers.delete(timer); } }; },
  };
  function flushHints() {
    let count = 0;
    while ([...timers].some((timer) => timer.delay <= 100)) {
      assert.ok(++count < 100, "bounded observer queue");
      const timer = [...timers].find((timer) => timer.delay <= 100); timers.delete(timer); timer.callback();
    }
  }
  let service = openSettingsService(databasePath, undefined, undefined, dependencies);
  const sql = new Database(databasePath); sql.pragma("foreign_keys = ON");
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
  const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
  const apply = () => command("workspace.applyDiscovery", { previewToken: query("workspace.previewDiscovery", { mode: "grouped" }).value.previewToken });
  const initial = apply().value, project = initial.projects.find((p) => p.name === "Original");
  const missing = initial.projects.find((p) => p.name === "Missing"), other = initial.projects.find((p) => p.name === "Other");
  const destinationId = initial.categories.find((c) => c.name === "Destination").categoryId;
  const propertyId = command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
  command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  Текст\n  " });
  function moveRow(extra = {}) {
    const source = sql.prepare("SELECT * FROM sources WHERE id = ?").get(workspace.sourceId);
    const p = sql.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId);
    const original = sql.prepare("SELECT * FROM categories WHERE id = ?").get(project.categoryId);
    const destination = sql.prepare("SELECT * FROM categories WHERE id = ?").get(destinationId);
    return { operation_id: randomUUID(), source_id: source.id, initiating_workspace_id: workspace.workspaceId, project_id: p.id,
      name: "Original", expected_revision: source.discovery_revision, original_category_id: original.id, destination_category_id: destination.id,
      canonical_root: source.canonical_root, original_parent_relative_path: original.relative_path, destination_parent_relative_path: destination.relative_path,
      original_relative_path: p.relative_path, requested_relative_path: "Destination/Original", root_identity: source.applied_root_identity,
      original_parent_identity: original.native_identity, destination_parent_identity: destination.native_identity, native_identity: p.native_identity,
      excluded_relative_paths: source.excluded_relative_paths, archive_relative_path: source.archive_relative_path, stage: "intent",
      last_verified_placement: "original", last_verified_identity: p.native_identity, ...extra };
  }
  function insert(table, row, replace = false) {
    sql.prepare(`INSERT ${replace ? "OR REPLACE " : ""}INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.keys(row).map(() => "?").join(",")})`).run(...Object.values(row));
    return row;
  }
  const seed = (extra = {}) => insert("project_category_move_operations", moveRow(extra));
  function creationRow(extra = {}) {
    const row = moveRow();
    return { operation_id: randomUUID(), source_id: row.source_id, initiating_workspace_id: row.initiating_workspace_id, project_id: randomUUID(),
      name: "Pending creation", mode: "grouped", expected_revision: row.expected_revision, category_id: row.original_category_id,
      canonical_root: row.canonical_root, parent_relative_path: row.original_parent_relative_path, relative_path: "Category/Pending creation",
      root_identity: row.root_identity, parent_identity: row.original_parent_identity, excluded_relative_paths: row.excluded_relative_paths,
      archive_relative_path: row.archive_relative_path, stage: "intent", ...extra };
  }
  function renameRow(extra = {}) {
    const row = moveRow(), p = sql.prepare("SELECT * FROM projects WHERE id = ?").get(other.projectId);
    return { operation_id: randomUUID(), source_id: row.source_id, initiating_workspace_id: row.initiating_workspace_id, project_id: p.id,
      original_name: "Other", name: "Requested", mode: "grouped", expected_revision: row.expected_revision, category_id: row.original_category_id,
      canonical_root: row.canonical_root, parent_relative_path: row.original_parent_relative_path, original_relative_path: p.relative_path,
      requested_relative_path: "Category/Requested", staging_relative_path: null, root_identity: row.root_identity,
      parent_identity: row.original_parent_identity, native_identity: p.native_identity, excluded_relative_paths: row.excluded_relative_paths,
      archive_relative_path: row.archive_relative_path, stage: "intent", last_verified_placement: "original", last_verified_identity: p.native_identity, ...extra };
  }
  const snapshot = () => Object.fromEntries(["sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "views", "settings"]
    .map((table) => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
  const move = (extra = {}) => command("workspace.moveProjectCategory", { projectId: project.projectId, operationId: randomUUID(),
    destinationCategoryId: project.categoryId, expectedRevision: sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(workspace.sourceId).discovery_revision, ...extra });
  const f = { directory, root, databasePath, sql, workspace, sibling, initial, project, missing, other, destinationId, propertyId, query, command, apply,
    seed, moveRow, creationRow, renameRow, insert, move, snapshot, watches, flushHints, get service() { return service; },
    restart(workspaceFilesystem) { service.close(); service = openSettingsService(databasePath, undefined, workspaceFilesystem, dependencies); } };
  try { await run(f); } finally { service.close(); sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

for (const stage of ["intent", "destination_recorded", "uncertain"]) for (const placement of ["original", "destination"]) {
  if (stage === "destination_recorded" && placement === "original") continue;
  test(`${stage}/${placement}: startup and observation preserve unfinished move without enrollment or metadata rewrites`, () => fixture(async (f) => {
    const row = f.seed();
    if (placement === "destination") fs.renameSync(join(f.root, row.original_relative_path), join(f.root, row.requested_relative_path));
    if (stage === "destination_recorded") f.sql.prepare("UPDATE project_category_move_operations SET stage = 'destination_recorded', destination_identity = native_identity, last_verified_placement = 'destination' WHERE operation_id = ?").run(row.operation_id);
    if (stage === "uncertain") f.sql.prepare("UPDATE project_category_move_operations SET stage = 'uncertain', problem = 'filesystem_changed' WHERE operation_id = ?").run(row.operation_id);
    fs.renameSync(join(f.root, "Category/Missing"), join(f.directory, "away"));
    const before = f.snapshot();
    f.restart(); assert.deepEqual(f.snapshot(), before);
    assert.equal(f.command("workspace.refreshSource").ok, true);
    const preview = f.query("workspace.previewDiscovery").value;
    const actual = placement === "original" ? row.original_relative_path : row.requested_relative_path;
    assert.notEqual(preview.entries.find((entry) => entry.relativePath === actual)?.reason, null);
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).error.code, "stale_preview");
    const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
    assert.notEqual(recovery.entries.find((entry) => entry.relativePath === actual)?.status, "selectable");
    assert.equal(f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: actual, previewToken: recovery.previewToken }).error.code, "stale_preview");
    assert.deepEqual(f.snapshot(), before);
    const create = f.command("workspace.createProject", { operationId: randomUUID(), name: "Fresh", mode: "grouped", categoryId: f.project.categoryId, expectedRevision: f.initial.revision });
    assert.equal(create.value.outcome, "rejected"); assert.equal(create.value.problem, "reserved_destination");
    assert.equal(fs.existsSync(join(f.root, "Category/Fresh")), false);
    const rename = f.command("workspace.renameProject", { operationId: randomUUID(), projectId: f.other.projectId, name: "Other", expectedRevision: f.initial.revision });
    assert.equal(rename.value.outcome, "rejected"); assert.equal(rename.value.problem, "reserved_destination");
    assert.equal(f.move({ projectId: f.other.projectId }).value.problem, "reserved_destination");
    const reveal = await f.service.revealProject({ type: "workspace.revealProject", workspaceId: f.workspace.workspaceId, projectId: f.project.projectId }, () => assert.fail("pending project dispatched"));
    assert.equal(reveal.value.problem, "unresolved");
    assert.equal((await f.service.revealProject({ type: "workspace.revealProject", workspaceId: f.workspace.workspaceId, projectId: f.other.projectId }, async () => ({ outcome: "dispatched" }))).value.outcome, "dispatched");
    assert.equal(fs.readFileSync(join(f.root, actual, "sentinel"), "utf8"), "  Exact bytes 📝\n");
    assert.equal(f.command("workspace.setTextValue", { projectId: f.project.projectId, propertyId: f.propertyId, value: " Edited \n" }).ok, true);
    assert.equal(f.query("workspace.listTextProperties", { workspaceId: f.sibling.workspaceId }).value.values[0].value, " Edited \n");
    assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.workspace.sourceId).discovery_revision, f.initial.revision);
    assert.equal(f.query("workspace.listProjectCategoryMoves").value.operations.length, 1);
    assert.equal(f.query("workspace.getProjectCategoryMove", { operationId: row.operation_id }).value.outcome, "recoverable");
  }));
}

for (const journal of ["creation", "rename"]) test(`${journal} operation IDs reject new move requests and durable inserts`, () => fixture((f) => {
  const operationId = randomUUID();
  const response = journal === "creation" ? f.command("workspace.createProject", { operationId, name: "Created", mode: "grouped", categoryId: f.project.categoryId, expectedRevision: f.initial.revision }) :
    f.command("workspace.renameProject", { operationId, projectId: f.other.projectId, name: "Other", expectedRevision: f.initial.revision });
  assert.equal(response.ok, true); assert.ok(["completed", "unchanged"].includes(response.value.outcome));
  const before = f.snapshot(), receipt = f.query(journal === "creation" ? "workspace.getProjectCreation" : "workspace.getProjectRename", { operationId });
  assert.equal(f.move({ operationId }).error.code, "invalid_input");
  for (const replace of [false, true]) assert.throws(() => f.insert("project_category_move_operations", f.moveRow({ operation_id: operationId }), replace));
  assert.deepEqual(f.query(journal === "creation" ? "workspace.getProjectCreation" : "workspace.getProjectRename", { operationId }), receipt);
  assert.deepEqual(f.snapshot(), before);
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_category_move_operations").get().n, 0);
}));

for (const stage of ["completed", "failed", "intent"]) test(`${stage} move operation IDs reject new creation/rename requests and durable inserts`, () => fixture((f) => {
  const operationId = randomUUID();
  if (stage === "completed") assert.equal(f.move({ operationId }).value.outcome, "unchanged");
  else {
    f.seed({ operation_id: operationId });
    if (stage === "failed") f.sql.prepare("UPDATE project_category_move_operations SET stage = 'failed', problem = 'kept_original', result_kind = 'rejected' WHERE operation_id = ?").run(operationId);
  }
  const receipt = f.query("workspace.getProjectCategoryMove", { operationId }), before = f.snapshot();
  const create = f.command("workspace.createProject", { operationId, name: "Fresh", mode: "grouped", categoryId: f.project.categoryId, expectedRevision: f.initial.revision });
  const rename = f.command("workspace.renameProject", { operationId, projectId: f.other.projectId, name: "Other", expectedRevision: f.initial.revision });
  assert.equal(create.error.code, "invalid_input"); assert.equal(rename.error.code, "invalid_input");
  for (const replace of [false, true]) {
    assert.throws(() => f.insert("project_creation_operations", f.creationRow({ operation_id: operationId }), replace));
    assert.throws(() => f.insert("project_rename_operations", f.renameRow({ operation_id: operationId }), replace));
  }
  assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId }), receipt);
  assert.deepEqual(f.snapshot(), before); assert.equal(fs.existsSync(join(f.root, "Category/Fresh")), false);
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_creation_operations").get().n, 0);
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_rename_operations").get().n, 0);
}));

test("move intent invalidates discovery and reassociation reviews and blocks fresh source mutations", () => fixture((f) => {
  fs.renameSync(join(f.root, "Category/Missing"), join(f.directory, "away")); fs.mkdirSync(join(f.root, "Category/Candidate"));
  const discovery = f.query("workspace.previewDiscovery").value;
  const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
  const row = f.seed(), before = f.snapshot();
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: "Category/Candidate", previewToken: recovery.previewToken }).error.code, "stale_preview");
  const fresh = f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: "Category/Candidate", previewToken: fresh.previewToken }).error.code, "stale_preview");
  assert.deepEqual(f.snapshot(), before);
  f.sql.prepare("UPDATE project_category_move_operations SET stage = 'failed', problem = 'kept_original', result_kind = 'rejected' WHERE operation_id = ?").run(row.operation_id);
  assert.equal(f.apply().ok, true);
}));

test("move reservations invalidate creation/rename recovery and preserve terminal receipts", () => fixture((f) => {
  const creation = f.insert("project_creation_operations", f.creationRow());
  const creationReceipt = f.query("workspace.getProjectCreation", { operationId: creation.operation_id });
  // Resolve creation before reviewing rename; each unfinished operation keeps
  // its own durable request, and relocation reviews block on other operations.
  const creationReview = f.query("workspace.previewProjectCreationRecovery", { operationId: creation.operation_id }).value;
  assert.ok(creationReview.actions.includes("retry_missing"));
  f.sql.prepare("UPDATE project_creation_operations SET stage = 'failed', problem = 'occupied' WHERE operation_id = ?").run(creation.operation_id);
  const rename = f.insert("project_rename_operations", f.renameRow());
  const renameReview = f.query("workspace.previewProjectRenameRecovery", { operationId: rename.operation_id }).value;
  assert.ok(renameReview.actions.includes("retry_original"));
  const pending = f.insert("project_creation_operations", f.creationRow({ name: "Another pending", relative_path: "Category/Another pending" }));
  f.seed();
  const before = f.snapshot(), receipts = f.sql.prepare("SELECT * FROM project_creation_operations ORDER BY operation_id").all();
  assert.equal(f.command("workspace.recoverProjectRename", { operationId: rename.operation_id, previewToken: renameReview.previewToken, action: "retry_original" }).error.code, "stale_preview");
  const blockedRename = f.query("workspace.previewProjectRenameRecovery", { operationId: rename.operation_id }).value;
  assert.deepEqual(blockedRename.actions, []); assert.equal(blockedRename.problem, "reserved_destination");
  const blockedCreation = f.query("workspace.previewProjectCreationRecovery", { operationId: pending.operation_id }).value;
  assert.deepEqual(blockedCreation.actions, []); assert.equal(blockedCreation.problem, "reserved_destination");
  const failed = f.query("workspace.getProjectCreation", { operationId: creation.operation_id });
  assert.equal(failed.value.outcome, "rejected");
  assert.equal(creationReceipt.value.outcome, "recoverable");
  assert.deepEqual(f.command("workspace.recoverProjectCreation", { operationId: creation.operation_id, previewToken: creationReview.previewToken, action: "retry_missing" }), failed);
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations ORDER BY operation_id").all(), receipts);
  assert.deepEqual(f.snapshot(), before); assert.equal(fs.existsSync(join(f.root, "Category/Another pending")), false);
}));

test("reopen preserves historical creation/rename ID overlaps and their immutable receipts", () => fixture((f) => {
  const operationId = randomUUID();
  const creationRequest = { operationId, name: "Created", mode: "grouped", categoryId: f.project.categoryId, expectedRevision: f.initial.revision };
  const creation = f.command("workspace.createProject", creationRequest); assert.equal(creation.value.outcome, "completed");
  const renameRequest = { operationId, projectId: f.other.projectId, name: "Other", expectedRevision: creation.value.project.revision };
  const rename = f.command("workspace.renameProject", renameRequest); assert.equal(rename.value.outcome, "unchanged");
  const before = f.snapshot(), creationRows = f.sql.prepare("SELECT * FROM project_creation_operations").all(), renameRows = f.sql.prepare("SELECT * FROM project_rename_operations").all();
  f.restart(); assert.deepEqual(f.snapshot(), before);
  assert.deepEqual(f.command("workspace.createProject", creationRequest), creation); assert.deepEqual(f.command("workspace.renameProject", renameRequest), rename);
  assert.equal(f.move({ operationId }).error.code, "invalid_input");
  for (const replace of [false, true]) assert.throws(() => f.insert("project_category_move_operations", f.moveRow({ operation_id: operationId }), replace));
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), creationRows);
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_rename_operations").all(), renameRows);
}));

test("new move intent invalidates a creation recovery token without changing discovery revision", () => fixture((f) => {
  const pending = f.insert("project_creation_operations", f.creationRow());
  const review = f.query("workspace.previewProjectCreationRecovery", { operationId: pending.operation_id }).value;
  assert.ok(review.actions.includes("retry_missing")); f.seed();
  const before = f.snapshot(), receipt = f.query("workspace.getProjectCreation", { operationId: pending.operation_id });
  assert.equal(f.command("workspace.recoverProjectCreation", { operationId: pending.operation_id, previewToken: review.previewToken, action: "retry_missing" }).error.code, "stale_preview");
  assert.deepEqual(f.query("workspace.getProjectCreation", { operationId: pending.operation_id }), receipt);
  assert.deepEqual(f.snapshot(), before); assert.equal(fs.existsSync(join(f.root, "Category/Pending creation")), false);
}));

test("queued watchers, sibling reentry and retained-source reuse keep move associations frozen", () => fixture((f) => {
  const row = f.seed(), events = []; let refreshed = false;
  f.service.workspaces.subscribe((event) => {
    events.push(event);
    if (event.type === "workspace.sourceObserved" && !refreshed) {
      refreshed = true; assert.equal(f.command("workspace.refreshSource", { workspaceId: f.sibling.workspaceId }).ok, true);
    }
  });
  fs.renameSync(join(f.root, row.original_relative_path), join(f.root, row.requested_relative_path));
  fs.renameSync(join(f.root, "Category/Other"), join(f.root, "Category/External"));
  const before = f.snapshot(), watcher = f.watches.find((watch) => !watch.closed && watch.path === f.root);
  assert.ok(watcher); watcher.hint(); assert.equal(f.command("workspace.refreshSource").ok, true); f.flushHints();
  assert.deepEqual(f.snapshot(), before); assert.equal(refreshed, true);
  const observed = events.filter((event) => event.type === "workspace.sourceObserved");
  assert.ok(observed.length > 0);
  assert.ok(observed.every((event) => event.workspaceIds.includes(f.workspace.workspaceId) && event.workspaceIds.includes(f.sibling.workspaceId)));
  assert.ok(!events.some((event) => event.type === "workspace.projectsChanged"));
  for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId }).ok, true);
  assert.ok(f.watches.every((watch) => watch.closed)); watcher.hint(); f.flushHints();
  const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
  assert.equal(reused.sourceId, f.workspace.sourceId); assert.deepEqual(f.sql.prepare("SELECT * FROM projects ORDER BY 1").all(), before.projects);
  assert.equal(f.query("workspace.listProjectCategoryMoves", { workspaceId: reused.workspaceId }).value.operations[0].initiatingWorkspaceId, f.workspace.workspaceId);
  const preview = f.query("workspace.previewDiscovery", { workspaceId: reused.workspaceId }).value;
  assert.equal(f.command("workspace.applyDiscovery", { workspaceId: reused.workspaceId, previewToken: preview.previewToken }).error.code, "stale_preview");
  assert.equal(fs.readFileSync(join(f.root, row.requested_relative_path, "sentinel"), "utf8"), "  Exact bytes 📝\n");
}));

test("move blocks canonical root rebinding under an injected resolver alias", () => fixture((f) => {
  const row = f.seed(), before = f.snapshot();
  const alias = join(f.directory, "canonical-alias");
  const filesystem = { realpath: (path) => path === f.root ? alias : path, legacyRealpath: (path) => path,
    isDirectory: () => true, assertAccessible() {} };
  f.restart(filesystem);
  assert.equal(f.service.workspaces.load().ok, true);
  assert.equal(f.sql.prepare("SELECT canonical_root FROM sources WHERE id = ?").get(f.workspace.sourceId).canonical_root, row.canonical_root);
  assert.deepEqual(f.snapshot(), before);
}));

for (const mutation of ["discovery", "reassociation"]) test(`${mutation} rolls back move intent introduced inside its metadata transaction`, () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Candidate"));
  if (mutation === "reassociation") fs.renameSync(join(f.root, "Category/Missing"), join(f.directory, "away"));
  const preview = mutation === "discovery" ? f.query("workspace.previewDiscovery").value : f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
  const row = f.moveRow({ expected_revision: f.initial.revision + 1 });
  const literal = (value) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
  f.sql.exec(`CREATE TRIGGER inject_move AFTER UPDATE OF discovery_revision ON sources WHEN NEW.id = '${f.workspace.sourceId}' BEGIN
    INSERT INTO project_category_move_operations (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")}); END`);
  const before = f.snapshot();
  const result = mutation === "discovery" ? f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }) :
    f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: "Category/Candidate", previewToken: preview.previewToken });
  assert.equal(result.error.code, "stale_preview"); assert.deepEqual(f.snapshot(), before);
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_category_move_operations").get().n, 0);
}));

for (const mutation of ["creation", "rename", "move"]) test(`${mutation} rechecks move reservations after intent insertion and rolls back before effects`, () => fixture((f) => {
  const row = f.moveRow(), table = { creation: "project_creation_operations", rename: "project_rename_operations", move: "project_category_move_operations" }[mutation];
  const literal = (value) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
  f.sql.exec(`CREATE TRIGGER inject_move AFTER INSERT ON ${table} WHEN NEW.operation_id != '${row.operation_id}' BEGIN
    INSERT INTO project_category_move_operations (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")}); END`);
  const before = f.snapshot();
  const response = mutation === "creation" ? f.command("workspace.createProject", { operationId: randomUUID(), name: "Fresh", mode: "grouped", categoryId: f.project.categoryId, expectedRevision: f.initial.revision }) :
    mutation === "rename" ? f.command("workspace.renameProject", { operationId: randomUUID(), projectId: f.other.projectId, name: "Other", expectedRevision: f.initial.revision }) : f.move({ projectId: f.other.projectId });
  assert.equal(response.value.outcome, "rejected"); assert.equal(response.value.problem, "reserved_destination");
  assert.deepEqual(f.snapshot(), before); assert.equal(fs.existsSync(join(f.root, "Category/Fresh")), false);
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_category_move_operations").get().n, 0);
  assert.equal(f.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  assert.equal(fs.readFileSync(join(f.root, "Category/Original/sentinel"), "utf8"), "  Exact bytes 📝\n");
}));

test("rename recovery repeats move reservation checks inside its terminal metadata transaction", () => fixture((f) => {
  const rename = f.insert("project_rename_operations", f.renameRow());
  const review = f.query("workspace.previewProjectRenameRecovery", { operationId: rename.operation_id }).value;
  assert.ok(review.actions.includes("keep_original"));
  const row = f.moveRow(), literal = (value) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
  f.sql.exec(`CREATE TRIGGER inject_move AFTER UPDATE OF stage ON project_rename_operations WHEN NEW.stage = 'failed' BEGIN
    INSERT INTO project_category_move_operations (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")}); END`);
  const before = f.snapshot();
  const response = f.command("workspace.recoverProjectRename", { operationId: rename.operation_id, previewToken: review.previewToken, action: "keep_original" });
  assert.equal(response.value.outcome, "recoverable"); assert.equal(response.value.operation.problem, "reserved_destination");
  assert.deepEqual(f.snapshot(), before); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_category_move_operations").get().n, 0);
  assert.equal(fs.existsSync(join(f.root, "Category/Other")), true); assert.equal(fs.existsSync(join(f.root, "Category/Requested")), false);
}));

test("pending Reveal reauthorizes against move intent and conflicting aliases", () => fixture(async (f) => {
  let validation;
  const result = await f.service.revealProject({ type: "workspace.revealProject", workspaceId: f.workspace.workspaceId, projectId: f.project.projectId }, async (_target, revalidate) => {
    f.seed(); validation = revalidate(); return { outcome: "dispatched" };
  });
  assert.equal(validation.problem, "unresolved"); assert.equal(result.value.problem, "unresolved");
}));

test("destination aliases block another project's Reveal while unrelated rows remain eligible", () => fixture(async (f) => {
  // Simulate a conflicting retained association at the reserved destination.
  f.seed(); fs.mkdirSync(join(f.root, "Destination/oRiGiNaL"));
  const stat = fs.lstatSync(join(f.root, "Destination/oRiGiNaL"), { bigint: true });
  f.sql.prepare("UPDATE projects SET relative_path = ?, category_id = ?, native_identity = ? WHERE id = ?")
    .run("Destination/oRiGiNaL", f.destinationId, JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }), f.other.projectId);
  const input = { type: "workspace.revealProject", workspaceId: f.sibling.workspaceId };
  assert.equal((await f.service.revealProject({ ...input, projectId: f.other.projectId }, () => assert.fail("reserved alias dispatched"))).value.problem, "unresolved");
  assert.equal((await f.service.revealProject({ ...input, projectId: f.missing.projectId }, async () => ({ outcome: "dispatched" }))).value.outcome, "dispatched");
}));

test("unrelated source mutations and historical creation/rename/move receipts remain available", () => fixture((f) => {
  const creationRequest = { operationId: randomUUID(), name: "Created", mode: "grouped", categoryId: f.project.categoryId, expectedRevision: f.initial.revision };
  const creation = f.command("workspace.createProject", creationRequest); assert.equal(creation.value.outcome, "completed");
  const renameRequest = { operationId: randomUUID(), projectId: f.other.projectId, name: "Other", expectedRevision: creation.value.project.revision };
  const rename = f.command("workspace.renameProject", renameRequest); assert.equal(rename.value.outcome, "unchanged");
  const moveRequest = { operationId: randomUUID(), projectId: f.other.projectId, destinationCategoryId: f.project.categoryId, expectedRevision: creation.value.project.revision };
  const move = f.move(moveRequest); assert.equal(move.value.outcome, "unchanged"); f.seed();
  assert.deepEqual(f.command("workspace.createProject", creationRequest), creation);
  assert.deepEqual(f.command("workspace.renameProject", renameRequest), rename); assert.deepEqual(f.move(moveRequest), move);
  const root = join(f.directory, "unrelated"); fs.mkdirSync(root);
  const workspaceId = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: root }).value.workspaceId;
  const preview = f.query("workspace.previewDiscovery", { workspaceId, mode: "direct" }).value;
  const applied = f.command("workspace.applyDiscovery", { workspaceId, previewToken: preview.previewToken }).value;
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const created = f.command("workspace.createProject", { workspaceId, operationId: randomUUID(), mode: "direct", expectedRevision: applied.revision, name: "Fresh" }).value;
  assert.equal(created.outcome, "completed");
  const renamed = f.command("workspace.renameProject", { workspaceId, operationId: randomUUID(), projectId: created.project.projectId, expectedRevision: created.project.revision, name: "Renamed" }).value;
  assert.equal(renamed.outcome, "completed");
  assert.ok(events.filter((event) => event.type === "workspace.projectsChanged").every((event) => JSON.stringify(event.workspaceIds) === JSON.stringify([workspaceId])));
}));

for (const terminal of ["failed", "completed", "unchanged"]) test(`${terminal} move receipts release vacated operation placements`, () => fixture((f) => {
  const row = f.seed(terminal === "unchanged" ? { destination_category_id: f.project.categoryId, destination_parent_relative_path: "Category", destination_parent_identity: f.moveRow().original_parent_identity, requested_relative_path: "Category/Original" } : {});
  if (terminal === "failed") f.sql.prepare("UPDATE project_category_move_operations SET stage = 'failed', problem = 'kept_original', result_kind = 'rejected' WHERE operation_id = ?").run(row.operation_id);
  else if (terminal === "unchanged") {
    f.sql.prepare("UPDATE project_category_move_operations SET stage = 'completed', result_kind = 'unchanged', completed_revision = expected_revision WHERE operation_id = ?").run(row.operation_id);
    fs.renameSync(join(f.root, "Category/Original"), join(f.root, "Category/Later")); assert.equal(f.command("workspace.refreshSource").ok, true);
  } else {
    fs.renameSync(join(f.root, row.original_relative_path), join(f.root, row.requested_relative_path));
    f.sql.prepare("UPDATE project_category_move_operations SET stage = 'destination_recorded', destination_identity = native_identity, last_verified_placement = 'destination' WHERE operation_id = ?").run(row.operation_id);
    f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET relative_path = ?, category_id = ? WHERE id = ?").run(row.requested_relative_path, row.destination_category_id, row.project_id);
      f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1 WHERE id = ?").run(f.workspace.sourceId);
      f.sql.prepare("UPDATE project_category_move_operations SET stage = 'completed', result_kind = 'completed', completed_revision = expected_revision + 1 WHERE operation_id = ?").run(row.operation_id);
    })();
  }
  const path = terminal === "failed" ? "Destination/Original" : "Category/Original";
  const receipt = f.query("workspace.getProjectCategoryMove", { operationId: row.operation_id });
  fs.mkdirSync(join(f.root, path)); const applied = f.apply(); assert.equal(applied.ok, true);
  const enrolled = applied.value.projects.find((project) => project.relativePath === path);
  assert.ok(enrolled); assert.notEqual(enrolled.projectId, f.project.projectId);
  f.restart(); assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: row.operation_id }), receipt);
}));
