import { validateSnapshotRelations } from "./data-recovery-invariants.js";
import { validExclusions, validArchive } from "./discovery.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { isDataRecoveryRequest, maxExportBytes, type DataRecoveryPayload } from "../contracts/data-recovery.js";
import type { ServiceResult } from "../contracts/settings.js";
import { isBoardLayoutConfig } from "../contracts/board-layout.js";
import { isTableLayoutConfig } from "../contracts/table-layout.js";
import { isViewGroupingConfig } from "../contracts/view-grouping.js";
import { isViewFilterConfig } from "../contracts/view-filters.js";

type SchemaEntry = { type: string; name: string; sql: string };
const format = "workspace-application-data";
const digest = (image: Buffer) => createHash("sha256").update(image).digest("hex");
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
function schema(db: Database.Database): SchemaEntry[] {
  return db.prepare("SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type, name").all() as SchemaEntry[];
}
function validate(db: Database.Database) {
  if (db.pragma("integrity_check", { simple: true }) !== "ok" || (db.pragma("foreign_key_check") as unknown[]).length) throw new Error("Invalid SQLite data");
  validateSnapshotRelations(db);
  const language = db.prepare("SELECT value FROM settings WHERE key = 'language'").get() as { value: string } | undefined;
  if (!language || !["en", "ru"].includes(language.value)) throw new Error("Invalid language");
  for (const view of db.prepare("SELECT kind, board_config, table_config, grouping_config, filter_config FROM views").all() as Record<string, string>[]) {
    if (!["table", "board"].includes(view.kind) || !isBoardLayoutConfig(JSON.parse(view.board_config)) ||
      !isTableLayoutConfig(JSON.parse(view.table_config)) || !isViewGroupingConfig(JSON.parse(view.grouping_config)) ||
      !isViewFilterConfig(JSON.parse(view.filter_config))) throw new Error("Invalid view");
  }
  for (const source of db.prepare("SELECT discovery_mode, excluded_relative_paths, archive_relative_path FROM sources").all() as Record<string, unknown>[]) {
    if (source.discovery_mode !== null && !["direct", "grouped"].includes(String(source.discovery_mode)) ||
      !validExclusions(JSON.parse(String(source.excluded_relative_paths)), "grouped") || !validArchive(source.archive_relative_path)) throw new Error("Invalid source configuration");
  }
  for (const table of schema(db).filter(entry => entry.type === "table")) {
    const columns = db.prepare(`PRAGMA table_info(${quote(table.name)})`).all() as { name: string }[];
    for (const column of columns.filter(c => c.name.endsWith("_identity"))) {
      for (const row of db.prepare(`SELECT ${quote(column.name)} AS value FROM ${quote(table.name)} WHERE ${quote(column.name)} IS NOT NULL`).all() as { value: string }[]) {
        const identity = JSON.parse(row.value);
        if (!identity || typeof identity.dev !== "string" || typeof identity.ino !== "string" || typeof identity.birthtimeNs !== "string") throw new Error("Invalid filesystem identity");
      }
    }
  }
  // These ownership constraints predate their SQL equivalents.
  if (db.prepare(`SELECT 1 FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM views v WHERE v.workspace_id=w.id)
    UNION ALL SELECT 1 FROM workspace_view_selection s JOIN views v ON v.id=s.view_id WHERE s.workspace_id!=v.workspace_id
    UNION ALL SELECT 1 FROM active_workspace a JOIN views v ON v.id=a.view_id WHERE a.workspace_id!=v.workspace_id LIMIT 1`).get()) throw new Error("Invalid view ownership");
}

/** No SQL from an export is executed. Rebuild only the current trusted schema. */
export function dataRecovery(sqlite: Database.Database, input: unknown): ServiceResult<DataRecoveryPayload> {
  if (!isDataRecoveryRequest(input)) return { ok: false, error: { code: "invalid_input", message: "Invalid application-data request." } };
  if (input.type === "data.export") {
    try {
      const image = sqlite.serialize();
      const content = JSON.stringify({ format, version: 1, checksum: digest(image), database: image.toString("base64") });
      if (Buffer.byteLength(content) > maxExportBytes) throw new Error("Export exceeds size limit");
      return { ok: true, value: { content } };
    } catch { return { ok: false, error: { code: "storage", message: "Application data could not be exported." } }; }
  }
  let candidate: Database.Database | undefined;
  let currentSchema: SchemaEntry[];
  try {
    if (Buffer.byteLength(input.content) > maxExportBytes) throw new Error("Export exceeds size limit");
    const envelope = JSON.parse(input.content);
    if (!envelope || Array.isArray(envelope) || Object.keys(envelope).sort().join() !== "checksum,database,format,version" ||
      envelope.format !== format || envelope.version !== 1 || typeof envelope.database !== "string" ) throw new Error("Invalid format");
    const image = Buffer.from(envelope.database, "base64");
    if (image.toString("base64") !== envelope.database || digest(image) !== envelope.checksum) throw new Error("Invalid checksum");
    if (image.length < 100 || image.subarray(0, 16).toString("binary") !== "SQLite format 3\0" ||
      ![1, 2].includes(image[18]) || ![1, 2].includes(image[19])) throw new Error("Invalid SQLite header");
    // sqlite3_serialize includes committed WAL pages, but preserves WAL header
    // flags. A deserialized in-memory database cannot open sidecars. Mark this
    // private copy as a self-contained rollback-journal image before opening it.
    image[18] = 1; image[19] = 1;
    candidate = new Database(image, { readonly: true });
    candidate.pragma("query_only = ON");
    currentSchema = schema(sqlite);
    if (JSON.stringify(schema(candidate)) !== JSON.stringify(currentSchema) ||
      JSON.stringify(candidate.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all()) !==
      JSON.stringify(sqlite.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all())) throw new Error("Unsupported schema");
    validate(candidate);
  } catch {
    candidate?.close();
    return { ok: false, error: { code: "invalid_input", message: "The export is invalid or uses an unsupported format or schema." } };
  }
  try {
    const source = candidate;
    // DDL and data are journaled together. Immutable-history triggers must not
    // interpret importing a completed receipt as a new filesystem operation.
    sqlite.pragma("foreign_keys = OFF");
    sqlite.transaction(() => {
      for (const entry of currentSchema.filter(e => e.type === "trigger")) sqlite.exec(`DROP TRIGGER ${quote(entry.name)}`);
      const tables = currentSchema.filter(e => e.type === "table");
      for (const table of tables) sqlite.exec(`DELETE FROM ${quote(table.name)}`);
      for (const table of tables) {
        const columns = (sqlite.prepare(`PRAGMA table_info(${quote(table.name)})`).all() as { name: string }[]).map(c => quote(c.name));
        const select = source.prepare(`SELECT ${columns.join()} FROM ${quote(table.name)}`).raw();
        const insert = sqlite.prepare(`INSERT INTO ${quote(table.name)} (${columns.join()}) VALUES (${columns.map(() => "?").join()})`);
        for (const row of select.iterate()) insert.run(...row as unknown[]);
      }
      for (const entry of currentSchema.filter(e => e.type === "trigger")) sqlite.exec(entry.sql);
      validate(sqlite);
    }).immediate();
    return { ok: true, value: { restored: true } };
  } catch { return { ok: false, error: { code: "storage", message: "Restore failed. Current application data was preserved." } }; }
  finally { sqlite.pragma("foreign_keys = ON"); candidate.close(); }
}
