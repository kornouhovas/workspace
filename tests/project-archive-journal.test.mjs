import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openSettingsService } from "../dist/service/settings.mjs";
const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
test("0012 upgrade preserves populated project identity, exact Text, source/workspace ownership and old receipts", () => {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "archive-upgrade-"))), currentPath = join(directory, "current.sqlite"), oldPath = join(directory, "old.sqlite");
  const root = join(directory, "root"); fs.mkdirSync(root); fs.mkdirSync(join(root, "Project"));
  let service;
  try {
    service = openSettingsService(currentPath, undefined, undefined, observer);
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const workspaceId = workspace.workspaceId;
    service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root });
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId, mode: "direct" }).value;
    const project = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects[0];
    const property = service.handleCommand({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" }).value;
    service.handleCommand({ type: "workspace.setTextValue", workspaceId, projectId: project.projectId, propertyId: property.propertyId, value: "  exact\nТекст  " });
    service.close(); service = undefined;
    const folder = join(directory, "old-migrations"); fs.mkdirSync(join(folder, "meta"), { recursive: true });
    const journal = JSON.parse(fs.readFileSync("src/service/db/migrations/meta/_journal.json", "utf8")); journal.entries = journal.entries.slice(0, 13);
    fs.writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries) fs.copyFileSync(`src/service/db/migrations/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`));
    const current = new Database(currentPath), old = new Database(oldPath);
    let snapshot;
    try {
      migrate(drizzle(old), { migrationsFolder: folder });
      const tables = old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='__drizzle_migrations' ORDER BY name").all().map(r => r.name);
      snapshot = Object.fromEntries(tables.map(table => [table, current.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
      // This migration fixture copies only existing rows, retaining exact prior
      // schema and migration history instead of mutating the new schema backwards.
      old.pragma("foreign_keys=OFF");
      for (const table of ["settings", "sources", "workspaces", "views", "active_workspace", "categories", "category_properties", "projects", "property_definitions", "text_property_values", "project_creation_operations", "project_rename_operations", "project_category_move_operations", "category_folder_operations", "category_presentation", "category_removal_operations", "category_removal_attempts"]) {
        for (const row of snapshot[table]) {
          const keys = Object.keys(row).filter(key => table !== "views" || !["position", "filter_config", "grouping_config", "table_config"].includes(key));
          old.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map(key => row[key]));
        }
      }
    } finally { current.close(); old.close(); }
    for (let i = 0; i < 2; i++) {
      service = openSettingsService(oldPath, undefined, undefined, observer);
      const read = service.handleQuery({ type: "workspace.listProjects", workspaceId });
      assert.equal(read.value.projects[0].projectId, project.projectId);
      assert.equal(service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.values[0].value, "  exact\nТекст  ");
      assert.deepEqual(service.handleQuery({ type: "workspace.listArchivedProjects", workspaceId }).value.projects, []);
      service.close(); service = undefined;
      const inspected = new Database(oldPath);
      try {
        for (const [table, rows] of Object.entries(snapshot)) assert.deepEqual(inspected.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(), rows, table);
        assert.equal(inspected.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get().count, 22);
        assert.deepEqual(inspected.pragma("foreign_key_check"), []);
      } finally { inspected.close(); }
    }
  } finally { service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
