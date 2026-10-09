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
  discovery_mode: null, discovery_revision: 0, excluded_relative_paths: "[]",
  archive_relative_path: null, applied_root_identity: null,
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
      sqlite.prepare("INSERT INTO views VALUES (?, ?, ?, ?)").run(viewIds[index], id, `Independent ${index}`, "table");
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
          workspaces: before.workspaces.map((row, position) => ({ ...row, position })) });
        const preview = discoveryPreview(service, ids[1]);
        assert.equal(preview.ok, true);
        assert.equal(preview.value.state, "empty");
        assert.equal(preview.value.revision, 0);
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
        ...[null, "Project", ["Project", "Project"], ["invented"], ["../escape"], ["/absolute"], ["a\\b"], [".hidden"]]
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
