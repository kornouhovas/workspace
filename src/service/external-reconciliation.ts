import { storedEvidence } from "./source-identity.js";
import { observeFolder, sameDurableFolder } from "./folder-evidence.js";
import { reserveDurablePlacements, continuityRecords, discoveryEvidence, sameVolumeEvidence, discoveryIdentityState, sourceIdentity, type EvidenceReader } from "./source-identity.js";
import { hasUnfinishedProjectRelocation, readProjectReservations } from "./project-rename-reservations.js";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isChildName, reserveProjectPlacements, projectExclusions, reliableIdentity, sameIdentity, scanDirectSource, scanGroupedSource, validArchive, validExclusions,
  type DirectoryObservation, type DiscoveryScan, type NativeIdentity } from "./discovery.js";
import * as schema from "./db/schema.js";

type Database = BetterSQLite3Database<typeof schema>;
type Source = typeof schema.sources.$inferSelect;
type Project = typeof schema.projects.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Association = (Project | Category) & { originalNativeIdentity?: string; historicalNativeIdentity?: string; ownershipNativeIdentities?: string[] };
function storedIdentity(row: Association, historical = false): NativeIdentity {
  const value = JSON.parse(historical ? row.historicalNativeIdentity ?? row.nativeIdentity : row.nativeIdentity);
  if (!value || typeof value.dev !== "string" || typeof value.ino !== "string" || typeof value.birthtimeNs !== "string") {
    throw new Error("Invalid stored native evidence");
  }
  return value;
}
const nativeAlias = (a: NativeIdentity, b: NativeIdentity) => a.dev === b.dev && a.ino === b.ino;
function indexNativeAliases<T>(values: T[], identity: (value: T) => NativeIdentity) {
  const index = new Map<string, T[]>();
  for (const value of values) {
    const { dev, ino } = identity(value), key = JSON.stringify([dev, ino]);
    const matches = index.get(key) ?? [];
    matches.push(value); index.set(key, matches);
  }
  return (native: NativeIdentity) => index.get(JSON.stringify([native.dev, native.ino])) ?? [];
}

function indexCandidates(scan: DiscoveryScan, directories: DirectoryObservation[]) {
  const eligible = new Set(scan.entries.filter(entry => entry.reason === null).map(entry => entry.relativePath));
  const key = (identity: NativeIdentity) => JSON.stringify([identity.dev, identity.ino, identity.birthtimeNs]);
  const byIdentity = new Map<string, DirectoryObservation[]>();
  for (const child of directories) {
    if (!eligible.has(child.relativePath) || !reliableIdentity(child.identity)) continue;
    const id = key(child.identity), matches = byIdentity.get(id) ?? [];
    matches.push(child); byIdentity.set(id, matches);
  }
  return { eligible: (path: string) => eligible.has(path), matches: (identity: NativeIdentity) => byIdentity.get(key(identity)) ?? [] };
}

// Compute the complete identity mapping before judging old-path occupants. Paths
// reserve placement, while sufficient unchanged native evidence identifies a move.
function directMappings(scan: DiscoveryScan, records: Project[], exclusions: string[], archive: string | null) {
  const directories = scan.snapshot!.children.filter((child): child is DirectoryObservation => child.kind === "directory");
  const identities = records.map(row => storedIdentity(row));
  const ownership = records.map((row:Association) => [storedIdentity(row), storedIdentity(row, true), ...(row.ownershipNativeIdentities??[]).map(value=>JSON.parse(value) as NativeIdentity)]);
  const candidatesByIdentity = indexCandidates(scan, directories);
  const mappings = new Map<string, string>();
  for (const [index, row] of records.entries()) {
    const stored = identities[index];
    if (row.modeInactive || row.associationState !== "active" || !reliableIdentity(stored) || exclusions.includes(row.relativePath) ||
      row.relativePath === archive?.split("/")[0]) continue;
    const candidates = candidatesByIdentity.matches(stored);
    if (candidates.length !== 1) continue;
    const target = candidates[0];
    // Continuously matching same-path associations need no write. In particular,
    // explicit recovery's historical-evidence exception remains path-local.
    if (target.relativePath === row.relativePath) continue;
    if (directories.some((child) => child !== target && nativeAlias(child.identity, target.identity)) ||
      ownership.some((identities, other) => other !== index && identities.some(identity => nativeAlias(identity, target.identity)))) continue;
    mappings.set(row.id, target.relativePath);
  }
  // Removing a blocked owner can block its predecessors too. Keep only complete
  // permutations/chains whose displaced current reservations all move away.
  let removed: boolean;
  do {
    removed = false;
    for (const [id, target] of mappings) {
      const owner = records.find((row) => row.id !== id && row.associationState !== "replaced" && row.relativePath === target);
      if (owner && !mappings.has(owner.id)) { mappings.delete(id); removed = true; }
    }
  } while (removed);
  return mappings;
}

interface Placement { relativePath: string; categoryId: string | null }

function groupedMappings(scan: DiscoveryScan, projects: Project[], categories: Category[], exclusions: string[], archive: string | null, historicalRoot: NativeIdentity) {
  const directories = scan.snapshot!.children.filter((child): child is DirectoryObservation => child.kind === "directory");
  const evidence = [...categories, ...projects].flatMap((row:Association) => [storedIdentity(row), storedIdentity(row, true), ...(row.ownershipNativeIdentities??[]).map(value=>JSON.parse(value) as NativeIdentity)].map(identity => ({row, identity})));
  // Keep every alias, including historical and insufficient birth evidence.
  // The index narrows comparisons; it never chooses an owner or authorizes a move.
  const directoryAliases = indexNativeAliases(directories, child => child.identity);
  const evidenceAliases = indexNativeAliases(evidence, item => item.identity);
  // Index exact, reliable candidate identities once. Keep every alias and all
  // reservation checks below; the index must never choose an ambiguous match.
  const { eligible, matches: candidatesByIdentity } = indexCandidates(scan, directories);
  const suppressed = (path: string) => exclusions.some((excluded) => path === excluded || path.startsWith(`${excluded}/`)) ||
    !!archive && archive.split("/").slice(0, 2).join("/") === path;
  // Reviewed mode changes can retain a direct project over the same physical
  // folder now owned by an operational category. This exact, continuous role
  // history remains legitimate after the category moves; its old project locator
  // must stay dormant. Same-role reservations and reused/ambiguous evidence still
  // block reconciliation, and a new category has no owner for this exception.
  const categoryRoleHistory = (row: Association, owner?: Association) => {
    if (!owner || "categoryId" in owner || owner.modeInactive || owner.associationState !== "active" ||
      !("categoryId" in row) || row.categoryId !== null || !isChildName(row.relativePath) || row.sourceId !== owner.sourceId ||
      !row.modeInactive || !["active","excluded"].includes(row.associationState)) return false;
    // Alias projections may veto adoption, never prove legitimate role history.
    if (row.durableEvidence !== null) {
      const old = storedEvidence(row.durableEvidence), current = storedEvidence(owner.durableEvidence);
      return !!old && !!current && sameDurableFolder(old,current);
    }
    const old = JSON.parse(row.originalNativeIdentity ?? row.nativeIdentity) as NativeIdentity;
    const originalOwner = JSON.parse(owner.originalNativeIdentity ?? owner.nativeIdentity) as NativeIdentity;
    const currentOwner = storedIdentity(owner);
    // A known current category may retain its exact historical cross-role peer
    // across a root-only device change. The original relationship and current
    // inode/creation must agree; synthesized ownership aliases prove none of it.
    return reliableIdentity(old) && reliableIdentity(originalOwner) && reliableIdentity(currentOwner) &&
      sameIdentity(old,originalOwner) && old.ino === currentOwner.ino && old.birthtimeNs === currentOwner.birthtimeNs &&
      (old.dev === currentOwner.dev || old.dev === historicalRoot.dev);
  };
  const conflict = (child: DirectoryObservation, owner?: Association, continuous = false) =>
    directoryAliases(child.identity).some((other) => other !== child) ||
    evidenceAliases(child.identity).some(({ row }) => row.id !== owner?.id &&
      !(continuous && row.associationState === "replaced") && !categoryRoleHistory(row, owner));
  // The same-path recovery exception is continuous only. Cross-path matching
  // still rejects competing same-role records and ambiguous native evidence.
  const candidate = (row: Association) => {
    if (row.modeInactive || row.associationState !== "active" || suppressed(row.relativePath)) return null;
    const identity = storedIdentity(row);
    if (!reliableIdentity(identity)) return null;
    const matches = candidatesByIdentity(identity);
    if (matches.length !== 1) return null;
    const child = matches[0];
    return conflict(child, row, child.relativePath === row.relativePath) ? null : child;
  };
  // Include continuously verified categories for project placement, then discard
  // blocked permutations together with any projects that depend on them.
  const verified = new Map<string, string>();
  for (const category of categories) {
    const child = candidate(category);
    if (child && isChildName(child.relativePath)) verified.set(category.id, child.relativePath);
  }
  const newTargets = directories.filter((child) => isChildName(child.relativePath) && eligible(child.relativePath) &&
    reliableIdentity(child.identity) && !categories.some((row) => row.relativePath === child.relativePath) && !conflict(child));
  const projectCandidates = new Map<string, DirectoryObservation>();
  for (const project of projects) {
    const child = candidate(project);
    if (child?.relativePath.split("/").length === 2) projectCandidates.set(project.id, child);
  }
  let placements = new Map<string, Placement>();
  let removed: boolean;
  do {
    removed = false;
    for (const [id, target] of verified) {
      const owner = categories.find((row) => row.id !== id && row.associationState !== "replaced" && row.relativePath === target);
      if (owner && (!verified.has(owner.id) || verified.get(owner.id) === owner.relativePath)) {
        verified.delete(id); removed = true;
      }
    }
    placements = new Map();
    for (const project of projects) {
      if (!project.categoryId || !verified.has(project.categoryId)) continue;
      const child = projectCandidates.get(project.id);
      if (!child) continue;
      const parent = child.relativePath.split("/")[0];
      const category = categories.find((row) => verified.get(row.id) === parent);
      if (!category && !newTargets.some((target) => target.relativePath === parent)) continue;
      if (child.relativePath !== project.relativePath || category?.id !== project.categoryId) {
        placements.set(project.id, { relativePath: child.relativePath, categoryId: category?.id ?? null });
      }
    }
    let blocked: boolean;
    do {
      blocked = false;
      for (const [id, target] of placements) {
        const owner = projects.find((row) => row.id !== id && row.associationState !== "replaced" && row.relativePath === target.relativePath);
        if (owner && !placements.has(owner.id)) { placements.delete(id); blocked = true; }
      }
    } while (blocked);
    for (const category of categories) {
      if (verified.has(category.id) && verified.get(category.id) !== category.relativePath &&
        projects.some((project) => project.categoryId === category.id && !project.modeInactive && project.associationState === "active" && !placements.has(project.id))) {
        // A parent rename cannot leave an active child at its old locator under
        // SQLite's required-category invariant. Defer the dependent mapping;
        // never infer absent/excluded children's identities or persist absence.
        verified.delete(category.id); removed = true;
      }
    }
  } while (removed);
  const changedCategories = new Map([...verified].filter(([id, path]) => categories.find((row) => row.id === id)!.relativePath !== path));
  const needed = newTargets.filter((child) => [...placements.values()].some((target) => target.categoryId === null && target.relativePath.split("/")[0] === child.relativePath));
  return { projects: placements, categories: changedCategories, needed };
}

// Caller owns post-commit publication. Reconciliation never enrolls projects,
// persists observed missing states, changes authored metadata or writes files.
export function reconcileSource(db: Database, source: Source, observedScan?: DiscoveryScan, scope = "", reader: EvidenceReader = observeFolder): { changed: boolean; scan: DiscoveryScan | null } {
  if (source.discoveryMode !== "direct" && source.discoveryMode !== "grouped") return { changed: false, scan: null };
  const grouped = source.discoveryMode === "grouped";
  const exclusions: unknown = JSON.parse(source.excludedRelativePaths);
  if (!validExclusions(exclusions, "grouped") || !validArchive(source.archiveRelativePath) || !Number.isSafeInteger(source.discoveryRevision) ||
    source.discoveryRevision < 0 || source.appliedRootIdentity === null) throw new Error("Invalid configured source");
  const readReservations = () => readProjectReservations(db, source.id);
  const reservations = readReservations();
  const scanSource = () => reserveDurablePlacements(source,reserveProjectPlacements((grouped ? scanGroupedSource : scanDirectSource)(source.canonicalRoot,
    source.archiveRelativePath, projectExclusions(exclusions, grouped ? "grouped" : "direct").effective), reservations),reservations,scope,reader);
  let scan = observedScan ? reserveDurablePlacements(source,reserveProjectPlacements(observedScan, reservations),reservations,scope,reader) : scanSource();
  if (!scan.snapshot) return { changed: false, scan };
  const peers=()=>db.select().from(schema.sources).all().filter(peer=>peer.id!==source.id);
  const identity = sourceIdentity(source, scan, scope, reader,peers());
  if (identity.state !== "verified") return {changed:false,scan:{state:discoveryIdentityState(identity.state),entries:[],snapshot:null}};
  const evidence = discoveryEvidence(source,scan,scope,reader);
  const rootEvidence=evidence.get("")!;
  if(!rootEvidence.ok || !identity.observation.ok || JSON.stringify(rootEvidence)!==JSON.stringify(identity.observation))
    return {changed:false,scan:{state:"changed",entries:[],snapshot:null}};
  const eligible = (path:string) => {
    const child=evidence.get(path);
    const parent=path.includes("/")?evidence.get(path.split("/")[0]):rootEvidence;
    return !!child && !!parent && sameVolumeEvidence(rootEvidence,child) && sameVolumeEvidence(rootEvidence,parent);
  };
  scan={...scan,entries:scan.entries.map(entry=>entry.reason===null&&!eligible(entry.relativePath)?{...entry,reason:"unresolved"}:entry)};
  // Observe topology but leave source locators untouched until relocation resolution.
  if (hasUnfinishedProjectRelocation(db, source.id)) return { changed: false, scan };
  const readSource = () => db.select().from(schema.sources).where(eq(schema.sources.id, source.id)).get();
  const readProjects = () => db.select().from(schema.projects).where(eq(schema.projects.sourceId, source.id)).orderBy(asc(schema.projects.id)).all();
  const readCategories = () => db.select().from(schema.categories).where(eq(schema.categories.sourceId, source.id)).orderBy(asc(schema.categories.id)).all();
  const readProperty = () => db.select().from(schema.categoryProperties).where(eq(schema.categoryProperties.sourceId, source.id)).get();
  const records = readProjects(), categories = readCategories(), property = readProperty();
  if (grouped && !property || categories.some((row) => !isChildName(row.relativePath)) || records.some((row) =>
    !row.relativePath.split("/").every(isChildName) || row.relativePath.split("/").length > 2 ||
    row.categoryId !== null && !categories.some((category) => category.id === row.categoryId) ||
    !row.modeInactive && (grouped ? row.relativePath.split("/").length !== 2 || !categories.some((category) => category.id === row.categoryId &&
      (row.associationState !== "active" || !category.modeInactive && category.associationState === "active" && row.relativePath.split("/")[0] === category.relativePath)) :
      row.categoryId !== null || !isChildName(row.relativePath)))) throw new Error("Invalid configured associations");
  const mapping = grouped ? groupedMappings(scan, continuityRecords(source, scan, records, scope, reader), continuityRecords(source, scan, categories, scope, reader), exclusions, source.archiveRelativePath, JSON.parse(source.appliedRootIdentity) as NativeIdentity) : null;
  const mappings = mapping?.projects ?? new Map([...directMappings(scan, continuityRecords(source, scan, records, scope, reader), exclusions, source.archiveRelativePath)]
    .map(([id, relativePath]) => [id, { relativePath, categoryId: null }]));
  const categoryMappings = mapping?.categories ?? new Map<string, string>();
  const insertedCategories: Category[] = (mapping?.needed ?? []).map((child) => ({ modeInactive: false, id: randomUUID(), sourceId: source.id,
    relativePath: child.relativePath, nativeIdentity: JSON.stringify(child.identity), durableEvidence: JSON.stringify((evidence.get(child.relativePath) as Extract<import("./folder-evidence.js").FolderObservation,{ok:true}>).evidence), associationState: "active" }));
  for (const target of mappings.values()) if (target.categoryId === null && grouped) {
    target.categoryId = insertedCategories.find((row) => row.relativePath === target.relativePath.split("/")[0])!.id;
  }
  if (mappings.size === 0 && categoryMappings.size === 0) return { changed: false, scan };
  if (!Number.isSafeInteger(source.discoveryRevision + 1)) throw new Error("Invalid discovery revision");
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const verifyScan = () => {
    const current = scanSource();
    if (!current.snapshot || !same(current.snapshot, scan.snapshot) ||
      sourceIdentity(source,current,scope,reader,peers()).state!=="verified" ||
      !same([...discoveryEvidence(source,current,scope,reader)],[...evidence])) throw new Error("Reconciliation observation changed");
  };
  db.transaction((tx) => {
    if (!same(readSource(), source) || !same(readProjects(), records) || !same(readCategories(), categories) || !same(readProperty(), property) || !same(readReservations(), reservations)) throw new Error("Reconciliation configuration changed");
    verifyScan();
    if (hasUnfinishedProjectRelocation(db, source.id)) throw new Error("Unfinished project relocation");
    // Release only participating path reservations, transaction-locally. All
    // final active states are restored before commit; triggers/indexes stay on.
    for (const id of mappings.keys()) tx.update(schema.projects).set({ associationState: "replaced" }).where(eq(schema.projects.id, id)).run();
    for (const id of categoryMappings.keys()) tx.update(schema.categories).set({ associationState: "replaced" }).where(eq(schema.categories.id, id)).run();
    for (const [id, relativePath] of categoryMappings) tx.update(schema.categories).set({ relativePath, associationState: "active" }).where(eq(schema.categories.id, id)).run();
    for (const row of insertedCategories) tx.insert(schema.categories).values(row).run();
    for (const [id, target] of mappings) tx.update(schema.projects).set({ ...target, associationState: "active" }).where(eq(schema.projects.id, id)).run();
    tx.update(schema.sources).set({ discoveryRevision: source.discoveryRevision + 1 }).where(eq(schema.sources.id, source.id)).run();
    verifyScan();
    const expected = records.map((row) => mappings.has(row.id) ? { ...row, ...mappings.get(row.id)! } : row);
    const expectedCategories = [...categories.map((row) => categoryMappings.has(row.id) ? { ...row, relativePath: categoryMappings.get(row.id)! } : row),
      ...insertedCategories].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (!same(readCategories(), expectedCategories) || !same(readProperty(), property) || !same(readSource(), { ...source, discoveryRevision: source.discoveryRevision + 1 }) || !same(readProjects(), expected) || !same(readReservations(), reservations)) {
      throw new Error("Reconciliation stored state changed");
    }
  });
  return { changed: true, scan };
}
