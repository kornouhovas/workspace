import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

function fixture(run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "workspace-mode-")));
  const root = join(directory, "root"); fs.mkdirSync(root);
  const databasePath = join(directory, "data", "workspace.sqlite");
  const service = openSettingsService(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Mode", rootPath: root }).value;
  const sqlite = new Database(databasePath);
  const query = (extra = {}) => service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, ...extra });
  const apply = (preview) => service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken });
  const configure = (mode, extra = {}) => {
    const preview = query({ mode, ...extra }); assert.equal(preview.ok, true, JSON.stringify(preview));
    const result = apply(preview.value); assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
  };
  try { run({ directory, root, sqlite, service, workspace, query, apply, configure }); }
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
