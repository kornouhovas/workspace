import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
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
function fixture(run, { grouped = false, paths = [] } = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "external-reconciliation-")));
  const root = join(directory, "root");
  const initialPath = grouped ? "Category/Project" : "Project";
  fs.mkdirSync(join(root, initialPath, "nested"), { recursive: true });
  for (const path of paths) fs.mkdirSync(join(root, path), { recursive: true });
  fs.writeFileSync(join(root, initialPath, "nested/sentinel"), Buffer.from([0, 255, 42, 10]));
  const databasePath = join(directory, "workspace.sqlite");
  const service = openSettingsService(databasePath), sqlite = new Database(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
  const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
  const apply = (extra = {}) => {
    const preview = query("workspace.previewDiscovery", { ...(grouped ? { mode: "grouped" } : {}), ...extra }); assert.equal(preview.ok, true);
    const result = command("workspace.applyDiscovery", { previewToken: preview.value.previewToken }); assert.equal(result.ok, true); return result.value;
  };
  const initial = apply();
  const project = initial.projects.find((row) => row.relativePath === initialPath);
  if (grouped) assert.equal(command("workspace.renameCategoryProperty", { propertyId: initial.categoryProperty.propertyId, name: "  Authored категория 📝  " }).ok, true);
  const propertyId = command("workspace.createProperty", { name: "  Notes 📝  ", propertyType: "text" }).value.propertyId;
  const value = "  Exact\nТекст 📝  ";
  assert.equal(command("workspace.setTextValue", { projectId: project.projectId, propertyId, value }).ok, true);
  const records = () => Object.fromEntries(["sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "workspaces", "views", "active_workspace", "settings"]
    .map((table) => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
  // Keep locator-commit assertions independent from runtime observation events.
  const events = [], observations = [];
  service.workspaces.subscribe((event) => (event.type === "workspace.sourceObserved" ? observations : events).push(event));
  const refresh = () => command("workspace.refreshSource");
  try { run({ initial, directory, root, databasePath, service, sqlite, workspace, sibling, project, propertyId, value, query, command, apply, records, events, observations, refresh }); }
  finally { sqlite.close(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
function patchFs(methods, run) {
  const originals = Object.fromEntries(Object.keys(methods).map((name) => [name, fs[name]]));
  for (const [name, create] of Object.entries(methods)) fs[name] = create(originals[name]);
  syncBuiltinESMExports();
  try { return run(); } finally { Object.assign(fs, originals); syncBuiltinESMExports(); }
}
function assertMetadata(f, before) {
  const after = f.records();
  for (const table of Object.keys(before).filter((name) => !["sources", "projects"].includes(name))) assert.deepEqual(after[table], before[table]);
  assert.deepEqual(after.sources, before.sources.map((source) => source.id === f.workspace.sourceId ? { ...source, discovery_revision: source.discovery_revision + 1 } : source));
  assert.equal(f.query("workspace.listTextProperties").value.values.find((row) => row.projectId === f.project.projectId).value, f.value);
  return after;
}

test("explicit direct refresh preserves identities, exact Text, source configuration and independent views; queries stay read-only", () => fixture((f) => {
  const otherRoot = join(f.directory, "other"); fs.mkdirSync(otherRoot);
  const unrelated = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: otherRoot }).value;
  f.service.workspaces.create({ type: "workspace.create", name: "Removed", rootPath: f.root });
  const removed = f.service.workspaces.load().value.activeWorkspace;
  assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId: removed.workspaceId }).ok, true);
  assert.equal(f.service.workspaces.activate({ type: "workspace.activate", workspaceId: f.sibling.workspaceId }).ok, true);
  f.sqlite.prepare("UPDATE views SET name = 'Independent presentation' WHERE id = ?").run(f.sibling.viewId);
  const before = f.records();
  fs.renameSync(join(f.root, "Project"), join(f.root, "Renamed")); fs.mkdirSync(join(f.root, "Unrelated"));
  const files = inventory(f.root);
  const discovery = f.query("workspace.previewDiscovery").value;
  const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId }).value;
  assert.equal(f.query("workspace.listProjects").value.retainedProjects[0].resolution, "missing");
  assert.deepEqual(f.records(), before);
  f.events.length = 0;
  let delivered = false, committedPath;
  f.service.workspaces.subscribe((event) => {
    if (event.type !== "workspace.projectsChanged") return;
    delivered = true;
    committedPath = f.sqlite.prepare("SELECT relative_path FROM projects WHERE id = ?").get(f.project.projectId).relative_path;
  });
  assert.deepEqual(f.refresh(), { ok: true, value: { sourceId: f.workspace.sourceId, workspaceIds: [f.workspace.workspaceId, f.sibling.workspaceId], canonicalRoot: f.root, sourceAvailable: true } });
  assert.equal(delivered, true); assert.equal(committedPath, "Renamed");
  assert.deepEqual(f.events.map((event) => event.type), ["workspace.projectsChanged"]);
  assert.deepEqual(f.observations, [{ type: "workspace.sourceObserved", sourceId: f.workspace.sourceId,
    workspaceIds: [f.workspace.workspaceId, f.sibling.workspaceId], observationRevision: 2, state: "ready", automaticUpdates: "active" }]);
  assert.deepEqual(f.events[0].workspaceIds, [f.workspace.workspaceId, f.sibling.workspaceId]);
  assert.ok(!f.events[0].workspaceIds.includes(unrelated.workspaceId));
  const after = assertMetadata(f, before);
  assert.deepEqual(after.projects, before.projects.map((row) => ({ ...row, relative_path: "Renamed" })));
  const list = f.query("workspace.listProjects").value;
  assert.deepEqual(list.projects.map((row) => [row.projectId, row.relativePath, row.resolution]), [[f.project.projectId, "Renamed", "active"]]);
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.project.projectId, previewToken: recovery.previewToken, relativePath: "Renamed" }).error.code, "stale_preview");
  f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.events, []); assert.deepEqual(f.records(), after);
  assert.deepEqual(inventory(f.root), files);
  const reopened = openSettingsService(f.databasePath);
  try {
    assert.deepEqual(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value, list);
    assert.equal(reopened.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: f.sibling.workspaceId }).value.values[0].value, f.value);
    assert.equal(reopened.workspaces.load().value.activeWorkspace.viewId, f.sibling.viewId);
  } finally { reopened.close(); }
}));

for (const name of ["project", "Renamed"]) test(`refresh preserves exact spelling for ${name}, including old-path replacement`, () => fixture((f) => {
  fs.renameSync(join(f.root, "Project"), join(f.root, name));
  // A case-only rename on a case-insensitive filesystem cannot have a separate old spelling occupant.
  if (name === "Renamed") fs.mkdirSync(join(f.root, "Project"));
  const before = f.records(), files = inventory(f.root);
  assert.equal(f.refresh().ok, true);
  const after = assertMetadata(f, before);
  assert.equal(after.projects.length, 1); assert.equal(after.projects[0].relative_path, name);
  assert.equal(f.query("workspace.listProjects").value.projects[0].projectId, f.project.projectId);
  if (name === "Renamed") {
    const applied = f.apply();
    const replacement = applied.projects.find((row) => row.relativePath === "Project");
    assert.notEqual(replacement.projectId, f.project.projectId);
    assert.ok(!f.query("workspace.listTextProperties").value.values.some((row) => row.projectId === replacement.projectId));
  }
  assert.deepEqual(inventory(f.root), files);
}));

test("direct occupied-path permutation preserves both IDs and commits one revision", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Second"));
  const second = f.apply().projects.find((row) => row.name === "Second");
  assert.equal(f.command("workspace.setTextValue", { projectId: second.projectId, propertyId: f.propertyId, value: "Second exact" }).ok, true);
  const before = f.records();
  fs.renameSync(join(f.root, "Project"), join(f.root, "temporary"));
  fs.renameSync(join(f.root, "Second"), join(f.root, "Project"));
  fs.renameSync(join(f.root, "temporary"), join(f.root, "Second"));
  const files = inventory(f.root); f.events.length = 0;
  assert.equal(f.refresh().ok, true);
  assertMetadata(f, before);
  assert.deepEqual(f.query("workspace.listProjects").value.projects.map((row) => [row.projectId, row.relativePath]), [[second.projectId, "Project"], [f.project.projectId, "Second"]]);
  assert.equal(f.events.length, 1); assert.equal(f.events[0].revision, before.sources[0].discovery_revision + 1);
  assert.deepEqual(inventory(f.root), files);
}));

for (const scenario of ["copy", "birthtime", "volume", "insufficient", "alias", "historical", "current conflict"]) {
  test(`refresh retains metadata for ${scenario} evidence instead of attaching it to a new path`, () => fixture((f) => {
    const stored = JSON.parse(f.records().projects[0].native_identity);
    fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
    fs.cpSync(join(f.directory, "away"), join(f.root, "Target"), { recursive: true });
    if (scenario === "alias") fs.mkdirSync(join(f.root, "Alias"));
    if (scenario === "historical" || scenario === "current conflict") {
      f.sqlite.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, ?)")
        .run(randomUUID(), f.workspace.sourceId, "Historical", JSON.stringify(stored), scenario === "historical" ? "replaced" : "missing");
    }
    const before = f.records(), files = inventory(f.root); f.events.length = 0;
    patchFs({ lstatSync: (original) => (path, ...args) => {
      const stat = original(path, ...args);
      if (["Target", "Alias"].some((name) => path === join(f.root, name)) && scenario !== "copy") {
        stat.dev = BigInt(stored.dev) + (scenario === "volume" ? 1n : 0n);
        stat.ino = BigInt(stored.ino);
        stat.birthtimeNs = scenario === "insufficient" ? 0n : BigInt(stored.birthtimeNs) + (scenario === "birthtime" ? 1n : 0n);
      }
      return stat;
    } }, () => {
      assert.equal(f.refresh().ok, true);
      assert.equal(f.query("workspace.listProjects").value.retainedProjects.find((row) => row.projectId === f.project.projectId).resolution, "missing");
    });
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []); assert.deepEqual(inventory(f.root), files);
    if (["copy", "birthtime", "volume", "insufficient"].includes(scenario)) {
      const preview = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId }).value;
      assert.equal(preview.entries.find((row) => row.relativePath === "Target").status, "selectable");
      const result = f.command("workspace.reassociateProject", { projectId: f.project.projectId, previewToken: preview.previewToken, relativePath: "Target" });
      assert.equal(result.ok, true); assert.equal(result.value.projects[0].projectId, f.project.projectId);
      assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
    }
  }));
}

test("an unmatched reserved destination blocks a whole dependent mapping chain", () => fixture((f) => {
  fs.mkdirSync(join(f.root, "Second")); fs.mkdirSync(join(f.root, "Third"));
  f.apply();
  const third = f.records().projects.find((row) => row.relative_path === "Third");
  f.sqlite.prepare("UPDATE projects SET association_state = 'missing' WHERE id = ?").run(third.id);
  fs.renameSync(join(f.root, "Third"), join(f.directory, "away"));
  fs.renameSync(join(f.root, "Second"), join(f.root, "Third"));
  fs.renameSync(join(f.root, "Project"), join(f.root, "Second"));
  const before = f.records(); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
}));

test("temporary absence keeps active evidence eligible later, but persisted missing/unresolved/excluded/replaced records need recovery", () => {
  for (const state of ["active", "missing", "unresolved", "excluded", "replaced"]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.directory, "away"));
    if (state !== "active") f.sqlite.prepare("UPDATE projects SET association_state = ? WHERE id = ?").run(state, f.project.projectId);
    const before = f.records(); f.events.length = 0;
    assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
    fs.renameSync(join(f.directory, "away"), join(f.root, "Returned"));
    assert.equal(f.refresh().ok, true);
    if (state === "active") { assertMetadata(f, before); assert.equal(f.records().projects[0].relative_path, "Returned"); }
    else { assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []); }
  });
});

for (const suppression of ["manual", "hidden", "service", "archive", "link", "outside", "depth"]) {
  test(`refresh respects ${suppression} boundaries without accessing suppressed targets or project contents`, () => fixture((f) => {
    const target = { manual: "Manual", hidden: ".hidden", service: "$RECYCLE.BIN", archive: "Archive", link: "Linked", outside: "Outside", depth: "Container/Deep" }[suppression];
    const destination = suppression === "outside" || suppression === "link" ? join(f.directory, target) : join(f.root, target);
    if (suppression === "depth") fs.mkdirSync(join(f.root, "Container"));
    fs.renameSync(join(f.root, "Project"), destination);
    if (suppression === "manual") f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = '[\"Manual\"]'").run();
    if (suppression === "archive") f.sqlite.prepare("UPDATE sources SET archive_relative_path = 'Archive/nested'").run();
    if (suppression === "link") fs.symlinkSync(destination, join(f.root, target), process.platform === "win32" ? "junction" : "dir");
    const before = f.records(), files = inventory(f.directory);
    const accesses = [];
    patchFs({
      lstatSync: (original) => (path, ...args) => {
        accesses.push(path);
        if ([destination, join(f.root, target)].includes(path)) throw new Error("Suppressed target was accessed");
        return original(path, ...args);
      },
      realpathSync: (original) => Object.assign((...args) => original(...args), { native: (path, ...args) => {
        if (path !== f.root && !(suppression === "depth" && path === join(f.root, "Container"))) throw new Error("Suppressed target was resolved");
        return original.native(path, ...args);
      } }),
      opendirSync: (original) => (path, ...args) => {
        assert.equal(path, f.root, "Never enumerate project contents"); return original(path, ...args);
      },
    }, () => {
      const result = f.refresh(); assert.equal(result.ok, true);
      assert.deepEqual(f.query("workspace.listProjects").value.projects, []);
    });
    assert.ok(!accesses.includes(destination)); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
    assert.deepEqual(inventory(f.directory).filter(([name]) => !name.startsWith("workspace.sqlite")), files.filter(([name]) => !name.startsWith("workspace.sqlite")));
  }));
}

test("saved exclusions are validated before filesystem scans, and suppress active old associations across paths", () => {
  fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
    f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = '[\"Project\"]'").run();
    const before = f.records(); assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  });
  for (const exclusions of ['["../outside"]', '["Category/Project/Deep"]', '{}', '["duplicate","duplicate"]', 'broken json']) fixture((f) => {
    f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = ?").run(exclusions);
    const before = f.records();
    patchFs({ lstatSync: () => () => { assert.fail("Invalid exclusions must not scan"); } }, () => {
      assert.equal(f.refresh().error.code, "storage");
      assert.equal(f.query("workspace.listProjects").error.code, "storage");
      assert.equal(f.query("workspace.previewDiscovery").error.code, "storage");
    });
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  });
});

for (const state of ["unavailable", "unreadable", "changed", "root_identity_conflict"]) {
  test(`refresh leaves all metadata intact for ${state} roots`, () => fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
    if (state === "unavailable" || state === "root_identity_conflict") fs.renameSync(f.root, join(f.directory, "away"));
    if (state === "root_identity_conflict") fs.mkdirSync(f.root);
    const before = f.records(); let observations = 0;
    patchFs({
      opendirSync: (original) => (path, ...args) => {
        if (state === "unreadable" && path === f.root) throw Object.assign(new Error("Denied"), { code: "EACCES" });
        return original(path, ...args);
      },
      lstatSync: (original) => (path, ...args) => {
        const stat = original(path, ...args); if (state === "changed" && path === f.root) stat.mtimeNs += BigInt(++observations); return stat;
      },
    }, () => {
      assert.equal(f.refresh().ok, true);
      assert.equal(f.query("workspace.listProjects").value.state, state);
      assert.equal(f.query("workspace.listProjects").value.projects[0].resolution, null);
    });
    assert.deepEqual(f.records(), before); assert.ok(f.events.every((event) => event.type !== "workspace.projectsChanged"));
  }));
}

for (const failure of ["reservation release", "partial mapping", "revision", "post-write records", "post-write configuration", "post-write filesystem", "pre-write filesystem", "post-write archive configuration", "unstable scan"]) {
  test(`reconciliation fully rolls back ${failure} failure and emits no committed event`, () => fixture((f) => {
    fs.mkdirSync(join(f.root, "Second")); f.apply();
    fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
    fs.renameSync(join(f.root, "Second"), join(f.root, "Another"));
    const before = f.records(), files = inventory(f.root); f.events.length = 0;
    if (failure === "reservation release") f.sqlite.exec("CREATE TRIGGER injected BEFORE UPDATE OF association_state ON projects WHEN NEW.association_state = 'replaced' BEGIN SELECT RAISE(ABORT, 'injected'); END");
    if (failure === "partial mapping") f.sqlite.exec("CREATE TRIGGER injected BEFORE UPDATE OF relative_path ON projects WHEN (SELECT COUNT(*) FROM projects WHERE relative_path IN ('Target', 'Another')) = 1 BEGIN SELECT RAISE(ABORT, 'injected'); END");
    if (failure === "revision") f.sqlite.exec("CREATE TRIGGER injected BEFORE UPDATE OF discovery_revision ON sources BEGIN SELECT RAISE(ABORT, 'injected'); END");
    if (failure === "post-write records") f.sqlite.exec("CREATE TRIGGER injected AFTER UPDATE OF relative_path ON projects BEGIN UPDATE projects SET native_identity = '{\"dev\":\"1\",\"ino\":\"1\",\"birthtimeNs\":\"1\"}' WHERE id = NEW.id; END");
    if (failure === "post-write configuration") f.sqlite.exec("CREATE TRIGGER injected AFTER UPDATE OF discovery_revision ON sources BEGIN UPDATE sources SET excluded_relative_paths = '[\"Target\"]' WHERE id = NEW.id; END");
    let observations = 0, raced = false;
    patchFs({ lstatSync: (original) => (path, ...args) => {
      if (path === f.root) {
        ++observations;
        const revision = f.sqlite.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.workspace.sourceId).discovery_revision;
        // The public sqlite connection sees only committed state. The service
        // connection's trigger therefore signals post-write races via fs calls.
        assert.equal(revision, before.sources[0].discovery_revision);
        const shouldRace = failure === "post-write filesystem" && observations === 9 || failure === "pre-write filesystem" && observations === 5;
        if (shouldRace) { fs.renameSync(join(f.root, "Target"), join(f.root, "Raced")); raced = true; }
      }
      const stat = original(path, ...args);
      if (failure === "unstable scan" && path === f.root) stat.mtimeNs += BigInt(observations);
      return stat;
    } }, () => {
      if (failure === "post-write archive configuration") {
        // Trigger writes during reservation release must fail final state verification.
        f.sqlite.exec("CREATE TRIGGER injected AFTER UPDATE OF association_state ON projects WHEN NEW.association_state = 'replaced' BEGIN UPDATE sources SET archive_relative_path = 'Target'; END");
      }
      const result = f.refresh();
      if (failure === "unstable scan") assert.equal(result.ok, true);
      else assert.equal(result.ok, false, failure);
    });
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
    if (["post-write filesystem", "pre-write filesystem"].includes(failure)) assert.equal(raced, true);
    f.sqlite.exec("DROP TRIGGER IF EXISTS injected");
    if (raced && failure !== "post-write archive configuration") fs.renameSync(join(f.root, "Raced"), join(f.root, "Target"));
    assert.deepEqual(inventory(f.root), files);
    assert.equal(f.refresh().ok, true); assert.equal(f.query("workspace.listProjects").value.projects.length, 2);
    assert.deepEqual(inventory(f.root), files);
  }));
}

test("same-path recovery over retired evidence remains continuous but that evidence blocks a later automatic move", () => fixture((f) => {
  const original = f.records().projects[0];
  f.sqlite.prepare("INSERT INTO projects (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, 'Historical', ?, 'replaced')")
    .run(randomUUID(), f.workspace.sourceId, original.native_identity);
  const before = f.records();
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  assert.equal(f.query("workspace.listProjects").value.projects[0].resolution, "active");
  fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  const preview = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId }).value;
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.project.projectId, previewToken: preview.previewToken, relativePath: "Target" }).ok, true);
  assert.equal(f.query("workspace.listProjects").value.projects[0].resolution, "active");
}));

test("concurrent configuration or record changes during scanning cannot commit stale locators", () => {
  for (const change of ["configuration", "records"]) fixture((f) => {
    fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
    const before = f.records(); let injected = false;
    patchFs({ lstatSync: (original) => (path, ...args) => {
      if (!injected && path === f.root) {
        injected = true;
        if (change === "configuration") f.sqlite.prepare("UPDATE sources SET archive_relative_path = 'Target' WHERE id = ?").run(f.workspace.sourceId);
        else f.sqlite.prepare("UPDATE projects SET association_state = 'missing' WHERE id = ?").run(f.project.projectId);
      }
      return original(path, ...args);
    } }, () => assert.equal(f.refresh().error.code, "storage"));
    assert.equal(injected, true);
    const expected = structuredClone(before);
    if (change === "configuration") expected.sources[0].archive_relative_path = "Target";
    else expected.projects[0].association_state = "missing";
    assert.deepEqual(f.records(), expected); assert.deepEqual(f.events, []);
  });
});

test("retargeted root or ancestor links cannot reconcile an identical folder beneath another source", () => {
  for (const retarget of ["root", "ancestor"]) fixture((f) => {
    const before = f.records();
    if (retarget === "root") {
      const away = join(f.directory, "away"); fs.renameSync(f.root, away);
      fs.renameSync(join(away, "Project"), join(away, "Target"));
      fs.symlinkSync(away, f.root, process.platform === "win32" ? "junction" : "dir");
      assert.equal(f.refresh().value.sourceAvailable, false);
    } else {
      // Rewrite the stored locator to a path through an ancestor link. The
      // original root evidence alone must not authorize scanning that alias.
      const alias = join(f.directory, "alias");
      fs.symlinkSync(f.directory, alias, process.platform === "win32" ? "junction" : "dir");
      f.sqlite.prepare("UPDATE sources SET canonical_root = ? WHERE id = ?").run(join(alias, "root"), f.workspace.sourceId);
      before.sources[0].canonical_root = join(alias, "root");
      fs.renameSync(join(f.root, "Project"), join(f.root, "Target"));
      assert.equal(f.refresh().value.sourceAvailable, false);
    }
    assert.deepEqual(f.records(), before); assert.ok(f.events.every((event) => event.type !== "workspace.projectsChanged"));
  });
});

test("healthy scans ignore timestamp noise and observe unrelated topology without enrollment", () => fixture((f) => {
  const before = f.records();
  fs.writeFileSync(join(f.root, "Project/new-file"), "authored outside Workspace");
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.observations, []);
  fs.mkdirSync(join(f.root, "Unrelated"));
  const files = inventory(f.root);
  assert.equal(f.refresh().ok, true);
  assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []); assert.deepEqual(inventory(f.root), files);
  assert.equal(f.observations.length, 1); assert.equal(f.observations[0].automaticUpdates, "active");
  assert.equal(f.refresh().ok, true); assert.equal(f.observations.length, 1);
  assert.equal(f.query("workspace.previewDiscovery").value.entries.find((entry) => entry.relativePath === "Unrelated").reason, null);
}));

function groupedFixture(run, paths = []) { return fixture(run, { grouped: true, paths }); }
function groupedMetadata(f, before, { projects, categories, addedCategories = 0 }) {
  const after = f.records();
  for (const table of Object.keys(before).filter((name) => !["sources", "projects", "categories"].includes(name))) assert.deepEqual(after[table], before[table], table);
  assert.deepEqual(after.sources, before.sources.map((row) => row.id === f.workspace.sourceId ? { ...row, discovery_revision: row.discovery_revision + 1 } : row));
  assert.deepEqual(after.projects, before.projects.map((row) => ({ ...row, ...projects(row, after) })));
  assert.equal(after.categories.length, before.categories.length + addedCategories);
  for (const row of before.categories) assert.deepEqual(after.categories.find((current) => current.id === row.id), { ...row, ...categories(row) });
  assert.equal(f.query("workspace.listTextProperties").value.values.find((row) => row.projectId === f.project.projectId).value, f.value);
  assert.deepEqual(f.events.map((event) => [event.type, event.revision, event.workspaceIds]), [["workspace.projectsChanged", before.sources[0].discovery_revision + 1, [f.workspace.workspaceId, f.sibling.workspaceId]]]);
  f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.events, []); assert.deepEqual(f.records(), after);
  return after;
}

for (const change of ["category rename", "case spelling", "empty rename", "project rename", "tracked move", "simultaneous", "category swap", "project swap", "category replacement"]) {
  test(`grouped ${change} preserves IDs, exact values and independent revisions in one batch`, () => groupedFixture((f) => {
    const before = f.records(), firstCategory = before.categories.find((row) => row.relative_path === "Category");
    const secondCategory = before.categories.find((row) => row.relative_path === "Second");
    let expectedCategories = () => ({}), expectedProjects = () => ({});
    if (["category rename", "case spelling", "simultaneous", "category replacement"].includes(change)) {
      const name = change === "case spelling" ? "category" : "Renamed";
      fs.renameSync(join(f.root, "Category"), join(f.root, name));
      expectedCategories = (row) => row.id === firstCategory.id ? { relative_path: name } : {};
      expectedProjects = (row) => row.category_id === firstCategory.id ? { relative_path: `${name}/${row.relative_path.split("/")[1]}` } : {};
      if (change === "simultaneous") {
        fs.renameSync(join(f.root, name, "Project"), join(f.root, "Second", "Moved"));
        expectedProjects = (row) => row.id === f.project.projectId ? { relative_path: "Second/Moved", category_id: secondCategory.id } : {};
      }
      if (change === "category replacement") fs.mkdirSync(join(f.root, "Category/Project"), { recursive: true });
    } else if (change === "empty rename") {
      fs.renameSync(join(f.root, "Empty"), join(f.root, "EmptyRenamed"));
      expectedCategories = (row) => row.relative_path === "Empty" ? { relative_path: "EmptyRenamed" } : {};
    } else if (change === "category swap") {
      fs.renameSync(join(f.root, "Category"), join(f.root, "Temporary"));
      fs.renameSync(join(f.root, "Second"), join(f.root, "Category"));
      fs.renameSync(join(f.root, "Temporary"), join(f.root, "Second"));
      expectedCategories = (row) => row.relative_path === "Category" ? { relative_path: "Second" } : row.relative_path === "Second" ? { relative_path: "Category" } : {};
      expectedProjects = (row) => ({ relative_path: `${row.category_id === firstCategory.id ? "Second" : "Category"}/${row.relative_path.split("/")[1]}` });
    } else if (change === "project swap") {
      fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Temporary"));
      fs.renameSync(join(f.root, "Second/Other"), join(f.root, "Category/Project"));
      fs.renameSync(join(f.root, "Temporary"), join(f.root, "Second/Other"));
      expectedProjects = (row) => row.id === f.project.projectId ? { relative_path: "Second/Other", category_id: secondCategory.id } : { relative_path: "Category/Project", category_id: firstCategory.id };
    } else {
      const target = change === "tracked move" ? "Second/Moved" : "Category/Renamed";
      fs.renameSync(join(f.root, "Category/Project"), join(f.root, target));
      fs.mkdirSync(join(f.root, "Category/Project"));
      expectedProjects = (row) => row.id === f.project.projectId ? { relative_path: target, category_id: change === "tracked move" ? secondCategory.id : firstCategory.id } : {};
    }
    const files = inventory(f.root);
    const discovery = f.query("workspace.previewDiscovery").value;
    // Projection and previews alone cannot persist these changes.
    f.query("workspace.listProjects"); assert.deepEqual(f.records(), before); f.events.length = 0;
    assert.equal(f.refresh().ok, true);
    groupedMetadata(f, before, { projects: expectedProjects, categories: expectedCategories });
    const list = f.query("workspace.listProjects").value;
    assert.equal(list.projects.length, before.projects.length); assert.ok(list.projects.every((row) => row.resolution === "active"));
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview");
    assert.deepEqual(inventory(f.root), files);
  }, ["Second/Other", "Empty"]));
}

for (const multiple of [false, true]) test(`grouped moves create only one needed category for ${multiple ? "multiple known projects" : "a known project"} without unrelated enrollment`, () => groupedFixture((f) => {
  const before = f.records();
  for (const path of ["Needed/Unrelated/nested", "UnrelatedCategory/Child", "NewEmpty"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Needed/Moved"));
  if (multiple) fs.renameSync(join(f.root, "Category/Second"), join(f.root, "Needed/Second"));
  const discovery = f.query("workspace.previewDiscovery").value;
  const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId }).value;
  const files = inventory(f.root); f.events.length = 0;
  let eventList;
  f.service.workspaces.subscribe((event) => { if (event.type === "workspace.projectsChanged") eventList = f.query("workspace.listProjects").value; });
  assert.equal(f.refresh().ok, true);
  const after = groupedMetadata(f, before, { addedCategories: 1, categories: () => ({}), projects: (row, after) => ({
    relative_path: row.id === f.project.projectId ? "Needed/Moved" : "Needed/Second", category_id: after.categories.find((category) => category.relative_path === "Needed").id,
  }) });
  assert.equal(eventList.projects.length, before.projects.length);
  const needed = after.categories.find((row) => row.relative_path === "Needed");
  assert.equal(needed.association_state, "active"); assert.match(needed.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(after.projects.map((row) => row.category_id), before.projects.map(() => needed.id));
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.project.projectId, previewToken: recovery.previewToken, relativePath: "Needed/Moved" }).error.code, "stale_preview");
  const reopened = openSettingsService(f.databasePath);
  try {
    assert.deepEqual(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value, f.query("workspace.listProjects").value);
    assert.equal(reopened.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: f.sibling.workspaceId }).value.values[0].value, f.value);
  } finally { reopened.close(); }
  const applied = f.apply();
  const unrelated = applied.projects.find((row) => row.relativePath === "Needed/Unrelated");
  assert.ok(unrelated); assert.notEqual(unrelated.projectId, f.project.projectId);
  assert.equal(applied.categories.find((row) => row.relativePath === "Needed").categoryId, needed.id);
  assert.ok(applied.categories.some((row) => row.relativePath === "NewEmpty"));
  assert.ok(!f.query("workspace.listTextProperties").value.values.some((row) => row.projectId === unrelated.projectId));
  assert.deepEqual(inventory(f.root), files);
}, multiple ? ["Category/Second"] : []));

for (const state of ["missing", "unresolved", "excluded", "replaced"]) test(`existing ${state} destination category stays a recovery case even with matching child evidence`, () => groupedFixture((f) => {
  const target = f.records().categories.find((row) => row.relative_path === "Target");
  f.sqlite.prepare("UPDATE categories SET association_state = ? WHERE id = ?").run(state, target.id);
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Target/Moved"));
  const before = f.records(); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  const preview = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId }).value;
  assert.equal(preview.entries.find((row) => row.relativePath === "Target/Moved").status, "category_unavailable");
}, ["Target"]));

for (const conflict of ["category historical path", "category reserved path", "category historical native", "category current native", "project historical native", "project reserved path", "category observed alias", "project observed alias", "cross-depth alias", "category birthtime", "category insufficient", "project birthtime", "project volume", "project insufficient"]) {
  test(`grouped refresh rejects ${conflict} without creating categories or transferring metadata`, () => groupedFixture((f) => {
    fs.mkdirSync(join(f.root, "Target"));
    fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Target/Moved"));
    const identityAt = (path) => {
      const stat = fs.lstatSync(join(f.root, path), { bigint: true });
      return { dev: stat.dev.toString(), ino: stat.ino.toString(), birthtimeNs: stat.birthtimeNs.toString() };
    };
    const categoryEvidence = identityAt("Target"), projectEvidence = identityAt("Target/Moved");
    const retired = (table, path, evidence, state = "replaced") => {
      if (table === "categories") f.sqlite.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, ?)")
        .run(randomUUID(), f.workspace.sourceId, path, JSON.stringify(evidence), state);
      else f.sqlite.prepare("INSERT INTO projects (id, source_id, category_id, relative_path, native_identity, association_state) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), f.workspace.sourceId, f.records().categories[0].id, path, JSON.stringify(evidence), state);
    };
    if (conflict === "category historical path") retired("categories", "Target", { dev: "999", ino: "999", birthtimeNs: "1" });
    if (conflict === "category reserved path") retired("categories", "Target", categoryEvidence, "missing");
    if (conflict === "category historical native" || conflict === "category current native") retired("categories", "Historical", categoryEvidence, conflict === "category current native" ? "missing" : "replaced");
    if (conflict === "project historical native") retired("projects", "Category/Historical", projectEvidence);
    if (conflict === "project reserved path") retired("projects", "Target/Moved", { dev: "999", ino: "999", birthtimeNs: "1" }, "missing");
    if (conflict === "category observed alias") fs.mkdirSync(join(f.root, "Alias"));
    if (conflict === "project observed alias") fs.mkdirSync(join(f.root, "Target/Alias"));
    if (conflict === "cross-depth alias") fs.mkdirSync(join(f.root, "Alias"));
    // For birthtime/insufficient categories, poison both stored and observed
    // evidence, independently of project identity. Never repair that parent.
    if (conflict === "category birthtime") retired("categories", "Historical", { ...categoryEvidence, birthtimeNs: (BigInt(categoryEvidence.birthtimeNs) - 1n).toString() });
    const before = f.records(), files = inventory(f.root); f.events.length = 0;
    patchFs({ lstatSync: (original) => (path, ...args) => {
      const stat = original(path, ...args);
      const override = path === join(f.root, "Alias") && conflict === "category observed alias" ? categoryEvidence
        : path === join(f.root, "Target/Alias") && conflict === "project observed alias" || path === join(f.root, "Alias") && conflict === "cross-depth alias" ? projectEvidence : null;
      if (override) { stat.dev = BigInt(override.dev); stat.ino = BigInt(override.ino); stat.birthtimeNs = BigInt(override.birthtimeNs); }
      if (path === join(f.root, "Target") && conflict === "category insufficient") stat.birthtimeNs = 0n;
      if (path === join(f.root, "Target/Moved")) {
        if (conflict === "project birthtime") ++stat.birthtimeNs;
        if (conflict === "project volume") ++stat.dev;
        if (conflict === "project insufficient") stat.birthtimeNs = 0n;
      }
      return stat;
    } }, () => assert.equal(f.refresh().ok, true));
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []); assert.deepEqual(inventory(f.root), files);
  }));
}

for (const state of ["missing child", "excluded child", "persisted missing", "persisted excluded", "replaced child"]) {
  test(`category rename with ${state} retains uncertain metadata and required-category invariants`, () => groupedFixture((f) => {
    const child = f.records().projects.find((row) => row.relative_path === "Category/Second");
    if (state === "missing child") fs.renameSync(join(f.root, "Category/Second"), join(f.directory, "away"));
    if (state === "excluded child") f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = '[\"Category/Second\"]'").run();
    if (state.startsWith("persisted")) f.sqlite.prepare("UPDATE projects SET association_state = ? WHERE id = ?").run(state.split(" ")[1], child.id);
    if (state === "replaced child") {
      fs.renameSync(join(f.root, "Category/Second"), join(f.directory, "away"));
      fs.mkdirSync(join(f.root, "Category/Second"));
    }
    fs.renameSync(join(f.root, "Category"), join(f.root, "Renamed"));
    const before = f.records(); f.events.length = 0;
    assert.equal(f.refresh().ok, true);
    if (state.startsWith("persisted")) {
      groupedMetadata(f, before, { projects: (row) => row.id === f.project.projectId ? { relative_path: "Renamed/Project" } : {}, categories: () => ({ relative_path: "Renamed" }) });
      assert.deepEqual(f.records().projects.find((row) => row.id === child.id), before.projects.find((row) => row.id === child.id));
      assert.ok(f.query("workspace.listProjects").value.retainedProjects.some((row) => row.projectId === child.id));
    } else {
      assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
      assert.ok(f.query("workspace.listProjects").value.retainedProjects.some((row) => row.projectId === f.project.projectId));
    }
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  }, ["Category/Second"]));
}

for (const suppression of ["manual category", "manual project", "hidden category", "hidden project", "service category", "service project", "archive category", "archive project", "category link", "project link", "outside", "depth"]) {
  test(`grouped refresh respects ${suppression} and never reads project contents or suppressed targets`, () => groupedFixture((f) => {
    let target = "Category/Moved", destination;
    if (suppression === "manual category") target = "Target/Moved";
    if (suppression === "hidden category") target = ".hidden/Moved";
    if (suppression === "hidden project") target = "Category/.hidden";
    if (suppression === "service category") target = "$RECYCLE.BIN/Moved";
    if (suppression === "service project") target = "Category/System Volume Information";
    if (suppression === "archive category") target = "Archive/Moved";
    if (suppression === "archive project") target = "Category/Archive";
    if (suppression === "depth") target = "Category/Container/Deep";
    const parent = target.split("/").slice(0, -1).join("/");
    fs.mkdirSync(join(f.root, parent), { recursive: true });
    destination = ["outside", "category link", "project link"].includes(suppression) ? join(f.directory, "away") : join(f.root, target);
    if (suppression === "category link") {
      fs.mkdirSync(destination); fs.renameSync(join(f.root, "Category/Project"), join(destination, "Moved"));
      target = "Linked"; fs.symlinkSync(destination, join(f.root, target), process.platform === "win32" ? "junction" : "dir");
    } else {
      fs.renameSync(join(f.root, "Category/Project"), destination);
      if (suppression === "project link") fs.symlinkSync(destination, join(f.root, target), process.platform === "win32" ? "junction" : "dir");
    }
    if (suppression.startsWith("manual")) f.sqlite.prepare("UPDATE sources SET excluded_relative_paths = ?").run(JSON.stringify([suppression === "manual category" ? "Target" : target]));
    if (suppression.startsWith("archive")) f.sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(suppression === "archive category" ? "Archive" : "Category/Archive/nested");
    const blocked = [destination, join(f.root, target), ...(suppression.endsWith("category") ? [join(f.root, target.split("/")[0])] : [])];
    const before = f.records(), files = inventory(f.root); f.events.length = 0;
    patchFs({
      lstatSync: (original) => (path, ...args) => { assert.ok(!blocked.includes(path), `suppressed target accessed: ${path}`); return original(path, ...args); },
      opendirSync: (original) => (path, ...args) => {
        assert.ok(path === f.root || ["Category", "Target"].some((name) => path === join(f.root, name)), `project contents opened: ${path}`);
        return original(path, ...args);
      },
    }, () => { assert.equal(f.refresh().ok, true); });
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []); assert.deepEqual(inventory(f.root), files);
  }));
}

for (const parent of ["missing", "replaced", "unresolved", "unavailable", "insufficient"]) {
  test(`matching grouped project evidence cannot repair an ${parent} original parent`, () => groupedFixture((f) => {
    fs.mkdirSync(join(f.root, "Target")); fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Target/Moved"));
    if (["missing", "replaced", "unresolved"].includes(parent)) {
      f.sqlite.prepare("UPDATE projects SET association_state = 'missing'").run();
      f.sqlite.prepare("UPDATE categories SET association_state = ?").run(parent);
    }
    if (parent === "unavailable") fs.renameSync(join(f.root, "Category"), join(f.directory, "away"));
    const before = f.records(); f.events.length = 0;
    patchFs({ lstatSync: (original) => (path, ...args) => { const stat = original(path, ...args); if (parent === "insufficient" && path === join(f.root, "Category")) stat.birthtimeNs = 0n; return stat; } }, () => assert.equal(f.refresh().ok, true));
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  }));
}

test("archive inside an otherwise verified category does not block other known project moves", () => groupedFixture((f) => {
  f.sqlite.prepare("UPDATE sources SET archive_relative_path = 'Category/Storage/nested'").run();
  fs.mkdirSync(join(f.root, "Category/Storage"));
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Category/Renamed"));
  const before = f.records(); f.events.length = 0;
  assert.equal(f.refresh().ok, true);
  groupedMetadata(f, before, { projects: () => ({ relative_path: "Category/Renamed" }), categories: () => ({}) });
}));

for (const failure of ["category release", "partial categories", "category insertion", "partial projects", "revision", "stored categories", "stored projects", "category label", "source configuration", "pre-write swap", "post-write swap", "post-write category link"]) {
  test(`grouped transaction rolls back ${failure}, including needed categories/revision, without events`, () => groupedFixture((f) => {
    fs.mkdirSync(join(f.root, "Needed/Unrelated"), { recursive: true });
    fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Needed/Moved"));
    fs.renameSync(join(f.root, "Second/Other"), join(f.root, "Needed/Other"));
    fs.renameSync(join(f.root, "Category"), join(f.root, "Renamed"));
    fs.renameSync(join(f.root, "Second"), join(f.root, "SecondRenamed"));
    const before = f.records(), files = inventory(f.root); f.events.length = 0;
    const triggers = {
      "category release": "BEFORE UPDATE OF association_state ON categories WHEN NEW.association_state = 'replaced' BEGIN SELECT RAISE(ABORT, 'injected'); END",
      "partial categories": "BEFORE UPDATE OF relative_path ON categories WHEN (SELECT COUNT(*) FROM categories WHERE relative_path IN ('Renamed', 'SecondRenamed')) = 1 BEGIN SELECT RAISE(ABORT, 'injected'); END",
      "category insertion": "AFTER INSERT ON categories WHEN NEW.relative_path = 'Needed' BEGIN SELECT RAISE(ABORT, 'injected'); END",
      "partial projects": "BEFORE UPDATE OF relative_path ON projects WHEN (SELECT COUNT(*) FROM projects WHERE relative_path LIKE 'Needed/%') = 1 BEGIN SELECT RAISE(ABORT, 'injected'); END",
      revision: "BEFORE UPDATE OF discovery_revision ON sources BEGIN SELECT RAISE(ABORT, 'injected'); END",
      "stored categories": "AFTER INSERT ON categories WHEN NEW.relative_path = 'Needed' BEGIN UPDATE categories SET native_identity = '{\"dev\":\"999\",\"ino\":\"999\",\"birthtimeNs\":\"1\"}' WHERE id = NEW.id; END",
      "stored projects": "AFTER UPDATE OF relative_path ON projects BEGIN UPDATE projects SET native_identity = '{\"dev\":\"999\",\"ino\":\"999\",\"birthtimeNs\":\"1\"}' WHERE id = NEW.id; END",
      "category label": "AFTER INSERT ON categories BEGIN UPDATE category_properties SET name = 'Unexpected label'; END",
      "source configuration": "AFTER INSERT ON categories BEGIN UPDATE sources SET excluded_relative_paths = '[\"Needed\"]'; END",
    };
    if (triggers[failure]) f.sqlite.exec(`CREATE TRIGGER injected ${triggers[failure]}`);
    let rootOpens = 0, raced = false;
    patchFs({ opendirSync: (original) => (path, ...args) => {
      // normalizeSource opens the root once; each complete scan then opens it
      // twice. Race at the first pre-write or post-write scan, respectively.
      if (path === f.root) {
        ++rootOpens;
        const shouldRace = failure === "pre-write swap" && rootOpens === 4 || failure.startsWith("post-write") && rootOpens === 6;
        if (shouldRace) {
          fs.renameSync(join(f.root, "Needed"), join(f.directory, "raced"));
          if (failure === "post-write category link") fs.symlinkSync(join(f.directory, "raced"), join(f.root, "Needed"), process.platform === "win32" ? "junction" : "dir");
          else fs.mkdirSync(join(f.root, "Needed"));
          raced = true;
        }
      }
      assert.notEqual(path, join(f.directory, "raced"), "Never traverse a replacement link");
      assert.ok(path === f.root || !path.slice(f.root.length + 1).includes("/"), "Never enumerate projects");
      return original(path, ...args);
    } }, () => assert.equal(f.refresh().error.code, "storage"));
    assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
    if (failure.includes("swap") || failure.includes("link")) assert.equal(raced, true);
    f.sqlite.exec("DROP TRIGGER IF EXISTS injected");
    if (raced) { fs.rmSync(join(f.root, "Needed"), { recursive: true, force: true }); fs.renameSync(join(f.directory, "raced"), join(f.root, "Needed")); }
    assert.deepEqual(inventory(f.root), files);
    assert.equal(f.refresh().ok, true);
    assert.equal(f.records().categories.length, before.categories.length + 1);
    assert.deepEqual(f.records().projects.map((row) => row.id), before.projects.map((row) => row.id));
    assert.equal(f.query("workspace.listProjects").value.projects.length, 2);
    assert.deepEqual(f.query("workspace.listTextProperties").value.values.map((row) => row.value), [f.value]);
    assert.deepEqual(inventory(f.root), files);
  }, ["Second/Other"]));
}

for (const state of ["unavailable", "unreadable", "changed", "root_identity_conflict"]) {
  test(`incomplete grouped ${state} source never commits category/project changes`, () => groupedFixture((f) => {
    fs.renameSync(join(f.root, "Category"), join(f.root, "Renamed"));
    if (["unavailable", "root_identity_conflict"].includes(state)) fs.renameSync(f.root, join(f.directory, "away"));
    if (state === "root_identity_conflict") fs.mkdirSync(f.root);
    const before = f.records(); let reads = 0; f.events.length = 0;
    patchFs({
      opendirSync: (original) => (path, ...args) => { if (state === "unreadable" && path === join(f.root, "Renamed")) throw Object.assign(new Error("Denied"), { code: "EACCES" }); return original(path, ...args); },
      lstatSync: (original) => (path, ...args) => { const stat = original(path, ...args); if (state === "changed" && path === join(f.root, "Renamed")) stat.ctimeNs += BigInt(++reads); return stat; },
    }, () => {
      assert.equal(f.refresh().ok, true);
      const result = f.query("workspace.listProjects"); assert.equal(result.ok, true); assert.equal(result.value.state, state);
      assert.equal(result.value.projects[0].resolution, null);
    });
    assert.deepEqual(f.records(), before); assert.ok(f.events.every((event) => event.type !== "workspace.projectsChanged"));
  }));
}

test("grouped category permutations block an unmatched reservation and its dependent projects", () => groupedFixture((f) => {
  f.sqlite.prepare("UPDATE categories SET association_state = 'missing' WHERE relative_path = 'Empty'").run();
  fs.renameSync(join(f.root, "Empty"), join(f.directory, "away"));
  fs.renameSync(join(f.root, "Second"), join(f.root, "Empty"));
  fs.renameSync(join(f.root, "Category"), join(f.root, "Second"));
  const before = f.records(); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
}, ["Second/Other", "Empty"]));

test("renamed tracked category is reused for an incoming project instead of a new category UUID", () => groupedFixture((f) => {
  const before = f.records(), second = before.categories.find((row) => row.relative_path === "Second");
  fs.renameSync(join(f.root, "Second"), join(f.root, "Renamed"));
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Renamed/Moved"));
  f.events.length = 0; assert.equal(f.refresh().ok, true);
  groupedMetadata(f, before, { categories: (row) => row.id === second.id ? { relative_path: "Renamed" } : {}, projects: () => ({ relative_path: "Renamed/Moved", category_id: second.id }) });
}, ["Second"]));

test("replacement at a mapped-out category path cannot qualify as a genuinely new destination", () => groupedFixture((f) => {
  fs.renameSync(join(f.root, "Category"), join(f.root, "Renamed"));
  fs.mkdirSync(join(f.root, "Category"));
  fs.renameSync(join(f.root, "Second/Other"), join(f.root, "Category/Moved"));
  const before = f.records(), secondProject = before.projects.find((row) => row.relative_path === "Second/Other");
  f.events.length = 0; assert.equal(f.refresh().ok, true);
  const after = f.records();
  assert.equal(after.categories.length, before.categories.length);
  assert.deepEqual(after.categories, before.categories.map((row) => row.relative_path === "Category" ? { ...row, relative_path: "Renamed" } : row));
  assert.deepEqual(after.projects, before.projects.map((row) => row.id === f.project.projectId ? { ...row, relative_path: "Renamed/Project" } : row));
  assert.equal(after.sources[0].discovery_revision, before.sources[0].discovery_revision + 1);
  assert.deepEqual(after.text_property_values, before.text_property_values);
  assert.deepEqual(after.category_properties, before.category_properties);
  assert.deepEqual(f.records().projects.find((row) => row.id === secondProject.id), secondProject);
  assert.ok(f.query("workspace.listProjects").value.retainedProjects.some((row) => row.projectId === secondProject.id));
}, ["Second/Other"]));

for (const change of ["category record", "category property", "configuration"]) test(`concurrent grouped ${change} change rejects a stale mapping`, () => groupedFixture((f) => {
  fs.renameSync(join(f.root, "Category"), join(f.root, "Renamed"));
  const before = f.records(); let injected = false; f.events.length = 0;
  patchFs({ opendirSync: (original) => (path, ...args) => {
    if (!injected && path === f.root) {
      injected = true;
      if (change === "category record") f.sqlite.prepare("UPDATE categories SET native_identity = '{\"dev\":\"999\",\"ino\":\"999\",\"birthtimeNs\":\"1\"}'").run();
      if (change === "category property") f.sqlite.prepare("UPDATE category_properties SET name = 'Concurrent label'").run();
      if (change === "configuration") f.sqlite.prepare("UPDATE sources SET archive_relative_path = 'Renamed'").run();
    }
    return original(path, ...args);
  } }, () => {
    assert.equal(f.refresh().error.code, "storage");
  });
  assert.equal(injected, true);
  const expected = structuredClone(before);
  if (change === "category record") expected.categories[0].native_identity = '{"dev":"999","ino":"999","birthtimeNs":"1"}';
  if (change === "category property") expected.category_properties[0].name = "Concurrent label";
  if (change === "configuration") expected.sources[0].archive_relative_path = "Renamed";
  assert.deepEqual(f.records(), expected); assert.deepEqual(f.events, []);
}));

for (const evidence of ["copy", "birthtime", "volume", "alias", "historical"]) test(`category rename rejects ${evidence} evidence even when a child still uniquely matches`, () => groupedFixture((f) => {
  const category = f.records().categories[0], stored = JSON.parse(category.native_identity);
  fs.renameSync(join(f.root, "Category"), join(f.directory, "away"));
  fs.mkdirSync(join(f.root, "Target"));
  fs.renameSync(join(f.directory, "away/Project"), join(f.root, "Target/Project"));
  if (evidence === "alias") fs.mkdirSync(join(f.root, "Alias"));
  if (evidence === "historical") f.sqlite.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state) VALUES (?, ?, 'Historical', ?, 'replaced')")
    .run(randomUUID(), f.workspace.sourceId, category.native_identity);
  const before = f.records(); f.events.length = 0;
  patchFs({ lstatSync: (original) => (path, ...args) => {
    const stat = original(path, ...args);
    if (["Target", "Alias"].some((name) => path === join(f.root, name)) && evidence !== "copy") {
      stat.dev = BigInt(stored.dev) + (evidence === "volume" ? 1n : 0n); stat.ino = BigInt(stored.ino);
      stat.birthtimeNs = BigInt(stored.birthtimeNs) + (evidence === "birthtime" ? 1n : 0n);
    }
    return stat;
  } }, () => assert.equal(f.refresh().ok, true));
  assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
}));

test("grouped persisted missing project can still use explicit T07 recovery into one new category after refresh declines it", () => groupedFixture((f) => {
  f.sqlite.prepare("UPDATE projects SET association_state = 'missing' WHERE id = ?").run(f.project.projectId);
  fs.mkdirSync(join(f.root, "Needed/Unrelated"), { recursive: true });
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Needed/Moved"));
  const before = f.records(); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  const preview = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId }).value;
  assert.equal(preview.entries.find((row) => row.relativePath === "Needed/Moved").status, "selectable");
  const recovered = f.command("workspace.reassociateProject", { projectId: f.project.projectId, relativePath: "Needed/Moved", previewToken: preview.previewToken });
  assert.equal(recovered.ok, true); assert.equal(recovered.value.projects.length, 1);
  assert.equal(recovered.value.projects[0].projectId, f.project.projectId);
  assert.equal(f.records().categories.length, before.categories.length + 1);
  assert.equal(f.records().projects.length, before.projects.length);
  assert.equal(f.query("workspace.listTextProperties").value.values[0].value, f.value);
  const after = f.records(); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), after); assert.deepEqual(f.events, []);
}));

test("populated migrations 0000–0006 reopen with reconciled grouped locators and all metadata intact", () => groupedFixture((f) => {
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get().count, 17);
  fs.mkdirSync(join(f.root, "Needed"));
  fs.renameSync(join(f.root, "Category/Project"), join(f.root, "Needed/Moved"));
  f.events.length = 0; assert.equal(f.refresh().ok, true);
  const before = f.records(), migrations = f.sqlite.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all(), files = inventory(f.root);
  const reopened = openSettingsService(f.databasePath);
  try {
    assert.equal(reopened.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId: f.workspace.workspaceId }).ok, true);
    assert.equal(reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.sibling.workspaceId }).value.projects[0].projectId, f.project.projectId);
    assert.deepEqual(f.records(), before); assert.deepEqual(f.sqlite.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all(), migrations);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    assert.deepEqual(inventory(f.root), files);
  } finally { reopened.close(); }
}));

for (const history of ["none", "direct role", "grouped round trip"]) for (const mode of ["production", "category polling"]) test(`live native ${mode} observation permits grouped root disconnect/reconnect, category rename and same-category project rename (${history})`, async () => {
  const { nativeObserverDependencies } = await import("../src/service/source-observer.ts");
  const { withDeadline } = await import("../scripts/runtime-lifecycle.mjs");
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "native-grouped-moves-")));
  const root = join(directory, "root"), away = join(directory, "disconnected"), databasePath = join(directory, "data.sqlite");
  fs.mkdirSync(join(root, "Category/Project/nested"), { recursive: true });
  fs.writeFileSync(join(root, "Category/Project/nested/sentinel"), "  Exact bytes\nТекст  ");
  const live = new Set();
  const dependencies = { ...nativeObserverDependencies, pollCategories: mode === "category polling" || nativeObserverDependencies.pollCategories,
    watch(path, hint, failed) {
      const handle = nativeObserverDependencies.watch(path, hint, failed);
      live.add(path);
      return { close() { live.delete(path); handle.close(); } };
    },
  };
  let service, sqlite;
  try {
    service = openSettingsService(databasePath, undefined, undefined, dependencies);
    sqlite = new Database(databasePath);
    const workspace = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
    const query = (type) => service.handleQuery({ type, workspaceId: workspace.workspaceId }).value;
    const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
    const configure = (mode) => {
      const review = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode });
      assert.equal(review.ok, true);
      const result = command("workspace.applyDiscovery", { previewToken: review.value.previewToken });
      assert.equal(result.ok, true); return result.value;
    };
    const oldDirect = history === "direct role" ? configure("direct").projects[0] : null;
    const initial = configure("grouped");
    const project = initial.projects[0], category = initial.categories[0];
    if (history === "grouped round trip") {
      configure("direct"); configure("grouped");
      const review = service.handleQuery({ type: "workspace.previewProjectRecovery", workspaceId: workspace.workspaceId, projectId: project.projectId });
      assert.equal(review.ok, true);
      assert.equal(command("workspace.reassociateProject", { projectId: project.projectId, previewToken: review.value.previewToken, relativePath: project.relativePath }).ok, true);
    }
    const property = command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value;
    assert.equal(command("workspace.setTextValue", { propertyId: property.propertyId, projectId: project.projectId, value: "  Exact\nТекст  " }).ok, true);
    assert.equal(command("workspace.renameCategoryProperty", { propertyId: initial.categoryProperty.propertyId, name: "  Authored label  " }).ok, true);
    if (oldDirect) assert.equal(command("workspace.setTextValue", { propertyId: property.propertyId, projectId: oldDirect.projectId, value: "  Dormant direct role 日本語  " }).ok, true);
    const dormant = sqlite.prepare("SELECT * FROM projects WHERE mode_inactive = 1 ORDER BY id").all();
    assert.equal(dormant.length, history === "none" ? 0 : 1);
    const text = query("workspace.listTextProperties"), before = query("workspace.listProjects");
    const stable = () => ["workspaces", "views", "property_definitions", "text_property_values", "category_properties"].map((table) =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    const metadata = stable();
    if (dependencies.pollCategories) assert.deepEqual([...live], [root], "no descendant watch handle may pin the root");
    else assert.ok(live.has(join(root, "Category")));
    const waitForEvent = async (action, predicate) => {
      let off;
      const event = new Promise((resolve) => { off = service.workspaces.subscribe((value) => { if (predicate(value)) resolve(value); }); });
      try {
        action();
        // Includes one five-second category polling/reconnection tick and debounce.
        return await withDeadline(event, 7500, "Live grouped native observation");
      } finally { off(); }
    };
    await waitForEvent(() => fs.renameSync(root, away), (event) => event.type === "workspace.sourceObserved" && event.state === "unavailable");
    assert.equal(query("workspace.listProjects").state, "unavailable");
    assert.deepEqual(stable(), metadata); assert.equal(live.size, 0);
    await waitForEvent(() => fs.renameSync(away, root), (event) => event.type === "workspace.sourceObserved" && event.state === "ready");
    assert.equal(query("workspace.listProjects").revision, before.revision);
    const renamed = await waitForEvent(() => fs.renameSync(join(root, "Category"), join(root, "Renamed category")),
      (event) => event.type === "workspace.projectsChanged");
    assert.deepEqual(renamed.workspaceIds, [workspace.workspaceId, sibling.workspaceId]);
    const moved = await waitForEvent(() => fs.renameSync(join(root, "Renamed category/Project"), join(root, "Renamed category/Renamed project")),
      (event) => event.type === "workspace.projectsChanged");
    assert.equal(moved.revision, before.revision + 2);
    const after = query("workspace.listProjects");
    assert.deepEqual(after.projects.map((row) => [row.projectId, row.categoryId, row.relativePath]),
      [[project.projectId, category.categoryId, "Renamed category/Renamed project"]]);
    assert.deepEqual(after.categories.map((row) => [row.categoryId, row.name]), [[category.categoryId, "Renamed category"]]);
    assert.deepEqual(after.categoryProperty, before.categoryProperty);
    assert.equal(after.categoryPropertyRevision, before.categoryPropertyRevision);
    assert.deepEqual(query("workspace.listTextProperties"), text); assert.deepEqual(stable(), metadata);
    assert.deepEqual(sqlite.prepare("SELECT * FROM projects WHERE mode_inactive = 1 ORDER BY id").all(), dormant);
    assert.equal(fs.readFileSync(join(root, "Renamed category/Renamed project/nested/sentinel"), "utf8"), "  Exact bytes\nТекст  ");
    service.close(); service = undefined; assert.equal(live.size, 0);
  } finally { service?.close(); sqlite?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

for (const grouped of [false, true]) test(`real native notifications and shutdown-missed ${grouped ? "grouped needed-category" : "direct"} changes preserve metadata before Refresh`, async () => {
  const { nativeObserverDependencies } = await import("../src/service/source-observer.ts");
  const { withDeadline } = await import("../scripts/runtime-lifecycle.mjs");
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "native-reconciliation-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  const original = grouped ? "Category/Project" : "Project";
  fs.mkdirSync(join(root, original, "nested"), { recursive: true });
  fs.writeFileSync(join(root, original, "nested/sentinel"), Buffer.from([0, 10, 255, 42]));
  const sqlite = new Database(databasePath);
  let hints = 0, service;
  const dependencies = { ...nativeObserverDependencies,
    watch(path, hint, failed) {
      return nativeObserverDependencies.watch(path, () => { ++hints; hint(); }, failed);
    },
  };
  try {
    service = openSettingsService(databasePath, undefined, undefined, dependencies);
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Native", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type) => service.handleQuery({ type, workspaceId: workspace.workspaceId }).value;
    const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: grouped ? "grouped" : "direct" }).value;
    assert.equal(command("workspace.applyDiscovery", { previewToken: preview.previewToken }).ok, true);
    const project = query("workspace.listProjects").projects[0];
    const property = command("workspace.createProperty", { name: " Notes 日本語 ", propertyType: "text" }).value;
    assert.equal(command("workspace.setTextValue", { projectId: project.projectId, propertyId: property.propertyId, value: "  Exact\nТекст 📝  " }).ok, true);
    if (grouped) assert.equal(command("workspace.renameCategoryProperty", { propertyId: query("workspace.listProjects").categoryProperty.propertyId, name: "  Authored label  " }).ok, true);
    const text = query("workspace.listTextProperties");
    const stable = () => Object.fromEntries(["workspaces", "views", "settings", "property_definitions", "text_property_values", "category_properties"]
      .map((table) => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
    const before = stable(), source = sqlite.prepare("SELECT * FROM sources").get();
    const initial = query("workspace.listProjects");
    // Drain initial installation-window scheduling before changing the fixture.
    await new Promise((resolve) => setTimeout(resolve, 250));
    let off;
    const committed = new Promise((resolve) => {
      off = service.workspaces.subscribe((event) => {
        if (event.type === "workspace.projectsChanged" && event.sourceId === workspace.sourceId) resolve(event);
      });
    });
    const target = grouped ? "Needed/Moved" : "Renamed";
    if (grouped) {
      for (const path of ["Needed/Unrelated", "Other new/Unrelated", "Empty new"]) fs.mkdirSync(join(root, path), { recursive: true });
    }
    const hintsBefore = hints;
    fs.renameSync(join(root, original), join(root, target));
    const prepared = inventory(root);
    let event;
    try { event = await withDeadline(committed, 4000, "Native reconciliation notification"); }
    finally { off(); }
    assert.ok(hints > hintsBefore, "Expected an actual fs.watch hint, not only health/Refresh");
    assert.deepEqual(event.workspaceIds, [workspace.workspaceId, sibling.workspaceId]);
    const notified = query("workspace.listProjects");
    assert.equal(notified.revision, initial.revision + 1);
    assert.deepEqual(notified.projects.map((row) => [row.projectId, row.relativePath]), [[project.projectId, target]]);
    assert.equal(notified.categories.length, grouped ? 2 : 0);
    assert.deepEqual(query("workspace.listTextProperties"), text);
    assert.deepEqual(stable(), before);
    assert.deepEqual(sqlite.prepare("SELECT * FROM sources").get(), { ...source, discovery_revision: source.discovery_revision + 1 });
    assert.deepEqual(inventory(root), prepared);
    const categoryMetadata = notified.categoryProperty;
    // Close owned watchers, then mutate while service is stopped. A reopened
    // service must commit before the first query and never need Discovery Apply.
    service.close(); service = undefined;
    const offline = grouped ? "Offline needed/Offline moved" : "Offline renamed";
    if (grouped) for (const path of ["Offline needed/Unrelated", "Offline other/Unrelated", "Offline empty"]) fs.mkdirSync(join(root, path), { recursive: true });
    fs.renameSync(join(root, target), join(root, offline));
    const offlineInventory = inventory(root);
    service = openSettingsService(databasePath, undefined, undefined, dependencies);
    assert.equal(sqlite.prepare("SELECT relative_path FROM projects WHERE id = ?").get(project.projectId).relative_path, offline);
    const reopened = query("workspace.listProjects");
    assert.equal(reopened.revision, notified.revision + 1);
    assert.equal(reopened.projects.length, 1);
    assert.equal(reopened.projects[0].projectId, project.projectId);
    assert.equal(reopened.projects[0].relativePath, offline);
    assert.equal(reopened.categories.length, grouped ? 3 : 0);
    assert.deepEqual(reopened.categoryProperty, categoryMetadata);
    assert.equal(reopened.categoryPropertyRevision, notified.categoryPropertyRevision);
    const stateAfterStartup = stable();
    for (let pass = 0; pass < 2; ++pass) {
      assert.equal(command("workspace.refreshSource").ok, true);
      assert.deepEqual(query("workspace.listProjects"), reopened);
      assert.deepEqual(query("workspace.listTextProperties"), text);
      assert.deepEqual(stable(), stateAfterStartup);
    }
    assert.deepEqual(stateAfterStartup, before);
    assert.deepEqual(sqlite.prepare("SELECT * FROM sources").get(), { ...source, discovery_revision: source.discovery_revision + 2 });
    assert.deepEqual(inventory(root), offlineInventory);
  } finally { service?.close(); sqlite.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});


for (const grouped of [false, true]) test(`refresh and startup never revive mode-inactive projects or enroll unrelated targets (${grouped})`, () => fixture((f) => {
  const mode = grouped ? "grouped" : "direct";
  f.apply({ mode: grouped ? "direct" : "grouped" }); f.apply({ mode });
  const dormant = f.sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(f.project.projectId);
  const destination = grouped ? "Category/Renamed" : "Renamed";
  fs.renameSync(join(f.root, dormant.relative_path), join(f.root, destination));
  fs.mkdirSync(join(f.root, grouped ? "Category/Unrelated" : "Unrelated"));
  const before = f.records(), files = inventory(f.root); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  f.service.close();
  const reopened = openSettingsService(f.databasePath);
  try {
    assert.deepEqual(f.records(), before);
    const list = reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value;
    assert.equal(list.projects.length, 0); assert.equal(list.retainedProjects.find((row) => row.projectId === f.project.projectId).retentionReason, "mode_change");
    assert.equal(reopened.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId: f.sibling.workspaceId }).ok, true);
    assert.deepEqual(f.records(), before);
  } finally { reopened.close(); }
  assert.deepEqual(inventory(f.root), files);
}, { grouped }));

test("operational category rename follows its evidence while dormant children retain their historical locators", () => groupedFixture((f) => {
  f.apply({ mode: "direct", excludedRelativePaths: ["Category"] });
  f.apply({ mode: "grouped", excludedRelativePaths: [] });
  const before = f.records();
  fs.renameSync(join(f.root, "Category"), join(f.root, "Renamed"));
  const files = inventory(f.root);
  assert.equal(f.refresh().ok, true);
  const after = f.records();
  assert.equal(after.categories[0].relative_path, "Renamed"); assert.equal(after.categories[0].id, before.categories[0].id);
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.text_property_values, before.text_property_values); assert.deepEqual(after.views, before.views);
  assert.equal(after.sources[0].discovery_revision, before.sources[0].discovery_revision + 1);
  assert.deepEqual(inventory(f.root), files);
}));


for (const mode of ["direct", "grouped"]) test(`live production observation after a mode round trip retains dormant projects (${mode})`, async () => {
  const { nativeObserverDependencies } = await import("../src/service/source-observer.ts");
  const { withDeadline } = await import("../scripts/runtime-lifecycle.mjs");
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "native-mode-roundtrip-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(join(root, "Category/Project/nested"), { recursive: true });
  fs.writeFileSync(join(root, "Category/Project/nested/sentinel"), Buffer.from([0, 255, 43]));
  const live = new Set();
  const dependencies = { ...nativeObserverDependencies, watch(path, hint, failed) {
    const handle = nativeObserverDependencies.watch(path, hint, failed); live.add(path);
    return { close() { live.delete(path); handle.close(); } };
  } };
  const service = openSettingsService(databasePath, undefined, undefined, dependencies), sqlite = new Database(databasePath);
  try {
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Native", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const configure = (target) => {
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: target });
      assert.equal(preview.ok, true);
      const result = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.value.previewToken });
      assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
    };
    const original = configure(mode).projects[0];
    const property = service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId: workspace.workspaceId, name: "Notes", propertyType: "text" }).value;
    service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId: workspace.workspaceId, projectId: original.projectId, propertyId: property.propertyId, value: "  Exact\nТекст  " });
    configure(mode === "direct" ? "grouped" : "direct"); configure(mode);
    assert.deepEqual([...live].sort(), [root, ...(mode === "grouped" && !dependencies.pollCategories ? [join(root, "Category")] : [])].sort());
    await new Promise((resolve) => setTimeout(resolve, 250)); // Drain installation-window scans.
    const records = () => ["sources", "projects", "categories", "text_property_values", "category_properties", "views"].map((table) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all());
    const before = records();
    const target = mode === "direct" ? "Renamed category" : "Category/Renamed project";
    let off;
    const observed = new Promise((resolve) => { off = service.workspaces.subscribe((event) => {
      if (event.type === "workspace.sourceObserved") resolve(event);
    }); });
    let event;
    try {
      fs.renameSync(join(root, original.relativePath), join(root, target));
      event = await withDeadline(observed, 7500, "Native mode round-trip observation");
    } finally { off(); }
    assert.deepEqual(event.workspaceIds, [workspace.workspaceId, sibling.workspaceId]); assert.equal(event.sourceId, workspace.sourceId);
    assert.deepEqual(records(), before);
    const list = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }).value;
    assert.equal(list.projects.length, 0); assert.equal(list.retainedProjects.find((row) => row.projectId === original.projectId).retentionReason, "mode_change");
    const sentinel = mode === "direct" ? `${target}/Project/nested/sentinel` : `${target}/nested/sentinel`;
    assert.deepEqual(fs.readFileSync(join(root, sentinel)), Buffer.from([0, 255, 43]));
    service.close(); assert.equal(live.size, 0);
  } finally { service.close(); sqlite.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

for (const groupedStart of [false, true]) test(`role history permits repeated category/child Refresh and startup reconciliation (${groupedStart ? "grouped round trip" : "direct to grouped"})`, () => fixture((f) => {
  if (groupedStart) f.apply({ mode: "direct" });
  f.apply({ mode: "grouped" });
  const path = groupedStart ? "Category/Project" : "Project/nested";
  if (groupedStart) {
    const review = f.query("workspace.previewProjectRecovery", { projectId: f.project.projectId });
    assert.equal(review.ok, true);
    assert.equal(f.command("workspace.reassociateProject", { projectId: f.project.projectId, previewToken: review.value.previewToken, relativePath: path }).ok, true);
  }
  const current = f.query("workspace.listProjects").value;
  const child = current.projects.find((row) => row.relativePath === path), category = current.categories.find((row) => row.categoryId === child.categoryId);
  const dormant = f.records().projects.filter((row) => row.mode_inactive);
  assert.equal(dormant.length, 1);
  assert.equal(dormant[0].relative_path, category.relativePath);
  assert.equal(f.command("workspace.setTextValue", { projectId: child.projectId, propertyId: f.propertyId, value: "  Current child 日本語\n  " }).ok, true);
  const text = f.query("workspace.listTextProperties").value;
  const before = f.records();
  for (const name of ["Renamed", "Renamed again"]) {
    const old = f.query("workspace.listProjects").value.categories.find((row) => row.categoryId === category.categoryId).relativePath;
    fs.renameSync(join(f.root, old), join(f.root, name));
    const bytes = inventory(f.root);
    f.events.length = 0; assert.equal(f.refresh().ok, true);
    const after = f.query("workspace.listProjects").value;
    assert.equal(after.projects.find((row) => row.projectId === child.projectId)?.relativePath, `${name}/${child.name}`);
    assert.equal(after.projects[0].categoryId, category.categoryId);
    assert.deepEqual(f.records().projects.filter((row) => row.mode_inactive), dormant);
    assert.deepEqual(f.query("workspace.listTextProperties").value, text);
    assert.equal(f.events.length, 1); assert.deepEqual(f.events[0].workspaceIds, [f.workspace.workspaceId, f.sibling.workspaceId]);
    assert.deepEqual(inventory(f.root), bytes);
  }
  f.service.close();
  fs.renameSync(join(f.root, "Renamed again"), join(f.root, "Startup renamed"));
  fs.renameSync(join(f.root, "Startup renamed", child.name), join(f.root, "Startup renamed", "New child name"));
  const bytes = inventory(f.root), reopened = openSettingsService(f.databasePath);
  try {
    const after = reopened.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: f.workspace.workspaceId }).value;
    assert.equal(after.revision, current.revision + 3);
    assert.equal(after.projects.find((row) => row.projectId === child.projectId)?.relativePath, "Startup renamed/New child name");
    assert.equal(after.projects[0].categoryId, category.categoryId);
    assert.deepEqual(f.records().projects.filter((row) => row.mode_inactive), dormant);
    assert.deepEqual(reopened.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: f.workspace.workspaceId }).value, text);
    for (const table of ["settings", "workspaces", "views", "active_workspace", "property_definitions", "text_property_values", "category_properties"]) assert.deepEqual(f.records()[table], before[table]);
    assert.deepEqual(inventory(f.root), bytes);
  } finally { reopened.close(); }
}, { grouped: groupedStart }));

for (const unsafe of ["missing", "unresolved", "replaced", "birthtime", "same-role"]) test(`role-history exception still rejects ${unsafe} competing evidence`, () => fixture((f) => {
  const grouped = f.apply({ mode: "grouped" }), child = grouped.projects[0];
  const history = f.records().projects.find((row) => row.mode_inactive);
  if (["missing", "unresolved", "replaced"].includes(unsafe)) f.sqlite.prepare("UPDATE projects SET association_state = ? WHERE id = ?").run(unsafe, history.id);
  if (unsafe === "birthtime") {
    const identity = JSON.parse(history.native_identity); identity.birthtimeNs = String(BigInt(identity.birthtimeNs) + 1n);
    f.sqlite.prepare("UPDATE projects SET native_identity = ? WHERE id = ?").run(JSON.stringify(identity), history.id);
  }
  if (unsafe === "same-role") f.sqlite.prepare("INSERT INTO categories (id, source_id, relative_path, native_identity, association_state, mode_inactive) VALUES (?, ?, 'Other historical category', ?, 'active', 1)")
    .run(randomUUID(), f.workspace.sourceId, history.native_identity);
  fs.renameSync(join(f.root, "Project"), join(f.root, "Renamed"));
  const before = f.records(), bytes = inventory(f.root); f.events.length = 0;
  assert.equal(f.refresh().ok, true); assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []);
  assert.ok(!f.query("workspace.listProjects").value.projects.some((row) => row.projectId === child.projectId));
  assert.deepEqual(inventory(f.root), bytes);
}));
