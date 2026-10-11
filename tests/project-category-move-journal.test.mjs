import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";
import { isProjectCategoryMoveRequest } from "../src/contracts/project-category-move.ts";
import { projectCategoryMoveOperations } from "../src/service/db/schema.ts";

const migrationsFolder = "src/service/db/migrations";
const journal = JSON.parse(fs.readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"));
const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
function copyMigrations(folder, count = journal.entries.length) {
  fs.mkdirSync(join(folder, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, count);
  for (const entry of entries) fs.copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
  fs.writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
}
function records(sql) {
  return Object.fromEntries(sql.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    .map(({ name }) => [name, sql.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
}
function fixture(run, legacy = false) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-move-journal-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  let sql, service;
  try {
    fs.mkdirSync(root); for (const parent of ["Original category", "Destination"]) fs.mkdirSync(join(root, parent));
    for (const name of ["Original", "Other", "Recovery"]) {
      fs.mkdirSync(join(root, "Original category", name));
      fs.writeFileSync(join(root, "Original category", name, "sentinel"), Buffer.from([0, 255, 42]));
    }
    const folder = legacy ? join(directory, "legacy") : migrationsFolder;
    if (legacy) copyMigrations(folder, 10);
    service = openSettingsService(databasePath, folder, undefined, dependencies, undefined,
      () => { throw new Error("Injected uncertain native outcome without filesystem effect"); });
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const workspaceId = workspace.workspaceId, sourceId = workspace.sourceId;
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" }).value;
    const initial = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value;
    const categoryId = initial.projects.find((p) => p.name === "Original").categoryId;
    const destinationId = initial.categories.find((c) => c.name === "Destination").categoryId;
    const projectId = initial.projects.find((p) => p.name === "Original").projectId;
    const otherId = initial.projects.find((p) => p.name === "Other").projectId;
    const recoveryId = initial.projects.find((p) => p.name === "Recovery").projectId;
    const created = service.handleCommand({ type: "workspace.createProject", workspaceId, operationId: randomUUID(), name: "Created",
      mode: "grouped", categoryId, expectedRevision: initial.revision });
    assert.equal(created.value.outcome, "completed");
    const revision = created.value.project.revision;
    const renameReceipt = service.renameProject({ type: "workspace.renameProject", workspaceId, operationId: randomUUID(), projectId: otherId,
      name: "Other", expectedRevision: revision });
    assert.equal(renameReceipt.value.outcome, "unchanged");
    const renamePending = service.renameProject({ type: "workspace.renameProject", workspaceId, operationId: randomUUID(), projectId: recoveryId,
      name: "Requested recovery", expectedRevision: revision });
    assert.equal(renamePending.value.outcome, "recoverable");
    const property = service.handleCommand({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" }).value;
    service.handleCommand({ type: "workspace.setTextValue", workspaceId, projectId, propertyId: property.propertyId, value: "  Exact Текст\n  " });
    service.handleCommand({ type: "settings.setLanguage", language: "ru" });
    service.close(); service = null;
    sql = new Database(databasePath); sql.pragma("foreign_keys = ON");
    const operation = (extra = {}) => {
      const source = sql.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId);
      const project = sql.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
      const original = sql.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
      const destination = sql.prepare("SELECT * FROM categories WHERE id = ?").get(destinationId);
      return { operation_id: randomUUID(), source_id: sourceId, initiating_workspace_id: workspaceId, project_id: projectId,
        name: "Original", expected_revision: source.discovery_revision, original_category_id: categoryId, destination_category_id: destinationId,
        canonical_root: source.canonical_root, original_parent_relative_path: original.relative_path, destination_parent_relative_path: destination.relative_path,
        original_relative_path: "Original category/Original", requested_relative_path: "Destination/Original", root_identity: source.applied_root_identity,
        original_parent_identity: original.native_identity, destination_parent_identity: destination.native_identity, native_identity: project.native_identity,
        excluded_relative_paths: source.excluded_relative_paths, archive_relative_path: source.archive_relative_path, stage: "intent",
        destination_identity: null, last_verified_placement: "original", last_verified_identity: project.native_identity,
        problem: null, result_kind: null, completed_revision: null, ...extra };
    };
    const insert = (row, replace = false) => sql.prepare(`INSERT ${replace ? "OR REPLACE " : ""}INTO project_category_move_operations (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`).run(...Object.values(row));
    const update = (op, fields) => sql.prepare(`UPDATE project_category_move_operations SET ${Object.keys(fields).map((key) => `${key} = ?`).join(", ")} WHERE operation_id = ?`).run(...Object.values(fields), op.operation_id);
    run({ directory, root, databasePath, sourceId, workspaceId, projectId, otherId, categoryId, destinationId, operation, insert, update,
      get sql() { return sql; }, reopen() { sql.close(); sql = new Database(databasePath); sql.pragma("foreign_keys = ON"); } });
  } finally { service?.close(); sql?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("all five category move requests accept exact logical payloads and reject paths, native evidence and invalid identities", () => {
  const workspaceId = randomUUID(), projectId = randomUUID(), operationId = randomUUID(), destinationCategoryId = randomUUID();
  const move = { type: "workspace.moveProjectCategory", workspaceId, projectId, operationId, destinationCategoryId, expectedRevision: 0 };
  const requests = [move, { type: "workspace.listProjectCategoryMoves", workspaceId },
    { type: "workspace.getProjectCategoryMove", workspaceId, operationId },
    { type: "workspace.previewProjectCategoryMoveRecovery", workspaceId, operationId },
    ...["retry_original", "complete_destination", "keep_original"].map((action) =>
      ({ type: "workspace.recoverProjectCategoryMove", workspaceId, operationId, previewToken: randomUUID(), action }))];
  for (const request of requests) {
    assert.equal(isProjectCategoryMoveRequest(request), true);
    for (const field of ["path", "nativeIdentity", "name", "root", "mode", "adapter"]) assert.equal(isProjectCategoryMoveRequest({ ...request, [field]: "unsafe" }), false);
    for (const field of Object.keys(request)) {
      const missing = { ...request }; delete missing[field]; assert.equal(isProjectCategoryMoveRequest(missing), false);
      if (field.endsWith("Id") || field === "previewToken") {
        for (const bad of ["", "bad", "00000000-0000-0000-0000-000000000000", null, 42]) assert.equal(isProjectCategoryMoveRequest({ ...request, [field]: bad }), false);
      }
    }
  }
  for (const bad of [null, [], {}, { ...move, type: "unknown" },
    ...[-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"].map((expectedRevision) => ({ ...move, expectedRevision })),
    { ...requests.at(-1), action: "finish_staged" }]) assert.equal(isProjectCategoryMoveRequest(bad), false);
});

test("populated 0000–0009 upgrade and reopen retain creation/rename receipts, outstanding recovery, IDs, Text and independent revisions", () => fixture((f) => {
  const before = records(f.sql); assert.equal(before.__drizzle_migrations.length, 10);
  assert.equal(before.project_creation_operations[0].stage, "completed");
  assert.deepEqual(before.project_rename_operations.map((r) => r.stage), ["completed", "uncertain"]);
  for (let i = 0; i < 2; i++) {
    migrate(drizzle(f.sql), { migrationsFolder }); f.reopen();
    const after = records(f.sql);
    for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") assert.deepEqual(after[table], rows, table);
    assert.deepEqual(after.__drizzle_migrations.slice(0, 10), before.__drizzle_migrations);
    assert.equal(after.__drizzle_migrations.length, 11); assert.deepEqual(after.project_category_move_operations, []);
    assert.deepEqual(f.sql.pragma("foreign_key_check"), []);
    assert.deepEqual(fs.readFileSync(join(f.root, "Original category", "Original", "sentinel")), Buffer.from([0, 255, 42]));
  }
}, true));

test("late migration failure rolls back schema and populated history; subsequent upgrade succeeds", () => fixture((f) => {
  const broken = join(f.directory, "broken"); copyMigrations(broken);
  fs.appendFileSync(join(broken, "0010_project_category_move.sql"), "\n--> statement-breakpoint\nINSERT INTO nonexistent_table VALUES ('failure');\n");
  const before = records(f.sql), schema = f.sql.prepare("SELECT * FROM sqlite_master ORDER BY name").all();
  assert.throws(() => migrate(drizzle(f.sql), { migrationsFolder: broken }), /nonexistent_table/);
  assert.deepEqual(records(f.sql), before); assert.deepEqual(f.sql.prepare("SELECT * FROM sqlite_master ORDER BY name").all(), schema);
  migrate(drizzle(f.sql), { migrationsFolder }); f.reopen();
  for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") assert.deepEqual(records(f.sql)[table], rows, table);
}, true));

test("intent binds both active same-source categories, current project, policy and full evidence", () => fixture((f) => {
  const before = records(f.sql);
  for (const change of [{ initiating_workspace_id: randomUUID() }, { source_id: randomUUID() }, { project_id: randomUUID() },
    { original_category_id: randomUUID() }, { destination_category_id: randomUUID() }, { expected_revision: 0 },
    { canonical_root: "foreign" }, { root_identity: "{}" }, { original_parent_identity: "{}" }, { destination_parent_identity: "{}" },
    { name: "../escape" }, { original_relative_path: "Wrong/Original" }, { requested_relative_path: "Wrong/Original" },
    { original_parent_relative_path: "../escape" }, { destination_parent_relative_path: "../escape" },
    { excluded_relative_paths: '["Other"]' }, { archive_relative_path: "Archive" },
    { stage: "completed", result_kind: "unchanged", completed_revision: 2 }]) assert.throws(() => f.insert(f.operation(change)));
  assert.deepEqual(records(f.sql), before);
  const op = f.operation(); f.insert(op);
  assert.equal(drizzle(f.sql).select().from(projectCategoryMoveOperations).get().operationId, op.operation_id);
  const inserted = records(f.sql);
  for (const field of ["operation_id", "source_id", "initiating_workspace_id", "project_id", "name", "expected_revision",
    "original_category_id", "destination_category_id", "canonical_root", "original_parent_relative_path", "destination_parent_relative_path",
    "original_relative_path", "requested_relative_path", "root_identity", "original_parent_identity", "destination_parent_identity",
    "native_identity", "excluded_relative_paths", "archive_relative_path"]) assert.throws(() => f.update(op, { [field]: field === "expected_revision" ? 9 : "changed" }));
  assert.throws(() => f.sql.exec("DELETE FROM project_category_move_operations"));
  for (const recursive of [0, 1]) {
    f.sql.pragma(`recursive_triggers = ${recursive}`); assert.throws(() => f.insert(op, true));
  }
  assert.deepEqual(records(f.sql), inserted);
}));

test("destination evidence, uncertainty and atomic completion enforce legal transitions and preserve terminal history", () => fixture((f) => {
  const op = f.operation(); f.insert(op);
  for (const bad of [{ stage: "completed", result_kind: "completed", completed_revision: op.expected_revision + 1 },
    { stage: "completed", result_kind: "unchanged", completed_revision: op.expected_revision }, { stage: "destination_recorded" },
    { stage: "uncertain" }, { stage: "uncertain", problem: "unknown" }, { stage: "failed", problem: "occupied" },
    { destination_identity: op.native_identity }, { last_verified_identity: "{}" }]) assert.throws(() => f.update(op, bad));
  f.update(op, { stage: "uncertain", problem: "ownership_uncertain" });
  assert.throws(() => f.update(op, { stage: "intent", problem: null }));
  f.update(op, { stage: "destination_recorded", problem: null, destination_identity: op.native_identity, last_verified_placement: "destination" });
  assert.throws(() => f.update(op, { destination_identity: null }));
  f.update(op, { stage: "uncertain", problem: "filesystem_changed" });
  assert.throws(() => f.update(op, { last_verified_placement: "original" }));
  assert.throws(() => f.update(op, { stage: "completed", problem: null, result_kind: "completed", completed_revision: op.expected_revision + 1 }));
  f.update(op, { stage: "destination_recorded", problem: null });
  const before = records(f.sql), revision = op.expected_revision + 1;
  for (const fields of ["category_id", "relative_path", "both-without-revision"]) {
    assert.throws(() => f.sql.transaction(() => {
      if (fields !== "category_id") f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(op.requested_relative_path, f.projectId);
      if (fields !== "relative_path") f.sql.prepare("UPDATE projects SET category_id = ? WHERE id = ?").run(f.destinationId, f.projectId);
      f.update(op, { stage: "completed", result_kind: "completed", completed_revision: revision });
    })());
    assert.deepEqual(records(f.sql), before);
  }
  f.sql.transaction(() => {
    f.sql.prepare("UPDATE projects SET category_id = ?, relative_path = ? WHERE id = ?").run(f.destinationId, op.requested_relative_path, f.projectId);
    f.sql.prepare("UPDATE sources SET discovery_revision = ? WHERE id = ?").run(revision, f.sourceId);
    f.update(op, { stage: "completed", result_kind: "completed", completed_revision: revision });
  })();
  const receipt = f.sql.prepare("SELECT * FROM project_category_move_operations").get();
  for (const bad of [{ stage: "uncertain", problem: "filesystem_changed", result_kind: null, completed_revision: null },
    { completed_revision: revision + 1 }, { last_verified_placement: "original" }, { destination_identity: null }]) assert.throws(() => f.update(op, bad));
  assert.throws(() => f.insert(op, true)); f.reopen();
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_category_move_operations").get(), receipt);
  for (const table of ["text_property_values", "project_creation_operations", "project_rename_operations"]) assert.deepEqual(records(f.sql)[table], before[table]);
}));

test("unchanged and failed receipts retain historical workspace and cannot be replaced", () => fixture((f) => {
  const op = f.operation({ destination_category_id: f.categoryId, destination_parent_relative_path: "Original category",
    destination_parent_identity: f.operation().original_parent_identity, requested_relative_path: "Original category/Original" });
  f.insert(op);
  assert.throws(() => f.update(op, { stage: "completed", result_kind: "unchanged", completed_revision: op.expected_revision + 1 }));
  f.update(op, { stage: "completed", result_kind: "unchanged", completed_revision: op.expected_revision });
  const failure = f.operation(); f.insert(failure);
  f.update(failure, { stage: "failed", result_kind: "rejected", problem: "occupied" });
  const receipts = f.sql.prepare("SELECT * FROM project_category_move_operations ORDER BY rowid").all();
  assert.throws(() => f.update(failure, { problem: "kept_original" })); assert.throws(() => f.insert(failure, true));
  f.sql.exec("DELETE FROM active_workspace; DELETE FROM views; DELETE FROM workspaces;"); f.reopen();
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_category_move_operations ORDER BY rowid").all(), receipts);
}));

test("incomplete and non-lossless native identities cannot enter the journal", () => fixture((f) => {
  for (const bad of ["{}", "not-json", "[]", ...[{ dev: 1, ino: "2", birthtimeNs: "3" }, { dev: "1", ino: "0", birthtimeNs: "3" },
    { dev: "1", ino: "2", birthtimeNs: "0" }, { dev: "1", ino: "2" }, { dev: "1.5", ino: "2", birthtimeNs: "3" },
    { dev: "1", ino: "2", birthtimeNs: "-3" }].map((value) => JSON.stringify(value))]) {
    const before = records(f.sql);
    assert.throws(() => f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET native_identity = ? WHERE id = ?").run(bad, f.projectId);
      f.insert(f.operation({ native_identity: bad, last_verified_identity: bad }));
    })());
    assert.deepEqual(records(f.sql), before);
  }
}));

test("unfinished moves reserve the project and every original/destination role; terminal receipts release operation reservations", () => fixture((f) => {
  const op = f.operation(); f.insert(op);
  assert.throws(() => f.insert(f.operation()));
  const other = f.sql.prepare("SELECT * FROM projects WHERE id = ?").get(f.otherId);
  const next = f.operation({ project_id: other.id, name: "Other", original_relative_path: other.relative_path,
    requested_relative_path: "Destination/Other", native_identity: other.native_identity, last_verified_identity: other.native_identity });
  for (const path of [op.original_relative_path, op.requested_relative_path]) {
    assert.throws(() => f.insert({ ...next, requested_relative_path: path }, true));
    assert.throws(() => f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET association_state = 'replaced' WHERE id = ?").run(f.projectId);
      f.sql.prepare("UPDATE projects SET category_id = ?, relative_path = ? WHERE id = ?").run(
        path.startsWith("Destination/") ? f.destinationId : f.categoryId, path, f.otherId);
      f.insert({ ...next, name: "Original", original_relative_path: path,
        original_category_id: path.startsWith("Destination/") ? f.destinationId : f.categoryId,
        original_parent_relative_path: path.split("/")[0],
        original_parent_identity: path.startsWith("Destination/") ? op.destination_parent_identity : op.original_parent_identity,
        requested_relative_path: "Destination/Original" });
    })());
  }
  f.update(op, { stage: "failed", result_kind: "rejected", problem: "occupied" });
  f.insert(f.operation());
  assert.equal(f.sql.prepare("SELECT count(*) AS count FROM project_category_move_operations").get().count, 2);
}));
