import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "workspace-settings-"));
  const databasePath = join(directory, "data", "settings.sqlite");
  try {
    run(databasePath, directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("fresh database migrates and starts with English", () => {
  withDatabase((databasePath) => {
    const service = openSettingsService(databasePath);
    assert.deepEqual(service.handleQuery({ type: "settings.load" }), {
      ok: true,
      value: { language: "en" },
    });
    service.close();

    const sqlite = new Database(databasePath);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get().count, 23);
    sqlite.close();
  });
});

test("Russian preference survives service close and reopen", () => {
  withDatabase((databasePath) => {
    const first = openSettingsService(databasePath);
    assert.deepEqual(first.handleCommand({ type: "settings.setLanguage", language: "ru" }), {
      ok: true,
      value: { language: "ru" },
    });
    first.close();

    const second = openSettingsService(databasePath);
    assert.deepEqual(second.handleQuery({ type: "settings.load" }), {
      ok: true,
      value: { language: "ru" },
    });
    second.close();
  });
});

test("existing settings database upgrades to workspaces without losing its language", () => {
  withDatabase((databasePath, directory) => {
    const migrationSource = join(process.cwd(), "src", "service", "db", "migrations");
    const oldMigrations = join(directory, "old-migrations");
    mkdirSync(join(oldMigrations, "meta"), { recursive: true });
    copyFileSync(join(migrationSource, "0000_settings.sql"), join(oldMigrations, "0000_settings.sql"));
    const journal = JSON.parse(readFileSync(join(migrationSource, "meta", "_journal.json"), "utf8"));
    writeFileSync(join(oldMigrations, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }));

    const previous = openSettingsService(databasePath, oldMigrations);
    assert.equal(previous.handleCommand({ type: "settings.setLanguage", language: "ru" }).ok, true);
    previous.close();

    const root = join(directory, "selected-root");
    mkdirSync(root);
    const upgraded = openSettingsService(databasePath);
    assert.deepEqual(upgraded.handleQuery({ type: "settings.load" }), {
      ok: true, value: { language: "ru" },
    });
    const created = upgraded.handleCommand({ type: "workspace.create", name: "Upgraded", rootPath: root });
    assert.equal(created.ok, true);
    upgraded.close();

    const sqlite = new Database(databasePath);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get().count, 23);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM workspaces").get().count, 1);
    sqlite.close();
  });
});

test("malformed queries and unsupported languages return normalized validation errors", () => {
  withDatabase((databasePath) => {
    const service = openSettingsService(databasePath);
    assert.deepEqual(service.handleQuery(null), {
      ok: false,
      error: { code: "invalid_input", message: "Expected a settings.load query." },
    });
    assert.deepEqual(service.handleCommand({ type: "settings.setLanguage", language: "fr" }), {
      ok: false,
      error: { code: "invalid_input", message: "Expected a supported language: en or ru." },
    });
    assert.deepEqual(service.handleCommand({ type: "unexpected" }), {
      ok: false,
      error: { code: "invalid_input", message: "Expected a supported language: en or ru." },
    });
    service.close();
  });
});

test("read and write failures return storage errors without claiming a save", () => {
  withDatabase((databasePath) => {
    const service = openSettingsService(databasePath);
    const sqlite = new Database(databasePath);
    sqlite.exec(`CREATE TRIGGER reject_language_update BEFORE UPDATE ON settings
      BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;`);
    const failedSave = service.handleCommand({ type: "settings.setLanguage", language: "ru" });
    assert.deepEqual(failedSave, {
      ok: false,
      error: { code: "storage", message: "Settings could not be read or saved." },
    });
    assert.notEqual(failedSave.ok && failedSave.value.language === "ru", true);

    sqlite.exec("DROP TABLE settings");
    assert.deepEqual(service.handleQuery({ type: "settings.load" }), {
      ok: false,
      error: { code: "storage", message: "Settings could not be read or saved." },
    });
    sqlite.close();
    service.close();
  });
});

test("settings routing delegates category labels without confusing Text or settings commands", () => {
  withDatabase((databasePath, directory) => {
    const root = join(directory, "root"); mkdirSync(join(root, "Category"), { recursive: true });
    const service = openSettingsService(databasePath);
    const workspaceId = service.handleCommand({ type: "workspace.create", name: "Grouped", rootPath: root }).value.workspaceId;
    const review = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" }).value;
    const propertyId = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: review.previewToken }).value.categoryProperty.propertyId;
    const command = { type: "workspace.renameCategoryProperty", workspaceId, propertyId, name: "  Label  " };
    assert.equal(service.handleQuery(command).error.code, "invalid_input");
    assert.equal(service.handleCommand({ ...command, extra: true }).error.code, "invalid_input");
    assert.equal(service.handleCommand(command).value.name, "  Label  ");
    assert.deepEqual(service.handleQuery({ type: "settings.load" }).value, { language: "en" });
    assert.deepEqual(service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.definitions, []);
    service.close();
    assert.equal(service.handleCommand(command).error.code, "storage");
  });
});

test("settings dispatcher exposes rename receipts and reviewed recovery without replay", () => {
  withDatabase((databasePath, directory) => {
    const root = join(directory, "rename-root"); mkdirSync(join(root, "Original"), { recursive: true });
    let calls = 0;
    const observers = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
    const service = openSettingsService(databasePath, undefined, undefined, observers, undefined, () => {
      calls++; throw new Error("private native interruption");
    });
    try {
      const workspaceId = service.handleCommand({ type: "workspace.create", name: "Rename", rootPath: root }).value.workspaceId;
      const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
      const list = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value;
      const input = { type: "workspace.renameProject", workspaceId, projectId: list.projects[0].projectId,
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Renamed", expectedRevision: list.revision };
      const result = service.handleCommand(input);
      assert.equal(result.value.outcome, "recoverable"); assert.equal(calls, 1);
      assert.deepEqual(service.handleQuery({ type: "workspace.getProjectRename", workspaceId, operationId: input.operationId }), result);
      assert.deepEqual(service.handleQuery({ type: "workspace.listProjectRenames", workspaceId }).value.operations, [result.value.operation]);
      assert.deepEqual(service.handleCommand(input), result); assert.equal(calls, 1);
      const query = { type: "workspace.previewProjectRenameRecovery", workspaceId, operationId: input.operationId };
      const review = service.handleQuery(query).value;
      assert.deepEqual(review.actions, ["retry_original", "keep_original"]);
      const recovery = { type: "workspace.recoverProjectRename", workspaceId, operationId: input.operationId,
        previewToken: review.previewToken, action: "keep_original" };
      for (const request of [input, query, recovery, { type: "workspace.listProjectRenames", workspaceId },
        { type: "workspace.getProjectRename", workspaceId, operationId: input.operationId }]) {
        const dispatch = ["workspace.renameProject", "workspace.recoverProjectRename"].includes(request.type) ? "handleCommand" : "handleQuery";
        assert.equal(service[dispatch]({ ...request, path: "/outside" }).error.code, "invalid_input");
      }
      const kept = service.handleCommand(recovery);
      assert.equal(kept.value.problem, "kept_original"); assert.equal(calls, 1);
      assert.deepEqual(service.handleQuery({ type: "workspace.listProjectRenames", workspaceId }).value.operations, []);
      assert.deepEqual(service.handleCommand(input), kept);
    } finally { service.close(); }
  });
});
