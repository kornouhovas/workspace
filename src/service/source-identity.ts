import { join } from "node:path";
import { observeFolder, sameDurableFolder, validateEvidence, type FolderEvidence, type FolderObservation } from "./folder-evidence.js";
import { sameIdentity, type DiscoveryScan } from "./discovery.js";
import type { DiscoveryPreview } from "../contracts/workspaces.js";

export type EvidenceReader = (path: string, scope: string) => FolderObservation;
export type IdentityState = import("../contracts/source-association.js").FolderIdentityReason;
export interface IdentitySource { canonicalRoot: string; durableEvidence: string | null; appliedRootIdentity: string | null }
export function storedEvidence(value: string | null): FolderEvidence | null {
  if (value === null) return null;
  try { const parsed: unknown = JSON.parse(value); return validateEvidence(parsed) ? parsed : null; }
  catch { return null; }
}
export function identityState(saved: string | null, observed: FolderObservation, scope: string): IdentityState {
  if (!observed.ok) return observed.reason === "changed" ? "unsafe" : "evidence_unavailable";
  const old = storedEvidence(saved);
  if (!old) return saved === null ? "review_required" : "evidence_unavailable";
  if (old.provider !== observed.evidence.provider || old.volume !== observed.evidence.volume || old.serial !== observed.evidence.serial) return "different_volume";
  if (!sameDurableFolder(old, observed.evidence, false)) return "folder_changed";
  return old.scope === scope ? "verified" : "scope_unverified";
}
export function sourceIdentity(source: IdentitySource, scan: DiscoveryScan, scope: string, reader: EvidenceReader = observeFolder): {
  state: IdentityState; observation: FolderObservation; scan: DiscoveryScan;
} {
  const observation = reader(source.canonicalRoot, scope);
  const state = identityState(source.durableEvidence, observation, scope);
  if (!scan.snapshot || !observation.ok) return {state, observation, scan};
  if (!sameIdentity(scan.snapshot.root.identity, observation.mount)) return {state: "unsafe", observation, scan: {...scan, state: "changed", snapshot: null, entries: []}};
  return {state, observation, scan};
}
export function discoveryIdentityState(state: IdentityState): DiscoveryPreview["state"] {
  return state === "verified" ? "ready" : state === "review_required" || state === "scope_unverified" ? "association_review_required"
    : state === "different_volume" ? "different_volume" : state === "folder_changed" ? "root_identity_conflict"
    : state === "unsafe" ? "changed" : "identity_unverified";
}

/** Transient discovery projection only. Never rewrite legacy triples or use this as an effect permit. */
export function continuityRecords<T extends {relativePath: string; durableEvidence: string | null; nativeIdentity: string}>(
  source: IdentitySource, scan: DiscoveryScan, rows: T[], scope: string, reader: EvidenceReader = observeFolder,
): T[] {
  const root = storedEvidence(source.durableEvidence);
  const eligiblePaths = new Set(scan.entries.filter(entry => entry.reason === null).map(entry => entry.relativePath));
  const candidates = new Map<string, { evidence: FolderEvidence; mount: import("./discovery.js").NativeIdentity }[]>();
  const key = (evidence: FolderEvidence) => JSON.stringify([evidence.provider,evidence.scope,evidence.volume,evidence.serial,evidence.fileId,evidence.created]);
  for (const child of scan.snapshot?.children ?? []) {
    if (child.kind !== "directory" || !eligiblePaths.has(child.relativePath)) continue;
    const observed = reader(join(source.canonicalRoot, child.relativePath), scope);
    if (!root || !observed.ok || observed.evidence.volume !== root.volume || observed.evidence.serial !== root.serial ||
      !sameIdentity(child.identity, observed.mount)) continue;
    const bucket = candidates.get(key(observed.evidence)) ?? [];
    bucket.push(observed); candidates.set(key(observed.evidence), bucket);
  }
  return rows.map(row => {
    const old = storedEvidence(row.durableEvidence);
    const matches = old && old.scope === scope ? candidates.get(key(old)) ?? [] : [];
    return {...row,nativeIdentity:matches.length === 1 ? JSON.stringify(matches[0].mount) : JSON.stringify({dev:"0",ino:"0",birthtimeNs:"0"})};
  });
}

/** Explain a current occupant without granting authority or changing the saved association. */
export function associationReason(source: IdentitySource, scan: DiscoveryScan, row: {relativePath:string;durableEvidence:string|null},
  scope: string, reader: EvidenceReader = observeFolder): IdentityState | null {
  const child = scan.snapshot?.children.find(c => c.relativePath === row.relativePath);
  if (child?.kind !== "directory" || !scan.entries.some(e => e.relativePath === row.relativePath && e.reason === null)) return null;
  const observed = reader(join(source.canonicalRoot,row.relativePath),scope);
  if (observed.ok && !sameIdentity(child.identity,observed.mount)) return "unsafe";
  return identityState(row.durableEvidence,observed,scope);
}
