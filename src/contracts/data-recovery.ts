/** Bound both renderer file reads and backend allocation. Includes base64 overhead. */
export const maxExportBytes = 64 * 1024 * 1024;
export type BackupStatus = {
  state: "ready" | "failed";
  destination: string;
  snapshots: { id: string; createdAt: number; kind: "automatic" | "pre-migration" }[];
};
export function parseBackupId(value: unknown): { kind: "automatic" | "pre-migration"; createdAt: number } | undefined {
  if (typeof value !== "string") return;
  const match = /^(automatic|pre-migration)-([0-9]{13})-[0-9a-f-]{36}\.json$/.exec(value);
  if (match) return { kind: match[1] as "automatic" | "pre-migration", createdAt: Number(match[2]) };
}
export type DataRecoveryRequest = { type: "data.backups" } | { type: "data.backupNow" } |
  { type: "data.backupExport"; backupId: string } | { type: "data.export" } | { type: "data.restore"; content: string };
export type DataRecoveryPayload = { backups: BackupStatus } | { content: string } | { restored: true };
export function isDataRecoveryRequest(value: unknown): value is DataRecoveryRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;
  return ["data.export", "data.backups", "data.backupNow"].includes(v.type) ? Object.keys(v).length === 1 :
    v.type === "data.backupExport" ? Object.keys(v).length === 2 && parseBackupId(v.backupId) !== undefined :
    v.type === "data.restore" && Object.keys(v).length === 2 && typeof v.content === "string" && v.content.length <= maxExportBytes;
}
