import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { dirname, join } from "node:path";
import { saveBackup } from "./automatic-backups.js";

export class MigrationProtectionError extends Error {
  constructor(readonly code: "BACKUP_FAILED" | "MIGRATION_FAILED", cause: unknown) {
    super(code === "BACKUP_FAILED"
      ? "Update blocked: a verified backup could not be saved. Check free space and permissions in the application-data backups directory, then restart."
      : "Update failed. Keep the pre-migration backup. Reopen with the previous application version and restore that snapshot through Application data if needed.", { cause });
  }
}

/** Existing databases must have a verified recovery point before schema writes. */
export function protectMigration(sqlite: Database.Database, databasePath: string, folder: string, apply: () => void): void {
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  const hasLedger = sqlite.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='__drizzle_migrations'").get();
  const ledger = hasLedger ? sqlite.prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at").all() as { hash: string; created_at: number }[] : [];
  // Reject forward/divergent histories instead of letting Drizzle silently skip them.
  if (ledger.some((row, i) => row.hash !== migrations[i]?.hash || row.created_at !== migrations[i]?.folderMillis)) {
    throw new MigrationProtectionError("MIGRATION_FAILED", new Error("Unsupported migration history"));
  }
  const hasData = sqlite.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get();
  if (hasData && ledger.length < migrations.length) {
    try { saveBackup(sqlite, join(dirname(databasePath), "backups"), "pre-migration"); }
    catch (error) { throw new MigrationProtectionError("BACKUP_FAILED", error); }
  }
  try { apply(); }
  catch (error) { if (!hasData) throw error; throw new MigrationProtectionError("MIGRATION_FAILED", error); }
}
