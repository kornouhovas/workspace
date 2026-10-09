import { lstatSync, opendirSync, realpathSync, type BigIntStats } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import type { DiscoveryEntry, DiscoveryPreview } from "../contracts/workspaces.js";

// Native evidence is lossless and local to this machine. It is never a logical ID.
export interface NativeIdentity {
  dev: string;
  ino: string;
  birthtimeNs: string;
}
export interface DirectoryObservation {
  relativePath: string;
  kind: "directory" | "link" | "other";
  identity: NativeIdentity;
  mtimeNs: string;
  ctimeNs: string;
}
interface ExcludedObservation {
  relativePath: string;
  kind: "excluded";
  reason: "link" | "hidden" | "service" | "archive";
}
export interface DiscoverySnapshot {
  root: DirectoryObservation;
  children: (DirectoryObservation | ExcludedObservation)[];
  archiveChild: string | null;
}
export interface DirectScan {
  state: DiscoveryPreview["state"];
  entries: DiscoveryEntry[];
  snapshot: DiscoverySnapshot | null;
}

export function isChildName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." &&
    !value.includes("\0") && !isAbsolute(value) && basename(value) === value;
}
export function validExclusions(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isChildName) && new Set(value).size === value.length;
}
export function validArchive(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.split("/").every(isChildName));
}

function observation(relativePath: string, stat: BigIntStats): DirectoryObservation {
  return {
    relativePath, kind: stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : "other",
    identity: { dev: stat.dev.toString(), ino: stat.ino.toString(), birthtimeNs: stat.birthtimeNs.toString() },
    mtimeNs: stat.mtimeNs.toString(), ctimeNs: stat.ctimeNs.toString(),
  };
}
function changed(before: DirectoryObservation, after: DirectoryObservation): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}
class ScanChanged extends Error {}
class RootConflict extends Error {}

function automaticDirectoryReason(name: string, archiveChild: string | null): ExcludedObservation["reason"] | null {
  return name.startsWith(".") ? "hidden"
    : ["$recycle.bin", "system volume information"].includes(name.toLowerCase()) ? "service"
    : name === archiveChild ? "archive" : null;
}

function scanOnce(canonicalRoot: string, archiveRelativePath: string | null): DiscoverySnapshot {
  const root = observation("", lstatSync(canonicalRoot, { bigint: true }));
  // Do not open a retargeted root or a link, including a link in an ancestor.
  if (root.kind !== "directory" || realpathSync.native(canonicalRoot) !== canonicalRoot) throw new RootConflict();
  if (!validArchive(archiveRelativePath)) throw new RootConflict();
  let archiveChild: string | null = archiveRelativePath?.split("/")[0] ?? null;
  const children: DiscoverySnapshot["children"] = [];
  const directory = opendirSync(canonicalRoot);
  try {
    let entry;
    while ((entry = directory.readSync()) !== null) {
      // Ordinary files have no discovery interpretation, including platform-valid nonportable names.
      if (entry.isFile()) continue;
      if (!isChildName(entry.name)) throw new ScanChanged();
      const reason = entry.isSymbolicLink() ? "link"
        : entry.isDirectory() ? automaticDirectoryReason(entry.name, archiveChild) : null;
      if (reason) {
        // The root's directory entry is sufficient to exclude these locations. Do not access their metadata.
        children.push({ relativePath: entry.name, kind: "excluded", reason });
        continue;
      }
      const path = join(canonicalRoot, entry.name);
      const child = observation(entry.name, lstatSync(path, { bigint: true }));
      // Links/junctions are never resolved, opened or enumerated. Project contents are never read.
      if (child.kind === "directory") {
        const resolved = realpathSync.native(path);
        if (relative(canonicalRoot, resolved) !== entry.name || resolved !== path) throw new ScanChanged();
        if (changed(child, observation(entry.name, lstatSync(path, { bigint: true })))) throw new ScanChanged();
      }
      children.push(child);
    }
  } finally { directory.closeSync(); }
  if (realpathSync.native(canonicalRoot) !== canonicalRoot ||
    changed(root, observation("", lstatSync(canonicalRoot, { bigint: true })))) throw new ScanChanged();
  // Resolve non-exact archive casing only with verified identity evidence, never by guessing names.
  if (archiveChild && !automaticDirectoryReason(archiveChild, null) &&
    !children.some((child) => child.relativePath === archiveChild)) {
    try {
      // Resolve casing using only the designated immediate child's own evidence. Do not open it.
      const archive = observation(archiveChild, lstatSync(join(canonicalRoot, archiveChild), { bigint: true }));
      if (archive.kind === "directory") {
        archiveChild = children.find((child) => child.kind === "directory" &&
          sameIdentity(child.identity, archive.identity))?.relativePath ?? archiveChild;
      }
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return { root, archiveChild, children: children.map((child) => child.kind === "directory" && child.relativePath === archiveChild
    ? { relativePath: child.relativePath, kind: "excluded" as const, reason: "archive" as const } : child)
    .sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0) };
}

export function scanDirectSource(canonicalRoot: string, archiveRelativePath: string | null, exclusions: string[]): DirectScan {
  try {
    const snapshot = scanOnce(canonicalRoot, archiveRelativePath);
    // Recheck the complete interpretation, including kind swaps and disappearing entries.
    if (JSON.stringify(snapshot) !== JSON.stringify(scanOnce(canonicalRoot, archiveRelativePath))) throw new ScanChanged();
    const archiveChild = snapshot.archiveChild;
    const entries: DiscoveryEntry[] = snapshot.children.filter((child) => child.kind !== "other").map((child) => {
      const name = child.relativePath;
      const reason = child.kind === "excluded" ? child.reason : child.kind === "link" ? "link"
        : automaticDirectoryReason(name, archiveChild) ?? (exclusions.includes(name) ? "manual" : null);
      return { name, relativePath: name, reason };
    });
    return { state: entries.some((entry) => entry.reason === null) ? "ready" : "empty", entries, snapshot };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const state = error instanceof RootConflict ? "root_identity_conflict" : error instanceof ScanChanged ? "changed"
      : code === "ENOENT" || code === "ENOTDIR" ? "unavailable" : "unreadable";
    return { state, entries: [], snapshot: null };
  }
}

export interface ProjectAssociation {
  id: string;
  sourceId: string;
  relativePath: string;
  nativeIdentity: string;
  associationState: "active" | "excluded" | "missing" | "unresolved" | "replaced";
}
export function reliableIdentity(value: NativeIdentity): boolean {
  return /^\d+$/.test(value.dev) && /^\d+$/.test(value.ino) && BigInt(value.ino) > 0n &&
    /^\d+$/.test(value.birthtimeNs) && BigInt(value.birthtimeNs) > 0n;
}
export function sameIdentity(a: NativeIdentity, b: NativeIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.birthtimeNs === b.birthtimeNs;
}
function storedIdentity(row: ProjectAssociation): NativeIdentity {
  const value = JSON.parse(row.nativeIdentity) as NativeIdentity;
  if (!value || typeof value.dev !== "string" || typeof value.ino !== "string" || typeof value.birthtimeNs !== "string") {
    throw new Error("Invalid stored native identity");
  }
  return value;
}

// Matching is deliberately path-local. Missing/ambiguous records never automatically reattach.
// Retired records remain evidence of native identifier reuse; no user metadata is deleted.
export function interpretProjects(scan: DirectScan, records: ProjectAssociation[]): {
  entries: DiscoveryEntry[];
  retained: ProjectAssociation[];
  additions: { relativePath: string; nativeIdentity: string }[];
} {
  if (!scan.snapshot) throw new Error("Cannot interpret an incomplete scan");
  const retained = records.map((row) => ({ ...row }));
  const entries = scan.entries.map((entry) => ({ ...entry }));
  const additions: { relativePath: string; nativeIdentity: string }[] = [];
  const identities = records.map((row) => storedIdentity(row));
  for (const row of retained.filter((row) => row.associationState !== "replaced")) {
    const child = scan.snapshot.children.find((child) => child.relativePath === row.relativePath);
    if (child?.kind === "excluded" && child.reason !== "link") {
      // Exclusion retains existing evidence without claiming a new association or reattaching missing metadata.
      if (row.associationState === "active" || row.associationState === "excluded") row.associationState = "excluded";
      continue;
    }
    if (!child || child.kind !== "directory") {
      if (row.associationState !== "unresolved") row.associationState = "missing";
    }
  }
  for (const child of scan.snapshot.children.filter((child): child is DirectoryObservation => child.kind === "directory")) {
    const entry = entries.find((entry) => entry.relativePath === child.relativePath)!;
    const current = retained.find((row) => row.relativePath === child.relativePath && row.associationState !== "replaced");
    const reliable = reliableIdentity(child.identity);
    const collision = records.some((row, index) => row.id !== current?.id &&
      identities[index].dev === child.identity.dev && identities[index].ino === child.identity.ino &&
      (row.relativePath !== child.relativePath || sameIdentity(identities[index], child.identity))) ||
      scan.snapshot.children.some((other) => other.relativePath !== child.relativePath && other.kind === "directory" &&
        other.identity.dev === child.identity.dev && other.identity.ino === child.identity.ino);
    let unresolved = !reliable || collision;
    if (current) {
      const previous = storedIdentity(current);
      if (reliable && reliableIdentity(previous) && !sameIdentity(previous, child.identity)) {
        current.associationState = "replaced";
      } else if (unresolved || !reliableIdentity(previous) ||
        (current.associationState !== "active" && current.associationState !== "excluded")) {
        current.associationState = "unresolved";
        unresolved = true;
      } else {
        current.associationState = entry.reason === null ? "active" : "excluded";
        continue;
      }
    }
    if (unresolved) {
      if (entry.reason === null) entry.reason = "unresolved";
    } else if (entry.reason === null) {
      additions.push({ relativePath: child.relativePath, nativeIdentity: JSON.stringify(child.identity) });
    }
  }
  return { entries, retained, additions };
}
