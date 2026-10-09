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
    entry.isSymbolicLink() ? fs.readlinkSync(join(path, entry.name)) : entry.isDirectory() ? inventory(join(path, entry.name)) : fs.readFileSync(join(path, entry.name)).toString("hex")]);
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
  const records = () => ["sources", "projects", "categories", "property_definitions", "text_property_values", "views", "category_properties"].map((table) => sqlite.prepare(`SELECT * FROM ${table}`).all());
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

function review(f, extra = {}) {
  return f.service.handleQuery({ type: "workspace.previewProjectRecovery", workspaceId: f.workspace.workspaceId, projectId: f.project.projectId, ...extra });
}
function recover(f, preview, relativePath, extra = {}) {
  return f.service.handleCommand({ type: "workspace.reassociateProject", workspaceId: f.workspace.workspaceId,
    projectId: f.project.projectId, previewToken: preview.previewToken, relativePath, ...extra });
}

test("direct recovery previews without Apply, cancels read-only and explicitly reopens with identical identity/Text", () => fixture((f) => {
  fs.writeFileSync(join(f.root, "Project/sentinel"), "original bytes");
  fs.renameSync(join(f.root, "Project"), join(f.root, "Renamed"));
  const before = f.records(), files = inventory(f.root), events = [];
  f.service.workspaces.subscribe((event) => events.push(event));
  const preview = review(f);
  assert.equal(preview.ok, true);
  assert.equal(preview.value.projectId, f.project.projectId);
  assert.equal(preview.value.mode, "direct");
  assert.equal(preview.value.entries.find((row) => row.relativePath === "Renamed").status, "selectable");
  assert.deepEqual(f.records(), before); assert.deepEqual(events, []);
  // Abandoning a preview is cancellation; no persisted token or mutation exists.
  const refreshed = review(f).value;
  assert.equal(recover(f, preview.value, "Renamed").error.code, "stale_preview");
  const result = recover(f, refreshed, "Renamed");
  assert.equal(result.ok, true);
  assert.equal(result.value.projects[0].projectId, f.project.projectId);
  assert.equal(result.value.projects[0].resolution, "active");
  assert.equal(result.value.projects[0].relativePath, "Renamed");
  assert.equal(result.value.revision, before[0][0].discovery_revision + 1);
  assert.deepEqual(f.records().slice(2), before.slice(2));
  assert.deepEqual(inventory(f.root), files);
  assert.deepEqual(events.map((event) => [event.type, event.sourceId, event.revision]), [["workspace.projectsChanged", f.workspace.sourceId, result.value.revision]]);
  assert.equal(recover(f, refreshed, "Renamed").error.code, "stale_preview");
  const reopened = openSettingsService(join(f.directory, "workspace.sqlite"));
  try {
    assert.equal(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value.projects[0].projectId, f.project.projectId);
    assert.equal(reopened.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: f.workspace.workspaceId }).value.values[0].value, f.value);
    assert.equal(reopened.workspaces.load().value.activeWorkspace.viewId, f.workspace.viewId);
  } finally { reopened.close(); }
}));

test("removed, persisted missing and ambiguous subjects can recover; active and manually excluded subjects cannot", () => {
  for (const state of ["observed", "missing", "unresolved"]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
    if (state !== "observed") f.apply();
    if (state === "unresolved") { fs.renameSync(join(f.directory, "away"), join(f.root, "Project")); f.apply(); }
    fs.mkdirSync(join(f.root, "Target"));
    const before = inventory(f.root);
    const result = recover(f, review(f).value, "Target");
    assert.equal(result.ok, true); assert.equal(result.value.projects[0].projectId, f.project.projectId);
    assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
    assert.deepEqual(inventory(f.root), before);
  });
  fixture((f) => {
    assert.equal(review(f).error.code, "invalid_input");
    f.apply({ excludedRelativePaths: ["Project"] });
    assert.equal(review(f).error.code, "invalid_input");
  });
});

test("recovery rejects non-direct, malformed/foreign ownership and unsafe or excluded targets without writes", () => {
  fixture((f) => { assert.equal(review(f).error.code, "invalid_input"); }, "grouped");
  fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
    for (const name of ["Target", ".hidden", "$RECYCLE.BIN", "System Volume Information", "Archive", "Manual"]) fs.mkdirSync(join(f.root, name));
    fs.mkdirSync(join(f.root, "Target/nested")); fs.writeFileSync(join(f.root, "file"), "bytes");
    fs.symlinkSync(join(f.directory, "away"), join(f.root, "link"), process.platform === "win32" ? "junction" : "dir");
    f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = ?, archive_relative_path = ? WHERE id = ?").run('["Manual"]', "Archive/deep", f.workspace.sourceId);
    const otherRoot = join(f.directory, "other"); fs.mkdirSync(otherRoot);
    const foreign = f.service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    const before = f.records();
    for (const extra of [{ extra: true }, { projectId: "bad" }, { workspaceId: foreign.workspaceId }, { projectId: foreign.workspaceId }]) {
      assert.equal(review(f, extra).error.code, "invalid_input");
    }
    const preview = review(f).value;
    for (const name of [".hidden", "$RECYCLE.BIN", "System Volume Information", "Archive", "Manual", "link"]) assert.notEqual(preview.entries.find((row) => row.relativePath === name)?.status, "selectable");
    for (const path of ["", "..", "../away", "/Target", "Target/nested", "file", "absent", ".hidden", "Archive", "Manual", "link", "Target\0"]) {
      assert.equal(recover(f, preview, path).error.code, "invalid_input");
    }
    for (const extra of [{ extra: true }, { projectId: "bad" }, { workspaceId: foreign.workspaceId }, { previewToken: "bad" }, { projectId: foreign.workspaceId }]) {
      assert.equal(recover(f, preview, "Target", extra).ok, false);
    }
    assert.deepEqual(f.records(), before);
  });
});

test("replacement already owned by another project cannot inherit retained Text or relinquish its reserved path", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.directory, "away")); fs.mkdirSync(join(f.root, "Project"));
  const replacement = f.apply().projects[0];
  const before = f.records(), files = inventory(f.root), preview = review(f).value;
  assert.equal(preview.entries.find((row) => row.relativePath === "Project").status, "reserved_path");
  assert.equal(recover(f, preview, "Project").error.code, "invalid_input");
  assert.deepEqual(f.records(), before); assert.deepEqual(inventory(f.root), files);
  assert.ok(!f.query("workspace.listTextProperties").value.values.some((row) => row.projectId === replacement.projectId));
}));

test("retired native evidence alone does not block an explicit association or make its result ambiguous", () => fixture((f) => {
  const original = f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(f.project.projectId);
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  f.sqlite.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, 'replaced')")
    .run("00000000-0000-4000-8000-000000000001", f.workspace.sourceId, "Historical", original.native_identity);
  const result = recover(f, review(f).value, "Target");
  assert.equal(result.ok, true); assert.equal(result.value.projects[0].resolution, "active");
  assert.equal(result.value.projects[0].projectId, f.project.projectId);
  assert.equal(f.query("workspace.listProjects").value.projects[0].projectId, f.project.projectId);
}));

test("recovery reviews stale on root/target/configuration/record swaps; transactional failures roll back and emit no success", () => {
  for (const failure of ["root", "target", "configuration", "record", "write", "revision_write", "after_write"]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
    const preview = review(f).value;
    if (failure === "root") { fs.renameSync(f.root, join(f.directory, "oldRoot")); fs.mkdirSync(f.root); fs.mkdirSync(join(f.root, "Target")); }
    if (failure === "target") { fs.renameSync(join(f.root, "Target"), join(f.directory, "away")); fs.mkdirSync(join(f.root, "Target")); }
    if (failure === "configuration") f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = '[\"Target\"]'").run();
    if (failure === "record") f.sqlite.prepare("UPDATE projects SET association_state = 'missing'").run();
    if (failure === "write") f.sqlite.exec("CREATE TRIGGER fail_recovery BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    if (failure === "revision_write") f.sqlite.exec("CREATE TRIGGER fail_revision BEFORE UPDATE ON sources BEGIN SELECT RAISE(ABORT, 'injected after project update'); END;");
    const before = f.records(), events = [];
    f.service.workspaces.subscribe((event) => events.push(event));
    const stat = fs.lstatSync;
    let written = false;
    if (failure === "after_write") {
      // Use filesystem observation count to alter the final, post-write scan.
      let rootReads = 0;
      fs.lstatSync = (path, ...args) => {
        const value = stat(path, ...args);
        if (path === f.root && ++rootReads > 8) written = true;
        if (written && path === join(f.root, "Target")) value.birthtimeNs += 1n;
        return value;
      };
    }
    syncBuiltinESMExports();
    let result;
    try { result = recover(f, preview, "Target"); }
    finally { fs.lstatSync = stat; syncBuiltinESMExports(); }
    assert.equal(result.ok, false, failure);
    assert.equal(result.error.code, ["write", "revision_write"].includes(failure) ? "storage" : "stale_preview", failure);
    assert.deepEqual(f.records(), before, failure); assert.deepEqual(events, [], failure);
  });
});

test("recovery refuses current native aliases, while candidate queries and commits never enumerate project contents", () => {
  for (const conflict of ["record", "directory", "none"]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
    fs.mkdirSync(join(f.root, "Other")); fs.writeFileSync(join(f.root, "Target/sentinel"), "unchanged");
    const identity = JSON.parse(f.sqlite.prepare("SELECT native_identity FROM projects WHERE id = ?").get(f.project.projectId).native_identity);
    if (conflict === "record") f.sqlite.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, 'missing')")
      .run("00000000-0000-4000-8000-000000000002", f.workspace.sourceId, "Reserved elsewhere", JSON.stringify(identity));
    const originalStat = fs.lstatSync, originalOpen = fs.opendirSync;
    fs.lstatSync = (path, ...args) => {
      const stat = originalStat(path, ...args);
      if (conflict === "directory" && path === join(f.root, "Other")) { stat.dev = BigInt(identity.dev); stat.ino = BigInt(identity.ino); }
      return stat;
    };
    fs.opendirSync = (path, ...args) => {
      assert.equal(path, f.root, "Project contents must not be enumerated");
      return originalOpen(path, ...args);
    };
    const before = f.records(), files = inventory(f.root);
    syncBuiltinESMExports();
    try {
      const preview = review(f).value, target = preview.entries.find((row) => row.relativePath === "Target");
      assert.equal(target.status, conflict === "none" ? "selectable" : "native_conflict");
      const result = recover(f, preview, "Target");
      assert.equal(result.ok, conflict === "none");
      if (conflict !== "none") { assert.equal(result.error.code, "invalid_input"); assert.deepEqual(f.records(), before); }
    } finally { fs.lstatSync = originalStat; fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
    assert.deepEqual(inventory(f.root), files);
  });
});

test("recovery handles unavailable or unverifiable roots with no token and rejects target link swaps inside the transaction", () => {
  for (const problem of ["unavailable", "unreadable", "root_identity_conflict", "transaction_link"]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
    f.apply(); fs.mkdirSync(join(f.root, "Target"));
    const preview = review(f).value;
    if (problem === "unavailable" || problem === "root_identity_conflict") fs.renameSync(f.root, join(f.directory, "oldRoot"));
    if (problem === "root_identity_conflict") fs.mkdirSync(f.root);
    const before = f.records(), events = []; f.service.workspaces.subscribe((event) => events.push(event));
    const originalOpen = fs.opendirSync;
    let opens = 0;
    fs.opendirSync = (path, ...args) => {
      if (problem === "unreadable" && path === f.root) throw Object.assign(new Error("denied"), { code: "EACCES" });
      if (problem === "transaction_link" && path === f.root && ++opens === 3) {
        fs.renameSync(join(f.root, "Target"), join(f.directory, "targetAway"));
        fs.symlinkSync(join(f.directory, "away"), join(f.root, "Target"), process.platform === "win32" ? "junction" : "dir");
      }
      return originalOpen(path, ...args);
    };
    syncBuiltinESMExports();
    try {
      if (problem !== "transaction_link") {
        const result = review(f); assert.equal(result.ok, true); assert.equal(result.value.state, problem); assert.equal(result.value.previewToken, null);
      } else assert.equal(recover(f, preview, "Target").error.code, "stale_preview");
    } finally { fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
    assert.deepEqual(f.records(), before); assert.deepEqual(events, []);
  });
});

test("direct recovery preserves independent Text revisions and invalidates same-source discovery and recovery reviews", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
  const own = review(f).value;
  const siblingRecovery = review(f, { workspaceId: sibling.workspaceId }).value;
  const siblingDiscovery = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: sibling.workspaceId }).value;
  assert.equal(recover(f, own, "Target", { workspaceId: sibling.workspaceId }).error.code, "stale_preview");
  assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: sibling.workspaceId, projectId: f.project.projectId, propertyId: f.propertyId, value: "New authored value" }).ok, true);
  const before = f.records(), events = []; f.service.workspaces.subscribe((event) => events.push(event));
  assert.equal(recover(f, own, "Target").ok, true);
  assert.equal(f.query("workspace.listTextProperties").value.values[0].value, "New authored value");
  assert.equal(f.records()[0][0].property_revision, before[0][0].property_revision);
  assert.equal(f.records()[0][0].category_property_revision, before[0][0].category_property_revision);
  assert.deepEqual(events[0].workspaceIds, [f.workspace.workspaceId, sibling.workspaceId]);
  assert.equal(recover(f, siblingRecovery, "Target", { workspaceId: sibling.workspaceId }).error.code, "stale_preview");
  assert.equal(f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: sibling.workspaceId, previewToken: siblingDiscovery.previewToken }).error.code, "stale_preview");
}));

test("unreliable target identity and caller-edited preview conflicts cannot authorize recovery", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
  fs.mkdirSync(join(f.root, "Target"));
  const before = f.records(), original = fs.lstatSync;
  fs.lstatSync = (path, ...args) => {
    const stat = original(path, ...args);
    if (path === join(f.root, "Target")) stat.birthtimeNs = 0n;
    return stat;
  };
  syncBuiltinESMExports();
  try {
    const preview = review(f).value;
    assert.equal(preview.entries[0].status, "unresolved");
    preview.entries[0].status = "selectable";
    assert.equal(recover(f, preview, "Target").error.code, "invalid_input");
    assert.deepEqual(f.records(), before);
  } finally { fs.lstatSync = original; syncBuiltinESMExports(); }
}));

test("grouped recovery reuses active or atomically creates new categories without Apply or discovering siblings", () => {
  for (const destination of ["Category", "New category"]) fixture((f) => {
    const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
    const property = f.query("workspace.listProjects").value.categoryProperty;
    assert.equal(f.service.handleCommand({ type: "workspace.renameCategoryProperty", workspaceId: sibling.workspaceId,
      propertyId: property.propertyId, name: "  Authored category label  " }).ok, true);
    const originalCategories = f.records()[2];
    fs.mkdirSync(join(f.root, destination), { recursive: true });
    fs.renameSync(join(f.root, "Category/Project"), join(f.root, destination, "Recovered"));
    fs.mkdirSync(join(f.root, destination, "Unrelated"));
    fs.mkdirSync(join(f.root, "Unrelated category/Unrelated project"), { recursive: true });
    fs.writeFileSync(join(f.root, destination, "Recovered/sentinel"), "untouched bytes");
    const before = f.records(), files = inventory(f.root), events = [];
    f.service.workspaces.subscribe((event) => events.push(event));
    const preview = review(f);
    assert.equal(preview.ok, true); assert.equal(preview.value.mode, "grouped");
    const target = preview.value.entries.find((row) => row.relativePath === `${destination}/Recovered`);
    assert.deepEqual(target, { relativePath: `${destination}/Recovered`, name: "Recovered", categoryPath: destination, status: "selectable" });
    assert.ok(preview.value.entries.every((row) => row.relativePath.split("/").length === 2));
    assert.deepEqual(f.records(), before); assert.deepEqual(events, []);
    const result = recover(f, preview.value, target.relativePath);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.projects.map((row) => [row.projectId, row.relativePath, row.categoryName, row.resolution]),
      [[f.project.projectId, target.relativePath, destination, "active"]]);
    assert.equal(result.value.revision, before[0][0].discovery_revision + 1);
    assert.equal(result.value.categoryProperty.propertyId, property.propertyId);
    assert.equal(result.value.categoryProperty.name, "  Authored category label  ");
    const after = f.records();
    assert.deepEqual(after.slice(3), before.slice(3));
    assert.equal(after[0][0].property_revision, before[0][0].property_revision);
    assert.equal(after[0][0].category_property_revision, before[0][0].category_property_revision);
    assert.deepEqual(after[2].filter((row) => originalCategories.some((old) => old.id === row.id)), originalCategories);
    assert.equal(after[2].length, originalCategories.length + (destination === "Category" ? 0 : 1));
    assert.equal(after[1].length, 1);
    assert.equal(after[2].find((row) => row.relative_path === destination).source_id, f.workspace.sourceId);
    assert.equal(result.value.projects[0].categoryId, after[2].find((row) => row.relative_path === destination).id);
    assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
    assert.equal(events.length, 1); assert.deepEqual(events[0].workspaceIds, [f.workspace.workspaceId, sibling.workspaceId]);
    assert.deepEqual(inventory(f.root), files);
    const reopened = openSettingsService(join(f.directory, "workspace.sqlite"));
    try {
      const list = reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId });
      assert.deepEqual(list, result);
      assert.equal(reopened.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: sibling.workspaceId }).value.values[0].value, f.value);
      assert.deepEqual(f.records().slice(3), before.slice(3));
    } finally { reopened.close(); }
  }, "grouped");
});

test("grouped recovery refuses excluded, missing, replaced, ambiguous and foreign category ownership", () => {
  for (const problem of ["excluded", "missing", "replaced", "unresolved", "observed_replaced", "native_alias", "foreign"]) fixture((f) => {
    fs.renameSync(join(f.root, "Category/Project"), join(f.directory, "away"));
    const categoryId = f.project.categoryId;
    if (["excluded", "missing", "replaced", "unresolved"].includes(problem)) {
      f.sqlite.prepare("UPDATE projects SET association_state = 'missing'").run();
      f.sqlite.prepare("UPDATE categories SET association_state = ? WHERE id = ?").run(problem, categoryId);
    }
    if (problem === "observed_replaced") {
      fs.renameSync(join(f.root, "Category"), join(f.directory, "oldCategory")); fs.mkdirSync(join(f.root, "Category"));
    }
    fs.mkdirSync(join(f.root, "Category/Target"));
    if (problem === "native_alias") {
      const identity = f.sqlite.prepare("SELECT native_identity FROM categories WHERE id = ?").get(categoryId).native_identity;
      f.sqlite.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, 'missing')")
        .run("00000000-0000-4000-8000-000000000002", f.workspace.sourceId, "Other path", identity);
    }
    const before = f.records(), files = inventory(f.root);
    const preview = review(f);
    assert.equal(preview.ok, true, problem);
    assert.equal(preview.value.entries.find((row) => row.relativePath === "Category/Target").status,
      problem === "foreign" ? "selectable" : "category_unavailable", problem);
    if (problem === "foreign") {
      const other = join(f.directory, "foreign"); fs.mkdirSync(other);
      const foreign = f.service.workspaces.create({ type: "workspace.create", rootPath: other, name: "Foreign" }).value;
      const withForeign = f.records();
      assert.equal(recover(f, preview.value, "Category/Target", { workspaceId: foreign.workspaceId }).error.code, "invalid_input");
      assert.deepEqual(f.records(), withForeign);
    } else {
      preview.value.entries[0].status = "selectable";
      assert.equal(recover(f, preview.value, "Category/Target").error.code, "invalid_input", problem);
      assert.deepEqual(f.records(), before);
    }
    assert.deepEqual(inventory(f.root), files);
  }, "grouped");
});

test("grouped targets use both-level exclusion, depth, link, reserved-path and native checks without reading project contents", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Category/Occupied")); f.apply();
  fs.renameSync(join(f.root, "Category/Project"), join(f.directory, "away"));
  for (const path of ["Category/Target/Deeper", "Category/.hidden", "Category/System Volume Information", "Category/Manual", "Category/Archive", "Manual category/Inside", "Storage/Inside"])
    fs.mkdirSync(join(f.root, path), { recursive: true });
  fs.writeFileSync(join(f.root, "Category/file"), "bytes");
  f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = ?, archive_relative_path = ?")
    .run(JSON.stringify(["Category/Manual", "Manual category"]), "Category/Archive");
  fs.symlinkSync(join(f.directory, "away"), join(f.root, "Category/Linked"), process.platform === "win32" ? "junction" : "dir");
  fs.symlinkSync(join(f.root, "Category"), join(f.root, "Linked category"), process.platform === "win32" ? "junction" : "dir");
  const open = fs.opendirSync;
  fs.opendirSync = (path, ...args) => {
    assert.ok([f.root, join(f.root, "Category"), join(f.root, "Storage")].includes(path), "only eligible roots/categories may be enumerated");
    return open(path, ...args);
  };
  const before = f.records(), files = inventory(f.root); syncBuiltinESMExports();
  try {
    const preview = review(f).value;
    assert.equal(preview.entries.find((row) => row.relativePath === "Category/Target").status, "selectable");
    assert.equal(preview.entries.find((row) => row.relativePath === "Category/Occupied").status, "reserved_path");
    for (const path of ["Category/.hidden", "Category/System Volume Information", "Category/Manual", "Category/Archive", "Category/Linked"])
      assert.equal(preview.entries.find((row) => row.relativePath === path).status, "excluded", path);
    for (const path of ["Category", "Category/Target/Deeper", "../Category/Target", "/Category/Target", "Category/../Target", "Category/file", "Manual category/Inside", "Linked category/Inside", "Category/Occupied"])
      assert.equal(recover(f, preview, path).error.code, "invalid_input", path);
    assert.deepEqual(f.records(), before);
    assert.equal(recover(f, preview, "Category/Target").ok, true);
  } finally { fs.opendirSync = open; syncBuiltinESMExports(); }
  assert.deepEqual(inventory(f.root), files);
}, "grouped"));

test("grouped category/root/link swaps and category-insert/project-update failures roll back all writes and events", () => {
  for (const failure of ["category", "root", "category_link", "project_link", "category_insert", "project_update", "revision_update", "after_insert", "after_update", "after_write_category", "after_write_root"]) fixture((f) => {
    fs.mkdirSync(join(f.root, "New")); fs.renameSync(join(f.root, "Category/Project"), join(f.root, "New/Target"));
    fs.writeFileSync(join(f.root, "New/Target/sentinel"), "untouched");
    const preview = review(f);
    assert.equal(preview.ok, true);
    if (failure === "category") { fs.renameSync(join(f.root, "New"), join(f.directory, "oldNew")); fs.mkdirSync(join(f.root, "New/Target"), { recursive: true }); }
    if (failure === "root") { fs.renameSync(f.root, join(f.directory, "oldRoot")); fs.mkdirSync(join(f.root, "New/Target"), { recursive: true }); }
    if (failure === "category_insert") f.sqlite.exec("CREATE TRIGGER fail_category BEFORE INSERT ON categories BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    if (failure === "project_update") f.sqlite.exec("CREATE TRIGGER fail_project BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'after category insert'); END;");
    if (failure === "revision_update") f.sqlite.exec("CREATE TRIGGER fail_revision BEFORE UPDATE ON sources BEGIN SELECT RAISE(ABORT, 'after project update'); END;");
    if (failure === "after_insert") f.sqlite.exec("CREATE TRIGGER corrupt_category AFTER INSERT ON categories BEGIN UPDATE categories SET native_identity = '{}' WHERE id = NEW.id; END;");
    if (failure === "after_update") f.sqlite.exec("CREATE TRIGGER corrupt_project AFTER UPDATE ON projects BEGIN UPDATE projects SET native_identity = '{}' WHERE id = NEW.id; END;");
    const before = f.records(), events = []; f.service.workspaces.subscribe((event) => events.push(event));
    const open = fs.opendirSync; let opens = 0;
    const externalFiles = () => inventory(f.directory).filter(([name]) => name !== "workspace.sqlite" && !name.startsWith("workspace.sqlite-"));
    let preparedFiles = externalFiles();
    fs.opendirSync = (path, ...args) => {
      if (path === f.root) opens++;
      if (["category_link", "project_link"].includes(failure) && path === f.root && opens === 3) {
        const relativePath = failure === "category_link" ? "New" : "New/Target";
        fs.renameSync(join(f.root, relativePath), join(f.directory, "swapped"));
        fs.symlinkSync(join(f.directory, "swapped"), join(f.root, relativePath), process.platform === "win32" ? "junction" : "dir");
        preparedFiles = externalFiles();
      }
      if (["after_write_category", "after_write_root"].includes(failure) && path === f.root && opens === 5) {
        const swapped = failure === "after_write_root" ? f.root : join(f.root, "New");
        fs.renameSync(swapped, join(f.directory, "swapped"));
        fs.mkdirSync(join(f.root, "New/Target"), { recursive: true });
        preparedFiles = externalFiles();
      }
      return open(path, ...args);
    };
    syncBuiltinESMExports(); let result;
    try { result = recover(f, preview.value, "New/Target"); }
    finally { fs.opendirSync = open; syncBuiltinESMExports(); }
    assert.equal(result.ok, false, failure);
    assert.equal(result.error.code, ["category_insert", "project_update", "revision_update"].includes(failure) ? "storage" : "stale_preview", failure);
    assert.deepEqual(f.records(), before, failure); assert.deepEqual(events, [], failure);
    // Compare against the last externally prepared state, including symlink targets.
    assert.deepEqual(externalFiles(), preparedFiles, failure);
  }, "grouped");
});

test("grouped recovery into another active category preserves all peer records and independent edits made after preview", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Destination/Peer"), { recursive: true });
  const baseline = f.apply();
  const peer = baseline.projects.find((row) => row.name === "Peer");
  const category = baseline.categories.find((row) => row.name === "Destination");
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Destination/Target"));
  const preview = review(f); assert.equal(preview.ok, true);
  const occupied = preview.value.entries.find((row) => row.relativePath === "Destination/Peer");
  assert.equal(occupied.status, "reserved_path");
  const label = "  New category label after review  ";
  assert.equal(f.service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: f.workspace.workspaceId,
    propertyId: baseline.categoryProperty.propertyId, name: label }).ok, true);
  assert.equal(f.service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: f.workspace.workspaceId,
    projectId: f.project.projectId, propertyId: f.propertyId, value: "Text changed after review" }).ok, true);
  const before = f.records(), files = inventory(f.root);
  assert.equal(recover(f, preview.value, "Destination/Peer").error.code, "invalid_input");
  assert.deepEqual(f.records(), before);
  const result = recover(f, preview.value, "Destination/Target"); assert.equal(result.ok, true);
  assert.equal(result.value.projects.find((row) => row.projectId === f.project.projectId).categoryId, category.categoryId);
  assert.deepEqual(result.value.projects.find((row) => row.projectId === peer.projectId), peer);
  assert.equal(result.value.categoryProperty.name, label);
  assert.equal(result.value.categoryPropertyRevision, before[0][0].category_property_revision);
  assert.deepEqual(f.records()[2], before[2]);
  assert.deepEqual(f.records().slice(3), before.slice(3));
  assert.equal(f.query("workspace.listTextProperties").value.values.find((row) => row.projectId === f.project.projectId).value, "Text changed after review");
  assert.deepEqual(inventory(f.root), files);
}, "grouped"));

test("grouped recovery rejects native aliases at both levels and insufficient category evidence", () => {
  for (const conflict of ["category_alias", "project_alias", "project_record", "category_unreliable"]) fixture((f) => {
    fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Category/Target"));
    fs.mkdirSync(join(f.root, "Other/Other project"), { recursive: true });
    const projectIdentity = JSON.parse(f.sqlite.prepare("SELECT native_identity FROM projects").get().native_identity);
    const categoryIdentity = JSON.parse(f.sqlite.prepare("SELECT native_identity FROM categories").get().native_identity);
    if (conflict === "project_record") f.sqlite.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state, category_id) VALUES (?, ?, ?, ?, 'missing', ?)")
      .run("00000000-0000-4000-8000-000000000002", f.workspace.sourceId, "Category/Reserved", JSON.stringify(projectIdentity), f.project.categoryId);
    const stat = fs.lstatSync;
    fs.lstatSync = (path, ...args) => {
      const result = stat(path, ...args);
      const identity = conflict === "category_alias" && path === join(f.root, "Other") ? categoryIdentity
        : conflict === "project_alias" && path === join(f.root, "Other/Other project") ? projectIdentity : null;
      if (identity) { result.dev = BigInt(identity.dev); result.ino = BigInt(identity.ino); }
      if (conflict === "category_unreliable" && path === join(f.root, "Category")) result.birthtimeNs = 0n;
      return result;
    };
    const before = f.records(), files = inventory(f.root); syncBuiltinESMExports();
    try {
      const preview = review(f); assert.equal(preview.ok, true, conflict);
      const target = preview.value.entries.find((row) => row.relativePath === "Category/Target");
      if (conflict === "category_unreliable") assert.equal(target, undefined);
      else assert.equal(target.status, conflict === "category_alias" ? "category_unavailable" : "native_conflict");
      assert.equal(recover(f, preview.value, "Category/Target").error.code, "invalid_input");
      assert.deepEqual(f.records(), before);
    } finally { fs.lstatSync = stat; syncBuiltinESMExports(); }
    assert.deepEqual(inventory(f.root), files);
  }, "grouped");
});

test("source observations invalidate both review kinds even after the same root reconnects", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  const recovery = review(f).value;
  const discovery = f.query("workspace.previewDiscovery").value;
  const before = f.records(), files = inventory(f.root);
  // Simulate an access outage without changing native evidence or directory times.
  const originalAccess = fs.accessSync;
  fs.accessSync = (path, ...args) => { if (path === f.root) throw Object.assign(new Error("denied"), { code: "EACCES" }); return originalAccess(path, ...args); };
  syncBuiltinESMExports();
  try { assert.equal(f.service.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId: f.workspace.workspaceId }).value.sourceAvailable, false); }
  finally { fs.accessSync = originalAccess; syncBuiltinESMExports(); }
  assert.equal(f.service.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId: f.workspace.workspaceId }).value.sourceAvailable, true);
  assert.equal(recover(f, recovery, "Target").error.code, "stale_preview");
  assert.equal(f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.deepEqual(f.records(), before); assert.deepEqual(inventory(f.root), files);
}));

test("recovery/discovery commits invalidate same-source reviews and preserve unrelated reviews and independent revisions", () => fixture((f) => {
  const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
  const otherRoot = join(f.directory, "other"); fs.mkdirSync(join(otherRoot, "Project"), { recursive: true });
  const other = f.service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
  const otherPreview = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: other.workspaceId }).value;
  f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: other.workspaceId, previewToken: otherPreview.previewToken });
  const otherProject = f.service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: other.workspaceId }).value.projects[0];
  fs.renameSync(join(otherRoot, "Project"), join(otherRoot, "Other target"));
  const otherReview = f.service.workspaces.previewProjectRecovery({ type: "workspace.previewProjectRecovery", workspaceId: other.workspaceId, projectId: otherProject.projectId }).value;
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  const siblingReview = review(f, { workspaceId: sibling.workspaceId }).value;
  const discovery = f.query("workspace.previewDiscovery").value;
  const beforeText = f.query("workspace.listTextProperties").value;
  const events = []; const unsubscribe = f.service.workspaces.subscribe((event) => events.push(event));
  const result = recover(f, review(f).value, "Target"); assert.equal(result.ok, true);
  assert.deepEqual(events, [{ type: "workspace.projectsChanged", sourceId: f.workspace.sourceId, revision: result.value.revision,
    workspaceIds: [f.workspace.workspaceId, sibling.workspaceId] }]);
  assert.equal(recover(f, siblingReview, "Target", { workspaceId: sibling.workspaceId }).error.code, "stale_preview");
  assert.equal(f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.deepEqual(f.query("workspace.listTextProperties").value, beforeText);
  unsubscribe();
  assert.equal(f.service.workspaces.reassociateProject({ type: "workspace.reassociateProject", workspaceId: other.workspaceId,
    projectId: otherProject.projectId, previewToken: otherReview.previewToken, relativePath: "Other target" }).ok, true);
  assert.equal(events.length, 1);
  fs.renameSync(join(f.root, "Target"), join(f.root, "Next"));
  const staleRecovery = review(f).value;
  f.apply({ excludedRelativePaths: ["Next"] });
  assert.equal(recover(f, staleRecovery, "Next").error.code, "stale_preview");
}));

test("review tokens are ephemeral across workspace removal and service restart", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  const old = review(f).value;
  const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
  f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.workspace.workspaceId });
  assert.equal(recover(f, old, "Target").error.code, "invalid_input");
  assert.equal(recover(f, old, "Target", { workspaceId: sibling.workspaceId }).error.code, "stale_preview");
  const current = review(f, { workspaceId: sibling.workspaceId }).value;
  const before = f.records();
  f.service.close();
  const reopened = openSettingsService(join(f.directory, "workspace.sqlite"));
  try {
    assert.equal(reopened.workspaces.reassociateProject({ type: "workspace.reassociateProject", workspaceId: sibling.workspaceId,
      projectId: f.project.projectId, previewToken: current.previewToken, relativePath: "Target" }).error.code, "stale_preview");
    assert.deepEqual(f.records(), before);
    assert.equal(reopened.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: sibling.workspaceId }).value.values[0].value, f.value);
  } finally { reopened.close(); }
}));

test("an incomplete project observation revokes reviews without metadata writes even after access returns", () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  const recovery = review(f).value, discovery = f.query("workspace.previewDiscovery").value;
  const before = f.records(), files = inventory(f.root), originalOpen = fs.opendirSync;
  fs.opendirSync = (path, ...args) => { if (path === f.root) throw Object.assign(new Error("denied"), { code: "EACCES" }); return originalOpen(path, ...args); };
  syncBuiltinESMExports();
  try { assert.equal(f.query("workspace.listProjects").value.state, "unreadable"); }
  finally { fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
  assert.equal(recover(f, recovery, "Target").error.code, "stale_preview");
  assert.equal(f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: f.workspace.workspaceId, previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.deepEqual(f.records(), before); assert.deepEqual(inventory(f.root), files);
}));

test("failed discovery and recovery scans invalidate sibling reviews before reporting source feedback", () => {
  for (const type of ["workspace.previewDiscovery", "workspace.previewProjectRecovery"]) for (const persisted of [false, true]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.directory, "away")); if (persisted) f.apply();
    fs.renameSync(join(f.directory, "away"), join(f.root, "Target"));
    const sibling = f.service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: f.root }).value;
    const recovery = review(f, { workspaceId: sibling.workspaceId }).value;
    const discovery = f.service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: sibling.workspaceId }).value;
    const before = f.records(), files = inventory(f.root), originalOpen = fs.opendirSync;
    fs.opendirSync = (path, ...args) => { if (path === f.root) throw Object.assign(new Error("denied"), { code: "EACCES" }); return originalOpen(path, ...args); };
    syncBuiltinESMExports();
    try {
      const response = f.service.handleQuery({ type, workspaceId: f.workspace.workspaceId, ...(type === "workspace.previewProjectRecovery" ? { projectId: f.project.projectId } : {}) });
      if (type === "workspace.previewProjectRecovery" && !persisted) assert.equal(response.error.code, "invalid_input");
      else { assert.equal(response.ok, true); assert.equal(response.value.state, "unreadable"); }
    } finally { fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
    assert.equal(recover(f, recovery, "Target", { workspaceId: sibling.workspaceId }).error.code, "stale_preview");
    assert.equal(f.service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: sibling.workspaceId, previewToken: discovery.previewToken }).error.code, "stale_preview");
    assert.deepEqual(f.records(), before); assert.deepEqual(inventory(f.root), files);
  });
});
