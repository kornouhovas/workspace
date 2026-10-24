import {withIdentityMigrationDefaults} from './support/identity-migration-fixtures.mjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";

function fixture(run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "workspace-grouped-")));
  const root = join(directory, "root");
  fs.mkdirSync(root);
  const databasePath = join(directory, "data", "workspace.sqlite");
  const service = openSettingsService(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Grouped", rootPath: root }).value;
  const sqlite = new Database(databasePath);
  const preview = (extra = {}) => service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: "grouped", ...extra });
  try { run({ directory, root, databasePath, sqlite, service, workspace, preview }); }
  finally { sqlite.close(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

function inventory(path) {
  return fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [
    entry.name, entry.isSymbolicLink() ? fs.readlinkSync(join(path, entry.name))
      : entry.isDirectory() ? inventory(join(path, entry.name)) : fs.readFileSync(join(path, entry.name)).toString("hex"),
  ]);
}

test("grouped review is read-only, shows empty/mixed categories and stops exactly at projects", () => fixture(({ root, sqlite, service, preview }) => {
  for (const path of ["Empty", "Category/Project/Deeper", "DirectLooking/src", "Archive/Kept"]) fs.mkdirSync(join(root, path), { recursive: true });
  fs.writeFileSync(join(root, "ordinary"), "root file");
  fs.writeFileSync(join(root, "Category", "ordinary"), "category file");
  fs.writeFileSync(join(root, "Category", "Project", "keep"), Buffer.from([0, 255, 42]));
  const before = inventory(root);
  const config = sqlite.prepare("SELECT * FROM sources").all();
  const events = []; service.workspaces.subscribe((event) => events.push(event));
  const original = fs.opendirSync;
  fs.opendirSync = (path, ...args) => {
    assert.ok(![join(root, "Category", "Project"), join(root, "DirectLooking", "src"), join(root, "Archive", "Kept")].includes(path), "project contents must never be enumerated");
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  let result;
  try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.equal(result.ok, true);
  assert.equal(result.value.mode, "grouped");
  assert.equal(result.value.configured, false);
  assert.equal(result.value.state, "ready");
  assert.ok(result.value.previewToken);
  assert.deepEqual(result.value.entries.map((entry) => [entry.kind, entry.relativePath, entry.kind === "project" ? entry.categoryPath : entry.empty]), [
    ["category", "Archive", false], ["project", "Archive/Kept", "Archive"],
    ["category", "Category", false], ["project", "Category/Project", "Category"],
    ["category", "DirectLooking", false], ["project", "DirectLooking/src", "DirectLooking"], ["category", "Empty", true],
  ]);
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), config);
  assert.deepEqual(sqlite.prepare("SELECT * FROM projects").all(), []);
  assert.deepEqual(inventory(root), before);
  assert.deepEqual(events, []);
}));

test("grouped automatic/manual exclusions precede excluded metadata access at both levels", () => fixture(({ directory, root, preview }) => {
  for (const path of [".hidden/Inside", "$RECYCLE.BIN/Inside", "Manual/Inside", "Category/.hidden", "Category/System Volume Information", "Category/Manual", "Category/Project", "Storage/Inside"])
    fs.mkdirSync(join(root, path), { recursive: true });
  const external = join(directory, "external"); fs.mkdirSync(external);
  fs.symlinkSync(external, join(root, "Linked"), process.platform === "win32" ? "junction" : "dir");
  fs.symlinkSync(external, join(root, "Category", "Linked"), process.platform === "win32" ? "junction" : "dir");
  const blocked = [".hidden", "$RECYCLE.BIN", "Manual", "Linked", "Category/.hidden", "Category/System Volume Information", "Category/Manual", "Category/Linked"].map((path) => join(root, path));
  const originalStat = fs.lstatSync; const originalOpen = fs.opendirSync;
  const assertAllowed = (path) => assert.ok(!blocked.includes(path) && path !== external, `excluded target accessed: ${path}`);
  fs.lstatSync = (path, ...args) => { assertAllowed(path); return originalStat(path, ...args); };
  fs.opendirSync = (path, ...args) => { assertAllowed(path); return originalOpen(path, ...args); };
  syncBuiltinESMExports();
  let result;
  try { result = preview({ excludedRelativePaths: ["Manual", "Category/Manual"] }); }
  finally { fs.lstatSync = originalStat; fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
  assert.equal(result.ok, true);
  assert.ok(result.value.previewToken);
  assert.equal(result.value.entries.find((entry) => entry.relativePath === "Manual").reason, "manual");
  assert.equal(result.value.entries.some((entry) => entry.relativePath === "Manual/Inside"), false);
  assert.equal(result.value.entries.find((entry) => entry.relativePath === "Category/Manual").reason, "manual");
  for (const path of ["Linked", "Category/Linked"]) assert.equal(result.value.entries.find((entry) => entry.relativePath === path).reason, "link");
}));

test("grouped archive policy excludes a designated category or its containing immediate project", () => fixture(({ root, sqlite, preview }) => {
  for (const path of ["Archive/Project", "Category/Storage/Archive", "Category/Kept", "Empty"]) fs.mkdirSync(join(root, path), { recursive: true });
  for (const [archive, excluded] of [["Archive", "Archive"], ["Category/Storage/Archive", "Category/Storage"], [null, null]]) {
    sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(archive);
    const original = fs.opendirSync;
    fs.opendirSync = (path, ...args) => { if (excluded) assert.notEqual(path, join(root, excluded)); return original(path, ...args); };
    syncBuiltinESMExports();
    let result;
    try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.equal(result.ok, true);
    assert.ok(result.value.previewToken);
    assert.deepEqual(result.value.entries.filter((entry) => entry.reason === "archive").map((entry) => entry.relativePath), excluded ? [excluded] : []);
  }
}));

test("grouped preview rejects unsafe depths, unselectable exclusions and modes without configuring a source", () => fixture(({ root, sqlite, service, workspace, preview }) => {
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true }); fs.mkdirSync(join(root, ".hidden"));
  const before = sqlite.prepare("SELECT * FROM sources").all();
  for (const excludedRelativePaths of [Array(1), [null], ["../escape"], ["/absolute"], ["Category//Project"], ["Category/Project/deep"], ["Category/.."], ["Category", "Category"], ["invented"], [".hidden"], ["Category/Project/"]]) {
    assert.equal(preview({ excludedRelativePaths }).error.code, "invalid_input");
  }
  for (const mode of [null, "recursive", 0]) assert.equal(preview({ mode }).error.code, "invalid_input");
  assert.equal(preview({ extra: true }).error.code, "invalid_input");
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), before);
  const direct = preview({ mode: "direct" }).value;
  assert.equal(service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: direct.previewToken }).ok, true);
  assert.equal(preview().value.currentMode, "direct");
  assert.equal(preview({ mode: undefined }).error.code, "invalid_input");
  assert.equal(service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId }).value.mode, "direct");
}));

test("category replacement/link swaps during child enumeration invalidate the complete review", () => {
  for (const link of [false, true]) fixture(({ directory, root, preview }) => {
    const category = join(root, "Category"); fs.mkdirSync(join(category, "Project"), { recursive: true });
    const external = join(directory, "external"); fs.mkdirSync(join(external, "Foreign"), { recursive: true });
    const original = fs.opendirSync;
    let swapped = false;
    fs.opendirSync = (path, ...args) => {
      assert.notEqual(path, external);
      const handle = original(path, ...args);
      if (path === category && !swapped) {
        swapped = true;
        fs.renameSync(category, join(directory, "old-category"));
        if (link) fs.symlinkSync(external, category, process.platform === "win32" ? "junction" : "dir");
        else fs.mkdirSync(join(category, "Project"), { recursive: true });
      }
      return handle;
    };
    syncBuiltinESMExports();
    let result;
    try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.equal(result.ok, true);
    assert.equal(result.value.state, "changed");
    assert.equal(result.value.previewToken, null);
    assert.deepEqual(result.value.entries, []);
  });
});

test("grouped exclusions preserve safe POSIX basenames and saved missing selections", { skip: process.platform === "win32" }, () => fixture(({ root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Category:one", "Project\\two"), { recursive: true });
  const path = "Category:one/Project\\two";
  assert.equal(preview({ excludedRelativePaths: [path] }).value.entries.find((entry) => entry.relativePath === path).reason, "manual");
  sqlite.prepare("UPDATE sources SET excluded_relative_paths = ?").run(JSON.stringify(["Absent"]));
  assert.deepEqual(preview().value.excludedRelativePaths, ["Absent"]);
}));

test("grouped reviews retain no token on unavailable, unreadable, unstable or retargeted roots", () => fixture(({ directory, root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true });
  const before = sqlite.prepare("SELECT * FROM sources").all();
  const original = fs.opendirSync;
  fs.opendirSync = (path, ...args) => {
    if (path === join(root, "Category")) throw Object.assign(new Error("denied"), { code: "EACCES" });
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  let result;
  try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.equal(result.value.state, "unreadable");
  assert.equal(result.value.previewToken, null);
  // A replacement between the first and second complete scans is stale too.
  let reads = 0;
  fs.opendirSync = (path, ...args) => {
    if (path === root && ++reads === 2) fs.mkdirSync(join(root, "Category", "New"));
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.equal(result.value.state, "changed");
  assert.equal(result.value.previewToken, null);
  fs.renameSync(root, join(directory, "disconnected"));
  assert.equal(preview().value.state, "unavailable");
  fs.symlinkSync(join(directory, "disconnected"), root, process.platform === "win32" ? "junction" : "dir");
  assert.equal(preview().value.state, "root_identity_conflict");
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), before);
}));

test("grouped archive casing uses actual native identity at category and project depth", () => fixture(({ root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Category", "Storage", "Archive"), { recursive: true });
  fs.mkdirSync(join(root, "Category", "Kept"));
  fs.mkdirSync(join(root, "Archive", "Kept"), { recursive: true });
  const insensitive = fs.existsSync(join(root, "category"));
  for (const [archive, excluded] of [["archive", "Archive"], ["category/storage/archive", "Category/Storage"]]) {
    sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(archive);
    const original = fs.opendirSync;
    fs.opendirSync = (path, ...args) => { if (insensitive) assert.notEqual(path, join(root, excluded)); return original(path, ...args); };
    syncBuiltinESMExports();
    let result;
    try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.ok(result.value.previewToken);
    assert.deepEqual(result.value.entries.filter((entry) => entry.reason === "archive").map((entry) => entry.relativePath), insensitive ? [excluded] : []);
  }
}));

test("a grouped review is workspace/token bound and returned data cannot change its reviewed mode", () => fixture(({ root, service, workspace, preview }) => {
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true });
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const reviewed = preview().value;
  const command = { type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: reviewed.previewToken };
  assert.equal(service.handleCommand({ ...command, workspaceId: sibling.workspaceId }).error.code, "stale_preview");
  reviewed.mode = "direct"; reviewed.entries.length = 0;
  assert.equal(service.handleCommand(command).value.mode, "grouped");
  assert.equal(service.handleCommand({ ...command, mode: "direct" }).error.code, "invalid_input");
  assert.equal(service.handleCommand(command).error.code, "stale_preview");
  const refreshed = preview().value;
  assert.equal(service.handleCommand({ ...command, previewToken: refreshed.previewToken }).ok, true);
}));

test("archive casing resolution never accesses an already excluded alias", () => fixture(({ root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Manual", "Inside"), { recursive: true });
  fs.mkdirSync(join(root, "Category", "Manual"), { recursive: true });
  for (const [archive, exclusion] of [["manual/deep", "Manual"], ["Category/manual/deep", "Category/Manual"]]) {
    sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(archive);
    const original = fs.lstatSync;
    fs.lstatSync = (path, ...args) => {
      assert.notEqual(path, join(root, exclusion));
      assert.notEqual(path, join(root, archive.split("/").slice(0, exclusion.split("/").length).join("/")));
      return original(path, ...args);
    };
    syncBuiltinESMExports();
    let result;
    try { result = preview({ excludedRelativePaths: [exclusion] }); }
    finally { fs.lstatSync = original; syncBuiltinESMExports(); }
    assert.ok(result.value.previewToken);
    assert.equal(result.value.entries.find((entry) => entry.relativePath === exclusion).reason, "manual");
  }
}));

function applied(f, extra = {}) {
  const review = f.preview(extra); assert.equal(review.ok, true);
  const result = f.service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: review.value.previewToken });
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
}

test("grouped Apply persists empty categories, required same-source values and independent property identity", () => fixture((f) => {
  for (const path of ["Category/Project/Deeper", "Empty", "DirectLooking/src"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  fs.writeFileSync(join(f.root, "Category/Project/bytes"), Buffer.from([0, 42, 255]));
  const before = inventory(f.root);
  const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
  const otherRoot = join(f.directory, "other"); fs.mkdirSync(otherRoot);
  const other = f.service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const result = applied(f);
  assert.equal(result.mode, "grouped"); assert.equal(result.revision, 1);
  assert.equal(result.categoryProperty.name, null); assert.equal(result.categoryPropertyRevision, 0);
  assert.deepEqual(result.categories.map((row) => row.name), ["Category", "DirectLooking", "Empty"]);
  assert.deepEqual(result.projects.map((row) => [row.name, row.relativePath]), [["Project", "Category/Project"], ["src", "DirectLooking/src"]]);
  for (const project of result.projects) assert.equal(result.categories.find((row) => row.categoryId === project.categoryId).relativePath, project.relativePath.split("/")[0]);
  assert.deepEqual(events[1], { type: "workspace.sourceObserved", sourceId: f.workspace.sourceId,
    workspaceIds: events[0].workspaceIds, observationRevision: 1, state: "ready", automaticUpdates: "active" });
  assert.equal(events.length, 2); assert.equal(events[0].type, "workspace.projectsChanged");
  assert.deepEqual(new Set(events[0].workspaceIds), new Set([f.workspace.workspaceId, sibling.workspaceId]));
  assert.equal(events[0].workspaceIds.includes(other.workspaceId), false);
  assert.deepEqual(applied(f), result); assert.equal(events.length, 2);
  const fromSibling = f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.workspaceId }).value;
  assert.deepEqual({ ...fromSibling, workspaceId: result.workspaceId }, result);
  assert.equal(f.preview({ mode: "direct" }).value.currentMode, "grouped");
  const reopened = openSettingsService(f.databasePath);
  try { assert.deepEqual(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value, result); }
  finally { reopened.close(); }
  f.sqlite.pragma("foreign_keys = ON");
  const project = result.projects[0], category = result.categories.find((row) => row.categoryId === project.categoryId);
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET category_id = NULL WHERE id = ?").run(project.projectId));
  assert.throws(() => f.sqlite.prepare("UPDATE categories SET association_state = 'missing' WHERE id = ?").run(category.categoryId));
  assert.throws(() => f.sqlite.prepare("UPDATE sources SET discovery_mode = 'direct' WHERE id = ?").run(result.sourceId));
  assert.deepEqual(inventory(f.root), before);
}));

test("grouped categories and project replacements retain Text without transferring old metadata", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true }); fs.mkdirSync(join(f.root, "Empty"));
  const first = applied(f), project = first.projects[0];
  const property = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId, name: "Notes", propertyType: "text" });
  assert.equal(property.ok, true);
  const propertyId = property.value.propertyId;
  assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: project.projectId, propertyId, value: "retained" }).ok, true);
  const excluded = applied(f, { excludedRelativePaths: ["Category"] });
  assert.equal(excluded.projects.length, 0); assert.equal(excluded.retainedCount, 1);
  assert.equal(applied(f, { excludedRelativePaths: [] }).projects[0].projectId, project.projectId);
  fs.renameSync(join(f.root, "Category"), join(f.directory, "old-category"));
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const replacement = applied(f);
  assert.deepEqual(replacement.projects,[]);
  assert.equal(replacement.retainedProjects[0].projectId,project.projectId);
  assert.equal(replacement.retainedProjects[0].categoryId,project.categoryId);
  assert.equal(replacement.categoryProperty.propertyId, first.categoryProperty.propertyId);
  assert.equal(replacement.retainedCount, 1);
  const text = f.service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: f.workspace.workspaceId }).value;
  assert.deepEqual(text.values.map((row) => [row.projectId, row.value]), [[project.projectId, "retained"]]);
  fs.renameSync(join(f.root, "Category"), join(f.directory, "missing-category"));
  assert.equal(applied(f).projects.length, 0);
  fs.renameSync(join(f.directory, "missing-category"), join(f.root, "Category"));
  assert.equal(applied(f).projects.length, 0, "missing category must not automatically reattach projects");
  fs.rmdirSync(join(f.root, "Empty"));
  const noEmpty = applied(f); assert.equal(noEmpty.categories.length, 0);
  assert.ok(f.sqlite.prepare("SELECT * FROM categories WHERE relative_path = 'Empty'").get());
}));

test("grouped Apply rejects stale reviewed categories/projects and rolls back writes without events", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const command = (token) => f.service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: token });
  let review = f.preview().value;
  fs.mkdirSync(join(f.root, "Empty")); assert.equal(command(review.previewToken).error.code, "stale_preview");
  review = f.preview().value;
  fs.mkdirSync(join(f.root, "Category/New")); assert.equal(command(review.previewToken).error.code, "stale_preview");
  const before = f.sqlite.prepare("SELECT * FROM sources").all();
  f.sqlite.exec("CREATE TRIGGER fail_grouped BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT, 'injected'); END");
  review = f.preview().value; assert.equal(command(review.previewToken).error.code, "storage");
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM sources").all(), before);
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM categories").all(), []);
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM category_properties").all(), []);
  assert.deepEqual(events, []);
  f.sqlite.exec("DROP TRIGGER fail_grouped");
  assert.equal(command(review.previewToken).ok, true);
  const initial = f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value;
  review = f.preview().value;
  f.sqlite.prepare("UPDATE categories SET native_identity = ? WHERE id = ?").run(JSON.stringify({ dev: "1", ino: "2", birthtimeNs: "3" }), initial.categories[0].categoryId);
  assert.equal(command(review.previewToken).error.code, "stale_preview");
  assert.deepEqual(events[1], { type: "workspace.sourceObserved", sourceId: f.workspace.sourceId,
    workspaceIds: events[0].workspaceIds, observationRevision: 1, state: "ready", automaticUpdates: "active" });
  assert.equal(events.length, 2);
}));

test("actual populated migrations 0000–0005 upgrade without changing settings, identities, Text or views", () => {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "grouped-upgrade-")));
  const legacy = join(directory, "legacy"), root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(join(root, "Project"), { recursive: true }); fs.mkdirSync(join(legacy, "meta"), { recursive: true });
  const folder = "src/service/db/migrations", journal = JSON.parse(fs.readFileSync(join(folder, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, 6);
  for (const entry of journal.entries) fs.copyFileSync(join(folder, `${entry.tag}.sql`), join(legacy, `${entry.tag}.sql`));
  fs.writeFileSync(join(legacy, "meta/_journal.json"), JSON.stringify(journal));
  const sql = new Database(databasePath); let service;
  const sourceId = randomUUID(), workspaceId = randomUUID(), siblingId = randomUUID(), viewId = randomUUID(), siblingView = randomUUID(), projectId = randomUUID(), propertyId = randomUUID();
  const identity = (path) => { const stat = fs.lstatSync(path, { bigint: true }); return JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }); };
  try {
    migrate(drizzle(sql), { migrationsFolder: legacy }); sql.pragma("foreign_keys = ON");
    sql.prepare("INSERT INTO settings VALUES ('language', 'ru')").run();
    sql.prepare("INSERT INTO sources (id, canonical_root, discovery_mode, discovery_revision, property_revision, applied_root_identity) VALUES (?, ?, 'direct', 7, 9, ?)").run(sourceId, root, identity(root));
    for (const [id, view, name, position] of [[workspaceId, viewId, "One", 0], [siblingId, siblingView, "Sibling", 1]]) {
      sql.prepare("INSERT INTO workspaces (id, name, source_id, position) VALUES (?, ?, ?, ?)").run(id, name, sourceId, position);
      sql.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, ?, 'table')").run(view, id, name);
    }
    sql.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(siblingId, siblingView);
    sql.prepare("INSERT INTO projects VALUES (?, ?, 'Project', ?, 'active')").run(projectId, sourceId, identity(join(root, "Project")));
    sql.prepare("INSERT INTO property_definitions VALUES (?, ?, '  Notes  ', 'text', 0)").run(propertyId, sourceId);
    sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, sourceId, "  Authored\nvalue  ");
    const tables = ["settings", "sources", "workspaces", "views", "active_workspace", "projects", "property_definitions", "text_property_values"];
    const before = Object.fromEntries(tables.map((table) => [table, sql.prepare(`SELECT * FROM ${table}`).all()])); sql.close();
    for (let attempt = 0; attempt < 2; attempt++) {
      service = openSettingsService(databasePath);
      const inspected = new Database(databasePath);
      try {
        for (const table of tables) {
          const expected = withIdentityMigrationDefaults(table,before[table]).map((row) => table === "sources" ? { ...row, category_property_revision: 0 } : table === "projects" ? { ...row, category_id: null, mode_inactive: 0 } : table === "views" ? { ...row, position: 0, filter_config: '{"search":"","rules":[]}', grouping_config: '{"propertyId":null,"settings":[]}', board_config: '{"widths":[],"properties":[],"wrap":true}', table_config: '{"columns":[],"rowOrder":[]}' } : row);
          assert.deepEqual(inspected.prepare(`SELECT * FROM ${table}`).all(), expected);
        }
        assert.equal(inspected.prepare('SELECT COUNT(*) AS count FROM "__drizzle_migrations"').get().count, 31);
        assert.deepEqual(inspected.prepare("SELECT * FROM categories").all(), []);
        assert.deepEqual(inspected.prepare("SELECT * FROM category_properties").all(), []);
        assert.deepEqual(inspected.prepare("SELECT * FROM project_rename_operations").all(), []);
      } finally { inspected.close(); }
      const listed = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }).value;
      assert.equal(listed.mode, "direct"); assert.equal(listed.categoryProperty, null); assert.equal(listed.retainedProjects[0].categoryId,null);
      assert.equal(listed.state,"association_review_required");
      const review = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId }).value;
      assert.equal(review.previewToken,null);
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken:randomUUID() }).ok,false);
      assert.equal(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" }).value.currentMode, "direct");
      service.close(); service = undefined;
    }
  } finally { if (sql.open) sql.close(); service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("category-only changes emit discovery revisions and final removal retains grouped source data", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Empty"));
  const first = applied(f); assert.equal(first.projects.length, 0); assert.equal(first.categories.length, 1);
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  fs.mkdirSync(join(f.root, "NewEmpty"));
  const second = applied(f); assert.equal(second.revision, first.revision + 1); assert.equal(events.length, 1);
  assert.equal(second.categories.find((row) => row.name === "Empty").categoryId, first.categories[0].categoryId);
  assert.equal(second.categoryProperty.propertyId, first.categoryProperty.propertyId);
  assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.workspace.workspaceId }).ok, true);
  const reopened = openSettingsService(f.databasePath);
  try {
    const recreated = reopened.workspaces.create({ type: "workspace.create", name: "Recreated", rootPath: f.root }).value;
    assert.equal(recreated.sourceId, f.workspace.sourceId); assert.notEqual(recreated.viewId, f.workspace.viewId);
    assert.deepEqual(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: recreated.workspaceId }).value, { ...second, workspaceId: recreated.workspaceId });
  } finally { reopened.close(); }
}));

test("parent exclusions safely replace reviewed child drafts and reinclusion restores the same associations", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const initial = applied(f);
  assert.ok(f.preview({ excludedRelativePaths: ["Category/Project"] }).value.previewToken);
  const originalStat = fs.lstatSync, originalOpen = fs.opendirSync;
  const denied = join(f.root, "Category");
  fs.lstatSync = (path, ...args) => { assert.ok(path !== denied && !String(path).startsWith(`${denied}/`)); return originalStat(path, ...args); };
  fs.opendirSync = (path, ...args) => { assert.ok(path !== denied && !String(path).startsWith(`${denied}/`)); return originalOpen(path, ...args); };
  syncBuiltinESMExports();
  try {
    const review = f.preview({ excludedRelativePaths: ["Category"] }).value;
    assert.ok(review.previewToken); assert.deepEqual(review.entries.map((entry) => entry.relativePath), ["Category"]);
    // The service still rejects unselectable redundant child inputs. UI normalizes known child choices.
    assert.equal(f.preview({ excludedRelativePaths: ["Category", "Category/Invented"] }).error.code, "invalid_input");
    assert.equal(applied(f, { excludedRelativePaths: ["Category"] }).projects.length, 0);
  } finally { fs.lstatSync = originalStat; fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
  assert.deepEqual(applied(f, { excludedRelativePaths: [] }).projects, initial.projects);
}));

test("grouped Apply rolls back a category/link swap observed inside its transaction", () => {
  for (const link of [false, true]) fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
    const external = join(f.directory, "outside"); fs.mkdirSync(join(external, "Foreign"), { recursive: true });
    const reviewed = f.preview().value, before = f.sqlite.prepare("SELECT * FROM sources").all();
    const events = []; f.service.workspaces.subscribe((event) => events.push(event));
    const original = fs.opendirSync; let swapped = false;
    fs.opendirSync = (path, ...args) => {
      assert.notEqual(path, external);
      // Source mode becomes visible through this connection only after the writes.
      if (path === f.root && !swapped && f.sqlite.prepare("SELECT discovery_mode FROM sources").get().discovery_mode === "grouped") throw new Error("unexpected isolation leak");
      // Apply scans twice before writes and twice inside before writes; the fifth root read is post-write revalidation.
      if (path === f.root && ++reads === 5) {
        swapped = true; fs.renameSync(join(f.root, "Category"), join(f.directory, "old"));
        if (link) fs.symlinkSync(external, join(f.root, "Category"), process.platform === "win32" ? "junction" : "dir");
        else fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
      }
      return original(path, ...args);
    };
    let reads = 0; syncBuiltinESMExports(); let result;
    try { result = f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: reviewed.previewToken }); }
    finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.equal(swapped, true); assert.equal(result.error.code, "stale_preview");
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM sources").all(), before);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects").all(), []);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM categories").all(), []);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM category_properties").all(), []);
    assert.deepEqual(events, []);
  });
});

test("database guards reject foreign category IDs and direct category values on insert and update", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const grouped = applied(f), project = grouped.projects[0];
  const otherRoot = join(f.directory, "other"); fs.mkdirSync(join(otherRoot, "Other/Project"), { recursive: true });
  const other = f.service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
  const review = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: other.workspaceId, mode: "grouped" }).value;
  const foreign = f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: other.workspaceId, previewToken: review.previewToken }).value;
  f.sqlite.pragma("foreign_keys = ON");
  const before = f.sqlite.prepare("SELECT * FROM projects ORDER BY id").all();
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET category_id = ? WHERE id = ?").run(foreign.categories[0].categoryId, project.projectId));
  assert.throws(() => f.sqlite.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id) VALUES (?, ?, 'Category/Injected', '{}', 'active', ?)").run(randomUUID(), grouped.sourceId, foreign.categories[0].categoryId));
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET relative_path = 'Elsewhere/Project' WHERE id = ?").run(project.projectId));
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET category_id = NULL WHERE id = ?").run(project.projectId));
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects ORDER BY id").all(), before);
  applied(f, { excludedRelativePaths: ["Category"] });
  assert.throws(() => f.sqlite.prepare("UPDATE categories SET source_id = ? WHERE id = ?").run(foreign.sourceId, project.categoryId));
  const directRoot = join(f.directory, "direct"); fs.mkdirSync(join(directRoot, "Direct"), { recursive: true });
  const direct = f.service.workspaces.create({ type: "workspace.create", name: "Direct", rootPath: directRoot }).value;
  const directReview = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: direct.workspaceId }).value;
  const directList = f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: direct.workspaceId, previewToken: directReview.previewToken }).value;
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET category_id = ? WHERE id = ?").run(project.categoryId, directList.projects[0].projectId));
  assert.throws(() => f.sqlite.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, 'Invalid', '{}', 'active')").run(randomUUID(), direct.sourceId));
  assert.throws(() => f.sqlite.prepare("INSERT INTO category_properties VALUES (?, ?, NULL)").run(randomUUID(), direct.sourceId));
  assert.equal(directList.categoryProperty, null); assert.deepEqual(directList.categories, []);
}));

test("grouped unavailable roots and cross-path category moves retain associations without metadata reassociation", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const first = applied(f);
  const disconnected = join(f.directory, "disconnected"); fs.renameSync(f.root, disconnected);
  const listed = f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value;
  assert.equal(listed.state,"unavailable");assert.deepEqual(listed.projects,[]);
  assert.equal(listed.retainedProjects[0].projectId,first.projects[0].projectId);assert.equal(listed.retainedProjects[0].associationState,"active");assert.equal(listed.retainedProjects[0].resolution,"unresolved");assert.deepEqual(listed.categories,first.categories);
  assert.equal(f.preview().value.previewToken, null);
  fs.renameSync(disconnected, f.root); fs.renameSync(join(f.root, "Category"), join(f.root, "Moved"));
  const review = f.preview().value;
  assert.equal(review.entries.find((entry) => entry.relativePath === "Moved").reason, "unresolved");
  assert.equal(review.entries.find((entry) => entry.relativePath === "Moved/Project").reason, "unresolved");
  const after = applied(f); assert.deepEqual(after.projects, []); assert.deepEqual(after.categories, []);
  assert.equal(after.retainedCount, 1);
  assert.equal(f.sqlite.prepare("SELECT association_state FROM categories WHERE id = ?").get(first.categories[0].categoryId).association_state, "missing");
}));

test("grouped persistence respects native POSIX basenames rather than SQL pattern matching", { skip: process.platform === "win32" }, () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category_%:one", "Project\\two"), { recursive: true });
  const first = applied(f); assert.equal(first.projects[0].name, "Project\\two");
  assert.equal(first.categories[0].name, "Category_%:one");
  assert.deepEqual(applied(f).projects, first.projects);
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET relative_path = 'Category-XX:one/Project' WHERE id = ?").run(first.projects[0].projectId));
}));

function applyGrouped({ service, workspace, preview }) {
  const review = preview(); assert.equal(review.ok, true);
  const result = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: review.value.previewToken });
  assert.equal(result.ok, true); return result.value;
}

test("category label rename is shared metadata, preserves authored text and valid reviews across reopen", () => fixture((f) => {
  const { root, service, workspace, sqlite, databasePath } = f;
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true });
  fs.writeFileSync(join(root, "Category", "Project", "bytes"), Buffer.from([0, 255, 36]));
  const applied = applyGrouped(f), propertyId = applied.categoryProperty.propertyId;
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const text = service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Duplicate", propertyType: "text" }).value;
  service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, propertyId: text.propertyId, projectId: applied.projects[0].projectId, value: "  authored\nText  " });
  const before = inventory(root), sources = sqlite.prepare("SELECT * FROM sources").all(), projects = sqlite.prepare("SELECT * FROM projects").all();
  const categories = sqlite.prepare("SELECT * FROM categories").all(), views = sqlite.prepare("SELECT * FROM views").all();
  const textBefore = service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId }).value;
  const review = f.preview().value;
  const events = []; service.workspaces.subscribe((event) => events.push(event));
  let revision = 0;
  for (const name of ["Duplicate", "  Категория 日本語  ", "Long ".repeat(600)]) {
    const saved = service.handleCommand({ type: "workspace.renameCategoryProperty", workspaceId: workspace.workspaceId, propertyId, name });
    assert.equal(saved.ok, true);
    assert.deepEqual(saved.value, { workspaceId: workspace.workspaceId, sourceId: workspace.sourceId, propertyId, name, revision: ++revision });
    assert.deepEqual(events.at(-1), { type: "workspace.categoryPropertyChanged", sourceId: workspace.sourceId, workspaceIds: [workspace.workspaceId, sibling.workspaceId], revision });
    assert.equal(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.workspaceId }).value.categoryProperty.name, name);
    assert.deepEqual(service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: sibling.workspaceId, propertyId, name }).value, { ...saved.value, workspaceId: sibling.workspaceId });
    assert.equal(events.length, revision);
  }
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), sources.map((row) => ({ ...row, category_property_revision: revision })));
  assert.deepEqual(sqlite.prepare("SELECT * FROM projects").all(), projects);
  assert.deepEqual(sqlite.prepare("SELECT * FROM categories").all(), categories);
  assert.deepEqual(sqlite.prepare("SELECT * FROM views").all(), views);
  assert.deepEqual(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: workspace.workspaceId }).value, textBefore);
  assert.deepEqual(inventory(root), before);
  assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: review.previewToken }).ok, true);
  assert.equal(events.length, revision);
  service.close();
  const reopened = openSettingsService(databasePath);
  try {
    const projection = reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }).value;
    assert.equal(projection.categoryPropertyRevision, revision); assert.equal(projection.categoryProperty.name, "Long ".repeat(600));
    assert.equal(projection.categoryProperty.propertyId, propertyId); assert.deepEqual(projection.projects, applied.projects);
  } finally { reopened.close(); }
}));

test("category label rejects malformed, foreign, missing and direct inputs and rolls back failed metadata writes", () => fixture((f) => {
  const { root, directory, service, workspace, sqlite } = f;
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true });
  const propertyId = applyGrouped(f).categoryProperty.propertyId;
  const directRoot = join(directory, "direct"), otherRoot = join(directory, "other"); fs.mkdirSync(directRoot); fs.mkdirSync(join(otherRoot, "Category"), { recursive: true });
  const direct = service.workspaces.create({ type: "workspace.create", name: "Direct", rootPath: directRoot }).value;
  const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
  const otherPreview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: other.workspaceId, mode: "grouped" }).value;
  const foreign = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: other.workspaceId, previewToken: otherPreview.previewToken }).value.categoryProperty.propertyId;
  const directPreview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: direct.workspaceId }).value;
  service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: direct.workspaceId, previewToken: directPreview.previewToken });
  const command = { type: "workspace.renameCategoryProperty", workspaceId: workspace.workspaceId, propertyId, name: "Saved" };
  const before = sqlite.prepare("SELECT * FROM sources").all(), properties = sqlite.prepare("SELECT * FROM category_properties").all();
  const events = []; service.workspaces.subscribe((event) => events.push(event));
  for (const input of [null, [], { ...command, extra: true }, { ...command, type: "workspace.renameProperty" },
    { ...command, workspaceId: "bad" }, { ...command, workspaceId: randomUUID() }, { ...command, propertyId: "bad" },
    { ...command, propertyId: randomUUID() }, { ...command, propertyId: foreign }, { ...command, workspaceId: direct.workspaceId },
    { ...command, name: null }, { ...command, name: "" }, { ...command, name: " \n\t " },
    { type: command.type, workspaceId: workspace.workspaceId, propertyId }]) {
    assert.equal(service.workspaces.renameCategoryProperty(input).error.code, "invalid_input");
  }
  // Failure after the label write must roll it and the revision back together.
  sqlite.exec("CREATE TRIGGER fail_category_revision BEFORE UPDATE OF category_property_revision ON sources BEGIN SELECT RAISE(ABORT, 'injected'); END");
  assert.equal(service.handleCommand(command).error.code, "storage");
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), before);
  assert.deepEqual(sqlite.prepare("SELECT * FROM category_properties").all(), properties);
  assert.deepEqual(events, []);
  sqlite.exec("DROP TRIGGER fail_category_revision");
  assert.equal(service.handleCommand(command).ok, true);
  assert.deepEqual(events[0].workspaceIds, [workspace.workspaceId]);
  assert.equal(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: other.workspaceId }).value.categoryProperty.name, null);
}));

test("category label notification queue preserves committed snapshots with throwing and reentrant subscribers", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category"));
  const propertyId = applyGrouped(f).categoryProperty.propertyId;
  const command = (name) => ({ type: "workspace.renameCategoryProperty", workspaceId: f.workspace.workspaceId, propertyId, name });
  const observed = [];
  f.service.workspaces.subscribe(() => { throw new Error("subscriber failure"); });
  f.service.workspaces.subscribe((event) => { if (event.type === "workspace.categoryPropertyChanged" && event.revision === 1) assert.equal(f.service.handleCommand(command("Second")).value.revision, 2); });
  f.service.workspaces.subscribe((event) => observed.push(event.revision));
  const first = f.service.handleCommand(command("First"));
  assert.equal(first.ok, true); assert.equal(first.value.name, "First"); assert.equal(first.value.revision, 1);
  assert.deepEqual(observed, [1, 2]);
  assert.equal(f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value.categoryProperty.name, "Second");
}));

test("explicit grouped recovery remains active through discovery when moved category evidence is historical", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const apply = () => {
    const preview = f.preview(); assert.equal(preview.ok, true);
    return f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: preview.value.previewToken });
  };
  const original = apply().value.projects[0];
  const property = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId, name: "Notes", propertyType: "text" }).value;
  f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: original.projectId, propertyId: property.propertyId, value: "Historical project Text" });
  fs.renameSync(join(f.root, "Category"), join(f.root, "New category"));
  fs.mkdirSync(join(f.root, "Category/Replacement"), { recursive: true });
  const discovered = apply(); assert.equal(discovered.ok, true);
  assert.equal(discovered.value.retainedProjects.find((row) => row.projectId === original.projectId).resolution, "replaced");
  const oldCategories = f.sqlite.prepare("SELECT * FROM categories").all();
  const preview = f.service.workspaces.previewProjectRecovery({ type: "workspace.previewProjectRecovery", workspaceId: f.workspace.workspaceId, projectId: original.projectId });
  assert.equal(preview.ok, true);
  assert.equal(preview.value.entries.find((row) => row.relativePath === "New category/Project").status, "selectable");
  const files = inventory(f.root);
  const recovered = f.service.workspaces.reassociateProject({ type: "workspace.reassociateProject", workspaceId: f.workspace.workspaceId, projectId: original.projectId,
    previewToken: preview.value.previewToken, relativePath: "New category/Project" });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value.projects.find((row) => row.projectId === original.projectId).resolution, "active");
  const review = f.preview(); assert.equal(review.ok, true);
  assert.ok(review.value.entries.every((entry) => entry.reason === null));
  const reapplied = f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: review.value.previewToken });
  assert.deepEqual(reapplied, recovered);
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM categories").all().filter((row) => oldCategories.some((old) => old.id === row.id)), oldCategories);
  assert.equal(f.service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: f.workspace.workspaceId }).value.values[0].value, "Historical project Text");
  assert.deepEqual(inventory(f.root), files);
}));

test("insufficient category evidence retains unresolved projects rather than reporting manual exclusion", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const preview = f.preview().value;
  const original = f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: preview.previewToken }).value.projects[0];
  const before = f.sqlite.prepare("SELECT * FROM projects").all();
  const stat = fs.lstatSync;
  fs.lstatSync = (path, ...args) => {
    const result = stat(path, ...args);
    if (path === join(f.root, "Category")) result.birthtimeNs = 0n;
    return result;
  };
  syncBuiltinESMExports();
  try {
    const observed = f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId });
    assert.equal(observed.ok, true);
    assert.deepEqual(observed.value.projects, []); assert.deepEqual(observed.value.categories, []);
    assert.equal(observed.value.retainedProjects[0].projectId, original.projectId);
    assert.equal(observed.value.retainedProjects[0].resolution, "unresolved");
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects").all(), before);
    const recovery = f.service.workspaces.previewProjectRecovery({ type: "workspace.previewProjectRecovery", workspaceId: f.workspace.workspaceId, projectId: original.projectId });
    assert.equal(recovery.ok,true,JSON.stringify(recovery));
    assert.notEqual(recovery.value.entries.find(row=>row.relativePath===original.relativePath)?.status,"selectable");
  } finally { fs.lstatSync = stat; syncBuiltinESMExports(); }
}));
