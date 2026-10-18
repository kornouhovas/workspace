/** Bound both renderer file reads and backend allocation. Includes base64 overhead. */
export const maxExportBytes = 64 * 1024 * 1024;
export type DataRecoveryRequest = { type: "data.export" } | { type: "data.restore"; content: string };
export type DataRecoveryPayload = { content: string } | { restored: true };
export function isDataRecoveryRequest(value: unknown): value is DataRecoveryRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.type === "data.export" ? Object.keys(v).length === 1 :
    v.type === "data.restore" && Object.keys(v).length === 2 && typeof v.content === "string" && v.content.length <= maxExportBytes;
}
