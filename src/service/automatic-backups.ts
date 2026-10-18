import { verifyBackupSnapshot } from "./data-recovery.js";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isDataRecoveryRequest, maxExportBytes, parseBackupId, type BackupStatus, type DataRecoveryPayload } from "../contracts/data-recovery.js";
import type { ServiceResult } from "../contracts/settings.js";
import { encodeSnapshot, openSnapshot } from "./snapshot.js";
const interval = 24 * 60 * 60 * 1000;

function read(directory: string, id: string): string {
  if (!parseBackupId(id)) throw new Error("Invalid backup ID");
  const path = join(directory, id), info = lstatSync(path);
  if (!info.isFile() || info.size > maxExportBytes) throw new Error("Invalid backup file");
  const content = readFileSync(path, "utf8");
  const snapshot = openSnapshot(content);
  try { verifyBackupSnapshot(snapshot, snapshot); } finally { snapshot.close(); }
  return content;
}
function ensureDirectory(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!lstatSync(directory).isDirectory()) throw new Error("Backup directory is not a local directory");
}
function list(directory: string, onInvalid: () => void = () => undefined): BackupStatus["snapshots"] {
  ensureDirectory(directory);
  return readdirSync(directory).flatMap(id => {
    const parsed = parseBackupId(id);
    if (!parsed) return [];
    try { read(directory, id); } catch { onInvalid(); return []; }
    return [{ id, ...parsed }];
  }).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}

/** Publish only a flushed, read-back verified image. Retention follows publication. */
export function saveBackup(sqlite: Database.Database, directory: string, kind: "automatic" | "pre-migration", now = Date.now()): string {
  ensureDirectory(directory);
  const id = `${kind}-${now}-${randomUUID()}.json`, temporary = join(directory, `${id}.partial`);
  const content = encodeSnapshot(sqlite);
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try { writeFileSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
    const copied = readFileSync(temporary, "utf8");
    if (copied !== content) throw new Error("Backup read-back mismatch");
    const verified = openSnapshot(copied);
    try { verifyBackupSnapshot(sqlite, verified); } finally { verified.close(); }
    renameSync(temporary, join(directory, id));
    // Windows does not support opening directories for fsync through Node.
    if (process.platform !== "win32") {
      const fd = openSync(directory, "r");
      try { fsyncSync(fd); } finally { closeSync(fd); }
    }
    return id;
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* Keep the original backup failure; partial files are never recovery points. */ }
    throw error;
  }
}

export function createAutomaticBackups(sqlite: Database.Database, databasePath: string) {
  const destination = join(dirname(databasePath), "backups");
  let failed = false;
  function status(): BackupStatus {
    try {
      let invalid = false;
      const snapshots = list(destination, () => { invalid = true; });
      return { state: failed || invalid ? "failed" : "ready", destination, snapshots };
    }
    catch { return { state: "failed", destination, snapshots: [] }; }
  }
  function run(force: boolean) {
    try {
      const previous = list(destination).find(item => item.kind === "automatic");
      if (!force && previous && Date.now() - previous.createdAt < interval) return;
      saveBackup(sqlite, destination, "automatic");
      const automatic = list(destination).filter(item => item.kind === "automatic");
      for (const item of automatic.slice(7)) unlinkSync(join(destination, item.id));
      failed = false;
    } catch { failed = true; }
  }
  run(false);
  const timer = setInterval(() => run(false), interval); timer.unref();
  return {
    close() { clearInterval(timer); },
    request(input: unknown): ServiceResult<DataRecoveryPayload> {
      if (!isDataRecoveryRequest(input)) return { ok: false, error: { code: "invalid_input", message: "Invalid backup request." } };
      if (input.type === "data.backupNow") run(true);
      if (input.type === "data.backups" || input.type === "data.backupNow") return { ok: true, value: { backups: status() } };
      if (input.type === "data.backupExport") {
        try { ensureDirectory(destination); return { ok: true, value: { content: read(destination, input.backupId) } }; }
        catch { return { ok: false, error: { code: "storage", message: "Backup could not be read. Keep the original file and check the backup directory." } }; }
      }
      return { ok: false, error: { code: "invalid_input", message: "Invalid backup request." } };
    },
  };
}
