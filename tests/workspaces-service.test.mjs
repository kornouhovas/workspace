import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
    assert.equal(created.value.canonicalRoot, realpathSync(root));
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

test("rejects malformed requests, blank names, files and inaccessible roots without records", () => {
  withFixture(({ root, directory, databasePath }) => {
    const file = join(directory, "not-a-directory");
    writeFileSync(file, "fixture");
    const deniedFilesystem = {
      realpath(path) { if (path === "denied") throw new Error("permission denied"); return path; },
      isDirectory(path) { return statSync(path).isDirectory(); },
    };
    const service = openSettingsService(databasePath, undefined, deniedFilesystem);
    assert.equal(service.workspaces.create(null).error.code, "invalid_input");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: " \t ", rootPath: root }).error.code, "invalid_input");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: "File", rootPath: file }).error.code, "filesystem");
    assert.equal(service.workspaces.create({ type: "workspace.create", name: "Denied", rootPath: "denied" }).error.code, "filesystem");
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
    symlinkSync(outside, join(root, "escape"), "dir");
    const service = openSettingsService(databasePath);
    assert.equal(service.workspaces.assertContained(root, join(root, "inside")), true);
    assert.equal(service.workspaces.assertContained(root, outsideFile), false);
    assert.equal(service.workspaces.assertContained(root, join(root, "..", "selected-sibling", "secret.txt")), false);
    assert.equal(service.workspaces.assertContained(root, join(root, "escape", "secret.txt")), false);
    service.close();
  });
});
