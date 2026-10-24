import { join } from "node:path";
import { observeFolder, durableOwnershipKey, sameDurableFolder, validateEvidence, type FolderEvidence, type FolderObservation } from "./folder-evidence.js";
import { reliableIdentity, sameIdentity, type DiscoveryScan } from "./discovery.js";
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
/** Competing root evidence can veto enrollment; it never chooses/merges a source. */
export function rootOwnershipConflict(observed: FolderObservation, peers: IdentitySource[], scope:string, reader:EvidenceReader=observeFolder): boolean {
  if (!observed.ok) return false;
  const alias=durableOwnershipKey;
  for (const peer of peers) {
    const saved=storedEvidence(peer.durableEvidence);
    if(saved && alias(saved)===alias(observed.evidence))return true;
    const current=reader(peer.canonicalRoot,scope);
    if(current.ok && alias(current.evidence)===alias(observed.evidence))return true;
    if(!current.ok && peer.appliedRootIdentity) {
      try {const old=JSON.parse(peer.appliedRootIdentity);if(reliableIdentity(old)&&sameIdentity(old,observed.mount))return true;}catch{/* Unusable history cannot authorize another source. */}
    }
  }
  return false;
}
export function sourceIdentity(source: IdentitySource, scan: DiscoveryScan, scope: string, reader: EvidenceReader = observeFolder, peers:IdentitySource[]=[]): {
  state: IdentityState; observation: FolderObservation; scan: DiscoveryScan;
} {
  const observation = reader(source.canonicalRoot, scope);
  const state = rootOwnershipConflict(observation,peers,scope,reader)?"unsafe":identityState(source.durableEvidence, observation, scope);
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
  const ownershipCandidates = new Map<string, import("./discovery.js").NativeIdentity[]>();
  const ownershipKey=durableOwnershipKey;
  const key = (evidence: FolderEvidence) => JSON.stringify([evidence.provider,evidence.scope,evidence.volume,evidence.serial,evidence.fileId,evidence.created]);
  for (const child of scan.snapshot?.children ?? []) {
    if (child.kind !== "directory" || !eligiblePaths.has(child.relativePath)) continue;
    const observed = reader(join(source.canonicalRoot, child.relativePath), scope);
    if (!root || !observed.ok || observed.evidence.volume !== root.volume || observed.evidence.serial !== root.serial ||
      !sameIdentity(child.identity, observed.mount)) continue;
    const bucket = candidates.get(key(observed.evidence)) ?? [];
    bucket.push(observed); candidates.set(key(observed.evidence), bucket);
    const owners = ownershipCandidates.get(ownershipKey(observed.evidence)) ?? [];
    owners.push(observed.mount); ownershipCandidates.set(ownershipKey(observed.evidence), owners);
  }
  return rows.map(row => {
    // A legacy alias cannot establish continuity, but it must still veto a
    // competing owner after root device renumbering. Project only the old root's
    // device namespace into this scan for conflict checks; preserve stored bytes.
    const historical = JSON.parse(row.nativeIdentity) as import("./discovery.js").NativeIdentity;
    const savedRoot = source.appliedRootIdentity ? JSON.parse(source.appliedRootIdentity) as import("./discovery.js").NativeIdentity : null;
    const historicalNativeIdentity = savedRoot && scan.snapshot && historical.dev === savedRoot.dev
      ? JSON.stringify({...historical, dev:scan.snapshot.root.identity.dev}) : row.nativeIdentity;
    const old = storedEvidence(row.durableEvidence);
    const ownership = old ? ownershipCandidates.get(ownershipKey(old)) ?? [] : [];
    const ownershipNativeIdentities = ownership.map(identity=>JSON.stringify(identity));
    const matches = old && old.scope === scope ? candidates.get(key(old)) ?? [] : [];
    return {...row,originalNativeIdentity:row.nativeIdentity,historicalNativeIdentity,ownershipNativeIdentities,nativeIdentity:matches.length === 1 ? JSON.stringify(matches[0].mount) : JSON.stringify({dev:"0",ino:"0",birthtimeNs:"0"})};
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

/** Read-only evidence for a complete scan; never a filesystem execution permit. */
export function discoveryEvidence(source: IdentitySource, scan: DiscoveryScan, scope: string, reader: EvidenceReader = observeFolder) {
  const observations = new Map<string, FolderObservation>();
  const root = reader(source.canonicalRoot,scope);
  observations.set("",root);
  for(const entry of scan.entries.filter(entry=>entry.reason===null)) {
    const child=scan.snapshot?.children.find(child=>child.relativePath===entry.relativePath);
    const observed=reader(join(source.canonicalRoot,entry.relativePath),scope);
    observations.set(entry.relativePath,observed.ok && (child?.kind!=="directory" || !sameIdentity(child.identity,observed.mount))
      ? {ok:false,reason:"changed"} : observed);
  }
  // Duplicate durable IDs remain ambiguous even when native observations differ.
  const aliases = new Map<string,string[]>();
  for(const [path,observed] of observations) if(observed.ok) {
    const key=durableOwnershipKey(observed.evidence);
    const paths=aliases.get(key)??[];paths.push(path);aliases.set(key,paths);
  }
  for(const paths of aliases.values()) if(paths.length>1) for(const path of paths) observations.set(path,{ok:false,reason:"changed"});
  return observations;
}
export function sameVolumeEvidence(root: FolderObservation, child: FolderObservation): boolean {
  return root.ok && child.ok && root.evidence.provider===child.evidence.provider && root.evidence.volume===child.evidence.volume && root.evidence.serial===child.evidence.serial;
}

/** Pending durable objects reserve their physical identity beyond their recorded
 * paths. This is a discovery veto, never a filesystem execution authorization. */
export function reserveDurablePlacements(source:IdentitySource,scan:DiscoveryScan,reservations:{durableEvidence?:string|null;nativeIdentity:string|null}[],scope:string,reader:EvidenceReader):DiscoveryScan {
  const reserved=new Set(reservations.flatMap(row=>{
    if(!row.durableEvidence)return [];
    const saved=storedEvidence(row.durableEvidence);
    if(!saved)throw new Error("Invalid durable reservation");
    return [durableOwnershipKey(saved)];
  }));
  const legacy=reservations.filter(row=>!row.durableEvidence && row.nativeIdentity).map(row=>JSON.parse(row.nativeIdentity!) as import("./discovery.js").NativeIdentity);
  if((!reserved.size && !legacy.length) || !scan.snapshot)return scan;
  return {...scan,entries:scan.entries.map(entry=>{
    if(entry.reason!==null)return entry;
    const child=scan.snapshot!.children.find(child=>child.relativePath===entry.relativePath);
    if(child && child.kind!=="excluded" && legacy.some(old=>old.ino===child.identity.ino && old.birthtimeNs===child.identity.birthtimeNs))return {...entry,reason:"unresolved"};
    if(!reserved.size)return entry;
    const observed=reader(join(source.canonicalRoot,entry.relativePath),scope);
    return !observed.ok || !child || child.kind==="excluded" || !sameIdentity(child.identity,observed.mount) || reserved.has(durableOwnershipKey(observed.evidence))
      ? {...entry,reason:"unresolved"} : entry;
  })};
}

/** Historical evidence can veto ownership across mount namespaces; it cannot
 * authorize continuity or a filesystem effect. */
export function reservationOwnsFolder(reservation:{durableEvidence?:string|null;nativeIdentity:string|null},observed:FolderObservation):boolean {
  if(!observed.ok)return false;
  if(reservation.durableEvidence) {
    const saved=storedEvidence(reservation.durableEvidence);
    return !saved || durableOwnershipKey(saved)===durableOwnershipKey(observed.evidence);
  }
  if(reservation.nativeIdentity===null)return false;
  try {
    const old=JSON.parse(reservation.nativeIdentity) as import("./discovery.js").NativeIdentity;
    return !reliableIdentity(old) || old.ino===observed.mount.ino && old.birthtimeNs===observed.mount.birthtimeNs;
  }catch{return true;}
}
