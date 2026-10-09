import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

function inventory(path) {
  return fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [entry.name,
    entry.isDirectory() ? inventory(join(path, entry.name)) : fs.readFileSync(join(path, entry.name)).toString("hex")]);
}

function fixture(run, mode = "direct") {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "project-recovery-")));
  const root = join(directory, "root");
  fs.mkdirSync(join(root, mode === "grouped" ? "Category/Project" : "Project"), { recursive: true });
  const databasePath = join(directory, "workspace.sqlite");
  const service = openSettingsService(databasePath);
  const sqlite = new Database(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Recovery", rootPath: root }).value;
  const query = (type) => service.handleQuery({ type, workspaceId: workspace.workspaceId });
  const apply = (extra = {}) => {
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode, ...extra });
    assert.equal(preview.ok, true);
    const result = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.value.previewToken });
    assert.equal(result.ok, true); return result.value;
  };
  const project = apply().projects[0];
  const propertyId = service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Notes", propertyType: "text" }).value.propertyId;
  const value = "  Authored\nТекст 📝  ";
  assert.equal(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: project.projectId, propertyId, value }).ok, true);
  const records = () => ["sources", "projects", "categories", "property_definitions", "text_property_values", "views"].map((table) => sqlite.prepare(`SELECT * FROM ${table}`).all());
  try { run({ directory, root, sqlite, service, workspace, project, propertyId, value, query, apply, records }); }
  finally { sqlite.close(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("listProjects observes individual disappearance before Apply without changing records, revisions or Text", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
  const before = f.records();
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const result = f.query("workspace.listProjects");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.projects, []);
  assert.equal(result.value.retainedCount, 1);
  assert.deepEqual(result.value.retainedProjects.map((row) => [row.projectId, row.associationState, row.resolution]), [[f.project.projectId, "active", "missing"]]);
  assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
  assert.deepEqual(f.records(), before); assert.deepEqual(events, []);
}));

test("retained excluded, missing, ambiguous and replaced records expose original IDs and editable Text", () => {
  for (const state of ["excluded", "missing", "unresolved", "replaced"]) fixture((f) => {
    if (state === "excluded") f.apply({ excludedRelativePaths: ["Project"] });
    if (state === "missing" || state === "unresolved" || state === "replaced") {
      fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
      if (state === "replaced") fs.mkdirSync(join(f.root, "Project"));
      f.apply();
      if (state === "unresolved") { fs.renameSync(join(f.directory, "away"), join(f.root, "Project")); f.apply(); }
    }
    const before = f.records(), result = f.query("workspace.listProjects").value;
    const retained = result.retainedProjects.find((row) => row.projectId === f.project.projectId);
    assert.equal(retained.associationState, state); assert.equal(retained.resolution, state);
    assert.equal(result.retainedCount, result.retainedProjects.length);
    assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
    assert.deepEqual(f.records(), before);
    assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: retained.projectId, propertyId: f.propertyId, value: "Edited retained" }).ok, true);
    assert.equal(f.query("workspace.listTextProperties").value.values[0].value, "Edited retained");
    const replacement = result.projects.find((row) => row.projectId !== retained.projectId);
    if (replacement) assert.ok(!f.query("workspace.listTextProperties").value.values.some((row) => row.projectId === replacement.projectId));
  });
});

test("unavailable, unreadable, changed and conflicting roots do not report mass missing or mutate metadata/files", () => {
  for (const state of ["unavailable", "unreadable", "changed", "root_identity_conflict"]) fixture((f) => {
    fs.writeFileSync(join(f.root, "Project", "sentinel"), "unchanged");
    if (state === "unavailable" || state === "root_identity_conflict") fs.renameSync(f.root, join(f.directory, "away"));
    if (state === "root_identity_conflict") fs.mkdirSync(f.root);
    const before = f.records();
    const fixtureRoot = state === "unavailable" || state === "root_identity_conflict" ? join(f.directory, "away") : f.root;
    const files = inventory(fixtureRoot);
    const originalOpen = fs.opendirSync, originalStat = fs.lstatSync;
    fs.opendirSync = (path, ...args) => { if (state === "unreadable" && path === f.root) throw Object.assign(new Error("denied"), { code: "EACCES" }); return originalOpen(path, ...args); };
    let observations = 0;
    fs.lstatSync = (path, ...args) => {
      const stat = originalStat(path, ...args);
      if (state === "changed" && path === f.root) stat.mtimeNs += BigInt(++observations);
      return stat;
    };
    syncBuiltinESMExports();
    let result;
    try { result = f.query("workspace.listProjects"); }
    finally { fs.opendirSync = originalOpen; fs.lstatSync = originalStat; syncBuiltinESMExports(); }
    assert.equal(result.ok, true); assert.equal(result.value.state, state);
    assert.equal(result.value.projects[0].projectId, f.project.projectId);
    assert.equal(result.value.projects[0].resolution, null);
    assert.deepEqual(result.value.retainedProjects, []);
    assert.deepEqual(f.records(), before);
    assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
    assert.equal(fs.readFileSync(join(state === "unavailable" || state === "root_identity_conflict" ? join(f.directory, "away") : f.root, "Project", "sentinel"), "utf8"), "unchanged");
    assert.deepEqual(inventory(fixtureRoot), files);
  });
});

test("grouped retained projects keep historical category labels outside active category options", () => fixture((f) => {
  fs.renameSync(join(f.root, "Category"), join(f.directory, "away"));
  const before = f.records();
  const observed = f.query("workspace.listProjects").value;
  assert.equal(observed.retainedProjects[0].categoryName, "Category");
  assert.equal(observed.retainedProjects[0].associationState, "active");
  assert.equal(observed.retainedProjects[0].resolution, "missing");
  assert.deepEqual(observed.categories, []);
  assert.deepEqual(f.records(), before);
  f.apply();
  const result = f.query("workspace.listProjects").value;
  assert.deepEqual(result.categories, []);
  assert.equal(result.retainedProjects[0].categoryId, f.project.categoryId);
  assert.equal(result.retainedProjects[0].categoryName, "Category");
  assert.equal(result.retainedProjects[0].resolution, "missing");
  assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
}, "grouped"));

test("read-only observed replacement and ambiguous native evidence retain the active record before Apply", () => {
  for (const resolution of ["replaced", "unresolved"]) fixture((f) => {
    if (resolution === "replaced") { fs.renameSync(join(f.root, "Project"), join(f.directory, "away")); fs.mkdirSync(join(f.root, "Project")); }
    const before = f.records(), files = inventory(f.root);
    const original = fs.lstatSync;
    fs.lstatSync = (path, ...args) => {
      const stat = original(path, ...args);
      if (resolution === "unresolved" && path === join(f.root, "Project")) stat.birthtimeNs = 0n;
      return stat;
    };
    syncBuiltinESMExports();
    let result;
    try { result = f.query("workspace.listProjects"); }
    finally { fs.lstatSync = original; syncBuiltinESMExports(); }
    assert.equal(result.ok, true); assert.deepEqual(result.value.projects, []);
    assert.equal(result.value.retainedProjects[0].projectId, f.project.projectId);
    assert.equal(result.value.retainedProjects[0].associationState, "active");
    assert.equal(result.value.retainedProjects[0].resolution, resolution);
    assert.deepEqual(f.records(), before); assert.deepEqual(inventory(f.root), files);
    assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
  });
});
