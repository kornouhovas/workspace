import {observeFolder} from '../src/service/folder-evidence.ts';
import {withIdentityMigrationDefaults,bindFixtureFolders,projectMetadataRecords} from './support/identity-migration-fixtures.mjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";

function withFixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "workspace-create-"));
  const root = join(directory, "selected");
  mkdirSync(root);
  const databasePath = join(directory, "data", "workspace.sqlite");
  try { run({ directory, root, databasePath }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

const unconfiguredDiscovery = {
  category_property_revision: 0, property_revision: 0, discovery_mode: null, discovery_revision: 0, excluded_relative_paths: "[]",
  archive_relative_path: null, applied_root_identity: null,durable_evidence:null,evidence_generation:0,
};

function records(databasePath) {
  const sqlite = new Database(databasePath);
  try {
    return {
      sources: sqlite.prepare("SELECT * FROM sources").all(),
      workspaces: sqlite.prepare("SELECT * FROM workspaces").all(),
      views: sqlite.prepare("SELECT * FROM views").all(),
      active: sqlite.prepare("SELECT * FROM active_workspace").all(),
    };
  } finally { sqlite.close(); }
}

test("management responses and notifications share one source observation", () => {
  withFixture(({ root, databasePath }) => {
    let checks = 0;
    let changing = false;
    const filesystem = {
      realpath: realpathSync.native,
      isDirectory: (path) => statSync(path).isDirectory(),
      assertAccessible() {
        if (changing && ++checks > 1) throw new Error("Folder became unavailable");
      },
    };
    const service = openSettingsService(databasePath, undefined, filesystem);
    const events = [];
    service.workspaces.subscribe((event) => events.push(event));
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
      changing = true;
      checks = 1;
      assert.equal(service.workspaces.load().value.activeWorkspace.sourceAvailable, false);
      for (const command of [
        { type: "workspace.activate", workspaceId: one.workspaceId },
        { type: "workspace.rename", workspaceId: two.workspaceId, name: "Renamed" },
        { type: "workspace.reorder", workspaceIds: [two.workspaceId, one.workspaceId] },
        { type: "workspace.remove", workspaceId: one.workspaceId },
      ]) {
        checks = 0;
        events.length = 0;
        const result = service.handleCommand(command);
        assert.equal(result.ok, true);
        const event = events.find((event) => event.type === "workspace.listChanged");
        const active = command.type === "workspace.activate" ? result.value : result.value.activeWorkspace;
        if (command.type === "workspace.activate") {
          assert.deepEqual(event.snapshot.activeWorkspace, active);
          assert.equal(events.filter((event) => event.type === "workspace.sourceChanged").length, 1);
        }
        else assert.deepEqual(event.snapshot, result.value);
        assert.equal(active.sourceAvailable, true);
        for (const sourceEvent of events.filter((event) => event.type === "workspace.sourceChanged")) {
          assert.equal(sourceEvent.source.sourceAvailable, active.sourceAvailable);
          assert.equal(sourceEvent.source.canonicalRoot, active.canonicalRoot);
        }
        assert.equal(checks, 1);
      }
    } finally { service.close(); }
  });
});

test("removal retains sources and file bytes, preserves surviving presentation and reuses orphan sources after restart", () => {
  withFixture(({ directory, root, databasePath }) => {
    const otherRoot = join(directory, "other");
    mkdirSync(otherRoot);
    const bytes = Buffer.from([0, 255, 42, 10]);
    for (const folder of [root, otherRoot]) writeFileSync(join(folder, "keep.bin"), bytes);
    let service = openSettingsService(databasePath);
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
      const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
      const sqlite = new Database(databasePath);
      sqlite.prepare("UPDATE views SET name = ? WHERE id = ?").run("Independent presentation", sibling.viewId);
      sqlite.close();
      service.handleCommand({ type: "workspace.reorder", workspaceIds: [sibling.workspaceId, other.workspaceId, one.workspaceId] });
      const before = records(databasePath);
      const inactive = service.handleCommand({ type: "workspace.remove", workspaceId: one.workspaceId });
      assert.equal(inactive.ok, true);
      assert.equal(inactive.value.activeWorkspace.workspaceId, other.workspaceId);
      assert.deepEqual(records(databasePath).active, before.active);
      assert.deepEqual(records(databasePath).views, before.views.filter((view) => view.workspace_id !== one.workspaceId));
      const active = service.handleCommand({ type: "workspace.remove", workspaceId: other.workspaceId });
      assert.equal(active.ok, true);
      assert.equal(active.value.activeWorkspace.workspaceId, sibling.workspaceId);
      assert.equal(active.value.activeWorkspace.viewId, sibling.viewId);
      assert.deepEqual(records(databasePath).workspaces.map((row) => row.position), [0]);
      const final = service.handleCommand({ type: "workspace.remove", workspaceId: sibling.workspaceId });
      assert.deepEqual(final, { ok: true, value: { workspaces: [], activeWorkspace: null } });
      assert.deepEqual(records(databasePath), { sources: before.sources, workspaces: [], views: [], active: [] });
      for (const folder of [root, otherRoot]) assert.deepEqual(readFileSync(join(folder, "keep.bin")), bytes);
      service.close();
      service = openSettingsService(databasePath);
      assert.deepEqual(service.workspaces.load(), final);
      for (const [folder, original] of [[root, one], [otherRoot, other]]) {
        const recreated = service.workspaces.create({ type: "workspace.create", name: "Recreated", rootPath: folder }).value;
        assert.equal(recreated.sourceId, original.sourceId);
        assert.notEqual(recreated.workspaceId, original.workspaceId);
        assert.notEqual(recreated.viewId, original.viewId);
        assert.deepEqual(readFileSync(join(folder, "keep.bin")), bytes);
      }
      assert.deepEqual(records(databasePath).sources, before.sources);
      const snapshot = service.workspaces.load();
      service.close();
      service = openSettingsService(databasePath);
      assert.deepEqual(service.workspaces.load(), snapshot);
    } finally { service.close(); }
  });
});

test("active removal falls back to saved order and existing Table even when its source is unavailable", () => {
  withFixture(({ directory, root, databasePath }) => {
    const otherRoot = join(directory, "other");
    mkdirSync(otherRoot);
    const service = openSettingsService(databasePath);
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
      const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
      service.handleCommand({ type: "workspace.reorder", workspaceIds: [two.workspaceId, one.workspaceId, other.workspaceId] });
      const before = records(databasePath);
      rmSync(root, { recursive: true });
      const removed = service.handleCommand({ type: "workspace.remove", workspaceId: other.workspaceId });
      assert.equal(removed.ok, true);
      assert.equal(removed.value.activeWorkspace.workspaceId, two.workspaceId);
      assert.equal(removed.value.activeWorkspace.viewId, two.viewId);
      assert.equal(removed.value.activeWorkspace.sourceAvailable, false);
      assert.deepEqual(records(databasePath).sources, before.sources);
      assert.deepEqual(records(databasePath).views, before.views.filter((view) => view.workspace_id !== other.workspaceId));
      const reopened = openSettingsService(databasePath);
      try { assert.deepEqual(reopened.workspaces.load(), removed); }
      finally { reopened.close(); }
    } finally { service.close(); }
  });
});

test("malformed, unknown and repeated removal leave every unrelated record and selection unchanged", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
      assert.equal(service.handleCommand({ type: "workspace.remove", workspaceId: one.workspaceId }).ok, true);
      const before = records(databasePath);
      const valid = { type: "workspace.remove", workspaceId: two.workspaceId };
      for (const input of [null, [], {}, { type: valid.type }, { ...valid, extra: true },
        { ...valid, type: "workspace.unknown" }, { ...valid, workspaceId: 42 }, { ...valid, workspaceId: "bad-id" },
        { ...valid, workspaceId: randomUUID() }, { ...valid, workspaceId: one.workspaceId },
      ]) {
        assert.equal(service.workspaces.remove(input).error.code, "invalid_input");
        assert.deepEqual(records(databasePath), before);
      }
      assert.equal(service.handleCommand({ type: "workspace.reorder", workspaceIds: [one.workspaceId, two.workspaceId] }).error.code, "invalid_input");
      assert.equal(service.handleCommand({ type: "workspace.rename", workspaceId: one.workspaceId, name: "Stale" }).error.code, "invalid_input");
      assert.equal(service.handleCommand({ type: "workspace.activate", workspaceId: one.workspaceId }).error.code, "invalid_input");
      assert.deepEqual(records(databasePath), before);
    } finally { service.close(); }
  });
});

test("removal rolls back selection, owned views and positions on write or resulting snapshot failures", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const sqlite = new Database(databasePath);
    try {
      service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root });
      const active = service.workspaces.create({ type: "workspace.create", name: "Active", rootPath: root }).value;
      const before = records(databasePath);
      for (const [operation, body] of [
        ["DELETE ON views", "SELECT RAISE(ABORT, 'view deletion failure');"],
        ["DELETE ON workspaces", "SELECT RAISE(ABORT, 'workspace deletion failure');"],
        ["UPDATE OF position ON workspaces", "SELECT RAISE(ABORT, 'ordering failure');"],
        ["DELETE ON workspaces", "UPDATE views SET kind = 'unsupported';"],
      ]) {
        sqlite.exec(`CREATE TRIGGER fail_remove AFTER ${operation} BEGIN ${body} END;`);
        assert.equal(service.handleCommand({ type: "workspace.remove", workspaceId: active.workspaceId }).error.code, "storage");
        assert.deepEqual(records(databasePath), before);
        sqlite.exec("DROP TRIGGER fail_remove;");
      }
    } finally { sqlite.close(); service.close(); }
  });
});

test("failed final removal restores the cleared selection and all configuration records", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const sqlite = new Database(databasePath);
    try {
      const final = service.workspaces.create({ type: "workspace.create", name: "Final", rootPath: root }).value;
      const before = records(databasePath);
      sqlite.exec("CREATE TRIGGER fail_final AFTER DELETE ON workspaces BEGIN SELECT RAISE(ABORT, 'injected final deletion failure'); END;");
      assert.equal(service.handleCommand({ type: "workspace.remove", workspaceId: final.workspaceId }).error.code, "storage");
      assert.deepEqual(records(databasePath), before);
      assert.equal(service.workspaces.load().value.activeWorkspace.viewId, final.viewId);
    } finally { sqlite.close(); service.close(); }
  });
});

test("creates a canonical source, workspace, Table view and active selection with distinct IDs", () => {
  withFixture(({ root, databasePath }) => {
    const contents = join(root, "keep.txt");
    writeFileSync(contents, "unchanged");
    const service = openSettingsService(databasePath);
    const created = service.workspaces.create({ type: "workspace.create", name: "  My Space  ", rootPath: root });
    assert.equal(created.ok, true);
    assert.equal(created.value.name, "  My Space  ");
    assert.equal(created.value.canonicalRoot, realpathSync.native(root));
    assert.equal(new Set([created.value.sourceId, created.value.workspaceId, created.value.viewId]).size, 3);
    assert.deepEqual(records(databasePath).views.map(({ name, kind }) => ({ name, kind })), [{ name: "Table", kind: "table" }]);
    assert.equal(records(databasePath).active[0].view_id, created.value.viewId);
    assert.equal(readFileSync(contents, "utf8"), "unchanged");
    service.close();
  });
});

test("reuses the canonical source while creating a separate view per workspace", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root });
    const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: join(root, ".") });
    assert.equal(one.ok && two.ok, true);
    assert.equal(one.value.sourceId, two.value.sourceId);
    assert.notEqual(one.value.workspaceId, two.value.workspaceId);
    assert.notEqual(one.value.viewId, two.value.viewId);
    assert.equal(records(databasePath).sources.length, 1);
    assert.equal(records(databasePath).views.length, 2);
    assert.equal(records(databasePath).active[0].workspace_id, two.value.workspaceId);
    service.close();
  });
});

test("native canonicalization converges locator aliases for source reuse and containment", (context) => {
  withFixture(({ root, directory, databasePath }) => {
    const canonicalRoot = realpathSync.native(root);
    const alias = join(directory, "SHORT~1");
    const nativeRealpath = realpathSync.native;
    // Model a Windows 8.3 alias at the native filesystem boundary.
    context.mock.method(realpathSync, "native", (path) => nativeRealpath(path === alias ? root : path));
    const service = openSettingsService(databasePath);
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "Alias", rootPath: alias });
      const two = service.workspaces.create({ type: "workspace.create", name: "Canonical", rootPath: canonicalRoot });
      assert.equal(one.ok, true);
      assert.equal(two.ok, true);
      assert.equal(one.value.canonicalRoot, canonicalRoot);
      assert.equal(one.value.sourceId, two.value.sourceId);
      assert.equal(service.workspaces.assertContained(alias, canonicalRoot), true);
      assert.equal(service.workspaces.load().value.activeWorkspace.sourceAvailable, true);
      assert.equal(records(databasePath).sources.length, 1);
    } finally { service.close(); }
  });
});

test("picker spelling and native canonical spelling reuse one real source after restart", () => {
  withFixture(({ root, databasePath }) => {
    const canonicalRoot = realpathSync.native(root);
    const service = openSettingsService(databasePath);
    const one = service.workspaces.create({ type: "workspace.create", name: "Picker", rootPath: root });
    const two = service.workspaces.create({ type: "workspace.create", name: "Canonical", rootPath: canonicalRoot });
    assert.equal(one.ok && two.ok, true);
    assert.equal(one.value.canonicalRoot, canonicalRoot);
    assert.equal(one.value.sourceId, two.value.sourceId);
    assert.equal(service.workspaces.assertContained(root, canonicalRoot), true);
    service.close();

    const reopened = openSettingsService(databasePath);
    try {
      const loaded = reopened.workspaces.load();
      assert.equal(loaded.ok, true);
      assert.equal(loaded.value.activeWorkspace.canonicalRoot, canonicalRoot);
      assert.equal(loaded.value.activeWorkspace.sourceAvailable, true);
      assert.equal(loaded.value.activeWorkspace.sourceId, one.value.sourceId);
      assert.equal(loaded.value.activeWorkspace.viewId, two.value.viewId);
    } finally { reopened.close(); }
  });
});

function aliasPolicies(root, directory) {
  const canonicalRoot = realpathSync.native(root);
  const alias = join(directory, "SHORT~1");
  const current = {
    realpath: (path) => realpathSync.native(path === alias ? root : path),
    legacyRealpath: (path) => path === alias ? alias : realpathSync(path),
    isDirectory: (path) => statSync(path === alias ? root : path).isDirectory(),
    assertAccessible: (path) => { fs.accessSync(path === alias ? root : path); },
  };
  return { alias, canonicalRoot, current, previous: { ...current, realpath: current.legacyRealpath } };
}

for (const operation of ["load", "activate", "create"]) {
  test(`${operation} converges a saved legacy alias without changing workspace identities`, () => {
    withFixture(({ root, directory, databasePath }) => {
      const { alias, canonicalRoot, previous, current } = aliasPolicies(root, directory);
      const oldService = openSettingsService(databasePath, undefined, previous);
      const saved = oldService.workspaces.create({ type: "workspace.create", name: "Saved", rootPath: alias });
      assert.equal(saved.ok, true);
      assert.equal(saved.value.canonicalRoot, alias);
      oldService.close();

      const reopened = openSettingsService(databasePath, undefined, current);
      try {
        if (operation === "load") assert.equal(reopened.workspaces.load().value.activeWorkspace.sourceAvailable, true);
        if (operation === "activate") {
          assert.equal(reopened.workspaces.activate({ type: "workspace.activate", workspaceId: saved.value.workspaceId }).value.sourceAvailable, true);
        }
        const added = reopened.workspaces.create({ type: "workspace.create", name: "New", rootPath: canonicalRoot });
        assert.equal(added.ok, true);
        assert.equal(added.value.sourceId, saved.value.sourceId);
        const activated = reopened.workspaces.activate({ type: "workspace.activate", workspaceId: saved.value.workspaceId });
        assert.deepEqual(activated, { ok: true, value: { ...saved.value, canonicalRoot, sourceAvailable: true } });
        assert.deepEqual(records(databasePath).sources, [{ id: saved.value.sourceId, canonical_root: canonicalRoot, ...unconfiguredDiscovery }]);
      } finally { reopened.close(); }

      const again = openSettingsService(databasePath, undefined, current);
      try {
        assert.deepEqual(again.workspaces.load().value.activeWorkspace, { ...saved.value, canonicalRoot, sourceAvailable: true });
      } finally { again.close(); }
    });
  });
}

test("alias convergence retains both existing source identities when canonical locators collide", () => {
  withFixture(({ root, directory, databasePath }) => {
    const { alias, canonicalRoot, previous, current } = aliasPolicies(root, directory);
    const oldService = openSettingsService(databasePath, undefined, previous);
    const aliased = oldService.workspaces.create({ type: "workspace.create", name: "Alias", rootPath: alias });
    const canonical = oldService.workspaces.create({ type: "workspace.create", name: "Canonical", rootPath: canonicalRoot });
    assert.equal(aliased.ok && canonical.ok, true);
    assert.notEqual(aliased.value.sourceId, canonical.value.sourceId);
    const before = records(databasePath);
    oldService.close();

    const reopened = openSettingsService(databasePath, undefined, current);
    try {
      const activated = reopened.workspaces.activate({ type: "workspace.activate", workspaceId: aliased.value.workspaceId });
      assert.deepEqual(activated, { ok: true, value: { ...aliased.value, canonicalRoot, sourceAvailable: true } });
      const added = reopened.workspaces.create({ type: "workspace.create", name: "Third", rootPath: canonicalRoot });
      assert.equal(added.ok, true);
      assert.equal(added.value.sourceId, canonical.value.sourceId);
      assert.deepEqual(records(databasePath).sources, before.sources);
      for (const workspace of before.workspaces) assert.ok(records(databasePath).workspaces.some((row) => row.id === workspace.id && row.source_id === workspace.source_id));
      assert.deepEqual(records(databasePath).views.slice(0, 2), before.views);
    } finally { reopened.close(); }
  });
});

test("failed creation rolls back legacy locator normalization along with new records", () => {
  withFixture(({ root, directory, databasePath }) => {
    const { alias, canonicalRoot, previous, current } = aliasPolicies(root, directory);
    const oldService = openSettingsService(databasePath, undefined, previous);
    assert.equal(oldService.workspaces.create({ type: "workspace.create", name: "Saved", rootPath: alias }).ok, true);
    oldService.close();
    const sqlite = new Database(databasePath);
    sqlite.exec("CREATE TRIGGER fail_view BEFORE INSERT ON views BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    sqlite.close();
    const before = records(databasePath);
    const reopened = openSettingsService(databasePath, undefined, current);
    try {
      const result = reopened.workspaces.create({ type: "workspace.create", name: "Failed", rootPath: canonicalRoot });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "storage");
      assert.deepEqual(records(databasePath), before);
    } finally { reopened.close(); }
  });
});

test("a saved canonical root replaced by a symlink remains unavailable and is not reused", () => {
  withFixture(({ root, directory, databasePath }) => {
    const first = openSettingsService(databasePath);
    const saved = first.workspaces.create({ type: "workspace.create", name: "Saved", rootPath: root });
    assert.equal(saved.ok, true);
    first.close();
    rmSync(root, { recursive: true });
    const replacement = join(directory, "replacement");
    mkdirSync(replacement);
    symlinkSync(replacement, root, process.platform === "win32" ? "junction" : "dir");

    const reopened = openSettingsService(databasePath);
    try {
      const loaded = reopened.workspaces.load().value.activeWorkspace;
      assert.deepEqual(loaded, { ...saved.value, sourceAvailable: false });
      const added = reopened.workspaces.create({ type: "workspace.create", name: "Replacement", rootPath: replacement });
      assert.equal(added.ok, true);
      assert.notEqual(added.value.sourceId, saved.value.sourceId);
      assert.equal(records(databasePath).sources.find((source) => source.id === saved.value.sourceId).canonical_root, saved.value.canonicalRoot);
    } finally { reopened.close(); }
  });
});

test("directory-open denial rejects creation and marks saved sources unavailable", (context) => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    try {
      const created = service.workspaces.create({ type: "workspace.create", name: "Saved", rootPath: root });
      assert.equal(created.ok, true);
      const before = records(databasePath);
      context.mock.method(fs, "opendirSync", () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); });
      syncBuiltinESMExports();
      const denied = service.workspaces.create({ type: "workspace.create", name: "Denied", rootPath: root });
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, "filesystem");
      assert.equal(service.workspaces.load().value.activeWorkspace.sourceAvailable, false);
      assert.equal(service.workspaces.activate({ type: "workspace.activate", workspaceId: created.value.workspaceId }).value.sourceAvailable, false);
      assert.deepEqual(records(databasePath), before);
    } finally {
      context.mock.restoreAll();
      syncBuiltinESMExports();
      service.close();
    }
  });
});

test("rejects malformed requests, blank names, files and inaccessible roots without records", () => {
  withFixture(({ root, directory, databasePath }) => {
    const file = join(directory, "not-a-directory");
    writeFileSync(file, "fixture");
    const deniedFilesystem = {
      realpath(path) { if (path === "denied") throw new Error("permission denied"); return path; },
      isDirectory(path) { return statSync(path).isDirectory(); },
      assertAccessible(path) { if (path === root) throw new Error("permission denied"); },
    };
    const service = openSettingsService(databasePath, undefined, deniedFilesystem);
    assert.equal(service.workspaces.create(null).error.code, "invalid_input");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: " \t ", rootPath: root }).error.code, "invalid_input");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: "File", rootPath: file }).error.code, "filesystem");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: "Denied", rootPath: "denied" }).error.code, "filesystem");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: "Denied after stat", rootPath: root }).error.code, "filesystem");
    assert.deepEqual(records(databasePath), { sources: [], workspaces: [], views: [], active: [] });
    service.close();
  });
});

test("rolls back source, workspace and active selection when view persistence fails", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const sqlite = new Database(databasePath);
    sqlite.exec("CREATE TRIGGER fail_view BEFORE INSERT ON views BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    sqlite.close();
    assert.deepEqual(service.workspaces.create({ type: "workspace.create", name: "Broken", rootPath: root }), {
      ok: false, error: { code: "storage", message: "Workspace could not be created." },
    });
    assert.deepEqual(records(databasePath), { sources: [], workspaces: [], views: [], active: [] });
    service.close();
  });
});

test("source containment rejects sibling prefixes, parent traversal and symlink escapes", () => {
  withFixture(({ directory, root, databasePath }) => {
    const outside = join(directory, "selected-sibling");
    mkdirSync(outside);
    mkdirSync(join(root, "inside"));
    const outsideFile = join(outside, "secret.txt");
    writeFileSync(outsideFile, "secret");
    symlinkSync(outside, join(root, "escape"), process.platform === "win32" ? "junction" : "dir");
    const service = openSettingsService(databasePath);
    assert.equal(service.workspaces.assertContained(root, join(root, "inside")), true);
    assert.equal(service.workspaces.assertContained(root, outsideFile), false);
    assert.equal(service.workspaces.assertContained(root, join(root, "..", "selected-sibling", "secret.txt")), false);
    assert.equal(service.workspaces.assertContained(root, join(root, "escape", "secret.txt")), false);
    service.close();
  });
});

test("loads the saved active workspace and view after closing and reopening the SQLite service", () => {
  withFixture(({ root, databasePath }) => {
    const first = openSettingsService(databasePath);
    const created = first.handleCommand({ type: "workspace.create", name: "Reopen", rootPath: root });
    assert.equal(created.ok, true);
    first.close();

    const reopened = openSettingsService(databasePath);
    assert.deepEqual(reopened.handleQuery({ type: "workspace.load" }), {
      ok: true,
      value: {
        workspaces: [{ workspaceId: created.value.workspaceId, name: "Reopen" }],
        activeWorkspace: {
          workspaceId: created.value.workspaceId,
          sourceId: created.value.sourceId,
          canonicalRoot: realpathSync.native(root),
          viewId: created.value.viewId,
          name: "Reopen",
          sourceAvailable: true,
        },
      },
    });
    reopened.close();
  });
});

test("activation switches between workspaces sharing a source without changing view ownership", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root });
    const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root });
    assert.equal(one.ok && two.ok, true);

    const activated = service.handleCommand({ type: "workspace.activate", workspaceId: one.value.workspaceId });
    assert.equal(activated.ok, true);
    assert.equal(activated.value.workspaceId, one.value.workspaceId);
    assert.equal(activated.value.viewId, one.value.viewId);
    assert.equal(records(databasePath).active[0].workspace_id, one.value.workspaceId);
    assert.equal(records(databasePath).active[0].view_id, one.value.viewId);
    assert.equal(records(databasePath).views.find((view) => view.id === one.value.viewId).workspace_id, one.value.workspaceId);
    assert.notEqual(one.value.viewId, two.value.viewId);
    service.close();
  });
});

test("retains workspace metadata and reports an unavailable source after its root disappears", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const created = service.handleCommand({ type: "workspace.create", name: "Offline", rootPath: root });
    assert.equal(created.ok, true);
    const canonicalRoot = realpathSync.native(root);
    service.close();
    rmSync(root, { recursive: true, force: true });

    const reopened = openSettingsService(databasePath);
    const loaded = reopened.handleQuery({ type: "workspace.load" });
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.value.workspaces, [{ workspaceId: created.value.workspaceId, name: "Offline" }]);
    assert.equal(loaded.value.activeWorkspace.sourceId, created.value.sourceId);
    assert.equal(loaded.value.activeWorkspace.canonicalRoot, canonicalRoot);
    assert.equal(loaded.value.activeWorkspace.viewId, created.value.viewId);
    assert.equal(loaded.value.activeWorkspace.sourceAvailable, false);
    reopened.close();
  });
});

test("retains a saved workspace when its existing root becomes inaccessible", () => {
  withFixture(({ root, databasePath }) => {
    let denied = false;
    const filesystem = {
      realpath: realpathSync,
      isDirectory: (path) => statSync(path).isDirectory(),
      assertAccessible: () => { if (denied) throw new Error("permission denied"); },
    };
    const service = openSettingsService(databasePath, undefined, filesystem);
    const created = service.workspaces.create({ type: "workspace.create", name: "Restricted", rootPath: root });
    assert.equal(created.ok, true);
    denied = true;

    const loaded = service.workspaces.load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.value.activeWorkspace.sourceAvailable, false);
    assert.equal(loaded.value.activeWorkspace.workspaceId, created.value.workspaceId);
    assert.equal(loaded.value.activeWorkspace.viewId, created.value.viewId);
    const activated = service.workspaces.activate({ type: "workspace.activate", workspaceId: created.value.workspaceId });
    assert.equal(activated.ok, true);
    assert.equal(activated.value.sourceAvailable, false);
    assert.deepEqual(records(databasePath).workspaces.map(({ id }) => id), [created.value.workspaceId]);
    service.close();
  });
});

test("rejects malformed and unknown workspace activation IDs", () => {
  withFixture(({ databasePath }) => {
    const service = openSettingsService(databasePath);
    assert.deepEqual(service.handleCommand({ type: "workspace.activate", workspaceId: "bad-id" }), {
      ok: false, error: { code: "invalid_input", message: "Choose a saved workspace." },
    });
    assert.deepEqual(service.handleCommand({ type: "workspace.activate", workspaceId: "00000000-0000-4000-8000-000000000000" }), {
      ok: false, error: { code: "invalid_input", message: "Choose a saved workspace." },
    });
    service.close();
  });
});

test("normalizes database read failures for workspace load and activation", () => {
  withFixture(({ databasePath }) => {
    const service = openSettingsService(databasePath);
    const sqlite = new Database(databasePath);
    sqlite.exec("DROP TABLE workspaces;");
    sqlite.close();
    assert.deepEqual(service.handleQuery({ type: "workspace.load" }), {
      ok: false, error: { code: "storage", message: "Workspace data could not be read or saved." },
    });
    assert.deepEqual(service.handleCommand({ type: "workspace.activate", workspaceId: "00000000-0000-4000-8000-000000000000" }), {
      ok: false, error: { code: "storage", message: "Workspace data could not be read or saved." },
    });
    service.close();
  });
});

test("renames active and inactive configurations durably without changing source, view or selection ownership", () => {
  withFixture(({ directory, root, databasePath }) => {
    const otherRoot = join(directory, "other");
    mkdirSync(otherRoot);
    writeFileSync(join(root, "keep.txt"), "source bytes");
    const service = openSettingsService(databasePath);
    const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
    const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
    const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
    const sqlite = new Database(databasePath);
    sqlite.prepare("UPDATE views SET name = ? WHERE id = ?").run("Independent table", one.viewId);
    sqlite.close();
    const before = records(databasePath);
    const authoredName = "  Общий & workspace  ";
    for (const workspace of [one, two, other]) {
      const renamed = service.handleCommand({ type: "workspace.rename", workspaceId: workspace.workspaceId, name: authoredName });
      assert.equal(renamed.ok, true);
      assert.equal(renamed.value.workspaces.find((item) => item.workspaceId === workspace.workspaceId).name, authoredName);
      assert.equal(renamed.value.activeWorkspace.workspaceId, other.workspaceId);
    }
    const after = records(databasePath);
    assert.deepEqual(after.sources, before.sources);
    assert.deepEqual(after.views, before.views);
    assert.deepEqual(after.active, before.active);
    assert.deepEqual(after.workspaces, before.workspaces.map((workspace) => ({ ...workspace, name: authoredName })));
    assert.equal(readFileSync(join(root, "keep.txt"), "utf8"), "source bytes");
    const snapshot = service.workspaces.load();
    assert.equal(snapshot.value.activeWorkspace.name, authoredName);
    service.close();
    const reopened = openSettingsService(databasePath);
    assert.deepEqual(reopened.workspaces.load(), snapshot);
    assert.equal(reopened.workspaces.activate({ type: "workspace.activate", workspaceId: one.workspaceId }).value.name, authoredName);
    reopened.close();
  });
});

test("invalid, unknown and removed rename targets preserve every remaining record", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const removed = service.workspaces.create({ type: "workspace.create", name: "Removed", rootPath: root }).value;
    const current = service.workspaces.create({ type: "workspace.create", name: "Current", rootPath: root }).value;
    const sqlite = new Database(databasePath);
    sqlite.prepare("DELETE FROM workspace_view_selection WHERE workspace_id = ?").run(removed.workspaceId);
    sqlite.prepare("DELETE FROM views WHERE workspace_id = ?").run(removed.workspaceId);
    sqlite.prepare("DELETE FROM workspaces WHERE id = ?").run(removed.workspaceId);
    sqlite.close();
    const before = records(databasePath);
    const valid = { type: "workspace.rename", workspaceId: current.workspaceId, name: "New" };
    for (const input of [null, [], {}, { ...valid, type: "workspace.unknown" },
      { ...valid, workspaceId: "bad-id" }, { ...valid, workspaceId: 42 },
      { ...valid, workspaceId: "00000000-0000-4000-8000-000000000000" },
      { ...valid, workspaceId: removed.workspaceId }, { ...valid, name: " \t\n " },
      { ...valid, name: null }, { ...valid, sourceId: current.sourceId },
      { type: "workspace.rename", workspaceId: current.workspaceId },
    ]) {
      const result = service.workspaces.rename(input);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "invalid_input");
      assert.deepEqual(records(databasePath), before);
    }
    service.close();
  });
});

test("rename rolls back both write failures and failures reading the resulting snapshot", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const created = service.workspaces.create({ type: "workspace.create", name: "Original", rootPath: root }).value;
    const before = records(databasePath);
    const sqlite = new Database(databasePath);
    for (const body of ["SELECT RAISE(ABORT, 'injected failure');", "UPDATE views SET kind = 'unsupported';"]) {
      sqlite.exec(`CREATE TRIGGER fail_rename AFTER UPDATE OF name ON workspaces BEGIN ${body} END;`);
      const result = service.handleCommand({ type: "workspace.rename", workspaceId: created.workspaceId, name: "Failed" });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "storage");
      assert.deepEqual(records(databasePath), before);
      sqlite.exec("DROP TRIGGER fail_rename;");
    }
    sqlite.close();
    assert.equal(service.workspaces.load().value.activeWorkspace.name, "Original");
    service.close();
  });
});


test("upgrades populated two-migration databases in insertion order without changing identities or presentation", () => {
  withFixture(({ directory, root, databasePath }) => {
    const legacyFolder = join(directory, "legacy-migrations");
    mkdirSync(join(legacyFolder, "meta"), { recursive: true });
    const migrations = "src/service/db/migrations";
    for (const name of ["0000_settings.sql", "0001_workspaces.sql"]) {
      writeFileSync(join(legacyFolder, name), readFileSync(join(migrations, name)));
    }
    const journal = JSON.parse(readFileSync(join(migrations, "meta", "_journal.json"), "utf8"));
    journal.entries = journal.entries.slice(0, 2);
    writeFileSync(join(legacyFolder, "meta", "_journal.json"), JSON.stringify(journal));
    mkdirSync(join(directory, "data"));
    const sqlite = new Database(databasePath);
    migrate(drizzle(sqlite), { migrationsFolder: legacyFolder });
    const sourceId = randomUUID();
    sqlite.prepare("INSERT INTO settings VALUES (?, ?)").run("language", "ru");
    sqlite.prepare("INSERT INTO sources VALUES (?, ?)").run(sourceId, realpathSync.native(root));
    // Deliberately oppose lexical ID order to the previous insertion order.
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort().reverse();
    const viewIds = ids.map(() => randomUUID());
    ids.forEach((id, index) => {
      sqlite.prepare("INSERT INTO workspaces VALUES (?, ?, ?)").run(id, `  Saved ${index}  `, sourceId);
      sqlite.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, ?, ?)").run(viewIds[index], id, `Independent ${index}`, "table");
    });
    sqlite.prepare("INSERT INTO active_workspace VALUES (?, ?, ?)").run("active", ids[1], viewIds[1]);
    sqlite.close();
    const before = records(databasePath);
    for (let reopen = 0; reopen < 2; reopen++) {
      const service = openSettingsService(databasePath);
      try {
        assert.deepEqual(service.workspaces.load().value.workspaces.map((row) => row.workspaceId), ids);
        const after = records(databasePath);
        assert.deepEqual(after, { ...before,
          sources: before.sources.map((row) => ({ ...row, ...unconfiguredDiscovery })),
          workspaces: before.workspaces.map((row, position) => ({ ...row, position })),
          views: before.views.map(row => ({ ...row, position: 0, filter_config: '{"search":"","rules":[]}', grouping_config: '{"propertyId":null,"settings":[]}', board_config: '{"widths":[],"properties":[],"wrap":true}', table_config: '{"columns":[],"rowOrder":[]}' })) });
        const preview = discoveryPreview(service, ids[1]);
        assert.equal(preview.ok, true);
        assert.equal(preview.value.state,"association_review_required");assert.equal(preview.value.previewToken,null);
        assert.equal(preview.value.revision,0);
        assert.deepEqual(records(databasePath), after);
        assert.equal(service.handleQuery({ type: "settings.load" }).value.language, "ru");
      } finally { service.close(); }
    }
  });
});

test("reorder survives restart and append while preserving shared sources, selection and independent views", () => {
  withFixture(({ directory, root, databasePath }) => {
    const otherRoot = join(directory, "other");
    mkdirSync(otherRoot);
    const service = openSettingsService(databasePath);
    const create = (name, rootPath = root) => service.handleCommand({ type: "workspace.create", name, rootPath }).value;
    const one = create("One");
    const two = create("Two");
    const other = create("Other", otherRoot);
    const sqlite = new Database(databasePath);
    sqlite.prepare("UPDATE views SET name = ? WHERE id = ?").run("Custom presentation", two.viewId);
    sqlite.close();
    const before = records(databasePath);
    const workspaceIds = [other.workspaceId, one.workspaceId, two.workspaceId];
    const reordered = service.handleCommand({ type: "workspace.reorder", workspaceIds });
    assert.equal(reordered.ok, true);
    assert.deepEqual(reordered.value.workspaces.map((row) => row.workspaceId), workspaceIds);
    assert.equal(reordered.value.activeWorkspace.workspaceId, other.workspaceId);
    const after = records(databasePath);
    assert.deepEqual(after.sources, before.sources);
    assert.deepEqual(after.views, before.views);
    assert.deepEqual(after.active, before.active);
    assert.deepEqual(after.workspaces, before.workspaces.map((row) => ({ ...row, position: workspaceIds.indexOf(row.id) })));
    service.close();
    const reopened = openSettingsService(databasePath);
    try {
      assert.deepEqual(reopened.workspaces.load(), reordered);
      const added = reopened.workspaces.create({ type: "workspace.create", name: "Append", rootPath: root }).value;
      assert.deepEqual(reopened.workspaces.load().value.workspaces.map((row) => row.workspaceId), [...workspaceIds, added.workspaceId]);
      assert.equal(records(databasePath).workspaces.find((row) => row.id === added.workspaceId).position, 3);
      assert.equal(reopened.workspaces.activate({ type: "workspace.activate", workspaceId: two.workspaceId }).value.viewId, two.viewId);
    } finally { reopened.close(); }
  });
});

test("reorder rejects malformed permutations and stale membership after creation or removal without writes", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    try {
      assert.deepEqual(service.handleCommand({ type: "workspace.reorder", workspaceIds: [] }), { ok: true, value: { workspaces: [], activeWorkspace: null } });
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
      const before = records(databasePath);
      const valid = { type: "workspace.reorder", workspaceIds: [two.workspaceId, one.workspaceId] };
      for (const input of [null, [], {}, { ...valid, type: "workspace.unknown" }, { ...valid, extra: true },
        { type: "workspace.reorder" }, { ...valid, workspaceIds: null }, { ...valid, workspaceIds: "ids" },
        { ...valid, workspaceIds: [one.workspaceId, 42] }, { ...valid, workspaceIds: [one.workspaceId, "bad-id"] },
        { ...valid, workspaceIds: [one.workspaceId, "00000000-0000-4000-8000-000000000000"] },
        { ...valid, workspaceIds: [one.workspaceId, one.workspaceId] }, { ...valid, workspaceIds: [] },
        { ...valid, workspaceIds: [one.workspaceId] },
      ]) {
        const result = service.workspaces.reorder(input);
        assert.equal(result.ok, false);
        assert.equal(result.error.code, "invalid_input");
        assert.deepEqual(records(databasePath), before);
      }
      const third = service.workspaces.create({ type: "workspace.create", name: "Third", rootPath: root }).value;
      const afterCreate = records(databasePath);
      assert.equal(service.handleCommand(valid).error.code, "invalid_input");
      assert.deepEqual(records(databasePath), afterCreate);
      const oldIds = [one.workspaceId, two.workspaceId, third.workspaceId];
      // Removal is delivered in Task 3; model a removed inactive configuration at the storage boundary.
      const sqlite = new Database(databasePath);
      sqlite.prepare("DELETE FROM workspace_view_selection WHERE workspace_id = ?").run(one.workspaceId);
      sqlite.prepare("DELETE FROM views WHERE workspace_id = ?").run(one.workspaceId);
      sqlite.prepare("DELETE FROM workspaces WHERE id = ?").run(one.workspaceId);
      sqlite.close();
      const afterRemove = records(databasePath);
      assert.equal(service.handleCommand({ type: "workspace.reorder", workspaceIds: oldIds }).error.code, "invalid_input");
      assert.deepEqual(records(databasePath), afterRemove);
    } finally { service.close(); }
  });
});

test("reorder rolls back partial writes and resulting snapshot failures", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
    const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
    const before = records(databasePath);
    const sqlite = new Database(databasePath);
    try {
      for (const body of ["SELECT CASE WHEN NEW.position = 1 THEN RAISE(ABORT, 'injected failure') END;", "UPDATE views SET kind = 'unsupported';"]) {
        sqlite.exec(`CREATE TRIGGER fail_reorder AFTER UPDATE OF position ON workspaces BEGIN ${body} END;`);
        const result = service.handleCommand({ type: "workspace.reorder", workspaceIds: [two.workspaceId, one.workspaceId] });
        assert.equal(result.ok, false);
        assert.equal(result.error.code, "storage");
        assert.deepEqual(records(databasePath), before);
        sqlite.exec("DROP TRIGGER fail_reorder;");
      }
    } finally { sqlite.close(); service.close(); }
  });
});

test("source observations fan out to actual references, suppress unchanged and failed changes, and unsubscribe", () => {
  withFixture(({ directory, root, databasePath }) => {
    const otherRoot = join(directory, "other");
    mkdirSync(otherRoot);
    const service = openSettingsService(databasePath);
    const events = [];
    try {
      const unsubscribe = service.workspaces.subscribe((event) => events.push(event));
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
      const other = service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
      events.length = 0;
      rmSync(root, { recursive: true });
      const refresh = { type: "workspace.refreshSource", workspaceId: one.workspaceId };
      const unavailable = service.handleCommand(refresh);
      assert.equal(unavailable.ok, true);
      assert.deepEqual(unavailable.value, {
        sourceId: one.sourceId, workspaceIds: [one.workspaceId, two.workspaceId],
        canonicalRoot: join(realpathSync.native(directory), "selected"), sourceAvailable: false,
      });
      assert.deepEqual(events, [{ type: "workspace.sourceChanged", source: unavailable.value }]);
      assert.equal(events[0].source.workspaceIds.includes(other.workspaceId), false);
      service.handleCommand(refresh);
      service.workspaces.activate({ type: "workspace.activate", workspaceId: two.workspaceId });
      assert.equal(events.filter((event) => event.type === "workspace.sourceChanged").length, 1);
      events.length = 0;
      for (const input of [
        { ...refresh, extra: true }, { ...refresh, workspaceId: randomUUID() },
        { ...refresh, workspaceId: 42 }, { ...refresh, workspaceId: "bad" },
      ]) assert.equal(service.handleCommand(input).error.code, "invalid_input");
      assert.deepEqual(events, []);
      mkdirSync(root);
      service.workspaces.load();
      assert.equal(events.length, 1);
      assert.equal(events[0].source.sourceAvailable, true);
      events.length = 0;
      const sqlite = new Database(databasePath);
      sqlite.exec("CREATE TRIGGER fail_rename BEFORE UPDATE OF name ON workspaces BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
      sqlite.close();
      assert.equal(service.workspaces.rename({ type: "workspace.rename", workspaceId: one.workspaceId, name: "No" }).ok, false);
      assert.deepEqual(events, []);
      unsubscribe();
      service.workspaces.remove({ type: "workspace.remove", workspaceId: one.workspaceId });
      assert.deepEqual(events, []);
    } finally { service.close(); }
  });
});

test("source locator notifications commit with normalization, and rollback suppresses observations until retry", () => {
  withFixture(({ directory, root, databasePath }) => {
    const { alias, canonicalRoot, previous, current } = aliasPolicies(root, directory);
    const old = openSettingsService(databasePath, undefined, previous);
    const one = old.workspaces.create({ type: "workspace.create", name: "One", rootPath: alias }).value;
    const two = old.workspaces.create({ type: "workspace.create", name: "Two", rootPath: alias }).value;
    old.close();
    const service = openSettingsService(databasePath, undefined, current);
    const events = [];
    service.workspaces.subscribe((event) => events.push(event));
    try {
      const before = records(databasePath);
      const sqlite = new Database(databasePath);
      sqlite.exec("CREATE TRIGGER fail_source BEFORE UPDATE ON sources BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
      sqlite.close();
      assert.equal(service.handleCommand({ type: "workspace.refreshSource", workspaceId: one.workspaceId }).error.code, "storage");
      assert.deepEqual(records(databasePath), before);
      assert.deepEqual(events, []);
      const writable = new Database(databasePath);
      writable.exec("DROP TRIGGER fail_source");
      writable.close();
      const refreshed = service.handleCommand({ type: "workspace.refreshSource", workspaceId: two.workspaceId });
      assert.equal(refreshed.value.canonicalRoot, canonicalRoot);
      assert.deepEqual(events, [{ type: "workspace.sourceChanged", source: refreshed.value }]);
      assert.deepEqual(refreshed.value.workspaceIds, [one.workspaceId, two.workspaceId]);
      assert.equal(records(databasePath).sources[0].canonical_root, canonicalRoot);
      service.workspaces.load();
      assert.equal(events.length, 1);
    } finally { service.close(); }
  });
});

test("subscriptions observe committed snapshots, isolate listener failures, and clear on close", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const events = [];
    service.workspaces.subscribe(() => { throw new Error("subscriber failure"); });
    const committedRows = [];
    service.workspaces.subscribe((event) => {
      events.push(event);
      if (event.type === "workspace.listChanged") committedRows.push({ event, rows: records(databasePath) });
    });
    const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
    assert.ok(one);
    const snapshot = service.workspaces.rename({ type: "workspace.rename", workspaceId: one.workspaceId, name: "Renamed" });
    assert.equal(snapshot.ok, true);
    assert.deepEqual(events.at(-1), { type: "workspace.listChanged", snapshot: snapshot.value });
    for (const { event, rows } of committedRows) {
      assert.deepEqual(event.snapshot.workspaces.map((workspace) => workspace.workspaceId), rows.workspaces.map((workspace) => workspace.id));
      assert.equal(event.snapshot.activeWorkspace?.workspaceId ?? null, rows.active[0]?.workspace_id ?? null);
    }
    const count = events.length;
    service.close();
    service.workspaces.load();
    assert.equal(events.length, count);
  });
});

test("source refresh rejects a retargeted root without changing source identity or locator", () => {
  withFixture(({ directory, root, databasePath }) => {
    const service = openSettingsService(databasePath);
    try {
      const saved = service.workspaces.create({ type: "workspace.create", name: "Saved", rootPath: root }).value;
      const before = records(databasePath);
      const events = [];
      service.workspaces.subscribe((event) => events.push(event));
      rmSync(root, { recursive: true });
      const other = join(directory, "replacement");
      mkdirSync(other);
      symlinkSync(other, root, process.platform === "win32" ? "junction" : "dir");
      const refreshed = service.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId: saved.workspaceId });
      assert.equal(refreshed.ok, true);
      assert.equal(refreshed.value.sourceAvailable, false);
      assert.equal(refreshed.value.canonicalRoot, saved.canonicalRoot);
      assert.deepEqual(records(databasePath), before);
      assert.deepEqual(events, [{ type: "workspace.sourceChanged", source: refreshed.value }]);
    } finally { service.close(); }
  });
});

test("subscription-triggered reads do not duplicate observations or reorder committed event batches", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const events = [];
    let renamed = false;
    service.workspaces.subscribe((event) => {
      if (event.type === "workspace.listChanged" && !renamed) {
        renamed = true;
        service.workspaces.load();
        service.workspaces.rename({ type: "workspace.rename", workspaceId: event.snapshot.activeWorkspace.workspaceId, name: "Renamed" });
      }
    });
    service.workspaces.subscribe((event) => events.push(event));
    try {
      assert.equal(service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).ok, true);
      assert.deepEqual(events.map((event) => event.type), ["workspace.listChanged", "workspace.sourceChanged", "workspace.listChanged"]);
      assert.equal(events[0].snapshot.activeWorkspace.name, "One");
      assert.equal(events[2].snapshot.activeWorkspace.name, "Renamed");
    } finally { service.close(); }
  });
});

function discoveryPreview(service, workspaceId, excludedRelativePaths) {
  return service.handleQuery({ type: "workspace.previewDiscovery", workspaceId,
    ...(excludedRelativePaths === undefined ? {} : { excludedRelativePaths }) });
}

test("direct preview is read-only, stops at projects, and excludes links/service folders without reading targets", () => {
  withFixture(({ directory, root, databasePath }) => {
    for (const name of ["Project", "Archive", ".service", "$RECYCLE.BIN", "system volume information"])
      mkdirSync(join(root, name));
    mkdirSync(join(root, "Project", "Nested"));
    writeFileSync(join(root, "Project", "sentinel.bin"), Buffer.from([0, 255, 42]));
    writeFileSync(join(root, "ordinary.txt"), "ordinary");
    const external = join(directory, "external");
    mkdirSync(external);
    writeFileSync(join(external, "sentinel.txt"), "untouched");
    symlinkSync(external, join(root, "Linked"), process.platform === "win32" ? "junction" : "dir");
    const service = openSettingsService(databasePath);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const before = records(databasePath);
      const events = [];
      service.workspaces.subscribe((event) => events.push(event));
      const result = discoveryPreview(service, workspace.workspaceId);
      assert.equal(result.ok, true);
      assert.equal(result.value.state, "ready");
      assert.ok(result.value.previewToken);
      assert.deepEqual(result.value.entries.map((entry) => [entry.relativePath, entry.reason]), [
        ["$RECYCLE.BIN", "service"], [".service", "hidden"], ["Archive", null], ["Linked", "link"],
        ["Project", null], ["system volume information", "service"],
      ]);
      const excluded = discoveryPreview(service, workspace.workspaceId, ["Project"]);
      assert.equal(excluded.value.entries.find((entry) => entry.relativePath === "Project").reason, "manual");
      assert.notEqual(excluded.value.previewToken, result.value.previewToken);
      assert.deepEqual(discoveryPreview(service, workspace.workspaceId).value.excludedRelativePaths, []);
      assert.deepEqual(records(databasePath), before);
      assert.deepEqual(events, []);
      assert.deepEqual(readFileSync(join(root, "Project", "sentinel.bin")), Buffer.from([0, 255, 42]));
      assert.equal(readFileSync(join(external, "sentinel.txt"), "utf8"), "untouched");
      assert.deepEqual(fs.readdirSync(join(root, "Project")).sort(), ["Nested", "sentinel.bin"]);
    } finally { service.close(); }
  });
});

test("preview honors a persisted archive designation and absent saved exclusions without guessing Archive", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Storage", "archive"), { recursive: true });
    mkdirSync(join(root, "Archive"));
    const service = openSettingsService(databasePath);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const sqlite = new Database(databasePath);
      try {
        sqlite.prepare("UPDATE sources SET archive_relative_path = ?, excluded_relative_paths = ? WHERE id = ?")
          .run("Storage/archive", JSON.stringify(["Absent"]), workspace.sourceId);
        const before = records(databasePath);
        const preview = discoveryPreview(service, workspace.workspaceId).value;
        assert.deepEqual(preview.entries.map((entry) => [entry.relativePath, entry.reason]), [["Archive", null], ["Storage", "archive"]]);
        assert.deepEqual(preview.excludedRelativePaths, ["Absent"]);
        assert.deepEqual(records(databasePath), before);
        sqlite.prepare("UPDATE sources SET archive_relative_path = '../escape' WHERE id = ?").run(workspace.sourceId);
        const unsafe = discoveryPreview(service, workspace.workspaceId);
        assert.equal(unsafe.ok, false);
        assert.equal(unsafe.error.code, "storage");
      } finally { sqlite.close(); }
    } finally { service.close(); }
  });
});

test("preview distinguishes empty, unavailable, unreadable and retargeted sources without changing saved state", () => {
  withFixture(({ directory, root, databasePath }) => {
    const service = openSettingsService(databasePath);
    const originalOpen = fs.opendirSync;
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const before = records(databasePath);
      assert.equal(discoveryPreview(service, workspace.workspaceId).value.state, "empty");
      fs.opendirSync = () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); };
      syncBuiltinESMExports();
      const unreadable = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(unreadable.state, "unreadable");
      assert.equal(unreadable.previewToken, null);
      fs.opendirSync = originalOpen;
      syncBuiltinESMExports();
      fs.renameSync(root, join(directory, "disconnected"));
      assert.equal(discoveryPreview(service, workspace.workspaceId).value.state, "unavailable");
      symlinkSync(join(directory, "disconnected"), root, process.platform === "win32" ? "junction" : "dir");
      const conflict = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(conflict.state, "root_identity_conflict");
      assert.equal(conflict.previewToken, null);
      assert.deepEqual(records(databasePath), before);
    } finally {
      fs.opendirSync = originalOpen;
      syncBuiltinESMExports();
      service.close();
    }
  });
});

test("inaccessible automatic exclusions do not block preview/apply or discard retained project evidence", () => {
  for (const [name, reason] of [[".service", "hidden"], ["$RECYCLE.BIN", "service"],
    ["System Volume Information", "service"], ["Storage", "archive"]]) {
    withFixture(({ root, databasePath }) => {
      mkdirSync(join(root, "Project")); mkdirSync(join(root, name));
      writeFileSync(join(root, name, "keep"), "excluded bytes");
      const service = openSettingsService(databasePath);
      const originalLstat = fs.lstatSync;
      const originalRealpath = fs.realpathSync.native;
      try {
        const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
        const initial = applyDiscovery(service, workspace.workspaceId).value;
        const saved = projectRecords(databasePath);
        if (reason === "archive") {
          const sql = new Database(databasePath);
          sql.prepare("UPDATE sources SET archive_relative_path = 'Storage/nested'").run(); sql.close();
        }
        fs.lstatSync = (path, ...args) => {
          if (path === join(workspace.canonicalRoot, name)) throw Object.assign(new Error("denied"), { code: "EACCES" });
          return originalLstat(path, ...args);
        };
        fs.realpathSync.native = (path, ...args) => {
          assert.notEqual(path, join(workspace.canonicalRoot, name));
          return originalRealpath(path, ...args);
        };
        syncBuiltinESMExports();
        const preview = discoveryPreview(service, workspace.workspaceId).value;
        assert.equal(preview.state, "ready");
        assert.ok(preview.previewToken);
        assert.equal(preview.entries.find((entry) => entry.name === name).reason, reason);
        assert.deepEqual(projectRecords(databasePath), saved);
        const applied = applyDiscovery(service, workspace.workspaceId, preview.previewToken).value;
        assert.deepEqual(applied.projects, initial.projects.filter((project) => project.name === "Project"));
        for (const row of saved) {
          const retained = projectRecords(databasePath).find((project) => project.id === row.id);
          assert.equal(retained.native_identity, row.native_identity);
          assert.equal(retained.association_state, row.relative_path === name ? "excluded" : "active");
        }
        assert.equal(readFileSync(join(root, name, "keep"), "utf8"), "excluded bytes");
        const committed = projectRecords(databasePath);
        fs.lstatSync = (path, ...args) => {
          if (path === join(workspace.canonicalRoot, "Project")) throw Object.assign(new Error("denied"), { code: "EACCES" });
          return originalLstat(path, ...args);
        };
        syncBuiltinESMExports();
        const unsafe = discoveryPreview(service, workspace.workspaceId).value;
        assert.equal(unsafe.state, "unreadable");
        assert.equal(unsafe.previewToken, null);
        assert.deepEqual(projectRecords(databasePath), committed);
      } finally {
        fs.lstatSync = originalLstat; fs.realpathSync.native = originalRealpath; syncBuiltinESMExports(); service.close();
      }
    });
  }
});

test("ordinary platform-valid files cannot prevent discovery of real project directories", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const file = process.platform === "win32" ? "ordinary.txt" : "a:notes.txt";
    writeFileSync(join(root, file), "ordinary bytes");
    const service = openSettingsService(databasePath);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const preview = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(preview.state, "ready");
      assert.deepEqual(preview.entries.map((entry) => entry.name), ["Project"]);
      assert.deepEqual(applyDiscovery(service, workspace.workspaceId, preview.previewToken).value.projects.map((project) => project.name), ["Project"]);
      assert.equal(readFileSync(join(root, file), "utf8"), "ordinary bytes");
    } finally { service.close(); }
  });
});

test("native POSIX project names support preview/apply, exclusions and stable IDs after restart", { skip: process.platform === "win32" }, () => {
  withFixture(({ root, databasePath }) => {
    const names = ["Back\\slash", "C:local", "Project"];
    for (const name of names) {
      mkdirSync(join(root, name, "Nested"), { recursive: true });
      writeFileSync(join(root, name, "keep"), name);
    }
    let service = openSettingsService(databasePath);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const preview = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(preview.state, "ready");
      assert.ok(preview.previewToken);
      assert.deepEqual(preview.entries.map((entry) => entry.name), names);
      const applied = applyDiscovery(service, workspace.workspaceId, preview.previewToken).value;
      assert.deepEqual(applied.projects.map((project) => project.name), names);
      assert.deepEqual(applyDiscovery(service, workspace.workspaceId).value.projects, applied.projects);
      const excluded = discoveryPreview(service, workspace.workspaceId, ["Back\\slash", "C:local"]).value;
      assert.deepEqual(excluded.entries.map((entry) => [entry.name, entry.reason]),
        [["Back\\slash", "manual"], ["C:local", "manual"], ["Project", null]]);
      const filtered = applyDiscovery(service, workspace.workspaceId, excluded.previewToken).value;
      assert.deepEqual(filtered.projects, applied.projects.filter((project) => project.name === "Project"));
      assert.equal(filtered.retainedCount, 2);
      service.close(); service = openSettingsService(databasePath);
      assert.deepEqual(listProjects(service, workspace.workspaceId).value.projects, filtered.projects);
      assert.deepEqual(discoveryPreview(service, workspace.workspaceId).value.excludedRelativePaths, ["Back\\slash", "C:local"]);
      const included = discoveryPreview(service, workspace.workspaceId, []).value;
      assert.deepEqual(applyDiscovery(service, workspace.workspaceId, included.previewToken).value.projects, applied.projects);
      for (const name of names) {
        assert.deepEqual(fs.readdirSync(join(root, name)).sort(), ["Nested", "keep"]);
        assert.equal(readFileSync(join(root, name, "keep"), "utf8"), name);
      }
      assert.deepEqual(fs.readdirSync(root).sort(), names);
      assert.equal(service.workspaces.load().value.activeWorkspace.viewId, workspace.viewId);
    } finally { service.close(); }
  });
});

test("persisted archives honor native POSIX child names without guessing ordinary Archive folders", { skip: process.platform === "win32" }, () => {
  for (const archiveChild of ["C:local", "Back\\slash"]) {
    withFixture(({ root, databasePath }) => {
      mkdirSync(join(root, archiveChild, "nested"), { recursive: true });
      mkdirSync(join(root, "Archive"));
      writeFileSync(join(root, archiveChild, "nested", "keep"), "archive bytes");
      const service = openSettingsService(databasePath);
      try {
        const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
        const sql = new Database(databasePath);
        try { sql.prepare("UPDATE sources SET archive_relative_path = ? WHERE id = ?").run(`${archiveChild}/nested`, workspace.sourceId); }
        finally { sql.close(); }
        const result = discoveryPreview(service, workspace.workspaceId);
        assert.equal(result.ok, true);
        const preview = result.value;
        assert.equal(preview.state, "ready");
        assert.ok(preview.previewToken);
        assert.deepEqual(preview.entries.map((entry) => [entry.name, entry.reason]), [["Archive", null], [archiveChild, "archive"]]);
        assert.deepEqual(applyDiscovery(service, workspace.workspaceId, preview.previewToken).value.projects.map((project) => project.name), ["Archive"]);
        assert.equal(readFileSync(join(root, archiveChild, "nested", "keep"), "utf8"), "archive bytes");
      } finally { service.close(); }
    });
  }
});

test("preview rejects malformed, foreign and unsafe exclusion requests", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    mkdirSync(join(root, ".hidden"));
    const service = openSettingsService(databasePath);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      for (const input of [
        { type: "workspace.previewDiscovery" },
        Object.create({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId }),
        { type: "workspace.previewDiscovery", workspaceId: randomUUID() },
        { type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, extra: true },
        ...[null, "Project", ["Project", "Project"], ["invented"], ["../escape"], ["/absolute"], ["a\\b"], [".hidden"],
          ["..\\escape"], ["C:local"], ["C:\\outside"], ["\\\\server\\share"], ["Project\0suffix"]]
          .map((excludedRelativePaths) => ({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, excludedRelativePaths })),
      ]) assert.equal(service.handleQuery(input).error.code, "invalid_input");
    } finally { service.close(); }
  });
});

test("preview rejects filesystem changes during enumeration and never resolves or opens link targets", () => {
  withFixture(({ directory, root, databasePath }) => {
    const external = join(directory, "external");
    mkdirSync(external);
    mkdirSync(join(root, "Project"));
    symlinkSync(external, join(root, "Linked"), process.platform === "win32" ? "junction" : "dir");
    const service = openSettingsService(databasePath);
    const originalOpen = fs.opendirSync;
    const originalRealpath = fs.realpathSync.native;
    const originalLstat = fs.lstatSync;
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const canonical = workspace.canonicalRoot;
      const touched = [];
      fs.realpathSync.native = (path, ...args) => {
        touched.push(path);
        assert.notEqual(path, join(canonical, "Linked"));
        assert.notEqual(path, external);
        return originalRealpath(path, ...args);
      };
      fs.lstatSync = (path, ...args) => {
        assert.notEqual(path, external);
        return originalLstat(path, ...args);
      };
      fs.opendirSync = (path, ...args) => {
        touched.push(path);
        assert.equal(path, canonical);
        return originalOpen(path, ...args);
      };
      syncBuiltinESMExports();
      assert.equal(discoveryPreview(service, workspace.workspaceId).value.state, "ready");
      assert.ok(touched.length > 0);
      const before = records(databasePath);
      let opens = 0;
      fs.opendirSync = (path, ...args) => {
        if (++opens === 2) mkdirSync(join(root, "Added-during-scan"));
        return originalOpen(path, ...args);
      };
      syncBuiltinESMExports();
      const changed = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(changed.state, "changed");
      assert.equal(changed.previewToken, null);
      assert.deepEqual(records(databasePath), before);
    } finally {
      fs.opendirSync = originalOpen;
      fs.realpathSync.native = originalRealpath;
      fs.lstatSync = originalLstat;
      syncBuiltinESMExports();
      service.close();
    }
  });
});

function applyDiscovery(service, workspaceId, previewToken = discoveryPreview(service, workspaceId).value.previewToken) {
  return service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken });
}
function listProjects(service, workspaceId) {
  return service.handleQuery({ type: "workspace.listProjects", workspaceId });
}
function projectRecords(databasePath) {
  const sqlite = new Database(databasePath);
  try { return sqlite.prepare("SELECT * FROM projects ORDER BY id").all(); }
  finally { sqlite.close(); }
}

test("apply commits the reviewed projection/exclusions, retains IDs on rescan/restart and re-inclusion, writes no markers", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "One", "Nested"), { recursive: true });
    mkdirSync(join(root, "Two"));
    writeFileSync(join(root, "One", "keep"), "one");
    writeFileSync(join(root, "Two", "keep"), "two");
    let service = openSettingsService(databasePath);
    const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
    try {
      assert.equal(listProjects(service, workspace.workspaceId).value.configured, false);
      const preview = discoveryPreview(service, workspace.workspaceId, ["Two"]).value;
      const applied = applyDiscovery(service, workspace.workspaceId, preview.previewToken);
      assert.equal(applied.ok, true);
      assert.deepEqual(applied.value.projects.map((p) => p.name), ["One"]);
      const id = applied.value.projects[0].projectId;
      assert.notEqual(id, "One");
      assert.deepEqual(discoveryPreview(service, workspace.workspaceId).value.excludedRelativePaths, ["Two"]);
      assert.equal(applyDiscovery(service, workspace.workspaceId).value.projects[0].projectId, id);
      // Mutable timestamps are not durable folder identity.
      writeFileSync(join(root, "One", "new"), "content");
      assert.equal(applyDiscovery(service, workspace.workspaceId).value.projects[0].projectId, id);
      service.close(); service = openSettingsService(databasePath);
      assert.equal(listProjects(service, workspace.workspaceId).value.projects[0].projectId, id);
      assert.equal(applyDiscovery(service, workspace.workspaceId).value.projects[0].projectId, id);
      const excluded = discoveryPreview(service, workspace.workspaceId, ["One", "Two"]).value;
      assert.equal(applyDiscovery(service, workspace.workspaceId, excluded.previewToken).value.retainedCount, 1);
      const included = discoveryPreview(service, workspace.workspaceId, []).value;
      const restored = applyDiscovery(service, workspace.workspaceId, included.previewToken).value;
      assert.equal(restored.projects.find((p) => p.name === "One").projectId, id);
      assert.deepEqual(fs.readdirSync(root).sort(), ["One", "Two"]);
      assert.deepEqual(fs.readdirSync(join(root, "One")).sort(), ["Nested", "keep", "new"]);
      assert.deepEqual(fs.readdirSync(join(root, "Two")), ["keep"]);
      assert.equal(readFileSync(join(root, "Two", "keep"), "utf8"), "two");
      assert.equal(service.workspaces.load().value.activeWorkspace.viewId, workspace.viewId);
    } finally { service.close(); }
  });
});

test("apply rejects stale filesystem/configuration, foreign/forged/expired tokens and exact-payload violations without writes", () => {
  withFixture(({ directory, root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const service = openSettingsService(databasePath);
    const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
    const sibling = service.handleCommand({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const baseline = records(databasePath);
    try {
      const token = discoveryPreview(service, workspace.workspaceId).value.previewToken;
      for (const input of [
        { type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId },
        { type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: token, projects: [] },
        Object.create({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: token }),
        { type: "workspace.listProjects", workspaceId: workspace.workspaceId, extra: true },
      ]) assert.equal((input.type === "workspace.listProjects" ? service.handleQuery(input) : service.handleCommand(input)).error.code, "invalid_input");
      assert.equal(applyDiscovery(service, sibling.workspaceId, token).error.code, "stale_preview");
      assert.equal(applyDiscovery(service, workspace.workspaceId, randomUUID()).error.code, "stale_preview");
      for (const mutate of [
        () => { mkdirSync(join(root, "Added")); },
        () => { rmSync(join(root, "Added"), { recursive: true }); },
        () => { fs.renameSync(join(root, "Project"), join(directory, "old")); mkdirSync(join(root, "Project")); },
        () => { rmSync(join(root, "Project"), { recursive: true }); symlinkSync(join(directory, "old"), join(root, "Project"), process.platform === "win32" ? "junction" : "dir"); },
        () => { const sql = new Database(databasePath); sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1").run(); sql.close(); },
        () => { const sql = new Database(databasePath); sql.prepare("UPDATE sources SET archive_relative_path = 'Project'").run(); sql.close(); },
      ]) {
        const preview = discoveryPreview(service, workspace.workspaceId).value;
        mutate();
        const before = records(databasePath);
        assert.equal(applyDiscovery(service, workspace.workspaceId, preview.previewToken).error.code, "stale_preview");
        assert.deepEqual(records(databasePath), before);
        assert.deepEqual(projectRecords(databasePath), []);
      }
      assert.deepEqual(records(databasePath).views, baseline.views);
      const current = discoveryPreview(service, sibling.workspaceId).value;
      service.workspaces.remove({ type: "workspace.remove", workspaceId: sibling.workspaceId });
      assert.equal(applyDiscovery(service, sibling.workspaceId, current.previewToken).error.code, "invalid_input");
      const expired = discoveryPreview(service, workspace.workspaceId).value.previewToken;
      service.close();
      const reopened = openSettingsService(databasePath);
      try { assert.equal(applyDiscovery(reopened, workspace.workspaceId, expired).error.code, "stale_preview"); }
      finally { reopened.close(); }
    } finally { service.close(); }
  });
});

test("apply rolls back configuration/project failures and emits no committed discovery event", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const service = openSettingsService(databasePath);
    const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
    const sql = new Database(databasePath);
    const events = [];
    service.workspaces.subscribe((event) => events.push(event));
    try {
      for (const table of ["sources", "projects"]) {
        const preview = discoveryPreview(service, workspace.workspaceId, table === "projects" ? ["Project"] : []).value;
        const before = records(databasePath);
        const beforeProjects = projectRecords(databasePath);
        sql.exec(`CREATE TRIGGER fail_write BEFORE ${table === "sources" ? "UPDATE" : "INSERT"} ON ${table} BEGIN SELECT RAISE(ABORT, 'injected'); END`);
        assert.equal(applyDiscovery(service, workspace.workspaceId, preview.previewToken).error.code, "storage");
        assert.deepEqual(records(databasePath), before);
        assert.deepEqual(projectRecords(databasePath), beforeProjects);
        assert.deepEqual(events, []);
        sql.exec("DROP TRIGGER fail_write");
        assert.equal(applyDiscovery(service, workspace.workspaceId, preview.previewToken).ok, true);
        events.length = 0;
        // Next iteration must insert a new folder.
        mkdirSync(join(root, `Next-${table}`));
      }
    } finally { sql.close(); service.close(); }
  });
});

test("replacement/copy cannot inherit an enrolled binding; missing and removed-workspace metadata stays retained", () => {
  withFixture(({ directory, root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    writeFileSync(join(root, "Project", "keep"), "sentinel");
    let service = openSettingsService(databasePath);
    const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
    try {
      const original = applyDiscovery(service, workspace.workspaceId).value.projects[0];
      fs.renameSync(join(root, "Project"), join(directory, "original"));
      fs.cpSync(join(directory, "original"), join(root, "Project"), { recursive: true });
      const replacement = applyDiscovery(service, workspace.workspaceId).value;
      assert.deepEqual(replacement.projects,[]);assert.equal(replacement.retainedCount,1);
      assert.equal(projectRecords(databasePath).find(p=>p.id===original.projectId).association_state,"unresolved");
      fs.renameSync(join(root, "Project"), join(directory, "missing"));
      assert.equal(applyDiscovery(service, workspace.workspaceId).value.retainedCount, 1);
      fs.renameSync(join(directory, "missing"), join(root, "Project"));
      const unresolved = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(unresolved.entries[0].reason, "unresolved");
      assert.deepEqual(applyDiscovery(service, workspace.workspaceId, unresolved.previewToken).value.projects, []);
      assert.equal(projectRecords(databasePath).find((p) => p.id === original.projectId).association_state, "unresolved");
      const savedProjects = projectRecords(databasePath);
      service.workspaces.remove({ type: "workspace.remove", workspaceId: workspace.workspaceId });
      assert.deepEqual(projectRecords(databasePath), savedProjects);
      service.close(); service = openSettingsService(databasePath);
      const recreated = service.handleCommand({ type: "workspace.create", name: "Again", rootPath: root }).value;
      assert.equal(recreated.sourceId, workspace.sourceId);
      assert.notEqual(recreated.viewId, workspace.viewId);
      assert.equal(listProjects(service, recreated.workspaceId).value.retainedCount, 1);
      assert.equal(discoveryPreview(service, recreated.workspaceId).value.entries[0].reason, "unresolved");
      assert.equal(readFileSync(join(root, "Project", "keep"), "utf8"), "sentinel");
    } finally { service.close(); }
  });
});

test("insufficient/reused native evidence remains unresolved rather than transferring metadata", () => {
  for (const evidence of ["insufficient", "reused", "reused-with-new-birth", "new-insufficient"]) {
    withFixture(({ root, databasePath }) => {
      mkdirSync(join(root, "One"));
      const service = openSettingsService(databasePath);
      const originalLstat = fs.lstatSync;
      try {
        const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
        const first = applyDiscovery(service, workspace.workspaceId).value.projects[0];
        const identity = JSON.parse(projectRecords(databasePath)[0].native_identity);
        if (evidence !== "insufficient") mkdirSync(join(root, "Two"));
        fs.lstatSync = (path, options) => {
          const stat = originalLstat(path, options);
          if (path === join(workspace.canonicalRoot, evidence === "insufficient" ? "One" : "Two") && options?.bigint) {
            if (evidence.endsWith("insufficient")) stat.birthtimeNs = 0n;
            else {
              stat.dev = BigInt(identity.dev); stat.ino = BigInt(identity.ino);
              stat.birthtimeNs = BigInt(identity.birthtimeNs) + (evidence === "reused-with-new-birth" ? 1n : 0n);
            }
          }
          return stat;
        };
        syncBuiltinESMExports();
        const preview = discoveryPreview(service, workspace.workspaceId).value;
        if(preview.previewToken===null){
          assert.equal(preview.state,"identity_unverified");
          assert.equal(applyDiscovery(service,workspace.workspaceId,randomUUID()).ok,false);
          assert.equal(projectRecords(databasePath).length,1);
          assert.equal(projectRecords(databasePath)[0].id,first.projectId);
          return;
        }
        assert.equal(preview.entries.find((e) => e.name === (evidence === "insufficient" ? "One" : "Two")).reason, "unresolved");
        const applied = applyDiscovery(service, workspace.workspaceId, preview.previewToken).value;
        if (evidence === "insufficient" || evidence.startsWith("reused")) {
          assert.deepEqual(applied.projects, []);
          assert.equal(applied.retainedCount, 1);
        } else assert.equal(applied.projects[0].projectId, first.projectId);
        assert.equal(projectRecords(databasePath).length, 1);
      } finally { fs.lstatSync = originalLstat; syncBuiltinESMExports(); service.close(); }
    });
  }
});

test("unavailable/unreadable/replaced roots keep saved projects and reject unsafe Apply", () => {
  withFixture(({ directory, root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const service = openSettingsService(databasePath);
    const originalOpen = fs.opendirSync;
    try {
      const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const applied = applyDiscovery(service, workspace.workspaceId).value;
      const before = records(databasePath);
      const saved = projectRecords(databasePath);
      const token = discoveryPreview(service, workspace.workspaceId).value.previewToken;
      fs.opendirSync = () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); };
      syncBuiltinESMExports();
      assert.equal(listProjects(service, workspace.workspaceId).value.state, "unreadable");
      assert.equal(applyDiscovery(service, workspace.workspaceId, token).error.code, "stale_preview");
      fs.opendirSync = originalOpen; syncBuiltinESMExports();
      fs.renameSync(root, join(directory, "disconnected"));
      assert.equal(listProjects(service, workspace.workspaceId).value.state, "unavailable");
      assert.deepEqual(listProjects(service,workspace.workspaceId).value.projects,[]);
      assert.equal(projectMetadataRecords(listProjects(service,workspace.workspaceId))[0].projectId,applied.projects[0].projectId);
      assert.equal(projectMetadataRecords(listProjects(service,workspace.workspaceId))[0].resolution,"unresolved");
      mkdirSync(root); mkdirSync(join(root, "Project"));
      const conflict = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(conflict.state, "root_identity_conflict");
      assert.equal(conflict.previewToken, null);
      assert.equal(listProjects(service, workspace.workspaceId).value.state, "root_identity_conflict");
      assert.deepEqual(records(databasePath), before);
      assert.deepEqual(projectRecords(databasePath), saved);
    } finally { fs.opendirSync = originalOpen; syncBuiltinESMExports(); service.close(); }
  });
});

test("filesystem changes during apply persistence roll back configuration and projects", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const service = openSettingsService(databasePath);
    const originalOpen = fs.opendirSync;
    try {
      const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const preview = discoveryPreview(service, workspace.workspaceId).value;
      const before = records(databasePath);
      let opens = 0;
      fs.opendirSync = (path, ...args) => {
        if (++opens === 3) mkdirSync(join(root, "Late"));
        return originalOpen(path, ...args);
      };
      syncBuiltinESMExports();
      assert.equal(applyDiscovery(service, workspace.workspaceId, preview.previewToken).error.code, "stale_preview");
      assert.deepEqual(records(databasePath), before);
      assert.deepEqual(projectRecords(databasePath), []);
    } finally { fs.opendirSync = originalOpen; syncBuiltinESMExports(); service.close(); }
  });
});

test("populated discovery configuration upgrades to projects, applies and reopens without changing workspace/view identities", () => {
  withFixture(({ directory, root, databasePath }) => {
    const legacy = join(directory, "discovery-migrations");
    mkdirSync(join(legacy, "meta"), { recursive: true });
    const migrations = "src/service/db/migrations";
    const journal = JSON.parse(readFileSync(join(migrations, "meta", "_journal.json"), "utf8"));
    journal.entries = journal.entries.slice(0, 4);
    for (const entry of journal.entries) writeFileSync(join(legacy, `${entry.tag}.sql`), readFileSync(join(migrations, `${entry.tag}.sql`)));
    writeFileSync(join(legacy, "meta", "_journal.json"), JSON.stringify(journal));
    mkdirSync(join(root, "Kept")); mkdirSync(join(root, "Excluded"));
    mkdirSync(join(directory, "data"));
    const sqlite = new Database(databasePath);
    migrate(drizzle(sqlite), { migrationsFolder: legacy });
    const workspace = { sourceId: randomUUID(), workspaceId: randomUUID(), viewId: randomUUID() };
    sqlite.prepare("INSERT INTO settings VALUES ('language', 'ru')").run();
    sqlite.prepare("INSERT INTO sources (id, canonical_root) VALUES (?, ?)").run(workspace.sourceId, realpathSync.native(root));
    sqlite.prepare("INSERT INTO workspaces (id, name, source_id, position) VALUES (?, 'Original', ?, 0)").run(workspace.workspaceId, workspace.sourceId);
    sqlite.prepare("INSERT INTO views (id, workspace_id, name, kind) VALUES (?, ?, 'Table', 'table')").run(workspace.viewId, workspace.workspaceId);
    sqlite.prepare("INSERT INTO active_workspace VALUES ('active', ?, ?)").run(workspace.workspaceId, workspace.viewId);
    sqlite.prepare("UPDATE sources SET excluded_relative_paths = '[\"Excluded\"]', archive_relative_path = 'Archive', discovery_revision = 7").run();
    sqlite.close();
    const before = records(databasePath);
    let service = openSettingsService(databasePath);
    let projects;
    try {
      assert.deepEqual(records(databasePath), { ...before, sources: withIdentityMigrationDefaults("sources",before.sources).map((row) => ({ ...row, property_revision: 0, category_property_revision: 0 })), views: before.views.map(row => ({ ...row, position: 0, filter_config: '{"search":"","rules":[]}', grouping_config: '{"propertyId":null,"settings":[]}', board_config: '{"widths":[],"properties":[],"wrap":true}', table_config: '{"columns":[],"rowOrder":[]}' })) });
      assert.deepEqual(projectRecords(databasePath), []);
      assert.equal(discoveryPreview(service,workspace.workspaceId).value.state,"association_review_required");
      bindFixtureFolders(service,workspace.workspaceId,[]);
      projects=applyDiscovery(service,workspace.workspaceId).value;
      assert.deepEqual(projects.projects.map(p=>p.name),["Kept"]);
      assert.equal(projects.revision,9);
    } finally { service.close(); }
    service = openSettingsService(databasePath);
    try {
      assert.deepEqual(listProjects(service, workspace.workspaceId).value, projects);
      assert.equal(service.workspaces.load().value.activeWorkspace.viewId, workspace.viewId);
      assert.equal(service.handleQuery({ type: "settings.load" }).value.language, "ru");
      assert.deepEqual(records(databasePath).workspaces, before.workspaces);
      assert.deepEqual(records(databasePath).views, before.views.map(row => ({ ...row, position: 0, filter_config: '{"search":"","rules":[]}', grouping_config: '{"propertyId":null,"settings":[]}', board_config: '{"widths":[],"properties":[],"wrap":true}', table_config: '{"columns":[],"rowOrder":[]}' })));
    } finally { service.close(); }
  });
});

test("persisted archive casing follows actual filesystem identity without guessing on case-sensitive roots", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Storage", "Archive"), { recursive: true });
    const service = openSettingsService(databasePath);
    const originalLstat = fs.lstatSync;
    try {
      const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const sql = new Database(databasePath);
      sql.prepare("UPDATE sources SET archive_relative_path = 'storage/Archive'").run(); sql.close();
      const caseInsensitive = fs.existsSync(join(root, "storage"));
      assert.equal(discoveryPreview(service, workspace.workspaceId).value.entries[0].reason, caseInsensitive ? "archive" : null);
      // Exercise the real service scanner's alias-evidence branch on either platform.
      fs.lstatSync = (path, ...args) => originalLstat(path === join(workspace.canonicalRoot, "storage")
        ? join(workspace.canonicalRoot, "Storage") : path, ...args);
      syncBuiltinESMExports();
      const preview = discoveryPreview(service, workspace.workspaceId).value;
      assert.equal(preview.entries[0].reason, "archive");
      assert.deepEqual(applyDiscovery(service, workspace.workspaceId, preview.previewToken).value.projects, []);
    } finally { fs.lstatSync = originalLstat; syncBuiltinESMExports(); service.close(); }
  });
});

test("apply excludes designated archive/service/link/manual folders without reading contents or modifying any root bytes", () => {
  withFixture(({ directory, root, databasePath }) => {
    for (const name of ["Project", "Manual", "Archive", "Storage", ".service", "$RECYCLE.BIN"])
      mkdirSync(join(root, name));
    const external = join(directory, "external"); mkdirSync(external);
    symlinkSync(external, join(root, "Link"), process.platform === "win32" ? "junction" : "dir");
    for (const folder of [root, external, ...["Project", "Manual", "Archive", "Storage", ".service", "$RECYCLE.BIN"].map((name) => join(root, name))])
      writeFileSync(join(folder, "keep"), `bytes-${folder}`);
    const originalOpen = fs.opendirSync;
    const originalRealpath = fs.realpathSync.native;
    const service = openSettingsService(databasePath);
    try {
      const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const sql = new Database(databasePath); sql.prepare("UPDATE sources SET archive_relative_path = 'Storage/nested'").run(); sql.close();
      fs.opendirSync = (path, ...args) => { assert.equal(path, workspace.canonicalRoot); return originalOpen(path, ...args); };
      fs.realpathSync.native = (path, ...args) => { assert.notEqual(path, external); assert.notEqual(path, join(root, "Link")); return originalRealpath(path, ...args); };
      syncBuiltinESMExports();
      const preview = discoveryPreview(service, workspace.workspaceId, ["Manual"]).value;
      assert.deepEqual(applyDiscovery(service, workspace.workspaceId, preview.previewToken).value.projects.map((p) => p.name), ["Archive", "Project"]);
      for (const folder of [root, external, ...["Project", "Manual", "Archive", "Storage", ".service", "$RECYCLE.BIN"].map((name) => join(root, name))]) {
        assert.equal(readFileSync(join(folder, "keep"), "utf8"), `bytes-${folder}`);
        if (folder !== root) assert.deepEqual(fs.readdirSync(folder), ["keep"]);
      }
      assert.deepEqual(fs.readdirSync(root).sort(), ["$RECYCLE.BIN", ".service", "Archive", "Link", "Manual", "Project", "Storage", "keep"]);
    } finally { fs.opendirSync = originalOpen; fs.realpathSync.native = originalRealpath; syncBuiltinESMExports(); service.close(); }
  });
});

test("new previews revoke previous tokens, failed removal preserves its token, and other sources cannot apply it", () => {
  withFixture(({ directory, root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const otherRoot = join(directory, "other"); mkdirSync(otherRoot);
    const service = openSettingsService(databasePath);
    const sql = new Database(databasePath);
    try {
      const one = service.handleCommand({ type: "workspace.create", name: "One", rootPath: root }).value;
      const other = service.handleCommand({ type: "workspace.create", name: "Other", rootPath: otherRoot }).value;
      const first = discoveryPreview(service, one.workspaceId).value;
      const second = discoveryPreview(service, one.workspaceId).value;
      assert.equal(applyDiscovery(service, other.workspaceId, second.previewToken).error.code, "stale_preview");
      assert.equal(listProjects(service, other.workspaceId).value.configured, false);
      assert.equal(applyDiscovery(service, one.workspaceId, first.previewToken).error.code, "stale_preview");
      const current = discoveryPreview(service, one.workspaceId).value;
      sql.exec("CREATE TRIGGER fail_remove BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT, 'injected'); END");
      assert.equal(service.handleCommand({ type: "workspace.remove", workspaceId: one.workspaceId }).error.code, "storage");
      sql.exec("DROP TRIGGER fail_remove");
      assert.equal(applyDiscovery(service, one.workspaceId, current.previewToken).ok, true);
      assert.deepEqual(listProjects(service, other.workspaceId).value.projects, []);
    } finally { sql.close(); service.close(); }
  });
});

test("Apply rejects a replaced or link-retargeted root even before its first committed discovery", () => {
  for (const retarget of ["directory", "link"]) withFixture(({ directory, root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const service = openSettingsService(databasePath);
    try {
      const workspace = service.handleCommand({ type: "workspace.create", name: "Test", rootPath: root }).value;
      const preview = discoveryPreview(service, workspace.workspaceId).value;
      const before = records(databasePath);
      fs.renameSync(root, join(directory, "previous"));
      if (retarget === "directory") { mkdirSync(root); mkdirSync(join(root, "Project")); }
      else symlinkSync(join(directory, "previous"), root, process.platform === "win32" ? "junction" : "dir");
      assert.equal(applyDiscovery(service, workspace.workspaceId, preview.previewToken).error.code, "stale_preview");
      assert.deepEqual(records(databasePath), before);
      assert.deepEqual(projectRecords(databasePath), []);
    } finally { service.close(); }
  });
});

test("changed durable creation evidence cannot transfer metadata or silently enroll a same-path replacement",()=>{
 withFixture(({root,databasePath})=>{
  mkdirSync(join(root,'Project'));let changed=false;
  const reader=(path,scope)=>{const current=observeFolder(path,scope);return changed&&path===join(realpathSync.native(root),'Project')&&current.ok?{...current,evidence:{...current.evidence,created:String(BigInt(current.evidence.created)+1n)}}:current;};
  const service=openSettingsService(databasePath,undefined,undefined,undefined,undefined,undefined,reader);
  try{
   const workspace=service.handleCommand({type:'workspace.create',name:'Test',rootPath:root}).value;
   const original=applyDiscovery(service,workspace.workspaceId).value.projects[0];
   changed=true;
   const replacement=applyDiscovery(service,workspace.workspaceId).value;
   assert.deepEqual(replacement.projects,[]);assert.equal(replacement.retainedProjects[0].projectId,original.projectId);
   assert.equal(replacement.retainedProjects[0].identityReason,'folder_changed');
   assert.equal(projectRecords(databasePath).length,1);
   assert.equal(applyDiscovery(service,workspace.workspaceId).value.retainedProjects[0].projectId,original.projectId);
  }finally{service.close();}
 });
});

test("committed projects fan out to actual source references, invalidate sibling previews, suppress unchanged applies and retain metadata", () => {
  withFixture(({ directory, root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    const otherRoot = join(directory, "other"); mkdirSync(otherRoot);
    const service = openSettingsService(databasePath);
    const create = (name, rootPath) => service.handleCommand({ type: "workspace.create", name, rootPath }).value;
    const one = create("One", root), two = create("Two", root), other = create("Other", otherRoot);
    const events = [], secondClient = [];
    const off = service.workspaces.subscribe((event) => events.push(event));
    service.workspaces.subscribe((event) => secondClient.push(event));
    try {
      const siblingPreview = discoveryPreview(service, two.workspaceId).value;
      const unrelatedPreview = discoveryPreview(service, other.workspaceId).value;
      const applied = applyDiscovery(service, one.workspaceId).value;
      assert.deepEqual(events, [{ type: "workspace.projectsChanged", sourceId: one.sourceId,
        workspaceIds: [one.workspaceId, two.workspaceId], revision: applied.revision },
        { type: "workspace.sourceObserved", sourceId: one.sourceId, workspaceIds: [one.workspaceId, two.workspaceId],
          observationRevision: 1, state: "ready", automaticUpdates: "active" }]);
      assert.deepEqual(secondClient, events);
      assert.equal(applyDiscovery(service, two.workspaceId, siblingPreview.previewToken).error.code, "stale_preview");
      assert.deepEqual(listProjects(service, two.workspaceId).value.projects, applied.projects);
      assert.notEqual(one.viewId, two.viewId);
      const unchangedSibling = discoveryPreview(service, two.workspaceId).value;
      assert.equal(applyDiscovery(service, one.workspaceId).value.revision, applied.revision);
      assert.equal(applyDiscovery(service, two.workspaceId, unchangedSibling.previewToken).value.revision, applied.revision);
      assert.equal(events.length, 2);
      off();
      assert.equal(applyDiscovery(service, other.workspaceId, unrelatedPreview.previewToken).ok, true);
      assert.equal(events.length, 2);
      assert.equal(secondClient.at(-1).sourceId, other.sourceId);
      const remove = (id) => service.handleCommand({ type: "workspace.remove", workspaceId: id });
      remove(one.workspaceId); remove(two.workspaceId);
      const saved = projectRecords(databasePath);
      const reused = create("Reused", root);
      assert.equal(reused.sourceId, one.sourceId);
      assert.notEqual(reused.viewId, two.viewId);
      assert.deepEqual(listProjects(service, reused.workspaceId).value.projects, applied.projects);
      assert.deepEqual(projectRecords(databasePath), saved);
      applyDiscovery(service, reused.workspaceId, discoveryPreview(service, reused.workspaceId, ["Project"]).value.previewToken);
      assert.deepEqual(secondClient.at(-1), { type: "workspace.projectsChanged", sourceId: one.sourceId,
        workspaceIds: [reused.workspaceId], revision: applied.revision + 1 });
    } finally { service.close(); }
  });
});

test("configured source Refresh preserves command validation and blocks reconciliation during an access outage", () => {
  withFixture(({ root, databasePath }) => {
    mkdirSync(join(root, "Project"));
    let unavailable = false;
    const filesystem = {
      realpath: realpathSync.native,
      isDirectory: (path) => statSync(path).isDirectory(),
      assertAccessible: () => { if (unavailable) throw new Error("Source unavailable"); },
    };
    const service = openSettingsService(databasePath, undefined, filesystem), sqlite = new Database(databasePath);
    try {
      const workspace = service.workspaces.create({ type: "workspace.create", name: "Configured", rootPath: root }).value;
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId }).value;
      const project = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).value.projects[0];
      fs.renameSync(join(root, "Project"), join(root, "Renamed"));
      const before = sqlite.prepare("SELECT * FROM projects").all(), events = [];
      service.workspaces.subscribe((event) => events.push(event));
      const input = { type: "workspace.refreshSource", workspaceId: workspace.workspaceId };
      for (const invalid of [{ ...input, extra: true }, { ...input, workspaceId: randomUUID() }, { ...input, workspaceId: "bad" }, { type: input.type }]) {
        assert.equal(service.handleCommand(invalid).error.code, "invalid_input");
      }
      assert.deepEqual(events, []); assert.deepEqual(sqlite.prepare("SELECT * FROM projects").all(), before);
      unavailable = true;
      assert.equal(service.handleCommand(input).value.sourceAvailable, false);
      assert.deepEqual(sqlite.prepare("SELECT * FROM projects").all(), before);
      assert.deepEqual(events.map((event) => event.type), ["workspace.sourceChanged", "workspace.sourceObserved"]);
      unavailable = false; events.length = 0;
      assert.equal(service.handleCommand(input).value.sourceAvailable, true);
      assert.deepEqual(events.map((event) => event.type), ["workspace.projectsChanged", "workspace.sourceChanged", "workspace.sourceObserved"]);
      assert.equal(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: workspace.workspaceId }).value.projects[0].projectId, project.projectId);
      assert.equal(sqlite.prepare("SELECT relative_path FROM projects").get().relative_path, "Renamed");
    } finally { sqlite.close(); service.close(); }
  });
});

test("source settings lists one shared source without changing active workspace", () => {
  withFixture(({ root, databasePath }) => {
    const service = openSettingsService(databasePath);
    try {
      const first = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const second = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
      const before = service.workspaces.load().value.activeWorkspace;
      const result = service.handleQuery({ type: "workspace.listSources" });
      assert.equal(result.ok, true);
      assert.equal(result.value.sources.length, 1);
      assert.deepEqual(result.value.sources[0], {
        sourceId: first.sourceId, canonicalRoot: realpathSync.native(root), sourceAvailable: true,
        mode: null, excludedRelativePaths: [], archiveRelativePath: null,
        workspaces: [{ workspaceId: first.workspaceId, name: "One" }, { workspaceId: second.workspaceId, name: "Two" }],
      });
      assert.deepEqual(service.workspaces.load().value.activeWorkspace, before);
    } finally { service.close(); }
  });
});

test("source settings retains orphan configuration and reports unavailable roots without losing metadata", () => {
  withFixture(({ root, directory, databasePath }) => {
    mkdirSync(join(root, "Keep")); mkdirSync(join(root, "Excluded"));
    let service = openSettingsService(databasePath);
    try {
      const created = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
      const review = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: created.workspaceId, mode: "direct", excludedRelativePaths: ["Excluded"] });
      assert.equal(review.ok, true);
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: created.workspaceId, previewToken: review.value.previewToken }).ok, true);
      const before = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: created.workspaceId }).value;
      assert.equal(service.workspaces.remove({ type: "workspace.remove", workspaceId: created.workspaceId }).ok, true);
      const orphan = service.handleQuery({ type: "workspace.listSources" }).value.sources[0];
      assert.deepEqual(orphan.workspaces, []); assert.equal(orphan.mode, "direct"); assert.deepEqual(orphan.excludedRelativePaths, ["Excluded"]);
      fs.renameSync(root, join(directory, "temporarily-away"));
      assert.equal(service.handleQuery({ type: "workspace.listSources" }).value.sources[0].sourceAvailable, false);
      assert.equal(service.handleQuery({ type: "workspace.listSources", workspaceId: created.workspaceId }).ok, false);
      fs.renameSync(join(directory, "temporarily-away"), root);
      service.close(); service = openSettingsService(databasePath);
      const reopened = service.workspaces.create({ type: "workspace.create", name: "Restored", rootPath: root }).value;
      assert.equal(reopened.sourceId, created.sourceId);
      assert.deepEqual(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: reopened.workspaceId }).value.projects, before.projects);
    } finally { service.close(); }
  });
});
