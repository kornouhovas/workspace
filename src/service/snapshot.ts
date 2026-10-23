import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { maxExportBytes } from "../contracts/data-recovery.js";
const digest = (image: Buffer) => createHash("sha256").update(image).digest("hex");

export function encodeSnapshot(sqlite: Database.Database): string {
  const image = sqlite.serialize();
  const content = JSON.stringify({ format: "workspace-application-data", version: 1, localAuthority: "installation anchor excluded; restore never replaces local authority", checksum: digest(image), database: image.toString("base64") });
  if (Buffer.byteLength(content) > maxExportBytes) throw new Error("Snapshot exceeds size limit");
  return content;
}

/** Open a private readonly image; never execute SQL supplied by the envelope. */
export function openSnapshot(content: string): Database.Database {
  if (Buffer.byteLength(content) > maxExportBytes) throw new Error("Snapshot exceeds size limit");
  const envelope = JSON.parse(content);
  if (!envelope || Array.isArray(envelope) || !["checksum,database,format,version", "checksum,database,format,localAuthority,version"].includes(Object.keys(envelope).sort().join()) ||
    (Object.hasOwn(envelope, "localAuthority") && envelope.localAuthority !== "installation anchor excluded; restore never replaces local authority") ||
    envelope.format !== "workspace-application-data" || envelope.version !== 1 || typeof envelope.database !== "string") throw new Error("Invalid format");
  const image = Buffer.from(envelope.database, "base64");
  if (image.toString("base64") !== envelope.database || digest(image) !== envelope.checksum) throw new Error("Invalid checksum");
  if (image.length < 100 || image.subarray(0, 16).toString("binary") !== "SQLite format 3\0" ||
    ![1, 2].includes(image[18]) || ![1, 2].includes(image[19])) throw new Error("Invalid SQLite header");
  // Serialized WAL pages are already included; an in-memory image has no sidecars.
  image[18] = 1; image[19] = 1;
  const db = new Database(image, { readonly: true });
  try {
    db.pragma("query_only = ON");
    if (db.pragma("integrity_check", { simple: true }) !== "ok" || (db.pragma("foreign_key_check") as unknown[]).length) throw new Error("Invalid SQLite data");
    return db;
  } catch (error) { db.close(); throw error; }
}
