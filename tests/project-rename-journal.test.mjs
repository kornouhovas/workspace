import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { isProjectRenameRequest } from "../src/contracts/project-rename.ts";
import { projectRenameOperations } from "../src/service/db/schema.ts";

const migrationsFolder = "src/service/db/migrations";
const journal = JSON.parse(fs.readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"));
const identity = (path) => {
  const stat = fs.lstatSync(path, { bigint: true });
  return JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) });
};
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
function fixture(mode, run, legacy = false) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "rename-journal-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(root);
  let sql = new Database(databasePath);
  const sourceId = randomUUID(), workspaceId = randomUUID(), categoryId = mode === "grouped" ? randomUUID() : null;
  try {
    const folder = legacy ? join(directory, "legacy") : migrationsFolder;
    if (legacy) copyMigrations(folder, 9);
    migrate(drizzle(sql), { migrationsFolder: folder }); sql.pragma("foreign_keys = ON");
    sql.prepare("INSERT INTO settings VALUES ('language', 'ru')").run();
    sql.prepare(`INSERT INTO sources (id, canonical_root, discovery_mode, discovery_revision, property_revision,
      category_property_revision, applied_root_identity) VALUES (?, ?, ?, 7, 9, 11, ?)`)
      .run(sourceId, root, mode, identity(root));
    sql.prepare("INSERT INTO workspaces (id, name, position, source_id) VALUES (?, 'Workspace', 0, ?)").run(workspaceId, sourceId);
    const viewId = randomUUID();
    sql.prepare("INSERT INTO views VALUES (?, ?, 'Table', 'table')").run(viewId, workspaceId);
    sql.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(workspaceId, viewId);
    const parent = mode === "grouped" ? "Category" : "";
    if (parent) {
      fs.mkdirSync(join(root, parent));
      sql.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, 'active')")
        .run(categoryId, sourceId, parent, identity(join(root, parent)));
    }
    const relative = (name) => parent ? `${parent}/${name}` : name;
    const addProject = (name) => {
      const id = randomUUID(); fs.mkdirSync(join(root, relative(name)));
      fs.writeFileSync(join(root, relative(name), "sentinel"), Buffer.from([0, 255, 42]));
      sql.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id) VALUES (?, ?, ?, ?, 'active', ?)")
        .run(id, sourceId, relative(name), identity(join(root, relative(name))), categoryId);
      return id;
    };
    const projectId = addProject("Original"), otherId = addProject("Other");
    const propertyId = randomUUID();
    sql.prepare("INSERT INTO property_definitions VALUES (?, ?, 'Notes', 'text', 0)").run(propertyId, sourceId);
    sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, sourceId, "  Текст 📝\n  ");
    // Populate the prior immutable creation history, not just empty prior tables.
    const creationId = randomUUID();
    sql.prepare(`INSERT INTO project_creation_operations (operation_id, source_id, initiating_workspace_id, project_id, name,
      mode, expected_revision, category_id, canonical_root, parent_relative_path, relative_path, root_identity,
      parent_identity, excluded_relative_paths, stage) VALUES (?, ?, ?, ?, 'Past creation', ?, 7, ?, ?, ?, ?, ?, ?, '[]', 'intent')`)
      .run(creationId, sourceId, workspaceId, randomUUID(), mode, categoryId, root, parent, relative("Past creation"), identity(root), identity(join(root, parent)));
    sql.prepare("UPDATE project_creation_operations SET stage = 'failed', problem = 'occupied'").run();
    const operation = (extra = {}) => {
      const project = sql.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
      return { operation_id: randomUUID(), source_id: sourceId, initiating_workspace_id: workspaceId, project_id: projectId,
        original_name: project.relative_path.split("/").at(-1), name: "  Requested  ", mode,
        expected_revision: sql.prepare("SELECT discovery_revision FROM sources").get().discovery_revision,
        category_id: categoryId, canonical_root: root, parent_relative_path: parent,
        original_relative_path: project.relative_path, requested_relative_path: relative("  Requested  "), staging_relative_path: null,
        root_identity: identity(root), parent_identity: identity(join(root, parent)), native_identity: project.native_identity,
        excluded_relative_paths: "[]", archive_relative_path: null, stage: "intent",
        last_verified_placement: "original", last_verified_identity: project.native_identity, ...extra };
    };
    const insert = (row, replace = false) => sql.prepare(`INSERT ${replace ? "OR REPLACE " : ""}INTO project_rename_operations (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`).run(...Object.values(row));
    const update = (op, fields) => sql.prepare(`UPDATE project_rename_operations SET ${Object.keys(fields).map((key) => `${key} = ?`).join(", ")} WHERE operation_id = ?`).run(...Object.values(fields), op.operation_id);
    const f = { directory, root, sourceId, workspaceId, projectId, otherId, categoryId, relative, operation, insert, update,
      get sql() { return sql; }, reopen() { sql.close(); sql = new Database(databasePath); sql.pragma("foreign_keys = ON"); } };
    run(f);
  } finally { if (sql.open) sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("all five rename requests validate exact logical payloads without changing authored names", () => {
  const workspaceId = randomUUID(), operationId = randomUUID(), projectId = randomUUID(), previewToken = randomUUID();
  const rename = { type: "workspace.renameProject", workspaceId, operationId, projectId, name: "  Authored: имя\n  ", expectedRevision: 0 };
  const requests = [rename, { type: "workspace.listProjectRenames", workspaceId },
    { type: "workspace.getProjectRename", workspaceId, operationId },
    { type: "workspace.previewProjectRenameRecovery", workspaceId, operationId },
    ...["retry_original", "finish_staged", "complete_destination", "keep_original"].map((action) =>
      ({ type: "workspace.recoverProjectRename", workspaceId, operationId, previewToken, action }))];
  for (const request of requests) {
    assert.equal(isProjectRenameRequest(request), true);
    for (const field of ["path", "nativeIdentity", "stagingPath", "mode", "categoryId", "extra"]) {
      assert.equal(isProjectRenameRequest({ ...request, [field]: "unsafe" }), false);
    }
    for (const field of Object.keys(request)) {
      const missing = { ...request }; delete missing[field]; assert.equal(isProjectRenameRequest(missing), false);
      if (field.endsWith("Id") || field === "previewToken") {
        for (const bad of ["invalid", "00000000-0000-0000-0000-000000000000", null, 1]) {
          assert.equal(isProjectRenameRequest({ ...request, [field]: bad }), false);
        }
      }
    }
  }
  for (const bad of [null, [], {}, { ...rename, type: "unknown" }, { ...rename, name: null },
    ...[-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"].map((expectedRevision) => ({ ...rename, expectedRevision })),
    { ...requests.at(-1), action: "automatic" }]) assert.equal(isProjectRenameRequest(bad), false);
  assert.equal(rename.name, "  Authored: имя\n  ");
});

for (const mode of ["direct", "grouped"]) {
  test(`${mode} populated 0000–0008 upgrade and reopen retain Text, creation receipts and configuration`, () => fixture(mode, (f) => {
    const before = records(f.sql);
    assert.equal(before.__drizzle_migrations.length, 9);
    for (let i = 0; i < 2; i++) {
      migrate(drizzle(f.sql), { migrationsFolder }); f.reopen();
      const after = records(f.sql);
      for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") assert.deepEqual(after[table], rows, table);
      assert.deepEqual(after.__drizzle_migrations.slice(0, 9), before.__drizzle_migrations);
      assert.equal(after.__drizzle_migrations.length, 10);
      assert.deepEqual(after.project_rename_operations, []);
      assert.deepEqual(f.sql.pragma("foreign_key_check"), []);
      assert.deepEqual(fs.readFileSync(join(f.root, f.relative("Original"), "sentinel")), Buffer.from([0, 255, 42]));
    }
  }, true));

  test(`${mode} intent binds source/project/category evidence and immutable authored context`, () => fixture(mode, (f) => {
    const op = f.operation();
    const before = records(f.sql);
    for (const extra of [{ expected_revision: 6 }, { initiating_workspace_id: randomUUID() }, { project_id: randomUUID() },
      { source_id: randomUUID() }, { category_id: randomUUID() }, { canonical_root: "other" }, { excluded_relative_paths: '["Other"]' },
      { root_identity: identity(join(f.root, f.relative("Other"))) },
      { name: "../escape", requested_relative_path: f.relative("../escape") },
      ...["../escape", "visible", f.relative(".nested/escape"), f.relative("Original")].map((staging_relative_path) => ({ staging_relative_path })),
      { archive_relative_path: "Archive" }, { original_relative_path: "Wrong" }, { original_name: "Wrong" },
      { native_identity: identity(f.root), last_verified_identity: identity(f.root) },
      { parent_identity: identity(join(f.root, f.relative("Other"))) }, { stage: "uncertain", problem: "ownership_uncertain" }]) {
      assert.throws(() => f.insert(f.operation({ project_id: f.otherId, original_name: "Other", original_relative_path: f.relative("Other"),
        native_identity: identity(join(f.root, f.relative("Other"))), last_verified_identity: identity(join(f.root, f.relative("Other"))), ...extra })));
    }
    assert.deepEqual(records(f.sql), before);
    f.insert(op);
    assert.equal(drizzle(f.sql).select().from(projectRenameOperations).get().operationId, op.operation_id);
    const inserted = records(f.sql);
    for (const field of Object.keys(op).filter((key) => !["stage", "last_verified_placement", "last_verified_identity"].includes(key))) {
      assert.throws(() => f.update(op, { [field]: field === "expected_revision" ? 8 : "changed" }), /immutable/);
    }
    assert.throws(() => f.sql.prepare("DELETE FROM project_rename_operations").run(), /retained/);
    assert.throws(() => f.insert(op, true), /retained|reserved/);
    assert.deepEqual(records(f.sql), inserted);
  }));

  test(`${mode} unfinished operations reserve every cross-role exact path and one project, allowing self aliases`, () => fixture(mode, (f) => {
    const op = f.operation({ staging_relative_path: f.relative(".rename-stage") }); f.insert(op);
    assert.throws(() => f.insert(f.operation({ name: "Different", requested_relative_path: f.relative("Different") })), /retained|reserved/);
    const otherIdentity = identity(join(f.root, f.relative("Other")));
    const other = { project_id: f.otherId, original_name: "Other", original_relative_path: f.relative("Other"),
      native_identity: otherIdentity, last_verified_identity: otherIdentity };
    for (const path of [op.original_relative_path, op.requested_relative_path, op.staging_relative_path]) {
      assert.throws(() => f.insert(f.operation({ ...other, name: path.split("/").at(-1), requested_relative_path: path }), true), /reserved/);
      assert.throws(() => f.insert(f.operation({ ...other, staging_relative_path: path }), true), /reserved/);
      // Swap the current association in a rolled-back transaction to exercise original-path conflicts too.
      assert.throws(() => f.sql.transaction(() => {
        f.sql.prepare("UPDATE projects SET association_state = 'replaced' WHERE id = ?").run(f.projectId);
        f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(path, f.otherId);
        f.insert(f.operation({ ...other, original_name: path.split("/").at(-1), original_relative_path: path,
          name: "Elsewhere", requested_relative_path: f.relative("Elsewhere") }));
      })(), /reserved/);
    }
    f.update(op, { stage: "failed", problem: "occupied", result_kind: "rejected" });
    const alias = f.operation({ name: "Original", requested_relative_path: f.relative("Original") }); f.insert(alias);
    assert.equal(f.sql.prepare("SELECT count(*) AS count FROM project_rename_operations").get().count, 2);
  }));

  test(`${mode} staged and destination evidence, uncertainty and atomic completion obey transition guards`, () => fixture(mode, (f) => {
    const op = f.operation({ staging_relative_path: f.relative(".rename-stage") }); f.insert(op);
    const change = (fields) => f.update(op, fields);
    for (const bad of [{ stage: "completed", result_kind: "completed", completed_revision: 8 }, { stage: "failed", problem: "occupied" },
      { stage: "completed", result_kind: "unchanged" }, { stage: "staged" },
      { stage: "uncertain" }, { stage: "uncertain", problem: "unknown" }, { last_verified_identity: identity(f.root) },
      { staged_identity: op.native_identity }, { destination_identity: "{}" }]) assert.throws(() => change(bad));
    change({ stage: "uncertain", problem: "ownership_uncertain" });
    assert.throws(() => change({ stage: "intent", problem: null }), /transition/);
    change({ stage: "staged", problem: null, staged_identity: op.native_identity, last_verified_placement: "staged" });
    assert.throws(() => change({ staged_identity: null }), /immutable/);
    assert.throws(() => change({ staged_identity: identity(f.root) }), /immutable/);
    change({ stage: "uncertain", problem: "filesystem_changed" });
    assert.throws(() => change({ last_verified_placement: "original" }), /evidence/);
    assert.throws(() => change({ stage: "completed", problem: null, result_kind: "completed", completed_revision: 8 }));
    change({ stage: "destination_recorded", problem: null, destination_identity: op.native_identity, last_verified_placement: "destination" });
    const before = records(f.sql);
    assert.throws(() => f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(op.requested_relative_path, f.projectId);
      change({ stage: "completed", result_kind: "completed", completed_revision: 8 });
    })(), /committed/);
    assert.deepEqual(records(f.sql), before);
    for (const mutation of ["UPDATE projects SET native_identity = '{}'", "UPDATE projects SET association_state = 'missing'",
      "UPDATE projects SET mode_inactive = 1", "UPDATE sources SET applied_root_identity = '{}'",
      "UPDATE sources SET excluded_relative_paths = '[\"Changed\"]'", "UPDATE sources SET canonical_root = 'other'",
      ...(mode === "grouped" ? ["UPDATE projects SET category_id = NULL, association_state = 'missing'"] : [])]) {
      assert.throws(() => f.sql.transaction(() => {
        f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(op.requested_relative_path, f.projectId);
        f.sql.prepare("UPDATE sources SET discovery_revision = 8").run(); f.sql.exec(mutation);
        change({ stage: "completed", result_kind: "completed", completed_revision: 8 });
      })());
      assert.deepEqual(records(f.sql), before);
    }
    f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(op.requested_relative_path, f.projectId);
      f.sql.prepare("UPDATE sources SET discovery_revision = 8").run();
      change({ stage: "completed", result_kind: "completed", completed_revision: 8 });
    })();
    const receipt = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    for (const bad of [{ stage: "uncertain", problem: "ownership_uncertain", completed_revision: null, result_kind: null },
      { completed_revision: 9 }, { result_kind: "unchanged" }, { last_verified_placement: "original" }]) assert.throws(() => change(bad), /immutable/);
    const next = f.operation({ name: "Next", requested_relative_path: f.relative("Next") }); f.insert(next);
    f.update(next, { stage: "destination_recorded", destination_identity: next.native_identity, last_verified_placement: "destination" });
    f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(next.requested_relative_path, f.projectId);
      f.sql.prepare("UPDATE sources SET discovery_revision = 9").run();
      f.update(next, { stage: "completed", result_kind: "completed", completed_revision: 9 });
    })();
    assert.equal(f.sql.prepare("SELECT count(*) AS count FROM project_rename_operations WHERE stage = 'completed'").get().count, 2);
    f.reopen(); assert.deepEqual(f.sql.prepare("SELECT * FROM project_rename_operations WHERE operation_id = ?").get(op.operation_id), receipt);
    assert.deepEqual(f.sql.prepare("SELECT * FROM text_property_values").all(), before.text_property_values);
    assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), before.project_creation_operations);
  }));

  test(`${mode} incomplete or non-lossless identity evidence cannot enter the journal`, () => fixture(mode, (f) => {
    for (const bad of ["{}", "not-json", "[]", ...[
      { dev: 1, ino: "2", birthtimeNs: "3" }, { dev: "1", ino: "0", birthtimeNs: "3" },
      { dev: "1", ino: "2", birthtimeNs: "0" }, { dev: "1", ino: "2" },
      { dev: "1.5", ino: "2", birthtimeNs: "3" }, { dev: "1", ino: "2", birthtimeNs: "-3" },
    ].map((value) => JSON.stringify(value))]) {
      const before = records(f.sql);
      assert.throws(() => f.sql.transaction(() => {
        // Match the persisted project binding so the full-identity CHECK is the rejecting boundary.
        f.sql.prepare("UPDATE projects SET native_identity = ? WHERE id = ?").run(bad, f.projectId);
        f.insert(f.operation({ native_identity: bad, last_verified_identity: bad }));
      })(), /CHECK|malformed JSON/);
      assert.deepEqual(records(f.sql), before);
    }
  }));

  test(`${mode} recovery can retain historical destination evidence while recording a fresh staged placement`, () => fixture(mode, (f) => {
    const op = f.operation({ staging_relative_path: f.relative(".stage") }); f.insert(op);
    f.update(op, { stage: "destination_recorded", destination_identity: op.native_identity, last_verified_placement: "destination" });
    f.update(op, { stage: "uncertain", problem: "filesystem_changed" });
    f.update(op, { stage: "staged", problem: null, staged_identity: op.native_identity, last_verified_placement: "staged" });
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.equal(row.destination_identity, op.native_identity); assert.equal(row.last_verified_placement, "staged");
    assert.throws(() => f.update(op, { destination_identity: null }), { code: "SQLITE_CONSTRAINT_TRIGGER" });
    assert.deepEqual(f.sql.prepare("SELECT * FROM project_rename_operations").get(), row);
  }));

  test(`${mode} validated unchanged receipts preserve revision and terminal history after workspace removal`, () => fixture(mode, (f) => {
    const op = f.operation({ name: "Original", requested_relative_path: f.relative("Original") }); f.insert(op);
    assert.throws(() => f.update(op, { stage: "completed", result_kind: "completed", completed_revision: 8 }));
    assert.throws(() => f.update(op, { stage: "completed", result_kind: "unchanged", completed_revision: 8 }));
    f.update(op, { stage: "completed", result_kind: "unchanged", completed_revision: 7 });
    const receipt = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources").get().discovery_revision, 7);
    assert.throws(() => f.update(op, { problem: "occupied" }), /immutable/);
    assert.throws(() => f.insert(op, true), /retained|reserved/);
    f.sql.exec("DELETE FROM active_workspace; DELETE FROM views; DELETE FROM workspaces;");
    f.reopen(); assert.deepEqual(f.sql.prepare("SELECT * FROM project_rename_operations").get(), receipt);
    const sibling = randomUUID();
    f.sql.prepare("INSERT INTO workspaces (id, name, position, source_id) VALUES (?, 'Reused', 0, ?)").run(sibling, f.sourceId);
    f.insert(f.operation({ initiating_workspace_id: sibling }));
  }));

  test(`${mode} failed/keep-original receipts require original placement and retain recorded evidence`, () => fixture(mode, (f) => {
    const op = f.operation({ staging_relative_path: f.relative(".stage") }); f.insert(op);
    f.update(op, { stage: "staged", staged_identity: op.native_identity, last_verified_placement: "staged" });
    assert.throws(() => f.update(op, { stage: "failed", problem: "occupied", result_kind: "rejected" }));
    f.update(op, { stage: "uncertain", problem: "ownership_uncertain" });
    assert.throws(() => f.update(op, { stage: "failed", problem: "occupied", result_kind: "rejected" }));
    f.update(op, { stage: "failed", last_verified_placement: "original", problem: "kept_original", result_kind: "rejected" });
    const receipt = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.equal(receipt.staged_identity, op.native_identity); assert.equal(receipt.native_identity, op.native_identity);
    assert.throws(() => f.update(op, { problem: "occupied" }), /immutable/);
    f.insert(f.operation());
  }));
}

test("late migration 0009 failure rolls back schema and all populated prior history; retry succeeds", () => fixture("grouped", (f) => {
  const broken = join(f.directory, "broken"); copyMigrations(broken);
  fs.appendFileSync(join(broken, "0009_project_rename.sql"), "\n--> statement-breakpoint\nINSERT INTO nonexistent_table VALUES ('failure');\n");
  const before = records(f.sql), schema = f.sql.prepare("SELECT * FROM sqlite_master ORDER BY name").all();
  assert.throws(() => migrate(drizzle(f.sql), { migrationsFolder: broken }), /nonexistent_table/);
  assert.deepEqual(records(f.sql), before); assert.deepEqual(f.sql.prepare("SELECT * FROM sqlite_master ORDER BY name").all(), schema);
  migrate(drizzle(f.sql), { migrationsFolder }); f.reopen();
  const after = records(f.sql);
  for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") assert.deepEqual(after[table], rows);
  assert.equal(after.__drizzle_migrations.length, 10);
}, true));
