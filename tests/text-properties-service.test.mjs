import test from "node:test";

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "text-properties-"));
  const root = join(directory, "root"), otherRoot = join(directory, "other");
  mkdirSync(root); mkdirSync(otherRoot); mkdirSync(join(root, "Project"));
  writeFileSync(join(root, "Project", "keep"), "unchanged bytes");
  const databasePath = join(directory, "workspace.sqlite");
  let service = openSettingsService(databasePath);
  const create = (path, name) => service.handleCommand({ type: "workspace.create", rootPath: path, name }).value;
  const one = create(root, "One"), sibling = create(root, "Sibling"), other = create(otherRoot, "Other");
  try { run({ directory, root, databasePath, one, sibling, other, get service() { return service; }, reopen() { service.close(); service = openSettingsService(databasePath); } }); }
  finally { service.close(); rmSync(directory, { recursive: true, force: true }); }
}
const list = (service, workspaceId) => service.handleQuery({ type: "workspace.listTextProperties", workspaceId });
const createProperty = (service, workspaceId, name = "  Заметки 📝  ") => service.handleCommand({ type: "workspace.createProperty", workspaceId, name, propertyType: "text" });
const rename = (service, workspaceId, propertyId, name) => service.handleCommand({ type: "workspace.renameProperty", workspaceId, propertyId, name });

test("Text definitions preserve authored names, stable order/IDs, sibling ownership and persisted revisions", () => fixture((f) => {
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const preview = f.service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: f.one.workspaceId }).value;
  const first = createProperty(f.service, f.one.workspaceId);
  assert.equal(first.ok, true);
  const second = createProperty(f.service, f.sibling.workspaceId);
  assert.equal(second.ok, true);
  assert.notEqual(first.value.propertyId, second.value.propertyId);
  assert.deepEqual(second.value.snapshot.definitions.map((p) => p.name), ["  Заметки 📝  ", "  Заметки 📝  "]);
  assert.deepEqual(events.map((e) => e.revision), [1, 2]);
  assert.deepEqual(events[0].workspaceIds, [f.one.workspaceId, f.sibling.workspaceId]);
  assert.deepEqual(list(f.service, f.other.workspaceId).value.definitions, []);
  const changed = rename(f.service, f.sibling.workspaceId, first.value.propertyId, "\t新しい имя\n");
  assert.equal(changed.value.snapshot.revision, 3);
  assert.equal(changed.value.propertyId, first.value.propertyId);
  assert.equal(changed.value.snapshot.definitions[0].name, "\t新しい имя\n");
  assert.deepEqual(rename(f.service, f.one.workspaceId, first.value.propertyId, "\t新しい имя\n").value.snapshot, changed.value.snapshot.workspaceId === f.one.workspaceId ? changed.value.snapshot : { ...changed.value.snapshot, workspaceId: f.one.workspaceId });
  assert.equal(events.length, 3);
  assert.equal(f.service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: f.one.workspaceId, previewToken: preview.previewToken }).ok, true, "property revision must not invalidate discovery preview");
  const before = list(f.service, f.one.workspaceId);
  f.reopen(); f.reopen(); assert.deepEqual(list(f.service, f.one.workspaceId), before);
  assert.equal(readFileSync(join(f.root, "Project", "keep"), "utf8"), "unchanged bytes");
}));

test("invalid IDs, names, extra keys, types and foreign definitions fail without writes or events", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const before = list(f.service, f.one.workspaceId);
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const base = { type: "workspace.createProperty", workspaceId: f.one.workspaceId, name: "Name", propertyType: "text" };
  for (const input of [null, {}, { ...base, name: " \n\t" }, { ...base, name: 42 }, { ...base, propertyType: "number" },
    { ...base, workspaceId: "bad" }, { ...base, workspaceId: randomUUID() }, { ...base, extra: true },
    { type: "workspace.renameProperty", workspaceId: f.one.workspaceId, propertyId, name: "Changed", propertyType: "number" },
    { type: "workspace.renameProperty", workspaceId: f.other.workspaceId, propertyId, name: "Foreign" },
    { type: "workspace.renameProperty", workspaceId: f.one.workspaceId, propertyId: randomUUID(), name: "Missing" },
    { type: "workspace.renameProperty", workspaceId: f.one.workspaceId, propertyId: "bad", name: "Bad" },
    { type: "workspace.renameProperty", workspaceId: f.one.workspaceId, propertyId, name: " " }]) {
    assert.equal(f.service.handleCommand(input).error.code, "invalid_input");
    assert.deepEqual(list(f.service, f.one.workspaceId), before);
  }
  for (const input of [{ type: "workspace.listTextProperties", workspaceId: "bad" }, { type: "workspace.listTextProperties", workspaceId: randomUUID() }, { type: "workspace.listTextProperties", workspaceId: f.one.workspaceId, extra: true }])
    assert.equal(f.service.handleQuery(input).error.code, "invalid_input");
  assert.deepEqual(events, []);
}));

test("injected definition/revision transaction failures roll back data and suppress notifications", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const sql = new Database(f.databasePath);
  try {
    for (const [table, operation, command] of [
      ["property_definitions", "INSERT", () => createProperty(f.service, f.one.workspaceId)],
      ["property_definitions", "UPDATE", () => rename(f.service, f.one.workspaceId, propertyId, "Changed")],
      ["sources", "UPDATE OF property_revision", () => createProperty(f.service, f.one.workspaceId)],
      ["sources", "UPDATE OF property_revision", () => rename(f.service, f.one.workspaceId, propertyId, "Changed")],
    ]) {
      const before = list(f.service, f.one.workspaceId);
      sql.exec(`CREATE TRIGGER fail_property BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`);
      assert.equal(command().error.code, "storage");
      assert.deepEqual(list(f.service, f.one.workspaceId), before);
      assert.deepEqual(events, []);
      sql.exec("DROP TRIGGER fail_property");
    }
  } finally { sql.close(); }
}));

test("upgrade from populated baseline 0000–0004 preserves settings, sources, projects, views and selection across reopens", () => {
  const directory = mkdtempSync(join(tmpdir(), "text-upgrade-"));
  const root = join(directory, "root"), legacy = join(directory, "baseline-migrations"), databasePath = join(directory, "workspace.sqlite");
  mkdirSync(root); mkdirSync(join(root, "Project")); mkdirSync(join(legacy, "meta"), { recursive: true });
  const migrations = "src/service/db/migrations";
  const journal = JSON.parse(readFileSync(join(migrations, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, 5);
  for (const entry of journal.entries) writeFileSync(join(legacy, `${entry.tag}.sql`), readFileSync(join(migrations, `${entry.tag}.sql`)));
  writeFileSync(join(legacy, "meta/_journal.json"), JSON.stringify(journal));
  let service;
  const sql = new Database(databasePath);
  const sourceId = randomUUID(), one = randomUUID(), sibling = randomUUID(), projectId = randomUUID(), viewOne = randomUUID(), viewTwo = randomUUID();
  try {
    migrate(drizzle(sql), { migrationsFolder: legacy }); sql.pragma("foreign_keys = ON");
    sql.prepare("INSERT INTO settings VALUES ('language', 'ru')").run();
    sql.prepare("INSERT INTO sources (id, canonical_root, discovery_mode, discovery_revision, excluded_relative_paths, archive_relative_path, applied_root_identity) VALUES (?, ?, 'direct', 7, '[\"Excluded\"]', 'Archive', 'baseline identity')").run(sourceId, root);
    sql.prepare("INSERT INTO workspaces (id, name, source_id, position) VALUES (?, ?, ?, ?)").run(one, "One", sourceId, 0);
    sql.prepare("INSERT INTO workspaces (id, name, source_id, position) VALUES (?, ?, ?, ?)").run(sibling, "Sibling", sourceId, 1);
    sql.prepare("INSERT INTO views VALUES (?, ?, ?, 'table')").run(viewOne, one, "Independent one");
    sql.prepare("INSERT INTO views VALUES (?, ?, ?, 'table')").run(viewTwo, sibling, "Independent two");
    sql.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(sibling, viewTwo);
    sql.prepare("INSERT INTO projects VALUES (?, ?, 'Project', 'native identity', 'active')").run(projectId, sourceId);
    const tables = ["settings", "sources", "projects", "workspaces", "views", "active_workspace"];
    const before = Object.fromEntries(tables.map((table) => [table, sql.prepare(`SELECT * FROM ${table}`).all()]));
    sql.close();
    let expected;
    for (let attempt = 0; attempt < 3; attempt++) {
      service = openSettingsService(databasePath);
      const inspected = new Database(databasePath);
      try {
        for (const table of tables) {
          const actual = inspected.prepare(`SELECT * FROM ${table}`).all();
          if (table === "sources") actual.forEach((row) => delete row.property_revision);
          assert.deepEqual(actual, before[table]);
        }
      } finally { inspected.close(); }
      if (attempt === 0) {
        const created = createProperty(service, one, "Upgraded Text"); assert.equal(created.ok, true);
        assert.equal(rename(service, sibling, created.value.propertyId, "Renamed Text").ok, true);
        expected = list(service, one);
      } else assert.deepEqual(list(service, one), expected);
      service.close(); service = undefined;
    }
  } finally { if (sql.open) sql.close(); service?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("SQLite composite foreign keys prevent cross-source values and keep definition types immutable", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const foreign = createProperty(f.service, f.other.workspaceId).value.propertyId;
  const preview = f.service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: f.one.workspaceId }).value;
  const projectId = f.service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: f.one.workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
  const sql = new Database(f.databasePath); sql.pragma("foreign_keys = ON");
  try {
    assert.throws(() => sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, ?)").run(projectId, foreign, f.one.sourceId, "foreign"), /FOREIGN KEY/);
    sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, f.one.sourceId, "authored");
    assert.throws(() => sql.prepare("UPDATE property_definitions SET property_type = 'number' WHERE id = ?").run(propertyId), /immutable/);
    assert.equal(rename(f.service, f.sibling.workspaceId, propertyId, "Renamed").ok, true);
    assert.deepEqual(list(f.service, f.one.workspaceId).value.values, [{ projectId, propertyId, value: "authored" }]);
  } finally { sql.close(); }
}));
