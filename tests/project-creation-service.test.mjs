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
import { isProjectCreationRequest } from "../src/contracts/project-creation.ts";
import { projectCreationOperations } from "../src/service/db/schema.ts";

const migrationFolder = "src/service/db/migrations";
const journal = JSON.parse(fs.readFileSync(join(migrationFolder, "meta/_journal.json"), "utf8"));
const identity = (path) => {
  const stat = fs.lstatSync(path, { bigint: true });
  return JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) });
};
function copyMigrations(destination, count = journal.entries.length) {
  fs.mkdirSync(join(destination, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, count);
  for (const entry of entries) fs.copyFileSync(join(migrationFolder, `${entry.tag}.sql`), join(destination, `${entry.tag}.sql`));
  fs.writeFileSync(join(destination, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
}
function records(sqlite) {
  return Object.fromEntries(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(({ name }) =>
    [name, sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
}
function inventory(path) {
  return fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [entry.name,
    entry.isDirectory() ? inventory(join(path, entry.name)) : fs.readFileSync(join(path, entry.name)).toString("hex")]);
}
function fixture(mode, run, legacy = false) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "project-creation-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(root);
  const sourceId = randomUUID(), workspaceId = randomUUID(), siblingId = randomUUID(), categoryId = randomUUID();
  const sql = new Database(databasePath);
  let service;
  const open = (folder) => { service = openSettingsService(databasePath, folder); return service; };
  const close = () => { service?.close(); service = undefined; };
  try {
    let folder = migrationFolder;
    if (legacy) { folder = join(directory, "legacy"); copyMigrations(folder, 8); }
    migrate(drizzle(sql), { migrationsFolder: folder }); sql.pragma("foreign_keys = ON");
    sql.prepare("INSERT INTO settings VALUES ('language', 'ru')").run();
    fs.mkdirSync(join(root, "Category"));
    sql.prepare(`INSERT INTO sources (id, canonical_root, discovery_mode, discovery_revision, property_revision,
      category_property_revision, excluded_relative_paths, archive_relative_path, applied_root_identity)
      VALUES (?, ?, ?, 7, 9, 11, '["Excluded","Category/Excluded"]', 'Archive', ?)`)
      .run(sourceId, root, mode, identity(root));
    for (const [id, position] of [[workspaceId, 0], [siblingId, 1]]) {
      const viewId = randomUUID();
      sql.prepare("INSERT INTO workspaces (id, name, source_id, position) VALUES (?, ?, ?, ?)").run(id, `  Workspace ${position}  `, sourceId, position);
      sql.prepare("INSERT INTO views VALUES (?, ?, 'Table', 'table')").run(viewId, id);
      if (position === 1) sql.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(id, viewId);
    }
    sql.prepare(`INSERT INTO categories (id, source_id, relative_path, native_identity, association_state, mode_inactive)
      VALUES (?, ?, 'Category', ?, 'active', ?)`)
      .run(categoryId, sourceId, identity(join(root, "Category")), mode === "direct" ? 1 : 0);
    // Seed a retained category label through a valid prior grouped interpretation.
    if (mode === "direct") sql.prepare("UPDATE sources SET discovery_mode = 'grouped' WHERE id = ?").run(sourceId);
    sql.prepare("INSERT INTO category_properties VALUES (?, ?, '  Authored category  ')").run(randomUUID(), sourceId);
    if (mode === "direct") sql.prepare("UPDATE sources SET discovery_mode = 'direct' WHERE id = ?").run(sourceId);
    const propertyId = randomUUID();
    sql.prepare("INSERT INTO property_definitions VALUES (?, ?, '  Notes  ', 'text', 0)").run(propertyId, sourceId);
    for (const state of ["active", "excluded", "missing", "unresolved", "replaced"]) {
      const relativePath = mode === "grouped" ? `Category/${state}` : state;
      fs.mkdirSync(join(root, relativePath)); fs.writeFileSync(join(root, relativePath, "sentinel"), Buffer.from([0, 255, 42]));
      const projectId = randomUUID();
      sql.prepare(`INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .run(projectId, sourceId, relativePath, identity(join(root, relativePath)), state, mode === "grouped" ? categoryId : null);
      sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, sourceId, `  ${state}\nТекст 📝  `);
    }
    // Keep dormant records of the other interpretation with independent logical IDs and Text.
    const dormantPath = mode === "grouped" ? "Dormant" : "Category/Dormant";
    fs.mkdirSync(join(root, dormantPath));
    const dormantId = randomUUID();
    sql.prepare(`INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id, mode_inactive)
      VALUES (?, ?, ?, ?, 'active', ?, 1)`)
      .run(dormantId, sourceId, dormantPath, identity(join(root, dormantPath)), mode === "direct" ? categoryId : null);
    sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, '')").run(dormantId, propertyId, sourceId);
    const operation = (extra = {}) => ({
      operation_id: randomUUID(), source_id: sourceId, initiating_workspace_id: workspaceId, project_id: randomUUID(), name: "  New project  ",
      mode, expected_revision: 7, category_id: mode === "grouped" ? categoryId : null, canonical_root: root,
      parent_relative_path: mode === "grouped" ? "Category" : "", relative_path: mode === "grouped" ? "Category/  New project  " : "  New project  ",
      root_identity: identity(root), parent_identity: identity(mode === "grouped" ? join(root, "Category") : root),
      excluded_relative_paths: '["Excluded","Category/Excluded"]', archive_relative_path: "Archive", stage: "intent", ...extra,
    });
    const insert = (row, replace = false) => sql.prepare(`INSERT ${replace ? "OR REPLACE " : ""}INTO project_creation_operations (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`).run(...Object.values(row));
    run({ directory, root, databasePath, sql, sourceId, workspaceId, siblingId, categoryId, operation, insert, open, close });
  } finally { close(); if (sql.open) sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("creation and reviewed recovery requests accept exact ID-only payloads and preserve authored names", () => {
  const workspaceId = randomUUID(), operationId = randomUUID(), categoryId = randomUUID(), previewToken = randomUUID();
  const create = { type: "workspace.createProject", workspaceId, operationId, name: "  Authored: name  ", mode: "direct", expectedRevision: 0 };
  const requests = [create, { ...create, mode: "grouped", categoryId },
    { type: "workspace.listProjectCreations", workspaceId },
    { type: "workspace.getProjectCreation", workspaceId, operationId },
    { type: "workspace.previewProjectCreationRecovery", workspaceId, operationId },
    ...["retry_missing", "complete_recorded", "associate_reviewed"].map((action) => ({ type: "workspace.recoverProjectCreation", workspaceId, operationId, previewToken, action }))];
  for (const request of requests) {
    assert.equal(isProjectCreationRequest(request), true, JSON.stringify(request));
    for (const field of ["destinationPath", "nativeIdentity", "projectId", "extra"]) assert.equal(isProjectCreationRequest({ ...request, [field]: "unsafe" }), false);
    assert.equal(isProjectCreationRequest({ ...request, workspaceId: "foreign-format" }), false);
  }
  for (const request of [null, [], { ...create, categoryId }, { ...create, mode: "grouped" }, { ...create, mode: "other" },
    { ...create, operationId: "invalid" }, { ...create, expectedRevision: -1 }, { ...create, expectedRevision: 1.5 },
    { ...create, expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { ...create, name: null },
    { ...requests.at(-1), action: "automatic" }, { ...requests.at(-1), previewToken: "invalid" }]) assert.equal(isProjectCreationRequest(request), false);
  assert.equal(create.name, "  Authored: name  ");
});

for (const mode of ["direct", "grouped"]) {
  test(`actual populated 0000–0007 ${mode} upgrade and reopen preserve all identities, values, configuration and files`, () => fixture(mode, (f) => {
    const before = records(f.sql), files = inventory(f.root);
    assert.equal(before.__drizzle_migrations.length, 8);
    for (let attempt = 0; attempt < 2; attempt++) {
      const service = f.open();
      const after = records(f.sql);
      for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") assert.deepEqual(after[table], rows, table);
      assert.deepEqual(after.project_creation_operations, []);
      assert.deepEqual(after.__drizzle_migrations.slice(0, 8), before.__drizzle_migrations);
      assert.equal(after.__drizzle_migrations.length, 9);
      assert.deepEqual(f.sql.pragma("foreign_key_check"), []);
      assert.equal(service.handleQuery({ type: "settings.load" }).value.language, "ru");
      assert.deepEqual(inventory(f.root), files); f.close();
    }
  }, true));

  test(`${mode} intent binds current source, immutable request, fresh ID and an outstanding path reservation`, () => fixture(mode, (f) => {
    const op = f.operation(); f.insert(op);
    const original = records(f.sql);
    assert.throws(() => f.insert(f.operation()), /retained/);
    assert.throws(() => f.insert(f.operation(), true), /retained/);
    const altered = f.operation({ operation_id: op.operation_id, name: "Other", relative_path: mode === "grouped" ? "Category/Other" : "Other" });
    assert.throws(() => f.insert(altered), /retained/);
    assert.throws(() => f.insert(altered, true), /retained/);
    assert.throws(() => f.insert({ ...altered, operation_id: randomUUID(), project_id: op.project_id }, true), /retained/);
    assert.throws(() => f.insert(f.operation({ project_id: original.projects[0].id })), /fresh ID/);
    for (const changes of [{ initiating_workspace_id: randomUUID() }, { source_id: randomUUID() }, { expected_revision: 6 },
      { canonical_root: join(f.directory, "outside") }, { root_identity: JSON.stringify({ dev: "1", ino: "2", birthtimeNs: "3" }) },
      { excluded_relative_paths: "[]" }, { archive_relative_path: null }, { stage: "uncertain", problem: "ownership_uncertain" },
      { relative_path: "../escape" }, { name: "../escape" }, { category_id: randomUUID() }]) {
      assert.throws(() => f.insert(f.operation(changes)), JSON.stringify(changes));
    }
    for (const field of ["operation_id", "source_id", "initiating_workspace_id", "project_id", "name", "mode", "expected_revision", "category_id",
      "canonical_root", "parent_relative_path", "relative_path", "root_identity", "parent_identity", "excluded_relative_paths", "archive_relative_path"]) {
      assert.throws(() => f.sql.prepare(`UPDATE project_creation_operations SET ${field} = ? WHERE operation_id = ?`).run(field === "expected_revision" ? 8 : "changed", op.operation_id), /immutable/);
    }
    assert.throws(() => f.sql.prepare("DELETE FROM project_creation_operations").run(), /retained/);
    assert.deepEqual(records(f.sql), original);
    const mapped = drizzle(f.sql).select().from(projectCreationOperations).get();
    assert.equal(mapped.operationId, op.operation_id); assert.equal(mapped.projectId, op.project_id); assert.equal(mapped.stage, "intent");
  }));

  test(`${mode} stage/evidence guards require sufficient immutable evidence and atomically completed metadata`, () => fixture(mode, (f) => {
    const op = f.operation(); f.insert(op);
    const update = (fields) => f.sql.prepare(`UPDATE project_creation_operations SET ${Object.keys(fields).map((key) => `${key} = ?`).join(", ")} WHERE operation_id = ?`).run(...Object.values(fields), op.operation_id);
    for (const native of [null, "{}", "not-json", JSON.stringify({ dev: 1, ino: "2", birthtimeNs: "3" }),
      JSON.stringify({ dev: "1", ino: "0", birthtimeNs: "3" }), JSON.stringify({ dev: "1", ino: "2", birthtimeNs: "0" })]) {
      assert.throws(() => update({ stage: "evidence_recorded", native_identity: native }));
    }
    assert.throws(() => update({ stage: "uncertain" }));
    assert.throws(() => update({ stage: "uncertain", problem: "invented" }));
    update({ stage: "uncertain", problem: "ownership_uncertain" });
    assert.throws(() => update({ stage: "intent", problem: null }), /transition/);
    assert.throws(() => update({ stage: "completed", problem: null, completed_revision: 8 }));
    fs.mkdirSync(join(f.root, op.relative_path));
    const native = identity(join(f.root, op.relative_path));
    update({ stage: "evidence_recorded", native_identity: native, problem: null });
    assert.throws(() => update({ native_identity: identity(f.root) }), /immutable/);
    assert.throws(() => update({ native_identity: null }), /immutable/);
    assert.throws(() => update({ stage: "completed", completed_revision: null }));
    assert.throws(() => update({ stage: "completed", completed_revision: 8 }), /committed project/);
    const insertProject = (evidence = native) => f.sql.prepare(`INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id)
      VALUES (?, ?, ?, ?, 'active', ?)`).run(op.project_id, f.sourceId, op.relative_path, evidence, op.category_id);
    assert.throws(() => insertProject(identity(f.root)), /Reserved project ID/);
    const before = records(f.sql);
    assert.throws(() => f.sql.transaction(() => { insertProject(); update({ stage: "completed", completed_revision: 8 }); })(), /committed project/);
    assert.deepEqual(records(f.sql), before);
    f.sql.transaction(() => {
      insertProject(); f.sql.prepare("UPDATE sources SET discovery_revision = 8 WHERE id = ?").run(f.sourceId);
      update({ stage: "completed", completed_revision: 8 });
    })();
    const completed = f.sql.prepare("SELECT * FROM project_creation_operations").get();
    assert.equal(completed.project_id, op.project_id); assert.equal(completed.stage, "completed"); assert.equal(completed.completed_revision, 8);
    assert.throws(() => update({ stage: "uncertain", completed_revision: null, problem: "ownership_uncertain" }), /immutable/);
    assert.throws(() => update({ completed_revision: 9 }), /immutable/);
    assert.deepEqual(f.sql.prepare("SELECT * FROM text_property_values WHERE project_id = ?").all(op.project_id), []);
    const service = f.open(); assert.equal(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspaceId }).value.projects.some((p) => p.projectId === op.project_id), true);
    f.close(); f.open(); assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").get(), completed);
  }));

  test(`${mode} operation history and outstanding reservation survive final workspace removal and source reuse`, () => fixture(mode, (f) => {
    const op = f.operation(); f.insert(op);
    f.sql.prepare("UPDATE project_creation_operations SET stage = 'uncertain', problem = 'ownership_uncertain' WHERE operation_id = ?").run(op.operation_id);
    const before = f.sql.prepare("SELECT * FROM project_creation_operations").all(), files = inventory(f.root);
    const service = f.open();
    for (const workspaceId of [f.workspaceId, f.siblingId]) assert.equal(service.workspaces.remove({ type: "workspace.remove", workspaceId }).ok, true);
    assert.equal(f.sql.prepare("SELECT count(*) AS count FROM workspaces").get().count, 0);
    f.close();
    const reopened = f.open();
    const reused = reopened.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root });
    assert.equal(reused.ok, true); assert.equal(reused.value.sourceId, f.sourceId);
    assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), before);
    assert.deepEqual(inventory(f.root), files);
    assert.throws(() => f.insert(f.operation({ initiating_workspace_id: reused.value.workspaceId })), /retained/);
  }));
}

test("a definitively failed intent retains immutable history and reserved UUID while releasing the outstanding path", () => fixture("direct", (f) => {
  const op = f.operation(); f.insert(op);
  f.sql.prepare("UPDATE project_creation_operations SET stage = 'failed', problem = 'occupied' WHERE operation_id = ?").run(op.operation_id);
  const retry = f.operation(); f.insert(retry);
  assert.throws(() => f.sql.prepare("UPDATE project_creation_operations SET stage = 'intent', problem = NULL WHERE operation_id = ?").run(op.operation_id), /immutable/);
  assert.throws(() => f.insert(f.operation({ project_id: op.project_id, name: "Other", relative_path: "Other" })), /retained/);
  const before = records(f.sql);
  assert.throws(() => f.insert({ ...op, project_id: randomUUID(), name: "Other", relative_path: "Other" }, true), /retained/);
  assert.deepEqual(records(f.sql), before);
  assert.equal(f.sql.prepare("SELECT count(*) AS count FROM project_creation_operations").get().count, 2);
}));

test("grouped intents cannot reserve a missing, inactive, excluded, foreign or changed parent", () => fixture("grouped", (f) => {
  for (const changes of [{ parent_relative_path: "Other", relative_path: "Other/  New project  " }, { parent_identity: identity(f.root) }]) assert.throws(() => f.insert(f.operation(changes)));
  f.sql.prepare("UPDATE projects SET association_state = 'missing' WHERE category_id = ?").run(f.categoryId);
  for (const state of ["excluded", "missing", "unresolved", "replaced"]) {
    f.sql.prepare("UPDATE categories SET association_state = ? WHERE id = ?").run(state, f.categoryId);
    assert.throws(() => f.insert(f.operation()), /source configuration/);
  }
  f.sql.prepare("UPDATE categories SET mode_inactive = 1 WHERE id = ?").run(f.categoryId);
  assert.throws(() => f.insert(f.operation()), /source configuration/);
}));

test("late migration failure rolls back journal/schema changes and every populated 0000–0007 row; retry and reopen work", () => fixture("grouped", (f) => {
  const broken = join(f.directory, "broken"); copyMigrations(broken);
  fs.appendFileSync(join(broken, "0008_project_creation.sql"), "\n--> statement-breakpoint\nINSERT INTO nonexistent_table VALUES ('injected migration failure');\n");
  const before = records(f.sql), schema = f.sql.prepare("SELECT * FROM sqlite_master ORDER BY name").all(), files = inventory(f.root);
  assert.throws(() => f.open(broken), /nonexistent_table/);
  assert.deepEqual(records(f.sql), before);
  assert.deepEqual(f.sql.prepare("SELECT * FROM sqlite_master ORDER BY name").all(), schema);
  assert.deepEqual(inventory(f.root), files);
  f.open(); f.close(); f.open();
  const after = records(f.sql);
  for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") assert.deepEqual(after[table], rows);
  assert.equal(after.__drizzle_migrations.length, 9); assert.deepEqual(after.project_creation_operations, []);
  assert.deepEqual(inventory(f.root), files);
}, true));
