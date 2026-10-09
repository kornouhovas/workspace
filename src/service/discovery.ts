import { lstatSync, opendirSync, realpathSync, type BigIntStats } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
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
export interface DiscoverySnapshot {
  root: DirectoryObservation;
  children: DirectoryObservation[];
}
export interface DirectScan {
  state: DiscoveryPreview["state"];
  entries: DiscoveryEntry[];
  snapshot: DiscoverySnapshot | null;
}

export function isChildName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." &&
    !value.includes("/") && !value.includes("\\") && !value.includes("\0") && !isAbsolute(value) &&
    !/^[a-z]:/i.test(value);
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

function scanOnce(canonicalRoot: string, archiveRelativePath: string | null): DiscoverySnapshot {
  const root = observation("", lstatSync(canonicalRoot, { bigint: true }));
  // Do not open a retargeted root or a link, including a link in an ancestor.
  if (root.kind !== "directory" || realpathSync.native(canonicalRoot) !== canonicalRoot) throw new RootConflict();
  const children: DirectoryObservation[] = [];
  const directory = opendirSync(canonicalRoot);
  try {
    let entry;
    while ((entry = directory.readSync()) !== null) {
      if (!isChildName(entry.name)) throw new ScanChanged();
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
  // Archive is validated even when currently absent; it is never followed or read.
  if (!validArchive(archiveRelativePath)) throw new RootConflict();
  return { root, children: children.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0) };
}

export function scanDirectSource(canonicalRoot: string, archiveRelativePath: string | null, exclusions: string[]): DirectScan {
  try {
    const snapshot = scanOnce(canonicalRoot, archiveRelativePath);
    // Recheck the complete interpretation, including kind swaps and disappearing entries.
    if (JSON.stringify(snapshot) !== JSON.stringify(scanOnce(canonicalRoot, archiveRelativePath))) throw new ScanChanged();
    const archiveChild = archiveRelativePath?.split("/")[0];
    const entries: DiscoveryEntry[] = snapshot.children.filter((child) => child.kind !== "other").map((child) => {
      const name = child.relativePath;
      const reason = child.kind === "link" ? "link"
        : name.startsWith(".") ? "hidden"
        : ["$recycle.bin", "system volume information"].includes(name.toLowerCase()) ? "service"
        : name === archiveChild ? "archive"
        : exclusions.includes(name) ? "manual" : null;
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
