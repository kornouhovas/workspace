import { lstatSync, opendirSync, realpathSync, type BigIntStats } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import { filesystemAlias } from "./path-alias.js";
import type { DiscoveryEntry, DiscoveryMode, DiscoveryPreview, DiscoveryProjectEffects, DiscoveryExclusionReason, ProjectAssociationState } from "../contracts/workspaces.js";

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
  reason: DiscoveryExclusionReason;
}
export interface DiscoverySnapshot {
  mode: DiscoveryMode;
  root: DirectoryObservation;
  children: (DirectoryObservation | ExcludedObservation)[];
  archiveChild: string | null;
}
export interface DiscoveryScan {
  state: DiscoveryPreview["state"];
  entries: DiscoveryEntry[];
  snapshot: DiscoverySnapshot | null;
}

export function isChildName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." &&
    !value.includes("\0") && !isAbsolute(value) && basename(value) === value;
}
export function validExclusions(value: unknown, mode: DiscoveryMode = "direct", folderRoles = false): value is string[] {
  return Array.isArray(value) && Array.from(value).every((path: unknown) => typeof path === "string" &&
    path.split("/").length <= (folderRoles ? 64 : mode === "grouped" ? 2 : 1) && path.split("/").every(isChildName)) &&
    new Set(value).size === value.length;
}
export function projectExclusions(paths: string[], mode: DiscoveryMode) {
  return {
    effective: paths.filter((path) => mode === "grouped" || !path.includes("/")).sort(),
    inactive: paths.filter((path) => mode === "direct" && path.includes("/")).sort(),
  };
}
export function validArchive(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.split("/").every(isChildName));
}

export function directoryObservation(relativePath: string, stat: BigIntStats): DirectoryObservation {
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

// Windows native realpath briefly opens the descendant without sharing, which
// can block an external rename of its parent. Entry spelling comes from the
// verified directory enumeration; legacy realpath still resolves ancestor links.
// Keep source-root canonicalization native and all identity/path checks intact.
export function descendantRealpath(path: string): string {
  return process.platform === "win32" ? realpathSync(path) : realpathSync.native(path);
}

export function automaticDirectoryReason(name: string, archiveChild: string | null): ExcludedObservation["reason"] | null {
  return name.startsWith(".") ? "hidden"
    : ["$recycle.bin", "system volume information"].includes(name.toLowerCase()) ? "service"
    : name === archiveChild ? "archive" : null;
}

function scanOnce(canonicalRoot: string, archiveRelativePath: string | null, exclusions: string[], cancelled?: () => boolean): DiscoverySnapshot {
  if (cancelled?.()) throw new ScanChanged();
  const root = directoryObservation("", lstatSync(canonicalRoot, { bigint: true }));
  // Do not open a retargeted root or a link, including a link in an ancestor.
  if (root.kind !== "directory" || realpathSync.native(canonicalRoot) !== canonicalRoot) throw new RootConflict();
  if (!validArchive(archiveRelativePath)) throw new RootConflict();
  let archiveChild: string | null = archiveRelativePath?.split("/")[0] ?? null;
  const children: DiscoverySnapshot["children"] = [];
  const directory = opendirSync(canonicalRoot);
  try {
    let entry;
    while ((entry = directory.readSync()) !== null) {
      if (cancelled?.()) throw new ScanChanged();
      // Ordinary files have no discovery interpretation, including platform-valid nonportable names.
      if (entry.isFile()) continue;
      if (!isChildName(entry.name)) throw new ScanChanged();
      const reason = entry.isSymbolicLink() ? "link"
        : entry.isDirectory() ? automaticDirectoryReason(entry.name, archiveChild) ?? (exclusions.includes(entry.name) ? "manual" : null) : null;
      if (reason) {
        // The root's directory entry is sufficient to exclude these locations. Do not access their metadata.
        children.push({ relativePath: entry.name, kind: "excluded", reason });
        continue;
      }
      const path = join(canonicalRoot, entry.name);
      const child = directoryObservation(entry.name, lstatSync(path, { bigint: true }));
      // Links/junctions are never resolved, opened or enumerated. Project contents are never read.
      if (child.kind === "directory") {
        const resolved = descendantRealpath(path);
        if (relative(canonicalRoot, resolved) !== entry.name || resolved !== path) throw new ScanChanged();
        if (changed(child, directoryObservation(entry.name, lstatSync(path, { bigint: true })))) throw new ScanChanged();
      }
      children.push(child);
    }
  } finally { directory.closeSync(); }
  if (realpathSync.native(canonicalRoot) !== canonicalRoot ||
    changed(root, directoryObservation("", lstatSync(canonicalRoot, { bigint: true })))) throw new ScanChanged();
  // Resolve non-exact archive casing only with verified identity evidence, never by guessing names.
  const suppressedArchiveAlias = archiveChild && children.some((child) => child.kind === "excluded" &&
    filesystemAlias(child.relativePath) === filesystemAlias(archiveChild!));
  if (archiveChild && !suppressedArchiveAlias && !automaticDirectoryReason(archiveChild, null) &&
    !children.some((child) => child.relativePath === archiveChild)) {
    try {
      // Resolve casing using only the designated immediate child's own evidence. Do not open it.
      const archive = directoryObservation(archiveChild, lstatSync(join(canonicalRoot, archiveChild), { bigint: true }));
      if (archive.kind === "directory") {
        archiveChild = children.find((child) => child.kind === "directory" &&
          sameIdentity(child.identity, archive.identity))?.relativePath ?? archiveChild;
      }
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return { mode: "direct", root, archiveChild, children: children.map((child) => child.kind === "directory" && child.relativePath === archiveChild
    ? { relativePath: child.relativePath, kind: "excluded" as const, reason: "archive" as const } : child)
    .sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0) };
}

export function scanDirectSource(canonicalRoot: string, archiveRelativePath: string | null, exclusions: string[], cancelled?: () => boolean): DiscoveryScan {
  try {
    const snapshot = scanOnce(canonicalRoot, archiveRelativePath, exclusions, cancelled);
    // Recheck the complete interpretation, including kind swaps and disappearing entries.
    if (JSON.stringify(snapshot) !== JSON.stringify(scanOnce(canonicalRoot, archiveRelativePath, exclusions, cancelled))) throw new ScanChanged();
    const archiveChild = snapshot.archiveChild;
    const entries: DiscoveryEntry[] = snapshot.children.filter((child) => child.kind !== "other").map((child) => {
      const name = child.relativePath;
      const reason = child.kind === "excluded" ? child.reason : child.kind === "link" ? "link"
        : automaticDirectoryReason(name, archiveChild) ?? (exclusions.includes(name) ? "manual" : null);
      return { kind: "project", categoryPath: null, name, relativePath: name, reason };
    });
    return { state: entries.some((entry) => entry.reason === null) ? "ready" : "empty", entries, snapshot };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const state = error instanceof RootConflict ? "root_identity_conflict" : error instanceof ScanChanged ? "changed"
      : code === "ENOENT" || code === "ENOTDIR" ? "unavailable" : "unreadable";
    return { state, entries: [], snapshot: null };
  }
}

// Exactly two levels. Every parent is reverified before accessing children and
// after enumeration; excluded entries use only their parent's directory entries.
function scanGroupedOnce(canonicalRoot: string, archiveRelativePath: string | null, exclusions: string[], cancelled?: () => boolean): DiscoverySnapshot {
  if (cancelled?.()) throw new ScanChanged();
  const root = directoryObservation("", lstatSync(canonicalRoot, { bigint: true }));
  if (root.kind !== "directory" || realpathSync.native(canonicalRoot) !== canonicalRoot ||
    !validArchive(archiveRelativePath)) throw new RootConflict();
  const children: DiscoverySnapshot["children"] = [];
  const archive = archiveRelativePath?.split("/") ?? [];
  const verify = (parent: DirectoryObservation) => {
    if (cancelled?.()) throw new ScanChanged();
    const path = join(canonicalRoot, parent.relativePath);
    // lstat first: a swapped link must never be resolved or traversed.
    if (changed(parent, directoryObservation(parent.relativePath, lstatSync(path, { bigint: true }))) ||
      (parent.relativePath === "" ? realpathSync.native(path) : descendantRealpath(path)) !== path) throw new ScanChanged();
  };
  const readLevel = (parent: DirectoryObservation, archiveName: string | null) => {
    verify(root); verify(parent);
    const path = join(canonicalRoot, parent.relativePath);
    const directory = opendirSync(path);
    const entries = [];
    try {
      verify(root); verify(parent);
      let entry;
      while ((entry = directory.readSync()) !== null) {
        if (cancelled?.()) throw new ScanChanged();
        if (entry.isFile()) continue;
        if (!isChildName(entry.name)) throw new ScanChanged();
        entries.push(entry);
      }
    } finally { directory.closeSync(); }
    verify(root); verify(parent);
    let designated = archiveName;
    const excludedAlias = designated && entries.some((entry) =>
      filesystemAlias(entry.name) === filesystemAlias(designated!) &&
      (entry.isSymbolicLink() || automaticDirectoryReason(entry.name, null) ||
        exclusions.includes(parent.relativePath ? `${parent.relativePath}/${entry.name}` : entry.name)));
    if (designated && !excludedAlias && !entries.some((entry) => entry.name === designated) && !automaticDirectoryReason(designated, null)) {
      // Case aliases require the designated child's own evidence. No directory
      // is opened here, and symlinks cannot provide archive identity evidence.
      try {
        const target = directoryObservation(designated, lstatSync(join(path, designated), { bigint: true }));
        if (target.kind === "directory") {
          for (const entry of entries) {
            const relativePath = parent.relativePath ? `${parent.relativePath}/${entry.name}` : entry.name;
            if (!entry.isDirectory() || automaticDirectoryReason(entry.name, null) || exclusions.includes(relativePath)) continue;
            verify(root); verify(parent);
            const candidate = directoryObservation(relativePath, lstatSync(join(path, entry.name), { bigint: true }));
            if (candidate.kind === "directory" && sameIdentity(candidate.identity, target.identity)) { designated = entry.name; break; }
          }
        }
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
    return { entries, designated };
  };
  const top = readLevel(root, archive[0] ?? null);
  const visit = (entry: (typeof top.entries)[number], parent: DirectoryObservation, archiveName: string | null) => {
    const relativePath = parent.relativePath ? `${parent.relativePath}/${entry.name}` : entry.name;
    const reason = entry.isSymbolicLink() ? "link" : entry.isDirectory()
      ? automaticDirectoryReason(entry.name, archiveName) ?? (exclusions.includes(relativePath) ? "manual" : null) : null;
    if (reason) { children.push({ relativePath, kind: "excluded", reason }); return null; }
    verify(root); verify(parent);
    const path = join(canonicalRoot, relativePath);
    const child = directoryObservation(relativePath, lstatSync(path, { bigint: true }));
    if (child.kind === "directory") {
      if (descendantRealpath(path) !== path) throw new ScanChanged();
      verify(root); verify(parent); verify(child);
    }
    children.push(child);
    return child.kind === "directory" ? child : null;
  };
  for (const entry of top.entries) {
    const category = visit(entry, root, archive.length === 1 ? top.designated : null);
    if (!category) continue;
    if (!reliableIdentity(category.identity)) {
      children[children.length - 1] = { relativePath: category.relativePath, kind: "excluded", reason: "unresolved" };
      continue;
    }
    const nested = readLevel(category, category.relativePath === top.designated ? archive[1] ?? null : null);
    for (const project of nested.entries) visit(project, category, nested.designated);
    verify(root); verify(category);
  }
  verify(root);
  return { mode: "grouped", root, archiveChild: archiveRelativePath,
    children: children.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0) };
}

export function scanGroupedSource(canonicalRoot: string, archiveRelativePath: string | null, exclusions: string[], cancelled?: () => boolean): DiscoveryScan {
  try {
    const snapshot = scanGroupedOnce(canonicalRoot, archiveRelativePath, exclusions, cancelled);
    if (JSON.stringify(snapshot) !== JSON.stringify(scanGroupedOnce(canonicalRoot, archiveRelativePath, exclusions, cancelled))) throw new ScanChanged();
    const entries: DiscoveryEntry[] = snapshot.children.filter((child) => child.kind !== "other").map((child) => {
      const parts = child.relativePath.split("/");
      const reason = child.kind === "excluded" ? child.reason : child.kind === "link" ? "link" :
        !reliableIdentity(child.identity) ? "unresolved" : null;
      const base = { name: parts.at(-1)!, relativePath: child.relativePath, reason };
      return parts.length === 1 ? { ...base, kind: "category", empty: !snapshot.children.some((project) =>
        project.relativePath.startsWith(`${child.relativePath}/`) && project.kind === "directory" && reliableIdentity(project.identity)) }
        : { ...base, kind: "project", categoryPath: parts[0] };
    });
    return { state: entries.some((entry) => entry.reason === null) ? "ready" : "empty", entries, snapshot };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    return { state: error instanceof RootConflict ? "root_identity_conflict" : error instanceof ScanChanged ? "changed"
      : code === "ENOENT" || code === "ENOTDIR" ? "unavailable" : "unreadable", entries: [], snapshot: null };
  }
}

export interface ProjectAssociation {
  modeInactive?: boolean;
  id: string;
  sourceId: string;
  relativePath: string;
  nativeIdentity: string;
  /** Conflict evidence only; never authority for continuity. */
  historicalNativeIdentity?: string;
  ownershipNativeIdentities?: string[];
  associationState: ProjectAssociationState;
}
export function reliableIdentity(value: NativeIdentity): boolean {
  return /^\d+$/.test(value.dev) && /^\d+$/.test(value.ino) && BigInt(value.ino) > 0n &&
    /^\d+$/.test(value.birthtimeNs) && BigInt(value.birthtimeNs) > 0n;
}
export function sameIdentity(a: NativeIdentity, b: NativeIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.birthtimeNs === b.birthtimeNs;
}
function storedIdentity(row: ProjectAssociation, historical = false): NativeIdentity {
  const value = JSON.parse(historical ? row.historicalNativeIdentity ?? row.nativeIdentity : row.nativeIdentity) as NativeIdentity;
  if (!value || typeof value.dev !== "string" || typeof value.ino !== "string" || typeof value.birthtimeNs !== "string") {
    throw new Error("Invalid stored native identity");
  }
  return value;
}

// Matching is deliberately path-local. Missing/ambiguous records never automatically reattach.
// Retired records remain evidence of native identifier reuse; no user metadata is deleted.
export function interpretProjects(scan: DiscoveryScan, records: ProjectAssociation[], reservations: ProjectAssociation[] = []): {
  entries: DiscoveryEntry[];
  retained: ProjectAssociation[];
  additions: { relativePath: string; nativeIdentity: string }[];
} {
  if (!scan.snapshot) throw new Error("Cannot interpret an incomplete scan");
  const retained = records.map((row) => ({ ...row }));
  const entries = scan.entries.map((entry) => ({ ...entry }));
  const additions: { relativePath: string; nativeIdentity: string }[] = [];
  const identities = records.map((row) => storedIdentity(row));
  // Index candidates without choosing an owner: every alias remains in its
  // bucket and mutable retained states are still checked at the point of use.
  const alias = (identity: NativeIdentity) => JSON.stringify([identity.dev, identity.ino]);
  const childrenByPath = new Map<string, DiscoverySnapshot["children"][number]>();
  const entriesByPath = new Map<string, DiscoveryEntry>();
  const retainedByPath = new Map<string, ProjectAssociation[]>();
  const recordsByAlias = new Map<string, { row: ProjectAssociation; identity: NativeIdentity }[]>();
  const childrenByAlias = new Map<string, DirectoryObservation[]>();
  for (const child of scan.snapshot.children) {
    if (!childrenByPath.has(child.relativePath)) childrenByPath.set(child.relativePath, child);
    if (child.kind !== "directory") continue;
    const key = alias(child.identity), bucket = childrenByAlias.get(key) ?? [];
    bucket.push(child); childrenByAlias.set(key, bucket);
  }
  for (const entry of entries) if (!entriesByPath.has(entry.relativePath)) entriesByPath.set(entry.relativePath, entry);
  for (const row of retained) {
    const bucket = retainedByPath.get(row.relativePath) ?? [];
    bucket.push(row); retainedByPath.set(row.relativePath, bucket);
  }
  records.forEach((row, index) => {
    const current = identities[index], historical = storedIdentity(row, true);
    for (const identity of [current, historical, ...(row.ownershipNativeIdentities ?? []).map(value=>JSON.parse(value) as NativeIdentity)]) {
      const key = alias(identity), bucket = recordsByAlias.get(key) ?? [];
      bucket.push({row, identity}); recordsByAlias.set(key, bucket);
    }
  });
  for (const row of retained.filter((row) => row.associationState !== "replaced")) {
    const child = childrenByPath.get(row.relativePath);
    if (child?.kind === "excluded" && child.reason === "unresolved") {
      // Grouped scanning suppresses children when parent evidence is insufficient.
      // This is an ambiguous association, not a user or policy exclusion.
      row.associationState = "unresolved";
      continue;
    }
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
    const entry = entriesByPath.get(child.relativePath)!;
    const current = retainedByPath.get(child.relativePath)?.find((row) => row.associationState !== "replaced");
    const reliable = reliableIdentity(child.identity);
    const continuouslyMatching = reliable && current !== undefined &&
      (current.associationState === "active" || current.associationState === "excluded") &&
      reliableIdentity(storedIdentity(current)) && sameIdentity(storedIdentity(current), child.identity);
    const collision = reservations.some((row) => !(row.associationState === "replaced" && continuouslyMatching) &&
      (row.relativePath === child.relativePath ||
      ([storedIdentity(row), storedIdentity(row, true), ...(row.ownershipNativeIdentities ?? []).map(value=>JSON.parse(value) as NativeIdentity)].some(identity => identity.dev === child.identity.dev && identity.ino === child.identity.ino)))) ||
      (recordsByAlias.get(alias(child.identity)) ?? []).some(({row, identity}) => row.id !== current?.id &&
      // Retired evidence alone cannot invalidate a continuously matching active
      // or excluded association established by recovery. New discovery stays conservative.
      !(row.associationState === "replaced" && continuouslyMatching) &&
      (row.relativePath !== child.relativePath || sameIdentity(identity, child.identity))) ||
      (childrenByAlias.get(alias(child.identity)) ?? []).some((other) => other.relativePath !== child.relativePath);
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
        // Placement reservations retain ambiguity without implying a policy
        // exclusion; native replacement and collision checks still run first.
        current.associationState = entry.reason === null ? "active" : entry.reason === "unresolved" ? "unresolved" : "excluded";
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

export interface GroupedProjectAssociation extends ProjectAssociation {
  categoryId: string | null;
}

// Keep historical association state intact. A removed exclusion permits only
// explicit recovery; it must never reactivate an association through discovery.
export function modeRetainedResolution(scan: DiscoveryScan, project: ProjectAssociation, exclusions: string[], archiveRelativePath: string | null): ProjectAssociationState | null {
  if (project.associationState !== "excluded") return scan.snapshot ? project.associationState : null;
  const parts = project.relativePath.split("/");
  const prefixes = parts.map((_, index) => parts.slice(0, index + 1).join("/"));
  const archive = archiveRelativePath?.split("/").slice(0, parts.length).join("/");
  const excluded = exclusions.some((path) => prefixes.includes(path)) ||
    parts.some((name) => automaticDirectoryReason(name, null) !== null) ||
    // Archive containment remains reserved at the historical project's depth.
    !!archive && prefixes.includes(archive) ||
    !!scan.snapshot?.children.some((child) => child.kind === "excluded" &&
      (prefixes.includes(child.relativePath) && ["manual", "hidden", "service", "archive"].includes(child.reason) ||
        child.reason === "archive" && child.relativePath.startsWith(`${project.relativePath}/`)));
  return excluded ? "excluded" : scan.snapshot ? "unresolved" : null;
}

// A project's evidence is meaningful only beneath its continuously matching category.
// Category retirement/exclusion therefore precedes project identity matching.
export function interpretGrouped(scan: DiscoveryScan, categories: ProjectAssociation[], projects: GroupedProjectAssociation[], reservations: ProjectAssociation[] = [], categoryReservations: ProjectAssociation[] = []) {
  if (!scan.snapshot || scan.snapshot.mode !== "grouped") throw new Error("Cannot interpret an incomplete grouped scan");
  const categoryScan: DiscoveryScan = { ...scan,
    entries: scan.entries.filter((entry) => entry.kind === "category"),
    snapshot: { ...scan.snapshot, children: scan.snapshot.children.filter((child) => !child.relativePath.includes("/")) },
  };
  const categoryInterpretation = interpretProjects(categoryScan, categories, categoryReservations);
  const projectScan: DiscoveryScan = { ...scan,
    entries: scan.entries.filter((entry) => entry.kind === "project").map((entry) => ({ ...entry })),
    snapshot: { ...scan.snapshot, children: scan.snapshot.children.filter((child) => child.relativePath.includes("/")) },
  };
  const projectRecords = projects.map((row) => {
    const parent = categoryInterpretation.retained.find((category) => category.id === row.categoryId);
    if (row.associationState === "replaced") return { ...row };
    if (!parent || parent.associationState === "replaced") return { ...row, associationState: "replaced" as const };
    if (parent.associationState === "excluded") {
      // Suppressed children are never accessed. Propagate the reviewed parent exclusion.
      if (!projectScan.snapshot!.children.some((child) => child.relativePath === row.relativePath)) {
        projectScan.snapshot!.children.push({ relativePath: row.relativePath, kind: "excluded", reason: "manual" });
      }
      return { ...row };
    }
    if (parent.associationState !== "active") return { ...row, associationState: parent.associationState };
    return { ...row };
  });
  for (const entry of projectScan.entries) {
    if (entry.kind !== "project") throw new Error("Invalid grouped project entry");
    const parent = categoryInterpretation.entries.find((category) => category.relativePath === entry.categoryPath);
    if (parent?.reason !== null && entry.reason === null) entry.reason = "unresolved";
  }
  const projectInterpretation = interpretProjects(projectScan, projectRecords, reservations);
  return { entries: scan.entries.map((entry) =>
    (entry.kind === "category" ? categoryInterpretation.entries : projectInterpretation.entries)
      .find((interpreted) => interpreted.relativePath === entry.relativePath)!),
    categories: categoryInterpretation, projects: projectInterpretation };
}

// Unfinished creation and rename operations reserve all placements and native
// evidence, including folders observed at a different path after interruption.
// Preserve the raw snapshot for watch topology and complete scan revalidation.
export interface ProjectPlacementReservation { relativePath: string; nativeIdentity: string | null }
export function reserveProjectPlacements(scan: DiscoveryScan, reservations: ProjectPlacementReservation[]): DiscoveryScan {
  return { ...scan, entries: scan.entries.map((entry) => {
    const child = scan.snapshot?.children.find((child) => child.relativePath === entry.relativePath);
    const blocked = reservations.some((row) => {
      const path = filesystemAlias(entry.relativePath), reserved = filesystemAlias(row.relativePath);
      const evidence: NativeIdentity | null = row.nativeIdentity ? JSON.parse(row.nativeIdentity) : null;
      return path === reserved || path.startsWith(`${reserved}/`) ||
        entry.kind === "project" && reserved.startsWith(`${path}/`) ||
        evidence && child && child.kind !== "excluded" && evidence.dev === child.identity.dev && evidence.ino === child.identity.ino;
    });
    return blocked && entry.reason === null ? { ...entry, reason: "unresolved" as const } : { ...entry };
  }) };
}

// Interpret each folder in its target role. Historical project evidence reserves
// project enrollment, but does not turn that same folder into a project category
// identity or transfer its metadata to a newly discovered child.
export function planDiscovery(scan: DiscoveryScan, categories: ProjectAssociation[], projects: GroupedProjectAssociation[], reservations: ProjectPlacementReservation[] = []) {
  scan = reserveProjectPlacements(scan, reservations);
  if (!scan.snapshot) throw new Error("Cannot plan an incomplete scan");
  const mode = scan.snapshot.mode;
  const compatible = projects.filter((row) => !row.modeInactive && (mode === "grouped"
    ? row.categoryId !== null && row.relativePath.split("/").length === 2
    : row.categoryId === null && !row.relativePath.includes("/")));
  const historical = projects.filter((row) => !compatible.includes(row));
  // Only continuously active/excluded category history can be resumed by a
  // reviewed Apply. Failed history keeps its exact prior evidence and state.
  const resumable = categories.filter((row) => !row.modeInactive ||
    row.associationState === "active" || row.associationState === "excluded");
  const dormantCategories = categories.filter((row) => !resumable.includes(row));
  const grouped = mode === "grouped" ? interpretGrouped(scan, resumable, compatible, historical, dormantCategories) : null;
  if (grouped) {
    grouped.categories.retained = categories.map((row) => {
      const target = grouped.categories.retained.find((target) => target.id === row.id);
      if (!target) return { ...row };
      if (row.modeInactive) {
        if (target.associationState !== "active" && target.associationState !== "excluded") return { ...row };
        if (target.associationState === "excluded") return { ...row }; // No current native evidence.
        return { ...target, modeInactive: false };
      }
      return target;
    });
    // Dormant history blocks new enrollment, but superseded replaced history
    // cannot hide an already accepted, continuously verified current category.
    const blockedCategoryPaths = new Set(grouped.categories.retained.filter((category) => category.modeInactive &&
      !grouped.categories.retained.some((current) => !current.modeInactive && current.associationState === "active" &&
        current.relativePath === category.relativePath)).map((category) => category.relativePath));
    grouped.categories.additions = grouped.categories.additions.filter((row) =>
      !blockedCategoryPaths.has(row.relativePath));
    for (const entry of grouped.entries) {
      const categoryPath = entry.kind === "category" ? entry.relativePath : entry.categoryPath;
      if (categoryPath !== null && blockedCategoryPaths.has(categoryPath) && entry.reason === null) entry.reason = "unresolved";
    }
    grouped.projects.additions = grouped.projects.additions.filter((row) =>
      !blockedCategoryPaths.has(row.relativePath.split("/")[0]));
  }
  const interpreted = grouped?.projects ?? interpretProjects(scan, compatible, historical);
  const retained = projects.map((row) => interpreted.retained.find((target) => target.id === row.id) ??
    { ...row, modeInactive: true });
  const effects: DiscoveryProjectEffects = { added: interpreted.additions.map((row) => ({
    relativePath: row.relativePath, name: row.relativePath.split("/").at(-1)!,
    categoryPath: mode === "grouped" ? row.relativePath.split("/")[0] : null,
  })), retained: [], noLongerRecognized: [], alreadyRetained: [] };
  for (const row of projects) {
    const summary = { projectId: row.id, name: row.relativePath.split("/").at(-1)!, relativePath: row.relativePath, categoryId: row.categoryId };
    if (row.modeInactive || row.associationState !== "active") effects.alreadyRetained.push(summary);
    else if (compatible.includes(row) && retained.find((target) => target.id === row.id)?.associationState === "active") effects.retained.push(summary);
    else effects.noLongerRecognized.push(summary);
  }
  for (const rows of [effects.added, effects.retained, effects.noLongerRecognized, effects.alreadyRetained]) {
    rows.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0);
  }
  return { entries: grouped?.entries ?? interpreted.entries,
    projects: { ...interpreted, retained }, categories: grouped?.categories ?? { retained: categories.map((row) => ({ ...row, modeInactive: true })), additions: [], entries: [] }, projectEffects: effects };
}
