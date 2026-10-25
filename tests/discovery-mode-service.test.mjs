import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";
import { withIdentityMigrationDefaults, projectMetadataRecords } from "./support/identity-migration-fixtures.mjs";
import { modeRetainedResolution } from "../src/service/discovery.ts";

test("mode-retained archive containment uses exact paths and scanner-confirmed aliases", () => {
  const identity = (ino) => ({ dev: "1", ino, birthtimeNs: "1" });
  const directory = (relativePath, ino) => ({ relativePath, kind: "directory", identity: identity(ino), mtimeNs: "1", ctimeNs: "1" });
  const project = { id: "project", sourceId: "source", relativePath: "Alpha", nativeIdentity: JSON.stringify(identity("2")), associationState: "excluded", modeInactive: true };
  const scan = { state: "ready", entries: [], snapshot: { mode: "grouped", root: directory("", "1"), archiveChild: "alpha/Archive", children: [
    directory("Alpha", "2"), directory("alpha", "3"), { relativePath: "alpha/Archive", kind: "excluded", reason: "archive" },
  ] } };
  // These are distinct directories on a case-sensitive filesystem, not aliases.
  assert.equal(modeRetainedResolution(scan, project, [], "alpha/Archive"), "unresolved");
  assert.equal(modeRetainedResolution(scan, project, [], "Alpha/Archive"), "excluded");
  // On an insensitive filesystem the scanner resolves aliases using native IDs.
  scan.snapshot.children = [directory("Alpha", "2"), { relativePath: "Alpha/Archive", kind: "excluded", reason: "archive" }];
  assert.equal(modeRetainedResolution(scan, project, [], "alpha/Archive"), "excluded");
});

function fixture(run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "workspace-mode-")));
  const root = join(directory, "root"); fs.mkdirSync(root);
  const databasePath = join(directory, "data", "workspace.sqlite");
  let service = openSettingsService(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Mode", rootPath: root }).value;
  const sqlite = new Database(databasePath);
  const query = (extra = {}) => service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, ...extra });
  const apply = (preview) => service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken });
  const configure = (mode, extra = {}) => {
    const preview = query({ mode, ...extra }); assert.equal(preview.ok, true, JSON.stringify(preview));
    const result = apply(preview.value); assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
  };
  const restart = () => { service.close(); service = openSettingsService(databasePath); };
  try { run({ directory, root, sqlite, get service() { return service; }, workspace, query, apply, configure, restart }); }
  finally { sqlite.close(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
function inventory(path) {
  return fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [entry.name,
    entry.isSymbolicLink() ? fs.readlinkSync(join(path, entry.name)) : entry.isDirectory() ? inventory(join(path, entry.name))
      : fs.readFileSync(join(path, entry.name)).toString("hex")]);
}
function databaseInventory(sqlite) {
  return sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(({ name }) =>
    [name, sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]);
}
function unchanged(f, run) {
  const database = databaseInventory(f.sqlite), files = inventory(f.directory);
  const events = [], unsubscribe = f.service.workspaces.subscribe((event) => events.push(event));
  try { run(); } finally { unsubscribe(); }
  assert.deepEqual(databaseInventory(f.sqlite), database);
  assert.deepEqual(inventory(f.directory), files);
  assert.deepEqual(events, []);
}
const paths = (rows) => rows.map((row) => row.relativePath);

for (const exclusion of ["direct", "grouped-child", "grouped-category"]) for (const ownPath of [false, true]) {
  test(`removed ${exclusion} exclusion permits explicit mode-retained recovery (ownPath=${ownPath})`, () => fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Child"), { recursive: true });
    fs.writeFileSync(join(f.root, "Category/Child/sentinel"), "unchanged");
    const mode = exclusion === "direct" ? "direct" : "grouped", otherMode = mode === "direct" ? "grouped" : "direct";
    const first = f.configure(mode), project = first.projects[0];
    const excludedPath = exclusion === "grouped-child" ? project.relativePath : "Category";
    const property = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId, name: "Notes", propertyType: "text" }).value;
    const value = "  Exact\nТекст 📝  ";
    assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value }).ok, true);
    f.configure(mode, { excludedRelativePaths: [excludedPath] });
    f.configure(otherMode); f.restart();
    const request = { workspaceId: f.workspace.workspaceId, projectId: project.projectId };
    assert.equal(f.service.workspaces.previewProjectRecovery({ type: "workspace.previewProjectRecovery", ...request }).error.code, "invalid_input");
    const history = f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId);
    const files = inventory(f.root);
    const cleared = f.configure(otherMode, { excludedRelativePaths: [] });
    const observed = cleared.retainedProjects.find((row) => row.projectId === project.projectId);
    assert.equal(observed.associationState, "excluded"); assert.equal(observed.resolution, "unresolved");
    assert.equal(observed.retentionReason, "mode_change");
    if (ownPath) f.configure(mode);
    f.restart();
    const target = ownPath ? project.relativePath : otherMode === "grouped" ? "New/Target" : "Target";
    if (!ownPath) fs.mkdirSync(join(f.root, target), { recursive: true });
    const before = databaseInventory(f.sqlite), targetFiles = inventory(f.root);
    const preview = f.service.workspaces.previewProjectRecovery({ type: "workspace.previewProjectRecovery", ...request });
    assert.equal(preview.ok, true, JSON.stringify(preview));
    assert.equal(preview.value.entries.find((entry) => entry.relativePath === target).status, "selectable");
    assert.deepEqual(databaseInventory(f.sqlite), before);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId), history);
    const recovered = f.service.workspaces.reassociateProject({ type: "workspace.reassociateProject", ...request, previewToken: preview.value.previewToken, relativePath: target });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.projects.find((row) => row.projectId === project.projectId).relativePath, target);
    const stored = f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId);
    assert.equal(stored.association_state, "active"); assert.equal(stored.mode_inactive, 0);
    assert.equal(f.sqlite.prepare("SELECT value FROM text_property_values WHERE project_id = ?").get(project.projectId).value, value);
    assert.deepEqual(inventory(f.root), targetFiles);
    if (ownPath) assert.deepEqual(inventory(f.root), files);
    f.restart();
    assert.ok(f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value.projects.some((row) => row.projectId === project.projectId));
  }));
}

for (const mode of ["direct", "grouped"]) test(`mode-retained archive exclusions stay blocked after clearing manual exclusions (${mode})`, () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Child/Archive"), { recursive: true });
  const project = f.configure(mode).projects[0];
  f.sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run("Category/Child/Archive");
  f.configure(mode);
  const switched = f.configure(mode === "direct" ? "grouped" : "direct", { excludedRelativePaths: [] });
  const retained = switched.retainedProjects.find((row) => row.projectId === project.projectId);
  assert.equal(retained.associationState, "excluded"); assert.equal(retained.resolution, "excluded");
  const before = databaseInventory(f.sqlite), files = inventory(f.root);
  const request = { type: "workspace.previewProjectRecovery", workspaceId: f.workspace.workspaceId, projectId: project.projectId };
  assert.equal(f.service.workspaces.previewProjectRecovery(request).error.code, "invalid_input");
  f.restart();
  assert.equal(f.service.workspaces.previewProjectRecovery(request).error.code, "invalid_input");
  assert.deepEqual(databaseInventory(f.sqlite), before); assert.deepEqual(inventory(f.root), files);
}));

test("configured direct-to-grouped preview keeps direct metadata and reviews fresh target roles without writes", () => fixture((f) => {
  for (const path of ["Category/Child/Deeper", "Empty", "Mixed/src"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  fs.writeFileSync(join(f.root, "Category/Child/sentinel"), Buffer.from([0, 255, 7]));
  const original = f.configure("direct");
  const project = original.projects.find((row) => row.relativePath === "Category");
  const property = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId, name: " Notes ", propertyType: "text" }).value;
  assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  exact\nтекст  " }).ok, true);
  unchanged(f, () => {
    const result = f.query({ mode: "grouped" }); assert.equal(result.ok, true, JSON.stringify(result));
    const review = result.value;
    assert.equal(review.currentMode, "direct"); assert.equal(review.mode, "grouped"); assert.ok(review.previewToken);
    assert.deepEqual(review.categoryAvailability, { current: false, target: true, propertyId: null, name: null });
    assert.deepEqual(paths(review.projectEffects.added), ["Category/Child", "Mixed/src"]);
    assert.ok(review.projectEffects.added.every((row) => !Object.hasOwn(row, "projectId")));
    assert.deepEqual(new Set(review.projectEffects.noLongerRecognized.map((row) => row.projectId)), new Set(original.projects.map((row) => row.projectId)));
    assert.deepEqual(review.projectEffects.retained, []); assert.deepEqual(review.projectEffects.alreadyRetained, []);
    assert.equal(review.entries.find((row) => row.relativePath === "Category").reason, null);
    // Abandoning a preview is Cancel at the service boundary.
  });
}));

test("configured grouped-to-direct preview preserves category UUID/label and inactive nested exclusions literally", () => fixture((f) => {
  for (const path of ["Category/Kept", "Category/Excluded", "Manual/Inside", "Empty"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  const original = f.configure("grouped", { excludedRelativePaths: ["Category/Excluded", "Manual"] });
  assert.equal(f.service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: f.workspace.workspaceId, propertyId: original.categoryProperty.propertyId, name: "  Authored category  " }).ok, true);
  unchanged(f, () => {
    const result = f.query({ mode: "direct" }); assert.equal(result.ok, true, JSON.stringify(result));
    const review = result.value;
    assert.equal(review.currentMode, "grouped"); assert.ok(review.previewToken);
    assert.deepEqual(review.categoryAvailability, { current: true, target: false, propertyId: original.categoryProperty.propertyId, name: "  Authored category  " });
    assert.deepEqual(review.excludedRelativePaths, ["Category/Excluded", "Manual"]);
    assert.deepEqual(review.effectiveExcludedRelativePaths, ["Manual"]);
    assert.deepEqual(review.inactiveExcludedRelativePaths, ["Category/Excluded"]);
    assert.equal(review.entries.find((row) => row.relativePath === "Category").reason, null);
    assert.equal(review.entries.find((row) => row.relativePath === "Manual").reason, "manual");
    assert.deepEqual(paths(review.projectEffects.added), ["Category", "Empty"]);
    assert.deepEqual(review.projectEffects.noLongerRecognized.map((row) => row.projectId), original.projects.map((row) => row.projectId));
  });
}));

test("same-mode preview separates continuous IDs, new folders and already retained metadata", () => fixture((f) => {
  for (const path of ["Kept", "Lost", "Excluded"]) fs.mkdirSync(join(f.root, path));
  const original = f.configure("direct");
  f.configure("direct", { excludedRelativePaths: ["Excluded"] });
  fs.renameSync(join(f.root, "Lost"), join(f.directory, "lost"));
  f.configure("direct");
  fs.mkdirSync(join(f.root, "New"));
  unchanged(f, () => {
    const review = f.query().value;
    assert.deepEqual(paths(review.projectEffects.added), ["New"]);
    assert.deepEqual(paths(review.projectEffects.retained), ["Kept"]);
    assert.equal(review.projectEffects.retained[0].projectId, original.projects.find((row) => row.relativePath === "Kept").projectId);
    assert.deepEqual(paths(review.projectEffects.alreadyRetained), ["Excluded", "Lost"]);
    assert.deepEqual(review.projectEffects.noLongerRecognized, []);
  });
}));

test("enrolled category mismatch retains its original data without automatic replacement enrollment", () => fixture((f) => {
  fs.mkdirSync(join(f.root,"Category/Old"),{recursive:true});
  const first=f.configure("grouped"),project=first.projects[0];
  const property=f.service.workspaces.createProperty({type:"workspace.createProperty",workspaceId:f.workspace.workspaceId,name:"Notes",propertyType:"text"}).value;
  assert.equal(f.service.workspaces.setTextValue({type:"workspace.setTextValue",workspaceId:f.workspace.workspaceId,projectId:project.projectId,propertyId:property.propertyId,value:"Original metadata"}).ok,true);
  const original=f.sqlite.prepare('SELECT id,native_identity,durable_evidence FROM categories').all();
  fs.renameSync(join(f.root,"Category"),join(f.directory,"old-category"));
  fs.mkdirSync(join(f.root,"Category/New"),{recursive:true});
  const files=inventory(f.root),applied=f.configure("grouped");
  assert.deepEqual(applied.projects,[]);
  assert.equal(applied.retainedProjects[0].projectId,project.projectId);
  assert.deepEqual(f.sqlite.prepare('SELECT id,native_identity,durable_evidence FROM categories').all(),original);
  const review=f.service.handleQuery({type:"workspace.previewSourceAssociation",workspaceId:f.workspace.workspaceId,mappings:[{kind:"category",id:project.categoryId,relativePath:"Category"}]});
  assert.equal(review.ok,true);assert.equal(review.value.previewToken,null);
  assert.equal(review.value.candidates.find(c=>c.id===project.categoryId).reason,"folder_changed");
  f.restart();
  assert.deepEqual(f.sqlite.prepare('SELECT id,native_identity,durable_evidence FROM categories').all(),original);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM projects').get().n,1);
  assert.equal(f.service.workspaces.listTextProperties({type:"workspace.listTextProperties",workspaceId:f.workspace.workspaceId}).value.values[0].value,"Original metadata");
  assert.deepEqual(inventory(f.root),files);
}));

test("empty configured roots can review either interpretation without persistent writes", () => {
  for (const current of ["direct", "grouped"]) fixture((f) => {
    f.configure(current);
    unchanged(f, () => {
      const review = f.query({ mode: current === "direct" ? "grouped" : "direct" }).value;
      assert.equal(review.state, "empty"); assert.ok(review.previewToken); assert.equal(review.currentMode, current);
      assert.deepEqual(review.projectEffects, { added: [], retained: [], noLongerRecognized: [], alreadyRetained: [] });
    });
  });
});

test("configured mode review rejects malformed/foreign commands and new inactive-depth exclusions", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true }); f.configure("grouped", { excludedRelativePaths: ["Category/Project"] });
  unchanged(f, () => {
    for (const extra of [{ mode: null }, { mode: "recursive" }, { mode: undefined }, { workspaceId: randomUUID() }, { workspaceId: f.workspace.sourceId }, { extra: true },
      ...[["../escape"], ["/absolute"], ["Category//Project"], ["Category/Project/Deep"], ["Category", "Category"], ["Invented/Child"]].map((excludedRelativePaths) => ({ mode: "direct", excludedRelativePaths }))]) {
      assert.equal(f.query(extra).error.code, "invalid_input", JSON.stringify(extra));
    }
    assert.equal(f.query({ mode: "direct", excludedRelativePaths: ["Category/Project"] }).ok, true);
  });
}));

test("target mode preview excludes links and designated archive containment before opening targets", () => fixture((f) => {
  for (const path of ["Category/Storage/Archive", "Category/Kept", ".hidden/Inside"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  const external = join(f.directory, "external"); fs.mkdirSync(external); fs.writeFileSync(join(external, "sentinel"), "outside");
  fs.symlinkSync(external, join(f.root, "Linked"), process.platform === "win32" ? "junction" : "dir");
  f.configure("direct"); f.sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run("Category/Storage/Archive");
  const original = fs.opendirSync;
  fs.opendirSync = (path, ...args) => {
    assert.ok(![external, join(f.root, "Linked"), join(f.root, ".hidden"), join(f.root, "Category/Storage")].includes(path));
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  try {
    unchanged(f, () => {
      const review = f.query({ mode: "grouped" }).value;
      assert.ok(review.previewToken);
      assert.equal(review.entries.find((row) => row.relativePath === "Linked").reason, "link");
      assert.equal(review.entries.find((row) => row.relativePath === "Category/Storage").reason, "archive");
      assert.deepEqual(paths(review.projectEffects.added), ["Category/Kept"]);
    });
  } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
}));

test("configured target reviews cannot apply unavailable, unreadable, changed or replaced roots", () => {
  for (const failure of ["unavailable", "unreadable", "changed", "root_identity_conflict"]) fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true }); f.configure("direct");
    const original = fs.opendirSync;
    let reads = 0;
    if (failure === "unavailable" || failure === "root_identity_conflict") {
      fs.renameSync(f.root, join(f.directory, "old"));
      if (failure === "root_identity_conflict") fs.mkdirSync(f.root);
    } else {
      fs.opendirSync = (path, ...args) => {
        if (failure === "unreadable" && path === join(f.root, "Category")) throw Object.assign(new Error("denied"), { code: "EACCES" });
        if (failure === "changed" && path === f.root && ++reads === 2) fs.mkdirSync(join(f.root, "Category/New"));
        return original(path, ...args);
      };
      syncBuiltinESMExports();
    }
    const before = databaseInventory(f.sqlite);
    let result;
    try { result = f.query({ mode: "grouped" }); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.state, failure); assert.equal(result.value.previewToken, null);
    assert.deepEqual(result.value.entries, []); assert.deepEqual(result.value.projectEffects.added, []);
    assert.deepEqual(databaseInventory(f.sqlite), before);
  });
});

test("project native reservations at another depth block guessed target IDs while category roles stay independent", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Child"), { recursive: true });
  const original = f.configure("direct");
  const child = fs.statSync(join(f.root, "Category/Child"), { bigint: true });
  // Simulate reused native evidence at the new depth; neither path nor native evidence authorizes a transfer.
  f.sqlite.prepare("UPDATE projects SET native_identity = ? WHERE id = ?").run(JSON.stringify({ dev: child.dev.toString(), ino: child.ino.toString(), birthtimeNs: child.birthtimeNs.toString() }), original.projects[0].projectId);
  unchanged(f, () => {
    const review = f.query({ mode: "grouped" }).value;
    assert.ok(review.previewToken);
    assert.equal(review.entries.find((row) => row.relativePath === "Category").reason, null);
    assert.equal(review.entries.find((row) => row.relativePath === "Category/Child").reason, "unresolved");
    assert.deepEqual(review.projectEffects.added, []);
    assert.equal(review.projectEffects.noLongerRecognized[0].projectId, original.projects[0].projectId);
  });
}));

test("review copies cannot alter committed effects and Text edits do not stale the independent discovery review", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Kept")); const original = f.configure("direct"); fs.mkdirSync(join(f.root, "New"));
  const review = f.query().value;
  review.entries.length = 0; review.projectEffects.added.length = 0; review.effectiveExcludedRelativePaths.push("New"); review.currentMode = "grouped";
  const property = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId, name: "Notes", propertyType: "text" }).value;
  f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: original.projects[0].projectId, propertyId: property.propertyId, value: "exact  " });
  const result = f.apply(review); assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(paths(result.value.projects), ["Kept", "New"]);
}));

test("stored association, category and configuration changes invalidate reviewed tokens without writes", () => {
  for (const change of ["project", "category", "configuration", "snapshot"]) fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true }); f.configure("grouped");
    const review = f.query().value;
    if (change === "project") f.sqlite.prepare("UPDATE projects SET native_identity = ?").run(JSON.stringify({ dev: "0", ino: "1", birthtimeNs: "1" }));
    if (change === "category") f.sqlite.prepare("UPDATE categories SET native_identity = ?").run(JSON.stringify({ dev: "0", ino: "1", birthtimeNs: "1" }));
    if (change === "configuration") f.sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run("Category/Project/archive");
    if (change === "snapshot") fs.mkdirSync(join(f.root, "New/Project"), { recursive: true });
    unchanged(f, () => assert.equal(f.apply(review).error.code, "stale_preview"));
  });
});

test("category label edits preserve the independent review and are reflected in subsequent mode previews", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true }); const original = f.configure("grouped");
  const review = f.query().value;
  f.service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: f.workspace.workspaceId, propertyId: original.categoryProperty.propertyId, name: " Exact label " });
  assert.equal(f.apply(review).ok, true);
  assert.equal(f.query({ mode: "direct" }).value.categoryAvailability.name, " Exact label ");
}));

test("mode Apply retains logical history and exact Text while fresh folder roles get fresh identities", () => {
  for (const current of ["direct", "grouped"]) fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Child"), { recursive: true });
    fs.writeFileSync(join(f.root, "Category/Child/sentinel"), Buffer.from([0, 255, 12]));
    const first = f.configure(current), project = first.projects[0];
    const property = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId, name: " Notes ", propertyType: "text" }).value;
    f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  exact\nтекст  " });
    const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
    const beforeFiles = inventory(f.root), beforeViews = f.sqlite.prepare("SELECT * FROM views ORDER BY id").all();
    const beforeSource = f.sqlite.prepare("SELECT * FROM sources").get();
    const beforeProject = f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId);
    const events = [], unsubscribe = f.service.workspaces.subscribe((event) => events.push(event));
    const next = f.configure(current === "direct" ? "grouped" : "direct");
    unsubscribe();
    assert.equal(next.revision, first.revision + 1);
    assert.equal(next.retainedProjects.find((row) => row.projectId === project.projectId).retentionReason, "mode_change");
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId), { ...beforeProject, mode_inactive: 1 });
    assert.ok(next.projects.every((row) => row.projectId !== project.projectId));
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM text_property_values").get().count, 1);
    assert.equal(f.sqlite.prepare("SELECT value FROM text_property_values").get().value, "  exact\nтекст  ");
    assert.equal(f.sqlite.prepare("SELECT property_revision FROM sources").get().property_revision, beforeSource.property_revision);
    assert.equal(f.sqlite.prepare("SELECT category_property_revision FROM sources").get().category_property_revision, beforeSource.category_property_revision);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM views ORDER BY id").all(), beforeViews);
    assert.deepEqual(inventory(f.root), beforeFiles);
    const committed = events.filter((row) => row.type === "workspace.projectsChanged");
    assert.equal(committed.length, 1); assert.deepEqual(new Set(committed[0].workspaceIds), new Set([f.workspace.workspaceId, sibling.workspaceId]));
    if (current === "grouped") { assert.equal(next.categoryProperty, null); assert.deepEqual(next.categories, []); }
    const revised = f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "still editable  " });
    assert.equal(revised.ok, true);
    unchanged(f, () => assert.deepEqual(f.configure(next.mode), next));
    const reopened = openSettingsService(join(f.directory, "data", "workspace.sqlite"));
    try {
      assert.deepEqual(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value, next);
      assert.equal(reopened.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId: sibling.workspaceId }).ok, true);
    } finally { reopened.close(); }
  });
});

test("mode Apply rolls back partial writes and observed races without publishing committed events", () => {
  for (const failure of ["source", "category", "project", "database_race", "filesystem_race"]) fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Child"), { recursive: true }); f.configure("direct");
    const review = f.query({ mode: "grouped" }).value;
    if (["source", "category", "project"].includes(failure)) f.sqlite.exec(`CREATE TRIGGER injected_failure BEFORE ${failure === "source" ? "UPDATE" : "INSERT"} ON ${failure === "source" ? "sources" : failure === "category" ? "categories" : "projects"} BEGIN SELECT RAISE(ABORT, 'injected'); END`);
    if (failure === "database_race") f.sqlite.exec("CREATE TRIGGER injected_race AFTER INSERT ON projects BEGIN UPDATE sources SET discovery_revision = discovery_revision + 1; END");
    const original = fs.opendirSync; let reads = 0;
    if (failure === "filesystem_race") { fs.opendirSync = (path, ...args) => { if (path === f.root && ++reads === 5) fs.mkdirSync(join(f.root, "Category/Raced")); return original(path, ...args); }; syncBuiltinESMExports(); }
    const files = inventory(f.root);
    const before = databaseInventory(f.sqlite), events = [], unsubscribe = f.service.workspaces.subscribe((event) => events.push(event));
    let result;
    try { result = f.apply(review); } finally { fs.opendirSync = original; syncBuiltinESMExports(); unsubscribe(); }
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.error.code, failure.endsWith("race") ? "stale_preview" : "storage");
    assert.deepEqual(databaseInventory(f.sqlite), before); assert.deepEqual(events, []);
    if (failure !== "filesystem_race") assert.deepEqual(inventory(f.root), files);
  });
});

test("actual populated 0000–0006 upgrade preserves authored data, selection, IDs and independent views", () => {
  for (const mode of ["direct", "grouped"]) {
    const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "workspace-mode-upgrade-")));
    const legacy = join(directory, "legacy"), root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
    const relativePath = mode === "grouped" ? "Category/Project" : "Project";
    fs.mkdirSync(join(root, relativePath), { recursive: true }); fs.mkdirSync(join(legacy, "meta"), { recursive: true });
    fs.writeFileSync(join(root, relativePath, "sentinel"), Buffer.from([0, 255, 43]));
    const folder = "src/service/db/migrations", journal = JSON.parse(fs.readFileSync(join(folder, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.slice(0, 7);
    for (const entry of journal.entries) fs.copyFileSync(join(folder, `${entry.tag}.sql`), join(legacy, `${entry.tag}.sql`));
    fs.writeFileSync(join(legacy, "meta/_journal.json"), JSON.stringify(journal));
    const sql = new Database(databasePath); let service;
    const sourceId = randomUUID(), workspaceId = randomUUID(), siblingId = randomUUID(), viewId = randomUUID(), siblingViewId = randomUUID();
    const categoryId = randomUUID(), categoryPropertyId = randomUUID(), projectId = randomUUID(), propertyId = randomUUID();
    const identity = (path) => { const stat = fs.lstatSync(path, { bigint: true }); return JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }); };
    try {
      migrate(drizzle(sql), { migrationsFolder: legacy }); sql.pragma("foreign_keys = ON");
      sql.prepare("INSERT INTO settings VALUES ('language', 'ru')").run();
      sql.prepare("INSERT INTO sources (id, canonical_root, discovery_mode, discovery_revision, property_revision, category_property_revision, excluded_relative_paths, archive_relative_path, applied_root_identity) VALUES (?, ?, ?, 7, 9, 11, ?, 'Archive', ?)").run(sourceId, root, mode, JSON.stringify(mode === "grouped" ? ["Category/Excluded"] : ["Excluded"]), identity(root));
      for (const [id, view, name, position] of [[workspaceId, viewId, "One", 0], [siblingId, siblingViewId, "Sibling", 1]]) {
        sql.prepare("INSERT INTO workspaces (id, name, source_id, position) VALUES (?, ?, ?, ?)").run(id, name, sourceId, position);
        sql.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, ?, 'table')").run(view, id, name);
      }
      sql.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(siblingId, siblingViewId);
      if (mode === "grouped") {
        sql.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, 'Category', ?, 'active')").run(categoryId, sourceId, identity(join(root, "Category")));
        sql.prepare("INSERT INTO category_properties (id,source_id,name) VALUES (?, ?, ?)").run(categoryPropertyId, sourceId, "  Authored category  ");
      }
      sql.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id) VALUES (?, ?, ?, ?, 'active', ?)").run(projectId, sourceId, relativePath, identity(join(root, relativePath)), mode === "grouped" ? categoryId : null);
      sql.prepare("INSERT INTO property_definitions VALUES (?, ?, '  Notes  ', 'text', 0)").run(propertyId, sourceId);
      sql.prepare("INSERT INTO text_property_values VALUES (?, ?, ?, ?)").run(projectId, propertyId, sourceId, "  Authored\nтекст  ");
      const before = databaseInventory(sql).filter(([table]) => table !== "__drizzle_migrations"), files = inventory(root); sql.close();
      for (let attempt = 0; attempt < 2; attempt++) {
        service = openSettingsService(databasePath);
        const inspected = new Database(databasePath);
        try {
          assert.deepEqual(databaseInventory(inspected).filter(([table]) => !["workspace_sessions", "workspace_view_selection", "__drizzle_migrations", "project_creation_operations", "project_creation_attestations", "project_rename_attestations", "project_category_move_attestations", "category_folder_attestations", "category_removal_attestations", "project_archive_attestations", "archived_folder_associations", "project_rename_operations", "project_category_move_operations", "category_folder_operations", "category_presentation", "category_removal_operations", "category_removal_attempts", "project_archives", "project_archive_operations", "number_property_values", "date_property_values", "select_options", "select_property_values", "select_option_visibility", "multi_select_property_values"].includes(table)), before.map(([table, rows]) =>
            [table, withIdentityMigrationDefaults(table,rows).map((row) => table === "projects" || table === "categories" ? { ...row, mode_inactive: 0 } : table === "views" ? { ...row, position: 0, filter_config: '{"search":"","rules":[]}', grouping_config: '{"propertyId":null,"settings":[]}', board_config: '{"widths":[],"properties":[],"wrap":true}', table_config: '{"columns":[],"rowOrder":[]}' } : row)]));
          assert.equal(inspected.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get().count, 34);
          assert.equal(inspected.prepare("SELECT COUNT(*) AS count FROM workspace_sessions").get().count, 2);
          assert.deepEqual(inspected.prepare("SELECT * FROM project_creation_operations").all(), []);
          assert.deepEqual(inspected.prepare("SELECT * FROM project_rename_operations").all(), []);
          assert.deepEqual(inspected.prepare("SELECT * FROM project_category_move_operations").all(), []);
          assert.deepEqual(inspected.prepare("SELECT * FROM category_folder_operations").all(), []);
          assert.deepEqual(inspected.prepare("SELECT * FROM category_presentation").all(), []);
          assert.deepEqual(inspected.prepare("SELECT * FROM category_removal_operations").all(), []);
          assert.deepEqual(inspected.prepare("SELECT * FROM category_removal_attempts").all(), []);
          assert.deepEqual(inspected.pragma("foreign_key_check"), []);
        } finally { inspected.close(); }
        const listed = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId });
        assert.equal(listed.ok, true, JSON.stringify(listed)); assert.equal(projectMetadataRecords(listed)[0].projectId, projectId);
        assert.equal(listed.value.state,"association_review_required");
        assert.equal(listed.value.categoryProperty?.name ?? null, mode === "grouped" ? "  Authored category  " : null);
        assert.deepEqual(inventory(root), files); service.close(); service = undefined;
      }
    } finally { if (sql.open) sql.close(); service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  }
});

test("final removal and source reuse preserve inactive histories, category labels and literal exclusions", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  fs.mkdirSync(join(f.root, "Category/Excluded"));
  const grouped = f.configure("grouped", { excludedRelativePaths: ["Category/Excluded"] });
  f.service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: f.workspace.workspaceId, propertyId: grouped.categoryProperty.propertyId, name: " Exact category " });
  const files = inventory(f.root);
  const direct = f.configure("direct");
  assert.equal(direct.categoryProperty, null); assert.deepEqual(direct.categories, []);
  assert.deepEqual(f.query().value.inactiveExcludedRelativePaths, ["Category/Excluded"]);
  const before = databaseInventory(f.sqlite).filter(([table]) => ["sources", "projects", "categories", "category_properties"].includes(table));
  assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.workspace.workspaceId }).ok, true);
  const recreated = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
  assert.equal(recreated.sourceId, f.workspace.sourceId); assert.notEqual(recreated.viewId, f.workspace.viewId);
  assert.deepEqual(databaseInventory(f.sqlite).filter(([table]) => ["sources", "projects", "categories", "category_properties"].includes(table)), before);
  const listed = f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: recreated.workspaceId }).value;
  assert.equal(listed.mode, "direct"); assert.equal(listed.retainedProjects[0].retentionReason, "mode_change");
  assert.equal(f.sqlite.prepare("SELECT name FROM category_properties").get().name, " Exact category ");
  assert.deepEqual(inventory(f.root), files);
}));

test("mode Apply preserves dormant failed category reservations without enrolling replacement roles", () => {
  for (const state of ["active", "missing", "unresolved", "replaced"]) fixture((f) => {
    fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
    const first = f.configure("grouped");
    if (state !== "active") {
      f.sqlite.prepare("UPDATE projects SET association_state = 'missing'").run();
      f.sqlite.prepare("UPDATE categories SET association_state = ?").run(state);
    }
    f.configure("direct");
    const history = f.sqlite.prepare("SELECT * FROM categories").all();
    fs.renameSync(join(f.root, "Category"), join(f.directory, "previous-category"));
    fs.mkdirSync(join(f.root, "Category/Replacement"), { recursive: true });
    const before = inventory(f.root), review = f.query({ mode: "grouped" }).value;
    assert.equal(review.entries.find((row) => row.relativePath === "Category").reason, "unresolved");
    assert.deepEqual(review.projectEffects.added, []);
    const applied = f.apply(review); assert.equal(applied.ok, true, JSON.stringify(applied));
    assert.deepEqual(applied.value.categories, []); assert.deepEqual(applied.value.projects, []);
    assert.equal(applied.value.categoryProperty.propertyId, first.categoryProperty.propertyId);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM categories").all(), history);
    assert.deepEqual(inventory(f.root), before);
  });
});

test("migration guards distinguish dormant history from operational category ownership and depth", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
  const first = f.configure("grouped"), projectId = first.projects[0].projectId;
  f.sqlite.pragma("foreign_keys = ON");
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET relative_path = 'Category/Project/Deep' WHERE id = ?").run(projectId));
  assert.throws(() => f.sqlite.prepare("UPDATE categories SET mode_inactive = 1").run());
  assert.throws(() => f.sqlite.prepare("UPDATE sources SET discovery_mode = 'direct'").run());
  f.configure("direct");
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET mode_inactive = 0 WHERE id = ?").run(projectId));
  const otherRoot = join(f.directory, "other"); fs.mkdirSync(join(otherRoot, "Other/Project"), { recursive: true });
  const other = f.service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
  const preview = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: other.workspaceId, mode: "grouped" }).value;
  const grouped = f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: other.workspaceId, previewToken: preview.previewToken }).value;
  assert.throws(() => f.sqlite.prepare("UPDATE projects SET category_id = ? WHERE id = ?").run(grouped.categories[0].categoryId, projectId));
  assert.throws(() => f.sqlite.prepare("UPDATE categories SET source_id = ? WHERE id = ?").run(other.sourceId, first.categories[0].categoryId));
  assert.deepEqual(f.sqlite.pragma("foreign_key_check"), []);
}));


for (const mode of ["direct", "grouped"]) test(`mode round trip with restart retains projects until explicit own-path recovery (${mode})`, () => fixture((f) => {
  for (const path of ["Category/One", "Category/Two"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  fs.writeFileSync(join(f.root, "Category/One/sentinel"), Buffer.from([0, 255, 17]));
  const first = f.configure(mode), original = f.sqlite.prepare("SELECT * FROM projects ORDER BY id").all();
  const propertyId = f.service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: f.workspace.workspaceId,
    name: " Notes ", propertyType: "text" }).value.propertyId;
  for (const project of first.projects) assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue",
    workspaceId: f.workspace.workspaceId, projectId: project.projectId, propertyId, value: `  Exact\nТекст ${project.projectId}  ` }).ok, true);
  if (mode === "grouped") f.service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty",
    workspaceId: f.workspace.workspaceId, propertyId: first.categoryProperty.propertyId, name: "  Authored category  " });
  const values = f.sqlite.prepare("SELECT * FROM text_property_values ORDER BY project_id").all();
  const views = f.sqlite.prepare("SELECT * FROM views").all(), files = inventory(f.root);
  const categories = f.sqlite.prepare("SELECT * FROM categories").all(), label = f.sqlite.prepare("SELECT * FROM category_properties").all();
  f.configure(mode === "direct" ? "grouped" : "direct"); f.restart();
  const returned = f.configure(mode); f.restart();
  assert.deepEqual(returned.projects, []);
  for (const project of original) assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.id), { ...project, mode_inactive: 1 });
  if (mode === "grouped") {
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM categories").all(), categories);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM category_properties").all(), label);
    assert.equal(returned.categoryProperty.propertyId, first.categoryProperty.propertyId);
  }
  for (const project of original) {
    const request = { workspaceId: f.workspace.workspaceId, projectId: project.id };
    const review = f.service.workspaces.previewProjectRecovery({ type: "workspace.previewProjectRecovery", ...request });
    assert.equal(review.ok, true, JSON.stringify(review));
    assert.equal(review.value.entries.find((row) => row.relativePath === project.relative_path).status, "selectable");
    const recovered = f.service.workspaces.reassociateProject({ type: "workspace.reassociateProject", ...request,
      previewToken: review.value.previewToken, relativePath: project.relative_path });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(project.id), project);
  }
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM text_property_values ORDER BY project_id").all(), values);
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM views").all(), views); assert.deepEqual(inventory(f.root), files);
  f.restart();
  assert.deepEqual(new Set(f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value.projects.map((row) => row.projectId)), new Set(original.map((row) => row.id)));
}));
