import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";
import { isProjectCreationRequest } from "../src/contracts/project-creation.ts";
import { projectCreationOperations } from "../src/service/db/schema.ts";
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";
import { nativeObserverDependencies } from "../src/service/source-observer.ts";

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
  const open = (folder, creationFilesystem) => { service = openSettingsService(databasePath, folder, undefined, undefined, creationFilesystem); return service; };
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

// Real filesystem/SQLite, with an inert watcher scheduler for deterministic
// injected races. Production native watchers remain covered by the fixtures above.
function emptyFixture(mode, run, adapter = nativeProjectFilesystem, { configure = true, category = true } = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "create-empty-")));
  const root = join(directory, "ancestor", "root"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(root, { recursive: true });
  if (mode === "grouped" && category) fs.mkdirSync(join(root, "Category"));
  const observer = { ...nativeObserverDependencies, watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
  const service = openSettingsService(databasePath, migrationFolder, undefined, observer, adapter);
  let sql;
  try {
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Empty", rootPath: root }).value;
    if (configure) {
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode }).value;
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).ok, true);
    }
    sql = new Database(databasePath);
    const categoryId = sql.prepare("SELECT id FROM categories").get()?.id;
    const f = { directory, root, databasePath, sql, service, sourceId: workspace.sourceId, workspaceId: workspace.workspaceId, categoryId };
    run(f);
  } finally { sql?.close(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

function assertRejected(f, request, problem) {
  const result = f.service.workspaces.createProject(request);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.value.outcome, "rejected", JSON.stringify(result));
  assert.equal(result.value.problem, problem); return result.value;
}

for (const mode of ["direct", "grouped"]) {
  test(`${mode} creation works in an applied empty root/category with no implicit category or Text`, () => emptyFixture(mode, (f) => {
    const before = records(f.sql);
    const result = f.service.workspaces.createProject(command(f, "First"));
    assert.equal(result.value.outcome, "completed");
    const after = records(f.sql);
    assert.equal(after.projects.length, 1); assert.deepEqual(after.categories, before.categories);
    assert.deepEqual(after.text_property_values, []);
    assert.deepEqual(inventory(f.root), mode === "grouped" ? [["Category", [["First", []]]]] : [["First", []]]);
  }));

  test(`${mode} mkdir permission error is recorded as definitely failed without filesystem effects (simulated errno)`, () => {
    let calls = 0;
    emptyFixture(mode, (f) => {
      const before = inventory(f.root), request = command(f, "Denied"), events = [];
      f.service.workspaces.subscribe((event) => events.push(event));
      const failed = assertRejected(f, request, "permission_denied");
      assert.equal(failed.operation.stage, "failed"); assert.equal(calls, 1);
      assert.deepEqual(f.service.workspaces.createProject(request).value, failed); assert.equal(calls, 1);
      assert.deepEqual(inventory(f.root), before); assert.equal(events.length, 0);
      assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources").get().discovery_revision, request.expectedRevision);
    }, { ...nativeProjectFilesystem, mkdir() { calls++; throw Object.assign(new Error("denied"), { code: "EACCES" }); } });
  });

  test(`${mode} exclusive mkdir never overwrites a competing directory or its third-party content`, () => {
    let path;
    emptyFixture(mode, (f) => {
      const request = command(f, "Collision");
      const failed = assertRejected(f, request, "occupied");
      assert.equal(failed.operation.stage, "failed"); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects").get().n, 0);
      assert.deepEqual(inventory(path), [["sentinel", Buffer.from("third party").toString("hex")]]);
    }, { ...nativeProjectFilesystem, mkdir(target) { path = target; fs.mkdirSync(target); fs.writeFileSync(join(target, "sentinel"), "third party"); nativeProjectFilesystem.mkdir(target); } });
  });

  test(`${mode} a concurrent same-source creator sees the committed reservation before the first mkdir`, () => {
    let competing, f;
    emptyFixture(mode, (fixture) => {
      f = fixture;
      const request = command(f, "Shared");
      const created = f.service.workspaces.createProject(request);
      assert.equal(created.value.outcome, "completed"); assert.equal(competing.value.problem, "reserved_destination");
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects").get().n, 1);
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_creation_operations").get().n, 1);
    }, { ...nativeProjectFilesystem, mkdir(path) { competing = f.service.workspaces.createProject(command(f, "Shared")); nativeProjectFilesystem.mkdir(path); } });
  });

  test(`${mode} outstanding aliases and missing historical paths remain reserved without inheriting Text`, () => fixture(mode, (f) => {
    const service = f.open(), parent = mode === "grouped" ? join(f.root, "Category") : f.root;
    fs.rmSync(join(parent, "missing"), { recursive: true });
    const files = inventory(f.root), before = records(f.sql);
    for (const name of ["missing", "MISSING", "replaced", "unresolved"]) {
      const result = service.workspaces.createProject(command(f, name)); assert.equal(result.value.problem, "reserved_destination");
    }
    const op = f.operation({ name: "Reserved", relative_path: mode === "grouped" ? "Category/Reserved" : "Reserved" }); f.insert(op);
    assert.equal(service.workspaces.createProject(command(f, "reserved")).value.problem, "reserved_destination");
    assert.deepEqual(inventory(f.root), files); assert.deepEqual(records(f.sql).text_property_values, before.text_property_values);
    assert.equal(records(f.sql).projects.length, before.projects.length);
  }));

  test(`${mode} archive containment and stored exclusion aliases block creation at the containing project`, () => emptyFixture(mode, (f) => {
    const archive = mode === "grouped" ? "Category/Archive/deeper" : "Archive/deeper";
    f.sql.prepare("UPDATE sources SET archive_relative_path = ?, excluded_relative_paths = ? WHERE id = ?")
      .run(archive, JSON.stringify(mode === "grouped" ? ["Category/EXCLUDED"] : ["EXCLUDED"]), f.sourceId);
    assertRejected(f, command(f, "archive"), "archive"); assertRejected(f, command(f, "excluded"), "excluded");
    assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), []);
  }));

  test(`${mode} changed full root birthtime, link and inaccessible root fail before durable intent`, () => emptyFixture(mode, (f) => {
    const original = identity(f.root), native = JSON.parse(original);
    f.sql.prepare("UPDATE sources SET applied_root_identity = ?").run(JSON.stringify({ ...native, birthtimeNs: String(BigInt(native.birthtimeNs) + 1n) }));
    assertRejected(f, command(f), "filesystem_changed");
    f.sql.prepare("UPDATE sources SET applied_root_identity = ?").run(original);
    const moved = `${f.root}-moved`; fs.renameSync(f.root, moved);
    assertRejected(f, command(f), "source_unavailable");
    fs.symlinkSync(moved, f.root, process.platform === "win32" ? "junction" : "dir");
    assertRejected(f, command(f), "filesystem_changed");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_creation_operations").get().n, 0);
    assert.deepEqual(inventory(moved), mode === "grouped" ? [["Category", []]] : []);
  }));

  test(`${mode} mode/root/revision changes after intent prevent mkdir and preserve the immutable request`, () => {
    for (const change of ["mode", "root", "revision"]) {
      let f, calls = 0;
      emptyFixture(mode, (fixture) => {
        f = fixture; const files = inventory(f.root);
        const rejected = assertRejected(f, command(f, "Changed"), "stale_configuration");
        assert.equal(rejected.operation.stage, "failed"); assert.equal(calls, 3);
        assert.deepEqual(inventory(f.root), files);
      }, { ...nativeProjectFilesystem, names(path) {
        const names = nativeProjectFilesystem.names(path);
        if (++calls === 3) {
          if (change === "mode") {
            f.sql.prepare("UPDATE categories SET mode_inactive = 1").run();
            f.sql.prepare("UPDATE sources SET discovery_mode = ?").run(mode === "direct" ? "grouped" : "direct");
          } else if (change === "root") f.sql.prepare("UPDATE sources SET canonical_root = ?").run(`${f.root}-other`);
          else f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1").run();
        }
        return names;
      } });
    }
  });

  test(`${mode} final project transaction failure retains evidence, rolls metadata/revision back and never removes new content`, () => emptyFixture(mode, (f) => {
    const events = [], before = records(f.sql);
    f.service.workspaces.subscribe((event) => events.push(event));
    f.sql.exec("CREATE TRIGGER fail_creation BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT, 'injected metadata failure'); END");
    const request = command(f, "Fresh"), result = f.service.workspaces.createProject(request);
    assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.stage, "uncertain");
    assert.equal(result.value.operation.evidenceRecorded, true); assert.equal(result.value.operation.problem, "storage_error");
    assert.deepEqual(records(f.sql).projects, before.projects); assert.deepEqual(records(f.sql).sources, before.sources); assert.equal(events.length, 0);
    const destination = join(f.root, result.value.operation.relativePath);
    fs.writeFileSync(join(destination, "sentinel"), "third party");
    assert.deepEqual(f.service.workspaces.createProject(request), result);
    assert.deepEqual(inventory(destination), [["sentinel", Buffer.from("third party").toString("hex")]]);
    assert.equal(f.service.workspaces.createProject({ ...request, name: "Changed" }).error.code, "invalid_input");
    assert.equal(f.service.workspaces.createProject({ ...request, workspaceId: randomUUID() }).error.code, "invalid_input");
  }));
}

test("unconfigured creation and grouped sources without an existing category cannot create folders/categories", () => {
  emptyFixture("direct", (f) => {
    const before = records(f.sql); assertRejected(f, command(f, "New", { mode: "direct" }), "unconfigured");
    assert.deepEqual(records(f.sql), before); assert.deepEqual(inventory(f.root), []);
  }, nativeProjectFilesystem, { configure: false });
  emptyFixture("grouped", (f) => {
    assertRejected(f, command(f, "New", { categoryId: randomUUID() }), "category_unavailable");
    assert.deepEqual(inventory(f.root), []); assert.deepEqual(f.sql.prepare("SELECT * FROM categories").all(), []);
  }, nativeProjectFilesystem, { category: false });
});

test("grouped category ownership, active state, full identity, exclusions and archive are revalidated", () => {
  for (const changed of ["foreign", "missing", "excluded", "replaced", "unresolved", "inactive", "identity", "path", "excluded_config", "archive"]) {
    emptyFixture("grouped", (f) => {
      let request = command(f, "New");
      if (changed === "foreign") request = { ...request, categoryId: randomUUID() };
      else if (changed === "inactive") f.sql.prepare("UPDATE categories SET mode_inactive = 1").run();
      else if (["missing", "excluded", "replaced", "unresolved"].includes(changed)) f.sql.prepare("UPDATE categories SET association_state = ?").run(changed);
      else if (changed === "identity") f.sql.prepare("UPDATE categories SET native_identity = ?").run(identity(f.root));
      else if (changed === "path") f.sql.prepare("UPDATE categories SET relative_path = 'Absent'").run();
      else if (changed === "excluded_config") f.sql.prepare("UPDATE sources SET excluded_relative_paths = '[\"category\"]'").run();
      else f.sql.prepare("UPDATE sources SET archive_relative_path = 'category'").run();
      const result = f.service.workspaces.createProject(request);
      assert.equal(result.value.outcome, "rejected", changed); assert.equal(result.value.operation, null);
      assert.deepEqual(inventory(f.root), [["Category", []]]); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects").get().n, 0);
    });
  }
});

test("Windows basename rules are simulated on real fixtures without claiming Windows OS acceptance", () => {
  emptyFixture("direct", (f) => {
    const before = inventory(f.root);
    for (const name of ["CON", "con.txt", "NUL", "PRN.txt", "AUX", "COM1", "LPT9.doc", "COM¹.txt", "LPT²", "bad:name", "a\\b", "bad*", "bad?", 'bad"', "bad|", "bad<", "bad>", "trailing.", "trailing ", "a\nb", "a\x1fb", "a".repeat(256)]) {
      assertRejected(f, command(f, name), "invalid_name");
    }
    assert.deepEqual(inventory(f.root), before);
    for (const name of ["  Authored", "COM0", "COM10", "CONnotes", "Project.1", "Проект 📝"]) assert.equal(f.service.workspaces.createProject(command(f, name)).value.outcome, "completed", name);
  }, { ...nativeProjectFilesystem, platform: "win32" });
});

test("actual POSIX creation preserves colon, backslash, whitespace and line breaks", { skip: process.platform === "win32" }, () => emptyFixture("direct", (f) => {
  for (const name of ["  ", "Authored: name", "Authored\\name", "line\nbreak", "trailing.", "CON.txt"]) {
    const result = f.service.workspaces.createProject(command(f, name));
    assert.equal(result.value.outcome, "completed", name); assert.equal(result.value.project.name, name);
    assert.equal(fs.lstatSync(join(f.root, name)).isDirectory(), true);
  }
}));

test("actual POSIX write permission failures preserve root/category contents", { skip: process.platform === "win32" || process.getuid?.() === 0 }, () => {
  for (const mode of ["direct", "grouped"]) emptyFixture(mode, (f) => {
    const parent = mode === "grouped" ? join(f.root, "Category") : f.root, files = inventory(f.root);
    fs.chmodSync(parent, 0o500);
    try { assert.equal(assertRejected(f, command(f, "Denied"), "permission_denied").operation.stage, "failed"); }
    finally { fs.chmodSync(parent, 0o700); }
    assert.deepEqual(inventory(f.root), files);
  });
});

for (const mode of ["direct", "grouped"]) {
  for (const parentKind of mode === "direct" ? ["root", "ancestor"] : ["root", "category", "ancestor"]) {
    for (const point of ["before_intent", "before_mkdir", "inside_mkdir", "after_mkdir"]) {
      test(`${mode} observed ${parentKind} link swap ${point} cannot complete; inventories account for the injected external move`, () => {
        let f, namesCalls = 0, mkdirCalls = 0, moved, replacement, swapParent, movedFiles;
        const swap = () => {
          fs.renameSync(swapParent, moved);
          fs.symlinkSync(replacement, swapParent, process.platform === "win32" ? "junction" : "dir");
        };
        emptyFixture(mode, (fixture) => {
          f = fixture;
          swapParent = parentKind === "category" ? join(f.root, "Category") : parentKind === "ancestor" ? join(f.directory, "ancestor") : f.root;
          moved = join(f.directory, "moved"); replacement = join(f.directory, "outside");
          fs.mkdirSync(replacement);
          const redirectedRoot = parentKind === "ancestor" ? join(replacement, "root") : replacement;
          if (parentKind === "ancestor") fs.mkdirSync(redirectedRoot);
          if (mode === "grouped" && parentKind !== "category") fs.mkdirSync(join(redirectedRoot, "Category"));
          fs.writeFileSync(join(replacement, "outside-sentinel"), "outside bytes");
          fs.writeFileSync(join(swapParent, "original-sentinel"), "original bytes");
          const before = inventory(swapParent), outside = inventory(replacement), request = command(f, "Fresh");
          const result = f.service.workspaces.createProject(request);
          assert.equal(result.ok, true); assert.notEqual(result.value.outcome, "completed");
          if (point === "before_intent") { assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.operation, null); }
          else if (point === "before_mkdir") assert.equal(result.value.operation.stage, "failed");
          else assert.equal(result.value.outcome, "recoverable");
          assert.equal(mkdirCalls, ["inside_mkdir", "after_mkdir"].includes(point) ? 1 : 0);
          assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects").get().n, 0);
          assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources").get().discovery_revision, request.expectedRevision);
          assert.equal(fs.readFileSync(join(moved, "original-sentinel"), "utf8"), "original bytes");
          assert.equal(fs.readFileSync(join(replacement, "outside-sentinel"), "utf8"), "outside bytes");
          const relDestination = parentKind === "category" ? "Fresh" : parentKind === "ancestor" ? `root/${mode === "grouped" ? "Category/" : ""}Fresh` : `${mode === "grouped" ? "Category/" : ""}Fresh`;
          if (point === "inside_mkdir") {
            // This deliberately demonstrates the remaining validation-to-mkdir
            // race. Detecting it preserves an uncertain operation, not rollback.
            assert.deepEqual(inventory(join(replacement, relDestination)), []);
            fs.rmdirSync(join(replacement, relDestination)); // Only fixture teardown restores comparison inventory.
          }
          assert.deepEqual(inventory(replacement), outside);
          if (point === "after_mkdir") {
            assert.deepEqual(inventory(join(moved, relDestination)), [["third-party", Buffer.from("keep me").toString("hex")]]);
            assert.deepEqual(inventory(moved), movedFiles);
          } else assert.deepEqual(inventory(moved), before);
          if (point !== "before_intent") {
            const retry = f.service.workspaces.createProject(request);
            assert.deepEqual(retry, result); assert.equal(mkdirCalls, ["inside_mkdir", "after_mkdir"].includes(point) ? 1 : 0);
          }
        }, { ...nativeProjectFilesystem,
          names(path) {
            const names = nativeProjectFilesystem.names(path);
            if (++namesCalls === (point === "before_intent" ? 1 : point === "before_mkdir" ? 3 : -1)) swap();
            return names;
          },
          mkdir(path) {
            mkdirCalls++;
            if (point === "inside_mkdir") swap();
            nativeProjectFilesystem.mkdir(path);
            if (point === "after_mkdir") {
              fs.writeFileSync(join(path, "third-party"), "keep me"); swap(); movedFiles = inventory(moved);
            }
          },
        });
      });
    }
  }

  for (const replacementKind of ["directory", "link"]) {
    test(`${mode} destination ${replacementKind} swap after metadata writes rolls back completion and retains immutable evidence`, () => {
      let f, evidenceReads = 0, moved, outside;
      emptyFixture(mode, (fixture) => {
        f = fixture; const request = command(f, "Fresh"), before = records(f.sql), events = [];
        f.service.workspaces.subscribe((event) => events.push(event));
        outside = join(f.directory, "outside"); fs.mkdirSync(outside); fs.writeFileSync(join(outside, "sentinel"), "outside bytes");
        const result = f.service.workspaces.createProject(request);
        assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.problem, "filesystem_changed");
        assert.equal(result.value.operation.evidenceRecorded, true); assert.equal(result.value.operation.stage, "uncertain");
        const op = f.sql.prepare("SELECT * FROM project_creation_operations").get();
        assert.equal(op.native_identity, identity(moved)); assert.deepEqual(records(f.sql).projects, before.projects);
        assert.deepEqual(records(f.sql).sources, before.sources); assert.equal(events.length, 0);
        assert.deepEqual(inventory(moved), [["third-party", Buffer.from("preserved").toString("hex")]]);
        assert.deepEqual(inventory(outside), [["sentinel", Buffer.from("outside bytes").toString("hex")]]);
        assert.deepEqual(f.service.workspaces.createProject(request), result); assert.equal(evidenceReads, 3);
      }, { ...nativeProjectFilesystem, inspect(path) {
        if (basename(path) === "Fresh" && f?.sql.prepare("SELECT stage FROM project_creation_operations").get()?.stage === "evidence_recorded" && ++evidenceReads === 3) {
          fs.writeFileSync(join(path, "third-party"), "preserved");
          moved = join(f.directory, "created-moved"); fs.renameSync(path, moved);
          if (replacementKind === "directory") fs.mkdirSync(path);
          else fs.symlinkSync(outside, path, process.platform === "win32" ? "junction" : "dir");
        }
        return nativeProjectFilesystem.inspect(path);
      } });
    });
  }
}

test("same-source sibling notifications exclude unrelated sources and survive throwing/reentrant subscribers", () => emptyFixture("direct", (f) => {
  const sibling = f.service.workspaces.create({ type: "workspace.create", rootPath: f.root, name: "Sibling" }).value;
  const unrelatedRoot = join(f.directory, "unrelated"); fs.mkdirSync(unrelatedRoot); fs.writeFileSync(join(unrelatedRoot, "sentinel"), "unchanged");
  const unrelated = f.service.workspaces.create({ type: "workspace.create", rootPath: unrelatedRoot, name: "Other" }).value;
  const unchanged = records(f.sql), events = [];
  f.service.workspaces.subscribe(() => { throw new Error("subscriber failure"); });
  f.service.workspaces.subscribe((event) => {
    if (event.type !== "workspace.projectsChanged") return;
    events.push(event);
    assert.equal(f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.workspaceId }).value.projects.length, 1);
  });
  const request = command(f, "Fresh");
  const created = f.service.workspaces.createProject(request); assert.equal(created.value.outcome, "completed");
  assert.deepEqual(events, [{ type: "workspace.projectsChanged", sourceId: f.sourceId, revision: request.expectedRevision + 1, workspaceIds: [f.workspaceId, sibling.workspaceId] }]);
  const after = records(f.sql);
  assert.deepEqual(after.sources.find((s) => s.id === unrelated.sourceId), unchanged.sources.find((s) => s.id === unrelated.sourceId));
  assert.deepEqual(after.views, unchanged.views); assert.deepEqual(after.active_workspace, unchanged.active_workspace);
  assert.deepEqual(inventory(unrelatedRoot), [["sentinel", Buffer.from("unchanged").toString("hex")]]);
  assert.equal(f.service.workspaces.createProject({ ...request, workspaceId: sibling.workspaceId }).error.code, "invalid_input");
  assert.equal(f.service.workspaces.createProject({ ...request, workspaceId: unrelated.workspaceId }).error.code, "invalid_input");
}));

for (const mode of ["direct", "grouped"]) {
  test(`${mode} a second SQLite connection cannot create a reserved destination while the initiating mkdir is pending`, () => {
    let f, competing;
    emptyFixture(mode, (fixture) => {
      f = fixture;
      const request = command(f, "Concurrent"), result = f.service.workspaces.createProject(request);
      assert.equal(result.value.outcome, "completed"); assert.equal(competing.value.problem, "reserved_destination");
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_creation_operations").get().n, 1);
    }, { ...nativeProjectFilesystem, mkdir(path) {
      const service = openSettingsService(f.databasePath, migrationFolder, undefined,
        { ...nativeObserverDependencies, watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } });
      try { competing = service.workspaces.createProject(command(f, "concurrent")); }
      finally { service.close(); }
      nativeProjectFilesystem.mkdir(path);
    } });
  });

  test(`${mode} native conflict with a retained logical project leaves the created directory recoverable`, () => {
    let f;
    emptyFixture(mode, (fixture) => {
      f = fixture;
      const result = f.service.workspaces.createProject(command(f, "Fresh"));
      assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.problem, "native_conflict");
      assert.equal(result.value.operation.evidenceRecorded, false);
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects").get().n, 1);
      assert.deepEqual(inventory(join(f.root, result.value.operation.relativePath)), []);
    }, { ...nativeProjectFilesystem, mkdir(path) {
      nativeProjectFilesystem.mkdir(path);
      f.sql.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id) VALUES (?, ?, ?, ?, 'missing', ?)")
        .run(randomUUID(), f.sourceId, mode === "direct" ? "History" : "Category/History", identity(path), mode === "direct" ? null : f.categoryId);
    } });
  });

  test(`${mode} intent/evidence/diagnostic storage failures retain the correct durable stage without folder cleanup`, () => {
    for (const point of ["intent", "evidence", "diagnostic"]) {
      emptyFixture(mode, (f) => {
        const before = records(f.sql), request = command(f, "Fresh");
        if (point === "intent") f.sql.exec("CREATE TRIGGER inject BEFORE INSERT ON project_creation_operations BEGIN SELECT RAISE(ABORT, 'intent failure'); END");
        else if (point === "evidence") f.sql.exec("CREATE TRIGGER inject BEFORE UPDATE ON project_creation_operations WHEN NEW.stage = 'evidence_recorded' BEGIN SELECT RAISE(ABORT, 'evidence failure'); END");
        else f.sql.exec("CREATE TRIGGER inject BEFORE UPDATE ON project_creation_operations WHEN NEW.stage = 'uncertain' BEGIN SELECT RAISE(ABORT, 'diagnostic failure'); END; CREATE TRIGGER inject_project BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT, 'project failure'); END");
        const result = f.service.workspaces.createProject(request);
        assert.equal(result.ok, true);
        assert.deepEqual(records(f.sql).projects, before.projects); assert.deepEqual(records(f.sql).sources, before.sources);
        if (point === "intent") {
          assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "storage_error");
          assert.equal(result.value.operation, null); assert.deepEqual(inventory(f.root), mode === "direct" ? [] : [["Category", []]]);
        } else {
          assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.stage, point === "evidence" ? "uncertain" : "evidence_recorded");
          assert.equal(result.value.operation.evidenceRecorded, point === "diagnostic");
          const path = join(f.root, result.value.operation.relativePath); fs.writeFileSync(join(path, "sentinel"), "retained");
          assert.deepEqual(f.service.workspaces.createProject(request), result);
          assert.deepEqual(inventory(path), [["sentinel", Buffer.from("retained").toString("hex")]]);
        }
      });
    }
  });

  test(`${mode} an ambiguous mkdir exception after creating third-party content retains intent and reserved ID`, () => {
    let calls = 0;
    emptyFixture(mode, (f) => {
      const request = command(f, "Fresh"), result = f.service.workspaces.createProject(request);
      assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.stage, "uncertain");
      assert.equal(result.value.operation.evidenceRecorded, false); assert.equal(result.value.operation.problem, "filesystem_error");
      assert.deepEqual(f.service.workspaces.createProject(request), result); assert.equal(calls, 1);
      assert.deepEqual(inventory(join(f.root, result.value.operation.relativePath)), [["sentinel", Buffer.from("third party").toString("hex")]]);
    }, { ...nativeProjectFilesystem, mkdir(path) {
      calls++; nativeProjectFilesystem.mkdir(path); fs.writeFileSync(join(path, "sentinel"), "third party");
      throw Object.assign(new Error("uncertain adapter outcome"), { code: "EIO" });
    } });
  });
}

test("actual Unicode spellings are retained and canonically equivalent occupied names collide", () => emptyFixture("direct", (f) => {
  const result = f.service.workspaces.createProject(command(f, "Café"));
  assert.equal(result.value.outcome, "completed"); assert.equal(result.value.project.name, "Café");
  assert.equal(f.service.workspaces.createProject(command(f, "Cafe\u0301")).value.problem, "reserved_destination");
  fs.mkdirSync(join(f.root, "Résumé"));
  assertRejected(f, command(f, "Re\u0301sume\u0301"), "case_alias");
}));

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

function command(f, name = "New project", extra = {}) {
  return { type: "workspace.createProject", workspaceId: f.workspaceId, operationId: randomUUID(), name,
    mode: f.sql.prepare("SELECT discovery_mode FROM sources WHERE id = ?").get(f.sourceId).discovery_mode,
    expectedRevision: f.sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.sourceId).discovery_revision,
    ...(f.sql.prepare("SELECT discovery_mode FROM sources WHERE id = ?").get(f.sourceId).discovery_mode === "grouped" ? { categoryId: f.categoryId } : {}), ...extra };
}

for (const mode of ["direct", "grouped"]) {
  test(`${mode} real creation commits one fresh durable ID, exact name and sibling event while preserving metadata`, () => fixture(mode, (f) => {
    const service = f.open(), before = records(f.sql), files = inventory(f.root), events = [];
    service.workspaces.subscribe((event) => { if (event.type === "workspace.projectsChanged") {
      assert.equal(f.sql.prepare("SELECT stage FROM project_creation_operations").get().stage, "completed"); events.push(event);
    } });
    const request = command(f, "  Authored проект 📝  ");
    const result = service.handleCommand(request);
    assert.equal(result.ok, true); assert.equal(result.value.outcome, "completed");
    const created = result.value.project;
    assert.equal(created.name, request.name); assert.equal(created.relativePath, mode === "grouped" ? `Category/${request.name}` : request.name);
    assert.equal(created.categoryId, mode === "grouped" ? f.categoryId : null); assert.equal(created.revision, 8);
    assert.deepEqual(inventory(join(f.root, created.relativePath)), []);
    const after = records(f.sql);
    assert.equal(after.projects.length, before.projects.length + 1);
    for (const table of ["settings", "workspaces", "views", "active_workspace", "categories", "category_properties", "property_definitions", "text_property_values"]) assert.deepEqual(after[table], before[table], table);
    assert.deepEqual(after.projects.filter((p) => p.id !== created.projectId), before.projects);
    assert.deepEqual(after.sources, before.sources.map((s) => ({ ...s, discovery_revision: 8 })));
    assert.equal(after.project_creation_operations[0].native_identity, identity(join(f.root, created.relativePath)));
    assert.deepEqual(events, [{ type: "workspace.projectsChanged", sourceId: f.sourceId, revision: 8, workspaceIds: [f.workspaceId, f.siblingId] }]);
    assert.deepEqual(service.handleCommand(request), result); assert.equal(events.length, 1);
    const afterFiles = inventory(f.root);
    if (mode === "direct") assert.deepEqual(afterFiles.filter(([name]) => name !== request.name), files);
    else assert.deepEqual(afterFiles.map(([name, entries]) => [name, name === "Category" ? entries.filter(([name]) => name !== request.name) : entries]), files);
    f.close(); const reopened = f.open(); assert.deepEqual(reopened.handleCommand(request), result);
    assert.ok(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.siblingId }).value.projects.some((p) => p.projectId === created.projectId));
  }));

  test(`${mode} rejects unsafe names, occupied content, configuration and ownership without effects`, () => fixture(mode, (f) => {
    const service = f.open(), before = records(f.sql), files = inventory(f.root);
    const reject = (request, problem) => {
      const result = service.workspaces.createProject(request);
      assert.equal(result.ok, true); assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, problem);
      assert.equal(result.value.operation, null);
    };
    for (const name of ["", ".", "..", "../Escape", "a/b", "a\0b", "bad\ud800name"]) reject(command(f, name), "invalid_name");
    for (const name of [".hidden", "$RECYCLE.BIN", "System Volume Information", "Excluded"]) reject(command(f, name), "excluded");
    reject(command(f, "New", { expectedRevision: 6 }), "stale_configuration");
    const otherMode = command(f, "New", { mode: mode === "direct" ? "grouped" : "direct", categoryId: f.categoryId });
    if (mode === "grouped") delete otherMode.categoryId;
    reject(otherMode, "stale_configuration");
    reject(command(f, "active"), "reserved_destination");
    const parent = mode === "grouped" ? join(f.root, "Category") : f.root;
    fs.mkdirSync(join(parent, "Occupied")); fs.writeFileSync(join(parent, "File"), "original");
    const occupied = inventory(f.root);
    for (const name of ["Occupied", "File"]) reject(command(f, name), "occupied");
    reject(command(f, "occupied"), "case_alias");
    assert.deepEqual(inventory(f.root), occupied);
    for (const request of [command(f, "New", { workspaceId: randomUUID() }), { ...command(f), extra: "injected" }, command(f, "New", { operationId: "bad" })]) assert.equal(service.workspaces.createProject(request).error.code, "invalid_input");
    assert.deepEqual(records(f.sql), before);
    fs.rmSync(join(parent, "Occupied"), { recursive: true }); fs.unlinkSync(join(parent, "File"));
    assert.deepEqual(inventory(f.root), files);
  }));
}
