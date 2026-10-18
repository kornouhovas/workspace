import test from "node:test";

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync, cpSync } from "node:fs";
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
  for (const input of [null, {}, { ...base, name: " \n\t" }, { ...base, name: 42 }, { ...base, propertyType: "select" },
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
    sql.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, ?, 'table')").run(viewOne, one, "Independent one");
    sql.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, ?, 'table')").run(viewTwo, sibling, "Independent two");
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
          if (table === "sources") actual.forEach((row) => { delete row.property_revision; delete row.category_property_revision; });
          if (table === "projects") actual.forEach((row) => { delete row.category_id; delete row.mode_inactive; });
          if (table === "views") actual.forEach(row => { assert.equal(row.position, 0); assert.equal(row.filter_config, '{"search":"","rules":[]}'); assert.equal(row.grouping_config, '{"propertyId":null,"settings":[]}'); assert.equal(row.board_config, '{"widths":[],"properties":[],"wrap":true}'); assert.equal(row.table_config, '{"columns":[],"rowOrder":[]}'); delete row.board_config; delete row.table_config; delete row.grouping_config; delete row.position; delete row.filter_config; });
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

const setValue = (service, workspaceId, projectId, propertyId, value) => service.handleCommand({ type: "workspace.setTextValue", workspaceId, projectId, propertyId, value });
const discover = (service, workspaceId, excludedRelativePaths) => {
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId, ...(excludedRelativePaths === undefined ? {} : { excludedRelativePaths }) });
  assert.equal(preview.ok, true);
  const result = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.value.previewToken });
  assert.equal(result.ok, true); return result.value;
};

test("authored Text values distinguish empty and null, survive reopen, and suppress repeated no-op events", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const projectId = discover(f.service, f.one.workspaceId).projects[0].projectId;
  let revision = 1;
  for (const value of [null, "Text", "", " \t\n ", "  日本語 📝\nСтрока\r\n  ", null]) {
    const events = []; const off = f.service.workspaces.subscribe((event) => events.push(event));
    const result = setValue(f.service, f.sibling.workspaceId, projectId, propertyId, value);
    assert.equal(result.ok, true);
    if (value !== null || revision !== 1) revision++;
    assert.equal(result.value.snapshot.revision, revision);
    assert.equal(result.value.projectId, projectId); assert.equal(result.value.propertyId, propertyId);
    const values = value === null ? [] : [{ projectId, propertyId, value }];
    assert.deepEqual(result.value.snapshot.values, values);
    assert.deepEqual(events, revision === 1 ? [] : [{ type: "workspace.propertiesChanged", sourceId: f.one.sourceId, workspaceIds: [f.one.workspaceId, f.sibling.workspaceId], revision }]);
    events.length = 0;
    assert.equal(setValue(f.service, f.one.workspaceId, projectId, propertyId, value).value.snapshot.revision, revision);
    assert.deepEqual(events, []); off();
    assert.deepEqual(list(f.service, f.other.workspaceId).value.values, []);
    f.reopen(); assert.deepEqual(list(f.service, f.one.workspaceId).value.values, values);
    assert.equal(list(f.service, f.one.workspaceId).value.revision, revision);
  }
}));

test("Text value commands reject malformed payloads and foreign or missing entities without writes", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const foreign = createProperty(f.service, f.other.workspaceId).value.propertyId;
  const projectId = discover(f.service, f.one.workspaceId).projects[0].projectId;
  const base = { type: "workspace.setTextValue", workspaceId: f.one.workspaceId, projectId, propertyId, value: "value" };
  const before = list(f.service, f.one.workspaceId);
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const { value: omitted, ...missingValue } = base; assert.equal(omitted, "value");
  for (const input of [missingValue, { ...base, value: undefined }, { ...base, value: 0 }, { ...base, value: {} }, { ...base, value: false },
    { ...base, extra: true }, { ...base, propertyType: "text" }, { ...base, propertyType: "number" },
    ...["workspaceId", "projectId", "propertyId"].flatMap((key) => [{ ...base, [key]: "bad" }, { ...base, [key]: randomUUID() }]),
    { ...base, propertyId: foreign }, { ...base, workspaceId: f.other.workspaceId }]) {
    assert.equal(f.service.handleCommand(input).error.code, "invalid_input");
    assert.deepEqual(list(f.service, f.one.workspaceId), before);
  }
  // A foreign project is rejected even when the property belongs to the selected source.
  assert.equal(setValue(f.service, f.other.workspaceId, projectId, foreign, "bad").error.code, "invalid_input");
  assert.deepEqual(events, []);
}));

test("injected Text insert/update/delete and revision failures roll back snapshots and events", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const projectId = discover(f.service, f.one.workspaceId).projects[0].projectId;
  const sql = new Database(f.databasePath);
  try {
    for (const [table, operation, initial, next] of [
      ["text_property_values", "INSERT", null, "insert"], ["text_property_values", "UPDATE", "old", "new"],
      ["text_property_values", "DELETE", "old", null], ["sources", "UPDATE OF property_revision", null, "insert"],
      ["sources", "UPDATE OF property_revision", "old", "new"], ["sources", "UPDATE OF property_revision", "old", null],
    ]) {
      assert.equal(setValue(f.service, f.one.workspaceId, projectId, propertyId, initial).ok, true);
      const before = list(f.service, f.one.workspaceId);
      const events = []; const off = f.service.workspaces.subscribe((event) => events.push(event));
      sql.exec(`CREATE TRIGGER fail_value BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`);
      assert.equal(setValue(f.service, f.one.workspaceId, projectId, propertyId, next).error.code, "storage");
      assert.deepEqual(list(f.service, f.one.workspaceId), before); assert.deepEqual(events, []);
      sql.exec("DROP TRIGGER fail_value"); off();
      f.reopen(); assert.deepEqual(list(f.service, f.one.workspaceId), before);
    }
  } finally { sql.close(); }
}));

function inventory(root) {
  const entries = [];
  const visit = (path, prefix) => {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) { entries.push([relative, "directory"]); visit(join(path, entry.name), `${relative}/`); }
      else entries.push([relative, readFileSync(join(path, entry.name)).toString("hex")]);
    }
  };
  visit(root, ""); return entries;
}

test("Text metadata stays on retained logical IDs through exclusions, replacements, missing folders and source reuse without file changes", () => fixture((f) => {
  mkdirSync(join(f.root, "Project", "Nested"));
  writeFileSync(join(f.root, "Project", "Nested", "sentinel.bin"), Buffer.from([0, 255, 42]));
  const safe = (command) => { const before = inventory(f.root); const result = command(); assert.deepEqual(inventory(f.root), before); return result; };
  const projectId = safe(() => discover(f.service, f.one.workspaceId)).projects[0].projectId;
  const propertyId = safe(() => createProperty(f.service, f.one.workspaceId)).value.propertyId;
  const sql = new Database(f.databasePath);
  const inspect = () => Object.fromEntries(["settings", "sources", "projects", "workspaces", "views", "active_workspace"].map((table) => [table,
    sql.prepare(`SELECT * FROM ${table}`).all().map((row) => { if (table === "sources") delete row.property_revision; return row; })]));
  try {
    const metadata = inspect();
    assert.equal(safe(() => setValue(f.service, f.one.workspaceId, projectId, propertyId, "  Durable 📝\n  ")).ok, true);
    assert.deepEqual(inspect(), metadata, "property mutations preserve discovery, project identities, settings, selection and independent views");
    const expected = list(f.service, f.one.workspaceId).value;
    assert.equal(safe(() => discover(f.service, f.one.workspaceId, ["Project"])).projects.length, 0);
    assert.equal(safe(() => discover(f.service, f.one.workspaceId, [])).projects[0].projectId, projectId);
    renameSync(join(f.root, "Project"), join(f.directory, "original"));
    cpSync(join(f.directory, "original"), join(f.root, "Project"), { recursive: true });
    const replacement = safe(() => discover(f.service, f.one.workspaceId));
    const replacementId = replacement.projects[0].projectId; assert.notEqual(replacementId, projectId);
    assert.deepEqual(list(f.service, f.sibling.workspaceId).value.values, expected.values);
    assert.equal(list(f.service, f.one.workspaceId).value.values.some((value) => value.projectId === replacementId), false);
    renameSync(join(f.root, "Project"), join(f.directory, "missing"));
    assert.equal(safe(() => discover(f.service, f.one.workspaceId)).retainedCount, 2);
    assert.deepEqual(list(f.service, f.one.workspaceId).value.values, expected.values);
    renameSync(join(f.directory, "missing"), join(f.root, "Project"));
    assert.equal(safe(() => discover(f.service, f.one.workspaceId)).projects.length, 0);
    // Retained records remain explicitly addressable, without assigning their values to a path.
    assert.equal(safe(() => setValue(f.service, f.sibling.workspaceId, projectId, propertyId, "  Durable 📝\n  ")).value.snapshot.revision, expected.revision);
    safe(() => f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.sibling.workspaceId }));
    f.reopen(); assert.deepEqual(list(f.service, f.one.workspaceId).value, expected);
    const projects = sql.prepare("SELECT * FROM projects ORDER BY id").all();
    safe(() => f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.one.workspaceId }));
    f.reopen();
    const reused = safe(() => f.service.handleCommand({ type: "workspace.create", rootPath: f.root, name: "Reused" })).value;
    assert.equal(reused.sourceId, f.one.sourceId); assert.notEqual(reused.viewId, f.one.viewId);
    assert.deepEqual(list(f.service, reused.workspaceId).value, { ...expected, workspaceId: reused.workspaceId });
    assert.deepEqual(sql.prepare("SELECT * FROM projects ORDER BY id").all(), projects);
    assert.equal(readFileSync(join(f.root, "Project", "keep"), "utf8"), "unchanged bytes");
    assert.deepEqual(readFileSync(join(f.root, "Project", "Nested", "sentinel.bin")), Buffer.from([0, 255, 42]));
    assert.deepEqual(inventory(join(f.directory, "original")), inventory(join(f.root, "Project")));
  } finally { sql.close(); }
}));

test("property notification batches isolate subscriber failures and serialize reentrant reads/mutations with discovery", () => fixture((f) => {
  const propertyId = createProperty(f.service, f.one.workspaceId).value.propertyId;
  const projectId = discover(f.service, f.one.workspaceId).projects[0].projectId;
  setValue(f.service, f.one.workspaceId, projectId, propertyId, "Original");
  const sql = new Database(f.databasePath);
  try {
    const views = sql.prepare("SELECT * FROM views ORDER BY id").all();
    const selection = sql.prepare("SELECT * FROM active_workspace").all();
    const discoveryBefore = sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.one.sourceId);
    const order = [], reads = [];
    f.service.workspaces.subscribe(() => { throw new Error("subscriber failure"); });
    let nested;
    f.service.workspaces.subscribe((event) => {
      if (event.type !== "workspace.propertiesChanged") return;
      reads.push(list(f.service, f.sibling.workspaceId).value);
      if (event.revision === 3) {
        nested = setValue(f.service, f.sibling.workspaceId, projectId, propertyId, "Reentrant");
        assert.equal(nested.ok, true);
        discover(f.service, f.one.workspaceId, ["Project"]);
      }
    });
    const unsubscribe = f.service.workspaces.subscribe((event) => order.push([event.type, event.revision]));
    const result = rename(f.service, f.one.workspaceId, propertyId, "Renamed");
    assert.equal(result.ok, true, "subscriber failures must not turn a committed rename into a failed save");
    assert.equal(result.value.snapshot.revision, 3);
    assert.deepEqual(result.value.snapshot.values, [{ projectId, propertyId, value: "Original" }]);
    assert.deepEqual(order, [["workspace.propertiesChanged", 3], ["workspace.propertiesChanged", 4], ["workspace.projectsChanged", 2]]);
    assert.deepEqual(reads.map((snapshot) => [snapshot.revision, snapshot.values[0].value]), [[3, "Original"], [4, "Reentrant"]]);
    assert.equal(nested.value.snapshot.definitions[0].name, "Renamed");
    assert.deepEqual(list(f.service, f.sibling.workspaceId).value.values, [{ projectId, propertyId, value: "Reentrant" }]);
    assert.deepEqual(list(f.service, f.other.workspaceId).value.definitions, []);
    assert.deepEqual(sql.prepare("SELECT * FROM views ORDER BY id").all(), views);
    assert.deepEqual(sql.prepare("SELECT * FROM active_workspace").all(), selection);
    assert.equal(discoveryBefore.discovery_revision, 1);
    assert.equal(sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.one.sourceId).discovery_revision, 2);
    assert.equal(readFileSync(join(f.root, "Project", "keep"), "utf8"), "unchanged bytes");
    unsubscribe();
    rename(f.service, f.one.workspaceId, propertyId, "After unsubscribe");
    assert.equal(order.length, 3);
  } finally { sql.close(); }
}));
