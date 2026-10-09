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
function fixture(run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "external-reconciliation-")));
  const root = join(directory, "root");
  fs.mkdirSync(join(root, "Project/nested"), { recursive: true });
  fs.writeFileSync(join(root, "Project/nested/sentinel"), Buffer.from([0, 255, 42, 10]));
  const databasePath = join(directory, "workspace.sqlite");
  const service = openSettingsService(databasePath), sqlite = new Database(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
  const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
  const apply = (extra = {}) => {
    const preview = query("workspace.previewDiscovery", extra); assert.equal(preview.ok, true);
    const result = command("workspace.applyDiscovery", { previewToken: preview.value.previewToken }); assert.equal(result.ok, true); return result.value;
  };
  const project = apply().projects[0];
  const propertyId = command("workspace.createProperty", { name: "  Notes 📝  ", propertyType: "text" }).value.propertyId;
  const value = "  Exact\nТекст 📝  ";
  assert.equal(command("workspace.setTextValue", { projectId: project.projectId, propertyId, value }).ok, true);
  const records = () => Object.fromEntries(["sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "workspaces", "views", "active_workspace", "settings"]
    .map((table) => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
  const events = []; service.workspaces.subscribe((event) => events.push(event));
  const refresh = () => command("workspace.refreshSource");
  try { run({ directory, root, databasePath, service, sqlite, workspace, sibling, project, propertyId, value, query, command, apply, records, events, refresh }); }
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
  for (const exclusions of ['["../outside"]', '["Category/Project"]', '{}', '["duplicate","duplicate"]', 'broken json']) fixture((f) => {
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

test("healthy no-op scans ignore timestamp changes and unrelated new folders", () => fixture((f) => {
  const before = f.records();
  fs.writeFileSync(join(f.root, "Project/new-file"), "authored outside Workspace");
  fs.mkdirSync(join(f.root, "Unrelated"));
  const files = inventory(f.root);
  assert.equal(f.refresh().ok, true);
  assert.deepEqual(f.records(), before); assert.deepEqual(f.events, []); assert.deepEqual(inventory(f.root), files);
  assert.equal(f.query("workspace.previewDiscovery").value.entries.find((entry) => entry.relativePath === "Unrelated").reason, null);
}));
