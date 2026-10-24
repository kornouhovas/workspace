import { createRequire } from "node:module";
import { dirname, join, toNamespacedPath } from "node:path";
import { fileURLToPath } from "node:url";
import { lstatSync, realpathSync } from "node:fs";

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
const reasons = new Set<EvidenceFailure>(["unsupported", "missing_attributes", "permission_denied", "disconnected", "changed"]);
const directory = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const requireNative = createRequire(join(directory, "folder-evidence.cjs"));
let native: { observeFolder(path: string): unknown } | undefined;

export function validateEvidence(value: unknown): value is FolderEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "created,fileId,provider,scope,serial,version,volume" || v.version !== 1 ||
    typeof v.scope !== "string" || !v.scope || typeof v.volume !== "string" || typeof v.serial !== "string" ||
    typeof v.fileId !== "string" || typeof v.created !== "string" || !/^[1-9][0-9]*$/.test(v.created)) return false;
  return v.provider === "apfs" ? /^[a-f0-9]{32}$/.test(v.volume) && /[1-9a-f]/.test(v.volume) &&
    v.serial === "" && /^[1-9][0-9]*$/.test(v.fileId) : v.provider === "ntfs" &&
    /^\\\\\?\\Volume\{[a-f0-9-]{36}\}\\$/i.test(v.volume) && /^[1-9][0-9]*$/.test(v.serial) &&
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
export function observeFolder(path: string, scope: string): FolderObservation {
  try {
    const before = lstatSync(path, { bigint: true });
    if (!before.isDirectory() || realpathSync.native(path) !== path) return {ok: false, reason: "changed"};
    if (before.ino <= 0n || before.birthtimeNs <= 0n) return {ok:false,reason:"missing_attributes"};
    if (process.platform !== "darwin" && process.platform !== "win32") return {ok: false, reason: "unsupported"};
    if (!native) {
      // Source imports are used by host tests; emitted modules use the same fixed artifact provenance.
      const root = directory.endsWith(`${process.platform === "win32" ? "\\" : "/"}src${process.platform === "win32" ? "\\" : "/"}service`)
        ? join(directory, "../../dist/service") : directory;
      try { native = requireNative(join(root, process.versions.electron ? "native/project-rename.node" : "../service-test-native/project-rename.node")); }
      catch { return {ok: false, reason: "unsupported"}; }
    }
    // Node fs uses long-path namespacing internally; raw Win32 calls do not.
    // Keep the canonical locator for validation/storage and qualify only this
    // private syscall operand, including long Unicode descendants.
    const raw = native!.observeFolder(process.platform === "win32" ? toNamespacedPath(path) : path);
    if (typeof raw === "string") return {ok: false, reason: reasons.has(raw as EvidenceFailure) ? raw as EvidenceFailure : "missing_attributes"};
    const evidence = { ...(raw as object), version: 1, scope, provider: process.platform === "darwin" ? "apfs" : "ntfs" };
    if (!validateEvidence(evidence)) return {ok: false, reason: "missing_attributes"};
    const after = lstatSync(path, {bigint: true});
    if (!after.isDirectory() || before.dev !== after.dev || before.ino !== after.ino || before.birthtimeNs !== after.birthtimeNs ||
      realpathSync.native(path) !== path) return {ok: false, reason: "changed"};
    return {ok: true, evidence, mount: {dev: after.dev.toString(), ino: after.ino.toString(), birthtimeNs: after.birthtimeNs.toString()}};
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {ok: false, reason: code === "ENOENT" || code === "ENOTDIR" ? "disconnected" : code === "EACCES" || code === "EPERM" ? "permission_denied" : "missing_attributes"};
  }
}
