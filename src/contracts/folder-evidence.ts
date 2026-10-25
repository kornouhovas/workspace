export interface FolderEvidence {
  version: 1;
  provider: "apfs" | "ntfs";
  scope: string;
  volume: string;
  serial: string;
  fileId: string;
  created: string;
}
export type EvidenceFailure = "unsupported" | "missing_attributes" | "permission_denied" | "disconnected" | "changed";
export type FolderObservation = { ok: true; evidence: FolderEvidence; mount: { dev: string; ino: string; birthtimeNs: string } }
  | { ok: false; reason: EvidenceFailure };
export function validateEvidence(value: unknown): value is FolderEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "created,fileId,provider,scope,serial,version,volume" || v.version !== 1 ||
    typeof v.scope !== "string" || !v.scope || typeof v.volume !== "string" || typeof v.serial !== "string" ||
    typeof v.fileId !== "string" || typeof v.created !== "string" || !/^[1-9][0-9]*$/.test(v.created)) return false;
  return v.provider === "apfs" ? /^[a-f0-9]{32}$/.test(v.volume) && /[1-9a-f]/.test(v.volume) &&
    v.serial === "" && /^[1-9][0-9]*$/.test(v.fileId) : v.provider === "ntfs" &&
    /^\\\\\?\\Volume\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}\\$/i.test(v.volume) &&
    /[1-9a-f]/i.test(v.volume.slice(v.volume.indexOf("{") + 1, v.volume.indexOf("}"))) && /^[1-9][0-9]*$/.test(v.serial) &&
    /^[a-f0-9]{32}$/.test(v.fileId) && /[1-9a-f]/.test(v.fileId);
}
/** Physical ownership veto key; NTFS GUID letter casing cannot name another volume. */
export function durableOwnershipKey(evidence:FolderEvidence):string {
  return JSON.stringify([evidence.provider,evidence.provider === "ntfs" ? evidence.volume.toLowerCase() : evidence.volume,evidence.serial,evidence.fileId]);
}
export function sameDurableFolder(a: FolderEvidence, b: FolderEvidence, includeScope = true): boolean {
  return validateEvidence(a) && validateEvidence(b) && a.provider === b.provider && (!includeScope || a.scope === b.scope) &&
    a.volume === b.volume && a.serial === b.serial && a.fileId === b.fileId && a.created === b.created;
}
