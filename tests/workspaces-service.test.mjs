import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

function withFixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "workspace-create-"));
  const root = join(directory, "selected");
  mkdirSync(root);
  const databasePath = join(directory, "data", "workspace.sqlite");
  try { run({ directory, root, databasePath }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

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
        assert.deepEqual(records(databasePath).sources, [{ id: saved.value.sourceId, canonical_root: canonicalRoot }]);
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
